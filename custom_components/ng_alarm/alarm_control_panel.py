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
    CONF_ACTIONS,
    CONF_ACTION_BY_USER,
    CONF_ACTION_FROM,
    CONF_ACTION_SCRIPTS,
    CONF_ACTION_TARGETS,
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
    CONF_MODE_ALARM_DURATION,
    CONF_MODE_TIMEOUT_ACTION,
    CONF_IGNORE_UNAVAILABLE_STATES,
    CONF_IGNORE_UNKNOWN_STATES,
    CONF_MODES,
    CONF_NAME,
    CONF_PANIC_SCRIPTS,
    CONF_PENDING_SCRIPTS,
    CONF_REQUIRE_CODE_TO_ARM,
    CONF_SENSOR_RULES,
    CONF_SENSOR_TRIGGER_ON_OPEN_ONLY,
    CONF_SENSOR_TRIGGER_UNKNOWN_UNAVAILABLE,
    CONF_TRIGGERED_SCRIPTS,
    CONF_USERS,
    CONF_USER_CAN_ARM,
    CONF_USER_CAN_DISARM,
    CONF_USER_CAN_PANIC,
    CONF_USER_ARM_MODES,
    CONF_USER_DISARM_MODES,
    CONF_USER_CODE,
    CONF_USER_NAME,
    DOMAIN,
    RUNTIME_STATE_KEY,
    STORAGE_KEY,
    UNKNOWN,
    BYPASS_MODE_TEMPLATE,
)

_LOGGER = logging.getLogger(__name__)

FEATURE_ARM_NIGHT = int(getattr(AlarmControlPanelEntityFeature, "ARM_NIGHT", 0))
FEATURE_ARM_VACATION = int(getattr(AlarmControlPanelEntityFeature, "ARM_VACATION", 0))
STATE_ARMED_NIGHT = getattr(AlarmControlPanelState, "ARMED_NIGHT", AlarmControlPanelState.ARMED_HOME)
STATE_ARMED_VACATION = getattr(AlarmControlPanelState, "ARMED_VACATION", AlarmControlPanelState.ARMED_AWAY)


def _normalize_mode_id(value: str | None) -> str:
    return str(value or "").strip().lower().replace(" ", "_")


