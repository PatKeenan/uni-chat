import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession, signUp } from "@/lib/client/auth-client";

export const Route = createFileRoute("/signup")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await getSession();
    if (session.data?.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);

    try {
      await signUp.email(
        {
          email,
          password,
          name,
        },
        {
          onSuccess: () => {
            navigate({ to: "/dashboard" });
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Subtle background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 70% 20%, rgba(196, 112, 75, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 30% 80%, rgba(196, 112, 75, 0.04) 0%, transparent 40%)
          `,
        }}
      />

      <div className="w-full max-w-[36rem] relative z-10">
        {/* Floating orbs - positioned behind the card */}
        <div className="absolute -top-16 -right-16 w-36 h-36 orb orb-primary animate-float float-delay-1 opacity-60" />
        <div className="absolute -top-4 -left-12 w-20 h-20 orb orb-secondary animate-float float-delay-2 opacity-50" />
        <div className="absolute -bottom-10 -right-6 w-14 h-14 orb orb-tertiary animate-float float-delay-3 opacity-70" />

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-lg p-8 animate-fade-scale-in relative">
          {/* Logo/Brand */}
          <div className="flex items-center justify-center gap-3 mb-8 animate-fade-slide-down delay-100">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-warm-400 to-warm-600 flex items-center justify-center shadow-md">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-warm-foreground"
              >
                <title>Muse logo</title>
                <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
                <path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
                <path d="M19 11h2m-1 -1v2" />
              </svg>
            </div>
            <span className="font-serif text-2xl font-medium tracking-tight">
              Muse
            </span>
          </div>

          {/* Header */}
          <div className="text-center mb-8 animate-fade-slide-down delay-150">
            <h1 className="font-serif text-3xl font-normal tracking-tight mb-2">
              Begin your <em className="italic text-warm-500">journey</em>
            </h1>
            <p className="text-muted-foreground">
              Create an account to start exploring
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl animate-fade-scale-in">
                {error}
              </div>
            )}

            <div className="space-y-2 animate-fade-slide-up delay-200">
              <Label htmlFor="name" className="text-sm font-medium">
                Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 rounded-xl border-border bg-background focus:ring-2 focus:ring-warm-500/20 focus:border-warm-400 transition-all"
              />
            </div>

            <div className="space-y-2 animate-fade-slide-up delay-250">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 rounded-xl border-border bg-background focus:ring-2 focus:ring-warm-500/20 focus:border-warm-400 transition-all"
              />
            </div>

            <div className="space-y-2 animate-fade-slide-up delay-300">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
                className="h-11 rounded-xl border-border bg-background focus:ring-2 focus:ring-warm-500/20 focus:border-warm-400 transition-all"
              />
            </div>

            <div className="space-y-2 animate-fade-slide-up delay-350">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
                className="h-11 rounded-xl border-border bg-background focus:ring-2 focus:ring-warm-500/20 focus:border-warm-400 transition-all"
              />
            </div>

            <div className="pt-2 animate-fade-slide-up delay-400">
              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium text-base transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <title>Loading</title>
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </div>

            <div className="text-center pt-2 animate-fade-slide-up delay-500">
              <span className="text-muted-foreground text-sm">
                Already have an account?{" "}
              </span>
              <Link
                to="/login"
                className="text-warm-500 hover:text-warm-600 font-medium text-sm transition-colors"
              >
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
