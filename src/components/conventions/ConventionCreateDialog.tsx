import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PDFDocument } from "pdf-lib";
import {
  conventionApi, ConventionDto, CreateConventionRequest,
  TypeDocumentConvention, CONVENTION_DOCUMENT_TYPES,
  bailleurApi, BailleurDto,
  deviseApi, DeviseDto, CreateDeviseRequest,
  forexApi,
  documentRequirementApi, DocumentRequirementDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UploadRow } from "@/components/ui/upload-row";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ArrowDown, ArrowUp, CheckCircle, File, Loader2, Merge, Paperclip, Plus, XCircle } from "lucide-react";
import { tTypeDocument, tDocRequirementLabel } from "@/i18n/enums";
import { formatNumber } from "@/i18n/format";
import { DEFAULT_DEVISES } from "./ConventionEditDialog";
import BailleursField from "./BailleursField";

const todayIso = () => new Date().toISOString().slice(0, 10);

type CreateForm = Omit<CreateConventionRequest, "bailleurId" | "bailleurIds"> & { bailleurIds: number[] };

const emptyForm = (): CreateForm => ({
  reference: "", intitule: "", bailleurIds: [],
  dateSignature: "", dateFin: "",
  montantDevise: undefined, deviseOrigine: "", montantMru: undefined, tauxChange: undefined,
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Appelé avec la convention créée (documents déjà envoyés). */
  onCreated: (created: ConventionDto) => void;
}

/**
 * Création d'une convention (POST /api/conventions) avec bailleurs multiples et pièces GED.
 * Utilisée depuis la liste des conventions et depuis le formulaire de marché (création à la volée).
 */
const ConventionCreateDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { t } = useTranslation(["conventions", "common"]);
  const { toast } = useToast();
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [creating, setCreating] = useState(false);

  const [bailleurs, setBailleurs] = useState<BailleurDto[]>([]);
  const [bailleursLoading, setBailleursLoading] = useState(false);

  const [devises, setDevises] = useState<DeviseDto[]>([]);
  const [devisesLoading, setDevisesLoading] = useState(false);
  const [addDeviseOpen, setAddDeviseOpen] = useState(false);
  const [newDevise, setNewDevise] = useState<CreateDeviseRequest>({ code: "", libelle: "", symbole: "" });
  const [addingDevise, setAddingDevise] = useState(false);
  const [tauxLoading, setTauxLoading] = useState(false);

  const [gedRequirements, setGedRequirements] = useState<DocumentRequirementDto[]>([]);
  const [gedReqLoading, setGedReqLoading] = useState(false);
  const [createDocs, setCreateDocs] = useState<{ type: TypeDocumentConvention; file: File }[]>([]);
  const [createDocType, setCreateDocType] = useState<TypeDocumentConvention>("CONVENTION_CONTRAT");
  const [merging, setMerging] = useState(false);

  const today = todayIso();

  // Référentiels + exigences GED à chaque ouverture
  useEffect(() => {
    if (!open) return;
    setBailleursLoading(true);
    bailleurApi.getAll().then(setBailleurs).catch(() => {}).finally(() => setBailleursLoading(false));
    setDevisesLoading(true);
    deviseApi.getAll()
      .then((fetched) => {
        const codes = new Set(fetched.map((d) => d.code));
        setDevises([...fetched, ...DEFAULT_DEVISES.filter((d) => !codes.has(d.code))]);
      })
      .catch(() => setDevises(DEFAULT_DEVISES))
      .finally(() => setDevisesLoading(false));
    setGedReqLoading(true);
    documentRequirementApi.getByProcessus("CONVENTION")
      .then((reqs) => {
        const valid = (reqs || []).filter((r) => !!r.typeDocument);
        setGedRequirements(valid);
        const firstValid = valid.find((r) => !!r.typeDocument);
        if (firstValid) setCreateDocType(firstValid.typeDocument as TypeDocumentConvention);
      })
      .catch(() => setGedRequirements([]))
      .finally(() => setGedReqLoading(false));
  }, [open]);

  // Taux de change automatique à chaque changement de devise
  useEffect(() => {
    if (!form.deviseOrigine || form.deviseOrigine === "MRU") {
      setForm((f) => ({ ...f, tauxChange: form.deviseOrigine === "MRU" ? 1 : undefined, montantMru: form.deviseOrigine === "MRU" && f.montantDevise ? f.montantDevise : undefined }));
      return;
    }
    let cancelled = false;
    setTauxLoading(true);
    forexApi.rate(form.deviseOrigine, "MRU")
      .then((res) => {
        if (cancelled) return;
        const rate = Math.round(res.rate * 10000) / 10000;
        setForm((f) => ({ ...f, tauxChange: rate, montantMru: f.montantDevise ? Math.round(f.montantDevise * rate * 100) / 100 : undefined }));
        toast({ title: t("conventions:create.rate_fetched"), description: t("conventions:create.rate_value", { currency: form.deviseOrigine, rate: formatNumber(rate) }) });
      })
      .catch(() => {
        if (!cancelled) toast({ title: t("common:errors.title", "Erreur"), description: t("conventions:create.rate_error", { currency: form.deviseOrigine }), variant: "destructive" });
      })
      .finally(() => { if (!cancelled) setTauxLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.deviseOrigine]);

  const handleDeviseChange = (code: string) => {
    setForm((f) => ({ ...f, deviseOrigine: code, tauxChange: undefined, montantMru: undefined }));
  };

  const handleAddDevise = async () => {
    if (!newDevise.code.trim() || !newDevise.libelle.trim()) return;
    setAddingDevise(true);
    try {
      const created = await deviseApi.create(newDevise);
      setDevises((prev) => [...prev, created]);
      handleDeviseChange(created.code);
      setAddDeviseOpen(false);
      setNewDevise({ code: "", libelle: "", symbole: "" });
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:devise.added") });
    } catch (e: any) {
      toast({ title: t("common:errors.title", "Erreur"), description: e.message, variant: "destructive" });
    } finally {
      setAddingDevise(false);
    }
  };

  const addCreateDoc = (file: File) => setCreateDocs((prev) => [...prev, { type: createDocType, file }]);
  const removeCreateDoc = (index: number) => setCreateDocs((prev) => prev.filter((_, i) => i !== index));
  const moveCreateDoc = (index: number, direction: "up" | "down") => {
    setCreateDocs((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const mergeCreateDocs = useCallback(async () => {
    const pdfFiles = createDocs
      .filter((d) => d.file.type === "application/pdf" || d.file.name.toLowerCase().endsWith(".pdf"))
      .map((d) => d.file);
    if (pdfFiles.length < 2) {
      toast({ title: t("conventions:docs.merge_impossible"), description: t("conventions:docs.merge_min_two_pdf"), variant: "destructive" });
      return;
    }
    setMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of pdfFiles) {
        const pdf = await PDFDocument.load(await file.arrayBuffer());
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }
      const mergedBytes = await mergedPdf.save();
      const mergedFile = new window.File([new Blob([mergedBytes as BlobPart], { type: "application/pdf" })], "convention_fusionnee.pdf", { type: "application/pdf" });
      // Garde le type CONVENTION_CONTRAT si un des fichiers fusionnés l'était, pour ne pas bloquer la création
      const mergedType: TypeDocumentConvention = createDocs.some((d) => d.type === "CONVENTION_CONTRAT")
        ? "CONVENTION_CONTRAT" as TypeDocumentConvention
        : "CONVENTION_JOIGNED_DOCUMENT" as TypeDocumentConvention;
      setCreateDocs([{ type: mergedType, file: mergedFile }]);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:docs.merge_success", { count: pdfFiles.length }) });
    } catch (e: any) {
      toast({ title: t("conventions:docs.merge_error"), description: e.message || t("conventions:docs.merge_error_desc"), variant: "destructive" });
    } finally {
      setMerging(false);
    }
  }, [createDocs, toast, t]);

  const handleCreate = async () => {
    if (!form.reference || !form.intitule) {
      toast({ title: t("common:errors.title", "Erreur"), description: t("conventions:create.missing_required"), variant: "destructive" });
      return;
    }
    if (form.dateSignature && form.dateSignature > today) {
      toast({ title: t("common:errors.title", "Erreur"), description: t("conventions:create.date_signature_future"), variant: "destructive" });
      return;
    }
    if (form.dateFin && form.dateFin < today) {
      toast({ title: t("common:errors.title", "Erreur"), description: t("conventions:create.date_fin_past"), variant: "destructive" });
      return;
    }
    const { bailleurIds, ...rest } = form;
    // Le premier bailleur choisi devient le principal.
    const payload: CreateConventionRequest = {
      ...rest,
      bailleurId: bailleurIds[0],
      bailleurIds: bailleurIds.length ? bailleurIds : undefined,
    };
    setCreating(true);
    try {
      const created = await conventionApi.create(payload);
      for (const doc of createDocs) {
        try {
          await conventionApi.uploadDocument(created.id, doc.type, doc.file);
        } catch {
          toast({ title: t("common:warnings.title", "Attention"), description: t("conventions:docs.upload_failure", { name: doc.file.name }), variant: "destructive" });
        }
      }
      toast({ title: t("common:success.title", "Succès"), description: createDocs.length ? t("conventions:create.success_with_docs", { count: createDocs.length }) : t("conventions:create.success") });
      onOpenChange(false);
      setForm(emptyForm());
      setCreateDocs([]);
      onCreated(created);
    } catch (e: any) {
      toast({ title: t("common:errors.title", "Erreur"), description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const sortedReqs = [...gedRequirements].sort((a, b) => (a.ordreAffichage || 0) - (b.ordreAffichage || 0));
  const missingDocs = gedRequirements.length > 0
    ? gedRequirements.filter((r) => r.obligatoire && r.sens !== "SORTIE").some((r) => !createDocs.some((d) => d.type === r.typeDocument))
    : !createDocs.some((d) => d.type === "CONVENTION_CONTRAT");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("conventions:create.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pe-1">
            <div className="space-y-2">
              <Label>{t("conventions:fields.reference_required")}</Label>
              <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder={t("conventions:create.reference_placeholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("conventions:fields.intitule_required")}</Label>
              <Input value={form.intitule} onChange={(e) => setForm((f) => ({ ...f, intitule: e.target.value }))} placeholder={t("conventions:create.intitule_placeholder")} />
            </div>

            <BailleursField
              label={t("conventions:fields.bailleurs_required")}
              bailleurs={bailleurs}
              setBailleurs={setBailleurs}
              loading={bailleursLoading}
              value={form.bailleurIds}
              onChange={(ids) => setForm((f) => ({ ...f, bailleurIds: ids }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("conventions:fields.date_signature")}</Label>
                <Input type="date" max={today} value={form.dateSignature} onChange={(e) => setForm((f) => ({ ...f, dateSignature: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("conventions:fields.date_fin")}</Label>
                <Input type="date" min={today} value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("conventions:fields.devise")}</Label>
              <div className="flex gap-2">
                <SearchableSelect
                  value={form.deviseOrigine || ""}
                  onValueChange={handleDeviseChange}
                  placeholder={devisesLoading ? t("conventions:create.loading") : t("conventions:create.select_devise")}
                  searchPlaceholder={t("conventions:create.search_devise")}
                  triggerClassName="flex-1"
                  options={devises.map((d) => ({
                    value: d.code,
                    label: `${d.code} — ${d.libelle}${d.symbole ? ` (${d.symbole})` : ""}`,
                    keywords: `${d.code} ${d.libelle}`,
                  }))}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setAddDeviseOpen(true)} title={t("conventions:create.add_devise_title")}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-2">
                <Label>{t("conventions:fields.montant_devise")}</Label>
                <Input type="number" step="0.01" value={form.montantDevise ?? ""} onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setForm((f) => ({ ...f, montantDevise: val, montantMru: val && f.tauxChange ? Math.round(val * f.tauxChange * 100) / 100 : undefined }));
                }} placeholder="1200000" />
              </div>
              <div className="space-y-2">
                <Label>{t("conventions:fields.taux_change")}</Label>
                <Input readOnly value={form.tauxChange != null ? formatNumber(form.tauxChange) : "—"} className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>{t("conventions:fields.montant_mru_auto")}</Label>
                <Input type="number" step="0.01" value={form.montantMru ?? ""} onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setForm((f) => ({ ...f, montantMru: val }));
                }} placeholder="0" />
              </div>
            </div>
            {tauxLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("conventions:create.rate_loading")}
              </div>
            )}

            {/* Documents — selon la configuration GED */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> {t("conventions:docs.title")}
              </Label>
              {gedReqLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("conventions:docs.loading_requirements")}
                </div>
              ) : gedRequirements.length > 0 ? (
                <div className="space-y-1">
                  {sortedReqs.map((req) => {
                    const docsForType = createDocs.filter((d) => d.type === req.typeDocument);
                    const hasDoc = docsForType.length > 0;
                    return (
                      <div key={req.id} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${req.obligatoire && !hasDoc ? "bg-destructive/10" : hasDoc ? "bg-green-50" : "bg-muted/30"}`}>
                        {hasDoc ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className={`h-3.5 w-3.5 shrink-0 ${req.obligatoire ? "text-destructive" : "text-muted-foreground"}`} />
                        )}
                        <span className={req.obligatoire && !hasDoc ? "text-destructive font-medium" : ""}>{tDocRequirementLabel(req)}</span>
                        {hasDoc && <span className="text-muted-foreground">{t("conventions:docs.files_count", { count: docsForType.length })}</span>}
                        {req.obligatoire && <Badge variant="outline" className="text-[10px] px-1 py-0">{t("conventions:docs.mandatory")}</Badge>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("conventions:docs.no_requirements")}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={createDocType} onValueChange={(v) => setCreateDocType(v as TypeDocumentConvention)}>
                  <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(gedRequirements.length > 0
                      ? sortedReqs.map((r) => r.typeDocument as string)
                      : (CONVENTION_DOCUMENT_TYPES as readonly string[])
                    ).map((value) => (
                      <SelectItem key={value} value={value}>{tTypeDocument(value)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <UploadRow
                  id="conv-create-docs"
                  className="flex-1"
                  label={t("conventions:docs.add_doc")}
                  file={null}
                  multiple
                  onFileChange={() => {}}
                  onFilesChange={(files) => files.forEach((file) => addCreateDoc(file))}
                />
              </div>
              {createDocs.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{t("conventions:docs.summary", { count: createDocs.length })}</span>
                    {createDocs.filter((d) => d.file.name.toLowerCase().endsWith(".pdf")).length >= 2 && (
                      <Button type="button" variant="outline" size="sm" onClick={mergeCreateDocs} disabled={merging}>
                        {merging ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Merge className="h-4 w-4 me-1" />}
                        {t("conventions:docs.merge_pdf")}
                      </Button>
                    )}
                  </div>
                  {createDocs.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1.5">
                      <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">{i + 1}</span>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0" disabled={i === 0} onClick={() => moveCreateDoc(i, "up")}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0" disabled={i === createDocs.length - 1} onClick={() => moveCreateDoc(i, "down")}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Badge variant="outline" className="text-xs shrink-0">{tTypeDocument(d.type)}</Badge>
                      <span className="truncate flex-1">{d.file.name}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeCreateDoc(i)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("conventions:actions.dismiss")}</Button>
            <Button onClick={handleCreate} disabled={creating || !form.reference || !form.intitule || missingDocs}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
              {t("conventions:actions.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nouvelle devise */}
      <Dialog open={addDeviseOpen} onOpenChange={setAddDeviseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("conventions:devise.modal_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("conventions:devise.code_required")}</Label>
              <Input value={newDevise.code} onChange={(e) => setNewDevise((d) => ({ ...d, code: e.target.value.toUpperCase() }))} placeholder="EUR" maxLength={5} />
            </div>
            <div className="space-y-2">
              <Label>{t("conventions:devise.libelle_required")}</Label>
              <Input value={newDevise.libelle} onChange={(e) => setNewDevise((d) => ({ ...d, libelle: e.target.value }))} placeholder={t("conventions:devise.libelle_placeholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("conventions:devise.symbole")}</Label>
              <Input value={newDevise.symbole} onChange={(e) => setNewDevise((d) => ({ ...d, symbole: e.target.value }))} placeholder="€" maxLength={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDeviseOpen(false)}>{t("conventions:actions.dismiss")}</Button>
            <Button onClick={handleAddDevise} disabled={addingDevise || !newDevise.code.trim() || !newDevise.libelle.trim()}>
              {addingDevise ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
              {t("conventions:actions.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConventionCreateDialog;
