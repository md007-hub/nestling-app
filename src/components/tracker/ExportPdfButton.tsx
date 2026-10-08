import { useState } from "react";
import { Crown, FileText, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePro } from "@/hooks/usePro";
import { useFamily } from "@/hooks/useFamily";
import { exportDoctorPdf } from "@/lib/exportPdf";

export function ExportPdfButton() {
  const { isPro, openUpgrade, watchRewardedAd } = usePro();
  const { baby } = useFamily();
  const [sheet, setSheet] = useState(false);

  const download = async () => {
    try {
      await exportDoctorPdf(baby?.name ?? null);
      toast.success("Report downloaded");
    } catch {
      toast.error("Couldn't create the report");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => (isPro ? void download() : setSheet(true))}
        className="mb-4 h-11 w-full rounded-xl"
      >
        <FileText /> Export Doctor PDF
      </Button>
      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-xl">Export Doctor PDF</DialogTitle>
            <DialogDescription>Choose how you'd like to unlock this report.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                setSheet(false);
                watchRewardedAd(download);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition active:scale-[0.98]"
            >
              <PlayCircle className="h-7 w-7 shrink-0 text-primary" />
              <span>
                <span className="block font-semibold">Watch a quick ad</span>
                <span className="block text-xs text-muted-foreground">Free single export</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSheet(false);
                openUpgrade();
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-primary bg-primary/10 p-4 text-left transition active:scale-[0.98]"
            >
              <Crown className="h-7 w-7 shrink-0 text-primary" />
              <span>
                <span className="block font-semibold">Upgrade to PRO</span>
                <span className="block text-xs text-muted-foreground">Instant unlimited exports</span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
