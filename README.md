# NG Alarm

A modern, zone-centric Home Assistant alarm integration with native-feeling configuration UI, user/code permissions, sensor rules, action flows, and event logging.

> Built with focus, iteration, and a little vibe-coding energy.

## Highlights

- Zone-based alarm model (custom zones with icon/name)
- Native arm-type support (away, home, night, vacation)
- Per-zone delays and timeout behavior
- Per-zone bypass strategy (none, entity-state, template)
- User/code management with permission controls
- Sensor rules with per-zone enable/bypass behavior
- Action builder (from/to/through/by-user + target entities)
- Event log panel with clear + export
- Optional event-log sensor exposure
- Sidebar panel UI with Home Assistant selectors

## Install with HACS

1. Add custom repository: `https://github.com/NikGro/ng_alarm`
2. Category: **Integration**
3. Install and restart Home Assistant

## Enable

1. Go to **Settings → Devices & Services → Add Integration**
2. Add **Alarm**
3. Open sidebar item **Alarm**

## API

- `GET /api/ng_alarm/config`
- `POST /api/ng_alarm/config`
- `POST /api/ng_alarm/reload`
- `GET /api/ng_alarm/events`
- `POST /api/ng_alarm/events/clear`

## Service

- `ng_alarm.reload`

## Variables passed to action targets

When an action rule matches, script targets receive:

- `from_state`
- `to_state`
- `alarm_state`
- `alarm_mode`
- `actor`
- `triggered_sensor`
- `triggered_sensor_name`
