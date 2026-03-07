import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  certificatCreditApi, CertificatCreditDto, CertificatStatut,
  CERTIFICAT_STATUT_LABELS,
  DocumentDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Search, RefreshCw, Eye, Loader2, Filter, FileText } from "lucide-react";

const API_BASE = "https://a488-102-214-208-11.ngrok-free.app/api";

const STATUT_COLORS: Record<CertificatStatut, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_VERIFICATION_DGI: "bg-indigo-100 text-indigo-800",
  EN_VALIDATION_PRESIDENT: "bg-purple-100 text-purple-800",
  VALIDE_PRESIDENT: "bg-violet-100 text-violet-800",
  EN_OUVERTURE_DGTCP: "bg-yellow-100 text-yellow-800",
  OUVERT: "bg-emerald-100 text-emerald-800",
  MODIFIE: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

const ROLE_TRANSITIONS: Record<string, { from: CertificatStatut[]; to: CertificatStatut; label: string }[]> = {
  DGI: [
    { from: ["DEMANDE"], to: "EN_VERIFICATION_DGI", label: "Vérifier (DGI)" },
    { from: ["DEMANDE", "EN_VERIFICATION_DGI"], to: "ANNULE", label: "Annuler" },
  ],
  PRESIDENT: [
    { from: ["EN_VERIFICATION_DGI"], to: "EN_VALIDATION_PRESIDENT", label: "Prendre en charge" },
    { from: ["EN_VALIDATION_PRESIDENT"], to: "VALIDE_PRESIDENT", label: "Valider & signer" },
    { from: ["DEMANDE", "EN_VERIFICATION_DGI", "EN_VALIDATION_PRESIDENT"], to: "ANNULE", label: "Annuler" },
  ],
  DGTCP: [
    { from: ["VALIDE_PRESIDENT"], to: "EN_OUVERTURE_DGTCP", label: "Prendre en charge" },
    { from: ["EN_OUVERTURE_DGTCP"], to: "OUVERT", label: "Ouvrir le crédit" },
    { from: ["DEMANDE", "VALIDE_PRESIDENT", "EN_OUVERTURE_DGTCP"], to: "ANNULE", label: "Annuler" },
  ],
  AUTORITE_CONTRACTANTE: [
    { from: ["DEMANDE"], to: "ANNULE", label: "Annuler" },
  ],
};


function getDocFileUrl(doc: DocumentDto): string {
  if (!doc.chemin) return "#";
  if (doc.chemin.startsWith("http")) return doc.chemin;
  return `${API_BASE}/documents/download/${doc.id}`;
}

