import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { utilisateurApi, autoriteContractanteApi, entrepriseApi, UtilisateurDto, ROLE_LABELS, ROLE_OPTIONS, UpdateUtilisateurRequest, DemandeResetPasswordDto, DemandeResetStatut, AutoriteContractanteDto, EntrepriseDto } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Search, CheckCircle, XCircle, RefreshCw, Clock, UserPlus, Eye, EyeOff, Pencil, Trash2, KeyRound, MoreHorizontal, Check, X, MailCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const Utilisateurs = () => {
  const [users, setUsers] = useState<UtilisateurDto[]>([]);
  const [pending, setPending] = useState<UtilisateurDto[]>([]);
  const [resetRequests, setResetRequests] = useState<DemandeResetPasswordDto[]>([]);
  const [resetReqLoading, setResetReqLoading] = useState(false);
  const [resetStatusFilter, setResetStatusFilter] = useState<"ALL" | DemandeResetStatut>("EN_ATTENTE");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManageResetRequests = hasPermission("user.reset");
  const canAssignRole = hasPermission("user.role.assign");
  const canUpdate = hasPermission("user.update");
  const canDisable = hasPermission("user.disable");
  const [acList, setAcList] = useState<AutoriteContractanteDto[]>([]);
  const [entreprisesList, setEntreprisesList] = useState<EntrepriseDto[]>([]);
  const [showEditPwd, setShowEditPwd] = useState(false);

  // Reject reset request dialog
  const [rejectReqOpen, setRejectReqOpen] = useState(false);
  const [rejectReq, setRejectReq] = useState<DemandeResetPasswordDto | null>(null);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejectingReq, setRejectingReq] = useState(false);
  const [approvingReqId, setApprovingReqId] = useState<number | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", nomComplet: "", email: "", role: "" });
  const [acForm, setAcForm] = useState({ nom: "", sigle: "", adresse: "", telephone: "", email: "" });

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

  const fetchResetRequests = async (statut: "ALL" | DemandeResetStatut = resetStatusFilter) => {
    if (!canManageResetRequests) return;
    setResetReqLoading(true);
    try {
      const data = await utilisateurApi.listPasswordResetRequests(statut === "ALL" ? undefined : statut);
      // tri date décroissante (sécurité côté client)
      data.sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime());
      setResetRequests(data);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les demandes de réinitialisation", variant: "destructive" });
    } finally {
      setResetReqLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchResetRequests(resetStatusFilter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [resetStatusFilter, canManageResetRequests]);

  const handleApproveReset = async (req: DemandeResetPasswordDto) => {
    setApprovingReqId(req.id);
    try {
      await utilisateurApi.approvePasswordResetRequest(req.id);
      toast({ title: "Demande approuvée", description: "Un e-mail a été envoyé à l'utilisateur." });
      fetchResetRequests();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Approbation impossible", variant: "destructive" });
    } finally {
      setApprovingReqId(null);
    }
  };

  const openRejectReset = (req: DemandeResetPasswordDto) => {
    setRejectReq(req);
    setRejectMotif("");
    setRejectReqOpen(true);
  };

  const handleRejectReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReq) return;
    setRejectingReq(true);
    try {
      await utilisateurApi.rejectPasswordResetRequest(rejectReq.id, rejectMotif || undefined);
      toast({ title: "Demande refusée", description: "L'utilisateur a été notifié." });
      setRejectReqOpen(false);
      fetchResetRequests();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Refus impossible", variant: "destructive" });
    } finally {
      setRejectingReq(false);
    }
  };


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
    if (newUser.role === "AUTORITE_CONTRACTANTE" && !acForm.nom.trim()) {
      toast({ title: "Erreur", description: "Veuillez saisir le nom de l'Autorité Contractante", variant: "destructive" }); return;
    }
    setCreating(true);
    try {
      let autoriteContractanteId: number | undefined;
      if (newUser.role === "AUTORITE_CONTRACTANTE") {
        const ac = await autoriteContractanteApi.create({ nom: acForm.nom, sigle: acForm.sigle || undefined, adresse: acForm.adresse || undefined, telephone: acForm.telephone || undefined, email: acForm.email || undefined });
        autoriteContractanteId = ac.id;
      }
      await utilisateurApi.create({ username: newUser.username, password: newUser.password, role: newUser.role, nomComplet: newUser.nomComplet, email: newUser.email, autoriteContractanteId });
      toast({ title: "Succès", description: "Compte créé avec succès" });
      setNewUser({ username: "", password: "", nomComplet: "", email: "", role: "" });
      setAcForm({ nom: "", sigle: "", adresse: "", telephone: "", email: "" });
      setCreateOpen(false);
      await fetchAll();
    } catch (err: any) {
      const msg = err?.message || "Impossible de créer le compte";
      console.error("Create user error:", err);
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const AC_ROLES = ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP"];
  const ENT_ROLES = ["ENTREPRISE", "SOUS_TRAITANT"];

  const openEdit = async (u: UtilisateurDto) => {
    setEditUser(u);
    setEditForm({
      nomComplet: u.nomComplet || "",
      email: u.email || "",
      autoriteContractanteId: u.autoriteContractanteId ?? undefined,
      entrepriseId: u.entrepriseId ?? undefined,
      newPassword: "",
    });
    setShowEditPwd(false);
    setEditOpen(true);
    // Charger les référentiels en parallèle si pas déjà chargés
    try {
      const [acs, ents] = await Promise.allSettled([
        acList.length ? Promise.resolve(acList) : autoriteContractanteApi.getAll(),
        entreprisesList.length ? Promise.resolve(entreprisesList) : entrepriseApi.getAll(),
      ]);
      if (acs.status === "fulfilled") setAcList(acs.value);
      if (ents.status === "fulfilled") setEntreprisesList(ents.value);
    } catch { /* silencieux */ }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    const role = editUser.role;
    // Validation rattachement
    if (AC_ROLES.includes(role) && !editForm.autoriteContractanteId) {
      toast({ title: "Erreur", description: "Une Autorité Contractante est requise pour ce rôle.", variant: "destructive" });
      return;
    }
    if (ENT_ROLES.includes(role) && !editForm.entrepriseId) {
      toast({ title: "Erreur", description: "Une entreprise est requise pour ce rôle.", variant: "destructive" });
      return;
    }
    // Construire le payload — n'envoyer que les champs renseignés/modifiés
    // Le rôle est figé après création et n'est plus modifiable via cet endpoint
    const payload: UpdateUtilisateurRequest = {};
    if ((editForm.nomComplet || "") !== (editUser.nomComplet || "")) payload.nomComplet = editForm.nomComplet || "";
    if ((editForm.email || "") !== (editUser.email || "")) payload.email = editForm.email || "";
    if (AC_ROLES.includes(role)) payload.autoriteContractanteId = editForm.autoriteContractanteId ?? null;
    if (ENT_ROLES.includes(role)) payload.entrepriseId = editForm.entrepriseId ?? null;
    if (editForm.newPassword && editForm.newPassword.trim().length > 0) {
      if (editForm.newPassword.length < 8) {
        toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 8 caractères.", variant: "destructive" });
        return;
      }
      payload.newPassword = editForm.newPassword;
    }
    if (Object.keys(payload).length === 0) {
      toast({ title: "Aucune modification", description: "Aucun champ n'a été modifié." });
      return;
    }
    setEditing(true);
    try {
      await utilisateurApi.update(editUser.id, payload);
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

  const filtered = users.filter((u) => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.nomComplet?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchStatus = statusFilter === "ALL" || (statusFilter === "ACTIF" ? u.actif : !u.actif);
    return matchSearch && matchRole && matchStatus;
  });

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter, pageSize]);

  const UserTable = ({ data, paginated = false }: { data: UtilisateurDto[]; paginated?: boolean }) => {
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageData = paginated ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize) : data;
    const from = data.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, data.length);
    return (
      <div className="space-y-3">
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
              {pageData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun utilisateur trouvé</TableCell>
                </TableRow>
              ) : (
                pageData.map((u) => (
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
                          <DropdownMenuItem onClick={() => toggleActif(u.id, !u.actif)} disabled={toggling === u.id}>
                            {u.actif ? <><XCircle className="h-4 w-4 mr-2" /> Désactiver</> : <><CheckCircle className="h-4 w-4 mr-2" /> Activer</>}
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
        {paginated && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
            <div className="text-muted-foreground">
              {data.length === 0 ? "Aucun résultat" : `Affichage ${from}–${to} sur ${data.length}`}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Par page</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(1)}>«</Button>
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>‹</Button>
                <span className="px-2 text-muted-foreground">Page {currentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>›</Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)}>»</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


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
                  {newUser.role === "AUTORITE_CONTRACTANTE" && (
                    <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
                      <p className="text-sm font-medium text-foreground">Informations de l'Autorité Contractante</p>
                      <div className="space-y-2">
                        <Label>Nom de l'AC *</Label>
                        <Input value={acForm.nom} onChange={(e) => setAcForm((p) => ({ ...p, nom: e.target.value }))} placeholder="Ex: Ministère de l'Économie" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Sigle</Label>
                        <Input value={acForm.sigle} onChange={(e) => setAcForm((p) => ({ ...p, sigle: e.target.value }))} placeholder="Ex: ME" />
                      </div>
                      <div className="space-y-2">
                        <Label>Adresse</Label>
                        <Input value={acForm.adresse} onChange={(e) => setAcForm((p) => ({ ...p, adresse: e.target.value }))} placeholder="Adresse" />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input value={acForm.telephone} onChange={(e) => setAcForm((p) => ({ ...p, telephone: e.target.value }))} placeholder="Téléphone" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email AC</Label>
                        <Input type="email" value={acForm.email} onChange={(e) => setAcForm((p) => ({ ...p, email: e.target.value }))} placeholder="contact@ac.mr" />
                      </div>
                    </div>
                  )}
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
            {canManageResetRequests && (
              <TabsTrigger value="reset">
                <KeyRound className="h-3 w-3 mr-1" /> Demandes de reset ({resetRequests.length})
              </TabsTrigger>
            )}
          </TabsList>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher un utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les rôles</SelectItem>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="ACTIF">Actif</SelectItem>
                <SelectItem value="INACTIF">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TabsContent value="all" className="mt-4"><UserTable data={filtered} paginated /></TabsContent>
          <TabsContent value="pending" className="mt-4"><UserTable data={pending} /></TabsContent>

          {canManageResetRequests && (
            <TabsContent value="reset" className="mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <Tabs value={resetStatusFilter} onValueChange={(v) => setResetStatusFilter(v as "ALL" | DemandeResetStatut)}>
                  <TabsList>
                    <TabsTrigger value="ALL">Toutes</TabsTrigger>
                    <TabsTrigger value="EN_ATTENTE">En attente</TabsTrigger>
                    <TabsTrigger value="APPROUVEE">Approuvées</TabsTrigger>
                    <TabsTrigger value="REFUSEE">Refusées</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">{resetRequests.length} demande(s)</p>
                  <Button variant="outline" size="sm" onClick={() => fetchResetRequests()} disabled={resetReqLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${resetReqLoading ? "animate-spin" : ""}`} /> Actualiser
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identifiant</TableHead>
                      <TableHead>Nom complet</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Demandé le</TableHead>
                      <TableHead>Traité le</TableHead>
                      <TableHead>Traité par</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resetRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Aucune demande
                        </TableCell>
                      </TableRow>
                    ) : (
                      resetRequests.map((r) => {
                        const statutBadge = r.statut === "EN_ATTENTE"
                          ? <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"><Clock className="h-3 w-3 mr-1" /> En attente</Badge>
                          : r.statut === "APPROUVEE"
                            ? <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10"><CheckCircle className="h-3 w-3 mr-1" /> Approuvée</Badge>
                            : <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10"><XCircle className="h-3 w-3 mr-1" /> Refusée</Badge>;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-muted-foreground">{r.username}</TableCell>
                            <TableCell className="font-medium text-foreground">{r.nomComplet || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{r.email || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {r.dateCreation ? new Date(r.dateCreation).toLocaleString("fr-FR") : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {r.dateTraitement ? new Date(r.dateTraitement).toLocaleString("fr-FR") : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {r.traiteParUsername || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {statutBadge}
                                {r.statut === "REFUSEE" && r.motifRefus && (
                                  <span className="text-xs text-muted-foreground italic" title={r.motifRefus}>
                                    {r.motifRefus.length > 40 ? r.motifRefus.slice(0, 40) + "…" : r.motifRefus}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {r.statut === "EN_ATTENTE" ? (
                                <div className="inline-flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveReset(r)}
                                    disabled={approvingReqId === r.id}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                  >
                                    {approvingReqId === r.id
                                      ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> ...</>
                                      : <><MailCheck className="h-3 w-3 mr-1" /> Approuver</>}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openRejectReset(r)}
                                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                  >
                                    <X className="h-3 w-3 mr-1" /> Refuser
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier l'utilisateur</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Identifiant</Label>
              <Input value={editUser?.username || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={editForm.nomComplet || ""} onChange={(e) => setEditForm((p) => ({ ...p, nomComplet: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email || ""} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Input value={ROLE_OPTIONS.find((r) => r.value === editUser?.role)?.label || editUser?.role || ""} disabled readOnly />
              <p className="text-xs text-muted-foreground">Le rôle est figé à la création et ne peut pas être modifié.</p>
            </div>
            {AC_ROLES.includes(editUser?.role || "") && (
              <div className="space-y-2">
                <Label>Autorité Contractante *</Label>
                <Select
                  value={editForm.autoriteContractanteId ? String(editForm.autoriteContractanteId) : ""}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, autoriteContractanteId: Number(v) }))}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionnez une AC" /></SelectTrigger>
                  <SelectContent>
                    {acList.map((ac) => (
                      <SelectItem key={ac.id} value={String(ac.id)}>{ac.nom}{ac.sigle ? ` (${ac.sigle})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {ENT_ROLES.includes(editUser?.role || "") && (
              <div className="space-y-2">
                <Label>Entreprise *</Label>
                <Select
                  value={editForm.entrepriseId ? String(editForm.entrepriseId) : ""}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, entrepriseId: Number(v) }))}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionnez une entreprise" /></SelectTrigger>
                  <SelectContent>
                    {entreprisesList.map((ent) => (
                      <SelectItem key={ent.id} value={String(ent.id)}>{ent.raisonSociale}{ent.nif ? ` — ${ent.nif}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nouveau mot de passe (optionnel)</Label>
              <div className="relative">
                <Input
                  type={showEditPwd ? "text" : "password"}
                  value={editForm.newPassword || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Laisser vide pour ne pas changer"
                  minLength={8}
                />
                <button type="button" onClick={() => setShowEditPwd(!showEditPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showEditPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={editing || !canUpdate}>{editing ? "Enregistrement..." : "Enregistrer"}</Button>
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

      {/* Reject reset request dialog */}
      <Dialog open={rejectReqOpen} onOpenChange={setRejectReqOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Refuser la demande de réinitialisation</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Refuser la demande de <strong>{rejectReq?.nomComplet || rejectReq?.username}</strong>.
          </p>
          <form onSubmit={handleRejectReset} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Motif (optionnel)</Label>
              <Textarea
                value={rejectMotif}
                onChange={(e) => setRejectMotif(e.target.value)}
                placeholder="Ex: identité non vérifiée"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectReqOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={rejectingReq} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {rejectingReq ? "Refus..." : "Confirmer le refus"}
              </Button>
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
