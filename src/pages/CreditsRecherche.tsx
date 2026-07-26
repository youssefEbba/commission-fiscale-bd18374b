import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatAmount, formatDate } from "@/i18n/format";
import { tStatutCertificat } from "@/i18n/enums";
import { displayRef } from "@/lib/displayRef";
import {
  certificatCreditConsultation,
  autoriteContractanteApi,
  AutoriteContractanteDto,
  CertificatCreditDto,
  CertificatCreditJournalDto,
  CertificatStatut,
  PageResponse,
} from "@/lib/api";

const STATUTS: CertificatStatut[] = ["EN_COURS_MISE_EN_PLACE", "OUVERT", "MODIFIE", "SUSPENDU", "CLOTURE", "ANNULE"] as CertificatStatut[];
const SIZE = 20;

const toInstant = (d: string, end = false) => (d ? `${d}T${end ? "23:59:59" : "00:00:00"}Z` : undefined);

export default function CreditsRecherche() {
  usePageTitle("nav:credits_consultation");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [autorites, setAutorites] = useState<AutoriteContractanteDto[]>([]);
  useEffect(() => {
    autoriteContractanteApi.getAll().then(setAutorites).catch(() => setAutorites([]));
  }, []);

  // ---- Recherche
  const [criteres, setCriteres] = useState({
    nif: "", numeroMarche: "", conventionRef: "", projet: "",
    autoriteContractanteId: "all", statut: "all", from: "", to: "",
  });
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PageResponse<CertificatCreditDto> | null>(null);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (p = 0) => {
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
        size: SIZE,
      });
      setResult(res);
      setPage(p);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Recherche impossible", description: e?.message || "Erreur serveur" });
    } finally {
      setLoading(false);
    }
  }, [criteres, toast]);

  useEffect(() => { void runSearch(0); /* chargement initial */ /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ---- Journal
  const [jFrom, setJFrom] = useState("");
  const [jTo, setJTo] = useState("");
  const [jPage, setJPage] = useState(0);
  const [journal, setJournal] = useState<CertificatCreditJournalDto | null>(null);
  const [jLoading, setJLoading] = useState(false);

  const runJournal = useCallback(async (p = 0) => {
    setJLoading(true);
    try {
      const res = await certificatCreditConsultation.journal({
        from: toInstant(jFrom),
        to: toInstant(jTo, true),
        page: p,
        size: SIZE,
      });
      setJournal(res);
      setJPage(p);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Journal indisponible", description: e?.message || "Erreur serveur" });
    } finally {
      setJLoading(false);
    }
  }, [jFrom, jTo, toast]);

  const openFiche = (c: CertificatCreditDto) => {
    const ref = c.reference || c.numero;
    if (!ref) return;
    navigate(`/dashboard/credits/fiche/${encodeURIComponent(ref)}`);
  };

  const Rows = ({ items }: { items: CertificatCreditDto[] }) => (
    <>
      {items.length === 0 ? (
        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun résultat</TableCell></TableRow>
      ) : items.map(c => (
        <TableRow key={c.id} className="cursor-pointer" onClick={() => openFiche(c)}>
          <TableCell className="font-medium whitespace-nowrap">{displayRef(c)}</TableCell>
          <TableCell className="max-w-[220px] truncate">{c.entrepriseRaisonSociale || c.entrepriseNom || "—"}</TableCell>
          <TableCell className="max-w-[220px] truncate">{c.marcheIntitule || "—"}</TableCell>
          <TableCell><Badge variant="outline" className="text-xs">{tStatutCertificat(c.statut)}</Badge></TableCell>
          <TableCell className="text-end whitespace-nowrap">{formatAmount(c.montantCordon)}</TableCell>
          <TableCell className="text-end whitespace-nowrap">{formatAmount(c.montantTVAInterieure)}</TableCell>
          <TableCell className="whitespace-nowrap">{formatDate(c.dateMiseEnPlace || c.dateEmission)}</TableCell>
        </TableRow>
      ))}
    </>
  );

  const Pager = ({ p, total, onGo, busy }: { p: number; total: number; onGo: (n: number) => void; busy: boolean }) => (
    <div className="flex items-center justify-between p-3 text-sm text-muted-foreground">
      <span>Page {total === 0 ? 0 : p + 1} / {total}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy || p <= 0} onClick={() => onGo(p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" disabled={busy || p + 1 >= total} onClick={() => onGo(p + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Consultation des crédits d'impôt</h1>
          <p className="text-muted-foreground text-sm">Recherche multi-critères, journal daté et fiche détaillée par référence.</p>
        </div>

        <Tabs defaultValue="recherche">
          <TabsList>
            <TabsTrigger value="recherche"><Search className="h-4 w-4 me-1" /> Recherche</TabsTrigger>
            <TabsTrigger value="journal" onClick={() => { if (!journal) void runJournal(0); }}><BookOpen className="h-4 w-4 me-1" /> Journal</TabsTrigger>
          </TabsList>

          <TabsContent value="recherche" className="space-y-4">
            <Card>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1"><Label className="text-xs">NIF</Label><Input value={criteres.nif} onChange={e => setCriteres(p => ({ ...p, nif: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">N° marché</Label><Input value={criteres.numeroMarche} onChange={e => setCriteres(p => ({ ...p, numeroMarche: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Réf. convention</Label><Input value={criteres.conventionRef} onChange={e => setCriteres(p => ({ ...p, conventionRef: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Projet</Label><Input value={criteres.projet} onChange={e => setCriteres(p => ({ ...p, projet: e.target.value }))} /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Autorité contractante</Label>
                  <Select value={criteres.autoriteContractanteId} onValueChange={v => setCriteres(p => ({ ...p, autoriteContractanteId: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {autorites.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Statut</Label>
                  <Select value={criteres.statut} onValueChange={v => setCriteres(p => ({ ...p, statut: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {STATUTS.map(s => <SelectItem key={s} value={s}>{tStatutCertificat(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Du</Label><Input type="date" value={criteres.from} onChange={e => setCriteres(p => ({ ...p, from: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Au</Label><Input type="date" value={criteres.to} onChange={e => setCriteres(p => ({ ...p, to: e.target.value }))} /></div>
                <div className="lg:col-span-4 flex justify-end">
                  <Button onClick={() => void runSearch(0)} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Search className="h-4 w-4 me-1" />} Rechercher
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Entreprise</TableHead>
                        <TableHead>Marché</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-end">Cordon</TableHead>
                        <TableHead className="text-end">TVA intérieure</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : <Rows items={result?.content || []} />}
                    </TableBody>
                  </Table>
                </div>
                <Pager p={page} total={result?.totalPages ?? 0} onGo={n => void runSearch(n)} busy={loading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="journal" className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-wrap items-end gap-3">
                <div className="space-y-1"><Label className="text-xs">Du</Label><Input type="date" className="w-40" value={jFrom} onChange={e => setJFrom(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Au</Label><Input type="date" className="w-40" value={jTo} onChange={e => setJTo(e.target.value)} /></div>
                <Button size="sm" onClick={() => void runJournal(0)} disabled={jLoading}>
                  {jLoading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <BookOpen className="h-4 w-4 me-1" />} Afficher
                </Button>
              </CardContent>
            </Card>

            {journal && (
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { l: "Crédits mis en place", v: String(journal.nombreCredits ?? 0) },
                  { l: "Total cordon", v: formatAmount(journal.totalMontantCordon) },
                  { l: "Total TVA intérieure", v: formatAmount(journal.totalMontantTVAInterieure) },
                  { l: "Solde cordon", v: formatAmount(journal.totalSoldeCordon) },
                  { l: "Solde TVA", v: formatAmount(journal.totalSoldeTVA) },
                ].map(k => (
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
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Entreprise</TableHead>
                        <TableHead>Marché</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-end">Cordon</TableHead>
                        <TableHead className="text-end">TVA intérieure</TableHead>
                        <TableHead>Mise en place</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jLoading ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : <Rows items={journal?.certificats?.content || []} />}
                    </TableBody>
                  </Table>
                </div>
                <Pager p={jPage} total={journal?.certificats?.totalPages ?? 0} onGo={n => void runJournal(n)} busy={jLoading} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
