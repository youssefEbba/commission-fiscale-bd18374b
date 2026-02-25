import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  entrepriseApi, EntrepriseDto, referentielProjetApi, ReferentielProjetDto,
  DOCUMENT_TYPES_REQUIS, demandeCorrectionApi,
  ImportationLigne, FiscaliteInterieure, DqeLigne,
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
import {
  Loader2, Plus, Trash2, ArrowLeft, ArrowRight, Upload, CheckCircle, Send, FileText,
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

  // Step 0: Entreprise + Projet + Documents
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [projets, setProjets] = useState<ReferentielProjetDto[]>([]);
  const [entrepriseId, setEntrepriseId] = useState("");
  const [projetId, setProjetId] = useState("");
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});
  const [loadingData, setLoadingData] = useState(false);

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
      const [ent, proj] = await Promise.all([
        entrepriseApi.getAll(),
        referentielProjetApi.getAll(),
      ]);
      setEntreprises(ent);
      setProjets(proj.filter(p => p.statut === "VALIDE"));
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les données", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      setStep(0);
      setEntrepriseId("");
      setProjetId("");
      setDocFiles({});
      setImportations([emptyImportation()]);
      setDqeLignes([emptyDqeLigne()]);
      setReferenceDossier("");
      loadInitialData();
    }
  }, [open, loadInitialData]);

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

  // Recalc fiscalite
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
    setSubmitting(true);
    try {
      const demande = await demandeCorrectionApi.create({
        autoriteContractanteId: user?.autoriteContractanteId,
        entrepriseId: Number(entrepriseId),
        referentielProjetId: projetId ? Number(projetId) : undefined,
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
    { label: "Modèle Fiscal", icon: FileText },
    { label: "DQE", icon: FileText },
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

        {/* ═══ STEP 0: Entreprise + Documents ═══ */}
        {step === 0 && (
          <div className="space-y-4">
            {loadingData ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Entreprise *</Label>
                    <Select value={entrepriseId} onValueChange={setEntrepriseId}>
                      <SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                      <SelectContent>
                        {entreprises.map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.raisonSociale} — NIF: {e.nif}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Projet référentiel</Label>
                    <Select value={projetId} onValueChange={setProjetId}>
                      <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                      <SelectContent>
                        {projets.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.nomProjet || p.intitule || `#${p.id}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Pièces à joindre</h3>
                  <div className="space-y-2">
                    {DOCUMENT_TYPES_REQUIS.map(dt => (
                      <div key={dt.value} className="flex items-center gap-2 rounded-lg border border-border p-2">
                        {docFiles[dt.value] ? (
                          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className={`flex-1 text-sm ${docFiles[dt.value] ? "font-medium" : "text-muted-foreground"}`}>
                          {dt.label}
                        </span>
                        {docFiles[dt.value] && (
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">{docFiles[dt.value].name}</span>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setDocFiles(prev => ({ ...prev, [dt.value]: f }));
                            }}
                          />
                          <span className="text-xs text-primary hover:underline">{docFiles[dt.value] ? "Changer" : "Choisir"}</span>
                        </label>
                      </div>
                    ))}
                  </div>
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
                <CardTitle className="text-base">🔴 3 — Récapitulatif</CardTitle>
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
                    <p className="text-xs text-muted-foreground">💰 Crédit total</p>
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
                <CardTitle className="text-base">📄 Formulaire DQE</CardTitle>
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
            {step < 2 ? (
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
