import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DocumentGED from "@/components/ged/DocumentGED";
import { GEDDocument, GEDDocumentType } from "@/components/ged/DocumentGED";
import {
  certificatCreditApi, CertificatCreditDto, CERTIFICAT_STATUT_LABELS, CertificatStatut,
  utilisationCreditApi, UtilisationCreditDto, UTILISATION_STATUT_LABELS, UtilisationStatut,
  documentRequirementApi, DocumentRequirementDto, DocumentDto,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Award, Loader2, Landmark, CalendarDays, Building2, CreditCard, FileText } from "lucide-react";

const STATUT_COLORS_CERT: Record<CertificatStatut, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_CONTROLE: "bg-teal-100 text-teal-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION_DGI: "bg-indigo-100 text-indigo-800",
  EN_VALIDATION_PRESIDENT: "bg-purple-100 text-purple-800",
  VALIDE_PRESIDENT: "bg-violet-100 text-violet-800",
  EN_OUVERTURE_DGTCP: "bg-yellow-100 text-yellow-800",
  OUVERT: "bg-emerald-100 text-emerald-800",
  MODIFIE: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

const STATUT_COLORS_UTIL: Record<UtilisationStatut, string> = {
  DEMANDEE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION: "bg-yellow-100 text-yellow-800",
  VISE: "bg-purple-100 text-purple-800",
  VALIDEE: "bg-emerald-100 text-emerald-800",
  LIQUIDEE: "bg-green-100 text-green-800",
  APUREE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
};

