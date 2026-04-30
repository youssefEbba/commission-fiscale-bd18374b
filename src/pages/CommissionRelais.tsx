import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Briefcase, ArrowLeft, Search, Loader2, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { commissionRelaisApi, formatApiErrorMessage, RelaisAutoriteDto, RelaisEntrepriseDto, PageResponse } from "@/lib/api";
import { toast } from "sonner";

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
  const { applyImpersonation, isCommissionRelais, isImpersonating, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [entreprises, setEntreprises] = useState<RelaisEntrepriseDto[]>([]);
  const [autorites, setAutorites] = useState<RelaisAutoriteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

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
      .catch((err) => toast.error(formatApiErrorMessage(err, "Échec du chargement")))
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [mode, debounced, page]);

  const handleImpersonate = async (target: { id: number; label: string }) => {
    setSubmittingId(target.id);
    try {
      const res = mode === "ENTREPRISE"
        ? await commissionRelaisApi.impersonateEntreprise(target.id)
        : await commissionRelaisApi.impersonateAutorite(target.id);
      applyImpersonation(res, target.label);
      toast.success(`Vous agissez désormais en tant que ${target.label}`);
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiErrorMessage(err, "Échec de la prise de relais"));
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
        <p className="text-muted-foreground">Accès réservé au rôle Commission relais.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Commission relais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connecté en tant que <span className="font-medium">{user?.username}</span>. Sélectionnez le mode puis l'entité à prendre en charge.
          </p>
        </div>

        {!mode && (
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => setMode("ENTREPRISE")}
              className="text-left rounded-xl border border-border bg-card p-6 hover:border-primary hover:shadow-md transition-all"
            >
              <Briefcase className="h-8 w-8 text-primary mb-3" />
              <h2 className="font-semibold">Mode Entreprise</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Agir à la place d'une entreprise (demandes, utilisations, transferts, sous-traitance).
              </p>
            </button>
            <button
              onClick={() => setMode("AUTORITE_CONTRACTANTE")}
              className="text-left rounded-xl border border-border bg-card p-6 hover:border-primary hover:shadow-md transition-all"
            >
              <Building2 className="h-8 w-8 text-primary mb-3" />
              <h2 className="font-semibold">Mode Autorité Contractante</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Agir à la place d'une AC (conventions, marchés, demandes de correction, mise en place).
              </p>
            </button>
          </div>
        )}

        {mode && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>{mode === "ENTREPRISE" ? "Choisir une entreprise" : "Choisir une autorité contractante"}</CardTitle>
                  <CardDescription>La session de relais expire au bout de 4 h.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setMode(null); setQuery(""); }}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Changer de mode
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, NIF, sigle…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{mode === "ENTREPRISE" ? "Raison sociale" : "Nom"}</TableHead>
                      <TableHead>{mode === "ENTREPRISE" ? "NIF" : "Sigle"}</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10">
                          <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                          Chargement…
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                          Aucun résultat.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.primary}</TableCell>
                          <TableCell className="text-muted-foreground">{r.secondary}</TableCell>
                          <TableCell>
                            {r.actif === false ? (
                              <Badge variant="secondary">Inactif</Badge>
                            ) : (
                              <Badge variant="outline" className="border-primary/40 text-primary">Actif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              disabled={submittingId !== null || r.actif === false}
                              onClick={() => handleImpersonate({ id: r.id, label: r.primary })}
                            >
                              {submittingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Prendre le relais"}
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
                    {totalElements} résultat{totalElements > 1 ? "s" : ""} — Page {page + 1} / {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0 || loading}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1 || loading}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      Suivant <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CommissionRelais;
