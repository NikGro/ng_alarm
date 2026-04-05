# NG Alarm

Custom Home Assistant alarm integration with a native editable configuration page (no config flow).

## Highlights

- `alarm_control_panel` backend with modes `armed_away` and `armed_home`
- Independent entry/exit delays per mode
- Sensor groups: away/home active + away/home bypass
- Trigger-state controls per mode (`away_trigger_states`, `home_trigger_states`)
- Unknown/unavailable sensor handling flags
- Bypass condition modes:
  - **Entity state mode** (`bypass_entities` + `bypass_state`)
  - **Template mode** (`bypass_template`)
- Users & code permissions (`can_arm`, `can_disarm`, `can_panic`)
- Action Builder rules (`from` / `to` / `through`) with script targets
- Legacy state scripts (`pending`, `triggered`, `armed_*`, `disarmed`, `panic`)
- Event log panel with clear/refresh API
- Runtime state persistence across restart
- Native HA-style sidebar page with tabbed editor

## Install (HACS)

1. Add custom repository: `https://github.com/NikGro/ng_alarm`
2. Category: **Integration**
3. Install and restart Home Assistant

## Enable integration

1. Go to **Settings → Devices & Services → Add Integration**
2. Add **Alarm**
3. Open sidebar item **Alarm** to edit runtime configuration

No settings are configured in config flow; all editing is done in the panel page.

## API endpoints

- `GET /api/ng_alarm/config`
- `POST /api/ng_alarm/config`
- `POST /api/ng_alarm/reload`

## Service

- `ng_alarm.reload`
