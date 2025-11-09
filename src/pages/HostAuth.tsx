import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import dressingroom from "@/assets/dressingroom.webp";

const HOST_SIGNIN_URL =
  import.meta.env.VITE_HOST_SIGNIN_URL || import.meta.env.VITE_SIGNIN_URL;

export default function HostAuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const hostSignInMutation = useMutation<
    any,
    any,
    { emailId: string; password: string }
  >({
    mutationFn: async ({ emailId, password }) => {
      const resp = await fetch(HOST_SIGNIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ emailId, password }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const err: any = new Error(
          data?.error || data?.message || `Host signin failed (${resp.status})`,
        );
        err.status = resp.status;
        err.data = data;
        throw err;
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Host Signed in",
        description: "Welcome to your host panel!",
      });
      console.log("Host signin response:", data);

      // Store the JWT token in localStorage
      if (data.jwtToken) {
        localStorage.setItem("hostJwtToken", data.jwtToken);
      }

      // Store host info with token
      if (data.user) {
        localStorage.setItem(
          "host",
          JSON.stringify({
            user: data.user,
            token: data.jwtToken,
            role: data.user.role || "host",
          }),
        );
      }

      // Redirect to host panel on successful authentication
      navigate("/host", { replace: true });
    },
    onError: (err: any) => {
      toast({
        title: "Host signin failed",
        description:
          err?.data?.error || err?.message || "Check your credentials",
        variant: "destructive",
      });
      console.error("Host signin error:", err);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    try {
      await hostSignInMutation.mutateAsync({ emailId: email, password });
    } catch (err) {
      // Error handled by mutation options
    }
  };

  const loading = isLoading || hostSignInMutation.status === "pending";

  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-background p-4 text-white"
      style={{
        backgroundImage: `url(${dressingroom})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/0 to-background z-0" />

      {/* Auth Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="glassmorphism-medium rounded-3xl shadow-2xl p-10 border border-card-border">
          <div className="text-center mb-10">
            <h1 className="text-white text-5xl leaguegothic uppercase tracking-tight mb-2">
              Host Panel
            </h1>
            <p className="text-white/70 text-sm">
              Sign in to access your host dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 inter">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-11 bg-white/10 border-white/20 placeholder:text-white/40 text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-white"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-11 bg-white/10 border-white/20 placeholder:text-white/40 text-white"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 font-semibold text-white rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In to Host Panel"
              )}
            </Button>
          </form>

          <p className="text-xs text-white/70 mt-6 text-center">
            Need host access? Contact support to get your host credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
