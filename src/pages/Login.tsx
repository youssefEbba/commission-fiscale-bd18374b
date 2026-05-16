import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, Eye, EyeOff, ArrowLeft, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

import { API_BASE } from "@/lib/apiConfig";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation(["auth", "common"]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let msg = "";
        try {
          const json = JSON.parse(body);
          if (json.error) msg = json.error;
          if (json.message) msg = json.message;
        } catch { /* use default */ }

        const lower = msg.toLowerCase();
        if (lower.includes("valid") || lower.includes("activ") || lower.includes("approuv") || lower.includes("disabled")) {
          setError(t("auth:login.errors.notValidated"));
        } else {
          setError(t("auth:login.errors.invalid"));
        }
        return;
      }

      const data = await res.json();
      login(data);
      toast({
        title: t("auth:login.success.title"),
        description: t("auth:login.success.welcome", { name: data.nomComplet || data.username }),
      });
      navigate("/dashboard");
    } catch {
      setError(t("auth:login.errors.network"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("common:nav.home")}
          </Link>
          <LanguageSwitcher variant="outline" />
        </div>
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src={logo} alt={t("common:brand.name")} className="h-12 w-12" />
            <div className="text-start leading-tight">
              <span className="block text-lg font-bold text-foreground">{t("common:brand.name")}</span>
              <span className="block text-xs font-medium text-accent tracking-wider uppercase">{t("common:brand.country")}</span>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground text-center mb-2">{t("auth:login.title")}</h1>
          <p className="text-muted-foreground text-center text-sm mb-6">
            {t("auth:login.subtitle")}
          </p>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">{t("auth:login.username")}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("auth:login.usernamePh")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth:login.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
              <LogIn className="h-4 w-4 me-2" />
              {loading ? t("auth:login.submitting") : t("auth:login.submit")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("auth:login.noAccount")}{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              {t("auth:login.register")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
