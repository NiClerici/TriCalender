import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Training } from "@/types/training";
import { Clock, MapPin, Edit2, CheckCircle2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface TrainingCardProps {
  training: Training;
  onEdit: (training: Training) => void;
}

const sportColors: Record<string, string> = {
  Run: "bg-primary text-primary-foreground",
  Bike: "bg-secondary text-secondary-foreground",
  Swim: "bg-accent text-accent-foreground",
  Strength: "bg-destructive text-destructive-foreground",
  Other: "bg-muted text-muted-foreground",
};

export function TrainingCard({ training, onEdit }: TrainingCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const startTime = training.start_time ?? "00:00";
  const dateObj = new Date(`${training.date}T${startTime}`);
  const displayDate = format(dateObj, "EEE, MMM d");
  const displayTime = format(dateObj, "HH:mm");
  const plannedDuration =
    typeof training.duration_min === "number"
      ? `${Math.round(training.duration_min)} min`
      : "—";

  const actualDuration =
    training.actual?.duration_min ?? training.actual?.elapsed_time_min ?? null;
  const actualDistance = training.actual?.distance_km ?? null;
  const actualPace =
    training.actual?.pace ?? training.actual?.pace_min_per_km_str ?? null;
  const actualAvgHr = training.actual?.avg_hr_bpm ?? null;
  const actualLink =
    training.actual?.link ??
    (training.actual?.activity_id
      ? `https://www.strava.com/activities/${training.actual.activity_id}`
      : null);

  const formatPace = (value: string | null) => {
    if (!value) {
      return null;
    }
    return value.includes("/") ? value : `${value}/km`;
  };

  const actualMetrics = [
    actualDuration !== null && actualDuration !== undefined
      ? `${Math.round(actualDuration)} min`
      : null,
    actualDistance !== null && actualDistance !== undefined
      ? `${actualDistance.toFixed(1)} km`
      : null,
    formatPace(actualPace),
    actualAvgHr !== null && actualAvgHr !== undefined
      ? `Ø ${Math.round(actualAvgHr)} bpm`
      : null,
  ].filter(Boolean);

  return (
    <Card
      className="transition-all duration-300 hover:shadow-hover cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={sportColors[training.sport] ?? sportColors.Other}>
                {training.sport}
              </Badge>
              {training.completed && (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Completed
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{training.title}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(training)}
            className={`transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>
              {displayDate} at {displayTime}
            </span>
          </div>
          <span className="font-medium">{plannedDuration}</span>
        </div>

        {training.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{training.location}</span>
          </div>
        )}

        {training.note && (
          <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
            {training.note}
          </p>
        )}

        {training.actual && training.completed && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-sm font-semibold mb-2 text-success">Actual Performance</h4>
            <div className="space-y-1 text-sm">
              {training.actual.title && (
                <p className="font-medium">{training.actual.title}</p>
              )}
              {(actualMetrics.length > 0 || training.actual?.power) && (
                <div className="flex flex-wrap gap-3 text-muted-foreground">
                  {actualMetrics.map((metric) => (
                    <span key={metric}>{metric}</span>
                  ))}
                  {typeof training.actual?.power === "number" && (
                    <span>Power: {training.actual.power} W</span>
                  )}
                </div>
              )}
              {actualLink && (
                <a
                  href={actualLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline text-xs mt-1"
                >
                  View on Strava <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {training.match_score !== null && training.match_score !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  Match score: {(training.match_score * 100).toFixed(0)}%
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
