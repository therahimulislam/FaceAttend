/**
 * FaceAttend — Admin Departments Page (Phase 3 placeholder)
 */
import { BookOpen } from "lucide-react";

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Departments</h1>
        <p className="text-slate-400 text-sm mt-1">Manage academic departments, semesters, and sections.</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center bg-white/3 border border-white/8 rounded-xl">
        <BookOpen className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-slate-300 font-medium">Department management coming soon</p>
        <p className="text-slate-600 text-sm mt-1">Full CRUD UI ships in the next sprint.</p>
      </div>
    </div>
  );
}
