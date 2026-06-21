import { API_BASE } from "@/lib/apiConfig";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  utilisationCreditApi, UtilisationCreditDto, UtilisationStatut, UtilisationType,
  UTILISATION_DOC_TYPES_DOUANE, UTILISATION_DOC_TYPES_TVA, getUtilisationDocTypesTVA,
  TypeDocumentUtilisation, DocumentDto,
  DecisionCorrectionDto, RejetTempResponseDto,
  certificatCreditApi, CertificatCreditDto, TvaDeductibleStockDto,
  LigneBulletinDto, AffectationTaxe, QuittanceTresorDto,
} from "@/lib/api";
import {
  tTypeDocument, tStatutUtilisation, tUtilisationStatutContextualise,
} from "@/i18n/enums";
import { formatAmount, formatDate } from "@/i18n/format";
import { usePageTitle } from "@/hooks/usePageTitle";
import DiscussionCommissionPanel from "@/components/explication/DiscussionCommissionPanel";

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
import {
  ArrowLeft, Loader2, Landmark, Ship, Building2, FileText, Upload, Info,
  AlertTriangle, CheckCircle2, CreditCard, XCircle, CircleDollarSign,
  TrendingDown, TrendingUp, Minus, Download
} from "lucide-react";
import { generateLiquidationPdf } from "@/lib/liquidationPdf";

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
  EN_CONTROLE_DGD: "bg-purple-100 text-purple-800",
  CHEQUE_SAISI: "bg-indigo-100 text-indigo-800",
  ENVOYEE_AU_TRESOR: "bg-sky-100 text-sky-800",
  QUITTANCES_ENREGISTREES: "bg-teal-100 text-teal-800",
};

const fmtAmt = (v: any) => formatAmount(v, { currency: "MRU", maximumFractionDigits: 2 });
const fmtNum = (v: any) => {
  if (v == null || isNaN(Number(v))) return "—";
  const n = Number(v);
  // Préserve les décimales (centimes) si présentes, pour éviter les écarts d'arrondi
  // entre la somme des lignes et le Montant total.
  const hasDecimals = Math.abs(n - Math.round(n)) > 1e-9;
  return n.toLocaleString("fr-FR", hasDecimals ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });
};

// Conversion d'un nombre en lettres (français) — usage bulletin de liquidation.
// REVIEW: conservé en FR uniquement ; la traduction des montants en lettres en AR
// n'est pas spécifiée dans ce lot.
const _u = ["zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf"];
const _t = ["","","vingt","trente","quarante","cinquante","soixante","soixante","quatre-vingt","quatre-vingt"];
function _below1000(n: number): string {
  if (n === 0) return "";
  let s = "";
  const c = Math.floor(n / 100), r = n % 100;
  if (c > 0) s += (c > 1 ? _u[c] + " " : "") + "cent" + (c > 1 && r === 0 ? "s" : "");
  if (r > 0) {
    if (s) s += " ";
    if (r < 20) s += _u[r];
    else {
      const d = Math.floor(r / 10), un = r % 10;
      if (d === 7 || d === 9) {
        s += _t[d] + (d === 7 && un === 1 ? " et " : "-") + _u[10 + un];
      } else {
        s += _t[d];
        if (un === 1 && d !== 8) s += " et un";
        else if (un > 0) s += "-" + _u[un];
        else if (d === 8) s += "s";
      }
    }
  }
  return s;
}
// i18n-intentional: montant en lettres pour document officiel PDF (français uniquement, exigence légale).
function numberToFrenchWords(n: number): string {
  if (!isFinite(n)) return "";
  const entier = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - entier) * 100);
  if (entier === 0 && cents === 0) return "zéro Ouguiya";
  let s = "";
  const millions = Math.floor(entier / 1000000);
  const milliers = Math.floor((entier % 1000000) / 1000);
  const reste = entier % 1000;
  if (millions > 0) s += (millions === 1 ? "un million" : _below1000(millions) + " millions");
  if (milliers > 0) {
    if (s) s += " ";
    s += (milliers === 1 ? "mille" : _below1000(milliers) + " mille");
  }
  if (reste > 0) {
    if (s) s += " ";
    s += _below1000(reste);
  }
  if (cents > 0) s += " virgule " + _below1000(cents);
  s += " Ouguiya";
  return s;
}

