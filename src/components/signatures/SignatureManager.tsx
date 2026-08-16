import { useCallback, useEffect, useRef, useState } from "react";
import { PenLine, Upload, RefreshCw, Trash2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signatureApi, formatApiErrorMessage, ROLE_LABELS, type SignatureDto } from "@/lib/api";
import { clearSignatureCache, validateSignatureFile } from "@/lib/signatures";
import { cn } from "@/lib/utils";

interface SignatureManagerProps {
  role: string;
  utilisateurId?: number;
  utilisateurNom?: string;
  /** Faux = lecture seule (aperçu uniquement). */
  canEdit?: boolean;
  title?: string;
  description?: string;
  /** Encapsuler dans une Card (défaut : true). */
  card?: boolean;
  onChanged?: () => void;
}

const SignatureManager = ({
  role,
  utilisateurId,
  utilisateurNom,
  canEdit = true,
  title = "Ma signature",
  description,
  card = true,
  onChanged,
}: SignatureManagerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SignatureDto | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; dataUrl: string; w: number; h: number } | null>(null);
  const [nomAffiche, setNomAffiche] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dto = await signatureApi.getActive(role, utilisateurId);
      setActive(dto);
      setNomAffiche(dto?.nomAffiche || "");
      if (dto?.id) {
        try {
          const { dataUrl } = await signatureApi.getBase64(dto.id);
          setPreview(dataUrl || null);
        } catch {
          setPreview(null);
        }
      } else {
        setPreview(null);
      }
    } catch {
      // 404 = pas de signature configurée
      setActive(null);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [role, utilisateurId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickFile = async (file?: File | null) => {
    if (!file) return;
    const check = await validateSignatureFile(file);
    if (!check.ok) {
      toast({ title: "Fichier refusé", description: check.error, variant: "destructive" });
      return;
    }
    setPending({ file, dataUrl: check.dataUrl!, w: check.width!, h: check.height! });
  };

  const submit = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      if (active?.id) {
        await signatureApi.remplacer(active.id, pending.file);
        if (nomAffiche && nomAffiche !== (active.nomAffiche || "")) {
          await signatureApi.update(active.id, { nomAffiche });
        }
      } else {
        await signatureApi.create({
          file: pending.file,
          role,
          utilisateurId,
          nomAffiche: nomAffiche || undefined,
          activer: true,
        });
      }
      clearSignatureCache();
      setPending(null);
      if (inputRef.current) inputRef.current.value = "";
      toast({ title: "Signature enregistrée", description: "Elle sera apposée sur les documents générés." });
      await load();
      onChanged?.();
    } catch (err) {
      toast({ title: "Erreur", description: formatApiErrorMessage(err, "Enregistrement impossible"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!active?.id) return;
    setSaving(true);
    try {
      await signatureApi.desactiver(active.id);
      clearSignatureCache();
      toast({ title: "Signature désactivée", description: "L'historique est conservé." });
      await load();
      onChanged?.();
    } catch (err) {
      toast({ title: "Erreur", description: formatApiErrorMessage(err, "Désactivation impossible"), variant: "destructive" });
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const body = (
    <div className="space-y-4">
      {description && <p className="text-sm text-muted-foreground">{description}</p>}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{ROLE_LABELS[role] || role}</Badge>
        {utilisateurNom && <span className="text-muted-foreground">{utilisateurNom}</span>}
        {active ? (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            Active — version {active.version ?? 1}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Aucune signature active</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Signature actuelle</p>
          <div className="h-28 rounded-lg border border-border bg-muted/20 flex items-center justify-center overflow-hidden">
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : preview ? (
              <img src={preview} alt={`Signature ${ROLE_LABELS[role] || role}`} className="max-h-24 max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ImageOff className="h-4 w-4" /> Aucune image
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Nouvelle signature</p>
          <div
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              setDragOver(false);
              void pickFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => canEdit && inputRef.current?.click()}
            className={cn(
              "h-28 rounded-lg border border-dashed flex items-center justify-center overflow-hidden transition-colors",
              canEdit ? "cursor-pointer hover:border-primary/60" : "opacity-60",
              dragOver ? "border-primary bg-primary/5" : "border-border bg-background",
            )}
          >
            {pending ? (
              <img src={pending.dataUrl} alt="Aperçu de la nouvelle signature" className="max-h-24 max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-3">
                Glissez un PNG à fond transparent ici
                <br />
                <span className="text-[11px]">ou cliquez pour choisir — max 1 Mo, 2000x1000 px</span>
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {canEdit && (
        <div className="space-y-2">
          <Label className="text-xs">Libellé imprimé sous la signature (facultatif)</Label>
          <Input
            value={nomAffiche}
            onChange={(e) => setNomAffiche(e.target.value)}
            placeholder="Ex. Le Président de la Commission Fiscale"
            maxLength={150}
          />
        </div>
      )}

      {pending && (
        <p className="text-xs text-muted-foreground">
          {pending.file.name} — {pending.w}x{pending.h} px, {(pending.file.size / 1024).toFixed(0)} Ko
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {pending && (
            <Button variant="ghost" size="sm" onClick={() => { setPending(null); if (inputRef.current) inputRef.current.value = ""; }} disabled={saving}>
              Annuler
            </Button>
          )}
          {active && (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-2" /> Désactiver
            </Button>
          )}
          <Button size="sm" onClick={submit} disabled={!pending || saving}>
            <Upload className="h-4 w-4 mr-2" />
            {saving ? "Envoi…" : active ? "Remplacer la signature" : "Enregistrer la signature"}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver cette signature ?</AlertDialogTitle>
            <AlertDialogDescription>
              La signature ne sera plus apposée sur les documents générés. L'historique est conservé côté serveur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void deactivate(); }} disabled={saving}>
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (!card) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
};

export default SignatureManager;
