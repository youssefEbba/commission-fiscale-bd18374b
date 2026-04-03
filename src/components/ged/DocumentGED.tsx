import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileText, Loader2, Download, Clock, CheckCircle2, Archive,
  File, FileImage, FileSpreadsheet, AlertCircle, Trash2, Replace
} from "lucide-react";

export interface GEDDocument {
  id: number;
  type: string;
  nomFichier: string;
  chemin?: string;
  dateUpload?: string;
  taille?: number;
  version?: number;
  actif?: boolean;
}

export interface GEDDocumentType {
  value: string;
  label: string;
}

interface DocumentGEDProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  dossierId: number | null;
  documentTypes: GEDDocumentType[];
  documents: GEDDocument[];
  loading: boolean;
  canUpload: boolean;
  canManageDocuments?: boolean;
  onUpload: (dossierId: number, type: string, file: File) => Promise<void>;
  onRefresh: (dossierId: number) => Promise<void>;
  onDeleteDocument?: (dossierId: number, docId: number) => Promise<void>;
  onReplaceDocument?: (dossierId: number, docId: number, file: File) => Promise<void>;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const getFileIcon = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) return <FileImage className="h-4 w-4 text-emerald-500" />;
  if (["xls", "xlsx", "csv"].includes(ext || "")) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (["pdf"].includes(ext || "")) return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

const DocumentGED = ({
  open, onOpenChange, title, dossierId, documentTypes,
  documents, loading, canUpload, canManageDocuments, onUpload, onRefresh,
  onDeleteDocument, onReplaceDocument,
}: DocumentGEDProps) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"actifs" | "historique">("actifs");
  const [uploadType, setUploadType] = useState(documentTypes[0]?.value || "");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceDocId, setReplaceDocId] = useState<number | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);

  const activeDocs = documents.filter(d => d.actif !== false);
  const historyDocs = documents.filter(d => d.actif === false);

  // Check which required types are present (active)
  const activeTypes = new Set(activeDocs.map(d => d.type));

  const handleUpload = async () => {
    if (!dossierId || !uploadFile || !uploadType) return;
    setUploading(true);
    try {
      await onUpload(dossierId, uploadType, uploadFile);
      toast({ title: "Succès", description: "Document uploadé avec succès" });
      setUploadFile(null);
      await onRefresh(dossierId);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Échec de l'upload", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const renderDocTable = (docs: GEDDocument[], showActifBadge = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Fichier</TableHead>
          <TableHead>Taille</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Date</TableHead>
          {showActifBadge && <TableHead>État</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActifBadge ? 6 : 5} className="text-center py-6 text-muted-foreground">
              Aucun document
            </TableCell>
          </TableRow>
        ) : docs.map((d) => (
          <TableRow key={d.id} className={d.actif === false ? "opacity-60" : ""}>
            <TableCell>
              <span className="text-xs font-medium">
                {documentTypes.find(t => t.value === d.type)?.label || d.type}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getFileIcon(d.nomFichier)}
                {d.chemin ? (
                  <a
                    href={d.chemin}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline text-xs hover:text-primary/80 transition-colors"
                  >
                    {d.nomFichier}
                  </a>
                ) : (
                  <span className="text-xs">{d.nomFichier}</span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{formatFileSize(d.taille)}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">v{d.version || 1}</Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {d.dateUpload ? new Date(d.dateUpload).toLocaleDateString("fr-FR", {
                day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
              }) : "—"}
            </TableCell>
            {showActifBadge && (
              <TableCell>
                <Badge variant={d.actif !== false ? "default" : "secondary"} className="text-xs">
                  {d.actif !== false ? "Actif" : "Remplacé"}
                </Badge>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Required documents checklist */}
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Documents requis
              </h4>
              <div className="flex flex-wrap gap-2">
                {documentTypes.map((dt) => (
                  <Badge
                    key={dt.value}
                    variant={activeTypes.has(dt.value) ? "default" : "outline"}
                    className={`text-xs flex items-center gap-1 ${
                      activeTypes.has(dt.value)
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "border-amber-300 text-amber-700 bg-amber-50"
                    }`}
                  >
                    {activeTypes.has(dt.value) ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {dt.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Tabs: Active / History */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="actifs" className="flex-1 gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Actifs ({activeDocs.length})
                </TabsTrigger>
                <TabsTrigger value="historique" className="flex-1 gap-1">
                  <Archive className="h-3.5 w-3.5" />
                  Historique ({historyDocs.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="actifs">
                {renderDocTable(activeDocs)}
              </TabsContent>

              <TabsContent value="historique">
                {historyDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucune version précédente
                  </p>
                ) : (
                  renderDocTable(historyDocs, true)
                )}
              </TabsContent>
            </Tabs>

            {/* Upload section */}
            {canUpload && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  Ajouter / remplacer un document
                </h4>
                <p className="text-xs text-muted-foreground">
                  Si un document actif existe déjà pour le type sélectionné, il sera automatiquement remplacé (versionnage).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type de document</Label>
                    <Select value={uploadType} onValueChange={setUploadType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                            {activeTypes.has(t.value) && " (remplacement)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Fichier</Label>
                    <Input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    />
                  </div>
                </div>
                {uploadFile && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                    {getFileIcon(uploadFile.name)}
                    <span>{uploadFile.name}</span>
                    <span>({formatFileSize(uploadFile.size)})</span>
                  </div>
                )}
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile}
                  className="w-full sm:w-auto"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Uploader
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentGED;
