"""The NG Alarm integration (panel-driven config + UI setup flow)."""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .config import NGAlarmRuntime, create_store, load_config
from .const import DOMAIN, RUNTIME_STATE_KEY
from .panel import async_setup_panel

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.ALARM_CONTROL_PANEL, Platform.SENSOR]


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up NG Alarm component."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up NG Alarm from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    if RUNTIME_STATE_KEY not in hass.data[DOMAIN]:
        store = create_store(hass)
        persisted = await load_config(store)
        runtime = NGAlarmRuntime(store=store, config=persisted)
        hass.data[DOMAIN][RUNTIME_STATE_KEY] = runtime

        async def _handle_reload_service(call):
            runtime.config = await load_config(store)
            if runtime.entity:
                await runtime.entity.async_reload_config(runtime.config)

        if not hass.services.has_service(DOMAIN, "reload"):
            hass.services.async_register(DOMAIN, "reload", _handle_reload_service)

        await async_setup_panel(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload NG Alarm config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
