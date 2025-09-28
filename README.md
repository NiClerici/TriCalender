# TriCalender

Simple tooling to export training sessions defined in `trainingskalender/trainings.json` into an iCalendar file.

## Prerequisites

- Python 3.11 or newer (for the built-in `zoneinfo` module)
- `pip install icalendar`

## Usage

1. Update `trainingskalender/trainings.json` with the desired sessions.
2. Run `python trainingskalender/export.py` from the project root.
3. Import the generated `trainingskalender/tritrainings.ics` into your calendar client.

## Notes

- Event UIDs are generated from date, start time, title, and sport so calendar imports stay in sync.
- If the JSON file is missing, the exporter aborts early to avoid creating incomplete calendars.
