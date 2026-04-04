"""Alarm control panel for NG Alarm integration."""
import logging
from datetime import timedelta
from typing import Any, Optional

from homeassistant.components.alarm_control_panel import (
    AlarmControlPanelEntity,
    AlarmControlPanelEntityFeature,
    CodeFormat,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    STATE_ALARM_ARMED_AWAY,
    STATE_ALARM_ARMED_HOME,
    STATE_ALARM_DISARMED,
    STATE_ALARM_PENDING,
    STATE_ALARM_TRIGGERED,
    STATE_UNAVAILABLE,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event, async_call_later
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.helpers.storage import Store

from .const import (
    DOMAIN,
    CONF_NAME,
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
    STORAGE_KEY,
    ATTR_TRIGGERED_SENSOR,
    ATTR_TRIGGERED_SENSOR_NAME,
    ATTR_ALARM_MODE,
    ATTR_ALARM_STATE,
)

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the alarm control panel from a config entry."""
    async_add_entities([NGAlarmControlPanel(hass, config_entry)])


class NGAlarmControlPanel(AlarmControlPanelEntity, RestoreEntity):
    """Representation of an NG Alarm control panel."""

    _attr_code_format = CodeFormat.NUMBER
    _attr_code_arm_required = True
    _attr_supported_features = (
        AlarmControlPanelEntityFeature.ARM_AWAY
        | AlarmControlPanelEntityFeature.ARM_HOME
    )

    def __init__(self, hass: HomeAssistant, config_entry: ConfigEntry):
        """Initialize the alarm control panel."""
        self.hass = hass
        self._config_entry = config_entry
        self._attr_unique_id = config_entry.entry_id
        self._attr_name = config_entry.data.get(CONF_NAME, "NG Alarm")

        # Store reference
        self._store = Store(hass, 1, f"{STORAGE_KEY}_{config_entry.entry_id}")

        # State machine
        self._state = STATE_ALARM_DISARMED
        self._arming_mode = None
        self._triggered_sensor = "unknown"
        self._triggered_sensor_name = "unknown"

        # Timers
        self._exit_timer = None
        self._entry_timer = None

        # Sensor listeners
        self._unsubscribe_sensors = None

        # Load config
        self._config = config_entry.data

    async def async_added_to_hass(self):
        """Run when entity is added to hass."""
        await super().async_added_to_hass()

        # Restore state from storage
        stored = await self._store.async_load()
        if stored:
            self._state = stored.get("state", STATE_ALARM_DISARMED)
            self._arming_mode = stored.get("arming_mode")
            self._triggered_sensor = stored.get("triggered_sensor", "unknown")
            self._triggered_sensor_name = stored.get("triggered_sensor_name", "unknown")

        # Listen for bypass entity changes
        if self._config.get(CONF_BYPASS_ENTITIES):
            async_track_state_change_event(
                self.hass,
                self._config[CONF_BYPASS_ENTITIES],
                self._async_bypass_changed,
            )

    async def _async_save_state(self):
        """Save state to storage."""
        await self._store.async_save({
            "state": self._state,
            "arming_mode": self._arming_mode,
            "triggered_sensor": self._triggered_sensor,
            "triggered_sensor_name": self._triggered_sensor_name,
        })

    def _is_bypass_active(self):
        """Check if bypass condition is active."""
        bypass_entities = self._config.get(CONF_BYPASS_ENTITIES, [])
        bypass_state = self._config.get(CONF_BYPASS_STATE, "")

        if not bypass_entities or not bypass_state:
            return False

        for entity_id in bypass_entities:
            state = self.hass.states.get(entity_id)
            if state and state.state == bypass_state:
                return True

        return False

    def _get_active_sensors(self):
        """Get list of sensors that should be monitored."""
        if self._state == STATE_ALARM_ARMED_AWAY:
            active = list(self._config.get(CONF_AWAY_ACTIVE_SENSORS, []))
            if not self._is_bypass_active():
                active.extend(self._config.get(CONF_AWAY_BYPASS_SENSORS, []))
            return active
        elif self._state == STATE_ALARM_ARMED_HOME:
            active = list(self._config.get(CONF_HOME_ACTIVE_SENSORS, []))
            if not self._is_bypass_active():
                active.extend(self._config.get(CONF_HOME_BYPASS_SENSORS, []))
            return active
        return []

    def _start_sensor_listeners(self):
        """Start listening to sensor state changes."""
        if self._unsubscribe_sensors:
            return

        sensors = self._get_active_sensors()
        if sensors:
            self._unsubscribe_sensors = async_track_state_change_event(
                self.hass,
                sensors,
                self._async_sensor_changed,
            )

    def _stop_sensor_listeners(self):
        """Stop listening to sensor state changes."""
        if self._unsubscribe_sensors:
            self._unsubscribe_sensors()
            self._unsubscribe_sensors = None

    async def _async_sensor_changed(self, event):
        """Handle sensor state changes."""
        if self._state not in [STATE_ALARM_ARMED_AWAY, STATE_ALARM_ARMED_HOME]:
            return

        new_state = event.data.get("new_state")
        if not new_state or new_state.state != "on":
            return

        # Store triggered sensor info (first one wins)
        if self._triggered_sensor == "unknown":
            self._triggered_sensor = event.data["entity_id"]
            entity = self.hass.states.get(self._triggered_sensor)
            self._triggered_sensor_name = entity.attributes.get("friendly_name", self._triggered_sensor) if entity else self._triggered_sensor

            # Cancel existing timers
            if self._entry_timer:
                self._entry_timer()
                self._entry_timer = None

            # Start entry delay
            entry_delay = self._config.get(CONF_ENTRY_DELAY_AWAY if self._state == STATE_ALARM_ARMED_AWAY else CONF_ENTRY_DELAY_HOME, 30)
            
            # Transition to pending
            self._state = STATE_ALARM_PENDING
            await self._async_save_state()
            self.async_write_ha_state()

            # Call pending scripts
            await self._async_run_scripts(CONF_PENDING_SCRIPTS, "pending")

            # Schedule trigger
            self._entry_timer = async_call_later(
                self.hass,
                entry_delay,
                self._async_entry_delay_done,
            )

    async def _async_entry_delay_done(self, _now):
        """Handle entry delay completion."""
        self._entry_timer = None
        if self._state == STATE_ALARM_PENDING:
            await self._async_trigger_alarm()

    async def _async_trigger_alarm(self):
        """Trigger the alarm."""
        self._state = STATE_ALARM_TRIGGERED
        await self._async_save_state()
        self.async_write_ha_state()

        await self._async_run_scripts(CONF_TRIGGERED_SCRIPTS, "triggered")

    async def _async_run_scripts(self, config_key, alarm_state):
        """Run configured scripts with variables."""
        scripts = self._config.get(config_key, [])
        if not scripts:
            return

        variables = {
            ATTR_TRIGGERED_SENSOR: self._triggered_sensor,
            ATTR_TRIGGERED_SENSOR_NAME: self._triggered_sensor_name,
            ATTR_ALARM_MODE: self._arming_mode or "unknown",
            ATTR_ALARM_STATE: alarm_state,
        }

        for script in scripts:
            await self.hass.services.async_call(
                "script",
                "turn_on",
                {"entity_id": script, "variables": variables},
                blocking=False,
            )

    async def async_alarm_disarm(self, code: Optional[str] = None):
        """Send disarm command."""
        alarm_code = str(self._config.get(CONF_ALARM_CODE, ""))
        panic_code = self._config.get(CONF_PANIC_CODE, "")
        
        if panic_code and str(code) == str(panic_code):
            # Panic code used
            await self._async_disarm_internal()
            await self._async_run_scripts(CONF_PANIC_SCRIPTS, "panic")
            return
        
        if alarm_code and str(code) != str(alarm_code):
            _LOGGER.warning("Invalid alarm code")
            return

        await self._async_disarm_internal()
        await self._async_run_scripts(CONF_DISARMED_SCRIPTS, "disarmed")

    async def _async_disarm_internal(self):
        """Internal disarm logic."""
        # Cancel timers
        if self._exit_timer:
            self._exit_timer()
            self._exit_timer = None
        if self._entry_timer:
            self._entry_timer()
            self._entry_timer = None

        # Stop sensor listeners
        self._stop_sensor_listeners()

        # Reset state
        self._state = STATE_ALARM_DISARMED
        self._arming_mode = None
        self._triggered_sensor = "unknown"
        self._triggered_sensor_name = "unknown"

        await self._async_save_state()
        self.async_write_ha_state()

    async def async_alarm_arm_away(self, code: Optional[str] = None):
        """Send arm away command."""
        alarm_code = str(self._config.get(CONF_ALARM_CODE, ""))
        if alarm_code and str(code) != str(alarm_code):
            _LOGGER.warning("Invalid alarm code")
            return

        await self._async_arm(STATE_ALARM_ARMED_AWAY)

    async def async_alarm_arm_home(self, code: Optional[str] = None):
        """Send arm home command."""
        alarm_code = str(self._config.get(CONF_ALARM_CODE, ""))
        if alarm_code and str(code) != str(alarm_code):
            _LOGGER.warning("Invalid alarm code")
            return

        await self._async_arm(STATE_ALARM_ARMED_HOME)

    async def _async_arm(self, arm_mode):
        """Internal arm logic."""
        # Cancel any existing timers/listeners
        if self._exit_timer:
            self._exit_timer()
            self._exit_timer = None
        if self._entry_timer:
            self._entry_timer()
            self._entry_timer = None
        self._stop_sensor_listeners()

        # Reset triggered sensor
        self._triggered_sensor = "unknown"
        self._triggered_sensor_name = "unknown"

        # Set arming mode
        self._arming_mode = arm_mode

        # Get exit delay
        exit_delay = 0
        if arm_mode == STATE_ALARM_ARMED_AWAY:
            exit_delay = self._config.get(CONF_EXIT_DELAY_AWAY, 60)
        else:
            exit_delay = self._config.get(CONF_EXIT_DELAY_HOME, 30)

        if exit_delay > 0:
            # Start arming delay
            self._state = STATE_ALARM_PENDING
            await self._async_save_state()
            self.async_write_ha_state()

            self._exit_timer = async_call_later(
                self.hass,
                exit_delay,
                self._async_exit_delay_done,
            )
        else:
            # Arm immediately
            self._state = arm_mode
            await self._async_save_state()
            self.async_write_ha_state()
            self._start_sensor_listeners()
            await self._async_run_scripts(
                CONF_ARMED_AWAY_SCRIPTS if arm_mode == STATE_ALARM_ARMED_AWAY else CONF_ARMED_HOME_SCRIPTS,
                arm_mode,
            )

    async def _async_exit_delay_done(self, _now):
        """Handle exit delay completion."""
        self._exit_timer = None
        if self._arming_mode:
            self._state = self._arming_mode
            await self._async_save_state()
            self.async_write_ha_state()
            self._start_sensor_listeners()
            await self._async_run_scripts(
                CONF_ARMED_AWAY_SCRIPTS if self._arming_mode == STATE_ALARM_ARMED_AWAY else CONF_ARMED_HOME_SCRIPTS,
                self._arming_mode,
            )

    async def async_alarm_trigger(self, code: Optional[str] = None):
        """Send alarm trigger command."""
        if self._state in [STATE_ALARM_ARMED_AWAY, STATE_ALARM_ARMED_HOME]:
            await self._async_trigger_alarm()

    @property
    def state(self):
        """Return the state of the device."""
        return self._state

    @property
    def extra_state_attributes(self):
        """Return entity specific state attributes."""
        return {
            ATTR_TRIGGERED_SENSOR: self._triggered_sensor,
            ATTR_TRIGGERED_SENSOR_NAME: self._triggered_sensor_name,
            ATTR_ALARM_MODE: self._arming_mode or "unknown",
        }

    async def _async_bypass_changed(self, event):
        """Handle bypass entity changes."""
        # Refresh sensor listeners when bypass changes
        if self._state in [STATE_ALARM_ARMED_AWAY, STATE_ALARM_ARMED_HOME]:
            self._stop_sensor_listeners()
            self._start_sensor_listeners()