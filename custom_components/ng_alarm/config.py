"""Config management for NG Alarm."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from homeassistant.helpers.storage import Store

from .const import DEFAULTS, INT_KEYS, LIST_KEYS, STORAGE_KEY, STORAGE_VERSION


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
