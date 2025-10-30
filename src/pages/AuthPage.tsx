import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import dressingroom from "@/assets/dressingroom.webp";

// import { apiRequest } from "../lib/queryCient"; // not used here, using fetch directly

type AuthMode = "signup" | "signin";
type AuthStep = "credentials" | "verification";

// Type for signup payload
type SignupPayload = {
  firstName: string;
  lastName: string;
  emailId: string;
  // add other optional fields if needed
};

// Type for signup response
type SignupResponse = {
  message?: string;
  error?: string;
  [key: string]: any;
};

const SIGNUP_URL = import.meta.env.VITE_SIGNUP_URL;

const SIGNIN_URL = import.meta.env.VITE_SIGNIN_URL;

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [step, setStep] = useState<AuthStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const navigate = useNavigate();

  // React Query mutation for signup POST
  // type aliases already declared above
  const signupMutation = useMutation<SignupResponse, any, SignupPayload>({
    mutationFn: async (payload: SignupPayload) => {
      // use the payload passed by mutateAsync instead of outer state
      const resp = await fetch(SIGNUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // if you need cookies from auth server, add: credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const err: any = new Error(
          data?.message || data?.error || `Signup failed (${resp.status})`,
        );
        err.status = resp.status;
        err.data = data;
        throw err;
      }
      return data as SignupResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data?.message || "Enrollment success. Check your email.",
      });
      setStep("verification");
    },
    onError: (err: any) => {
      if ((err as any)?.status === 409) {
        toast({
          title: "Email taken",
          description:
            (err as any)?.data?.message ||
            "User already exists. Enter your password to save draft.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Signup error",
          description: err?.message || "Failed to signup",
          variant: "destructive",
        });
      }
      console.error("signup error:", err);
    },
  });

  const signInMutation = useMutation<
    any,
    any,
    { emailId: string; password: string }
  >({
    mutationFn: async ({ emailId, password }) => {
      const resp = await fetch(SIGNIN_URL, {
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
          data?.error || data?.message || `Signin failed (${resp.status})`,
        );
        err.status = resp.status;
        err.data = data;
        throw err;
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Signed in",
        description: "Welcome back!",
      });
      console.log("Signin response:", data);

      // Store the JWT token in localStorage
      if (data.jwtToken) {
        localStorage.setItem("jwtToken", data.jwtToken);
      }

      // Store user info with token
      if (data.user) {
        localStorage.setItem(
          "user",
          JSON.stringify({
            user: data.user,
            lobbyName: data.user.lobbyName,
            token: data.jwtToken, // Make sure token is stored here too
          }),
        );
      }

      navigate("/lobby", { replace: true });
    },
    onError: (err: any) => {
      toast({
        title: "Signin failed",
        description:
          err?.data?.error || err?.message || "Check your credentials",
        variant: "destructive",
      });
      console.error("Signin error:", err);
    },
  });

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email",
        variant: "destructive",
      });
      return;
    }

    if (mode === "signup" && (!firstName || !lastName)) {
      toast({
        title: "Error",
        description: "Please enter your first and last name",
        variant: "destructive",
      });
      return;
    }

    if (mode === "signin" && !password) {
      toast({
        title: "Error",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    // Signup flow uses React Query mutation
    if (mode === "signup") {
      const payload = {
        firstName,
        lastName,
        emailId: email, // backend expects `emailId`
        // add other optional fields here as needed
      };

      try {
        await signupMutation.mutateAsync(payload);
        // onSuccess will handle toast + setStep
      } catch (err) {
        // onError handled by mutation options
      }
      return;
    }

    // Signin flow implemented here!
    if (mode === "signin") {
      try {
        await signInMutation.mutateAsync({ emailId: email, password });
        // onSuccess will handle toast + localStorage set
      } catch (err) {
        // onError handled by mutation options
      }
      return;
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationCode) {
      toast({
        title: "Error",
        description: "Please enter the verification code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // verification logic (unchanged)...
    // e.g. call your verify endpoint here
    setIsLoading(false);
  };

  const handleResendCode = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "No email to resend to",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      firstName,
      lastName,
      emailId: email,
    };

    try {
      await signupMutation.mutateAsync(payload);
      // onSuccess will show toast and set step
    } catch (err) {
      // onError handled by mutation
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setStep("credentials");
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setVerificationCode("");
  };

  const loading = isLoading || signupMutation.status === "pending";

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
              Top Club Trivia
            </h1>
            <p className="text-white/70 text-sm">
              {step === "credentials"
                ? mode === "signup"
                  ? "Create your account to get started"
                  : "Welcome back, sign in to continue"
                : "Verify your email address"}
            </p>
          </div>

          {/* Sign In / Sign Up Tabs */}
          {step === "credentials" && (
            <div className="mb-8">
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/10 rounded-lg">
                <button
                  data-testid="button-signup-tab"
                  onClick={() => switchMode("signup")}
                  className={`leaguegothic uppercase py-2.5 px-4 rounded-md text-xl transition-all ${
                    mode === "signup"
                      ? "glassmorphism-medium text-white/100 bg-primary text-primary-foreground shadow-sm"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
                <button
                  data-testid="button-signin-tab"
                  onClick={() => switchMode("signin")}
                  className={`leaguegothic uppercase py-2.5 px-4 rounded-md text-xl transition-all ${
                    mode === "signin"
                      ? "glassmorphism-medium text-white/100 bg-primary text-primary-foreground shadow-sm"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
              </div>
            </div>
          )}

          {/* Credentials Form */}
          {step === "credentials" ? (
            <form
              onSubmit={handleSubmitCredentials}
              className="space-y-5 inter"
            >
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="firstName"
                      className="text-sm font-medium text-white"
                    >
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      data-testid="input-firstname"
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={loading}
                      className="h-11 bg-white/10 border-white/20 placeholder:text-white/40 text-white"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="lastName"
                      className="text-sm font-medium text-white"
                    >
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      data-testid="input-lastname"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={loading}
                      className="h-11 bg-white/10 border-white/20 placeholder:text-white/40 text-white"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-white"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-11 bg-white/10 border-white/20 placeholder:text-white/40 text-white"
                  required
                />
              </div>

              {mode === "signin" && (
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-white"
                  >
                    Password
                  </Label>
                  <Input
                    id="password"
                    data-testid="input-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="h-11 bg-white/10 border-white/20 placeholder:text-white/40 text-white"
                    required
                  />
                </div>
              )}

              <Button
                type="submit"
                data-testid="button-continue"
                disabled={loading}
                className="w-full h-11 font-semibold text-white rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          ) : (
            // Verification Form
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="code"
                  className="text-sm font-medium text-white"
                >
                  Verification Code
                </Label>
                <Input
                  id="code"
                  data-testid="input-verification-code"
                  type="text"
                  placeholder="Enter code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  disabled={loading}
                  className="h-11 text-2xl tracking-widest text-center font-semibold bg-white/10 border-white/20 text-white"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-white/70 text-center">
                  Code sent to {email}
                </p>
              </div>

              <Button
                type="submit"
                data-testid="button-verify"
                className="w-full h-11 font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  data-testid="button-resend"
                  onClick={handleResendCode}
                  className="text-sm font-medium underline hover:text-white/90 text-white"
                  disabled={loading}
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
          <p className="text-xs text-white/70 mt-2 text-center">
            You can use your{" "}
            <span
              className="underline font-medium cursor-pointer text-white"
              onClick={() =>
                window.open("https://topclubfantasy.com/", "_blank")
              }
            >
              Topclub Fantasy
            </span>{" "}
            credentials to <strong className="text-white">Sign In</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
