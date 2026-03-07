import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  certificatCreditApi, CertificatCreditDto, CertificatStatut,
  CERTIFICAT_STATUT_LABELS, CreateCertificatCreditRequest,
  demandeCorrectionApi, DemandeCorrectionDto,
  documentRequirementApi, DocumentRequirementDto,
  DocumentDto, entrepriseApi, EntrepriseDto, marcheApi, MarcheDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Search, RefreshCw, Eye, Loader2, Filter, Plus, Upload, FileText, CheckCircle, Info, DollarSign, ShieldCheck, XCircle, FileDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const API_BASE = "https://a488-102-214-208-11.ngrok-free.app/api";

const STATUT_COLORS: Record<CertificatStatut, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_VERIFICATION_DGI: "bg-indigo-100 text-indigo-800",
  EN_VALIDATION_PRESIDENT: "bg-purple-100 text-purple-800",
  VALIDE_PRESIDENT: "bg-violet-100 text-violet-800",
  EN_OUVERTURE_DGTCP: "bg-yellow-100 text-yellow-800",
  OUVERT: "bg-emerald-100 text-emerald-800",
  MODIFIE: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

const ROLE_TRANSITIONS: Record<string, { from: CertificatStatut[]; to: CertificatStatut; label: string; icon?: string }[]> = {
  DGI: [
    { from: ["DEMANDE"], to: "EN_VERIFICATION_DGI", label: "Vérifier (DGI)" },
    { from: ["DEMANDE", "EN_VERIFICATION_DGI"], to: "ANNULE", label: "Annuler" },
  ],
  PRESIDENT: [
    { from: ["EN_VERIFICATION_DGI"], to: "EN_VALIDATION_PRESIDENT", label: "Prendre en charge" },
    { from: ["EN_VALIDATION_PRESIDENT"], to: "VALIDE_PRESIDENT", label: "Valider & signer" },
    { from: ["DEMANDE", "EN_VERIFICATION_DGI", "EN_VALIDATION_PRESIDENT"], to: "ANNULE", label: "Annuler" },
  ],
  DGTCP: [
    { from: ["VALIDE_PRESIDENT"], to: "EN_OUVERTURE_DGTCP", label: "Viser", icon: "visa" },
    { from: ["EN_OUVERTURE_DGTCP"], to: "OUVERT", label: "Ouvrir le crédit" },
  ],
  AUTORITE_CONTRACTANTE: [
    { from: ["DEMANDE"], to: "ANNULE", label: "Annuler" },
  ],
};

function getDocFileUrl(doc: DocumentDto): string {
  if (!doc.chemin) return "#";
  if (doc.chemin.startsWith("http")) return doc.chemin;
  return `${API_BASE}/documents/download/${doc.id}`;
}

