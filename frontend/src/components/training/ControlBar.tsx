import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PlayCircle, RefreshCw, Upload, GitCommit, LucideIcon, Plus } from "lucide-react";

type ActionKey = "get-strava" | "sync-strava" | "export" | "commit";

interface ActionConfig {
  key: ActionKey;
  label: string;
  icon: LucideIcon;
  successTitle: string;
  successDescription?: string;
}

interface ControlBarProps {
  onCreate?: () => void;
  disableCreate?: boolean;
}

const ACTIONS: ActionConfig[] = [
  {
    key: "get-strava",
    label: "Get Strava",
    icon: PlayCircle,
    successTitle: "Strava-Aktivitäten aktualisiert",
    successDescription: "Die Exportdatei wurde neu erstellt.",
  },
  {
    key: "sync-strava",
    label: "Sync",
    icon: RefreshCw,
    successTitle: "Trainings synchronisiert",
    successDescription: "Trainingsplan wurde mit Strava-Aktivitäten abgeglichen.",
  },
  {
    key: "export",
    label: "Export",
    icon: Upload,
    successTitle: "ICS exportiert",
    successDescription: "Kalenderdatei steht als tritrainings.ics bereit.",
  },
  {
    key: "commit",
    label: "Commit",
    icon: GitCommit,
    successTitle: "Änderungen committed",
    successDescription: "auto_commit.sh wurde ausgeführt.",
  },
];

const buildEndpoint = (path: string) => {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
  const clean = path.replace(/^\/+/, "");
  return `${base}/${clean}`;
};

const extractPreviewLine = (text: string | undefined) => {
  if (!text) {
    return undefined;
  }
  const line = text.trim().split(/\r?\n/).find(Boolean);
  return line;
};

export function ControlBar({ onCreate, disableCreate }: ControlBarProps) {
  const { toast } = useToast();
  const [runningAction, setRunningAction] = useState<ActionKey | null>(null);

  const triggerAction = async (config: ActionConfig) => {
    if (runningAction) {
      return;
    }

    setRunningAction(config.key);
    try {
      const response = await fetch(buildEndpoint(`api/actions/${config.key}`), {
        method: "POST",
      });

      const data: { success?: boolean; output?: string; error?: string } | undefined =
        await response
          .json()
          .catch(() => ({ success: false, error: "Antwort konnte nicht gelesen werden." }));

      if (!response.ok || !data?.success) {
        const detail = data?.error || (await response.text());
        throw new Error(detail || "Aktion fehlgeschlagen.");
      }

      toast({
        title: config.successTitle,
        description: extractPreviewLine(data.output) ?? config.successDescription,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Aktion konnte nicht ausgeführt werden.";
      toast({
        title: "Fehler",
        description: message,
        variant: "destructive",
      });
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-gradient-hero shadow-card backdrop-blur-sm border-b border-border/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-white">Training Calendar</h1>

          <div className="flex items-center gap-2 flex-wrap">
            {onCreate && (
              <Button
                variant="default"
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={onCreate}
                disabled={Boolean(disableCreate)}
              >
                <Plus className="h-4 w-4" />
                Neues Training
              </Button>
            )}

            {ACTIONS.map((action) => {
              const Icon = action.icon;
              const isRunning = runningAction === action.key;
              return (
                <Button
                  key={action.key}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20 disabled:opacity-50"
                  onClick={() => triggerAction(action)}
                  disabled={isRunning}
                >
                  <Icon className="h-4 w-4" />
                  {isRunning ? "Running…" : action.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
