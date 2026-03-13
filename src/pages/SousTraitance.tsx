import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  sousTraitanceApi, SousTraitanceDto, StatutSousTraitance,
  SousTraitanceOnboardingRequest, SOUS_TRAITANCE_STATUT_LABELS,
  SOUS_TRAITANCE_DOCUMENT_TYPES, TypeDocumentSousTraitance, DocumentSousTraitanceDto,
  certificatCreditApi, CertificatCreditDto,
  entrepriseApi, EntrepriseDto,
  utilisateurApi, UtilisateurDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Handshake, Search, RefreshCw, Loader2, Plus, Eye, Filter, Upload, FileText, CheckCircle2, XCircle, UserPlus, Building2, User } from "lucide-react";
import DocumentGED from "@/components/ged/DocumentGED";

const STATUT_COLORS: Record<StatutSousTraitance, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_COURS: "bg-yellow-100 text-yellow-800",
  AUTORISEE: "bg-green-100 text-green-800",
  REFUSEE: "bg-red-100 text-red-800",
};

const SousTraitance = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [data, setData] = useState<SousTraitanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Onboarding dialog
  const [showCreate, setShowCreate] = useState(false);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [createNewEntreprise, setCreateNewEntreprise] = useState(false);
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState<number | null>(null);
  const [entrepriseUsers, setEntrepriseUsers] = useState<UtilisateurDto[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [form, setForm] = useState<Partial<SousTraitanceOnboardingRequest>>({});
  const [creating, setCreating] = useState(false);

  // Document uploads in creation
  const [createDocContrat, setCreateDocContrat] = useState<File | null>(null);
  const [createDocLettre, setCreateDocLettre] = useState<File | null>(null);

  // Detail dialog
  const [selected, setSelected] = useState<SousTraitanceDto | null>(null);

  // Document dialog
  const [docDialog, setDocDialog] = useState<number | null>(null);
  const [docs, setDocs] = useState<DocumentSousTraitanceDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try { setData(await sousTraitanceApi.getAll()); }
    catch { toast({ title: "Erreur", description: "Impossible de charger les sous-traitances", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = async () => {
    setForm({ contratEnregistre: true });
    setCreateNewEntreprise(false);
    setSelectedEntrepriseId(null);
    setSelectedUserId(null);
    setEntrepriseUsers([]);
    setCreateDocContrat(null);
    setCreateDocLettre(null);

    const certsPromise = role === "ENTREPRISE" && user?.entrepriseId
      ? certificatCreditApi.getByEntreprise(user.entrepriseId)
      : certificatCreditApi.getAll();

    const [certsResult, entsResult] = await Promise.allSettled([
      certsPromise,
      entrepriseApi.getAll(),
    ]);

    if (certsResult.status === "fulfilled") {
      setCertificats(certsResult.value.filter((c) => c.statut === "OUVERT"));
    } else {
      setCertificats([]);
      const certsError = certsResult.reason instanceof Error ? certsResult.reason.message : "Erreur inconnue";
      toast({ title: "Erreur", description: `Impossible de charger les certificats: ${certsError}`, variant: "destructive" });
    }

    if (entsResult.status === "fulfilled") {
      // Exclure l'entreprise connectée (on ne peut pas sous-traiter à soi-même)
      const filtered = user?.entrepriseId
        ? entsResult.value.filter((e: EntrepriseDto) => e.id !== user.entrepriseId)
        : entsResult.value;
      setEntreprises(filtered);
    } else {
      setEntreprises([]);
      setCreateNewEntreprise(true);

      const entsError = entsResult.reason instanceof Error ? entsResult.reason.message : "Erreur inconnue";
      const isAccessDenied = entsError.toLowerCase().includes("accès refusé") || entsError.toLowerCase().includes("access denied");

      toast({
        title: isAccessDenied ? "Permissions insuffisantes" : "Erreur",
        description: isAccessDenied
          ? "Votre profil ne peut pas lister les entreprises. Demandez l'ajout de la permission entreprise.list au rôle ENTREPRISE pour sélectionner une entreprise existante."
          : `Impossible de charger les entreprises: ${entsError}`,
        variant: "destructive",
      });
    }

    setShowCreate(true);
  };

  // Load users when enterprise is selected
  const [usersAccessDenied, setUsersAccessDenied] = useState(false);

  const handleSelectEntreprise = async (entrepriseId: number) => {
    setSelectedEntrepriseId(entrepriseId);
    setSelectedUserId(null);
    setEntrepriseUsers([]);
    setUsersAccessDenied(false);
    setLoadingUsers(true);
    try {
      const users = await utilisateurApi.getByEntreprise(entrepriseId);
      setEntrepriseUsers(users);
    } catch (err1) {
      // Fallback: try getAll and filter by entrepriseId
      try {
        const allUsers = await utilisateurApi.getAll();
        const filtered = allUsers.filter((u) => u.entrepriseId === entrepriseId);
        setEntrepriseUsers(filtered);
      } catch {
        setEntrepriseUsers([]);
        setUsersAccessDenied(true);
        toast({
          title: "Permission manquante",
          description: "Impossible de charger les utilisateurs de cette entreprise. Vous pouvez créer une nouvelle entreprise avec son utilisateur.",
          variant: "destructive",
        });
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreate = async () => {
    const f2 = { ...form };

    if (!f2.certificatCreditId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un certificat", variant: "destructive" });
      return;
    }

    let createdSousTraitance: SousTraitanceDto | null = null;

    if (!createNewEntreprise) {
      // Use existing enterprise + existing user → use create API
      if (!selectedEntrepriseId) {
        toast({ title: "Erreur", description: "Veuillez sélectionner une entreprise", variant: "destructive" });
        return;
      }
      if (!selectedUserId) {
        toast({ title: "Erreur", description: "Veuillez sélectionner un utilisateur sous-traitant", variant: "destructive" });
        return;
      }
      setCreating(true);
      try {
        createdSousTraitance = await sousTraitanceApi.create({
          certificatCreditId: f2.certificatCreditId,
          sousTraitantUserId: selectedUserId,
          contratEnregistre: f2.contratEnregistre,
          volumes: f2.volumes,
          quantites: f2.quantites,
        });
      } catch (e: any) {
        toast({ title: "Erreur", description: e.message, variant: "destructive" });
        setCreating(false);
        return;
      }
    } else {
      // Create new enterprise + user → use onboard API
      const { sousTraitantEntrepriseRaisonSociale, sousTraitantEntrepriseNif, sousTraitantUsername, sousTraitantPassword } = f2;
      if (!sousTraitantEntrepriseRaisonSociale || !sousTraitantEntrepriseNif) {
        toast({ title: "Erreur", description: "Veuillez remplir la raison sociale et le NIF", variant: "destructive" });
        return;
      }
      if (!sousTraitantUsername || !sousTraitantPassword) {
        toast({ title: "Erreur", description: "Veuillez remplir le nom d'utilisateur et le mot de passe", variant: "destructive" });
        return;
      }
      setCreating(true);
      try {
        const result = await sousTraitanceApi.onboard(f2 as SousTraitanceOnboardingRequest);
        createdSousTraitance = result.sousTraitance;
      } catch (e: any) {
        toast({ title: "Erreur", description: e.message, variant: "destructive" });
        setCreating(false);
        return;
      }
    }

    // Upload documents if provided
    if (createdSousTraitance) {
      try {
        if (createDocContrat) {
          await sousTraitanceApi.uploadDocument(createdSousTraitance.id, "CONTRAT_SOUS_TRAITANCE_ENREGISTRE", createDocContrat);
        }
        if (createDocLettre) {
          await sousTraitanceApi.uploadDocument(createdSousTraitance.id, "LETTRE_SOUS_TRAITANCE", createDocLettre);
        }
      } catch (e: any) {
        toast({ title: "Attention", description: "Sous-traitance créée mais erreur lors de l'upload des documents: " + e.message, variant: "destructive" });
      }
    }

    toast({ title: "Succès", description: "Sous-traitance créée et demande soumise" });
    setShowCreate(false);
    setCreating(false);
    fetchData();
  };

  const handleAutoriser = async (id: number) => {
    setActionLoading(id);
    try {
      await sousTraitanceApi.autoriser(id);
      toast({ title: "Succès", description: "Sous-traitance autorisée" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const handleRefuser = async (id: number) => {
    setActionLoading(id);
    try {
      await sousTraitanceApi.refuser(id);
      toast({ title: "Succès", description: "Sous-traitance refusée" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const openDocs = async (id: number) => {
    setDocDialog(id);
    setDocsLoading(true);
    try { setDocs(await sousTraitanceApi.getDocuments(id)); } catch { setDocs([]); }
    finally { setDocsLoading(false); }
  };

  const refreshDocs = async (id: number) => {
    try { setDocs(await sousTraitanceApi.getDocuments(id)); } catch { /* ignore */ }
  };

  const handleGEDUpload = async (dossierId: number, type: string, file: File) => {
    await sousTraitanceApi.uploadDocument(dossierId, type as TypeDocumentSousTraitance, file);
  };

  const filtered = data.filter((t) => {
    const ms = (t.certificatNumero || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.sousTraitantUsername || "").toLowerCase().includes(search.toLowerCase()) ||
      String(t.id).includes(search);
    const matchStatut = filterStatut === "ALL" || t.statut === filterStatut;
    return ms && matchStatut;
  });

  const canCreate = role === "ENTREPRISE";
  const canValidate = role === "DGTCP";
  const f = (v: any) => v != null ? Number(v).toLocaleString("fr-FR") : "—";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Handshake className="h-6 w-6 text-primary" />
              Sous-traitance
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Gestion des autorisations de sous-traitance</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreate}><UserPlus className="h-4 w-4 mr-2" /> Nouvelle sous-traitance</Button>
            )}
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
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
              {Object.entries(SOUS_TRAITANCE_STATUT_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
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
                    <TableHead>Sous-traitant</TableHead>
                    <TableHead>Volumes</TableHead>
                    <TableHead>Quantités</TableHead>
                    <TableHead>Contrat enregistré</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date autorisation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune sous-traitance</TableCell></TableRow>
                  ) : filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">#{t.id}</TableCell>
                      <TableCell className="text-muted-foreground">{t.certificatNumero || `Cert #${t.certificatCreditId}`}</TableCell>
                      <TableCell>{t.sousTraitantUsername || `User #${t.sousTraitantUserId}`}</TableCell>
                      <TableCell>{f(t.volumes)}</TableCell>
                      <TableCell>{f(t.quantites)}</TableCell>
                      <TableCell>
                        <Badge variant={t.contratEnregistre ? "default" : "outline"} className="text-xs">
                          {t.contratEnregistre ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge className={`text-xs ${STATUT_COLORS[t.statut]}`}>{SOUS_TRAITANCE_STATUT_LABELS[t.statut]}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.dateAutorisation ? new Date(t.dateAutorisation).toLocaleDateString("fr-FR") : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(t)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openDocs(t.id)}><FileText className="h-4 w-4" /></Button>
                          {canValidate && t.statut === "DEMANDE" && (
                            <>
                              <Button size="sm" disabled={actionLoading === t.id} onClick={() => handleAutoriser(t.id)}>
                                {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                Autoriser
                              </Button>
                              <Button variant="destructive" size="sm" disabled={actionLoading === t.id} onClick={() => handleRefuser(t.id)}>
                                {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                                Refuser
                              </Button>
                            </>
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

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Sous-traitance #{selected?.id}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Certificat</span><p className="font-medium">{selected.certificatNumero || `#${selected.certificatCreditId}`}</p></div>
                <div><span className="text-muted-foreground">Sous-traitant</span><p className="font-medium">{selected.sousTraitantUsername || `#${selected.sousTraitantUserId}`}</p></div>
                <div><span className="text-muted-foreground">Volumes</span><p className="font-medium">{f(selected.volumes)}</p></div>
                <div><span className="text-muted-foreground">Quantités</span><p className="font-medium">{f(selected.quantites)}</p></div>
                <div><span className="text-muted-foreground">Contrat enregistré</span><p className="font-medium">{selected.contratEnregistre ? "Oui" : "Non"}</p></div>
                <div><span className="text-muted-foreground">Statut</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{SOUS_TRAITANCE_STATUT_LABELS[selected.statut]}</Badge></p></div>
                <div><span className="text-muted-foreground">Date autorisation</span><p className="font-medium">{selected.dateAutorisation ? new Date(selected.dateAutorisation).toLocaleDateString("fr-FR") : "—"}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Onboarding dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Nouvelle sous-traitance</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Certificat */}
            <div>
              <Label>Certificat source (OUVERT) *</Label>
              <Select value={form.certificatCreditId ? String(form.certificatCreditId) : ""} onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un certificat" /></SelectTrigger>
                <SelectContent>
                  {certificats.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.reference || c.numero || `Cert #${c.id}`} — Solde: {f(c.soldeCordon)} MRU
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entreprise sous-traitante */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Entreprise sous-traitante
                </h4>
                <Button
                  type="button"
                  variant={createNewEntreprise ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCreateNewEntreprise(!createNewEntreprise);
                    if (!createNewEntreprise) {
                      setSelectedEntrepriseId(null);
                      setSelectedUserId(null);
                      setEntrepriseUsers([]);
                    } else {
                      setForm({ ...form, sousTraitantEntrepriseRaisonSociale: undefined, sousTraitantEntrepriseNif: undefined, sousTraitantEntrepriseAdresse: undefined, sousTraitantEntrepriseSituationFiscale: undefined, sousTraitantUsername: undefined, sousTraitantPassword: undefined, sousTraitantNomComplet: undefined, sousTraitantEmail: undefined });
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {createNewEntreprise ? "Sélectionner existante" : "Créer nouvelle"}
                </Button>
              </div>

              {!createNewEntreprise ? (
                <div className="space-y-3">
                  <div>
                    <Label>Sélectionner une entreprise existante *</Label>
                    <Select value={selectedEntrepriseId ? String(selectedEntrepriseId) : ""} onValueChange={(v) => handleSelectEntreprise(Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Choisir une entreprise" /></SelectTrigger>
                      <SelectContent>
                        {entreprises.map((e) => (
                          <SelectItem key={e.id} value={String(e.id!)}>
                            {e.raisonSociale} — NIF: {e.nif}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* User selection from enterprise */}
                  {selectedEntrepriseId && (
                    <div>
                      <Label className="flex items-center gap-2">
                        <User className="h-4 w-4" /> Utilisateur sous-traitant *
                      </Label>
                      {loadingUsers ? (
                        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des utilisateurs...
                        </div>
                      ) : entrepriseUsers.length === 0 ? (
                        <div className="text-sm py-2">
                          <p className="text-muted-foreground">
                            {usersAccessDenied
                              ? "Accès refusé. Utilisez « Créer nouvelle » pour ajouter l'entreprise et son utilisateur."
                              : "Aucun utilisateur trouvé pour cette entreprise. L'entreprise n'a pas encore d'utilisateur associé."}
                          </p>
                        </div>
                      ) : (
                        <Select value={selectedUserId ? String(selectedUserId) : ""} onValueChange={(v) => setSelectedUserId(Number(v))}>
                          <SelectTrigger><SelectValue placeholder="Choisir un utilisateur" /></SelectTrigger>
                          <SelectContent>
                            {entrepriseUsers.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.nomComplet || u.username} — {u.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Raison sociale *</Label>
                      <Input value={form.sousTraitantEntrepriseRaisonSociale ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseRaisonSociale: e.target.value })} />
                    </div>
                    <div>
                      <Label>NIF *</Label>
                      <Input value={form.sousTraitantEntrepriseNif ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseNif: e.target.value })} />
                    </div>
                    <div>
                      <Label>Adresse</Label>
                      <Input value={form.sousTraitantEntrepriseAdresse ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEntrepriseAdresse: e.target.value })} />
                    </div>
                    <div>
                      <Label>Situation fiscale</Label>
                      <Select value={form.sousTraitantEntrepriseSituationFiscale ?? ""} onValueChange={(v) => setForm({ ...form, sousTraitantEntrepriseSituationFiscale: v })}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REGULIERE">Régulière</SelectItem>
                          <SelectItem value="NON_REGULIERE">Non régulière</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Utilisateur sous-traitant (new) */}
                  <div className="border rounded-lg p-4 space-y-3 mt-3">
                    <h4 className="font-semibold text-sm text-foreground">Utilisateur sous-traitant</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Nom d'utilisateur *</Label>
                        <Input value={form.sousTraitantUsername ?? ""} onChange={(e) => setForm({ ...form, sousTraitantUsername: e.target.value })} />
                      </div>
                      <div>
                        <Label>Mot de passe *</Label>
                        <Input type="password" value={form.sousTraitantPassword ?? ""} onChange={(e) => setForm({ ...form, sousTraitantPassword: e.target.value })} />
                      </div>
                      <div>
                        <Label>Nom complet</Label>
                        <Input value={form.sousTraitantNomComplet ?? ""} onChange={(e) => setForm({ ...form, sousTraitantNomComplet: e.target.value })} />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input type="email" value={form.sousTraitantEmail ?? ""} onChange={(e) => setForm({ ...form, sousTraitantEmail: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Détails sous-traitance */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Volumes</Label>
                <Input type="number" value={form.volumes ?? ""} onChange={(e) => setForm({ ...form, volumes: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <Label>Quantités</Label>
                <Input type="number" value={form.quantites ?? ""} onChange={(e) => setForm({ ...form, quantites: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.contratEnregistre ?? false} onCheckedChange={(v) => setForm({ ...form, contratEnregistre: v })} />
              <Label>Contrat enregistré</Label>
            </div>

            {/* Documents obligatoires */}
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Upload className="h-4 w-4" /> Documents requis
              </h4>
              <div className="space-y-3">
                <div>
                  <Label>Contrat de sous-traitance enregistré *</Label>
                  <Input type="file" onChange={(e) => setCreateDocContrat(e.target.files?.[0] || null)} />
                  {createDocContrat && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {createDocContrat.name}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Lettre de sous-traitance *</Label>
                  <Input type="file" onChange={(e) => setCreateDocLettre(e.target.files?.[0] || null)} />
                  {createDocLettre && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {createDocLettre.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Créer et soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GED Document dialog */}
      <DocumentGED
        open={docDialog !== null}
        onOpenChange={() => setDocDialog(null)}
        title={`Documents — Sous-traitance #${docDialog}`}
        dossierId={docDialog}
        documentTypes={SOUS_TRAITANCE_DOCUMENT_TYPES}
        documents={docs}
        loading={docsLoading}
        canUpload={role === "ENTREPRISE"}
        onUpload={handleGEDUpload}
        onRefresh={refreshDocs}
      />
    </DashboardLayout>
  );
};

export default SousTraitance;
