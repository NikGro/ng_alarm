"""Config management for NG Alarm."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from homeassistant.helpers.storage import Store

from .const import (
    BYPASS_MODE_ENTITY_STATE,
    BYPASS_MODE_TEMPLATE,
    CONF_ACTIONS,
    CONF_ACTION_BY_USER,
    CONF_ACTION_FROM,
    CONF_ACTION_SCRIPTS,
    CONF_ACTION_TARGETS,
    CONF_ACTION_THROUGH,
    CONF_ACTION_TO,
    CONF_AWAY_TRIGGER_STATES,
    CONF_BYPASS_MODE,
    CONF_BYPASS_TEMPLATE,
    CONF_HOME_TRIGGER_STATES,
    CONF_IGNORE_UNAVAILABLE_STATES,
    CONF_IGNORE_UNKNOWN_STATES,
    CONF_EXPOSE_EVENT_LOG_SENSOR,
    CONF_MODE_ALARM_DURATION,
    CONF_MODE_TIMEOUT_ACTION,
    CONF_MODES,
    CONF_REQUIRE_CODE_TO_ARM,
    CONF_SENSOR_RULES,
    CONF_SENSOR_TRIGGER_ON_OPEN_ONLY,
    CONF_SENSOR_TRIGGER_UNKNOWN_UNAVAILABLE,
    CONF_USERS,
    CONF_USER_CAN_ARM,
    CONF_USER_CAN_DISARM,
    CONF_USER_CAN_PANIC,
    CONF_USER_ARM_MODES,
    CONF_USER_DISARM_MODES,
    CONF_USER_CODE,
    CONF_USER_NAME,
    DEFAULTS,
    INT_KEYS,
    LIST_KEYS,
    STORAGE_KEY,
    STORAGE_VERSION,
)


@dataclass
class NGAlarmRuntime:
    """Shared runtime state for the integration."""

    store: Store
    config: dict[str, Any]
    entity: Any | None = None
    entities: list[Any] | None = None
    event_sensor: Any | None = None
    event_sensors: list[Any] | None = None


def normalize_config(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize external input into a valid NG Alarm config dict."""
    data = dict(DEFAULTS)
    if raw:
        data.update(raw)

    for key in LIST_KEYS:
        value = data.get(key, [])
        if value is None:
            value = []
        if not isinstance(value, list):
            value = [value]
        data[key] = [str(v) for v in value if str(v).strip()]

    for key in INT_KEYS:
        try:
            data[key] = max(0, int(data.get(key, 0)))
        except (TypeError, ValueError):
            data[key] = int(DEFAULTS[key])

    data["name"] = str(data.get("name") or DEFAULTS["name"])
    data["bypass_state"] = str(data.get("bypass_state") or DEFAULTS["bypass_state"])
    data[CONF_REQUIRE_CODE_TO_ARM] = bool(data.get(CONF_REQUIRE_CODE_TO_ARM, True))
    data[CONF_EXPOSE_EVENT_LOG_SENSOR] = bool(data.get(CONF_EXPOSE_EVENT_LOG_SENSOR, False))

    mode = str(data.get(CONF_BYPASS_MODE) or BYPASS_MODE_ENTITY_STATE)
    data[CONF_BYPASS_MODE] = (
        mode if mode in (BYPASS_MODE_ENTITY_STATE, BYPASS_MODE_TEMPLATE) else BYPASS_MODE_ENTITY_STATE
    )
    data[CONF_BYPASS_TEMPLATE] = str(data.get(CONF_BYPASS_TEMPLATE) or "")

    data[CONF_IGNORE_UNKNOWN_STATES] = bool(data.get(CONF_IGNORE_UNKNOWN_STATES, True))
    data[CONF_IGNORE_UNAVAILABLE_STATES] = bool(
        data.get(CONF_IGNORE_UNAVAILABLE_STATES, True)
    )
    data[CONF_HOME_TRIGGER_STATES] = [
        str(v).strip().lower()
        for v in data.get(CONF_HOME_TRIGGER_STATES, ["on"])
        if str(v).strip()
    ] or ["on"]
    data[CONF_AWAY_TRIGGER_STATES] = [
        str(v).strip().lower()
        for v in data.get(CONF_AWAY_TRIGGER_STATES, ["on"])
        if str(v).strip()
    ] or ["on"]

    modes = []
    for mode in data.get(CONF_MODES, []) or []:
        if not isinstance(mode, dict):
            continue
        mode_id = str(mode.get("id") or "").strip().lower().replace(" ", "_")
        name = str(mode.get("name") or "").strip()
        icon = str(mode.get("icon") or "mdi:shield")
        arm_target = str(mode.get("arm_target") or "away").strip().lower()
        arm_types = [
            str(v).strip().lower()
            for v in mode.get("arm_types", [arm_target])
            if str(v).strip()
        ]
        arm_types = [v for v in arm_types if v in {"away", "home", "night", "vacation"}] or [arm_target if arm_target in {"away","home","night","vacation"} else "away"]
        require_code_to_arm = bool(mode.get("require_code_to_arm", True))
        bypass_mode = str(mode.get("bypass_mode") or "none").strip().lower()
        bypass_entities = [
            str(v).strip() for v in mode.get("bypass_entities", []) if str(v).strip()
        ]
        bypass_state = str(mode.get("bypass_state") or "on").strip()
        bypass_template = str(mode.get("bypass_template") or "").strip()
        if not mode_id or not name:
            continue
        if arm_target not in {"away", "home", "night", "vacation"}:
            arm_target = "away"
        if bypass_mode not in {"none", "entity_state", "template"}:
            bypass_mode = "none"
        exit_delay = mode.get("exit_delay", DEFAULTS.get("exit_delay_away", 60))
        entry_delay = mode.get("entry_delay", DEFAULTS.get("entry_delay_away", 30))
        alarm_duration = mode.get(CONF_MODE_ALARM_DURATION, 0)
        try:
            exit_delay = max(0, int(exit_delay))
        except (TypeError, ValueError):
            exit_delay = 60
        try:
            entry_delay = max(0, int(entry_delay))
        except (TypeError, ValueError):
            entry_delay = 30
        try:
            alarm_duration = max(0, int(alarm_duration or 0))
        except (TypeError, ValueError):
            alarm_duration = 0

        modes.append(
            {
                "id": mode_id,
                "name": name,
                "icon": icon,
                "arm_target": arm_target,
                "arm_types": arm_types,
                "require_code_to_arm": require_code_to_arm,
                "exit_delay": exit_delay,
                "entry_delay": entry_delay,
                CONF_MODE_ALARM_DURATION: alarm_duration,
                CONF_MODE_TIMEOUT_ACTION: str(mode.get(CONF_MODE_TIMEOUT_ACTION, "none") or "none").strip().lower(),
                "bypass_mode": bypass_mode,
                "bypass_entities": bypass_entities,
                "bypass_state": bypass_state,
                "bypass_template": bypass_template,
            }
        )
    data[CONF_MODES] = modes

    sensor_rules = []
    for rule in data.get(CONF_SENSOR_RULES, []) or []:
        if not isinstance(rule, dict):
            continue
        entity_id = str(rule.get("entity_id") or "").strip()
        if not entity_id:
            continue
        sensor_rules.append(
            {
                "entity_id": entity_id,
                "modes": [str(v).strip().lower() for v in rule.get("modes", []) if str(v).strip()],
                "bypass_modes": [str(v).strip().lower() for v in rule.get("bypass_modes", []) if str(v).strip()],
                "allow_open_arm": bool(rule.get("allow_open_arm", False)),
                "trigger_on_close_only": bool(rule.get("trigger_on_close_only", False)),
                CONF_SENSOR_TRIGGER_ON_OPEN_ONLY: bool(
                    rule.get(CONF_SENSOR_TRIGGER_ON_OPEN_ONLY, False)
                ),
                "trigger_unknown": bool(rule.get("trigger_unknown", False)),
                "trigger_unavailable": bool(rule.get("trigger_unavailable", False)),
                CONF_SENSOR_TRIGGER_UNKNOWN_UNAVAILABLE: bool(
                    rule.get(CONF_SENSOR_TRIGGER_UNKNOWN_UNAVAILABLE, False)
                ),
            }
        )
    data[CONF_SENSOR_RULES] = sensor_rules

    users = []
    for user in data.get(CONF_USERS, []) or []:
        if not isinstance(user, dict):
            continue
        code = str(user.get(CONF_USER_CODE) or "").strip()
        name = str(user.get(CONF_USER_NAME) or "").strip()
        if not code:
            continue
        arm_modes = [
            str(v).strip().lower().replace(" ", "_")
            for v in user.get(CONF_USER_ARM_MODES, [])
            if str(v).strip()
        ]
        disarm_modes = [
            str(v).strip().lower().replace(" ", "_")
            for v in user.get(CONF_USER_DISARM_MODES, [])
            if str(v).strip()
        ]
        users.append(
            {
                CONF_USER_NAME: name or f"User {len(users) + 1}",
                CONF_USER_CODE: code,
                CONF_USER_CAN_ARM: bool(user.get(CONF_USER_CAN_ARM, True)),
                CONF_USER_CAN_DISARM: bool(user.get(CONF_USER_CAN_DISARM, True)),
                CONF_USER_CAN_PANIC: bool(user.get(CONF_USER_CAN_PANIC, False)),
                CONF_USER_ARM_MODES: arm_modes,
                CONF_USER_DISARM_MODES: disarm_modes,
            }
        )
    data[CONF_USERS] = users

    actions = []
    for action in data.get(CONF_ACTIONS, []) or []:
        if not isinstance(action, dict):
            continue
        targets = [str(v) for v in action.get(CONF_ACTION_TARGETS, action.get(CONF_ACTION_SCRIPTS, [])) if str(v).strip()]
        if not targets:
            continue
        actions.append(
            {
                CONF_ACTION_FROM: [
                    str(v).strip().lower()
                    for v in action.get(CONF_ACTION_FROM, [])
                    if str(v).strip()
                ],
                CONF_ACTION_TO: [
                    str(v).strip().lower()
                    for v in action.get(CONF_ACTION_TO, [])
                    if str(v).strip()
                ],
                CONF_ACTION_THROUGH: [
                    str(v).strip().lower()
                    for v in action.get(CONF_ACTION_THROUGH, [])
                    if str(v).strip()
                ],
                "name": str(action.get("name", "") or "").strip(),
                CONF_ACTION_BY_USER: str(action.get(CONF_ACTION_BY_USER, "any") or "any").strip(),
                CONF_ACTION_TARGETS: targets,
                CONF_ACTION_SCRIPTS: targets,
            }
        )
    data[CONF_ACTIONS] = actions

    return data


async def load_config(store: Store) -> dict[str, Any]:
    """Load config from storage."""
    return normalize_config(await store.async_load())


async def save_config(store: Store, data: dict[str, Any]) -> dict[str, Any]:
    """Save config to storage and return normalized copy."""
    normalized = normalize_config(data)
    await store.async_save(normalized)
    return normalized


def create_store(hass) -> Store:
    """Create the storage backend."""
    return Store(hass, STORAGE_VERSION, STORAGE_KEY)
