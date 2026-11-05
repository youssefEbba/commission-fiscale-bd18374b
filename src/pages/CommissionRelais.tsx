import { useEffect, useMemo, useState } from "react";
import { RowNumberHead, RowNumberCell } from "@/components/ui/row-number";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { Building2, Briefcase, ArrowLeft, Search, Loader2, ShieldCheck, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { commissionRelaisApi, formatApiErrorMessage, RelaisAutoriteDto, RelaisEntrepriseDto, PageResponse } from "@/lib/api";
import { toast } from "sonner";
import { emitErrorDialog } from "@/components/ErrorDialog";
import { ArchiveCreateDialog, type ArchiveCreateInitial, type ArchiveCreateKind } from "@/components/archive/ArchiveCreateDialog";

type Mode = "ENTREPRISE" | "AUTORITE_CONTRACTANTE";

const PAGE_SIZE = 10;

function unwrap<T>(payload: PageResponse<T> | T[]): { items: T[]; totalPages: number; totalElements: number } {
  if (Array.isArray(payload)) return { items: payload, totalPages: 1, totalElements: payload.length };
  return {
    items: payload?.content ?? [],
    totalPages: payload?.totalPages ?? 1,
    totalElements: payload?.totalElements ?? (payload?.content?.length ?? 0),
  };
}

const CommissionRelais = () => {
  const { t } = useTranslation("common");
  const { applyImpersonation, isCommissionRelais, isImpersonating, user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [entreprises, setEntreprises] = useState<RelaisEntrepriseDto[]>([]);
  const [autorites, setAutorites] = useState<RelaisAutoriteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  // L'entité à représenter peut ne pas encore exister : la commission relais la crée sur place.
  const [createKind, setCreateKind] = useState<ArchiveCreateKind | null>(null);
  const [createInitial, setCreateInitial] = useState<ArchiveCreateInitial>({});
  const [reloadKey, setReloadKey] = useState(0);

  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Reset page when mode or search changes
  useEffect(() => { setPage(0); }, [mode, debounced]);

  useEffect(() => {
    if (!mode) return;
    let cancel = false;
    setLoading(true);
    const req = mode === "ENTREPRISE"
      ? commissionRelaisApi.listEntreprises(page, PAGE_SIZE, debounced)
      : commissionRelaisApi.listAutorites(page, PAGE_SIZE, debounced);
    req
      .then((res) => {
        if (cancel) return;
        const u = unwrap(res as any);
        if (mode === "ENTREPRISE") setEntreprises(u.items as RelaisEntrepriseDto[]);
        else setAutorites(u.items as RelaisAutoriteDto[]);
        setTotalPages(Math.max(1, u.totalPages));
        setTotalElements(u.totalElements);
      })
      .catch((err) => emitErrorDialog({ title: t("relais.load_error"), description: formatApiErrorMessage(err, t("relais.load_error")) }))
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [mode, debounced, page, reloadKey]);

  const canCreate = mode === "ENTREPRISE" ? hasPermission("entreprise.create")
    : mode === "AUTORITE_CONTRACTANTE" ? hasPermission("autorite.create") : false;

  /** La recherche en cours pré-remplit la création : des chiffres comme NIF, sinon comme nom. */
  const openCreate = () => {
    const q = query.trim();
    if (mode === "ENTREPRISE") {
      setCreateInitial(/^\d+$/.test(q) ? { nif: q } : q ? { raisonSociale: q } : {});
      setCreateKind("entreprise");
    } else {
      setCreateInitial(q ? { nom: q } : {});
      setCreateKind("autorite");
    }
  };

  // La fenêtre annonce que l'entité créée sera sélectionnée : la liste est filtrée sur elle,
  // pour qu'elle apparaisse aussitôt avec son bouton « Prendre le relais » (A98).
  const handleCreated = async (_kind: ArchiveCreateKind, _id: number, recherche?: string) => {
    setCreateKind(null);
    if (recherche) setQuery(recherche);
    setReloadKey((k) => k + 1);
    toast.success(mode === "ENTREPRISE" ? t("relais.created_entreprise") : t("relais.created_ac"));
  };

  const handleImpersonate = async (target: { id: number; label: string }) => {
    setSubmittingId(target.id);
    try {
      const res = mode === "ENTREPRISE"
        ? await commissionRelaisApi.impersonateEntreprise(target.id)
        : await commissionRelaisApi.impersonateAutorite(target.id);
      applyImpersonation(res, target.label);
      toast.success(t("relais.acting_as", { label: target.label }));
      navigate("/dashboard");
    } catch (err) {
      emitErrorDialog({ title: t("relais.take_over_failed"), description: formatApiErrorMessage(err, t("relais.take_over_failed")) });
    } finally {
      setSubmittingId(null);
    }
  };

  const rows = useMemo(() => {
    if (mode === "ENTREPRISE") {
      return entreprises.map((e) => ({ id: e.id, primary: e.raisonSociale, secondary: e.nif ?? "—", actif: e.actif }));
    }
    if (mode === "AUTORITE_CONTRACTANTE") {
      return autorites.map((a) => ({ id: a.id, primary: a.nom, secondary: a.sigle ?? "—", actif: a.actif }));
    }
    return [];
  }, [mode, entreprises, autorites]);

  if (!isCommissionRelais && !isImpersonating) {
    // Defensive: should not happen because route is protected
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">{t("relais.reserved")}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {t("relais.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <Trans t={t} i18nKey="relais.connected_as" values={{ username: user?.username }} components={{ strong: <span className="font-medium" /> }} />
          </p>
        </div>

        {!mode && (
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => setMode("ENTREPRISE")}
              className="text-left rounded-xl border border-border bg-card p-6 hover:border-primary hover:shadow-md transition-all"
            >
              <Briefcase className="h-8 w-8 text-primary mb-3" />
              <h2 className="font-semibold">{t("relais.mode_entreprise")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("relais.mode_entreprise_desc")}
              </p>
            </button>
            <button
              onClick={() => setMode("AUTORITE_CONTRACTANTE")}
              className="text-left rounded-xl border border-border bg-card p-6 hover:border-primary hover:shadow-md transition-all"
            >
              <Building2 className="h-8 w-8 text-primary mb-3" />
              <h2 className="font-semibold">{t("relais.mode_ac")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("relais.mode_ac_desc")}
              </p>
            </button>
          </div>
        )}

        {mode && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>{mode === "ENTREPRISE" ? t("relais.choose_entreprise") : t("relais.choose_ac")}</CardTitle>
                  <CardDescription>{t("relais.expires")}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canCreate && (
                    <Button variant="outline" size="sm" onClick={openCreate}>
                      <Plus className="h-4 w-4 mr-1" />
                      {mode === "ENTREPRISE" ? t("relais.create_entreprise") : t("relais.create_ac")}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setMode(null); setQuery(""); }}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> {t("relais.change_mode")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("relais.search")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow><RowNumberHead />
                      <TableHead>{mode === "ENTREPRISE" ? t("relais.col_entreprise") : t("relais.col_nom")}</TableHead>
                      <TableHead>{mode === "ENTREPRISE" ? t("relais.col_nif") : t("relais.col_sigle")}</TableHead>
                      <TableHead>{t("relais.col_statut")}</TableHead>
                      <TableHead className="text-right">{t("relais.col_action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10">
                          <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                          {t("relais.loading")}
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                          <p>{mode === "ENTREPRISE" ? t("relais.empty_entreprise") : t("relais.empty_ac")}</p>
                          {canCreate && (
                            <Button variant="link" size="sm" className="mt-1" onClick={openCreate}>
                              <Plus className="h-4 w-4 mr-1" />
                              {query.trim() ? t("relais.create_named", { name: query.trim() }) : mode === "ENTREPRISE" ? t("relais.create_entreprise") : t("relais.create_ac")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r, rowIdx) => (
                        <TableRow key={r.id}>
                          <RowNumberCell n={page * PAGE_SIZE + rowIdx + 1} />
                          <TableCell className="font-medium">{r.primary}</TableCell>
                          <TableCell className="text-muted-foreground">{r.secondary}</TableCell>
                          <TableCell>
                            {r.actif === false ? (
                              <Badge variant="secondary">{t("relais.inactif")}</Badge>
                            ) : (
                              <Badge variant="outline" className="border-primary/40 text-primary">{t("relais.actif")}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              disabled={submittingId !== null || r.actif === false}
                              onClick={() => handleImpersonate({ id: r.id, label: r.primary })}
                            >
                              {submittingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("relais.take_over")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalElements > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div>
                    {t("relais.results", { count: totalElements, page: page + 1, pages: totalPages })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0 || loading}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> {t("relais.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1 || loading}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      {t("relais.next")} <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <ArchiveCreateDialog
        kind={createKind}
        initial={createInitial}
        onClose={() => setCreateKind(null)}
        onCreated={handleCreated}
      />
    </DashboardLayout>
  );
};

export default CommissionRelais;
