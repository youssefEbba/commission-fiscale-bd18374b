import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import type { AvenantDto } from "@/lib/api";
import { canOpenMarche } from "@/lib/marcheAccess";

/** Marché d'un avenant : lien vers la fiche pour les rôles qui y ont accès, texte sinon. */
export default function AvenantMarcheLink({ avenant: a, withIntitule = false }: { avenant: Pick<AvenantDto, "marcheId" | "marcheNumero" | "marcheIntitule">; withIntitule?: boolean }) {
  const { t } = useTranslation("modifications");
  const { user } = useAuth();
  if (a.marcheId == null) return <span className="text-muted-foreground">{t("depot.sans_marche")}</span>;
  const label = `${a.marcheNumero || `#${a.marcheId}`}${withIntitule && a.marcheIntitule ? ` — ${a.marcheIntitule}` : ""}`;
  return canOpenMarche(user?.role) ? (
    <Link to={`/dashboard/marches/${a.marcheId}`} className="text-primary hover:underline" title={a.marcheIntitule || undefined}>{label}</Link>
  ) : (
    <span title={a.marcheIntitule || undefined}>{label}</span>
  );
}
