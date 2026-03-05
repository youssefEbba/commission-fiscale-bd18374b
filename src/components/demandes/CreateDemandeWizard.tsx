import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  entrepriseApi, EntrepriseDto,
  conventionApi, ConventionDto,
  demandeCorrectionApi,
  ImportationLigne, FiscaliteInterieure, DqeLigne,
  marcheApi, MarcheDto,
  bailleurApi, BailleurDto,
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
} from "lucide-react";

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

  // Create convention inline
  const [showCreateConvention, setShowCreateConvention] = useState(false);
  const [newConvention, setNewConvention] = useState<{ reference: string; intitule: string; bailleur?: string; dateSignature?: string }>({ reference: "", intitule: "" });
  const [creatingConvention, setCreatingConvention] = useState(false);

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
      setMarches(marc);
      setBailleurs(bail);
      setGedDocTypes(gedReqs.sort((a, b) => (a.ordreAffichage || 0) - (b.ordreAffichage || 0)));
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les données", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

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
      setNewConvention({ reference: "", intitule: "", dateSignature: "" });
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

  // Create convention inline
  const handleCreateConvention = async () => {
    if (!newConvention.reference || !newConvention.intitule) {
      toast({ title: "Erreur", description: "Référence et intitulé sont obligatoires", variant: "destructive" });
      return;
    }
    setCreatingConvention(true);
    try {
      const created = await conventionApi.create({
        reference: newConvention.reference,
        intitule: newConvention.intitule,
        bailleur: newConvention.bailleur,
        dateSignature: newConvention.dateSignature || new Date().toISOString().split("T")[0],
        statut: "EN_ATTENTE",
        autoriteContractanteId: user?.autoriteContractanteId || undefined,
      });
      setConventions(prev => [...prev, created]);
      setConventionId(String(created.id));
      setShowCreateConvention(false);
      setNewConvention({ reference: "", intitule: "", dateSignature: "" });
      toast({ title: "Succès", description: "Convention créée" });
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
    if (user?.role === "AUTORITE_CONTRACTANTE" && !user?.autoriteContractanteId) {
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
                              <div className="space-y-2 border border-dashed border-border rounded-md p-2">
                                <Input
                                  placeholder="Référence *"
                                  value={newConvention.reference}
                                  onChange={e => setNewConvention(prev => ({ ...prev, reference: e.target.value }))}
                                />
                                <Input
                                  placeholder="Intitulé *"
                                  value={newConvention.intitule}
                                  onChange={e => setNewConvention(prev => ({ ...prev, intitule: e.target.value }))}
                                />
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground flex items-center justify-between">
                                    <span>Bailleur (optionnel)</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 text-xs text-primary p-0"
                                      onClick={() => setShowCreateBailleur(!showCreateBailleur)}
                                    >
                                      <Plus className="h-3 w-3 mr-0.5" />
                                      {showCreateBailleur ? "Annuler" : "Ajouter"}
                                    </Button>
                                  </Label>
                                  {!showCreateBailleur ? (
                                    <Select value={newConvention.bailleur || ""} onValueChange={v => setNewConvention(prev => ({ ...prev, bailleur: v }))}>
                                      <SelectTrigger><SelectValue placeholder="Sélectionnez un bailleur" /></SelectTrigger>
                                      <SelectContent>
                                        {bailleurs.map(b => (
                                          <SelectItem key={b.id} value={b.nom}>{b.nom}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className="flex gap-1">
                                      <Input
                                        placeholder="Nom du bailleur"
                                        value={newBailleurNom}
                                        onChange={e => setNewBailleurNom(e.target.value)}
                                        className="text-sm"
                                      />
                                      <Button
                                        size="sm"
                                        disabled={creatingBailleur || !newBailleurNom}
                                        onClick={async () => {
                                          setCreatingBailleur(true);
                                          try {
                                            const created = await bailleurApi.create({ nom: newBailleurNom });
                                            setBailleurs(prev => [...prev, created]);
                                            setNewConvention(prev => ({ ...prev, bailleur: created.nom }));
                                            setNewBailleurNom("");
                                            setShowCreateBailleur(false);
                                            toast({ title: "Succès", description: "Bailleur ajouté" });
                                          } catch (e: any) {
                                            toast({ title: "Erreur", description: e.message, variant: "destructive" });
                                          } finally {
                                            setCreatingBailleur(false);
                                          }
                                        }}
                                      >
                                        {creatingBailleur ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Date de signature *</Label>
                                  <Input
                                    type="date"
                                    value={newConvention.dateSignature || ""}
                                    onChange={e => setNewConvention(prev => ({ ...prev, dateSignature: e.target.value }))}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={handleCreateConvention}
                                  disabled={creatingConvention}
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
  );
}
