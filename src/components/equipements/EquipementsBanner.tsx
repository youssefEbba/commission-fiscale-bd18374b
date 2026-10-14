import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Truck, ExternalLink, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { demandeCorrectionApi, DocumentDto } from "@/lib/api";
import { openDocument } from "@/lib/openDocument";
import { showApiError } from "@/lib/feedback";
import { EQUIP_DOC } from "@/lib/equipements";

interface Props {
  /** Drapeau serveur `equipementsPresents` (demande ou certificat). */
  present?: boolean | null;
  /** Demande de correction d'origine, porteuse de la pièce LISTE_EQUIPEMENTS. */
  demandeId?: number | null;
  className?: string;
}

/** Avertissement « véhicules / équipements sous régime (plaques TT) » — jamais bloquant. */
export default function EquipementsBanner({ present, demandeId, className }: Props) {
  const { t } = useTranslation("mise_en_place");
  const [docs, setDocs] = useState<DocumentDto[] | null>(null);

  useEffect(() => {
    if (!present || !demandeId) return;
    let alive = true;
    demandeCorrectionApi.getDocuments(demandeId)
      .then((all) => { if (alive) setDocs(all.filter((d) => (d.codeDocument || d.type) === EQUIP_DOC && d.actif !== false)); })
      .catch(() => { if (alive) setDocs([]); });
    return () => { alive = false; };
  }, [present, demandeId]);

  if (!present) return null;

  return (
    <Alert className={`border-accent bg-accent/10 ${className ?? ""}`}>
      <Truck className="h-4 w-4" />
      <AlertTitle>{t("equipements.banner_title")}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">{t("equipements.banner_body")}</p>
        {docs === null && demandeId ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : docs && docs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {docs.map((d) => (
              <Button key={d.id} size="sm" variant="outline" onClick={() => openDocument(d).catch((e) => showApiError(e, t("equipements.open_error")))}>
                <ExternalLink className="h-3.5 w-3.5 me-1" /> {t("equipements.open_list")}{docs.length > 1 && d.version ? ` (v${d.version})` : ""}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("equipements.list_unavailable")}</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
