import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  utilisationCreditApi, UtilisationCreditDto, UtilisationStatut, UtilisationType,
  UTILISATION_STATUT_LABELS, utilisationStatutLabel, UTILISATION_DOC_TYPES_DOUANE, UTILISATION_DOC_TYPES_TVA,
  UTILISATION_DOCUMENT_TYPES, TypeDocumentUtilisation, DocumentDto,
  DecisionCorrectionDto, DecisionType, RejetTempResponseDto,
  certificatCreditApi, CertificatCreditDto, TvaDeductibleStockDto,
  LigneBulletinDto, AffectationTaxe,
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

const STATUT_COLORS: Record<UtilisationStatut, string> = {
  BROUILLON: "bg-slate-100 text-slate-700",
  DEMANDEE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION: "bg-yellow-100 text-yellow-800",
  VISE: "bg-purple-100 text-purple-800",
  VALIDEE: "bg-emerald-100 text-emerald-800",
  LIQUIDEE: "bg-green-100 text-green-800",
  APUREE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
  CLOTUREE: "bg-slate-200 text-slate-800",
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

  // Liquidation dialog (décision par ligne du bulletin)
  const [showLiq, setShowLiq] = useState(false);
  const [liqDecisions, setLiqDecisions] = useState<Record<number, AffectationTaxe>>({});
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
  const [respondDecision, setRespondDecision] = useState<DecisionCorrectionDto | null>(null);
  const [respondWithUpload, setRespondWithUpload] = useState(false);
  const [responseFiles, setResponseFiles] = useState<Record<string, File>>({});
  const [responseMsg, setResponseMsg] = useState("");
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [responding, setResponding] = useState(false);

  const utilId = Number(id);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const u = await utilisationCreditApi.getById(utilId);
      const [d, dec, lignesFallback] = await Promise.all([
        utilisationCreditApi.getDocuments(utilId).catch(() => []),
        utilisationCreditApi.getDecisions(utilId).catch(() => []),
        (!u.lignes || u.lignes.length === 0) && u.type === "DOUANIER"
          ? utilisationCreditApi.getLignesBulletin(utilId).catch(() => [])
          : Promise.resolve(null),
      ]);
      // Compléter les lignes si le DTO principal ne les contient pas (selon le rôle backend)
      if (lignesFallback && Array.isArray(lignesFallback) && lignesFallback.length > 0) {
        u.lignes = lignesFallback;
        if (u.totalPrisEnCharge == null) {
          u.totalPrisEnCharge = lignesFallback
            .filter(l => l.affectation === "AU_CI")
            .reduce((s, l) => s + (Number(l.valeur) || 0), 0);
        }
        if (u.totalAPayer == null) {
          u.totalAPayer = lignesFallback
            .filter(l => l.affectation === "A_PAYER")
            .reduce((s, l) => s + (Number(l.valeur) || 0), 0);
        }
      }
      setUtil(u);
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

  // DGD : annote chaque ligne + appose le visa en une seule action (POST /visa-dgd → statut VISE)
  const handleVisaDgd = async () => {
    if (!util) return;
    const lignes = util.lignes || [];
    const missing = lignes.filter(l => !liqDecisions[l.id]);
    if (missing.length > 0) {
      toast({ title: "Décisions incomplètes", description: `Toutes les lignes doivent être affectées (AU CI ou À PAYER). Restantes : ${missing.length}.`, variant: "destructive" });
      return;
    }
    setLiqLoading(true);
    try {
      const decisions = lignes.map(l => ({ ligneId: l.id, affectation: liqDecisions[l.id] }));
      await utilisationCreditApi.visaDgd(utilId, decisions);
      toast({ title: "Visa apposé", description: "Le bulletin est annoté et visé. En attente de la liquidation DGTCP." });
      setShowLiq(false);
      setLiqDecisions({});
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setLiqLoading(false); }
  };

  // DGTCP : exécute la liquidation financière (POST /liquidation-douane, sans body → statut LIQUIDEE)
  const handleLiquidationDgtcp = async () => {
    setLiqLoading(true);
    try {
      await utilisationCreditApi.liquiderDouane(utilId);
      toast({ title: "Liquidation effectuée", description: "Solde cordon débité, quota TVA décrémenté, stock TVA déductible alimenté." });
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
    if (!respondDecision) return;
    const files = respondWithUpload ? Object.values(responseFiles) : (responseFile ? [responseFile] : []);
    if (!responseMsg.trim() && files.length === 0) return;
    setResponding(true);
    try {
      // Send one API call per file, or a single call if text-only
      if (files.length === 0) {
        await utilisationCreditApi.postRejetTempResponse(respondDecision.id, responseMsg.trim(), undefined, undefined);
      } else if (respondWithUpload && respondDecision.documentsDemandes?.length) {
        // Multi-upload: responseFiles is keyed by doc type
        const entries = Object.entries(responseFiles);
        for (let i = 0; i < entries.length; i++) {
          const [docType, file] = entries[i];
          const msg = i === 0 ? (responseMsg.trim() || "Document joint") : "Document joint";
          await utilisationCreditApi.postRejetTempResponse(respondDecision.id, msg, file, docType);
        }
      } else if (responseFile) {
        await utilisationCreditApi.postRejetTempResponse(respondDecision.id, responseMsg.trim() || "Document joint", responseFile);
      }
      toast({ title: "Succès", description: files.length > 1 ? `${files.length} documents envoyés` : "Réponse envoyée" });
      setRespondDecision(null);
      setRespondWithUpload(false);
      setResponseFiles({});
      setResponseMsg("");
      setResponseFile(null);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setResponding(false); }
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
  const canDGDVerify = role === "DGD" && isDouane && u.statut === "DEMANDEE";
  // Le DGD annote chaque ligne (AU CI / À PAYER) et appose son visa en une seule action.
  // Possible depuis DEMANDEE, EN_VERIFICATION ou A_RECONTROLER.
  const lignesAffectees = (u.lignes || []).every(l => !!l.affectation);
  const canDGDAnnoterEtViser = role === "DGD" && isDouane && ["DEMANDEE", "EN_VERIFICATION", "A_RECONTROLER"].includes(u.statut) && (u.lignes?.length || 0) > 0;
  // DGTCP douanier : liquide directement depuis VISE (pas d'étape VALIDEE intermédiaire — backend simplifié)
  const canDGTCPLiquider = role === "DGTCP" && isDouane && u.statut === "VISE";
  const canDGTCPVerifyTVA = role === "DGTCP" && isTVA && u.statut === "DEMANDEE";
  const canDGTCPValideTVA = role === "DGTCP" && isTVA && u.statut === "EN_VERIFICATION";
  const canDGTCPApurer = role === "DGTCP" && isTVA && u.statut === "VALIDEE";
  const myHasVisa = decisions.some(d => d.role === role && d.decision === "VISA");
  const canRejetTemp = !myHasVisa && (role === "DGD" || role === "DGTCP") && ["DEMANDEE", "EN_VERIFICATION", "VISE", "VALIDEE", "A_RECONTROLER"].includes(u.statut);
  const canReject = (role === "DGD" && isDouane && ["DEMANDEE", "EN_VERIFICATION", "A_RECONTROLER"].includes(u.statut)) ||
    (role === "DGTCP" && isTVA && ["DEMANDEE", "EN_VERIFICATION", "VALIDEE"].includes(u.statut)) ||
    (role === "DGTCP" && isDouane && u.statut === "VISE");

  // A_RECONTROLER transitions
  const canDGDReVerify = role === "DGD" && isDouane && u.statut === "A_RECONTROLER";
  const canDGTCPReVerifyTVA = role === "DGTCP" && isTVA && u.statut === "A_RECONTROLER";

  const openRejets = decisions.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT");
  const resolvedRejets = decisions.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "RESOLU");
  const visaDecisions = decisions.filter(d => d.decision === "VISA");

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
              {u.demandeurEstSousTraitant && (
                <Badge variant="outline" className="ml-2 text-[10px] border-orange-300 text-orange-700 bg-orange-50">Sous-traité</Badge>
              )}
            </p>
            {u.demandeurEstSousTraitant && u.certificatTitulaireRaisonSociale && (
              <p className="text-xs text-muted-foreground mt-0.5">Titulaire du certificat : <span className="font-medium">{u.certificatTitulaireRaisonSociale}</span></p>
            )}
          </div>
          <Badge className={`text-sm px-3 py-1 ${STATUT_COLORS[u.statut]}`}>
            {utilisationStatutLabel(u.statut, u.type)}
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
                  <p className="text-xs text-muted-foreground">Total pris en charge (CI)</p>
                  <p className="text-lg font-bold text-primary">{f(u.totalPrisEnCharge)} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Total à payer (entreprise)</p>
                  <p className="text-lg font-bold text-amber-700">{f(u.totalAPayer)} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
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

        {/* Bulletin de liquidation — lignes saisies par l'entreprise + affectation DGTCP */}
        {isDouane && u.lignes && u.lignes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Bulletin de liquidation ({u.lignes.length} ligne{u.lignes.length > 1 ? "s" : ""})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Code</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="text-right w-32">Valeur (MRU)</TableHead>
                    <TableHead className="w-36">Affectation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {u.lignes.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.code}</TableCell>
                      <TableCell className="text-sm">{l.libelle}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{l.type}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{f(l.valeur)}</TableCell>
                      <TableCell>
                        {l.affectation === "AU_CI" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">AU CI</Badge>
                        ) : l.affectation === "A_PAYER" ? (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px]">À PAYER</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">En attente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell colSpan={3} className="text-right">Totaux</TableCell>
                    <TableCell className="text-right">
                      {f(u.lignes.reduce((s, l) => s + (Number(l.valeur) || 0), 0))}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="text-emerald-700">CI : {f(u.totalPrisEnCharge)}</div>
                      <div className="text-amber-700">Payer : {f(u.totalAPayer)}</div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Traçabilité Liquidation Douane */}
        {isDouane && u.statut === "LIQUIDEE" && u.soldeCordonAvant != null && (
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-5 w-5 text-blue-500" /> Traçabilité liquidation</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground">Solde Cordon avant</p><p className="font-bold">{f(u.soldeCordonAvant)} MRU</p></div>
                <div><p className="text-muted-foreground">Montant imputé</p><p className="font-bold text-destructive">- {f(u.montant)} MRU</p></div>
                <div><p className="text-muted-foreground">Solde Cordon après</p><p className="font-bold text-emerald-600">{f(u.soldeCordonApres)} MRU</p></div>
                <div><p className="text-muted-foreground">TVA → Stock déductible</p><p className="font-bold text-blue-600">+ {f(u.montantTVADouane)} MRU</p></div>
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

        {/* Stock TVA déductible (for DGTCP when preparing apurement) */}
        {isTVA && (role === "DGTCP" || role === "ADMIN_SI") && tvaStock.length > 0 && u.statut !== "APUREE" && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Stock TVA déductible disponible — Total : {f(totalStockDisponible)} MRU</CardTitle></CardHeader>
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
                          <Button size="sm" variant="outline" onClick={() => { setRespondDecision(d); setRespondWithUpload(false); setResponseMsg(""); setResponseFile(null); setResponseFiles({}); }}>
                             Répondre
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRespondDecision(d); setRespondWithUpload(true); setResponseMsg(""); setResponseFile(null); setResponseFiles({}); }}>
                            <Upload className="h-3.5 w-3.5 mr-1" /> Upload doc
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
                {/* Visa decisions */}
                {visaDecisions.map(d => (
                  <div key={d.id} className="p-2 rounded border text-sm border-emerald-300 bg-emerald-50/50">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-[10px]">VISA</Badge>
                      <span className="text-muted-foreground">{d.utilisateurNom || d.role}</span>
                      {d.dateDecision && <span className="text-xs text-muted-foreground">{new Date(d.dateDecision).toLocaleDateString("fr-FR")}</span>}
                    </div>
                    {d.motifRejet && <p className="text-muted-foreground mt-1">{d.motifRejet}</p>}
                  </div>
                ))}
                {/* Resolved rejets (NOT visas) */}
                {resolvedRejets.map(d => (
                  <div key={d.id} className="p-2 rounded border text-sm border-muted bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">REJET_TEMP</Badge>
                      <span className="text-muted-foreground">{d.utilisateurNom || d.role}</span>
                      {d.dateDecision && <span className="text-xs text-muted-foreground">{new Date(d.dateDecision).toLocaleDateString("fr-FR")}</span>}
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-800">Résolu</Badge>
                    </div>
                    {d.motifRejet && <p className="text-muted-foreground mt-1">{d.motifRejet}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {(canDGDVerify || canDGDAnnoterEtViser || canDGTCPLiquider || canDGTCPVerifyTVA || canDGTCPValideTVA || canDGTCPApurer || canRejetTemp || canReject || canDGDReVerify || canDGTCPReVerifyTVA) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Actions disponibles</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {canDGDVerify && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Prendre en charge</Button>}
                {canDGDReVerify && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Re-vérifier</Button>}
                {canDGDAnnoterEtViser && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                    const init: Record<number, AffectationTaxe> = {};
                    (u.lignes || []).forEach(l => { if (l.affectation) init[l.id] = l.affectation; });
                    setLiqDecisions(init);
                    setShowLiq(true);
                  }}><Landmark className="h-4 w-4 mr-2" /> Annoter le bulletin & viser</Button>
                )}
                {canDGTCPVerifyTVA && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Passer en vérification</Button>}
                {canDGTCPReVerifyTVA && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Re-vérifier</Button>}
                {canDGTCPValideTVA && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatut("VALIDEE")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Valider</Button>}
                {canDGTCPLiquider && <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleLiquidationDgtcp} disabled={liqLoading}>
                  {liqLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Landmark className="h-4 w-4 mr-2" /> Exécuter la liquidation
                </Button>}
                {canDGTCPApurer && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setShowApur(true); setApurMontant(""); }}><CircleDollarSign className="h-4 w-4 mr-2" /> Procéder à l'apurement</Button>}
                {canRejetTemp && <Button variant="outline" className="text-amber-600 border-amber-300" onClick={() => { setShowRejet(true); setRejetMotif(""); setRejetDocs([]); }}><AlertTriangle className="h-4 w-4 mr-1" /> Rejet temporaire</Button>}
                {canReject && <Button variant="destructive" onClick={() => handleStatut("REJETEE")} disabled={actionLoading}><XCircle className="h-4 w-4 mr-2" /> Rejeter définitivement</Button>}
              </div>
              {canDGTCPLiquider && (
                <p className="text-xs text-muted-foreground mt-3">
                  La liquidation va débiter le solde cordon de <strong>{f((u.totalPrisEnCharge ?? 0) - (u.montantTVADouane ?? 0))} MRU</strong> (hors TVA), décrémenter le quota TVA importation de <strong>{f(u.montantTVADouane)} MRU</strong> et alimenter le stock TVA déductible.
                </p>
              )}
              {role === "DGD" && isDouane && (u.lignes?.length || 0) === 0 && (
                <p className="text-xs text-amber-700 mt-3">Aucune ligne n'a été saisie par l'entreprise. Demandez via rejet temporaire la complétion du bulletin.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Liquidation Dialog — décision par ligne du bulletin */}
      <Dialog open={showLiq} onOpenChange={setShowLiq}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Annotation du bulletin & visa DGD — #{u.id}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pour chaque ligne du bulletin, choisissez son <strong>affectation</strong> : <Badge variant="outline" className="mx-1">AU CI</Badge> (pris en charge par le crédit extérieur) ou <Badge variant="outline" className="mx-1">À PAYER</Badge> (à régler comptant par l'entreprise). À la confirmation, le statut passe à <strong>VISÉ</strong> ; la liquidation financière sera ensuite exécutée par le DGTCP.
            </p>
            {(!u.lignes || u.lignes.length === 0) ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                Aucune ligne de bulletin n'a été saisie pour cette utilisation. Demandez à l'entreprise de compléter le bulletin avant le visa.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Code</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="text-right w-32">Valeur (MRU)</TableHead>
                    <TableHead className="w-44">Affectation *</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {u.lignes.map((l: LigneBulletinDto) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.code}</TableCell>
                      <TableCell className="text-sm">{l.libelle}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{l.type}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{f(l.valeur)}</TableCell>
                      <TableCell>
                        <Select value={liqDecisions[l.id] || ""} onValueChange={(v) => setLiqDecisions(prev => ({ ...prev, [l.id]: v as AffectationTaxe }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AU_CI">AU CI (crédit extérieur)</SelectItem>
                            <SelectItem value="A_PAYER">À PAYER (entreprise)</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {u.lignes && u.lignes.length > 0 && (() => {
              const totalAuCi = u.lignes.filter(l => liqDecisions[l.id] === "AU_CI").reduce((s, l) => s + (Number(l.valeur) || 0), 0);
              const tvaAuCi = u.lignes.filter(l => liqDecisions[l.id] === "AU_CI" && (l.code || "").toUpperCase() === "TVA").reduce((s, l) => s + (Number(l.valeur) || 0), 0);
              const horsTvaAuCi = totalAuCi - tvaAuCi;
              const totalAPayer = u.lignes.filter(l => liqDecisions[l.id] === "A_PAYER").reduce((s, l) => s + (Number(l.valeur) || 0), 0);
              const restant = u.lignes.filter(l => !liqDecisions[l.id]).length;
              return (
                <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                  <div className="flex justify-between"><span>Total pris en charge (AU CI) :</span><span className="font-bold text-primary">{f(totalAuCi)} MRU</span></div>
                  <div className="flex justify-between text-xs pl-3"><span>— dont TVA (stock déductible) :</span><span>{f(tvaAuCi)} MRU</span></div>
                  <div className="flex justify-between text-xs pl-3"><span>— dont hors TVA (solde cordon) :</span><span>{f(horsTvaAuCi)} MRU</span></div>
                  <div className="flex justify-between"><span>Total à payer (entreprise) :</span><span className="font-bold text-amber-700">{f(totalAPayer)} MRU</span></div>
                  {cert && <div className="flex justify-between border-t pt-1"><span>Solde Cordon actuel :</span><span>{f(cert.soldeCordon)} MRU</span></div>}
                  {cert && <div className="flex justify-between"><span>Solde Cordon après liquidation DGTCP :</span><span className="font-bold">{f((cert.soldeCordon ?? 0) - horsTvaAuCi)} MRU</span></div>}
                  {restant > 0 && <div className="text-amber-700 text-xs pt-1">{restant} ligne(s) sans affectation — toutes les lignes doivent être renseignées.</div>}
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLiq(false)}>Annuler</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={liqLoading || !u.lignes || u.lignes.length === 0 || u.lignes.some(l => !liqDecisions[l.id])} onClick={handleVisaDgd}>
                {liqLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirmer le visa
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
            <p className="text-sm text-muted-foreground">Saisissez la TVA déductible à utiliser. Le système consommera le stock TVA déductible et calculera la TVA nette.</p>
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
      <Dialog open={respondDecision !== null} onOpenChange={() => { setRespondDecision(null); setRespondWithUpload(false); setResponseFile(null); setResponseFiles({}); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{respondWithUpload ? "Uploader les documents demandés" : "Répondre au rejet temporaire"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Votre réponse ou justification..." value={responseMsg} onChange={e => setResponseMsg(e.target.value)} />
            {respondWithUpload && respondDecision?.documentsDemandes && respondDecision.documentsDemandes.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Documents demandés ({respondDecision.documentsDemandes.length})</Label>
                {respondDecision.documentsDemandes.map(dt => {
                  const docLabel = UTILISATION_DOCUMENT_TYPES.find(t => t.value === dt)?.label || dt.replace(/_/g, " ");
                  const file = responseFiles[dt];
                  return (
                    <div key={dt} className="p-3 rounded-lg border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{docLabel}</span>
                        {file && <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">✓ Sélectionné</Badge>}
                      </div>
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          setResponseFiles(prev => {
                            const next = { ...prev };
                            if (f) next[dt] = f; else delete next[dt];
                            return next;
                          });
                        }}
                      />
                      {file && <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> {file.name}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            {!respondWithUpload && (
              <div>
                <Label className="text-sm">Joindre un document (optionnel)</Label>
                <Input type="file" className="mt-1" onChange={e => setResponseFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" />
                {responseFile && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {responseFile.name}
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRespondDecision(null); setRespondWithUpload(false); setResponseFile(null); setResponseFiles({}); }}>Annuler</Button>
              <Button
                disabled={responding || (!responseMsg.trim() && !responseFile && Object.keys(responseFiles).length === 0) || (respondWithUpload && respondDecision?.documentsDemandes?.length ? Object.keys(responseFiles).length === 0 : false)}
                onClick={handleRespondRejet}
              >
                {responding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {respondWithUpload && Object.keys(responseFiles).length > 1 ? `Envoyer ${Object.keys(responseFiles).length} documents` : "Envoyer"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UtilisationDetail;
