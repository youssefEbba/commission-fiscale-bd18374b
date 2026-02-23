import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DemandeStatut,
  DEMANDE_STATUT_LABELS, DocumentDto, DOCUMENT_TYPES_REQUIS,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Search, RefreshCw, Plus, Eye, Upload, Loader2,
  CheckCircle, XCircle, ArrowRight, Filter, Download, ExternalLink,
} from "lucide-react";
import CreateDemandeWizard from "@/components/demandes/CreateDemandeWizard";
import { Textarea } from "@/components/ui/textarea";

const STATUT_COLORS: Record<DemandeStatut, string> = {
  RECUE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-yellow-100 text-yellow-800",
  RECEVABLE: "bg-emerald-100 text-emerald-800",
  EN_EVALUATION: "bg-orange-100 text-orange-800",
  EN_VALIDATION: "bg-purple-100 text-purple-800",
  ADOPTEE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
  NOTIFIEE: "bg-gray-100 text-gray-800",
};

const ROLE_TRANSITIONS: Record<string, { from: DemandeStatut[]; to: DemandeStatut; label: string; icon: React.ElementType }[]> = {
  DGD: [
    { from: ["RECUE", "RECEVABLE"], to: "EN_EVALUATION", label: "Commencer l'évaluation", icon: ArrowRight },
    { from: ["EN_EVALUATION", "EN_VALIDATION"], to: "ADOPTEE", label: "Apposer visa Douanes", icon: CheckCircle },
    { from: ["EN_EVALUATION", "EN_VALIDATION"], to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGTCP: [
    { from: ["EN_EVALUATION", "EN_VALIDATION"], to: "ADOPTEE", label: "Apposer visa Trésor", icon: CheckCircle },
    { from: ["EN_EVALUATION", "EN_VALIDATION"], to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGI: [
    { from: ["EN_EVALUATION", "EN_VALIDATION"], to: "ADOPTEE", label: "Apposer visa Impôts", icon: CheckCircle },
    { from: ["EN_EVALUATION", "EN_VALIDATION"], to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGB: [
    { from: ["EN_EVALUATION", "EN_VALIDATION"], to: "ADOPTEE", label: "Apposer visa Budget", icon: CheckCircle },
    { from: ["EN_EVALUATION", "EN_VALIDATION"], to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  PRESIDENT: [
    { from: ["EN_VALIDATION", "ADOPTEE"], to: "ADOPTEE", label: "Valider la correction", icon: CheckCircle },
    { from: ["EN_VALIDATION"], to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
};

const API_BASE = "https://74dd-197-231-1-0.ngrok-free.app/api";

function getDocFileUrl(doc: DocumentDto): string {
  if (doc.chemin) {
    // Convert Windows backslash path to a file:/// URL
    const normalized = doc.chemin.replace(/\\/g, "/");
    if (normalized.match(/^[A-Za-z]:\//)) {
      return "file:///" + normalized;
    }
    return normalized;
  }
  return "";
}

async function downloadDocAuthenticated(url: string, filename: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "ngrok-skip-browser-warning": "true",
    },
  });
  if (!res.ok) throw new Error("Téléchargement échoué");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

const Demandes = () => {
  const { user, hasRole } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [demandes, setDemandes] = useState<DemandeCorrectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Detail/Document dialog
  const [selected, setSelected] = useState<DemandeCorrectionDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Create wizard
  const [createOpen, setCreateOpen] = useState(false);

  // Rejection modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);

  // Entreprise detail dialog
  const [entrepriseDetail, setEntrepriseDetail] = useState<any | null>(null);
  const [entrepriseLoading, setEntrepriseLoading] = useState(false);
  const [entrepriseDialogOpen, setEntrepriseDialogOpen] = useState(false);

  const openEntrepriseDetail = async (entrepriseId: number) => {
    setEntrepriseDialogOpen(true);
    setEntrepriseLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/entreprises/${entrepriseId}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (!res.ok) throw new Error("Erreur");
      setEntrepriseDetail(await res.json());
    } catch {
      // Fallback: try list and filter
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${API_BASE}/entreprises`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        });
        const list = await res.json();
        const found = list.find((e: any) => e.id === entrepriseId);
        setEntrepriseDetail(found || null);
      } catch {
        toast({ title: "Erreur", description: "Impossible de charger les informations de l'entreprise", variant: "destructive" });
      }
    } finally {
      setEntrepriseLoading(false);
    }
  };

  const fetchDemandes = async () => {
    setLoading(true);
    try {
      const data = await demandeCorrectionApi.getAll();
      setDemandes(data);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les demandes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDemandes(); }, []);

  // Wizard handles creation now

  const openDetail = async (d: DemandeCorrectionDto) => {
    setSelected(d);
    setDocsLoading(true);
    try {
      const documents = await demandeCorrectionApi.getDocuments(d.id);
      setDocs(documents);
    } catch {
      setDocs(d.documents || []);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleStatutChange = async (id: number, statut: DemandeStatut, motifRejet?: string) => {
    setActionLoading(id);
    try {
      const updated = await demandeCorrectionApi.updateStatut(id, statut, motifRejet);
      toast({ title: "Succès", description: `Statut mis à jour: ${DEMANDE_STATUT_LABELS[updated.statut || statut]}` });
      fetchDemandes();
      if (selected?.id === id) {
        setSelected(updated);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (id: number) => {
    setRejectTargetId(id);
    setRejectMotif("");
    setRejectOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTargetId || !rejectMotif.trim()) return;
    setRejectOpen(false);
    await handleStatutChange(rejectTargetId, "REJETEE", rejectMotif.trim());
    setRejectTargetId(null);
    setRejectMotif("");
  };

  const handleUpload = async () => {
    if (!selected || !uploadFile || !uploadType) return;
    setUploading(true);
    try {
      await demandeCorrectionApi.uploadDocument(selected.id, uploadType, uploadFile);
      toast({ title: "Succès", description: "Document uploadé" });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadType("");
      const documents = await demandeCorrectionApi.getDocuments(selected.id);
      setDocs(documents);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const filtered = demandes.filter((d) => {
    const matchSearch =
      (d.numero || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.autoriteContractanteNom || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.entrepriseRaisonSociale || "").toLowerCase().includes(search.toLowerCase()) ||
      String(d.id).includes(search);
    const matchStatut = filterStatut === "ALL" || d.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const transitions = ROLE_TRANSITIONS[role] || [];

  const pageTitle: Record<string, string> = {
    AUTORITE_CONTRACTANTE: "Mes demandes de correction",
    DGD: "Dossiers à évaluer (Douanes)",
    DGI: "Dossiers en attente de visa (Impôts)",
    DGB: "Dossiers en attente de visa (Budget)",
    DGTCP: "Dossiers à valider (Trésor)",
    PRESIDENT: "Dossiers en attente de validation finale",
    ADMIN_SI: "Toutes les demandes (Audit)",
    ENTREPRISE: "Demandes associées",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {pageTitle[role] || "Demandes de correction"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Processus P2 – Correction de l'offre fiscale
            </p>
          </div>
          <div className="flex gap-2">
            {hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle demande
              </Button>
            )}
            <Button variant="outline" onClick={fetchDemandes} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(DEMANDE_STATUT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Demande</TableHead>
                    <TableHead>Autorité Contractante</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date dépôt</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.numero || `#${d.id}`}</TableCell>
                        <TableCell className="text-muted-foreground">{d.autoriteContractanteNom || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{d.entrepriseRaisonSociale || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUT_COLORS[d.statut] || ""}`}>
                            {DEMANDE_STATUT_LABELS[d.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {d.dateDepot ? new Date(d.dateDepot).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openDetail(d)}>
                              <Eye className="h-4 w-4 mr-1" /> Détail
                            </Button>
                            {transitions.map((t) =>
                              t.from.includes(d.statut) ? (
                                <Button
                                  key={t.to}
                                  variant={t.to === "REJETEE" ? "destructive" : "default"}
                                  size="sm"
                                  disabled={actionLoading === d.id}
                                  onClick={() => t.to === "REJETEE" ? openRejectDialog(d.id) : handleStatutChange(d.id, t.to)}
                                >
                                  {actionLoading === d.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <t.icon className="h-4 w-4 mr-1" />}
                                  {t.label}
                                </Button>
                              ) : null
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demande {selected?.numero || `#${selected?.id}`}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Autorité Contractante</span>
                  <p className="font-medium">{selected.autoriteContractanteNom || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Entreprise</span>
                  {selected.entrepriseId ? (
                    <button
                      className="font-medium text-primary hover:underline cursor-pointer text-left"
                      onClick={() => openEntrepriseDetail(selected.entrepriseId)}
                    >
                      {selected.entrepriseRaisonSociale || "—"}
                    </button>
                  ) : (
                    <p className="font-medium">{selected.entrepriseRaisonSociale || "—"}</p>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{DEMANDE_STATUT_LABELS[selected.statut]}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date de dépôt</span>
                  <p>{selected.dateDepot ? new Date(selected.dateDepot).toLocaleDateString("fr-FR") : "—"}</p>
                </div>
              </div>

              {/* Motif de rejet */}
              {selected.statut === "REJETEE" && selected.motifRejet && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h3 className="text-sm font-semibold text-destructive mb-1">Motif du rejet</h3>
                  <p className="text-sm">{selected.motifRejet}</p>
                </div>
              )}

              {/* Validation parallèle tracker */}
              {(selected.statut === "EN_EVALUATION" || selected.statut === "EN_VALIDATION" || selected.statut === "ADOPTEE") && (
                <div className="rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold mb-3">Validation parallèle</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "DGD – Douanes", done: selected.validationDgd, date: selected.validationDgdDate },
                      { label: "DGTCP – Trésor", done: selected.validationDgtcp, date: selected.validationDgtcpDate },
                      { label: "DGI – Impôts", done: selected.validationDgi, date: selected.validationDgiDate },
                    ].map((v) => (
                      <div key={v.label} className={`rounded-lg border p-3 text-center text-xs ${v.done ? "border-green-300 bg-green-50" : "border-border bg-muted/30"}`}>
                        {v.done ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />
                        )}
                        <p className="font-medium">{v.label}</p>
                        {v.done && v.date && (
                          <p className="text-muted-foreground mt-0.5">{new Date(v.date).toLocaleDateString("fr-FR")}</p>
                        )}
                        {!v.done && <p className="text-muted-foreground mt-0.5">En attente</p>}
                      </div>
                    ))}
                  </div>
                  {selected.validationDgd && selected.validationDgtcp && selected.validationDgi && (
                    <p className="text-xs text-green-700 font-medium mt-2 text-center">✓ Toutes les validations sont complètes</p>
                  )}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Pièces du dossier</h3>
                  {hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) && (
                    <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                      <Upload className="h-4 w-4 mr-1" /> Ajouter un document
                    </Button>
                  )}
                </div>
                {docsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-2">
                    {DOCUMENT_TYPES_REQUIS.map((dt) => {
                      const uploaded = docs.find((d) => d.type === dt.value);
                      const fileUrl = uploaded ? getDocFileUrl(uploaded) : null;
                      return (
                        <div key={dt.value} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                          {uploaded ? (
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${!uploaded ? "text-muted-foreground" : ""}`}>{dt.label}</p>
                            {uploaded && (
                              <p className="text-xs text-muted-foreground truncate">{uploaded.nomFichier}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {uploaded && fileUrl ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => window.open(fileUrl, "_blank")}
                                >
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir
                                </Button>
                                <a
                                  href={fileUrl}
                                  download={uploaded.nomFichier || dt.label}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1" /> Télécharger
                                  </Button>
                                </a>
                              </>
                            ) : hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => { setUploadType(dt.value); setUploadOpen(true); }}
                              >
                                <Upload className="h-3.5 w-3.5 mr-1" /> Uploader
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Non fourni</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Workflow Actions — buttons under documents */}
              {transitions.length > 0 && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  {transitions.map((t) =>
                    t.from.includes(selected.statut) ? (
                      <Button
                        key={t.to}
                        variant={t.to === "REJETEE" ? "destructive" : "default"}
                        disabled={actionLoading === selected.id}
                        onClick={() => t.to === "REJETEE" ? openRejectDialog(selected.id) : handleStatutChange(selected.id, t.to)}
                      >
                        {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <t.icon className="h-4 w-4 mr-1" />}
                        {t.label}
                      </Button>
                    ) : null
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de document</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez le type" /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES_REQUIS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fichier</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Annuler</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadType}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Uploader
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Wizard */}
      <CreateDemandeWizard open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchDemandes} />

      {/* Entreprise Detail Dialog */}
      <Dialog open={entrepriseDialogOpen} onOpenChange={setEntrepriseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Informations de l'entreprise</DialogTitle>
          </DialogHeader>
          {entrepriseLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entrepriseDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground text-xs">Raison sociale</span>
                  <p className="font-medium">{entrepriseDetail.raisonSociale || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground text-xs">NIF</span>
                  <p className="font-medium">{entrepriseDetail.nif || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground text-xs">Adresse</span>
                  <p className="font-medium">{entrepriseDetail.adresse || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <span className="text-muted-foreground text-xs">Situation fiscale</span>
                  <p>
                    <Badge className={entrepriseDetail.situationFiscale === "REGULIERE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                      {entrepriseDetail.situationFiscale || "—"}
                    </Badge>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Aucune information disponible</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Motif Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motif du rejet</DialogTitle>
            <DialogDescription>Veuillez indiquer le motif du rejet de cette demande.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Saisissez le motif du rejet..."
              value={rejectMotif}
              onChange={(e) => setRejectMotif(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button variant="destructive" disabled={!rejectMotif.trim()} onClick={handleRejectConfirm}>
              <XCircle className="h-4 w-4 mr-1" /> Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Demandes;