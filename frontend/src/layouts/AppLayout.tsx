/**
 * FaceAttend — App Layout (Sidebar Shell)
 * Phase 19: Mobile-responsive — sidebar is a fixed topbar + drawer on mobile.
 */
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Safe area padding: top accounts for mobile topbar (h-14), bottom for iOS home indicator */}
        <div className="p-4 lg:p-8 pb-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
