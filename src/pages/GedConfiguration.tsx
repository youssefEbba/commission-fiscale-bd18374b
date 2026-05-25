import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentRequirementApi, DocumentRequirementDto, CreateDocumentRequirementRequest, ProcessusType, FormatFichier, referentielTypeDocumentApi, ReferentielTypeDocumentDto } from "@/lib/api";
import { tTypeDocument } from "@/i18n/enums";
import { Plus, Pencil, Trash2, X, BookOpen, ChevronDown, ChevronUp } from "lucide-react";

type ProcessusSectionConfig = { key: string; processus: ProcessusType };

const PROCESSUS_SECTIONS: ProcessusSectionConfig[] = [
  { key: "CONVENTION", processus: "CONVENTION" },
  { key: "MARCHE", processus: "MARCHE" },
  { key: "CORRECTION", processus: "CORRECTION_OFFRE_FISCALE" },
  { key: "MISE_EN_PLACE", processus: "MISE_EN_PLACE_CI" },
  { key: "UTIL_EXTERIEUR", processus: "UTILISATION_CI_EXTERIEUR" },
  { key: "UTIL_INTERIEUR", processus: "UTILISATION_CI_INTERIEUR" },
  { key: "TRANSFERT", processus: "TRANSFERT_CREDIT" },
  { key: "SOUS_TRAITANCE", processus: "SOUS_TRAITANCE" },
  { key: "MODIFICATION", processus: "MODIFICATION_CI" },
  { key: "CLOTURE", processus: "CLOTURE_CI" },
];

const FORMAT_VALUES: FormatFichier[] = ["WORD", "EXCEL", "IMAGE", "PDF"];

const CODE_PATTERN = /^[A-Z0-9_]+$/;

