import os
import json
import time
import datetime as dt
import requests
from pathlib import Path
from dotenv import load_dotenv

# ==== Konfig ====
load_dotenv()
CLIENT_ID = os.environ["CLIENT_ID"]
CLIENT_SECRET = os.environ["CLIENT_SECRET"]
REFRESH_TOKEN = os.environ["REFRESH_TOKEN"]

EXPORT_PATH = Path(__file__).parent / "exportStravaTraining.json"
days_back = 10 # wie viele Tage zurück sollen Aktivitäten geprüft werden
after_ts = int((dt.datetime.utcnow() - dt.timedelta(days = days_back)).timestamp())

# ==== Helpers ====
def safe_div(a, b):
    return a / b if (b and b != 0) else None

def fmt_minsec(total_minutes: float | None) -> str | None:
    if total_minutes is None:
        return None
    total_seconds = int(round(total_minutes * 60))
    m, s = divmod(total_seconds, 60)
    return f"{m}:{s:02d}"

def refresh_access_token() -> str:
    resp = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": REFRESH_TOKEN,
        },
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["access_token"]

def fetch_recent_activities(access_token, after_ts, per_page=50):
    activities = []
    page = 1
    while True:
        resp = requests.get(
        "https://www.strava.com/api/v3/athlete/activities",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"per_page": per_page, 
                "page": page,
                "after": after_ts},
        timeout=20,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break

        activities.extend(batch)
        page += 1
        time.sleep(1)  # Rate limit beachten
    return activities

def transform_activity(activity: dict) -> dict:
    sport_type = activity["type"]

    base = {
        "activity_id": activity["id"],
        "title": activity.get("name"),
        "sport_type": sport_type,
        "start_time_local": activity.get("start_date_local"),
        "elapsed_time_min": safe_div(activity.get("elapsed_time"), 60),
        "calories": activity.get("calories"),
    }

    distance_m = activity.get("distance")
    moving_time_s = activity.get("moving_time")
    avg_speed_ms = activity.get("average_speed")
    elevation_m = activity.get("total_elevation_gain")
    avg_hr = activity.get("average_heartrate")
    max_hr = activity.get("max_heartrate")
    avg_cadence = activity.get("average_cadence")

    out = dict(base)
    out["distance_km"] = safe_div(distance_m, 1000)
    out["moving_time_min"] = safe_div(moving_time_s, 60)
    out["elevation_gain_m"] = elevation_m

    if sport_type == "Run":
        pace_min_km = safe_div(1000, avg_speed_ms)
        pace_min_km = safe_div(pace_min_km, 60)
        run_steps_per_min = avg_cadence * 2 if avg_cadence is not None else None
        out.update({
            "pace_min_per_km": pace_min_km,
            "pace_min_per_km_str": fmt_minsec(pace_min_km),
            "avg_hr_bpm": avg_hr,
            "max_hr_bpm": max_hr,
            "avg_cadence_spm": run_steps_per_min,
        })

    elif sport_type == "Ride":
        out.update({
            "avg_watts": activity.get("average_watts"),
            "max_watts": activity.get("max_watts"),
            "avg_hr_bpm": avg_hr,
            "max_hr_bpm": max_hr,
            "avg_cadence_rpm": avg_cadence,
        })

    elif sport_type == "Swim":
        pace_sec_100m = safe_div(100, avg_speed_ms) if avg_speed_ms else None
        pace_min_100m = safe_div(pace_sec_100m, 60) if pace_sec_100m else None
        out.update({
            "pace_sec_per_100m": pace_sec_100m,
            "pace_per_100m_str": fmt_minsec(pace_min_100m) if pace_min_100m is not None else None,
            "avg_hr_bpm": avg_hr,
            "max_hr_bpm": max_hr,
        })

    else:
        out.update({
            "avg_hr_bpm": avg_hr,
            "max_hr_bpm": max_hr,
            "avg_cadence_raw": avg_cadence,
        })

    return out
    

# ==== Main ====
if __name__ == "__main__":
    token = refresh_access_token()
    raw_activities = fetch_recent_activities(token, after_ts)
    transformed = [transform_activity(act) for act in raw_activities]


    # Saubere JSON-Ausgabe (nur relevante Felder)
    with EXPORT_PATH.open("w", encoding="utf-8") as f:
        json.dump(transformed, f, ensure_ascii=False, indent=2)
    print(f"Latest activity data written to {EXPORT_PATH}")
    print(f"Wrote {len(transformed)} activities to {EXPORT_PATH}")
