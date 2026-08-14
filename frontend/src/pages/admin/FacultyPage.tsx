/**
 * FaceAttend — Admin Faculty Management Page (Phase 3)
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, RefreshCw } from "lucide-react";
import { facultyApi } from "@/features/faculty/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function FacultyPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["faculty-list", search],
    queryFn: () => facultyApi.list({ search: search || undefined, page_size: 50 }),
  });

  const faculty = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Faculty</h1>
          <p className="text-slate-400 text-sm mt-1">{data?.count ?? 0} faculty members</p>
        </div>
        <Button variant="outline" size="sm" className="border-white/10 text-slate-300 hover:bg-white/5" onClick={() => refetch()}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Search faculty…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
        />
      </div>

      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-slate-500" size={20} />
          </div>
        ) : faculty.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No faculty found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {["Faculty Member", "Employee ID", "Department", "Designation", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {faculty.map((f) => (
                <tr key={f.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-medium">{f.full_name}</p>
                    <p className="text-slate-500 text-xs">{f.email}</p>
                  </td>
                  <td className="px-4 py-3"><span className="font-mono text-slate-300 text-sm">{f.employee_id}</span></td>
                  <td className="px-4 py-3"><p className="text-slate-300 text-sm">{f.department_name ?? "—"}</p></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-300 text-sm">{f.designation || "—"}</p>
                      {f.is_hod && <Badge variant="outline" className="text-xs">HOD</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={f.user_status === "ACTIVE" ? "success" : "secondary"} className="text-xs">
                      {f.user_status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
