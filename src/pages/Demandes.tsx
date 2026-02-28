import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  demandeCorrectionApi, DemandeCorrectionDto, DemandeStatut,
  DEMANDE_STATUT_LABELS, DocumentDto, DOCUMENT_TYPES_REQUIS, RejetDto,
  DecisionCorrectionDto,
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
import { useNavigate } from "react-router-dom";
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

// Visa/rejet actions: no status change on backend (decisionFinale=false)
// Decision finale: only DGTCP & PRESIDENT can adopt/reject with decisionFinale=true
const ALL_STATUTS: DemandeStatut[] = ["RECUE", "INCOMPLETE", "RECEVABLE", "EN_EVALUATION", "EN_VALIDATION"];

const ROLE_TRANSITIONS: Record<string, { from: DemandeStatut[]; to: DemandeStatut; label: string; icon: React.ElementType; isVisa?: boolean; isDecisionFinale?: boolean }[]> = {
  DGD: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Douanes", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGTCP: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Trésor", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Décision finale : Adopter", icon: CheckCircle, isDecisionFinale: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Décision finale : Rejeter", icon: XCircle, isDecisionFinale: true },
  ],
  DGI: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Impôts", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  DGB: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Apposer visa Budget", icon: CheckCircle, isVisa: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Rejeter", icon: XCircle },
  ],
  PRESIDENT: [
    { from: ALL_STATUTS, to: "ADOPTEE", label: "Décision finale : Adopter", icon: CheckCircle, isDecisionFinale: true },
    { from: ALL_STATUTS, to: "REJETEE", label: "Décision finale : Rejeter", icon: XCircle, isDecisionFinale: true },
  ],
};

