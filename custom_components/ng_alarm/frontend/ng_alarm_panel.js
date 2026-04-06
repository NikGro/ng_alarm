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
    this._openSensorDetails = {};
    this._sensorConfigClipboard = null;
    this._sensorDropIndicator = null;
    this._dragIndicators = {};
    this._haUsers = [];
    this._autosaveTimer = null;
    this._autosaveInFlight = false;
    this._configLoaded = false;
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
        .wrap { padding: 0 12px 12px; max-width: none; margin: 0; color: var(--primary-text-color); }
        .content { max-width: 980px; margin: 0 auto; }
        .head-native {
          display:flex;
          align-items:center;
          min-height: 56px;
          margin: 0 -12px 10px;
          padding: 0 12px;
          width: auto;
          max-width: none;
          overflow: hidden;
          box-sizing: border-box;
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
          display: none;
          align-items: center;
          justify-content: center;
        }
        .head-title {
          margin-left: 0;
          font-size: 1rem;
          font-weight: 600;
          line-height: 1;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
        }
        .head-spacer { flex: 1; }
        .head-version { font-size: 0.85rem; color: var(--secondary-text-color); padding-right: 2px; }
        .muted { color: var(--secondary-text-color); font-size: 0.9rem; }

        .tabs { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin: 12px 0; }
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
          flex: 0 0 auto;
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
        .item.drag-over-before { margin-top: 14px; }
        .item.drag-over-after { margin-bottom: 14px; }
        details > summary { cursor:pointer; font-weight:600; }
        details > summary::-webkit-details-marker { margin-right: 6px; }
        .row { display:grid; grid-template-columns: 1fr; gap:8px; margin-top:8px; }

        .btn {
          border:1px solid var(--divider-color);
          border-radius:10px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          padding: 8px 12px;
          cursor:pointer;
          transition: filter 120ms ease, transform 80ms ease, box-shadow 120ms ease;
        }
        .btn.primary { border:none; background: var(--primary-color); color:white; font-weight:600; border-radius: 999px; }
        .btn.pill-gray { border:none; background: #474c52; color: #fff; border-radius: 999px; }
        .btn-save { min-height: 44px; padding: 10px 18px; font-size: 1rem; white-space: nowrap; min-width: 170px; }
        .btn.danger { border:none; background:#b00020; color:#fff; margin-top: 0; border-radius: 999px; }
        .btn.danger-soft { border:none; background:#b00020; color:#fff; border-radius: 10px; }
        .btn:hover { filter: brightness(0.96); }
        .btn:active { transform: scale(0.98); filter: brightness(0.9); }
        .item .btn.danger { margin-top: 10px; }
        .item .btn.danger, .item .btn.danger-soft { margin-top: 18px; }
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
        .action-btn-row { display:flex; align-items:center; justify-content:flex-end; gap:10px; margin-top: 10px; flex-wrap: wrap; }
        .action-btn-row .btn { min-width: 170px; min-height: 40px; justify-content: center; border-radius: 999px; }
        .global-btn-row { margin-top: 12px; }
        .global-btn-top { display:flex; justify-content:center; gap:8px; align-items:center; flex-wrap: wrap; }
        .global-btn-top .btn { min-width: 132px; min-height: 38px; border-radius: 999px; }
        .global-btn-delete { margin-top: 10px; display:flex; justify-content:flex-start; }
        .inline-test-result { font-size: 0.9rem; color: var(--secondary-text-color); }
        .inline-test-result.ok { color: #1b8f3a; font-weight: 600; }
        .inline-test-result.err { color: #b00020; font-weight: 600; }
        .hint-inline { font-size: 0.82rem; color: var(--secondary-text-color); margin-top: -4px; }
        .sensor-picker { margin-top: 4px; }
        .sensor-picker + .hint-inline { margin-bottom: 6px; }
        .sensor-btn-row { margin-top: 12px; }
        .sensor-btn-top { display:flex; justify-content:center; gap:10px; }
        .sensor-btn-top .btn { min-width: 170px; min-height: 40px; border-radius: 999px; }
        .sensor-btn-delete { margin-top: 12px; display:flex; justify-content:flex-start; }
        .system-notice-wrap { margin-top: 12px; margin-bottom: 10px; }
        .summary-with-handle {
          display:inline-flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          width: calc(100% - 18px);
          vertical-align: middle;
        }
        .summary-main {
          display:inline-flex;
          align-items:center;
          gap: 8px;
          min-width: 0;
        }
        .summary-main-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .summary-handle {
          color: var(--secondary-text-color);
          opacity: 0.85;
          display: inline-flex;
          align-items: center;
        }

        @media (max-width: 800px) {
          .wrap { max-width: 100%; padding: 0 10px 10px; }
          .content { max-width: 100%; }
          .head-native { margin: 0 -10px 10px; }
          .menu-btn { display: inline-flex; }
          .head-title { margin-left: 8px; }
          .tabs { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; justify-content: stretch; }
          .tab { flex: 1 1 auto; }
          .btn-save { min-width: 156px; }
        }
      </style>

      <div class="wrap">
        <div class="head-native">
          <button id="open-sidebar" class="menu-btn" type="button" title="Open sidebar" aria-label="Open sidebar">
            <ha-icon icon="mdi:menu"></ha-icon>
          </button>
          <div class="head-title">${this._t("Alarm", "Alarm")}</div>
          <div class="head-spacer"></div>
          <div class="head-version" id="header-version">v–</div>
        </div>

        <div class="content">

        <div class="tabs">
          <button class="tab" data-tab="general"><ha-icon icon="mdi:cog-outline"></ha-icon>${this._t("General", "Allgemein")}</button>
          <button class="tab" data-tab="modes"><ha-icon icon="mdi:shape-outline"></ha-icon>${this._t("Zones", "Zonen")}</button>
          <button class="tab" data-tab="sensors"><ha-icon icon="mdi:motion-sensor"></ha-icon>${this._t("Sensors", "Sensoren")}</button>
          <button class="tab" data-tab="users"><ha-icon icon="mdi:account-outline"></ha-icon>${this._t("Users", "Benutzer")}</button>
          <button class="tab" data-tab="actions"><ha-icon icon="mdi:script-text-outline"></ha-icon>${this._t("Actions", "Aktionen")}</button>
          <button class="tab" data-tab="events"><ha-icon icon="mdi:history"></ha-icon>${this._t("Events", "Ereignisse")}</button>
        </div>

        <div id="general" class="section">
          <ha-card header="${this._t("General Settings", "Allgemeine Einstellungen")}">
            <div class="muted" style="margin-bottom:8px">${this._t("Choose how users enter their code in the alarm panel.", "Wählen Sie, wie Benutzer ihren Code im Alarm-Panel eingeben.")}</div>
            <div id="general-settings-list" class="list"></div>
          </ha-card>
        </div>

        <div id="modes" class="section">
          <ha-card header="${this._t("Zones", "Zonen")}">
            <div class="muted card-subtitle" id="zones-help">Each zone can expose one or more native arm types and has its own delays/bypass settings.</div>
            <div id="modes-list" class="list" style="margin-top:10px"></div>
            <button id="modes-add" class="btn" type="button">${this._t("+ Add zone", "+ Zone hinzufügen")}</button>
          </ha-card>
        </div>

        <div id="sensors" class="section">
          <ha-card header="${this._t("Global Bypass Rules", "Globale Bypass-Regeln")}">
            <div class="muted card-subtitle">${this._t("Global bypass elements can be reused by multiple sensors.", "Globale Bypass-Elemente können von mehreren Sensoren verwendet werden.")}</div>
            <div id="global-bypass-list" class="list" style="margin-top:10px"></div>
            <button id="global-bypass-add" class="btn" type="button">${this._t("+ Add global bypass", "+ Globalen Bypass hinzufügen")}</button>
          </ha-card>
          <ha-card header="${this._t("Sensors", "Sensoren")}">
            <div class="muted card-subtitle">${this._t("Per sensor zones, bypass and trigger flags", "Pro Sensor: Zonen, Bypass und Trigger-Flags")}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
              <button id="sensors-add-all-motion" class="btn" type="button">${this._t("+ Add all motion / occupancy", "+ Alle Bewegungs-/Präsenzsensoren hinzufügen")}</button>
              <button id="sensors-add-all-door" class="btn" type="button">${this._t("+ Add all door / window", "+ Alle Tür-/Fenstersensoren hinzufügen")}</button>
            </div>
            <div id="sensors-list" class="list" style="margin-top:10px"></div>
            <button id="sensors-add" class="btn" type="button">${this._t("+ Add sensor", "+ Sensor hinzufügen")}</button>
          </ha-card>
        </div>

        <div id="users" class="section">
          <ha-card header="${this._t("Users & Codes", "Benutzer & Codes")}">
            <div class="muted" style="margin-bottom:8px">${this._t("Manage users, permissions and which zones each code may control.", "Verwalten Sie Benutzer, Berechtigungen und welche Zonen jeder Code steuern darf.")}</div>
            <div id="users-list" class="list"></div>
            <button id="users-add" class="btn" type="button">${this._t("+ Add user", "+ Benutzer hinzufügen")}</button>
          </ha-card>
        </div>

        <div id="actions" class="section">
          <ha-card header="${this._t("Action Builder", "Aktions-Builder")}">
            <div class="muted" style="margin-bottom:8px">${this._t("Define what should run when the alarm changes state.", "Definieren Sie, was beim Zustandswechsel des Alarms ausgeführt wird.")}</div>
            <div id="actions-list" class="list"></div>
            <button id="actions-add" class="btn" type="button">${this._t("+ Add action", "+ Aktion hinzufügen")}</button>
            <div class="muted card-subtitle" style="margin-top:10px">
              ${this._t("Variables available", "Verfügbare Variablen")}: <code>zone</code>, <code>from_state</code>, <code>to_state</code>, <code>arm_type</code>, <code>cause_user</code>, <code>cause_sensor</code>, <code>cause_sensor_name</code>, <code>pending_seconds</code>.
            </div>
          </ha-card>
        </div>

        <div id="events" class="section">
          <ha-card header="${this._t("Event Log", "Ereignisprotokoll")}">
            <div class="muted" style="margin-bottom:8px">${this._t("Review alarm history across all zones and export or clear entries.", "Prüfen Sie den Alarmverlauf über alle Zonen und exportieren oder löschen Sie Einträge.")}</div>
            <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
              <select id="events-zone" class="btn" style="min-width:140px">
                <option value="all">All zones</option>
              </select>
              <button id="events-refresh" class="btn" type="button">${this._t("Refresh", "Aktualisieren")}</button>
              <button id="events-export" class="btn" type="button">${this._t("Export JSON", "JSON exportieren")}</button>
              <button id="events-clear" class="btn danger-soft" type="button">${this._t("Clear", "Leeren")}</button>
            </div>
            <div id="events-sensor-toggle" style="margin-bottom:10px"></div>
            <div id="events-list"></div>
          </ha-card>
        </div>

        <div class="footer">
          <button id="save" class="btn primary btn-save">${this._t("Save & Reload", "Speichern & Neu laden")}</button>
          <div class="muted" id="status"></div>
        </div>
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
      this._scheduleAutosave();
    });

    this.shadowRoot.getElementById("global-bypass-add").addEventListener("click", () => {
      const rules = [...(this._data.global_bypass_rules || [])];
      rules.push({ id: "", name: "", icon: "mdi:swap-horizontal", mode: "entity_state", entities: [], template: "" });
      this._data.global_bypass_rules = rules;
      this._renderGlobalBypass();
      this._renderSensors();
      this._scheduleAutosave();
    });

    this.shadowRoot.getElementById("sensors-add").addEventListener("click", () => {
      const rules = [...(this._data.sensor_rules || [])];
      rules.push({ entity_id: "", modes: [], bypass_modes: [], bypass_global_ids: [], allow_open_arm: false, trigger_on_open_only: false, trigger_unknown_unavailable: false });
      this._data.sensor_rules = rules;
      this._renderSensors();
      this._scheduleAutosave();
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
      this._scheduleAutosave();
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
      this._scheduleAutosave();
    });

    this.shadowRoot.getElementById("users-add").addEventListener("click", () => {
      const users = [...(this._data.users || [])];
      users.push({ name: "", code: "", can_arm_override: false, ha_user_ids: [], arm_modes: [], disarm_modes: [] });
      this._data.users = users;
      this._renderUsers();
      this._scheduleAutosave();
    });

    this.shadowRoot.getElementById("actions-add").addEventListener("click", () => {
      const actions = [...(this._data.actions || [])];
      actions.push({ name: "", icon: "mdi:script-text-outline", from: ["any"], to: ["any"], through: ["any"], through_mode: ["any"], by_user: "any_actor", targets: [] });
      this._data.actions = actions;
      this._renderActions();
      this._scheduleAutosave();
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
      this._scheduleAutosave();
    });
    wrap.appendChild(sel);
    return wrap;
  }

  _scheduleAutosave() {
    if (!this._configLoaded) return;
    if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
    this._autosaveTimer = setTimeout(() => {
      this._saveConfig(true);
    }, 1200);
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
    const modeLabel = {
      away: this._t("Away", "Abwesend"),
      home: this._t("Home", "Zuhause"),
      night: this._t("Night", "Nacht"),
      vacation: this._t("Vacation", "Urlaub"),
    };
    (this._data.modes || []).forEach((z) => {
      const zid = z.id || "";
      const zname = z.name || zid || "zone";
      if (!zid) return;
      opts.push({ value: zid, label: `${zname} (${this._t("All", "Alle")})` });
      const armTypes = Array.isArray(z.arm_types) && z.arm_types.length ? z.arm_types : [z.arm_target || "away"];
      armTypes.forEach((t) => {
        const tt = String(t || "").toLowerCase();
        if (!tt) return;
        opts.push({ value: `${zid}:${tt}`, label: `${zname} (${modeLabel[tt] || tt})` });
      });
    });
    return opts;
  }

  _zoneDisplayLabel(raw) {
    const value = String(raw || "").trim();
    if (!value || value === "main") return this._t("Main", "Haupt");
    const [zoneId, armType] = value.split(":", 2);
    const zone = (this._data?.modes || []).find((z) => String(z?.id || "") === zoneId);
    const zoneName = zone?.name || zoneId;
    if (!armType) return zoneName;
    const map = {
      away: this._t("Away", "Abwesend"),
      home: this._t("Home", "Zuhause"),
      night: this._t("Night", "Nacht"),
      vacation: this._t("Vacation", "Urlaub"),
    };
    return `${zoneName} (${map[String(armType).toLowerCase()] || armType})`;
  }

  _actionStateOptionsForZones(zoneIds) {
    const selected = Array.isArray(zoneIds) && zoneIds.length ? zoneIds : ["any"];
    const anyZone = selected.includes("any");
    const modeMap = {
      away: { value: "armed_away", en: "Armed Away", de: "Scharf Abwesend" },
      home: { value: "armed_home", en: "Armed Home", de: "Scharf Zuhause" },
      night: { value: "armed_night", en: "Armed Night", de: "Scharf Nacht" },
      vacation: { value: "armed_vacation", en: "Armed Vacation", de: "Scharf Urlaub" },
    };

    let armTypes = new Set();
    let reduced = false;
    if (anyZone) {
      (this._data.modes || []).forEach((z) => {
        const types = Array.isArray(z.arm_types) && z.arm_types.length ? z.arm_types : [z.arm_target || "away"];
        types.forEach((t) => armTypes.add(String(t || "").toLowerCase()));
      });
      if (!armTypes.size) armTypes = new Set(["away", "home"]);
    } else {
      const zoneSets = selected.map((id) => {
        const z = (this._data.modes || []).find((m) => String(m.id || "") === String(id));
        const types = z ? (Array.isArray(z.arm_types) && z.arm_types.length ? z.arm_types : [z.arm_target || "away"]) : ["away"];
        return new Set(types.map((t) => String(t || "").toLowerCase()));
      });
      if (zoneSets.length) {
        armTypes = new Set(zoneSets[0]);
        zoneSets.slice(1).forEach((s) => {
          armTypes = new Set([...armTypes].filter((x) => s.has(x)));
        });
        const union = new Set();
        zoneSets.forEach((s) => [...s].forEach((x) => union.add(x)));
        reduced = armTypes.size < union.size;
      }
      if (!armTypes.size) armTypes = new Set(["away"]);
    }

    const opts = [
      { value: "any", label: this._t("Any — all transitions", "Beliebig — alle Übergänge") },
      { value: "disarmed", label: this._t("Disarmed — alarm off", "Unscharf — Alarm aus") },
      { value: "arming", label: this._t("Arming — exit delay running", "Scharfschalten — Exit-Delay läuft") },
      { value: "pending", label: this._t("Pending — entry delay running", "Auslöseverzögerung — Entry-Delay läuft") },
      { value: "triggered", label: this._t("Triggered — alarm active", "Ausgelöst — Alarm aktiv") },
      { value: "arm_blocked", label: this._t("Arm blocked — open sensors", "Scharfschalten blockiert — offene Sensoren") },
    ];

    opts.splice(1, 0, { value: "any_armed", label: this._t("Any armed state — all armed_*", "Beliebiger Scharf-Zustand — alle armed_*") });

    const anyZoneText = this._t("in any zone", "in beliebiger Zone");
    Array.from(armTypes).forEach((t) => {
      const meta = modeMap[t];
      if (!meta) return;
      const label = anyZone
        ? `${this._t(meta.en, meta.de)} (${anyZoneText})`
        : this._t(meta.en, meta.de);
      opts.splice(3, 0, { value: meta.value, label });
    });

    return { options: opts, reduced };
  }

  _actionToOptions(fromState, options) {
    const from = String(fromState || "any");
    if (!from || from === "any") return options;
    return options.filter((o) => o.value === "any" || o.value !== from);
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
      this._sel(
        { boolean: {} },
        this._data.require_second_arm_for_override !== false,
        (v) => {
          upd({ require_second_arm_for_override: !!v });
          this._renderGeneral();
        },
        this._t("Second arming required for force-arm", "Zweites Scharfschalten für Force-Arm erforderlich")
      ),
    );

    const helper = document.createElement("div");
    helper.className = "muted";
    helper.style.marginTop = "2px";
    helper.textContent = this._t(
      "When enabled, users with force permission must arm twice within the configured time window.",
      "Wenn aktiv, müssen Benutzer mit Force-Recht innerhalb des Zeitfensters zweimal scharf schalten."
    );
    host.append(helper);

    if (this._data.require_second_arm_for_override !== false) {
      host.append(
      this._sel(
        { number: { min: 5, max: 120, step: 1, mode: "box", unit_of_measurement: "s" } },
        Number(this._data.arm_override_confirm_window ?? 20),
        (v) => upd({ arm_override_confirm_window: Math.max(5, Number(v || 20)) }),
        this._t("Force-arm confirm window", "Force-Arm Bestätigungsfenster")
      ),
      );
      const helper2 = document.createElement("div");
      helper2.className = "muted";
      helper2.style.marginTop = "-2px";
      helper2.textContent = this._t(
        "Time in seconds for the second force-arm confirmation.",
        "Zeitfenster in Sekunden für die zweite Force-Arm-Bestätigung."
      );
      host.append(helper2);
    }
  }

  _renderModes() {
    const host = this.shadowRoot.getElementById("modes-list");
    if (!host) return;
    host.innerHTML = "";

    (this._data.modes || []).forEach((mode, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      this._bindSimpleDnD(item, idx, host, "modes", () => {
        this._renderModes();
        this._renderSensors();
        this._renderActions();
      });
      const details = document.createElement("details");
      const zoneKey = (mode.id || `zone_${idx}`).toString();
      details.open = Object.prototype.hasOwnProperty.call(this._openZoneDetails, zoneKey)
        ? !!this._openZoneDetails[zoneKey]
        : !mode.name;
      details.addEventListener("toggle", () => {
        this._openZoneDetails[zoneKey] = details.open;
      });
      const summary = document.createElement("summary");
      summary.innerHTML = this._summaryWithHandle(mode.icon || "mdi:shield", mode.name || mode.id || `Zone #${idx + 1}`);
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";

      const upd = (patch) => {
        const modes = [...(this._data.modes || [])];
        const next = { ...modes[idx], ...patch };
        if ((!next.id || patch.name !== undefined) && next.name) next.id = this._slugify(next.name);
        modes[idx] = next;
        this._data.modes = modes;
        summary.innerHTML = this._summaryWithHandle(next.icon || "mdi:shield", next.name || next.id || `Zone #${idx + 1}`);
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
      del.textContent = this._t("Delete zone", "Zone löschen");
      del.addEventListener("click", () => {
        const modes = [...(this._data.modes || [])];
        modes.splice(idx, 1);
        this._data.modes = modes;
        this._renderModes();
        this._renderSensors();
        this._renderActions();
        this._scheduleAutosave();
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
      this._bindSimpleDnD(item, idx, host, "global_bypass_rules", () => {
        this._renderGlobalBypass();
        this._renderSensors();
      });
      const details = document.createElement("details");
      const key = (rule.id || `global_${idx}`).toString();
      details.open = Object.prototype.hasOwnProperty.call(this._openGlobalBypassDetails, key)
        ? !!this._openGlobalBypassDetails[key]
        : !rule.name;
      details.addEventListener("toggle", () => {
        this._openGlobalBypassDetails[key] = details.open;
      });
      const summary = document.createElement("summary");
      summary.innerHTML = this._summaryWithHandle(rule.icon || "mdi:swap-horizontal", rule.name || rule.id || `Global bypass #${idx + 1}`);
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";
      const upd = (patch) => {
        const arr = [...(this._data.global_bypass_rules || [])];
        const next = { ...arr[idx], ...patch };
        if ((!next.id || patch.name !== undefined) && next.name) next.id = this._slugify(next.name);
        arr[idx] = next;
        this._data.global_bypass_rules = arr;
        summary.innerHTML = this._summaryWithHandle(next.icon || "mdi:swap-horizontal", next.name || next.id || `Global bypass #${idx + 1}`);
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
      test.className = "btn pill-gray";
      test.type = "button";
      test.textContent = this._t("Test condition", "Bedingung testen");
      test.addEventListener("click", async () => {
        const current = (this._data.global_bypass_rules || [])[idx] || {};
        const result = await this._testGlobalBypassRule(current);
        this._flashButtonText(
          test,
          result ? this._t("Active", "Aktiv") : this._t("Inactive", "Inaktiv"),
          1400,
          this._t("Test condition", "Bedingung testen")
        );
      });

      const del = document.createElement("button");
      del.className = "btn danger";
      del.type = "button";
      del.textContent = this._t("Delete global bypass", "Globalen Bypass löschen");
      del.addEventListener("click", () => {
        const arr = [...(this._data.global_bypass_rules || [])];
        arr.splice(idx, 1);
        this._data.global_bypass_rules = arr;
        this._renderGlobalBypass();
        this._renderSensors();
        this._scheduleAutosave();
      });

      const btnRow = document.createElement("div");
      btnRow.className = "global-btn-row";
      const btnTop = document.createElement("div");
      btnTop.className = "global-btn-top";
      btnTop.append(test);
      const btnDelete = document.createElement("div");
      btnDelete.className = "global-btn-delete";
      btnDelete.append(del);
      btnRow.append(btnTop, btnDelete);

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
      item.draggable = true;
      item.dataset.index = String(idx);
      item.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", String(idx));
        item.classList.add("dragging");
        this._sensorDropIndicator = null;
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        host.querySelectorAll(".item").forEach((n) => n.classList.remove("drag-over-before", "drag-over-after"));
        this._sensorDropIndicator = null;
      });
      item.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        const rect = item.getBoundingClientRect();
        const upper = rect.top + rect.height * 0.35;
        const lower = rect.top + rect.height * 0.65;
        let before = true;
        if (ev.clientY <= upper) before = true;
        else if (ev.clientY >= lower) before = false;
        else if (this._sensorDropIndicator && this._sensorDropIndicator.idx === idx) before = this._sensorDropIndicator.before;
        else before = ev.clientY < rect.top + rect.height / 2;

        const changed = !this._sensorDropIndicator
          || this._sensorDropIndicator.idx !== idx
          || this._sensorDropIndicator.before !== before;
        if (!changed) return;

        this._sensorDropIndicator = { idx, before };
        host.querySelectorAll(".item").forEach((n) => n.classList.remove("drag-over-before", "drag-over-after"));
        item.classList.add(before ? "drag-over-before" : "drag-over-after");
      });
      item.addEventListener("dragleave", () => {
        // Keep marker stable; it will be replaced on next dragover or cleared on dragend/drop.
      });
      item.addEventListener("drop", (ev) => {
        ev.preventDefault();
        const from = Number(ev.dataTransfer.getData("text/plain"));
        const to = Number(item.dataset.index);
        if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
        const before = this._sensorDropIndicator && this._sensorDropIndicator.idx === to
          ? this._sensorDropIndicator.before
          : ev.clientY < (item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2);
        const rules = [...(this._data.sensor_rules || [])];
        const [moved] = rules.splice(from, 1);
        let insertAt = to;
        if (!before) insertAt = to + (from < to ? 0 : 1);
        else insertAt = to + (from < to ? -1 : 0);
        if (insertAt < 0) insertAt = 0;
        if (insertAt > rules.length) insertAt = rules.length;
        rules.splice(insertAt, 0, moved);
        this._data.sensor_rules = rules;
        host.querySelectorAll(".item").forEach((n) => n.classList.remove("drag-over-before", "drag-over-after"));
        this._sensorDropIndicator = null;
        this._renderSensors();
        this._scheduleAutosave();
      });

      const details = document.createElement("details");
      const sensorKey = (rule.entity_id || `sensor_${idx}`).toString();
      details.open = Object.prototype.hasOwnProperty.call(this._openSensorDetails, sensorKey)
        ? !!this._openSensorDetails[sensorKey]
        : !rule.entity_id;
      details.addEventListener("toggle", () => {
        this._openSensorDetails[sensorKey] = details.open;
      });
      const summary = document.createElement("summary");
      const st = rule.entity_id ? this._hass?.states?.[rule.entity_id] : null;
      const icon = this._sensorIcon(st);
      const name = st?.attributes?.friendly_name || rule.entity_id || `Sensor rule #${idx + 1}`;
      summary.innerHTML = `
        <span class="summary-with-handle">
          <span class="summary-main">
            <ha-icon icon="${icon}"></ha-icon>
            <span class="summary-main-text">${name}</span>
          </span>
          <span class="summary-handle"><ha-icon icon="mdi:menu"></ha-icon></span>
        </span>
      `;
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";

      const upd = (patch) => {
        const rules = [...(this._data.sensor_rules || [])];
        rules[idx] = { ...rules[idx], ...patch };
        this._data.sensor_rules = rules;
        const s = rules[idx].entity_id ? this._hass?.states?.[rules[idx].entity_id] : null;
        const iconNow = this._sensorIcon(s);
        const nameNow = s?.attributes?.friendly_name || rules[idx].entity_id || `Sensor rule #${idx + 1}`;
        summary.innerHTML = `
          <span class="summary-with-handle">
            <span class="summary-main">
              <ha-icon icon="${iconNow}"></ha-icon>
              <span class="summary-main-text">${nameNow}</span>
            </span>
            <span class="summary-handle"><ha-icon icon="mdi:menu"></ha-icon></span>
          </span>
        `;
      };

      row.append(
        this._sel({ entity: { filter: { domain: "binary_sensor" } } }, rule.entity_id || "", (v) => upd({ entity_id: v }), "Sensor"),
      );

      const sep = document.createElement("hr");
      sep.className = "sep";
      row.appendChild(sep);

      const usedIn = this._sel(
        { select: { multiple: true, mode: "dropdown", options: modeOptions } },
        rule.modes || [],
        (v) => upd({ modes: v || [] }),
        "Use Sensor in"
      );
      usedIn.classList.add("sensor-picker");
      const usedInHint = document.createElement("div");
      usedInHint.className = "hint-inline";
      usedInHint.textContent = "Where this sensor is active.";

      const bypassedIn = this._sel(
        { select: { multiple: true, mode: "dropdown", options: modeOptions } },
        rule.bypass_modes || [],
        (v) => upd({ bypass_modes: v || [] }),
        "Allow Bypass in"
      );
      bypassedIn.classList.add("sensor-picker");
      const bypassedInHint = document.createElement("div");
      bypassedInHint.className = "hint-inline";
      bypassedInHint.textContent = "Ignored when zone bypass is active.";

      const globalBypass = this._sel(
        { select: { multiple: true, mode: "dropdown", options: globalBypassOptions } },
        rule.bypass_global_ids || [],
        (v) => upd({ bypass_global_ids: v || [] }),
        "Select Bypass Rule"
      );
      globalBypass.classList.add("sensor-picker");
      const globalBypassHint = document.createElement("div");
      globalBypassHint.className = "hint-inline";
      globalBypassHint.textContent = "Extra bypass conditions linked to this sensor.";

      row.append(
        usedIn,
        usedInHint,
        bypassedIn,
        bypassedInHint,
        globalBypass,
        globalBypassHint,
        this._sel({ boolean: {} }, !rule.allow_open_arm, (v) => upd({ allow_open_arm: !v }), "Prohibit arming when open"),
        this._sel({ boolean: {} }, !!rule.trigger_on_open_only, (v) => upd({ trigger_on_open_only: !!v }), "Trigger only when opening"),
        this._sel({ boolean: {} }, !!rule.trigger_unknown_unavailable, (v) => upd({ trigger_unknown_unavailable: !!v }), "Trigger when becomes unknown OR unavailable"),
      );

      const del = document.createElement("button");
      del.className = "btn danger";
      del.type = "button";
      del.textContent = this._t("Delete sensor rule", "Sensorregel löschen");
      del.addEventListener("click", () => {
        const rules = [...(this._data.sensor_rules || [])];
        rules.splice(idx, 1);
        this._data.sensor_rules = rules;
        this._renderSensors();
        this._scheduleAutosave();
      });

      const copyBtn = document.createElement("button");
      copyBtn.className = "btn pill-gray";
      copyBtn.type = "button";
      copyBtn.textContent = this._t("Copy config", "Konfiguration kopieren");
      copyBtn.addEventListener("click", () => {
        const current = (this._data.sensor_rules || [])[idx] || {};
        this._sensorConfigClipboard = {
          modes: [...(current.modes || [])],
          bypass_modes: [...(current.bypass_modes || [])],
          bypass_global_ids: [...(current.bypass_global_ids || [])],
          allow_open_arm: !!current.allow_open_arm,
          trigger_on_open_only: !!current.trigger_on_open_only,
          trigger_unknown_unavailable: !!current.trigger_unknown_unavailable,
        };
        this._status(this._t("Sensor config copied.", "Sensor-Konfiguration kopiert."), "ok");
        this._flashButtonText(
          copyBtn,
          this._t("Copied!", "Kopiert!"),
          1200,
          this._t("Copy config", "Konfiguration kopieren")
        );
      });

      const pasteBtn = document.createElement("button");
      pasteBtn.className = "btn pill-gray";
      pasteBtn.type = "button";
      pasteBtn.textContent = this._t("Paste config", "Konfiguration einfügen");
      pasteBtn.addEventListener("click", () => {
        if (!this._sensorConfigClipboard) {
          this._status(this._t("No copied sensor config available.", "Keine kopierte Sensor-Konfiguration verfügbar."), "error");
          return;
        }
        upd({ ...this._sensorConfigClipboard });
        this._renderSensors();
        this._status(this._t("Sensor config pasted.", "Sensor-Konfiguration eingefügt."), "ok");
        this._scheduleAutosave();
      });

      const btnRow = document.createElement("div");
      btnRow.className = "sensor-btn-row";
      const btnTop = document.createElement("div");
      btnTop.className = "sensor-btn-top";
      btnTop.append(copyBtn, pasteBtn);
      const btnDelete = document.createElement("div");
      btnDelete.className = "sensor-btn-delete";
      btnDelete.append(del);
      btnRow.append(btnTop, btnDelete);

      details.appendChild(row);
      details.appendChild(btnRow);
      item.appendChild(details);
      host.appendChild(item);
    });
  }

  _sensorIcon(st) {
    const explicit = st?.attributes?.icon;
    if (explicit) return explicit;
    const dc = String(st?.attributes?.device_class || "").toLowerCase();
    if (["door", "window", "opening", "garage_door"].includes(dc)) return "mdi:door";
    if (["motion", "occupancy", "presence"].includes(dc)) return "mdi:motion-sensor";
    return "mdi:shield-alert-outline";
  }

  _renderUsers() {
    const host = this.shadowRoot.getElementById("users-list");
    if (!host) return;
    host.innerHTML = "";

    if (!(this._haUsers || []).length) {
      const hint = document.createElement("div");
      hint.className = "muted";
      hint.style.marginBottom = "8px";
      hint.textContent = this._t("HA user list unavailable in this context; mapping picker may stay empty.", "HA-Benutzerliste in diesem Kontext nicht verfügbar; der Mapping-Picker kann leer bleiben.");
      host.appendChild(hint);
    }

    (this._data.users || []).forEach((u, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      this._bindSimpleDnD(item, idx, host, "users", () => {
        this._renderUsers();
        this._renderActions();
      });
      const details = document.createElement("details");
      details.open = !u.name;
      const summary = document.createElement("summary");
      const userIcon = "mdi:account";
      summary.innerHTML = this._summaryWithHandle(userIcon, u.name || `User #${idx + 1}`);
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";
      const upd = (patch) => {
        const users = [...(this._data.users || [])];
        users[idx] = { ...users[idx], ...patch };
        this._data.users = users;
        const iu = users[idx];
        const userIconNow = "mdi:account";
        summary.innerHTML = this._summaryWithHandle(userIconNow, iu.name || `User #${idx + 1}`);
      };

      const modeOptions = this._zoneModeOptions();
      const haUserOptions = (this._haUsers || []).map((u) => ({ value: u.id, label: u.name }));
      const helper = document.createElement("div");
      helper.className = "muted";
      helper.style.marginTop = "-2px";
      helper.style.marginBottom = "6px";
      helper.textContent = this._t(
        "Map Home Assistant UI users to this alarm user for code-less arming and proper cause_user logging.",
        "Ordnen Sie Home-Assistant-UI-Benutzer diesem Alarm-Benutzer zu (für codefreies Scharfschalten und korrektes cause_user-Logging)."
      );

      row.append(
        this._sel({ text: {} }, u.name || "", (v) => upd({ name: v }), "Name"),
        this._sel({ text: { type: "password" } }, u.code || "", (v) => upd({ code: v }), "Code"),
      );

      const sep0 = document.createElement("hr");
      sep0.className = "sep";
      sep0.style.marginTop = "6px";
      sep0.style.marginBottom = "2px";
      row.append(sep0);

      row.append(
        this._sel(
          { select: { multiple: true, mode: "dropdown", options: haUserOptions } },
          Array.isArray(u.ha_user_ids) ? u.ha_user_ids : [],
          (v) => upd({ ha_user_ids: Array.isArray(v) ? v : [] }),
          this._t("Linked HA users", "Verknüpfte HA-Benutzer")
        ),
        helper,
      );

      const sep = document.createElement("hr");
      sep.className = "sep";
      sep.style.marginTop = "6px";
      sep.style.marginBottom = "2px";
      row.append(sep);

      row.append(
        this._sel({ select: { multiple: true, mode: "dropdown", options: modeOptions } }, u.arm_modes || [], (v) => upd({ arm_modes: v || [] }), "Arm modes"),
        this._sel({ boolean: {} }, !!u.can_arm_override, (v) => upd({ can_arm_override: !!v }), this._t("Can arm with override", "Kann mit Override scharf schalten")),
        this._sel({ select: { multiple: true, mode: "dropdown", options: modeOptions } }, u.disarm_modes || [], (v) => upd({ disarm_modes: v || [] }), "Disarm modes"),
      );

      const del = document.createElement("button");
      del.className = "btn danger";
      del.type = "button";
      del.textContent = this._t("Delete user", "Benutzer löschen");
      del.addEventListener("click", () => {
        const users = [...(this._data.users || [])];
        users.splice(idx, 1);
        this._data.users = users;
        this._renderUsers();
        this._renderActions();
        this._scheduleAutosave();
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

    if (this._data.require_second_arm_for_override !== false) {
      const systemItem = document.createElement("div");
      systemItem.className = "item";
      const sysDetails = document.createElement("details");
      sysDetails.open = false;
      const sysSummary = document.createElement("summary");
      sysSummary.innerHTML = this._summaryWithHandle(
        "mdi:bell-outline",
        this._t("Default notice: force-arm confirmation", "Standardhinweis: Force-Arm-Bestätigung")
      );
      const sysHint = document.createElement("div");
      sysHint.className = "muted";
      sysHint.style.marginTop = "8px";
      sysHint.textContent = this._t(
        "Built-in notice shown when second arming is required. It cannot be deleted, only enabled/disabled.",
        "Eingebauter Hinweis bei erforderlichem zweitem Scharfschalten. Er kann nicht gelöscht, nur aktiviert/deaktiviert werden."
      );
      const sysBtn = document.createElement("button");
      sysBtn.className = "btn danger";
      sysBtn.type = "button";
      const syncSysBtn = () => {
        const enabled = this._data.override_required_persistent_notice !== false;
        sysBtn.textContent = enabled
          ? this._t("Disable notice", "Hinweis deaktivieren")
          : this._t("Enable notice", "Hinweis aktivieren");
      };
      syncSysBtn();
      sysBtn.addEventListener("click", () => {
        this._data.override_required_persistent_notice = !(this._data.override_required_persistent_notice !== false);
        syncSysBtn();
        this._scheduleAutosave();
      });

      const sysBox = document.createElement("div");
      sysBox.className = "sensor-btn-row system-notice-wrap";
      const sysTop = document.createElement("div");
      sysTop.className = "sensor-btn-top";
      sysTop.append(sysBtn);
      sysBox.append(sysHint, sysTop);
      sysDetails.append(sysSummary, sysBox);
      systemItem.appendChild(sysDetails);
      host.appendChild(systemItem);
    }

    const throughZoneOptions = [{ value: "any", label: this._t("Any zone", "Beliebige Zone") }, ...this._modeOptions()];
    const userOptions = [
      { value: "any_actor", label: this._t("Any User / Any Sensor", "Beliebiger Benutzer / Beliebiger Sensor") },
      { value: "any_user", label: this._t("Any User", "Beliebiger Benutzer") },
      { value: "none", label: this._t("Any Sensor", "Beliebiger Sensor") },
      ...(this._data.users || []).map((u) => ({
        value: (u.name || "").trim().toLowerCase() || "any",
        label: `${this._t("User", "Benutzer")} (${u.name || this._t("Unnamed", "Unbenannt")})`,
      })),
    ];

    (this._data.actions || []).forEach((action, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      this._bindSimpleDnD(item, idx, host, "actions", () => {
        this._renderActions();
      });
      const details = document.createElement("details");
      details.open = !action.name;
      const summary = document.createElement("summary");
      summary.innerHTML = this._summaryWithHandle(action.icon || "mdi:script-text-outline", action.name || `Action #${idx + 1}`);
      details.appendChild(summary);

      const row = document.createElement("div");
      row.className = "row";
      const upd = (patch) => {
        const actions = [...(this._data.actions || [])];
        actions[idx] = { ...actions[idx], ...patch, through_mode: ["any"] };
        this._data.actions = actions;
        const a = actions[idx];
        summary.innerHTML = this._summaryWithHandle(a.icon || "mdi:script-text-outline", a.name || `Action #${idx + 1}`);
      };

      const selectedZones = Array.isArray(action.through) && action.through.length ? action.through : ["any"];
      const { options: stateOptions, reduced: stateReduced } = this._actionStateOptionsForZones(selectedZones);
      const selectedFrom = (action.from || ["any"])[0] || "any";
      const toOptions = this._actionToOptions(selectedFrom, stateOptions);

      const nameSel = this._sel({ text: {} }, action.name || "", (v) => upd({ name: v }), "Action name");
      const iconSel = this._sel({ icon: {} }, action.icon || "mdi:script-text-outline", (v) => upd({ icon: v }), "Icon");
      nameSel.style.marginBottom = "-2px";
      iconSel.style.marginTop = "-2px";

      row.append(
        nameSel,
        iconSel,
        this._sel(
          { select: { multiple: true, mode: "dropdown", options: throughZoneOptions } },
          selectedZones,
          (v) => {
            const arr = Array.isArray(v) ? v : [v || "any"];
            const cleaned = arr.filter(Boolean);
            const noAny = cleaned.filter((x) => x !== "any");
            const normalized = cleaned.includes("any") && noAny.length ? noAny : (cleaned.length ? cleaned : ["any"]);
            upd({ through: normalized, from: ["any"], to: ["any"] });
            this._renderActions();
          },
          this._t("Zones", "Zonen")
        ),
        this._sel(
          { select: { mode: "dropdown", options: stateOptions } },
          selectedFrom,
          (v) => {
            upd({ from: [v || "any"], to: ["any"] });
            this._renderActions();
          },
          this._t("From state", "Von Zustand")
        ),
        this._sel({ select: { mode: "dropdown", options: toOptions } }, (action.to || ["any"])[0] || "any", (v) => upd({ to: [v || "any"] }), this._t("To state", "Zu Zustand")),
        this._sel({ select: { mode: "dropdown", options: userOptions } }, action.by_user || "any_actor", (v) => upd({ by_user: v || "any_actor" }), "By"),
      );

      const topSep = document.createElement("hr");
      topSep.className = "sep";
      topSep.style.marginTop = "4px";
      row.insertBefore(topSep, row.children[2] || null);

      if (stateReduced) {
        const warn = document.createElement("div");
        warn.className = "muted";
        warn.textContent = this._t(
          "State options were reduced because selected zones support different arm states.",
          "Die Zustandsauswahl wurde eingeschränkt, da gewählte Zonen unterschiedliche Scharfzustände unterstützen."
        );
        row.append(warn);
      }
      const sep = document.createElement("hr");
      sep.className = "sep";
      row.appendChild(sep);
      row.append(
        this._sel({ entity: { multiple: true } }, action.targets || action.scripts || [], (v) => upd({ targets: v || [], scripts: v || [] }), "Triggered targets (any turn_on entity)"),
      );

      const del = document.createElement("button");
      del.className = "btn danger";
      del.type = "button";
      del.textContent = this._t("Delete action", "Aktion löschen");
      del.addEventListener("click", () => {
        const actions = [...(this._data.actions || [])];
        actions.splice(idx, 1);
        this._data.actions = actions;
        this._renderActions();
        this._scheduleAutosave();
      });

      const test = document.createElement("button");
      test.className = "btn pill-gray";
      test.type = "button";
      test.textContent = this._t("Test action", "Aktion testen");
      test.addEventListener("click", async () => {
        const current = (this._data.actions || [])[idx] || {};
        const ok = await this._runActionTest(current);
        this._flashButtonText(
          test,
          ok ? this._t("Test sent", "Test gesendet") : this._t("Failed", "Fehlgeschlagen"),
          1400,
          this._t("Test action", "Aktion testen")
        );
      });

      const btnRow = document.createElement("div");
      btnRow.className = "sensor-btn-row";
      const btnTop = document.createElement("div");
      btnTop.className = "sensor-btn-top";
      btnTop.append(test);
      const btnDelete = document.createElement("div");
      btnDelete.className = "sensor-btn-delete";
      btnDelete.append(del);
      btnRow.append(btnTop, btnDelete);

      details.appendChild(row);
      details.appendChild(btnRow);
      item.appendChild(details);
      host.appendChild(item);
    });
  }

  async _runActionTest(action) {
    try {
      const targets = action.targets || action.scripts || [];
      if (!Array.isArray(targets) || !targets.length) return false;
      const testZone = Array.isArray(action.through)
        ? (action.through.find((z) => z && z !== "any") || action.through[0] || "main")
        : "main";
      const variables = {
        zone: Array.isArray(action.through) && action.through.length
          ? action.through.filter((z) => z && z !== "any").join(", ") || "main"
          : testZone,
        from_state: "disarmed",
        to_state: "triggered",
        arm_type: "away",
        cause_user: "UI (test_user)",
        cause_sensor: "binary_sensor.test_sensor",
        cause_sensor_name: "Test Sensor",
        pending_seconds: 30,
        blocking_sensors: ["binary_sensor.test_window", "binary_sensor.test_door"],
        blocking_sensor_names: ["Test Window", "Test Door"],
        blocking_sensors_text: "Test Window, Test Door",
      };
      for (const entityId of targets) {
        const [domain] = String(entityId || "").split(".", 1);
        if (domain === "script") {
          await this._hass.callService("script", "turn_on", { entity_id: entityId, variables });
        } else {
          await this._hass.callService("homeassistant", "turn_on", { entity_id: entityId });
        }
      }
      this._status(this._t("Action test executed.", "Aktionstest ausgeführt."), "ok");
      return true;
    } catch (err) {
      this._status(`${this._t("Action test failed", "Aktionstest fehlgeschlagen")}: ${err.message}`, "error");
      return false;
    }
  }

  async _loadConfig() {
    try {
      await this._loadHaUsers();
      const data = await this._hass.callApi("get", "ng_alarm/config");
      this._data = {
        name: "NG Alarm",
        require_code_to_arm: true,
        require_code_to_mode_change: true,
        require_code_to_disarm: true,
        code_input_mode: "pin",
        arm_override_confirm_window: 20,
        require_second_arm_for_override: true,
        override_required_persistent_notice: true,
        expose_event_log_sensor: false,
        modes: [],
        global_bypass_rules: [],
        sensor_rules: [],
        users: [],
        actions: [],
        ...data,
      };

      if (Array.isArray(this._data.actions)) {
        this._data.actions = this._data.actions.map((a) => ({ ...a, through_mode: ["any"] }));
      }

      this._renderGeneral();
      this._renderModes();
      this._renderGlobalBypass();
      this._renderSensors();
      this._renderUsers();
      this._renderActions();
      this._renderEventSensorToggle();
      this._updateHeaderVersion();
      this._configLoaded = true;

      this._status(this._t("Configuration loaded.", "Konfiguration geladen."));
    } catch (err) {
      this._configLoaded = false;
      this._status(`${this._t("Load failed", "Laden fehlgeschlagen")}: ${err.message}`, "error");
    }
  }

  async _loadHaUsers() {
    try {
      let users = [];
      try {
        users = await this._hass.callWS({ type: "config/auth/list" });
      } catch (_wsErr) {
        users = await this._hass.callApi("get", "config/users");
      }
      this._haUsers = (Array.isArray(users) ? users : [])
        .filter((u) => u && u.id && (u.name || u.username))
        .map((u) => ({ id: String(u.id), name: String(u.name || u.username) }));

      const currentId = this._hass?.user?.id;
      const currentName = this._hass?.user?.name || this._hass?.user?.username;
      if (currentId && currentName && !this._haUsers.some((u) => u.id === currentId)) {
        this._haUsers.unshift({ id: String(currentId), name: String(currentName) });
      }
    } catch (_err) {
      const currentId = this._hass?.user?.id;
      const currentName = this._hass?.user?.name || this._hass?.user?.username;
      this._haUsers = currentId && currentName ? [{ id: String(currentId), name: String(currentName) }] : [];
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
    sel.innerHTML = `<option value="all">${this._t("All zones", "Alle Zonen")}</option>`;
    (this._eventZones || []).forEach((z) => {
      const o = document.createElement("option");
      o.value = z;
      o.textContent = this._zoneDisplayLabel(z);
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
        const z = this._zoneDisplayLabel(ev.zone || "main");
        const causeUser = ev.cause_user || ev.by || ev.actor || "N/A";
        const causeSensor = ev.cause_sensor || "N/A";
        item.innerHTML = `<strong>[${z}] ${ev.event || "event"}</strong> • ${ts}<br/>${ev.message || ""}<br/><span class="muted">from=${ev.from_state || "N/A"} to=${ev.to_state || "N/A"} cause_user=${causeUser} cause_sensor=${causeSensor} pending_seconds=${ev.pending_seconds ?? 0}</span>`;
        host.appendChild(item);
      });
    } catch (err) {
      this._status(`${this._t("Events load failed", "Laden der Ereignisse fehlgeschlagen")}: ${err.message}`, "error");
    }
  }

  async _clearEvents() {
    try {
      await this._hass.callApi("post", "ng_alarm/events/clear", { zone: this._selectedEventZone || "all" });
      this._events = [];
      await this._loadEvents();
      this._status(this._t("Event log cleared.", "Ereignisprotokoll geleert."), "ok");
    } catch (err) {
      this._status(`${this._t("Event clear failed", "Leeren der Ereignisse fehlgeschlagen")}: ${err.message}`, "error");
    }
  }

  async _saveConfig(isAutosave = false) {
    if (this._autosaveInFlight) return;
    try {
      this._autosaveInFlight = true;
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
      this._status(
        isAutosave
          ? this._t("Autosaved.", "Automatisch gespeichert.")
          : this._t("Saved and runtime reloaded.", "Gespeichert und Laufzeit neu geladen."),
        "ok"
      );
      if (!isAutosave) {
        const saveBtn = this.shadowRoot.getElementById("save");
        this._flashButtonText(
          saveBtn,
          this._t("Saved!", "Gespeichert!"),
          1400,
          this._t("Save & Reload", "Speichern & Neu laden")
        );
      }
    } catch (err) {
      this._status(`${this._t("Save failed", "Speichern fehlgeschlagen")}: ${err.message}`, "error");
    } finally {
      this._autosaveInFlight = false;
    }
  }

  _flashButtonText(button, text, ms = 1200, restoreText = null) {
    if (!button) return;
    const original = restoreText || button.textContent;
    button.textContent = text;
    setTimeout(() => {
      button.textContent = original;
    }, ms);
  }

  _status(text, level = "") {
    const s = this.shadowRoot.getElementById("status");
    if (!s) return;
    s.textContent = text;
    s.classList.remove("status-ok", "status-error");
    if (level === "ok") s.classList.add("status-ok");
    if (level === "error") s.classList.add("status-error");
  }

  _summaryWithHandle(icon, text) {
    return `
      <span class="summary-with-handle">
        <span class="summary-main">
          <ha-icon icon="${icon}"></ha-icon>
          <span class="summary-main-text">${text}</span>
        </span>
        <span class="summary-handle"><ha-icon icon="mdi:menu"></ha-icon></span>
      </span>
    `;
  }

  _bindSimpleDnD(item, idx, host, key, rerender) {
    item.draggable = true;
    item.dataset.index = String(idx);
    item.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", String(idx));
      this._dragIndicators[key] = null;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      host.querySelectorAll(".item").forEach((n) => n.classList.remove("drag-over-before", "drag-over-after"));
      this._dragIndicators[key] = null;
    });
    item.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      const rect = item.getBoundingClientRect();
      const upper = rect.top + rect.height * 0.35;
      const lower = rect.top + rect.height * 0.65;
      let before = true;
      if (ev.clientY <= upper) before = true;
      else if (ev.clientY >= lower) before = false;
      else if (this._dragIndicators[key] && this._dragIndicators[key].idx === idx) before = this._dragIndicators[key].before;
      else before = ev.clientY < rect.top + rect.height / 2;

      const changed = !this._dragIndicators[key]
        || this._dragIndicators[key].idx !== idx
        || this._dragIndicators[key].before !== before;
      if (!changed) return;

      this._dragIndicators[key] = { idx, before };
      host.querySelectorAll(".item").forEach((n) => n.classList.remove("drag-over-before", "drag-over-after"));
      item.classList.add(before ? "drag-over-before" : "drag-over-after");
    });
    item.addEventListener("dragleave", () => {
      // keep marker stable until next dragover/drop
    });
    item.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const from = Number(ev.dataTransfer.getData("text/plain"));
      const to = Number(item.dataset.index);
      if (Number.isNaN(from) || Number.isNaN(to)) return;
      const before = this._dragIndicators[key] && this._dragIndicators[key].idx === to
        ? this._dragIndicators[key].before
        : ev.clientY < (item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2);
      const arr = [...(this._data[key] || [])];
      const [moved] = arr.splice(from, 1);
      let insertAt = to + (before ? 0 : 1);
      if (from < insertAt) insertAt -= 1;
      if (insertAt < 0) insertAt = 0;
      if (insertAt > arr.length) insertAt = arr.length;
      if (insertAt === from) {
        host.querySelectorAll(".item").forEach((n) => n.classList.remove("drag-over-before", "drag-over-after"));
        this._dragIndicators[key] = null;
        return;
      }
      arr.splice(insertAt, 0, moved);
      this._data[key] = arr;
      host.querySelectorAll(".item").forEach((n) => n.classList.remove("drag-over-before", "drag-over-after"));
      this._dragIndicators[key] = null;
      rerender();
      this._scheduleAutosave();
    });
  }
}

if (!customElements.get("ha-panel-ng-alarm")) {
  customElements.define("ha-panel-ng-alarm", HAPanelNGAlarm);
}
if (!customElements.get("ng-alarm-panel")) {
  customElements.define("ng-alarm-panel", HAPanelNGAlarm);
}
