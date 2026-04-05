"""Alarm control panel entity for NG Alarm."""

from __future__ import annotations

import logging
import time
from typing import Any

from homeassistant.components.alarm_control_panel import (
    AlarmControlPanelEntity,
    AlarmControlPanelEntityFeature,
    AlarmControlPanelState,
    CodeFormat,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.storage import Store
from homeassistant.helpers.template import Template, TemplateError, result_as_boolean

from .const import (
    ATTR_ALARM_MODE,
    ATTR_ALARM_STATE,
    ATTR_ACTOR,
    ATTR_TRIGGERED_SENSOR,
    ATTR_TRIGGERED_SENSOR_NAME,
    CONF_ALARM_CODE,
    CONF_ACTIONS,
    CONF_ACTION_FROM,
    CONF_ACTION_SCRIPTS,
    CONF_ACTION_THROUGH,
    CONF_ACTION_TO,
    CONF_ARMED_AWAY_SCRIPTS,
    CONF_ARMED_HOME_SCRIPTS,
    CONF_AWAY_ACTIVE_SENSORS,
    CONF_AWAY_BYPASS_SENSORS,
    CONF_AWAY_TRIGGER_STATES,
    CONF_BYPASS_ENTITIES,
    CONF_BYPASS_MODE,
    CONF_BYPASS_STATE,
    CONF_BYPASS_TEMPLATE,
    CONF_DISARMED_SCRIPTS,
    CONF_ENTRY_DELAY_AWAY,
    CONF_ENTRY_DELAY_HOME,
    CONF_EXIT_DELAY_AWAY,
    CONF_EXIT_DELAY_HOME,
    CONF_HOME_ACTIVE_SENSORS,
    CONF_HOME_BYPASS_SENSORS,
    CONF_HOME_TRIGGER_STATES,
    CONF_IGNORE_UNAVAILABLE_STATES,
    CONF_IGNORE_UNKNOWN_STATES,
    CONF_NAME,
    CONF_PANIC_CODE,
    CONF_PANIC_SCRIPTS,
    CONF_PENDING_SCRIPTS,
    CONF_TRIGGERED_SCRIPTS,
    CONF_USERS,
    CONF_USER_CAN_ARM,
    CONF_USER_CAN_DISARM,
    CONF_USER_CAN_PANIC,
    CONF_USER_CODE,
    CONF_USER_NAME,
    DOMAIN,
    RUNTIME_STATE_KEY,
    STORAGE_KEY,
    UNKNOWN,
    BYPASS_MODE_TEMPLATE,
)

_LOGGER = logging.getLogger(__name__)


def _state_str(state: AlarmControlPanelState) -> str:
    """Return legacy string representation for scripts."""
    return {
        AlarmControlPanelState.DISARMED: "disarmed",
        AlarmControlPanelState.ARMING: "arming",
        AlarmControlPanelState.ARMED_AWAY: "armed_away",
        AlarmControlPanelState.ARMED_HOME: "armed_home",
        AlarmControlPanelState.PENDING: "pending",
        AlarmControlPanelState.TRIGGERED: "triggered",
    }[state]


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
) -> None:
    """Set up platform from config entry."""
    runtime = hass.data[DOMAIN][RUNTIME_STATE_KEY]
    entity = NGAlarmControlPanel(hass, runtime.config)
    runtime.entity = entity
    async_add_entities([entity])


