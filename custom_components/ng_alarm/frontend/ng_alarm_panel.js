class HAPanelNGAlarm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._initialized = false;
    this._hass = null;
    this._data = {};
    this._events = [];
    this._activeTab = "general";

    this._labels = {
      name: "Name",
      alarm_code: "Master Alarm Code (legacy)",
      panic_code: "Master Panic Code (legacy)",
      exit_delay_away: "Exit Delay Away",
      entry_delay_away: "Entry Delay Away",
      exit_delay_home: "Exit Delay Home",
      entry_delay_home: "Entry Delay Home",
      bypass_mode: "Bypass Mode",
      bypass_state: "Bypass Entity State",
      bypass_template: "Bypass Template",
      away_active_sensors: "Away Active Sensors",
      away_bypass_sensors: "Away Bypass Sensors",
      home_active_sensors: "Home Active Sensors",
      home_bypass_sensors: "Home Bypass Sensors",
      bypass_entities: "Bypass Entities",
      away_trigger_states: "Away Trigger States",
      home_trigger_states: "Home Trigger States",
      ignore_unknown_states: "Ignore unknown states",
      ignore_unavailable_states: "Ignore unavailable states",
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

    this.shadowRoot.querySelectorAll("ha-form, ha-selector").forEach((el) => {
      el.hass = hass;
    });
  }

  set narrow(_narrow) {}
  set route(_route) {}
  set panel(_panel) {}

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; height:100%; box-sizing:border-box; }
        .wrap { padding: 16px; max-width: 1180px; margin: 0 auto; color: var(--primary-text-color); }
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
        .grid { display: grid; gap: 10px; }
        .row { display:grid; grid-template-columns: 1.2fr 1fr auto auto auto auto; gap:8px; align-items:center; margin-bottom:8px; }
        .row.actions { grid-template-columns: 1fr 1fr 1fr 1.5fr auto; }
        .row input { width:100%; box-sizing:border-box; padding:8px; border-radius:8px; border:1px solid var(--divider-color); background: var(--card-background-color); color:var(--primary-text-color); }
        .checks { display:flex; gap:8px; font-size:0.9rem; }
        .pill { border: 1px solid var(--divider-color); border-radius: 8px; padding: 6px 10px; }
        .btn { border:1px solid var(--divider-color); border-radius:10px; background: var(--card-background-color); color: var(--primary-text-color); padding: 8px 12px; cursor:pointer; }
        .btn.danger { border-color: #b00020; color:#b00020; }
        .btn.primary { border:none; background: var(--primary-color); color:white; font-weight:600; }
        .event { border:1px solid var(--divider-color); border-radius:8px; padding:8px 10px; margin-bottom:8px; }

        .footer { display:flex; align-items:center; gap:10px; margin-top: 10px; }
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
          <button class="tab" data-tab="general">⚙️ General</button>
          <button class="tab" data-tab="sensors">🧲 Sensors</button>
          <button class="tab" data-tab="users">👤 Users & Codes</button>
          <button class="tab" data-tab="actions">🎬 Action Builder</button>
          <button class="tab" data-tab="events">📜 Event Log</button>
        </div>

        <div id="general" class="section">
          <ha-card header="General Settings"><ha-form id="form-general"></ha-form></ha-card>
        </div>

        <div id="sensors" class="section">
          <ha-card header="Sensor Configuration"><ha-form id="form-sensors"></ha-form></ha-card>
          <ha-card header="Legacy State Actions"><ha-form id="form-actions-legacy"></ha-form></ha-card>
        </div>

        <div id="users" class="section">
          <ha-card header="Users & Permissions">
            <div class="muted">Codes with permissions for arm/disarm/panic.</div>
            <div id="users-list" class="grid" style="margin-top:10px"></div>
            <button id="users-add" class="btn" type="button">+ Add user</button>
          </ha-card>
        </div>

        <div id="actions" class="section">
          <ha-card header="Action Rules">
            <div class="muted">from/to/through filters + script targets</div>
            <div id="actions-list" class="grid" style="margin-top:10px"></div>
            <button id="actions-add" class="btn" type="button">+ Add action rule</button>
          </ha-card>
        </div>

        <div id="events" class="section">
          <ha-card header="Event Log">
            <div style="display:flex;gap:8px;margin-bottom:10px">
              <button id="events-refresh" class="btn" type="button">Refresh</button>
              <button id="events-clear" class="btn danger" type="button">Clear</button>
            </div>
            <div id="events-list"></div>
          </ha-card>
        </div>

        <div class="footer">
          <button id="save" class="btn primary">Save & Reload</button>
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
      {
        name: "bypass_mode",
        selector: {
          select: {
            options: [
              { value: "entity_state", label: "Entity state" },
              { value: "template", label: "Template" },
            ],
            mode: "dropdown",
          },
        },
      },
      { name: "bypass_entities", selector: { entity: { multiple: true } } },
      { name: "bypass_state", selector: { text: {} } },
      { name: "bypass_template", selector: { template: {} } },
    ];
  }

  _schemaSensors() {
    const triggerOptions = ["on", "open", "motion", "detected", "unknown", "unavailable"];
    return [
      { name: "away_active_sensors", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { name: "away_bypass_sensors", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { name: "home_active_sensors", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { name: "home_bypass_sensors", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      {
        name: "away_trigger_states",
        selector: { select: { multiple: true, mode: "list", options: triggerOptions.map((v) => ({ value: v, label: v })) } },
      },
      {
        name: "home_trigger_states",
        selector: { select: { multiple: true, mode: "list", options: triggerOptions.map((v) => ({ value: v, label: v })) } },
      },
      { name: "ignore_unknown_states", selector: { boolean: {} } },
      { name: "ignore_unavailable_states", selector: { boolean: {} } },
    ];
  }

  _schemaLegacyActions() {
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
    mkForm("form-actions-legacy", this._schemaLegacyActions());
  }

  _refreshForms() {
    this.shadowRoot.querySelectorAll("ha-form").forEach((form) => {
      form.data = this._data;
      form.hass = this._hass;
    });
    this._renderUsers();
    this._renderActions();
  }

  _bindEvents() {
    this.shadowRoot.getElementById("save").addEventListener("click", () => this._saveConfig());

    this.shadowRoot.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => this._switchTab(btn.dataset.tab));
    });

    this.shadowRoot.getElementById("users-add").addEventListener("click", () => {
      const users = [...(this._data.users || [])];
      users.push({ name: "", code: "", can_arm: true, can_disarm: true, can_panic: false });
      this._data.users = users;
      this._renderUsers();
    });

    this.shadowRoot.getElementById("actions-add").addEventListener("click", () => {
      const actions = [...(this._data.actions || [])];
      actions.push({ from: [], to: [], through: [], scripts: [] });
      this._data.actions = actions;
      this._renderActions();
    });

    this.shadowRoot.getElementById("events-refresh").addEventListener("click", () => this._loadEvents());
    this.shadowRoot.getElementById("events-clear").addEventListener("click", () => this._clearEvents());
  }

  _switchTab(tab) {
    this._activeTab = tab;
    this.shadowRoot.querySelectorAll(".tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    this.shadowRoot.querySelectorAll(".section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === tab);
    });

    if (tab === "events") {
      this._loadEvents();
    }
  }

  _renderUsers() {
    const host = this.shadowRoot.getElementById("users-list");
    if (!host) return;
    const users = this._data.users || [];
    host.innerHTML = "";

    users.forEach((u, idx) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <input data-key="name" value="${(u.name || "").replaceAll('"', '&quot;')}" placeholder="Name" />
        <input data-key="code" type="password" value="${(u.code || "").replaceAll('"', '&quot;')}" placeholder="Code" />
        <label class="pill"><input data-key="can_arm" type="checkbox" ${u.can_arm ? "checked" : ""} /> Arm</label>
        <label class="pill"><input data-key="can_disarm" type="checkbox" ${u.can_disarm ? "checked" : ""} /> Disarm</label>
        <label class="pill"><input data-key="can_panic" type="checkbox" ${u.can_panic ? "checked" : ""} /> Panic</label>
        <button class="btn danger" data-del="1" type="button">✕</button>
      `;

      row.querySelectorAll("input[data-key]").forEach((inp) => {
        inp.addEventListener("input", () => {
          const key = inp.dataset.key;
          const usersNow = [...(this._data.users || [])];
          usersNow[idx] = { ...usersNow[idx], [key]: inp.type === "checkbox" ? inp.checked : inp.value };
          this._data.users = usersNow;
        });
      });

      row.querySelector("button[data-del]").addEventListener("click", () => {
        const usersNow = [...(this._data.users || [])];
        usersNow.splice(idx, 1);
        this._data.users = usersNow;
        this._renderUsers();
      });

      host.appendChild(row);
    });
  }

  _renderActions() {
    const host = this.shadowRoot.getElementById("actions-list");
    if (!host) return;
    host.innerHTML = "";

    const actions = this._data.actions || [];
    actions.forEach((action, idx) => {
      const row = document.createElement("div");
      row.className = "row actions";

      const fromInput = document.createElement("input");
      fromInput.placeholder = "from (comma-separated, e.g. armed_home,pending or any)";
      fromInput.value = (action.from || []).join(",");

      const toInput = document.createElement("input");
      toInput.placeholder = "to (comma-separated)";
      toInput.value = (action.to || []).join(",");

      const throughInput = document.createElement("input");
      throughInput.placeholder = "through mode (armed_home, armed_away, any)";
      throughInput.value = (action.through || []).join(",");

      const selector = document.createElement("ha-selector");
      selector.hass = this._hass;
      selector.selector = { entity: { multiple: true, filter: { domain: "script" } } };
      selector.value = action.scripts || [];

      const delBtn = document.createElement("button");
      delBtn.className = "btn danger";
      delBtn.type = "button";
      delBtn.textContent = "✕";

      const update = () => {
        const actionsNow = [...(this._data.actions || [])];
        actionsNow[idx] = {
          from: fromInput.value.split(",").map((s) => s.trim()).filter(Boolean),
          to: toInput.value.split(",").map((s) => s.trim()).filter(Boolean),
          through: throughInput.value.split(",").map((s) => s.trim()).filter(Boolean),
          scripts: selector.value || [],
        };
        this._data.actions = actionsNow;
      };

      fromInput.addEventListener("input", update);
      toInput.addEventListener("input", update);
      throughInput.addEventListener("input", update);
      selector.addEventListener("value-changed", (ev) => {
        selector.value = ev.detail.value;
        update();
      });

      delBtn.addEventListener("click", () => {
        const actionsNow = [...(this._data.actions || [])];
        actionsNow.splice(idx, 1);
        this._data.actions = actionsNow;
        this._renderActions();
      });

      row.append(fromInput, toInput, throughInput, selector, delBtn);
      host.appendChild(row);
    });
  }

  async _loadConfig() {
    try {
      const data = await this._hass.callApi("get", "ng_alarm/config");
      this._data = {
        users: [],
        actions: [],
        away_trigger_states: ["on"],
        home_trigger_states: ["on"],
        ignore_unknown_states: true,
        ignore_unavailable_states: true,
        ...data,
      };
      this._refreshForms();
      this._status("Configuration loaded.");
    } catch (err) {
      this._status(`Load failed: ${err.message}`);
    }
  }

  async _loadEvents() {
    try {
      const payload = await this._hass.callApi("get", "ng_alarm/events");
      this._events = payload.events || [];
      const host = this.shadowRoot.getElementById("events-list");
      host.innerHTML = "";
      if (!this._events.length) {
        host.innerHTML = `<div class="muted">No events yet.</div>`;
        return;
      }
      [...this._events].reverse().forEach((ev) => {
        const item = document.createElement("div");
        item.className = "event";
        const ts = new Date((ev.ts || 0) * 1000).toLocaleString();
        item.innerHTML = `<strong>${ev.event || "event"}</strong> • ${ts}<br/>${ev.message || ""}<br/><span class="muted">state=${ev.state || ""} mode=${ev.mode || ""} actor=${ev.actor || ""}</span>`;
        host.appendChild(item);
      });
    } catch (err) {
      this._status(`Events load failed: ${err.message}`);
    }
  }

  async _clearEvents() {
    try {
      await this._hass.callApi("post", "ng_alarm/events/clear", {});
      this._events = [];
      await this._loadEvents();
      this._status("Event log cleared.");
    } catch (err) {
      this._status(`Event clear failed: ${err.message}`);
    }
  }

  async _saveConfig() {
    try {
      await this._hass.callApi("post", "ng_alarm/config", this._data);
      this._status("Saved and runtime reloaded.");
      await this._loadEvents();
    } catch (err) {
      this._status(`Save failed: ${err.message}`);
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
