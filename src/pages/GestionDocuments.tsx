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
import { Plus, Pencil, Trash2, X } from "lucide-react";

// Tags stored in description to identify sub-section
const SOUS_SECTION_TAG_DOUANE = "[DOUANE]";
const SOUS_SECTION_TAG_TVA = "[TVA]";

const hasSousTag = (desc: string | undefined, tag: string) => (desc || "").includes(tag);
const stripSousTags = (desc: string | undefined) => (desc || "").replace(/\[(DOUANE|TVA)\]\s*/g, "").trim();

type ProcessusSectionConfig = { key: string; processus: ProcessusType; label: string; filterFn?: (r: DocumentRequirementDto) => boolean; sousTag?: string };

const PROCESSUS_SECTIONS: ProcessusSectionConfig[] = [
  { key: "CORRECTION", processus: "CORRECTION_OFFRE_FISCALE", label: "Demande de correction de l'offre Fiscale" },
  { key: "MISE_EN_PLACE", processus: "MISE_EN_PLACE_CI", label: "Mise en place CI (Certificat)" },
  { key: "UTIL_DOUANE", processus: "UTILISATION_CI", label: "Utilisation CI — Douane (Importation)", sousTag: SOUS_SECTION_TAG_DOUANE, filterFn: (r) => hasSousTag(r.description, SOUS_SECTION_TAG_DOUANE) },
  { key: "UTIL_TVA", processus: "UTILISATION_CI", label: "Utilisation CI — TVA Intérieure", sousTag: SOUS_SECTION_TAG_TVA, filterFn: (r) => hasSousTag(r.description, SOUS_SECTION_TAG_TVA) },
];

const FORMAT_OPTIONS: { value: FormatFichier; label: string }[] = [
  { value: "WORD", label: "Word" },
  { value: "EXCEL", label: "Excel" },
  { value: "IMAGE", label: "Images" },
  { value: "PDF", label: "PDF" },
];

const TYPE_DOCUMENT_OPTIONS = [
  { value: "OFFRE_CORRIGEE", label: "Offre corrigée" },
  { value: "LETTRE_SAISINE", label: "Lettre de saisine" },
  { value: "PV_OUVERTURE", label: "PV d'ouverture" },
  { value: "ATTESTATION_FISCALE", label: "Attestation fiscale" },
  { value: "OFFRE_FINANCIERE", label: "Offre financière" },
  { value: "TABLEAU_MODELE", label: "Tableau modèle" },
  { value: "DAO_DQE", label: "DAO DQE" },
  { value: "LISTE_ITEMS", label: "Liste des items" },
  { value: "DAO_ANNOTE", label: "DAO annoté" },
  { value: "CERTIFICAT_VISITE_DOUANE", label: "Certificat visite douane" },
  { value: "CERTIFICAT_CREDIT_IMPOTS_SYDONIA", label: "Certificat CI Sydonia" },
  { value: "LETTRE_DEMANDE_CREDIT_IMPOTS", label: "Lettre demande CI" },
  { value: "DECLARATION_TVA", label: "Déclaration TVA" },
  { value: "ORDRE_TRANSIT", label: "Ordre de transit" },
  { value: "IMAGE_DECLARATION_DOUANE", label: "Image déclaration douane" },
  { value: "DEVIS", label: "Devis" },
  { value: "LETTRE_DEMANDE_MISE_EN_PLACE_CI", label: "Lettre demande mise en place CI" },
  { value: "LETTRE_NOTIFICATION_CONTRAT", label: "Lettre notification contrat" },
  { value: "CONTRAT", label: "Contrat" },
  { value: "CERTIFICAT_NIF", label: "Certificat NIF" },
  { value: "LETTRE_CORRECTION", label: "Lettre de correction" },
  { value: "LETTRE_ADOPTION", label: "Lettre d'adoption" },
  { value: "BULLETIN_LIQUIDATION", label: "Bulletin de liquidation" },
  { value: "DECLARATION_DOUANE", label: "Déclaration douane" },
  { value: "FACTURE", label: "Facture" },
  { value: "CONNAISSEMENT", label: "Connaissement" },
  { value: "DECOMPTE", label: "Décompte" },
  { value: "AUTRE_DOCUMENT", label: "Autre document" },
  { value: "CREDIT_EXTERIEUR", label: "Crédit extérieur" },
  { value: "CREDIT_INTERIEUR", label: "Crédit intérieur" },
];

