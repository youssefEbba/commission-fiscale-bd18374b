import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Truck, ExternalLink, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { demandeCorrectionApi, certificatCreditApi, DocumentDto } from "@/lib/api";
import { DocumentButton } from "@/components/documents/DocumentButton";
import { showApiError } from "@/lib/feedback";
import { EQUIP_DOC } from "@/lib/equipements";

interface Props {
  /** Drapeau serveur `equipementsPresents` (demande ou certificat). */
  present?: boolean | null;
  /** Demande de correction d'origine, porteuse de la pièce LISTE_EQUIPEMENTS. */
  demandeId?: number | null;
  /** À défaut de demandeId : certificat dont la fiche porte demandeCorrectionId. */
  certificatId?: number | null;
  /** « cloture » : il reste des équipements, vérifier leur sort avant de fermer. */
  variant?: "default" | "cloture";
  className?: string;
}

/** Avertissement « véhicules / équipements sous régime (plaques TT) » — jamais bloquant. */
export default function EquipementsBanner({ present, demandeId, certificatId, variant = "default", className }: Props) {
  const { t } = useTranslation("mise_en_place");
  const [docs, setDocs] = useState<DocumentDto[] | null>(null);

  useEffect(() => {
    if (!present || (!demandeId && !certificatId)) return;
    let alive = true;
    const resolveId = demandeId
      ? Promise.resolve(demandeId)
      : certificatCreditApi.getById(certificatId!).then((c) => c.demandeCorrectionId);
    resolveId
      .then((id) => (id ? demandeCorrectionApi.getDocuments(id) : []))
      .then((all) => { if (alive) setDocs(all.filter((d) => (d.codeDocument || d.type) === EQUIP_DOC && d.actif !== false)); })
      .catch(() => { if (alive) setDocs([]); });
    return () => { alive = false; };
  }, [present, demandeId, certificatId]);

  if (!present) return null;

  return (
    <Alert className={`border-accent bg-accent/10 ${className ?? ""}`}>
      <Truck className="h-4 w-4" />
      <AlertTitle>{t("equipements.banner_title")}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">{t(variant === "cloture" ? "equipements.banner_body_cloture" : "equipements.banner_body")}</p>
        {docs === null && (demandeId || certificatId) ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : docs && docs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {docs.map((d) => (
              <DocumentButton key={d.id} doc={d} icon={ExternalLink} size="sm" variant="outline" onError={(e) => showApiError(e, t("equipements.open_error"))}>
                {t("equipements.open_list")}{docs.length > 1 && d.version ? ` (v${d.version})` : ""}
              </DocumentButton>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("equipements.list_unavailable")}</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
