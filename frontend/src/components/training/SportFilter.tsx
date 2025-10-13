import { Button } from "@/components/ui/button";
import { SportType } from "@/types/training";

interface SportFilterProps {
  selectedSport: SportType;
  onSelectSport: (sport: SportType) => void;
  sports?: SportType[];
}

const defaultSports: SportType[] = [
  "All",
  "Run",
  "Bike",
  "Swim",
  "Strength",
  "Other",
];

export function SportFilter({
  selectedSport,
  onSelectSport,
  sports = defaultSports,
}: SportFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-muted-foreground">Filter:</span>
      {sports.map((sport) => (
        <Button
          key={sport}
          variant={selectedSport === sport ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectSport(sport)}
          className="transition-all"
        >
          {sport}
        </Button>
      ))}
    </div>
  );
}
