/**
 * FaceAttend — Pending Approval Page
 * Shown to students whose registration is awaiting admin approval.
 */
import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/store/authStore";

export default function PendingApprovalPage() {
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);
  const studentInfo = (user as { student_info?: { full_name?: string } } | null)?.student_info;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
          <Clock className="w-9 h-9 text-amber-400" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          {studentInfo?.full_name ? `Welcome, ${studentInfo.full_name.split(" ")[0]}!` : "Registration Submitted"}
        </h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          Your student account is pending approval by the department administrator.
          You will be able to access FaceAttend once your account is approved.
        </p>

        {/* Status card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-medium">Registration submitted</p>
              <p className="text-slate-500 text-xs">Your account details have been received.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-slate-400 text-sm font-medium">Awaiting admin review</p>
              <p className="text-slate-500 text-xs">The department admin will review your details.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-slate-700 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-slate-500 text-sm font-medium">Face enrollment</p>
              <p className="text-slate-600 text-xs">After approval, you'll enroll your face for attendance.</p>
            </div>
          </div>
        </div>

        <p className="text-slate-600 text-xs mb-6">
          You'll receive an email notification once your account is approved.
        </p>

        <Button
          variant="outline"
          className="border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut size={14} />
          Sign out
        </Button>
      </div>
    </div>
  );
}
