/**
 * FaceAttend — Register Page (Student Self-Registration)
 * POST /api/v1/auth/register/
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, UserPlus, Loader2 } from "lucide-react";
import { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRegister } from "@/features/auth/hooks/useRegister";

const schema = z
  .object({
    full_name: z.string().min(2, "Full name must be at least 2 characters"),
    student_id: z.string().min(3, "Student ID is required"),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().optional(),
    department_name: z.string().min(2, "Department is required"),
    semester_name: z.string().min(1, "Semester is required"),
    section_name: z.string().min(1, "Section is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const register = useRegister();

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await register.mutateAsync(data);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; errors?: Record<string, string[]> }>;
      const errs = axiosErr.response?.data?.errors;
      if (errs) {
        const first = Object.values(errs).flat()[0];
        setServerError(first ?? "Registration failed.");
      } else {
        setServerError(axiosErr.response?.data?.message ?? "Registration failed. Please try again.");
      }
    }
  };

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-white text-xl">Create student account</CardTitle>
        <CardDescription className="text-slate-400">
          Fill in your details. An admin will review and approve your account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-5 bg-red-950/50 border-red-800/50 text-red-300">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Full Name + Student ID row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="text-slate-300 text-xs">Full name *</Label>
              <Input
                id="full_name"
                placeholder="Jane Smith"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-10 text-sm"
                {...field("full_name")}
              />
              {errors.full_name && <p className="text-red-400 text-xs">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="student_id" className="text-slate-300 text-xs">Student ID *</Label>
              <Input
                id="student_id"
                placeholder="CS2024001"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-10 text-sm"
                {...field("student_id")}
              />
              {errors.student_id && <p className="text-red-400 text-xs">{errors.student_id.message}</p>}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-300 text-xs">Email address *</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-10 text-sm"
              {...field("email")}
            />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-slate-300 text-xs">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+91 98765 43210"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-10 text-sm"
              {...field("phone")}
            />
          </div>

          {/* Department / Semester / Section */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="department_name" className="text-slate-300 text-xs">Department *</Label>
              <Input
                id="department_name"
                placeholder="Computer Sci."
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-10 text-sm"
                {...field("department_name")}
              />
              {errors.department_name && <p className="text-red-400 text-xs">{errors.department_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="semester_name" className="text-slate-300 text-xs">Semester *</Label>
              <Input
                id="semester_name"
                placeholder="Sem 3"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-10 text-sm"
                {...field("semester_name")}
              />
              {errors.semester_name && <p className="text-red-400 text-xs">{errors.semester_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="section_name" className="text-slate-300 text-xs">Section *</Label>
              <Input
                id="section_name"
                placeholder="A"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-10 text-sm"
                {...field("section_name")}
              />
              {errors.section_name && <p className="text-red-400 text-xs">{errors.section_name.message}</p>}
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-300 text-xs">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-10 text-sm pr-10"
                {...field("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm_password" className="text-slate-300 text-xs">Confirm password *</Label>
            <Input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-white/20 h-10 text-sm"
              {...field("confirm_password")}
            />
            {errors.confirm_password && <p className="text-red-400 text-xs">{errors.confirm_password.message}</p>}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-11 bg-white text-slate-900 hover:bg-white/90 font-semibold mt-1"
            disabled={isSubmitting || register.isPending}
          >
            {register.isPending ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
            {register.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <div className="mt-5 pt-5 border-t border-white/10 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-white font-medium hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
