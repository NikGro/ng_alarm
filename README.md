# NG Alarm

A custom Home Assistant alarm integration replacing Alarmo with a cleaner, script-based action model and first-class sensor bypass support.

## Features

- **Two arm modes**: `armed_away` and `armed_home`
- **Independent delays**: Exit and entry delays for each mode
- **Four sensor groups**:
  - Away — Active: Always monitored when armed_away
  - Away — Bypass: Monitored when armed_away, silenced when bypass is active
  - Home — Active: Always monitored when armed_home
  - Home — Bypass: Monitored when armed_home, silenced when bypass is active
- **Bypass condition**: Any HA entity can trigger bypass mode (e.g., robot vacuum in "cleaning" state)
- **Script-based actions**: All actions are Home Assistant scripts with variable payload
- **Panic code**: Optional panic code for silent alerts
- **State persistence**: Restores state after Home Assistant restart

## Installation

### HACS (Recommended)

1. Add this repository to HACS as a custom repository
2. Install "NG Alarm"
3. Restart Home Assistant

### Manual

1. Copy `custom_components/ng_alarm/` to your Home Assistant config directory
2. Restart Home Assistant

## Configuration

All configuration is done through the Home Assistant UI:

1. Go to Settings → Devices & Services → Add Integration
2. Search for "NG Alarm"
3. Configure:
   - Alarm name
   - Alarm code (required)
   - Panic code (optional)
   - Exit/entry delays
   - Sensor groups
   - Bypass entities
   - Action scripts

## Script Variables

All scripts receive these variables:

```yaml
triggered_sensor: "binary_sensor.front_door"
triggered_sensor_name: "Front Door"
alarm_mode: "armed_away"
alarm_state: "triggered"  # pending, triggered, armed_away, armed_home, disarmed, panic
```

## License

MIT