const GestionDocuments = () => {
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

  const correctionQuery = useQuery({
    queryKey: ["document-requirements", "CORRECTION_OFFRE_FISCALE"],
    queryFn: () => documentRequirementApi.getByProcessus("CORRECTION_OFFRE_FISCALE"),
  });
  const miseEnPlaceQuery = useQuery({
    queryKey: ["document-requirements", "MISE_EN_PLACE_CI"],
    queryFn: () => documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI"),
  });
  const utilisationQuery = useQuery({
    queryKey: ["document-requirements", "UTILISATION_CI"],
    queryFn: () => documentRequirementApi.getByProcessus("UTILISATION_CI"),
  });

  const queriesByProcessus: Record<ProcessusType, { data: DocumentRequirementDto[]; isLoading: boolean }> = {
    CORRECTION_OFFRE_FISCALE: { data: correctionQuery.data || [], isLoading: correctionQuery.isLoading },
    MISE_EN_PLACE_CI: { data: miseEnPlaceQuery.data || [], isLoading: miseEnPlaceQuery.isLoading },
    UTILISATION_CI: { data: utilisationQuery.data || [], isLoading: utilisationQuery.isLoading },
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentRequirementRequest) => documentRequirementApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requirements"] });
      toast({ title: "Document ajouté" });
      closeDialog();
    },
    onError: (e: Error) => {
      const msg = e.message?.includes("Unique") || e.message?.includes("unique") || e.message?.includes("UK_DOC_REQ")
        ? "Ce type de document est déjà configuré pour ce processus."
        : e.message;
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateDocumentRequirementRequest> }) =>
      documentRequirementApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requirements"] });
      toast({ title: "Document modifié" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentRequirementApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requirements"] });
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
    setDialogSousTag("");
  };

  const openCreate = (processus: ProcessusType, sousTag?: string) => {
    closeDialog();
    setDialogProcessus(processus);
    setDialogSousTag(sousTag || "");
    const reqs = queriesByProcessus[processus].data;
    setOrdreAffichage((reqs.length || 0) + 1);
    setDialogOpen(true);
  };

  const openEdit = (item: DocumentRequirementDto) => {
    setEditItem(item);
    setDialogProcessus(item.processus as ProcessusType);
    setTypeDocument(item.typeDocument);
    setObligatoire(item.obligatoire);
    setTypesAutorises(item.typesAutorises || []);
    // Strip the sous-tag from description for editing
    const rawDesc = item.description || "";
    const tag = rawDesc.includes(SOUS_SECTION_TAG_DOUANE) ? SOUS_SECTION_TAG_DOUANE : rawDesc.includes(SOUS_SECTION_TAG_TVA) ? SOUS_SECTION_TAG_TVA : "";
    setDialogSousTag(tag);
    setDescription(stripSousTags(rawDesc));
    setOrdreAffichage(item.ordreAffichage || 1);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!typeDocument.trim()) {
      toast({ title: "Veuillez saisir le type de document", variant: "destructive" });
      return;
    }
    // Vérifier doublon côté frontend (sauf en mode édition du même type)
    if (!editItem || editItem.typeDocument !== typeDocument.trim()) {
      const existing = queriesByProcessus[dialogProcessus].data;
      const duplicate = existing.find(
        (r) => r.typeDocument === typeDocument.trim()
      );
      if (duplicate) {
        toast({
          title: "Doublon détecté",
          description: `Le type "${typeDocument.trim()}" est déjà configuré pour ce processus.`,
          variant: "destructive",
        });
        return;
      }
    }
    const finalDescription = dialogSousTag ? `${dialogSousTag} ${description.trim()}`.trim() : description.trim();
    const payload: CreateDocumentRequirementRequest = {
      processus: dialogProcessus,
      typeDocument: typeDocument.trim(),
      obligatoire,
      typesAutorises,
      description: finalDescription,
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
          <h1 className="text-2xl font-bold text-foreground">GED – Gestion des Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configurez les documents requis par processus
          </p>
        </div>

        {PROCESSUS_SECTIONS.map((section) => {
          const q = queriesByProcessus[section.processus];
          const filteredReqs = section.filterFn ? q.data.filter(section.filterFn) : q.data;
          const sorted = sortReqs(filteredReqs);
          return (
            <Card key={section.key}>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg text-primary">{section.label}</CardTitle>
                <Button size="sm" onClick={() => openCreate(section.processus, section.sousTag)}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un document
                </Button>
              </CardHeader>
              <CardContent>
                {q.isLoading ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">Chargement…</p>
                ) : sorted.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">Aucun document configuré.</p>
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
                              {stripSousTags(req.description) || "—"}
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
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Modifier le document" : "Ajouter un document requis"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de document *</Label>
              <Select value={typeDocument} onValueChange={setTypeDocument}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type de document" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_DOCUMENT_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                        selected ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
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
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description du document..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Ordre d'affichage</Label>
              <Input type="number" min={1} value={ordreAffichage} onChange={(e) => setOrdreAffichage(Number(e.target.value))} />
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