const UtilisationDetail = () => {
  const { t } = useTranslation(["utilisations", "common", "errors"]);
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const tSuccess = () => t("common:states.success", { defaultValue: "Succès" });
  const tError = () => t("common:states.error", { defaultValue: "Erreur" });

  const [util, setUtil] = useState<UtilisationCreditDto | null>(null);
  const [cert, setCert] = useState<CertificatCreditDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [tvaStock, setTvaStock] = useState<TvaDeductibleStockDto[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Liquidation dialog
  const [showLiq, setShowLiq] = useState(false);
  const [liqDecisions, setLiqDecisions] = useState<Record<number, AffectationTaxe>>({});
  const [liqValeurs, setLiqValeurs] = useState<Record<number, string>>({});
  const [liqBulletinFile, setLiqBulletinFile] = useState<File | null>(null);
  const [liqLoading, setLiqLoading] = useState(false);

  // Apurement dialog
  const [showApur, setShowApur] = useState(false);
  const [apurMontant, setApurMontant] = useState("");
  const [apurLoading, setApurLoading] = useState(false);

  // Montants en lettres (éditables)
  const [lettresAPayer, setLettresAPayer] = useState<string | null>(null);
  const [lettresAuCi, setLettresAuCi] = useState<string | null>(null);
  const [lettresAPayerLiq, setLettresAPayerLiq] = useState<string | null>(null);
  const [lettresAuCiLiq, setLettresAuCiLiq] = useState<string | null>(null);

  // Chèque dialog
  const [showCheque, setShowCheque] = useState(false);
  const [chequeForm, setChequeForm] = useState({ banqueNom: "", numeroCheque: "", montantCheque: "", dateCheque: "" });
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [chequeLoading, setChequeLoading] = useState(false);

  // Quittances dialog
  const [showQuittances, setShowQuittances] = useState(false);
  const [quittancesForm, setQuittancesForm] = useState<QuittanceTresorDto[]>([]);
  const [quittancesFiles, setQuittancesFiles] = useState<Record<number, File | null>>({});
  const [quittancesLoading, setQuittancesLoading] = useState(false);

  const [envoiLoading, setEnvoiLoading] = useState(false);
  const [receptionLoading, setReceptionLoading] = useState(false);

  // Rejet temp dialog
  const [showRejet, setShowRejet] = useState(false);
  const [rejetMotif, setRejetMotif] = useState("");
  const [rejetDocs, setRejetDocs] = useState<string[]>([]);
  const [rejetLoading, setRejetLoading] = useState(false);

  // Upload
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

  usePageTitle("utilisations:detail.title", {
    reference: util ? (util.numeroDeclaration || util.numeroFacture || `#${util.id}`) : `#${id}`,
  });

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
      if (u.certificatCreditId) {
        certificatCreditApi.getById(u.certificatCreditId).then(setCert).catch(() => {});
        if (role === "DGTCP" || role === "ADMIN_SI") {
          certificatCreditApi.getTvaStock(u.certificatCreditId).then(setTvaStock).catch(() => setTvaStock([]));
        }
      }
    } catch {
      toast({ title: tError(), description: t("utilisations:detail.load_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) fetchAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const handleStatut = async (statut: UtilisationStatut) => {
    setActionLoading(true);
    try {
      await utilisationCreditApi.updateStatut(utilId, statut);
      toast({ title: tSuccess(), description: t("utilisations:toast.statut_updated", { label: tStatutUtilisation(statut) }) });
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const handleVisaDgd = async () => {
    if (!util) return;
    const lignes = util.lignes || [];
    const missing = lignes.filter(l => (Number(l.valeur) || 0) > 0 && !liqDecisions[l.id]);
    if (missing.length > 0) {
      toast({ title: t("utilisations:toast.decisions_missing_title"), description: t("utilisations:toast.decisions_missing_desc", { count: missing.length }), variant: "destructive" });
      return;
    }
    setLiqLoading(true);
    try {
      const dec = lignes.filter(l => liqDecisions[l.id]).map(l => {
        const raw = liqValeurs[l.id];
        const overrideNum = raw !== undefined && raw !== "" ? Number(raw) : NaN;
        const hasOverride = !isNaN(overrideNum) && overrideNum !== Number(l.valeur);
        return { ligneId: l.id, affectation: liqDecisions[l.id], ...(hasOverride ? { valeurTaxe: overrideNum } : {}) };
      });
      await utilisationCreditApi.visaDgd(utilId, dec, liqBulletinFile);
      toast({ title: t("utilisations:toast.visa_apposed_title"), description: t("utilisations:toast.visa_apposed_desc") });
      setShowLiq(false);
      setLiqDecisions({});
      setLiqValeurs({});
      setLiqBulletinFile(null);
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setLiqLoading(false); }
  };

  const handleLiquidationDgtcp = async () => {
    setLiqLoading(true);
    try {
      await utilisationCreditApi.liquiderDouane(utilId);
      toast({ title: t("utilisations:toast.liquidation_done_title"), description: t("utilisations:toast.liquidation_done_desc") });
      setShowLiq(false);
      const u2 = await utilisationCreditApi.getById(utilId);
      const cert2 = u2.certificatCreditId
        ? await certificatCreditApi.getById(u2.certificatCreditId).catch(() => null)
        : null;
      setUtil(u2);
      if (cert2) setCert(cert2);
      try { generateLiquidationPdf(u2, cert2); } catch (err) { console.error("PDF generation failed", err); }
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setLiqLoading(false); }
  };

  const handleSaisirCheque = async () => {
    if (!chequeForm.banqueNom.trim() || !chequeForm.numeroCheque.trim() || !chequeForm.montantCheque) return;
    if (!chequeFile) {
      toast({ title: t("utilisations:toast.scan_required_title"), description: t("utilisations:toast.scan_required_desc"), variant: "destructive" });
      return;
    }
    setChequeLoading(true);
    try {
      await utilisationCreditApi.saisirCheque(utilId, {
        banqueNom: chequeForm.banqueNom.trim(),
        numeroCheque: chequeForm.numeroCheque.trim(),
        montantCheque: Number(chequeForm.montantCheque),
        dateCheque: chequeForm.dateCheque ? new Date(chequeForm.dateCheque).toISOString() : undefined,
        file: chequeFile,
      });
      toast({ title: t("utilisations:toast.cheque_saved_title"), description: t("utilisations:toast.cheque_saved_desc") });
      setShowCheque(false);
      setChequeForm({ banqueNom: "", numeroCheque: "", montantCheque: "", dateCheque: "" });
      setChequeFile(null);
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setChequeLoading(false); }
  };

  const handleEnvoyerTresor = async () => {
    setEnvoiLoading(true);
    try {
      await utilisationCreditApi.envoyerAuTresor(utilId);
      toast({ title: t("utilisations:toast.envoi_tresor_title"), description: t("utilisations:toast.envoi_tresor_desc") });
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setEnvoiLoading(false); }
  };

  const handleSaisirQuittances = async () => {
    const validIdx: number[] = [];
    quittancesForm.forEach((q, i) => {
      if (q.numeroQuittance.trim() && q.dateQuittance && Number(q.montant) > 0) validIdx.push(i);
    });
    if (validIdx.length === 0) {
      toast({ title: t("utilisations:toast.no_valid_quittance_title"), description: t("utilisations:toast.no_valid_quittance_desc"), variant: "destructive" });
      return;
    }
    setQuittancesLoading(true);
    try {
      const valid = validIdx.map(i => {
        const q = quittancesForm[i];
        return {
          numeroQuittance: q.numeroQuittance.trim(),
          dateQuittance: new Date(q.dateQuittance).toISOString(),
          montant: Number(q.montant),
          referencePaiement: q.referencePaiement?.trim() || undefined,
        };
      });
      const files = validIdx.map(i => quittancesFiles[i] || null);
      await utilisationCreditApi.saisirQuittances(utilId, valid, files);
      toast({ title: t("utilisations:toast.quittances_saved_title"), description: t("utilisations:toast.quittances_saved_desc", { count: valid.length }) });
      setShowQuittances(false);
      setQuittancesFiles({});
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setQuittancesLoading(false); }
  };

  const handleClotureReception = async () => {
    setReceptionLoading(true);
    try {
      await utilisationCreditApi.cloturerReception(utilId);
      toast({ title: t("utilisations:toast.reception_done_title"), description: t("utilisations:toast.reception_done_desc") });
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setReceptionLoading(false); }
  };

  const handleApurement = async () => {
    setApurLoading(true);
    try {
      await utilisationCreditApi.apurerTVA(utilId, Number(apurMontant));
      toast({ title: tSuccess(), description: t("utilisations:toast.apurement_done") });
      setShowApur(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setApurLoading(false); }
  };

  const handleRejetTemp = async () => {
    if (!rejetMotif.trim() || rejetDocs.length === 0) return;
    setRejetLoading(true);
    try {
      await utilisationCreditApi.postDecision(utilId, "REJET_TEMP", rejetMotif.trim(), rejetDocs);
      toast({ title: tSuccess(), description: t("utilisations:toast.rejet_temp_simple") });
      setShowRejet(false);
      setRejetMotif("");
      setRejetDocs([]);
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setRejetLoading(false); }
  };

  const handleUpload = async () => {
    if (!docFile) return;
    setUploading(true);
    try {
      await utilisationCreditApi.uploadDocument(utilId, docType, docFile);
      toast({ title: tSuccess(), description: t("utilisations:toast.doc_uploaded") });
      setDocFile(null);
      setShowUpload(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleRespondRejet = async () => {
    if (!respondDecision) return;
    const files = respondWithUpload ? Object.values(responseFiles) : (responseFile ? [responseFile] : []);
    if (!responseMsg.trim() && files.length === 0) return;
    setResponding(true);
    try {
      if (files.length === 0) {
        await utilisationCreditApi.postRejetTempResponse(respondDecision.id, responseMsg.trim(), undefined, undefined);
      } else if (respondWithUpload && respondDecision.documentsDemandes?.length) {
        const entries = Object.entries(responseFiles);
        for (let i = 0; i < entries.length; i++) {
          const [dt, file] = entries[i];
          const msg = i === 0 ? (responseMsg.trim() || t("utilisations:respond_dialog.default_doc_msg")) : t("utilisations:respond_dialog.default_doc_msg");
          await utilisationCreditApi.postRejetTempResponse(respondDecision.id, msg, file, dt);
        }
      } else if (responseFile) {
        await utilisationCreditApi.postRejetTempResponse(respondDecision.id, responseMsg.trim() || t("utilisations:respond_dialog.default_doc_msg"), responseFile);
      }
      toast({
        title: tSuccess(),
        description: files.length > 1
          ? t("utilisations:toast.documents_sent_n", { count: files.length })
          : t("utilisations:toast.response_sent"),
      });
      setRespondDecision(null);
      setRespondWithUpload(false);
      setResponseFiles({});
      setResponseMsg("");
      setResponseFile(null);
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    } finally { setResponding(false); }
  };

  const handleResolveRejet = async (decisionId: number) => {
    try {
      await utilisationCreditApi.resolveRejetTemp(decisionId);
      toast({ title: tSuccess(), description: t("utilisations:toast.rejet_resolved") });
      fetchAll();
    } catch (e: any) {
      toast({ title: tError(), description: e.message, variant: "destructive" });
    }
  };

  const openFile = (doc: DocumentDto) => {
    if (!doc.chemin) return;
    let url = doc.chemin;
    if (!/^https?:\/\//i.test(url)) {
      const apiOrigin = API_BASE.replace(/\/api\/?$/, "");
      url = apiOrigin + (url.startsWith("/") ? "" : "/") + url;
    }
    if (url.includes("ngrok")) {
      url += (url.includes("?") ? "&" : "?") + "ngrok-skip-browser-warning=true";
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <DashboardLayout><div className="flex justify-center items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }

  if (!util) {
    return <DashboardLayout><div className="text-center py-24 text-muted-foreground">{t("utilisations:detail.not_found")}</div></DashboardLayout>;
  }

  const u = util;
  const isDouane = u.type === "DOUANIER";
  const isTVA = u.type === "TVA_INTERIEURE";
  const tvaDocTypes = isTVA ? getUtilisationDocTypesTVA(u.typeAchat) : [];
  const canUploadDoc = role === "ENTREPRISE" || role === "ADMIN_SI";
  const totalStockDisponible = tvaStock.reduce((s, x) => s + x.montantRestant, 0);

  const canDGDVerify = role === "DGD" && isDouane && u.statut === "DEMANDEE";
  const canDGDAnnoterEtViser = role === "DGD" && isDouane && ["DEMANDEE", "EN_VERIFICATION", "A_RECONTROLER"].includes(u.statut) && (u.lignes?.length || 0) > 0;
  const isEntreprise = role === "ENTREPRISE" || role === "SOUS_TRAITANT" || role === "COMMISSION_RELAIS";
  const canEntrepriseCheque = isEntreprise && isDouane && (u.statut === "EN_CONTROLE_DGD" || u.statut === "VISE");
  const canDGTCPEnvoyerTresor = role === "DGTCP" && isDouane && u.statut === "CHEQUE_SAISI";
  const canDGTCPQuittances = role === "DGTCP" && isDouane && (u.statut === "ENVOYEE_AU_TRESOR" || u.statut === "QUITTANCES_ENREGISTREES");
  const canDGTCPLiquider = role === "DGTCP" && isDouane && (u.statut === "QUITTANCES_ENREGISTREES" || u.statut === "VISE");
  const canEntrepriseReception = isEntreprise && isDouane && u.statut === "LIQUIDEE";
  const canDGTCPVerifyTVA = role === "DGTCP" && isTVA && u.statut === "DEMANDEE";
  const canDGTCPValideTVA = role === "DGTCP" && isTVA && u.statut === "EN_VERIFICATION";
  const canDGTCPApurer = role === "DGTCP" && isTVA && u.statut === "VALIDEE";
  const myHasVisa = decisions.some(d => d.role === role && d.decision === "VISA");
  const canRejetTemp = !myHasVisa && (role === "DGD" || role === "DGTCP") && ["DEMANDEE", "EN_VERIFICATION", "EN_CONTROLE_DGD", "VISE", "VALIDEE", "A_RECONTROLER"].includes(u.statut);
  const canReject = (role === "DGD" && isDouane && ["DEMANDEE", "EN_VERIFICATION", "A_RECONTROLER"].includes(u.statut)) ||
    (role === "DGTCP" && isTVA && ["DEMANDEE", "EN_VERIFICATION", "VALIDEE"].includes(u.statut)) ||
    (role === "DGTCP" && isDouane && ["VISE", "EN_CONTROLE_DGD", "CHEQUE_SAISI", "ENVOYEE_AU_TRESOR", "QUITTANCES_ENREGISTREES"].includes(u.statut));
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
            <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("utilisations:detail.back")}
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {isDouane ? <Ship className="h-6 w-6 text-primary" /> : <Building2 className="h-6 w-6 text-primary" />}
              {isDouane
                ? t("utilisations:detail.header.title_douane", { id: u.id })
                : t("utilisations:detail.header.title_tva", { id: u.id })}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("utilisations:detail.header.subtitle_cert", { ref: u.certificatReference || `#${u.certificatCreditId}` })}
              {u.entrepriseNom && <> — {t("utilisations:detail.header.subtitle_company", { name: u.entrepriseNom })}</>}
              {u.demandeurEstSousTraitant && (
                <Badge variant="outline" className="ms-2 text-[10px] border-orange-300 text-orange-700 bg-orange-50">
                  {t("utilisations:detail.header.sous_traite_badge")}
                </Badge>
              )}
            </p>
            {u.demandeurEstSousTraitant && u.certificatTitulaireRaisonSociale && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("utilisations:detail.header.titulaire_label")} <span className="font-medium">{u.certificatTitulaireRaisonSociale}</span>
              </p>
            )}
          </div>
          <Badge className={`text-sm px-3 py-1 ${STATUT_COLORS[u.statut]}`}>
            {tUtilisationStatutContextualise(u.statut, u.type)}
          </Badge>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><CreditCard className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("utilisations:detail.kpi.montant_total")}</p>
                  <p className="text-lg font-bold">{fmtAmt(u.montant)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isDouane && (() => {
            // Si les totaux finaux ne sont pas encore figés par la DGD, on affiche
            // un aperçu basé sur la proposition de l'entreprise pour ne pas montrer "0".
            const beforeVisa = ["BROUILLON","DEMANDEE","INCOMPLETE","A_RECONTROLER","EN_VERIFICATION"].includes(u.statut);
            const lignes = u.lignes || [];
            const propAuCi = lignes.filter(l => l.affectationEntreprise === "AU_CI").reduce((s,l)=>s+(Number(l.valeur)||0),0);
            const propAPayer = lignes.filter(l => l.affectationEntreprise === "A_PAYER").reduce((s,l)=>s+(Number(l.valeur)||0),0);
            const showCi = (u.totalPrisEnCharge != null && u.totalPrisEnCharge > 0) ? u.totalPrisEnCharge : (beforeVisa ? propAuCi : (u.totalPrisEnCharge ?? 0));
            const showAP = (u.totalAPayer != null && u.totalAPayer > 0) ? u.totalAPayer : (beforeVisa ? propAPayer : (u.totalAPayer ?? 0));
            const isPreview = beforeVisa && (propAuCi > 0 || propAPayer > 0) && (!u.totalPrisEnCharge && !u.totalAPayer);
            return (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">
                      {t("utilisations:detail.kpi.total_au_ci")}
                      {isPreview && <span className="ms-1 text-[10px] italic text-muted-foreground/80">(aperçu — proposition entreprise)</span>}
                    </p>
                    <p className="text-lg font-bold text-primary">{fmtAmt(showCi)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">
                      {t("utilisations:detail.kpi.total_a_payer")}
                      {isPreview && <span className="ms-1 text-[10px] text-muted-foreground/80">({t("utilisations:bulletin.proposition_none", { defaultValue: "proposition" })})</span>}
                    </p>
                    <p className="text-lg font-bold text-amber-700">{fmtAmt(showAP)}</p>
                  </CardContent>
                </Card>
              </>
            );
          })()}

          {isTVA && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t("utilisations:detail.kpi.tva_collectee")}</p>
                <p className="text-lg font-bold">{fmtAmt(u.montantTVAInterieure)}</p>
              </CardContent>
            </Card>
          )}

          {cert && (
            <Card className="border-s-4 border-s-primary">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">{t("utilisations:detail.kpi.soldes_cert")}</p>
                <div className="text-sm space-y-1 mt-1">
                  <div className="flex justify-between"><span>{t("utilisations:detail.kpi.solde_cordon")}</span><span className="font-semibold">{fmtAmt(cert.soldeCordon)}</span></div>
                  <div className="flex justify-between"><span>{t("utilisations:detail.kpi.tva_import_restante")}</span><span className="font-semibold">{fmtAmt(cert.tvaImportationDouane)}</span></div>
                  <div className="flex justify-between"><span>{t("utilisations:detail.kpi.solde_tva_int")}</span><span className="font-semibold">{fmtAmt(cert.soldeTVA)}</span></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Info métier */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("utilisations:detail.info.title")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {isDouane && (
                <>
                  <div><p className="text-muted-foreground">{t("utilisations:detail.info.numero_declaration")}</p><p className="font-medium">{u.numeroDeclaration || "—"}</p></div>
                  <div><p className="text-muted-foreground">{t("utilisations:detail.info.numero_bulletin")}</p><p className="font-medium">{u.numeroBulletin || "—"}</p></div>
                  <div><p className="text-muted-foreground">{t("utilisations:detail.info.date_declaration")}</p><p className="font-medium">{formatDate(u.dateDeclaration)}</p></div>
                  <div><p className="text-muted-foreground">{t("utilisations:detail.info.sydonia")}</p><p className="font-medium">{u.enregistreeSYDONIA ? t("utilisations:detail.info.sydonia_yes") : t("utilisations:detail.info.sydonia_no")}</p></div>
                </>
              )}
              {isTVA && (
                <>
                  <div>
                    <p className="text-muted-foreground">{t("utilisations:detail.info.type_achat")}</p>
                    <p className="font-medium">{u.typeAchat === "ACHAT_LOCAL" ? t("utilisations:detail.info.achat_local") : u.typeAchat === "DECOMPTE" ? t("utilisations:detail.info.decompte") : (u.typeAchat || "—")}</p>
                  </div>
                  <div><p className="text-muted-foreground">{t("utilisations:detail.info.numero_facture")}</p><p className="font-medium">{u.numeroFacture || "—"}</p></div>
                  <div><p className="text-muted-foreground">{t("utilisations:detail.info.numero_decompte")}</p><p className="font-medium">{u.numeroDecompte || "—"}</p></div>
                  <div><p className="text-muted-foreground">{t("utilisations:detail.info.date_facture")}</p><p className="font-medium">{formatDate(u.dateFacture)}</p></div>
                </>
              )}
              <div><p className="text-muted-foreground">{t("utilisations:detail.info.date_creation")}</p><p className="font-medium">{formatDate(u.dateCreation)}</p></div>
              {u.dateLiquidation && <div><p className="text-muted-foreground">{t("utilisations:detail.info.date_liquidation")}</p><p className="font-medium">{formatDate(u.dateLiquidation)}</p></div>}
            </div>
          </CardContent>
        </Card>

        {/* Bulletin */}
        {isDouane && u.lignes && u.lignes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t("utilisations:bulletin.title", { count: u.lignes.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">{t("utilisations:bulletin.col_code")}</TableHead>
                    <TableHead>{t("utilisations:bulletin.col_name")}</TableHead>
                    <TableHead className="text-end w-40">{t("utilisations:bulletin.col_value")}</TableHead>
                    <TableHead className="w-36">{t("utilisations:bulletin.col_proposition")}</TableHead>
                    <TableHead className="w-44">{t("utilisations:bulletin.col_affectation")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {u.lignes.map(l => {
                    const val = Number(l.valeur) || 0;
                    const propose = l.affectationEntreprise ?? null;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.code}</TableCell>
                        <TableCell className="text-sm">{l.libelle}</TableCell>
                        <TableCell className="text-end font-medium">{fmtNum(l.valeur)}</TableCell>
                        <TableCell>
                          {val === 0 ? (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          ) : propose === "AU_CI" ? (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-[10px]">{t("utilisations:bulletin.affectation_au_ci")}</Badge>
                          ) : propose === "A_PAYER" ? (
                            <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]">{t("utilisations:bulletin.affectation_a_payer")}</Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">{t("utilisations:bulletin.proposition_none")}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {val === 0 ? (
                            <span className="text-[10px] text-muted-foreground">{t("utilisations:bulletin.affectation_not_required")}</span>
                          ) : (
                            <div className="flex flex-col gap-1 items-start">
                              {l.affectation === "AU_CI" ? (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">{t("utilisations:bulletin.affectation_au_ci")}</Badge>
                              ) : l.affectation === "A_PAYER" ? (
                                <Badge className="bg-amber-100 text-amber-800 text-[10px]">{t("utilisations:bulletin.affectation_a_payer")}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">{t("utilisations:bulletin.affectation_pending")}</Badge>
                              )}
                              {l.affectationModifieeParDgd === true && (
                                <span className="text-[10px] text-amber-700 font-medium">{t("utilisations:bulletin.dgd_modified")}</span>
                              )}
                              {l.affectationModifieeParDgd === false && (
                                <span className="text-[10px] text-emerald-700 font-medium">{t("utilisations:bulletin.dgd_validated")}</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {(() => {
                const visaStatuts: UtilisationStatut[] = ["EN_CONTROLE_DGD","VISE","VALIDEE","LIQUIDEE","APUREE","CLOTUREE","CHEQUE_SAISI","ENVOYEE_AU_TRESOR","QUITTANCES_ENREGISTREES"];
                if (!visaStatuts.includes(u.statut)) return null;
                const lignesAuCi = (u.lignes || []).filter(l => l.affectation === "AU_CI" && (Number(l.valeur) || 0) > 0);
                const lignesAPayer = (u.lignes || []).filter(l => l.affectation === "A_PAYER" && (Number(l.valeur) || 0) > 0);
                const totalAuCi = lignesAuCi.reduce((s,l)=>s+(Number(l.valeur)||0),0);
                const totalAPayer = lignesAPayer.reduce((s,l)=>s+(Number(l.valeur)||0),0);
                const codesAPayer = lignesAPayer.map(l=>l.code).join(" + ");
                const codesAuCi = lignesAuCi.map(l=>l.code).join(" + ");
                const dateVisa = u.dateMiseAJour || u.dateCreation;
                const dateStr = formatDate(dateVisa || new Date());
                return (
                  <div className="border-t bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">{t("utilisations:bulletin.annotation_title")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">{t("utilisations:bulletin.a_payer_box")}</p>
                        <p className="text-2xl font-bold text-amber-800 mt-1">{fmtAmt(totalAPayer)}</p>
                      </div>
                      <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                        <p className="text-xs uppercase tracking-wide text-primary font-semibold">{t("utilisations:bulletin.au_ci_box")}</p>
                        <p className="text-2xl font-bold text-primary mt-1">{fmtAmt(totalAuCi)}</p>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background p-4 space-y-2 font-serif">
                      <p className="text-sm"><span className="font-semibold">{t("utilisations:bulletin.date_prefix", { date: dateStr })}</span></p>
                      {totalAPayer > 0 && (
                        <p className="text-sm">
                          <span className="underline font-semibold">{t("utilisations:bulletin.a_payer_line")}</span>{codesAPayer && <> : {codesAPayer}</>} (<span className="font-semibold">{fmtAmt(totalAPayer)}</span>) — <em
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => setLettresAPayer(e.currentTarget.textContent || "")}
                            className="outline-none border-b border-dashed border-muted-foreground/40 focus:border-primary cursor-text"
                            title={t("utilisations:bulletin.edit_letters_title")}
                          >{lettresAPayer ?? numberToFrenchWords(totalAPayer)}</em>
                        </p>
                      )}
                      {totalAuCi > 0 && (
                        <p className="text-sm">
                          <span className="underline font-semibold">{t("utilisations:bulletin.au_ci_line")}</span>{codesAuCi && <> : {codesAuCi}</>} (<span className="font-semibold">{fmtAmt(totalAuCi)}</span>) — <em
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => setLettresAuCi(e.currentTarget.textContent || "")}
                            className="outline-none border-b border-dashed border-muted-foreground/40 focus:border-primary cursor-text"
                            title={t("utilisations:bulletin.edit_letters_title")}
                          >{lettresAuCi ?? numberToFrenchWords(totalAuCi)}</em>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Chèque */}
        {isDouane && u.numeroCheque && (
          <Card className="border-s-4 border-s-indigo-500">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-5 w-5 text-indigo-500" /> {t("utilisations:cheque.title")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground">{t("utilisations:cheque.banque")}</p><p className="font-medium">{u.banqueNom || "—"}</p></div>
                <div><p className="text-muted-foreground">{t("utilisations:cheque.numero")}</p><p className="font-mono font-medium">{u.numeroCheque}</p></div>
                <div><p className="text-muted-foreground">{t("utilisations:cheque.montant")}</p><p className="font-bold">{fmtAmt(u.montantCheque)}</p></div>
                <div><p className="text-muted-foreground">{t("utilisations:cheque.date")}</p><p className="font-medium">{formatDate(u.dateCheque)}</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quittances */}
        {isDouane && u.quittances && u.quittances.length > 0 && (
          <Card className="border-s-4 border-s-teal-500">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-500" />
                {t("utilisations:quittances.title", { count: u.quittances.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("utilisations:quittances.col_numero")}</TableHead>
                    <TableHead>{t("utilisations:quittances.col_date")}</TableHead>
                    <TableHead className="text-end">{t("utilisations:quittances.col_montant")}</TableHead>
                    <TableHead>{t("utilisations:quittances.col_reference")}</TableHead>
                    <TableHead>{t("utilisations:quittances.col_justificatif")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {u.quittances.map((q, i) => (
                    <TableRow key={q.id ?? i}>
                      <TableCell className="font-mono">{q.numeroQuittance}</TableCell>
                      <TableCell>{formatDate(q.dateQuittance)}</TableCell>
                      <TableCell className="text-end font-medium">{fmtNum(q.montant)}</TableCell>
                      <TableCell className="text-xs">{q.referencePaiement || "—"}</TableCell>
                      <TableCell>
                        {q.documentChemin ? (
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => openFile({ chemin: q.documentChemin, nomFichier: q.documentNomFichier } as any)}>
                            <FileText className="h-3.5 w-3.5 me-1" /> {q.documentNomFichier || t("utilisations:quittances.see_doc")}
                          </Button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell colSpan={2} className="text-end">{t("utilisations:quittances.total")}</TableCell>
                    <TableCell className="text-end">{fmtNum(u.quittances.reduce((s, q) => s + Number(q.montant || 0), 0))}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Traçabilité Liquidation Douane */}
        {isDouane && u.statut === "LIQUIDEE" && u.soldeCordonAvant != null && (
          <Card className="border-s-4 border-s-blue-500">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-5 w-5 text-blue-500" /> {t("utilisations:traceability_liq.title")}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => generateLiquidationPdf(u, cert)}>
                <Download className="h-4 w-4 me-2" /> {t("utilisations:traceability_liq.download_pdf")}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground">{t("utilisations:traceability_liq.solde_avant")}</p><p className="font-bold">{fmtAmt(u.soldeCordonAvant)}</p></div>
                <div><p className="text-muted-foreground">{t("utilisations:traceability_liq.montant_impute")}</p><p className="font-bold text-destructive">- {fmtAmt(u.montant)}</p></div>
                <div><p className="text-muted-foreground">{t("utilisations:traceability_liq.solde_apres")}</p><p className="font-bold text-emerald-600">{fmtAmt(u.soldeCordonApres)}</p></div>
                <div><p className="text-muted-foreground">{t("utilisations:traceability_liq.tva_to_stock")}</p><p className="font-bold text-blue-600">+ {fmtAmt(u.montantTVADouane)}</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Traçabilité Apurement TVA */}
        {isTVA && u.statut === "APUREE" && u.tvaNette != null && (
          <Card className="border-s-4 border-s-emerald-500">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-500" /> {t("utilisations:traceability_apur.title")}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><p className="text-muted-foreground">{t("utilisations:traceability_apur.tva_collectee")}</p><p className="font-bold">{fmtAmt(u.montantTVAInterieure)}</p></div>
                  <div><p className="text-muted-foreground">{t("utilisations:traceability_apur.tva_ded_used")}</p><p className="font-bold">- {fmtAmt(u.tvaDeductibleUtilisee)}</p></div>
                  <div>
                    <p className="text-muted-foreground">{t("utilisations:traceability_apur.tva_nette")}</p>
                    <p className={`font-bold text-lg ${(u.tvaNette ?? 0) > 0 ? "text-destructive" : (u.tvaNette ?? 0) < 0 ? "text-emerald-600" : ""}`}>
                      {fmtAmt(u.tvaNette)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-3">
                  <div><p className="text-muted-foreground">{t("utilisations:traceability_apur.credit_used")}</p><p className="font-medium">{fmtAmt(u.creditInterieurUtilise)}</p></div>
                  <div><p className="text-muted-foreground">{t("utilisations:traceability_apur.paiement_entreprise")}</p><p className="font-medium">{fmtAmt(u.paiementEntreprise)}</p></div>
                  <div><p className="text-muted-foreground">{t("utilisations:traceability_apur.report")}</p><p className="font-medium">{fmtAmt(u.reportANouveau)}</p></div>
                  <div>
                    <p className="text-muted-foreground">{t("utilisations:traceability_apur.solde_tva")}</p>
                    <p className="font-medium">{fmtAmt(u.soldeTVAAvant)} → <span className="font-bold">{fmtAmt(u.soldeTVAApres)}</span></p>
                  </div>
                </div>
                <div className={`p-3 rounded-lg text-sm ${(u.tvaNette ?? 0) === 0 ? "bg-muted" : (u.tvaNette ?? 0) > 0 ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"}`}>
                  {(u.tvaNette ?? 0) === 0 && <p className="flex items-center gap-2"><Minus className="h-4 w-4" /> {t("utilisations:traceability_apur.cas1")}</p>}
                  {(u.tvaNette ?? 0) > 0 && (u.paiementEntreprise ?? 0) === 0 && (
                    <p className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-amber-600" /> {t("utilisations:traceability_apur.cas2a", { montant: fmtAmt(u.creditInterieurUtilise) })}</p>
                  )}
                  {(u.tvaNette ?? 0) > 0 && (u.paiementEntreprise ?? 0) > 0 && (
                    <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> {t("utilisations:traceability_apur.cas2b", { interne: fmtAmt(u.creditInterieurUtilise), paiement: fmtAmt(u.paiementEntreprise) })}</p>
                  )}
                  {(u.tvaNette ?? 0) < 0 && (
                    <p className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /> {t("utilisations:traceability_apur.cas3", { montant: fmtAmt(u.reportANouveau) })}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock TVA */}
        {isTVA && (role === "DGTCP" || role === "ADMIN_SI") && tvaStock.length > 0 && u.statut !== "APUREE" && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> {t("utilisations:stock_tva.title", { total: fmtAmt(totalStockDisponible) })}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("utilisations:stock_tva.col_declaration")}</TableHead>
                    <TableHead>{t("utilisations:stock_tva.col_initial")}</TableHead>
                    <TableHead>{t("utilisations:stock_tva.col_consomme")}</TableHead>
                    <TableHead>{t("utilisations:stock_tva.col_restant")}</TableHead>
                    <TableHead>{t("utilisations:stock_tva.col_date")}</TableHead>
                    <TableHead>{t("utilisations:stock_tva.col_epuise")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tvaStock.map(x => (
                    <TableRow key={x.id} className={x.epuise ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{x.numeroDeclaration || t("utilisations:stock_tva.util_fallback", { id: x.utilisationDouaneId })}</TableCell>
                      <TableCell>{fmtAmt(x.montantInitial)}</TableCell>
                      <TableCell>{fmtAmt(x.montantConsomme)}</TableCell>
                      <TableCell className="font-bold">{fmtAmt(x.montantRestant)}</TableCell>
                      <TableCell>{formatDate(x.dateCreation)}</TableCell>
                      <TableCell>{x.epuise ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</TableCell>
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
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t("utilisations:documents.title", { count: docs.filter(d => d.actif !== false).length })}
              </CardTitle>
              {canUploadDoc && (
                <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
                  <Upload className="h-4 w-4 me-2" /> {t("utilisations:documents.add")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const allowedTvaTypes = isTVA ? new Set<string>(tvaDocTypes) : null;
              const visibleDocs = docs.filter(d => {
                if (d.actif === false) return false;
                if (!isTVA) return true;
                return allowedTvaTypes!.has(d.type as TypeDocumentUtilisation);
              });
              return visibleDocs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">{t("utilisations:documents.empty")}</p>
              ) : (
                <div className="space-y-2">
                  {visibleDocs.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{d.nomFichier}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.type ? `${tTypeDocument(d.type) || d.type.replace(/_/g, " ")} · ` : ""}
                          {t("utilisations:documents.version_short", { n: d.version || 1 })}
                        </p>
                      </div>
                      {d.chemin && (
                        <Button variant="ghost" size="sm" onClick={() => openFile(d)}>{t("utilisations:documents.open")}</Button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Decisions / Rejets */}
        {decisions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> {t("utilisations:decisions_section.title", { count: decisions.length })}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {openRejets.map(d => (
                  <div key={d.id} className="p-3 rounded-lg border-2 border-amber-400 bg-amber-50/50 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="text-xs">{t("utilisations:decisions_section.rejet_ouvert")}</Badge>
                      <span className="text-sm font-medium">{d.utilisateurNom || d.role}</span>
                      {d.dateDecision && <span className="text-xs text-muted-foreground">{formatDate(d.dateDecision)}</span>}
                    </div>
                    {d.motifRejet && <p className="text-sm">{d.motifRejet}</p>}
                    {d.documentsDemandes && d.documentsDemandes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-muted-foreground">{t("utilisations:decisions_section.documents_demandes")}</span>
                        {d.documentsDemandes.map(doc => <Badge key={doc} variant="outline" className="text-[10px]">{tTypeDocument(doc) || doc.replace(/_/g, " ")}</Badge>)}
                      </div>
                    )}
                    {d.rejetTempResponses && d.rejetTempResponses.length > 0 && (
                      <div className="ms-4 space-y-1 border-s-2 border-muted ps-3">
                        {d.rejetTempResponses.map((r: RejetTempResponseDto, i) => (
                          <div key={i} className="text-sm">
                            <span className="text-muted-foreground">{r.auteurNom || r.utilisateurNom || t("utilisations:decisions_section.default_response_author")} :</span> {r.message}
                            {r.documentUrl && <Badge className="ms-1 text-[10px]">{t("utilisations:decisions_section.doc_badge")}</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      {(role === "ENTREPRISE" || role === "AUTORITE_CONTRACTANTE") && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setRespondDecision(d); setRespondWithUpload(false); setResponseMsg(""); setResponseFile(null); setResponseFiles({}); }}>
                            {t("utilisations:decisions_section.respond")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRespondDecision(d); setRespondWithUpload(true); setResponseMsg(""); setResponseFile(null); setResponseFiles({}); }}>
                            <Upload className="h-3.5 w-3.5 me-1" /> {t("utilisations:decisions_section.upload_doc")}
                          </Button>
                        </>
                      )}
                      {d.role === role && (
                        <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => handleResolveRejet(d.id)}>
                          <CheckCircle2 className="h-4 w-4 me-1" /> {t("utilisations:decisions_section.mark_resolved")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {visaDecisions.map(d => (
                  <div key={d.id} className="p-2 rounded border text-sm border-emerald-300 bg-emerald-50/50">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-[10px]">{t("utilisations:decisions_section.visa_badge")}</Badge>
                      <span className="text-muted-foreground">{d.utilisateurNom || d.role}</span>
                      {d.dateDecision && <span className="text-xs text-muted-foreground">{formatDate(d.dateDecision)}</span>}
                    </div>
                    {d.motifRejet && <p className="text-muted-foreground mt-1">{d.motifRejet}</p>}
                  </div>
                ))}
                {resolvedRejets.map(d => (
                  <div key={d.id} className="p-2 rounded border text-sm border-muted bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{t("utilisations:decisions_section.rejet_temp_badge")}</Badge>
                      <span className="text-muted-foreground">{d.utilisateurNom || d.role}</span>
                      {d.dateDecision && <span className="text-xs text-muted-foreground">{formatDate(d.dateDecision)}</span>}
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-800">{t("utilisations:decisions_section.resolved_badge")}</Badge>
                    </div>
                    {d.motifRejet && <p className="text-muted-foreground mt-1">{d.motifRejet}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {(canDGDVerify || canDGDAnnoterEtViser || canDGTCPLiquider || canDGTCPVerifyTVA || canDGTCPValideTVA || canDGTCPApurer || canRejetTemp || canReject || canDGDReVerify || canDGTCPReVerifyTVA || canEntrepriseCheque || canDGTCPEnvoyerTresor || canDGTCPQuittances || canEntrepriseReception) && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("utilisations:detail.actions_section")}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {canDGDVerify && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:actions.prendre_en_charge")}</Button>}
                {canDGDReVerify && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:actions.re_verifier")}</Button>}
                {canDGDAnnoterEtViser && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                    const init: Record<number, AffectationTaxe> = {};
                    (u.lignes || []).forEach(l => {
                      // Pré-remplissage : proposition entreprise prioritaire (nouveau flux), sinon décision existante.
                      const pref = l.affectationEntreprise ?? l.affectation;
                      if (pref) init[l.id] = pref;
                    });
                    setLiqDecisions(init);
                    setShowLiq(true);
                  }}><Landmark className="h-4 w-4 me-2" /> {t("utilisations:actions.annoter_viser")}</Button>
                )}
                {canEntrepriseCheque && (
                  <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => {
                    setChequeForm({
                      banqueNom: u.banqueNom || "",
                      numeroCheque: u.numeroCheque || "",
                      montantCheque: u.montantCheque != null ? String(u.montantCheque) : (u.totalAPayer != null ? String(u.totalAPayer) : ""),
                      dateCheque: "",
                    });
                    setShowCheque(true);
                  }}><CreditCard className="h-4 w-4 me-2" /> {t("utilisations:actions.saisir_cheque")}</Button>
                )}
                {canDGTCPEnvoyerTresor && (
                  <Button className="bg-sky-600 hover:bg-sky-700" onClick={handleEnvoyerTresor} disabled={envoiLoading}>
                    {envoiLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                    <Ship className="h-4 w-4 me-2" /> {t("utilisations:actions.envoyer_tresor")}
                  </Button>
                )}
                {canDGTCPQuittances && (
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => {
                    setQuittancesForm(
                      (u.quittances && u.quittances.length > 0)
                        ? u.quittances.map(q => ({
                            numeroQuittance: q.numeroQuittance,
                            dateQuittance: q.dateQuittance ? q.dateQuittance.slice(0, 10) : "",
                            montant: q.montant,
                            referencePaiement: q.referencePaiement,
                          }))
                        : [{ numeroQuittance: "", dateQuittance: "", montant: u.totalAPayer || 0, referencePaiement: "" }]
                    );
                    setQuittancesFiles({});
                    setShowQuittances(true);
                  }}><FileText className="h-4 w-4 me-2" /> {u.quittances && u.quittances.length > 0 ? t("utilisations:actions.modifier_quittances") : t("utilisations:actions.saisir_quittances")}</Button>
                )}
                {canDGTCPVerifyTVA && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:actions.passer_verification")}</Button>}
                {canDGTCPReVerifyTVA && <Button onClick={() => handleStatut("EN_VERIFICATION")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:actions.re_verifier")}</Button>}
                {canDGTCPValideTVA && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatut("VALIDEE")} disabled={actionLoading}>{actionLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:actions.valider")}</Button>}
                {canDGTCPLiquider && <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleLiquidationDgtcp} disabled={liqLoading}>
                  {liqLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                  <Landmark className="h-4 w-4 me-2" /> {t("utilisations:actions.liquider_certificat")}
                </Button>}
                {canEntrepriseReception && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleClotureReception} disabled={receptionLoading}>
                    {receptionLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                    <CheckCircle2 className="h-4 w-4 me-2" /> {t("utilisations:actions.accuser_reception")}
                  </Button>
                )}
                {canDGTCPApurer && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setShowApur(true); setApurMontant(""); }}><CircleDollarSign className="h-4 w-4 me-2" /> {t("utilisations:actions.proceder_apurement")}</Button>}
                {canRejetTemp && <Button variant="outline" className="text-amber-600 border-amber-300" onClick={() => { setShowRejet(true); setRejetMotif(""); setRejetDocs([]); }}><AlertTriangle className="h-4 w-4 me-1" /> {t("utilisations:actions.rejet_temp")}</Button>}
                {canReject && <Button variant="destructive" onClick={() => handleStatut("REJETEE")} disabled={actionLoading}><XCircle className="h-4 w-4 me-2" /> {t("utilisations:actions.rejeter_definitivement")}</Button>}
              </div>
              {canDGTCPLiquider && (
                <p
                  className="text-xs text-muted-foreground mt-3"
                  dangerouslySetInnerHTML={{
                    __html: t("utilisations:detail.actions_hint_liquidation", {
                      hors_tva: fmtAmt((u.totalPrisEnCharge ?? 0) - (u.montantTVADouane ?? 0)),
                      tva: fmtAmt(u.montantTVADouane),
                    }),
                  }}
                />
              )}
              {role === "DGD" && isDouane && (u.lignes?.length || 0) === 0 && (
                <p className="text-xs text-amber-700 mt-3">{t("utilisations:detail.actions_no_lines_hint")}</p>
              )}
            </CardContent>
          </Card>
        )}

        <DiscussionCommissionPanel contexte="UTILISATION" dossierId={u.id} dossierStatut={u.statut as string} />
      </div>



      {/* Liquidation Dialog — visa DGD */}
      <Dialog open={showLiq} onOpenChange={setShowLiq}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("utilisations:visa_dgd.title", { id: u.id })}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("utilisations:visa_dgd.intro_prefix")}<strong>{t("utilisations:visa_dgd.intro_affectation")}</strong>{t("utilisations:visa_dgd.intro_middle")}
              <Badge variant="outline" className="mx-1">{t("utilisations:bulletin.affectation_au_ci")}</Badge>
              {t("utilisations:visa_dgd.intro_au_ci_note")}
              <Badge variant="outline" className="mx-1">{t("utilisations:bulletin.affectation_a_payer")}</Badge>
              {t("utilisations:visa_dgd.intro_a_payer_note")}
              <strong>{t("utilisations:visa_dgd.intro_zero")}</strong>
              {t("utilisations:visa_dgd.intro_suffix")}
            </p>
            {(!u.lignes || u.lignes.length === 0) ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                {t("utilisations:visa_dgd.no_lines")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">{t("utilisations:visa_dgd.col_code")}</TableHead>
                    <TableHead>{t("utilisations:visa_dgd.col_name")}</TableHead>
                    <TableHead className="text-end w-36">{t("utilisations:visa_dgd.col_value_saisie")}</TableHead>
                    <TableHead className="w-40">{t("utilisations:visa_dgd.col_proposition")}</TableHead>
                    <TableHead className="text-end w-36">{t("utilisations:visa_dgd.col_value_override")}</TableHead>
                    <TableHead className="w-48">{t("utilisations:visa_dgd.col_affectation")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {u.lignes.map((l: LigneBulletinDto) => {
                    const isZero = (Number(l.valeur) || 0) === 0;
                    const propose = l.affectationEntreprise ?? null;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.code}</TableCell>
                        <TableCell className="text-sm">{l.libelle}</TableCell>
                        <TableCell className="text-end font-medium">{fmtNum(l.valeur)}</TableCell>
                        <TableCell>
                          {isZero ? (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          ) : propose === "AU_CI" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">{t("utilisations:visa_dgd.proposition_au_ci")}</Badge>
                          ) : propose === "A_PAYER" ? (
                            <Badge className="bg-amber-100 text-amber-800 text-[10px]">{t("utilisations:visa_dgd.proposition_a_payer")}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">{t("utilisations:visa_dgd.proposition_none")}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 text-xs text-end"
                            placeholder={isZero ? t("utilisations:visa_dgd.override_placeholder_zero") : t("utilisations:visa_dgd.override_placeholder")}
                            disabled={isZero}
                            value={liqValeurs[l.id] ?? ""}
                            onChange={(e) => setLiqValeurs(prev => ({ ...prev, [l.id]: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={liqDecisions[l.id] || ""}
                            disabled={isZero}
                            onValueChange={(v) => setLiqDecisions(prev => ({ ...prev, [l.id]: v as AffectationTaxe }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder={isZero ? t("utilisations:visa_dgd.select_placeholder_zero") : t("utilisations:visa_dgd.select_placeholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AU_CI">{t("utilisations:visa_dgd.option_au_ci")}</SelectItem>
                              <SelectItem value="A_PAYER">{t("utilisations:visa_dgd.option_a_payer")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {u.lignes && u.lignes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">{t("utilisations:visa_dgd.upload.label")}</Label>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setLiqBulletinFile(e.target.files?.[0] || null)}
                />
                {liqBulletinFile && <p className="text-xs text-muted-foreground">{t("utilisations:visa_dgd.upload.file_prefix", { name: liqBulletinFile.name })}</p>}
              </div>
            )}
            {u.lignes && u.lignes.length > 0 && (() => {
              const effVal = (l: LigneBulletinDto) => {
                const raw = liqValeurs[l.id];
                const n = raw !== undefined && raw !== "" ? Number(raw) : NaN;
                return !isNaN(n) ? n : (Number(l.valeur) || 0);
              };
              const lignesAuCi = u.lignes.filter(l => liqDecisions[l.id] === "AU_CI");
              const lignesAPayer = u.lignes.filter(l => liqDecisions[l.id] === "A_PAYER");
              const totalAuCi = lignesAuCi.reduce((s, l) => s + effVal(l), 0);
              const totalAPayer = lignesAPayer.reduce((s, l) => s + effVal(l), 0);
              const restant = u.lignes.filter(l => (Number(l.valeur) || 0) > 0 && !liqDecisions[l.id]).length;
              const codesAPayer = lignesAPayer.map(l => l.code).join(" + ");
              const codesAuCi = lignesAuCi.map(l => l.code).join(" + ");
              const today = formatDate(new Date());
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">{t("utilisations:bulletin.a_payer_box")}</p>
                      <p className="text-2xl font-bold text-amber-800 mt-1">{fmtAmt(totalAPayer)}</p>
                    </div>
                    <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                      <p className="text-xs uppercase tracking-wide text-primary font-semibold">{t("utilisations:bulletin.au_ci_box")}</p>
                      <p className="text-2xl font-bold text-primary mt-1">{fmtAmt(totalAuCi)}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2 font-serif">
                    <p className="text-sm"><span className="font-semibold">{t("utilisations:bulletin.date_prefix", { date: today })}</span></p>
                    {totalAPayer > 0 && (
                      <p className="text-sm">
                        <span className="underline font-semibold">{t("utilisations:bulletin.a_payer_line")}</span> {codesAPayer && <>: {codesAPayer}</>} (<span className="font-semibold">{fmtAmt(totalAPayer)}</span>) — <em
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => setLettresAPayerLiq(e.currentTarget.textContent || "")}
                          className="outline-none border-b border-dashed border-muted-foreground/40 focus:border-primary cursor-text"
                          title={t("utilisations:bulletin.edit_letters_title")}
                        >{lettresAPayerLiq ?? numberToFrenchWords(totalAPayer)}</em>
                      </p>
                    )}
                    {totalAuCi > 0 && (
                      <p className="text-sm">
                        <span className="underline font-semibold">{t("utilisations:bulletin.au_ci_line")}</span> {codesAuCi && <>: {codesAuCi}</>} (<span className="font-semibold">{fmtAmt(totalAuCi)}</span>) — <em
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => setLettresAuCiLiq(e.currentTarget.textContent || "")}
                          className="outline-none border-b border-dashed border-muted-foreground/40 focus:border-primary cursor-text"
                          title={t("utilisations:bulletin.edit_letters_title")}
                        >{lettresAuCiLiq ?? numberToFrenchWords(totalAuCi)}</em>
                      </p>
                    )}
                  </div>
                  {restant > 0 && <div className="text-amber-700 text-xs">{t("utilisations:visa_dgd.lines_pending", { count: restant })}</div>}
                </div>
              );
            })()}
            <DialogFooter>
              <div className="flex flex-col items-start gap-2 w-full">
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 w-full">
                  <AlertTriangle className="h-3.5 w-3.5 inline me-1" />
                  Attention : le visa est une action irréversible.
                </p>
                <div className="flex gap-2 justify-end w-full">
                  <Button variant="outline" onClick={() => setShowLiq(false)}>{t("utilisations:visa_dgd.cancel")}</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={liqLoading || !u.lignes || u.lignes.length === 0 || u.lignes.some(l => (Number(l.valeur) || 0) > 0 && !liqDecisions[l.id])} onClick={handleVisaDgd}>
                    {liqLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:visa_dgd.confirm")}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chèque Dialog */}
      <Dialog open={showCheque} onOpenChange={setShowCheque}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-indigo-500" /> {t("utilisations:cheque_dialog.title", { id: u.id })}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {u.totalAPayer != null
                ? t("utilisations:cheque_dialog.intro_with_amount", { montant: fmtAmt(u.totalAPayer) })
                : t("utilisations:cheque_dialog.intro_no_amount")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>{t("utilisations:cheque_dialog.banque_label")} *</Label><Input value={chequeForm.banqueNom} onChange={e => setChequeForm(p => ({ ...p, banqueNom: e.target.value }))} placeholder={t("utilisations:cheque_dialog.banque_placeholder")} /></div>
              <div><Label>{t("utilisations:cheque_dialog.numero_label")} *</Label><Input value={chequeForm.numeroCheque} onChange={e => setChequeForm(p => ({ ...p, numeroCheque: e.target.value }))} placeholder={t("utilisations:cheque_dialog.numero_placeholder")} /></div>
              <div><Label>{t("utilisations:cheque_dialog.montant_label")} *</Label><Input type="number" min="0" step="0.01" value={chequeForm.montantCheque} onChange={e => setChequeForm(p => ({ ...p, montantCheque: e.target.value }))} /></div>
              <div className="col-span-2"><Label>{t("utilisations:cheque_dialog.date_label")}</Label><Input type="date" value={chequeForm.dateCheque} onChange={e => setChequeForm(p => ({ ...p, dateCheque: e.target.value }))} /></div>
              <div className="col-span-2">
                <Label>{t("utilisations:cheque_dialog.upload.label")} * <span className="text-xs text-muted-foreground">{t("utilisations:cheque_dialog.upload.hint")}</span></Label>
                <Input type="file" accept="application/pdf,image/*" onChange={e => setChequeFile(e.target.files?.[0] || null)} />
                {chequeFile && <p className="text-xs text-muted-foreground mt-1">{t("utilisations:cheque_dialog.upload.size", { name: chequeFile.name, size: (chequeFile.size / 1024).toFixed(1) })}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCheque(false); setChequeFile(null); }}>{t("utilisations:cheque_dialog.cancel")}</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={chequeLoading || !chequeForm.banqueNom.trim() || !chequeForm.numeroCheque.trim() || !chequeForm.montantCheque || !chequeFile} onClick={handleSaisirCheque}>
              {chequeLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:cheque_dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quittances Dialog */}
      <Dialog open={showQuittances} onOpenChange={setShowQuittances}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-teal-500" /> {t("utilisations:quittances_dialog.title", { id: u.id })}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("utilisations:quittances_dialog.intro")}
              {u.totalAPayer != null && <> {t("utilisations:quittances_dialog.intro_expected", { montant: fmtAmt(u.totalAPayer) })}</>}
            </p>
            {quittancesForm.map((q, idx) => (
              <div key={idx} className="space-y-2 p-2 rounded border">
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3"><Label className="text-xs">{t("utilisations:quittances_dialog.col_numero")} *</Label><Input value={q.numeroQuittance} onChange={e => setQuittancesForm(arr => arr.map((x, i) => i === idx ? { ...x, numeroQuittance: e.target.value } : x))} /></div>
                  <div className="col-span-3"><Label className="text-xs">{t("utilisations:quittances_dialog.col_date")} *</Label><Input type="date" value={q.dateQuittance} onChange={e => setQuittancesForm(arr => arr.map((x, i) => i === idx ? { ...x, dateQuittance: e.target.value } : x))} /></div>
                  <div className="col-span-2"><Label className="text-xs">{t("utilisations:quittances_dialog.col_montant")} *</Label><Input type="number" min="0" step="0.01" value={q.montant} onChange={e => setQuittancesForm(arr => arr.map((x, i) => i === idx ? { ...x, montant: Number(e.target.value) } : x))} /></div>
                  <div className="col-span-3"><Label className="text-xs">{t("utilisations:quittances_dialog.col_reference")}</Label><Input value={q.referencePaiement || ""} onChange={e => setQuittancesForm(arr => arr.map((x, i) => i === idx ? { ...x, referencePaiement: e.target.value } : x))} /></div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setQuittancesForm(arr => arr.filter((_, i) => i !== idx));
                      setQuittancesFiles(prev => {
                        const next: Record<number, File | null> = {};
                        Object.entries(prev).forEach(([k, v]) => {
                          const ki = Number(k);
                          if (ki < idx) next[ki] = v;
                          else if (ki > idx) next[ki - 1] = v;
                        });
                        return next;
                      });
                    }} disabled={quittancesForm.length <= 1}>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12">
                    <Label className="text-xs">{t("utilisations:quittances_dialog.upload.label")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={e => setQuittancesFiles(prev => ({ ...prev, [idx]: e.target.files?.[0] || null }))}
                        className="text-xs"
                      />
                      {quittancesFiles[idx] && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{quittancesFiles[idx]!.name}</span>
                      )}
                      {!quittancesFiles[idx] && q.documentNomFichier && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{t("utilisations:quittances_dialog.upload.current", { name: q.documentNomFichier })}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <Button size="sm" variant="outline" onClick={() => setQuittancesForm(arr => [...arr, { numeroQuittance: "", dateQuittance: "", montant: 0, referencePaiement: "" }])}>
                {t("utilisations:quittances_dialog.add")}
              </Button>
              <p className="text-sm">{t("utilisations:quittances_dialog.total")} <span className="font-bold">{fmtAmt(quittancesForm.reduce((s, q) => s + Number(q.montant || 0), 0))}</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuittances(false)}>{t("utilisations:quittances_dialog.cancel")}</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" disabled={quittancesLoading || quittancesForm.every(q => !q.numeroQuittance.trim() || !q.dateQuittance || !(Number(q.montant) > 0))} onClick={handleSaisirQuittances}>
              {quittancesLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:quittances_dialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apurement Dialog */}
      <Dialog open={showApur} onOpenChange={setShowApur}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("utilisations:apurement_dialog.title", { id: u.id })}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("utilisations:apurement_dialog.intro")}</p>
            {tvaStock.length > 0 && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                <p className="font-semibold text-blue-800 mb-1">{t("utilisations:apurement_dialog.stock_title", { total: fmtAmt(totalStockDisponible) })}</p>
                <div className="text-xs text-blue-600 space-y-0.5">
                  {tvaStock.filter(x => !x.epuise).map(x => (
                    <div key={x.id}>{x.numeroDeclaration || t("utilisations:stock_tva.util_fallback", { id: x.utilisationDouaneId })} : {fmtAmt(x.montantRestant)}</div>
                  ))}
                </div>
              </div>
            )}
            <div className="p-3 rounded-lg bg-muted text-sm">
              <div className="flex justify-between"><span>{t("utilisations:apurement_dialog.tva_collectee_label")}</span><span className="font-semibold">{fmtAmt(u.montantTVAInterieure)}</span></div>
            </div>
            <div>
              <Label>{t("utilisations:apurement_dialog.tva_ded_label")} *</Label>
              <Input type="number" min="0" value={apurMontant} onChange={e => setApurMontant(e.target.value)} />
            </div>
            {apurMontant && u.montantTVAInterieure != null && (() => {
              const tvaNette = u.montantTVAInterieure - Number(apurMontant);
              return (
                <div className="p-3 rounded-lg border space-y-1 text-sm">
                  <div className="flex justify-between"><span>{t("utilisations:apurement_dialog.tva_collectee_short")}</span><span>{fmtAmt(u.montantTVAInterieure)}</span></div>
                  <div className="flex justify-between"><span>{t("utilisations:apurement_dialog.tva_ded_short")}</span><span>- {fmtAmt(Number(apurMontant))}</span></div>
                  <div className="border-t pt-1 flex justify-between font-bold">
                    <span>{t("utilisations:apurement_dialog.tva_nette_short")}</span>
                    <span className={tvaNette > 0 ? "text-destructive" : tvaNette < 0 ? "text-emerald-600" : ""}>{fmtAmt(tvaNette)}</span>
                  </div>
                  {tvaNette === 0 && <p className="text-xs text-muted-foreground mt-1">{t("utilisations:apurement_dialog.cas1_short")}</p>}
                  {tvaNette > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      {cert && (cert.soldeTVA ?? 0) < tvaNette
                        ? t("utilisations:apurement_dialog.cas2_with_cash", { montant: fmtAmt(tvaNette - (cert.soldeTVA ?? 0)) })
                        : t("utilisations:apurement_dialog.cas2_short")}
                    </p>
                  )}
                  {tvaNette < 0 && <p className="text-xs text-emerald-600 mt-1">{t("utilisations:apurement_dialog.cas3_short", { montant: fmtAmt(Math.abs(tvaNette)) })}</p>}
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApur(false)}>{t("utilisations:apurement_dialog.cancel")}</Button>
              <Button disabled={apurLoading || !apurMontant || Number(apurMontant) < 0} onClick={handleApurement}>
                {apurLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:apurement_dialog.confirm")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejet Temp Dialog */}
      <Dialog open={showRejet} onOpenChange={setShowRejet}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> {t("utilisations:rejet_temp_dialog.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("utilisations:rejet_temp_dialog.motif_label")} *</Label>
              <Textarea placeholder={t("utilisations:rejet_temp_dialog.motif_placeholder")} value={rejetMotif} onChange={e => setRejetMotif(e.target.value)} className="min-h-[80px]" />
            </div>
            <div>
              <Label>{t("utilisations:rejet_temp_dialog.docs_label")} *</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto mt-2">
                {(isDouane ? UTILISATION_DOC_TYPES_DOUANE : tvaDocTypes).map(dt => (
                  <label key={dt} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={rejetDocs.includes(dt)} onCheckedChange={checked => setRejetDocs(prev => checked ? [...prev, dt] : prev.filter(d => d !== dt))} />
                    <span className="text-sm">{tTypeDocument(dt)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejet(false)}>{t("utilisations:rejet_temp_dialog.cancel")}</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" disabled={rejetLoading || !rejetMotif.trim() || rejetDocs.length === 0} onClick={handleRejetTemp}>
              {rejetLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:rejet_temp_dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("utilisations:upload_dialog.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={docType} onValueChange={v => setDocType(v as TypeDocumentUtilisation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(isDouane ? UTILISATION_DOC_TYPES_DOUANE : tvaDocTypes).map(tp => (
                  <SelectItem key={tp} value={tp}>{tTypeDocument(tp)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="file" onChange={e => setDocFile(e.target.files?.[0] || null)} />
            <Button onClick={handleUpload} disabled={uploading || !docFile} className="w-full">
              {uploading && <Loader2 className="h-4 w-4 animate-spin me-2" />} {t("utilisations:upload_dialog.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Respond to rejet */}
      <Dialog open={respondDecision !== null} onOpenChange={() => { setRespondDecision(null); setRespondWithUpload(false); setResponseFile(null); setResponseFiles({}); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{respondWithUpload ? t("utilisations:respond_dialog.title_upload") : t("utilisations:respond_dialog.title_message")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder={t("utilisations:respond_dialog.message_placeholder")} value={responseMsg} onChange={e => setResponseMsg(e.target.value)} />
            {respondWithUpload && respondDecision?.documentsDemandes && respondDecision.documentsDemandes.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("utilisations:respond_dialog.documents_demandes", { count: respondDecision.documentsDemandes.length })}</Label>
                {respondDecision.documentsDemandes.map(dt => {
                  const docLabel = tTypeDocument(dt) || dt.replace(/_/g, " ");
                  const file = responseFiles[dt];
                  return (
                    <div key={dt} className="p-3 rounded-lg border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{docLabel}</span>
                        {file && <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">{t("utilisations:respond_dialog.selected")}</Badge>}
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
                <Label className="text-sm">{t("utilisations:respond_dialog.joindre_optional")}</Label>
                <Input type="file" className="mt-1" onChange={e => setResponseFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" />
                {responseFile && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {responseFile.name}
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRespondDecision(null); setRespondWithUpload(false); setResponseFile(null); setResponseFiles({}); }}>{t("utilisations:respond_dialog.cancel")}</Button>
              <Button
                disabled={responding || (!responseMsg.trim() && !responseFile && Object.keys(responseFiles).length === 0) || (respondWithUpload && respondDecision?.documentsDemandes?.length ? Object.keys(responseFiles).length === 0 : false)}
                onClick={handleRespondRejet}
              >
                {responding && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                {respondWithUpload && Object.keys(responseFiles).length > 1 ? t("utilisations:respond_dialog.send_n", { count: Object.keys(responseFiles).length }) : t("utilisations:respond_dialog.send")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UtilisationDetail;
