import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  marcheApi, MarcheDto, CreateMarcheRequest, StatutMarche, MARCHE_STATUT_LABELS,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gavel, Plus, RefreshCw, Loader2, Search, Edit, Eye } from "lucide-react";

const STATUT_COLORS: Record<StatutMarche, string> = {
  EN_COURS: "bg-blue-100 text-blue-800",
  AVENANT: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
};

const Marches = () => {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [marches, setMarches] = useState<MarcheDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarcheDto | null>(null);
  const [form, setForm] = useState<CreateMarcheRequest>({ numeroMarche: "", dateSignature: "", montantContratTtc: 0, statut: "EN_COURS" });
  const [submitting, setSubmitting] = useState(false);

  const fetchMarches = async () => {
    setLoading(true);
    try {
      const data = await marcheApi.getAll();
      setMarches(data);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les marchés", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMarches(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ numeroMarche: "", dateSignature: "", montantContratTtc: 0, statut: "EN_COURS" });
    setDialogOpen(true);
  };

  const openEdit = (m: MarcheDto) => {
    setEditing(m);
    setForm({
      numeroMarche: m.numeroMarche || "",
      dateSignature: m.dateSignature || "",
      montantContratTtc: m.montantContratTtc || 0,
      statut: m.statut,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.numeroMarche?.trim()) {
      toast({ title: "Erreur", description: "Le numéro de marché est requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await marcheApi.update(editing.id, form);
        toast({ title: "Succès", description: "Marché mis à jour" });
      } else {
        await marcheApi.create(form);
        toast({ title: "Succès", description: "Marché créé" });
      }
      setDialogOpen(false);
      fetchMarches();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = marches.filter(m =>
    (m.numeroMarche || "").toLowerCase().includes(search.toLowerCase()) ||
    String(m.id).includes(search)
  );

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Gavel className="h-6 w-6 text-primary" />
              Marchés
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Gestion des marchés publics</p>
          </div>
          <div className="flex gap-2">
            {isAC && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Nouveau marché
              </Button>
            )}
            <Button variant="outline" onClick={fetchMarches} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un marché..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>N° Marché</TableHead>
                    <TableHead>Date signature</TableHead>
                    <TableHead>Montant TTC</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Demande liée</TableHead>
                    {isAC && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAC ? 7 : 6} className="text-center py-8 text-muted-foreground">Aucun marché</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">#{m.id}</TableCell>
                        <TableCell>{m.numeroMarche || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.dateSignature ? new Date(m.dateSignature).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell>{m.montantContratTtc?.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUT_COLORS[m.statut]}`}>
                            {MARCHE_STATUT_LABELS[m.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.demandeCorrectionId ? `DC #${m.demandeCorrectionId}` : "—"}
                        </TableCell>
                        {isAC && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                              <Edit className="h-4 w-4 mr-1" /> Modifier
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le marché" : "Nouveau marché"}</DialogTitle>
            <DialogDescription>
              {editing ? "Modifiez les informations du marché." : "Renseignez les informations du nouveau marché."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Numéro de marché *</Label>
              <Input value={form.numeroMarche} onChange={e => setForm(f => ({ ...f, numeroMarche: e.target.value }))} placeholder="MARC-2026-001" />
            </div>
            <div className="space-y-2">
              <Label>Date de signature</Label>
              <Input type="date" value={form.dateSignature} onChange={e => setForm(f => ({ ...f, dateSignature: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Montant contrat TTC</Label>
              <Input type="number" value={form.montantContratTtc || ""} onChange={e => setForm(f => ({ ...f, montantContratTtc: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={v => setForm(f => ({ ...f, statut: v as StatutMarche }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MARCHE_STATUT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Marches;
