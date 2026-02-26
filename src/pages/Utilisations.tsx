import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  utilisationCreditApi, UtilisationCreditDto, UtilisationStatut,
  UTILISATION_STATUT_LABELS,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, Search, RefreshCw, Loader2, CheckCircle, XCircle, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUT_COLORS: Record<UtilisationStatut, string> = {
  DEMANDEE: "bg-blue-100 text-blue-800",
  EN_VERIFICATION: "bg-yellow-100 text-yellow-800",
  VISE: "bg-purple-100 text-purple-800",
  VALIDEE: "bg-emerald-100 text-emerald-800",
  LIQUIDEE: "bg-green-100 text-green-800",
  APUREE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
};

const ROLE_TRANSITIONS: Record<string, { from: UtilisationStatut[]; to: UtilisationStatut; label: string }[]> = {
  DGD: [
    { from: ["DEMANDEE"], to: "EN_VERIFICATION", label: "Commencer vérification" },
    { from: ["EN_VERIFICATION"], to: "VISE", label: "Viser le bulletin" },
    { from: ["DEMANDEE", "EN_VERIFICATION"], to: "REJETEE", label: "Rejeter" },
  ],
  DGTCP: [
    { from: ["VISE"], to: "LIQUIDEE", label: "Imputer & liquider" },
    { from: ["DEMANDEE", "EN_VERIFICATION"], to: "VALIDEE", label: "Valider l'apurement" },
    { from: ["VALIDEE"], to: "APUREE", label: "Apurer" },
    { from: ["DEMANDEE", "EN_VERIFICATION", "VISE"], to: "REJETEE", label: "Rejeter" },
  ],
};

const Utilisations = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [data, setData] = useState<UtilisationCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [tab, setTab] = useState("all");

  const fetch = async () => {
    setLoading(true);
    try { setData(await utilisationCreditApi.getAll()); }
    catch { toast({ title: "Erreur", description: "Impossible de charger les utilisations", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleStatut = async (id: number, statut: UtilisationStatut) => {
    setActionLoading(id);
    try {
      await utilisationCreditApi.updateStatut(id, statut);
      toast({ title: "Succès", description: `Statut: ${UTILISATION_STATUT_LABELS[statut]}` });
      fetch();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const transitions = ROLE_TRANSITIONS[role] || [];

  const filtered = data.filter((u) => {
    const ms = (u.certificatReference || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.entrepriseNom || "").toLowerCase().includes(search.toLowerCase()) || String(u.id).includes(search);
    const matchStatut = filterStatut === "ALL" || u.statut === filterStatut;
    const matchTab = tab === "all" || u.type === tab;
    return ms && matchStatut && matchTab;
  });

  const pageTitle: Record<string, string> = {
    ENTREPRISE: "Mes utilisations de crédit",
    DGD: "Utilisations Douane – Vérification",
    DGTCP: "Utilisations – Imputation & apurement",
    DGI: "Utilisations – Consultation",
    ADMIN_SI: "Toutes les utilisations (Audit)",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Landmark className="h-6 w-6 text-primary" />
              {pageTitle[role] || "Utilisations de crédit"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Douane & Intérieur</p>
          </div>
          <Button variant="outline" onClick={fetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="DOUANE">Douane (P4)</TabsTrigger>
            <TabsTrigger value="INTERIEUR">Intérieur (P5)</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(UTILISATION_STATUT_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
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
                    <TableHead>#</TableHead>
                    <TableHead>Certificat</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune utilisation</TableCell></TableRow>
                  ) : filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">#{u.id}</TableCell>
                      <TableCell className="text-muted-foreground">{u.certificatReference || `Cert #${u.certificatCreditId}`}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{u.type || "—"}</Badge></TableCell>
                      <TableCell>{u.montant?.toLocaleString("fr-FR") || "—"} MRU</TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[u.statut]}`}>{UTILISATION_STATUT_LABELS[u.statut]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {transitions.map((t) =>
                            t.from.includes(u.statut) ? (
                              <Button key={t.to} variant={t.to === "REJETEE" ? "destructive" : "default"} size="sm" disabled={actionLoading === u.id} onClick={() => handleStatut(u.id, t.to)}>
                                {actionLoading === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
    </DashboardLayout>
  );
};

export default Utilisations;
