import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Training } from "@/types/training";
import { useToast } from "@/hooks/use-toast";

interface EditTrainingDialogProps {
  training: Training | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (training: Training) => Promise<void>;
  onDelete?: (training: Training) => Promise<void>;
}

export function EditTrainingDialog({
  training,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: EditTrainingDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Training | null>(training);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update formData when training prop changes
  useEffect(() => {
    if (training) {
      setFormData(training);
    }
  }, [training]);

  const handleSave = async () => {
    if (!formData) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      toast({
        title: "Training updated",
        description: "Your changes have been saved successfully.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save training", error);
      toast({
        title: "Speichern fehlgeschlagen",
        description: "Bitte erneut versuchen. Details siehe Konsole.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!formData || !onDelete || typeof formData.sourceIndex !== "number") {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(formData);
      toast({
        title: "Training gelöscht",
        description: "Der Eintrag wurde entfernt.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete training", error);
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Bitte erneut versuchen. Details siehe Konsole.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Training</DialogTitle>
          <DialogDescription>
            Update your training plan details below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
            />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="time">Start Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.start_time ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sport">Sport</Label>
              <Select
                value={formData.sport}
                onValueChange={(value: Training["sport"]) =>
                  setFormData({ ...formData, sport: value })
                }
              >
                <SelectTrigger id="sport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Run">Run</SelectItem>
                  <SelectItem value="Bike">Bike</SelectItem>
                  <SelectItem value="Swim">Swim</SelectItem>
                  <SelectItem value="Strength">Strength</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="duration">Duration (min)</Label>
              <Input
                id="duration"
                type="number"
                value={
                  typeof formData.duration_min === "number"
                    ? formData.duration_min
                    : ""
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration_min: e.target.value
                      ? Math.max(0, Number(e.target.value))
                      : null,
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location || ""}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={formData.note || ""}
              onChange={(e) =>
                setFormData({ ...formData, note: e.target.value })
              }
              rows={3}
              placeholder="Training notes, zones, focus points..."
            />
          </div>

          <div className="flex items-center justify-between space-x-2 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="alarm">Use Default Alarm</Label>
              <p className="text-sm text-muted-foreground">
                Set a reminder notification for this training
              </p>
            </div>
            <Switch
              id="alarm"
              checked={Boolean(formData.use_default_alarm)}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, use_default_alarm: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between space-x-2 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="completed">Completed</Label>
              <p className="text-sm text-muted-foreground">
                Mark this training as completed
              </p>
            </div>
            <Switch
              id="completed"
              checked={Boolean(formData.completed)}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, completed: checked })
              }
            />
          </div>

          {formData.matched_activity_id && (
            <div className="grid gap-2 p-4 rounded-lg bg-muted">
              <h4 className="font-semibold text-sm">Strava Match Info</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <Label className="text-muted-foreground">Activity ID</Label>
                  <p className="font-mono">{formData.matched_activity_id}</p>
                </div>
                {formData.match_score !== null && (
                  <div>
                    <Label className="text-muted-foreground">Match Score</Label>
                    <p>{(formData.match_score * 100).toFixed(0)}%</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {onDelete && typeof formData.sourceIndex === "number" && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          )}
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isDeleting}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isDeleting}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
