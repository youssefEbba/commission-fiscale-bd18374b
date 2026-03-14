import { useState, useCallback, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { useAuth } from "@/contexts/AuthContext";
import {
  entrepriseApi, EntrepriseDto,
  conventionApi, ConventionDto, CreateConventionRequest,
  TypeDocumentConvention, CONVENTION_DOCUMENT_TYPES,
  demandeCorrectionApi,
  ImportationLigne, FiscaliteInterieure, DqeLigne,
  marcheApi, MarcheDto,
  bailleurApi, BailleurDto,
  deviseApi, DeviseDto, CreateDeviseRequest,
  forexApi,
  documentRequirementApi, DocumentRequirementDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2, Plus, Trash2, ArrowLeft, ArrowRight, Upload, CheckCircle, Send, FileText, Building2, Info,
  XCircle, Merge, ArrowUp, ArrowDown, File, Paperclip,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

export default function CreateDemandeWizard({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 0: Entreprise + Convention + Documents
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [conventions, setConventions] = useState<ConventionDto[]>([]);
  const [marches, setMarches] = useState<MarcheDto[]>([]);
  const [entrepriseId, setEntrepriseId] = useState("");
  const [conventionId, setConventionId] = useState("");
  const [marcheId, setMarcheId] = useState("");
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});
  const [loadingData, setLoadingData] = useState(false);

  // Create enterprise inline
  const [showCreateEntreprise, setShowCreateEntreprise] = useState(false);
  const [newEntreprise, setNewEntreprise] = useState<EntrepriseDto>({ raisonSociale: "", nif: "" });
  const [creatingEntreprise, setCreatingEntreprise] = useState(false);

  // Create convention inline – full form matching Conventions page
  const [showCreateConvention, setShowCreateConvention] = useState(false);
  const [newConvForm, setNewConvForm] = useState<CreateConventionRequest>({
    reference: "", intitule: "", bailleur: "", bailleurDetails: "",
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

  // Create marché inline
  const [showCreateMarche, setShowCreateMarche] = useState(false);
  const [newMarche, setNewMarche] = useState<{ numeroMarche: string; montantContratTtc?: number; dateSignature?: string }>({ numeroMarche: "" });
  const [creatingMarche, setCreatingMarche] = useState(false);

  // Bailleurs référentiel
  const [bailleurs, setBailleurs] = useState<BailleurDto[]>([]);
  const [showCreateBailleur, setShowCreateBailleur] = useState(false);
  const [newBailleurNom, setNewBailleurNom] = useState("");
  const [creatingBailleur, setCreatingBailleur] = useState(false);

  // GED document requirements
  const [gedDocTypes, setGedDocTypes] = useState<DocumentRequirementDto[]>([]);

  // Step 1: Modèle fiscal
  const [typeProjet, setTypeProjet] = useState("BTP");
  const [referenceDossier, setReferenceDossier] = useState("");
  const [showNomenclature, setShowNomenclature] = useState(false);
  const [importations, setImportations] = useState<ImportationLigne[]>([emptyImportation()]);
  const [fiscalite, setFiscalite] = useState<FiscaliteInterieure>({
    montantHT: 0, tauxTVA: 16, autresTaxes: 0, tvaCollectee: 0,
    tvaDeductible: 0, tvaNette: 0, creditInterieur: 0,
  });

  // Step 2: DQE
  const [dqeNumero, setDqeNumero] = useState("");
  const [dqeProjet, setDqeProjet] = useState("");
  const [dqeLot, setDqeLot] = useState("");
  const [dqeTauxTVA, setDqeTauxTVA] = useState(16);
  const [dqeLignes, setDqeLignes] = useState<DqeLigne[]>([emptyDqeLigne()]);

  // Load data on open
  const isDelegate = user?.role === "AUTORITE_UPM" || user?.role === "AUTORITE_UEP";

  const loadInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [ent, conv, marc, bail, gedReqs] = await Promise.all([
        entrepriseApi.getAll(),
        conventionApi.getAll(),
        marcheApi.getAll().catch(() => [] as MarcheDto[]),
        bailleurApi.getAll().catch(() => [] as BailleurDto[]),
        documentRequirementApi.getByProcessus("CORRECTION_OFFRE_FISCALE").catch(() => [] as DocumentRequirementDto[]),
      ]);
      setEntreprises(ent);
      setConventions(conv);
      // Delegates only see marchés assigned to them
      if (isDelegate && user?.userId) {
        setMarches(marc.filter(m => m.delegueIds?.includes(user.userId)));
      } else {
        setMarches(marc);
      }
      setBailleurs(bail);
      setGedDocTypes(gedReqs.sort((a, b) => (a.ordreAffichage || 0) - (b.ordreAffichage || 0)));
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les données", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast, isDelegate, user?.userId]);

  useEffect(() => {
    if (open) {
      setStep(0);
      setEntrepriseId("");
      setConventionId("");
      setMarcheId("");
      setDocFiles({});
      setImportations([emptyImportation()]);
      setDqeLignes([emptyDqeLigne()]);
      setReferenceDossier("");
      setShowCreateEntreprise(false);
      setNewEntreprise({ raisonSociale: "", nif: "" });
      setShowCreateConvention(false);
      setNewConvForm({
        reference: "", intitule: "", bailleur: "", bailleurDetails: "",
        dateSignature: "", dateFin: "",
        montantDevise: undefined, deviseOrigine: "", montantMru: undefined, tauxChange: undefined,
      });
      setConvCreateDocs([]);
      setConvGedReqs([]);
      setShowCreateMarche(false);
      setNewMarche({ numeroMarche: "" });
      // pendingMarche removed — marchés are now created directly via API
      loadInitialData();
    }
  }, [open, loadInitialData]);

  // Create enterprise inline
  const handleCreateEntreprise = async () => {
    if (!newEntreprise.raisonSociale || !newEntreprise.nif) {
      toast({ title: "Erreur", description: "Raison sociale et NIF sont obligatoires", variant: "destructive" });
      return;
    }
    setCreatingEntreprise(true);
    try {
      const created = await entrepriseApi.create(newEntreprise);
      setEntreprises(prev => [...prev, created]);
      setEntrepriseId(String(created.id));
      setShowCreateEntreprise(false);
      setNewEntreprise({ raisonSociale: "", nif: "" });
      toast({ title: "Succès", description: "Entreprise créée" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCreatingEntreprise(false);
    }
  };

  // Auto-fetch devises + GED requirements when convention creation opens
  useEffect(() => {
    if (showCreateConvention) {
      setDevisesLoading(true);
      const defaultDevises: DeviseDto[] = [
        { id: -1, code: "EUR", libelle: "Euro", symbole: "€" },
        { id: -2, code: "USD", libelle: "Dollar américain", symbole: "$" },
      ];
      deviseApi.getAll()
        .then(fetched => {
          const codes = new Set(fetched.map(d => d.code));
          setDevises([...fetched, ...defaultDevises.filter(d => !codes.has(d.code))]);
        })
        .catch(() => setDevises(defaultDevises))
        .finally(() => setDevisesLoading(false));
      documentRequirementApi.getByProcessus("CONVENTION")
        .then(reqs => {
          setConvGedReqs(reqs);
          if (reqs.length > 0) setConvDocType(reqs[0].typeDocument as TypeDocumentConvention);
        })
        .catch(() => setConvGedReqs([]));
    }
  }, [showCreateConvention]);

  // Auto-fetch taux when devise changes in convention form
  useEffect(() => {
    if (!newConvForm.deviseOrigine || newConvForm.deviseOrigine === "MRU") {
      setNewConvForm(f => ({ ...f, tauxChange: newConvForm.deviseOrigine === "MRU" ? 1 : undefined, montantMru: newConvForm.deviseOrigine === "MRU" && f.montantDevise ? f.montantDevise : undefined }));
      return;
    }
    let cancelled = false;
    setConvTauxLoading(true);
    forexApi.rate(newConvForm.deviseOrigine, "MRU")
      .then(res => {
        if (cancelled) return;
        const rate = Math.round(res.rate * 10000) / 10000;
        setNewConvForm(f => ({
          ...f, tauxChange: rate,
          montantMru: f.montantDevise ? Math.round(f.montantDevise * rate * 100) / 100 : undefined,
        }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setConvTauxLoading(false); });
    return () => { cancelled = true; };
  }, [newConvForm.deviseOrigine]);

  const convMergeCreateDocs = useCallback(async () => {
    const pdfFiles = convCreateDocs.filter(d => d.file.name.toLowerCase().endsWith(".pdf")).map(d => d.file);
    if (pdfFiles.length < 2) { toast({ title: "Fusion impossible", description: "Il faut au moins 2 fichiers PDF.", variant: "destructive" }); return; }
    setConvMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of pdfFiles) {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }
      const mergedBytes = await mergedPdf.save();
      const mergedBlob = new Blob([mergedBytes as BlobPart], { type: "application/pdf" });
      const mergedFile = new window.File([mergedBlob], "convention_fusionnee.pdf", { type: "application/pdf" });
      setConvCreateDocs([{ type: "CONVENTION_JOIGNED_DOCUMENT" as TypeDocumentConvention, file: mergedFile }]);
      toast({ title: "Succès", description: `${pdfFiles.length} PDF fusionnés.` });
    } catch (e: any) {
      toast({ title: "Erreur de fusion", description: e.message, variant: "destructive" });
    } finally { setConvMerging(false); }
  }, [convCreateDocs, toast]);

  // Create convention inline
  const handleCreateConvention = async () => {
    if (!newConvForm.reference || !newConvForm.intitule) {
      toast({ title: "Erreur", description: "Référence et intitulé sont obligatoires", variant: "destructive" });
      return;
    }
    setCreatingConvention(true);
    try {
      const created = await conventionApi.create({
        ...newConvForm,
        dateSignature: newConvForm.dateSignature || new Date().toISOString().split("T")[0],
        statut: "EN_ATTENTE",
        autoriteContractanteId: user?.autoriteContractanteId || undefined,
      });
      // Upload convention documents
      for (const doc of convCreateDocs) {
        try { await conventionApi.uploadDocument(created.id, doc.type, doc.file); } catch { /* continue */ }
      }
      setConventions(prev => [...prev, created]);
      setConventionId(String(created.id));
      setShowCreateConvention(false);
      setNewConvForm({
        reference: "", intitule: "", bailleur: "", bailleurDetails: "",
        dateSignature: "", dateFin: "",
        montantDevise: undefined, deviseOrigine: "", montantMru: undefined, tauxChange: undefined,
      });
      setConvCreateDocs([]);
      toast({ title: "Succès", description: `Convention créée${convCreateDocs.length ? ` avec ${convCreateDocs.length} document(s)` : ""}` });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCreatingConvention(false);
    }
  };

  // Create marché inline — now calls API directly with conventionId
  const handleCreateMarche = async () => {
    if (!newMarche.numeroMarche) {
      toast({ title: "Erreur", description: "Le numéro de marché est obligatoire", variant: "destructive" });
      return;
    }
    if (!conventionId) {
      toast({ title: "Erreur", description: "Veuillez d'abord sélectionner une convention", variant: "destructive" });
      return;
    }
    setCreatingMarche(true);
    try {
      const created = await marcheApi.create({
        conventionId: Number(conventionId),
        numeroMarche: newMarche.numeroMarche,
        montantContratTtc: newMarche.montantContratTtc,
        dateSignature: newMarche.dateSignature || new Date().toISOString().split("T")[0],
        statut: "EN_COURS",
      });
      setMarches(prev => [...prev, created]);
      setMarcheId(String(created.id));
      setShowCreateMarche(false);
      setNewMarche({ numeroMarche: "" });
      toast({ title: "Succès", description: "Marché créé" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCreatingMarche(false);
    }
  };

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
  const creditExterieur = totalTaxes;

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

  const creditTotal = creditExterieur + fiscalite.creditInterieur;

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

  // ── Submit ──
  const handleSubmit = async () => {
    if ((user?.role === "AUTORITE_CONTRACTANTE" || isDelegate) && !user?.autoriteContractanteId) {
      toast({ title: "Erreur", description: "Votre compte n'est pas encore associé à une Autorité Contractante. Veuillez contacter un administrateur.", variant: "destructive" });
      return;
    }
    if (!entrepriseId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une entreprise", variant: "destructive" });
      return;
    }
    if (!conventionId && !marcheId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une convention ou un marché", variant: "destructive" });
      return;
    }

    // If a marché is selected, get its conventionId from the marché data
    const selectedMarche = marcheId ? marches.find(m => String(m.id) === marcheId) : null;
    const finalConventionId = conventionId ? Number(conventionId) : selectedMarche?.conventionId;

    setSubmitting(true);
    try {
      const demande = await demandeCorrectionApi.create({
        autoriteContractanteId: user?.autoriteContractanteId || undefined,
        entrepriseId: Number(entrepriseId),
        conventionId: finalConventionId,
        marcheId: marcheId && marcheId !== "pending" ? Number(marcheId) : undefined,
        modeleFiscal: {
          referenceDossier,
          typeProjet,
          afficherNomenclature: showNomenclature,
          importations,
          fiscaliteInterieure: { ...fiscalite, tvaDeductible: totalTVADouane },
          recapitulatif: { creditExterieur, creditInterieur: fiscalite.creditInterieur, creditTotal },
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
      });

      // Marché is now created directly via API (no longer deferred)

      // Upload documents
      const docEntries = Object.entries(docFiles);
      for (const [type, file] of docEntries) {
        try {
          await demandeCorrectionApi.uploadDocument(demande.id, type, file);
        } catch {
          // continue uploading others
        }
      }

      // Send only Offre Fiscale, Offre Financière & DQE to AI service
      try {
        const AI_DOC_TYPES = ["OFFRE_FISCALE", "OFFRE_FINANCIERE", "DQE", "DAO_DQE"];
        const uploadedDocs = await demandeCorrectionApi.getDocuments(demande.id);
        const sourceUrls = uploadedDocs
          .filter((d: any) => d.chemin && AI_DOC_TYPES.some(t => (d.type || d.typeDocument || "").includes(t)))
          .map((d: any) => d.chemin.replace(/\\/g, "/"));
        if (sourceUrls.length > 0) {
          const AI_SERVICE_BASE = "https://superelegant-irretraceably-liv.ngrok-free.dev";
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

      toast({ title: "Succès", description: `Demande ${demande.numero || "#" + demande.id} créée` });
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { label: "Entreprise & Documents", icon: FileText },
    // { label: "Modèle Fiscal", icon: FileText },
    // { label: "DQE", icon: FileText },
  ];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle demande de correction</DialogTitle>
        </DialogHeader>

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Entreprise with create option */}
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span>Entreprise *</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-primary"
                        onClick={() => setShowCreateEntreprise(!showCreateEntreprise)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {showCreateEntreprise ? "Annuler" : "Créer"}
                      </Button>
                    </Label>
                    {!showCreateEntreprise ? (
                      <Select value={entrepriseId} onValueChange={setEntrepriseId}>
                        <SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                        <SelectContent>
                          {entreprises.map(e => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.raisonSociale} — NIF: {e.nif}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Card className="border-primary/30">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <Building2 className="h-4 w-4" />
                            Nouvelle entreprise
                          </div>
                          <Input
                            placeholder="Raison sociale *"
                            value={newEntreprise.raisonSociale}
                            onChange={e => setNewEntreprise(prev => ({ ...prev, raisonSociale: e.target.value }))}
                          />
                          <Input
                            placeholder="NIF *"
                            value={newEntreprise.nif}
                            onChange={e => setNewEntreprise(prev => ({ ...prev, nif: e.target.value }))}
                          />
                          <Input
                            placeholder="Adresse (optionnel)"
                            value={newEntreprise.adresse || ""}
                            onChange={e => setNewEntreprise(prev => ({ ...prev, adresse: e.target.value }))}
                          />
                          <Input
                            placeholder="Email (optionnel)"
                            value={newEntreprise.email || ""}
                            onChange={e => setNewEntreprise(prev => ({ ...prev, email: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={handleCreateEntreprise}
                            disabled={creatingEntreprise}
                          >
                            {creatingEntreprise ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                            Créer l'entreprise
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Attribution / Adjudication */}
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span>Attribution / Adjudication</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-primary"
                        onClick={() => { setShowCreateMarche(!showCreateMarche); if (showCreateMarche) { setShowCreateConvention(false); } }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {showCreateMarche ? "Annuler" : "Créer"}
                      </Button>
                    </Label>

                    {!showCreateMarche ? (
                      <Select value={marcheId} onValueChange={setMarcheId}>
                        <SelectTrigger><SelectValue placeholder="Sélectionnez (optionnel)" /></SelectTrigger>
                        <SelectContent>
                          {marches.map(m => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.numeroMarche || `#${m.id}`} — {m.montantContratTtc?.toLocaleString("fr-FR") || "0"} MRU
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Card className="border-primary/30">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <FileText className="h-4 w-4" />
                            Nouveau marché
                          </div>

                          {/* Convention selector — only during creation */}
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center justify-between">
                              <span>Convention *</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-5 text-xs text-primary p-0"
                                onClick={() => setShowCreateConvention(!showCreateConvention)}
                              >
                                <Plus className="h-3 w-3 mr-0.5" />
                                {showCreateConvention ? "Annuler" : "Créer"}
                              </Button>
                            </Label>
                            {!showCreateConvention ? (
                              <Select value={conventionId} onValueChange={v => { setConventionId(v); }}>
                                <SelectTrigger><SelectValue placeholder="Sélectionnez une convention" /></SelectTrigger>
                                <SelectContent>
                                  {conventions.map(c => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                      {c.reference || `#${c.id}`} — {c.intitule || c.bailleur || ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="space-y-3 border border-dashed border-border rounded-md p-3 max-h-[50vh] overflow-y-auto">
                                <Input
                                  placeholder="Référence *"
                                  value={newConvForm.reference}
                                  onChange={e => setNewConvForm(prev => ({ ...prev, reference: e.target.value }))}
                                />
                                <Input
                                  placeholder="Intitulé *"
                                  value={newConvForm.intitule}
                                  onChange={e => setNewConvForm(prev => ({ ...prev, intitule: e.target.value }))}
                                />
                                {/* Bailleur */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground flex items-center justify-between">
                                    <span>Bailleur (optionnel)</span>
                                    <Button type="button" variant="ghost" size="sm" className="h-5 text-xs text-primary p-0" onClick={() => setShowCreateBailleur(!showCreateBailleur)}>
                                      <Plus className="h-3 w-3 mr-0.5" />
                                      {showCreateBailleur ? "Annuler" : "Ajouter"}
                                    </Button>
                                  </Label>
                                  {!showCreateBailleur ? (
                                    <Select value={newConvForm.bailleur || ""} onValueChange={v => setNewConvForm(prev => ({ ...prev, bailleur: v }))}>
                                      <SelectTrigger><SelectValue placeholder="Sélectionnez un bailleur" /></SelectTrigger>
                                      <SelectContent>
                                        {bailleurs.map(b => (
                                          <SelectItem key={b.id} value={b.nom}>{b.nom}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className="flex gap-1">
                                      <Input placeholder="Nom du bailleur" value={newBailleurNom} onChange={e => setNewBailleurNom(e.target.value)} className="text-sm" />
                                      <Button size="sm" disabled={creatingBailleur || !newBailleurNom} onClick={async () => {
                                        setCreatingBailleur(true);
                                        try {
                                          const created = await bailleurApi.create({ nom: newBailleurNom });
                                          setBailleurs(prev => [...prev, created]);
                                          setNewConvForm(prev => ({ ...prev, bailleur: created.nom }));
                                          setNewBailleurNom("");
                                          setShowCreateBailleur(false);
                                          toast({ title: "Succès", description: "Bailleur ajouté" });
                                        } catch (e: any) {
                                          toast({ title: "Erreur", description: e.message, variant: "destructive" });
                                        } finally { setCreatingBailleur(false); }
                                      }}>
                                        {creatingBailleur ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <Input
                                  placeholder="Descriptif de projets (optionnel)"
                                  value={newConvForm.bailleurDetails}
                                  onChange={e => setNewConvForm(prev => ({ ...prev, bailleurDetails: e.target.value }))}
                                />
                                {/* Dates */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Date signature *</Label>
                                    <Input type="date" value={newConvForm.dateSignature || ""} onChange={e => setNewConvForm(prev => ({ ...prev, dateSignature: e.target.value }))} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Date fin</Label>
                                    <Input type="date" value={newConvForm.dateFin || ""} onChange={e => setNewConvForm(prev => ({ ...prev, dateFin: e.target.value }))} />
                                  </div>
                                </div>
                                {/* Devise */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Devise d'origine</Label>
                                  <div className="flex gap-1">
                                    <Select value={newConvForm.deviseOrigine || ""} onValueChange={code => setNewConvForm(f => ({ ...f, deviseOrigine: code, tauxChange: undefined, montantMru: undefined }))}>
                                      <SelectTrigger className="flex-1">
                                        {devisesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Devise" />}
                                      </SelectTrigger>
                                      <SelectContent>
                                        {devises.map(d => (
                                          <SelectItem key={d.id} value={d.code}>{d.code} — {d.libelle}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowAddDevise(true)} title="Ajouter devise">
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                {/* Montants */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Montant devise</Label>
                                    <Input type="number" value={newConvForm.montantDevise ?? ""} onChange={e => {
                                      const val = e.target.value ? Number(e.target.value) : undefined;
                                      setNewConvForm(f => ({ ...f, montantDevise: val, montantMru: val && f.tauxChange ? Math.round(val * f.tauxChange * 100) / 100 : undefined }));
                                    }} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Taux de change</Label>
                                    <Input readOnly value={newConvForm.tauxChange ?? "—"} className="bg-muted" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Montant MRU</Label>
                                    <Input readOnly value={newConvForm.montantMru ? newConvForm.montantMru.toLocaleString("fr-FR") : "—"} className="bg-muted" />
                                  </div>
                                </div>
                                {convTauxLoading && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Récupération du taux...
                                  </div>
                                )}
                                {/* Documents convention */}
                                <div className="border-t border-border pt-2 space-y-2">
                                  <Label className="text-xs font-semibold flex items-center gap-1">
                                    <Paperclip className="h-3 w-3" /> Documents joints
                                  </Label>
                                  {convGedReqs.length > 0 && (
                                    <div className="space-y-0.5">
                                      {convGedReqs.map(req => {
                                        const hasDoc = convCreateDocs.some(d => d.type === req.typeDocument);
                                        return (
                                          <div key={req.id} className={`flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 ${req.obligatoire && !hasDoc ? "bg-destructive/10" : hasDoc ? "bg-green-50" : "bg-muted/30"}`}>
                                            {hasDoc ? <CheckCircle className="h-3 w-3 text-green-600 shrink-0" /> : <XCircle className={`h-3 w-3 shrink-0 ${req.obligatoire ? "text-destructive" : "text-muted-foreground"}`} />}
                                            <span>{req.typeDocument}</span>
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
                                          ? convGedReqs.map(r => ({ value: r.typeDocument, label: r.typeDocument }))
                                          : CONVENTION_DOCUMENT_TYPES
                                        ).map(t => (
                                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input type="file" multiple className="flex-1 text-xs" onChange={e => {
                                      const files = e.target.files;
                                      if (files) { Array.from(files).forEach(f => setConvCreateDocs(prev => [...prev, { type: convDocType, file: f }])); e.target.value = ""; }
                                    }} />
                                  </div>
                                  {convCreateDocs.length > 0 && (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-muted-foreground">{convCreateDocs.length} fichier(s)</span>
                                        {convCreateDocs.filter(d => d.file.name.toLowerCase().endsWith(".pdf")).length >= 2 && (
                                          <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={convMergeCreateDocs} disabled={convMerging}>
                                            {convMerging ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Merge className="h-3 w-3 mr-1" />}
                                            Fusionner PDF
                                          </Button>
                                        )}
                                      </div>
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
                                          <Badge variant="outline" className="text-[10px] shrink-0">{d.type}</Badge>
                                          <span className="truncate flex-1">{d.file.name}</span>
                                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-destructive" onClick={() => setConvCreateDocs(prev => prev.filter((_, j) => j !== i))}>
                                            <XCircle className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={handleCreateConvention}
                                  disabled={creatingConvention || !newConvForm.reference || !newConvForm.intitule}
                                >
                                  {creatingConvention ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                                  Créer la convention
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Marché fields — enabled after convention */}
                          {!conventionId ? (
                            <p className="text-xs text-muted-foreground italic border border-dashed border-border rounded-md p-2 text-center">
                              Choisissez d'abord une convention ci-dessus
                            </p>
                          ) : (
                            <>
                              <Input
                                placeholder="Numéro de marché *"
                                value={newMarche.numeroMarche}
                                onChange={e => setNewMarche(prev => ({ ...prev, numeroMarche: e.target.value }))}
                              />
                              <Input
                                placeholder="Montant TTC (optionnel)"
                                type="number"
                                value={newMarche.montantContratTtc || ""}
                                onChange={e => setNewMarche(prev => ({ ...prev, montantContratTtc: e.target.value ? parseFloat(e.target.value) : undefined }))}
                              />
                              <div>
                                <Label className="text-xs text-muted-foreground">Date de signature</Label>
                                <Input
                                  type="date"
                                  value={newMarche.dateSignature || ""}
                                  onChange={e => setNewMarche(prev => ({ ...prev, dateSignature: e.target.value }))}
                                />
                              </div>
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={handleCreateMarche}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Créer le marché
                              </Button>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Pièces à joindre <span className="text-muted-foreground text-xs">(selon configuration GED)</span></h3>
                  {gedDocTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">Aucun document configuré pour ce processus dans la GED.</p>
                  ) : (
                    <div className="space-y-2">
                      {gedDocTypes.map(dt => (
                        <div key={dt.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                          {docFiles[dt.typeDocument] ? (
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className={`flex-1 text-sm flex items-center gap-1 ${docFiles[dt.typeDocument] ? "font-medium" : "text-muted-foreground"}`}>
                            {dt.typeDocument.replace(/_/g, " ")}
                            {dt.obligatoire && <span className="text-destructive ml-1">*</span>}
                            {dt.description && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px] text-xs">
                                  {dt.description}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                          {docFiles[dt.typeDocument] && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">{docFiles[dt.typeDocument].name}</span>
                          )}
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept={dt.typesAutorises?.map(f => f === "PDF" ? ".pdf" : f === "WORD" ? ".doc,.docx" : f === "EXCEL" ? ".xls,.xlsx" : "image/*").join(",")}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setDocFiles(prev => ({ ...prev, [dt.typeDocument]: f }));
                              }}
                            />
                            <span className="text-xs text-primary hover:underline">{docFiles[dt.typeDocument] ? "Changer" : "Choisir"}</span>
                          </label>
                        </div>
                      ))}
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
                <CardTitle className="text-base">Modèle fiscal — Paramètres</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Référence dossier</Label>
                    <Input value={referenceDossier} onChange={e => setReferenceDossier(e.target.value)} placeholder="REF-001" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type de projet</Label>
                    <Select value={typeProjet} onValueChange={setTypeProjet}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BTP">BTP</SelectItem>
                        <SelectItem value="EQUIPEMENT">Équipements industriels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch checked={showNomenclature} onCheckedChange={setShowNomenclature} />
                    <Label className="text-xs">Nomenclature douanière</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 1: Importations */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">1 — Importations & Douane</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setImportations(prev => [...prev, emptyImportation()])}>
                    <Plus className="h-3 w-3 mr-1" /> Ligne
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs min-w-[120px]">Désignation</TableHead>
                        <TableHead className="text-xs w-16">Unité</TableHead>
                        <TableHead className="text-xs w-20">Qté</TableHead>
                        <TableHead className="text-xs w-20">PU</TableHead>
                        {showNomenclature && <TableHead className="text-xs w-24">Nomencl.</TableHead>}
                        <TableHead className="text-xs w-16">DD%</TableHead>
                        <TableHead className="text-xs w-16">RS%</TableHead>
                        <TableHead className="text-xs w-16">PSC%</TableHead>
                        <TableHead className="text-xs w-16">TVA%</TableHead>
                        <TableHead className="text-xs w-24 text-right">Val. Douane</TableHead>
                        <TableHead className="text-xs w-20 text-right">DD</TableHead>
                        <TableHead className="text-xs w-20 text-right">TVA douane</TableHead>
                        <TableHead className="text-xs w-24 text-right">Total taxes</TableHead>
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
                          <TableCell className="text-right text-xs">{fmt(l.valeurDouane)}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(l.dd)}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(l.tvaDouane)}</TableCell>
                          <TableCell className="text-right text-xs font-semibold">{fmt(l.totalTaxes)}</TableCell>
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
                  <div><span className="text-muted-foreground">Total VD</span><p className="font-semibold">{fmt(totalVD)}</p></div>
                  <div><span className="text-muted-foreground">Total DD</span><p className="font-semibold">{fmt(totalDD)}</p></div>
                  <div><span className="text-muted-foreground">Total TVA douane</span><p className="font-semibold">{fmt(totalTVADouane)}</p></div>
                  <div><span className="text-muted-foreground">Crédit extérieur</span><p className="font-semibold text-primary">{fmt(creditExterieur)}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Fiscalité intérieure */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2 — Fiscalité intérieure (DGI)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Montant HT</Label>
                    <Input type="number" value={fiscalite.montantHT || ""} onChange={e => updateFiscalite("montantHT", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Taux TVA %</Label>
                    <Input type="number" value={fiscalite.tauxTVA} onChange={e => updateFiscalite("tauxTVA", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Autres taxes</Label>
                    <Input type="number" value={fiscalite.autresTaxes || ""} onChange={e => updateFiscalite("autresTaxes", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">TVA collectée</Label>
                    <Input readOnly value={fmt(fiscalite.tvaCollectee)} className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">TVA déductible (douane)</Label>
                    <Input readOnly value={fmt(totalTVADouane)} className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">TVA nette</Label>
                    <Input readOnly value={fmt(fiscalite.tvaNette)} className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Crédit intérieur</Label>
                    <Input readOnly value={fmt(fiscalite.creditInterieur)} className="bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Récapitulatif */}
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">3 — Récapitulatif</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Crédit extérieur</p>
                    <p className="text-lg font-bold">{fmt(creditExterieur)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Crédit intérieur</p>
                    <p className="text-lg font-bold">{fmt(fiscalite.creditInterieur)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Crédit total</p>
                    <p className="text-xl font-bold text-primary">{fmt(creditTotal)}</p>
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
                <CardTitle className="text-base">Formulaire DQE</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Numéro AAOI</Label>
                    <Input value={dqeNumero} onChange={e => setDqeNumero(e.target.value)} placeholder="AAOI-2026-01" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Projet</Label>
                    <Input value={dqeProjet} onChange={e => setDqeProjet(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lot</Label>
                    <Input value={dqeLot} onChange={e => setDqeLot(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Taux TVA %</Label>
                    <Input type="number" value={dqeTauxTVA} onChange={e => setDqeTauxTVA(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setDqeLignes(prev => [...prev, emptyDqeLigne()])}>
                    <Plus className="h-3 w-3 mr-1" /> Ajouter une ligne
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Désignation</TableHead>
                      <TableHead className="text-xs w-20">Unité</TableHead>
                      <TableHead className="text-xs w-24">Quantité</TableHead>
                      <TableHead className="text-xs w-24">PU HT</TableHead>
                      <TableHead className="text-xs w-28 text-right">Montant HT</TableHead>
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
                        <TableCell className="text-right text-xs font-semibold">{fmt(l.montantHT)}</TableCell>
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
                  <div><span className="text-muted-foreground">Total HT</span><p className="font-semibold">{fmt(dqeTotalHT)}</p></div>
                  <div><span className="text-muted-foreground">TVA</span><p className="font-semibold">{fmt(dqeMontantTVA)}</p></div>
                  <div><span className="text-muted-foreground">Total TTC</span><p className="font-semibold text-primary">{fmt(dqeTotalTTC)}</p></div>
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
                <ArrowLeft className="h-4 w-4 mr-1" /> Précédent
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !entrepriseId}>
                Suivant <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !entrepriseId}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Soumettre la demande
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Add Devise dialog */}
    <Dialog open={showAddDevise} onOpenChange={setShowAddDevise}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Ajouter une devise</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Code (ex: GBP) *" value={newDevise.code} onChange={e => setNewDevise(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} />
          <Input placeholder="Libellé (ex: Livre sterling) *" value={newDevise.libelle} onChange={e => setNewDevise(prev => ({ ...prev, libelle: e.target.value }))} />
          <Input placeholder="Symbole (ex: £)" value={newDevise.symbole} onChange={e => setNewDevise(prev => ({ ...prev, symbole: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddDevise(false)}>Annuler</Button>
          <Button disabled={addingDevise || !newDevise.code || !newDevise.libelle} onClick={async () => {
            setAddingDevise(true);
            try {
              const created = await deviseApi.create(newDevise);
              setDevises(prev => [...prev, created]);
              setNewConvForm(f => ({ ...f, deviseOrigine: created.code, tauxChange: undefined, montantMru: undefined }));
              setShowAddDevise(false);
              setNewDevise({ code: "", libelle: "", symbole: "" });
              toast({ title: "Succès", description: "Devise ajoutée" });
            } catch (e: any) {
              toast({ title: "Erreur", description: e.message, variant: "destructive" });
            } finally { setAddingDevise(false); }
          }}>
            {addingDevise ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
