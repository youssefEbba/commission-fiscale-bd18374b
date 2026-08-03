import { useMemo, useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  adminCorrectionApi,
  ApiRequestError,
  DocumentDto,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type AdminCorrectionEntity = "DEMANDE" | "CERTIFICAT" | "UTILISATION";

export interface AdminCorrectionField {
  /** Clé du champ attendue par l'API (ex. `creditInterieur`). */
  key: string;
  label: string;
  type: "text" | "number" | "date";
  /** Valeur actuelle utilisée comme pré-remplissage et référence de diff. */
  value?: string | number | null;
  /** Message d'avertissement affiché sous le champ (ex. verrou 409). */
  hint?: string;
}

interface AdminCorrectionCardProps {
  entity: AdminCorrectionEntity;
  entityId: number;
  /** Champs corrigeables pour cette entité, pré-remplis. */
  fields: AdminCorrectionField[];
  /** Documents existants — sert à choisir celui à remplacer. */
  documents?: DocumentDto[];
  /** Codes de documents supplémentaires proposés (types attendus non encore uploadés). */
  extraDocTypes?: string[];
  /** Traduit un code document en libellé lisible. */
  docLabel?: (code: string) => string;
  /** Rechargement de la page appelante après succès. */
  onSuccess: () => void;
}

const toInputValue = (v: string | number | null | undefined, type: AdminCorrectionField["type"]) => {
  if (v === null || v === undefined) return "";
  if (type === "date") return String(v).slice(0, 10);
  return String(v);
};

/**
 * Correction administrateur (ADMIN_SI) — disponible à tout moment du workflow,
 * quel que soit le statut de l'entité. Motif obligatoire, journalisé en audit
 * sous l'action ADMIN_CORRECTION.
 */
const AdminCorrectionCard = ({
  entity,
  entityId,
  fields,
  documents = [],
  extraDocTypes = [],
  docLabel,
  onSuccess,
}: AdminCorrectionCardProps) => {
  const { hasRole } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [motif, setMotif] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [docCode, setDocCode] = useState<string>("");
  const [docFile, setDocFile] = useState<File | null>(null);

  const initial = useMemo(() => {
    const map: Record<string, string> = {};
    fields.forEach((f) => { map[f.key] = toInputValue(f.value, f.type); });
    return map;
  }, [fields]);

  const docOptions = useMemo(() => {
    const codes = new Set<string>();
    documents.forEach((d) => {
      const code = d.codeDocument || d.type;
      if (code) codes.add(code);
    });
    extraDocTypes.forEach((c) => c && codes.add(c));
    return Array.from(codes).sort((a, b) =>
      (docLabel?.(a) ?? a).localeCompare(docLabel?.(b) ?? b, "fr", { sensitivity: "base" }),
    );
  }, [documents, extraDocTypes, docLabel]);

  if (!hasRole(["ADMIN_SI"])) return null;

  const openDialog = () => {
    setValues({ ...initial });
    setMotif("");
    setDocCode("");
    setDocFile(null);
    setOpen(true);
  };

  // Seuls les champs réellement modifiés sont envoyés (patch partiel).
  const changedFields = fields.filter((f) => (values[f.key] ?? "") !== (initial[f.key] ?? ""));
  const hasDocReplacement = !!docCode && !!docFile;
  const canSubmit = motif.trim().length > 0 && (changedFields.length > 0 || hasDocReplacement);

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    changedFields.forEach((f) => {
      const raw = (values[f.key] ?? "").trim();
      if (raw === "") return;
      payload[f.key] = f.type === "number" ? Number(raw) : raw;
    });
    return payload;
  };

  const submit = async () => {
    const trimmedMotif = motif.trim();
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (Object.keys(payload).length > 0) {
        if (entity === "DEMANDE") await adminCorrectionApi.patchDemande(entityId, trimmedMotif, payload);
        else if (entity === "CERTIFICAT") await adminCorrectionApi.patchCertificat(entityId, trimmedMotif, payload);
        else await adminCorrectionApi.patchUtilisation(entityId, trimmedMotif, payload);
      }
      if (hasDocReplacement && docFile) {
        if (entity === "DEMANDE") await adminCorrectionApi.replaceDemandeDocument(entityId, docCode, trimmedMotif, docFile);
        else if (entity === "CERTIFICAT") await adminCorrectionApi.replaceCertificatDocument(entityId, docCode, trimmedMotif, docFile);
        else await adminCorrectionApi.replaceUtilisationDocument(entityId, docCode, trimmedMotif, docFile);
      }
      toast({
        title: "Correction enregistrée",
        description: "L'action a été journalisée dans l'audit (ADMIN_CORRECTION).",
      });
      setConfirmOpen(false);
      setOpen(false);
      onSuccess();
    } catch (err) {
      const apiErr = err instanceof ApiRequestError ? err : null;
      toast({
        title: apiErr?.status === 409 ? "Modification bloquée" : "Échec de la correction",
        description:
          apiErr?.message ||
          "La correction n'a pas pu être appliquée. Aucune modification n'a été enregistrée.",
        variant: "destructive",
      });
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className="border-amber-300/70 bg-amber-50/40 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Correction administrateur
          </CardTitle>
          <CardDescription>
            Réservé au rôle ADMIN_SI. Permet de corriger une information ou de remplacer un
            document mal chargé à tout moment du workflow. Chaque action exige un motif et est
            journalisée dans le journal d'audit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={openDialog}>
            <ShieldAlert className="h-4 w-4 me-2" />
            Ouvrir la correction administrateur
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!submitting) setOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Correction administrateur</DialogTitle>
            <DialogDescription>
              Modifiez uniquement les champs concernés. Un motif est obligatoire et sera conservé
              dans l'audit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-correction-motif">
                Motif de la correction <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="admin-correction-motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. : document erroné transmis par l'autorité contractante, montant saisi à tort…"
                rows={3}
              />
            </div>

            {fields.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Informations</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label htmlFor={`admin-field-${f.key}`}>{f.label}</Label>
                      <Input
                        id={`admin-field-${f.key}`}
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                      {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Remplacer un document</p>
              <p className="text-xs text-muted-foreground">
                L'ancienne version est désactivée mais conservée dans l'historique.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Type de document</Label>
                  <Select value={docCode} onValueChange={setDocCode}>
                    <SelectTrigger aria-label="Type de document">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {docOptions.length === 0 ? (
                        <SelectItem value="__none" disabled>Aucun document disponible</SelectItem>
                      ) : docOptions.map((code) => (
                        <SelectItem key={code} value={code}>{docLabel?.(code) ?? code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-correction-file">Nouveau fichier</Label>
                  <Input
                    id="admin-correction-file"
                    type="file"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSubmit || submitting}>
              Appliquer la correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => { if (!submitting) setConfirmOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Action à journaliser</AlertDialogTitle>
            <AlertDialogDescription>
              Cette correction administrateur sera enregistrée dans le journal d'audit avec votre
              identifiant et le motif saisi.
              {changedFields.length > 0 && (
                <>
                  <br />
                  Champs modifiés : {changedFields.map((f) => f.label).join(", ")}.
                </>
              )}
              {hasDocReplacement && (
                <>
                  <br />
                  Document remplacé : {docLabel?.(docCode) ?? docCode}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); submit(); }}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminCorrectionCard;
