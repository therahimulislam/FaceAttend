/**
 * FaceAttend — Student Dashboard
 */
import { useQuery } from "@tanstack/react-query";
import { studentsApi } from "@/features/students/api";
import { Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function StudentDashboard() {
  const { data: profile } = useQuery({
    queryKey: ["student-me"],
    queryFn: studentsApi.me,
  });

  const status = profile?.approval_status;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-slate-400 text-sm mt-1">Your FaceAttend student portal</p>
      </div>

      {status === "PENDING" && (
        <Card className="bg-amber-950/30 border-amber-800/30">
          <CardContent className="p-5 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-medium text-sm">Account pending approval</p>
              <p className="text-amber-500/80 text-xs mt-0.5">
                Your registration is under review. You'll be notified once approved.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "APPROVED" && (
        <Card className="bg-emerald-950/30 border-emerald-800/30">
          <CardContent className="p-5 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-emerald-300 font-medium text-sm">Account approved</p>
              <p className="text-emerald-600/80 text-xs mt-0.5">
                You can now mark attendance in your classes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {profile && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-3">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">My Details</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Student ID", profile.student_id],
                ["Department", profile.department_display],
                ["Semester", profile.semester_display],
                ["Section", profile.section_display],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-slate-500 text-xs">{label}</p>
                  <p className="text-white text-sm font-medium mt-0.5">{value || "—"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
