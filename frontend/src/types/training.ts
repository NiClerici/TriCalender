export interface ActualData {
  activity_id: number;
  title?: string | null;
  sport_type?: string | null;
  start_time_local?: string | null;
  elapsed_time_min?: number | null;
  moving_time_min?: number | null;
  duration_min?: number | null;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
  pace_min_per_km?: number | null;
  pace_min_per_km_str?: string | null;
  pace?: string | null;
  power?: number | null;
  avg_hr_bpm?: number | null;
  max_hr_bpm?: number | null;
  avg_cadence_spm?: number | null;
  calories?: number | null;
  link?: string | null;
}

export interface Training {
  id: string;
  date: string;
  start_time: string;
  duration_min?: number | null;
  sport: string;
  title: string;
  note?: string;
  location?: string;
  use_default_alarm?: boolean;
  completed: boolean;
  matched_activity_id?: number | null;
  match_score?: number | null;
  actual?: ActualData | null;
  sourceIndex?: number;
}

export type SportType = Training["sport"] | "All";
