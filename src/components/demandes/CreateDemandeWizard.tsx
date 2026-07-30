import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatAmount, formatNumber } from "@/i18n/format";
import { tTypeDocument, tTypeProjet, tDocRequirementLabel } from "@/i18n/enums";
import { AI_SERVICE_BASE } from "@/lib/apiConfig";
import { PDFDocument } from "pdf-lib";
import { useAuth } from "@/contexts/AuthContext";
import {
  entrepriseApi, EntrepriseDto,
  groupementApi, GroupementDto,
  conventionApi, ConventionDto, CreateConventionRequest,
  TypeDocumentConvention, CONVENTION_DOCUMENT_TYPES,
  demandeCorrectionApi, DemandeCorrectionDto, ModeleFiscal, Dqe,
  ImportationLigne, FiscaliteInterieure, DqeLigne,
  marcheApi, MarcheDto,
  bailleurApi, BailleurDto,
  deviseApi, DeviseDto, CreateDeviseRequest,
  forexApi,
  documentRequirementApi, DocumentRequirementDto,
  formatApiErrorMessage,
} from "@/lib/api";
import { requiredVisasCorrection } from "@/lib/visas";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePersistedFiles } from "@/hooks/usePersistedFiles";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadRow } from "@/components/ui/upload-row";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Loader2, Plus, Trash2, ArrowLeft, ArrowRight, Upload, CheckCircle, Send, FileText, Building2, Info,
  XCircle, Merge, ArrowUp, ArrowDown, File, Paperclip, Search, Check, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import GroupementFormDialog from "@/components/groupements/GroupementFormDialog";

// ── helpers ──
const emptyImportation = (): ImportationLigne => ({
  designation: "", unite: "", quantite: 0, prixUnitaire: 0,
  nomenclature: "", tauxDD: 5, tauxRS: 2, tauxPSC: 1, tauxTVA: 16,
  valeurDouane: 0, dd: 0, rs: 0, psc: 0, baseTVA: 0, tvaDouane: 0, totalTaxes: 0,
});

const recalcImportation = (l: ImportationLigne): ImportationLigne => {
  const valeurDouane = l.quantite * l.prixUnitaire;
  const dd = valeurDouane * l.tauxDD / 100;
  const rs = valeurDouane * l.tauxRS / 100;
  const psc = valeurDouane * l.tauxPSC / 100;
  const baseTVA = valeurDouane + dd + rs + psc;
  const tvaDouane = baseTVA * l.tauxTVA / 100;
  const totalTaxes = dd + rs + psc + tvaDouane;
  return { ...l, valeurDouane, dd, rs, psc, baseTVA, tvaDouane, totalTaxes };
};

const emptyDqeLigne = (): DqeLigne => ({
  designation: "", unite: "", quantite: 0, prixUnitaireHT: 0, montantHT: 0,
});

const fmt = (n: number) => formatNumber(Math.round(n * 100) / 100);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  /** Si fourni, le wizard édite une demande existante (BROUILLON / RECUE / INCOMPLETE). */
  editingId?: number | null;
  /** Demande pré-chargée (utilisée pour préremplir le formulaire en mode édition). */
  editingDemande?: DemandeCorrectionDto | null;
}

