import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Search, Clock, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { rattachementPublicApi, DemandeRattachementDto, StatutRattachement } from "@/lib/api";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { usePageTitle } from "@/hooks/usePageTitle";
import emblem from "@/assets/logo-official.png";

// Date toujours en chiffres latins (même en arabe)
const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
};

const STATUT_ICON: Record<StatutRattachement, React.ElementType> = {
  EN_ATTENTE: Clock,
  APPROUVEE: CheckCircle2,
  REFUSEE: XCircle,
};

const STATUT_STYLE: Record<StatutRattachement, string> = {
  EN_ATTENTE: "bg-accent/15 text-accent-foreground border-accent",
  APPROUVEE: "bg-primary/10 text-primary border-primary",
  REFUSEE: "bg-destructive/10 text-destructive border-destructive",
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 px-5 py-3">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-end font-medium text-foreground">{children}</dd>
  </div>
);

export default function SuiviRattachement() {
  const { t } = useTranslation("rattachement");
  usePageTitle("rattachement:suivi.title");
  const [params, setParams] = useSearchParams();
  const initialRef = params.get("ref") || "";
  const initialEmail = params.get("email") || "";
  const [reference, setReference] = useState(initialRef);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemandeRattachementDto | null>(null);

  const search = useCallback(async (rawRef: string, rawEmail: string) => {
    const ref = rawRef.trim();
    const mail = rawEmail.trim();
    if (!ref || !mail) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dto = await rattachementPublicApi.suivi(ref, mail);
      setResult(dto);
    } catch (e: unknown) {
      // Référence inconnue et e-mail non concordant rendent exactement la même
      // erreur 404 : ne jamais chercher à les distinguer (protection volontaire).
      const status = (e as { status?: number })?.status;
      setError(t(status === 404 ? "suivi.not_found" : "suivi.unavailable"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (initialRef && initialEmail) search(initialRef, initialEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ref = reference.trim();
    const mail = email.trim();
    const next: Record<string, string> = {};
    if (ref) next.ref = ref;
    if (mail) next.email = mail;
    setParams(next);
    search(ref, mail);
  };

  const StatutIcon = result ? STATUT_ICON[result.statut] : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <img src={emblem} alt="" className="h-10 w-10" />
          <div className="leading-tight min-w-0">
            <div className="text-lg font-bold text-foreground">{t("common:app.ministry")}</div>
            <div className="text-sm font-medium text-muted-foreground truncate">Commission Fiscale</div>
          </div>
        </Link>
        <LanguageSwitcher variant="compact" />
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto p-4 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">{t("suivi.title")}</h1>
          <p className="text-base text-muted-foreground mt-1">{t("suivi.subtitle")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="reference" className="text-sm font-medium">{t("suivi.reference_label")}</label>
            <Input
              id="reference"
              dir="ltr"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("suivi.placeholder")}
              className="h-14 text-lg font-mono uppercase"
              autoCapitalize="characters"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">{t("suivi.email_label")}</label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("suivi.email_placeholder")}
                className="h-14 text-lg"
                autoComplete="email"
              />
              <Button type="submit" size="lg" className="h-14 px-5" disabled={loading || !reference.trim() || !email.trim()}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                <span className="ms-2 hidden sm:inline">{t("suivi.search")}</span>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("suivi.hint")}</p>
        </form>

        {error && (
          <div role="alert" className="rounded-lg border-2 border-destructive p-4 space-y-3">
            <p className="text-base font-medium text-destructive">{error}</p>
            <Button variant="outline" onClick={() => search(reference, email)} disabled={loading || !reference.trim() || !email.trim()}>
              {t("suivi.retry")}
            </Button>
          </div>
        )}

        {result && StatutIcon && (
          <section className="rounded-xl overflow-hidden border-2">
            <div className={`flex items-center gap-4 p-5 border-b-2 ${STATUT_STYLE[result.statut]}`}>
              <StatutIcon className="h-12 w-12 shrink-0" />
              <div>
                <p className="text-xl font-bold leading-snug">{t(`statut.${result.statut}`)}</p>
                <p dir="ltr" className="font-mono text-sm opacity-80">{result.reference || `#${result.id}`}</p>
              </div>
            </div>
            <dl className="divide-y text-base">
              <Row label={t("suivi.qualite")}>
                {result.roleDemande ? t(`roles.${result.roleDemande}`) : "—"}
              </Row>
              <Row label={t("suivi.entite")}>
                {result.entiteNomAffiche || result.entiteNom || "—"}
                {result.entiteNouvelle && (
                  <Badge variant="secondary" className="ms-2 text-xs">{t("queue.entite_a_creer")}</Badge>
                )}
              </Row>
              <Row label={t("suivi.date_demande")}><span dir="ltr">{fmtDate(result.dateDepot || result.dateDemande)}</span></Row>
              {(result.dateTraitement || result.dateDecision) && (
                <Row label={t("suivi.date_decision")}><span dir="ltr">{fmtDate(result.dateTraitement || result.dateDecision)}</span></Row>
              )}
            </dl>
            {result.statut === "REFUSEE" && result.motifRefus && (
              <div className="border-t-2 border-destructive/40 bg-destructive/5 p-5">
                <p className="text-sm font-semibold text-destructive">{t("detail.motif_refus")}</p>
                <p className="text-sm text-foreground mt-1">{result.motifRefus}</p>
              </div>
            )}
            {result.statut === "APPROUVEE" && (
              <div className="border-t p-5 text-sm text-muted-foreground">{t("suivi.approved_hint")}</div>
            )}
          </section>
        )}

        <div className="pt-2">
          <Button variant="ghost" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />{t("suivi.back_home")}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
