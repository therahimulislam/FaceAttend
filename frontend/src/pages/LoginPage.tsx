/**
 * FaceAttend — Login Page
 * POST /api/v1/auth/login/
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLogin } from "@/features/auth/hooks/useLogin";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "Invalid email or password.",
  AUTH_ACCOUNT_REJECTED: "Your registration was rejected. Contact your department administrator.",
  AUTH_ACCOUNT_SUSPENDED: "Your account has been suspended. Contact support.",
  AUTH_ACCOUNT_INACTIVE: "This account is inactive.",
};

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await login.mutateAsync(data);
    } catch (err) {
      const axiosErr = err as AxiosError<{ code?: string; message?: string }>;
      const code = axiosErr.response?.data?.code ?? "SERVER_ERROR";
      const message = axiosErr.response?.data?.message;
      setServerError(ERROR_MESSAGES[code] ?? message ?? "Login failed. Please try again.");
    }
  };

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-white text-xl">Sign in</CardTitle>
        <CardDescription className="text-slate-400">
          Enter your credentials to access your dashboard
        </CardDescription>
      </CardHeader>

      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-5 bg-red-950/50 border-red-800/50 text-red-300">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-300">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-11"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <Link
                to="/forgot-password"
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-11 pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-11 bg-white text-slate-900 hover:bg-white/90 font-semibold mt-2"
            disabled={isSubmitting || login.isPending}
          >
            {login.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <LogIn size={16} />
            )}
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {/* Register link */}
        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <p className="text-sm text-slate-500">
            New student?{" "}
            <Link
              to="/register"
              className="text-white font-medium hover:underline underline-offset-4"
            >
              Create an account
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
