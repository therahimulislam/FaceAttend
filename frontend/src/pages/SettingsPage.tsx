import { useAuthStore } from "@/store/authStore";
import { User, Lock, Bell, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1 text-sm">Manage your account preferences and security.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="bg-slate-900/50 border-white/10 md:col-span-2">
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
            
            <Separator className="bg-white/5 my-4" />
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Change Password</p>
                <p className="text-xs text-slate-500">Update your account password securely.</p>
              </div>
              <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5 text-slate-300">
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
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
                Privacy & Security
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
