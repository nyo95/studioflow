"use client";

import { Role } from "@/generated/prisma";
import {
  updateUserRole,
  createUser,
  deleteUser
} from "@/actions/user-actions";
import { Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui_engine";
import { useTransition } from "react";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { Trash2 } from "lucide-react";

export function UserManagement({ 
  allUsers, 
  currentUserId, 
  requesterRole 
}: { 
  allUsers: Array<{ id: string; name: string; email: string; role: Role }>;
  currentUserId: string;
  requesterRole: Role;
}) {
  void requesterRole;
  const [isPending, startTransition] = useTransition();

  async function handleCreateUser(formData: FormData) {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as Role;
    
    startTransition(async () => {
      try {
        unwrapActionResult(await createUser({ name, email, password, role }));
        toast.success("User created successfully");
      } catch {
        toast.error("Failed to create user");
      }
    });
  }

  async function handleRoleChange(targetId: string, newRole: Role) {
    startTransition(async () => {
      try {
        unwrapActionResult(await updateUserRole({ targetUserId: targetId, newRole }));
        toast.success("Role updated");
      } catch {
        toast.error("Failed to update role");
      }
    });
  }

  async function handleDeleteUser(targetId: string, targetName: string) {
    startTransition(async () => {
      try {
        unwrapActionResult(await deleteUser({ targetUserId: targetId }));
        toast.success(`${targetName} removed. Their name stays on past records; re-add the same email to restore access.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        toast.error(
          message.includes("CANNOT_REMOVE_LAST_ADMIN")
            ? "Can't remove the last admin/developer."
            : "Failed to remove user"
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-bold text-slate-950">User Management</h2>
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Studio Roster & Roles</p>
        </div>
        
        <form action={handleCreateUser} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pl-3 shadow-sm">
          <Input 
            name="name" 
            placeholder="New User Name" 
            className="w-40 h-8 text-[11px] border-none focus-visible:ring-0 shadow-none p-0" 
            required 
          />
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <Input
            name="email"
            type="email"
            placeholder="Email"
            className="w-44 h-8 text-[11px] border-none focus-visible:ring-0 shadow-none p-0"
            required
          />
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <Input
            name="password"
            type="password"
            placeholder="Password"
            className="w-32 h-8 text-[11px] border-none focus-visible:ring-0 shadow-none p-0"
            required
          />
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <Select name="role" defaultValue="STAFF">
            <SelectTrigger className="w-24 h-8 text-[9px] uppercase font-black border-none bg-transparent shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN" className="text-[9px] font-bold uppercase tracking-widest">ADMIN</SelectItem>
              <SelectItem value="DEVELOPER" className="text-[9px] font-bold uppercase tracking-widest">DEVELOPER</SelectItem>
              <SelectItem value="DIC" className="text-[9px] font-bold uppercase tracking-widest">DIC</SelectItem>
              <SelectItem value="DRIC" className="text-[9px] font-bold uppercase tracking-widest">DRIC</SelectItem>
              <SelectItem value="STAFF" className="text-[9px] font-bold uppercase tracking-widest">STAFF</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" disabled={isPending} className="bg-slate-900 hover:bg-slate-800 text-white px-4 h-8 rounded-lg font-sans text-[10px] font-bold uppercase tracking-widest">
            {isPending ? "..." : "Add User"}
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        {allUsers.map((user) => (
          <div 
            key={user.id} 
            className="flex items-center justify-between p-2 pl-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <span className="text-[10px] font-bold uppercase tracking-tighter">{user.name.charAt(0)}</span>
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-slate-900">{user.name}</h4>
                <p className="text-[10px] text-slate-500">{user.email}</p>
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{user.id}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {user.id === currentUserId ? (
                <div className="px-3 py-1 bg-slate-900 text-white rounded-full">
                  <span className="text-[9px] font-black uppercase tracking-[0.15em]">You</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Select 
                    defaultValue={user.role} 
                    onValueChange={(val) => handleRoleChange(user.id, val as Role)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-24 h-7 text-[9px] uppercase font-black border-slate-100 bg-slate-50 shadow-none hover:bg-slate-100 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN" className="text-[9px] font-bold uppercase tracking-widest">ADMIN</SelectItem>
                      <SelectItem value="DEVELOPER" className="text-[9px] font-bold uppercase tracking-widest">DEVELOPER</SelectItem>
                      <SelectItem value="DIC" className="text-[9px] font-bold uppercase tracking-widest">DIC</SelectItem>
                      <SelectItem value="DRIC" className="text-[9px] font-bold uppercase tracking-widest">DRIC</SelectItem>
                      <SelectItem value="STAFF" className="text-[9px] font-bold uppercase tracking-widest">STAFF</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDeleteUser(user.id, user.name)}
                    aria-label={`Remove ${user.name}`}
                    title="Remove user"
                    className="h-7 w-7 p-0 text-slate-300 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
