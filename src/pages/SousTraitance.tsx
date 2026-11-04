import { SOUS_TRAITANCE_STATUT_COLORS } from "@/lib/statutColors";
import { useEffect, useState } from "react";
import { RowNumberHead, RowNumberCell } from "@/components/ui/row-number";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  sousTraitanceApi, SousTraitanceDto, StatutSousTraitance,
  SousTraitanceOnboardingRequest,
  TypeDocumentSousTraitance, DocumentSousTraitanceDto,
  certificatCreditApi, CertificatCreditDto,
  EntrepriseDto, utilisateurApi, formatApiErrorMessage,
} from "@/lib/api";
import { useGedPieces, acceptFromFormats } from "@/hooks/useGedPieces";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Handshake, Search, RefreshCw, Loader2, Plus, Eye, Filter, Upload, FileText, CheckCircle2, XCircle, UserPlus, Building2 } from "lucide-react";
import DocumentGED from "@/components/ged/DocumentGED";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutSousTraitance } from "@/i18n/enums";
import { formatDate, formatAmount, formatNumber } from "@/i18n/format";

const STATUT_COLORS = SOUS_TRAITANCE_STATUT_COLORS;

const STATUT_VALUES: StatutSousTraitance[] = ["DEMANDE", "EN_COURS", "AUTORISEE", "REFUSEE"];

/** Statuts encore en attente de la décision de la DGTCP (le serveur tranche). */
const STATUTS_A_DECIDER: StatutSousTraitance[] = ["DEMANDE", "EN_COURS"];
/** Statuts finaux : plus de dépôt de pièce. */
const STATUTS_FINAUX: StatutSousTraitance[] = ["AUTORISEE", "REFUSEE"];

