import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogIn, Eye, EyeOff, ArrowLeft, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

import { API_BASE } from "@/lib/apiConfig";

const Login = () => {
  const { t } = useTranslation("auth");
  usePageTitle("auth:login.title");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
        let raw = "";
        try {
          const json = JSON.parse(body);
          raw = (json.error || json.message || "") as string;
        } catch { /* noop */ }

        const lower = raw.toLowerCase();
        if (lower.includes("valid") || lower.includes("activ") || lower.includes("approuv") || lower.includes("disabled")) {
          setError(t("login.errors.account_not_validated"));
        } else {
          setError(t("login.errors.invalid_credentials"));
        }
        return;
      }

      const data = await res.json();
      login(data);
      toast({
        title: t("login.success_title"),
        description: t("login.success_description", { name: data.nomComplet || data.username }),
      });
      navigate("/dashboard");
    } catch {
      setError(t("login.errors.network"));
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
            {t("back_home")}
          </Link>
          <LanguageSwitcher variant="compact" />
        </div>
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src={logo} alt={t("brand.name")} className="h-12 w-12" />
            <div className="text-start leading-tight">
              <span className="block text-lg font-bold text-foreground">{t("brand.name")}</span>
              <span className="block text-xs font-medium text-accent tracking-wider uppercase">{t("brand.country")}</span>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground text-center mb-2">{t("login.title")}</h1>
          <p className="text-muted-foreground text-center text-sm mb-6">
            {t("login.subtitle")}
          </p>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">{t("login.username")}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("login.username_placeholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("login.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.password_placeholder")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t("login.toggle_password_hide") : t("login.toggle_password_show")}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
              <LogIn className="h-4 w-4 me-2" />
              {loading ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("login.no_account")}{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              {t("login.register")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
