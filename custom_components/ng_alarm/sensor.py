"""Sensor entities for NG Alarm."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant

from .const import CONF_EXPOSE_EVENT_LOG_SENSOR, DOMAIN, RUNTIME_STATE_KEY


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities) -> None:
    runtime = hass.data[DOMAIN][RUNTIME_STATE_KEY]
    entities = runtime.entities or ([runtime.entity] if runtime.entity else [])

    sensors = []
    for alarm_entity in entities:
        if not alarm_entity:
            continue
        sensors.append(NGAlarmEventLogSensor(runtime, alarm_entity))

    # keep references for runtime update notifications
    runtime.event_sensors = sensors
    runtime.event_sensor = sensors[0] if sensors else None
    async_add_entities(sensors)


class NGAlarmEventLogSensor(SensorEntity):
    """Expose last alarm event as a text sensor per zone."""

    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_icon = "mdi:clipboard-text-clock-outline"
    _attr_should_poll = False

    def __init__(self, runtime, alarm_entity) -> None:
        self._runtime = runtime
        self._alarm_entity = alarm_entity
        zone = getattr(alarm_entity, "_zone_id", None) or "main"
        self._zone = zone
        zone_label = alarm_entity.name or zone
        self._attr_name = f"{zone_label} Log"
        self._attr_unique_id = f"ng_alarm_event_log_{zone}"

    @property
    def available(self) -> bool:
        return True

    def _events(self):
        events = []
        if self._alarm_entity:
            for ev in self._alarm_entity.get_event_log():
                merged = dict(ev)
                merged.setdefault("zone", self._zone)
                events.append(merged)
        events.sort(key=lambda x: x.get("ts", 0))
        return events

    @property
    def native_value(self):
        if not bool(self._runtime.config.get(CONF_EXPOSE_EVENT_LOG_SENSOR, False)):
            return "disabled"
        events = self._events()
        if not events:
            return "no_events"
        last = events[-1]
        zone = str(last.get("zone") or self._zone)
        from_state = str(last.get("from_state") or "unknown")
        to_state = str(last.get("to_state") or str(last.get("state") or "unknown"))
        by_actor = str(last.get("by") or last.get("actor") or "unknown")
        txt = f"[{zone}] {from_state} -> {to_state} by {by_actor}"
        return txt[:255]

    @property
    def extra_state_attributes(self):
        events = self._events()
        last = events[-1] if events else {}
        zone = str(last.get("zone") or self._zone)
        from_state = str(last.get("from_state") or "unknown")
        to_state = str(last.get("to_state") or str(last.get("state") or "unknown"))
        by_actor = str(last.get("by") or last.get("actor") or "unknown")
        return {
            "zone": zone,
            "event_count": len(events),
            "last_event": last.get("event"),
            "last_actor": last.get("actor"),
            "last_state": last.get("state"),
            "last_mode": last.get("mode"),
            "last_zone": zone,
            "last_ts": last.get("ts"),
            "enabled": bool(self._runtime.config.get(CONF_EXPOSE_EVENT_LOG_SENSOR, False)),
            "from_state": from_state,
            "to_state": to_state,
            "by": by_actor,
            "summary_text": f"[{zone}] {from_state} -> {to_state} by {by_actor}",
        }
