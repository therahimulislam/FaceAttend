/**
 * FaceAttend — Admin Dashboard
 * Overview cards: pending approvals, total students, faculty, departments.
 */
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Users, BookOpen, Clock, CheckCircle, XCircle } from "lucide-react";
import { studentsApi } from "@/features/students/api";
import { facultyApi } from "@/features/faculty/api";
import { departmentsApi } from "@/features/departments/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

function StatCard({ label, value, icon: Icon, color, to }: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; to?: string;
}) {
  const content = (
    <Card className="bg-white/5 border-white/10 hover:bg-white/8 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon size={18} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function AdminDashboard() {
  const { data: pendingStudents } = useQuery({
    queryKey: ["admin-students", "", "PENDING"],
    queryFn: () => studentsApi.list({ approval_status: "PENDING", page_size: 1 }),
  });
  const { data: allStudents } = useQuery({
    queryKey: ["admin-students", "", ""],
    queryFn: () => studentsApi.list({ page_size: 1 }),
  });
  const { data: facultyData } = useQuery({
    queryKey: ["faculty-list"],
    queryFn: () => facultyApi.list({ page_size: 1 }),
  });
  const { data: deptData } = useQuery({
    queryKey: ["dept-list"],
    queryFn: () => departmentsApi.list({ status: "ACTIVE" }),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Welcome back. Here's what's happening.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Approvals" value={pendingStudents?.count ?? 0}
          icon={Clock} color="bg-amber-600" to="/admin/students?status=PENDING" />
        <StatCard label="Total Students" value={allStudents?.count ?? 0}
          icon={GraduationCap} color="bg-blue-600" to="/admin/students" />
        <StatCard label="Faculty Members" value={facultyData?.count ?? 0}
          icon={Users} color="bg-violet-600" to="/admin/faculty" />
        <StatCard label="Departments" value={deptData?.count ?? 0}
          icon={BookOpen} color="bg-emerald-600" to="/admin/departments" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Clock size={16} className="text-amber-400" /> Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm mb-4">
              {pendingStudents?.count ?? 0} student registrations are waiting for your review.
            </p>
            <Link to="/admin/students">
              <button className="inline-flex items-center gap-2 text-sm text-white bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg transition-colors">
                <GraduationCap size={14} /> Review Students
              </button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Users size={16} className="text-violet-400" /> Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/faculty" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors py-1">
              <CheckCircle size={13} className="text-emerald-400" /> Add faculty member
            </Link>
            <Link to="/admin/departments" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors py-1">
              <CheckCircle size={13} className="text-emerald-400" /> Manage departments
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