const GedConfiguration = () => {
  const { t } = useTranslation();
  usePageTitle("ged:config.title");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogProcessus, setDialogProcessus] = useState<ProcessusType>("CORRECTION_OFFRE_FISCALE");
  const [dialogSousTag, setDialogSousTag] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<DocumentRequirementDto | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [catalogueExpanded, setCatalogueExpanded] = useState(false);
  const toggleSection = (key: string) => setExpandedSections((p) => ({ ...p, [key]: !p[key] }));

  const [typeDocument, setTypeDocument] = useState("");
  const [newTypeMode, setNewTypeMode] = useState(false);
  const [newTypeCode, setNewTypeCode] = useState("");
  const [newTypeLibelle, setNewTypeLibelle] = useState("");
  const [newTypeLibelleAr, setNewTypeLibelleAr] = useState("");
  const [obligatoire, setObligatoire] = useState(true);
  const [typesAutorises, setTypesAutorises] = useState<FormatFichier[]>(["PDF", "WORD", "EXCEL", "IMAGE"]);
  const [description, setDescription] = useState("");
  const [ordreAffichage, setOrdreAffichage] = useState(1);

  // Catalogue
  const referentielQuery = useQuery({
    queryKey: ["referentiel-types-document"],
    queryFn: () => referentielTypeDocumentApi.list(false),
  });
  const referentiel: ReferentielTypeDocumentDto[] = referentielQuery.data || [];
  const referentielActif = referentiel.filter((r) => r.actif);
  const labelOfCode = (code?: string | null) => {
    if (!code) return "—";
    const found = referentiel.find((r) => r.code === code);
    if (found?.libelle) return found.libelle;
    const enumLabel = tTypeDocument(code);
    return enumLabel && enumLabel !== "—" ? enumLabel : code;
  };

  const [catalogueDialogOpen, setCatalogueDialogOpen] = useState(false);
  const [catalogueEdit, setCatalogueEdit] = useState<ReferentielTypeDocumentDto | null>(null);
  const [catCode, setCatCode] = useState("");
  const [catLibelle, setCatLibelle] = useState("");
  const [catLibelleAr, setCatLibelleAr] = useState("");
  const [catActif, setCatActif] = useState(true);


  const conventionReqQuery = useQuery({
    queryKey: ["document-requirements", "CONVENTION"],
    queryFn: () => documentRequirementApi.getByProcessus("CONVENTION"),
  });
  const marcheReqQuery = useQuery({
    queryKey: ["document-requirements", "MARCHE"],
    queryFn: () => documentRequirementApi.getByProcessus("MARCHE"),
  });
  const correctionQuery = useQuery({
    queryKey: ["document-requirements", "CORRECTION_OFFRE_FISCALE"],
    queryFn: () => documentRequirementApi.getByProcessus("CORRECTION_OFFRE_FISCALE"),
  });
  const miseEnPlaceQuery = useQuery({
    queryKey: ["document-requirements", "MISE_EN_PLACE_CI"],
    queryFn: () => documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI"),
  });
  const exterieurQuery = useQuery({
    queryKey: ["document-requirements", "UTILISATION_CI_EXTERIEUR"],
    queryFn: () => documentRequirementApi.getByProcessus("UTILISATION_CI_EXTERIEUR"),
  });
  const interieurQuery = useQuery({
    queryKey: ["document-requirements", "UTILISATION_CI_INTERIEUR"],
    queryFn: () => documentRequirementApi.getByProcessus("UTILISATION_CI_INTERIEUR"),
  });
  const transfertQuery = useQuery({
    queryKey: ["document-requirements", "TRANSFERT_CREDIT"],
    queryFn: () => documentRequirementApi.getByProcessus("TRANSFERT_CREDIT"),
  });
  const sousTraitanceQuery = useQuery({
    queryKey: ["document-requirements", "SOUS_TRAITANCE"],
    queryFn: () => documentRequirementApi.getByProcessus("SOUS_TRAITANCE"),
  });

  const queriesByProcessus: Partial<Record<ProcessusType, { data: DocumentRequirementDto[]; isLoading: boolean }>> = {
    CONVENTION: { data: conventionReqQuery.data || [], isLoading: conventionReqQuery.isLoading },
    MARCHE: { data: marcheReqQuery.data || [], isLoading: marcheReqQuery.isLoading },
    CORRECTION_OFFRE_FISCALE: { data: correctionQuery.data || [], isLoading: correctionQuery.isLoading },
    MISE_EN_PLACE_CI: { data: miseEnPlaceQuery.data || [], isLoading: miseEnPlaceQuery.isLoading },
    UTILISATION_CI_EXTERIEUR: { data: exterieurQuery.data || [], isLoading: exterieurQuery.isLoading },
    UTILISATION_CI_INTERIEUR: { data: interieurQuery.data || [], isLoading: interieurQuery.isLoading },
    TRANSFERT_CREDIT: { data: transfertQuery.data || [], isLoading: transfertQuery.isLoading },
    SOUS_TRAITANCE: { data: sousTraitanceQuery.data || [], isLoading: sousTraitanceQuery.isLoading },
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentRequirementRequest) => documentRequirementApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requirements"] });
      toast({ title: t("ged:config.toast.added") });
      closeDialog();
    },
    onError: (e: Error) => {
      const msg = e.message?.includes("Unique") || e.message?.includes("unique") || e.message?.includes("UK_DOC_REQ")
        ? t("ged:config.toast.unique_constraint")
        : e.message;
      toast({ title: t("ged:config.toast.error"), description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateDocumentRequirementRequest> }) =>
      documentRequirementApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requirements"] });
      toast({ title: t("ged:config.toast.modified") });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: t("ged:config.toast.error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentRequirementApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requirements"] });
      toast({ title: t("ged:config.toast.deleted") });
    },
    onError: (e: Error) => toast({ title: t("ged:config.toast.error"), description: e.message, variant: "destructive" }),
  });

  // Catalogue mutations
  const catCreateMutation = useMutation({
    mutationFn: (data: { code: string; libelle: string; libelleAr?: string | null; actif?: boolean }) =>
      referentielTypeDocumentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referentiel-types-document"] });
      toast({ title: t("ged:config.toast.cat_added") });
      closeCatalogueDialog();
    },
    onError: (e: Error) => toast({ title: t("ged:config.toast.error"), description: e.message, variant: "destructive" }),
  });
  const catUpdateMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<{ libelle: string; libelleAr?: string | null; actif?: boolean }> }) =>
      referentielTypeDocumentApi.update(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referentiel-types-document"] });
      toast({ title: t("ged:config.toast.cat_modified") });
      closeCatalogueDialog();
    },
    onError: (e: Error) => toast({ title: t("ged:config.toast.error"), description: e.message, variant: "destructive" }),
  });
  const catDeleteMutation = useMutation({
    mutationFn: (code: string) => referentielTypeDocumentApi.delete(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referentiel-types-document"] });
      toast({ title: t("ged:config.toast.cat_deleted") });
    },
    onError: (e: Error) => toast({ title: t("ged:config.toast.error"), description: e.message, variant: "destructive" }),
  });

  const closeCatalogueDialog = () => {
    setCatalogueDialogOpen(false);
    setCatalogueEdit(null);
    setCatCode("");
    setCatLibelle("");
    setCatLibelleAr("");
    setCatActif(true);
  };
  const openCatalogueCreate = () => {
    closeCatalogueDialog();
    setCatalogueDialogOpen(true);
  };
  const openCatalogueEdit = (item: ReferentielTypeDocumentDto) => {
    setCatalogueEdit(item);
    setCatCode(item.code);
    setCatLibelle(item.libelle);
    setCatLibelleAr(item.libelleAr || "");
    setCatActif(item.actif);
    setCatalogueDialogOpen(true);
  };
  const submitCatalogue = () => {
    const libelle = catLibelle.trim();
    if (!libelle) {
      toast({ title: t("ged:config.toast.libelle_required_title"), variant: "destructive" });
      return;
    }
    if (catalogueEdit) {
      catUpdateMutation.mutate({
        code: catalogueEdit.code,
        data: { libelle, libelleAr: catLibelleAr.trim() || null, actif: catActif },
      });
      return;
    }
    const code = catCode.trim().toUpperCase();
    if (!code || !CODE_PATTERN.test(code)) {
      toast({ title: t("ged:config.toast.code_invalid_title"), description: t("ged:config.toast.code_invalid_desc"), variant: "destructive" });
      return;
    }
    catCreateMutation.mutate({ code, libelle, libelleAr: catLibelleAr.trim() || null, actif: catActif });
  };

  const closeDialog = () => {

    setDialogOpen(false);
    setEditItem(null);
    setTypeDocument("");
    setObligatoire(true);
    setTypesAutorises(["PDF", "WORD", "EXCEL", "IMAGE"]);
    setDescription("");
    setOrdreAffichage(1);
    setDialogSousTag("");
    setNewTypeMode(false);
    setNewTypeCode("");
    setNewTypeLibelle("");
    setNewTypeLibelleAr("");
  };


  const openCreate = (processus: ProcessusType) => {
    closeDialog();
    setDialogProcessus(processus);
    setDialogSousTag("");
    const reqs = queriesByProcessus[processus]?.data || [];
    setOrdreAffichage((reqs.length || 0) + 1);
    setDialogOpen(true);
  };

  const openEdit = (item: DocumentRequirementDto) => {
    setEditItem(item);
    setDialogProcessus(item.processus as ProcessusType);
    setTypeDocument(item.codeDocument || item.typeDocument || "");
    setObligatoire(item.obligatoire);
    setTypesAutorises(item.typesAutorises || []);
    setDescription(item.description || "");
    setOrdreAffichage(item.ordreAffichage || 1);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    let codeFinal = typeDocument.trim();
    let libelleInline: string | undefined;

    if (!editItem && newTypeMode) {
      codeFinal = newTypeCode.trim().toUpperCase();
      libelleInline = newTypeLibelle.trim();
      if (!codeFinal || !CODE_PATTERN.test(codeFinal)) {
        toast({ title: t("ged:config.toast.code_invalid_title"), description: t("ged:config.toast.code_invalid_desc"), variant: "destructive" });
        return;
      }
      if (!libelleInline) {
        toast({ title: t("ged:config.toast.libelle_required_title"), variant: "destructive" });
        return;
      }
    }

    if (!codeFinal) {
      toast({ title: t("ged:config.toast.type_required_title"), variant: "destructive" });
      return;
    }
    if (!editItem || (editItem.codeDocument || editItem.typeDocument) !== codeFinal) {
      const existing = queriesByProcessus[dialogProcessus]?.data || [];
      const duplicate = existing.find((r) => (r.codeDocument || r.typeDocument) === codeFinal);
      if (duplicate) {
        toast({
          title: t("ged:config.toast.duplicate_title"),
          description: t("ged:config.toast.duplicate_desc", { type: labelOfCode(codeFinal) }),
          variant: "destructive",
        });
        return;
      }
    }
    const payload: CreateDocumentRequirementRequest = {
      processus: dialogProcessus,
      typeDocument: codeFinal,
      codeDocument: codeFinal,
      libelle: libelleInline,
      obligatoire,
      typesAutorises,
      description: description.trim(),
      ordreAffichage,
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };


  const toggleFormat = (format: FormatFichier) => {
    setTypesAutorises((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  };

  const sortReqs = (reqs: DocumentRequirementDto[]) =>
    [...reqs].sort((a, b) => (a.ordreAffichage || 0) - (b.ordreAffichage || 0));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("ged:config.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("ged:config.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg text-primary">{t("ged:config.catalogue.title")}</CardTitle>
              <Badge variant="secondary" className="ms-2">{referentiel.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setCatalogueExpanded((v) => !v)}>
                {catalogueExpanded ? (
                  <><ChevronUp className="h-4 w-4 me-1" />{t("ged:config.hide")}</>
                ) : (
                  <><ChevronDown className="h-4 w-4 me-1" />{t("ged:config.show_all", { count: referentiel.length })}</>
                )}
              </Button>
              <Button size="sm" onClick={openCatalogueCreate}>
                <Plus className="h-4 w-4 me-1" /> {t("ged:config.catalogue.add")}
              </Button>
            </div>
          </CardHeader>
          {catalogueExpanded && (
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">{t("ged:config.catalogue.subtitle")}</p>
            {referentielQuery.isLoading ? (
              <p className="text-muted-foreground text-sm py-4 text-center">{t("ged:config.loading")}</p>
            ) : referentiel.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">{t("ged:config.catalogue.empty")}</p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">{t("ged:config.catalogue.code")}</TableHead>
                      <TableHead className="min-w-[260px]">{t("ged:config.catalogue.libelle")}</TableHead>
                      <TableHead className="min-w-[160px]">{t("ged:config.catalogue.libelle_ar")}</TableHead>
                      <TableHead className="w-[100px]">{t("ged:config.catalogue.actif")}</TableHead>
                      <TableHead className="w-[100px]">{t("ged:config.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...referentiel].sort((a, b) => a.code.localeCompare(b.code)).map((rt) => (
                      <TableRow key={rt.code}>
                        <TableCell className="font-mono text-xs">{rt.code}</TableCell>
                        <TableCell>{rt.libelle}</TableCell>
                        <TableCell dir="rtl" className="text-sm">{rt.libelleAr || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={rt.actif ? "default" : "secondary"}>
                            {rt.actif ? t("ged:config.yes") : t("ged:config.no")}
                          </Badge>
                          {rt.systeme && (
                            <Badge variant="outline" className="ms-1 text-[10px]">{t("ged:config.catalogue.systeme")}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openCatalogueEdit(rt)} aria-label={t("ged:config.dialog.submit_edit")}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={rt.systeme}
                              onClick={() => catDeleteMutation.mutate(rt.code)}
                              className="text-destructive hover:text-destructive disabled:opacity-30"
                              aria-label={t("ged:config.toast.deleted")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          )}
        </Card>

        <div className="space-y-6">

          {PROCESSUS_SECTIONS.map((section) => {
            const q = queriesByProcessus[section.processus];
            if (!q) return null;
            const sorted = sortReqs(q.data);
            return (
              <Card key={section.key}>
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg text-primary">
                      {t(`ged:config.modules.${section.processus}`)}
                    </CardTitle>
                    <Badge variant="secondary" className="ms-2">{sorted.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleSection(section.key)} disabled={sorted.length === 0}>
                      {expandedSections[section.key] ? (
                        <><ChevronUp className="h-4 w-4 me-1" />{t("ged:config.hide")}</>
                      ) : (
                        <><ChevronDown className="h-4 w-4 me-1" />{t("ged:config.show_all", { count: sorted.length })}</>
                      )}
                    </Button>
                    <Button size="sm" onClick={() => openCreate(section.processus)}>
                      <Plus className="h-4 w-4 me-1" /> {t("ged:config.add_document")}
                    </Button>
                  </div>
                </CardHeader>
                {expandedSections[section.key] && (
                <CardContent>
                  {q.isLoading ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">{t("ged:config.loading")}</p>
                  ) : sorted.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">{t("ged:config.empty")}</p>
                  ) : (
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">{t("ged:config.table.document")}</TableHead>
                            <TableHead className="min-w-[120px]">{t("ged:config.table.required")}</TableHead>
                            <TableHead className="min-w-[250px]">{t("ged:config.table.type")}</TableHead>
                            <TableHead className="min-w-[250px]">{t("ged:config.table.description")}</TableHead>
                            <TableHead className="w-[100px]">{t("ged:config.table.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sorted.map((req) => (
                            <TableRow key={req.id}>
                              <TableCell className="font-medium">{req.libelle || labelOfCode(req.codeDocument || req.typeDocument)}</TableCell>
                              <TableCell>
                                <Badge variant={req.obligatoire ? "default" : "secondary"}>
                                  {req.obligatoire ? t("ged:config.yes") : t("ged:config.no")}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {(req.typesAutorises || []).map((f) => (
                                    <Badge key={f} className="bg-primary text-primary-foreground text-xs">
                                      {f.toLowerCase()}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                                {req.description || t("ged:config.no_description")}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(req)} aria-label={t("ged:config.dialog.submit_edit")}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(req.id)} className="text-destructive hover:text-destructive" aria-label={t("ged:config.toast.deleted")}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? t("ged:config.dialog.edit_title") : t("ged:config.dialog.create_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t("ged:config.dialog.type_label")}</Label>
                {!editItem && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewTypeMode((v) => !v);
                      setTypeDocument("");
                      setNewTypeCode("");
                      setNewTypeLibelle("");
                      setNewTypeLibelleAr("");
                    }}
                  >
                    {newTypeMode ? t("ged:config.dialog.pick_existing") : t("ged:config.dialog.new_type")}
                  </Button>
                )}
              </div>
              {!newTypeMode || editItem ? (
                <Select value={typeDocument} onValueChange={setTypeDocument} disabled={!!editItem}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("ged:config.dialog.type_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {referentielActif.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("ged:config.dialog.no_type_yet")}</div>
                    )}
                    {referentielActif.map((rt) => (
                      <SelectItem key={rt.code} value={rt.code}>
                        {rt.libelle} <span className="text-xs text-muted-foreground ms-1">({rt.code})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2 rounded-md border border-dashed p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("ged:config.dialog.new_type_code")}</Label>
                    <Input
                      value={newTypeCode}
                      onChange={(e) => setNewTypeCode(e.target.value.toUpperCase())}
                      placeholder="EX: CERTIFICAT_UTILISATION_DOUANE"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("ged:config.dialog.new_type_libelle")}</Label>
                    <Input
                      value={newTypeLibelle}
                      onChange={(e) => setNewTypeLibelle(e.target.value)}
                      placeholder={t("ged:config.dialog.new_type_libelle_placeholder")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("ged:config.dialog.new_type_libelle_ar")}</Label>
                    <Input
                      value={newTypeLibelleAr}
                      onChange={(e) => setNewTypeLibelleAr(e.target.value)}
                      dir="rtl"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("ged:config.dialog.new_type_help")}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Label>{t("ged:config.dialog.required_label")}</Label>
              <Switch checked={obligatoire} onCheckedChange={setObligatoire} />
              <span className="text-sm text-muted-foreground">{obligatoire ? t("ged:config.yes") : t("ged:config.no")}</span>
            </div>
            <div className="space-y-2">
              <Label>{t("ged:config.dialog.formats_label")}</Label>
              <div className="flex flex-wrap gap-2">
                {FORMAT_VALUES.map((value) => {
                  const selected = typesAutorises.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleFormat(value)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t(`ged:config.formats.${value}`)}
                      {selected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("ged:config.dialog.description_label")}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("ged:config.dialog.description_placeholder")} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t("ged:config.dialog.ordre_label")}</Label>
              <Input type="number" min={1} value={ordreAffichage} onChange={(e) => setOrdreAffichage(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("ged:config.dialog.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editItem ? t("ged:config.dialog.submit_edit") : t("ged:config.dialog.submit_create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catalogueDialogOpen} onOpenChange={(o) => !o && closeCatalogueDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {catalogueEdit ? t("ged:config.catalogue.edit_title") : t("ged:config.catalogue.create_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("ged:config.catalogue.code")}</Label>
              <Input
                value={catCode}
                disabled={!!catalogueEdit}
                onChange={(e) => setCatCode(e.target.value.toUpperCase())}
                placeholder="EX: CERTIFICAT_UTILISATION_DOUANE"
              />
              {!catalogueEdit && (
                <p className="text-xs text-muted-foreground">{t("ged:config.catalogue.code_help")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("ged:config.catalogue.libelle")}</Label>
              <Input value={catLibelle} onChange={(e) => setCatLibelle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("ged:config.catalogue.libelle_ar")}</Label>
              <Input value={catLibelleAr} onChange={(e) => setCatLibelleAr(e.target.value)} dir="rtl" />
            </div>
            <div className="flex items-center gap-3">
              <Label>{t("ged:config.catalogue.actif")}</Label>
              <Switch checked={catActif} onCheckedChange={setCatActif} />
              <span className="text-sm text-muted-foreground">{catActif ? t("ged:config.yes") : t("ged:config.no")}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCatalogueDialog}>{t("ged:config.dialog.cancel")}</Button>
            <Button onClick={submitCatalogue} disabled={catCreateMutation.isPending || catUpdateMutation.isPending}>
              {catalogueEdit ? t("ged:config.dialog.submit_edit") : t("ged:config.dialog.submit_create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default GedConfiguration;
