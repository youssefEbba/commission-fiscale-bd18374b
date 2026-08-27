import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { demandeCorrectionApi, VisaEtatDto } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { tTypeDocument } from "@/i18n/enums";
import { formatDate } from "@/i18n/format";
import { showApiError, showSuccess } from "@/lib/feedback";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, CheckCircle, Loader2, AlertTriangle } from "lucide-react";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";

interface Props {
  demandeId: number;
  /** Rafraîchit la demande parente après un visa administrateur. */
  onSuccess?: () => void;
}

const AdminVisasCard = ({ demandeId, onSuccess }: Props) => {
  const { t } = useTranslation();
  const { hasPermission, hasRole } = useAuth();
  const canOverride = hasPermission("correction.visa.admin_override") || hasRole(["ADMIN_SI"]);

  const [visas, setVisas] = useState<VisaEtatDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<VisaEtatDto | null>(null);
  const [motif, setMotif] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await demandeCorrectionApi.getVisas(demandeId);
      setVisas(Array.isArray(data) ? data : []);
    } catch {
      setVisas([]);
    } finally {
      setLoading(false);
    }
  }, [demandeId]);

  useEffect(() => { if (canOverride) load(); }, [canOverride, load]);

  if (!canOverride) return null;

  const openDialog = (v: VisaEtatDto) => {
    setTarget(v);
    setMotif("");
    setFile(null);
  };

  const roleLabel = (role: string) => t(`roles:${role}`, { defaultValue: role });

  const fileRequired = !!target?.codeDocumentRequis && !target?.documentRequisPresent;

  const submit = async () => {
    if (!target) return;
    if (!motif.trim()) return;
    if (fileRequired && !file) return;
    setSubmitting(true);
    try {
      const res = await demandeCorrectionApi.poserVisaAdmin(demandeId, target.role, motif.trim(), file);
      if (Array.isArray(res?.visas)) setVisas(res.visas);
      else await load();
      setTarget(null);
      showSuccess(
        t("demandes:detail.admin_visas.toast_title"),
        t("demandes:detail.admin_visas.toast_desc", { role: roleLabel(target.role) }),
      );
      onSuccess?.();
    } catch (e) {
      showApiError(e, t("demandes:detail.admin_visas.error_title"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className="border-primary/30">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{t("demandes:detail.admin_visas.title")}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{t("demandes:detail.admin_visas.description")}</p>

          {loading && !visas ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("common:states.loading")}
            </div>
          ) : !visas || visas.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("common:states.empty")}</p>
          ) : (
            <div className="space-y-2">
              {visas.map((v) => {
                const isPresident = v.role === "PRESIDENT";
                return (
                  <div key={v.role} className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{roleLabel(v.role)}</span>
                        {v.pose ? (
                          <Badge className="bg-green-100 text-green-700 text-[10px]">
                            <CheckCircle className="h-3 w-3 me-1" />
                            {isPresident
                              ? t("demandes:detail.admin_visas.state_adopted")
                              : t("demandes:detail.admin_visas.state_posed")}
                          </Badge>
                        ) : !v.requis ? (
                          <Badge variant="outline" className="text-[10px]">{t("demandes:detail.admin_visas.state_not_concerned")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            {t("demandes:detail.admin_visas.state_pending")}
                          </Badge>
                        )}
                        {v.visaParAdmin && (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                            {t("demandes:detail.admin_visas.by_admin")}
                          </Badge>
                        )}
                      </div>
                      {v.pose && (v.datePose || v.utilisateurNom) && (
                        <p className="text-[11px] text-muted-foreground">
                          {t("demandes:detail.admin_visas.posed_meta", {
                            date: v.datePose ? formatDate(v.datePose) : "—",
                            user: v.utilisateurNom || "—",
                          })}
                        </p>
                      )}
                      {v.codeDocumentRequis && (
                        <p className="text-[11px] text-muted-foreground">
                          {t("demandes:detail.admin_visas.doc_required")} : {tTypeDocument(v.codeDocumentRequis)} —{" "}
                          <span className={v.documentRequisPresent ? "text-green-700" : "text-amber-700"}>
                            {v.documentRequisPresent
                              ? t("demandes:detail.admin_visas.doc_present")
                              : t("demandes:detail.admin_visas.doc_missing")}
                          </span>
                        </p>
                      )}
                      {!v.pose && !v.visableParAdmin && v.motifBlocage && (
                        <p className="text-[11px] text-amber-700 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {v.motifBlocage}
                        </p>
                      )}
                    </div>
                    {!v.pose && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!v.visableParAdmin}
                        title={!v.visableParAdmin ? v.motifBlocage ?? undefined : undefined}
                        onClick={() => openDialog(v)}
                      >
                        {isPresident
                          ? t("demandes:detail.admin_visas.action_adopt")
                          : t("demandes:detail.admin_visas.action_visa", { role: roleLabel(v.role) })}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o && !submitting) setTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {target?.role === "PRESIDENT"
                ? t("demandes:detail.admin_visas.action_adopt")
                : t("demandes:detail.admin_visas.action_visa", { role: target ? roleLabel(target.role) : "" })}
            </DialogTitle>
            <DialogDescription>
              {t("demandes:detail.admin_visas.dialog_warning", { role: target ? roleLabel(target.role) : "" })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("demandes:detail.admin_visas.motif_label")} *</Label>
              <Textarea
                rows={3}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder={t("demandes:detail.admin_visas.motif_placeholder")}
              />
            </div>
            {target?.codeDocumentRequis && (
              <div className="space-y-1.5">
                <Label>
                  {tTypeDocument(target.codeDocumentRequis)} {fileRequired ? "*" : `(${t("demandes:detail.admin_visas.file_optional")})`}
                </Label>
                <Input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={submitting}>
              {t("common:actions.cancel")}
            </Button>
            <Button onClick={submit} disabled={submitting || !motif.trim() || (fileRequired && !file)}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {t("demandes:detail.admin_visas.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminVisasCard;
