"""Native Home Assistant panel + API for NG Alarm."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from aiohttp import web
from homeassistant.components.frontend import (
    add_extra_js_url,
    async_register_built_in_panel,
)
from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers import entity_registry as er

from .const import (
    API_EVENTS,
    API_EVENTS_CLEAR,
    API_GET_CONFIG,
    API_RELOAD,
    CONF_MODES,
    DOMAIN,
    PANEL_COMPONENT_NAME,
    PANEL_JS_FILE,
    PANEL_STATIC_URL,
    PANEL_URL_PATH,
    RUNTIME_STATE_KEY,
)
from .config import normalize_config, save_config

_LOGGER = logging.getLogger(__name__)


class NGAlarmConfigView(HomeAssistantView):
    """Read/write NG Alarm configuration."""

    url = API_GET_CONFIG
    name = "api:ng_alarm:config"
    requires_auth = True

    async def get(self, request):
        """Return current config."""
        hass = request.app["hass"]
        runtime = hass.data[DOMAIN][RUNTIME_STATE_KEY]
        return self.json(runtime.config)

    async def post(self, request):
        """Persist config and reload runtime."""
        hass = request.app["hass"]
        runtime = hass.data[DOMAIN][RUNTIME_STATE_KEY]

        payload = await request.json()
        normalized = await save_config(runtime.store, payload)
        runtime.config = normalized

        # Remove orphaned zone entities from entity registry when zones were deleted.
        entries = hass.config_entries.async_entries(DOMAIN)
        if entries:
            entry_id = entries[0].entry_id
            registry = er.async_get(hass)
            zone_ids = {
                str((z or {}).get("id", "")).strip().lower().replace(" ", "_")
                for z in normalized.get(CONF_MODES, [])
                if isinstance(z, dict) and str((z or {}).get("id", "")).strip()
            }
            keep_unique_ids = {f"{DOMAIN}_{zid}" for zid in zone_ids} or {f"{DOMAIN}_main"}
            # Support current and legacy event-log sensor unique-id formats.
            keep_event_sensor_ids = (
                {f"ng_alarm_event_log_{zid}" for zid in zone_ids}
                | {f"{DOMAIN}_eventsensor_{zid}" for zid in zone_ids}
            ) or {"ng_alarm_event_log_main", f"{DOMAIN}_eventsensor_main"}
            expose_event_sensor = bool(normalized.get("expose_event_log_sensor", False))
            for entry in er.async_entries_for_config_entry(registry, entry_id):
                uid = entry.unique_id or ""
                if entry.domain == "alarm_control_panel":
                    if uid.startswith(f"{DOMAIN}_") and uid not in keep_unique_ids:
                        registry.async_remove(entry.entity_id)
                elif entry.domain == "sensor":
                    if uid.startswith("ng_alarm_event_log_") or uid.startswith(f"{DOMAIN}_eventsensor_"):
                        if (not expose_event_sensor) or (uid not in keep_event_sensor_ids):
                            registry.async_remove(entry.entity_id)

        for entity in (runtime.entities or ([runtime.entity] if runtime.entity else [])):
            if entity:
                await entity.async_reload_config(normalized)

        try:
            if entries:
                await hass.services.async_call(
                    "homeassistant",
                    "reload_config_entry",
                    {"entry_id": entries[0].entry_id},
                    blocking=True,
                )
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("reload_config_entry after save failed: %s", err)

        return self.json({"ok": True, "config": normalized})


class NGAlarmReloadView(HomeAssistantView):
    """Reload runtime from persisted storage."""

    url = API_RELOAD
    name = "api:ng_alarm:reload"
    requires_auth = True

    async def post(self, request):
        """Reload alarm runtime and entity listeners."""
        hass = request.app["hass"]
        runtime = hass.data[DOMAIN][RUNTIME_STATE_KEY]
        runtime.config = normalize_config(await runtime.store.async_load())

        for entity in (runtime.entities or ([runtime.entity] if runtime.entity else [])):
            if entity:
                await entity.async_reload_config(runtime.config)

        return self.json({"ok": True, "config": runtime.config})


class NGAlarmEventsView(HomeAssistantView):
    """Expose event log for panel display."""

    url = API_EVENTS
    name = "api:ng_alarm:events"
    requires_auth = True

    async def get(self, request):
        hass = request.app["hass"]
        runtime = hass.data[DOMAIN][RUNTIME_STATE_KEY]
        entities = runtime.entities or ([runtime.entity] if runtime.entity else [])

        wanted_zone = str(request.query.get("zone", "all") or "all").strip().lower()
        by_zone: dict[str, list[dict[str, Any]]] = {}
        zones: list[str] = []

        for entity in entities:
            if not entity:
                continue
            zone_id = getattr(entity, "_zone_id", None) or "main"
            zones.append(zone_id)
            if wanted_zone != "all" and zone_id != wanted_zone:
                continue
            z_events = list(entity.get_event_log())
            z_events.sort(key=lambda x: x.get("ts", 0))
            by_zone[zone_id] = z_events[-500:]

        events = []
        for z, z_events in by_zone.items():
            for ev in z_events:
                merged = dict(ev)
                merged.setdefault("zone", z)
                events.append(merged)
        events.sort(key=lambda x: x.get("ts", 0))

        return self.json({"events": events[-500:], "events_by_zone": by_zone, "zones": sorted(set(zones))})


class NGAlarmEventsClearView(HomeAssistantView):
    """Clear event log from panel."""

    url = API_EVENTS_CLEAR
    name = "api:ng_alarm:events_clear"
    requires_auth = True

    async def post(self, request):
        hass = request.app["hass"]
        runtime = hass.data[DOMAIN][RUNTIME_STATE_KEY]
        payload = await request.json() if request.can_read_body else {}
        wanted_zone = str(payload.get("zone", "all") or "all").strip().lower()

        for entity in (runtime.entities or ([runtime.entity] if runtime.entity else [])):
            if not entity:
                continue
            zone_id = getattr(entity, "_zone_id", None) or "main"
            if wanted_zone != "all" and wanted_zone != zone_id:
                continue
            await entity.async_clear_event_log()
        return self.json({"ok": True})


async def async_setup_panel(hass) -> None:
    """Register static frontend assets, API views and sidebar panel."""
    frontend_dir = Path(__file__).parent / "frontend"
    if hass.http is None:
        return

    # HA API changed over time; support both static registration styles.
    if hasattr(hass.http, "async_register_static_paths"):
        try:
            from homeassistant.components.http import StaticPathConfig

            await hass.http.async_register_static_paths(
                [StaticPathConfig(PANEL_STATIC_URL, str(frontend_dir), False)]
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Could not register static panel path (new API): %s", err)
    elif hasattr(hass.http, "register_static_path"):
        try:
            hass.http.register_static_path(
                PANEL_STATIC_URL,
                str(frontend_dir),
                cache_headers=False,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Could not register static panel path (legacy API): %s", err)

    hass.http.register_view(NGAlarmConfigView)
    hass.http.register_view(NGAlarmReloadView)
    hass.http.register_view(NGAlarmEventsView)
    hass.http.register_view(NGAlarmEventsClearView)

    module_url = f"{PANEL_STATIC_URL}/{PANEL_JS_FILE}?v={int(time.time())}"

    try:
        # Modern HA approach: register module url + built-in panel entry.
        add_extra_js_url(hass, module_url)
        async_register_built_in_panel(
            hass,
            PANEL_COMPONENT_NAME,
            sidebar_title="Alarm",
            sidebar_icon="mdi:shield-home",
            frontend_url_path=PANEL_URL_PATH,
            config={"domain": DOMAIN},
            require_admin=True,
            update=True,
        )
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Could not register NG Alarm panel via frontend API: %s", err)

        # Fallback for older setups where panel_custom register service still exists.
        if hass.services.has_service("panel_custom", "register"):
            try:
                await hass.services.async_call(
                    "panel_custom",
                    "register",
                    {
                        "frontend_url_path": PANEL_URL_PATH,
                        "webcomponent_name": f"ha-panel-{PANEL_COMPONENT_NAME}",
                        "module_url": module_url,
                        "sidebar_title": "Alarm",
                        "sidebar_icon": "mdi:shield-home",
                        "require_admin": True,
                        "config": {"domain": DOMAIN},
                    },
                    blocking=True,
                )
            except Exception as fallback_err:  # noqa: BLE001
                _LOGGER.warning(
                    "Could not register NG Alarm panel via panel_custom fallback: %s",
                    fallback_err,
                )
