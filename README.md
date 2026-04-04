# NG Alarm

Custom Home Assistant alarm integration with a native editable configuration page (no config flow).

## Highlights

- `alarm_control_panel` backend with modes `armed_away` and `armed_home`
- Independent entry/exit delays per mode
- Sensor groups: away/home active + away/home bypass
- Bypass condition: if any bypass entity matches bypass state, bypass sensors are silenced
- Script-based actions (`pending`, `triggered`, `armed_*`, `disarmed`, `panic`)
- Panic code support (silent panic scripts)
- Runtime state persistence across restart
- Native sidebar page **NG Alarm** for editing config live

## Install (HACS)

1. Add custom repository: `https://github.com/NikGro/ng_alarm`
2. Category: **Integration**
3. Install and restart Home Assistant

## Enable integration

No config flow is used. Add this to `configuration.yaml`:

```yaml
ng_alarm:
```

Restart Home Assistant.

Then open sidebar item **NG Alarm** to edit configuration.

## API endpoints

- `GET /api/ng_alarm/config`
- `POST /api/ng_alarm/config`
- `POST /api/ng_alarm/reload`

## Service

- `ng_alarm.reload`
