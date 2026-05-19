import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  certificatCreditApi, CertificatCreditDto, CertificatStatut,
  CERTIFICAT_STATUT_LABELS,
  DocumentDto,
  sousTraitanceApi,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Search, RefreshCw, Eye, Loader2, Filter, FileText } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tStatutCertificat, tTypeDocument } from "@/i18n/enums";
import { formatAmount, formatDate } from "@/i18n/format";

import { API_BASE } from "@/lib/apiConfig";

const STATUT_COLORS: Record<CertificatStatut, string> = {
  BROUILLON: "bg-slate-100 text-slate-700",
  ENVOYEE: "bg-sky-100 text-sky-800",
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

const ROLE_TRANSITIONS: Record<string, { from: CertificatStatut[]; to: CertificatStatut; labelKey: string }[]> = {
  AUTORITE_CONTRACTANTE: [],
  PRESIDENT: [
    { from: ["EN_VALIDATION_PRESIDENT"], to: "OUVERT", labelKey: "list.actions.valider_ouvrir" },
  ],
  DGTCP: [],
};

function getDocFileUrl(doc: DocumentDto): string {
  if (!doc.chemin) return "#";
  if (doc.chemin.startsWith("http")) return doc.chemin;
  return `${API_BASE}/documents/download/${doc.id}`;
}

const Certificats = () => {
  const { t } = useTranslation(["certificats", "common"]);
  usePageTitle("certificats:list.title");
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role as AppRole;
  const { toast } = useToast();
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [sousTraiteCertIds, setSousTraiteCertIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selected, setSelected] = useState<CertificatCreditDto | null>(null);

  const [detailDocs, setDetailDocs] = useState<DocumentDto[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const fetchCertificats = async () => {
    setLoading(true);
    try {
      if (role === "ENTREPRISE" && user?.entrepriseId) {
        let ownCerts: CertificatCreditDto[] = [];
        try {
          ownCerts = await certificatCreditApi.getByEntreprise(user.entrepriseId);
        } catch { /* ignore */ }

        let allSousTraitances: any[] = [];
        try {
          allSousTraitances = await sousTraitanceApi.getAll();
        } catch { /* ignore */ }

        const mySousTraitances = allSousTraitances.filter(
          (st: any) => st.sousTraitantEntrepriseId === user.entrepriseId && st.statut === "AUTORISEE"
        );

        const ownCertIds = new Set(ownCerts.map((c) => c.id));
        const stCertIds = new Set<number>();
        const sousTraiteCerts: CertificatCreditDto[] = [];

        for (const st of mySousTraitances) {
          if (!ownCertIds.has(st.certificatCreditId) && !stCertIds.has(st.certificatCreditId)) {
            stCertIds.add(st.certificatCreditId);
            try {
              const cert = await certificatCreditApi.getById(st.certificatCreditId);
              sousTraiteCerts.push(cert);
            } catch {
              sousTraiteCerts.push({
                id: st.certificatCreditId,
                numero: st.certificatNumero || `CERT-${st.certificatCreditId}`,
                reference: st.certificatNumero,
                statut: "OUVERT" as CertificatStatut,
                entrepriseId: st.entrepriseSourceId,
                entrepriseRaisonSociale: st.entrepriseSourceRaisonSociale || "—",
              } as CertificatCreditDto);
            }
          }
        }

        setSousTraiteCertIds(stCertIds);
        setCertificats([...ownCerts, ...sousTraiteCerts]);
      } else {
        setSousTraiteCertIds(new Set());
        setCertificats(await certificatCreditApi.getAll());
      }
    } catch {
      toast({ title: t("common:states.error"), description: t("certificats:list.toast.load_error"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCertificats(); }, []);

  const handleStatut = async (id: number, statut: CertificatStatut) => {
    setActionLoading(id);
    try {
      await certificatCreditApi.updateStatut(id, statut);
      toast({ title: t("common:states.success"), description: t("certificats:list.toast.statut_success", { label: tStatutCertificat(statut) }) });
      fetchCertificats();
    } catch (e: any) {
      toast({ title: t("common:states.error"), description: e.message, variant: "destructive" });
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
    if (c.statut !== "OUVERT" && c.statut !== "MODIFIE" && c.statut !== "CLOTURE") return false;
    const q = search.trim().toLowerCase();
    const ms = !q ||
      (c.reference || "").toLowerCase().includes(q) ||
      (c.numero || "").toLowerCase().includes(q) ||
      (c.entrepriseRaisonSociale || "").toLowerCase().includes(q) ||
      (c.entrepriseNom || "").toLowerCase().includes(q) ||
      String(c.id).includes(q);
    return ms && (filterStatut === "ALL" || c.statut === filterStatut);
  });

  const pageTitle = t(`certificats:list.role_titles.${role}`, {
    defaultValue: t("certificats:list.role_titles.DEFAULT"),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              {pageTitle}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("certificats:list.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchCertificats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} /> {t("certificats:list.refresh")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("certificats:list.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-48"><Filter className="h-4 w-4 me-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("certificats:list.filter_all")}</SelectItem>
              {Object.keys(CERTIFICAT_STATUT_LABELS).map((k) => (<SelectItem key={k} value={k}>{tStatutCertificat(k)}</SelectItem>))}
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
                     <TableHead>{t("certificats:list.columns.ref")}</TableHead>
                     <TableHead>{t("certificats:list.columns.entreprise")}</TableHead>
                     <TableHead>{t("certificats:list.columns.cordon")}</TableHead>
                     <TableHead>{t("certificats:list.columns.tva_int")}</TableHead>
                     <TableHead>{t("certificats:list.columns.solde_cordon")}</TableHead>
                     <TableHead>{t("certificats:list.columns.solde_tva")}</TableHead>
                     <TableHead>{t("certificats:list.columns.statut")}</TableHead>
                     <TableHead className="text-end">{t("certificats:list.columns.actions")}</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("certificats:list.empty")}</TableCell></TableRow>
                  ) : filtered.map((c) => (
                     <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/certificats/${c.id}`)}>
                       <TableCell className="font-medium">
                         {c.numero || c.reference || `#${c.id}`}
                         {sousTraiteCertIds.has(c.id) && (
                           <Badge className="ms-2 text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100">{t("certificats:list.badge.sous_traite")}</Badge>
                         )}
                       </TableCell>
                       <TableCell className="text-muted-foreground">{c.entrepriseRaisonSociale || c.entrepriseNom || "—"}</TableCell>
                       <TableCell>{formatAmount(c.montantCordon ?? c.montantDouane)}</TableCell>
                       <TableCell>{formatAmount(c.montantTVAInterieure ?? c.montantInterieur)}</TableCell>
                       <TableCell className="font-semibold">{formatAmount(c.soldeCordon)}</TableCell>
                       <TableCell className="font-semibold">{formatAmount(c.soldeTVA)}</TableCell>
                       <TableCell><Badge className={`text-xs ${STATUT_COLORS[c.statut]}`}>{tStatutCertificat(c.statut)}</Badge></TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/certificats/${c.id}`)}><Eye className="h-4 w-4 me-1" /> {t("certificats:list.actions.detail")}</Button>
                          {transitions.map((tr) =>
                            tr.from.includes(c.statut) ? (
                              <Button key={tr.to} variant={tr.to === "ANNULE" ? "destructive" : "default"} size="sm" disabled={actionLoading === c.id} onClick={() => handleStatut(c.id, tr.to)}>
                                {actionLoading === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t(`certificats:${tr.labelKey}`)}
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
          <DialogHeader><DialogTitle>{t("certificats:list.dialog.title", { ref: selected?.reference || `#${selected?.id}` })}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{t("certificats:list.dialog.entreprise")}</span><p className="font-medium">{selected.entrepriseRaisonSociale || selected.entrepriseNom || "—"}</p></div>
                <div><span className="text-muted-foreground">{t("certificats:list.dialog.statut")}</span><p><Badge className={`text-xs ${STATUT_COLORS[selected.statut]}`}>{tStatutCertificat(selected.statut)}</Badge></p></div>
                <div><span className="text-muted-foreground">{t("certificats:list.dialog.montant_cordon")}</span><p className="font-medium">{formatAmount(selected.montantCordon ?? selected.montantDouane)}</p></div>
                <div><span className="text-muted-foreground">{t("certificats:list.dialog.montant_tva")}</span><p className="font-medium">{formatAmount(selected.montantTVAInterieure ?? selected.montantInterieur)}</p></div>
                <div>
                  <span className="text-muted-foreground">{t("certificats:list.dialog.solde_cordon")}</span>
                  <p className="font-bold">
                    {formatAmount(selected.soldeCordon)}
                    <br />
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {t("certificats:list.dialog.solde_cordon_plus", {
                        tva: formatAmount(selected.tvaImportationDouane),
                        total: formatAmount((selected.soldeCordon ?? 0) + (selected.tvaImportationDouane ?? 0)),
                      })}
                    </span>
                  </p>
                </div>
                <div><span className="text-muted-foreground">{t("certificats:list.dialog.solde_tva")}</span><p className="font-bold">{formatAmount(selected.soldeTVA)}</p></div>
                <div><span className="text-muted-foreground">{t("certificats:list.dialog.total")}</span><p className="font-bold text-primary">{formatAmount(selected.montantTotal)}</p></div>
                <div><span className="text-muted-foreground">{t("certificats:list.dialog.date")}</span><p>{formatDate(selected.dateEmission || selected.dateCreation)}</p></div>
                {selected.dateValidite && <div><span className="text-muted-foreground">{t("certificats:list.dialog.validite")}</span><p>{formatDate(selected.dateValidite)}</p></div>}
                {selected.demandeCorrectionId && <div><span className="text-muted-foreground">{t("certificats:list.dialog.demande_correction")}</span><p className="font-medium">#{selected.demandeCorrectionId}</p></div>}
                {selected.marcheId && <div><span className="text-muted-foreground">{t("certificats:list.dialog.marche")}</span><p className="font-medium">#{selected.marcheId}</p></div>}
              </div>

              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> {t("certificats:list.dialog.documents_title")}</h4>
                {loadingDocs ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : detailDocs.length === 0 ? (
                  <p className="text-muted-foreground text-xs">{t("certificats:list.dialog.no_documents")}</p>
                ) : (
                  <div className="space-y-2">
                    {detailDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.nomFichier}</p>
                            <p className="text-xs text-muted-foreground">{tTypeDocument(doc.type)}</p>
                          </div>
                        </div>
                        <a
                          href={getDocFileUrl(doc)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {t("certificats:list.dialog.download")}
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

    </DashboardLayout>
  );
};

export default Certificats;
