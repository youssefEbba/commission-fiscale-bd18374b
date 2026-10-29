import { useEffect, useState, useCallback } from "react";
import { RowNumberHead, RowNumberCell } from "@/components/ui/row-number";
import { DocumentButton } from "@/components/documents/DocumentButton";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PDFDocument } from "pdf-lib";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  conventionApi, ConventionDto, ConventionStatut,
  CONVENTION_STATUT_VALUES, CreateConventionRequest,
  DocumentDto, TypeDocumentConvention, CONVENTION_DOCUMENT_TYPES,
  bailleurApi, BailleurDto, CreateBailleurRequest,
  deviseApi, DeviseDto, CreateDeviseRequest,
  forexApi,
  documentRequirementApi, DocumentRequirementDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UploadRow } from "@/components/ui/upload-row";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText, Search, RefreshCw, Plus, Loader2,
  CheckCircle, XCircle, Filter, Upload, File, Paperclip,
  ArrowUp, ArrowDown, Merge, MoreHorizontal, Eye, Edit,
  Trash2, Ban, ShieldCheck, ShieldX, CalendarClock,
} from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutConvention, tTypeDocument, tDocRequirementLabel } from "@/i18n/enums";
import { formatDate, formatAmount, formatNumber } from "@/i18n/format";
import ClickableTableRow from "@/components/ui/clickable-table-row";
import { echeanceConvention } from "@/lib/conventionEcheance";
import { canEditConvention, conventionCancelMode } from "@/lib/conventionEditability";
import ConventionEditDialog, { DEFAULT_DEVISES } from "@/components/conventions/ConventionEditDialog";
import ConventionCancelDialog from "@/components/conventions/ConventionCancelDialog";

const STATUT_COLORS: Record<ConventionStatut | "ANNULEE", string> = {
  EN_ATTENTE: "bg-orange-100 text-orange-800",
  VALIDE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
  ANNULEE: "bg-gray-100 text-gray-800",
};

const todayIso = new Date().toISOString().slice(0, 10);