const Certificats = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selected, setSelected] = useState<CertificatCreditDto | null>(null);

  // Detail documents
  const [detailDocs, setDetailDocs] = useState<DocumentDto[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const fetchCertificats = async () => {
    setLoading(true);
    try {
      setCertificats(await certificatCreditApi.getAll());
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les certificats", variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCertificats(); }, []);


  const handleStatut = async (id: number, statut: CertificatStatut) => {
    setActionLoading(id);
    try {
      await certificatCreditApi.updateStatut(id, statut);
      toast({ title: "Succès", description: `Statut: ${CERTIFICAT_STATUT_LABELS[statut]}` });
      fetchCertificats();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  };

  const openDetail = async (c: CertificatCreditDto) => {
    setSelected(c);
    setDetailDocs([]);
    setLoadingDocs(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/certificats-credit/${c.id}/documents`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (res.ok) {
        setDetailDocs(await res.json());
      }
    } catch { /* ignore */ }
    setLoadingDocs(false);
  };

  const transitions = ROLE_TRANSITIONS[role] || [];

  const filtered = certificats.filter((c) => {
    const ms = (c.reference || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.entrepriseNom || "").toLowerCase().includes(search.toLowerCase()) ||
      String(c.id).includes(search);
    return ms && (filterStatut === "ALL" || c.statut === filterStatut);
  });

  

  const pageTitle: Record<string, string> = {
    AUTORITE_CONTRACTANTE: "Mes certificats",
    ENTREPRISE: "Mes certificats de crédit",
    DGTCP: "Certificats – Ouverture & ventilation",
    DGI: "Certificats – Contrôle fiscal",
    PRESIDENT: "Certificats en attente de signature",
    ADMIN_SI: "Tous les certificats (Audit)",
  };

  const canCreate = role === "AUTORITE_CONTRACTANTE";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              {pageTitle[role] || "Certificats de crédit"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Mise en place du crédit d'impôt</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle demande
              </Button>
            )}
            <Button variant="outline" onClick={fetchCertificats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(CERTIFICAT_STATUT_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Réf.</TableHead>
                     <TableHead>Entreprise</TableHead>
                     <TableHead>Cordon (Douane)</TableHead>
                     <TableHead>TVA Int.</TableHead>
                     <TableHead>Solde Cordon</TableHead>
                     <TableHead>Solde TVA</TableHead>
                     <TableHead>Statut</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun certificat</TableCell></TableRow>
                  ) : filtered.map((c) => (
                    <TableRow key={c.id}>
                       <TableCell className="font-medium">{c.reference || `#${c.id}`}</TableCell>
                       <TableCell className="text-muted-foreground">{c.entrepriseNom || "—"}</TableCell>
                       <TableCell>{c.montantCordon?.toLocaleString("fr-FR") ?? c.montantDouane?.toLocaleString("fr-FR") ?? "—"}</TableCell>
                       <TableCell>{c.montantTVAInterieure?.toLocaleString("fr-FR") ?? c.montantInterieur?.toLocaleString("fr-FR") ?? "—"}</TableCell>
                       <TableCell className="font-semibold">{c.soldeCordon?.toLocaleString("fr-FR") ?? "—"}</TableCell>
                       <TableCell className="font-semibold">{c.soldeTVA?.toLocaleString("fr-FR") ?? "—"}</TableCell>
                       <TableCell><Badge className={`text-xs ${STATUT_COLORS[c.statut]}`}>{CERTIFICAT_STATUT_LABELS[c.statut]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(c)}><Eye className="h-4 w-4 mr-1" /> Détail</Button>
                          {transitions.map((t) =>
                            t.from.includes(c.statut) ? (
                              <Button key={t.to} variant={t.to === "ANNULE" ? "destructive" : "default"} size="sm" disabled={actionLoading === c.id} onClick={() => handleStatut(c.id, t.to)}>
                                {actionLoading === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t.label}
                              </Button>
                            ) : null
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Certificat {selected?.reference || `#${selected?.id}`}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Entreprise</span><p className="font-medium">{selected.entrepriseNom || "—"}</p></div>
                <div><span className="text-muted-foreground">Statut</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{CERTIFICAT_STATUT_LABELS[selected.statut]}</Badge></p></div>
                <div><span className="text-muted-foreground">Montant Cordon (Douane)</span><p className="font-medium">{selected.montantCordon?.toLocaleString("fr-FR") ?? selected.montantDouane?.toLocaleString("fr-FR") ?? "0"} MRU</p></div>
                <div><span className="text-muted-foreground">Montant TVA Intérieure</span><p className="font-medium">{selected.montantTVAInterieure?.toLocaleString("fr-FR") ?? selected.montantInterieur?.toLocaleString("fr-FR") ?? "0"} MRU</p></div>
                <div><span className="text-muted-foreground">Solde Cordon</span><p className="font-bold">{selected.soldeCordon?.toLocaleString("fr-FR") ?? "—"} MRU</p></div>
                <div><span className="text-muted-foreground">Solde TVA</span><p className="font-bold">{selected.soldeTVA?.toLocaleString("fr-FR") ?? "—"} MRU</p></div>
                <div><span className="text-muted-foreground">Total</span><p className="font-bold text-primary">{selected.montantTotal?.toLocaleString("fr-FR") || "0"} MRU</p></div>
                <div><span className="text-muted-foreground">Date</span><p>{selected.dateCreation ? new Date(selected.dateCreation).toLocaleDateString("fr-FR") : "—"}</p></div>
                {selected.dateValidite && <div><span className="text-muted-foreground">Validité</span><p>{new Date(selected.dateValidite).toLocaleDateString("fr-FR")}</p></div>}
                {selected.demandeCorrectionId && <div><span className="text-muted-foreground">Demande correction</span><p className="font-medium">#{selected.demandeCorrectionId}</p></div>}
                {selected.marcheId && <div><span className="text-muted-foreground">Marché</span><p className="font-medium">#{selected.marcheId}</p></div>}
              </div>

              {/* Documents */}
              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Documents du dossier</h4>
                {loadingDocs ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : detailDocs.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Aucun document associé</p>
                ) : (
                  <div className="space-y-2">
                    {detailDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.nomFichier}</p>
                            <p className="text-xs text-muted-foreground">{doc.type?.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                        <a
                          href={getDocFileUrl(doc)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Télécharger
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Demande de mise en place du crédit d'impôt
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Select correction */}
            <div className="space-y-2">
              <Label>Demande de correction (adoptée/notifiée) *</Label>
              <Select value={selectedCorrectionId} onValueChange={setSelectedCorrectionId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une correction..." /></SelectTrigger>
                <SelectContent>
                  {corrections.length === 0 ? (
                    <SelectItem value="__none" disabled>Aucune correction adoptée disponible</SelectItem>
                  ) : corrections.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.numero || `#${c.id}`} — {c.entrepriseRaisonSociale || "Entreprise"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info from selected correction */}
            {selectedCorrection && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 text-sm">
                  <p className="font-semibold mb-1">Correction sélectionnée</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">N°</span> {selectedCorrection.numero || `#${selectedCorrection.id}`}</div>
                    <div><span className="text-muted-foreground">Entreprise</span> {selectedCorrection.entrepriseRaisonSociale}</div>
                    <div><span className="text-muted-foreground">Statut</span> {selectedCorrection.statut}</div>
                    <div><span className="text-muted-foreground">AC</span> {selectedCorrection.autoriteContractanteNom}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents upload */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Pièces du dossier</Label>
              <div className="space-y-2">
                {MISE_EN_PLACE_DOC_TYPES.map((dt) => {
                  const req = docRequirements.find(r => r.typeDocument === dt.value);
                  const isRequired = req?.obligatoire ?? false;
                  const hasFile = !!docFiles[dt.value];
                  return (
                    <div key={dt.value} className="flex items-center gap-3 p-2 rounded border bg-background">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {dt.label}
                          {isRequired && <span className="text-destructive ml-1">*</span>}
                        </p>
                        {hasFile && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                            <CheckCircle className="h-3 w-3" /> {docFiles[dt.value].name}
                          </p>
                        )}
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setDocFiles(prev => ({ ...prev, [dt.value]: file }));
                          }}
                        />
                        <div className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <Upload className="h-3 w-3" />
                          {hasFile ? "Remplacer" : "Choisir"}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating || uploadingDocs}>
              {(creating || uploadingDocs) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Certificats;
