/**
 * FaceAttend — 403 Unauthorized Page
 */
import { ShieldX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <ShieldX className="w-16 h-16 text-destructive mb-4" />
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-muted-foreground mb-8 text-center max-w-sm">
        You don't have permission to access this page.
      </p>
      <Link to="/">
        <Button>Go to dashboard</Button>
      </Link>
    </div>
  );
}
