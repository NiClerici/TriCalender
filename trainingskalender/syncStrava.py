import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

TRAININGS_PATH = Path(__file__).parent / "trainings.json"
STRAVA_EXPORT_PATH = Path(__file__).parent / "exportStravaTraining.json"

SPORT_MAP = {
    "run": {"run", "trailrun"},
    "bike": {"ride", "virtualride", "gravelride"},
    "swim": {"swim"},
    "workout": {"workout", "weighttraining", "crossfit"},
}

DURATION_TOLERANCE_FRAC = 0.40  # 40 %
DURATION_TOLERANCE_MIN = 10     # 10 Minuten absolute Toleranz
DATE_TOLERANCE_DAYS = 1
DATE_FMT = "%Y-%m-%d"
TIME_FMT = "%H:%M"


def load_trainings() -> List[Dict[str, Any]]:
    with TRAININGS_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data.get("trainings", [])


def save_trainings(trainings: Iterable[Dict[str, Any]]) -> None:
    payload = {"trainings": list(trainings)}
    with TRAININGS_PATH.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def load_strava_export() -> List[Dict[str, Any]]:
    with STRAVA_EXPORT_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _build_summary_line(sport: str, actual: dict) -> str:
    sport_lower = sport.lower()
    distance = actual.get("distance_km")
    pace_run = actual.get("pace_min_per_km_str")
    pace_swim = actual.get("pace_per_100m_str")
    moving_min = actual.get("moving_time_min")
    elapsed_min = actual.get("elapsed_time_min")

    parts: List[str] = []

    if distance is not None:
        parts.append(f"Strecke: {distance:.1f} km")

    if sport_lower == "run" and pace_run:
        parts.append(f"Pace: {pace_run}/km")
    elif sport_lower == "swim" and pace_swim:
        parts.append(f"Pace: {pace_swim} /100m")
    else:
        if distance is not None and moving_min:
            speed = distance / (moving_min / 60)
            parts.append(f"Geschwindigkeit: {speed:.1f} km/h")

    duration = moving_min or elapsed_min
    if duration:
        parts.append(f"Dauer: {duration:.0f} min")

    summary = "\n".join(parts) if parts else "keine Daten"
    return f"{summary}"


def build_strava_block(workout: dict, actual: dict) -> str:
    sport = workout.get("sport", "").lower()
    lines = ["Strava Summary:"]

    lines.append(_build_summary_line(sport, actual))

    avg_hr = actual.get("avg_hr_bpm")
    max_hr = actual.get("max_hr_bpm")
    if avg_hr or max_hr:
        hr_avg = f"{avg_hr:.0f}" if avg_hr is not None else "–"
        hr_max = f"{max_hr:.0f}" if max_hr is not None else "–"
        lines.append(f"HF Ø/Max {hr_avg}/{hr_max} bpm")

    elevation = actual.get("elevation_gain_m")
    if elevation:
        lines.append(f"Höhenmeter {elevation:.0f} m")

    if sport == "run":
        cadence = actual.get("avg_cadence_spm")
        if cadence:
            lines.append(f"Kadenz {cadence:.0f} spm")
    elif sport == "bike":
        avg_watts = actual.get("avg_watts")
        max_watts = actual.get("max_watts")
        if avg_watts or max_watts:
            watt_avg = f"{avg_watts:.0f}" if avg_watts is not None else "–"
            watt_max = f"{max_watts:.0f}" if max_watts is not None else "–"
            lines.append(f"Leistung Ø/Max {watt_avg}/{watt_max} W")
        cadence = actual.get("avg_cadence_rpm")
        if cadence:
            lines.append(f"Kadenz {cadence:.0f} rpm")
    elif sport == "swim":
        pace_swim = actual.get("pace_per_100m_str")
        if pace_swim:
            lines.append(f"Pace {pace_swim} /100m")
    else:
        cadence_raw = actual.get("avg_cadence_raw")
        if cadence_raw:
            lines.append(f"Kadenz {cadence_raw:.0f}")

    activity_id = actual.get("activity_id")
    if activity_id:
        lines.append(f"Strava Link: https://www.strava.com/activities/{activity_id}")

    return "\n".join(lines)


