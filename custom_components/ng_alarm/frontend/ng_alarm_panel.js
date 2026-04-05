class HAPanelNGAlarm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._initialized = false;
    this._hass = null;
    this._data = {};
    this._activeTab = "general";

    this._labels = {
      name: "Name",
      alarm_code: "Alarm Code",
      panic_code: "Panic Code (optional)",
      exit_delay_away: "Exit Delay Away",
      entry_delay_away: "Entry Delay Away",
      exit_delay_home: "Exit Delay Home",
      entry_delay_home: "Entry Delay Home",
      bypass_state: "Bypass State",
      away_active_sensors: "Away Active Sensors",
      away_bypass_sensors: "Away Bypass Sensors",
      home_active_sensors: "Home Active Sensors",
      home_bypass_sensors: "Home Bypass Sensors",
      bypass_entities: "Bypass Entities",
      pending_scripts: "Pending Scripts",
      triggered_scripts: "Triggered Scripts",
      armed_away_scripts: "Armed Away Scripts",
      armed_home_scripts: "Armed Home Scripts",
      disarmed_scripts: "Disarmed Scripts",
      panic_scripts: "Panic Scripts",
    };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this._renderShell();
      this._bindEvents();
      this._loadConfig();
      this._switchTab(this._activeTab);
    }

    // keep forms in sync with live hass reference
    this.shadowRoot.querySelectorAll("ha-form").forEach((f) => {
      f.hass = hass;
    });
  }

  set narrow(_narrow) {}
  set route(_route) {}
  set panel(_panel) {}

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; height:100%; box-sizing:border-box; }
        .wrap { padding: 16px; max-width: 1100px; margin: 0 auto; color: var(--primary-text-color); }
        .head { display:flex; align-items:center; gap:12px; margin-bottom: 14px; }
        .logo { width:44px; height:44px; border-radius:10px; object-fit:cover; border:1px solid var(--divider-color); }
        h1 { margin:0; font-size: 28px; }
        .muted { color: var(--secondary-text-color); font-size: 0.9rem; }

        .tabs { display:flex; flex-wrap:wrap; gap:8px; margin: 16px 0; }
        .tab { border:1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); border-radius: 10px; padding: 8px 12px; cursor:pointer; }
        .tab.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }

        .section { display:none; }
        .section.active { display:block; }

        ha-card { padding: 14px; margin-bottom: 12px; }

        .footer { display:flex; align-items:center; gap:10px; margin-top: 10px; }
        .save-btn {
          padding: 10px 14px;
          border: none;
          border-radius: 10px;
          background: var(--primary-color);
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }
      </style>

      <div class="wrap">
        <div class="head">
          <img class="logo" src="/ng_alarm_static/alarm_icon.jpg" alt="Alarm Icon" />
          <div>
            <h1>Alarm</h1>
            <div class="muted">Native Home Assistant style configuration</div>
          </div>
        </div>

        <div class="tabs">
          <button class="tab" data-tab="general">⚙️ Generell</button>
          <button class="tab" data-tab="sensors">🧲 Sensoren</button>
          <button class="tab" data-tab="actions">🎬 Aktionen</button>
        </div>

        <div id="general" class="section">
          <ha-card header="Generelle Einstellungen">
            <ha-form id="form-general"></ha-form>
          </ha-card>
        </div>

        <div id="sensors" class="section">
          <ha-card header="Sensor Verwaltung">
            <ha-form id="form-sensors"></ha-form>
          </ha-card>
        </div>

        <div id="actions" class="section">
          <ha-card header="Aktionen / Skripte">
            <ha-form id="form-actions"></ha-form>
          </ha-card>
        </div>

        <div class="footer">
          <button id="save" class="save-btn">Speichern & Reload</button>
          <div class="muted" id="status"></div>
        </div>
      </div>
    `;

    this._setupForms();
  }

  _schemaGeneral() {
    return [
      { name: "name", selector: { text: {} } },
      { name: "alarm_code", selector: { text: { type: "password" } } },
      { name: "panic_code", selector: { text: { type: "password" } } },
      { name: "exit_delay_away", selector: { number: { min: 0, max: 600, step: 1, mode: "slider", unit_of_measurement: "s" } } },
      { name: "entry_delay_away", selector: { number: { min: 0, max: 600, step: 1, mode: "slider", unit_of_measurement: "s" } } },
      { name: "exit_delay_home", selector: { number: { min: 0, max: 600, step: 1, mode: "slider", unit_of_measurement: "s" } } },
      { name: "entry_delay_home", selector: { number: { min: 0, max: 600, step: 1, mode: "slider", unit_of_measurement: "s" } } },
      { name: "bypass_state", selector: { text: {} } },
    ];
  }

  _schemaSensors() {
    return [
      { name: "away_active_sensors", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { name: "away_bypass_sensors", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { name: "home_active_sensors", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { name: "home_bypass_sensors", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { name: "bypass_entities", selector: { entity: { multiple: true } } },
    ];
  }

  _schemaActions() {
    return [
      { name: "pending_scripts", selector: { entity: { multiple: true, filter: { domain: "script" } } } },
      { name: "triggered_scripts", selector: { entity: { multiple: true, filter: { domain: "script" } } } },
      { name: "armed_away_scripts", selector: { entity: { multiple: true, filter: { domain: "script" } } } },
      { name: "armed_home_scripts", selector: { entity: { multiple: true, filter: { domain: "script" } } } },
      { name: "disarmed_scripts", selector: { entity: { multiple: true, filter: { domain: "script" } } } },
      { name: "panic_scripts", selector: { entity: { multiple: true, filter: { domain: "script" } } } },
    ];
  }

  _setupForms() {
    const mkForm = (id, schema) => {
      const form = this.shadowRoot.getElementById(id);
      form.hass = this._hass;
      form.data = this._data;
      form.schema = schema;
      form.computeLabel = (item) => this._labels[item.name] || item.name;
      form.addEventListener("value-changed", (ev) => {
        this._data = { ...this._data, ...ev.detail.value };
      });
    };

    mkForm("form-general", this._schemaGeneral());
    mkForm("form-sensors", this._schemaSensors());
    mkForm("form-actions", this._schemaActions());
  }

  _refreshForms() {
    this.shadowRoot.querySelectorAll("ha-form").forEach((form) => {
      form.data = this._data;
      form.hass = this._hass;
    });
  }

  _bindEvents() {
    this.shadowRoot.getElementById("save").addEventListener("click", () => this._saveConfig());

    this.shadowRoot.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => this._switchTab(btn.dataset.tab));
    });
  }

  _switchTab(tab) {
    this._activeTab = tab;
    this.shadowRoot.querySelectorAll(".tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    this.shadowRoot.querySelectorAll(".section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === tab);
    });
  }

  async _loadConfig() {
    try {
      // Use authenticated HA API helper instead of direct fetch to avoid 401 in panel contexts.
      const data = await this._hass.callApi("get", "ng_alarm/config");
      this._data = { ...data };
      this._refreshForms();
      this._status("Konfiguration geladen.");
    } catch (err) {
      this._status(`Laden fehlgeschlagen: ${err.message}`);
    }
  }

  async _saveConfig() {
    try {
      await this._hass.callApi("post", "ng_alarm/config", this._data);
      this._status("Gespeichert und runtime neu geladen.");
    } catch (err) {
      this._status(`Speichern fehlgeschlagen: ${err.message}`);
    }
  }

  _status(text) {
    const s = this.shadowRoot.getElementById("status");
    if (s) s.textContent = text;
  }
}

if (!customElements.get("ha-panel-ng-alarm")) {
  customElements.define("ha-panel-ng-alarm", HAPanelNGAlarm);
}
if (!customElements.get("ng-alarm-panel")) {
  customElements.define("ng-alarm-panel", HAPanelNGAlarm);
}
