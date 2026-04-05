"""Config management for NG Alarm."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from homeassistant.helpers.storage import Store

from .const import (
    BYPASS_MODE_ENTITY_STATE,
    BYPASS_MODE_TEMPLATE,
    CONF_ACTIONS,
    CONF_ACTION_FROM,
    CONF_ACTION_SCRIPTS,
    CONF_ACTION_THROUGH,
    CONF_ACTION_TO,
    CONF_AWAY_TRIGGER_STATES,
    CONF_BYPASS_MODE,
    CONF_BYPASS_TEMPLATE,
    CONF_HOME_TRIGGER_STATES,
    CONF_IGNORE_UNAVAILABLE_STATES,
    CONF_IGNORE_UNKNOWN_STATES,
    CONF_USERS,
    CONF_USER_CAN_ARM,
    CONF_USER_CAN_DISARM,
    CONF_USER_CAN_PANIC,
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
    data["alarm_code"] = str(data.get("alarm_code") or "")
    data["panic_code"] = str(data.get("panic_code") or "")
    data["bypass_state"] = str(data.get("bypass_state") or DEFAULTS["bypass_state"])

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

    users = []
    for user in data.get(CONF_USERS, []) or []:
        if not isinstance(user, dict):
            continue
        code = str(user.get(CONF_USER_CODE) or "").strip()
        name = str(user.get(CONF_USER_NAME) or "").strip()
        if not code:
            continue
        users.append(
            {
                CONF_USER_NAME: name or f"User {len(users) + 1}",
                CONF_USER_CODE: code,
                CONF_USER_CAN_ARM: bool(user.get(CONF_USER_CAN_ARM, True)),
                CONF_USER_CAN_DISARM: bool(user.get(CONF_USER_CAN_DISARM, True)),
                CONF_USER_CAN_PANIC: bool(user.get(CONF_USER_CAN_PANIC, False)),
            }
        )
    data[CONF_USERS] = users

    actions = []
    for action in data.get(CONF_ACTIONS, []) or []:
        if not isinstance(action, dict):
            continue
        scripts = [str(v) for v in action.get(CONF_ACTION_SCRIPTS, []) if str(v).strip()]
        if not scripts:
            continue
        actions.append(
            {
                CONF_ACTION_FROM: [
                    str(v).strip() for v in action.get(CONF_ACTION_FROM, []) if str(v).strip()
                ],
                CONF_ACTION_TO: [
                    str(v).strip() for v in action.get(CONF_ACTION_TO, []) if str(v).strip()
                ],
                CONF_ACTION_THROUGH: [
                    str(v).strip() for v in action.get(CONF_ACTION_THROUGH, []) if str(v).strip()
                ],
                CONF_ACTION_SCRIPTS: scripts,
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
