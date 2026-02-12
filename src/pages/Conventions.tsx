import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  conventionApi, ConventionDto, ConventionStatut,
  CONVENTION_STATUT_LABELS, CreateConventionRequest,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Search, RefreshCw, Plus, Loader2,
  CheckCircle, XCircle, Filter,
} from "lucide-react";

const STATUT_COLORS: Record<ConventionStatut, string> = {
  EN_ATTENTE: "bg-orange-100 text-orange-800",
  VALIDE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
};

const Conventions = () => {
  const { user, hasRole } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();

  const [conventions, setConventions] = useState<ConventionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateConventionRequest>({ reference: "", intitule: "", bailleur: "" });
  const [creating, setCreating] = useState(false);

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isDGB = hasRole(["DGB"]);
  const isAdmin = hasRole(["ADMIN_SI", "PRESIDENT"]);

  const fetchConventions = async () => {
    setLoading(true);
    try {
      const data = await conventionApi.getAll();
      setConventions(data);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les conventions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConventions(); }, []);

  const handleCreate = async () => {
    if (!form.reference || !form.intitule) {
      toast({ title: "Erreur", description: "Référence et intitulé sont obligatoires", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await conventionApi.create(form);
      toast({ title: "Succès", description: "Convention créée" });
      setCreateOpen(false);
      setForm({ reference: "", intitule: "", bailleur: "" });
      fetchConventions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleStatutChange = async (id: number, statut: "VALIDE" | "REJETE") => {
    setActionLoading(id);
    try {
      await conventionApi.updateStatut(id, statut);
      toast({ title: "Succès", description: `Convention ${CONVENTION_STATUT_LABELS[statut].toLowerCase()}` });
      fetchConventions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = conventions.filter((c) => {
    const matchSearch =
      (c.reference || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.intitule || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.bailleur || "").toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === "ALL" || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Conventions
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestion des conventions de financement
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchConventions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
            {(isAC || isAdmin) && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle convention
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(CONVENTION_STATUT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
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
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Intitulé</TableHead>
                    <TableHead>Bailleur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune convention</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.reference || `#${c.id}`}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{c.intitule || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.bailleur || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUT_COLORS[c.statut] || ""}`}>
                            {CONVENTION_STATUT_LABELS[c.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {c.dateCreation ? new Date(c.dateCreation).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            {isDGB && c.statut === "EN_ATTENTE" && (
                              <>
                                <Button size="sm" disabled={actionLoading === c.id} onClick={() => handleStatutChange(c.id, "VALIDE")}>
                                  {actionLoading === c.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                  Valider
                                </Button>
                                <Button variant="destructive" size="sm" disabled={actionLoading === c.id} onClick={() => handleStatutChange(c.id, "REJETE")}>
                                  <XCircle className="h-4 w-4 mr-1" /> Rejeter
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Convention</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Référence *</Label>
              <Input value={form.reference} onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="CONV-2026-001" />
            </div>
            <div className="space-y-2">
              <Label>Intitulé *</Label>
              <Input value={form.intitule} onChange={(e) => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder="Convention de financement..." />
            </div>
            <div className="space-y-2">
              <Label>Bailleur de fonds</Label>
              <Input value={form.bailleur} onChange={(e) => setForm(f => ({ ...f, bailleur: e.target.value }))} placeholder="Banque mondiale..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating || !form.reference || !form.intitule}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Conventions;
