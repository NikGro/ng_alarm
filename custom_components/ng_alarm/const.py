"""Constants for the NG Alarm integration."""

from __future__ import annotations

DOMAIN = "ng_alarm"

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.config"
RUNTIME_STATE_KEY = f"{DOMAIN}.runtime"

PANEL_URL_PATH = "ng-alarm"
PANEL_COMPONENT_NAME = "ng-alarm-panel"
PANEL_STATIC_URL = "/ng_alarm_static"
PANEL_JS_FILE = "ng_alarm_panel.js"

API_GET_CONFIG = "/api/ng_alarm/config"
API_SET_CONFIG = "/api/ng_alarm/config"
API_RELOAD = "/api/ng_alarm/reload"

UNKNOWN = "unknown"

CONF_NAME = "name"
CONF_ALARM_CODE = "alarm_code"
CONF_PANIC_CODE = "panic_code"
CONF_EXIT_DELAY_AWAY = "exit_delay_away"
CONF_ENTRY_DELAY_AWAY = "entry_delay_away"
CONF_EXIT_DELAY_HOME = "exit_delay_home"
CONF_ENTRY_DELAY_HOME = "entry_delay_home"
CONF_AWAY_ACTIVE_SENSORS = "away_active_sensors"
CONF_AWAY_BYPASS_SENSORS = "away_bypass_sensors"
CONF_HOME_ACTIVE_SENSORS = "home_active_sensors"
CONF_HOME_BYPASS_SENSORS = "home_bypass_sensors"
CONF_BYPASS_ENTITIES = "bypass_entities"
CONF_BYPASS_STATE = "bypass_state"
CONF_PENDING_SCRIPTS = "pending_scripts"
CONF_TRIGGERED_SCRIPTS = "triggered_scripts"
CONF_ARMED_AWAY_SCRIPTS = "armed_away_scripts"
CONF_ARMED_HOME_SCRIPTS = "armed_home_scripts"
CONF_DISARMED_SCRIPTS = "disarmed_scripts"
CONF_PANIC_SCRIPTS = "panic_scripts"

ATTR_TRIGGERED_SENSOR = "triggered_sensor"
ATTR_TRIGGERED_SENSOR_NAME = "triggered_sensor_name"
ATTR_ALARM_MODE = "alarm_mode"
ATTR_ALARM_STATE = "alarm_state"

DEFAULTS: dict = {
    CONF_NAME: "NG Alarm",
    CONF_ALARM_CODE: "",
    CONF_PANIC_CODE: "",
    CONF_EXIT_DELAY_AWAY: 60,
    CONF_ENTRY_DELAY_AWAY: 30,
    CONF_EXIT_DELAY_HOME: 30,
    CONF_ENTRY_DELAY_HOME: 20,
    CONF_AWAY_ACTIVE_SENSORS: [],
    CONF_AWAY_BYPASS_SENSORS: [],
    CONF_HOME_ACTIVE_SENSORS: [],
    CONF_HOME_BYPASS_SENSORS: [],
    CONF_BYPASS_ENTITIES: [],
    CONF_BYPASS_STATE: "cleaning",
    CONF_PENDING_SCRIPTS: [],
    CONF_TRIGGERED_SCRIPTS: [],
    CONF_ARMED_AWAY_SCRIPTS: [],
    CONF_ARMED_HOME_SCRIPTS: [],
    CONF_DISARMED_SCRIPTS: [],
    CONF_PANIC_SCRIPTS: [],
}

LIST_KEYS = {
    CONF_AWAY_ACTIVE_SENSORS,
    CONF_AWAY_BYPASS_SENSORS,
    CONF_HOME_ACTIVE_SENSORS,
    CONF_HOME_BYPASS_SENSORS,
    CONF_BYPASS_ENTITIES,
    CONF_PENDING_SCRIPTS,
    CONF_TRIGGERED_SCRIPTS,
    CONF_ARMED_AWAY_SCRIPTS,
    CONF_ARMED_HOME_SCRIPTS,
    CONF_DISARMED_SCRIPTS,
    CONF_PANIC_SCRIPTS,
}

INT_KEYS = {
    CONF_EXIT_DELAY_AWAY,
    CONF_ENTRY_DELAY_AWAY,
    CONF_EXIT_DELAY_HOME,
    CONF_ENTRY_DELAY_HOME,
}
