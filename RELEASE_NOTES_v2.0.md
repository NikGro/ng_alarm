## NG Alarm 2.0
Zuverlässiger nach Neustarts, präzisere Benutzerrechte und eine mobile Oberfläche, die sich stärker an Home Assistant orientiert.

### 📱 Mobile Oberfläche
- Die Kopfzeile berücksichtigt die Safe-Area-Abstände der Companion App und des Browsers – auch im Bereich von iPhone-Statusleiste und Dynamic Island.
- Farben, Schriftgröße und Abstände orientieren sich am Home-Assistant-Theme.
- Der native Home-Assistant-Menübutton wird verwendet, sobald er verfügbar ist. Während des Ladens bleibt ein bedienbarer Ersatzbutton erhalten.
- Das Menü-Icon übernimmt die Farbe der Kopfzeile statt ungewollt blau dargestellt zu werden.

### 🛡️ Alarmzustand & Neustarts
- Nacht- und Urlaubsmodus werden nach einem Neustart oder Integrations-Reload korrekt wiederhergestellt.
- Laufende Ein- und Ausgangsverzögerungen sowie begrenzte Alarmdauern werden mit ihrem gespeicherten Ablaufzeitpunkt fortgesetzt.
- Bereits abgelaufene Timer werden ohne zusätzliche volle Verzögerung weiterverarbeitet.
- Ältere gespeicherte Zustände ohne Ablaufzeitpunkt setzen ihre gespeicherte Verzögerung fort.
- Veraltete Timer können eine inzwischen unscharfe Anlage nicht erneut scharfschalten oder auslösen.

### 🔐 PINs, Passwörter & Berechtigungen
- **PIN-Modus:** Nur Ziffern von `0` bis `9` sind zulässig. Führende Nullen bleiben erhalten; Eingaben wie `abc123` werden abgewiesen.
- **Passwortmodus:** Die vollständige Eingabe wird exakt geprüft – einschließlich Buchstaben, Ziffern, Leerzeichen und Sonderzeichen.
- Ungültige PIN-Konfigurationen werden vor dem Speichern abgewiesen.
- Berechtigungen für eine gesamte Zone und für einzelne Scharfschaltmodi werden getrennt geprüft.
- Die Konfigurations-, Reload- und Ereignis-APIs des Panels sind jetzt auf Home-Assistant-Administratoren beschränkt.

### ⚙️ Home Assistant & Qualität
- HTTP-Zugriffe verwenden den typisierten Home-Assistant-Anwendungsschlüssel.
- Alarm-Entitäten werden vor den zugehörigen Protokollsensoren eingerichtet.
- Die in HACS angegebene Mindestversion wurde auf **Home Assistant 2024.11** korrigiert.
- **46 Regressionstests** bestehen unter Home Assistant **2026.10.1**; GitHub Actions führt die Tests und die JavaScript-Syntaxprüfung automatisch aus.

### Hinweise zum Update
- Nach der Installation Home Assistant neu starten.
- Vor dem Wechsel vom Passwort- in den PIN-Modus alle Benutzer-Codes auf ausschließlich numerische Werte umstellen.
- Externe Aufrufe der Panel-APIs benötigen nun ein Administratorkonto.
- Die mobile Darstellung wurde angepasst, aber noch nicht auf einem echten iPhone visuell bestätigt.

**Alle Änderungen:** [v1.0.4 … v2.0](https://github.com/NikGro/ng_alarm/compare/v1.0.4...v2.0)