export default function CreateDemandeWizard({ open, onOpenChange, onCreated, editingId, editingDemande }: Props) {
  const { t } = useTranslation(["demandes", "common"]);
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const isEditing = !!editingId;

  // Step 0: Entreprise + Convention + Documents
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [conventions, setConventions] = useState<ConventionDto[]>([]);
  const [marches, setMarches] = useState<MarcheDto[]>([]);
  // Persistance pour ne pas perdre la saisie sur mobile (bascule WhatsApp, etc.)
  const [entrepriseId, setEntrepriseId, clearEntrepriseId] = usePersistedState<string>("demande:entrepriseId", "");
  const [conventionId, setConventionId, clearConventionId] = usePersistedState<string>("demande:conventionId", "");
  const [marcheId, setMarcheId, clearMarcheId] = usePersistedState<string>("demande:marcheId", "");
  // Titulaire : entreprise seule ou groupement (XOR côté back).
  const [titulaireType, setTitulaireType] = usePersistedState<"ENTREPRISE" | "GROUPEMENT">("demande:titulaireType", "ENTREPRISE");
  const [groupementId, setGroupementId] = usePersistedState<string>("demande:groupementId", "");
  const [groupements, setGroupements] = useState<GroupementDto[]>([]);
  // Intitulé libre du marché (Phase A — remplace la création de marché dans le wizard de correction).
  const [intituleMarche, setIntituleMarche, clearIntituleMarche] = usePersistedState<string>("demande:intituleMarche", "");
  // docFiles persistés dans IndexedDB pour survivre à une bascule mobile (WhatsApp, etc.)
  const [docFiles, setDocFiles, clearDocFiles] = usePersistedFiles("demande:docs");
  const [loadingData, setLoadingData] = useState(false);

  // Entreprise search combobox
  const [entrepriseOpen, setEntrepriseOpen] = useState(false);

  // Chargement des groupements actifs (titulaire alternatif).
  useEffect(() => {
    if (!open) return;
    groupementApi.getAll(true)
      .then(list => setGroupements(list || []))
      .catch(() => setGroupements([]));
  }, [open]);

  // Create groupement inline
  const [showCreateGroupement, setShowCreateGroupement] = useState(false);

  // Create enterprise inline
  const [showCreateEntreprise, setShowCreateEntreprise] = useState(false);
  const [newEntreprise, setNewEntreprise] = useState<EntrepriseDto>({ raisonSociale: "", nif: "" });
  const [creatingEntreprise, setCreatingEntreprise] = useState(false);

  // Create convention inline – full form matching Conventions page
  const [showCreateConvention, setShowCreateConvention] = useState(false);
  const [newConvForm, setNewConvForm] = useState<CreateConventionRequest>({
    reference: "", intitule: "", bailleurId: undefined,
    dateSignature: "", dateFin: "",
    montantDevise: undefined, deviseOrigine: "", montantMru: undefined, tauxChange: undefined,
  });
  const [creatingConvention, setCreatingConvention] = useState(false);

  // Devises référentiel (for convention creation)
  const [devises, setDevises] = useState<DeviseDto[]>([]);
  const [devisesLoading, setDevisesLoading] = useState(false);
  const [showAddDevise, setShowAddDevise] = useState(false);
  const [newDevise, setNewDevise] = useState<CreateDeviseRequest>({ code: "", libelle: "", symbole: "" });
  const [addingDevise, setAddingDevise] = useState(false);
  const [convTauxLoading, setConvTauxLoading] = useState(false);

  // Convention documents (for inline creation)
  const [convCreateDocs, setConvCreateDocs] = useState<{ type: TypeDocumentConvention; file: File }[]>([]);
  const [convDocType, setConvDocType] = useState<TypeDocumentConvention>("CONVENTION_CONTRAT");
  const [convGedReqs, setConvGedReqs] = useState<DocumentRequirementDto[]>([]);
  const [convMerging, setConvMerging] = useState(false);

  // ── Importation helpers ──
  const updateImportation = (idx: number, field: keyof ImportationLigne, value: string | number) => {
    setImportations(prev => {
      const updated = [...prev];
      updated[idx] = recalcImportation({ ...updated[idx], [field]: typeof value === "string" && ["quantite", "prixUnitaire", "tauxDD", "tauxRS", "tauxPSC", "tauxTVA"].includes(field) ? parseFloat(value) || 0 : value });
      return updated;
    });
  };

  const totalVD = importations.reduce((s, l) => s + l.valeurDouane, 0);
  const totalDD = importations.reduce((s, l) => s + l.dd, 0);
  const totalTVADouane = importations.reduce((s, l) => s + l.tvaDouane, 0);
  const totalTaxes = importations.reduce((s, l) => s + l.totalTaxes, 0);
  const creditExterieurCalc = totalTaxes;
  const creditExterieur = creditExtManuel.trim() !== "" ? (parseFloat(creditExtManuel) || 0) : creditExterieurCalc;

  const updateFiscalite = (field: keyof FiscaliteInterieure, value: number) => {
    setFiscalite(prev => {
      const next = { ...prev, [field]: value };
      next.tvaCollectee = next.montantHT * next.tauxTVA / 100;
      next.tvaDeductible = totalTVADouane;
      next.tvaNette = next.tvaCollectee - next.tvaDeductible;
      next.creditInterieur = next.tvaNette;
      return next;
    });
  };

  const creditInterieur = creditIntManuel.trim() !== "" ? (parseFloat(creditIntManuel) || 0) : fiscalite.creditInterieur;
  const creditTotal = creditExterieur + creditInterieur;

  // ── DQE helpers ──
  const updateDqeLigne = (idx: number, field: keyof DqeLigne, value: string | number) => {
    setDqeLignes(prev => {
      const updated = [...prev];
      const l = { ...updated[idx], [field]: typeof value === "string" && ["quantite", "prixUnitaireHT"].includes(field) ? parseFloat(value) || 0 : value };
      l.montantHT = l.quantite * l.prixUnitaireHT;
      updated[idx] = l;
      return updated;
    });
  };

  const dqeTotalHT = dqeLignes.reduce((s, l) => s + l.montantHT, 0);
  const dqeMontantTVA = dqeTotalHT * dqeTauxTVA / 100;
  const dqeTotalTTC = dqeTotalHT + dqeMontantTVA;

  // ── Drag & drop helpers ──
  const handleDragOver = (e: React.DragEvent, typeDocument: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverType(typeDocument);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverType(null);
  };

  const handleDrop = (e: React.DragEvent, typeDocument: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverType(null);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setDocFiles(prev => ({ ...prev, [typeDocument]: f }));
    }
  };

  // ── Submit ──
  // brouillon=true → POST avec brouillon:true (ou PUT en édition) ; reste en BROUILLON.
  // brouillon=false → POST normal puis (en édition) déclenche soumettre().
  const handleSubmit = async (asBrouillon: boolean) => {
    if ((user?.role === "AUTORITE_CONTRACTANTE" || isDelegate) && !user?.autoriteContractanteId) {
      toast({ title: t("demandes:toast.error"), description: t("demandes:wizard.errors.no_ac_associated"), variant: "destructive" });
      return;
    }
    const isGroupement = titulaireType === "GROUPEMENT";
    if (isGroupement ? !groupementId : !entrepriseId) {
      toast({
        title: t("demandes:toast.error"),
        description: isGroupement
          ? t("demandes:wizard.errors.groupement_required")
          : t("demandes:wizard.errors.entreprise_required"),
        variant: "destructive",
      });
      return;
    }
    // Le back actuel accepte la demande sans création de marché, mais exige encore
    // une convention porteuse. On bloque côté front pour éviter l'erreur API générique.
    if (!asBrouillon && !conventionId) {
      toast({ title: t("demandes:toast.error"), description: t("demandes:wizard.errors.convention_required"), variant: "destructive" });
      return;
    }
    if (!asBrouillon && !marcheId && !intituleMarche?.trim()) {
      toast({ title: t("demandes:toast.error"), description: t("demandes:wizard.errors.intitule_marche_required"), variant: "destructive" });
      return;
    }
    if (!asBrouillon && creditExterieur <= 0 && creditInterieur <= 0) {
      toast({ title: t("demandes:toast.error"), description: t("demandes:wizard.errors.credit_required"), variant: "destructive" });
      return;
    }


    const selectedMarche = marcheId ? marches.find(m => String(m.id) === marcheId) : null;
    const finalConventionId = conventionId ? Number(conventionId) : selectedMarche?.conventionId;

    if (asBrouillon) setSavingDraft(true); else setSubmitting(true);
    try {
      const payload = {
        autoriteContractanteId: user?.autoriteContractanteId || undefined,
        // XOR : groupementId prime côté back (titulaire = chef de file).
        entrepriseId: isGroupement ? undefined : Number(entrepriseId),
        groupementId: isGroupement ? Number(groupementId) : undefined,
        conventionId: finalConventionId,
        marcheId: marcheId && marcheId !== "pending" ? Number(marcheId) : undefined,
        // Phase A : intitulé libre + enveloppes crédit (routing dynamique des visas côté back).
        intituleMarche: intituleMarche?.trim() || selectedMarche?.intitule || undefined,
        creditExterieur: Number(creditExterieur) || 0,
        creditInterieur: Number(creditInterieur) || 0,
        modeleFiscal: {
          referenceDossier,
          typeProjet,
          afficherNomenclature: showNomenclature,
          importations,
          fiscaliteInterieure: { ...fiscalite, tvaDeductible: totalTVADouane, creditInterieur },
          recapitulatif: { creditExterieur, creditInterieur, creditTotal },
        },
        dqe: {
          numeroAAOI: dqeNumero,
          projet: dqeProjet,
          lot: dqeLot,
          tauxTVA: dqeTauxTVA,
          totalHT: dqeTotalHT,
          montantTVA: dqeMontantTVA,
          totalTTC: dqeTotalTTC,
          lignes: dqeLignes,
        },
      };

      let demande: DemandeCorrectionDto;
      if (isEditing && editingId) {
        // Édition : PUT, puis soumettre si demandé.
        demande = await demandeCorrectionApi.update(editingId, payload);
        if (!asBrouillon && demande.statut === "BROUILLON") {
          demande = await demandeCorrectionApi.soumettre(editingId);
        }
      } else {
        // Création : POST avec flag brouillon.
        demande = await demandeCorrectionApi.create({ ...payload, brouillon: asBrouillon });
      }

      const docEntries = Object.entries(docFiles);
      for (const [type, file] of docEntries) {
        try {
          await demandeCorrectionApi.uploadDocument(demande.id, type, file);
        } catch {
          // continue uploading others
        }
      }

      try {
        const AI_DOC_TYPES = ["OFFRE_FISCALE", "OFFRE_FINANCIERE", "DQE", "DAO_DQE"];
        const uploadedDocs = await demandeCorrectionApi.getDocuments(demande.id);
        const sourceUrls = uploadedDocs
          .filter((d: any) => d.chemin && AI_DOC_TYPES.some(t => (d.type || d.typeDocument || "").includes(t)))
          .map((d: any) => d.chemin.replace(/\\/g, "/"));
        if (sourceUrls.length > 0) {
          await fetch(`${AI_SERVICE_BASE}/api/fiscal-context/${demande.id}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "ngrok-skip-browser-warning": "true",
            },
            body: JSON.stringify({ sourceUrls }),
          });
        }
      } catch (e) {
        console.warn("AI context upload failed (non-blocking):", e);
      }

      toast({
        title: t("demandes:toast.success"),
        description: asBrouillon
          ? t("demandes:wizard.toast.draft_saved", { numero: demande.numero || `#${demande.id}` })
          : isEditing
          ? t("demandes:wizard.toast.demande_submitted", { numero: demande.numero || `#${demande.id}` })
          : t("demandes:wizard.toast.demande_created", { numero: demande.numero || `#${demande.id}` }),
      });
      // Nettoyer toutes les valeurs persistées du wizard après succès
      try {
        const keys = [
          "demande:entrepriseId", "demande:groupementId", "demande:titulaireType", "demande:conventionId", "demande:marcheId", "demande:intituleMarche",
          "demande:typeProjet", "demande:refDossier",
          "demande:importations", "demande:fiscalite",
          "demande:dqeNumero", "demande:dqeProjet", "demande:dqeLot",
          "demande:dqeTauxTVA", "demande:dqeLignes",
          "demande:creditExtManuel", "demande:creditIntManuel",
        ];
        keys.forEach(k => sessionStorage.removeItem(`lvbl:form:${k}`));
      } catch { /* noop */ }
      clearDocFiles();
      onOpenChange(false);
      onCreated();
    } catch (e: unknown) {
      toast({ title: t("demandes:toast.error"), description: formatApiErrorMessage(e, asBrouillon ? t("demandes:wizard.errors.save_failed") : t("demandes:wizard.errors.submit_failed")), variant: "destructive" });
    } finally {
      setSavingDraft(false);
      setSubmitting(false);
    }
  };

  const steps = [
    { label: t("demandes:wizard.steps.entreprise_documents"), icon: FileText },
  ];

  const selectedEntreprise = entreprises.find(e => String(e.id) === entrepriseId);
  const titulaireSelected = titulaireType === "GROUPEMENT" ? !!groupementId : !!entrepriseId;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("demandes:wizard.title_edit", { numero: editingDemande?.numero || `#${editingId}` }) : t("demandes:wizard.title_new")}</DialogTitle>
        </DialogHeader>
        <div className="md:hidden flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>{t("demandes:wizard.mobile_tip_title")}</strong> {t("demandes:wizard.mobile_tip_body")}
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${i < step ? "bg-green-600 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${i === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              {i < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* ═══ STEP 0: Entreprise + Convention + Documents ═══ */}
        {step === 0 && (
          <div className="space-y-4">
            {loadingData ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <>
                {/* Titulaire : entreprise seule ou groupement */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t("demandes:wizard.fields.titulaire")} :</span>
                  <div className="inline-flex rounded-md border p-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={titulaireType === "ENTREPRISE" ? "default" : "ghost"}
                      className="h-7 text-xs"
                      onClick={() => { setTitulaireType("ENTREPRISE"); setGroupementId(""); }}
                    >
                      {t("demandes:wizard.fields.titulaire_entreprise")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={titulaireType === "GROUPEMENT" ? "default" : "ghost"}
                      className="h-7 text-xs"
                      onClick={() => { setTitulaireType("GROUPEMENT"); setShowCreateEntreprise(false); }}
                    >
                      {t("demandes:wizard.fields.titulaire_groupement")}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {titulaireType === "GROUPEMENT" ? (
                    <div className="space-y-2">
                      <Label className="flex items-center justify-between">
                        <span>{t("demandes:wizard.fields.groupement")} *</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-primary"
                          onClick={() => setShowCreateGroupement(true)}
                        >
                          <Plus className="h-3 w-3 me-1" />
                          {t("demandes:wizard.actions.create_short")}
                        </Button>
                      </Label>
                      <SearchableSelect
                        value={groupementId}
                        onValueChange={(v) => setGroupementId(v)}
                        placeholder={t("demandes:wizard.fields.groupement_placeholder")}
                        searchPlaceholder={t("demandes:wizard.fields.entreprise_search_command_placeholder")}
                        emptyMessage={t("demandes:wizard.fields.groupement_empty")}
                        options={[...groupements]
                          .sort((a, b) => (a.raisonSociale || "").localeCompare(b.raisonSociale || "", "fr", { sensitivity: "base" }))
                          .map(g => ({
                            value: String(g.id),
                            label: g.raisonSociale || `#${g.id}`,
                            description: g.nifAffiche
                              ? `NIF (chef de file) : ${g.nifAffiche}${g.chefDeFileRaisonSociale ? ` — ${g.chefDeFileRaisonSociale}` : ""}`
                              : g.chefDeFileRaisonSociale || undefined,
                            keywords: `${g.raisonSociale || ""} ${g.nifAffiche || ""} ${g.chefDeFileRaisonSociale || ""}`,
                          }))}
                      />
                    </div>
                  ) : (
                  /* Entreprise with searchable combobox */
                  <div className="space-y-2">

                    <Label className="flex items-center justify-between">
                      <span>{t("demandes:wizard.fields.entreprise_required")} *</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-primary"
                        onClick={() => setShowCreateEntreprise(!showCreateEntreprise)}
                      >
                        <Plus className="h-3 w-3 me-1" />
                        {showCreateEntreprise ? t("demandes:wizard.actions.cancel") : t("demandes:wizard.actions.create_short")}
                      </Button>
                    </Label>
                    {!showCreateEntreprise ? (
                      <SearchableSelect
                        value={entrepriseId}
                        onValueChange={(v) => setEntrepriseId(v)}
                        placeholder={t("demandes:wizard.fields.entreprise_search_placeholder")}
                        searchPlaceholder={t("demandes:wizard.fields.entreprise_search_command_placeholder")}
                        emptyMessage={t("demandes:wizard.fields.entreprise_empty")}
                        options={[...entreprises]
                          .sort((a, b) => (a.raisonSociale || "").localeCompare(b.raisonSociale || "", "fr", { sensitivity: "base" }))
                          .map(e => ({
                            value: String(e.id),
                            label: e.raisonSociale || `#${e.id}`,
                            description: (e.nifAffiche || e.nif) ? `NIF : ${e.nifAffiche || e.nif}` : (e.registreCommerceEtranger ? `RC étranger : ${e.registreCommerceEtranger}` : undefined),
                            keywords: `${e.raisonSociale || ""} ${e.nifAffiche || ""} ${e.nif || ""} ${e.registreCommerceEtranger || ""}`,
                          }))}
                      />
                    ) : (
                      <Card className="border-primary/30">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <Building2 className="h-4 w-4" />
                            {t("demandes:wizard.fields.new_entreprise")}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t("demandes:wizard.fields.raison_sociale")} <span className="text-destructive">*</span></Label>
                            <Input
                              placeholder={t("demandes:wizard.fields.raison_sociale_placeholder")}
                              value={newEntreprise.raisonSociale}
                              onChange={e => setNewEntreprise(prev => ({ ...prev, raisonSociale: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={!!newEntreprise.entrepriseEtrangere}
                                onCheckedChange={(v) => setNewEntreprise(prev => ({ ...prev, entrepriseEtrangere: !!v }))}
                              />
                              {t("demandes:wizard.fields.entreprise_etrangere")}
                            </label>
                          </div>
                          {newEntreprise.entrepriseEtrangere && (
                            <div className="space-y-1">
                              <Label className="text-xs">{t("demandes:wizard.fields.rc_etranger")} <span className="text-destructive">*</span></Label>
                              <Input
                                placeholder={t("demandes:wizard.fields.rc_etranger_placeholder")}
                                value={newEntreprise.registreCommerceEtranger || ""}
                                onChange={e => setNewEntreprise(prev => ({ ...prev, registreCommerceEtranger: e.target.value }))}
                              />
                            </div>
                          )}

                          <div className="space-y-1">
                            <Label className="text-xs">
                              {t("demandes:wizard.fields.nif")}
                              {!newEntreprise.entrepriseEtrangere && <span className="text-destructive"> *</span>}
                              {" "}<span className="text-muted-foreground">{t("demandes:wizard.fields.nif_hint")}</span>
                            </Label>
                            <Input
                              placeholder={t("demandes:wizard.fields.nif_placeholder")}
                              value={newEntreprise.nif}
                              maxLength={8}
                              onChange={e => setNewEntreprise(prev => ({ ...prev, nif: e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) }))}
                            />
                            {!!newEntreprise.nif && newEntreprise.nif.length !== 8 && (
                              <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {t("demandes:wizard.fields.nif_count", { count: newEntreprise.nif.length })}
                              </p>
                            )}
                            {newEntreprise.nif && newEntreprise.nif.length === 8 && (
                              <p className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                {t("demandes:wizard.fields.nif_count", { count: 8 })}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t("demandes:wizard.fields.adresse")}</Label>
                            <Input
                              placeholder={t("demandes:wizard.fields.adresse_placeholder")}
                              value={newEntreprise.adresse || ""}
                              onChange={e => setNewEntreprise(prev => ({ ...prev, adresse: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t("demandes:wizard.fields.email")}</Label>
                            <Input
                              placeholder={t("demandes:wizard.fields.email_placeholder")}
                              type="email"
                              value={newEntreprise.email || ""}
                              onChange={e => setNewEntreprise(prev => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={handleCreateEntreprise}
                            disabled={creatingEntreprise || !newEntreprise.raisonSociale || (newEntreprise.entrepriseEtrangere ? !newEntreprise.registreCommerceEtranger?.trim() : (newEntreprise.nif || "").length !== 8)}
                          >
                            {creatingEntreprise ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
                            {t("demandes:wizard.fields.create_entreprise")}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  )}


                  {/* Convention porteuse — le marché n'est plus créé/sélectionné ici. */}
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span>{t("demandes:wizard.fields.convention")} <span className="text-destructive">*</span></span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-primary"
                        onClick={() => setShowCreateConvention(!showCreateConvention)}
                      >
                        <Plus className="h-3 w-3 me-1" />
                        {showCreateConvention ? t("demandes:wizard.actions.cancel") : t("demandes:wizard.actions.create_short")}
                      </Button>
                    </Label>

                    {!showCreateConvention ? (
                      <SearchableSelect
                        value={conventionId}
                        onValueChange={v => {
                          setConventionId(v);
                          setMarcheId("");
                        }}
                        placeholder={t("demandes:wizard.fields.select_convention")}
                        searchPlaceholder={t("demandes:wizard.fields.search_convention")}
                        options={conventions.map(c => ({
                          value: String(c.id),
                          label: `${c.reference || `#${c.id}`} — ${c.intitule || c.bailleurNom || c.bailleur || ""}`,
                          keywords: `${c.reference || ""} ${c.intitule || ""} ${c.bailleurNom || ""}`,
                        }))}
                      />
                    ) : (
                      <Card className="border-primary/30">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <FileText className="h-4 w-4" />
                            {t("demandes:wizard.fields.create_convention")}
                          </div>

                          <div className="space-y-1">
                              <div className="space-y-3 border border-dashed border-border rounded-md p-3 max-h-[50vh] overflow-y-auto">
                                <Input
                                  placeholder={t("demandes:wizard.fields.reference_placeholder")}
                                  value={newConvForm.reference}
                                  onChange={e => setNewConvForm(prev => ({ ...prev, reference: e.target.value }))}
                                />
                                <Input
                                  placeholder={t("demandes:wizard.fields.intitule_placeholder")}
                                  value={newConvForm.intitule}
                                  onChange={e => setNewConvForm(prev => ({ ...prev, intitule: e.target.value }))}
                                />
                                {/* Bailleur */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground flex items-center justify-between">
                                    <span>{t("demandes:wizard.fields.bailleur")}</span>
                                    <Button type="button" variant="ghost" size="sm" className="h-5 text-xs text-primary p-0" onClick={() => setShowCreateBailleur(!showCreateBailleur)}>
                                      <Plus className="h-3 w-3 me-0.5" />
                                      {showCreateBailleur ? t("demandes:wizard.actions.cancel") : t("demandes:wizard.actions.add_short")}
                                    </Button>
                                  </Label>
                                  {!showCreateBailleur ? (
                                    <SearchableSelect
                                      value={newConvForm.bailleurId != null ? String(newConvForm.bailleurId) : ""}
                                      onValueChange={v => setNewConvForm(prev => ({ ...prev, bailleurId: v ? Number(v) : undefined }))}
                                      placeholder={t("demandes:wizard.fields.select_bailleur")}
                                      searchPlaceholder={t("demandes:wizard.fields.search_bailleur")}
                                      options={bailleurs.map(b => ({ value: String(b.id), label: b.nom }))}
                                    />
                                  ) : (
                                    <div className="flex gap-1">
                                      <Input placeholder={t("demandes:wizard.fields.bailleur_name")} value={newBailleurNom} onChange={e => setNewBailleurNom(e.target.value)} className="text-sm" />
                                      <Button size="sm" disabled={creatingBailleur || !newBailleurNom} onClick={async () => {
                                        setCreatingBailleur(true);
                                        try {
                                          const created = await bailleurApi.create({ nom: newBailleurNom });
                                          setBailleurs(prev => [...prev, created]);
                                          setNewConvForm(prev => ({ ...prev, bailleurId: created.id }));
                                          setNewBailleurNom("");
                                          setShowCreateBailleur(false);
                                          toast({ title: t("demandes:toast.success"), description: t("demandes:wizard.toast.bailleur_added") });
                                        } catch (e: any) {
                                          toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
                                        } finally { setCreatingBailleur(false); }
                                      }}>
                                        {creatingBailleur ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {/* Le descriptif provient désormais du bailleur sélectionné. */}
                                {/* Dates */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">{t("demandes:wizard.fields.date_signature")} <span className="text-destructive">*</span></Label>
                                    <Input type="date" value={newConvForm.dateSignature || ""} onChange={e => setNewConvForm(prev => ({ ...prev, dateSignature: e.target.value }))} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">{t("demandes:wizard.fields.date_fin")}</Label>
                                    <Input type="date" value={newConvForm.dateFin || ""} onChange={e => setNewConvForm(prev => ({ ...prev, dateFin: e.target.value }))} />
                                  </div>
                                </div>
                                {/* Devise */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">{t("demandes:wizard.fields.devise_origine")}</Label>
                                  <div className="flex gap-1">
                                    <SearchableSelect
                                      value={newConvForm.deviseOrigine || ""}
                                      onValueChange={code => setNewConvForm(f => ({ ...f, deviseOrigine: code, tauxChange: undefined, montantMru: undefined }))}
                                      placeholder={devisesLoading ? t("demandes:wizard.fields.devise_loading") : t("demandes:wizard.fields.devise")}
                                      searchPlaceholder={t("demandes:wizard.fields.search_devise")}
                                      triggerClassName="flex-1"
                                      options={devises.map(d => ({
                                        value: d.code,
                                        label: `${d.code} — ${d.libelle}`,
                                        keywords: `${d.code} ${d.libelle}`,
                                      }))}
                                    />
                                    <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowAddDevise(true)} title={t("demandes:wizard.fields.add_devise_title")}>
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                {/* Montants */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">{t("demandes:wizard.fields.amount_devise")}</Label>
                                    <Input type="number" value={newConvForm.montantDevise ?? ""} onChange={e => {
                                      const val = e.target.value ? Number(e.target.value) : undefined;
                                      setNewConvForm(f => ({ ...f, montantDevise: val, montantMru: val && f.tauxChange ? Math.round(val * f.tauxChange * 100) / 100 : undefined }));
                                    }} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">{t("demandes:wizard.fields.exchange_rate")}</Label>
                                    <Input
                                      type="number"
                                      step="0.0001"
                                      value={newConvForm.tauxChange ?? ""}
                                      placeholder="—"
                                      onChange={e => {
                                        const rate = e.target.value ? Number(e.target.value) : undefined;
                                        setNewConvForm(f => ({
                                          ...f,
                                          tauxChange: rate,
                                          montantMru: f.montantDevise && rate ? Math.round(f.montantDevise * rate * 100) / 100 : undefined,
                                        }));
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">{t("demandes:wizard.fields.amount_mru")}</Label>
                                    <Input readOnly value={newConvForm.montantMru ? formatNumber(newConvForm.montantMru) : "—"} className="bg-muted" />
                                  </div>
                                </div>
                                {convTauxLoading && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" /> {t("demandes:wizard.fields.rate_loading")}
                                  </div>
                                )}
                                {/* Documents convention */}
                                <div className="border-t border-border pt-2 space-y-2">
                                  <Label className="text-xs font-semibold flex items-center gap-1">
                                    <Paperclip className="h-3 w-3" /> {t("demandes:wizard.fields.attached_documents")}
                                  </Label>
                                  {convGedReqs.length > 0 && (
                                    <div className="space-y-0.5">
                                      {convGedReqs.map(req => {
                                        const hasDoc = convCreateDocs.some(d => d.type === req.typeDocument);
                                        return (
                                          <div key={req.id} className={`flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 ${req.obligatoire && !hasDoc ? "bg-destructive/10" : hasDoc ? "bg-green-50" : "bg-muted/30"}`}>
                                            {hasDoc ? <CheckCircle className="h-3 w-3 text-green-600 shrink-0" /> : <XCircle className={`h-3 w-3 shrink-0 ${req.obligatoire ? "text-destructive" : "text-muted-foreground"}`} />}
                                            <span>{tDocRequirementLabel(req)}</span>
                                            {req.obligatoire && <span className="text-destructive">*</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  <div className="flex gap-1">
                                    <Select value={convDocType} onValueChange={v => setConvDocType(v as TypeDocumentConvention)}>
                                      <SelectTrigger className="w-40 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(convGedReqs.length > 0
                                          ? convGedReqs.map(r => ({ value: r.typeDocument as string, label: tTypeDocument(r.typeDocument) }))
                                          : CONVENTION_DOCUMENT_TYPES.map(v => ({ value: v as string, label: tTypeDocument(v) }))
                                        ).map(dt => (
                                          <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                                        ))}

                                      </SelectContent>
                                    </Select>
                                    <UploadRow
                                      id="wizard-conv-create-docs"
                                      className="flex-1"
                                      label={t("demandes:wizard.actions.browse")}
                                      file={null}
                                      multiple
                                      onFileChange={() => {}}
                                      onFilesChange={files => files.forEach(f => setConvCreateDocs(prev => [...prev, { type: convDocType, file: f }]))}
                                    />
                                  </div>
                                  {convCreateDocs.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[11px] text-muted-foreground">{t("demandes:wizard.fields.files_count", { count: convCreateDocs.length })}</span>
                                      {convCreateDocs.map((d, i) => (
                                        <div key={i} className="flex items-center gap-1 text-xs bg-muted/50 rounded px-2 py-1">
                                          <span className="text-muted-foreground font-mono w-4 shrink-0">{i + 1}</span>
                                          <div className="flex flex-col gap-0.5 shrink-0">
                                            <Button type="button" variant="ghost" size="sm" className="h-3 w-3 p-0" disabled={i === 0} onClick={() => {
                                              setConvCreateDocs(prev => { const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
                                            }}><ArrowUp className="h-2 w-2" /></Button>
                                            <Button type="button" variant="ghost" size="sm" className="h-3 w-3 p-0" disabled={i === convCreateDocs.length - 1} onClick={() => {
                                              setConvCreateDocs(prev => { const n = [...prev]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n; });
                                            }}><ArrowDown className="h-2 w-2" /></Button>
                                          </div>
                                          <File className="h-3 w-3 text-muted-foreground shrink-0" />
                                          <Badge variant="outline" className="text-[10px] shrink-0">{tTypeDocument(d.type)}</Badge>
                                          <span className="truncate flex-1">{d.file.name}</span>
                                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-destructive" onClick={() => setConvCreateDocs(prev => prev.filter((_, j) => j !== i))}>
                                            <XCircle className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                      {/* Fusion section with messages */}
                                      <div className="mt-2 p-2 bg-muted/30 rounded-md space-y-2">
                                        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                          <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                          <div>
                                            <p className="font-medium text-foreground">{t("demandes:wizard.inline.fusion_title")}</p>
                                            <p>{t("demandes:wizard.inline.fusion_body")}</p>
                                          </div>
                                        </div>
                                        {convCreateDocs.filter(d => d.file.name.toLowerCase().endsWith(".pdf")).length >= 2 ? (
                                          <Button type="button" variant="outline" size="sm" className="w-full" onClick={convMergeCreateDocs} disabled={convMerging}>
                                            {convMerging ? <Loader2 className="h-3 w-3 animate-spin me-1" /> : <Merge className="h-3 w-3 me-1" />}
                                            {t("demandes:wizard.inline.fusion_btn", { count: convCreateDocs.filter(d => d.file.name.toLowerCase().endsWith(".pdf")).length })}
                                          </Button>
                                        ) : (
                                          <p className="text-[11px] text-muted-foreground italic text-center">
                                            {t("demandes:wizard.inline.fusion_min_hint")}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={handleCreateConvention}
                                  disabled={creatingConvention || !newConvForm.reference || !newConvForm.intitule}
                                >
                                  {creatingConvention ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
                                  {t("demandes:wizard.fields.create_convention")}
                                </Button>
                              </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Phase A — Intitulé libre du marché (aucune création de marché ici). */}
                    <div className="space-y-1 mt-2">
                      <Label className="text-sm">
                        {t("demandes:wizard.fields.intitule_marche")}
                        <span className="text-destructive ms-1">*</span>
                      </Label>
                      <Input
                        value={intituleMarche}
                        onChange={(e) => setIntituleMarche(e.target.value)}
                        placeholder={t("demandes:wizard.fields.intitule_marche_placeholder")}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("demandes:wizard.fields.intitule_marche_hint")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Enveloppes crédit — au moins une doit être > 0 */}
                <div className="rounded-lg border border-primary/30 p-3 space-y-3">
                  <h3 className="text-sm font-semibold">{t("demandes:wizard.modele_fiscal.section_recap")}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {t("demandes:wizard.modele_fiscal.totals.credit_exterieur")}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={creditExtManuel}
                        placeholder={String(creditExterieurCalc || 0)}
                        onChange={e => setCreditExtManuel(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {t("demandes:wizard.modele_fiscal.totals.credit_interieur")}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={creditIntManuel}
                        placeholder={String(fiscalite.creditInterieur || 0)}
                        onChange={e => setCreditIntManuel(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("demandes:wizard.modele_fiscal.totals.credit_total")}</Label>
                      <Input readOnly value={fmt(creditTotal)} className="bg-muted font-bold text-primary" />
                    </div>
                  </div>
                  {(() => {
                    const visas = requiredVisasCorrection({ creditInterieur, creditExterieur });
                    const exclus = (["DGD", "DGI"] as const).filter(o => !visas.includes(o));
                    return (
                      <p className="text-xs text-muted-foreground">
                        {t("demandes:wizard.modele_fiscal.visas_preview", { list: visas.join(", ") })}
                        {exclus.length > 0 && ` — ${t("demandes:wizard.modele_fiscal.visas_excluded", { list: exclus.join(", ") })}`}
                      </p>
                    );
                  })()}
                </div>


                <div>
                  <h3 className="text-sm font-semibold mb-2">{t("demandes:wizard.fields.pieces_to_attach")} <span className="text-muted-foreground text-xs">{t("demandes:wizard.fields.pieces_ged_hint")}</span></h3>
                  {gedDocTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">{t("demandes:wizard.fields.pieces_empty")}</p>
                  ) : (
                    <div className="space-y-2">
                      {gedDocTypes.map(dt => {
                        const code = (dt.codeDocument || dt.typeDocument || "") as string;
                        const label = dt.libelle || tTypeDocument(code as any);
                        return (
                        <label
                          key={dt.id}
                          htmlFor={`wizard-doc-${dt.id}`}
                          className={`group flex items-center gap-2 rounded-lg border p-2 transition-colors cursor-pointer hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring ${
                            dragOverType === code
                              ? "border-primary bg-primary/5 border-dashed"
                              : docFiles[code]
                                ? "border-emerald-300 bg-emerald-50/40"
                                : "border-border"
                          }`}
                          onDragOver={e => handleDragOver(e, code)}
                          onDragLeave={handleDragLeave}
                          onDrop={e => handleDrop(e, code)}
                        >
                          {docFiles[code] ? (
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          ) : existingDocs[code] ? (
                            <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className={`flex-1 text-sm flex items-center gap-1 ${docFiles[code] || existingDocs[code] ? "font-medium" : "text-muted-foreground"}`}>
                            {label}
                            {dt.obligatoire && <span className="text-destructive ms-1">*</span>}
                            {dt.description && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" onClick={e => e.preventDefault()} />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px] text-xs">
                                  {dt.description}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                          {docFiles[code] ? (
                            <span className="text-xs text-emerald-700 truncate max-w-[150px]">{docFiles[code].name}</span>
                          ) : existingDocs[code] ? (
                            <span className="text-xs text-primary truncate max-w-[180px]" title={existingDocs[code].nomFichier}>
                              {t("demandes:wizard.fields.already_provided", { name: existingDocs[code].nomFichier })}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                              {t("demandes:wizard.actions.drop_hint")}
                            </span>
                          )}
                          {docFiles[code] && (
                            <button
                              type="button"
                              aria-label={t("demandes:wizard.actions.remove", { defaultValue: "Retirer" }) as string}
                              className="rounded-full p-1 hover:bg-destructive/10 text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDocFiles(prev => {
                                  const next = { ...prev };
                                  delete next[code];
                                  return next;
                                });
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <input
                            id={`wizard-doc-${dt.id}`}
                            type="file"
                            className="sr-only"
                            accept={dt.typesAutorises?.map(f => f === "PDF" ? ".pdf" : f === "WORD" ? ".doc,.docx" : f === "EXCEL" ? ".xls,.xlsx" : "image/*").join(",")}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setDocFiles(prev => ({ ...prev, [code]: f }));
                              e.target.value = "";
                            }}
                          />
                          <span className="text-xs text-primary underline-offset-2 group-hover:underline shrink-0">
                            {docFiles[code] || existingDocs[code] ? t("demandes:wizard.actions.replace") : t("demandes:wizard.actions.browse")}
                          </span>
                        </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ STEP 1: Modèle Fiscal ═══ */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("demandes:wizard.modele_fiscal.section_parameters")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.fields.reference_dossier")}</Label>
                    <Input value={referenceDossier} onChange={e => setReferenceDossier(e.target.value)} placeholder={t("demandes:wizard.fields.reference_dossier_placeholder")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.fields.type_projet")}</Label>
                    <Select value={typeProjet} onValueChange={setTypeProjet}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BTP">{tTypeProjet("BTP")}</SelectItem>
                        <SelectItem value="EQUIPEMENT">{tTypeProjet("EQUIPEMENT")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch checked={showNomenclature} onCheckedChange={setShowNomenclature} />
                    <Label className="text-xs">{t("demandes:wizard.fields.nomenclature_douaniere")}</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t("demandes:wizard.modele_fiscal.section_importations")}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setImportations(prev => [...prev, emptyImportation()])}>
                    <Plus className="h-3 w-3 me-1" /> {t("demandes:wizard.modele_fiscal.add_line")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs min-w-[120px]">{t("demandes:wizard.modele_fiscal.imp_cols.designation")}</TableHead>
                        <TableHead className="text-xs w-16">{t("demandes:wizard.modele_fiscal.imp_cols.unite")}</TableHead>
                        <TableHead className="text-xs w-20">{t("demandes:wizard.modele_fiscal.imp_cols.quantite")}</TableHead>
                        <TableHead className="text-xs w-20">{t("demandes:wizard.modele_fiscal.imp_cols.pu")}</TableHead>
                        {showNomenclature && <TableHead className="text-xs w-24">{t("demandes:wizard.modele_fiscal.imp_cols.nomencl")}</TableHead>}
                        <TableHead className="text-xs w-16">{t("demandes:wizard.modele_fiscal.imp_cols.dd_pct")}</TableHead>
                        <TableHead className="text-xs w-16">{t("demandes:wizard.modele_fiscal.imp_cols.rs_pct")}</TableHead>
                        <TableHead className="text-xs w-16">{t("demandes:wizard.modele_fiscal.imp_cols.psc_pct")}</TableHead>
                        <TableHead className="text-xs w-16">{t("demandes:wizard.modele_fiscal.imp_cols.tva_pct")}</TableHead>
                        <TableHead className="text-xs w-24 text-end">{t("demandes:wizard.modele_fiscal.imp_cols.val_douane")}</TableHead>
                        <TableHead className="text-xs w-20 text-end">{t("demandes:wizard.modele_fiscal.imp_cols.dd")}</TableHead>
                        <TableHead className="text-xs w-20 text-end">{t("demandes:wizard.modele_fiscal.imp_cols.tva_douane")}</TableHead>
                        <TableHead className="text-xs w-24 text-end">{t("demandes:wizard.modele_fiscal.imp_cols.total_taxes")}</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importations.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell><Input className="h-7 text-xs" value={l.designation} onChange={e => updateImportation(i, "designation", e.target.value)} /></TableCell>
                          <TableCell><Input className="h-7 text-xs" value={l.unite} onChange={e => updateImportation(i, "unite", e.target.value)} /></TableCell>
                          <TableCell><Input className="h-7 text-xs" type="number" value={l.quantite || ""} onChange={e => updateImportation(i, "quantite", e.target.value)} /></TableCell>
                          <TableCell><Input className="h-7 text-xs" type="number" value={l.prixUnitaire || ""} onChange={e => updateImportation(i, "prixUnitaire", e.target.value)} /></TableCell>
                          {showNomenclature && <TableCell><Input className="h-7 text-xs" value={l.nomenclature || ""} onChange={e => updateImportation(i, "nomenclature", e.target.value)} /></TableCell>}
                          <TableCell><Input className="h-7 text-xs" type="number" value={l.tauxDD} onChange={e => updateImportation(i, "tauxDD", e.target.value)} /></TableCell>
                          <TableCell><Input className="h-7 text-xs" type="number" value={l.tauxRS} onChange={e => updateImportation(i, "tauxRS", e.target.value)} /></TableCell>
                          <TableCell><Input className="h-7 text-xs" type="number" value={l.tauxPSC} onChange={e => updateImportation(i, "tauxPSC", e.target.value)} /></TableCell>
                          <TableCell><Input className="h-7 text-xs" type="number" value={l.tauxTVA} onChange={e => updateImportation(i, "tauxTVA", e.target.value)} /></TableCell>
                          <TableCell className="text-end text-xs">{fmt(l.valeurDouane)}</TableCell>
                          <TableCell className="text-end text-xs">{fmt(l.dd)}</TableCell>
                          <TableCell className="text-end text-xs">{fmt(l.tvaDouane)}</TableCell>
                          <TableCell className="text-end text-xs font-semibold">{fmt(l.totalTaxes)}</TableCell>
                          <TableCell>
                            {importations.length > 1 && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setImportations(prev => prev.filter((_, j) => j !== i))}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 p-3 bg-muted/50 rounded-lg text-sm">
                  <div><span className="text-muted-foreground">{t("demandes:wizard.modele_fiscal.totals.vd")}</span><p className="font-semibold">{fmt(totalVD)}</p></div>
                  <div><span className="text-muted-foreground">{t("demandes:wizard.modele_fiscal.totals.dd")}</span><p className="font-semibold">{fmt(totalDD)}</p></div>
                  <div><span className="text-muted-foreground">{t("demandes:wizard.modele_fiscal.totals.tva_douane")}</span><p className="font-semibold">{fmt(totalTVADouane)}</p></div>
                  <div><span className="text-muted-foreground">{t("demandes:wizard.modele_fiscal.totals.credit_exterieur")}</span><p className="font-semibold text-primary">{fmt(creditExterieur)}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("demandes:wizard.modele_fiscal.section_fiscalite")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.fisc.montant_ht")}</Label>
                    <Input type="number" value={fiscalite.montantHT || ""} onChange={e => updateFiscalite("montantHT", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.fisc.taux_tva")}</Label>
                    <Input type="number" value={fiscalite.tauxTVA} onChange={e => updateFiscalite("tauxTVA", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.fisc.autres_taxes")}</Label>
                    <Input type="number" value={fiscalite.autresTaxes || ""} onChange={e => updateFiscalite("autresTaxes", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.fisc.tva_collectee")}</Label>
                    <Input readOnly value={fmt(fiscalite.tvaCollectee)} className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.fisc.tva_deductible")}</Label>
                    <Input readOnly value={fmt(totalTVADouane)} className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.fisc.tva_nette")}</Label>
                    <Input readOnly value={fmt(fiscalite.tvaNette)} className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.fisc.credit_interieur")}</Label>
                    <Input readOnly value={fmt(fiscalite.creditInterieur)} className="bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("demandes:wizard.modele_fiscal.section_recap")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.totals.credit_exterieur")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={creditExtManuel}
                      placeholder={String(creditExterieurCalc || 0)}
                      onChange={e => setCreditExtManuel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.totals.credit_interieur")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={creditIntManuel}
                      placeholder={String(fiscalite.creditInterieur || 0)}
                      onChange={e => setCreditIntManuel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.modele_fiscal.totals.credit_total")}</Label>
                    <Input readOnly value={fmt(creditTotal)} className="bg-muted font-bold text-primary" />
                  </div>
                </div>
                
              </CardContent>

            </Card>
          </div>
        )}

        {/* ═══ STEP 2: DQE ═══ */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("demandes:wizard.dqe_form.section")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.dqe_form.numero_aaoi")}</Label>
                    <Input value={dqeNumero} onChange={e => setDqeNumero(e.target.value)} placeholder={t("demandes:wizard.dqe_form.numero_aaoi_placeholder")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.dqe_form.projet")}</Label>
                    <Input value={dqeProjet} onChange={e => setDqeProjet(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("demandes:wizard.dqe_form.lot")}</Label>
                    <Input value={dqeLot} onChange={e => setDqeLot(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Taux TVA %</Label>
                    <Input type="number" value={dqeTauxTVA} onChange={e => setDqeTauxTVA(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setDqeLignes(prev => [...prev, emptyDqeLigne()])}>
                    <Plus className="h-3 w-3 me-1" /> {t("demandes:wizard.dqe_form.add_line")}
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t("demandes:wizard.dqe_form.cols.designation")}</TableHead>
                      <TableHead className="text-xs w-20">{t("demandes:wizard.dqe_form.cols.unite")}</TableHead>
                      <TableHead className="text-xs w-24">{t("demandes:wizard.dqe_form.cols.quantite")}</TableHead>
                      <TableHead className="text-xs w-24">{t("demandes:wizard.dqe_form.cols.pu_ht")}</TableHead>
                      <TableHead className="text-xs w-28 text-end">{t("demandes:wizard.dqe_form.cols.montant_ht")}</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dqeLignes.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell><Input className="h-7 text-xs" value={l.designation} onChange={e => updateDqeLigne(i, "designation", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 text-xs" value={l.unite} onChange={e => updateDqeLigne(i, "unite", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 text-xs" type="number" value={l.quantite || ""} onChange={e => updateDqeLigne(i, "quantite", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 text-xs" type="number" value={l.prixUnitaireHT || ""} onChange={e => updateDqeLigne(i, "prixUnitaireHT", e.target.value)} /></TableCell>
                        <TableCell className="text-end text-xs font-semibold">{fmt(l.montantHT)}</TableCell>
                        <TableCell>
                          {dqeLignes.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDqeLignes(prev => prev.filter((_, j) => j !== i))}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                  <div><span className="text-muted-foreground">{t("demandes:wizard.dqe_form.totals.total_ht")}</span><p className="font-semibold">{fmt(dqeTotalHT)}</p></div>
                  <div><span className="text-muted-foreground">{t("demandes:wizard.dqe_form.totals.tva")}</span><p className="font-semibold">{fmt(dqeMontantTVA)}</p></div>
                  <div><span className="text-muted-foreground">{t("demandes:wizard.dqe_form.totals.total_ttc")}</span><p className="font-semibold text-primary">{fmt(dqeTotalTTC)}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("demandes:wizard.actions.previous")}
              </Button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("demandes:wizard.actions.cancel")}</Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !titulaireSelected}>
                {t("demandes:wizard.actions.next")} <ArrowRight className="h-4 w-4 ms-1 rtl:rotate-180" />
              </Button>
            ) : (
              <>
                {editingDemande?.statut !== "RECUE" && (
                  <Button
                    variant="secondary"
                    onClick={() => handleSubmit(true)}
                    disabled={savingDraft || submitting || !titulaireSelected}
                    title={t("demandes:wizard.actions.save_draft_tooltip")}
                  >
                    {savingDraft ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <FileText className="h-4 w-4 me-1" />}
                    {t("demandes:wizard.actions.save_draft")}
                  </Button>
                )}
                <Button onClick={() => handleSubmit(false)} disabled={submitting || savingDraft || !titulaireSelected}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Send className="h-4 w-4 me-1" />}
                  {isEditing ? t("demandes:wizard.actions.submit") : t("demandes:wizard.actions.submit_full")}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Add Devise dialog */}
    <Dialog open={showAddDevise} onOpenChange={setShowAddDevise}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t("demandes:wizard.inline.add_devise_dialog_title")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder={t("demandes:wizard.inline.devise_code_placeholder")} value={newDevise.code} onChange={e => setNewDevise(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} />
          <Input placeholder={t("demandes:wizard.inline.devise_libelle_placeholder")} value={newDevise.libelle} onChange={e => setNewDevise(prev => ({ ...prev, libelle: e.target.value }))} />
          <Input placeholder={t("demandes:wizard.inline.devise_symbole_placeholder")} value={newDevise.symbole} onChange={e => setNewDevise(prev => ({ ...prev, symbole: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddDevise(false)}>{t("demandes:wizard.actions.cancel")}</Button>
          <Button disabled={addingDevise || !newDevise.code || !newDevise.libelle} onClick={async () => {
            setAddingDevise(true);
            try {
              const created = await deviseApi.create(newDevise);
              setDevises(prev => [...prev, created]);
              setNewConvForm(f => ({ ...f, deviseOrigine: created.code, tauxChange: undefined, montantMru: undefined }));
              setShowAddDevise(false);
              setNewDevise({ code: "", libelle: "", symbole: "" });
              toast({ title: t("demandes:toast.success"), description: t("demandes:wizard.toast.devise_added") });
            } catch (e: any) {
              toast({ title: t("demandes:toast.error"), description: e.message, variant: "destructive" });
            } finally { setAddingDevise(false); }
          }}>
            {addingDevise ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
            {t("demandes:wizard.actions.add_short")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Création d'un groupement (avec création d'entreprise membre à la volée) */}
    <GroupementFormDialog
      open={showCreateGroupement}
      onOpenChange={setShowCreateGroupement}
      onSaved={(g) => {
        setGroupements(prev => [...prev.filter(x => x.id !== g.id), g]);
        if (g.id) { setTitulaireType("GROUPEMENT"); setGroupementId(String(g.id)); }
      }}
    />
    </>
  );
}
