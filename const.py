"""Constants for the NG Alarm integration."""

DOMAIN = "ng_alarm"

# Config keys
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

# Default values
DEFAULT_NAME = "NG Alarm"
DEFAULT_EXIT_DELAY_AWAY = 60
DEFAULT_ENTRY_DELAY_AWAY = 30
DEFAULT_EXIT_DELAY_HOME = 30
DEFAULT_ENTRY_DELAY_HOME = 20
DEFAULT_BYPASS_STATE = "cleaning"

# Storage key
STORAGE_KEY = "ng_alarm_storage"

# State attributes
ATTR_TRIGGERED_SENSOR = "triggered_sensor"
ATTR_TRIGGERED_SENSOR_NAME = "triggered_sensor_name"
ATTR_ALARM_MODE = "alarm_mode"
ATTR_ALARM_STATE = "alarm_state"