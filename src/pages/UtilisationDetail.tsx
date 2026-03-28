import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  utilisationCreditApi, UtilisationCreditDto, UtilisationStatut, UtilisationType,
  UTILISATION_STATUT_LABELS, UTILISATION_DOC_TYPES_DOUANE, UTILISATION_DOC_TYPES_TVA,
  UTILISATION_DOCUMENT_TYPES, TypeDocumentUtilisation, DocumentDto,
  DecisionCorrectionDto, DecisionType, RejetTempResponseDto,
  certificatCreditApi, CertificatCreditDto, TvaDeductibleStockDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Loader2, Landmark, Ship, Building2, FileText, Upload, Info,
  AlertTriangle, CheckCircle2, Clock, CreditCard, XCircle, CircleDollarSign,
  TrendingDown, TrendingUp, Minus
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUT_COLORS: Record<UtilisationStatut, string> = {
  DEMANDEE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION: "bg-yellow-100 text-yellow-800",
  VISE: "bg-purple-100 text-purple-800",
  VALIDEE: "bg-emerald-100 text-emerald-800",
  LIQUIDEE: "bg-green-100 text-green-800",
  APUREE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
};

const f = (v: any) => v != null ? Number(v).toLocaleString("fr-FR") : "—";

const UtilisationDetail = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [util, setUtil] = useState<UtilisationCreditDto | null>(null);
  const [cert, setCert] = useState<CertificatCreditDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [tvaStock, setTvaStock] = useState<TvaDeductibleStockDto[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Liquidation dialog
  const [showLiq, setShowLiq] = useState(false);
  const [liqDroits, setLiqDroits] = useState("");
  const [liqTVA, setLiqTVA] = useState("");
  const [liqLoading, setLiqLoading] = useState(false);

  // Apurement dialog
  const [showApur, setShowApur] = useState(false);
  const [apurMontant, setApurMontant] = useState("");
  const [apurLoading, setApurLoading] = useState(false);

  // Rejet temp dialog
  const [showRejet, setShowRejet] = useState(false);
  const [rejetMotif, setRejetMotif] = useState("");
  const [rejetDocs, setRejetDocs] = useState<string[]>([]);
  const [rejetLoading, setRejetLoading] = useState(false);

  // Document upload
  const [showUpload, setShowUpload] = useState(false);
  const [docType, setDocType] = useState<TypeDocumentUtilisation>("DEMANDE_UTILISATION");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Rejet temp response
  const [respondDecisionId, setRespondDecisionId] = useState<number | null>(null);
  const [responseMsg, setResponseMsg] = useState("");
  const [responding, setResponding] = useState(false);

  // Rejet temp upload doc response
  const [uploadRejetDecisionId, setUploadRejetDecisionId] = useState<number | null>(null);
  const [rejetUploadDocType, setRejetUploadDocType] = useState<TypeDocumentUtilisation>("DEMANDE_UTILISATION");
  const [rejetUploadFile, setRejetUploadFile] = useState<File | null>(null);
  const [rejetUploadMsg, setRejetUploadMsg] = useState("");
  const [rejetUploading, setRejetUploading] = useState(false);

  const utilId = Number(id);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const u = await utilisationCreditApi.getById(utilId);
      setUtil(u);
      const [d, dec] = await Promise.all([
        utilisationCreditApi.getDocuments(utilId).catch(() => []),
        utilisationCreditApi.getDecisions(utilId).catch(() => []),
      ]);
      setDocs(d);
      setDecisions(dec);
      // Load cert and TVA stock
      if (u.certificatCreditId) {
        certificatCreditApi.getById(u.certificatCreditId).then(setCert).catch(() => {});
        if (role === "DGTCP" || role === "ADMIN_SI") {
          certificatCreditApi.getTvaStock(u.certificatCreditId).then(setTvaStock).catch(() => setTvaStock([]));
        }
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger l'utilisation", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) fetchAll(); }, [id]);

  const handleStatut = async (statut: UtilisationStatut) => {
    setActionLoading(true);
    try {
      await utilisationCreditApi.updateStatut(utilId, statut);
      toast({ title: "Succès", description: `Statut: ${UTILISATION_STATUT_LABELS[statut]}` });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const handleLiquidation = async () => {
    setLiqLoading(true);
    try {
      await utilisationCreditApi.liquiderDouane(utilId, Number(liqDroits), Number(liqTVA));
      toast({ title: "Succès", description: "Utilisation liquidée — solde cordon mis à jour" });
      setShowLiq(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setLiqLoading(false); }
  };

  const handleApurement = async () => {
    setApurLoading(true);
    try {
      await utilisationCreditApi.apurerTVA(utilId, Number(apurMontant));
      toast({ title: "Succès", description: "Apurement TVA effectué" });
      setShowApur(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setApurLoading(false); }
  };

  const handleRejetTemp = async () => {
    if (!rejetMotif.trim() || rejetDocs.length === 0) return;
    setRejetLoading(true);
    try {
      await utilisationCreditApi.postDecision(utilId, "REJET_TEMP", rejetMotif.trim(), rejetDocs);
      toast({ title: "Succès", description: "Rejet temporaire envoyé" });
      setShowRejet(false);
      setRejetMotif("");
      setRejetDocs([]);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setRejetLoading(false); }
  };

  const handleUpload = async () => {
    if (!docFile) return;
    setUploading(true);
    try {
      await utilisationCreditApi.uploadDocument(utilId, docType, docFile);
      toast({ title: "Succès", description: "Document uploadé" });
      setDocFile(null);
      setShowUpload(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleRespondRejet = async () => {
    if (!respondDecisionId || !responseMsg.trim()) return;
    setResponding(true);
    try {
      await apiFetch(`/utilisations-credit/decisions/${respondDecisionId}/rejet-temp/reponses`, {
        method: "POST",
        body: { message: responseMsg.trim() },
      });
      toast({ title: "Succès", description: "Réponse envoyée" });
      setRespondDecisionId(null);
      setResponseMsg("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setResponding(false); }
  };

  const handleUploadRejetDoc = async () => {
    if (!uploadRejetDecisionId || !rejetUploadFile || !rejetUploadMsg.trim()) return;
    setRejetUploading(true);
    try {
      // Backend requires message in the document upload FormData when rejet is open
      const formData = new FormData();
      formData.append("file", rejetUploadFile);
      formData.append("message", rejetUploadMsg.trim());
      await apiFetch(`/utilisations-credit/${utilId}/documents?type=${encodeURIComponent(rejetUploadDocType)}`, {
        method: "POST",
        rawBody: formData,
      });
      
      // Auto-resolve the rejection after successful document upload
      try {
        await utilisationCreditApi.resolveRejetTemp(uploadRejetDecisionId);
        toast({ title: "Succès", description: "Document uploadé et rejet résolu automatiquement" });
      } catch {
        // If auto-resolve fails (e.g. not all docs provided), just notify upload success
        toast({ title: "Succès", description: "Document uploadé avec succès" });
      }
      
      setUploadRejetDecisionId(null);
      setRejetUploadFile(null);
      setRejetUploadMsg("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setRejetUploading(false); }
  };

  const handleResolveRejet = async (decisionId: number) => {
    try {
      await utilisationCreditApi.resolveRejetTemp(decisionId);
      toast({ title: "Succès", description: "Rejet résolu" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const openFile = async (doc: DocumentDto) => {
    try {
      const res = await fetch(doc.chemin!, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ouvrir le fichier", variant: "destructive" });
    }
  };

  if (loading) {
    return <DashboardLayout><div className="flex justify-center items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }

  if (!util) {
    return <DashboardLayout><div className="text-center py-24 text-muted-foreground">Utilisation introuvable</div></DashboardLayout>;
  }

  const u = util;
  const isDouane = u.type === "DOUANIER";
  const isTVA = u.type === "TVA_INTERIEURE";
  const canUploadDoc = role === "ENTREPRISE" || role === "ADMIN_SI";
  const totalStockDisponible = tvaStock.reduce((s, t) => s + t.montantRestant, 0);

  // Determine available actions
  // DGD n'a PAS d'actions sur les utilisations — seule la DGTCP agit
  const canDGDVerify = false;
  const canDGDVisa = false;
  const canDGTCPLiquider = role === "DGTCP" && isDouane && u.statut === "VISE";
  const canDGTCPVerifyTVA = role === "DGTCP" && isTVA && u.statut === "DEMANDEE";
  const canDGTCPValideTVA = role === "DGTCP" && isTVA && u.statut === "EN_VERIFICATION";
  const canDGTCPApurer = role === "DGTCP" && isTVA && u.statut === "VALIDEE";
  const canRejetTemp = role === "DGTCP" && ["DEMANDEE", "EN_VERIFICATION", "VISE", "VALIDEE", "A_RECONTROLER"].includes(u.statut);
  const canReject = (role === "DGTCP" && isTVA && ["DEMANDEE", "EN_VERIFICATION", "VALIDEE"].includes(u.statut)) ||
    (role === "DGTCP" && isDouane && u.statut === "VISE");

  // A_RECONTROLER transitions — DGTCP uniquement
  const canDGDReVerify = false;
  const canDGTCPReVerifyTVA = role === "DGTCP" && isTVA && u.statut === "A_RECONTROLER";

  const openRejets = decisions.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT");
  const resolvedDecisions = decisions.filter(d => d.rejetTempStatus === "RESOLU" || d.decision === "VISA");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {isDouane ? <Ship className="h-6 w-6 text-primary" /> : <Building2 className="h-6 w-6 text-primary" />}
              Utilisation #{u.id} — {isDouane ? "Importation Douanière" : "TVA Intérieure"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Certificat {u.certificatReference || `#${u.certificatCreditId}`}
              {u.entrepriseNom && ` — ${u.entrepriseNom}`}
            </p>
          </div>
          <Badge className={`text-sm px-3 py-1 ${STATUT_COLORS[u.statut]}`}>
            {UTILISATION_STATUT_LABELS[u.statut]}
          </Badge>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><CreditCard className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Montant total</p>
                  <p className="text-lg font-bold">{f(u.montant)} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isDouane && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Droits de douane</p>
                  <p className="text-lg font-bold">{f(u.montantDroits)} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">TVA Douane (import)</p>
                  <p className="text-lg font-bold">{f(u.montantTVADouane)} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
                </CardContent>
              </Card>
            </>
          )}

          {isTVA && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">TVA Intérieure (collectée)</p>
                <p className="text-lg font-bold">{f(u.montantTVAInterieure)} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
              </CardContent>
            </Card>
          )}

          {cert && (
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Soldes certificat</p>
                <div className="text-sm space-y-1 mt-1">
                  <div className="flex justify-between"><span>Cordon:</span><span className="font-semibold">{f(cert.soldeCordon)} MRU</span></div>
                  <div className="flex justify-between"><span>TVA:</span><span className="font-semibold">{f(cert.soldeTVA)} MRU</span></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Details métier */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informations métier</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {isDouane && (
                <>
                  <div><p className="text-muted-foreground">N° Déclaration</p><p className="font-medium">{u.numeroDeclaration || "—"}</p></div>
                  <div><p className="text-muted-foreground">N° Bulletin</p><p className="font-medium">{u.numeroBulletin || "—"}</p></div>
                  <div><p className="text-muted-foreground">Date déclaration</p><p className="font-medium">{u.dateDeclaration ? new Date(u.dateDeclaration).toLocaleDateString("fr-FR") : "—"}</p></div>
                  <div><p className="text-muted-foreground">SYDONIA</p><p className="font-medium">{u.enregistreeSYDONIA ? "✅ Oui" : "❌ Non"}</p></div>
                </>
              )}
              {isTVA && (
                <>
                  <div><p className="text-muted-foreground">Type d'achat</p><p className="font-medium">{u.typeAchat === "ACHAT_LOCAL" ? "Achat Local" : u.typeAchat === "DECOMPTE" ? "Décompte" : u.typeAchat || "—"}</p></div>
                  <div><p className="text-muted-foreground">N° Facture</p><p className="font-medium">{u.numeroFacture || "—"}</p></div>
                  <div><p className="text-muted-foreground">N° Décompte</p><p className="font-medium">{u.numeroDecompte || "—"}</p></div>
                  <div><p className="text-muted-foreground">Date facture</p><p className="font-medium">{u.dateFacture ? new Date(u.dateFacture).toLocaleDateString("fr-FR") : "—"}</p></div>
                </>
              )}
              <div><p className="text-muted-foreground">Date création</p><p className="font-medium">{u.dateCreation ? new Date(u.dateCreation).toLocaleDateString("fr-FR") : "—"}</p></div>
              {u.dateLiquidation && <div><p className="text-muted-foreground">Date liquidation</p><p className="font-medium">{new Date(u.dateLiquidation).toLocaleDateString("fr-FR")}</p></div>}
            </div>
          </CardContent>
        </Card>

        {/* Traçabilité Liquidation Douane */}
        {isDouane && u.statut === "LIQUIDEE" && u.soldeCordonAvant != null && (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-5 w-5 text-blue-500" /> Traçabilité liquidation</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground">Solde Cordon avant</p><p className="font-bold">{f(u.soldeCordonAvant)} MRU</p></div>
                <div><p className="text-muted-foreground">Montant imputé</p><p className="font-bold text-destructive">- {f(u.montant)} MRU</p></div>
                <div><p className="text-muted-foreground">Solde Cordon après</p><p className="font-bold text-emerald-600">{f(u.soldeCordonApres)} MRU</p></div>
                <div><p className="text-muted-foreground">TVA → Stock FIFO</p><p className="font-bold text-blue-600">+ {f(u.montantTVADouane)} MRU</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Traçabilité Apurement TVA */}
        {isTVA && u.statut === "APUREE" && u.tvaNette != null && (
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-500" /> Traçabilité apurement TVA</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><p className="text-muted-foreground">TVA collectée</p><p className="font-bold">{f(u.montantTVAInterieure)} MRU</p></div>
                  <div><p className="text-muted-foreground">TVA déductible utilisée</p><p className="font-bold">- {f(u.tvaDeductibleUtilisee)} MRU</p></div>
                  <div>
                    <p className="text-muted-foreground">TVA nette</p>
                    <p className={`font-bold text-lg ${(u.tvaNette ?? 0) > 0 ? "text-destructive" : (u.tvaNette ?? 0) < 0 ? "text-emerald-600" : ""}`}>
                      {f(u.tvaNette)} MRU
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-3">
                  <div><p className="text-muted-foreground">Crédit intérieur utilisé</p><p className="font-medium">{f(u.creditInterieurUtilise)} MRU</p></div>
                  <div><p className="text-muted-foreground">Paiement entreprise</p><p className="font-medium">{f(u.paiementEntreprise)} MRU</p></div>
                  <div><p className="text-muted-foreground">Report à nouveau</p><p className="font-medium">{f(u.reportANouveau)} MRU</p></div>
                  <div>
                    <p className="text-muted-foreground">Solde TVA</p>
                    <p className="font-medium">{f(u.soldeTVAAvant)} → <span className="font-bold">{f(u.soldeTVAApres)} MRU</span></p>
                  </div>
                </div>
                {/* Cas métier */}
                <div className={`p-3 rounded-lg text-sm ${(u.tvaNette ?? 0) === 0 ? "bg-muted" : (u.tvaNette ?? 0) > 0 ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"}`}>
                  {(u.tvaNette ?? 0) === 0 && <p className="flex items-center gap-2"><Minus className="h-4 w-4" /> <strong>Cas 1</strong> — TVA nette nulle : opération neutre, aucun impact sur le solde.</p>}
                  {(u.tvaNette ?? 0) > 0 && (u.paiementEntreprise ?? 0) === 0 && <p className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-amber-600" /> <strong>Cas 2a</strong> — TVA nette positive : le solde TVA du certificat a été débité de {f(u.creditInterieurUtilise)} MRU.</p>}
                  {(u.tvaNette ?? 0) > 0 && (u.paiementEntreprise ?? 0) > 0 && <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> <strong>Cas 2b</strong> — Solde insuffisant : {f(u.creditInterieurUtilise)} MRU prélevés + {f(u.paiementEntreprise)} MRU à payer en cash par l'entreprise.</p>}
                  {(u.tvaNette ?? 0) < 0 && <p className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /> <strong>Cas 3</strong> — Report à nouveau : {f(u.reportANouveau)} MRU ajoutés au solde TVA du certificat.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TVA Stock FIFO (for DGTCP when preparing apurement) */}
        {isTVA && (role === "DGTCP" || role === "ADMIN_SI") && tvaStock.length > 0 && u.statut !== "APUREE" && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Stock TVA déductible disponible (FIFO) — Total : {f(totalStockDisponible)} MRU</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Déclaration</TableHead>
                    <TableHead>Initial</TableHead>
                    <TableHead>Consommé</TableHead>
                    <TableHead>Restant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Épuisé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tvaStock.map(t => (
                    <TableRow key={t.id} className={t.epuise ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{t.numeroDeclaration || `Util #${t.utilisationDouaneId}`}</TableCell>
                      <TableCell>{f(t.montantInitial)} MRU</TableCell>
                      <TableCell>{f(t.montantConsomme)} MRU</TableCell>
                      <TableCell className="font-bold">{f(t.montantRestant)} MRU</TableCell>
                      <TableCell>{t.dateCreation ? new Date(t.dateCreation).toLocaleDateString("fr-FR") : "—"}</TableCell>
                      <TableCell>{t.epuise ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Documents ({docs.filter(d => d.actif !== false).length})</CardTitle>
              {canUploadDoc && (
                <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
                  <Upload className="h-4 w-4 mr-2" /> Ajouter
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {docs.filter(d => d.actif !== false).length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Aucun document</p>
            ) : (
              <div className="space-y-2">
                {docs.filter(d => d.actif !== false).map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{d.nomFichier}</p>
                      <p className="text-xs text-muted-foreground">{d.type?.replace(/_/g, " ")} — v{d.version || 1}</p>
                    </div>
                    {d.chemin && (
                      <Button variant="ghost" size="sm" onClick={() => openFile(d)}>Ouvrir</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Decisions / Rejets */}
        {decisions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Décisions & Rejets ({decisions.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Open rejets first */}
                {openRejets.map(d => (
                  <div key={d.id} className="p-3 rounded-lg border-2 border-amber-400 bg-amber-50/50 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="text-xs">REJET OUVERT</Badge>
                      <span className="text-sm font-medium">{d.utilisateurNom || d.role}</span>
                      {d.dateDecision && <span className="text-xs text-muted-foreground">{new Date(d.dateDecision).toLocaleDateString("fr-FR")}</span>}
                    </div>
                    {d.motifRejet && <p className="text-sm">{d.motifRejet}</p>}
                    {d.documentsDemandes && d.documentsDemandes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-muted-foreground">Documents demandés :</span>
                        {d.documentsDemandes.map(doc => <Badge key={doc} variant="outline" className="text-[10px]">{doc.replace(/_/g, " ")}</Badge>)}
                      </div>
                    )}
                    {/* Responses */}
                    {d.rejetTempResponses && d.rejetTempResponses.length > 0 && (
                      <div className="ml-4 space-y-1 border-l-2 border-muted pl-3">
                        {d.rejetTempResponses.map((r, i) => (
                          <div key={i} className="text-sm">
                            <span className="text-muted-foreground">{r.auteurNom || r.utilisateurNom || "Réponse"} :</span> {r.message}
                            {r.documentUrl && <Badge className="ml-1 text-[10px]">📎 Doc</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      {(role === "ENTREPRISE" || role === "AUTORITE_CONTRACTANTE") && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setRespondDecisionId(d.id); setResponseMsg(""); }}>
                            Répondre
                          </Button>
                          <Button size="sm" variant="outline" className="text-primary" onClick={() => {
                            setUploadRejetDecisionId(d.id);
                            setRejetUploadFile(null);
                            setRejetUploadMsg("");
                            // Pre-select first requested doc type if available
                            const requestedDocs = d.documentsDemandes || [];
                            setRejetUploadDocType(requestedDocs.length > 0 ? requestedDocs[0] as TypeDocumentUtilisation : "DEMANDE_UTILISATION");
                          }}>
                            <Upload className="h-4 w-4 mr-1" /> Upload doc
                          </Button>
                        </>
                      )}
                      {d.role === role && (
                        <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => handleResolveRejet(d.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Marquer résolu
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {/* Resolved decisions */}
                {resolvedDecisions.map(d => (
                  <div key={d.id} className={`p-2 rounded border text-sm ${d.decision === "VISA" ? "border-emerald-300 bg-emerald-50/50" : "border-muted bg-muted/30"}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant={d.decision === "VISA" ? "default" : "secondary"} className="text-[10px]">{d.decision}</Badge>
                      <span className="text-muted-foreground">{d.utilisateurNom || d.role}</span>
                      {d.dateDecision && <span className="text-xs text-muted-foreground">{new Date(d.dateDecision).toLocaleDateString("fr-FR")}</span>}
                      {d.rejetTempStatus === "RESOLU" && <Badge className="text-[10px] bg-emerald-100 text-emerald-800">Résolu</Badge>}
                    </div>
                    {d.motifRejet && <p className="text-muted-foreground mt-1">{d.motifRejet}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {(canDGDVerify || canDGDVisa || canDGTCPLiquider || canDGTCPVerifyTVA || canDGTCPValideTVA || canDGTCPApurer || canRejetTemp || canReject || canDGDReVerify || canDGTCPReVerifyTVA) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Actions disponibles</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {canDGDVerify && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Passer en vérification</Button>}
                {canDGDReVerify && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Re-vérifier</Button>}
                {canDGDVisa && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatut("VISE")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Apposer le visa</Button>}
                {canDGTCPVerifyTVA && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Passer en vérification</Button>}
                {canDGTCPReVerifyTVA && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Re-vérifier</Button>}
                {canDGTCPValideTVA && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatut("VALIDEE")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Valider</Button>}
                {canDGTCPLiquider && <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setShowLiq(true); setLiqDroits(String(u.montantDroits ?? "")); setLiqTVA(String(u.montantTVADouane ?? "")); }}><Landmark className="h-4 w-4 mr-2" /> Liquider (imputation)</Button>}
                {canDGTCPApurer && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setShowApur(true); setApurMontant(""); }}><CircleDollarSign className="h-4 w-4 mr-2" /> Procéder à l'apurement</Button>}
                {canRejetTemp && <Button variant="outline" className="text-amber-600 border-amber-300" onClick={() => { setShowRejet(true); setRejetMotif(""); setRejetDocs([]); }}><AlertTriangle className="h-4 w-4 mr-1" /> Rejet temporaire</Button>}
                {canReject && <Button variant="destructive" onClick={() => handleStatut("REJETEE")} disabled={actionLoading}><XCircle className="h-4 w-4 mr-2" /> Rejeter définitivement</Button>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Liquidation Dialog */}
      <Dialog open={showLiq} onOpenChange={setShowLiq}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Liquidation Douane — Utilisation #{u.id}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Saisissez les montants d'imputation. Le solde cordon sera automatiquement débité et une tranche FIFO sera créée.</p>
            <div className="space-y-3">
              <div><Label>Montant Droits (MRU) *</Label><Input type="number" min="0" value={liqDroits} onChange={e => setLiqDroits(e.target.value)} /></div>
              <div><Label>Montant TVA Douane (MRU) *</Label><Input type="number" min="0" value={liqTVA} onChange={e => setLiqTVA(e.target.value)} /></div>
              {liqDroits && liqTVA && (
                <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                  <div className="flex justify-between"><span>Total imputation :</span><span className="font-bold text-primary">{f(Number(liqDroits) + Number(liqTVA))} MRU</span></div>
                  {cert && <div className="flex justify-between"><span>Solde Cordon actuel :</span><span>{f(cert.soldeCordon)} MRU</span></div>}
                  {cert && <div className="flex justify-between"><span>Solde après :</span><span className="font-bold">{f((cert.soldeCordon ?? 0) - Number(liqDroits) - Number(liqTVA))} MRU</span></div>}
                  <div className="border-t pt-1"><span className="text-blue-600">→ Tranche FIFO créée : {f(Number(liqTVA))} MRU de TVA déductible</span></div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLiq(false)}>Annuler</Button>
              <Button disabled={liqLoading || !liqDroits || !liqTVA} onClick={handleLiquidation}>
                {liqLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirmer la liquidation
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apurement Dialog */}
      <Dialog open={showApur} onOpenChange={setShowApur}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Apurement TVA — Utilisation #{u.id}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Saisissez la TVA déductible à utiliser. Le système consommera le stock FIFO et calculera la TVA nette.</p>
            {tvaStock.length > 0 && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                <p className="font-semibold text-blue-800 mb-1">Stock TVA déductible disponible : {f(totalStockDisponible)} MRU</p>
                <div className="text-xs text-blue-600 space-y-0.5">
                  {tvaStock.filter(t => !t.epuise).map(t => (
                    <div key={t.id}>{t.numeroDeclaration || `Util #${t.utilisationDouaneId}`} : {f(t.montantRestant)} MRU</div>
                  ))}
                </div>
              </div>
            )}
            <div className="p-3 rounded-lg bg-muted text-sm">
              <div className="flex justify-between"><span>TVA collectée :</span><span className="font-semibold">{f(u.montantTVAInterieure)} MRU</span></div>
            </div>
            <div>
              <Label>TVA déductible à utiliser (MRU) *</Label>
              <Input type="number" min="0" value={apurMontant} onChange={e => setApurMontant(e.target.value)} />
            </div>
            {apurMontant && u.montantTVAInterieure != null && (() => {
              const tvaNette = u.montantTVAInterieure - Number(apurMontant);
              return (
                <div className="p-3 rounded-lg border space-y-1 text-sm">
                  <div className="flex justify-between"><span>TVA collectée :</span><span>{f(u.montantTVAInterieure)} MRU</span></div>
                  <div className="flex justify-between"><span>TVA déductible :</span><span>- {f(Number(apurMontant))} MRU</span></div>
                  <div className="border-t pt-1 flex justify-between font-bold">
                    <span>TVA nette :</span>
                    <span className={tvaNette > 0 ? "text-destructive" : tvaNette < 0 ? "text-emerald-600" : ""}>{f(tvaNette)} MRU</span>
                  </div>
                  {tvaNette === 0 && <p className="text-xs text-muted-foreground mt-1">➡ Cas 1 : Opération neutre</p>}
                  {tvaNette > 0 && <p className="text-xs text-amber-600 mt-1">⚠ Cas 2 : TVA nette positive — solde TVA sera débité{cert && (cert.soldeTVA ?? 0) < tvaNette ? `, paiement cash de ${f(tvaNette - (cert.soldeTVA ?? 0))} MRU requis` : ""}</p>}
                  {tvaNette < 0 && <p className="text-xs text-emerald-600 mt-1">✅ Cas 3 : Report à nouveau de {f(Math.abs(tvaNette))} MRU → solde TVA augmente</p>}
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApur(false)}>Annuler</Button>
              <Button disabled={apurLoading || !apurMontant || Number(apurMontant) < 0} onClick={handleApurement}>
                {apurLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirmer l'apurement
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejet Temp Dialog */}
      <Dialog open={showRejet} onOpenChange={setShowRejet}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Rejet temporaire</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Motif *</Label><Textarea placeholder="Corrections ou compléments attendus..." value={rejetMotif} onChange={e => setRejetMotif(e.target.value)} className="min-h-[80px]" /></div>
            <div>
              <Label>Documents à corriger *</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto mt-2">
                {(isDouane ? UTILISATION_DOC_TYPES_DOUANE : UTILISATION_DOC_TYPES_TVA).map(dt => (
                  <label key={dt.value} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={rejetDocs.includes(dt.value)} onCheckedChange={checked => setRejetDocs(prev => checked ? [...prev, dt.value] : prev.filter(d => d !== dt.value))} />
                    <span className="text-sm">{dt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejet(false)}>Annuler</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" disabled={rejetLoading || !rejetMotif.trim() || rejetDocs.length === 0} onClick={handleRejetTemp}>
              {rejetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={docType} onValueChange={v => setDocType(v as TypeDocumentUtilisation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(isDouane ? UTILISATION_DOC_TYPES_DOUANE : UTILISATION_DOC_TYPES_TVA).map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="file" onChange={e => setDocFile(e.target.files?.[0] || null)} />
            <Button onClick={handleUpload} disabled={uploading || !docFile} className="w-full">
              {uploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Uploader
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Respond to rejet */}
      <Dialog open={respondDecisionId !== null} onOpenChange={() => setRespondDecisionId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Répondre au rejet temporaire</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Votre réponse..." value={responseMsg} onChange={e => setResponseMsg(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRespondDecisionId(null)}>Annuler</Button>
              <Button disabled={responding || !responseMsg.trim()} onClick={handleRespondRejet}>
                {responding && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Envoyer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload doc for rejet temp */}
      <Dialog open={uploadRejetDecisionId !== null} onOpenChange={() => setUploadRejetDecisionId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Ajouter un document manquant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Show requested doc types from the rejet */}
            {(() => {
              const decision = decisions.find(d => d.id === uploadRejetDecisionId);
              const requestedDocs = decision?.documentsDemandes || [];
              const availableDocTypes = requestedDocs.length > 0
                ? (isDouane ? UTILISATION_DOC_TYPES_DOUANE : UTILISATION_DOC_TYPES_TVA).filter(dt => requestedDocs.includes(dt.value))
                : (isDouane ? UTILISATION_DOC_TYPES_DOUANE : UTILISATION_DOC_TYPES_TVA);
              return (
                <>
                  {requestedDocs.length > 0 && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <span className="font-semibold">Documents demandés :</span> {requestedDocs.map(d => d.replace(/_/g, " ")).join(", ")}
                    </div>
                  )}
                  <div>
                    <Label className="text-sm">Type de document</Label>
                    <Select value={rejetUploadDocType} onValueChange={v => setRejetUploadDocType(v as TypeDocumentUtilisation)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableDocTypes.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              );
            })()}
            <div>
              <Label className="text-sm">Fichier *</Label>
              <Input type="file" onChange={e => setRejetUploadFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" />
            </div>
            <div>
              <Label className="text-sm">Message justificatif *</Label>
              <Textarea placeholder="Décrivez le document fourni..." value={rejetUploadMsg} onChange={e => setRejetUploadMsg(e.target.value)} className="min-h-[60px]" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadRejetDecisionId(null)}>Annuler</Button>
              <Button disabled={rejetUploading || !rejetUploadFile || !rejetUploadMsg.trim()} onClick={handleUploadRejetDoc}>
                {rejetUploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Uploader
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UtilisationDetail;
