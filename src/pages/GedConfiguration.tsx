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
import { Plus, Pencil, Trash2, X, BookOpen } from "lucide-react";

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

  const [typeDocument, setTypeDocument] = useState("");
  const [obligatoire, setObligatoire] = useState(true);
  const [typesAutorises, setTypesAutorises] = useState<FormatFichier[]>(["PDF", "WORD", "EXCEL", "IMAGE"]);
  const [description, setDescription] = useState("");
  const [ordreAffichage, setOrdreAffichage] = useState(1);

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

  const closeDialog = () => {
    setDialogOpen(false);
    setEditItem(null);
    setTypeDocument("");
    setObligatoire(true);
    setTypesAutorises(["PDF", "WORD", "EXCEL", "IMAGE"]);
    setDescription("");
    setOrdreAffichage(1);
    setDialogSousTag("");
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
    setTypeDocument(item.typeDocument);
    setObligatoire(item.obligatoire);
    setTypesAutorises(item.typesAutorises || []);
    setDescription(item.description || "");
    setOrdreAffichage(item.ordreAffichage || 1);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!typeDocument.trim()) {
      toast({ title: t("ged:config.toast.type_required_title"), variant: "destructive" });
      return;
    }
    if (!editItem || editItem.typeDocument !== typeDocument.trim()) {
      const existing = queriesByProcessus[dialogProcessus]?.data || [];
      const duplicate = existing.find((r) => r.typeDocument === typeDocument.trim());
      if (duplicate) {
        toast({
          title: t("ged:config.toast.duplicate_title"),
          description: t("ged:config.toast.duplicate_desc", { type: tTypeDocument(typeDocument.trim()) }),
          variant: "destructive",
        });
        return;
      }
    }
    const payload: CreateDocumentRequirementRequest = {
      processus: dialogProcessus,
      typeDocument: typeDocument.trim(),
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

        <div className="space-y-6">
          {PROCESSUS_SECTIONS.map((section) => {
            const q = queriesByProcessus[section.processus];
            if (!q) return null;
            const sorted = sortReqs(q.data);
            return (
              <Card key={section.key}>
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-lg text-primary">
                    {t(`ged:config.modules.${section.processus}`)}
                  </CardTitle>
                  <Button size="sm" onClick={() => openCreate(section.processus)}>
                    <Plus className="h-4 w-4 me-1" /> {t("ged:config.add_document")}
                  </Button>
                </CardHeader>
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
                              <TableCell className="font-medium">{tTypeDocument(req.typeDocument)}</TableCell>
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
              <Label>{t("ged:config.dialog.type_label")}</Label>
              <Select value={typeDocument} onValueChange={setTypeDocument}>
                <SelectTrigger>
                  <SelectValue placeholder={t("ged:config.dialog.type_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_DOCUMENT_CODES.map((code) => (
                    <SelectItem key={code} value={code}>{tTypeDocument(code)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </DashboardLayout>
  );
};

export default GedConfiguration;
