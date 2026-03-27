import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  certificatCreditApi, CertificatCreditDto, CertificatStatut,
  CERTIFICAT_STATUT_LABELS,
  demandeCorrectionApi, DemandeCorrectionDto,
  DocumentDto, entrepriseApi, EntrepriseDto, marcheApi, MarcheDto,
  DecisionCorrectionDto, RejetTempResponseDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Award, ArrowLeft, Loader2, FileText, CheckCircle, XCircle, ShieldCheck,
  AlertTriangle, History, DollarSign, FileDown, MessageSquare, Send,
} from "lucide-react";

const API_BASE = "https://1b5f-197-231-3-222.ngrok-free.app/api";

const STATUT_COLORS: Record<CertificatStatut, string> = {
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

// Types de documents demandables (aligné avec le backend TypeDocument enum)
const DOC_TYPES_DEMANDABLES: { value: string; label: string }[] = [
  { value: "ATTESTATION_FISCALE", label: "Attestation fiscale" },
  { value: "BULLETIN_PAIEMENT", label: "Bulletin de paiement" },
  { value: "CONVENTION", label: "Convention" },
  { value: "MARCHE", label: "Marché" },
  { value: "FACTURE", label: "Facture" },
  { value: "BORDEREAU_LIVRAISON", label: "Bordereau de livraison" },
  { value: "PROCES_VERBAL", label: "Procès verbal" },
  { value: "ORDRE_SERVICE", label: "Ordre de service" },
  { value: "AVENANT", label: "Avenant" },
  { value: "ATTESTATION_BONNE_EXECUTION", label: "Attestation de bonne exécution" },
  { value: "CERTIFICAT_ORIGINE", label: "Certificat d'origine" },
  { value: "DECLARATION_IMPORTATION", label: "Déclaration d'importation" },
  { value: "QUITTANCE_DOUANE", label: "Quittance de douane" },
  { value: "AUTRE", label: "Autre" },
];

const DECISION_ROLES_LIST = ["DGI", "DGD", "DGTCP", "PRESIDENT"];
const DECISION_ROLE_LABELS: Record<string, string> = {
  DGI: "DGI – Impôts",
  DGD: "DGD – Douanes",
  DGTCP: "DGTCP – Trésor",
  PRESIDENT: "Président",
};

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

  const [certificat, setCertificat] = useState<CertificatCreditDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [decisions, setDecisions] = useState<DecisionCorrectionDto[]>([]);
  const [activeOrg, setActiveOrg] = useState("DGI");

  // Caches
  const [entreprise, setEntreprise] = useState<EntrepriseDto | null>(null);
  const [correction, setCorrection] = useState<DemandeCorrectionDto | null>(null);
  const [marche, setMarche] = useState<MarcheDto | null>(null);

  // Action states
  const [visaLoading, setVisaLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [generatingCert, setGeneratingCert] = useState(false);

  // Rejet temp dialog
  const [showRejetTemp, setShowRejetTemp] = useState(false);
  const [rejetTempMotif, setRejetTempMotif] = useState("");
  const [rejetTempDocs, setRejetTempDocs] = useState<string[]>([]);
  const [rejetTempLoading, setRejetTempLoading] = useState(false);

  // Montants dialog (DGTCP)
  const [showMontants, setShowMontants] = useState(false);
  const [montantCordon, setMontantCordon] = useState("");
  const [montantTVAInt, setMontantTVAInt] = useState("");
  const [savingMontants, setSavingMontants] = useState(false);

  // Reject dialog (DGTCP)
  const [showReject, setShowReject] = useState(false);
  const [motifRejet, setMotifRejet] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Response to rejet (AC/Entreprise)
  const [responseDecisionId, setResponseDecisionId] = useState<number | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [respondingLoading, setRespondingLoading] = useState(false);

  // Annulation confirmation dialog
  const [showAnnulation, setShowAnnulation] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const cert = await certificatCreditApi.getById(Number(id));
      setCertificat(cert);

      const [docsRes, decisionsRes] = await Promise.all([
        certificatCreditApi.getDocuments(cert.id),
        certificatCreditApi.getDecisions(cert.id).catch(() => []),
      ]);
      setDocs(docsRes);
      setDecisions(decisionsRes);

      // Fetch related data
      const promises: Promise<any>[] = [];
      if (cert.entrepriseId) promises.push(entrepriseApi.getById(cert.entrepriseId).then(setEntreprise).catch(() => {}));
      if (cert.demandeCorrectionId) promises.push(demandeCorrectionApi.getById(cert.demandeCorrectionId).then(setCorrection).catch(() => {}));
      if (cert.marcheId) promises.push(marcheApi.getById(cert.marcheId).then(setMarche).catch(() => {}));
      await Promise.all(promises);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger la demande", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

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
          <p className="text-muted-foreground">Demande introuvable</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/mise-en-place")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const c = certificat;
  const entrepriseName = c.entrepriseNom || entreprise?.raisonSociale || "—";
  const correctionRef = c.demandeCorrectionNumero || (correction ? correction.numero || `#${correction.id}` : "—");
  const marcheRef = c.marcheIntitule || marche?.numeroMarche || "—";

  // ===== WORKFLOW LOGIC (from backend rules) =====
  // For the active tab's role, get decisions
  const getMyDecisionForRole = (r: string) => decisions.find(d => d.role === r);
  const getMyDecision = () => getMyDecisionForRole(role as string);

  const myDecision = getMyDecision();
  const myHasVisa = myDecision?.decision === "VISA";
  const myHasOpenRejet = myDecision?.decision === "REJET_TEMP" && myDecision?.rejetTempStatus === "OUVERT";
  const myHasResolvedRejet = myDecision?.decision === "REJET_TEMP" && myDecision?.rejetTempStatus === "RESOLU";

  // Roles that can participate in parallel visa workflow (EN_CONTROLE)
  const isControlRole = ["DGI", "DGD", "DGTCP"].includes(role as string);
  const isDecisionRole = ["DGI", "DGTCP", "DGD", "PRESIDENT"].includes(role as string);
  const isACOrEntreprise = role === "AUTORITE_CONTRACTANTE" || role === "ENTREPRISE";
  const isClosed = ["OUVERT", "ANNULE", "CLOTURE"].includes(c.statut);

  // AC submission is automatic upon creation (no manual submit button needed)

  // During EN_CONTROLE: DGI, DGD, DGTCP give parallel visas
  const isInControle = c.statut === "EN_CONTROLE" || c.statut === "INCOMPLETE" || c.statut === "A_RECONTROLER";
  const canDoVisa = isControlRole && isInControle && !myHasVisa && !myHasOpenRejet;
  const canDoRejetTemp = isControlRole && isInControle && !myHasVisa;

  // DGTCP must enter montants before visa (during EN_CONTROLE phase)
  const canMontants = role === "DGTCP" && isInControle && c.montantCordon == null;
  // DGTCP visa blocked if montants not set
  const dgtcpMontantsRequired = role === "DGTCP" && isInControle && c.montantCordon == null;

  // Permission "mise_en_place.annuler" : AC, DGI, PRESIDENT, DGTCP
  const canAnnuler = hasPermission("mise_en_place.annuler")
    && !["OUVERT", "CLOTURE", "ANNULE"].includes(c.statut);

  // President validates after auto-transition to EN_VALIDATION_PRESIDENT
  const canValiderPresident = role === "PRESIDENT" && c.statut === "EN_VALIDATION_PRESIDENT";

  // DGTCP opens after president validation
  const canPreparerOuverture = role === "DGTCP" && c.statut === "VALIDE_PRESIDENT";
  const canOuvrirCredit = role === "DGTCP" && c.statut === "EN_OUVERTURE_DGTCP";

  // President generates certificate when OUVERT
  const canGenerateCert = role === "PRESIDENT" && c.statut === "OUVERT";

  const handleStatut = async (statut: CertificatStatut) => {
    setActionLoading(true);
    try {
      await certificatCreditApi.updateStatut(c.id, statut);
      toast({ title: "Succès", description: `Statut: ${CERTIFICAT_STATUT_LABELS[statut]}` });
      if (statut === "ANNULE") {
        navigate("/dashboard/mise-en-place");
      } else {
        fetchData();
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const handleVisa = async () => {
    setVisaLoading(true);
    try {
      await certificatCreditApi.postDecision(c.id, "VISA");
      toast({ title: "Succès", description: "Visa apposé" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
      // Refresh to get latest state
      fetchData();
    } finally { setVisaLoading(false); }
  };

  const handleRejetTemp = async () => {
    if (!rejetTempMotif.trim() || rejetTempDocs.length === 0) return;
    setRejetTempLoading(true);
    try {
      await certificatCreditApi.postDecision(c.id, "REJET_TEMP", rejetTempMotif.trim(), rejetTempDocs);
      toast({ title: "Succès", description: "Rejet temporaire envoyé" });
      setShowRejetTemp(false);
      setRejetTempMotif("");
      setRejetTempDocs([]);
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
      fetchData();
    } finally { setRejetTempLoading(false); }
  };

  const handleResolve = async (decisionId: number) => {
    setActionLoading(true);
    try {
      await certificatCreditApi.resolveRejetTemp(decisionId);
      toast({ title: "Succès", description: "Rejet résolu. Vous pouvez maintenant apposer votre visa." });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const handleResponse = async () => {
    if (!responseDecisionId || !responseMessage.trim()) return;
    setRespondingLoading(true);
    try {
      await certificatCreditApi.postRejetTempResponse(responseDecisionId, responseMessage.trim());
      toast({ title: "Succès", description: "Réponse envoyée" });
      setResponseDecisionId(null);
      setResponseMessage("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setRespondingLoading(false); }
  };

  const handleReject = async () => {
    if (!motifRejet.trim()) return;
    setRejecting(true);
    try {
      await certificatCreditApi.reject(c.id, motifRejet.trim());
      toast({ title: "Succès", description: "Demande rejetée" });
      setShowReject(false);
      setMotifRejet("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setRejecting(false); }
  };

  const handleGenerateCertificate = async () => {
    setGeneratingCert(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("CERTIFICAT DE CRÉDIT D'IMPÔT", 105, 30, { align: "center" });
      doc.setFontSize(12);
      doc.text(`Référence : ${c.reference || `#${c.id}`}`, 20, 55);
      doc.text(`Entreprise : ${entrepriseName}`, 20, 65);
      doc.text(`Correction douanière : ${correctionRef}`, 20, 75);
      if (marcheRef !== "—") doc.text(`Marché : ${marcheRef}`, 20, 85);
      let y = marcheRef !== "—" ? 100 : 95;
      doc.setFontSize(14);
      doc.text("Montants", 20, y);
      doc.setFontSize(12);
      y += 12;
      if (c.montantCordon != null) doc.text(`Cordon / Douane : ${c.montantCordon.toLocaleString("fr-FR")} FCFA`, 25, y);
      y += 10;
      if (c.montantTVAInterieure != null) doc.text(`TVA Intérieure : ${c.montantTVAInterieure.toLocaleString("fr-FR")} FCFA`, 25, y);
      y += 10;
      if (c.soldeCordon != null) doc.text(`Solde Cordon : ${c.soldeCordon.toLocaleString("fr-FR")} FCFA`, 25, y);
      y += 10;
      if (c.soldeTVA != null) doc.text(`Solde TVA : ${c.soldeTVA.toLocaleString("fr-FR")} FCFA`, 25, y);
      y += 25;
      doc.text(`Statut : ${CERTIFICAT_STATUT_LABELS[c.statut] || c.statut}`, 20, y);
      y += 10;
      doc.text(`Date : ${new Date().toLocaleDateString("fr-FR")}`, 20, y);
      y += 30;
      doc.text("Le Président de la Commission Fiscale", 105, y, { align: "center" });
      y += 20;
      doc.text("____________________________", 105, y, { align: "center" });

      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], `certificat-credit-${c.id}.pdf`, { type: "application/pdf" });
      await certificatCreditApi.uploadDocument(c.id, "CERTIFICAT_CREDIT_IMPOTS", pdfFile);
      toast({ title: "Succès", description: "Certificat généré et attaché" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setGeneratingCert(false); }
  };

  // ===== Organism tab content =====
  const r = activeOrg;
  const roleDecs = decisions.filter(d => d.role === r);
  const tabDecision = roleDecs.length > 0 ? roleDecs[roleDecs.length - 1] : undefined;
  const allRejets = roleDecs.filter(d => d.decision === "REJET_TEMP");
  const openRejets = allRejets.filter(d => d.rejetTempStatus !== "RESOLU");
  const resolvedRejets = allRejets.filter(d => d.rejetTempStatus === "RESOLU");
  const tabHasVisa = tabDecision?.decision === "VISA";
  const tabHasRejets = allRejets.length > 0;
  const tabAllResolved = tabHasRejets && openRejets.length === 0 && resolvedRejets.length > 0;
  const isMyTab = (role as string) === r;

  // Tab-level action permissions (only for control roles during EN_CONTROLE phase)
  const isControlTab = ["DGI", "DGD", "DGTCP"].includes(r);
  const tabCanVisa = isMyTab && isControlTab && isInControle && !tabHasVisa && !openRejets.length && !(r === "DGTCP" && c.montantCordon == null);
  const tabCanRejetTemp = isMyTab && isControlTab && isInControle && !tabHasVisa;
  const tabCanResolve = isMyTab && openRejets.length > 0;

  const cardStyle = tabHasVisa
    ? "border-green-300 bg-green-50"
    : tabAllResolved
    ? "border-emerald-300 bg-emerald-50"
    : tabHasRejets
    ? "border-red-300 bg-red-50"
    : "border-border bg-muted/30";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/mise-en-place")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Award className="h-6 w-6 text-primary" />
                 {role === "AUTORITE_CONTRACTANTE" ? "Détails" : "Traitement"} — {c.reference || `#${c.id}`}
              </h1>
              <p className="text-muted-foreground text-sm">{role === "AUTORITE_CONTRACTANTE" ? "Visualisation de la demande de mise en place" : "Page de traitement de la demande de mise en place"}</p>
            </div>
          </div>
          <Badge className={`text-sm px-3 py-1 ${STATUT_COLORS[c.statut]}`}>
            {CERTIFICAT_STATUT_LABELS[c.statut]}
          </Badge>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Entreprise</p>
              <p className="font-semibold">{entrepriseName}</p>
              {entreprise?.nif && <p className="text-xs text-muted-foreground">NIF: {entreprise.nif}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Correction douanière</p>
              <p className="font-semibold">{correctionRef}</p>
              {correction?.statut && <p className="text-xs text-muted-foreground">Statut: {correction.statut}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Marché</p>
              <p className="font-semibold">{marcheRef}</p>
              {c.dateCreation && <p className="text-xs text-muted-foreground">Créé le: {new Date(c.dateCreation).toLocaleDateString("fr-FR")}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Montants section */}
        {(c.montantCordon != null || c.montantTVAInterieure != null) && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Montants</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Cordon</span><p className="font-bold">{c.montantCordon?.toLocaleString("fr-FR") || "—"} MRU</p></div>
                <div><span className="text-muted-foreground">TVA Intérieure</span><p className="font-bold">{c.montantTVAInterieure?.toLocaleString("fr-FR") || "—"} MRU</p></div>
                <div><span className="text-muted-foreground">Solde Cordon</span><p className="font-bold">{c.soldeCordon?.toLocaleString("fr-FR") || "—"} MRU</p></div>
                <div><span className="text-muted-foreground">Solde TVA</span><p className="font-bold">{c.soldeTVA?.toLocaleString("fr-FR") || "—"} MRU</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions bar */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Actions disponibles</h3>
            <div className="flex flex-wrap gap-2">
              {/* Workflow info messages */}
              {isControlRole && isInControle && myHasVisa && (
                <div className="w-full flex items-center gap-2 p-2 rounded bg-green-50 border border-green-200 text-green-800 text-sm mb-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Vous avez déjà apposé votre visa. Aucune autre action possible.</span>
                </div>
              )}
              {isControlRole && isInControle && myHasOpenRejet && (
                <div className="w-full flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Un rejet temporaire est en cours. Résolvez-le d'abord pour pouvoir viser.</span>
                </div>
              )}
              {dgtcpMontantsRequired && !myHasVisa && (
                <div className="w-full flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Vous devez renseigner les montants avant de pouvoir apposer votre visa.</span>
                </div>
              )}


              {/* Parallel visas: DGI, DGD, DGTCP during EN_CONTROLE */}
              {canDoVisa && !dgtcpMontantsRequired && (
                <Button variant="outline" className="text-green-600 border-green-300" disabled={visaLoading} onClick={handleVisa}>
                  <ShieldCheck className="h-4 w-4 mr-1" /> Apposer visa
                </Button>
              )}
              {canDoRejetTemp && (
                <Button variant="outline" className="text-amber-600 border-amber-300" onClick={() => { setShowRejetTemp(true); setRejetTempMotif(""); setRejetTempDocs([]); }}>
                  <AlertTriangle className="h-4 w-4 mr-1" /> Rejet temporaire
                </Button>
              )}

              {/* DGTCP: enter montants before visa */}
              {canMontants && (
                <Button variant="outline" onClick={() => { setShowMontants(true); setMontantCordon(""); setMontantTVAInt(""); }}>
                  <DollarSign className="h-4 w-4 mr-1" /> Renseigner montants
                </Button>
              )}

              {/* President: validate after auto-transition */}
              {canValiderPresident && (
                <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={actionLoading} onClick={() => handleStatut("VALIDE_PRESIDENT")}>
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  <ShieldCheck className="h-4 w-4 mr-1" /> Valider le certificat
                </Button>
              )}

              {/* DGTCP: prepare opening */}
              {canPreparerOuverture && (
                <Button onClick={() => handleStatut("EN_OUVERTURE_DGTCP")} disabled={actionLoading}>
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Préparer l'ouverture
                </Button>
              )}

              {/* DGTCP: open the credit */}
              {canOuvrirCredit && (
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={actionLoading} onClick={() => handleStatut("OUVERT")}>
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  <ShieldCheck className="h-4 w-4 mr-1" /> Ouvrir le crédit
                </Button>
              )}

              {/* President: generate certificate */}
              {canGenerateCert && (
                <Button disabled={generatingCert} onClick={handleGenerateCertificate}>
                  {generatingCert ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
                  Générer certificat
                </Button>
              )}

              {/* Annulation */}
              {canAnnuler && (
                <Button variant="destructive" onClick={() => setShowAnnulation(true)} disabled={actionLoading}>
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Annuler
                </Button>
              )}
              {!isDecisionRole && !isACOrEntreprise && !canAnnuler && !canSoumettreControle && !canMontants && !canGenerateCert && (
                <p className="text-sm text-muted-foreground">Aucune action disponible pour votre rôle.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Organism tabs */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Statut par organisme</h3>
            <div className="flex border-b border-border mb-3 gap-0">
              {DECISION_ROLES_LIST.map((orgRole) => {
                const orgDecs = decisions.filter(d => d.role === orgRole);
                const orgLatest = orgDecs.length > 0 ? orgDecs[orgDecs.length - 1] : undefined;
                const orgHasVisa = orgLatest?.decision === "VISA";
                const orgHasRejets = orgDecs.some(d => d.decision === "REJET_TEMP");
                const orgOpenRejets = orgDecs.filter(d => d.decision === "REJET_TEMP" && d.rejetTempStatus !== "RESOLU");
                const orgAllResolved = orgHasRejets && orgOpenRejets.length === 0;
                const isActive = activeOrg === orgRole;
                return (
                  <button
                    key={orgRole}
                    onClick={() => setActiveOrg(orgRole)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    {orgHasVisa ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : orgAllResolved ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : orgHasRejets ? <XCircle className="h-3.5 w-3.5 text-red-600" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />}
                    <span>{DECISION_ROLE_LABELS[orgRole] || orgRole}</span>
                  </button>
                );
              })}
            </div>
            <div className={`rounded-lg border p-4 min-h-[120px] ${cardStyle}`}>
              <div className="text-center mb-3">
                {tabHasVisa ? <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" /> : tabAllResolved ? <CheckCircle className="h-6 w-6 text-emerald-600 mx-auto mb-1" /> : tabHasRejets ? <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" /> : <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />}
                <p className="font-semibold text-sm">{DECISION_ROLE_LABELS[r] || r}</p>
                {tabHasVisa && <p className="text-green-700 font-medium text-xs mt-0.5">✓ Visa apposé — Plus d'actions possibles</p>}
                {tabAllResolved && !tabHasVisa && <p className="text-emerald-700 font-medium text-xs mt-0.5">Tous les rejets résolus — Peut viser</p>}
                {!tabDecision && <p className="text-muted-foreground text-xs mt-0.5">En attente de décision</p>}
                {tabHasVisa && tabDecision?.dateDecision && <p className="text-muted-foreground text-[10px] mt-0.5">Le : {new Date(tabDecision.dateDecision).toLocaleDateString("fr-FR")}</p>}
              </div>

              {/* Open rejets */}
              {openRejets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-red-700 font-semibold text-xs text-center">{openRejets.length} rejet{openRejets.length > 1 ? "s" : ""} ouvert{openRejets.length > 1 ? "s" : ""}</p>
                  {openRejets.map((rej, idx) => (
                    <div key={idx} className="border-l-2 border-red-300 pl-3 py-2 space-y-1 bg-background/50 rounded-r">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-red-800 text-xs">Rejet {idx + 1}</span>
                        <Badge className="text-[9px] bg-red-100 text-red-700">Ouvert</Badge>
                        {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{new Date(rej.dateDecision).toLocaleDateString("fr-FR")}</span>}
                      </div>
                      {rej.motifRejet && <p className="text-muted-foreground italic text-xs">{rej.motifRejet}</p>}
                      {rej.documentsDemandes && rej.documentsDemandes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-muted-foreground">Docs demandés :</span>
                          {rej.documentsDemandes.map((dt: string) => (
                            <Badge key={dt} variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">{DOC_TYPES_DEMANDABLES.find(t => t.value === dt)?.label || dt.replace(/_/g, " ")}</Badge>
                          ))}
                        </div>
                      )}
                      {/* Responses history */}
                      {rej.rejetTempResponses && rej.rejetTempResponses.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {rej.rejetTempResponses.map((resp, rIdx) => (
                            <div key={rIdx} className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-blue-800">
                                  <MessageSquare className="h-3 w-3 inline mr-1" />
                                  {resp.utilisateurNom || resp.auteurNom || "Réponse"}
                                </span>
                                {resp.createdAt && <span className="text-muted-foreground text-[10px]">{new Date(resp.createdAt).toLocaleDateString("fr-FR")}</span>}
                              </div>
                              <p className="text-blue-700 mt-0.5">{resp.message}</p>
                              {resp.documentUrl && <Badge className="text-[9px] bg-blue-100 text-blue-700 mt-1">📎 Document uploadé</Badge>}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* AC/Entreprise: respond to rejet */}
                      {isACOrEntreprise && (
                        <div className="mt-2">
                          {responseDecisionId === rej.id ? (
                            <div className="flex gap-2">
                              <Input
                                placeholder="Votre réponse..."
                                value={responseMessage}
                                onChange={(e) => setResponseMessage(e.target.value)}
                                className="text-xs h-7"
                              />
                              <Button size="sm" className="h-7 text-[10px] px-2" disabled={respondingLoading || !responseMessage.trim()} onClick={handleResponse}>
                                {respondingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => { setResponseDecisionId(null); setResponseMessage(""); }}>
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => { setResponseDecisionId(rej.id); setResponseMessage(""); }}>
                              <MessageSquare className="h-3 w-3 mr-0.5" /> Répondre
                            </Button>
                          )}
                        </div>
                      )}
                      {/* Acteur who created the rejet: resolve it */}
                      {rej.role === (role as string) && (
                        <Button size="sm" variant="default" className="h-6 text-[10px] px-2 mt-1" disabled={actionLoading} onClick={() => handleResolve(rej.id)}>
                          <CheckCircle className="h-3 w-3 mr-0.5" /> Résoudre le rejet
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions in tab (for the actor of this tab) */}
              {isMyTab && !isClosed && !tabHasVisa && (
                <div className="flex gap-2 mt-3 justify-center">
                  {tabCanVisa && (
                    <Button variant="default" size="sm" className="h-7 text-xs" disabled={visaLoading} onClick={handleVisa}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Apposer visa
                    </Button>
                  )}
                  {tabCanRejetTemp && (
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { setShowRejetTemp(true); setRejetTempMotif(""); setRejetTempDocs([]); }}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeter
                    </Button>
                  )}
                  {openRejets.length > 0 && (
                    <p className="text-amber-700 text-[10px] self-center">Résolvez le rejet avant de pouvoir viser</p>
                  )}
                </div>
              )}

              {/* Resolved history */}
              {resolvedRejets.length > 0 && (
                <details className="mt-3 border-t border-border pt-3">
                  <summary className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                    <History className="h-3.5 w-3.5" />
                    Historique ({resolvedRejets.length} résolu{resolvedRejets.length > 1 ? "s" : ""})
                  </summary>
                  <div className="space-y-2 mt-2">
                    {resolvedRejets.map((rej, idx) => (
                      <div key={idx} className="border-l-2 border-muted pl-3 py-2 space-y-1 bg-muted/30 rounded-r opacity-75">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium text-muted-foreground text-xs">Rejet {idx + 1}</span>
                          <Badge className="text-[9px] bg-green-100 text-green-700">Résolu</Badge>
                          {rej.dateDecision && <span className="text-muted-foreground text-[10px]">{new Date(rej.dateDecision).toLocaleDateString("fr-FR")}</span>}
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

        {/* Documents */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> Documents du dossier</h3>
            {docs.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun document associé</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
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
          </CardContent>
        </Card>
      </div>

      {/* REJET_TEMP Dialog */}
      <Dialog open={showRejetTemp} onOpenChange={setShowRejetTemp}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Rejet temporaire — Demander des compléments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Demande {c.reference || `#${c.id}`} — {entrepriseName}
            </p>
            <div className="space-y-2">
              <Label>Motif *</Label>
              <Textarea placeholder="Précisez les corrections ou compléments attendus..." value={rejetTempMotif} onChange={(e) => setRejetTempMotif(e.target.value)} className="min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label>Documents à corriger / compléter *</Label>
              <p className="text-xs text-muted-foreground">Sélectionnez au moins un document</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {DOC_TYPES_DEMANDABLES.map((dt) => (
                  <label key={dt.value} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={rejetTempDocs.includes(dt.value)}
                      onCheckedChange={(checked) => {
                        setRejetTempDocs(prev => checked ? [...prev, dt.value] : prev.filter(d => d !== dt.value));
                      }}
                    />
                    <span className="text-sm">{dt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejetTemp(false)}>Annuler</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" disabled={rejetTempLoading || !rejetTempMotif.trim() || rejetTempDocs.length === 0} onClick={handleRejetTemp}>
              {rejetTempLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer le rejet temporaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Montants Dialog (DGTCP) */}
      <Dialog open={showMontants} onOpenChange={setShowMontants}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Renseigner les montants
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Montant Cordon (Douane) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={montantCordon} onChange={(e) => setMontantCordon(e.target.value)} className="pl-9 text-base font-medium" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Montant TVA Intérieure *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={montantTVAInt} onChange={(e) => setMontantTVAInt(e.target.value)} className="pl-9 text-base font-medium" />
              </div>
            </div>
          </div>
          {montantCordon && montantTVAInt && Number(montantCordon) > 0 && Number(montantTVAInt) > 0 && (
            <div className="rounded-lg bg-muted/50 border p-3 text-sm">
              <p className="text-muted-foreground mb-1">Récapitulatif</p>
              <div className="flex justify-between">
                <span>Total crédit</span>
                <span className="font-bold text-foreground">{(Number(montantCordon) + Number(montantTVAInt)).toLocaleString("fr-FR")} MRU</span>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowMontants(false)} className="sm:mr-auto">Annuler</Button>
            <Button
              disabled={savingMontants || !montantCordon || !montantTVAInt || Number(montantCordon) <= 0 || Number(montantTVAInt) <= 0}
              onClick={async () => {
                setSavingMontants(true);
                try {
                  await certificatCreditApi.updateMontants(c.id, Number(montantCordon), Number(montantTVAInt));
                  toast({ title: "Succès", description: "Montants enregistrés. Le Président peut maintenant valider et ouvrir le certificat." });
                  setShowMontants(false);
                  fetchData();
                } catch (e: any) {
                  toast({ title: "Erreur", description: e.message, variant: "destructive" });
                } finally { setSavingMontants(false); }
              }}
            >
              {savingMontants && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <DollarSign className="h-4 w-4 mr-1" />
              Enregistrer les montants
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog (DGTCP) */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Rejeter la demande
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Demande {c.reference || `#${c.id}`} — {entrepriseName}</p>
            <div className="space-y-2">
              <Label>Motif du rejet *</Label>
              <Textarea placeholder="Veuillez préciser le motif du rejet..." value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} className="min-h-[100px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Annuler</Button>
            <Button variant="destructive" disabled={rejecting || !motifRejet.trim()} onClick={handleReject}>
              {rejecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Annulation Confirmation Dialog */}
      <Dialog open={showAnnulation} onOpenChange={setShowAnnulation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Confirmer l'annulation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir annuler le certificat <strong>{c.reference || `#${c.id}`}</strong> ?
            </p>
            <p className="text-sm text-muted-foreground">
              Cette action est irréversible. Vous pourrez créer un nouveau certificat sur la même demande de correction après l'annulation.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnulation(false)}>Non, revenir</Button>
            <Button
              variant="destructive"
              disabled={actionLoading}
              onClick={async () => {
                setShowAnnulation(false);
                await handleStatut("ANNULE");
              }}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Oui, annuler le certificat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MiseEnPlaceDetail;
