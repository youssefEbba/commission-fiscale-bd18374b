import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  certificatCreditApi,
  certificatCreditConsultation,
  autoriteContractanteApi,
  AutoriteContractanteDto,
  CertificatCreditDto,
  CertificatCreditJournalDto,
  CertificatStatut,
  CERTIFICAT_STATUT_VALUES,
  PageResponse,
  sousTraitanceApi,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Search, RefreshCw, Loader2, BookOpen, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutCertificat } from "@/i18n/enums";
import { formatAmount, formatDate } from "@/i18n/format";
import CreditLink from "@/components/credits/CreditLink";

const PAGE_SIZES = [10, 20, 50, 100];
const toInstant = (d: string, end = false) => (d ? `${d}T${end ? "23:59:59" : "00:00:00"}Z` : undefined);

const EMPTY_CRITERES = {
  nif: "", numeroMarche: "", conventionRef: "", projet: "",
  autoriteContractanteId: "all", statut: "all", from: "", to: "",
};

/**
 * Menu unique « Crédits » : liste paginée côté serveur (GET /certificats-credit/search),
 * filtres multi-critères, journal daté. Un clic ouvre directement le détail du crédit.
 */
const Certificats = () => {
  const { t } = useTranslation(["certificats", "common"]);
  usePageTitle("certificats:list.title");
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEntreprise = role === "ENTREPRISE";

  const [autorites, setAutorites] = useState<AutoriteContractanteDto[]>([]);
  useEffect(() => {
    if (isEntreprise) return;
    autoriteContractanteApi.getAll().then(setAutorites).catch(() => setAutorites([]));
  }, [isEntreprise]);

  // ---- Liste
  const [criteres, setCriteres] = useState(EMPTY_CRITERES);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [result, setResult] = useState<PageResponse<CertificatCreditDto> | null>(null);
  const [loading, setLoading] = useState(false);
  const [sousTraiteIds, setSousTraiteIds] = useState<Set<number>>(new Set());

  // Entreprise : source dédiée (crédits propres + sous-traités), paginée localement.
  const [entrepriseAll, setEntrepriseAll] = useState<CertificatCreditDto[]>([]);

  const loadEntreprise = useCallback(async () => {
    if (!user?.entrepriseId) return;
    setLoading(true);
    try {
      const own = await certificatCreditApi.getByEntreprise(user.entrepriseId).catch(() => [] as CertificatCreditDto[]);
      const sts = await sousTraitanceApi.getAll().catch(() => [] as any[]);
      const mine = sts.filter((st: any) => st.sousTraitantEntrepriseId === user.entrepriseId && st.statut === "AUTORISEE");
      const ownIds = new Set(own.map((c) => c.id));
      const stIds = new Set<number>();
      const extra: CertificatCreditDto[] = [];
      for (const st of mine) {
        if (ownIds.has(st.certificatCreditId) || stIds.has(st.certificatCreditId)) continue;
        stIds.add(st.certificatCreditId);
        const c = await certificatCreditApi.getById(st.certificatCreditId).catch(() => null);
        if (c) extra.push(c);
      }
      setSousTraiteIds(stIds);
      setEntrepriseAll([...own, ...extra]);
    } catch {
      toast({ title: t("common:states.error"), description: t("certificats:list.toast.load_error"), variant: "destructive" });
    } finally { setLoading(false); }
  }, [user?.entrepriseId, toast, t]);

  const runSearch = useCallback(async (p = 0, s = size) => {
    setLoading(true);
    try {
      const res = await certificatCreditConsultation.search({
        nif: criteres.nif.trim() || undefined,
        numeroMarche: criteres.numeroMarche.trim() || undefined,
        conventionRef: criteres.conventionRef.trim() || undefined,
        projet: criteres.projet.trim() || undefined,
        autoriteContractanteId: criteres.autoriteContractanteId !== "all" ? Number(criteres.autoriteContractanteId) : undefined,
        statut: criteres.statut !== "all" ? (criteres.statut as CertificatStatut) : undefined,
        from: toInstant(criteres.from),
        to: toInstant(criteres.to, true),
        page: p,
        size: s,
      });
      setResult(res);
      setPage(p);
    } catch (e: any) {
      toast({ variant: "destructive", title: t("certificats:list.toast.load_error"), description: e?.message });
    } finally { setLoading(false); }
  }, [criteres, size, toast, t]);

  useEffect(() => {
    if (isEntreprise) void loadEntreprise();
    else void runSearch(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEntreprise]);

  // Filtrage local pour l'entreprise (statut + date), sinon résultat serveur.
  const entrepriseFiltered = useMemo(() => entrepriseAll.filter((c) => {
    if (criteres.statut !== "all" && c.statut !== criteres.statut) return false;
    const d = c.dateEmission ? c.dateEmission.slice(0, 10) : "";
    if (criteres.from && (!d || d < criteres.from)) return false;
    if (criteres.to && (!d || d > criteres.to)) return false;
    return true;
  }), [entrepriseAll, criteres]);

  const items: CertificatCreditDto[] = isEntreprise
    ? entrepriseFiltered.slice(page * size, page * size + size)
    : result?.content || [];
  const totalElements = isEntreprise ? entrepriseFiltered.length : result?.totalElements ?? 0;
  const totalPages = isEntreprise ? Math.max(1, Math.ceil(totalElements / size)) : Math.max(1, result?.totalPages ?? 0);
  const firstIdx = totalElements === 0 ? 0 : page * size + 1;
  const lastIdx = Math.min(totalElements, page * size + items.length);

  const goPage = (p: number) => {
    if (isEntreprise) setPage(p);
    else void runSearch(p);
  };
  const changeSize = (s: number) => {
    setSize(s);
    if (isEntreprise) setPage(0);
    else void runSearch(0, s);
  };
  const applyFilters = () => {
    if (isEntreprise) setPage(0);
    else void runSearch(0);
  };
  const refresh = () => (isEntreprise ? void loadEntreprise() : void runSearch(page));

  // ---- Journal
  const [jFrom, setJFrom] = useState("");
  const [jTo, setJTo] = useState("");
  const [jPage, setJPage] = useState(0);
  const [journal, setJournal] = useState<CertificatCreditJournalDto | null>(null);
  const [jLoading, setJLoading] = useState(false);
  const runJournal = useCallback(async (p = 0) => {
    setJLoading(true);
    try {
      const res = await certificatCreditConsultation.journal({ from: toInstant(jFrom), to: toInstant(jTo, true), page: p, size });
      setJournal(res);
      setJPage(p);
    } catch (e: any) {
      toast({ variant: "destructive", title: t("certificats:list.journal.error"), description: e?.message });
    } finally { setJLoading(false); }
  }, [jFrom, jTo, size, toast, t]);

  const pageTitle = t(`certificats:list.role_titles.${role}`, { defaultValue: t("certificats:list.role_titles.DEFAULT") });

  const Rows = ({ list }: { list: CertificatCreditDto[] }) => (
    <>
      {list.length === 0 ? (
        <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t("certificats:list.empty")}</TableCell></TableRow>
      ) : list.map((c) => (
        <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/certificats/${c.id}`)}>
          <TableCell className="whitespace-nowrap">
            <CreditLink id={c.id} reference={c.reference} numero={c.numero} />
            {sousTraiteIds.has(c.id) && (
              <Badge variant="outline" className="ms-2 text-[10px]">{t("certificats:list.badge.sous_traite")}</Badge>
            )}
          </TableCell>
          <TableCell className="max-w-[200px] truncate">{c.entrepriseRaisonSociale || c.entrepriseNom || "—"}</TableCell>
          <TableCell className="max-w-[200px] truncate">{c.marcheIntitule || "—"}</TableCell>
          <TableCell className="text-end whitespace-nowrap">{formatAmount(c.montantCordon ?? c.montantDouane)}</TableCell>
          <TableCell className="text-end whitespace-nowrap">{formatAmount(c.montantTVAInterieure ?? c.montantInterieur)}</TableCell>
          <TableCell className="text-end whitespace-nowrap font-semibold">{formatAmount(c.soldeCordon)}</TableCell>
          <TableCell className="text-end whitespace-nowrap font-semibold">{formatAmount(c.soldeTVA)}</TableCell>
          <TableCell><Badge variant="outline" className="text-xs">{tStatutCertificat(c.statut)}</Badge></TableCell>
          <TableCell className="whitespace-nowrap">{c.dateEmission ? formatDate(c.dateEmission) : "—"}</TableCell>
        </TableRow>
      ))}
    </>
  );

  const Head = () => (
    <TableHeader>
      <TableRow>
        <TableHead>{t("certificats:list.columns.ref")}</TableHead>
        <TableHead>{t("certificats:list.columns.entreprise")}</TableHead>
        <TableHead>{t("certificats:list.columns.marche")}</TableHead>
        <TableHead className="text-end">{t("certificats:list.columns.cordon")}</TableHead>
        <TableHead className="text-end">{t("certificats:list.columns.tva_int")}</TableHead>
        <TableHead className="text-end">{t("certificats:list.columns.solde_cordon")}</TableHead>
        <TableHead className="text-end">{t("certificats:list.columns.solde_tva")}</TableHead>
        <TableHead>{t("certificats:list.columns.statut")}</TableHead>
        <TableHead>{t("certificats:list.columns.date_creation")}</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" /> {pageTitle}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("certificats:list.subtitle")}</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} /> {t("certificats:list.refresh")}
          </Button>
        </div>

        <Tabs defaultValue="liste">
          {!isEntreprise && (
            <TabsList>
              <TabsTrigger value="liste"><Search className="h-4 w-4 me-1" /> {t("certificats:list.tabs.liste")}</TabsTrigger>
              <TabsTrigger value="journal" onClick={() => { if (!journal) void runJournal(0); }}>
                <BookOpen className="h-4 w-4 me-1" /> {t("certificats:list.tabs.journal")}
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="liste" className="space-y-4">
            <Card>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {!isEntreprise && (
                  <>
                    <div className="space-y-1"><Label className="text-xs">{t("certificats:list.filters.nif")}</Label><Input value={criteres.nif} onChange={(e) => setCriteres((p) => ({ ...p, nif: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">{t("certificats:list.filters.numero_marche")}</Label><Input value={criteres.numeroMarche} onChange={(e) => setCriteres((p) => ({ ...p, numeroMarche: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">{t("certificats:list.filters.convention")}</Label><Input value={criteres.conventionRef} onChange={(e) => setCriteres((p) => ({ ...p, conventionRef: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">{t("certificats:list.filters.projet")}</Label><Input value={criteres.projet} onChange={(e) => setCriteres((p) => ({ ...p, projet: e.target.value }))} /></div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("certificats:list.filters.autorite")}</Label>
                      <Select value={criteres.autoriteContractanteId} onValueChange={(v) => setCriteres((p) => ({ ...p, autoriteContractanteId: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("certificats:list.filters.all_f")}</SelectItem>
                          {autorites.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.nom}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">{t("certificats:list.filter_status")}</Label>
                  <Select value={criteres.statut} onValueChange={(v) => setCriteres((p) => ({ ...p, statut: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("certificats:list.filter_all")}</SelectItem>
                      {CERTIFICAT_STATUT_VALUES.map((k) => <SelectItem key={k} value={k}>{tStatutCertificat(k)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">{t("certificats:list.filters.from")}</Label><Input type="date" value={criteres.from} onChange={(e) => setCriteres((p) => ({ ...p, from: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">{t("certificats:list.filters.to")}</Label><Input type="date" value={criteres.to} onChange={(e) => setCriteres((p) => ({ ...p, to: e.target.value }))} /></div>
                <div className="lg:col-span-4 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setCriteres(EMPTY_CRITERES)} disabled={loading}>
                    <RotateCcw className="h-4 w-4 me-1" /> {t("certificats:list.filters.reset")}
                  </Button>
                  <Button onClick={applyFilters} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Search className="h-4 w-4 me-1" />} {t("certificats:list.filters.search")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1000px]">
                    <Head />
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : <Rows list={items} />}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-3 border-t p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {t("certificats:list.pagination.range", { from: firstIdx, to: lastIdx, total: totalElements })}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span>{t("certificats:list.pagination.per_page")}</span>
                      <Select value={String(size)} onValueChange={(v) => changeSize(Number(v))}>
                        <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <span>{t("certificats:list.pagination.page", { page: totalElements === 0 ? 0 : page + 1, total: totalElements === 0 ? 0 : totalPages })}</span>
                    <Button size="sm" variant="outline" disabled={loading || page <= 0} onClick={() => goPage(page - 1)} aria-label={t("certificats:list.pagination.prev")}>
                      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={loading || page + 1 >= totalPages} onClick={() => goPage(page + 1)} aria-label={t("certificats:list.pagination.next")}>
                      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {!isEntreprise && (
            <TabsContent value="journal" className="space-y-4">
              <Card>
                <CardContent className="p-4 flex flex-wrap items-end gap-3">
                  <div className="space-y-1"><Label className="text-xs">{t("certificats:list.filters.from")}</Label><Input type="date" className="w-40" value={jFrom} onChange={(e) => setJFrom(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">{t("certificats:list.filters.to")}</Label><Input type="date" className="w-40" value={jTo} onChange={(e) => setJTo(e.target.value)} /></div>
                  <Button size="sm" onClick={() => void runJournal(0)} disabled={jLoading}>
                    {jLoading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <BookOpen className="h-4 w-4 me-1" />} {t("certificats:list.journal.show")}
                  </Button>
                </CardContent>
              </Card>

              {journal && (
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { l: t("certificats:list.journal.nb"), v: String(journal.nombreCredits ?? 0) },
                    { l: t("certificats:list.journal.total_cordon"), v: formatAmount(journal.totalMontantCordon) },
                    { l: t("certificats:list.journal.total_tva"), v: formatAmount(journal.totalMontantTVAInterieure) },
                    { l: t("certificats:list.journal.solde_cordon"), v: formatAmount(journal.totalSoldeCordon) },
                    { l: t("certificats:list.journal.solde_tva"), v: formatAmount(journal.totalSoldeTVA) },
                  ].map((k) => (
                    <Card key={k.l}>
                      <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{k.l}</CardTitle></CardHeader>
                      <CardContent className="pt-0"><p className="text-lg font-bold">{k.v}</p></CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[1000px]">
                      <Head />
                      <TableBody>
                        {jLoading ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                        ) : <Rows list={journal?.certificats?.content || []} />}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
                    <span>{t("certificats:list.pagination.total", { total: journal?.certificats?.totalElements ?? 0 })}</span>
                    <div className="flex items-center gap-2">
                      <span>{t("certificats:list.pagination.page", { page: (journal?.certificats?.totalPages ?? 0) === 0 ? 0 : jPage + 1, total: journal?.certificats?.totalPages ?? 0 })}</span>
                      <Button size="sm" variant="outline" disabled={jLoading || jPage <= 0} onClick={() => void runJournal(jPage - 1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button>
                      <Button size="sm" variant="outline" disabled={jLoading || jPage + 1 >= (journal?.certificats?.totalPages ?? 0)} onClick={() => void runJournal(jPage + 1)}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Certificats;
