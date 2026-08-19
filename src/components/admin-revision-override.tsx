"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { overrideRevision } from "@/actions/phase-actions";
import { unwrapActionResult } from "@/lib/result";
import { Button, Input, Label, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui_engine";

interface AdminRevisionOverrideProps {
  phaseId: string;
  currentVersion: {
    major: number;
    minor: number;
  };
}

type OverrideMode = "HARD_RESET_ACTIVE" | "HARD_RESET_PENDING";

export function AdminRevisionOverride({
  phaseId,
  currentVersion,
}: AdminRevisionOverrideProps) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<OverrideMode>("HARD_RESET_ACTIVE");
  const [major, setMajor] = useState(String(currentVersion.major + 1));
  const [minor, setMinor] = useState("0");
  const [confirmed, setConfirmed] = useState(false);

  const parsedMajor = Number(major);
  const parsedMinor = Number(minor);

  const canSubmit =
    confirmed &&
    (mode === "HARD_RESET_PENDING" || 
      (Number.isInteger(parsedMajor) && parsedMajor >= 0 && Number.isInteger(parsedMinor) && parsedMinor >= 0));

  function handleOverride() {
    startTransition(async () => {
      try {
        unwrapActionResult(
          await overrideRevision({
            phaseId,
            targetMajorVersion: mode === "HARD_RESET_ACTIVE" ? parsedMajor : undefined,
            targetMinorVersion: mode === "HARD_RESET_ACTIVE" ? parsedMinor : undefined,
            mode,
            note: "Hard Reset by Admin",
          })
        );
        toast.success(
          mode === "HARD_RESET_ACTIVE" 
            ? `Phase reset to new revision v${parsedMajor}.${parsedMinor}`
            : "Phase reverted to Pending state."
        );
        setIsOpen(false);
        setConfirmed(false);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to override revision.");
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => setIsOpen(true)}
        className="h-8 border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
      >
        {isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
        )}
        Admin Override
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Admin Revision Override</DialogTitle>
            </div>
            <DialogDescription>
              Advanced administrative tools to manually adjust phase versions or reset state.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mode} onValueChange={(v) => setMode(v as OverrideMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="HARD_RESET_ACTIVE" className="text-[10px] uppercase tracking-tighter">Reset to Revision</TabsTrigger>
              <TabsTrigger value="HARD_RESET_PENDING" className="text-[10px] uppercase tracking-tighter">Reset to Pending</TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-6">
              {/* Context Summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <div className="text-slate-500 mb-1">Current Active State:</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-lg font-black text-slate-900">v{currentVersion.major}.{currentVersion.minor}</span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest bg-slate-200/50 px-1.5 py-0.5 rounded">Active</span>
                </div>
              </div>

              {/* Version Inputs - Only when ACTIVE */}
              {mode === "HARD_RESET_ACTIVE" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="override-major" className="text-xs font-bold text-slate-600">Target Major</Label>
                    <Input
                      id="override-major"
                      type="number"
                      min="0"
                      className="h-12 text-lg font-serif"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="override-minor" className="text-xs font-bold text-slate-600">Target Minor</Label>
                    <Input
                      id="override-minor"
                      type="number"
                      min="0"
                      className="h-12 text-lg font-serif"
                      value={minor}
                      onChange={(e) => setMinor(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Warning/Confirmation */}
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-red-50 p-4">
                  <div className="flex gap-3">
                    <Checkbox id="confirm-override" checked={confirmed} onCheckedChange={(c) => setConfirmed(!!c)} className="mt-0.5 border-amber-400 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600" />
                    <div className="space-y-1">
                      <Label htmlFor="confirm-override" className="text-sm font-semibold text-red-900 leading-tight">Confirm Destructive Reset</Label>
                      <p className="text-xs text-red-800/80 leading-relaxed">
                        This is a destructive action. Existing activities, files, and discussions for this phase will be permanently wiped out. {mode === "HARD_RESET_PENDING" && "The phase status will be reverted backwards to Pending."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs>

          <DialogFooter className="mt-8 border-t pt-6">
            <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleOverride}
              disabled={!canSubmit || isPending}
              className="min-w-[140px] transition-all bg-red-600 hover:bg-red-700"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Execute Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