const SousTraitance = () => {
  const { t } = useTranslation();
  usePageTitle("sous_traitance:list.title");
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  // Pièces déposées par l'entreprise titulaire (contrat enregistré, lettre des volumes…) : paramétrées dans la GED.
  const gedDepot = useGedPieces("SOUS_TRAITANCE", { depot: true });
  const [data, setData] = useState<SousTraitanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  // Autoriser engage la DGTCP : confirmation, comme les autres décisions (A37).
  const [aAutoriser, setAAutoriser] = useState<SousTraitanceDto | null>(null);
  const [aRefuser, setARefuser] = useState<SousTraitanceDto | null>(null);

  // Onboarding dialog
  const [showCreate, setShowCreate] = useState(false);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [createNewEntreprise, setCreateNewEntreprise] = useState(false);
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<SousTraitanceOnboardingRequest>>({});
  const [creating, setCreating] = useState(false);

  // Document uploads in creation
  const [createFiles, setCreateFiles] = useState<Record<string, File | null>>({});

  // Detail dialog
  const [selected, setSelected] = useState<SousTraitanceDto | null>(null);

  // Document dialog
  const [docDialog, setDocDialog] = useState<number | null>(null);
  const [docs, setDocs] = useState<DocumentSousTraitanceDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try { setData(await sousTraitanceApi.getAll()); }
    catch (e) {
      toast({
        title: t("sous_traitance:toast.load_error_title"),
        description: formatApiErrorMessage(e, t("sous_traitance:toast.load_error_desc")),
        variant: "destructive",
      });
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const openCreate = async () => {
    setForm({ contratEnregistre: true });
    setCreateNewEntreprise(false);
    setSelectedEntrepriseId(null);
    setCreateFiles({});

    const certsPromise = role === "ENTREPRISE" && user?.entrepriseId
      ? certificatCreditApi.getByEntreprise(user.entrepriseId)
      : certificatCreditApi.getAll();

    const [certsResult, entsResult] = await Promise.allSettled([
      certsPromise,
      utilisateurApi.getEntreprisesSousTraitantes(),
    ]);

    if (certsResult.status === "fulfilled") {
      // Mêmes statuts que le serveur (SousTraitanceService) : un crédit modifié par avenant reste sous-traitable.
      setCertificats(certsResult.value.filter((c) => c.statut === "OUVERT" || c.statut === "MODIFIE"));
    } else {
      setCertificats([]);
      const certsError = formatApiErrorMessage(certsResult.reason, t("sous_traitance:toast.unknown_error"));
      toast({
        title: t("sous_traitance:toast.error_title"),
        description: t("sous_traitance:toast.certs_load_error", { error: certsError }),
        variant: "destructive",
      });
    }

    if (entsResult.status === "fulfilled") {
      // Exclure l'entreprise connectée (on ne peut pas sous-traiter à soi-même)
      const filtered = user?.entrepriseId
        ? entsResult.value.filter((e: EntrepriseDto) => e.id !== user.entrepriseId)
        : entsResult.value;
      setEntreprises(filtered);
    } else {
      setEntreprises([]);
      setCreateNewEntreprise(true);

      const entsError = formatApiErrorMessage(entsResult.reason, t("sous_traitance:toast.unknown_error"));
      const isAccessDenied = entsError.toLowerCase().includes("accès refusé") || entsError.toLowerCase().includes("access denied");

      toast({
        title: isAccessDenied
          ? t("sous_traitance:toast.permissions_title")
          : t("sous_traitance:toast.error_title"),
        description: isAccessDenied
          ? t("sous_traitance:toast.permissions_desc")
          : t("sous_traitance:toast.ents_load_error", { error: entsError }),
        variant: "destructive",
      });
    }

    setShowCreate(true);
  };

  const handleSelectEntreprise = (entrepriseId: number) => {
    setSelectedEntrepriseId(entrepriseId);
  };

  const handleCreate = async () => {
    const f2 = { ...form };

    if (!f2.certificatCreditId) {
      toast({ title: t("sous_traitance:toast.error_title"), description: t("sous_traitance:toast.select_certificat"), variant: "destructive" });
      return;
    }
    // Seules les pièces marquées obligatoires dans la GED bloquent.
    const missing = gedDepot.options.filter((o) => o.obligatoire && !createFiles[o.code]);
    if (missing.length > 0) {
      toast({
        title: t("sous_traitance:toast.error_title"),
        description: t("sous_traitance:toast.missing_pieces", { list: missing.map((m) => m.label).join(", ") }),
        variant: "destructive",
      });
      return;
    }

    let createdSousTraitance: SousTraitanceDto | null = null;

    if (!createNewEntreprise) {
      if (!selectedEntrepriseId) {
        toast({ title: t("sous_traitance:toast.error_title"), description: t("sous_traitance:toast.select_entreprise"), variant: "destructive" });
        return;
      }
      setCreating(true);
      try {
        createdSousTraitance = await sousTraitanceApi.create({
          certificatCreditId: f2.certificatCreditId,
          sousTraitantEntrepriseId: selectedEntrepriseId,
          contratEnregistre: f2.contratEnregistre,
          volumes: f2.volumes,
          quantites: f2.quantites,
        });
      } catch (e: any) {
        toast({ title: t("sous_traitance:toast.error_title"), description: formatApiErrorMessage(e), variant: "destructive" });
        setCreating(false);
        return;
      }
    } else {
      const { sousTraitantEntrepriseRaisonSociale, sousTraitantEntrepriseNif } = f2;
      if (!sousTraitantEntrepriseRaisonSociale || !sousTraitantEntrepriseNif) {
        toast({ title: t("sous_traitance:toast.error_title"), description: t("sous_traitance:toast.fill_raison_nif"), variant: "destructive" });
        return;
      }
      setCreating(true);
      try {
        const result = await sousTraitanceApi.onboard(f2 as SousTraitanceOnboardingRequest);
        createdSousTraitance = result.sousTraitance;
      } catch (e: any) {
        toast({ title: t("sous_traitance:toast.error_title"), description: formatApiErrorMessage(e), variant: "destructive" });
        setCreating(false);
        return;
      }
    }

    const failures: string[] = [];
    if (createdSousTraitance) {
      for (const piece of gedDepot.options) {
        const file = createFiles[piece.code];
        if (!file) continue;
        try {
          await sousTraitanceApi.uploadDocument(createdSousTraitance.id, piece.code as TypeDocumentSousTraitance, file);
        } catch (e) {
          failures.push(`${piece.label} : ${formatApiErrorMessage(e)}`);
        }
      }
    }

    if (failures.length > 0) {
      // La demande est créée mais des pièces manquent : on le dit clairement (à compléter via « Documents »).
      toast({
        title: t("sous_traitance:toast.warn_title"),
        description: t("sous_traitance:toast.docs_upload_error", { error: failures.join(" • ") }),
        variant: "destructive",
      });
    } else {
      toast({ title: t("sous_traitance:toast.success_title"), description: t("sous_traitance:toast.created") });
    }
    setShowCreate(false);
    setCreating(false);
    fetchData();
  };

  const handleAutoriser = async (id: number) => {
    setActionLoading(id);
    try {
      await sousTraitanceApi.autoriser(id);
      toast({ title: t("sous_traitance:toast.success_title"), description: t("sous_traitance:toast.authorized") });
      fetchData();
    } catch (e: any) {
      toast({ title: t("sous_traitance:toast.error_title"), description: formatApiErrorMessage(e), variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleRefuser = async (id: number) => {
    setActionLoading(id);
    try {
      await sousTraitanceApi.refuser(id);
      toast({ title: t("sous_traitance:toast.success_title"), description: t("sous_traitance:toast.refused") });
      fetchData();
    } catch (e: any) {
      toast({ title: t("sous_traitance:toast.error_title"), description: formatApiErrorMessage(e), variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const openDocs = async (id: number) => {
    setDocDialog(id);
    setDocsLoading(true);
    setDocsError(null);
    try { setDocs(await sousTraitanceApi.getDocuments(id)); }
    catch (e) { setDocs([]); setDocsError(formatApiErrorMessage(e, t("sous_traitance:toast.docs_load_error"))); }
    finally { setDocsLoading(false); }
  };

  const refreshDocs = async (id: number) => {
    try { setDocs(await sousTraitanceApi.getDocuments(id)); setDocsError(null); }
    catch (e) { setDocs([]); setDocsError(formatApiErrorMessage(e, t("sous_traitance:toast.docs_load_error"))); }
  };

  const handleGEDUpload = async (dossierId: number, type: string, file: File) => {
    await sousTraitanceApi.uploadDocument(dossierId, type as TypeDocumentSousTraitance, file);
  };

  const filtered = data.filter((row) => {
    const ms = (row.certificatReference || row.certificatNumero || "").toLowerCase().includes(search.toLowerCase()) ||
      (row.sousTraitantEntrepriseRaisonSociale || "").toLowerCase().includes(search.toLowerCase()) ||
      String(row.id).includes(search);
    const matchStatut = filterStatut === "ALL" || row.statut === filterStatut;
    return ms && matchStatut;
  });

  const canCreate = role === "ENTREPRISE";
  const canValidate = role === "DGTCP";
  const fmtNum = (v: any) => v != null ? formatNumber(Number(v)) : "—";
  // No currency field on SousTraitanceDto — volumes/quantites are unitless numbers,
  // certificat solde uses MRU (default backend currency) until DTO exposes it.

  const gedDocTypes = gedDepot.options.map((o) => ({ value: o.code, label: o.label }));
  const docDossier = docDialog !== null ? data.find((r) => r.id === docDialog) : undefined;
  const canUploadDocs = role === "ENTREPRISE" && !!docDossier && !STATUTS_FINAUX.includes(docDossier.statut);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Handshake className="h-6 w-6 text-primary" />
              {t("sous_traitance:list.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("sous_traitance:list.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreate} aria-label={t("sous_traitance:actions.new")}>
                <UserPlus className="h-4 w-4 me-2" /> {t("sous_traitance:actions.new")}
              </Button>
            )}
            <Button variant="outline" onClick={fetchData} disabled={loading} aria-label={t("sous_traitance:actions.refresh")}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} /> {t("sous_traitance:actions.refresh")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("sous_traitance:list.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 me-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("sous_traitance:list.filter_all")}</SelectItem>
              {STATUT_VALUES.map((k) => (<SelectItem key={k} value={k}>{tStatutSousTraitance(k)}</SelectItem>))}
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
                  <TableRow><RowNumberHead />
                    <TableHead>{t("sous_traitance:list.columns.id")}</TableHead>
                    <TableHead>{t("sous_traitance:list.columns.certificat")}</TableHead>
                    <TableHead>{t("sous_traitance:list.columns.sous_traitant")}</TableHead>
                    <TableHead>{t("sous_traitance:list.columns.volumes")}</TableHead>
                    <TableHead>{t("sous_traitance:list.columns.quantites")}</TableHead>
                    <TableHead>{t("sous_traitance:list.columns.contrat_enregistre")}</TableHead>
                    <TableHead>{t("sous_traitance:list.columns.statut")}</TableHead>
                    <TableHead>{t("sous_traitance:list.columns.date_autorisation")}</TableHead>
                    <TableHead className="text-end">{t("sous_traitance:list.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{t("sous_traitance:list.empty")}</TableCell></TableRow>
                  ) : filtered.map((row, rowIdx) => (
                    <TableRow key={row.id}>
                      <RowNumberCell n={rowIdx + 1} />
                      <TableCell className="font-medium">#{row.id}</TableCell>
                      <TableCell className="text-muted-foreground">{row.certificatReference || row.certificatNumero || t("sous_traitance:list.cert_fallback", { id: row.certificatCreditId })}</TableCell>
                      <TableCell>{row.sousTraitantEntrepriseRaisonSociale || t("sous_traitance:list.ent_fallback", { id: row.sousTraitantEntrepriseId })}</TableCell>
                      <TableCell>{fmtNum(row.volumes)}</TableCell>
                      <TableCell>{fmtNum(row.quantites)}</TableCell>
                      <TableCell>
                        <Badge variant={row.contratEnregistre ? "default" : "outline"} className="text-xs">
                          {row.contratEnregistre ? t("sous_traitance:common.yes") : t("sous_traitance:common.no")}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[row.statut]}`}>{tStatutSousTraitance(row.statut)}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.dateAutorisation ? formatDate(row.dateAutorisation) : "—"}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(row)} aria-label={t("sous_traitance:actions.view")}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openDocs(row.id)} aria-label={t("sous_traitance:actions.documents")}><FileText className="h-4 w-4" /></Button>
                          {canValidate && STATUTS_A_DECIDER.includes(row.statut) && (
                            <>
                              <Button size="sm" disabled={actionLoading === row.id} onClick={() => setAAutoriser(row)}>
                                {actionLoading === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 me-1" />}
                                {t("sous_traitance:actions.authorize")}
                              </Button>
                              <Button variant="destructive" size="sm" disabled={actionLoading === row.id} onClick={() => setARefuser(row)}>
                                {actionLoading === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 me-1" />}
                                {t("sous_traitance:actions.refuse")}
                              </Button>
                            </>
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

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("sous_traitance:detail.title", { id: selected?.id })}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{t("sous_traitance:detail.fields.certificat")}</span><p className="font-medium">{selected.certificatReference || selected.certificatNumero || `#${selected.certificatCreditId}`}</p></div>
                <div><span className="text-muted-foreground">{t("sous_traitance:detail.fields.sous_traitant")}</span><p className="font-medium">{selected.sousTraitantEntrepriseRaisonSociale || `#${selected.sousTraitantEntrepriseId}`}</p></div>
                <div><span className="text-muted-foreground">{t("sous_traitance:detail.fields.volumes")}</span><p className="font-medium">{fmtNum(selected.volumes)}</p></div>
                <div><span className="text-muted-foreground">{t("sous_traitance:detail.fields.quantites")}</span><p className="font-medium">{fmtNum(selected.quantites)}</p></div>
                <div><span className="text-muted-foreground">{t("sous_traitance:detail.fields.contrat_enregistre")}</span><p className="font-medium">{selected.contratEnregistre ? t("sous_traitance:common.yes") : t("sous_traitance:common.no")}</p></div>
                <div><span className="text-muted-foreground">{t("sous_traitance:detail.fields.statut")}</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{tStatutSousTraitance(selected.statut)}</Badge></p></div>
                <div><span className="text-muted-foreground">{t("sous_traitance:detail.fields.date_autorisation")}</span><p className="font-medium">{selected.dateAutorisation ? formatDate(selected.dateAutorisation) : "—"}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Onboarding dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> {t("sous_traitance:dialogs.create.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Certificat */}
            <div>
              <Label>{t("sous_traitance:dialogs.create.certificat_label")}</Label>
              <SearchableSelect
                value={form.certificatCreditId ? String(form.certificatCreditId) : ""}
                onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}
                placeholder={t("sous_traitance:dialogs.create.certificat_placeholder")}
                searchPlaceholder={t("sous_traitance:dialogs.create.certificat_search_placeholder")}
                options={certificats.map((c) => ({
                  value: String(c.id),
                  label: t("sous_traitance:dialogs.create.certificat_option_label", {
                    // c.reference / c.numero are referential values from API — not translated.
                    ref: c.reference || c.numero || t("sous_traitance:list.cert_fallback", { id: c.id }),
                    // No currency field on CertificatDto — defaults to MRU.
                    solde: formatAmount(c.soldeCordon, { currency: "MRU" }),
                  }),
                  keywords: `${c.reference || ""} ${c.numero || ""}`,
                }))}
              />
            </div>

            {/* Entreprise sous-traitante */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> {t("sous_traitance:dialogs.create.entreprise_section")}
                </h4>
                <Button
                  type="button"
                  variant={createNewEntreprise ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCreateNewEntreprise(!createNewEntreprise);
                    if (!createNewEntreprise) {
                      setSelectedEntrepriseId(null);
                    } else {
                      setForm({ ...form, sousTraitantEntrepriseRaisonSociale: undefined, sousTraitantEntrepriseNif: undefined, sousTraitantEntrepriseAdresse: undefined, sousTraitantEntrepriseSituationFiscale: undefined, sousTraitantEntrepriseNomCommercial: undefined, sousTraitantEntrepriseActivite: undefined, sousTraitantEntrepriseAutre: undefined });
                    }
                  }}
                >
                  <Plus className="h-4 w-4 me-1" />
                  {createNewEntreprise
                    ? t("sous_traitance:dialogs.create.select_existing")
                    : t("sous_traitance:dialogs.create.create_new")}
                </Button>
              </div>

              {!createNewEntreprise ? (
                <div className="space-y-3">
                  <div>
                    <Label>{t("sous_traitance:dialogs.create.select_label")}</Label>
                    <SearchableSelect
                      value={selectedEntrepriseId ? String(selectedEntrepriseId) : ""}
                      onValueChange={(v) => handleSelectEntreprise(Number(v))}
                      placeholder={t("sous_traitance:dialogs.create.select_placeholder")}
                      searchPlaceholder={t("sous_traitance:dialogs.create.select_search_placeholder")}
                      options={entreprises.map((e) => ({
                        value: String(e.id!),
                        // raisonSociale + nif viennent du référentiel API — non traduits.
                        label: e.raisonSociale,
                        description: t("sous_traitance:dialogs.create.nif_prefix", { nif: e.nif }),
                        keywords: `${e.raisonSociale} ${e.nif}`,
                      }))}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t("sous_traitance:dialogs.create.fields.raison_sociale")}</Label>
                      <Input value={form.sousTraitantEntrepriseRaisonSociale ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseRaisonSociale: e.target.value })} />
                    </div>
                    <div>
                      <Label>{t("sous_traitance:dialogs.create.fields.nif")}</Label>
                      <Input value={form.sousTraitantEntrepriseNif ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseNif: e.target.value })} />
                    </div>
                    <div>
                      <Label>{t("sous_traitance:dialogs.create.fields.adresse")}</Label>
                      <Input value={form.sousTraitantEntrepriseAdresse ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseAdresse: e.target.value })} />
                    </div>
                    <div>
                      <Label>{t("sous_traitance:dialogs.create.fields.situation_fiscale")}</Label>
                      <Select value={form.sousTraitantEntrepriseSituationFiscale ?? ""} onValueChange={(v) => setForm({ ...form, sousTraitantEntrepriseSituationFiscale: v })}>
                        <SelectTrigger><SelectValue placeholder={t("sous_traitance:dialogs.create.fields.situation_placeholder")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REGULIERE">{t("sous_traitance:dialogs.create.fields.situation_reguliere")}</SelectItem>
                          <SelectItem value="NON_REGULIERE">{t("sous_traitance:dialogs.create.fields.situation_non_reguliere")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("sous_traitance:dialogs.create.fields.nom_commercial")}</Label>
                      <Input value={form.sousTraitantEntrepriseNomCommercial ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseNomCommercial: e.target.value })} />
                    </div>
                    <div>
                      <Label>{t("sous_traitance:dialogs.create.fields.activite")}</Label>
                      <Input value={form.sousTraitantEntrepriseActivite ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseActivite: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label>{t("sous_traitance:dialogs.create.fields.autre")}</Label>
                      <Input value={form.sousTraitantEntrepriseAutre ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseAutre: e.target.value })} maxLength={2000} placeholder={t("sous_traitance:dialogs.create.fields.autre_placeholder")} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Détails sous-traitance */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("sous_traitance:dialogs.create.fields.volumes")}</Label>
                <Input type="number" step="0.01" value={form.volumes ?? ""} onChange={(e) => setForm({ ...form, volumes: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <Label>{t("sous_traitance:dialogs.create.fields.quantites")}</Label>
                <Input type="number" step="0.01" value={form.quantites ?? ""} onChange={(e) => setForm({ ...form, quantites: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.contratEnregistre ?? false} onCheckedChange={(v) => setForm({ ...form, contratEnregistre: v })} />
              <Label>{t("sous_traitance:dialogs.create.fields.contrat_enregistre")}</Label>
            </div>

            {/* Documents obligatoires */}
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Upload className="h-4 w-4" /> {t("sous_traitance:dialogs.create.documents_section")}
              </h4>
              {gedDepot.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("common:documents.ged_pieces.loading")}
                </p>
              ) : gedDepot.error ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{t("common:documents.ged_pieces.error", { message: gedDepot.error.message })}</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => gedDepot.refetch()}>
                    {t("common:documents.ged_pieces.retry")}
                  </Button>
                </div>
              ) : gedDepot.options.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common:documents.ged_pieces.empty")}</p>
              ) : (
                <div className="space-y-3">
                  {gedDepot.options.map((piece) => (
                    <div key={piece.code}>
                      <Label>{piece.label} {piece.obligatoire && <span className="text-destructive">*</span>}</Label>
                      <Input
                        type="file"
                        accept={acceptFromFormats(piece.typesAutorises)}
                        onChange={(e) => setCreateFiles({ ...createFiles, [piece.code]: e.target.files?.[0] || null })}
                      />
                      {createFiles[piece.code] && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {createFiles[piece.code]!.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("sous_traitance:actions.cancel")}</Button>
            <Button onClick={handleCreate} disabled={creating || gedDepot.isLoading || !!gedDepot.error}>
              {creating && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("sous_traitance:actions.create_submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GED Document dialog */}
      <DocumentGED
        open={docDialog !== null}
        onOpenChange={() => setDocDialog(null)}
        title={t("sous_traitance:dialogs.documents.title", { id: docDialog })}
        dossierId={docDialog}
        documentTypes={gedDocTypes}
        documents={docs}
        loading={docsLoading}
        loadError={docsError}
        canUpload={canUploadDocs}
        onUpload={handleGEDUpload}
        onRefresh={refreshDocs}
      />
      <Dialog open={!!aRefuser} onOpenChange={(o) => { if (!o) setARefuser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("sous_traitance:refuse_dialog.title")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("sous_traitance:refuse_dialog.desc", {
              sousTraitant: aRefuser?.sousTraitantEntrepriseRaisonSociale || "—",
              credit: aRefuser?.certificatReference || aRefuser?.certificatNumero || "—",
            })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setARefuser(null)}>{t("common:actions.cancel")}</Button>
            <Button variant="destructive" disabled={!aRefuser || actionLoading === aRefuser.id}
              onClick={async () => { const r = aRefuser; setARefuser(null); if (r) await handleRefuser(r.id); }}>
              {t("sous_traitance:actions.refuse")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!aAutoriser} onOpenChange={(o) => { if (!o) setAAutoriser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("sous_traitance:authorize_dialog.title")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("sous_traitance:authorize_dialog.desc", {
              sousTraitant: aAutoriser?.sousTraitantEntrepriseRaisonSociale || "—",
              credit: aAutoriser?.certificatReference || aAutoriser?.certificatNumero || "—",
            })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAAutoriser(null)}>{t("common:actions.cancel")}</Button>
            <Button disabled={!aAutoriser || actionLoading === aAutoriser.id}
              onClick={async () => { const r = aAutoriser; setAAutoriser(null); if (r) await handleAutoriser(r.id); }}>
              {t("sous_traitance:actions.authorize")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SousTraitance;
