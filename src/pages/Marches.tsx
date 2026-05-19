import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  marcheApi, MarcheDto, CreateMarcheRequest, StatutMarche, MARCHE_STATUT_LABELS,
  delegueApi, DelegueDto,
  conventionApi, ConventionDto,
  DocumentDto, MARCHE_DOCUMENT_TYPES, TypeDocumentMarche,
  formatApiErrorMessage,
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Gavel, Plus, RefreshCw, Loader2, Search, Edit, UserPlus, UserRoundPlus, X, FileText, Ban, MoreHorizontal, Eye } from "lucide-react";
import { CreateDelegueRequest } from "@/lib/api";
import DocumentGED from "@/components/ged/DocumentGED";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutMarche } from "@/i18n/enums";
import { formatAmount } from "@/i18n/format";

const STATUT_COLORS: Record<StatutMarche, string> = {
  EN_COURS: "bg-blue-100 text-blue-800",
  AVENANT: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

const Marches = () => {
  const { t } = useTranslation();
  usePageTitle("marches:list.title");
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [marches, setMarches] = useState<MarcheDto[]>([]);
  const [conventions, setConventions] = useState<ConventionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarcheDto | null>(null);
  const [form, setForm] = useState<CreateMarcheRequest>({ conventionId: 0, numeroMarche: "", intitule: "", montantContratHt: undefined, statut: "EN_COURS" });
  const [submitting, setSubmitting] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMarche, setAssignMarche] = useState<MarcheDto | null>(null);
  const [delegues, setDelegues] = useState<DelegueDto[]>([]);
  const [selectedDelegue, setSelectedDelegue] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const [showCreateDelegue, setShowCreateDelegue] = useState(false);
  const [delegueForm, setDelegueForm] = useState<CreateDelegueRequest>({ username: "", password: "", role: "AUTORITE_UPM", nomComplet: "", email: "" });
  const [creatingDelegue, setCreatingDelegue] = useState(false);

  const [gedOpen, setGedOpen] = useState(false);
  const [gedMarche, setGedMarche] = useState<MarcheDto | null>(null);
  const [gedDocs, setGedDocs] = useState<DocumentDto[]>([]);
  const [gedLoading, setGedLoading] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMarche, setCancelMarche] = useState<MarcheDto | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const errTitle = t("common:toast.error", { defaultValue: "Erreur" });
  const okTitle = t("common:toast.success", { defaultValue: "Succès" });

  const fetchMarches = async (q?: string) => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        marcheApi.getAll(q),
        conventionApi.getAll(),
      ]);
      setMarches(results[0].status === "fulfilled" ? results[0].value : []);
      setConventions(results[1].status === "fulfilled" ? results[1].value : []);
      if (results[0].status === "rejected") {
        toast({ title: errTitle, description: t("marches:list.load_error"), variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const tm = setTimeout(() => { fetchMarches(search.trim() || undefined); }, 300);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => { fetchMarches(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ conventionId: 0, numeroMarche: "", intitule: "", montantContratHt: undefined, statut: "EN_COURS" });
    setDialogOpen(true);
  };

  const openEdit = (m: MarcheDto) => {
    setEditing(m);
    setForm({
      conventionId: m.conventionId || 0,
      numeroMarche: m.numeroMarche || "",
      intitule: m.intitule || "",
      montantContratHt: m.montantContratHt ?? m.montantContratTtc,
      statut: m.statut,
    });
    setDialogOpen(true);
  };

  const openAssign = async (m: MarcheDto) => {
    setAssignMarche(m);
    setSelectedDelegue("");
    setShowCreateDelegue(false);
    setAssignOpen(true);
    try {
      const d = await delegueApi.getAll();
      setDelegues(d.filter(x => x.actif));
    } catch {
      toast({ title: errTitle, description: t("marches:list.delegues_load_error"), variant: "destructive" });
    }
  };

  const handleCreateDelegueInline = async () => {
    if (!delegueForm.username.trim() || !delegueForm.password.trim() || !delegueForm.nomComplet.trim()) {
      toast({ title: errTitle, description: t("marches:toast.delegue_form_required"), variant: "destructive" });
      return;
    }
    setCreatingDelegue(true);
    try {
      const created = await delegueApi.create(delegueForm);
      toast({ title: okTitle, description: t("marches:toast.delegue_created") });
      setDelegueForm({ username: "", password: "", role: "AUTORITE_UPM", nomComplet: "", email: "" });
      setShowCreateDelegue(false);
      const d = await delegueApi.getAll();
      setDelegues(d.filter(x => x.actif));
      setSelectedDelegue(String(created.id));
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally {
      setCreatingDelegue(false);
    }
  };

  const handleAssign = async () => {
    if (!assignMarche || !selectedDelegue) return;
    setAssigning(true);
    try {
      await marcheApi.addDelegue(assignMarche.id, parseInt(selectedDelegue));
      toast({ title: okTitle, description: t("marches:toast.delegue_added") });
      setSelectedDelegue("");
      fetchMarches();
      const updated = await marcheApi.getById(assignMarche.id);
      setAssignMarche(updated);
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveDelegue = async (delegueId: number) => {
    if (!assignMarche) return;
    try {
      await marcheApi.removeDelegue(assignMarche.id, delegueId);
      toast({ title: okTitle, description: t("marches:toast.delegue_removed") });
      fetchMarches();
      const updated = await marcheApi.getById(assignMarche.id);
      setAssignMarche(updated);
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    }
  };

  const openGed = async (m: MarcheDto) => {
    setGedMarche(m);
    setGedOpen(true);
    setGedLoading(true);
    try {
      const docs = await marcheApi.getDocuments(m.id);
      setGedDocs(docs);
    } catch {
      setGedDocs([]);
    } finally {
      setGedLoading(false);
    }
  };

  const handleGedUpload = async (marcheId: number, type: string, file: File) => {
    await marcheApi.uploadDocument(marcheId, type as TypeDocumentMarche, file);
  };
  const handleGedRefresh = async (marcheId: number) => {
    const docs = await marcheApi.getDocuments(marcheId);
    setGedDocs(docs);
  };
  const handleGedDelete = async (marcheId: number, docId: number) => {
    await marcheApi.deleteDocument(marcheId, docId);
  };
  const handleGedReplace = async (marcheId: number, docId: number, file: File) => {
    await marcheApi.replaceDocument(marcheId, docId, file);
  };

  const openCancelMarche = (m: MarcheDto) => {
    setCancelMarche(m);
    setCancelOpen(true);
  };

  const handleCancelMarche = async () => {
    if (!cancelMarche) return;
    setCancelling(true);
    try {
      await marcheApi.updateStatut(cancelMarche.id, "ANNULE");
      toast({ title: okTitle, description: t("marches:toast.cancelled") });
      setCancelOpen(false);
      setCancelMarche(null);
      fetchMarches();
    } catch (e: any) {
      toast({ title: errTitle, description: e.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.numeroMarche?.trim()) {
      toast({ title: errTitle, description: t("marches:form.errors.numero_required"), variant: "destructive" });
      return;
    }
    if (form.montantContratHt == null || isNaN(form.montantContratHt)) {
      toast({ title: errTitle, description: t("marches:form.errors.montant_required"), variant: "destructive" });
      return;
    }
    const payload: CreateMarcheRequest = { ...form };
    if (payload.montantContratHt == null) {
      delete payload.montantContratHt;
      delete payload.montantContratTtc;
    } else {
      payload.montantContratTtc = payload.montantContratHt;
    }
    if (!payload.conventionId) {
      delete payload.conventionId;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await marcheApi.update(editing.id, payload);
        toast({ title: okTitle, description: t("marches:toast.updated") });
      } else {
        await marcheApi.create(payload);
        toast({ title: okTitle, description: t("marches:toast.created") });
      }
      setDialogOpen(false);
      fetchMarches();
    } catch (e: unknown) {
      toast({ title: errTitle, description: formatApiErrorMessage(e, t("marches:form.errors.submit_failed")), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = marches.filter(m => {
    const s = search.toLowerCase();
    if (!s) return true;
    return (
      (m.numeroMarche || "").toLowerCase().includes(s) ||
      (m.intitule || "").toLowerCase().includes(s) ||
      String(m.id).includes(s)
    );
  });

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isDelegate = hasRole(["AUTORITE_UPM", "AUTORITE_UEP"]);

  const conventionDevise = (conventionId?: number) => {
    const c = conventions.find(x => x.id === conventionId);
    return c?.deviseOrigine || "MRU";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Gavel className="h-6 w-6 text-primary" />
              {t("marches:list.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("marches:list.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            {isAC && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 me-2" /> {t("marches:list.new")}
              </Button>
            )}
            <Button variant="outline" onClick={() => fetchMarches(search.trim() || undefined)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} /> {t("marches:list.refresh")}
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("marches:list.search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("marches:columns.numero")}</TableHead>
                      <TableHead>{t("marches:columns.intitule")}</TableHead>
                      <TableHead className="text-end">{t("marches:columns.montant_ht")}</TableHead>
                      <TableHead>{t("marches:columns.statut")}</TableHead>
                      <TableHead>{t("marches:columns.type")}</TableHead>
                      <TableHead className="text-end">{t("marches:columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("marches:list.empty")}</TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium whitespace-nowrap">{m.numeroMarche || `#${m.id}`}</TableCell>
                          <TableCell className="max-w-[260px] truncate" title={m.intitule || ""}>{m.intitule || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-end">
                            {formatAmount(m.montantContratHt ?? m.montantContratTtc, { currency: conventionDevise(m.conventionId), minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${STATUT_COLORS[m.statut]}`}>
                              {tStatutMarche(m.statut)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {m.demandeCorrectionId ? (
                              <Badge className="text-xs bg-green-100 text-green-800">{t("marches:type.contrat")}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">{t("marches:type.attribution")}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => navigate(`/dashboard/marches/${m.id}`)}
                              >
                                <Eye className="h-4 w-4 me-1" /> {t("marches:actions.view")}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openGed(m)}>
                                    <FileText className="h-4 w-4 me-2" /> {t("marches:actions.ged")}
                                  </DropdownMenuItem>
                                  {isAC && m.statut !== "CLOTURE" && m.statut !== "ANNULE" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => openEdit(m)}>
                                        <Edit className="h-4 w-4 me-2" /> {t("marches:actions.edit")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openAssign(m)}>
                                        <UserPlus className="h-4 w-4 me-2" /> {t("marches:actions.assign")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openCancelMarche(m)} className="text-destructive">
                                        <Ban className="h-4 w-4 me-2" /> {t("marches:actions.cancel")}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("marches:form.title_edit") : t("marches:form.title_create")}</DialogTitle>
            <DialogDescription>
              {editing ? t("marches:form.description_edit") : t("marches:form.description_create")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (() => {
              const effectiveAcId = user?.actingAutoriteContractanteId ?? user?.autoriteContractanteId;
              const visibleConventions = effectiveAcId
                ? conventions.filter(c => c.autoriteContractanteId === effectiveAcId || c.creeParAutoriteContractanteId === effectiveAcId)
                : conventions;
              return (
              <div className="space-y-2">
                <Label>{t("marches:form.convention")} <span className="text-muted-foreground text-xs">{t("marches:form.convention_scope")}</span></Label>
                <SearchableSelect
                  value={form.conventionId ? String(form.conventionId) : ""}
                  onValueChange={v => setForm(f => ({ ...f, conventionId: Number(v) }))}
                  placeholder={visibleConventions.length === 0 ? t("marches:form.convention_empty_scope") : t("marches:form.convention_placeholder")}
                  searchPlaceholder={t("marches:form.convention_search")}
                  options={visibleConventions.map(c => ({
                    value: String(c.id),
                    label: `${c.reference || `#${c.id}`} — ${c.intitule || ""}`,
                    keywords: `${c.reference || ""} ${c.intitule || ""} ${c.bailleurNom || ""}`,
                  }))}
                />
              </div>
              );
            })()}
            <div className="space-y-2">
              <Label>{t("marches:form.numero_required")}</Label>
              <Input value={form.numeroMarche} onChange={e => setForm(f => ({ ...f, numeroMarche: e.target.value }))} placeholder={t("marches:form.numero_placeholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("marches:form.intitule")} <span className="text-muted-foreground text-xs">{t("marches:form.intitule_hint")}</span></Label>
              <Input maxLength={500} value={form.intitule || ""} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder={t("marches:form.intitule_placeholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("marches:form.montant_required")}</Label>
              <Input type="number" value={form.montantContratHt ?? ""} onChange={e => setForm(f => ({ ...f, montantContratHt: e.target.value ? parseFloat(e.target.value) : undefined }))} placeholder={t("marches:form.montant_placeholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("marches:form.statut")}</Label>
              <Select value={form.statut} onValueChange={v => setForm(f => ({ ...f, statut: v as StatutMarche }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(MARCHE_STATUT_LABELS).map((k) => (
                    <SelectItem key={k} value={k}>{tStatutMarche(k)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("marches:actions.dismiss")}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {editing ? t("marches:actions.save") : t("marches:actions.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Delegate Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("marches:assign.title")}</DialogTitle>
            <DialogDescription>
              {t("marches:assign.description", { id: assignMarche?.id })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {assignMarche?.delegueIds && assignMarche.delegueIds.length > 0 && (
              <div className="space-y-2">
                <Label>{t("marches:assign.current")}</Label>
                <div className="flex flex-wrap gap-2">
                  {assignMarche.delegueIds.map(dId => {
                    const d = delegues.find(x => x.id === dId);
                    return (
                      <Badge key={dId} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                        {d ? `${d.nomComplet} (${d.role === "AUTORITE_UPM" ? "UPM" : "UEP"})` : `#${dId}`}
                        <button onClick={() => handleRemoveDelegue(dId)} className="ms-1 rounded-full hover:bg-muted p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {!showCreateDelegue ? (
              <>
                <div className="space-y-2">
                  <Label>{t("marches:assign.add")}</Label>
                  <Select value={selectedDelegue} onValueChange={setSelectedDelegue}>
                    <SelectTrigger><SelectValue placeholder={t("marches:assign.add_placeholder")} /></SelectTrigger>
                    <SelectContent>
                      {delegues
                        .filter(d => !(assignMarche?.delegueIds || []).includes(d.id))
                        .map(d => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.nomComplet} ({d.role === "AUTORITE_UPM" ? "UPM" : "UEP"})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {delegues.filter(d => !(assignMarche?.delegueIds || []).includes(d.id)).length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("marches:assign.all_assigned")}</p>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowCreateDelegue(true)}>
                  <UserRoundPlus className="h-4 w-4 me-2" /> {t("marches:assign.create_new")}
                </Button>
              </>
            ) : (
              <div className="space-y-3 border rounded-lg p-4">
                <p className="text-sm font-medium">{t("marches:assign.new_title")}</p>
                <div className="space-y-2">
                  <Label>{t("marches:assign.nom_required")}</Label>
                  <Input value={delegueForm.nomComplet} onChange={e => setDelegueForm(f => ({ ...f, nomComplet: e.target.value }))} placeholder={t("marches:assign.nom_placeholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("marches:assign.username_required")}</Label>
                  <Input value={delegueForm.username} onChange={e => setDelegueForm(f => ({ ...f, username: e.target.value }))} placeholder={t("marches:assign.username_placeholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("marches:assign.password_required")}</Label>
                  <Input type="password" value={delegueForm.password} onChange={e => setDelegueForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("marches:assign.email")}</Label>
                  <Input type="email" value={delegueForm.email} onChange={e => setDelegueForm(f => ({ ...f, email: e.target.value }))} placeholder={t("marches:assign.email_placeholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("marches:assign.role_required")}</Label>
                  <Select value={delegueForm.role} onValueChange={v => setDelegueForm(f => ({ ...f, role: v as "AUTORITE_UPM" | "AUTORITE_UEP" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTORITE_UPM">{t("enums:role.AUTORITE_UPM")}</SelectItem>
                      <SelectItem value="AUTORITE_UEP">{t("enums:role.AUTORITE_UEP")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCreateDelegue(false)} className="flex-1">{t("marches:assign.back")}</Button>
                  <Button size="sm" onClick={handleCreateDelegueInline} disabled={creatingDelegue} className="flex-1">
                    {creatingDelegue && <Loader2 className="h-4 w-4 animate-spin me-1" />}
                    {t("marches:actions.create")}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {!showCreateDelegue && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>{t("marches:actions.close")}</Button>
              <Button onClick={handleAssign} disabled={assigning || !selectedDelegue}>
                {assigning && <Loader2 className="h-4 w-4 animate-spin me-1" />}
                {t("marches:actions.add")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* GED Documents Dialog */}
      <DocumentGED
        open={gedOpen}
        onOpenChange={setGedOpen}
        title={t("marches:ged.title", { ref: gedMarche?.numeroMarche || `#${gedMarche?.id}` })}
        dossierId={gedMarche?.id || null}
        documentTypes={MARCHE_DOCUMENT_TYPES}
        documents={gedDocs}
        loading={gedLoading}
        canUpload={(isAC || isDelegate) && gedMarche?.statut !== "CLOTURE" && gedMarche?.statut !== "ANNULE"}
        canManageDocuments={(isAC || isDelegate) && gedMarche?.statut !== "CLOTURE" && gedMarche?.statut !== "ANNULE"}
        onUpload={handleGedUpload}
        onRefresh={handleGedRefresh}
        onDeleteDocument={handleGedDelete}
        onReplaceDocument={handleGedReplace}
      />

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" /> {t("marches:cancel_dialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("marches:cancel_dialog.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>{t("marches:cancel_dialog.keep")}</Button>
            <Button variant="destructive" onClick={handleCancelMarche} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Ban className="h-4 w-4 me-1" />}
              {t("marches:cancel_dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Marches;
