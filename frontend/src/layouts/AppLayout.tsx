/**
 * FaceAttend — App Layout (Sidebar Shell)
 * Used by all authenticated dashboard views.
 */
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
