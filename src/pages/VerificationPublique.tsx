import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE, NGROK_HEADERS } from "@/lib/apiConfig";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import emblem from "@/assets/logo-official.png";

type Severite = "success" | "warning" | "muted" | "destructive";

interface VerificationPubliqueDto {
  trouve: boolean;
  code: string;
  typeDocument?: "CERTIFICAT_CREDIT" | "CERTIFICAT_UTILISATION" | string | null;
  authentique?: boolean;
  libelleEtat: string;
  severiteUi: Severite;
  dateEmission?: string | null;
  entrepriseRaisonSociale?: string | null;
  statut?: string | null;
  motifs?: string[];
}

const bandeau: Record<Severite, string> = {
  success: "bg-primary text-primary-foreground",
  warning: "bg-accent text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  muted: "bg-muted text-foreground",
};

const Icon = ({ s }: { s: Severite }) => {
  const cls = "h-14 w-14 shrink-0";
  if (s === "success") return <ShieldCheck className={cls} />;
  if (s === "warning") return <ShieldAlert className={cls} />;
  if (s === "destructive") return <ShieldX className={cls} />;
  return <ShieldQuestion className={cls} />;
};

// Date toujours en chiffres latins (même en arabe)
const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
};

export default function VerificationPublique() {
  const { t } = useTranslation("common");
  const [params, setParams] = useSearchParams();
  const initial = params.get("code") || "";
  const [code, setCode] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationPubliqueDto | null>(null);

  const verify = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/public/verification?code=${encodeURIComponent(value)}`, {
        headers: { Accept: "application/json", ...NGROK_HEADERS },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message || t("verification.unavailable"));
        return;
      }
      setResult(body as VerificationPubliqueDto);
    } catch {
      setError(t("verification.unavailable"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (initial) verify(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = code.trim();
    setParams(v ? { code: v } : {});
    verify(v);
  };

  const typeLabel = (k?: string | null) =>
    k ? t(`verification.types.${k}`, { defaultValue: k }) : "—";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <img src={emblem} alt="" className="h-10 w-10" />
          <div className="leading-tight min-w-0">
            <div className="text-xs text-muted-foreground">{t("app.ministry")}</div>
            <div className="font-semibold truncate">Commission Fiscale</div>
          </div>
        </div>
        <LanguageSwitcher variant="compact" />
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto p-4 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">{t("verification.title")}</h1>
          <p className="text-base text-muted-foreground mt-1">{t("verification.subtitle")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-2">
          <label htmlFor="code" className="text-sm font-medium">{t("verification.code_label")}</label>
          <div className="flex gap-2">
            <Input
              id="code"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("verification.placeholder")}
              className="h-14 text-lg font-mono uppercase"
              autoCapitalize="characters"
            />
            <Button type="submit" size="lg" className="h-14 px-5" disabled={loading || !code.trim()}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              <span className="ms-2 hidden sm:inline">{t("verification.verify")}</span>
            </Button>
          </div>
        </form>

        {error && (
          <div role="alert" className="rounded-lg border-2 border-destructive p-4 space-y-3">
            <p className="text-base font-medium text-destructive">{error}</p>
            <Button variant="outline" onClick={() => verify(code)} disabled={loading || !code.trim()}>
              {t("verification.retry")}
            </Button>
          </div>
        )}

        {result && (
          <section className="rounded-xl overflow-hidden border-2">
            <div className={`flex items-center gap-4 p-5 ${bandeau[result.severiteUi] ?? bandeau.muted}`}>
              <Icon s={result.severiteUi} />
              <p className="text-xl sm:text-2xl font-bold leading-snug">{result.libelleEtat}</p>
            </div>
            <dl className="divide-y text-base">
              <Row label={t("verification.code")}>
                <span dir="ltr" className="font-mono font-semibold">{result.code}</span>
              </Row>
              {result.trouve && (
                <>
                  <Row label={t("verification.type")}>{typeLabel(result.typeDocument)}</Row>
                  <Row label={t("verification.entreprise")}>{result.entrepriseRaisonSociale || "—"}</Row>
                  <Row label={t("verification.date")}><span dir="ltr">{fmtDate(result.dateEmission)}</span></Row>
                  <Row label={t("verification.statut")}><span dir="ltr" className="font-mono">{result.statut || "—"}</span></Row>
                </>
              )}
            </dl>
            {result.motifs && result.motifs.length > 0 && (
              <div className="p-4 border-t">
                <div className="text-sm font-semibold mb-2">{t("verification.motifs")}</div>
                <ul className="list-disc ps-5 space-y-1 text-base">
                  {result.motifs.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        <p className="text-sm text-muted-foreground">{t("verification.note")}</p>
      </main>

      <footer className="py-4 text-center">
        <Link to="/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t("verification.login")}
        </Link>
      </footer>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium mt-0.5 break-words">{children}</dd>
    </div>
  );
}
