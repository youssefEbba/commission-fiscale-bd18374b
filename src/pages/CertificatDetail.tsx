import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DocumentGED from "@/components/ged/DocumentGED";
import { GEDDocument, GEDDocumentType } from "@/components/ged/DocumentGED";
import {
  certificatCreditApi, CertificatCreditDto, CertificatStatut,
  utilisationCreditApi, UtilisationCreditDto, UtilisationStatut,
  documentRequirementApi, DocumentDto, TvaDeductibleStockDto,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Award, Loader2, Landmark, CalendarDays, Building2, CreditCard, FileText, Plus, Eye, CheckCircle2, XCircle, Info } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutCertificat, tStatutUtilisation, tTypeDocument, tTvaStockSource } from "@/i18n/enums";
import { formatAmount, formatDate } from "@/i18n/format";

const STATUT_COLORS_CERT: Record<CertificatStatut, string> = {
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

const STATUT_COLORS_UTIL: Record<UtilisationStatut, string> = {
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

const CertificatDetail = () => {
  const { t } = useTranslation(["certificats", "common"]);
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [certificat, setCertificat] = useState<CertificatCreditDto | null>(null);
  const [utilisations, setUtilisations] = useState<UtilisationCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tvaStock, setTvaStock] = useState<TvaDeductibleStockDto[]>([]);

  // GED documents state
  const [showGed, setShowGed] = useState(false);
  const [gedDocs, setGedDocs] = useState<GEDDocument[]>([]);
  const [gedLoading, setGedLoading] = useState(false);
  const [gedDocTypes, setGedDocTypes] = useState<GEDDocumentType[]>([]);

  const role = (user as any)?.role;
  const canUpload = role === "ENTREPRISE" || role === "ADMIN_SI" || role === "DGTCP";

  const certRef = certificat?.numero || certificat?.reference || (certificat ? `#${certificat.id}` : "");
  usePageTitle("certificats:detail.title", { ref: certRef });

  useEffect(() => {
    if (!id) return;
    const certId = Number(id);
    setLoading(true);

    const fetchCert = async (): Promise<CertificatCreditDto> => {
      try {
        return await certificatCreditApi.getById(certId);
      } catch {
        try {
          if (user?.entrepriseId) {
            const certs = await certificatCreditApi.getByEntreprise(user.entrepriseId);
            const found = certs.find((c) => c.id === certId);
            if (found) return found;
          }

          const all = await certificatCreditApi.getAll();
          const found = all.find((c) => c.id === certId);
          if (found) return found;
        } catch {
          // ignore fallback errors
        }

        throw new Error(t("certificats:detail.not_found"));
      }
    };

    const fetchUtilisations = async () => {
      try {
        return await utilisationCreditApi.getByCertificat(certId);
      } catch {
        try {
          const all = await utilisationCreditApi.getAll();
          return all.filter((u) => u.certificatCreditId === certId);
        } catch {
          return [];
        }
      }
    };

    Promise.allSettled([
      fetchCert(),
      fetchUtilisations(),
      role === "DGTCP" || role === "ADMIN_SI" || role === "ENTREPRISE"
        ? certificatCreditApi.getTvaStock(certId)
        : Promise.resolve([] as TvaDeductibleStockDto[]),
    ])
      .then(([certResult, utilsResult, stockResult]) => {
        if (certResult.status !== "fulfilled") {
          throw certResult.reason;
        }

        setCertificat(certResult.value);
        setUtilisations(utilsResult.status === "fulfilled" ? utilsResult.value : []);
        setTvaStock(stockResult.status === "fulfilled" ? stockResult.value : []);
      })
      .catch(() => {
        setCertificat(null);
        setUtilisations([]);
        setTvaStock([]);
        toast({ title: t("common:states.error"), description: t("certificats:detail.load_error"), variant: "destructive" });
      })
      .finally(() => setLoading(false));

    // Load GED document requirements
    documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI")
      .then((reqs) => {
        setGedDocTypes(reqs.map(r => ({ value: r.typeDocument, label: tTypeDocument(r.typeDocument) })));
      })
      .catch(() => {
        setGedDocTypes([
          { value: "CERTIFICAT_CREDIT", label: tTypeDocument("CERTIFICAT_CREDIT") },
          { value: "DECISION_COMMISSION", label: tTypeDocument("DECISION_COMMISSION") },
          { value: "AUTRE", label: tTypeDocument("AUTRE") },
        ]);
      });
  }, [id, role, toast, user?.entrepriseId, t]);

  const loadGedDocs = async (certId: number) => {
    setGedLoading(true);
    try {
      const docs = await certificatCreditApi.getDocuments(certId);
      setGedDocs(docs.map((d: DocumentDto) => ({
        id: d.id,
        type: d.type || "AUTRE",
        nomFichier: d.nomFichier,
        chemin: d.chemin,
        dateUpload: d.dateUpload,
        taille: d.taille,
        version: d.version,
        actif: d.actif,
      })));
    } catch {
      setGedDocs([]);
    } finally {
      setGedLoading(false);
    }
  };

  const openGed = () => {
    if (!id) return;
    loadGedDocs(Number(id));
    setShowGed(true);
  };

  const handleGedUpload = async (dossierId: number, type: string, file: File) => {
    await certificatCreditApi.uploadDocument(dossierId, type, file);
  };

  const handleGedRefresh = async (dossierId: number) => {
    await loadGedDocs(dossierId);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!certificat) {
    return (
      <DashboardLayout>
        <div className="text-center py-24 text-muted-foreground">{t("certificats:detail.not_found")}</div>
      </DashboardLayout>
    );
  }

  const c = certificat;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("certificats:detail.back")}
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              {t("certificats:detail.title", { ref: certRef })}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("certificats:detail.subtitle")}</p>
          </div>
          <Button variant="outline" onClick={openGed}>
            <FileText className="h-4 w-4 me-2" /> {t("certificats:detail.ged_button")}
          </Button>
        </div>

        {/* Certificate Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("certificats:detail.cards.entreprise")}</p>
                  <p className="font-semibold text-sm">{c.entrepriseRaisonSociale || c.entrepriseNom || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("certificats:detail.cards.statut")}</p>
                  <Badge className={`text-xs mt-1 ${STATUT_COLORS_CERT[c.statut]}`}>
                    {tStatutCertificat(c.statut)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("certificats:detail.cards.date_emission")}</p>
                  <p className="font-semibold text-sm">{formatDate(c.dateEmission || c.dateCreation)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("certificats:detail.cards.validite")}</p>
                  <p className="font-semibold text-sm">{formatDate(c.dateValidite)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Montants */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-s-4 border-s-blue-500">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t("certificats:detail.amounts.montant_cordon")}</p>
              <p className="text-xl font-bold">{formatAmount(c.montantCordon ?? c.montantDouane)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{t("certificats:detail.amounts.montant_cordon_note")}</p>
            </CardContent>
          </Card>
          <Card className="border-s-4 border-s-indigo-500">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t("certificats:detail.amounts.montant_tva")}</p>
              <p className="text-xl font-bold">{formatAmount(c.montantTVAInterieure ?? c.montantInterieur)}</p>
            </CardContent>
          </Card>
          <Card className="border-s-4 border-s-emerald-500">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t("certificats:detail.amounts.solde_cordon")}</p>
              <p className="text-xl font-bold text-emerald-600">{formatAmount(c.soldeCordon)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("certificats:detail.amounts.solde_cordon_extra", {
                  tva: formatAmount(c.tvaImportationDouane),
                  total: formatAmount((c.soldeCordon ?? 0) + (c.tvaImportationDouane ?? 0)),
                })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-s-4 border-s-green-500">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t("certificats:detail.amounts.solde_tva")}</p>
              <p className="text-xl font-bold text-green-600">{formatAmount(c.soldeTVA)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Récapitulatif fiscal */}
        {(c.valeurDouaneFournitures != null || c.droitsEtTaxesDouaneHorsTva != null || c.tvaImportationDouane != null
          || c.montantMarcheHt != null || c.tvaCollecteeTravaux != null
          || c.creditExterieurRecap != null || c.creditInterieurNetRecap != null || c.totalCreditImpotRecap != null) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> {t("certificats:detail.recap.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("certificats:detail.recap.ref_col")}</TableHead>
                    <TableHead>{t("certificats:detail.recap.label_col")}</TableHead>
                    <TableHead className="text-end">{t("certificats:detail.recap.amount_col")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell className="font-mono">a</TableCell><TableCell>{t("certificats:detail.recap.a")}</TableCell><TableCell className="text-end">{formatAmount(c.valeurDouaneFournitures)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-mono">b</TableCell><TableCell>{t("certificats:detail.recap.b")}</TableCell><TableCell className="text-end">{formatAmount(c.droitsEtTaxesDouaneHorsTva)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-mono">d</TableCell><TableCell>{t("certificats:detail.recap.d")}</TableCell><TableCell className="text-end">{formatAmount(c.tvaImportationDouaneAccordee ?? c.tvaImportationDouane)}</TableCell></TableRow>
                  {c.tvaImportationDouaneAccordee != null && c.tvaImportationDouane != null && c.tvaImportationDouane !== c.tvaImportationDouaneAccordee && (
                    <TableRow><TableCell className="font-mono text-muted-foreground">d′</TableCell><TableCell className="text-muted-foreground">{t("certificats:detail.recap.dp")}</TableCell><TableCell className="text-end text-muted-foreground">{formatAmount(c.tvaImportationDouane)}</TableCell></TableRow>
                  )}
                  <TableRow className="bg-muted/40"><TableCell className="font-mono font-bold">e</TableCell><TableCell className="font-semibold">{t("certificats:detail.recap.e")}</TableCell><TableCell className="text-end font-bold">{formatAmount(c.creditExterieurRecap)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-mono">f</TableCell><TableCell>{t("certificats:detail.recap.f")}</TableCell><TableCell className="text-end">{formatAmount(c.montantMarcheHt)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-mono">g</TableCell><TableCell>{t("certificats:detail.recap.g")}</TableCell><TableCell className="text-end">{formatAmount(c.tvaCollecteeTravaux)}</TableCell></TableRow>
                  <TableRow className="bg-muted/40"><TableCell className="font-mono font-bold">h</TableCell><TableCell className="font-semibold">{t("certificats:detail.recap.h")}</TableCell><TableCell className="text-end font-bold">{formatAmount(c.creditInterieurNetRecap)}</TableCell></TableRow>
                  <TableRow className="bg-primary/5"><TableCell className="font-mono font-bold">Σ</TableCell><TableCell className="font-bold text-primary">{t("certificats:detail.recap.total")}</TableCell><TableCell className="text-end font-bold text-primary">{formatAmount(c.totalCreditImpotRecap)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        {(c.demandeCorrectionId || c.marcheId) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("certificats:detail.info.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {c.demandeCorrectionId && (
                  <div>
                    <p className="text-muted-foreground">{t("certificats:detail.info.demande_correction")}</p>
                    <p className="font-medium">#{c.demandeCorrectionId}</p>
                  </div>
                )}
                {c.marcheId && (
                  <div>
                    <p className="text-muted-foreground">{t("certificats:detail.info.marche")}</p>
                    <p className="font-medium">#{c.marcheId}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Indicateurs */}
        {c.statut === "OUVERT" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(() => {
              const liquidees = utilisations.filter(u => u.type === "DOUANIER" && u.statut === "LIQUIDEE");
              const apurees = utilisations.filter(u => u.type === "TVA_INTERIEURE" && u.statut === "APUREE");
              const totalStock = tvaStock.reduce((s, t) => s + t.montantRestant, 0);
              const totalCash = apurees.reduce((s, u) => s + (u.paiementEntreprise ?? 0), 0);
              const totalReport = apurees.reduce((s, u) => s + (u.reportANouveau ?? 0), 0);
              return (
                <>
                  <Card className="text-center"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{t("certificats:detail.indicators.importations_liquidees")}</p><p className="text-2xl font-bold">{liquidees.length}</p></CardContent></Card>
                  <Card className="text-center"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{t("certificats:detail.indicators.apurements")}</p><p className="text-2xl font-bold">{apurees.length}</p></CardContent></Card>
                  <Card className="text-center"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{t("certificats:detail.indicators.stock_tva")}</p><p className="text-2xl font-bold text-blue-600">{formatAmount(totalStock)}</p></CardContent></Card>
                  <Card className="text-center"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{t("certificats:detail.indicators.paiement_cash")}</p><p className="text-2xl font-bold text-amber-600">{formatAmount(totalCash)}</p></CardContent></Card>
                  <Card className="text-center"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{t("certificats:detail.indicators.reports")}</p><p className="text-2xl font-bold text-emerald-600">{formatAmount(totalReport)}</p></CardContent></Card>
                  <Card className="text-center"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{t("certificats:detail.indicators.utilisations_cours")}</p><p className="text-2xl font-bold">{utilisations.filter(u => !["LIQUIDEE", "APUREE", "REJETEE", "CLOTUREE"].includes(u.statut)).length}</p></CardContent></Card>
                </>
              );
            })()}
          </div>
        )}

        {/* Stock TVA déductible */}
        {tvaStock.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                {t("certificats:detail.stock.title", { total: formatAmount(tvaStock.reduce((s, t) => s + t.montantRestant, 0)) })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("certificats:detail.stock.source")}</TableHead>
                    <TableHead>{t("certificats:detail.stock.declaration")}</TableHead>
                    <TableHead>{t("certificats:detail.stock.montant_initial")}</TableHead>
                    <TableHead>{t("certificats:detail.stock.consomme")}</TableHead>
                    <TableHead>{t("certificats:detail.stock.restant")}</TableHead>
                    <TableHead>{t("certificats:detail.stock.date")}</TableHead>
                    <TableHead>{t("certificats:detail.stock.etat")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tvaStock.map(stk => {
                    const source = stk.source ?? (stk.utilisationDouaneId ? "UTILISATION_DOUANE" : "TRANSFERT_CREDIT");
                    const isTransfert = source === "TRANSFERT_CREDIT";
                    return (
                      <TableRow key={stk.id} className={stk.epuise ? "opacity-50" : ""}>
                        <TableCell>
                          <Badge variant="outline" className={isTransfert ? "border-amber-500 text-amber-700 bg-amber-50" : "border-blue-500 text-blue-700 bg-blue-50"}>
                            {tTvaStockSource(source)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{stk.numeroDeclaration || (stk.utilisationDouaneId ? t("certificats:detail.stock.util_short", { id: stk.utilisationDouaneId }) : "—")}</TableCell>
                        <TableCell>{formatAmount(stk.montantInitial)}</TableCell>
                        <TableCell>{formatAmount(stk.montantConsomme)}</TableCell>
                        <TableCell className="font-bold">{formatAmount(stk.montantRestant)}</TableCell>
                        <TableCell>{formatDate(stk.dateCreation)}</TableCell>
                        <TableCell>{stk.epuise ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Utilisations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                {t("certificats:detail.utilisations.title", { count: utilisations.length })}
              </CardTitle>
              {c.statut === "OUVERT" && (role === "ENTREPRISE" || role === "ADMIN_SI") && (
                <Button size="sm" onClick={() => navigate("/dashboard/utilisations")}>
                  <Plus className="h-4 w-4 me-2" /> {t("certificats:detail.utilisations.new")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("certificats:detail.utilisations.id")}</TableHead>
                  <TableHead>{t("certificats:detail.utilisations.type")}</TableHead>
                  <TableHead>{t("certificats:detail.utilisations.montant")}</TableHead>
                  <TableHead>{t("certificats:detail.utilisations.droits")}</TableHead>
                  <TableHead>{t("certificats:detail.utilisations.tva")}</TableHead>
                  <TableHead>{t("certificats:detail.utilisations.date")}</TableHead>
                  <TableHead>{t("certificats:detail.utilisations.statut")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utilisations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {t("certificats:detail.utilisations.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  utilisations.map((u) => (
                    <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/utilisations/${u.id}`)}>
                      <TableCell className="font-medium">#{u.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {u.type === "DOUANIER" ? t("certificats:detail.utilisations.type_douane") : t("certificats:detail.utilisations.type_tva")}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatAmount(u.montant)}</TableCell>
                      <TableCell>{u.type === "DOUANIER" ? formatAmount(u.montantDroits) : "—"}</TableCell>
                      <TableCell>{u.type === "DOUANIER" ? formatAmount(u.montantTVADouane) : formatAmount(u.montantTVAInterieure)}</TableCell>
                      <TableCell>{formatDate(u.dateLiquidation || u.dateCreation)}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUT_COLORS_UTIL[u.statut]}`}>
                          {tStatutUtilisation(u.statut)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* GED Document Dialog */}
      <DocumentGED
        open={showGed}
        onOpenChange={setShowGed}
        title={t("certificats:detail.ged_dialog_title", { ref: certRef })}
        dossierId={c.id}
        documentTypes={gedDocTypes}
        documents={gedDocs}
        loading={gedLoading}
        canUpload={canUpload}
        onUpload={handleGedUpload}
        onRefresh={handleGedRefresh}
      />
    </DashboardLayout>
  );
};

export default CertificatDetail;
