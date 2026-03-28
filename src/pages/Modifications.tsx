import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  avenantApi, AvenantDto, StatutAvenant, AVENANT_STATUT_LABELS,
  AVENANT_DOCUMENT_TYPES, TypeDocumentAvenant, DocumentAvenantDto,
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

const STATUT_COLORS: Record<StatutAvenant, string> = {
  EN_ATTENTE: "bg-orange-100 text-orange-800",
  VALIDE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
};

const Modifications = () => {
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

  const fetchData = async () => {
    setLoading(true);
    try {
      // Backend does not support GET /avenants — endpoint not available
      // Avenants can only be accessed by ID via their document endpoints
      setData([]);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les avenants", variant: "destructive" });
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
          setGedDocTypes(reqs.map(r => ({ value: r.typeDocument, label: r.description || r.typeDocument })));
        } else {
          setGedDocTypes(AVENANT_DOCUMENT_TYPES);
        }
      })
      .catch(() => setGedDocTypes(AVENANT_DOCUMENT_TYPES));
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
              Modifications / Avenants (P8)
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestion des avenants et notes de service avec documents GED
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par description, certificat, marché…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  {Object.entries(AVENANT_STATUT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
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
                    <TableHead>ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Certificat</TableHead>
                    <TableHead>Marché</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Aucun avenant trouvé
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.id}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{a.description || a.type || "—"}</TableCell>
                      <TableCell className="text-xs">{a.certificatNumero || "—"}</TableCell>
                      <TableCell className="text-xs">{a.marcheNumero || "—"}</TableCell>
                      <TableCell>
                        <Badge className={STATUT_COLORS[a.statut]}>{AVENANT_STATUT_LABELS[a.statut]}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.dateCreation ? new Date(a.dateCreation).toLocaleDateString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openDocs(a.id)}>
                          <FileText className="h-4 w-4 mr-1" /> Documents
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
        title={`Documents — Avenant #${docDialog}`}
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
