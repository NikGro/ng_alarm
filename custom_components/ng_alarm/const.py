"""Constants for the NG Alarm integration."""

from __future__ import annotations

DOMAIN = "ng_alarm"

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.config"
RUNTIME_STATE_KEY = f"{DOMAIN}.runtime"

PANEL_URL_PATH = "alarm"
PANEL_COMPONENT_NAME = "ng-alarm"
PANEL_STATIC_URL = "/ng_alarm_static"
PANEL_JS_FILE = "ng_alarm_panel.js"

API_GET_CONFIG = "/api/ng_alarm/config"
API_SET_CONFIG = "/api/ng_alarm/config"
API_RELOAD = "/api/ng_alarm/reload"
API_EVENTS = "/api/ng_alarm/events"
API_EVENTS_CLEAR = "/api/ng_alarm/events/clear"

UNKNOWN = "unknown"

CONF_NAME = "name"
CONF_REQUIRE_CODE_TO_ARM = "require_code_to_arm"
CONF_MODES = "modes"
CONF_SENSOR_RULES = "sensor_rules"
CONF_GLOBAL_BYPASS_RULES = "global_bypass_rules"
CONF_SENSOR_BYPASS_GLOBAL_IDS = "bypass_global_ids"
CONF_SENSOR_TRIGGER_UNKNOWN_UNAVAILABLE = "trigger_unknown_unavailable"
CONF_SENSOR_TRIGGER_ON_OPEN_ONLY = "trigger_on_open_only"
CONF_EXPOSE_EVENT_LOG_SENSOR = "expose_event_log_sensor"
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
CONF_BYPASS_MODE = "bypass_mode"
CONF_BYPASS_TEMPLATE = "bypass_template"
CONF_USERS = "users"
CONF_ACTIONS = "actions"
CONF_AWAY_TRIGGER_STATES = "away_trigger_states"
CONF_HOME_TRIGGER_STATES = "home_trigger_states"
CONF_IGNORE_UNKNOWN_STATES = "ignore_unknown_states"
CONF_IGNORE_UNAVAILABLE_STATES = "ignore_unavailable_states"
CONF_PENDING_SCRIPTS = "pending_scripts"
CONF_TRIGGERED_SCRIPTS = "triggered_scripts"
CONF_ARMED_AWAY_SCRIPTS = "armed_away_scripts"
CONF_ARMED_HOME_SCRIPTS = "armed_home_scripts"
CONF_DISARMED_SCRIPTS = "disarmed_scripts"
CONF_PANIC_SCRIPTS = "panic_scripts"

CONF_USER_NAME = "name"
CONF_USER_CODE = "code"
CONF_USER_CAN_ARM = "can_arm"
CONF_USER_CAN_DISARM = "can_disarm"
CONF_USER_CAN_PANIC = "can_panic"
CONF_USER_ARM_MODES = "arm_modes"
CONF_USER_DISARM_MODES = "disarm_modes"

CONF_ACTION_FROM = "from"
CONF_ACTION_TO = "to"
CONF_ACTION_THROUGH = "through"
CONF_ACTION_BY_USER = "by_user"
CONF_ACTION_SCRIPTS = "scripts"
CONF_ACTION_TARGETS = "targets"
CONF_MODE_ALARM_DURATION = "alarm_duration"
CONF_MODE_TIMEOUT_ACTION = "timeout_action"

BYPASS_MODE_ENTITY_STATE = "entity_state"
BYPASS_MODE_TEMPLATE = "template"

ATTR_TRIGGERED_SENSOR = "triggered_sensor"
ATTR_TRIGGERED_SENSOR_NAME = "triggered_sensor_name"
ATTR_ALARM_MODE = "alarm_mode"
ATTR_ALARM_STATE = "alarm_state"
ATTR_ACTOR = "actor"

DEFAULTS: dict = {
    CONF_NAME: "NG Alarm",
    CONF_REQUIRE_CODE_TO_ARM: True,
    CONF_MODES: [],
    CONF_SENSOR_RULES: [],
    CONF_GLOBAL_BYPASS_RULES: [],
    CONF_EXPOSE_EVENT_LOG_SENSOR: False,
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
    CONF_BYPASS_MODE: BYPASS_MODE_ENTITY_STATE,
    CONF_BYPASS_TEMPLATE: "",
    CONF_USERS: [],
    CONF_ACTIONS: [],
    CONF_AWAY_TRIGGER_STATES: ["on"],
    CONF_HOME_TRIGGER_STATES: ["on"],
    CONF_IGNORE_UNKNOWN_STATES: True,
    CONF_IGNORE_UNAVAILABLE_STATES: True,
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
    CONF_AWAY_TRIGGER_STATES,
    CONF_HOME_TRIGGER_STATES,
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