const Conventions = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const canUpdate = hasPermission("convention.update");
  const canAnnuler = hasPermission("convention.annuler");
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation(["conventions", "common"]);
  usePageTitle("conventions:list.title");

  const [conventions, setConventions] = useState<ConventionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailConvention, setDetailConvention] = useState<ConventionDto | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editConvention, setEditConvention] = useState<ConventionDto | null>(null);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectConvention, setRejectConvention] = useState<ConventionDto | null>(null);
  const [rejectMotif, setRejectMotif] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Cancel dialog : route autorité ou route de statut selon conventionCancelMode
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConvention, setCancelConvention] = useState<ConventionDto | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  // Documents state
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsConvention, setDocsConvention] = useState<ConventionDto | null>(null);
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadType, setUploadType] = useState<TypeDocumentConvention>("CONVENTION_CONTRAT");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Document replace
  const [replaceDocId, setReplaceDocId] = useState<number | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);

  const isAC = hasRole(["AUTORITE_CONTRACTANTE"]);
  const isDGB = hasRole(["DGB"]);
  const isDGI = hasRole(["DGI"]);
  const isAdmin = hasRole(["ADMIN_SI", "PRESIDENT"]);

  const fetchConventions = async (q?: string) => {
    setLoading(true);
    try {
      const data = await conventionApi.getAll(q);
      setConventions(data);
    } catch {
      toast({ title: t("common:errors.title", "Erreur"), description: t("conventions:load_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConventions(); }, []);

  // Recherche côté serveur (debounce 300 ms) — back filtre sur référence / intitulé / projectReference
  useEffect(() => {
    const t = setTimeout(() => { fetchConventions(search.trim() || undefined); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const [merging, setMerging] = useState(false);

  const mergeExistingDocs = async () => {
    if (documents.length < 2) return;
    const pdfDocs = documents.filter(d => d.nomFichier?.toLowerCase().endsWith(".pdf") && d.chemin);
    if (pdfDocs.length < 2) {
      toast({ title: t("conventions:docs.merge_impossible"), description: t("conventions:docs.merge_min_two_pdf"), variant: "destructive" });
      return;
    }
    setMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const doc of pdfDocs) {
        const response = await fetch(doc.chemin!);
        const bytes = await response.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }
      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes) as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `convention_${docsConvention?.reference || "merged"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:docs.merge_existing_success", { count: pdfDocs.length }) });
    } catch (e: any) {
      toast({ title: t("conventions:docs.merge_error"), description: e.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  };

  const handleStatutChange = async (id: number, statut: "VALIDE" | "REJETE") => {
    setActionLoading(id);
    try {
      await conventionApi.updateStatut(id, statut);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:statut_change.success", { label: tStatutConvention(statut) }) });
      fetchConventions();
    } catch (e: any) {
      toast({ title: t("common:errors.title", "Erreur"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // Open detail dialog
  const openDetail = (conv: ConventionDto) => {
    setDetailConvention(conv);
    setDetailOpen(true);
  };

  // Modification : visible seulement si canEditConvention (permission + EN_ATTENTE + AC titulaire/créatrice)
  const openEdit = (conv: ConventionDto) => {
    setEditConvention(conv);
    setEditOpen(true);
  };

  // Open reject dialog
  const openReject = (conv: ConventionDto) => {
    setRejectConvention(conv);
    setRejectMotif("");
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!rejectConvention || !rejectMotif.trim()) return;
    setRejecting(true);
    try {
      await conventionApi.updateStatut(rejectConvention.id, "REJETE", rejectMotif);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:reject.success") });
      setRejectOpen(false);
      fetchConventions();
    } catch (e: any) {
      toast({ title: t("common:errors.title", "Erreur"), description: e.message, variant: "destructive" });
    } finally {
      setRejecting(false);
    }
  };

  // Annulation : chemin choisi par conventionCancelMode (autorité titulaire/créatrice ou administration)
  const cancelModeOf = (conv: ConventionDto) => conventionCancelMode(conv, user?.autoriteContractanteId, canAnnuler, isAdmin);
  const openCancel = (conv: ConventionDto) => {
    setCancelConvention(conv);
    setCancelOpen(true);
  };

  const openDocuments = async (conv: ConventionDto) => {
    setDocsConvention(conv);
    setDocsOpen(true);
    setDocsLoading(true);
    try {
      const docs = await conventionApi.getDocuments(conv.id);
      setDocuments(docs);
    } catch {
      toast({ title: t("common:errors.title", "Erreur"), description: t("conventions:docs.load_error"), variant: "destructive" });
    } finally {
      setDocsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!docsConvention || !uploadFile) return;
    setUploading(true);
    try {
      await conventionApi.uploadDocument(docsConvention.id, uploadType, uploadFile);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:docs.upload_success") });
      setUploadFile(null);
      const docs = await conventionApi.getDocuments(docsConvention.id);
      setDocuments(docs);
    } catch (e: any) {
      toast({ title: t("common:errors.title", "Erreur"), description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConvDoc = async (docId: number) => {
    if (!docsConvention) return;
    try {
      await conventionApi.deleteDocument(docsConvention.id, docId);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:docs.deleted") });
      const docs = await conventionApi.getDocuments(docsConvention.id);
      setDocuments(docs);
    } catch (e: any) {
      toast({ title: t("common:errors.title", "Erreur"), description: e.message, variant: "destructive" });
    }
  };

  const handleReplaceConvDoc = async () => {
    if (!docsConvention || !replaceDocId || !replaceFile) return;
    setReplacing(true);
    try {
      await conventionApi.replaceDocument(docsConvention.id, replaceDocId, replaceFile);
      toast({ title: t("common:success.title", "Succès"), description: t("conventions:docs.replaced") });
      setReplaceDocId(null);
      setReplaceFile(null);
      const docs = await conventionApi.getDocuments(docsConvention.id);
      setDocuments(docs);
    } catch (e: any) {
      toast({ title: t("common:errors.title", "Erreur"), description: e.message, variant: "destructive" });
    } finally {
      setReplacing(false);
    }
  };

  const filtered = conventions.filter((c) => {
    const s = search.toLowerCase();
    const matchSearch = !s || (
      (c.reference || "").toLowerCase().includes(s) ||
      (c.projectReference || "").toLowerCase().includes(s) ||
      (c.intitule || "").toLowerCase().includes(s) ||
      (c.bailleurNom || c.bailleur || "").toLowerCase().includes(s)
    );
    const matchStatut = filterStatut === "ALL" || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterStatut]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {t("conventions:list.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("conventions:list.subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchConventions(search.trim() || undefined)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} /> {t("conventions:list.refresh")}
            </Button>
            {(isAC || isAdmin) && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 me-2" /> {t("conventions:list.new")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("conventions:list.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 me-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("conventions:list.all_statuses")}</SelectItem>
              {CONVENTION_STATUT_VALUES.map((k) => (
                <SelectItem key={k} value={k}>{tStatutConvention(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[600px] [&_th]:h-10 [&_th]:px-3 [&_td]:px-3 [&_td]:py-2">
                   <TableHeader>
                    <TableRow><RowNumberHead />
                      <TableHead>{t("conventions:columns.reference")}</TableHead>
                      <TableHead>{t("conventions:columns.intitule")}</TableHead>
                      <TableHead>{t("conventions:columns.bailleur")}</TableHead>
                      <TableHead>{t("conventions:columns.statut")}</TableHead>
                      <TableHead className="text-end">{t("conventions:columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t("conventions:list.empty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((c, rowIdx) => (
                        <ClickableTableRow key={c.id} to={`/dashboard/conventions/${c.id}`}>
                          <RowNumberCell n={(currentPage - 1) * PAGE_SIZE + rowIdx + 1} />
                          <TableCell className="font-medium whitespace-nowrap">
                            <Link
                              to={`/dashboard/conventions/${c.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {c.reference || `#${c.id}`}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[320px] truncate" title={c.intitule || ""}>{c.intitule || "—"}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{c.bailleurNom || c.bailleur || "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge className={`text-xs ${STATUT_COLORS[c.statut] || ""}`}>
                                {tStatutConvention(c.statut)}
                              </Badge>
                              {c.actif === false && (
                                <Badge variant="destructive" className="text-xs">{t("conventions:activation.disabled_badge")}</Badge>
                              )}
                              {(() => {
                                const ech = echeanceConvention(c.dateFin);
                                if (!ech) return null;
                                return (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${ech.niveau === "avertissement" ? "border-accent text-accent-foreground bg-accent/20" : "border-destructive text-destructive"}`}
                                  >
                                    <CalendarClock className="h-3 w-3 me-1" />
                                    {ech.niveau === "depassee"
                                      ? t("conventions:echeance.depassee", { date: formatDate(c.dateFin) })
                                      : t("conventions:echeance.dans_jours", { jours: ech.jours })}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => navigate(`/dashboard/conventions/${c.id}`)}
                              >
                                <Eye className="h-4 w-4 me-1" /> {t("conventions:actions.view")}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openDocuments(c)}>
                                    <Paperclip className="h-4 w-4 me-2" /> {t("conventions:actions.documents")}
                                  </DropdownMenuItem>
                                  {(isDGB || isDGI) && c.statut === "EN_ATTENTE" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleStatutChange(c.id, "VALIDE")}>
                                        <ShieldCheck className="h-4 w-4 me-2 text-green-600" /> {t("conventions:actions.validate")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openReject(c)}>
                                        <ShieldX className="h-4 w-4 me-2 text-destructive" /> {t("conventions:actions.reject")}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {(canEditConvention(c, user?.autoriteContractanteId, canUpdate) || cancelModeOf(c)) && (
                                    <DropdownMenuSeparator />
                                  )}
                                  {canEditConvention(c, user?.autoriteContractanteId, canUpdate) && (
                                    <DropdownMenuItem onClick={() => openEdit(c)}>
                                      <Edit className="h-4 w-4 me-2" /> {t("conventions:actions.edit")}
                                    </DropdownMenuItem>
                                  )}
                                  {cancelModeOf(c) && (
                                    <DropdownMenuItem onClick={() => openCancel(c)} className="text-destructive">
                                      <Ban className="h-4 w-4 me-2" /> {t("conventions:actions.cancel")}
                                    </DropdownMenuItem>
                                  )}
                              </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </ClickableTableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {filtered.length > 0 && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-t text-sm">
                    <span className="text-muted-foreground">
                      {t("conventions:list.pagination.range", { from: (currentPage - 1) * PAGE_SIZE + 1, to: Math.min(currentPage * PAGE_SIZE, filtered.length), total: filtered.length })}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>{t("conventions:list.pagination.previous")}</Button>
                      <span className="text-muted-foreground">{t("conventions:list.pagination.page", { current: currentPage, total: totalPages })}</span>
                      <Button variant="outline" size="sm" className="h-8" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>{t("conventions:list.pagination.next")}</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConventionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => { setPage(1); fetchConventions(search.trim() || undefined); }}
      />

      {/* Documents Dialog */}
      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              {t("conventions:docs.modal_title", { ref: docsConvention?.reference || docsConvention?.intitule || "" })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            {(isAC || isAdmin) && docsConvention?.statut !== "VALIDE" && docsConvention?.statut !== ("ANNULEE" as any) && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Label className="text-sm font-semibold">{t("conventions:docs.add_doc")}</Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={uploadType} onValueChange={(v) => setUploadType(v as TypeDocumentConvention)}>
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONVENTION_DOCUMENT_TYPES.map((value) => (
                          <SelectItem key={value} value={value}>{tTypeDocument(value)}</SelectItem>
                        ))}

                      </SelectContent>
                    </Select>
                    <UploadRow
                      id="conv-upload-doc"
                      className="flex-1"
                      label={t("conventions:docs.add_doc")}
                      file={uploadFile}
                      onFileChange={setUploadFile}
                    />
                    <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Upload className="h-4 w-4 me-1" />}
                      {t("conventions:actions.send")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!docsLoading && documents.filter(d => d.nomFichier?.toLowerCase().endsWith(".pdf")).length >= 2 && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={mergeExistingDocs} disabled={merging}>
                  {merging ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Merge className="h-4 w-4 me-1" />}
                  {t("conventions:docs.merge_all_pdf")}
                </Button>
              </div>
            )}

            {docsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <File className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>{t("conventions:docs.empty")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("conventions:columns.type")}</TableHead>
                    <TableHead>{t("conventions:columns.filename")}</TableHead>
                    <TableHead>{t("conventions:columns.date")}</TableHead>
                    <TableHead className="text-end">{t("conventions:columns.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {tTypeDocument(doc.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{doc.nomFichier}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(doc.dateUpload)}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end">
                          {doc.chemin && (
                            <DocumentButton doc={{ id: doc.id, chemin: doc.chemin, nomFichier: doc.nomFichier }} icon={FileText} iconClassName="h-4 w-4 me-1" variant="outline" size="sm">
                              {t("conventions:actions.open")}
                            </DocumentButton>
                          )}
                          {(isAC || isAdmin) && docsConvention?.statut !== "VALIDE" && docsConvention?.statut !== ("ANNULEE" as any) && (
                            <>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setReplaceDocId(doc.id); setReplaceFile(null); }}>
                                {t("conventions:actions.replace")}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive" onClick={() => handleDeleteConvDoc(doc.id)}>
                                <Trash2 className="h-3 w-3" />
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
            {replaceDocId && (
              <div className="flex items-center gap-2 border border-border rounded-lg p-2">
                <UploadRow
                  id="conv-replace-doc"
                  className="flex-1"
                  label={t("conventions:actions.replace", { defaultValue: "Remplacer le document" })}
                  file={replaceFile}
                  onFileChange={setReplaceFile}
                />
                <Button size="sm" onClick={handleReplaceConvDoc} disabled={replacing || !replaceFile}>
                  {replacing ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
                  {t("conventions:actions.confirm")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setReplaceDocId(null); setReplaceFile(null); }}>
                  ✕
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> {t("conventions:docs.details_title")}
            </DialogTitle>
          </DialogHeader>
          {detailConvention && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{t("conventions:columns.reference")} :</span> <span className="font-medium">{detailConvention.reference || "—"}</span></div>
                <div><span className="text-muted-foreground">{t("conventions:fields.statut")} :</span> <Badge className={`text-xs ms-1 ${STATUT_COLORS[detailConvention.statut] || ""}`}>{tStatutConvention(detailConvention.statut)}</Badge></div>
              </div>
              <div><span className="text-muted-foreground">{t("conventions:fields.intitule")} :</span> <span className="font-medium">{detailConvention.intitule || "—"}</span></div>
              <div><span className="text-muted-foreground">{t("conventions:fields.bailleur")} :</span> {detailConvention.bailleurNom || detailConvention.bailleur || "—"}</div>
              <div><span className="text-muted-foreground">{t("conventions:fields.descriptif")} :</span> {detailConvention.bailleurDetails || "—"}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{t("conventions:fields.date_signature")} :</span> {formatDate(detailConvention.dateSignature)}</div>
                <div><span className="text-muted-foreground">{t("conventions:fields.date_fin")} :</span> {formatDate(detailConvention.dateFin)}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><span className="text-muted-foreground">{t("conventions:fields.montant_devise")} :</span><br />{detailConvention.montantDevise != null ? formatAmount(detailConvention.montantDevise, { currency: detailConvention.deviseOrigine || "MRU", minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</div>
                <div><span className="text-muted-foreground">{t("conventions:fields.taux")} :</span><br />{detailConvention.tauxChange != null ? formatNumber(detailConvention.tauxChange) : "—"}</div>
                <div><span className="text-muted-foreground">{t("conventions:fields.montant_mru")} :</span><br />{detailConvention.montantMru != null ? formatAmount(detailConvention.montantMru, { currency: "MRU", minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</div>
              </div>
              {detailConvention.autoriteContractanteNom && (
                <div><span className="text-muted-foreground">{t("conventions:fields.autorite_contractante")} :</span> {detailConvention.autoriteContractanteNom}</div>
              )}
              {detailConvention.motifRejet && (
                <div className="bg-destructive/10 rounded p-2"><span className="text-destructive font-medium">{t("conventions:fields.motif_rejet")} :</span> {detailConvention.motifRejet}</div>
              )}
              <div><span className="text-muted-foreground">{t("conventions:fields.date_creation")} :</span> {formatDate(detailConvention.dateCreation)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — EN_ATTENTE, AC titulaire ou créatrice */}
      <ConventionEditDialog
        convention={editConvention}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => fetchConventions(search.trim() || undefined)}
      />

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="h-5 w-5" /> {t("conventions:reject.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("conventions:reject.convention_label")} <span className="font-medium text-foreground">{rejectConvention?.reference || rejectConvention?.intitule}</span>
            </p>
            <div className="space-y-2">
              <Label>{t("conventions:reject.motif_required")}</Label>
              <Textarea
                value={rejectMotif}
                onChange={(e) => setRejectMotif(e.target.value)}
                placeholder={t("conventions:reject.motif_placeholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("conventions:actions.dismiss")}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting || !rejectMotif.trim()}>
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <XCircle className="h-4 w-4 me-1" />}
              {t("conventions:actions.confirm_reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <ConventionCancelDialog
        convention={cancelConvention}
        mode={cancelConvention ? cancelModeOf(cancelConvention) : null}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={() => fetchConventions()}
      />
    </DashboardLayout>
  );
};

export default Conventions;