const DemandesMiseEnPlace = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selected, setSelected] = useState<CertificatCreditDto | null>(null);

  // Creation dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [corrections, setCorrections] = useState<DemandeCorrectionDto[]>([]);
  const [docRequirements, setDocRequirements] = useState<DocumentRequirementDto[]>([]);
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string>("");
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // Detail documents
  const [detailDocs, setDetailDocs] = useState<DocumentDto[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Montants dialog (DGTCP)
  const [showMontants, setShowMontants] = useState<CertificatCreditDto | null>(null);
  const [montantCordon, setMontantCordon] = useState("");
  const [montantTVAInt, setMontantTVAInt] = useState("");
  const [savingMontants, setSavingMontants] = useState(false);

  // Lookup caches for full objects
  const [correctionCache, setCorrectionCache] = useState<Record<number, DemandeCorrectionDto>>({});
  const [marcheCache, setMarcheCache] = useState<Record<number, MarcheDto>>({});
  const [entrepriseCache, setEntrepriseCache] = useState<Record<number, EntrepriseDto>>({});

  // Info modal state
  const [infoModal, setInfoModal] = useState<{ type: "entreprise" | "correction" | "marche"; id: number } | null>(null);

  // Reject dialog state (DGTCP)
  const [showReject, setShowReject] = useState<CertificatCreditDto | null>(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Certificate generation state (DGTCP)
  const [generatingCert, setGeneratingCert] = useState<number | null>(null);

  const fetchCertificats = async () => {
    setLoading(true);
    try {
      const data = await certificatCreditApi.getAll();
      setCertificats(data);

      // Collect unique IDs to resolve
      const corrIds = [...new Set(data.map(c => c.demandeCorrectionId).filter(Boolean))] as number[];
      const marcheIds = [...new Set(data.map(c => c.marcheId).filter(Boolean))] as number[];
      const entIds = [...new Set(data.map(c => c.entrepriseId).filter(Boolean))] as number[];

      // Fetch names in parallel
      const [corrResults, marcheResults, entResults] = await Promise.all([
        Promise.all(corrIds.map(id => demandeCorrectionApi.getById(id).then(r => ({ id, data: r })).catch(() => null))),
        Promise.all(marcheIds.map(id => marcheApi.getById(id).then(r => ({ id, data: r })).catch(() => null))),
        Promise.all(entIds.map(id => entrepriseApi.getById(id).then(r => ({ id, data: r })).catch(() => null))),
      ]);

      setCorrectionCache(Object.fromEntries(corrResults.filter(Boolean).map(r => [r!.id, r!.data])));
      setMarcheCache(Object.fromEntries(marcheResults.filter(Boolean).map(r => [r!.id, r!.data])));
      setEntrepriseCache(Object.fromEntries(entResults.filter(Boolean).map(r => [r!.id, r!.data])));
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les demandes", variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCertificats(); }, []);

  const openCreateDialog = async () => {
    setShowCreate(true);
    setSelectedCorrectionId("");
    setDocFiles({});
    try {
      const [corrs, reqs] = await Promise.all([
        user?.autoriteContractanteId
          ? demandeCorrectionApi.getByAutorite(user.autoriteContractanteId)
          : demandeCorrectionApi.getAll(),
        documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI"),
      ]);
      setCorrections(corrs.filter(c => c.statut === "NOTIFIEE" || c.statut === "ADOPTEE"));
      setDocRequirements(reqs);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les données", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!selectedCorrectionId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une demande de correction", variant: "destructive" });
      return;
    }
    const correction = corrections.find(c => c.id === Number(selectedCorrectionId));
    if (!correction?.entrepriseId) {
      toast({ title: "Erreur", description: "L'entreprise n'est pas définie dans la correction", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const request: CreateCertificatCreditRequest = {
        entrepriseId: correction.entrepriseId,
        demandeCorrectionId: Number(selectedCorrectionId),
      };
      const created = await certificatCreditApi.create(request);

      if (Object.keys(docFiles).length > 0) {
        setUploadingDocs(true);
        for (const [type, file] of Object.entries(docFiles)) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            const token = localStorage.getItem("auth_token");
            await fetch(`${API_BASE}/certificats-credit/${created.id}/documents?type=${encodeURIComponent(type)}`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "ngrok-skip-browser-warning": "true",
              },
              body: formData,
            });
          } catch {
            toast({ title: "Avertissement", description: `Échec upload: ${type}`, variant: "destructive" });
          }
        }
        setUploadingDocs(false);
      }

      toast({ title: "Succès", description: "Demande de mise en place créée avec succès" });
      setShowCreate(false);
      fetchCertificats();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Impossible de créer la demande", variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleStatut = async (id: number, statut: CertificatStatut) => {
    setActionLoading(id);
    try {
      await certificatCreditApi.updateStatut(id, statut);
      toast({ title: "Succès", description: `Statut: ${CERTIFICAT_STATUT_LABELS[statut]}` });
      fetchCertificats();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!showReject || !motifRejet.trim()) return;
    setRejecting(true);
    try {
      await certificatCreditApi.reject(showReject.id, motifRejet.trim());
      toast({ title: "Succès", description: "Demande rejetée" });
      setShowReject(null);
      setMotifRejet("");
      fetchCertificats();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setRejecting(false); }
  };

  const handleGenerateCertificate = async (c: CertificatCreditDto) => {
    setGeneratingCert(c.id);
    try {
      await certificatCreditApi.generateCertificate(c.id);
      toast({ title: "Succès", description: "Certificat généré avec succès" });
      fetchCertificats();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setGeneratingCert(null); }
  };

  const openDetail = async (c: CertificatCreditDto) => {
    setSelected(c);
    setDetailDocs([]);
    setLoadingDocs(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/certificats-credit/${c.id}/documents`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (res.ok) {
        setDetailDocs(await res.json());
      }
    } catch { /* ignore */ }
    setLoadingDocs(false);
  };

  const transitions = ROLE_TRANSITIONS[role] || [];

  const filtered = certificats.filter((c) => {
    const ms = (c.reference || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.entrepriseNom || "").toLowerCase().includes(search.toLowerCase()) ||
      String(c.id).includes(search);
    return ms && (filterStatut === "ALL" || c.statut === filterStatut);
  });

  const getEntrepriseName = (c: CertificatCreditDto) => c.entrepriseNom || (c.entrepriseId && entrepriseCache[c.entrepriseId]?.raisonSociale) || "—";
  const getCorrectionName = (c: CertificatCreditDto) => c.demandeCorrectionNumero || (c.demandeCorrectionId && correctionCache[c.demandeCorrectionId]?.numero) || "—";
  const getMarcheName = (c: CertificatCreditDto) => c.marcheIntitule || (c.marcheId && marcheCache[c.marcheId]?.numeroMarche) || "—";

  const selectedCorrection = corrections.find(c => c.id === Number(selectedCorrectionId));
  const canCreate = role === "AUTORITE_CONTRACTANTE";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              Demandes de mise en place du crédit d'impôt
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Créer et suivre les demandes de mise en place</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle demande
              </Button>
            )}
            <Button variant="outline" onClick={fetchCertificats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(CERTIFICAT_STATUT_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Correction</TableHead>
                    <TableHead>Marché</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell></TableRow>
                  ) : filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.reference || `#${c.id}`}</TableCell>
                      <TableCell>{getEntrepriseName(c)}</TableCell>
                      <TableCell>{getCorrectionName(c)}</TableCell>
                      <TableCell>{getMarcheName(c)}</TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[c.statut]}`}>{CERTIFICAT_STATUT_LABELS[c.statut]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(c)}><Eye className="h-4 w-4 mr-1" /> Détail</Button>
                          {role === "DGTCP" && (c.statut === "EN_OUVERTURE_DGTCP" || c.statut === "VALIDE_PRESIDENT") && c.montantCordon == null && (
                            <Button variant="outline" size="sm" onClick={() => { setShowMontants(c); setMontantCordon(""); setMontantTVAInt(""); }}>
                              <DollarSign className="h-4 w-4 mr-1" /> Renseigner montants
                            </Button>
                          )}
                          {/* DGTCP Reject button */}
                          {role === "DGTCP" && ["VALIDE_PRESIDENT", "EN_OUVERTURE_DGTCP"].includes(c.statut) && (
                            <Button variant="destructive" size="sm" onClick={() => { setShowReject(c); setMotifRejet(""); }}>
                              <XCircle className="h-4 w-4 mr-1" /> Rejeter
                            </Button>
                          )}
                          {/* DGTCP Generate certificate button */}
                          {role === "DGTCP" && c.statut === "OUVERT" && (
                            <Button variant="outline" size="sm" disabled={generatingCert === c.id} onClick={() => handleGenerateCertificate(c)}>
                              {generatingCert === c.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
                              Générer certificat
                            </Button>
                          )}
                          {transitions.map((t) =>
                            t.from.includes(c.statut) ? (
                              <Button key={t.to} variant={t.to === "ANNULE" ? "destructive" : "default"} size="sm" disabled={actionLoading === c.id} onClick={() => handleStatut(c.id, t.to)}>
                                {actionLoading === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t.label}
                              </Button>
                            ) : null
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Demande {selected?.reference || `#${selected?.id}`}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Entreprise</span><p className="font-medium">
                  {selected.entrepriseId ? <button className="text-primary underline hover:opacity-80" onClick={() => setInfoModal({ type: "entreprise", id: selected.entrepriseId! })}>{getEntrepriseName(selected)}</button> : "—"}
                </p></div>
                <div><span className="text-muted-foreground">Statut</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{CERTIFICAT_STATUT_LABELS[selected.statut]}</Badge></p></div>
                <div><span className="text-muted-foreground">Date</span><p>{selected.dateCreation ? new Date(selected.dateCreation).toLocaleDateString("fr-FR") : "—"}</p></div>
                <div><span className="text-muted-foreground">Correction</span><p className="font-medium">
                  {selected.demandeCorrectionId ? <button className="text-primary underline hover:opacity-80" onClick={() => setInfoModal({ type: "correction", id: selected.demandeCorrectionId! })}>{getCorrectionName(selected)}</button> : "—"}
                </p></div>
                <div><span className="text-muted-foreground">Marché</span><p className="font-medium">
                  {selected.marcheId ? <button className="text-primary underline hover:opacity-80" onClick={() => setInfoModal({ type: "marche", id: selected.marcheId! })}>{getMarcheName(selected)}</button> : "—"}
                </p></div>
              </div>

              {/* Documents */}
              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Documents du dossier</h4>
                {loadingDocs ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : detailDocs.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Aucun document associé</p>
                ) : (
                  <div className="space-y-2">
                    {detailDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.nomFichier}</p>
                            <p className="text-xs text-muted-foreground">{doc.type?.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                        <a href={getDocFileUrl(doc)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Télécharger</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog - uses GED-configured documents */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nouvelle demande de mise en place
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Demande de correction (adoptée/notifiée) *</Label>
              <Select value={selectedCorrectionId} onValueChange={setSelectedCorrectionId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une correction..." /></SelectTrigger>
                <SelectContent>
                  {corrections.length === 0 ? (
                    <SelectItem value="__none" disabled>Aucune correction adoptée disponible</SelectItem>
                  ) : corrections.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.numero || `#${c.id}`} — {c.entrepriseRaisonSociale || "Entreprise"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCorrection && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 text-sm">
                  <p className="font-semibold mb-1">Correction sélectionnée</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">N°</span> {selectedCorrection.numero || `#${selectedCorrection.id}`}</div>
                    <div><span className="text-muted-foreground">Entreprise</span> {selectedCorrection.entrepriseRaisonSociale}</div>
                    <div><span className="text-muted-foreground">Statut</span> {selectedCorrection.statut}</div>
                    <div><span className="text-muted-foreground">AC</span> {selectedCorrection.autoriteContractanteNom}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents from GED configuration */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Pièces du dossier (configurées dans la GED)</Label>
              {docRequirements.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun document configuré pour ce processus</p>
              ) : (
                <div className="space-y-2">
                  {docRequirements.map((req) => {
                    const hasFile = !!docFiles[req.typeDocument];
                    return (
                      <div key={req.id} className="flex items-center gap-3 p-2 rounded border bg-background">
                        <div className="flex-1">
                          <p className="text-sm font-medium flex items-center gap-1">
                            {req.typeDocument.replace(/_/g, " ")}
                            {req.obligatoire && <span className="text-destructive ml-1">*</span>}
                            {req.description && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent><p className="max-w-xs text-xs">{req.description}</p></TooltipContent>
                              </Tooltip>
                            )}
                          </p>
                          {hasFile && (
                            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                              <CheckCircle className="h-3 w-3" /> {docFiles[req.typeDocument].name}
                            </p>
                          )}
                        </div>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setDocFiles(prev => ({ ...prev, [req.typeDocument]: file }));
                            }}
                          />
                          <div className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <Upload className="h-3 w-3" />
                            {hasFile ? "Remplacer" : "Choisir"}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating || uploadingDocs}>
              {(creating || uploadingDocs) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Montants Dialog (DGTCP) */}
      <Dialog open={!!showMontants} onOpenChange={() => setShowMontants(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Renseigner les montants
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Demande {showMontants?.reference || `#${showMontants?.id}`} — {showMontants?.entrepriseNom}
            </p>
            <div className="space-y-2">
              <Label>Montant Cordon (Douane) *</Label>
              <Input type="number" min="0" step="0.01" placeholder="Ex: 1000000" value={montantCordon} onChange={(e) => setMontantCordon(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Montant TVA Intérieure *</Label>
              <Input type="number" min="0" step="0.01" placeholder="Ex: 200000" value={montantTVAInt} onChange={(e) => setMontantTVAInt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMontants(null)}>Annuler</Button>
            <Button
              disabled={savingMontants || !montantCordon || !montantTVAInt || Number(montantCordon) <= 0 || Number(montantTVAInt) <= 0}
              onClick={async () => {
                if (!showMontants) return;
                setSavingMontants(true);
                try {
                  await certificatCreditApi.updateMontants(showMontants.id, Number(montantCordon), Number(montantTVAInt));
                  toast({ title: "Succès", description: "Montants enregistrés" });
                  setShowMontants(null);
                  fetchCertificats();
                } catch (e: any) {
                  toast({ title: "Erreur", description: e.message, variant: "destructive" });
                } finally { setSavingMontants(false); }
              }}
            >
              {savingMontants && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Modal for Entreprise / Correction / Marché */}
      <Dialog open={!!infoModal} onOpenChange={() => setInfoModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {infoModal?.type === "entreprise" && "Détails de l'entreprise"}
              {infoModal?.type === "correction" && "Détails de la correction"}
              {infoModal?.type === "marche" && "Détails du marché"}
            </DialogTitle>
          </DialogHeader>
          {infoModal?.type === "entreprise" && (() => {
            const ent = entrepriseCache[infoModal.id];
            if (!ent) return <p className="text-muted-foreground text-sm">Chargement...</p>;
            return (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Raison sociale</span><p className="font-medium">{ent.raisonSociale}</p></div>
                  <div><span className="text-muted-foreground">NIF</span><p className="font-medium">{ent.nif || "—"}</p></div>
                  <div><span className="text-muted-foreground">Adresse</span><p>{ent.adresse || "—"}</p></div>
                  <div><span className="text-muted-foreground">Téléphone</span><p>{ent.telephone || "—"}</p></div>
                  <div><span className="text-muted-foreground">Email</span><p>{ent.email || "—"}</p></div>
                  <div><span className="text-muted-foreground">Situation fiscale</span><p>{ent.situationFiscale || "—"}</p></div>
                </div>
              </div>
            );
          })()}
          {infoModal?.type === "correction" && (() => {
            const corr = correctionCache[infoModal.id];
            if (!corr) return <p className="text-muted-foreground text-sm">Chargement...</p>;
            return (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Numéro</span><p className="font-medium">{corr.numero || `#${corr.id}`}</p></div>
                  <div><span className="text-muted-foreground">Statut</span><p className="font-medium">{corr.statut}</p></div>
                  <div><span className="text-muted-foreground">Entreprise</span><p>{corr.entrepriseRaisonSociale || "—"}</p></div>
                  <div><span className="text-muted-foreground">Autorité contractante</span><p>{corr.autoriteContractanteNom || "—"}</p></div>
                  <div><span className="text-muted-foreground">Date de dépôt</span><p>{corr.dateDepot ? new Date(corr.dateDepot).toLocaleDateString("fr-FR") : "—"}</p></div>
                  {corr.motifRejet && <div className="col-span-2"><span className="text-muted-foreground">Motif de rejet</span><p className="text-destructive">{corr.motifRejet}</p></div>}
                </div>
              </div>
            );
          })()}
          {infoModal?.type === "marche" && (() => {
            const m = marcheCache[infoModal.id];
            if (!m) return <p className="text-muted-foreground text-sm">Chargement...</p>;
            return (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">N° Marché</span><p className="font-medium">{m.numeroMarche || `#${m.id}`}</p></div>
                  <div><span className="text-muted-foreground">Statut</span><p className="font-medium">{m.statut}</p></div>
                  <div><span className="text-muted-foreground">Date signature</span><p>{m.dateSignature ? new Date(m.dateSignature).toLocaleDateString("fr-FR") : "—"}</p></div>
                  <div><span className="text-muted-foreground">Montant TTC</span><p>{m.montantContratTtc != null ? `${m.montantContratTtc.toLocaleString("fr-FR")} MRU` : "—"}</p></div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DemandesMiseEnPlace;