def merge_plan_and_strava(plan_note: str, strava_block: str) -> str:
    plan_part = plan_note.split("\nStrava:", 1)[0].rstrip()
    if plan_part:
        return f"{plan_part}\n\n{strava_block}"
    return strava_block


def _parse_plan_datetime(workout: dict) -> datetime:
    plan_date = datetime.strptime(workout["date"], DATE_FMT)
    start_time = datetime.strptime(workout.get("start_time", "00:00"), TIME_FMT).time()
    return datetime.combine(plan_date.date(), start_time)


def _parse_strava_datetime(activity: dict) -> datetime:
    strava_dt = datetime.fromisoformat(activity["start_time_local"].replace("Z", "+00:00"))
    return strava_dt.replace(tzinfo=None)


def _sport_matches(workout: dict, activity: dict) -> bool:
    plan_sport = workout.get("sport", "").lower()
    act_sport = activity.get("sport_type", "").lower()
    allowed = SPORT_MAP.get(plan_sport, {plan_sport})
    return act_sport in allowed


def _duration_matches(workout: dict, activity: dict) -> Optional[float]:
    plan_duration = workout.get("duration_min")
    act_duration = activity.get("moving_time_min") or activity.get("elapsed_time_min")
    if plan_duration is None or act_duration is None:
        return None

    diff = abs(plan_duration - act_duration)
    if diff <= DURATION_TOLERANCE_MIN:
        return diff / plan_duration

    if plan_duration <= 0:
        return None

    frac = diff / plan_duration
    return frac if frac <= DURATION_TOLERANCE_FRAC else None


def _compute_match_score(plan_dt: datetime, act_dt: datetime, duration_frac: Optional[float]) -> float:
    date_penalty = abs((plan_dt.date() - act_dt.date()).days)
    time_penalty = abs((plan_dt - act_dt).total_seconds()) / 3600  # Stunden
    duration_penalty = duration_frac if duration_frac is not None else 0.0
    return date_penalty * 3 + time_penalty * 1.5 + duration_penalty * 4


def find_best_match(workout: dict, activities: List[dict], used_ids: set[int]) -> Optional[Dict[str, Any]]:
    plan_dt = _parse_plan_datetime(workout)
    candidates: List[tuple[float, dict]] = []

    for activity in activities:
        if activity["activity_id"] in used_ids:
            continue
        if not _sport_matches(workout, activity):
            continue

        act_dt = _parse_strava_datetime(activity)
        if abs((plan_dt.date() - act_dt.date()).days) > DATE_TOLERANCE_DAYS:
            continue

        duration_frac = _duration_matches(workout, activity)
        if duration_frac is None:
            continue

        score = _compute_match_score(plan_dt, act_dt, duration_frac)
        candidates.append((score, activity))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


def main() -> None:
    trainings = load_trainings()
    strava_raw = load_strava_export()

    used_ids = {w.get("matched_activity_id") for w in trainings if w.get("matched_activity_id")}

    for workout in trainings:
        if workout.get("completed"):
            continue

        plan_note = workout.get("note", "")
        match = find_best_match(workout, strava_raw, used_ids)
        if not match:
            continue

        print(
            "Matched plan {date} {sport} – {title} mit Strava #{activity_id} ({strava_title}).".format(
                date=workout["date"],
                sport=workout.get("sport", ""),
                title=workout.get("title", ""),
                activity_id=match["activity_id"],
                strava_title=match.get("title", ""),
            )
        )

        strava_block = build_strava_block(workout, match)
        workout["note"] = merge_plan_and_strava(plan_note, strava_block)
        workout["completed"] = True
        workout["matched_activity_id"] = match["activity_id"]
        workout["actual"] = match
        duration_frac = _duration_matches(workout, match)
        plan_dt = _parse_plan_datetime(workout)
        act_dt = _parse_strava_datetime(match)
        workout["match_score"] = round(_compute_match_score(plan_dt, act_dt, duration_frac), 3)
        used_ids.add(match["activity_id"])

    save_trainings(trainings)
    print(f"Updated {len(trainings)} trainings with Strava data where applicable.")


if __name__ == "__main__":
    main()
