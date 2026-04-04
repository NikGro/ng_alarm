class NGAlarmPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this.render();
      this.loadConfig();
    }
  }

  render() {
    this.innerHTML = `
      <style>
        .wrap { padding: 16px; max-width: 1000px; margin: 0 auto; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .card { border: 1px solid var(--divider-color); border-radius: 12px; padding: 12px; margin-bottom: 12px; }
        label { font-size: 0.9rem; color: var(--secondary-text-color); display:block; margin-bottom: 4px; }
        input, textarea { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); }
        textarea { min-height: 80px; }
        button { margin-top: 12px; padding: 10px 14px; border-radius: 10px; border: none; background: var(--primary-color); color: white; font-weight: 600; cursor: pointer; }
        .muted { color: var(--secondary-text-color); font-size: 0.85rem; }
      </style>
      <div class="wrap">
        <h1>NG Alarm</h1>
        <p class="muted">Native editor for NG Alarm configuration (no config flow).</p>

        <div class="card grid">
          <div><label>Name</label><input id="name" /></div>
          <div><label>Bypass State</label><input id="bypass_state" /></div>
          <div><label>Alarm Code</label><input id="alarm_code" type="password" /></div>
          <div><label>Panic Code (optional)</label><input id="panic_code" type="password" /></div>
          <div><label>Exit Delay Away</label><input id="exit_delay_away" type="number" /></div>
          <div><label>Entry Delay Away</label><input id="entry_delay_away" type="number" /></div>
          <div><label>Exit Delay Home</label><input id="exit_delay_home" type="number" /></div>
          <div><label>Entry Delay Home</label><input id="entry_delay_home" type="number" /></div>
        </div>

        <div class="card grid">
          <div><label>Away Active Sensors (one entity_id per line)</label><textarea id="away_active_sensors"></textarea></div>
          <div><label>Away Bypass Sensors</label><textarea id="away_bypass_sensors"></textarea></div>
          <div><label>Home Active Sensors</label><textarea id="home_active_sensors"></textarea></div>
          <div><label>Home Bypass Sensors</label><textarea id="home_bypass_sensors"></textarea></div>
          <div><label>Bypass Entities</label><textarea id="bypass_entities"></textarea></div>
        </div>

        <div class="card grid">
          <div><label>Pending Scripts</label><textarea id="pending_scripts"></textarea></div>
          <div><label>Triggered Scripts</label><textarea id="triggered_scripts"></textarea></div>
          <div><label>Armed Away Scripts</label><textarea id="armed_away_scripts"></textarea></div>
          <div><label>Armed Home Scripts</label><textarea id="armed_home_scripts"></textarea></div>
          <div><label>Disarmed Scripts</label><textarea id="disarmed_scripts"></textarea></div>
          <div><label>Panic Scripts</label><textarea id="panic_scripts"></textarea></div>
        </div>

        <button id="save">Save & Reload</button>
        <p class="muted" id="status"></p>
      </div>
    `;

    this.querySelector("#save").addEventListener("click", () => this.saveConfig());
  }

  async loadConfig() {
    const res = await fetch("/api/ng_alarm/config", { credentials: "same-origin" });
    const data = await res.json();
    this._setValue("name", data.name);
    this._setValue("bypass_state", data.bypass_state);
    this._setValue("alarm_code", data.alarm_code);
    this._setValue("panic_code", data.panic_code);
    this._setValue("exit_delay_away", data.exit_delay_away);
    this._setValue("entry_delay_away", data.entry_delay_away);
    this._setValue("exit_delay_home", data.exit_delay_home);
    this._setValue("entry_delay_home", data.entry_delay_home);

    [
      "away_active_sensors",
      "away_bypass_sensors",
      "home_active_sensors",
      "home_bypass_sensors",
      "bypass_entities",
      "pending_scripts",
      "triggered_scripts",
      "armed_away_scripts",
      "armed_home_scripts",
      "disarmed_scripts",
      "panic_scripts",
    ].forEach((k) => this._setValue(k, (data[k] || []).join("\n")));
  }

  async saveConfig() {
    const body = {
      name: this._getValue("name"),
      bypass_state: this._getValue("bypass_state"),
      alarm_code: this._getValue("alarm_code"),
      panic_code: this._getValue("panic_code"),
      exit_delay_away: Number(this._getValue("exit_delay_away") || 0),
      entry_delay_away: Number(this._getValue("entry_delay_away") || 0),
      exit_delay_home: Number(this._getValue("exit_delay_home") || 0),
      entry_delay_home: Number(this._getValue("entry_delay_home") || 0),
    };

    [
      "away_active_sensors",
      "away_bypass_sensors",
      "home_active_sensors",
      "home_bypass_sensors",
      "bypass_entities",
      "pending_scripts",
      "triggered_scripts",
      "armed_away_scripts",
      "armed_home_scripts",
      "disarmed_scripts",
      "panic_scripts",
    ].forEach((k) => {
      body[k] = this._getValue(k)
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
    });

    const res = await fetch("/api/ng_alarm/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });

    const status = this.querySelector("#status");
    if (res.ok) {
      status.textContent = "Saved. Runtime reloaded.";
    } else {
      status.textContent = "Save failed.";
    }
  }

  _setValue(id, value) {
    const el = this.querySelector(`#${id}`);
    if (el) el.value = value ?? "";
  }

  _getValue(id) {
    const el = this.querySelector(`#${id}`);
    return el ? el.value : "";
  }
}

customElements.define("ng-alarm-panel", NGAlarmPanel);
