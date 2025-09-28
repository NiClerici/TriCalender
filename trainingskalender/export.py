import json
import hashlib
from icalendar import Calendar, Event
import datetime as dt
from zoneinfo import ZoneInfo

json_path = "trainingskalender/trainings.json"
out_path = "tritrainings.ics"
tz = ZoneInfo("Europe/Berlin")


cal = Calendar()
cal.add("prodid", "-//TriCalender//DE")
cal.add("version", "2.0")
cal.add("X-WR-CALNAME", "Trainingskalender")
cal.add("X-WR-TIMEZONE", "Europe/Berlin")   


try:
    with open(json_path, "r", encoding="utf-8") as f:
        trainings = json.load(f)
except FileNotFoundError as e:
    print(f"File not found. Please ensure 'trainingskalender/trainings.json' exists.: {e}")
    trainings = None


def make_uid(t: dict) -> str:
    """Create a unique identifier for an event based on its details."""
    key = f"{t['date']}|{t['start_time']}|{t['title'].strip()}|{t['sport'].strip()}"
    return hashlib.sha1(key.encode()).hexdigest() + "@trical.local"
    

# NEU: über alle Trainings Events bauen
for t in trainings["trainings"]:
    start = dt.datetime.fromisoformat(f"{t['date']}T{t['start_time']}:00").replace(tzinfo=tz)
    end = start + dt.timedelta(minutes=int(t["duration_min"]))  # oder wenn end_time vorhanden: das nutzen

    event = Event()
    event.add("summary", t['title'])
    event.add("dtstart", start)
    event.add("dtend", end)
    if t.get("location"):
        event.add("location", t["location"])
    desc = f"{t['sport']}\n{t.get('note','')}".strip()
    event.add("description", desc)

    #Wichtig für Abo/Updates:
    event.add("uid", make_uid(t))
    event.add("sequence", 0)
    event.add("dtstamp", dt.datetime.now(tz=tz))

    cal.add_component(event)


with open(out_path, "wb") as f:
    f.write(cal.to_ical())
print(f"ICS file written to {out_path}")

