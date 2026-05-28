import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authApi } from "@/lib/api";
import { ApiRequestError } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = () => {
  usePageTitle("Mot de passe oublié");
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetState = () => {
    setExists(null);
    setError(null);
    setSuccess(null);
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Veuillez saisir une adresse e-mail valide.");
      return;
    }
    setChecking(true);
    try {
      const res = await authApi.passwordResetCheckEmail(email.trim());
      setExists(res.exists);
      if (!res.exists) {
        setError("Cet e-mail n'est pas enregistré sur un compte actif.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la vérification de l'e-mail.");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await authApi.passwordResetRequest(email.trim());
      setSuccess(res.message || "Si l'e-mail est enregistré, votre demande a été transmise à l'administrateur.");
      setExists(null);
      setEmail("");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        const msg = err.message || "";
        if (msg.toLowerCase().includes("ambig")) {
          setError("Adresse ambiguë : contactez l'administrateur.");
        } else {
          setError("Une demande est déjà en cours pour ce compte.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Impossible d'envoyer la demande.");
      }
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
            Retour à la connexion
          </Link>
          <LanguageSwitcher variant="compact" />
        </div>

        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-12 w-12" />
            <div className="text-start leading-tight">
              <span className="block text-lg font-bold text-foreground">Commission Fiscale</span>
              <span className="block text-xs font-medium text-accent tracking-wider uppercase">Mauritanie</span>
            </div>
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground text-center mb-2 flex items-center justify-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" />
            Mot de passe oublié
          </h1>
          <p className="text-muted-foreground text-center text-sm mb-6">
            Saisissez votre adresse e-mail. Un administrateur traitera votre demande et un nouveau mot de passe vous sera envoyé.
          </p>

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

          <form onSubmit={handleCheck} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); resetState(); }}
                placeholder="votre@email.mr"
                required
                disabled={submitting}
              />
            </div>

            {exists !== true ? (
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={checking || !email}>
                {checking ? <><Loader2 className="h-4 w-4 me-2 animate-spin" /> Vérification…</> : "Vérifier l'e-mail"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={submitting}
              >
                {submitting ? <><Loader2 className="h-4 w-4 me-2 animate-spin" /> Envoi…</> : "Envoyer la demande"}
              </Button>
            )}
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link to="/login" className="text-primary font-medium hover:underline">
              Revenir à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
