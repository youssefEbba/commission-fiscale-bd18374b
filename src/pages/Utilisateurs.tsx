import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { utilisateurApi, UtilisateurDto, ROLE_LABELS, ROLE_OPTIONS } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Search, CheckCircle, XCircle, RefreshCw, Clock, UserPlus, Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Utilisateurs = () => {
  const [users, setUsers] = useState<UtilisateurDto[]>([]);
  const [pending, setPending] = useState<UtilisateurDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    nomComplet: "",
    email: "",
    role: "",
  });
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [allUsers, pendingUsers] = await Promise.all([
        utilisateurApi.getAll(),
        utilisateurApi.getPending(),
      ]);
      setUsers(allUsers);
      setPending(pendingUsers);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les utilisateurs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const toggleActif = async (id: number, actif: boolean) => {
    setToggling(id);
    try {
      await utilisateurApi.setActif(id, actif);
      toast({ title: "Succès", description: `Utilisateur ${actif ? "activé" : "désactivé"}` });
      fetchAll();
    } catch {
      toast({ title: "Erreur", description: "Impossible de modifier le statut", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.role) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un rôle", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await utilisateurApi.create({
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        nomComplet: newUser.nomComplet,
        email: newUser.email,
      });
      toast({ title: "Succès", description: "Compte utilisateur créé avec succès" });
      setNewUser({ username: "", password: "", nomComplet: "", email: "", role: "" });
      setDialogOpen(false);
      fetchAll();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de créer le compte",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.nomComplet?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const UserTable = ({ data }: { data: UtilisateurDto[] }) => (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom complet</TableHead>
            <TableHead>Identifiant</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Aucun utilisateur trouvé
              </TableCell>
            </TableRow>
          ) : (
            data.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">{u.nomComplet || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {ROLE_LABELS[u.role] || u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.actif ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <CheckCircle className="h-3 w-3 mr-1" /> Actif
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <XCircle className="h-3 w-3 mr-1" /> Inactif
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant={u.actif ? "outline" : "default"}
                    size="sm"
                    disabled={toggling === u.id}
                    onClick={() => toggleActif(u.id, !u.actif)}
                    className={u.actif ? "" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                  >
                    {toggling === u.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : u.actif ? (
                      "Désactiver"
                    ) : (
                      "Activer"
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Gestion des utilisateurs
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Créez, gérez les comptes et attribuez les rôles
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Créer un compte
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Créer un nouveau compte</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-nomComplet">Nom complet</Label>
                    <Input
                      id="new-nomComplet"
                      value={newUser.nomComplet}
                      onChange={(e) => setNewUser((p) => ({ ...p, nomComplet: e.target.value }))}
                      placeholder="Prénom et nom"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-email">Email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                      placeholder="utilisateur@email.mr"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-username">Identifiant</Label>
                    <Input
                      id="new-username"
                      value={newUser.username}
                      onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                      placeholder="Identifiant de connexion"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-role">Rôle</Label>
                    <Select value={newUser.role} onValueChange={(v) => setNewUser((p) => ({ ...p, role: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        value={newUser.password}
                        onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={creating || !newUser.role}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {creating ? "Création..." : "Créer le compte"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">
              Tous ({users.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              <Clock className="h-3 w-3 mr-1" />
              En attente ({pending.length})
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un utilisateur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <TabsContent value="all" className="mt-4">
            <UserTable data={filtered} />
          </TabsContent>
          <TabsContent value="pending" className="mt-4">
            <UserTable data={pending} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Utilisateurs;