def _state_str(state: AlarmControlPanelState) -> str:
    """Return legacy string representation for scripts."""
    if state == STATE_ARMED_NIGHT:
        return "armed_night"
    if state == STATE_ARMED_VACATION:
        return "armed_vacation"
    return {
        AlarmControlPanelState.DISARMED: "disarmed",
        AlarmControlPanelState.ARMING: "arming",
        AlarmControlPanelState.ARMED_AWAY: "armed_away",
        AlarmControlPanelState.ARMED_HOME: "armed_home",
        AlarmControlPanelState.PENDING: "pending",
        AlarmControlPanelState.TRIGGERED: "triggered",
    }.get(state, "unknown")


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
        AlarmControlPanelEntityFeature.ARM_AWAY
        | AlarmControlPanelEntityFeature.ARM_HOME
        | FEATURE_ARM_NIGHT
        | FEATURE_ARM_VACATION
    )
    _attr_code_format = CodeFormat.TEXT
    _attr_code_arm_required = False

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
        self._current_mode_id = UNKNOWN
        self._event_log: list[dict[str, Any]] = []

        self._exit_unsub = None
        self._entry_unsub = None
        self._alarm_duration_unsub = None
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
            "current_mode": self._current_mode_id,
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
                "armed_night": STATE_ARMED_NIGHT,
                "armed_vacation": STATE_ARMED_VACATION,
            }.get(raw_mode)
            self._triggered_sensor = saved.get("triggered_sensor", UNKNOWN)
            self._triggered_sensor_name = saved.get("triggered_sensor_name", UNKNOWN)
            self._last_actor = saved.get("last_actor", UNKNOWN)
            self._current_mode_id = saved.get("current_mode_id", UNKNOWN)
            self._event_log = list(saved.get("event_log", []))[-200:]

        await self._async_bind_bypass_listener()
        if self._alarm_state in (
            AlarmControlPanelState.ARMED_AWAY,
            AlarmControlPanelState.ARMED_HOME,
            STATE_ARMED_NIGHT,
            STATE_ARMED_VACATION,
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
        runtime = self.hass.data.get(DOMAIN, {}).get(RUNTIME_STATE_KEY)
        if runtime and runtime.event_sensor:
            runtime.event_sensor.async_write_ha_state()

    async def _async_persist_runtime(self) -> None:
        await self._store.async_save(
            {
                "state": _state_str(self._alarm_state),
                "armed_mode": _state_str(self._armed_mode) if self._armed_mode else None,
                "triggered_sensor": self._triggered_sensor,
                "triggered_sensor_name": self._triggered_sensor_name,
                "last_actor": self._last_actor,
                "current_mode_id": self._current_mode_id,
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
        runtime = self.hass.data.get(DOMAIN, {}).get(RUNTIME_STATE_KEY)
        if runtime and runtime.event_sensor:
            runtime.event_sensor.async_write_ha_state()

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
        runtime = self.hass.data.get(DOMAIN, {}).get(RUNTIME_STATE_KEY)
        if runtime and runtime.event_sensor:
            runtime.event_sensor.async_write_ha_state()

    def _resolve_user_from_code(self, code: str | None) -> dict[str, Any] | None:
        entered = str(code or "")
        for user in self._config.get(CONF_USERS, []):
            if entered and str(user.get(CONF_USER_CODE, "")) == entered:
                return user
        return None

    def _with_users(self) -> bool:
        return bool(self._config.get(CONF_USERS))

    @property
    def code_arm_required(self) -> bool:
        return bool(self._config.get(CONF_REQUIRE_CODE_TO_ARM, True))

    def _resolve_mode_for_arm(self, target: str) -> str:
        modes = self._config.get(CONF_MODES, []) or []
        if not modes:
            return UNKNOWN
        for mode in modes:
            if str(mode.get("arm_target", target)).strip().lower() == target:
                return _normalize_mode_id(mode.get("id"))
        return _normalize_mode_id(modes[0].get("id"))

    def _mode_delay(self, kind: str, default: int) -> int:
        mode = self._mode_config()
        if not mode:
            return default
        try:
            return max(0, int(mode.get(kind, default)))
        except (TypeError, ValueError):
            return default

    def _mode_timeout_action(self) -> str:
        mode = self._mode_config()
        if not mode:
            return "none"
        action = str(mode.get(CONF_MODE_TIMEOUT_ACTION, "none") or "none").strip().lower()
        if action not in {"none", "disarm", "rearm"}:
            action = "none"
        return action

    def _authorize_arm(self, code: str | None, mode_id: str) -> str | None:
        mode_cfg = self._mode_config(mode_id)
        require_code = bool(
            (mode_cfg or {}).get(
                "require_code_to_arm",
                self._config.get(CONF_REQUIRE_CODE_TO_ARM, True),
            )
        )
        mode_id = _normalize_mode_id(mode_id)
        if self._with_users():
            if not require_code and not str(code or "").strip():
                return UNKNOWN
            user = self._resolve_user_from_code(code)
            if not user or not bool(user.get(CONF_USER_CAN_ARM, False)):
                return None
            allowed = [_normalize_mode_id(v) for v in user.get(CONF_USER_ARM_MODES, [])]
            if allowed and mode_id not in allowed:
                return None
            return self._actor_name(user)

        # No legacy master code: allow arming only when code is optional.
        if require_code:
            return None
        return UNKNOWN

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
        through_state = self._current_mode_id if self._current_mode_id != UNKNOWN else (_state_str(self._armed_mode) if self._armed_mode else UNKNOWN)
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
            by_user = str(action.get(CONF_ACTION_BY_USER, "any") or "any").strip().lower()
            if by_user not in {"", "any"} and by_user != str(self._last_actor).strip().lower():
                continue

            for entity_id in action.get(CONF_ACTION_TARGETS, action.get(CONF_ACTION_SCRIPTS, [])):
                domain = str(entity_id).split(".", 1)[0]
                if domain == "script":
                    await self.hass.services.async_call(
                        "script",
                        "turn_on",
                        {"entity_id": entity_id, "variables": variables},
                        blocking=False,
                    )
                else:
                    await self.hass.services.async_call(
                        "homeassistant",
                        "turn_on",
                        {"entity_id": entity_id},
                        blocking=False,
                    )

    async def _async_run_scripts(self, key: str, alarm_state: str) -> None:
        variables = {
            ATTR_TRIGGERED_SENSOR: self._triggered_sensor,
            ATTR_TRIGGERED_SENSOR_NAME: self._triggered_sensor_name,
            ATTR_ALARM_MODE: self._current_mode_id if self._current_mode_id != UNKNOWN else (_state_str(self._armed_mode) if self._armed_mode else UNKNOWN),
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
        if self._alarm_duration_unsub:
            self._alarm_duration_unsub()
            self._alarm_duration_unsub = None

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

        entities: set[str] = set()
        for mode in self._config.get(CONF_MODES, []) or []:
            entities.update(mode.get("bypass_entities", []) or [])

        if entities:
            self._bypass_unsub = async_track_state_change_event(
                self.hass, list(entities), self._async_bypass_changed
            )

    def _mode_config(self, mode_id: str | None = None) -> dict[str, Any] | None:
        wanted = _normalize_mode_id(mode_id or self._current_mode_id)
        for mode in self._config.get(CONF_MODES, []) or []:
            if _normalize_mode_id(mode.get("id")) == wanted:
                return mode
        return None

    def _is_bypass_active(self) -> bool:
        mode = self._mode_config()
        if mode:
            mode_bypass = str(mode.get("bypass_mode", "none")).lower()
            if mode_bypass == "none":
                return False
            if mode_bypass == "template":
                tpl = str(mode.get("bypass_template", "")).strip()
                if not tpl:
                    return False
                try:
                    rendered = Template(tpl, self.hass).async_render(parse_result=False)
                    return result_as_boolean(rendered)
                except TemplateError as err:
                    _LOGGER.debug("Bypass template render failed: %s", err)
                    return False

            for entity_id in mode.get("bypass_entities", []) or []:
                state = self.hass.states.get(entity_id)
                if state and str(state.state).lower() in {"on", "true", "1", "home", "open"}:
                    return True
            return False

        return False

    def _trigger_states(self) -> set[str]:
        mode_cfg = self._mode_config()
        arm_target = str((mode_cfg or {}).get("arm_target", "")).lower()

        if self._alarm_state == AlarmControlPanelState.ARMED_AWAY or arm_target == "away":
            return {
                str(v).lower()
                for v in self._config.get(CONF_AWAY_TRIGGER_STATES, ["on"])
                if str(v).strip()
            }
        if self._alarm_state in (AlarmControlPanelState.ARMED_HOME, STATE_ARMED_NIGHT) or arm_target in {"home", "night"}:
            return {
                str(v).lower()
                for v in self._config.get(CONF_HOME_TRIGGER_STATES, ["on"])
                if str(v).strip()
            }
        return {"on"}

    def _sensor_rule(self, entity_id: str) -> dict[str, Any] | None:
        for rule in self._config.get(CONF_SENSOR_RULES, []) or []:
            if str(rule.get("entity_id", "")).strip() == entity_id:
                return rule
        return None

    def _monitored_sensors(self) -> list[str]:
        rules = self._config.get(CONF_SENSOR_RULES, []) or []
        if rules and self._current_mode_id and self._current_mode_id != UNKNOWN:
            result: list[str] = []
            bypass_active = self._is_bypass_active()
            for rule in rules:
                entity_id = str(rule.get("entity_id", "")).strip()
                if not entity_id:
                    continue
                modes = [_normalize_mode_id(v) for v in rule.get("modes", [])]
                if modes and self._current_mode_id not in modes:
                    continue
                bypass_modes = [_normalize_mode_id(v) for v in rule.get("bypass_modes", [])]
                if bypass_active and self._current_mode_id in bypass_modes:
                    continue
                result.append(entity_id)
            return result

        # legacy fallback
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
            STATE_ARMED_NIGHT,
            STATE_ARMED_VACATION,
        ):
            self._async_refresh_sensor_listener()

    async def _async_sensor_changed(self, event) -> None:
        if self._alarm_state not in (
            AlarmControlPanelState.ARMED_AWAY,
            AlarmControlPanelState.ARMED_HOME,
            STATE_ARMED_NIGHT,
            STATE_ARMED_VACATION,
        ):
            return

        new_state = event.data.get("new_state")
        if not new_state:
            return

        entity_id = event.data.get("entity_id", UNKNOWN)
        rule = self._sensor_rule(entity_id)

        new_state_value = str(new_state.state).lower()
        ignore_unknown = self._config.get(CONF_IGNORE_UNKNOWN_STATES, True)
        ignore_unavailable = self._config.get(CONF_IGNORE_UNAVAILABLE_STATES, True)
        if rule:
            combined = bool(rule.get(CONF_SENSOR_TRIGGER_UNKNOWN_UNAVAILABLE, False))
            ignore_unknown = not (combined or bool(rule.get("trigger_unknown", False)))
            ignore_unavailable = not (combined or bool(rule.get("trigger_unavailable", False)))

        if new_state_value == "unknown" and ignore_unknown:
            return
        if new_state_value == "unavailable" and ignore_unavailable:
            return

        if rule and bool(rule.get(CONF_SENSOR_TRIGGER_ON_OPEN_ONLY, False)):
            old_state = event.data.get("old_state")
            old_state_value = str(old_state.state).lower() if old_state else ""
            if not (old_state_value in {"off", "closed", "false", "0"} and new_state_value in {"on", "open", "true", "1"}):
                return
        elif new_state_value not in self._trigger_states():
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

        delay = self._mode_delay(
            "entry_delay",
            int(
                self._config.get(
                    CONF_ENTRY_DELAY_AWAY
                    if self._armed_mode == AlarmControlPanelState.ARMED_AWAY
                    else CONF_ENTRY_DELAY_HOME,
                    0,
                )
            ),
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
        self._schedule_alarm_timeout()

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

        arm_target = str((self._mode_config() or {}).get("arm_target", "")).lower()
        if self._alarm_state == AlarmControlPanelState.ARMED_AWAY or arm_target in {"away", "vacation"}:
            await self._async_run_scripts(CONF_ARMED_AWAY_SCRIPTS, "armed_away")
        elif self._alarm_state in (AlarmControlPanelState.ARMED_HOME, STATE_ARMED_NIGHT) or arm_target in {"home", "night"}:
            await self._async_run_scripts(CONF_ARMED_HOME_SCRIPTS, "armed_home")

    def _code_ok(self, given, expected: str) -> bool:
        return str(given or "") == str(expected or "")

    async def async_alarm_arm_away(self, code=None) -> None:
        self._current_mode_id = self._resolve_mode_for_arm("away")
        actor = self._authorize_arm(code, self._current_mode_id)
        if actor is None:
            await self._async_log_event("denied", "Denied arm away: code/permission/mode mismatch")
            return
        self._last_actor = actor
        if self._current_mode_id == UNKNOWN:
            await self._async_log_event("denied", "Denied arm away: no modes configured")
            return
        await self._async_arm(
            AlarmControlPanelState.ARMED_AWAY,
            self._mode_delay("exit_delay", int(self._config.get(CONF_EXIT_DELAY_AWAY, 0))),
        )

    async def async_alarm_arm_home(self, code=None) -> None:
        self._current_mode_id = self._resolve_mode_for_arm("home")
        actor = self._authorize_arm(code, self._current_mode_id)
        if actor is None:
            await self._async_log_event("denied", "Denied arm home: code/permission/mode mismatch")
            return
        self._last_actor = actor
        if self._current_mode_id == UNKNOWN:
            await self._async_log_event("denied", "Denied arm home: no modes configured")
            return
        await self._async_arm(
            AlarmControlPanelState.ARMED_HOME,
            self._mode_delay("exit_delay", int(self._config.get(CONF_EXIT_DELAY_HOME, 0))),
        )

    async def async_alarm_arm_night(self, code=None) -> None:
        self._current_mode_id = self._resolve_mode_for_arm("night")
        actor = self._authorize_arm(code, self._current_mode_id)
        if actor is None:
            await self._async_log_event("denied", "Denied arm night: code/permission/mode mismatch")
            return
        self._last_actor = actor
        if self._current_mode_id == UNKNOWN:
            await self._async_log_event("denied", "Denied arm night: no modes configured")
            return
        await self._async_arm(
            STATE_ARMED_NIGHT,
            self._mode_delay("exit_delay", int(self._config.get(CONF_EXIT_DELAY_HOME, 0))),
        )

    async def async_alarm_arm_vacation(self, code=None) -> None:
        self._current_mode_id = self._resolve_mode_for_arm("vacation")
        actor = self._authorize_arm(code, self._current_mode_id)
        if actor is None:
            await self._async_log_event("denied", "Denied arm vacation: code/permission/mode mismatch")
            return
        self._last_actor = actor
        if self._current_mode_id == UNKNOWN:
            await self._async_log_event("denied", "Denied arm vacation: no modes configured")
            return
        await self._async_arm(
            STATE_ARMED_VACATION,
            self._mode_delay("exit_delay", int(self._config.get(CONF_EXIT_DELAY_AWAY, 0))),
        )

    async def _async_arm(self, mode: AlarmControlPanelState, delay: int) -> None:
        self._cancel_timers()
        self._triggered_sensor = UNKNOWN
        self._triggered_sensor_name = UNKNOWN
        self._armed_mode = mode
        prev = _state_str(self._alarm_state)

        # Block arming if configured sensors are open and not allowed.
        blocking: list[str] = []
        for rule in self._config.get(CONF_SENSOR_RULES, []) or []:
            entity_id = str(rule.get("entity_id", "")).strip()
            if not entity_id:
                continue
            modes = [_normalize_mode_id(v) for v in rule.get("modes", [])]
            if modes and self._current_mode_id not in modes:
                continue
            if bool(rule.get("allow_open_arm", False)):
                continue
            st = self.hass.states.get(entity_id)
            if st and str(st.state).lower() in {"on", "open", "true"}:
                blocking.append(entity_id)

        if blocking:
            await self._async_log_event(
                "arm_blocked",
                "Arming blocked due to open sensors",
                sensors=blocking,
            )
            return

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
            arm_target = str((self._mode_config() or {}).get("arm_target", "")).lower()
            if mode == AlarmControlPanelState.ARMED_AWAY or arm_target in {"away", "vacation"}:
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
            if not bool(user.get(CONF_USER_CAN_DISARM, False)):
                await self._async_log_event("denied", "Denied disarm: missing disarm permission")
                return
            allowed = [_normalize_mode_id(v) for v in user.get(CONF_USER_DISARM_MODES, [])]
            if allowed and self._current_mode_id not in allowed and self._current_mode_id != UNKNOWN:
                await self._async_log_event("denied", "Denied disarm: mode not allowed for user")
                return
            panic = bool(user.get(CONF_USER_CAN_PANIC, False)) and bool(
                str(code or "").strip()
            )
        else:
            await self._async_log_event("denied", "Denied disarm: no users configured")
            return

        self._last_actor = actor

        self._cancel_timers()
        self._remove_listeners()
        await self._async_bind_bypass_listener()
        prev = _state_str(self._alarm_state)

        self._alarm_state = AlarmControlPanelState.DISARMED
        self._armed_mode = None
        self._current_mode_id = UNKNOWN
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

    def _schedule_alarm_timeout(self) -> None:
        duration = self._mode_delay(CONF_MODE_ALARM_DURATION, 0)
        if duration <= 0:
            return
        if self._alarm_duration_unsub:
            self._alarm_duration_unsub()
            self._alarm_duration_unsub = None
        self._alarm_duration_unsub = async_call_later(self.hass, duration, self._async_alarm_timeout)

    async def _async_alarm_timeout(self, _now):
        self._alarm_duration_unsub = None
        if self._alarm_state != AlarmControlPanelState.TRIGGERED:
            return
        action = self._mode_timeout_action()
        await self._async_log_event("alarm_timeout", f"Alarm duration elapsed (action={action})")
        if action == "disarm":
            prev = _state_str(self._alarm_state)
            self._alarm_state = AlarmControlPanelState.DISARMED
            self._armed_mode = None
            self._current_mode_id = UNKNOWN
            self._triggered_sensor = UNKNOWN
            self._triggered_sensor_name = UNKNOWN
            self._remove_listeners()
            await self._async_bind_bypass_listener()
            self.async_write_ha_state()
            await self._async_persist_runtime()
            await self._async_run_transition_actions(prev, "disarmed", "disarmed")
            await self._async_run_scripts(CONF_DISARMED_SCRIPTS, "disarmed")
        elif action == "rearm":
            if self._armed_mode is not None:
                prev = _state_str(self._alarm_state)
                self._alarm_state = self._armed_mode
                self.async_write_ha_state()
                await self._async_persist_runtime()
                self._async_refresh_sensor_listener()
                to_state = _state_str(self._alarm_state)
                await self._async_run_transition_actions(prev, to_state, to_state)

    async def async_alarm_trigger(self, code=None) -> None:
        actor = UNKNOWN
        if self._with_users():
            user = self._resolve_user_from_code(code)
            if not user or not bool(user.get(CONF_USER_CAN_PANIC, False)):
                await self._async_log_event("denied", "Denied trigger: missing panic permission")
                return
            actor = self._actor_name(user)
        else:
            await self._async_log_event("denied", "Denied trigger: no users configured")
            return

        if self._alarm_state in (
            AlarmControlPanelState.ARMED_AWAY,
            AlarmControlPanelState.ARMED_HOME,
            STATE_ARMED_NIGHT,
            STATE_ARMED_VACATION,
            AlarmControlPanelState.PENDING,
        ):
            self._last_actor = actor
            prev = _state_str(self._alarm_state)
            self._alarm_state = AlarmControlPanelState.TRIGGERED
            self.async_write_ha_state()
            await self._async_persist_runtime()
            await self._async_log_event("triggered", "Alarm triggered manually")
            await self._async_run_transition_actions(prev, "triggered", "triggered")
            await self._async_run_scripts(CONF_TRIGGERED_SCRIPTS, "triggered")
            self._schedule_alarm_timeout()
