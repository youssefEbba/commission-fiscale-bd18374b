import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  certificatCreditApi, CertificatCreditDto, CertificatStatut,
  CERTIFICAT_STATUT_LABELS,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Search, RefreshCw, Eye, Loader2, CheckCircle, XCircle, Filter } from "lucide-react";

const STATUT_COLORS: Record<CertificatStatut, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EMIS: "bg-yellow-100 text-yellow-800",
  OUVERT: "bg-emerald-100 text-emerald-800",
  MODIFIE: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

const ROLE_TRANSITIONS: Record<string, { from: CertificatStatut[]; to: CertificatStatut; label: string }[]> = {
  DGTCP: [
    { from: ["DEMANDE"], to: "EMIS", label: "Émettre le certificat" },
    { from: ["EMIS"], to: "OUVERT", label: "Ouvrir le crédit" },
  ],
  PRESIDENT: [
    { from: ["EMIS", "OUVERT"], to: "OUVERT", label: "Valider & signer" },
    { from: ["DEMANDE", "EMIS"], to: "ANNULE", label: "Annuler" },
  ],
};

const Certificats = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selected, setSelected] = useState<CertificatCreditDto | null>(null);

  const fetchCertificats = async () => {
    setLoading(true);
    try {
      setCertificats(await certificatCreditApi.getAll());
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les certificats", variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCertificats(); }, []);

  const handleStatut = async (id: number, statut: CertificatStatut) => {
    setActionLoading(id);
    try {
      await certificatCreditApi.updateStatut(id, statut);
      toast({ title: "Succès", description: `Statut: ${CERTIFICAT_STATUT_LABELS[statut]}` });
      fetchCertificats();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const transitions = ROLE_TRANSITIONS[role] || [];

  const filtered = certificats.filter((c) => {
    const ms = (c.reference || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.entrepriseNom || "").toLowerCase().includes(search.toLowerCase()) ||
      String(c.id).includes(search);
    return ms && (filterStatut === "ALL" || c.statut === filterStatut);
  });

  const pageTitle: Record<string, string> = {
    AUTORITE_CONTRACTANTE: "Mes certificats",
    ENTREPRISE: "Mes certificats de crédit",
    DGTCP: "Certificats – Ouverture & ventilation",
    DGI: "Certificats – Contrôle fiscal",
    PRESIDENT: "Certificats en attente de signature",
    ADMIN_SI: "Tous les certificats (Audit)",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              {pageTitle[role] || "Certificats de crédit"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Processus P3 – Mise en place du crédit</p>
          </div>
          <Button variant="outline" onClick={fetchCertificats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(CERTIFICAT_STATUT_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
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
                    <TableHead>Réf.</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Douane</TableHead>
                    <TableHead>Intérieur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun certificat</TableCell></TableRow>
                  ) : filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.reference || `#${c.id}`}</TableCell>
                      <TableCell className="text-muted-foreground">{c.entrepriseNom || "—"}</TableCell>
                      <TableCell>{c.montantDouane?.toLocaleString("fr-FR") || "—"}</TableCell>
                      <TableCell>{c.montantInterieur?.toLocaleString("fr-FR") || "—"}</TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[c.statut]}`}>{CERTIFICAT_STATUT_LABELS[c.statut]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(c)}><Eye className="h-4 w-4 mr-1" /> Détail</Button>
                          {transitions.map((t) =>
                            t.from.includes(c.statut) ? (
                              <Button key={t.to} variant={t.to === "ANNULE" ? "destructive" : "default"} size="sm" disabled={actionLoading === c.id} onClick={() => handleStatut(c.id, t.to)}>
                                {actionLoading === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t.label}
                              </Button>
                            ) : null
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Certificat {selected?.reference || `#${selected?.id}`}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Entreprise</span><p className="font-medium">{selected.entrepriseNom || "—"}</p></div>
                <div><span className="text-muted-foreground">Statut</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{CERTIFICAT_STATUT_LABELS[selected.statut]}</Badge></p></div>
                <div><span className="text-muted-foreground">Composante Douane</span><p className="font-medium">{selected.montantDouane?.toLocaleString("fr-FR") || "0"} MRU</p></div>
                <div><span className="text-muted-foreground">Composante Intérieur</span><p className="font-medium">{selected.montantInterieur?.toLocaleString("fr-FR") || "0"} MRU</p></div>
                <div><span className="text-muted-foreground">Total</span><p className="font-bold text-primary">{selected.montantTotal?.toLocaleString("fr-FR") || "0"} MRU</p></div>
                <div><span className="text-muted-foreground">Date</span><p>{selected.dateCreation ? new Date(selected.dateCreation).toLocaleDateString("fr-FR") : "—"}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Certificats;
