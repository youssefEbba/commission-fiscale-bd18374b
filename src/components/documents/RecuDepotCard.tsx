import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentButton } from "@/components/documents/DocumentButton";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/i18n/format";
import { formatApiErrorMessage, type DocumentDto } from "@/lib/api";
import { presentBlob, trackDocumentTask } from "@/lib/openDocument";
import { recuVersions } from "@/lib/recuDepot";
import { generateRecuPdf, recuFileName, type RecuModele } from "@/lib/recuDepotPdf";

/**
 * Reçu de dépôt d'un dossier : toutes les versions enregistrées (une par dépôt, la plus récente en tête).
 * Sans reçu enregistré, le reçu est reconstitué à partir du dossier (statut actuel omis).
 */
export function RecuDepotCard({ documents, modele }: {
  /** Pièces du dossier telles que le serveur les renvoie à l'utilisateur. */
  documents: DocumentDto[];
  /** Modèle du reçu reconstitué (`regenerated`), ou `null` si la reconstitution n'est pas proposée. */
  modele: RecuModele | null;
}) {
  const { t } = useTranslation(["demandes"]);
  const { toast } = useToast();
  const [busy, setBusy] = useState<"open" | "download" | false>(false);
  const versions = recuVersions(documents);

  const regenerate = async (mode: "open" | "download") => {
    if (!modele) return;
    setBusy(mode);
    const name = recuFileName(modele);
    try {
      await trackDocumentTask(`recu-depot:${modele.processus}:${modele.reference}:${mode}`, "generate", name, async () => {
        await new Promise((r) => setTimeout(r, 0)); // laisse l'attente s'afficher avant la génération
        presentBlob(await generateRecuPdf(modele, { documents, regenerated: true }), name, mode);
      });
    } catch (e) {
      toast({ title: t("demandes:detail.recu_card.error"), description: formatApiErrorMessage(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!versions.length && !modele) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <FileText className="h-8 w-8 text-primary shrink-0" />
          <div className="flex-1 min-w-[12rem]">
            <p className="text-sm font-semibold">{t("demandes:detail.recu_card.title")}</p>
            <p className="text-xs text-muted-foreground">
              {versions.length > 1
                ? t("demandes:detail.recu_card.description_multi")
                : versions.length
                  ? t("demandes:detail.recu_card.description")
                  : t("demandes:detail.recu_card.not_stored")}
            </p>
          </div>
          {!versions.length && modele && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={!!busy} aria-busy={busy === "open" || undefined} onClick={() => void regenerate("open")}>
                {busy === "open" ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <ExternalLink className="h-4 w-4 me-1" />} {t("demandes:detail.recu_card.open")}
              </Button>
              <Button size="sm" disabled={!!busy} aria-busy={busy === "download" || undefined} onClick={() => void regenerate("download")}>
                {busy === "download" ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Download className="h-4 w-4 me-1" />}
                {t("demandes:detail.recu_card.download")}
              </Button>
            </div>
          )}
        </div>

        {versions.length > 0 && (
          <ul className="divide-y rounded-md border bg-background" aria-label={t("demandes:detail.recu_card.versions")}>
            {versions.map((d, i) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="font-medium">{t("demandes:detail.recu_card.version", { version: d.version ?? versions.length - i })}</span>
                {d.dateUpload && <span className="text-xs text-muted-foreground">{t("demandes:detail.recu_card.depose_le", { date: formatDateTime(d.dateUpload) })}</span>}
                {i === 0 && d.actif !== false && <Badge variant="secondary" className="text-[10px]">{t("demandes:detail.recu_card.version_courante")}</Badge>}
                <span className="flex-1" />
                <DocumentButton doc={d} mode="open" variant="ghost" size="sm" icon={ExternalLink}>{t("demandes:detail.recu_card.open")}</DocumentButton>
                <DocumentButton doc={d} mode="download" variant="outline" size="sm" icon={Download}>{t("demandes:detail.recu_card.download")}</DocumentButton>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
