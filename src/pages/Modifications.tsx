import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  avenantApi, AvenantDto, StatutAvenant,
  TypeDocumentAvenant, DocumentAvenantDto,
  documentRequirementApi, DocumentRequirementDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Search, RefreshCw, Loader2, Filter, FileText } from "lucide-react";
import DocumentGED from "@/components/ged/DocumentGED";
import type { GEDDocumentType } from "@/components/ged/DocumentGED";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutAvenant, tTypeDocument, tDocRequirementLabel } from "@/i18n/enums";
import { formatDate } from "@/i18n/format";

const STATUT_COLORS: Record<StatutAvenant, string> = {
  EN_ATTENTE: "bg-orange-100 text-orange-800",
  VALIDE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
};

const AVENANT_DOC_TYPES: TypeDocumentAvenant[] = [
  "NOTE_SERVICE",
  "JUSTIFICATIONS_LEGALES",
  "LETTRES_MOTIVEES",
  "AVENANT_CONTRAT",
  "LETTRES_AUTORITE_CONTRACTANTE",
  "DETAIL_CORRECTIONS_NECESSAIRES",
  "DOCUMENTS_OFFICIELS",
  "DECISION_COMMISSION",
  "AUTRE_DOCUMENT",
];

const STATUT_VALUES: StatutAvenant[] = ["EN_ATTENTE", "VALIDE", "REJETE"];

const Modifications = () => {
  const { t } = useTranslation();
  usePageTitle("modifications:list.title");
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [data, setData] = useState<AvenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("ALL");

  // Document GED dialog
  const [docDialog, setDocDialog] = useState<number | null>(null);
  const [docs, setDocs] = useState<DocumentAvenantDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [gedDocTypes, setGedDocTypes] = useState<GEDDocumentType[]>([]);

  const defaultDocTypes = (): GEDDocumentType[] =>
    AVENANT_DOC_TYPES.map((v) => ({ value: v, label: tTypeDocument(v) }));

  const fetchData = async () => {
    setLoading(true);
    try {
      // Backend does not support GET /avenants — endpoint not available
      // Avenants can only be accessed by ID via their document endpoints
      setData([]);
    } catch {
      toast({
        title: t("modifications:toast.load_error_title"),
        description: t("modifications:toast.load_error_desc"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load GED requirements for MODIFICATION_CI on mount
  useEffect(() => {
    fetchData();
    documentRequirementApi.getByProcessus("MODIFICATION_CI")
      .then((reqs: DocumentRequirementDto[]) => {
        if (reqs.length > 0) {
          // Backend description is a referential value — do not translate
          setGedDocTypes(reqs.map(r => ({ value: r.typeDocument, label: r.description || tTypeDocument(r.typeDocument) })));
        } else {
          setGedDocTypes(defaultDocTypes());
        }
      })
      .catch(() => setGedDocTypes(defaultDocTypes()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDocs = async (id: number) => {
    setDocDialog(id);
    setDocsLoading(true);
    try {
      setDocs(await avenantApi.getDocuments(id));
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const refreshDocs = async (id: number) => {
    try {
      setDocs(await avenantApi.getDocuments(id));
    } catch { /* ignore */ }
  };

  const handleGEDUpload = async (dossierId: number, type: string, file: File) => {
    await avenantApi.uploadDocument(dossierId, type as TypeDocumentAvenant, file);
  };

  const canUpload = ["AUTORITE_CONTRACTANTE", "ENTREPRISE", "ADMIN_SI"].includes(role);

  const filtered = data.filter((a) => {
    const matchSearch =
      (a.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.certificatNumero || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.marcheNumero || "").toLowerCase().includes(search.toLowerCase()) ||
      String(a.id).includes(search);
    const matchStatut = filterStatut === "ALL" || a.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              {t("modifications:list.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("modifications:list.subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading} aria-label={t("modifications:actions.refresh")}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} />
              {t("modifications:actions.refresh")}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("modifications:list.search_placeholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-10"
                />
              </div>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 me-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("modifications:list.filter_all")}</SelectItem>
                  {STATUT_VALUES.map((k) => (
                    <SelectItem key={k} value={k}>{tStatutAvenant(k)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("modifications:list.columns.id")}</TableHead>
                    <TableHead>{t("modifications:list.columns.description")}</TableHead>
                    <TableHead>{t("modifications:list.columns.certificat")}</TableHead>
                    <TableHead>{t("modifications:list.columns.marche")}</TableHead>
                    <TableHead>{t("modifications:list.columns.statut")}</TableHead>
                    <TableHead>{t("modifications:list.columns.date")}</TableHead>
                    <TableHead>{t("modifications:list.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t("modifications:list.empty")}
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.id}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{a.description || a.type || "—"}</TableCell>
                      <TableCell className="text-xs">{a.certificatNumero || "—"}</TableCell>
                      <TableCell className="text-xs">{a.marcheNumero || "—"}</TableCell>
                      <TableCell>
                        <Badge className={STATUT_COLORS[a.statut]}>{tStatutAvenant(a.statut)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.dateCreation ? formatDate(a.dateCreation) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openDocs(a.id)} aria-label={t("modifications:actions.documents")}>
                          <FileText className="h-4 w-4 me-1" /> {t("modifications:actions.documents")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* GED Document dialog */}
      <DocumentGED
        open={docDialog !== null}
        onOpenChange={() => setDocDialog(null)}
        title={t("modifications:dialogs.documents_title", { id: docDialog })}
        dossierId={docDialog}
        documentTypes={gedDocTypes}
        documents={docs}
        loading={docsLoading}
        canUpload={canUpload}
        onUpload={handleGEDUpload}
        onRefresh={refreshDocs}
      />
    </DashboardLayout>
  );
};

export default Modifications;