const CertificatDetail = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [certificat, setCertificat] = useState<CertificatCreditDto | null>(null);
  const [utilisations, setUtilisations] = useState<UtilisationCreditDto[]>([]);
  const [loading, setLoading] = useState(true);

  // GED documents state
  const [showGed, setShowGed] = useState(false);
  const [gedDocs, setGedDocs] = useState<GEDDocument[]>([]);
  const [gedLoading, setGedLoading] = useState(false);
  const [gedDocTypes, setGedDocTypes] = useState<GEDDocumentType[]>([]);

  const role = (user as any)?.role;
  const canUpload = role === "ENTREPRISE" || role === "ADMIN_SI" || role === "DGTCP";

  useEffect(() => {
    if (!id) return;
    const certId = Number(id);
    setLoading(true);

    const fetchCert = async (): Promise<CertificatCreditDto> => {
      try {
        return await certificatCreditApi.getById(certId);
      } catch {
        // Fallback: try enterprise list or global list
        try {
          if (user?.entrepriseId) {
            const certs = await certificatCreditApi.getByEntreprise(user.entrepriseId);
            const found = certs.find(c => c.id === certId);
            if (found) return found;
          }
          const all = await certificatCreditApi.getAll();
          const found = all.find(c => c.id === certId);
          if (found) return found;
        } catch { /* ignore */ }
        throw new Error("Certificat introuvable");
      }
    };

    Promise.all([
      fetchCert(),
      utilisationCreditApi.getByCertificat(certId).catch(() =>
        utilisationCreditApi.getAll().then(all => all.filter(u => u.certificatCreditId === certId))
      ),
    ])
      .then(([cert, utils]) => {
        setCertificat(cert);
        setUtilisations(utils);
      })
      .catch(() => {
        toast({ title: "Erreur", description: "Impossible de charger le certificat", variant: "destructive" });
      })
      .finally(() => setLoading(false));

    // Load GED document requirements
    documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI")
      .then((reqs) => {
        setGedDocTypes(reqs.map(r => ({ value: r.typeDocument, label: formatDocLabel(r.typeDocument) })));
      })
      .catch(() => {
        // Fallback document types
        setGedDocTypes([
          { value: "CERTIFICAT_CREDIT", label: "Certificat de crédit" },
          { value: "DECISION_COMMISSION", label: "Décision de la commission" },
          { value: "AUTRE", label: "Autre" },
        ]);
      });
  }, [id]);

  const loadGedDocs = async (certId: number) => {
    setGedLoading(true);
    try {
      const docs = await certificatCreditApi.getDocuments(certId);
      setGedDocs(docs.map((d: DocumentDto) => ({
        id: d.id,
        type: d.type || "AUTRE",
        nomFichier: d.nomFichier,
        chemin: d.chemin,
        dateUpload: d.dateUpload,
        taille: d.taille,
        version: d.version,
        actif: d.actif,
      })));
    } catch {
      setGedDocs([]);
    } finally {
      setGedLoading(false);
    }
  };

  const openGed = () => {
    if (!id) return;
    loadGedDocs(Number(id));
    setShowGed(true);
  };

  const handleGedUpload = async (dossierId: number, type: string, file: File) => {
    await certificatCreditApi.uploadDocument(dossierId, type, file);
  };

  const handleGedRefresh = async (dossierId: number) => {
    await loadGedDocs(dossierId);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!certificat) {
    return (
      <DashboardLayout>
        <div className="text-center py-24 text-muted-foreground">Certificat introuvable</div>
      </DashboardLayout>
    );
  }

  const c = certificat;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              Certificat {c.numero || c.reference || `#${c.id}`}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Détail du certificat, documents GED et historique des utilisations</p>
          </div>
          <Button variant="outline" onClick={openGed}>
            <FileText className="h-4 w-4 mr-2" /> Documents GED
          </Button>
        </div>

        {/* Certificate Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entreprise</p>
                  <p className="font-semibold text-sm">{c.entrepriseRaisonSociale || c.entrepriseNom || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <Badge className={`text-xs mt-1 ${STATUT_COLORS_CERT[c.statut]}`}>
                    {CERTIFICAT_STATUT_LABELS[c.statut]}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date d'émission</p>
                  <p className="font-semibold text-sm">
                    {(c.dateEmission || c.dateCreation) ? new Date(c.dateEmission || c.dateCreation!).toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Validité</p>
                  <p className="font-semibold text-sm">
                    {c.dateValidite ? new Date(c.dateValidite).toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Montants */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Montant Cordon (Douane)</p>
              <p className="text-xl font-bold">{(c.montantCordon ?? c.montantDouane ?? 0).toLocaleString("fr-FR")} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Montant TVA Intérieure</p>
              <p className="text-xl font-bold">{(c.montantTVAInterieure ?? c.montantInterieur ?? 0).toLocaleString("fr-FR")} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Solde Cordon</p>
              <p className="text-xl font-bold text-emerald-600">{(c.soldeCordon ?? 0).toLocaleString("fr-FR")} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Solde TVA</p>
              <p className="text-xl font-bold text-green-600">{(c.soldeTVA ?? 0).toLocaleString("fr-FR")} <span className="text-sm font-normal text-muted-foreground">MRU</span></p>
            </CardContent>
          </Card>
        </div>

        {/* Info supplémentaires */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations complémentaires</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {c.demandeCorrectionId && (
                <div>
                  <p className="text-muted-foreground">Demande correction</p>
                  <p className="font-medium">#{c.demandeCorrectionId}</p>
                </div>
              )}
              {c.marcheId && (
                <div>
                  <p className="text-muted-foreground">Marché</p>
                  <p className="font-medium">#{c.marcheId}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Utilisations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Utilisations liées ({utilisations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Droits</TableHead>
                  <TableHead>TVA</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utilisations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune utilisation pour ce certificat
                    </TableCell>
                  </TableRow>
                ) : (
                  utilisations.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">#{u.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {u.type === "DOUANIER" ? "Douane (P6)" : "TVA Int. (P7)"}
                        </Badge>
                      </TableCell>
                      <TableCell>{u.montant?.toLocaleString("fr-FR") ?? "—"} MRU</TableCell>
                      <TableCell>
                        {u.type === "DOUANIER"
                          ? `${u.montantDroits?.toLocaleString("fr-FR") ?? "—"} MRU`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {u.type === "DOUANIER"
                          ? `${u.montantTVADouane?.toLocaleString("fr-FR") ?? "—"} MRU`
                          : `${u.montantTVAInterieure?.toLocaleString("fr-FR") ?? "—"} MRU`}
                      </TableCell>
                      <TableCell>
                        {(u.dateLiquidation || u.dateCreation)
                          ? new Date(u.dateLiquidation || u.dateCreation!).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUT_COLORS_UTIL[u.statut]}`}>
                          {UTILISATION_STATUT_LABELS[u.statut]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* GED Document Dialog */}
      <DocumentGED
        open={showGed}
        onOpenChange={setShowGed}
        title={`Documents GED — Certificat ${c.numero || c.reference || `#${c.id}`}`}
        dossierId={c.id}
        documentTypes={gedDocTypes}
        documents={gedDocs}
        loading={gedLoading}
        canUpload={canUpload}
        onUpload={handleGedUpload}
        onRefresh={handleGedRefresh}
      />
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

export default CertificatDetail;
