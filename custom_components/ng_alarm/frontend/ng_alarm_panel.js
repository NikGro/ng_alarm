class HAPanelNGAlarm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._initialized = false;
    this._hass = null;
    this._data = {};
    this._events = [];
    this._activeTab = "general";
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
        .wrap { padding: 12px; max-width: 980px; margin: 0 auto; color: var(--primary-text-color); }
        .head { display:flex; align-items:center; gap:10px; margin-bottom: 12px; }
        .logo { width:40px; height:40px; border-radius:10px; object-fit:cover; border:1px solid var(--divider-color); }
        h1 { margin:0; font-size: 24px; }
        .muted { color: var(--secondary-text-color); font-size: 0.9rem; }

        .tabs { display:flex; flex-wrap:wrap; gap:8px; margin: 12px 0; }
        .tab {
          border:1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          border-radius: 10px;
          padding: 8px 11px;
          cursor:pointer;
        }
        .tab.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }

        .section { display:none; }
        .section.active { display:block; }

        ha-card { padding: 12px; margin-bottom: 12px; }

        .list { display:grid; gap:10px; }
        .item {
          border:1px solid var(--divider-color);
          border-radius: 12px;
          padding:10px;
          background: var(--secondary-background-color, var(--card-background-color));
        }
        details > summary { cursor:pointer; font-weight:600; }
        .row { display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px; }

        .btn {
          border:1px solid var(--divider-color);
          border-radius:10px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          padding: 8px 12px;
          cursor:pointer;
        }
        .btn.primary { border:none; background: var(--primary-color); color:white; font-weight:600; }
        .btn.danger { border-color:#b00020; color:#b00020; margin-top: 10px; }
        #modes-add, #sensors-add, #users-add, #actions-add { margin-top: 10px; }
        #events-list .item { margin-bottom: 10px; line-height: 1.35; }
        hr.sep { border: none; border-top: 1px dashed var(--divider-color); margin: 8px 0; grid-column: 1 / -1; }

        .footer { display:flex; align-items:center; gap:10px; margin-top: 10px; }

        @media (max-width: 800px) {
          .wrap { max-width: 100%; padding: 10px; }
          .row { grid-template-columns: 1fr; }
          .tabs .tab { flex: 1 1 auto; min-width: 42%; }
        }
      </style>

      <div class="wrap">
        <div class="head">
          <img class="logo" src="/ng_alarm_static/alarm_icon.jpg" alt="Alarm Icon" />
          <div>
            <h1>Alarm</h1>
            <div class="muted">Konfiguration ohne Legacy-Master-Codes</div>
          </div>
        </div>

        <div class="tabs">
          <button class="tab" data-tab="general">⚙️ General</button>
          <button class="tab" data-tab="modes">🧩 Modes</button>
          <button class="tab" data-tab="sensors">🧲 Sensors</button>
          <button class="tab" data-tab="users">👤 Users</button>
          <button class="tab" data-tab="actions">🎬 Actions</button>
          <button class="tab" data-tab="events">📜 Events</button>
        </div>

        <div id="general" class="section">
          <ha-card header="General Settings">
            <div class="muted">(intentionally empty)</div>
          </ha-card>
        </div>

        <div id="modes" class="section">
          <ha-card header="Zones (formerly Modes)">
            <div class="muted">Jede Zone kann eigene Arming-Typen/Delays/Bypass-Konfiguration haben.</div>
            <div id="modes-list" class="list" style="margin-top:10px"></div>
            <button id="modes-add" class="btn" type="button">+ Add zone</button>
          </ha-card>
        </div>

        <div id="sensors" class="section">
          <ha-card header="Sensors">
            <div class="muted">Pro Sensor Zonen, Bypass und Trigger-Flags</div>
            <div id="sensors-list" class="list" style="margin-top:10px"></div>
            <button id="sensors-add" class="btn" type="button">+ Add sensor</button>
          </ha-card>
        </div>

        <div id="users" class="section">
          <ha-card header="Users & Codes">
            <div id="users-list" class="list"></div>
            <button id="users-add" class="btn" type="button">+ Add user</button>
          </ha-card>
        </div>

        <div id="actions" class="section">
          <ha-card header="Action Builder">
            <div id="actions-list" class="list"></div>
            <button id="actions-add" class="btn" type="button">+ Add action</button>
            <div class="muted" style="margin-top:10px">
              Script/target variables available: <code>from_state</code>, <code>to_state</code>, <code>alarm_mode</code>, <code>actor</code>, <code>triggered_sensor</code>, <code>triggered_sensor_name</code>.
            </div>
          </ha-card>
        </div>

        <div id="events" class="section">
          <ha-card header="Event Log">
            <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
              <button id="events-refresh" class="btn" type="button">Refresh</button>
              <button id="events-export" class="btn" type="button">Export JSON</button>
              <button id="events-clear" class="btn danger" type="button">Clear</button>
            </div>
            <div id="events-sensor-toggle" style="margin-bottom:10px"></div>
            <div id="events-list"></div>
          </ha-card>
        </div>

        <div class="footer">
          <button id="save" class="btn primary">Save & Reload</button>
          <div class="muted" id="status"></div>
        </div>
      </div>
    `;

  }

  _bindEvents() {
    this.shadowRoot.getElementById("save").addEventListener("click", () => this._saveConfig());
    this.shadowRoot.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => this._switchTab(btn.dataset.tab));
    });

    this.shadowRoot.getElementById("modes-add").addEventListener("click", () => {
      const modes = [...(this._data.modes || [])];
      modes.push({ id: "", name: "", icon: "mdi:shield", arm_target: "away", require_code_to_arm: false, exit_delay: 60, entry_delay: 30, bypass_mode: "none", bypass_entities: [], bypass_template: "" });
      this._data.modes = modes;
      this._renderModes();
    });

    this.shadowRoot.getElementById("sensors-add").addEventListener("click", () => {
      const rules = [...(this._data.sensor_rules || [])];
      rules.push({ entity_id: "", modes: [], bypass_modes: [], allow_open_arm: false, trigger_on_open_only: false, trigger_unknown_unavailable: false });
      this._data.sensor_rules = rules;
      this._renderSensors();
    });

    this.shadowRoot.getElementById("users-add").addEventListener("click", () => {
      const users = [...(this._data.users || [])];
      users.push({ name: "", code: "", can_arm: true, can_disarm: true, can_panic: false, arm_modes: [], disarm_modes: [] });
      this._data.users = users;
      this._renderUsers();
    });

    this.shadowRoot.getElementById("actions-add").addEventListener("click", () => {
      const actions = [...(this._data.actions || [])];
      actions.push({ name: "", from: ["any"], to: ["any"], through: ["any"], by_user: "any", targets: [] });
      this._data.actions = actions;
      this._renderActions();
    });

    this.shadowRoot.getElementById("events-refresh").addEventListener("click", () => this._loadEvents());
    this.shadowRoot.getElementById("events-export").addEventListener("click", () => this._exportEvents());
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

    if (tab === "events") this._loadEvents();
  }

  _sel(config, value, onChange, label = "") {
    const wrap = document.createElement("div");
    const sel = document.createElement("ha-selector");
    sel.hass = this._hass;
    sel.selector = config;
    sel.value = value;
    if (label) sel.label = label;
    sel.addEventListener("value-changed", (ev) => {
      sel.value = ev.detail.value;
      onChange(ev.detail.value);
    });
    wrap.appendChild(sel);
    return wrap;
  }

  _modeOptions() {
    return (this._data.modes || []).map((m) => ({ value: m.id || "", label: m.name || m.id || "mode" }));
  }

  _renderModes() {
    const host = this.shadowRoot.getElementById("modes-list");
    if (!host) return;
    host.innerHTML = "";

    (this._data.modes || []).forEach((mode, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      const details = document.createElement("details");
      details.open = !mode.name;
      const summary = document.createElement("summary");
      summary.innerHTML = `<ha-icon icon="${mode.icon || "mdi:shield"}"></ha-icon> ${mode.name || mode.id || `Zone #${idx + 1}`}`;
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";

      const upd = (patch) => {
        const modes = [...(this._data.modes || [])];
        const next = { ...modes[idx], ...patch };
        if (typeof next.id === "string") {
          next.id = next.id.trim().toLowerCase().replace(/\s+/g, "_");
        }
        modes[idx] = next;
        this._data.modes = modes;
        summary.innerHTML = `<ha-icon icon="${next.icon || "mdi:shield"}"></ha-icon> ${next.name || next.id || `Zone #${idx + 1}`}`;
      };

      row.append(
        this._sel({ text: {} }, mode.id || "", (v) => upd({ id: v }), "Zone ID"),
        this._sel({ text: {} }, mode.name || "", (v) => upd({ name: v }), "Zone name"),
        this._sel({ icon: {} }, mode.icon || "mdi:shield", (v) => upd({ icon: v }), "Zone icon"),
        this._sel({ select: { mode: "dropdown", options: [{ value: "away", label: "Away" }, { value: "home", label: "Home" }, { value: "night", label: "Night" }, { value: "vacation", label: "Vacation" }] } }, mode.arm_target || "away", (v) => upd({ arm_target: v }), "Arm type"),
        this._sel({ boolean: {} }, !!mode.require_code_to_arm, (v) => upd({ require_code_to_arm: !!v }), "Code required for arming"),
        this._sel({ number: { min: 0, max: 600, step: 1, mode: "box", unit_of_measurement: "s" } }, mode.exit_delay ?? 60, (v) => upd({ exit_delay: Number(v || 0) }), "Exit delay"),
        this._sel({ number: { min: 0, max: 600, step: 1, mode: "box", unit_of_measurement: "s" } }, mode.entry_delay ?? 30, (v) => upd({ entry_delay: Number(v || 0) }), "Pending (entry) delay"),
        this._sel({ number: { min: 0, max: 3600, step: 1, mode: "box", unit_of_measurement: "s" } }, mode.alarm_duration ?? 0, (v) => upd({ alarm_duration: Number(v || 0) }), "Alarm duration (0 = infinite)"),
        this._sel({ select: { mode: "dropdown", options: [{ value: "none", label: "No timeout action" }, { value: "disarm", label: "Disarm after duration" }, { value: "rearm", label: "Re-arm same mode after duration" }] } }, mode.timeout_action || "none", (v) => upd({ timeout_action: v || "none" }), "After alarm duration"),
        this._sel({ select: { mode: "dropdown", options: [{ value: "none", label: "No bypass" }, { value: "entity_state", label: "Entity state" }, { value: "template", label: "Template" }] } }, mode.bypass_mode || "none", (v) => { upd({ bypass_mode: v }); this._renderModes(); }, "Bypass mode"),
      );

      const by = mode.bypass_mode || "none";
      if (by === "entity_state") {
        row.append(
          this._sel({ entity: { multiple: true } }, mode.bypass_entities || [], (v) => upd({ bypass_entities: v || [] }), "Bypass entities (true = bypass)"),
        );
      }
      if (by === "template") {
        row.append(this._sel({ template: {} }, mode.bypass_template || "", (v) => upd({ bypass_template: v }), "Bypass template"));
      }

      const del = document.createElement("button");
      del.className = "btn danger";
      del.type = "button";
      del.textContent = "Delete zone";
      del.addEventListener("click", () => {
        const modes = [...(this._data.modes || [])];
        modes.splice(idx, 1);
        this._data.modes = modes;
        this._renderModes();
        this._renderSensors();
        this._renderActions();
      });

      details.appendChild(row);
      details.appendChild(del);
      item.appendChild(details);
      host.appendChild(item);
    });
  }

  _renderSensors() {
    const host = this.shadowRoot.getElementById("sensors-list");
    if (!host) return;
    host.innerHTML = "";
    const modeOptions = this._modeOptions();

    (this._data.sensor_rules || []).forEach((rule, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      const details = document.createElement("details");
      details.open = !rule.entity_id;
      const summary = document.createElement("summary");
      const st = rule.entity_id ? this._hass?.states?.[rule.entity_id] : null;
      const icon = st?.attributes?.icon || "mdi:motion-sensor";
      const name = st?.attributes?.friendly_name || rule.entity_id || `Sensor rule #${idx + 1}`;
      summary.innerHTML = `<ha-icon icon="${icon}"></ha-icon> ${name}`;
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";

      const upd = (patch) => {
        const rules = [...(this._data.sensor_rules || [])];
        rules[idx] = { ...rules[idx], ...patch };
        this._data.sensor_rules = rules;
        const s = rules[idx].entity_id ? this._hass?.states?.[rules[idx].entity_id] : null;
        const iconNow = s?.attributes?.icon || "mdi:motion-sensor";
        const nameNow = s?.attributes?.friendly_name || rules[idx].entity_id || `Sensor rule #${idx + 1}`;
        summary.innerHTML = `<ha-icon icon="${iconNow}"></ha-icon> ${nameNow}`;
      };

      row.append(
        this._sel({ entity: { filter: { domain: "binary_sensor" } } }, rule.entity_id || "", (v) => upd({ entity_id: v }), "Sensor"),
        this._sel({ select: { multiple: true, mode: "dropdown", options: modeOptions } }, rule.modes || [], (v) => upd({ modes: v || [] }), "Modes used in"),
      );

      const sep = document.createElement("hr");
      sep.className = "sep";
      row.appendChild(sep);

      row.append(
        this._sel({ select: { multiple: true, mode: "dropdown", options: modeOptions } }, rule.bypass_modes || [], (v) => upd({ bypass_modes: v || [] }), "Modes bypassed when bypass is active"),
        this._sel({ boolean: {} }, !rule.allow_open_arm, (v) => upd({ allow_open_arm: !v }), "Prohibit arming when open"),
        this._sel({ boolean: {} }, !!rule.trigger_on_open_only, (v) => upd({ trigger_on_open_only: !!v }), "Trigger only when opening"),
        this._sel({ boolean: {} }, !!rule.trigger_unknown_unavailable, (v) => upd({ trigger_unknown_unavailable: !!v }), "Trigger when becomes unknown OR unavailable"),
      );

      const del = document.createElement("button");
      del.className = "btn danger";
      del.type = "button";
      del.textContent = "Delete sensor rule";
      del.addEventListener("click", () => {
        const rules = [...(this._data.sensor_rules || [])];
        rules.splice(idx, 1);
        this._data.sensor_rules = rules;
        this._renderSensors();
      });

      details.appendChild(row);
      details.appendChild(del);
      item.appendChild(details);
      host.appendChild(item);
    });
  }

  _renderUsers() {
    const host = this.shadowRoot.getElementById("users-list");
    if (!host) return;
    host.innerHTML = "";

    (this._data.users || []).forEach((u, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      const details = document.createElement("details");
      details.open = !u.name;
      const summary = document.createElement("summary");
      const userIcon = u.can_panic ? "mdi:account-alert" : "mdi:account";
      summary.innerHTML = `<ha-icon icon="${userIcon}"></ha-icon> ${u.name || `User #${idx + 1}`}`;
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";
      const upd = (patch) => {
        const users = [...(this._data.users || [])];
        users[idx] = { ...users[idx], ...patch };
        this._data.users = users;
        const iu = users[idx];
        const userIconNow = iu.can_panic ? "mdi:account-alert" : "mdi:account";
        summary.innerHTML = `<ha-icon icon="${userIconNow}"></ha-icon> ${iu.name || `User #${idx + 1}`}`;
      };

      const modeOptions = this._modeOptions();
      row.append(
        this._sel({ text: {} }, u.name || "", (v) => upd({ name: v }), "Name"),
        this._sel({ text: { type: "password" } }, u.code || "", (v) => upd({ code: v }), "Code"),
        this._sel({ boolean: {} }, !!u.can_arm, (v) => upd({ can_arm: !!v }), "Can arm"),
        this._sel({ select: { multiple: true, mode: "dropdown", options: modeOptions } }, u.arm_modes || [], (v) => upd({ arm_modes: v || [] }), "Arm modes"),
        this._sel({ boolean: {} }, !!u.can_disarm, (v) => upd({ can_disarm: !!v }), "Can disarm"),
        this._sel({ select: { multiple: true, mode: "dropdown", options: modeOptions } }, u.disarm_modes || [], (v) => upd({ disarm_modes: v || [] }), "Disarm modes"),
        this._sel({ boolean: {} }, !!u.can_panic, (v) => upd({ can_panic: !!v }), "Is panic code"),
      );

      const del = document.createElement("button");
      del.className = "btn danger";
      del.type = "button";
      del.textContent = "Delete user";
      del.addEventListener("click", () => {
        const users = [...(this._data.users || [])];
        users.splice(idx, 1);
        this._data.users = users;
        this._renderUsers();
        this._renderActions();
      });

      details.appendChild(row);
      details.appendChild(del);
      item.appendChild(details);
      host.appendChild(item);
    });
  }

  _renderActions() {
    const host = this.shadowRoot.getElementById("actions-list");
    if (!host) return;
    host.innerHTML = "";

    const stateOptions = [
      { value: "any", label: "Any" },
      { value: "disarmed", label: "Disarmed" },
      { value: "arming", label: "Arming" },
      { value: "armed_home", label: "Armed Home" },
      { value: "armed_away", label: "Armed Away" },
      { value: "pending", label: "Pending" },
      { value: "triggered", label: "Triggered" },
    ];
    const throughOptions = [{ value: "any", label: "Any" }, ...this._modeOptions()];
    const userOptions = [
      { value: "any", label: "Any user" },
      { value: "none", label: "None / sensor-triggered" },
      ...(this._data.users || []).map((u) => ({
        value: (u.name || "").trim().toLowerCase() || "any",
        label: u.name || "Unnamed",
      })),
    ];

    (this._data.actions || []).forEach((action, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      const details = document.createElement("details");
      details.open = !action.name;
      const summary = document.createElement("summary");
      summary.textContent = action.name || `Action #${idx + 1}`;
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";
      const upd = (patch) => {
        const actions = [...(this._data.actions || [])];
        actions[idx] = { ...actions[idx], ...patch };
        this._data.actions = actions;
        summary.textContent = actions[idx].name || `Action #${idx + 1}`;
      };

      row.append(
        this._sel({ text: {} }, action.name || "", (v) => upd({ name: v }), "Action name"),
        this._sel({ select: { mode: "dropdown", options: stateOptions } }, (action.from || ["any"])[0] || "any", (v) => upd({ from: [v || "any"] }), "From state"),
        this._sel({ select: { mode: "dropdown", options: stateOptions } }, (action.to || ["any"])[0] || "any", (v) => upd({ to: [v || "any"] }), "To state"),
        this._sel({ select: { mode: "dropdown", options: throughOptions } }, (action.through || ["any"])[0] || "any", (v) => upd({ through: [v || "any"] }), "Through mode"),
        this._sel({ select: { mode: "dropdown", options: userOptions } }, action.by_user || "any", (v) => upd({ by_user: v || "any" }), "By user"),
        this._sel({ entity: { multiple: true } }, action.targets || action.scripts || [], (v) => upd({ targets: v || [], scripts: v || [] }), "Targets (any turn_on entity)"),
      );

      const del = document.createElement("button");
      del.className = "btn danger";
      del.type = "button";
      del.textContent = "Delete action";
      del.addEventListener("click", () => {
        const actions = [...(this._data.actions || [])];
        actions.splice(idx, 1);
        this._data.actions = actions;
        this._renderActions();
      });

      details.appendChild(row);
      details.appendChild(del);
      item.appendChild(details);
      host.appendChild(item);
    });
  }

  async _loadConfig() {
    try {
      const data = await this._hass.callApi("get", "ng_alarm/config");
      this._data = {
        name: "NG Alarm",
        require_code_to_arm: true,
        expose_event_log_sensor: false,
        modes: [],
        sensor_rules: [],
        users: [],
        actions: [],
        ...data,
      };

      this._renderModes();
      this._renderSensors();
      this._renderUsers();
      this._renderActions();
      this._renderEventSensorToggle();

      this._status("Configuration loaded.");
    } catch (err) {
      this._status(`Load failed: ${err.message}`);
    }
  }

  _renderEventSensorToggle() {
    const host = this.shadowRoot.getElementById("events-sensor-toggle");
    if (!host) return;
    host.innerHTML = "";
    host.append(
      this._sel(
        { boolean: {} },
        !!this._data.expose_event_log_sensor,
        (v) => {
          this._data.expose_event_log_sensor = !!v;
        },
        "Expose event log as sensor"
      )
    );
  }

  _exportEvents() {
    const content = JSON.stringify(this._events || [], null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ng_alarm_events_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        item.className = "item";
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
      // remove legacy master codes if they still exist in storage
      delete this._data.alarm_code;
      delete this._data.panic_code;
      await this._hass.callApi("post", "ng_alarm/config", this._data);
      this._status("Saved and runtime reloaded.");
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
