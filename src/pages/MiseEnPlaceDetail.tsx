import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  certificatCreditApi, CertificatCreditDto, CertificatStatut,
  demandeCorrectionApi, DemandeCorrectionDto,
  DocumentDto, entrepriseApi, EntrepriseDto, marcheApi, MarcheDto,
  conventionApi, ConventionDto,
  DecisionCorrectionDto,
  documentRequirementApi,
  autoriteContractanteApi,
  type AutoriteContractanteDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UploadRow } from "@/components/ui/upload-row";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Award, ArrowLeft, Loader2, FileText, CheckCircle, XCircle, ShieldCheck,
  AlertTriangle, History, Wallet, Upload, MessageSquare, Send, Download,
} from "lucide-react";
import { generateCertificatToSignPdf } from "@/lib/certificatSignaturePdf";

import { API_BASE } from "@/lib/apiConfig";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutCertificat, tTypeDocument } from "@/i18n/enums";
import { formatDate, formatAmount, formatNumber } from "@/i18n/format";
import { displayRef } from "@/lib/displayRef";
import { requiredVisasCertificat, isRoleExcluded } from "@/lib/visas";

// Couleurs de badge par statut — décoratives, conservées en dur (cohérence UI cross-module).
const STATUT_COLORS: Record<CertificatStatut, string> = {
  BROUILLON: "bg-slate-100 text-slate-700",
  ENVOYEE: "bg-sky-100 text-sky-800",
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_CONTROLE: "bg-teal-100 text-teal-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION_DGI: "bg-indigo-100 text-indigo-800",
  EN_VALIDATION_PRESIDENT: "bg-purple-100 text-purple-800",
  VALIDE_PRESIDENT: "bg-violet-100 text-violet-800",
  EN_OUVERTURE_DGTCP: "bg-yellow-100 text-yellow-800",
  OUVERT: "bg-emerald-100 text-emerald-800",
  MODIFIE: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

// Fallback si l'API de paramétrage GED est indisponible — codes connus pour MISE_EN_PLACE_CI.
const DOC_TYPES_FALLBACK = [
  "LETTRE_SAISINE",
  "CONTRAT",
  "LETTRE_NOTIFICATION_CONTRAT",
  "CERTIFICAT_NIF",
  "LETTRE_CORRECTION",
  "CERTIFICAT_CREDIT_IMPOTS",
];

const DECISION_ROLES_LIST = ["DGI", "DGD", "DGTCP", "PRESIDENT"];

function getDocFileUrl(doc: DocumentDto): string {
  if (!doc.chemin) return "#";
  if (doc.chemin.startsWith("http")) return doc.chemin;
  return `${API_BASE}/documents/download/${doc.id}`;
}

const MiseEnPlaceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation(["mise_en_place", "common", "enums"]);

  const [certificat, setCertificat] = useState<CertificatCreditDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [activeOrg, setActiveOrg] = useState("DGI");

  const [entreprise, setEntreprise] = useState<EntrepriseDto | null>(null);
  const [correction, setCorrection] = useState<DemandeCorrectionDto | null>(null);
  const [marche, setMarche] = useState<MarcheDto | null>(null);
  const [convention, setConvention] = useState<ConventionDto | null>(null);
  const [autorite, setAutorite] = useState<AutoriteContractanteDto | null>(null);

  const [visaLoading, setVisaLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);

  const [showRejetTemp, setShowRejetTemp] = useState(false);
  const [rejetTempMotif, setRejetTempMotif] = useState("");
  const [rejetTempDocs, setRejetTempDocs] = useState<string[]>([]);
  const [docTypesDemandables, setDocTypesDemandables] = useState<string[]>(DOC_TYPES_FALLBACK);
  const [rejetTempLoading, setRejetTempLoading] = useState(false);

  const [showMontants, setShowMontants] = useState(false);
  const [montantCordon, setMontantCordon] = useState("");
  const [montantTVAInt, setMontantTVAInt] = useState("");
  const [recapA, setRecapA] = useState("");
  const [recapB, setRecapB] = useState("");
  const [recapC, setRecapC] = useState("");
  const [recapD, setRecapD] = useState("");
  const [recapG, setRecapG] = useState("");
  const [savingMontants, setSavingMontants] = useState(false);

  const [showReject, setShowReject] = useState(false);
  const [motifRejet, setMotifRejet] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [responseDecisionId, setResponseDecisionId] = useState<number | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [respondingLoading, setRespondingLoading] = useState(false);

  // Compléments AC/Entreprise (upload GED en réponse aux rejets ouverts)
  const [complementFiles, setComplementFiles] = useState<Record<string, File | null>>({});
  const [complementMessages, setComplementMessages] = useState<Record<string, string>>({});
  const [complementLoading, setComplementLoading] = useState<Record<string, boolean>>({});

  const [showAnnulation, setShowAnnulation] = useState(false);
  const [visaConfirmOpen, setVisaConfirmOpen] = useState(false);

  const okToast = (description: string) =>
    toast({ title: t("common:states.success"), description });
  const errToast = (description: string) =>
    toast({ title: t("common:states.error"), description, variant: "destructive" });

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const cert = await certificatCreditApi.getById(Number(id));
      setCertificat(cert);

      const [certDocsRes, decisionsRes, demandeDocsRes, marcheDocsRes] = await Promise.all([
        certificatCreditApi.getDocuments(cert.id).catch(() => [] as DocumentDto[]),
        certificatCreditApi.getDecisions(cert.id).catch(() => []),
        cert.demandeCorrectionId ? demandeCorrectionApi.getDocuments(cert.demandeCorrectionId).catch(() => [] as DocumentDto[]) : Promise.resolve([] as DocumentDto[]),
        cert.marcheId ? marcheApi.getDocuments(cert.marcheId).catch(() => [] as DocumentDto[]) : Promise.resolve([] as DocumentDto[]),
      ]);
      const tagged: DocumentDto[] = [
        ...certDocsRes.map((d) => ({ ...d, _source: "certificat" } as any)),
        ...demandeDocsRes.map((d) => ({ ...d, _source: "correction" } as any)),
        ...marcheDocsRes.map((d) => ({ ...d, _source: "marche" } as any)),
      ];
      setDocs(tagged);
      setDecisions(decisionsRes);

      const promises: Promise<any>[] = [];
      if (cert.entrepriseId) promises.push(entrepriseApi.getById(cert.entrepriseId).then(setEntreprise).catch(() => {}));
      if (cert.demandeCorrectionId) promises.push(demandeCorrectionApi.getById(cert.demandeCorrectionId).then(setCorrection).catch(() => {}));
      if (cert.marcheId) {
        promises.push(
          marcheApi.getById(cert.marcheId)
            .then(async (m) => {
              setMarche(m);
              if (m?.conventionId) {
                try {
                  const conv = await conventionApi.getById(m.conventionId);
                  setConvention(conv);
                  if (conv?.autoriteContractanteId) {
                    autoriteContractanteApi.getById(conv.autoriteContractanteId).then(setAutorite).catch(() => {});
                  }
                } catch { /* ignore */ }
              }
            })
            .catch(() => {})
        );
      }
      await Promise.all(promises);
    } catch {
      errToast(t("mise_en_place:detail.load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI")
      .then((reqs) => {
        const codes = Array.from(new Set(
          (reqs || [])
            .map(r => r.codeDocument || r.typeDocument || "")
            .filter(Boolean)
        ));
        if (codes.length > 0) setDocTypesDemandables(codes);
      })
      .catch(() => { /* fallback déjà en place */ });
  }, []);

  usePageTitle("mise_en_place:detail.title", { ref: certificat?.reference || (id ? `#${id}` : "") });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  if (!certificat) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t("mise_en_place:detail.not_found")}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/mise-en-place")}>
            <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t("mise_en_place:detail.back")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const c = certificat;
  const entrepriseName = c.entrepriseNom || entreprise?.raisonSociale || "—";
  const correctionRef = (correction ? displayRef(correction) : c.demandeCorrectionNumero || "—");
  const marcheRef = c.marcheIntitule || marche?.numeroMarche || "—";
  // Devise affichée pour les montants — celle du marché si dispo, sinon MRU.
  const currency = (marche as any)?.deviseOrigine || "MRU";

  const myRoleDecs = decisions.filter(d => d.role === (role as string));
  const myHasVisa = myRoleDecs.some(d => d.decision === "VISA");
  const myOpenRejets = myRoleDecs.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT");
  const myHasOpenRejet = myOpenRejets.length > 0;

  // Routing dynamique des visas : les crédits proviennent de la demande de correction liée.
  const requiredVisas = requiredVisasCertificat(correction);
  const dgdRequired = requiredVisas.includes("DGD");
  const dgiRequired = requiredVisas.includes("DGI");
  const visibleDecisionRoles = DECISION_ROLES_LIST.filter(r => r === "PRESIDENT" || requiredVisas.includes(r as any));
  const roleExcluded = isRoleExcluded(role as string, correction);

  const isControlRole = ["DGI", "DGD", "DGTCP"].includes(role as string) && !roleExcluded;
  const isDecisionRole = ["DGI", "DGTCP", "DGD", "PRESIDENT"].includes(role as string) && !roleExcluded;
  const isACOrEntreprise = role === "AUTORITE_CONTRACTANTE" || role === "ENTREPRISE";
  const isClosed = ["OUVERT", "ANNULE", "CLOTURE"].includes(c.statut);

  const isInControle = c.statut === "EN_CONTROLE" || c.statut === "INCOMPLETE" || c.statut === "A_RECONTROLER";
  const canDoVisa = isControlRole && isInControle && !myHasVisa && !myHasOpenRejet;
  const canDoRejetTemp = isControlRole && isInControle && !myHasVisa;

  const canMontants = role === "DGTCP" && isInControle && c.montantCordon == null;
  const dgtcpMontantsRequired = role === "DGTCP" && isInControle && c.montantCordon == null;

  const canAnnuler = hasPermission("mise_en_place.annuler") && !["OUVERT", "CLOTURE", "ANNULE"].includes(c.statut);

  const hasCertDoc = docs.some(d => d.type === "CERTIFICAT_CREDIT_IMPOTS");

  const handleStatut = async (statut: CertificatStatut) => {
    setActionLoading(true);
    try {
      await certificatCreditApi.updateStatut(c.id, statut);
      okToast(t("mise_en_place:toast.statut_changed", { statut: tStatutCertificat(statut) }));
      if (statut === "ANNULE") navigate("/dashboard/mise-en-place");
      else fetchData();
    } catch (e: any) {
      errToast(e.message);
    } finally { setActionLoading(false); }
  };

  const handleVisa = async () => {
    setVisaLoading(true);
    try {
      await certificatCreditApi.postDecision(c.id, "VISA");
      okToast(t("mise_en_place:toast.visa_apposed"));
      fetchData();
    } catch (e: any) {
      errToast(e.message);
      fetchData();
    } finally { setVisaLoading(false); }
  };

  const confirmVisa = () => {
    setVisaConfirmOpen(false);
    handleVisa();
  };

  const handleRejetTemp = async () => {
    if (!rejetTempMotif.trim() || rejetTempDocs.length === 0) return;
    setRejetTempLoading(true);
    try {
      await certificatCreditApi.postDecision(c.id, "REJET_TEMP", rejetTempMotif.trim(), rejetTempDocs);
      okToast(t("mise_en_place:toast.rejet_temp_sent_short"));
      setShowRejetTemp(false);
      setRejetTempMotif("");
      setRejetTempDocs([]);
      fetchData();
    } catch (e: any) {
      errToast(e.message);
      fetchData();
    } finally { setRejetTempLoading(false); }
  };

  const handleResolve = async (decisionId: number) => {
    setActionLoading(true);
    try {
      await certificatCreditApi.resolveRejetTemp(decisionId);
      okToast(t("mise_en_place:toast.rejet_resolved_can_visa"));
      fetchData();
    } catch (e: any) {
      errToast(e.message);
    } finally { setActionLoading(false); }
  };

  const handleResponse = async () => {
    if (!responseDecisionId || !responseMessage.trim()) return;
    setRespondingLoading(true);
    try {
      await certificatCreditApi.postRejetTempResponse(responseDecisionId, responseMessage.trim());
      okToast(t("mise_en_place:toast.response_sent"));
      setResponseDecisionId(null);
      setResponseMessage("");
      fetchData();
    } catch (e: any) {
      errToast(e.message);
    } finally { setRespondingLoading(false); }
  };

  const handleUploadComplement = async (codeDoc: string) => {
    const file = complementFiles[codeDoc];
    const msg = (complementMessages[codeDoc] || "").trim();
    if (!file || !msg) return;
    setComplementLoading(prev => ({ ...prev, [codeDoc]: true }));
    try {
      await certificatCreditApi.uploadDocument(c.id, codeDoc, file, msg);
      okToast(t("mise_en_place:toast.complement_uploaded", { defaultValue: "Complément déposé" }));
      setComplementFiles(prev => ({ ...prev, [codeDoc]: null }));
      setComplementMessages(prev => ({ ...prev, [codeDoc]: "" }));
      fetchData();
    } catch (e: any) {
      errToast(e.message);
    } finally {
      setComplementLoading(prev => ({ ...prev, [codeDoc]: false }));
    }
  };



  const handleReject = async () => {
    if (!motifRejet.trim()) return;
    setRejecting(true);
    try {
      await certificatCreditApi.reject(c.id, motifRejet.trim());
      okToast(t("mise_en_place:toast.rejected"));
      setShowReject(false);
      setMotifRejet("");
      fetchData();
    } catch (e: any) {
      errToast(e.message);
    } finally { setRejecting(false); }
  };

  const handleUploadAndValidate = async () => {
    if (!certFile && !hasCertDoc) return;
    setUploadingCert(true);
    try {
      if (certFile) {
        await certificatCreditApi.uploadDocument(c.id, "CERTIFICAT_CREDIT_IMPOTS", certFile);
      }
      await certificatCreditApi.updateStatut(c.id, "OUVERT");
      okToast(t("mise_en_place:toast.cert_uploaded_opened"));
      setCertFile(null);
      fetchData();
    } catch (e: any) {
      errToast(e.message);
    } finally { setUploadingCert(false); }
  };

  // ====== Tab d'organisme actif (les organismes exclus ne sont pas affichés) ======
  const r = visibleDecisionRoles.includes(activeOrg) ? activeOrg : (visibleDecisionRoles[0] || activeOrg);
  const roleDecs = decisions.filter(d => d.role === r);
  const allRejets = roleDecs.filter(d => d.decision === "REJET_TEMP");
  const openRejets = allRejets.filter(d => d.rejetTempStatus !== "RESOLU");
  const resolvedRejets = allRejets.filter(d => d.rejetTempStatus === "RESOLU");
  const tabHasVisa = roleDecs.some(d => d.decision === "VISA");
  const tabHasRejets = allRejets.length > 0;
  const tabAllResolved = tabHasRejets && openRejets.length === 0 && resolvedRejets.length > 0;
  const isMyTab = (role as string) === r;

  const isControlTab = ["DGI", "DGD", "DGTCP"].includes(r);
  const tabCanVisa = isMyTab && isControlTab && isInControle && !tabHasVisa && !openRejets.length && !(r === "DGTCP" && c.montantCordon == null);
  const tabCanRejetTemp = isMyTab && isControlTab && isInControle && !tabHasVisa;

  const presidentValidated = r === "PRESIDENT" && ["OUVERT", "CLOTURE"].includes(c.statut);
  const cardStyle = (tabHasVisa || presidentValidated)
    ? "border-green-300 bg-green-50"
    : tabAllResolved
    ? "border-emerald-300 bg-emerald-50"
    : tabHasRejets
    ? "border-red-300 bg-red-50"
    : "border-border bg-muted/30";

  const fmtAmt = (n: number | null | undefined) => formatAmount(n, { currency });
  const fmtRaw = (n: number | null | undefined) => (n == null ? "—" : formatNumber(n));

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/mise-en-place")}>
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Award className="h-6 w-6 text-primary" />
                {role === "AUTORITE_CONTRACTANTE"
                  ? t("mise_en_place:detail.header_view", { ref: c.reference || `#${c.id}` })
                  : t("mise_en_place:detail.header_process", { ref: c.reference || `#${c.id}` })}
              </h1>
              <p className="text-muted-foreground text-sm">
                {role === "AUTORITE_CONTRACTANTE" ? t("mise_en_place:detail.header_subtitle_view") : t("mise_en_place:detail.header_subtitle_process")}
              </p>
            </div>
          </div>
          <Badge className={`text-sm px-3 py-1 ${STATUT_COLORS[c.statut]}`}>
            {tStatutCertificat(c.statut)}
          </Badge>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("mise_en_place:detail.info.entreprise")}</p>
              <p className="font-semibold">{entrepriseName}</p>
              {entreprise?.nif && <p className="text-xs text-muted-foreground">{t("mise_en_place:detail.info.nif")}: {entreprise.nif}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("mise_en_place:detail.info.correction")}</p>
              <p className="font-semibold">{correctionRef}</p>
              {correction?.statut && <p className="text-xs text-muted-foreground">{t("mise_en_place:detail.info.correction_statut")}: {correction.statut}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("mise_en_place:detail.info.marche")}</p>
              <p className="font-semibold">{marcheRef}</p>
              {c.dateCreation && <p className="text-xs text-muted-foreground">{t("mise_en_place:detail.info.created_on")}: {formatDate(c.dateCreation)}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Montants section */}
        {(c.montantCordon != null || c.montantTVAInterieure != null) && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Wallet className="h-4 w-4" /> {t("mise_en_place:detail.montants.title")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">{t("mise_en_place:detail.montants.cordon")}</span><p className="font-bold">{fmtAmt(c.montantCordon)}</p></div>
                <div><span className="text-muted-foreground">{t("mise_en_place:detail.montants.tva_interieure")}</span><p className="font-bold">{fmtAmt(c.montantTVAInterieure)}</p></div>
                <div><span className="text-muted-foreground">{t("mise_en_place:detail.montants.solde_cordon")}</span><p className="font-bold">{fmtAmt(c.soldeCordon)}<br/><span className="text-[10px] font-normal text-muted-foreground">{t("mise_en_place:detail.montants.solde_cordon_extra", { tva: fmtAmt(c.tvaImportationDouane ?? 0), total: fmtAmt((c.soldeCordon ?? 0) + (c.tvaImportationDouane ?? 0)) })}</span></p></div>
                <div><span className="text-muted-foreground">{t("mise_en_place:detail.montants.solde_tva")}</span><p className="font-bold">{fmtAmt(c.soldeTVA)}</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Récapitulatif fiscal */}
        {(c.valeurDouaneFournitures != null || c.droitsEtTaxesDouaneHorsTva != null || c.tvaImportationDouane != null
          || c.montantMarcheHt != null || c.tvaCollecteeTravaux != null
          || c.creditExterieurRecap != null || c.creditInterieurNetRecap != null || c.totalCreditImpotRecap != null) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" /> {t("mise_en_place:detail.recap.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-start">{t("mise_en_place:detail.recap.col_ref")}</TableHead>
                    <TableHead className="text-start">{t("mise_en_place:detail.recap.col_label")}</TableHead>
                    <TableHead className="text-end">{t("mise_en_place:detail.recap.col_amount", { currency })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell className="font-mono">a</TableCell><TableCell>{t("mise_en_place:detail.recap.a")}</TableCell><TableCell className="text-end">{fmtRaw(c.valeurDouaneFournitures)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-mono">b</TableCell><TableCell>{t("mise_en_place:detail.recap.b")}</TableCell><TableCell className="text-end">{fmtRaw(c.droitsEtTaxesDouaneHorsTva)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-mono">d</TableCell><TableCell>{t("mise_en_place:detail.recap.d")}</TableCell><TableCell className="text-end">{fmtRaw(c.tvaImportationDouaneAccordee ?? c.tvaImportationDouane)}</TableCell></TableRow>
                  {c.tvaImportationDouaneAccordee != null && c.tvaImportationDouane != null && c.tvaImportationDouane !== c.tvaImportationDouaneAccordee && (
                    <TableRow><TableCell className="font-mono text-muted-foreground">d′</TableCell><TableCell className="text-muted-foreground">{t("mise_en_place:detail.recap.d_prime")}</TableCell><TableCell className="text-end text-muted-foreground">{fmtRaw(c.tvaImportationDouane)}</TableCell></TableRow>
                  )}
                  <TableRow className="bg-muted/40"><TableCell className="font-mono font-bold">e</TableCell><TableCell className="font-semibold">{t("mise_en_place:detail.recap.e")}</TableCell><TableCell className="text-end font-bold">{fmtRaw(c.creditExterieurRecap)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-mono">f</TableCell><TableCell>{t("mise_en_place:detail.recap.f")}</TableCell><TableCell className="text-end">{fmtRaw(c.montantMarcheHt)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-mono">g</TableCell><TableCell>{t("mise_en_place:detail.recap.g")}</TableCell><TableCell className="text-end">{fmtRaw(c.tvaCollecteeTravaux)}</TableCell></TableRow>
                  <TableRow className="bg-muted/40"><TableCell className="font-mono font-bold">h</TableCell><TableCell className="font-semibold">{t("mise_en_place:detail.recap.h")}</TableCell><TableCell className="text-end font-bold">{fmtRaw(c.creditInterieurNetRecap)}</TableCell></TableRow>
                  <TableRow className="bg-primary/5"><TableCell className="font-mono font-bold">Σ</TableCell><TableCell className="font-bold text-primary">{t("mise_en_place:detail.recap.total")}</TableCell><TableCell className="text-end font-bold text-primary">{fmtRaw(c.totalCreditImpotRecap)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Actions bar */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">{t("mise_en_place:detail.actions_block.title")}</h3>
            <div className="flex flex-wrap gap-2">
              {c.statut === "ENVOYEE" && isControlRole && (
                <Button variant="default" disabled={actionLoading} onClick={async () => {
                  setActionLoading(true);
                  try {
                    await certificatCreditApi.prendreEnCharge(c.id);
                    okToast(t("mise_en_place:toast.taken_charge"));
                    fetchData();
                  } catch (e: any) {
                    errToast(e.message);
                  } finally { setActionLoading(false); }
                }}>
                  {actionLoading ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <CheckCircle className="h-4 w-4 me-1" />}
                  {t("mise_en_place:actions.take_charge")}
                </Button>
              )}
              {isControlRole && isInControle && myHasVisa && (
                <div className="w-full flex items-center gap-2 p-2 rounded bg-green-50 border border-green-200 text-green-800 text-sm mb-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>{t("mise_en_place:detail.actions_block.already_visa")}</span>
                </div>
              )}
              {isControlRole && isInControle && myHasOpenRejet && (
                <div className="w-full flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{t("mise_en_place:detail.actions_block.open_rejet_blocking")}</span>
                </div>
              )}
              {dgtcpMontantsRequired && !myHasVisa && (
                <div className="w-full flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{t("mise_en_place:detail.actions_block.montants_required")}</span>
                </div>
              )}

              {canDoVisa && !dgtcpMontantsRequired && (
                <Button variant="outline" className="text-green-600 border-green-300" disabled={visaLoading} onClick={() => setVisaConfirmOpen(true)}>
                  <ShieldCheck className="h-4 w-4 me-1" /> {t("mise_en_place:actions.visa")}
                </Button>
              )}
              {canDoRejetTemp && (
                <Button variant="outline" className="text-amber-600 border-amber-300" onClick={() => { setShowRejetTemp(true); setRejetTempMotif(""); setRejetTempDocs([]); }}>
                  <AlertTriangle className="h-4 w-4 me-1" /> {t("mise_en_place:actions.reject_temp")}
                </Button>
              )}

              {canMontants && (
                <Button variant="outline" onClick={() => {
                  setShowMontants(true);
                  setMontantCordon(c.montantCordon != null ? String(c.montantCordon) : "");
                  setMontantTVAInt(c.montantTVAInterieure != null ? String(c.montantTVAInterieure) : "");
                  setRecapA(c.valeurDouaneFournitures != null ? String(c.valeurDouaneFournitures) : "");
                  setRecapB(c.droitsEtTaxesDouaneHorsTva != null ? String(c.droitsEtTaxesDouaneHorsTva) : "");
                  setRecapC(c.montantMarcheHt != null ? String(c.montantMarcheHt) : "");
                  setRecapD(c.tvaImportationDouane != null ? String(c.tvaImportationDouane) : "");
                  setRecapG(c.tvaCollecteeTravaux != null ? String(c.tvaCollecteeTravaux) : "");
                }}>
                  <Wallet className="h-4 w-4 me-1" /> {t("mise_en_place:actions.set_montants")}
                </Button>
              )}

              {role === "PRESIDENT" && c.statut === "EN_VALIDATION_PRESIDENT" && (
                <div className="w-full space-y-3">
                  {!hasCertDoc && (
                    <>
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => { void generateCertificatToSignPdf(c, { entreprise, marche, convention, autorite }); }}
                        >
                          <Download className="h-4 w-4 me-1" /> Télécharger le certificat à signer
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">
                          Téléchargez le certificat pré-rempli, signez-le, puis téléversez le document signé ci-dessous.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <UploadRow
                          id="mep-cert-upload"
                          label={t("mise_en_place:detail.president.upload_label") as string}
                          file={certFile}
                          onFileChange={setCertFile}
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        />
                        {!certFile && (
                          <p className="text-xs text-amber-600">⚠️ {t("mise_en_place:detail.president.upload_warning")}</p>
                        )}
                      </div>
                    </>
                  )}
                  {hasCertDoc && !certFile && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600">
                      <CheckCircle className="h-4 w-4" /> {t("mise_en_place:detail.president.already_uploaded")}
                    </div>
                  )}
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={uploadingCert || (!hasCertDoc && !certFile)} onClick={handleUploadAndValidate}>
                    {uploadingCert && <Loader2 className="h-4 w-4 animate-spin me-1" />}
                    <ShieldCheck className="h-4 w-4 me-1" /> {t("mise_en_place:detail.president.validate_and_open")}
                  </Button>
                </div>
              )}

              {canAnnuler && (
                <Button variant="destructive" onClick={() => setShowAnnulation(true)} disabled={actionLoading}>
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin me-1" />}
                  {t("mise_en_place:actions.cancel")}
                </Button>
              )}
              {!isDecisionRole && !isACOrEntreprise && !canAnnuler && !canMontants && !(role === "PRESIDENT" && c.statut === "EN_VALIDATION_PRESIDENT") && (
                <p className="text-sm text-muted-foreground">{t("mise_en_place:detail.actions_block.no_action_for_role")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Organism tabs */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">{t("mise_en_place:detail.orgs.title")}</h3>
            <div className="flex border-b border-border mb-3 gap-0">
              {visibleDecisionRoles.map((orgRole) => {
                const orgDecs = decisions.filter(d => d.role === orgRole);
                const orgHasVisa = orgDecs.some(d => d.decision === "VISA");
                const orgHasRejets = orgDecs.some(d => d.decision === "REJET_TEMP");
                const orgOpenRejets = orgDecs.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus !== "RESOLU");
                const orgAllResolved = orgHasRejets && orgOpenRejets.length === 0;
                const isActive = activeOrg === orgRole;
                const orgValidated = orgRole === "PRESIDENT" && ["OUVERT", "CLOTURE"].includes(c.statut);
                return (
                  <button key={orgRole} onClick={() => setActiveOrg(orgRole)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                    }`}>
                    {orgHasVisa || orgValidated ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : orgAllResolved ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : orgHasRejets ? <XCircle className="h-3.5 w-3.5 text-red-600" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />}
                    <span>{t(`mise_en_place:detail.orgs.labels.${orgRole}`)}</span>
                  </button>
                );
              })}
            </div>
            <div className={`rounded-lg border p-4 min-h-[120px] ${cardStyle}`}>
              <div className="text-center mb-3">
                {tabHasVisa || presidentValidated ? <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" /> : tabAllResolved ? <CheckCircle className="h-6 w-6 text-emerald-600 mx-auto mb-1" /> : tabHasRejets ? <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" /> : <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />}
                <p className="font-semibold text-sm">{t(`mise_en_place:detail.orgs.labels.${r}`)}</p>
                {tabHasVisa && <p className="text-green-700 font-medium text-xs mt-0.5">{t("mise_en_place:detail.orgs.visa_apposed_locked")}</p>}
                {tabAllResolved && !tabHasVisa && <p className="text-emerald-700 font-medium text-xs mt-0.5">{t("mise_en_place:detail.orgs.all_resolved_can_visa")}</p>}
                {presidentValidated && !tabHasVisa && !tabHasRejets && <p className="text-green-700 font-medium text-xs mt-0.5">{t("mise_en_place:detail.orgs.president_validated")}</p>}
                {!presidentValidated && !tabHasVisa && !tabHasRejets && <p className="text-muted-foreground text-xs mt-0.5">{t("mise_en_place:detail.orgs.waiting")}</p>}
                {tabHasVisa && (() => { const vd = roleDecs.find(d => d.decision === "VISA"); return vd?.dateDecision ? <p className="text-muted-foreground text-[10px] mt-0.5">{t("mise_en_place:detail.orgs.on_date", { date: formatDate(vd.dateDecision) })}</p> : null; })()}
              </div>

              {openRejets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-red-700 font-semibold text-xs text-center">{t("mise_en_place:detail.orgs.open_rejets_count", { count: openRejets.length })}</p>
                  {openRejets.map((rej, idx) => (
                    <div key={idx} className="border-s-2 border-red-300 ps-3 py-2 space-y-1 bg-background/50 rounded-e">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-red-800 text-xs">{t("mise_en_place:detail.orgs.rejet_label", { n: idx + 1 })}</span>
                        <Badge className="text-[9px] bg-red-100 text-red-700">{t("mise_en_place:detail.orgs.rejet_open")}</Badge>
                        {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{formatDate(rej.dateDecision)}</span>}
                      </div>
                      {rej.motifRejet && <p className="text-muted-foreground italic text-xs">{rej.motifRejet}</p>}
                      {rej.documentsDemandes && rej.documentsDemandes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-muted-foreground">{t("mise_en_place:detail.orgs.docs_demanded")}</span>
                          {rej.documentsDemandes.map((dt: string) => (
                            <Badge key={dt} variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">{tTypeDocument(dt)}</Badge>
                          ))}
                        </div>
                      )}
                      {rej.rejetTempResponses && rej.rejetTempResponses.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {rej.rejetTempResponses.map((resp, rIdx) => (
                            <div key={rIdx} className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-blue-800">
                                  <MessageSquare className="h-3 w-3 inline me-1" />
                                  {resp.utilisateurNom || resp.auteurNom || t("mise_en_place:detail.orgs.respond_btn")}
                                </span>
                                {resp.createdAt && <span className="text-muted-foreground text-[10px]">{formatDate(resp.createdAt)}</span>}
                              </div>
                              <p className="text-blue-700 mt-0.5">{resp.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {isACOrEntreprise && (
                        <div className="mt-2">
                          {responseDecisionId === rej.id ? (
                            <div className="flex gap-2">
                              <Input placeholder={t("mise_en_place:detail.orgs.respond_placeholder")} value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} className="text-xs h-7" />
                              <Button size="sm" className="h-7 text-[10px] px-2" disabled={respondingLoading || !responseMessage.trim()} onClick={handleResponse}>
                                {respondingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => { setResponseDecisionId(null); setResponseMessage(""); }}>
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => { setResponseDecisionId(rej.id); setResponseMessage(""); }}>
                              <MessageSquare className="h-3 w-3 me-0.5" /> {t("mise_en_place:detail.orgs.respond_btn")}
                            </Button>
                          )}
                        </div>
                      )}
                      {rej.role === (role as string) && (
                        <Button size="sm" variant="default" className="h-6 text-[10px] px-2 mt-1" disabled={actionLoading} onClick={() => handleResolve(rej.id)}>
                          <CheckCircle className="h-3 w-3 me-0.5" /> {t("mise_en_place:detail.orgs.resolve_rejet_btn")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isMyTab && !isClosed && !tabHasVisa && (
                <div className="flex gap-2 mt-3 justify-center">
                  {tabCanVisa && (
                    <Button variant="default" size="sm" className="h-7 text-xs" disabled={visaLoading} onClick={() => setVisaConfirmOpen(true)}>
                      <CheckCircle className="h-3.5 w-3.5 me-1" /> {t("mise_en_place:actions.visa")}
                    </Button>
                  )}
                  {tabCanRejetTemp && (
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { setShowRejetTemp(true); setRejetTempMotif(""); setRejetTempDocs([]); }}>
                      <XCircle className="h-3.5 w-3.5 me-1" /> {t("mise_en_place:actions.reject")}
                    </Button>
                  )}
                  {openRejets.length > 0 && (
                    <p className="text-amber-700 text-[10px] self-center">{t("mise_en_place:detail.orgs.resolve_before_visa")}</p>
                  )}
                </div>
              )}

              {resolvedRejets.length > 0 && (
                <details className="mt-3 border-t border-border pt-3">
                  <summary className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                    <History className="h-3.5 w-3.5" />
                    {t("mise_en_place:detail.orgs.history_summary", { count: resolvedRejets.length })}
                  </summary>
                  <div className="space-y-2 mt-2">
                    {resolvedRejets.map((rej, idx) => (
                      <div key={idx} className="border-s-2 border-muted ps-3 py-2 space-y-1 bg-muted/30 rounded-e opacity-75">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium text-muted-foreground text-xs">{t("mise_en_place:detail.orgs.rejet_label", { n: idx + 1 })}</span>
                          <Badge className="text-[9px] bg-green-100 text-green-700">{t("mise_en_place:detail.orgs.rejet_resolved")}</Badge>
                          {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{formatDate(rej.dateDecision)}</span>}
                        </div>
                        {rej.motifRejet && <p className="text-muted-foreground italic text-xs">{rej.motifRejet}</p>}
                        {rej.rejetTempResponses && rej.rejetTempResponses.length > 0 && (
                          <div className="space-y-1 mt-1">
                            {rej.rejetTempResponses.map((resp, rIdx) => (
                              <div key={rIdx} className="text-[10px] text-muted-foreground">
                                💬 {resp.utilisateurNom || resp.auteurNom}: {resp.message}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bandeau compléments AC/Entreprise — uploads GED en réponse aux rejets ouverts */}
        {isACOrEntreprise && c.statut === "INCOMPLETE" && (() => {
          const openCodes = Array.from(new Set(
            decisions
              .filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus === "OUVERT")
              .flatMap(d => d.documentsDemandes ?? [])
          ));
          if (openCodes.length === 0) return null;
          return (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-800">
                  <Upload className="h-4 w-4" /> {t("mise_en_place:detail.complements.title", { defaultValue: "Déposer les compléments demandés" })}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("mise_en_place:detail.complements.hint", { defaultValue: "Pour chaque pièce demandée, joindre le fichier et un message explicatif (obligatoire)." })}
                </p>
                <div className="space-y-3">
                  {openCodes.map((code) => (
                    <div key={code} className="rounded border border-amber-200 bg-background p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{tTypeDocument(code)}</Badge>
                      </div>
                      <UploadRow
                        id={`mep-complement-${code}`}
                        label={tTypeDocument(code)}
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        file={complementFiles[code] || null}
                        onFileChange={(f) => setComplementFiles(prev => ({ ...prev, [code]: f }))}
                      />
                      <Textarea
                        placeholder={t("mise_en_place:detail.complements.message_placeholder", { defaultValue: "Message explicatif (obligatoire)" })}
                        value={complementMessages[code] || ""}
                        onChange={(e) => setComplementMessages(prev => ({ ...prev, [code]: e.target.value }))}
                        className="min-h-[60px] text-sm"
                      />
                      <div className="flex justify-end">
                        <Button size="sm"
                          disabled={!complementFiles[code] || !(complementMessages[code] || "").trim() || complementLoading[code]}
                          onClick={() => handleUploadComplement(code)}>
                          {complementLoading[code] ? <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" /> : <Send className="h-3.5 w-3.5 me-1" />}
                          {t("mise_en_place:detail.complements.submit", { defaultValue: "Envoyer" })}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Documents */}

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> {t("mise_en_place:detail.documents.title")}</h3>
            {docs.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("mise_en_place:detail.documents.empty")}</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => {
                  const src = (doc as any)._source as string | undefined;
                  return (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.nomFichier}</p>
                          <p className="text-xs text-muted-foreground">
                            {tTypeDocument(doc.type)}
                            {src && <span className="ms-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{t(`mise_en_place:detail.documents.source.${src}`)}</span>}
                          </p>
                        </div>
                      </div>
                      <a href={getDocFileUrl(doc)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{t("mise_en_place:detail.documents.download")}</a>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* REJET_TEMP Dialog */}
      <Dialog open={showRejetTemp} onOpenChange={setShowRejetTemp}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("mise_en_place:dialogs.rejet_temp.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("mise_en_place:dialogs.rejet_temp.subtitle", { ref: c.reference || `#${c.id}`, entreprise: entrepriseName })}
            </p>
            <div className="space-y-2">
              <Label>{t("mise_en_place:dialogs.rejet_temp.motif_label")}</Label>
              <Textarea placeholder={t("mise_en_place:dialogs.rejet_temp.motif_placeholder")} value={rejetTempMotif} onChange={(e) => setRejetTempMotif(e.target.value)} className="min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label>{t("mise_en_place:dialogs.rejet_temp.docs_label")}</Label>
              <p className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.rejet_temp.docs_hint")}</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {docTypesDemandables.map((dt) => (
                  <label key={dt} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={rejetTempDocs.includes(dt)} onCheckedChange={(checked) => {
                      setRejetTempDocs(prev => checked ? [...prev, dt] : prev.filter(d => d !== dt));
                    }} />
                    <span className="text-sm">{tTypeDocument(dt)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejetTemp(false)}>{t("mise_en_place:dialogs.rejet_temp.cancel")}</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" disabled={rejetTempLoading || !rejetTempMotif.trim() || rejetTempDocs.length === 0} onClick={handleRejetTemp}>
              {rejetTempLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.rejet_temp.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Montants Dialog (DGTCP) */}
      <Dialog open={showMontants} onOpenChange={setShowMontants}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              {t("mise_en_place:dialogs.montants.title_dgtcp")}
            </DialogTitle>
          </DialogHeader>

          {(() => {
            const cordonNum = Number(montantCordon);
            const tvaNum = Number(montantTVAInt);
            const a = recapA === "" ? null : Number(recapA);
            const b = recapB === "" ? null : Number(recapB);
            const cVal = recapC === "" ? null : Number(recapC);
            const d = recapD === "" ? null : Number(recapD);
            const g = recapG === "" ? null : Number(recapG);
            const cordonExpected = b != null && d != null ? b + d : null;
            const tvaExpected = g != null && d != null ? g - d : null;
            const cordonMismatch = false;
            const tvaMismatch = false;
            const baseValid = montantCordon !== "" && montantTVAInt !== "" && cordonNum >= 0 && tvaNum >= 0;
            const canSave = baseValid && !savingMontants;

            return (
              <>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("mise_en_place:dialogs.montants.cordon_label")}</Label>
                      <div className="relative">
                        <Wallet className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={montantCordon} onChange={(e) => setMontantCordon(e.target.value)} className="ps-9 text-base font-medium" />
                      </div>
                      {cordonMismatch && (
                        <p className="text-xs text-destructive">{t("mise_en_place:dialogs.montants.cordon_mismatch", { value: formatNumber(cordonExpected!) })}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("mise_en_place:dialogs.montants.tva_label")}</Label>
                      <div className="relative">
                        <Wallet className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={montantTVAInt} onChange={(e) => setMontantTVAInt(e.target.value)} className="ps-9 text-base font-medium" />
                      </div>
                      {tvaMismatch && (
                        <p className="text-xs text-destructive">{t("mise_en_place:dialogs.montants.tva_mismatch", { value: formatNumber(tvaExpected!) })}</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{t("mise_en_place:dialogs.montants.recap_title")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("mise_en_place:dialogs.montants.recap_hint")}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.montants.recap_a")}</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={recapA} onChange={(e) => setRecapA(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.montants.recap_b")}</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={recapB} onChange={(e) => setRecapB(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.montants.recap_d")}</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={recapD} onChange={(e) => setRecapD(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.montants.recap_f")}</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={recapC} onChange={(e) => setRecapC(e.target.value)} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs text-muted-foreground">{t("mise_en_place:dialogs.montants.recap_g")}</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={recapG} onChange={(e) => setRecapG(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {baseValid && (
                    <div className="rounded-lg bg-muted/50 border p-3 text-sm">
                      <p className="text-muted-foreground mb-1">{t("mise_en_place:dialogs.montants.total_credit")}</p>
                      <div className="flex justify-between">
                        <span>{t("mise_en_place:dialogs.montants.total_row")}</span>
                        <span className="font-bold text-foreground">{formatAmount(cordonNum + tvaNum, { currency })}</span>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-3 pt-3">
                  <Button variant="outline" onClick={() => setShowMontants(false)} className="sm:me-auto">{t("mise_en_place:dialogs.montants.cancel")}</Button>
                  <Button disabled={!canSave} onClick={async () => {
                    setSavingMontants(true);
                    try {
                      const recap: Record<string, number> = {};
                      if (a != null && Number.isFinite(a)) recap.valeurDouaneFournitures = a;
                      if (b != null && Number.isFinite(b)) recap.droitsEtTaxesDouaneHorsTva = b;
                      if (d != null && Number.isFinite(d)) recap.tvaImportationDouane = d;
                      if (cVal != null && Number.isFinite(cVal)) recap.montantMarcheHt = cVal;
                      if (g != null && Number.isFinite(g)) recap.tvaCollecteeTravaux = g;
                      await certificatCreditApi.updateMontants(c.id, cordonNum, tvaNum, Object.keys(recap).length ? recap : undefined);
                      okToast(t("mise_en_place:toast.montants_saved_president"));
                      setShowMontants(false);
                      fetchData();
                    } catch (e: any) {
                      errToast(e.message);
                    } finally { setSavingMontants(false); }
                  }}>
                    {savingMontants && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                    <Wallet className="h-4 w-4 me-1" />
                    {t("mise_en_place:dialogs.montants.save_only")}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              {t("mise_en_place:dialogs.reject.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("mise_en_place:dialogs.reject.subtitle", { ref: c.reference || `#${c.id}`, entreprise: entrepriseName })}</p>
            <div className="space-y-2">
              <Label>{t("mise_en_place:dialogs.reject.motif_label")}</Label>
              <Textarea placeholder={t("mise_en_place:dialogs.reject.motif_placeholder")} value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} className="min-h-[100px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>{t("mise_en_place:dialogs.reject.cancel")}</Button>
            <Button variant="destructive" disabled={rejecting || !motifRejet.trim()} onClick={handleReject}>
              {rejecting && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.reject.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Annulation Confirmation */}
      <Dialog open={showAnnulation} onOpenChange={setShowAnnulation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              {t("mise_en_place:dialogs.annul_confirm.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("mise_en_place:dialogs.annul_confirm.description", { ref: c.reference || `#${c.id}` })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("mise_en_place:dialogs.annul_confirm.warning")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnulation(false)}>{t("mise_en_place:dialogs.annul_confirm.cancel")}</Button>
            <Button variant="destructive" disabled={actionLoading} onClick={async () => {
              setShowAnnulation(false);
              await handleStatut("ANNULE");
            }}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("mise_en_place:dialogs.annul_confirm.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={visaConfirmOpen} onOpenChange={setVisaConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Action irréversible</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Êtes-vous sûr de vouloir apposer votre visa ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVisaConfirmOpen(false)}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVisa}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default MiseEnPlaceDetail;
