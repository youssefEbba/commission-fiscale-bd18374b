import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FilePen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { avenantApi, AvenantDto } from "@/lib/api";
import { AVENANT_VIEW_PERMS } from "@/lib/avenants";

/**
 * Bandeau d'une demande de correction issue d'un avenant financier.
 * Le lien est porté par l'avenant (`demandeCorrectionId`) : on le retrouve dans la liste du périmètre.
 * Silencieux si la liste n'est pas lisible : l'absence de bandeau ne signifie pas absence d'avenant.
 */
export default function AvenantOrigineBanner({ demandeId }: { demandeId: number }) {
  const { t } = useTranslation(["modifications"]);
  const { hasPermission } = useAuth();
  const [avenant, setAvenant] = useState<AvenantDto | null>(null);
  const canView = AVENANT_VIEW_PERMS.some(hasPermission) || hasPermission("modification.submit");

  useEffect(() => {
    if (!canView) return;
    let alive = true;
    avenantApi.getAll()
      .then((list) => { if (alive) setAvenant(list.find((a) => a.demandeCorrectionId === demandeId) ?? null); })
      .catch(() => { if (alive) setAvenant(null); });
    return () => { alive = false; };
  }, [canView, demandeId]);

  if (!avenant) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <FilePen className="h-4 w-4 text-primary shrink-0" />
      <span className="font-medium">{t("modifications:banner.text", { numero: avenant.numero || `#${avenant.id}` })}</span>
      <Link to={`/dashboard/modifications/${avenant.id}`} className="text-primary hover:underline ms-auto">
        {t("modifications:banner.link")}
      </Link>
    </div>
  );
}
