class HAPanelNGAlarm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._initialized = false;
    this._hass = null;
    this._data = {};
    this._events = [];
    this._eventZones = [];
    this._selectedEventZone = "all";
    this._openZoneDetails = {};
    this._openGlobalBypassDetails = {};
    this._activeTab = "general";
  }

  _lang() {
    return (this._hass && this._hass.language) ? String(this._hass.language).toLowerCase() : "en";
  }

  _t(en, de) {
    return this._lang().startsWith("de") ? de : en;
  }

  _slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
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
    const mb = this.shadowRoot.getElementById("open-sidebar");
    if (mb) mb.hass = hass;
    this._updateHeaderVersion();
    const ge = this.shadowRoot.getElementById("general-empty");
    if (ge) ge.textContent = this._t("(intentionally empty)", "(bewusst leer)");
    const zh = this.shadowRoot.getElementById("zones-help");
    if (zh) zh.textContent = this._t("Each zone can expose one or more native arm types and has its own delays/bypass settings.", "Jede Zone kann einen oder mehrere native Arming-Typen anbieten und hat eigene Delay-/Bypass-Einstellungen.");
  }

  set narrow(_narrow) {}
  set route(_route) {}
  set panel(_panel) {}

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display:block;
          height:100%;
          box-sizing:border-box;
          background: var(--primary-background-color);
        }
        .wrap { padding: 0 12px 12px; max-width: 980px; margin: 0 auto; color: var(--primary-text-color); }
        .head-native {
          display:flex;
          align-items:center;
          min-height: 56px;
          margin: 0 -12px 10px;
          padding: 0 8px;
          background: var(--app-header-background-color, var(--card-background-color));
          border-bottom: 1px solid var(--divider-color);
        }
        .menu-btn {
          width: 40px;
          height: 40px;
          padding: 0;
          border-radius: 999px;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .head-title {
          margin-left: 8px;
          font-size: 1rem;
          font-weight: 600;
          line-height: 1;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
        }
        .head-spacer { flex: 1; }
        .head-version { font-size: 0.85rem; color: var(--secondary-text-color); }
        .muted { color: var(--secondary-text-color); font-size: 0.9rem; }

        .tabs { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px; margin: 12px 0; }
        .tab {
          border:1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          border-radius: 999px;
          padding: 6px 10px;
          cursor:pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 38px;
          font-size: 0.95rem;
        }
        .tab.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }

        .section { display:none; }
        .section.active { display:block; }

        ha-card { padding: 12px 12px 12px 8px; margin-bottom: 12px; }

        .list { display:grid; gap:10px; }
        .item {
          border:1px solid var(--divider-color);
          border-radius: 12px;
          padding:10px;
          background: var(--secondary-background-color, var(--card-background-color));
        }
        details > summary { cursor:pointer; font-weight:600; }
        .row { display:grid; grid-template-columns: 1fr; gap:8px; margin-top:8px; }

        .btn {
          border:1px solid var(--divider-color);
          border-radius:10px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          padding: 8px 12px;
          cursor:pointer;
        }
        .btn.primary { border:none; background: var(--primary-color); color:white; font-weight:600; border-radius: 999px; }
        .btn-save { min-height: 44px; padding: 10px 18px; font-size: 1rem; white-space: nowrap; min-width: 170px; }
        .btn.danger { border:none; background:#b00020; color:#fff; margin-top: 0; border-radius: 999px; }
        .item .btn.danger { margin-top: 10px; }
        #events .btn.danger { margin-top: 0; }
        #modes-add, #global-bypass-add, #sensors-add, #users-add, #actions-add { margin-top: 10px; }
        #events-list .item { margin-bottom: 10px; line-height: 1.35; }
        hr.sep { border: none; border-top: 1px dashed var(--divider-color); margin: 8px 0; grid-column: 1 / -1; }

        .footer { display:flex; align-items:center; gap:10px; margin-top: 10px; }
        .card-subtitle { padding-left: 0; }
        ha-card { --ha-card-header-padding: 8px 0 6px 0; }
        ha-card::part(header) { padding-left: 0 !important; padding-right: 0 !important; }
        #status.status-ok { color: #1b8f3a; font-weight: 600; }
        #status.status-error { color: #b00020; font-weight: 600; }
        .action-btn-row { display:flex; align-items:center; gap:10px; margin-top: 10px; flex-wrap: wrap; }
        .action-btn-row .btn { min-width: 150px; justify-content: center; border-radius: 999px; }
        .inline-test-result { font-size: 0.9rem; color: var(--secondary-text-color); }
        .inline-test-result.ok { color: #1b8f3a; font-weight: 600; }
        .inline-test-result.err { color: #b00020; font-weight: 600; }

        @media (max-width: 800px) {
          .wrap { max-width: 100%; padding: 0 10px 10px; }
          .tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .btn-save { min-width: 156px; }
        }
      </style>

      <div class="wrap">
        <div class="head-native">
          <button id="open-sidebar" class="menu-btn" type="button" title="Open sidebar" aria-label="Open sidebar">
            <ha-icon icon="mdi:menu"></ha-icon>
          </button>
          <div class="head-title">Alarm</div>
          <div class="head-spacer"></div>
          <div class="head-version" id="header-version">v–</div>
        </div>

        <div class="tabs">
          <button class="tab" data-tab="general"><ha-icon icon="mdi:cog-outline"></ha-icon>General</button>
          <button class="tab" data-tab="modes"><ha-icon icon="mdi:shape-outline"></ha-icon>Zones</button>
          <button class="tab" data-tab="sensors"><ha-icon icon="mdi:motion-sensor"></ha-icon>Sensors</button>
          <button class="tab" data-tab="users"><ha-icon icon="mdi:account-outline"></ha-icon>Users</button>
          <button class="tab" data-tab="actions"><ha-icon icon="mdi:script-text-outline"></ha-icon>Actions</button>
          <button class="tab" data-tab="events"><ha-icon icon="mdi:history"></ha-icon>Events</button>
        </div>

        <div id="general" class="section">
          <ha-card header="General Settings">
            <div class="muted" style="margin-bottom:8px">Choose how users enter their code in the alarm panel.</div>
            <div id="general-settings-list" class="list"></div>
          </ha-card>
        </div>

        <div id="modes" class="section">
          <ha-card header="Zones">
            <div class="muted card-subtitle" id="zones-help">Each zone can expose one or more native arm types and has its own delays/bypass settings.</div>
            <div id="modes-list" class="list" style="margin-top:10px"></div>
            <button id="modes-add" class="btn" type="button">+ Add zone</button>
          </ha-card>
        </div>

        <div id="sensors" class="section">
          <ha-card header="Global Bypass Rules">
            <div class="muted card-subtitle">Global bypass elements can be reused by multiple sensors.</div>
            <div id="global-bypass-list" class="list" style="margin-top:10px"></div>
            <button id="global-bypass-add" class="btn" type="button">+ Add global bypass</button>
          </ha-card>
          <ha-card header="Sensors">
            <div class="muted card-subtitle">Per sensor zones, bypass and trigger flags</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
              <button id="sensors-add-all-motion" class="btn" type="button">+ Add all motion / occupancy</button>
              <button id="sensors-add-all-door" class="btn" type="button">+ Add all door / window</button>
            </div>
            <div id="sensors-list" class="list" style="margin-top:10px"></div>
            <button id="sensors-add" class="btn" type="button">+ Add sensor</button>
          </ha-card>
        </div>

        <div id="users" class="section">
          <ha-card header="Users & Codes">
            <div class="muted" style="margin-bottom:8px">Manage users, permissions and which zones each code may control.</div>
            <div id="users-list" class="list"></div>
            <button id="users-add" class="btn" type="button">+ Add user</button>
          </ha-card>
        </div>

        <div id="actions" class="section">
          <ha-card header="Action Builder">
            <div class="muted" style="margin-bottom:8px">Define what should run when the alarm changes state.</div>
            <div id="actions-list" class="list"></div>
            <button id="actions-add" class="btn" type="button">+ Add action</button>
            <div class="muted card-subtitle" style="margin-top:10px">
              Script/target variables available: <code>from_state</code>, <code>to_state</code>, <code>alarm_mode</code>, <code>zone</code>, <code>arm_type</code>, <code>actor</code>, <code>triggered_sensor</code>, <code>triggered_sensor_name</code>.
            </div>
          </ha-card>
        </div>

        <div id="events" class="section">
          <ha-card header="Event Log">
            <div class="muted" style="margin-bottom:8px">Review alarm history across all zones and export or clear entries.</div>
            <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
              <label class="muted" for="events-zone" style="margin-right:4px">Zone</label>
              <select id="events-zone" class="btn" style="min-width:140px">
                <option value="all">All zones</option>
              </select>
              <button id="events-refresh" class="btn" type="button">Refresh</button>
              <button id="events-export" class="btn" type="button">Export JSON</button>
              <button id="events-clear" class="btn danger" type="button">Clear</button>
            </div>
            <div id="events-sensor-toggle" style="margin-bottom:10px"></div>
            <div id="events-list"></div>
          </ha-card>
        </div>

        <div class="footer">
          <button id="save" class="btn primary btn-save">Save & Reload</button>
          <div class="muted" id="status"></div>
        </div>
      </div>
    `;

  }

  _bindEvents() {
    this.shadowRoot.getElementById("save").addEventListener("click", () => this._saveConfig());
    this.shadowRoot.getElementById("open-sidebar").addEventListener("click", () => {
      this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
    });
    this.shadowRoot.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => this._switchTab(btn.dataset.tab));
    });

    this.shadowRoot.getElementById("modes-add").addEventListener("click", () => {
      const modes = [...(this._data.modes || [])];
      modes.push({ id: "", name: "", icon: "mdi:shield", arm_target: "away", arm_types: ["away"], require_code_to_arm: true, require_code_to_mode_change: true, require_code_to_disarm: true, exit_delay: 60, entry_delay: 30, bypass_mode: "none", bypass_entities: [], bypass_template: "" });
      this._data.modes = modes;
      this._renderModes();
    });

    this.shadowRoot.getElementById("global-bypass-add").addEventListener("click", () => {
      const rules = [...(this._data.global_bypass_rules || [])];
      rules.push({ id: "", name: "", icon: "mdi:swap-horizontal", mode: "entity_state", entities: [], template: "" });
      this._data.global_bypass_rules = rules;
      this._renderGlobalBypass();
      this._renderSensors();
    });

    this.shadowRoot.getElementById("sensors-add").addEventListener("click", () => {
      const rules = [...(this._data.sensor_rules || [])];
      rules.push({ entity_id: "", modes: [], bypass_modes: [], bypass_global_ids: [], allow_open_arm: false, trigger_on_open_only: false, trigger_unknown_unavailable: false });
      this._data.sensor_rules = rules;
      this._renderSensors();
    });

    this.shadowRoot.getElementById("sensors-add-all-motion").addEventListener("click", () => {
      const states = this._hass?.states || {};
      const existing = new Set((this._data.sensor_rules || []).map((r) => r.entity_id));
      const add = [];
      Object.keys(states).forEach((eid) => {
        if (!eid.startsWith("binary_sensor.")) return;
        const s = states[eid];
        const dc = String(s?.attributes?.device_class || "").toLowerCase();
        if (!["motion", "occupancy", "presence"].includes(dc)) return;
        if (existing.has(eid)) return;
        add.push({ entity_id: eid, modes: [], bypass_modes: [], bypass_global_ids: [], allow_open_arm: false, trigger_on_open_only: false, trigger_unknown_unavailable: false });
      });
      this._data.sensor_rules = [...(this._data.sensor_rules || []), ...add];
      this._renderSensors();
    });

    this.shadowRoot.getElementById("sensors-add-all-door").addEventListener("click", () => {
      const states = this._hass?.states || {};
      const existing = new Set((this._data.sensor_rules || []).map((r) => r.entity_id));
      const add = [];
      Object.keys(states).forEach((eid) => {
        if (!eid.startsWith("binary_sensor.")) return;
        const s = states[eid];
        const dc = String(s?.attributes?.device_class || "").toLowerCase();
        if (!["door", "window", "opening", "garage_door"].includes(dc)) return;
        if (existing.has(eid)) return;
        add.push({ entity_id: eid, modes: [], bypass_modes: [], bypass_global_ids: [], allow_open_arm: false, trigger_on_open_only: true, trigger_unknown_unavailable: false });
      });
      this._data.sensor_rules = [...(this._data.sensor_rules || []), ...add];
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
      actions.push({ name: "", icon: "mdi:script-text-outline", from: ["any"], to: ["any"], through: ["any"], through_mode: ["any"], by_user: "any", targets: [] });
      this._data.actions = actions;
      this._renderActions();
    });

    this.shadowRoot.getElementById("events-zone").addEventListener("change", (ev) => {
      this._selectedEventZone = ev.target.value || "all";
      this._loadEvents();
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
    return (this._data.modes || []).map((m) => ({ value: m.id || "", label: m.name || m.id || "zone" }));
  }

  _globalBypassOptions() {
    return (this._data.global_bypass_rules || []).map((r) => ({
      value: r.id || "",
      label: r.name || r.id || "global bypass",
    })).filter((x) => x.value);
  }

  _zoneModeOptions() {
    const opts = [];
    (this._data.modes || []).forEach((z) => {
      const zid = z.id || "";
      const zname = z.name || zid || "zone";
      if (!zid) return;
      opts.push({ value: zid, label: `${zname} (all arm types)` });
      const armTypes = Array.isArray(z.arm_types) && z.arm_types.length ? z.arm_types : [z.arm_target || "away"];
      armTypes.forEach((t) => {
        const tt = String(t || "").toLowerCase();
        if (!tt) return;
        opts.push({ value: `${zid}:${tt}`, label: `${zname} > ${tt}` });
      });
    });
    return opts;
  }

  _renderGeneral() {
    const host = this.shadowRoot.getElementById("general-settings-list");
    if (!host) return;
    host.innerHTML = "";

    const upd = (patch) => {
      this._data = { ...this._data, ...patch };
    };

    host.append(
      this._sel(
        {
          select: {
            mode: "dropdown",
            options: [
              { value: "pin", label: this._t("PIN keypad", "PIN-Tastatur") },
              { value: "password", label: this._t("Password input", "Passwort-Eingabe") },
            ],
          },
        },
        this._data.code_input_mode || "pin",
        (v) => upd({ code_input_mode: v || "pin" }),
        this._t("Code input mode", "Code-Eingabemodus")
      ),
    );
  }

  _renderModes() {
    const host = this.shadowRoot.getElementById("modes-list");
    if (!host) return;
    host.innerHTML = "";

    (this._data.modes || []).forEach((mode, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      const details = document.createElement("details");
      const zoneKey = (mode.id || `zone_${idx}`).toString();
      details.open = Object.prototype.hasOwnProperty.call(this._openZoneDetails, zoneKey)
        ? !!this._openZoneDetails[zoneKey]
        : !mode.name;
      details.addEventListener("toggle", () => {
        this._openZoneDetails[zoneKey] = details.open;
      });
      const summary = document.createElement("summary");
      summary.innerHTML = `<ha-icon icon="${mode.icon || "mdi:shield"}"></ha-icon> ${mode.name || mode.id || `Zone #${idx + 1}`}`;
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";

      const upd = (patch) => {
        const modes = [...(this._data.modes || [])];
        const next = { ...modes[idx], ...patch };
        if ((!next.id || patch.name !== undefined) && next.name) next.id = this._slugify(next.name);
        modes[idx] = next;
        this._data.modes = modes;
        summary.innerHTML = `<ha-icon icon="${next.icon || "mdi:shield"}"></ha-icon> ${next.name || next.id || `Zone #${idx + 1}`}`;
      };

      const selectedArmTypes = Array.isArray(mode.arm_types) && mode.arm_types.length
        ? mode.arm_types
        : [mode.arm_target || "away"];

      // Base section (ID/Name/Icon)
      row.append(
        this._sel({ text: {} }, mode.name || "", (v) => upd({ name: v }), "Zone name"),
        this._sel({ icon: {} }, mode.icon || "mdi:shield", (v) => upd({ icon: v }), "Zone icon"),
        this._sel({ boolean: {} }, mode.require_code_to_arm !== false, (v) => upd({ require_code_to_arm: !!v }), "Code required for arming"),
        this._sel({ boolean: {} }, mode.require_code_to_mode_change !== false, (v) => upd({ require_code_to_mode_change: !!v }), "Code required for mode change"),
        this._sel({ boolean: {} }, mode.require_code_to_disarm !== false, (v) => upd({ require_code_to_disarm: !!v }), "Code required for disarming"),
      );

      const sepBase = document.createElement("hr");
      sepBase.className = "sep";
      row.appendChild(sepBase);

      // Arm-type toggles (always above expandables)
      const typeLabel = { away: "Away", home: "Home", night: "Night", vacation: "Vacation" };
      const delays = { ...(mode.delays || {}) };
      ["away", "home", "night", "vacation"].forEach((t) => {
        const enabled = selectedArmTypes.includes(t);
        row.append(
          this._sel({ boolean: {} }, enabled, (v) => {
            const set = new Set(selectedArmTypes);
            if (v) set.add(t); else set.delete(t);
            const next = Array.from(set);
            upd({ arm_types: next, arm_target: next[0] || "away" });
            this._openZoneDetails[zoneKey] = true;
            this._renderModes();
          }, `Enable ${typeLabel[t]} arm type`)
        );
      });

      const sepTypes = document.createElement("hr");
      sepTypes.className = "sep";
      row.appendChild(sepTypes);

      // Expandables per enabled arm type
      ["away", "home", "night", "vacation"].forEach((t) => {
        if (!selectedArmTypes.includes(t)) return;
        const cur = delays[t] || {};
        const setCur = (patch) => {
          delays[t] = { ...cur, ...patch };
          upd({ delays: delays });
        };

        const d = document.createElement("details");
        d.className = "item";
        d.open = false;
        const s = document.createElement("summary");
        s.textContent = `${typeLabel[t]} configuration`;
        d.appendChild(s);

        const sub = document.createElement("div");
        sub.className = "row";
        sub.append(
          this._sel({ number: { min: 0, max: 600, step: 1, mode: "box", unit_of_measurement: "s" } }, cur.exit_delay ?? mode.exit_delay ?? 60, (v) => setCur({ exit_delay: Number(v || 0) }), `${typeLabel[t]} exit delay`),
          this._sel({ number: { min: 0, max: 600, step: 1, mode: "box", unit_of_measurement: "s" } }, cur.entry_delay ?? mode.entry_delay ?? 30, (v) => setCur({ entry_delay: Number(v || 0) }), `${typeLabel[t]} pending delay`),
          this._sel({ number: { min: 0, max: 3600, step: 1, mode: "box", unit_of_measurement: "s" } }, cur.alarm_duration ?? mode.alarm_duration ?? 0, (v) => setCur({ alarm_duration: Number(v || 0) }), `${typeLabel[t]} alarm duration (0 = infinite)`),
          this._sel({ select: { mode: "dropdown", options: [{ value: "none", label: "No timeout action" }, { value: "disarm", label: "Disarm after duration" }, { value: "rearm", label: "Re-arm after duration" }] } }, cur.timeout_action || mode.timeout_action || "none", (v) => setCur({ timeout_action: v || "none" }), `${typeLabel[t]} after duration`),
        );
        d.appendChild(sub);
        row.appendChild(d);
      });

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

  _renderGlobalBypass() {
    const host = this.shadowRoot.getElementById("global-bypass-list");
    if (!host) return;
    host.innerHTML = "";

    (this._data.global_bypass_rules || []).forEach((rule, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      const details = document.createElement("details");
      const key = (rule.id || `global_${idx}`).toString();
      details.open = Object.prototype.hasOwnProperty.call(this._openGlobalBypassDetails, key)
        ? !!this._openGlobalBypassDetails[key]
        : !rule.name;
      details.addEventListener("toggle", () => {
        this._openGlobalBypassDetails[key] = details.open;
      });
      const summary = document.createElement("summary");
      summary.innerHTML = `<ha-icon icon="${rule.icon || "mdi:swap-horizontal"}"></ha-icon> ${rule.name || rule.id || `Global bypass #${idx + 1}`}`;
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";
      const upd = (patch) => {
        const arr = [...(this._data.global_bypass_rules || [])];
        const next = { ...arr[idx], ...patch };
        if ((!next.id || patch.name !== undefined) && next.name) next.id = this._slugify(next.name);
        arr[idx] = next;
        this._data.global_bypass_rules = arr;
        summary.innerHTML = `<ha-icon icon="${next.icon || "mdi:swap-horizontal"}"></ha-icon> ${next.name || next.id || `Global bypass #${idx + 1}`}`;
      };

      row.append(
        this._sel({ text: {} }, rule.name || "", (v) => upd({ name: v }), "Name"),
        this._sel({ icon: {} }, rule.icon || "mdi:swap-horizontal", (v) => upd({ icon: v }), "Icon"),
      );

      const sep = document.createElement("hr");
      sep.className = "sep";
      row.appendChild(sep);

      row.append(
        this._sel(
          { select: { mode: "dropdown", options: [{ value: "entity_state", label: "Entities" }, { value: "template", label: "Template" }] } },
          rule.mode || "entity_state",
          (v) => { upd({ mode: v }); this._renderGlobalBypass(); },
          "Rule type"
        ),
      );

      const rmode = rule.mode || "entity_state";
      if (rmode === "entity_state") {
        const hint = document.createElement("div");
        hint.className = "muted";
        hint.textContent = "Active when any selected entity is truthy (on/open/home/active).";
        row.append(hint);
        row.append(this._sel({ entity: { multiple: true } }, rule.entities || [], (v) => upd({ entities: v || [] }), "Entities"));
      } else {
        const hint = document.createElement("div");
        hint.className = "muted";
        hint.textContent = "Template should evaluate to true/false.";
        row.append(hint);
        row.append(this._sel({ template: {} }, rule.template || "", (v) => upd({ template: v }), "Template"));
      }

      const test = document.createElement("button");
      test.className = "btn";
      test.type = "button";
      test.textContent = "Test condition";
      const testResult = document.createElement("span");
      testResult.className = "inline-test-result";
      test.addEventListener("click", async () => {
        const current = (this._data.global_bypass_rules || [])[idx] || {};
        const result = await this._testGlobalBypassRule(current);
        testResult.classList.remove("ok", "err");
        testResult.classList.add(result ? "ok" : "err");
        testResult.textContent = result ? "ACTIVE" : "inactive";
      });

      const del = document.createElement("button");
      del.className = "btn danger";
      del.type = "button";
      del.textContent = "Delete global bypass";
      del.addEventListener("click", () => {
        const arr = [...(this._data.global_bypass_rules || [])];
        arr.splice(idx, 1);
        this._data.global_bypass_rules = arr;
        this._renderGlobalBypass();
        this._renderSensors();
      });

      const btnRow = document.createElement("div");
      btnRow.className = "action-btn-row";
      btnRow.append(test, del, testResult);

      details.appendChild(row);
      details.appendChild(btnRow);
      item.appendChild(details);
      host.appendChild(item);
    });
  }

  async _testGlobalBypassRule(rule) {
    const mode = String(rule?.mode || "entity_state").toLowerCase();
    try {
      if (mode === "template") {
        const tpl = String(rule?.template || "").trim();
        if (!tpl) return false;
        const rendered = await this._hass.callApi("post", "template", { template: tpl });
        const out = String(rendered || "").trim().toLowerCase();
        return ["1", "true", "on", "yes", "open", "home", "active"].includes(out);
      }

      const entities = Array.isArray(rule?.entities) ? rule.entities : [];
      if (!entities.length) return false;
      const truthy = new Set(["on", "true", "open", "home", "active", "1", "unlocked"]);
      for (const eid of entities) {
        const st = String(this._hass?.states?.[eid]?.state || "").toLowerCase();
        if (truthy.has(st)) return true;
      }
      return false;
    } catch (err) {
      this._status(`Bypass test failed: ${err.message}`, "error");
      return false;
    }
  }

  _renderSensors() {
    const host = this.shadowRoot.getElementById("sensors-list");
    if (!host) return;
    host.innerHTML = "";
    const modeOptions = this._zoneModeOptions();
    const globalBypassOptions = this._globalBypassOptions();

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
      );

      const sep = document.createElement("hr");
      sep.className = "sep";
      row.appendChild(sep);

      row.append(
        this._sel({ select: { multiple: true, mode: "dropdown", options: modeOptions } }, rule.modes || [], (v) => upd({ modes: v || [] }), "Modes used in"),
        this._sel({ select: { multiple: true, mode: "dropdown", options: modeOptions } }, rule.bypass_modes || [], (v) => upd({ bypass_modes: v || [] }), "Modes bypassed when zone bypass is active"),
        this._sel({ select: { multiple: true, mode: "dropdown", options: globalBypassOptions } }, rule.bypass_global_ids || [], (v) => upd({ bypass_global_ids: v || [] }), "Global bypass elements"),
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

      const modeOptions = this._zoneModeOptions();
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
    const throughZoneOptions = [{ value: "any", label: "Any" }, ...this._modeOptions()];
    const throughModeOptions = [
      { value: "any", label: "Any" },
      { value: "away", label: "Away" },
      { value: "home", label: "Home" },
      { value: "night", label: "Night" },
      { value: "vacation", label: "Vacation" },
    ];
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
      summary.innerHTML = `<ha-icon icon="${action.icon || "mdi:script-text-outline"}"></ha-icon> ${action.name || `Action #${idx + 1}`}`;
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";
      const upd = (patch) => {
        const actions = [...(this._data.actions || [])];
        actions[idx] = { ...actions[idx], ...patch };
        this._data.actions = actions;
        const a = actions[idx];
        summary.innerHTML = `<ha-icon icon="${a.icon || "mdi:script-text-outline"}"></ha-icon> ${a.name || `Action #${idx + 1}`}`;
      };

      row.append(
        this._sel({ text: {} }, action.name || "", (v) => upd({ name: v }), "Action name"),
        this._sel({ icon: {} }, action.icon || "mdi:script-text-outline", (v) => upd({ icon: v }), "Icon"),
        this._sel({ select: { mode: "dropdown", options: stateOptions } }, (action.from || ["any"])[0] || "any", (v) => upd({ from: [v || "any"] }), "From state"),
        this._sel({ select: { mode: "dropdown", options: stateOptions } }, (action.to || ["any"])[0] || "any", (v) => upd({ to: [v || "any"] }), "To state"),
        this._sel({ select: { mode: "dropdown", options: throughZoneOptions } }, (action.through || ["any"])[0] || "any", (v) => upd({ through: [v || "any"] }), "Through zone"),
        this._sel({ select: { mode: "dropdown", options: throughModeOptions } }, (action.through_mode || ["any"])[0] || "any", (v) => upd({ through_mode: [v || "any"] }), "Through mode"),
        this._sel({ select: { mode: "dropdown", options: userOptions } }, action.by_user || "any", (v) => upd({ by_user: v || "any" }), "By"),
      );
      const sep = document.createElement("hr");
      sep.className = "sep";
      row.appendChild(sep);
      row.append(
        this._sel({ entity: { multiple: true } }, action.targets || action.scripts || [], (v) => upd({ targets: v || [], scripts: v || [] }), "Triggered targets (any turn_on entity)"),
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
        require_code_to_mode_change: true,
        require_code_to_disarm: true,
        code_input_mode: "pin",
        expose_event_log_sensor: false,
        modes: [],
        global_bypass_rules: [],
        sensor_rules: [],
        users: [],
        actions: [],
        ...data,
      };

      this._renderGeneral();
      this._renderModes();
      this._renderGlobalBypass();
      this._renderSensors();
      this._renderUsers();
      this._renderActions();
      this._renderEventSensorToggle();
      this._updateHeaderVersion();

      this._status("Configuration loaded.");
    } catch (err) {
      this._status(`Load failed: ${err.message}`, "error");
    }
  }

  _updateHeaderVersion() {
    const el = this.shadowRoot.getElementById("header-version");
    if (!el) return;
    const u = this._hass?.states?.["update.ng_alarm_update"];
    const v = u?.attributes?.installed_version || u?.attributes?.latest_version || this._data?.version || "-";
    el.textContent = String(v).startsWith("v") ? String(v) : `v${v}`;
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

  _renderEventZoneOptions() {
    const sel = this.shadowRoot.getElementById("events-zone");
    if (!sel) return;
    const cur = this._selectedEventZone || "all";
    sel.innerHTML = `<option value="all">All zones</option>`;
    (this._eventZones || []).forEach((z) => {
      const o = document.createElement("option");
      o.value = z;
      o.textContent = z;
      sel.appendChild(o);
    });
    sel.value = cur;
  }

  async _loadEvents() {
    try {
      const zone = encodeURIComponent(this._selectedEventZone || "all");
      const payload = await this._hass.callApi("get", `ng_alarm/events?zone=${zone}`);
      this._events = payload.events || [];
      this._eventZones = payload.zones || [];
      this._renderEventZoneOptions();
      const host = this.shadowRoot.getElementById("events-list");
      host.innerHTML = "";
      if (!this._events.length) {
        host.innerHTML = `<div class="muted">No events yet.</div>`;
        return;
      }
      const fmt = new Intl.DateTimeFormat(this._lang().startsWith("de") ? "de-DE" : "en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      [...this._events].reverse().forEach((ev) => {
        const item = document.createElement("div");
        item.className = "item";
        const ts = fmt.format(new Date((ev.ts || 0) * 1000));
        item.innerHTML = `<strong>[${ev.zone || "main"}] ${ev.event || "event"}</strong> • ${ts}<br/>${ev.message || ""}<br/><span class="muted">from=${ev.from_state || ""} to=${ev.to_state || ""} by=${ev.by || ev.actor || ""}</span>`;
        host.appendChild(item);
      });
    } catch (err) {
      this._status(`Events load failed: ${err.message}`, "error");
    }
  }

  async _clearEvents() {
    try {
      await this._hass.callApi("post", "ng_alarm/events/clear", { zone: this._selectedEventZone || "all" });
      this._events = [];
      await this._loadEvents();
      this._status("Event log cleared.", "ok");
    } catch (err) {
      this._status(`Event clear failed: ${err.message}`, "error");
    }
  }

  async _saveConfig() {
    try {
      const payload = JSON.parse(JSON.stringify(this._data));
      // remove ui-only fields
      if (Array.isArray(payload.users)) {
        payload.users = payload.users.map((u) => {
          const copy = { ...u };
          delete copy.code_confirm;
          return copy;
        });
      }
      // remove legacy master codes if they still exist in storage
      delete payload.alarm_code;
      delete payload.panic_code;

      await this._hass.callApi("post", "ng_alarm/config", payload);
      this._status("Saved and runtime reloaded.", "ok");
    } catch (err) {
      this._status(`Save failed: ${err.message}`, "error");
    }
  }

  _status(text, level = "") {
    const s = this.shadowRoot.getElementById("status");
    if (!s) return;
    s.textContent = text;
    s.classList.remove("status-ok", "status-error");
    if (level === "ok") s.classList.add("status-ok");
    if (level === "error") s.classList.add("status-error");
  }
}

if (!customElements.get("ha-panel-ng-alarm")) {
  customElements.define("ha-panel-ng-alarm", HAPanelNGAlarm);
}
if (!customElements.get("ng-alarm-panel")) {
  customElements.define("ng-alarm-panel", HAPanelNGAlarm);
}
