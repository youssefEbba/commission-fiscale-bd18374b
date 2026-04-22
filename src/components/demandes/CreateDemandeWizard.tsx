import { useState, useCallback, useEffect, useRef } from "react";
import { AI_SERVICE_BASE } from "@/lib/apiConfig";
import { PDFDocument } from "pdf-lib";
import { useAuth } from "@/contexts/AuthContext";
import {
  entrepriseApi, EntrepriseDto,
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
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePersistedFiles } from "@/hooks/usePersistedFiles";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  /** Si fourni, le wizard édite une demande existante (BROUILLON / RECUE / INCOMPLETE). */
  editingId?: number | null;
  /** Demande pré-chargée (utilisée pour préremplir le formulaire en mode édition). */
  editingDemande?: DemandeCorrectionDto | null;
}

export default function CreateDemandeWizard({ open, onOpenChange, onCreated, editingId, editingDemande }: Props) {
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
  // docFiles persistés dans IndexedDB pour survivre à une bascule mobile (WhatsApp, etc.)
  const [docFiles, setDocFiles, clearDocFiles] = usePersistedFiles("demande:docs");
  const [loadingData, setLoadingData] = useState(false);

  // Entreprise search combobox
  const [entrepriseOpen, setEntrepriseOpen] = useState(false);

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

  // Documents déjà téléversés (en mode édition)
  const [existingDocs, setExistingDocs] = useState<Record<string, { id: number; nomFichier: string }>>({});

  // Drag and drop state
  const [dragOverType, setDragOverType] = useState<string | null>(null);

  // Step 1: Modèle fiscal — persistés pour résister à la mise en arrière-plan mobile
  const [typeProjet, setTypeProjet] = usePersistedState<string>("demande:typeProjet", "BTP");
  const [referenceDossier, setReferenceDossier] = usePersistedState<string>("demande:refDossier", "");
  const [showNomenclature, setShowNomenclature] = useState(false);
  const [importations, setImportations] = usePersistedState<ImportationLigne[]>("demande:importations", [emptyImportation()]);
  const [fiscalite, setFiscalite] = usePersistedState<FiscaliteInterieure>("demande:fiscalite", {
    montantHT: 0, tauxTVA: 16, autresTaxes: 0, tvaCollectee: 0,
    tvaDeductible: 0, tvaNette: 0, creditInterieur: 0,
  });

  // Step 2: DQE — persistés
  const [dqeNumero, setDqeNumero] = usePersistedState<string>("demande:dqeNumero", "");
  const [dqeProjet, setDqeProjet] = usePersistedState<string>("demande:dqeProjet", "");
  const [dqeLot, setDqeLot] = usePersistedState<string>("demande:dqeLot", "");
  const [dqeTauxTVA, setDqeTauxTVA] = usePersistedState<number>("demande:dqeTauxTVA", 16);
  const [dqeLignes, setDqeLignes] = usePersistedState<DqeLigne[]>("demande:dqeLignes", [emptyDqeLigne()]);

  // Load data on open
  const isDelegate = user?.role === "AUTORITE_UPM" || user?.role === "AUTORITE_UEP";

  // Marchés déjà associés à une demande de correction "active" (non terminale)
  // → doivent apparaître mais désactivés à la sélection.
  const [busyMarcheIds, setBusyMarcheIds] = useState<Set<number>>(new Set());

  const loadInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [ent, conv, marc, bail, gedReqs, demandes] = await Promise.all([
        entrepriseApi.getAll(),
        conventionApi.getAll(),
        marcheApi.getAll().catch(() => [] as MarcheDto[]),
        bailleurApi.getAll().catch(() => [] as BailleurDto[]),
        documentRequirementApi.getByProcessus("CORRECTION_OFFRE_FISCALE").catch(() => [] as DocumentRequirementDto[]),
        demandeCorrectionApi.getAll().catch(() => [] as DemandeCorrectionDto[]),
      ]);
      setEntreprises(ent);
      setConventions(conv);
      if (isDelegate && user?.userId) {
        setMarches(marc.filter(m => m.delegueIds?.includes(user.userId)));
      } else {
        setMarches(marc);
      }
      setBailleurs(bail);
      setGedDocTypes(gedReqs.sort((a, b) => (a.ordreAffichage || 0) - (b.ordreAffichage || 0)));

      // Statuts terminaux : la demande est close → le marché redevient sélectionnable
      const TERMINAL = new Set<string>(["ADOPTEE", "REJETEE", "NOTIFIEE", "ANNULEE"]);
      const busy = new Set<number>();
      for (const d of demandes) {
        if (!d.marcheId) continue;
        if (TERMINAL.has(d.statut)) continue;
        // En mode édition, ne pas se bloquer soi-même
        if (editingId && d.id === editingId) continue;
        busy.add(d.marcheId);
      }
      setBusyMarcheIds(busy);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les données", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast, isDelegate, user?.userId, editingId]);

  // Suit l'état d'ouverture précédent pour distinguer une vraie ouverture d'un remontage
  // (le navigateur mobile peut décharger l'onglet quand l'utilisateur bascule vers WhatsApp).
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      const isFreshOpen = !wasOpenRef.current;
      wasOpenRef.current = true;
      if (isFreshOpen) {
        // Au premier rendu, ne PAS écraser les états persistés (entrepriseId, conventionId,
        // marcheId, importations, dqe, fiscalite, docFiles, etc.) — l'utilisateur peut être
        // de retour après une bascule mobile et on veut restaurer sa saisie.
        setStep(0);
        setShowCreateEntreprise(false);
        setNewEntreprise({ raisonSociale: "", nif: "" });
        setShowCreateConvention(false);
        setShowCreateMarche(false);
      }
      loadInitialData();
    } else {
      wasOpenRef.current = false;
    }
  }, [open, loadInitialData]);

  // Préremplissage en mode édition (BROUILLON / RECUE / INCOMPLETE).
  // Important : on force l'écrasement de l'état persisté (localStorage) pour
  // éviter qu'un brouillon précédent n'écrase les valeurs de la demande éditée.
  useEffect(() => {
    if (!open || !editingDemande) return;
    setEntrepriseId(editingDemande.entrepriseId ? String(editingDemande.entrepriseId) : "");
    setConventionId(editingDemande.conventionId ? String(editingDemande.conventionId) : "");
    setMarcheId(editingDemande.marcheId ? String(editingDemande.marcheId) : "");
    const mf = editingDemande.modeleFiscal;
    if (mf) {
      if (mf.typeProjet) setTypeProjet(mf.typeProjet);
      if (mf.referenceDossier !== undefined) setReferenceDossier(mf.referenceDossier || "");
      if (mf.afficherNomenclature != null) setShowNomenclature(!!mf.afficherNomenclature);
      if (mf.importations?.length) setImportations(mf.importations);
      if (mf.fiscaliteInterieure) setFiscalite(mf.fiscaliteInterieure);
    }
    const dqe = editingDemande.dqe;
    if (dqe) {
      setDqeNumero(dqe.numeroAAOI || "");
      setDqeProjet(dqe.projet || "");
      setDqeLot(dqe.lot || "");
      if (dqe.tauxTVA != null) setDqeTauxTVA(dqe.tauxTVA);
      if (dqe.lignes?.length) setDqeLignes(dqe.lignes);
    }

    // Charger les documents déjà téléversés pour les afficher comme "déjà fournis"
    demandeCorrectionApi.getDocuments(editingDemande.id)
      .then(docs => {
        const map: Record<string, { id: number; nomFichier: string }> = {};
        for (const d of docs) {
          const t = (d as any).type || (d as any).typeDocument;
          if (t && (d as any).actif !== false) {
            map[t] = { id: d.id, nomFichier: d.nomFichier };
          }
        }
        setExistingDocs(map);
      })
      .catch(() => setExistingDocs({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingDemande?.id]);

  // Race condition : si la liste des marchés se charge APRÈS le préremplissage,
  // ou si le délégué n'a pas le marché dans sa liste filtrée, on l'ajoute à la main.
  // Fallback supplémentaire : si l'API ne renvoie pas marcheId mais renvoie marcheNumero,
  // on tente de retrouver le marché par son numéro pour fixer la sélection.
  useEffect(() => {
    if (!open || !editingDemande) return;
    const targetId = editingDemande.marcheId ? String(editingDemande.marcheId) : null;

    if (targetId) {
      if (marcheId !== targetId) setMarcheId(targetId);
      if (marches.some(m => String(m.id) === targetId)) return;
      marcheApi.getById(editingDemande.marcheId!)
        .then(m => setMarches(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]))
        .catch(() => { /* silent */ });
      return;
    }

    // Pas de marcheId mais peut-être un numéro → résolution par numéro
    const numero = editingDemande.marcheNumero;
    if (numero && !marcheId) {
      const found = marches.find(m => m.numeroMarche === numero);
      if (found) setMarcheId(String(found.id));
    }
  }, [open, editingDemande?.id, editingDemande?.marcheId, editingDemande?.marcheNumero, marches, marcheId, setMarcheId]);

  // Create enterprise inline
  const handleCreateEntreprise = async () => {
    if (!newEntreprise.raisonSociale) {
      toast({ title: "Erreur", description: "La raison sociale est obligatoire", variant: "destructive" });
      return;
    }
    if (!newEntreprise.nif || newEntreprise.nif.length !== 8) {
      toast({ title: "Erreur", description: "Le NIF doit contenir exactement 8 caractères", variant: "destructive" });
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
        { id: -3, code: "CNY", libelle: "Yuan chinois", symbole: "¥" },
        { id: -4, code: "SAR", libelle: "Riyal saoudien", symbole: "﷼" },
        { id: -5, code: "AED", libelle: "Dirham des Émirats", symbole: "د.إ" },
        { id: -6, code: "QAR", libelle: "Riyal qatari", symbole: "﷼" },
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
      const toInstant = (d?: string) => d ? `${d}T00:00:00Z` : new Date().toISOString();
      const created = await conventionApi.create({
        ...newConvForm,
        dateSignature: toInstant(newConvForm.dateSignature),
        dateFin: newConvForm.dateFin ? toInstant(newConvForm.dateFin) : undefined,
        statut: "EN_ATTENTE",
        autoriteContractanteId: user?.autoriteContractanteId || undefined,
      });
      for (const doc of convCreateDocs) {
        try { await conventionApi.uploadDocument(created.id, doc.type, doc.file); } catch { /* continue */ }
      }
      setConventions(prev => [...prev, created]);
      setConventionId(String(created.id));
      setShowCreateConvention(false);
      setNewConvForm({
        reference: "", intitule: "", bailleurId: undefined,
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

  // Create marché inline
  const handleCreateMarche = async () => {
    if (!newMarche.numeroMarche) {
      toast({ title: "Erreur", description: "Le numéro de marché est obligatoire", variant: "destructive" });
      return;
    }
    if (!conventionId) {
      toast({ title: "Erreur", description: "Veuillez d'abord sélectionner une convention", variant: "destructive" });
      return;
    }
    if (!newMarche.dateSignature) {
      toast({ title: "Erreur", description: "La date d'attribution est obligatoire", variant: "destructive" });
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    if (newMarche.dateSignature > today) {
      toast({ title: "Erreur", description: "La date d'attribution doit être antérieure à la date du jour", variant: "destructive" });
      return;
    }
    setCreatingMarche(true);
    try {
      const toInstant = (d?: string) => d ? `${d}T00:00:00Z` : new Date().toISOString();
      const created = await marcheApi.create({
        conventionId: Number(conventionId),
        numeroMarche: newMarche.numeroMarche,
        montantContratTtc: newMarche.montantContratTtc,
        dateSignature: toInstant(newMarche.dateSignature),
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
      toast({ title: "Erreur", description: "Votre compte n'est pas encore associé à une Autorité Contractante. Veuillez contacter un administrateur.", variant: "destructive" });
      return;
    }
    if (!entrepriseId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une entreprise", variant: "destructive" });
      return;
    }
    // En soumission ferme, conv/marché obligatoire ; en brouillon on est plus tolérant.
    if (!asBrouillon && !conventionId && !marcheId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une convention ou un marché", variant: "destructive" });
      return;
    }

    const selectedMarche = marcheId ? marches.find(m => String(m.id) === marcheId) : null;
    const finalConventionId = conventionId ? Number(conventionId) : selectedMarche?.conventionId;

    if (asBrouillon) setSavingDraft(true); else setSubmitting(true);
    try {
      const payload = {
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
        title: "Succès",
        description: asBrouillon
          ? `Brouillon ${demande.numero || "#" + demande.id} enregistré`
          : isEditing
          ? `Demande ${demande.numero || "#" + demande.id} soumise`
          : `Demande ${demande.numero || "#" + demande.id} créée`,
      });
      // Nettoyer toutes les valeurs persistées du wizard après succès
      try {
        const keys = [
          "demande:entrepriseId", "demande:conventionId", "demande:marcheId",
          "demande:typeProjet", "demande:refDossier",
          "demande:importations", "demande:fiscalite",
          "demande:dqeNumero", "demande:dqeProjet", "demande:dqeLot",
          "demande:dqeTauxTVA", "demande:dqeLignes",
        ];
        keys.forEach(k => sessionStorage.removeItem(`lvbl:form:${k}`));
      } catch { /* noop */ }
      clearDocFiles();
      onOpenChange(false);
      onCreated();
    } catch (e: unknown) {
      toast({ title: "Erreur", description: formatApiErrorMessage(e, asBrouillon ? "Échec de l'enregistrement" : "Échec de la soumission"), variant: "destructive" });
    } finally {
      setSavingDraft(false);
      setSubmitting(false);
    }
  };

  const steps = [
    { label: "Entreprise & Documents", icon: FileText },
  ];

  const selectedEntreprise = entreprises.find(e => String(e.id) === entrepriseId);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Modifier la demande ${editingDemande?.numero || `#${editingId}`}` : "Nouvelle demande de correction"}</DialogTitle>
        </DialogHeader>
        <div className="md:hidden flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Astuce mobile :</strong> votre saisie <em>et vos fichiers</em> sont sauvegardés automatiquement. Vous pouvez quitter l'application (WhatsApp, appel, etc.) et revenir : tout sera restauré.
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Entreprise with searchable combobox */}
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
                      <Popover open={entrepriseOpen} onOpenChange={setEntrepriseOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={entrepriseOpen}
                            className="w-full justify-between font-normal"
                          >
                            {selectedEntreprise
                              ? `${selectedEntreprise.raisonSociale} — NIF: ${selectedEntreprise.nif}`
                              : "Rechercher une entreprise..."}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Rechercher par nom ou NIF..." />
                            <CommandList>
                              <CommandEmpty>Aucune entreprise trouvée.</CommandEmpty>
                              <CommandGroup>
                                {entreprises.map(e => (
                                  <CommandItem
                                    key={e.id}
                                    value={`${e.raisonSociale} ${e.nif}`}
                                    onSelect={() => {
                                      setEntrepriseId(String(e.id));
                                      setEntrepriseOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${entrepriseId === String(e.id) ? "opacity-100" : "opacity-0"}`} />
                                    {e.raisonSociale} — NIF: {e.nif}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Card className="border-primary/30">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <Building2 className="h-4 w-4" />
                            Nouvelle entreprise
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Raison sociale <span className="text-destructive">*</span></Label>
                            <Input
                              placeholder="Ex: SARL Mon Entreprise"
                              value={newEntreprise.raisonSociale}
                              onChange={e => setNewEntreprise(prev => ({ ...prev, raisonSociale: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">NIF <span className="text-destructive">*</span> <span className="text-muted-foreground">(exactement 8 caractères)</span></Label>
                            <Input
                              placeholder="Ex: 12345678"
                              value={newEntreprise.nif}
                              maxLength={8}
                              onChange={e => setNewEntreprise(prev => ({ ...prev, nif: e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) }))}
                            />
                            {newEntreprise.nif && newEntreprise.nif.length !== 8 && (
                              <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {newEntreprise.nif.length}/8 caractères
                              </p>
                            )}
                            {newEntreprise.nif && newEntreprise.nif.length === 8 && (
                              <p className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                8/8 caractères
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Adresse</Label>
                            <Input
                              placeholder="Ex: Avenue Gamal Abdel Nasser, Nouakchott"
                              value={newEntreprise.adresse || ""}
                              onChange={e => setNewEntreprise(prev => ({ ...prev, adresse: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Email</Label>
                            <Input
                              placeholder="Ex: contact@entreprise.mr"
                              type="email"
                              value={newEntreprise.email || ""}
                              onChange={e => setNewEntreprise(prev => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={handleCreateEntreprise}
                            disabled={creatingEntreprise || !newEntreprise.raisonSociale || newEntreprise.nif.length !== 8}
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
                      <SearchableSelect
                        value={marcheId}
                        onValueChange={setMarcheId}
                        placeholder="Sélectionnez"
                        searchPlaceholder="Rechercher un marché..."
                        options={marches.map(m => {
                          const isBusy = busyMarcheIds.has(m.id);
                          const baseLabel = `${m.numeroMarche || `#${m.id}`} — ${m.montantContratTtc?.toLocaleString("fr-FR") || "0"} MRU`;
                          return {
                            value: String(m.id),
                            label: isBusy ? `${baseLabel} (déjà associé à une demande active)` : baseLabel,
                            description: isBusy ? "Marché indisponible : une demande de correction est déjà en cours pour ce marché." : undefined,
                            keywords: `${m.numeroMarche || ""} ${m.intitule || ""}`,
                            disabled: isBusy,
                          };
                        })}
                      />
                    ) : (
                      <Card className="border-primary/30">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <FileText className="h-4 w-4" />
                            Nouveau marché
                          </div>

                          {/* Convention selector */}
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center justify-between">
                              <span>Convention <span className="text-destructive">*</span></span>
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
                              <SearchableSelect
                                value={conventionId}
                                onValueChange={v => { setConventionId(v); }}
                                placeholder="Sélectionnez une convention"
                                searchPlaceholder="Rechercher une convention..."
                                options={conventions.map(c => ({
                                  value: String(c.id),
                                  label: `${c.reference || `#${c.id}`} — ${c.intitule || c.bailleurNom || c.bailleur || ""}`,
                                  keywords: `${c.reference || ""} ${c.intitule || ""} ${c.bailleurNom || ""}`,
                                }))}
                              />
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
                                    <span>Bailleur</span>
                                    <Button type="button" variant="ghost" size="sm" className="h-5 text-xs text-primary p-0" onClick={() => setShowCreateBailleur(!showCreateBailleur)}>
                                      <Plus className="h-3 w-3 mr-0.5" />
                                      {showCreateBailleur ? "Annuler" : "Ajouter"}
                                    </Button>
                                  </Label>
                                  {!showCreateBailleur ? (
                                    <SearchableSelect
                                      value={newConvForm.bailleurId != null ? String(newConvForm.bailleurId) : ""}
                                      onValueChange={v => setNewConvForm(prev => ({ ...prev, bailleurId: v ? Number(v) : undefined }))}
                                      placeholder="Sélectionnez un bailleur"
                                      searchPlaceholder="Rechercher un bailleur..."
                                      options={bailleurs.map(b => ({ value: String(b.id), label: b.nom }))}
                                    />
                                  ) : (
                                    <div className="flex gap-1">
                                      <Input placeholder="Nom du bailleur" value={newBailleurNom} onChange={e => setNewBailleurNom(e.target.value)} className="text-sm" />
                                      <Button size="sm" disabled={creatingBailleur || !newBailleurNom} onClick={async () => {
                                        setCreatingBailleur(true);
                                        try {
                                          const created = await bailleurApi.create({ nom: newBailleurNom });
                                          setBailleurs(prev => [...prev, created]);
                                          setNewConvForm(prev => ({ ...prev, bailleurId: created.id }));
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
                                {/* Le descriptif provient désormais du bailleur sélectionné. */}
                                {/* Dates */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Date signature <span className="text-destructive">*</span></Label>
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
                                    <SearchableSelect
                                      value={newConvForm.deviseOrigine || ""}
                                      onValueChange={code => setNewConvForm(f => ({ ...f, deviseOrigine: code, tauxChange: undefined, montantMru: undefined }))}
                                      placeholder={devisesLoading ? "Chargement..." : "Devise"}
                                      searchPlaceholder="Rechercher une devise..."
                                      triggerClassName="flex-1"
                                      options={devises.map(d => ({
                                        value: d.code,
                                        label: `${d.code} — ${d.libelle}`,
                                        keywords: `${d.code} ${d.libelle}`,
                                      }))}
                                    />
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
                                    <div className="space-y-1">
                                      <span className="text-[11px] text-muted-foreground">{convCreateDocs.length} fichier(s)</span>
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
                                      {/* Fusion section with messages */}
                                      <div className="mt-2 p-2 bg-muted/30 rounded-md space-y-2">
                                        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                          <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                          <div>
                                            <p className="font-medium text-foreground">Fusion de fichiers PDF</p>
                                            <p>Vous pouvez fusionner plusieurs fichiers PDF en un seul document. Réorganisez l'ordre des fichiers ci-dessus avant de lancer la fusion. Seuls les fichiers PDF seront inclus.</p>
                                          </div>
                                        </div>
                                        {convCreateDocs.filter(d => d.file.name.toLowerCase().endsWith(".pdf")).length >= 2 ? (
                                          <Button type="button" variant="outline" size="sm" className="w-full" onClick={convMergeCreateDocs} disabled={convMerging}>
                                            {convMerging ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Merge className="h-3 w-3 mr-1" />}
                                            Fusionner les {convCreateDocs.filter(d => d.file.name.toLowerCase().endsWith(".pdf")).length} fichiers PDF
                                          </Button>
                                        ) : (
                                          <p className="text-[11px] text-muted-foreground italic text-center">
                                            Ajoutez au moins 2 fichiers PDF pour activer la fusion.
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
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Numéro de marché <span className="text-destructive">*</span></Label>
                                <Input
                                  placeholder="Ex: MARCHE-2026-001"
                                  value={newMarche.numeroMarche}
                                  onChange={e => setNewMarche(prev => ({ ...prev, numeroMarche: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Montant TTC</Label>
                                <Input
                                  placeholder="Ex: 50000000"
                                  type="number"
                                  value={newMarche.montantContratTtc || ""}
                                  onChange={e => setNewMarche(prev => ({ ...prev, montantContratTtc: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Date d'attribution <span className="text-destructive">*</span></Label>
                                <Input
                                  type="date"
                                  max={new Date().toISOString().split("T")[0]}
                                  value={newMarche.dateSignature || ""}
                                  onChange={e => setNewMarche(prev => ({ ...prev, dateSignature: e.target.value }))}
                                />
                                <p className="text-[11px] text-muted-foreground">Doit être antérieure à la date du jour</p>
                              </div>
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={handleCreateMarche}
                                disabled={creatingMarche || !newMarche.numeroMarche || !newMarche.dateSignature}
                              >
                                {creatingMarche ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
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
                        <div
                          key={dt.id}
                          className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                            dragOverType === dt.typeDocument
                              ? "border-primary bg-primary/5 border-dashed"
                              : "border-border"
                          }`}
                          onDragOver={e => handleDragOver(e, dt.typeDocument)}
                          onDragLeave={handleDragLeave}
                          onDrop={e => handleDrop(e, dt.typeDocument)}
                        >
                          {docFiles[dt.typeDocument] ? (
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          ) : existingDocs[dt.typeDocument] ? (
                            <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className={`flex-1 text-sm flex items-center gap-1 ${docFiles[dt.typeDocument] || existingDocs[dt.typeDocument] ? "font-medium" : "text-muted-foreground"}`}>
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
                          {docFiles[dt.typeDocument] ? (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">{docFiles[dt.typeDocument].name}</span>
                          ) : existingDocs[dt.typeDocument] ? (
                            <span className="text-xs text-primary truncate max-w-[180px]" title={existingDocs[dt.typeDocument].nomFichier}>
                              Déjà fourni — {existingDocs[dt.typeDocument].nomFichier}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                              Glissez un fichier ici ou
                            </span>
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
                            <span className="text-xs text-primary hover:underline">
                              {docFiles[dt.typeDocument] || existingDocs[dt.typeDocument] ? "Remplacer" : "Parcourir"}
                            </span>
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
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !entrepriseId}>
                Suivant <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <>
                {editingDemande?.statut !== "RECUE" && (
                  <Button
                    variant="secondary"
                    onClick={() => handleSubmit(true)}
                    disabled={savingDraft || submitting || !entrepriseId}
                    title="Enregistrer sans notifier les services"
                  >
                    {savingDraft ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                    Enregistrer brouillon
                  </Button>
                )}
                <Button onClick={() => handleSubmit(false)} disabled={submitting || savingDraft || !entrepriseId}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  {isEditing ? "Soumettre" : "Soumettre la demande"}
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
