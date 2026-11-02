import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { feedbackApi, type EnqueteDto } from "@/lib/api";
import { cachedList } from "@/lib/listCache";
import { enquetesEnCoursKey } from "@/lib/enquetes";

const DISMISS_KEY = "enquete-banner:dismissed";

function readDismissed(): number[] {
  try { return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]"); } catch { return []; }
}

/** Bandeau « Une enquête de satisfaction vous attend » (feedback.submit) ; échec ou route absente : rien. */
export function EnqueteBanner() {
  const { t } = useTranslation("feedback");
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const [enquetes, setEnquetes] = useState<EnqueteDto[]>([]);
  const [dismissed, setDismissed] = useState<number[]>(readDismissed);
  const allowed = hasPermission("feedback.submit");

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    // Liste courte gardée 10 minutes : le bandeau ne relance pas l'appel à chaque page.
    cachedList(enquetesEnCoursKey(user?.userId), () => feedbackApi.enquetesEnCours(), 10 * 60 * 1000)
      .then((list) => { if (alive) setEnquetes(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setEnquetes([]); });
    return () => { alive = false; };
  }, [allowed, user?.userId, location.pathname]);

  const pending = enquetes.filter((e) => !dismissed.includes(e.id));
  if (!allowed || pending.length === 0 || location.pathname.startsWith("/dashboard/satisfaction/enquetes/")) return null;
  const first = pending[0];

  const dismiss = () => {
    const next = [...dismissed, ...pending.map((e) => e.id)];
    setDismissed(next);
    try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  };

  return (
    <div role="status" className="border-b border-border bg-accent/15 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2 text-sm text-foreground min-w-0">
        <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">
          <strong>{t("banner.title")}</strong>
          <span className="ms-1 text-muted-foreground">{pending.length > 1 ? t("banner.count", { count: pending.length }) : first.titre}</span>
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button asChild size="sm" className="h-8">
          <Link to={`/dashboard/satisfaction/enquetes/${first.id}`}>{t("banner.answer")}</Link>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={dismiss} aria-label={t("banner.later")} title={t("banner.later")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