class NGAlarmControlPanel(AlarmControlPanelEntity):
    """NG Alarm control panel implementation."""

    _attr_supported_features = (
        AlarmControlPanelEntityFeature.ARM_AWAY | AlarmControlPanelEntityFeature.ARM_HOME
    )
    _attr_code_format = CodeFormat.NUMBER
    _attr_code_arm_required = True

    def __init__(self, hass: HomeAssistant, config: dict[str, Any]) -> None:
        self.hass = hass
        self._store = Store(hass, 1, f"{STORAGE_KEY}.runtime")
        self._config = config
        self._attr_name = config.get(CONF_NAME, "NG Alarm")
        self._attr_unique_id = f"{DOMAIN}_main"

        self._alarm_state = AlarmControlPanelState.DISARMED
        self._armed_mode: AlarmControlPanelState | None = None
        self._triggered_sensor = UNKNOWN
        self._triggered_sensor_name = UNKNOWN
        self._last_actor = UNKNOWN
        self._event_log: list[dict[str, Any]] = []

        self._exit_unsub = None
        self._entry_unsub = None
        self._sensor_unsub = None
        self._bypass_unsub = None

    @property
    def alarm_state(self) -> AlarmControlPanelState:
        """Return alarm state enum (required by modern HA)."""
        return self._alarm_state

    @property
    def extra_state_attributes(self):
        return {
            ATTR_TRIGGERED_SENSOR: self._triggered_sensor,
            ATTR_TRIGGERED_SENSOR_NAME: self._triggered_sensor_name,
            ATTR_ALARM_MODE: _state_str(self._armed_mode) if self._armed_mode else UNKNOWN,
            ATTR_ACTOR: self._last_actor,
        }

    async def async_added_to_hass(self) -> None:
        saved = await self._store.async_load()
        if saved:
            raw = saved.get("state", "disarmed")
            self._alarm_state = {
                "disarmed": AlarmControlPanelState.DISARMED,
                "arming": AlarmControlPanelState.ARMING,
                "armed_away": AlarmControlPanelState.ARMED_AWAY,
                "armed_home": AlarmControlPanelState.ARMED_HOME,
                "pending": AlarmControlPanelState.PENDING,
                "triggered": AlarmControlPanelState.TRIGGERED,
            }.get(raw, AlarmControlPanelState.DISARMED)
            raw_mode = saved.get("armed_mode")
            self._armed_mode = {
                "armed_away": AlarmControlPanelState.ARMED_AWAY,
                "armed_home": AlarmControlPanelState.ARMED_HOME,
            }.get(raw_mode)
            self._triggered_sensor = saved.get("triggered_sensor", UNKNOWN)
            self._triggered_sensor_name = saved.get("triggered_sensor_name", UNKNOWN)
            self._last_actor = saved.get("last_actor", UNKNOWN)
            self._event_log = list(saved.get("event_log", []))[-200:]

        await self._async_bind_bypass_listener()
        if self._alarm_state in (
            AlarmControlPanelState.ARMED_AWAY,
            AlarmControlPanelState.ARMED_HOME,
        ):
            self._async_refresh_sensor_listener()

    async def async_will_remove_from_hass(self) -> None:
        self._cancel_timers()
        self._remove_listeners()

    async def async_reload_config(self, new_config: dict[str, Any]) -> None:
        self._config = new_config
        self._attr_name = self._config.get(CONF_NAME, "NG Alarm")
        await self._async_bind_bypass_listener()
        self._async_refresh_sensor_listener()
        self.async_write_ha_state()

    async def _async_persist_runtime(self) -> None:
        await self._store.async_save(
            {
                "state": _state_str(self._alarm_state),
                "armed_mode": _state_str(self._armed_mode) if self._armed_mode else None,
                "triggered_sensor": self._triggered_sensor,
                "triggered_sensor_name": self._triggered_sensor_name,
                "last_actor": self._last_actor,
                "event_log": self._event_log[-200:],
            }
        )

    def get_event_log(self) -> list[dict[str, Any]]:
        """Return latest alarm event log entries."""
        return list(self._event_log)

    async def async_clear_event_log(self) -> None:
        """Clear event log and persist state."""
        self._event_log = []
        await self._async_persist_runtime()

    async def _async_log_event(self, event_type: str, message: str, **meta: Any) -> None:
        entry = {
            "ts": int(time.time()),
            "event": event_type,
            "message": message,
            "state": _state_str(self._alarm_state),
            "mode": _state_str(self._armed_mode) if self._armed_mode else UNKNOWN,
            "actor": self._last_actor,
        }
        entry.update({k: v for k, v in meta.items() if v is not None})
        self._event_log.append(entry)
        self._event_log = self._event_log[-200:]
        await self._async_persist_runtime()

    def _resolve_user_from_code(self, code: str | None) -> dict[str, Any] | None:
        entered = str(code or "")
        for user in self._config.get(CONF_USERS, []):
            if entered and str(user.get(CONF_USER_CODE, "")) == entered:
                return user
        return None

    def _with_users(self) -> bool:
        return bool(self._config.get(CONF_USERS))

    def _actor_name(self, user: dict[str, Any] | None) -> str:
        if user:
            return str(user.get(CONF_USER_NAME, "") or "user")
        return UNKNOWN

    def _action_matches(self, filters: list[str], value: str) -> bool:
        if not filters:
            return True
        normalized = {str(v).strip().lower() for v in filters if str(v).strip()}
        if not normalized:
            return True
        return "any" in normalized or str(value).strip().lower() in normalized

    async def _async_run_transition_actions(
        self,
        from_state: str,
        to_state: str,
        alarm_state: str,
    ) -> None:
        through_state = _state_str(self._armed_mode) if self._armed_mode else UNKNOWN
        variables = {
            ATTR_TRIGGERED_SENSOR: self._triggered_sensor,
            ATTR_TRIGGERED_SENSOR_NAME: self._triggered_sensor_name,
            ATTR_ALARM_MODE: through_state,
            ATTR_ALARM_STATE: alarm_state,
            ATTR_ACTOR: self._last_actor,
            "from_state": from_state,
            "to_state": to_state,
        }
        for action in self._config.get(CONF_ACTIONS, []):
            if not isinstance(action, dict):
                continue
            if not self._action_matches(action.get(CONF_ACTION_FROM, []), from_state):
                continue
            if not self._action_matches(action.get(CONF_ACTION_TO, []), to_state):
                continue
            if not self._action_matches(action.get(CONF_ACTION_THROUGH, []), through_state):
                continue

            for entity_id in action.get(CONF_ACTION_SCRIPTS, []):
                await self.hass.services.async_call(
                    "script",
                    "turn_on",
                    {"entity_id": entity_id, "variables": variables},
                    blocking=False,
                )

    async def _async_run_scripts(self, key: str, alarm_state: str) -> None:
        variables = {
            ATTR_TRIGGERED_SENSOR: self._triggered_sensor,
            ATTR_TRIGGERED_SENSOR_NAME: self._triggered_sensor_name,
            ATTR_ALARM_MODE: _state_str(self._armed_mode) if self._armed_mode else UNKNOWN,
            ATTR_ALARM_STATE: alarm_state,
            ATTR_ACTOR: self._last_actor,
        }
        for entity_id in self._config.get(key, []):
            await self.hass.services.async_call(
                "script",
                "turn_on",
                {"entity_id": entity_id, "variables": variables},
                blocking=False,
            )

    def _cancel_timers(self) -> None:
        if self._exit_unsub:
            self._exit_unsub()
            self._exit_unsub = None
        if self._entry_unsub:
            self._entry_unsub()
            self._entry_unsub = None

    def _remove_listeners(self) -> None:
        if self._sensor_unsub:
            self._sensor_unsub()
            self._sensor_unsub = None
        if self._bypass_unsub:
            self._bypass_unsub()
            self._bypass_unsub = None

    async def _async_bind_bypass_listener(self) -> None:
        if self._bypass_unsub:
            self._bypass_unsub()
            self._bypass_unsub = None
        entities = self._config.get(CONF_BYPASS_ENTITIES, [])
        if entities:
            self._bypass_unsub = async_track_state_change_event(
                self.hass, entities, self._async_bypass_changed
            )

    def _is_bypass_active(self) -> bool:
        if self._config.get(CONF_BYPASS_MODE) == BYPASS_MODE_TEMPLATE:
            tpl = str(self._config.get(CONF_BYPASS_TEMPLATE, "")).strip()
            if not tpl:
                return False
            try:
                rendered = Template(tpl, self.hass).async_render(parse_result=False)
                return result_as_boolean(rendered)
            except TemplateError as err:
                _LOGGER.debug("Bypass template render failed: %s", err)
                return False

        bypass_state = str(self._config.get(CONF_BYPASS_STATE, ""))
        if not bypass_state:
            return False
        for entity_id in self._config.get(CONF_BYPASS_ENTITIES, []):
            state = self.hass.states.get(entity_id)
            if state and state.state == bypass_state:
                return True
        return False

    def _trigger_states(self) -> set[str]:
        if self._alarm_state == AlarmControlPanelState.ARMED_AWAY:
            return {
                str(v).lower()
                for v in self._config.get(CONF_AWAY_TRIGGER_STATES, ["on"])
                if str(v).strip()
            }
        if self._alarm_state == AlarmControlPanelState.ARMED_HOME:
            return {
                str(v).lower()
                for v in self._config.get(CONF_HOME_TRIGGER_STATES, ["on"])
                if str(v).strip()
            }
        return {"on"}

    def _monitored_sensors(self) -> list[str]:
        if self._alarm_state == AlarmControlPanelState.ARMED_AWAY:
            sensors = list(self._config.get(CONF_AWAY_ACTIVE_SENSORS, []))
            if not self._is_bypass_active():
                sensors += list(self._config.get(CONF_AWAY_BYPASS_SENSORS, []))
            return sensors
        if self._alarm_state == AlarmControlPanelState.ARMED_HOME:
            sensors = list(self._config.get(CONF_HOME_ACTIVE_SENSORS, []))
            if not self._is_bypass_active():
                sensors += list(self._config.get(CONF_HOME_BYPASS_SENSORS, []))
            return sensors
        return []

    def _async_refresh_sensor_listener(self) -> None:
        if self._sensor_unsub:
            self._sensor_unsub()
            self._sensor_unsub = None
        sensors = self._monitored_sensors()
        if sensors:
            self._sensor_unsub = async_track_state_change_event(
                self.hass, sensors, self._async_sensor_changed
            )

    async def _async_bypass_changed(self, _event) -> None:
        if self._alarm_state in (
            AlarmControlPanelState.ARMED_AWAY,
            AlarmControlPanelState.ARMED_HOME,
        ):
            self._async_refresh_sensor_listener()

    async def _async_sensor_changed(self, event) -> None:
        if self._alarm_state not in (
            AlarmControlPanelState.ARMED_AWAY,
            AlarmControlPanelState.ARMED_HOME,
        ):
            return

        new_state = event.data.get("new_state")
        if not new_state:
            return

        new_state_value = str(new_state.state).lower()
        if (
            new_state_value == "unknown"
            and self._config.get(CONF_IGNORE_UNKNOWN_STATES, True)
        ):
            return
        if (
            new_state_value == "unavailable"
            and self._config.get(CONF_IGNORE_UNAVAILABLE_STATES, True)
        ):
            return

        if new_state_value not in self._trigger_states():
            return

        prev = _state_str(self._alarm_state)
        if self._triggered_sensor == UNKNOWN:
            entity_id = event.data.get("entity_id", UNKNOWN)
            self._triggered_sensor = entity_id
            state_obj = self.hass.states.get(entity_id)
            self._triggered_sensor_name = (
                state_obj.attributes.get("friendly_name", entity_id) if state_obj else entity_id
            )

        self._alarm_state = AlarmControlPanelState.PENDING
        self.async_write_ha_state()
        await self._async_persist_runtime()
        await self._async_log_event(
            "sensor_pending",
            f"Sensor {self._triggered_sensor_name} triggered pending state",
            sensor=self._triggered_sensor,
        )
        await self._async_run_transition_actions(prev, "pending", "pending")
        await self._async_run_scripts(CONF_PENDING_SCRIPTS, "pending")

        delay = self._config.get(
            CONF_ENTRY_DELAY_AWAY
            if self._armed_mode == AlarmControlPanelState.ARMED_AWAY
            else CONF_ENTRY_DELAY_HOME,
            0,
        )
        self._cancel_timers()
        self._entry_unsub = async_call_later(self.hass, delay, self._async_finish_entry_delay)

    async def _async_finish_entry_delay(self, _now):
        self._entry_unsub = None
        prev = _state_str(self._alarm_state)
        self._alarm_state = AlarmControlPanelState.TRIGGERED
        self.async_write_ha_state()
        await self._async_persist_runtime()
        await self._async_log_event("triggered", "Alarm switched to TRIGGERED")
        await self._async_run_transition_actions(prev, "triggered", "triggered")
        await self._async_run_scripts(CONF_TRIGGERED_SCRIPTS, "triggered")

    async def _async_finish_exit_delay(self, _now):
        self._exit_unsub = None
        prev = _state_str(self._alarm_state)
        self._alarm_state = self._armed_mode or AlarmControlPanelState.ARMED_AWAY
        self.async_write_ha_state()
        await self._async_persist_runtime()
        self._async_refresh_sensor_listener()
        to_state = _state_str(self._alarm_state)
        await self._async_log_event("armed", f"Alarm armed as {to_state}")
        await self._async_run_transition_actions(prev, to_state, to_state)

        if self._alarm_state == AlarmControlPanelState.ARMED_AWAY:
            await self._async_run_scripts(CONF_ARMED_AWAY_SCRIPTS, "armed_away")
        elif self._alarm_state == AlarmControlPanelState.ARMED_HOME:
            await self._async_run_scripts(CONF_ARMED_HOME_SCRIPTS, "armed_home")

    def _code_ok(self, given, expected: str) -> bool:
        return str(given or "") == str(expected or "")

    async def async_alarm_arm_away(self, code=None) -> None:
        actor = UNKNOWN
        if self._with_users():
            user = self._resolve_user_from_code(code)
            if not user or not bool(user.get(CONF_USER_CAN_ARM, False)):
                await self._async_log_event("denied", "Denied arm away: code/permission mismatch")
                return
            actor = self._actor_name(user)
        elif not self._code_ok(code, self._config.get(CONF_ALARM_CODE, "")):
            await self._async_log_event("denied", "Denied arm away: invalid code")
            return
        self._last_actor = actor
        await self._async_arm(
            AlarmControlPanelState.ARMED_AWAY, int(self._config.get(CONF_EXIT_DELAY_AWAY, 0))
        )

    async def async_alarm_arm_home(self, code=None) -> None:
        actor = UNKNOWN
        if self._with_users():
            user = self._resolve_user_from_code(code)
            if not user or not bool(user.get(CONF_USER_CAN_ARM, False)):
                await self._async_log_event("denied", "Denied arm home: code/permission mismatch")
                return
            actor = self._actor_name(user)
        elif not self._code_ok(code, self._config.get(CONF_ALARM_CODE, "")):
            await self._async_log_event("denied", "Denied arm home: invalid code")
            return
        self._last_actor = actor
        await self._async_arm(
            AlarmControlPanelState.ARMED_HOME, int(self._config.get(CONF_EXIT_DELAY_HOME, 0))
        )

    async def _async_arm(self, mode: AlarmControlPanelState, delay: int) -> None:
        self._cancel_timers()
        self._triggered_sensor = UNKNOWN
        self._triggered_sensor_name = UNKNOWN
        self._armed_mode = mode
        prev = _state_str(self._alarm_state)

        self._alarm_state = AlarmControlPanelState.ARMING if delay > 0 else mode
        self.async_write_ha_state()
        await self._async_persist_runtime()
        to_state = _state_str(self._alarm_state)
        await self._async_log_event("arming", f"Alarm changed to {to_state}")
        await self._async_run_transition_actions(prev, to_state, to_state)

        if delay > 0:
            self._exit_unsub = async_call_later(self.hass, delay, self._async_finish_exit_delay)
        else:
            self._async_refresh_sensor_listener()
            if mode == AlarmControlPanelState.ARMED_AWAY:
                await self._async_run_scripts(CONF_ARMED_AWAY_SCRIPTS, "armed_away")
            else:
                await self._async_run_scripts(CONF_ARMED_HOME_SCRIPTS, "armed_home")

    async def async_alarm_disarm(self, code=None) -> None:
        panic = False
        actor = UNKNOWN
        if self._with_users():
            user = self._resolve_user_from_code(code)
            if not user:
                await self._async_log_event("denied", "Denied disarm: unknown user code")
                return
            actor = self._actor_name(user)
            if bool(user.get(CONF_USER_CAN_PANIC, False)):
                panic = True
            elif not bool(user.get(CONF_USER_CAN_DISARM, False)):
                await self._async_log_event("denied", "Denied disarm: missing disarm permission")
                return
        else:
            panic_code = str(self._config.get(CONF_PANIC_CODE, ""))
            alarm_code = str(self._config.get(CONF_ALARM_CODE, ""))
            panic = bool(panic_code and self._code_ok(code, panic_code))
            if not panic and not self._code_ok(code, alarm_code):
                await self._async_log_event("denied", "Denied disarm: invalid code")
                return

        self._last_actor = actor

        self._cancel_timers()
        self._remove_listeners()
        await self._async_bind_bypass_listener()
        prev = _state_str(self._alarm_state)

        self._alarm_state = AlarmControlPanelState.DISARMED
        self._armed_mode = None
        self._triggered_sensor = UNKNOWN
        self._triggered_sensor_name = UNKNOWN
        self.async_write_ha_state()
        await self._async_persist_runtime()
        await self._async_log_event("panic" if panic else "disarmed", "Alarm disarmed")
        await self._async_run_transition_actions(prev, "disarmed", "panic" if panic else "disarmed")

        if panic:
            await self._async_run_scripts(CONF_PANIC_SCRIPTS, "panic")
        else:
            await self._async_run_scripts(CONF_DISARMED_SCRIPTS, "disarmed")

    async def async_alarm_trigger(self, code=None) -> None:
        if self._alarm_state in (
            AlarmControlPanelState.ARMED_AWAY,
            AlarmControlPanelState.ARMED_HOME,
            AlarmControlPanelState.PENDING,
        ):
            prev = _state_str(self._alarm_state)
            self._alarm_state = AlarmControlPanelState.TRIGGERED
            self.async_write_ha_state()
            await self._async_persist_runtime()
            await self._async_log_event("triggered", "Alarm triggered manually")
            await self._async_run_transition_actions(prev, "triggered", "triggered")
            await self._async_run_scripts(CONF_TRIGGERED_SCRIPTS, "triggered")
