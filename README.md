# TriCalender

TriCalender hält einen schlanken Trainingsplan als JSON vor, synchronisiert absolvierte Einheiten mit Strava und exportiert einen abonnierbaren `.ics` Kalender.

## Requirements

- Python 3.11 oder neuer (inkl. `zoneinfo`)
- Abhängigkeiten aus `requirements.txt` (`icalendar`, `python-dotenv`, `requests`)

### Optional: virtuelle Umgebung
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Daily workflow

1. **Plan pflegen** – Einträge in `trainingskalender/trainings.json` anpassen.
2. **Strava laden** – `python trainingskalender/getStrava.py` holt Aktivitäten der letzten `days_back` Tage und speichert sie als `trainingskalender/exportStravaTraining.json`.
3. **Plan synchronisieren** – `python trainingskalender/syncStrava.py` matched offene Workouts, markiert Treffer als erledigt und erweitert die Notizen um einen Strava-Block (inkl. Log-Ausgabe, welche Sessions aktualisiert wurden).
4. **ICS exportieren** – `python trainingskalender/export.py` erstellt/aktualisiert `tritrainings.ics`.
5. **Veröffentlichen** – Mit Git committen und pushen oder das Helferskript nutzen.

Kurzfassung ohne Helfer:
```bash
git add trainingskalender/trainings.json tritrainings.ics
git commit -m "Sync plan with Strava"
git push
```

### Automatisches Commit & Push

```bash
./auto_commit.sh
```
- staged `trainingskalender/trainings.json`, `tritrainings.ics` und alle relevanten Dateien
- erstellt eine Zeitstempel-Nachricht
- pusht zum konfigurierten Remote
- überspringt den Commit, wenn keine Änderungen vorhanden sind

## Plan editieren

Jede Einheit in `trainings.json` benötigt mindestens
- `date` (`YYYY-MM-DD`)
- `start_time` (`HH:MM`, 24h)
- `duration_min`
- `sport`
- `title`

Optional kannst du `note`, `use_default_alarm`, `location` u.Ä. ergänzen. Der Strava-Sync hängt seinen Block automatisch an `note` an bzw. ersetzt ihn beim nächsten Lauf.

## Strava Aktivitäten abrufen

```bash
python trainingskalender/getStrava.py
```
- liest `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN` aus `.env`
- erneuert bei Bedarf den Access Token (per Refresh Flow)
- lädt alle Aktivitäten der letzten `days_back` Tage (Default: 10) und speichert die verdichteten Daten in `exportStravaTraining.json`

Passe `days_back` im Skript an, falls du ein größeres Zeitfenster brauchst.

## Plan mit Strava mergen

```bash
python trainingskalender/syncStrava.py
```
- lädt Plan + Strava-Export
- mappt Sportarten über `SPORT_MAP`
- akzeptiert Datum ±1 Tag und Dauerabweichungen ≤40 % oder ≤10 Minuten
- wählt bei mehreren Kandidaten den besten Score (Datum, Startzeit, Dauer)
- setzt `completed`, `matched_activity_id`, `match_score`, `actual` und ersetzt den Strava-Block in `note`
- loggt im Terminal, ob eine Einheit gematcht wurde oder offen bleibt

Bereits abgeschlossene Workouts werden übersprungen. Wenn du eine Einheit neu zuordnen willst, lösche `completed`/`matched_activity_id` im JSON.

## Kalender exportieren

```bash
python trainingskalender/export.py
```
Erstellt `tritrainings.ics` neben dem Skript, setzt pro Event eine stabile UID und aktualisiert `DTSTAMP`, damit abonnierte Kalender die Änderungen erkennen.

## Veröffentlichung / Hosting

1. `tritrainings.ics` kurz prüfen (Kalender öffnen oder Datei ansehen).
2. Mit Git committen & pushen oder `./auto_commit.sh` nutzen, damit `https://niclerici.github.io/TriCalender/tritrainings.ics` aktualisiert wird.

## Secrets verwalten

- `.env.example` → `.env` kopieren und Strava-Credentials eintragen.
- `.env` ist gitignored und bleibt lokal.
- `getStrava.py` lädt die Werte via `python-dotenv`; andere Skripte lesen nur aus den JSON-Dateien.

## Implementation notes

- Matching-Toleranzen lassen sich in `syncStrava.py` über `DURATION_TOLERANCE_*` und `DATE_TOLERANCE_DAYS` justieren.
- Der Strava-Block im `note` wird beim Sync immer komplett ersetzt, sodass du keinen manuellen Abgleich brauchst.
- Die ICS-UIDs basieren auf Datum, Startzeit, Titel und Sport, damit Kalenderclients Updates erkennen.
- `export.py` verwendet `Europe/Berlin` (Zoneinfo) – passe den Code an, falls du eine andere Zeitzone bevorzugst.

## Troubleshooting

- `ModuleNotFoundError`: `pip install -r requirements.txt`
- Keine Strava-Übereinstimmung: Datum/Dauer/Sport prüfen oder Toleranzen anpassen, ggf. `days_back` erhöhen.
- Kalender aktualisiert sich nicht sofort: Viele Clients (v.a. iOS) cachen für einige Minuten – kurz warten oder manuell neu laden.
