import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateNote, type LogEntry } from "@/lib/db";

const TAGS = ["Doctor", "Medicine", "Symptom", "General"] as const;
type NoteTag = (typeof TAGS)[number];

function splitNote(value: string): { tag: NoteTag; text: string } {
  const tag = TAGS.find((item) => value.startsWith(`${item}: `));
  return tag
    ? { tag, text: value.slice(tag.length + 2) }
    : { tag: "General", text: value };
}

export function NoteDialog({
  note,
  open,
  onOpenChange,
}: {
  note: LogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tag, setTag] = useState<NoteTag>("General");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!note || !open) return;
    const parsed = splitNote(note.value);
    setTag(parsed.tag);
    setText(parsed.text);
    setEditing(false);
  }, [note?.uid, open]);

  const save = async () => {
    if (!note || saving) return;
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Write a short note first");
      return;
    }
    if (trimmed.length > 300) {
      toast.error("Notes can contain up to 300 characters");
      return;
    }

    setSaving(true);
    try {
      await updateNote(note.uid, `${tag}: ${trimmed}`);
      toast.success("Note updated");
      setEditing(false);
      onOpenChange(false);
    } catch {
      toast.error("Could not update note");
    } finally {
      setSaving(false);
    }
  };

  if (!note) return null;

  const original = splitNote(note.value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl border-border bg-background p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <StickyNote className="h-5 w-5 text-rose-500" />
            Note
          </DialogTitle>
          <DialogDescription className="text-left">
            {new Date(note.timestamp).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Note category">
              {TAGS.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={tag === item ? "default" : "outline"}
                  aria-pressed={tag === item}
                  onClick={() => setTag(item)}
                  className="min-h-11 rounded-xl"
                >
                  {item}
                </Button>
              ))}
            </div>
            <textarea
              aria-label="Edit note"
              maxLength={300}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-36 w-full resize-none rounded-xl border border-input bg-card p-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setEditing(false)}
                className="min-h-11 flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="min-h-11 flex-1 rounded-xl"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-medium">
              {original.tag}
            </div>
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed">
              {original.text}
            </p>
            <Button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-11 w-full rounded-xl"
            >
              Edit Note
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
