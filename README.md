# TriCalender

TriCalender exports structured training plans from `trainingskalender/trainings.json` into an iCalendar (`.ics`) file that can be imported or subscribed to from calendar apps.

## Requirements

- Python 3.11 or newer (ships with the `zoneinfo` module used for time zones)
- Python package: `icalendar`

### Optional: isolate dependencies
```bash
python -m venv venv
source venv/bin/activate
pip install icalendar
```

## Edit the training plan

Update `trainingskalender/trainings.json` with your upcoming sessions. Each entry needs:
- `date` (`YYYY-MM-DD`)
- `start_time` (`HH:MM` 24h)
- `duration_min`
- `sport`
- `title`
- Optional: `location`, `note`, `alarm_min`

Example:
```json
{
  "trainings": [
    {
      "date": "2025-10-01",
      "start_time": "18:30",
      "duration_min": 60,
      "sport": "Laufen",
      "title": "GA1 Dauerlauf",
      "location": "Aarau",
      "note": "Locker 60 Min, Pulszone 2",
      "alarm_min": 30
    }
  ]
}
```

## Export the calendar

Run from the project root:
```bash
python trainingskalender/export.py
```
The script writes `tritrainings.ics` next to the script and prints the output path. Re-run anytime you change the JSON.

## Publish updates

1. Confirm `tritrainings.ics` contains the expected sessions (open in a calendar app or look at the raw file).
2. Commit and push to GitHub so the hosted calendar at `https://niclerici.github.io/TriCalender/tritrainings.ics` refreshes.

Short version:
```bash
git add tritrainings.ics
git commit -m "Trainingsplan Update"
git push
```

### Automate commit + push

Use the helper script to stage, commit with a timestamped message, and push:
```bash
./auto_commit.sh
```
It skips committing when the working tree is clean.

## Implementation notes

- Event UIDs derive from the date, start time, title, and sport so calendar clients detect updates reliably.
- `DTSTAMP` is refreshed on every export which prompts connected clients to sync new changes.
- The exporter aborts early if `trainingskalender/trainings.json` is missing to prevent publishing an empty calendar.
- All times use the `Europe/Berlin` time zone via Python's `zoneinfo` module.

## Troubleshooting

- `ModuleNotFoundError: icalendar`: install the dependency (`pip install icalendar`).
- Nothing happens when exporting: double-check the JSON structure and that `trainings` contains a list of sessions.
- Calendar does not update immediately: some clients (e.g. iOS) cache subscriptions for several minutes; allow time before re-checking or force a manual refresh.
