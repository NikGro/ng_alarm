"""Config flow for NG Alarm.

UI setup only. Runtime configuration is edited in the NG Alarm panel page.
"""

from __future__ import annotations

from homeassistant import config_entries

from .const import DOMAIN


class NGAlarmConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle NG Alarm setup in Integrations UI."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Create a single NG Alarm config entry without options."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return self.async_create_entry(title="Alarm", data={})
