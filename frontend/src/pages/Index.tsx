import { useEffect, useMemo, useState } from "react";
import { Training, SportType } from "@/types/training";
import { ControlBar } from "@/components/training/ControlBar";
import { SportFilter } from "@/components/training/SportFilter";
import { TrainingCard } from "@/components/training/TrainingCard";
import { EditTrainingDialog } from "@/components/training/EditTrainingDialog";
import { getWeek, startOfWeek, format } from "date-fns";

interface TrainingsResponse {
  trainings?: RawTraining[];
}

interface RawActualData {
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
  avg_hr_bpm?: number | null;
  max_hr_bpm?: number | null;
  avg_cadence_spm?: number | null;
  calories?: number | null;
}

interface RawTraining {
  date: string;
  start_time?: string | null;
  duration_min?: number | null;
  sport?: string | null;
  title: string;
  note?: string | null;
  location?: string | null;
  use_default_alarm?: boolean;
  completed?: boolean;
  matched_activity_id?: number | null;
  match_score?: number | null;
  actual?: RawActualData | null;
}

const buildEndpoint = (path: string) => {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${base}/${cleanPath}`;
};

const mapTraining = (raw: RawTraining, index: number): Training => {
  const startTime = raw.start_time ?? "00:00";
  const matchedId = raw.matched_activity_id ?? null;
  const actual = raw.actual
    ? {
        ...raw.actual,
        duration_min:
          raw.actual.duration_min ?? raw.actual.elapsed_time_min ?? null,
        pace: raw.actual.pace_min_per_km_str ?? null,
        link: raw.actual.activity_id
          ? `https://www.strava.com/activities/${raw.actual.activity_id}`
          : null,
      }
    : null;

  return {
    id:
      matchedId !== null && matchedId !== undefined
        ? String(matchedId)
        : `${raw.date}-${startTime}-${index}`,
    date: raw.date,
    start_time: startTime,
    duration_min: raw.duration_min ?? null,
    sport: raw.sport ?? "Other",
    title: raw.title ?? "Untitled Training",
    note: raw.note ?? undefined,
    location: raw.location ?? undefined,
    use_default_alarm: raw.use_default_alarm,
    completed: Boolean(raw.completed),
    matched_activity_id: matchedId,
    match_score: raw.match_score ?? null,
    actual,
    sourceIndex: index,
  };
};

const Index = () => {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedSport, setSelectedSport] = useState<SportType>("All");
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadTrainings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          buildEndpoint("trainingskalender/trainings.json"),
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }

        const payload: TrainingsResponse = await response.json();
        const items = Array.isArray(payload?.trainings)
          ? payload.trainings
          : [];
        const mapped = items
          .filter((raw): raw is RawTraining => Boolean(raw?.date && raw?.title))
          .map((raw, index) => mapTraining(raw, index));

        setTrainings(mapped);
        setLoadError(null);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        console.error("Failed to load trainings.json", error);
        setLoadError("Konnte Trainingsdaten nicht laden");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTrainings();

    return () => controller.abort();
  }, []);

  const availableSports = useMemo<SportType[]>(() => {
    const sports = new Set<string>();
    trainings.forEach((training) => {
      if (training.sport) {
        sports.add(training.sport);
      }
    });

    return ["All", ...Array.from(sports).sort()];
  }, [trainings]);

  // Filter trainings by sport
  const filteredTrainings = trainings.filter(
    (training) => selectedSport === "All" || training.sport === selectedSport
  );

  // Group trainings by week
  const trainingsByWeek = filteredTrainings.reduce((acc, training) => {
    const date = new Date(training.date);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekKey = format(weekStart, "yyyy-MM-dd");
    const weekNumber = getWeek(date, { weekStartsOn: 1 });
    const year = date.getFullYear();
    
    if (!acc[weekKey]) {
      acc[weekKey] = {
        weekNumber,
        year,
        weekStart,
        trainings: [],
      };
    }
    
    acc[weekKey].trainings.push(training);
    return acc;
  }, {} as Record<string, { weekNumber: number; year: number; weekStart: Date; trainings: Training[] }>);

  // Sort weeks chronologically
  const sortedWeeks = Object.entries(trainingsByWeek).sort(
    ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
  );

  const handleEdit = (training: Training) => {
    setEditingTraining(training);
    setDialogOpen(true);
  };

  const handleSave = async (updatedTraining: Training) => {
    const sourceIndex = updatedTraining.sourceIndex;
    if (typeof sourceIndex !== "number" || Number.isNaN(sourceIndex)) {
      throw new Error("Training source index is missing.");
    }

    const response = await fetch(buildEndpoint("api/trainings"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ training: updatedTraining }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Failed to save training.");
    }

    const result = (await response.json()) as {
      success: boolean;
      training: RawTraining;
      index: number;
      error?: string;
    };

    if (!result?.success) {
      throw new Error(result?.error || "Failed to save training.");
    }

    const mapped = mapTraining(result.training, result.index);

    setTrainings((prev) =>
      prev.map((training) =>
        training.sourceIndex === mapped.sourceIndex ? mapped : training
      )
    );
    setLoadError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <ControlBar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <SportFilter
            selectedSport={selectedSport}
            sports={availableSports}
            onSelectSport={setSelectedSport}
          />
        </div>

        <div className="space-y-8">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">Lade Trainings…</p>
            </div>
          ) : sortedWeeks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No trainings found for the selected filter.</p>
            </div>
          ) : (
            sortedWeeks.map(([weekKey, { weekNumber, year, weekStart, trainings }]) => (
              <div key={weekKey} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-primary" />
                  <h2 className="text-xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                    Week {weekNumber}, {year}
                  </h2>
                  <div className="h-px flex-1 bg-gradient-secondary" />
                </div>
                
                <p className="text-sm text-muted-foreground text-center">
                  Starting {format(weekStart, "MMMM d, yyyy")}
                </p>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {trainings
                    .sort(
                      (a, b) =>
                        new Date(a.date + "T" + a.start_time).getTime() -
                        new Date(b.date + "T" + b.start_time).getTime()
                    )
                    .map((training) => (
                      <TrainingCard
                        key={training.id}
                        training={training}
                        onEdit={handleEdit}
                      />
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <EditTrainingDialog
        training={editingTraining}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
      />
      {loadError && (
        <div className="fixed bottom-4 right-4 text-sm text-muted-foreground bg-background/90 border border-border px-4 py-2 rounded-md shadow-sm">
          {loadError}
        </div>
      )}
    </div>
  );
};

export default Index;
