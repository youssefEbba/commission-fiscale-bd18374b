import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, KeyRound, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authApi, formatApiErrorMessage } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mot de passe oublié : la demande est envoyée directement. Le serveur répond
 * le même message générique que l'adresse ait un compte ou non — l'écran ne
 * dit jamais si une adresse est enregistrée.
 */
const ForgotPassword = () => {
  const { t } = useTranslation(["auth", "common"]);
  usePageTitle("auth:forgot.title");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!EMAIL_REGEX.test(email.trim())) {
      setError(t("forgot.invalid_email"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.passwordResetRequest(email.trim());
      setSuccess(res?.message?.trim() || t("forgot.generic_success"));
      setEmail("");
    } catch (err) {
      setError(formatApiErrorMessage(err, t("forgot.send_error")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("forgot.back_to_login")}
          </Link>
          <LanguageSwitcher variant="compact" />
        </div>

        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src={logo} alt={t("brand.name")} className="h-12 w-12" />
            <div className="text-start leading-tight">
              <span className="block text-lg font-bold text-foreground">{t("brand.name")}</span>
              <span className="block text-xs font-medium text-accent tracking-wider uppercase">{t("brand.country")}</span>
            </div>
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground text-center mb-2 flex items-center justify-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" />
            {t("forgot.title")}
          </h1>
          <p className="text-muted-foreground text-center text-sm mb-6">{t("forgot.subtitle")}</p>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-primary/30 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t("forgot.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder={t("forgot.email_placeholder")}
                required
                disabled={submitting}
              />
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 me-2 animate-spin" /> {t("forgot.submitting")}</> : t("forgot.submit")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t("forgot.return_login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
