"""Regression tests using real HA entity APIs and isolated storage/timer doubles."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from aiohttp import web
from homeassistant.components.alarm_control_panel import AlarmControlPanelState, CodeFormat
from homeassistant.components.http.const import KEY_HASS_USER
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.http import KEY_HASS

from custom_components.ng_alarm import alarm_control_panel as alarm
from custom_components.ng_alarm.config import normalize_config, save_config
from custom_components.ng_alarm.panel import (
    NGAlarmAdminView, NGAlarmConfigView, NGAlarmReloadView,
    NGAlarmEventsView, NGAlarmEventsClearView,
)


@pytest.mark.parametrize("code", ["00123", "0", "123456"])
def test_pin_preserves_digits(code):
    assert alarm._clean_code(code) == code


@pytest.mark.parametrize("code", ["abc123", "undefined123", "12 34", " 123", "123 ", "-123", "12.3", "１２３", "١٢٣", "abc"])
def test_pin_rejects_non_digits(code):
    with pytest.raises(ServiceValidationError):
        alarm._clean_code(code)


@pytest.mark.parametrize("code", ["Haus123!", "undefined123", " secret 123 ", "１２３", "abc"])
def test_password_is_exact(code):
    assert alarm._clean_code(code, "password") == code
    config = normalize_config({"code_input_mode": "password", "users": [{"name": "Owner", "code": code}]})
    assert config["users"][0]["code"] == code


def test_pin_configuration_rejects_password():
    with pytest.raises(ValueError, match="digits"):
        normalize_config({"code_input_mode": "pin", "users": [{"code": "Haus123!"}]})


async def test_invalid_save_does_not_overwrite_storage():
    store = SimpleNamespace(async_save=AsyncMock())
    with pytest.raises(ValueError):
        await save_config(store, {"code_input_mode": "pin", "users": [{"code": "abc123"}]})
    store.async_save.assert_not_awaited()


@pytest.fixture
async def entity(tmp_path):
    hass = HomeAssistant(str(tmp_path))
    config = normalize_config({"modes": [{"id": "house", "name": "House", "arm_types": ["home", "away", "night", "vacation"]}]})
    entity = alarm.NGAlarmControlPanel(hass, config, zone_id="house")
    entity.entity_id = "alarm_control_panel.house"
    entity._store = SimpleNamespace(async_load=AsyncMock(return_value=None), async_save=AsyncMock())
    entity._async_bind_bypass_listener = AsyncMock()
    entity._async_refresh_sensor_listener = Mock()
    entity.async_write_ha_state = Mock()
    entity._async_run_transition_actions = AsyncMock()
    entity._async_run_scripts = AsyncMock()
    return entity


@pytest.mark.parametrize("arm_type,allowed", [("home", True), ("away", False), ("night", False)])
def test_arm_type_permission(entity, arm_type, allowed):
    entity._current_arm_type = arm_type
    assert entity._user_can_arm_mode({"arm_modes": ["house:home"]}, "house") is allowed
    assert entity._user_can_disarm_mode({"disarm_modes": ["house:home"]}, "house") is allowed
    assert entity._user_can_arm_mode({"arm_modes": ["house"]}, "house")
    assert entity._user_can_disarm_mode({"disarm_modes": ["house"]}, "house")


def test_entity_respects_input_mode(entity):
    assert entity.code_format == CodeFormat.NUMBER
    with pytest.raises(ServiceValidationError):
        entity._clean_code("Haus123!")
    entity._config["code_input_mode"] = "password"
    entity._apply_code_format()
    assert entity.code_format == CodeFormat.TEXT
    assert entity._clean_code("Haus123!") == "Haus123!"


@pytest.mark.parametrize("mode,code", [("pin", "00123"), ("password", " Haus123! ")])
async def test_disarm_requires_exact_configured_code(entity, mode, code):
    entity._config["code_input_mode"] = mode
    entity._config["users"] = [{"name": "Owner", "code": code, "disarm_modes": ["house:home"]}]
    entity._current_mode_id = "house"
    entity._current_arm_type = "home"
    entity._armed_mode = AlarmControlPanelState.ARMED_HOME
    entity._alarm_state = AlarmControlPanelState.ARMED_HOME
    await entity.async_alarm_disarm(code[:-1])
    assert entity.alarm_state == AlarmControlPanelState.ARMED_HOME
    await entity.async_alarm_disarm(code)
    assert entity.alarm_state == AlarmControlPanelState.DISARMED


@pytest.mark.parametrize("state", ["armed_night", "armed_vacation"])
async def test_restore_armed_state(entity, state):
    entity._store.async_load.return_value = {"state": state, "armed_mode": state}
    await entity.async_added_to_hass()
    assert entity.alarm_state.value == state
    entity._async_refresh_sensor_listener.assert_called_once()


@pytest.mark.parametrize("state,key,callback", [
    ("arming", "exit_deadline", "_async_finish_exit_delay"),
    ("pending", "entry_deadline", "_async_finish_entry_delay"),
    ("triggered", "alarm_deadline", "_async_alarm_timeout"),
])
@pytest.mark.parametrize("deadline,expected", [(1030, 30), (990, 0), (None, 60)])
async def test_restore_timer_remaining_time(entity, monkeypatch, state, key, callback, deadline, expected):
    monkeypatch.setattr(alarm.time, "time", lambda: 1000)
    schedule = Mock(return_value=Mock())
    monkeypatch.setattr(alarm, "async_call_later", schedule)
    entity._mode_delay = Mock(return_value=60)
    entity._store.async_load.return_value = {
        "state": state, "armed_mode": "armed_home", key: deadline,
        "exit_delay_seconds": 60, "entry_delay_seconds": 60,
    }
    await entity.async_added_to_hass()
    assert schedule.call_args.args[1] == expected
    assert schedule.call_args.args[2] == getattr(entity, callback)


async def test_expired_pending_timer_triggers(entity, monkeypatch):
    monkeypatch.setattr(alarm, "async_call_later", Mock(return_value=Mock()))
    entity._alarm_state = AlarmControlPanelState.PENDING
    await entity._async_finish_entry_delay(None)
    assert entity.alarm_state == AlarmControlPanelState.TRIGGERED
    entity._async_run_transition_actions.assert_awaited()


async def test_stale_timer_cannot_rearm_disarmed_entity(entity):
    await entity._async_finish_exit_delay(None)
    await entity._async_finish_entry_delay(None)
    assert entity.alarm_state == AlarmControlPanelState.DISARMED


async def test_unload_preserves_deadlines_and_cancels_timers(entity):
    entity._exit_deadline = 12345
    cancel = entity._exit_unsub = Mock()
    await entity.async_will_remove_from_hass()
    assert entity._store.async_save.call_args.args[0]["exit_deadline"] == 12345
    cancel.assert_called_once()


class Request(dict):
    def __init__(self, hass, admin):
        super().__init__({KEY_HASS_USER: SimpleNamespace(is_admin=admin)})
        self.app = {KEY_HASS: hass}


def test_http_uses_typed_key_and_requires_admin():
    hass = object()
    assert NGAlarmAdminView.admin_hass(Request(hass, True)) is hass
    with pytest.raises(web.HTTPForbidden):
        NGAlarmAdminView.admin_hass(Request(hass, False))


@pytest.mark.parametrize("view,method", [
    (NGAlarmConfigView, "get"), (NGAlarmConfigView, "post"),
    (NGAlarmReloadView, "post"), (NGAlarmEventsView, "get"),
    (NGAlarmEventsClearView, "post"),
])
async def test_every_panel_endpoint_rejects_nonadmin(view, method):
    with pytest.raises(web.HTTPForbidden):
        await getattr(view(), method)(Request(object(), False))
