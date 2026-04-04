"""Config flow for NG Alarm integration."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from homeassistant.const import CONF_NAME

from .const import (
    DOMAIN,
    CONF_ALARM_CODE,
    CONF_PANIC_CODE,
    CONF_EXIT_DELAY_AWAY,
    CONF_ENTRY_DELAY_AWAY,
    CONF_EXIT_DELAY_HOME,
    CONF_ENTRY_DELAY_HOME,
    CONF_AWAY_ACTIVE_SENSORS,
    CONF_AWAY_BYPASS_SENSORS,
    CONF_HOME_ACTIVE_SENSORS,
    CONF_HOME_BYPASS_SENSORS,
    CONF_BYPASS_ENTITIES,
    CONF_BYPASS_STATE,
    CONF_PENDING_SCRIPTS,
    CONF_TRIGGERED_SCRIPTS,
    CONF_ARMED_AWAY_SCRIPTS,
    CONF_ARMED_HOME_SCRIPTS,
    CONF_DISARMED_SCRIPTS,
    CONF_PANIC_SCRIPTS,
    DEFAULT_NAME,
    DEFAULT_EXIT_DELAY_AWAY,
    DEFAULT_ENTRY_DELAY_AWAY,
    DEFAULT_EXIT_DELAY_HOME,
    DEFAULT_ENTRY_DELAY_HOME,
    DEFAULT_BYPASS_STATE,
)


class NGAlarmConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for NG Alarm."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            if not user_input.get(CONF_ALARM_CODE):
                errors["base"] = "invalid_code"
            else:
                await self.async_set_unique_id(user_input[CONF_NAME])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=user_input.get(CONF_NAME, DEFAULT_NAME),
                    data=user_input,
                )

        # Build schema with all fields in exact order
        schema = vol.Schema({
            vol.Required(CONF_NAME, default=DEFAULT_NAME): str,
            vol.Required(CONF_ALARM_CODE): str,
            vol.Optional(CONF_PANIC_CODE, default=""): str,
            vol.Required(CONF_EXIT_DELAY_AWAY, default=DEFAULT_EXIT_DELAY_AWAY): vol.Coerce(int),
            vol.Required(CONF_ENTRY_DELAY_AWAY, default=DEFAULT_ENTRY_DELAY_AWAY): vol.Coerce(int),
            vol.Required(CONF_EXIT_DELAY_HOME, default=DEFAULT_EXIT_DELAY_HOME): vol.Coerce(int),
            vol.Required(CONF_ENTRY_DELAY_HOME, default=DEFAULT_ENTRY_DELAY_HOME): vol.Coerce(int),
            vol.Optional(CONF_AWAY_ACTIVE_SENSORS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["binary_sensor"])
            ),
            vol.Optional(CONF_AWAY_BYPASS_SENSORS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["binary_sensor"])
            ),
            vol.Optional(CONF_HOME_ACTIVE_SENSORS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["binary_sensor"])
            ),
            vol.Optional(CONF_HOME_BYPASS_SENSORS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["binary_sensor"])
            ),
            vol.Optional(CONF_BYPASS_ENTITIES, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig()
            ),
            vol.Optional(CONF_BYPASS_STATE, default=DEFAULT_BYPASS_STATE): str,
            vol.Optional(CONF_PENDING_SCRIPTS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_TRIGGERED_SCRIPTS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_ARMED_AWAY_SCRIPTS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_ARMED_HOME_SCRIPTS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_DISARMED_SCRIPTS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_PANIC_SCRIPTS, default=[]): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
        })

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Get the options flow for this handler."""
        return NGAlarmOptionsFlow(config_entry)


class NGAlarmOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for NG Alarm."""

    def __init__(self, config_entry):
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        # Get current values or defaults
        current = self.config_entry.data

        schema = vol.Schema({
            vol.Required(CONF_NAME, default=current.get(CONF_NAME, DEFAULT_NAME)): str,
            vol.Required(CONF_ALARM_CODE, default=current.get(CONF_ALARM_CODE, "")): str,
            vol.Optional(CONF_PANIC_CODE, default=current.get(CONF_PANIC_CODE, "")): str,
            vol.Required(CONF_EXIT_DELAY_AWAY, default=current.get(CONF_EXIT_DELAY_AWAY, DEFAULT_EXIT_DELAY_AWAY)): vol.Coerce(int),
            vol.Required(CONF_ENTRY_DELAY_AWAY, default=current.get(CONF_ENTRY_DELAY_AWAY, DEFAULT_ENTRY_DELAY_AWAY)): vol.Coerce(int),
            vol.Required(CONF_EXIT_DELAY_HOME, default=current.get(CONF_EXIT_DELAY_HOME, DEFAULT_EXIT_DELAY_HOME)): vol.Coerce(int),
            vol.Required(CONF_ENTRY_DELAY_HOME, default=current.get(CONF_ENTRY_DELAY_HOME, DEFAULT_ENTRY_DELAY_HOME)): vol.Coerce(int),
            vol.Optional(CONF_AWAY_ACTIVE_SENSORS, default=current.get(CONF_AWAY_ACTIVE_SENSORS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["binary_sensor"])
            ),
            vol.Optional(CONF_AWAY_BYPASS_SENSORS, default=current.get(CONF_AWAY_BYPASS_SENSORS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["binary_sensor"])
            ),
            vol.Optional(CONF_HOME_ACTIVE_SENSORS, default=current.get(CONF_HOME_ACTIVE_SENSORS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["binary_sensor"])
            ),
            vol.Optional(CONF_HOME_BYPASS_SENSORS, default=current.get(CONF_HOME_BYPASS_SENSORS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["binary_sensor"])
            ),
            vol.Optional(CONF_BYPASS_ENTITIES, default=current.get(CONF_BYPASS_ENTITIES, [])): selector.EntitySelector(
                selector.EntitySelectorConfig()
            ),
            vol.Optional(CONF_BYPASS_STATE, default=current.get(CONF_BYPASS_STATE, DEFAULT_BYPASS_STATE)): str,
            vol.Optional(CONF_PENDING_SCRIPTS, default=current.get(CONF_PENDING_SCRIPTS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_TRIGGERED_SCRIPTS, default=current.get(CONF_TRIGGERED_SCRIPTS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_ARMED_AWAY_SCRIPTS, default=current.get(CONF_ARMED_AWAY_SCRIPTS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_ARMED_HOME_SCRIPTS, default=current.get(CONF_ARMED_HOME_SCRIPTS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_DISARMED_SCRIPTS, default=current.get(CONF_DISARMED_SCRIPTS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
            vol.Optional(CONF_PANIC_SCRIPTS, default=current.get(CONF_PANIC_SCRIPTS, [])): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["script"])
            ),
        })

        return self.async_show_form(
            step_id="init",
            data_schema=schema,
        )