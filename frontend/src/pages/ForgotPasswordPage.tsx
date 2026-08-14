/**
 * FaceAttend — Forgot Password Page
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForgotPassword } from "@/features/auth/hooks/useForgotPassword";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPassword();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    await forgotPassword.mutateAsync(data.email);
    setSent(true);
  };

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-white text-xl">Reset your password</CardTitle>
        <CardDescription className="text-slate-400">
          Enter your email and we'll send you a reset link
        </CardDescription>
      </CardHeader>

      <CardContent>
        {sent ? (
          <div className="text-center py-4">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">Check your inbox</p>
            <p className="text-slate-400 text-sm mb-6">
              If an account exists for that email, a reset link has been sent (valid 24 hours).
            </p>
            <Link to="/login">
              <Button variant="outline" className="border-white/20 text-slate-300 hover:bg-white/10 hover:text-white">
                <ArrowLeft size={14} />
                Back to sign in
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-300">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@university.edu"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-11"
                {...register("email")}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-white text-slate-900 hover:bg-white/90 font-semibold"
              disabled={forgotPassword.isPending}
            >
              {forgotPassword.isPending ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
              {forgotPassword.isPending ? "Sending…" : "Send reset link"}
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1">
                <ArrowLeft size={12} /> Back to sign in
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
