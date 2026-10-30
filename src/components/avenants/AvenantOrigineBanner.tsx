import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FilePen } from "lucide-react";

/**
 * Bandeau d'une demande de correction issue d'un avenant financier.
 * Le lien vient du serveur (`DemandeCorrectionDto.avenantId` / `avenantNumero`, nuls pour une demande ordinaire).
 */
export default function AvenantOrigineBanner({
  avenantId,
  avenantNumero,
}: {
  avenantId?: number | null;
  avenantNumero?: string | null;
}) {
  const { t } = useTranslation(["modifications"]);
  if (avenantId == null) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <FilePen className="h-4 w-4 text-primary shrink-0" />
      <span className="font-medium">{t("modifications:banner.text", { numero: avenantNumero || `#${avenantId}` })}</span>
      <Link to={`/dashboard/modifications/${avenantId}`} className="text-primary hover:underline ms-auto">
        {t("modifications:banner.link")}
      </Link>
    </div>
  );
}
