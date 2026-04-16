"use client";

import { useState, useEffect } from "react";
import { 
  Database, 
  Download, 
  Plus, 
  RotateCcw, 
  Trash2, 
  AlertTriangle,
  FileJson,
  Calendar,
  HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  createBackupAction, 
  listBackupsAction, 
  restoreBackupAction, 
  deleteBackupAction 
} from "@/actions/database-actions";
import { unwrapActionResult } from "@/lib/result";
import { format } from "date-fns";
import { 
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Backup {
  name: string;
  size: number;
  createdAt: Date;
}

export function DatabaseSettingsPanel() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = unwrapActionResult(await listBackupsAction(null));
      setBackups(res.backups);
    } catch (err) {
      toast.error("Failed to load backups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const res = unwrapActionResult(await createBackupAction(null));
      toast.success(`Backup created: ${res.fileName}`);
      fetchBackups();
    } catch (err: any) {
      toast.error(err.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    try {
      unwrapActionResult(await deleteBackupAction({ fileName }));
      toast.success("Backup deleted");
      fetchBackups();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete backup");
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    
    try {
      setRestoring(true);
      toast.info(`Restoring database from ${selectedBackup}...`);
      unwrapActionResult(await restoreBackupAction({ fileName: selectedBackup }));
      toast.success("Database restored successfully. Refreshing page...");
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to restore database");
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
      setSelectedBackup(null);
    }
  };

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm md:col-span-2">
          <CardHeader className="border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-serif text-xl font-bold text-slate-900">Available Backups</CardTitle>
                <CardDescription>View and manage your database snapshots.</CardDescription>
              </div>
              <Button 
                onClick={handleCreateBackup} 
                disabled={creating || loading}
                className="rounded-xl bg-slate-900 text-xs font-semibold"
              >
                {creating ? "Creating..." : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    New Backup
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-slate-400">Loading backups...</div>
            ) : backups.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center space-y-2 text-slate-400">
                <Database className="h-8 w-8 opacity-20" />
                <p className="text-sm">No backups found.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {backups.map((backup) => (
                  <div key={backup.name} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <FileJson className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{backup.name}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(backup.createdAt), "MMM d, yyyy HH:mm")}
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {formatSize(backup.size)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                        onClick={() => {
                          setSelectedBackup(backup.name);
                          setConfirmRestore(true);
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => handleDeleteBackup(backup.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-900 text-white shadow-lg shadow-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Safety Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-300">
              Database backups are stored locally on the server. They capture the entire state of your studio including projects, materials, and settings.
            </p>
            <div className="space-y-2 rounded-xl bg-white/5 p-4 text-[10px] text-slate-400 border border-white/10">
              <strong className="block font-bold uppercase tracking-widest text-white/50">Restoration Policy</strong>
              Restoring a backup will <span className="text-amber-400 font-bold underline">completely replace</span> the current database. All changes made since the selected backup will be lost.
            </div>
          </CardContent>
          <CardFooter>
             <p className="text-[10px] text-slate-500 italic">
               System Version: Pillar 2 SSOT Ready
             </p>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent className="rounded-2xl border-slate-200 bg-white shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-bold text-slate-900">
              Restore Database?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              You are about to restore the database to the state captured in <span className="font-bold text-slate-900">{selectedBackup}</span>. 
              This is a destructive operation and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleRestore();
              }}
              disabled={restoring}
              className="rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {restoring ? "Restoring..." : "Yes, Restore Database"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

