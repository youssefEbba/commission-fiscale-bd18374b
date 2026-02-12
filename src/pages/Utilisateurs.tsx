import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { utilisateurApi, UtilisateurDto, ROLE_LABELS, ROLE_OPTIONS, UpdateUtilisateurRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Search, CheckCircle, XCircle, RefreshCw, Clock, UserPlus, Eye, EyeOff, Pencil, Trash2, KeyRound, MoreHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const Utilisateurs = () => {
  const [users, setUsers] = useState<UtilisateurDto[]>([]);
  const [pending, setPending] = useState<UtilisateurDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const { toast } = useToast();

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", nomComplet: "", email: "", role: "" });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editUser, setEditUser] = useState<UtilisateurDto | null>(null);
  const [editForm, setEditForm] = useState<UpdateUtilisateurRequest>({});

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UtilisateurDto | null>(null);

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetUser, setResetUser] = useState<UtilisateurDto | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPwd, setShowResetPwd] = useState(false);

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

  useEffect(() => { fetchAll(); }, []);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.role) { toast({ title: "Erreur", description: "Veuillez sélectionner un rôle", variant: "destructive" }); return; }
    setCreating(true);
    try {
      await utilisateurApi.create({ username: newUser.username, password: newUser.password, role: newUser.role, nomComplet: newUser.nomComplet, email: newUser.email });
      toast({ title: "Succès", description: "Compte créé avec succès" });
      setNewUser({ username: "", password: "", nomComplet: "", email: "", role: "" });
      setCreateOpen(false);
      await fetchAll();
    } catch (err: any) {
      const msg = err?.message || "Impossible de créer le compte";
      console.error("Create user error:", err);
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const openEdit = (u: UtilisateurDto) => {
    setEditUser(u);
    setEditForm({ username: u.username, nomComplet: u.nomComplet, email: u.email, role: u.role });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditing(true);
    try {
      await utilisateurApi.update(editUser.id, editForm);
      toast({ title: "Succès", description: "Utilisateur modifié" });
      setEditOpen(false);
      fetchAll();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible de modifier", variant: "destructive" });
    } finally { setEditing(false); }
  };

  const openDelete = (u: UtilisateurDto) => { setDeleteUser(u); setDeleteOpen(true); };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await utilisateurApi.delete(deleteUser.id);
      toast({ title: "Succès", description: "Utilisateur supprimé" });
      setDeleteOpen(false);
      fetchAll();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible de supprimer", variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const openReset = (u: UtilisateurDto) => { setResetUser(u); setResetPassword(""); setShowResetPwd(false); setResetOpen(true); };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !resetPassword) return;
    setResetting(true);
    try {
      await utilisateurApi.resetPassword(resetUser.id, resetPassword);
      toast({ title: "Succès", description: "Mot de passe réinitialisé" });
      setResetOpen(false);
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible de réinitialiser", variant: "destructive" });
    } finally { setResetting(false); }
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
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun utilisateur trouvé</TableCell>
            </TableRow>
          ) : (
            data.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">{u.nomComplet || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{ROLE_LABELS[u.role] || u.role}</Badge>
                </TableCell>
                <TableCell>
                  {u.actif ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20"><CheckCircle className="h-3 w-3 mr-1" /> Actif</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> Inactif</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4 mr-2" /> Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openReset(u)}>
                        <KeyRound className="h-4 w-4 mr-2" /> Réinitialiser MDP
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActif(u.id, !u.actif)} disabled={toggling === u.id}>
                        {u.actif ? <><XCircle className="h-4 w-4 mr-2" /> Désactiver</> : <><CheckCircle className="h-4 w-4 mr-2" /> Activer</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openDelete(u)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            <p className="text-muted-foreground text-sm mt-1">Créez, modifiez et gérez les comptes utilisateurs</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <UserPlus className="h-4 w-4 mr-2" /> Créer un compte
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Créer un nouveau compte</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Nom complet</Label>
                    <Input value={newUser.nomComplet} onChange={(e) => setNewUser((p) => ({ ...p, nomComplet: e.target.value }))} placeholder="Prénom et nom" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} placeholder="utilisateur@email.mr" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Identifiant</Label>
                    <Input value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} placeholder="Identifiant de connexion" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Select value={newUser.role} onValueChange={(v) => setNewUser((p) => ({ ...p, role: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionnez un rôle" /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mot de passe</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} placeholder="••••••••" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={creating || !newUser.role}>
                    <UserPlus className="h-4 w-4 mr-2" />{creating ? "Création..." : "Créer le compte"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Tous ({users.length})</TabsTrigger>
            <TabsTrigger value="pending"><Clock className="h-3 w-3 mr-1" /> En attente ({pending.length})</TabsTrigger>
          </TabsList>
          <div className="mt-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher un utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <TabsContent value="all" className="mt-4"><UserTable data={filtered} /></TabsContent>
          <TabsContent value="pending" className="mt-4"><UserTable data={pending} /></TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Modifier l'utilisateur</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={editForm.nomComplet || ""} onChange={(e) => setEditForm((p) => ({ ...p, nomComplet: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email || ""} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Identifiant</Label>
              <Input value={editForm.username || ""} onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={editForm.role || ""} onValueChange={(v) => setEditForm((p) => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={editing}>{editing ? "Enregistrement..." : "Enregistrer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Réinitialiser le mot de passe</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Nouveau mot de passe pour <strong>{resetUser?.nomComplet || resetUser?.username}</strong></p>
          <form onSubmit={handleReset} className="space-y-4 mt-2">
            <div className="relative">
              <Input type={showResetPwd ? "text" : "password"} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Nouveau mot de passe" required minLength={6} />
              <button type="button" onClick={() => setShowResetPwd(!showResetPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showResetPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={resetting || !resetPassword}>{resetting ? "Réinitialisation..." : "Réinitialiser"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteUser?.nomComplet || deleteUser?.username}</strong> ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Utilisateurs;
