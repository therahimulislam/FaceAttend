import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { User, Lock, Bell, Shield, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import api from "@/services/api";

// ── Change Password Section ────────────────────────────────────────────────────
function ChangePasswordForm() {
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showCur,    setShowCur]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [localError, setLocalError] = useState("");
  const [success,    setSuccess]    = useState(false);

  const changePw = useMutation({
    mutationFn: (payload: { current_password: string; new_password: string }) =>
      api.post("/auth/change-password/", payload),
    onSuccess: () => {
      setSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setLocalError("");
      setTimeout(() => setSuccess(false), 4000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? "Failed to change password.";
      setLocalError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(""); setSuccess(false);
    if (newPw.length < 8) { setLocalError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setLocalError("New passwords do not match."); return; }
    changePw.mutate({ current_password: currentPw, new_password: newPw });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Current Password */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">Current Password</Label>
        <div className="relative">
          <Input
            type={showCur ? "text" : "password"}
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="Enter current password"
            className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10 pr-10"
            required
          />
          <button type="button" tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            onClick={() => setShowCur((p) => !p)}>
            {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* New Password */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">New Password</Label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="At least 8 characters"
            className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10 pr-10"
            required
          />
          <button type="button" tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            onClick={() => setShowNew((p) => !p)}>
            {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div className="space-y-1.5">
        <Label className="text-slate-300 text-sm">Confirm New Password</Label>
        <Input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          placeholder="Repeat new password"
          className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
          required
        />
      </div>

      {/* Error / Success */}
      {localError && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
          <AlertCircle size={14} /> {localError}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-950/30 border border-emerald-800/30 rounded-lg px-3 py-2">
          <CheckCircle size={14} /> Password changed successfully!
        </div>
      )}

      <Button type="submit" size="sm" className="bg-white text-slate-900 hover:bg-white/90"
        disabled={changePw.isPending}>
        {changePw.isPending && <Loader2 className="animate-spin" size={13} />}
        Update Password
      </Button>
    </form>
  );
}

// ── Main Settings Page ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1 text-sm">Manage your account preferences and security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column — Profile + Change Password */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Card */}
          <Card className="bg-slate-900/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User size={18} className="text-blue-400" />
                Profile Information
              </CardTitle>
              <CardDescription>Your personal account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Email Address</p>
                  <p className="text-sm text-slate-200 font-medium">{user?.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Account Role</p>
                  <p className="text-sm text-slate-200 font-medium">{user?.role}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="bg-slate-900/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock size={18} className="text-amber-400" />
                Change Password
              </CardTitle>
              <CardDescription>Update your account password. You will stay logged in.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell size={18} className="text-purple-400" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 mb-4">
                Configure how you receive alerts and updates from the system.
              </p>
              <Button variant="secondary" size="sm" className="w-full bg-white/5 hover:bg-white/10 text-slate-300">
                Manage Preferences
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield size={18} className="text-emerald-400" />
                Privacy &amp; Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 mb-4">
                View connected devices and manage two-factor authentication.
              </p>
              <Button variant="secondary" size="sm" className="w-full bg-white/5 hover:bg-white/10 text-slate-300">
                Security Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
