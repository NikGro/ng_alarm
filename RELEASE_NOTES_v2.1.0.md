## NG Alarm 2.1.0

Die Konfigurationsoberfläche orientiert sich jetzt stärker an Home Assistant: eine klare Tab-Leiste wie in den Werkzeugen und einheitliche Hinzufügen-Buttons wie im Automationseditor.

### 🧭 Horizontale Tab-Leiste
- **Allgemein, Zonen, Sensoren, Benutzer, Aktionen und Ereignisse** stehen in einer einzigen Zeile direkt unter der Kopfzeile.
- Auf kleinen Bildschirmen lässt sich die Leiste horizontal scrollen; der ausgewählte Tab wird sichtbar gehalten.
- Kopfzeile und Tab-Leiste bleiben beim Scrollen gemeinsam am oberen Rand.
- Die Safe-Area-Abstände für Statusleiste und Dynamic Island bleiben berücksichtigt.
- Verwendet die nativen Home-Assistant-Tab-Komponenten, sobald diese geladen sind. Eine passend gestaltete Navigation funktioniert bereits während des Ladens und auf älteren Frontends.
- Die Ersatznavigation unterstützt Pfeiltasten sowie Home/End und kennzeichnet Tabs und zugehörige Inhalte für assistive Technologien.

### ➕ Einheitliche Hinzufügen-Buttons
- Alle Hinzufügen-Buttons der sortierbaren Listen sind jetzt rund, in der primären Themefarbe (standardmäßig blau) und mit Plus-Symbol gestaltet.
- Das gilt für Zonen, globale Bypass-Regeln, Sensoren, Benutzer und Aktionen sowie die Sammelaktionen für Bewegungs-/Präsenz- und Tür-/Fenstersensoren.
- Sobald verfügbar, werden die nativen Accent-Buttons aus dem HA-Automationseditor verwendet.

### 🛠️ Weitere Korrektur
- Ein Fehler bei der Registrierung des alten Panel-Namens wurde behoben: Derselbe Custom-Element-Konstruktor wird nicht mehr zweimal registriert.
- Die Integrationsversion im Manifest ist jetzt **2.1.0**.

### ✅ Geprüft
- Browserprüfung in Hochkant (**390 × 844**), Querformat (**844 × 390**) und Desktopansicht (**1280 × 800**), jeweils in hellem und dunklem Theme.
- Tabwechsel, Tastaturbedienung, Sichtbarkeit des aktiven Tabs, Hinzufügen und nachträgliches Laden der nativen Komponenten geprüft.
- Alle **46 Backend-Regressionstests** bestanden.

### Update
Über HACS aktualisieren und Home Assistant neu starten. Falls noch die alte Oberfläche angezeigt wird, die Ansicht neu laden beziehungsweise den Frontend-Cache aktualisieren.

**Änderungen:** [Pull Request #2](https://github.com/NikGro/ng_alarm/pull/2) · [v2.0 … v2.1.0](https://github.com/NikGro/ng_alarm/compare/v2.0...v2.1.0)
