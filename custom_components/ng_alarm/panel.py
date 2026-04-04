"""Native Home Assistant panel + API for NG Alarm."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .const import (
    API_GET_CONFIG,
    API_RELOAD,
    API_SET_CONFIG,
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

        if runtime.entity:
            await runtime.entity.async_reload_config(normalized)

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

        if runtime.entity:
            await runtime.entity.async_reload_config(runtime.config)

        return self.json({"ok": True, "config": runtime.config})


async def async_setup_panel(hass) -> None:
    """Register static frontend assets, API views and sidebar panel."""
    frontend_dir = Path(__file__).parent / "frontend"
    if hass.http is not None:
        hass.http.register_static_path(
            PANEL_STATIC_URL,
            str(frontend_dir),
            cache_headers=False,
        )

    hass.http.register_view(NGAlarmConfigView)
    hass.http.register_view(NGAlarmReloadView)

    module_url = f"{PANEL_STATIC_URL}/{PANEL_JS_FILE}"

    try:
        # Register via panel_custom service to get a native sidebar page.
        await hass.services.async_call(
            "panel_custom",
            "register",
            {
                "frontend_url_path": PANEL_URL_PATH,
                "webcomponent_name": PANEL_COMPONENT_NAME,
                "module_url": module_url,
                "sidebar_title": "NG Alarm",
                "sidebar_icon": "mdi:shield-home",
                "require_admin": True,
                "config": {"domain": DOMAIN},
            },
            blocking=True,
        )
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Could not register NG Alarm panel: %s", err)