const API_BASE = "https://63eb-2605-59c0-49ed-9e08-f1d5-e0ac-3fc6-77f5.ngrok-free.app/api";

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
  const navigate = useNavigate();
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

  // Upload offre corrigée dialog (DGTCP/DGB before visa)
  const [offreCorrigeeOpen, setOffreCorrigeeOpen] = useState(false);
  const [offreCorrigeeFile, setOffreCorrigeeFile] = useState<File | null>(null);
  const [offreCorrigeeUploading, setOffreCorrigeeUploading] = useState(false);
  const [offreCorrigeePendingId, setOffreCorrigeePendingId] = useState<number | null>(null);

  // Create wizard
  const [createOpen, setCreateOpen] = useState(false);

  // Rejection modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectDecisionFinale, setRejectDecisionFinale] = useState(false);
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
    if (!role) return;
    setLoading(true);
    try {
      let data: DemandeCorrectionDto[];
      if (role === "ENTREPRISE" && user?.entrepriseId) {
        data = await demandeCorrectionApi.getByEntreprise(user.entrepriseId);
      } else if (role === "AUTORITE_CONTRACTANTE" && user?.autoriteContractanteId) {
        data = await demandeCorrectionApi.getByAutorite(user.autoriteContractanteId);
      } else {
        data = await demandeCorrectionApi.getAll();
      }
      setDemandes(data);
    } catch (e: any) {
      const message = String(e?.message || "");
      const accessDenied = message.includes("Accès refusé") || message.includes("Access Denied");
      toast({
        title: "Erreur",
        description: accessDenied
          ? "Votre compte n'a pas encore la permission de consulter les demandes de correction."
          : "Impossible de charger les demandes",
        variant: "destructive",
      });
      setDemandes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!role) return;
    fetchDemandes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user?.entrepriseId, user?.autoriteContractanteId]);

  // Wizard handles creation now

  const openDetail = async (d: DemandeCorrectionDto) => {
    setDocsLoading(true);
    try {
      // Fetch full detail (includes rejets)
      const full = await demandeCorrectionApi.getById(d.id);
      setSelected(full);
    } catch {
      setSelected(d);
    }
    try {
      const documents = await demandeCorrectionApi.getDocuments(d.id);
      setDocs(documents);
    } catch {
      setDocs(d.documents || []);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleStatutChange = async (id: number, statut: DemandeStatut, motifRejet?: string, decisionFinale?: boolean) => {
    setActionLoading(id);
    try {
      const updated = await demandeCorrectionApi.updateStatut(id, statut, motifRejet, decisionFinale);
      toast({ title: "Succès", description: decisionFinale ? `Décision finale appliquée: ${DEMANDE_STATUT_LABELS[updated.statut || statut]}` : statut === "REJETEE" ? "Rejet enregistré" : "Visa apposé avec succès" });
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

  // DGTCP must upload CREDIT_INTERIEUR, DGD must upload CREDIT_EXTERIEUR before visa
  const UPLOAD_BEFORE_VISA: Record<string, { docType: string; label: string }> = {
    DGD: { docType: "CREDIT_EXTERIEUR", label: "Crédit Extérieur" },
    DGTCP: { docType: "CREDIT_INTERIEUR", label: "Crédit Intérieur" },
  };
  const uploadBeforeVisa = role ? UPLOAD_BEFORE_VISA[role] : undefined;

  const checkAndHandleVisa = async (id: number) => {
    if (uploadBeforeVisa) {
      try {
        const documents = await demandeCorrectionApi.getDocuments(id);
        const hasDoc = documents.some(d => d.type === uploadBeforeVisa.docType && d.actif !== false);
        if (!hasDoc) {
          setOffreCorrigeePendingId(id);
          setOffreCorrigeeOpen(true);
          return;
        }
      } catch {
        setOffreCorrigeePendingId(id);
        setOffreCorrigeeOpen(true);
        return;
      }
    }
    await handleTempVisa(id);
  };

  const handleOffreCorrigeeUploadAndVisa = async () => {
    if (!offreCorrigeePendingId || !offreCorrigeeFile) return;
    setOffreCorrigeeUploading(true);
    try {
      await demandeCorrectionApi.uploadDocument(offreCorrigeePendingId, uploadBeforeVisa?.docType || "OFFRE_CORRIGEE", offreCorrigeeFile);
      toast({ title: "Succès", description: `${uploadBeforeVisa?.label || "Document"} uploadé` });
      setOffreCorrigeeOpen(false);
      setOffreCorrigeeFile(null);
      // Now proceed with visa
      await handleTempVisa(offreCorrigeePendingId);
      // Refresh docs if detail is open
      if (selected?.id === offreCorrigeePendingId) {
        const documents = await demandeCorrectionApi.getDocuments(offreCorrigeePendingId);
        setDocs(documents);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setOffreCorrigeeUploading(false);
      setOffreCorrigeePendingId(null);
    }
  };

  const REQUIRED_VISA_ROLES = ["DGD", "DGI", "DGTCP", "DGB"];

  // After a visa/reject, update demande status accordingly
  const updateDemandeStatusAfterDecision = async (id: number) => {
    try {
      // Use getById instead of getDecisions (which may be access-restricted)
      const demande = await demandeCorrectionApi.getById(id);
      const decisions = demande.decisions || [];
      const visaRoles = decisions
        .filter((d: any) => d.decision === "VISA")
        .map((d: any) => d.role);
      const allVisas = REQUIRED_VISA_ROLES.every(r => visaRoles.includes(r));
      const newStatut = allVisas ? "EN_VALIDATION" : "EN_EVALUATION";
      await demandeCorrectionApi.updateStatut(id, newStatut);
    } catch (e: any) {
      console.error("Could not update demande status after decision", e);
      toast({ title: "Erreur statut", description: e?.message || "Impossible de mettre à jour le statut", variant: "destructive" });
    }
  };

  // Temporary decision (VISA / REJET_TEMP) via POST /decisions
  const handleTempVisa = async (id: number) => {
    setActionLoading(id);
    try {
      await demandeCorrectionApi.postDecision(id, "VISA");
      await updateDemandeStatusAfterDecision(id);
      toast({ title: "Succès", description: "Visa temporaire apposé" });
      fetchDemandes();
      if (selected) {
        const full = await demandeCorrectionApi.getById(id);
        setSelected(full);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTempReject = async (id: number, motif: string) => {
    setActionLoading(id);
    try {
      await demandeCorrectionApi.postDecision(id, "REJET_TEMP", motif);
      await updateDemandeStatusAfterDecision(id);
      toast({ title: "Succès", description: "Rejet temporaire enregistré" });
      fetchDemandes();
      if (selected) {
        const full = await demandeCorrectionApi.getById(id);
        setSelected(full);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (id: number, decisionFinale?: boolean) => {
    setRejectTargetId(id);
    setRejectMotif("");
    setRejectDecisionFinale(!!decisionFinale);
    setRejectOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTargetId || !rejectMotif.trim()) return;
    setRejectOpen(false);
    if (rejectDecisionFinale) {
      await handleStatutChange(rejectTargetId, "REJETEE", rejectMotif.trim(), true);
    } else {
      await handleTempReject(rejectTargetId, rejectMotif.trim());
    }
    setRejectTargetId(null);
    setRejectMotif("");
    setRejectDecisionFinale(false);
  };

  // Adopter avec génération de lettre d'adoption
  const handleAdoptWithLetter = async (id: number) => {
    setActionLoading(id);
    try {
      // 1. Appliquer la décision finale
      const updated = await demandeCorrectionApi.updateStatut(id, "ADOPTEE", undefined, true);

      // 2. Générer la lettre d'adoption — tenter l'upload, sinon télécharger localement
      const demande = selected || updated;
      const letterContent = generateAdoptionLetter(demande);
      const blob = new Blob([letterContent], { type: "text/html" });
      const filename = `Lettre_Adoption_${demande.numero || id}.html`;

      try {
        const file = new File([blob], filename, { type: "text/html" });
        await demandeCorrectionApi.uploadDocument(id, "LETTRE_ADOPTION", file);
        toast({ title: "Succès", description: "Demande adoptée et lettre d'adoption enregistrée" });
      } catch {
        // Fallback: téléchargement local si l'upload est refusé (permissions)
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Adoptée", description: "Demande adoptée. La lettre a été téléchargée sur votre ordinateur." });
      }

      fetchDemandes();
      if (selected?.id === id) {
        const full = await demandeCorrectionApi.getById(id);
        setSelected(full);
        const documents = await demandeCorrectionApi.getDocuments(id);
        setDocs(documents);
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const generateAdoptionLetter = (demande: DemandeCorrectionDto): string => {
    const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const decisions = (demande.decisions || []).filter(d => d.decision === "VISA");
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Lettre d'adoption</title>
<style>
  body { font-family: 'Times New Roman', serif; margin: 40px 60px; line-height: 1.6; color: #333; }
  h1 { text-align: center; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .header { text-align: center; margin-bottom: 30px; }
  .ref { margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  td, th { border: 1px solid #999; padding: 8px; text-align: left; }
  th { background: #f0f0f0; }
  .signature { margin-top: 60px; text-align: right; }
</style></head>
<body>
  <div class="header">
    <h1>LETTRE D'ADOPTION</h1>
    <p>Commission Nationale des Exonérations Fiscales</p>
  </div>
  <div class="ref">
    <p><strong>Référence :</strong> ${demande.numero || `DC-${demande.id}`}</p>
    <p><strong>Date :</strong> ${date}</p>
    <p><strong>Autorité Contractante :</strong> ${demande.autoriteContractanteNom || "—"}</p>
    <p><strong>Entreprise :</strong> ${demande.entrepriseRaisonSociale || "—"}</p>
  </div>
  <p>Par la présente, la Commission Nationale des Exonérations Fiscales certifie que la demande de correction de l'offre fiscale référencée ci-dessus a été examinée et <strong>ADOPTÉE</strong> à l'unanimité par l'ensemble des organismes compétents.</p>

  <h3>Visas obtenus :</h3>
  <table>
    <tr><th>Organisme</th><th>Agent</th><th>Date du visa</th></tr>
    ${decisions.map(d => `<tr><td>${d.role}</td><td>${d.utilisateurNom || "—"}</td><td>${d.dateDecision ? new Date(d.dateDecision).toLocaleDateString("fr-FR") : "—"}</td></tr>`).join("")}
  </table>

  <p>Cette décision est définitive et prend effet à compter de la date de signature de la présente lettre.</p>

  <div class="signature">
    <p>Fait à Nouakchott, le ${date}</p>
    <br/><br/>
    <p><strong>Le Président de la Commission</strong></p>
  </div>
</body></html>`;
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
    // AC ne voit que ses propres demandes
    if (role === "AUTORITE_CONTRACTANTE" && user?.autoriteContractanteId && d.autoriteContractanteId !== user.autoriteContractanteId) {
      return false;
    }
    // Entreprise ne voit que ses propres demandes
    if (role === "ENTREPRISE" && user?.entrepriseId && d.entrepriseId !== user.entrepriseId) {
      return false;
    }
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
              Correction de l'offre fiscale
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
                            {role === "DGD" ? (
                              <Button size="sm" onClick={() => navigate(`/dashboard/correction-douaniere/${d.id}`)}>
                                <ArrowRight className="h-4 w-4 mr-1" /> Commencer la correction douanière
                              </Button>
                            ) : (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openDetail(d)}>
                                  <Eye className="h-4 w-4 mr-1" /> Détail
                                </Button>
                                {transitions.map((t, idx) => {
                                  if (!t.from.includes(d.statut)) return null;
                                  if (t.isDecisionFinale) return null;
                                  const myDecision = (d.decisions || []).find(dec => dec.role === role);
                                  const hasRejet = (d.decisions || []).some(dec => dec.decision === "REJET_TEMP") || (d.rejets && d.rejets.length > 0);
                                  if (t.isVisa && hasRejet) return (
                                    <Badge key={idx + "-blocked"} className="bg-red-100 text-red-800 text-xs">Rejet en cours</Badge>
                                  );
                                  if (t.isVisa && myDecision?.decision === "VISA") return (
                                    <Badge key={idx + "-done"} className="bg-green-100 text-green-800 text-xs">Visa apposé</Badge>
                                  );
                                  if (t.to === "REJETEE" && myDecision?.decision === "REJET_TEMP") return null;
                                  return (
                                    <Button
                                      key={idx}
                                      variant={t.to === "REJETEE" ? "destructive" : "default"}
                                      size="sm"
                                      disabled={actionLoading === d.id}
                                      onClick={() => t.to === "REJETEE" ? openRejectDialog(d.id) : checkAndHandleVisa(d.id)}
                                    >
                                      {actionLoading === d.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <t.icon className="h-4 w-4 mr-1" />}
                                      {t.label}
                                    </Button>
                                  );
                                })}
                              </>
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

              {/* Historique des décisions (rejets + visas) */}
              {((selected.rejets && selected.rejets.length > 0) || (selected.decisions && selected.decisions.length > 0)) && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Historique des décisions</h3>
                  {/* Decisions from /decisions endpoint */}
                  {selected.decisions && selected.decisions.length > 0 && selected.decisions.map((dec: any, i: number) => (
                    <div key={`dec-${i}`} className={`rounded border p-3 text-sm space-y-1 ${dec.decision === "REJET_TEMP" ? "border-destructive/20 bg-destructive/5" : "border-green-200 bg-green-50"}`}>
                      <div className="flex items-center gap-2">
                        {dec.decision === "VISA" ? (
                          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        )}
                        <span className="font-medium">{dec.decision === "VISA" ? "Visa" : "Rejet temporaire"}</span>
                        <Badge variant="outline" className="text-xs">{dec.role}</Badge>
                      </div>
                      {dec.motifRejet && <p className="text-sm ml-6">{dec.motifRejet}</p>}
                      <div className="flex gap-3 text-xs text-muted-foreground ml-6">
                        {dec.utilisateurNom && <span>Par : {dec.utilisateurNom}</span>}
                        {dec.dateDecision && <span>Le : {new Date(dec.dateDecision).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                      </div>
                    </div>
                  ))}
                  {/* Legacy rejets */}
                  {selected.rejets && selected.rejets.length > 0 && (!selected.decisions || selected.decisions.length === 0) && selected.rejets.map((r: RejetDto) => (
                    <div key={r.id} className="rounded border border-destructive/20 bg-destructive/5 p-3 text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        <span className="font-medium">Rejet</span>
                      </div>
                      <p className="ml-6">{r.motifRejet}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground ml-6">
                        {r.utilisateurNom && <span>Par : {r.utilisateurNom}</span>}
                        {r.dateRejet && <span>Le : {new Date(r.dateRejet).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Motif de rejet (legacy) */}
              {selected.statut === "REJETEE" && selected.motifRejet && (!selected.rejets || selected.rejets.length === 0) && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h3 className="text-sm font-semibold text-destructive mb-1">Motif du rejet</h3>
                  <p className="text-sm">{selected.motifRejet}</p>
                </div>
              )}

              {/* Validation parallèle tracker — always visible */}
              {(() => {
                const decs = selected.decisions || [];
                const DECISION_ROLES_LIST = ["DGD", "DGTCP", "DGI", "DGB"];
                const DECISION_ROLE_LABELS: Record<string, string> = {
                  DGD: "DGD – Douanes",
                  DGTCP: "DGTCP – Trésor",
                  DGI: "DGI – Impôts",
                  DGB: "DGB – Budget",
                };
                return (
                  <div className="rounded-lg border border-border p-4">
                    <h3 className="text-sm font-semibold mb-3">Statut par organisme</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {DECISION_ROLES_LIST.map((r) => {
                        const dec = decs.find(d => d.role === r);
                        const isVisa = dec?.decision === "VISA";
                        const isRejet = dec?.decision === "REJET_TEMP";
                        return (
                          <div key={r} className={`rounded-lg border p-3 text-center text-xs ${
                            isVisa ? "border-green-300 bg-green-50" :
                            isRejet ? "border-red-300 bg-red-50" :
                            "border-border bg-muted/30"
                          }`}>
                            {isVisa ? (
                              <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                            ) : isRejet ? (
                              <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />
                            )}
                            <p className="font-medium">{DECISION_ROLE_LABELS[r] || r}</p>
                            {isVisa && <p className="text-green-700 font-medium mt-0.5">Visa</p>}
                            {isRejet && (
                              <>
                                <p className="text-red-700 font-medium mt-0.5">Rejeté</p>
                                {dec.motifRejet && <p className="text-muted-foreground mt-1 italic truncate" title={dec.motifRejet}>{dec.motifRejet}</p>}
                              </>
                            )}
                            {!dec && <p className="text-muted-foreground mt-0.5">En attente</p>}
                            {dec?.dateDecision && (
                              <p className="text-muted-foreground mt-0.5 text-[10px]">{new Date(dec.dateDecision).toLocaleDateString("fr-FR")}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Documents de décision */}
              {(() => {
                const SPECIAL_DOC_TYPES_LIST = ["CREDIT_EXTERIEUR", "CREDIT_INTERIEUR", "LETTRE_ADOPTION"];
                const SPECIAL_DOC_LABELS_MAP: Record<string, string> = {
                  CREDIT_EXTERIEUR: "Crédit Extérieur",
                  CREDIT_INTERIEUR: "Crédit Intérieur",
                  LETTRE_ADOPTION: "Lettre d'Adoption",
                };
                const specialDocs = docs.filter(d => SPECIAL_DOC_TYPES_LIST.includes(d.type));
                return (
                  <div className="rounded-lg border border-border p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" /> Documents de décision
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {SPECIAL_DOC_TYPES_LIST.map((docType) => {
                        const doc = specialDocs.find(d => d.type === docType);
                        const fileUrl = doc ? getDocFileUrl(doc) : null;
                        return (
                          <div
                            key={docType}
                            className={`rounded-xl border-2 p-4 text-center transition-colors ${
                              doc
                                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                                : "border-dashed border-muted-foreground/20 bg-muted/20"
                            }`}
                          >
                            {doc ? (
                              <Download className="h-8 w-8 text-primary mx-auto mb-2" />
                            ) : (
                              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                            )}
                            <p className={`text-xs font-semibold ${doc ? "text-foreground" : "text-muted-foreground"}`}>
                              {SPECIAL_DOC_LABELS_MAP[docType]}
                            </p>
                            {doc && fileUrl ? (
                              <div className="flex items-center justify-center gap-1 mt-2">
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => window.open(fileUrl, "_blank")}>
                                  <ExternalLink className="h-3 w-3 mr-1" /> Ouvrir
                                </Button>
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground mt-1">Non disponible</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

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
                    {DOCUMENT_TYPES_REQUIS.filter(dt => !["CREDIT_EXTERIEUR", "CREDIT_INTERIEUR", "LETTRE_ADOPTION"].includes(dt.value)).map((dt) => {
                      // Find the active version, or the latest by version/id
                      const allOfType = docs.filter((d) => d.type === dt.value);
                      const uploaded = allOfType.find(d => d.actif === true)
                        || allOfType.sort((a, b) => (b.version || b.id) - (a.version || a.id))[0]
                        || null;
                      const fileUrl = uploaded ? getDocFileUrl(uploaded) : null;
                      const olderVersions = allOfType.filter(d => d.id !== uploaded?.id).sort((a, b) => (b.version || b.id) - (a.version || a.id));
                      return (
                        <div key={dt.value} className="space-y-1">
                        <div className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                          {uploaded ? (
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${!uploaded ? "text-muted-foreground" : ""}`}>{dt.label}</p>
                            {uploaded && (
                              <p className="text-xs text-muted-foreground truncate">
                                {uploaded.nomFichier}
                                {uploaded.version && <span className="ml-1 font-medium">(v{uploaded.version})</span>}
                              </p>
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
                                {hasRole(["AUTORITE_CONTRACTANTE", "ADMIN_SI"]) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => { setUploadType(dt.value); setUploadOpen(true); }}
                                  >
                                    <Upload className="h-3.5 w-3.5 mr-1" /> Nouvelle version
                                  </Button>
                                )}
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
                        {/* Version history */}
                        {olderVersions.length > 0 && (
                          <div className="ml-8 mt-1 space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Versions précédentes :</p>
                            {olderVersions.map(v => (
                              <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>v{v.version || '?'} — {v.nomFichier}</span>
                                <span>{new Date(v.dateUpload).toLocaleDateString("fr-FR")}</span>
                                {v.chemin && (
                                  <a href={getDocFileUrl(v)} target="_blank" rel="noopener noreferrer" className="underline">
                                    Télécharger
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>

              {/* Workflow Actions — buttons under documents */}
              {transitions.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-border">
                  {/* Visa / Simple reject */}
                  {(() => {
                    const decs = selected.decisions || [];
                    const myDec = decs.find(d => d.role === role);
                    return (
                      <div className="space-y-2">
                        {/* Current decision status */}
                        {myDec && (
                          <div className={`text-xs rounded px-2 py-1 inline-block ${myDec.decision === "VISA" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            Votre décision actuelle : {myDec.decision === "VISA" ? "Visa" : "Rejet"} — Vous pouvez la modifier ci-dessous
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {transitions.filter(t => !t.isDecisionFinale && t.from.includes(selected.statut)).map((t, idx) => (
                            <Button
                              key={idx}
                              variant={t.to === "REJETEE" ? "destructive" : (t.isVisa && myDec?.decision === "VISA") ? "secondary" : "default"}
                              disabled={actionLoading === selected.id}
                              onClick={() => t.to === "REJETEE" ? openRejectDialog(selected.id) : checkAndHandleVisa(selected.id)}
                            >
                              {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <t.icon className="h-4 w-4 mr-1" />}
                              {myDec ? (t.isVisa ? "Re-valider" : "Rejeter à nouveau") : t.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Decision finale (DGTCP / PRESIDENT only) — visible uniquement si les 4 organismes ont validé */}
                  {(() => {
                    const hasFinalTransitions = transitions.some(t => t.isDecisionFinale && t.from.includes(selected.statut));
                    if (!hasFinalTransitions) return null;
                    const decs = selected.decisions || [];
                    const REQUIRED_ROLES = ["DGD", "DGTCP", "DGI", "DGB"];
                    const allValidated = REQUIRED_ROLES.every(r => decs.find(d => d.role === r)?.decision === "VISA");
                    const missingRoles = REQUIRED_ROLES.filter(r => decs.find(d => d.role === r)?.decision !== "VISA");
                    return (
                      <div className="pt-2 border-t border-dashed border-border space-y-2">
                        <span className="text-xs font-semibold text-muted-foreground mr-2">Décision finale :</span>
                        {!allValidated ? (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            ⚠️ Tous les organismes doivent apposer leur visa avant de pouvoir prendre la décision finale.
                            <br />Manquant : {missingRoles.join(", ")}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {transitions.filter(t => t.isDecisionFinale && t.from.includes(selected.statut)).map((t, idx) => (
                              <Button
                                key={`final-${idx}`}
                                variant={t.to === "REJETEE" ? "destructive" : "default"}
                                disabled={actionLoading === selected.id}
                                onClick={() => t.to === "REJETEE" ? openRejectDialog(selected.id, true) : handleAdoptWithLetter(selected.id)}
                              >
                                {actionLoading === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <t.icon className="h-4 w-4 mr-1" />}
                                {t.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
      {/* Offre Corrigée Upload Dialog (DGTCP/DGB) */}
      <Dialog open={offreCorrigeeOpen} onOpenChange={(v) => { setOffreCorrigeeOpen(v); if (!v) { setOffreCorrigeeFile(null); setOffreCorrigeePendingId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload du {uploadBeforeVisa?.label || "document"}</DialogTitle>
            <DialogDescription>
              Vous devez uploader le document « {uploadBeforeVisa?.label || "requis"} » avant de pouvoir apposer votre visa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fichier du {uploadBeforeVisa?.label || "document"}</Label>
              <Input type="file" onChange={(e) => setOffreCorrigeeFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOffreCorrigeeOpen(false); setOffreCorrigeeFile(null); setOffreCorrigeePendingId(null); }}>Annuler</Button>
            <Button onClick={handleOffreCorrigeeUploadAndVisa} disabled={offreCorrigeeUploading || !offreCorrigeeFile}>
              {offreCorrigeeUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Uploader et valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Demandes;