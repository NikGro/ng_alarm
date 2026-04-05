"""Sensor entities for NG Alarm."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant

from .const import CONF_EXPOSE_EVENT_LOG_SENSOR, DOMAIN, RUNTIME_STATE_KEY


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities) -> None:
    runtime = hass.data[DOMAIN][RUNTIME_STATE_KEY]
    sensor = NGAlarmEventLogSensor(runtime)
    runtime.event_sensor = sensor
    async_add_entities([sensor])


class NGAlarmEventLogSensor(SensorEntity):
    """Expose last alarm event as a text sensor."""

    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_name = "NG Alarm Event Log"
    _attr_unique_id = "ng_alarm_event_log"
    _attr_icon = "mdi:clipboard-text-clock-outline"
    _attr_should_poll = False

    def __init__(self, runtime) -> None:
        self._runtime = runtime

    @property
    def available(self) -> bool:
        return bool(self._runtime.config.get(CONF_EXPOSE_EVENT_LOG_SENSOR, False))

    @property
    def native_value(self):
        events = self._runtime.entity.get_event_log() if self._runtime.entity else []
        if not events:
            return "no_events"
        last = events[-1]
        txt = f"{last.get('event','event')} | {last.get('message','')}"
        return txt[:255]

    @property
    def extra_state_attributes(self):
        events = self._runtime.entity.get_event_log() if self._runtime.entity else []
        last = events[-1] if events else {}
        return {
            "event_count": len(events),
            "last_event": last.get("event"),
            "last_actor": last.get("actor"),
            "last_state": last.get("state"),
            "last_mode": last.get("mode"),
            "last_ts": last.get("ts"),
        }
