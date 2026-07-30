import { useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE } from "@/lib/apiConfig";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UploadRow } from "@/components/ui/upload-row";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatFileSize } from "@/i18n/format";
import {
  Upload, FileText, Loader2, Clock, CheckCircle2, Archive,
  File, FileImage, FileSpreadsheet, AlertCircle, Trash2, Replace, X
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
  const { t } = useTranslation();
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
  const activeTypes = new Set(activeDocs.map(d => d.type));

  const handleUpload = async () => {
    if (!dossierId || !uploadFile || !uploadType) return;
    setUploading(true);
    try {
      await onUpload(dossierId, uploadType, uploadFile);
      toast({ title: t("ged:toast.success_title"), description: t("ged:toast.upload_success_desc") });
      setUploadFile(null);
      await onRefresh(dossierId);
    } catch (e: any) {
      toast({ title: t("ged:toast.error_title"), description: e.message || t("ged:toast.upload_error_fallback"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!dossierId || !onDeleteDocument) return;
    try {
      await onDeleteDocument(dossierId, docId);
      toast({ title: t("ged:toast.success_title"), description: t("ged:toast.delete_success_desc") });
      await onRefresh(dossierId);
    } catch (e: any) {
      toast({ title: t("ged:toast.error_title"), description: e.message, variant: "destructive" });
    }
  };

  const openFile = async (doc: GEDDocument) => {
    if (!doc.chemin) return;
    let url = doc.chemin;
    if (!/^https?:\/\//i.test(url)) {
      const apiOrigin = API_BASE.replace(/\/api\/?$/, "");
      url = apiOrigin + (url.startsWith("/") ? "" : "/") + url;
    }
    // Récupération authentifiée + bypass ngrok warning, puis ouverture via blob
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        // Fallback téléchargement si popup bloqué
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = doc.nomFichier || "document";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e: any) {
      toast({
        title: t("ged:toast.error_title"),
        description: t("ged:toast.open_error", { defaultValue: "Impossible d'ouvrir le document. Vérifiez que le tunnel backend est actif." }) + (e?.message ? ` (${e.message})` : ""),
        variant: "destructive",
      });
    }
  };

  const handleReplaceDoc = async () => {
    if (!dossierId || !replaceDocId || !replaceFile || !onReplaceDocument) return;
    setReplacing(true);
    try {
      await onReplaceDocument(dossierId, replaceDocId, replaceFile);
      toast({ title: t("ged:toast.success_title"), description: t("ged:toast.replace_success_desc") });
      setReplaceDocId(null);
      setReplaceFile(null);
      await onRefresh(dossierId);
    } catch (e: any) {
      toast({ title: t("ged:toast.error_title"), description: e.message, variant: "destructive" });
    } finally {
      setReplacing(false);
    }
  };

  const renderDocTable = (docs: GEDDocument[], showActifBadge = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("ged:document.table.type")}</TableHead>
          <TableHead>{t("ged:document.table.file")}</TableHead>
          <TableHead>{t("ged:document.table.size")}</TableHead>
          <TableHead>{t("ged:document.table.version")}</TableHead>
          <TableHead>{t("ged:document.table.date")}</TableHead>
          {showActifBadge && <TableHead>{t("ged:document.table.state")}</TableHead>}
          {canManageDocuments && !showActifBadge && <TableHead className="text-end">{t("ged:document.table.actions")}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={canManageDocuments && !showActifBadge ? 7 : (showActifBadge ? 6 : 5)} className="text-center py-6 text-muted-foreground">
              {t("ged:document.empty")}
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
                  <button
                    type="button"
                    onClick={() => openFile(d)}
                    className="text-primary underline text-xs hover:text-primary/80 transition-colors text-start"
                  >
                    {d.nomFichier}
                  </button>
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
              {d.dateUpload ? formatDateTime(d.dateUpload) : "—"}
            </TableCell>
            {showActifBadge && (
              <TableCell>
                <Badge variant={d.actif !== false ? "default" : "secondary"} className="text-xs">
                  {d.actif !== false ? t("ged:document.state_active") : t("ged:document.state_replaced")}
                </Badge>
              </TableCell>
            )}
            {canManageDocuments && !showActifBadge && (
              <TableCell className="text-end">
                <div className="flex gap-1 justify-end">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setReplaceDocId(d.id); setReplaceFile(null); }}>
                    <Replace className="h-3 w-3 me-1" /> {t("ged:document.replace")}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => handleDeleteDoc(d.id)} aria-label={t("ged:toast.delete_success_desc")}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
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
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t("ged:document.required_section_title")}
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

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="actifs" className="flex-1 gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("ged:document.tab_active", { count: activeDocs.length })}
                </TabsTrigger>
                <TabsTrigger value="historique" className="flex-1 gap-1">
                  <Archive className="h-3.5 w-3.5" />
                  {t("ged:document.tab_history", { count: historyDocs.length })}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="actifs">
                {renderDocTable(activeDocs)}
              </TabsContent>

              <TabsContent value="historique">
                {historyDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {t("ged:document.no_history")}
                  </p>
                ) : (
                  renderDocTable(historyDocs, true)
                )}
              </TabsContent>
            </Tabs>

            {replaceDocId && (
              <div className="flex items-center gap-2 border border-border rounded-lg p-2">
                <UploadRow
                  id="ged-replace-file"
                  className="flex-1"
                  label={t("ged:document.replace", { defaultValue: "Remplacer le document" })}
                  file={replaceFile}
                  onFileChange={setReplaceFile}
                  browseLabel={t("ged:document.browse", { defaultValue: "Parcourir" }) as string}
                />
                <Button size="sm" onClick={handleReplaceDoc} disabled={replacing || !replaceFile}>
                  {replacing ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Replace className="h-4 w-4 me-1" />}
                  {t("ged:document.confirm")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setReplaceDocId(null); setReplaceFile(null); }} aria-label={t("ged:document.cancel")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {canUpload && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  {t("ged:upload.section_title")}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {t("ged:upload.section_help")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t("ged:upload.type_label")}</Label>
                    <Select value={uploadType} onValueChange={setUploadType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((dt) => (
                          <SelectItem key={dt.value} value={dt.value}>
                            {dt.label}
                            {activeTypes.has(dt.value) && t("ged:document.replacement_suffix")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t("ged:upload.file_label")}</Label>
                    <label
                      htmlFor="ged-upload-file"
                      className="mt-1 flex w-full items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring transition-colors"
                    >
                      {uploadFile ? (
                        <>
                          {getFileIcon(uploadFile.name)}
                          <span className="flex-1 truncate text-xs">{uploadFile.name}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">({formatFileSize(uploadFile.size)})</span>
                          <button
                            type="button"
                            aria-label={t("ged:document.cancel") as string}
                            className="rounded-full p-1 hover:bg-destructive/10 text-destructive"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUploadFile(null); }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-xs text-muted-foreground">{t("ged:upload.file_label")}</span>
                          <span className="text-xs text-primary">{t("ged:document.browse", { defaultValue: "Parcourir" })}</span>
                        </>
                      )}
                      <input
                        id="ged-upload-file"
                        type="file"
                        className="sr-only"
                        onChange={(e) => { setUploadFile(e.target.files?.[0] || null); e.target.value = ""; }}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      />
                    </label>
                  </div>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile}
                  className="w-full sm:w-auto"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin me-2" />
                  ) : (
                    <Upload className="h-4 w-4 me-2" />
                  )}
                  {t("ged:upload.submit")}
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
