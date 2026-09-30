import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, PenLine, Stamp, Download, Upload, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { signatureApi, formatApiErrorMessage, type MesEmpreintesDto, type ModeApposition } from "@/lib/api";
import type { AppositionOptions } from "@/lib/signatures";

/**
 * Parcours de signature du Président pour un document officiel
 * (lettre d'adoption, certificat de crédit d'impôt, certificat d'utilisation).
 * - Système : incruste signature + cachet enregistrés, puis dépose (APPOSE_SYSTEME).
 * - Manuel : télécharge le modèle vierge, puis dépose le scan (MANUSCRIT_SCANNE).
 * `prepare` est appelé avant toute génération (ex. émission du certificat d'utilisation
 * pour obtenir son numéro) ; son résultat est passé à `generate`.
 */
interface PresidentSignDialogProps<P> {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  filename: string;
  prepare?: () => Promise<P>;
  generate: (apposition: AppositionOptions, prepared: P | undefined) => Promise<Blob>;
  upload: (file: File, mode: ModeApposition) => Promise<void>;
  onDone?: () => void;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PresidentSignDialog<P = unknown>({ open, onOpenChange, title, filename, prepare, generate, upload, onDone }: PresidentSignDialogProps<P>) {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [emp, setEmp] = useState<MesEmpreintesDto | null>(null);
  const [loadingEmp, setLoadingEmp] = useState(false);
  const [busy, setBusy] = useState<"systeme" | "modele" | "scan" | null>(null);
  const [scan, setScan] = useState<File | null>(null);
  const [prepared, setPrepared] = useState<P | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setScan(null);
    setPrepared(undefined);
    setLoadingEmp(true);
    signatureApi.me(true)
      .then(setEmp)
      .catch(() => setEmp(null))
      .finally(() => setLoadingEmp(false));
  }, [open]);

  const ensurePrepared = async (): Promise<P | undefined> => {
    if (!prepare) return undefined;
    if (prepared !== undefined) return prepared;
    const p = await prepare();
    setPrepared(p);
    return p;
  };

  const missing: string[] = [];
  if (!emp?.signature || !emp?.signatureDataUrl) missing.push(t("president_sign.signature"));
  if (!emp?.cachet || !emp?.cachetDataUrl) missing.push(t("president_sign.cachet"));
  const systemeDisponible = !loadingEmp && missing.length === 0;

  const err = (e: unknown) =>
    toast({ title: t("states.error", { defaultValue: "Erreur" }), description: formatApiErrorMessage(e, "Erreur"), variant: "destructive" });

  const runSysteme = async () => {
    if (!emp) return;
    setBusy("systeme");
    try {
      const p = await ensurePrepared();
      const blob = await generate({ mode: "APPOSE_SYSTEME", signatureDataUrl: emp.signatureDataUrl, cachetDataUrl: emp.cachetDataUrl }, p);
      const file = new File([blob], filename, { type: "application/pdf" });
      await upload(file, "APPOSE_SYSTEME");
      download(blob, filename);
      toast({ title: t("president_sign.done") });
      onOpenChange(false);
      onDone?.();
    } catch (e) { err(e); } finally { setBusy(null); }
  };

  const runModele = async () => {
    setBusy("modele");
    try {
      const p = await ensurePrepared();
      const blob = await generate({ mode: "MANUSCRIT_SCANNE" }, p);
      download(blob, filename);
    } catch (e) { err(e); } finally { setBusy(null); }
  };

  const runScan = async () => {
    if (!scan) return;
    setBusy("scan");
    try {
      await ensurePrepared();
      await upload(scan, "MANUSCRIT_SCANNE");
      toast({ title: t("president_sign.done") });
      onOpenChange(false);
      onDone?.();
    } catch (e) { err(e); } finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title || t("president_sign.title")}</DialogTitle>
          <DialogDescription>{t("president_sign.intro")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-2">
            <p className="font-medium text-sm flex items-center gap-2"><Stamp className="h-4 w-4 text-primary" /> {t("president_sign.systeme_title")}</p>
            <p className="text-xs text-muted-foreground">{t("president_sign.systeme_desc")}</p>
            {loadingEmp ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {t("president_sign.loading")}</p>
            ) : missing.length > 0 ? (
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-accent-foreground" /> {t("president_sign.manquant", { items: missing.join(", ") })}</p>
                <Link to="/dashboard/profil" className="text-primary underline">{t("president_sign.profil_link")}</Link>
              </div>
            ) : (
              <div className="flex items-center gap-3 h-14">
                {emp?.signatureDataUrl && <img src={emp.signatureDataUrl} alt="" className="max-h-12 object-contain" />}
                {emp?.cachetDataUrl && <img src={emp.cachetDataUrl} alt="" className="max-h-12 object-contain" />}
              </div>
            )}
            <Button size="sm" onClick={runSysteme} disabled={!systemeDisponible || !!busy}>
              {busy === "systeme" ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <PenLine className="h-4 w-4 me-2" />}
              {t("president_sign.systeme_btn")}
            </Button>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-2">
            <p className="font-medium text-sm flex items-center gap-2"><PenLine className="h-4 w-4 text-primary" /> {t("president_sign.manuel_title")}</p>
            <p className="text-xs text-muted-foreground">{t("president_sign.manuel_desc")}</p>
            <Button size="sm" variant="outline" onClick={runModele} disabled={!!busy}>
              {busy === "modele" ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Download className="h-4 w-4 me-2" />}
              {t("president_sign.manuel_download")}
            </Button>
            <div className="space-y-1">
              <Label className="text-xs">{t("president_sign.manuel_file")}</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setScan(e.target.files?.[0] || null)} />
            </div>
            <Button size="sm" variant="outline" onClick={runScan} disabled={!scan || !!busy}>
              {busy === "scan" ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Upload className="h-4 w-4 me-2" />}
              {t("president_sign.manuel_upload")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PresidentSignDialog;
