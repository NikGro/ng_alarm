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

## Why this exists (and call for testers)

I was fed up with Alarmo and the Manual Alarm Panel because I couldn’t get them to do exactly what I wanted (specifically: temporary sensor overrides so my robot vacuum can clean while the alarm is armed).

Instead of learning how to code first, I put GPT-5.3-Codex to work. I haven’t written a single line of code myself — I directed the AI and it built **ng_alarm** from the ground up based on my requirements.

It’s heavily Alarmo-inspired, but with the specific tweaks I needed. Now I need your help to see if it actually holds up.

Try it, break it, and judge the s**t out of it. Any feedback is welcome and may end up on Jarvis’s to-do list.

Repo: <https://github.com/NikGro/ng_alarm>

### Full disclosure

- **AI-generated:** Since I didn’t code this myself, there is definitely still polishing required.
- **Experimental:** I haven’t tested every single function yet. I’m pushing updates to `main` as I go, so please do **not** use this for real home security yet. This is for testing and breaking things.
- **Feedback-driven:** If something is not self-explanatory, open an issue on GitHub. Since I’m “prompting” rather than “coding,” your feedback helps me tell the AI exactly what to fix next.

I plan to move trial-and-error to a beta channel as soon as the current state feels stable.
