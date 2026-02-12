import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DemandeStatut,
  DEMANDE_STATUT_LABELS, DocumentDto, DOCUMENT_TYPES,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Search, RefreshCw, Plus, Eye, Upload, Loader2,
  CheckCircle, XCircle, ArrowRight, Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

// Role-based workflow transitions
const ROLE_TRANSITIONS: Record<string, { from: DemandeStatut[]; to: DemandeStatut; label: string; icon: React.ElementType }[]> = {
  DGD: [
    { from: ["RECUE", "RECEVABLE"], to: "EN_EVALUATION", label: "Commencer l'évaluation", icon: ArrowRight },
  ],
  DGTCP: [
    { from: ["EN_EVALUATION"], to: "EN_VALIDATION", label: "Apposer visa Trésor", icon: CheckCircle },
    { from: ["EN_EVALUATION", "RECUE"], to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGI: [
    { from: ["EN_EVALUATION"], to: "EN_VALIDATION", label: "Apposer visa Impôts", icon: CheckCircle },
    { from: ["EN_EVALUATION"], to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGB: [
    { from: ["EN_EVALUATION"], to: "EN_VALIDATION", label: "Apposer visa Budget", icon: CheckCircle },
    { from: ["EN_EVALUATION"], to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  PRESIDENT: [
    { from: ["EN_VALIDATION"], to: "ADOPTEE", label: "Valider la correction", icon: CheckCircle },
    { from: ["EN_VALIDATION"], to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
};

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

  const openDetail = async (d: DemandeCorrectionDto) => {
    setSelected(d);
    setDocsLoading(true);
    try {
      const documents = await demandeCorrectionApi.getDocuments(d.id);
      setDocs(documents);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleStatutChange = async (id: number, statut: DemandeStatut) => {
    setActionLoading(id);
    try {
      await demandeCorrectionApi.updateStatut(id, statut);
      toast({ title: "Succès", description: `Statut mis à jour: ${DEMANDE_STATUT_LABELS[statut]}` });
      fetchDemandes();
      if (selected?.id === id) {
        setSelected((prev) => prev ? { ...prev, statut } : null);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
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
      (d.reference || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.autoriteContractanteNom || "").toLowerCase().includes(search.toLowerCase()) ||
      String(d.id).includes(search);
    const matchStatut = filterStatut === "ALL" || d.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const transitions = ROLE_TRANSITIONS[role] || [];

  // What this role sees as title
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
                    <TableHead>Réf.</TableHead>
                    <TableHead>Autorité Contractante</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.reference || `#${d.id}`}</TableCell>
                        <TableCell className="text-muted-foreground">{d.autoriteContractanteNom || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUT_COLORS[d.statut] || ""}`}>
                            {DEMANDE_STATUT_LABELS[d.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {d.dateCreation ? new Date(d.dateCreation).toLocaleDateString("fr-FR") : "—"}
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
                                  onClick={() => handleStatutChange(d.id, t.to)}
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demande {selected?.reference || `#${selected?.id}`}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Autorité Contractante</span>
                  <p className="font-medium">{selected.autoriteContractanteNom || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{DEMANDE_STATUT_LABELS[selected.statut]}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant</span>
                  <p className="font-medium">{selected.montant?.toLocaleString("fr-FR") || "—"} {selected.devise || ""}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <p>{selected.dateCreation ? new Date(selected.dateCreation).toLocaleDateString("fr-FR") : "—"}</p>
                </div>
              </div>
              {selected.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Description</span>
                  <p className="text-sm mt-1">{selected.description}</p>
                </div>
              )}

              {/* Documents */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Documents</h3>
                  {hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) && (
                    <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                      <Upload className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                  )}
                </div>
                {docsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : docs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun document</p>
                ) : (
                  <div className="space-y-1">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1 truncate">{doc.nomFichier}</span>
                        <Badge variant="secondary" className="text-[10px]">{doc.type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Workflow Actions */}
              {transitions.length > 0 && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  {transitions.map((t) =>
                    t.from.includes(selected.statut) ? (
                      <Button
                        key={t.to}
                        variant={t.to === "REJETEE" ? "destructive" : "default"}
                        disabled={actionLoading === selected.id}
                        onClick={() => handleStatutChange(selected.id, t.to)}
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
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
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
    </DashboardLayout>
  );
};

export default Demandes;
