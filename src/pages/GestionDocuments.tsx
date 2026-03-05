import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
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
import { documentRequirementApi, DocumentRequirementDto, CreateDocumentRequirementRequest, ProcessusType, FormatFichier } from "@/lib/api";
import { Plus, Pencil, Trash2, FileText, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PROCESSUS_OPTIONS: { value: ProcessusType; label: string }[] = [
  { value: "CORRECTION_OFFRE_FISCALE", label: "Demande de correction de l'offre Fiscale" },
  { value: "MISE_EN_PLACE_CI", label: "Mise en place CI (Certificat)" },
  { value: "UTILISATION_CI", label: "Utilisation CI" },
];

const FORMAT_OPTIONS: { value: FormatFichier; label: string; color: string }[] = [
  { value: "WORD", label: "Word", color: "bg-emerald-500" },
  { value: "EXCEL", label: "Excel", color: "bg-emerald-500" },
  { value: "IMAGE", label: "Images", color: "bg-emerald-500" },
  { value: "PDF", label: "PDF", color: "bg-emerald-500" },
];

const GestionDocuments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProcessusType>("CORRECTION_OFFRE_FISCALE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<DocumentRequirementDto | null>(null);

  // Form state
  const [typeDocument, setTypeDocument] = useState("");
  const [obligatoire, setObligatoire] = useState(true);
  const [typesAutorises, setTypesAutorises] = useState<FormatFichier[]>(["PDF", "WORD", "EXCEL", "IMAGE"]);
  const [description, setDescription] = useState("");
  const [ordreAffichage, setOrdreAffichage] = useState(1);

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ["document-requirements", activeTab],
    queryFn: () => documentRequirementApi.getByProcessus(activeTab),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentRequirementRequest) => documentRequirementApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requirements", activeTab] });
      toast({ title: "Document ajouté" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateDocumentRequirementRequest> }) =>
      documentRequirementApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requirements", activeTab] });
      toast({ title: "Document modifié" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentRequirementApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requirements", activeTab] });
      toast({ title: "Document supprimé" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditItem(null);
    setTypeDocument("");
    setObligatoire(true);
    setTypesAutorises(["PDF", "WORD", "EXCEL", "IMAGE"]);
    setDescription("");
    setOrdreAffichage(1);
  };

  const openCreate = () => {
    closeDialog();
    setOrdreAffichage((requirements.length || 0) + 1);
    setDialogOpen(true);
  };

  const openEdit = (item: DocumentRequirementDto) => {
    setEditItem(item);
    setTypeDocument(item.typeDocument);
    setObligatoire(item.obligatoire);
    setTypesAutorises(item.typesAutorises || []);
    setDescription(item.description || "");
    setOrdreAffichage(item.ordreAffichage || 1);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!typeDocument.trim()) {
      toast({ title: "Veuillez saisir le type de document", variant: "destructive" });
      return;
    }
    const payload: CreateDocumentRequirementRequest = {
      processus: activeTab,
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

  const sorted = [...requirements].sort((a, b) => (a.ordreAffichage || 0) - (b.ordreAffichage || 0));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">GED – Gestion des Documents</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configurez les documents requis par processus
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProcessusType)}>
          <TabsList className="grid grid-cols-3 w-full max-w-2xl">
            {PROCESSUS_OPTIONS.map((p) => (
              <TabsTrigger key={p.value} value={p.value} className="text-xs sm:text-sm">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {PROCESSUS_OPTIONS.map((p) => (
            <TabsContent key={p.value} value={p.value}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-lg text-primary">
                    {p.label}
                  </CardTitle>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1" /> Ajouter un document
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">Chargement…</p>
                  ) : sorted.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">Aucun document configuré pour ce processus.</p>
                  ) : (
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">DOCUMENT</TableHead>
                            <TableHead className="min-w-[120px]">OBLIGATOIRE ?</TableHead>
                            <TableHead className="min-w-[250px]">TYPE</TableHead>
                            <TableHead className="min-w-[250px]">DESCRIPTION</TableHead>
                            <TableHead className="w-[100px]">ACTIONS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sorted.map((req) => (
                            <TableRow key={req.id}>
                              <TableCell className="font-medium">{formatDocLabel(req.typeDocument)}</TableCell>
                              <TableCell>
                                <Badge variant={req.obligatoire ? "default" : "secondary"}>
                                  {req.obligatoire ? "Oui" : "Non"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {(req.typesAutorises || []).map((f) => (
                                    <Badge key={f} className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
                                      {f.toLowerCase()}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                                {req.description || "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(req)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(req.id)} className="text-destructive hover:text-destructive">
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
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Dialog create/edit */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Modifier le document" : "Ajouter un document requis"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de document *</Label>
              <Input
                value={typeDocument}
                onChange={(e) => setTypeDocument(e.target.value)}
                placeholder="Ex: LETTRE_SAISINE"
              />
            </div>

            <div className="flex items-center gap-3">
              <Label>Obligatoire</Label>
              <Switch checked={obligatoire} onCheckedChange={setObligatoire} />
              <span className="text-sm text-muted-foreground">{obligatoire ? "Oui" : "Non"}</span>
            </div>

            <div className="space-y-2">
              <Label>Formats autorisés</Label>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((f) => {
                  const selected = typesAutorises.includes(f.value);
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => toggleFormat(f.value)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selected
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {f.label}
                      {selected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description du document..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Ordre d'affichage</Label>
              <Input
                type="number"
                min={1}
                value={ordreAffichage}
                onChange={(e) => setOrdreAffichage(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editItem ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

function formatDocLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bCi\b/g, "CI")
    .replace(/\bTva\b/g, "TVA");
}

export default GestionDocuments;
