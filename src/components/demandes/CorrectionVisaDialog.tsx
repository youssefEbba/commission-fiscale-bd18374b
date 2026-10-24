import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { demandeCorrectionApi, type DemandeCorrectionDto } from "@/lib/api";
import { useCorrectionVisaState } from "@/hooks/useCorrectionVisaState";
import { requiredPreVisaDocCorrection, resolveCredits } from "@/lib/visas";
import {
  declaredMontants, initialMontantsDraft, parseMontants, type CorrectionMontantsDraft,
} from "@/lib/correctionMontants";
import { tTypeDocument } from "@/i18n/enums";
import { showApiError, showSuccess } from "@/lib/feedback";
import CorrectionMontantsFields from "./CorrectionMontantsFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw } from "lucide-react";

interface Props {
  /** Demande à viser ; `null` ferme la boîte. */
  demande: DemandeCorrectionDto | null;
  role: string | null | undefined;
  onClose: () => void;
  /** Appelé après un visa réussi (rafraîchir la page). */
  onDone: () => void | Promise<void>;
}

/**
 * Visa d'une direction sur une demande de correction.
 * Document pré-visa et saisie des crédits retenus pilotés par `GET /visas`
 * (`codeDocumentRequis`, `documentRequisPresent`, `saisieMontantsExigee`), relu à chaque ouverture.
 */
const CorrectionVisaDialog = ({ demande, role, onClose, onDone }: Props) => {
  const { t } = useTranslation();
  const open = !!demande;
  const visaState = useCorrectionVisaState(demande?.id, role, open);
  const { row, saisieExigee } = visaState;

  // Repli si l'état serveur est illisible : document déduit des crédits + liste des pièces.
  const [fallbackDocPresent, setFallbackDocPresent] = useState<boolean | null>(null);
  const fallbackDocType = requiredPreVisaDocCorrection(role, resolveCredits(demande));
  const docType = row ? row.codeDocumentRequis : visaState.error ? fallbackDocType : null;
  const docPresent = row ? row.documentRequisPresent : fallbackDocPresent === true;
  const needsFile = !!docType && !docPresent;

  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<CorrectionMontantsDraft>(() => initialMontantsDraft(demande));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!demande) return;
    setFile(null);
    setDraft(initialMontantsDraft(demande));
    setFallbackDocPresent(null);
  }, [demande?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!demande || !visaState.error || !fallbackDocType) return;
    demandeCorrectionApi.getDocuments(demande.id)
      .then((docs) => setFallbackDocPresent(docs.some((d) => ((d as any).codeDocument ?? d.type) === fallbackDocType && d.actif !== false)))
      .catch(() => setFallbackDocPresent(false));
  }, [demande?.id, visaState.error, fallbackDocType]); // eslint-disable-line react-hooks/exhaustive-deps

  const montants = saisieExigee ? parseMontants(draft) : null;
  const stateLoading = visaState.active && !visaState.visas && !visaState.error;
  const canSubmit = !!demande && !submitting && !stateLoading && (!needsFile || !!file) && (!saisieExigee || !!montants);
  const docLabel = docType ? tTypeDocument(docType) : "";

  const submit = async () => {
    if (!demande || !canSubmit) return;
    setSubmitting(true);
    try {
      if (needsFile && file && docType) {
        await demandeCorrectionApi.uploadDocument(demande.id, docType, file);
        showSuccess(t("correction_douaniere:visa_dialog.success_title"), t("correction_douaniere:toast.pre_visa_success", { label: docLabel }));
        setFile(null);
      }
      await demandeCorrectionApi.postDecision(demande.id, "VISA", undefined, undefined, saisieExigee ? montants : undefined);
      showSuccess(t("correction_douaniere:visa_dialog.success_title"), t("correction_douaniere:toast.visa_success"));
      onClose();
      await onDone();
    } catch (e) {
      showApiError(e);
      // Le document a pu être déposé avant le refus : relire l'état serveur.
      await visaState.reload();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("correction_douaniere:visa_dialog.title")}</DialogTitle>
          <DialogDescription>{t("correction_douaniere:visa_dialog.irreversible")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {stateLoading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("correction_douaniere:visa_dialog.loading")}
            </p>
          )}

          {visaState.error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-2">
              <p className="flex items-start gap-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {t("correction_douaniere:visa_dialog.state_error", { message: visaState.error })}
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => visaState.reload()} disabled={visaState.loading}>
                <RefreshCw className="h-3 w-3 me-1" /> {t("correction_douaniere:visa_dialog.retry")}
              </Button>
            </div>
          )}

          {row?.visaPrealableManquant && (
            <p className="text-xs text-amber-700 flex items-start gap-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {row.motifBlocage || t("correction_douaniere:actions.blocked_by_first_body", { role: row.visaPrealableManquant })}
            </p>
          )}

          {docType && (
            docPresent ? (
              <p className="flex items-center gap-2 text-xs text-green-700">
                <CheckCircle className="h-4 w-4" /> {t("correction_douaniere:actions.upload_done", { label: docLabel })}
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {docLabel} <span className="text-destructive">*</span>
                </Label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={submitting} />
                <p className="text-[11px] text-muted-foreground">
                  {t("correction_douaniere:dialog.pre_visa.description", { label: docLabel })}
                </p>
              </div>
            )
          )}

          {saisieExigee && (
            <CorrectionMontantsFields
              draft={draft}
              onChange={setDraft}
              declared={declaredMontants(demande)}
              disabled={submitting}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("correction_douaniere:dialog.pre_visa.cancel")}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <CheckCircle className="h-4 w-4 me-1" />}
            {t("correction_douaniere:visa_dialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CorrectionVisaDialog;
