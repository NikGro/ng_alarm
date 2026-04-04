"""The NG Alarm integration (no config flow, native panel driven)."""

from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant
from homeassistant.helpers import discovery

from .config import NGAlarmRuntime, create_store, load_config
from .const import DOMAIN, RUNTIME_STATE_KEY
from .panel import async_setup_panel

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up NG Alarm from YAML/bootstrap and persistent storage."""
    hass.data.setdefault(DOMAIN, {})

    store = create_store(hass)
    persisted = await load_config(store)

    runtime = NGAlarmRuntime(store=store, config=persisted)
    hass.data[DOMAIN][RUNTIME_STATE_KEY] = runtime

    await async_setup_panel(hass)

    async def _handle_reload_service(call):
        runtime.config = await load_config(store)
        if runtime.entity:
            await runtime.entity.async_reload_config(runtime.config)

    hass.services.async_register(DOMAIN, "reload", _handle_reload_service)

    # Load alarm panel platform once.
    await discovery.async_load_platform(hass, "alarm_control_panel", DOMAIN, {}, config)
    _LOGGER.debug("NG Alarm setup complete")
    return True
