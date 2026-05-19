import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  clotureCreditApi, ClotureCreditDto, CreateClotureCreditRequest,
  MotifCloture, TypeOperationCloture,
  MOTIF_CLOTURE_LABELS, TYPE_OPERATION_LABELS,
  certificatCreditApi, CertificatCreditDto,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Archive, RefreshCw, Loader2, Plus, CheckCircle2, XCircle, Lock, Search, Eye,
} from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { tMotifCloture, tTypeOperationCloture } from "@/i18n/enums";
import { formatAmount, formatDate, formatDateTime } from "@/i18n/format";

const Cloture = () => {
  const { t } = useTranslation(["cloture", "common"]);
  usePageTitle("cloture:list.title");
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();

  const approbationBadge = (approuvee: boolean | null | undefined) => {
    if (approuvee === null || approuvee === undefined)
      return <Badge className="bg-yellow-100 text-yellow-800">{t("cloture:approbation.pending")}</Badge>;
    if (approuvee) return <Badge className="bg-green-100 text-green-800">{t("cloture:approbation.approved")}</Badge>;
    return <Badge className="bg-red-100 text-red-800">{t("cloture:approbation.rejected")}</Badge>;
  };

  const [propositions, setPropositions] = useState<ClotureCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [eligibleIds, setEligibleIds] = useState<number[]>([]);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [showPropose, setShowPropose] = useState(false);
  const [form, setForm] = useState<Partial<CreateClotureCreditRequest>>({});
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<ClotureCreditDto | null>(null);

  const isDGTCP = role === "DGTCP";
  const isPresident = role === "PRESIDENT";

  const fetchPropositions = async () => {
    setLoading(true);
    try {
      const res = await clotureCreditApi.getPropositions();
      setPropositions(res);
    } catch (e: any) {
      toast({ title: t("cloture:toast.error"), description: e.message || t("cloture:toast.load_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchEligible = async () => {
    setEligibleLoading(true);
    try {
      const [ids, certs] = await Promise.all([
        clotureCreditApi.getEligible(),
        certificatCreditApi.getAll(),
      ]);
      setEligibleIds(ids);
      setCertificats(certs);
    } catch (e: any) {
      toast({ title: t("cloture:toast.error"), description: e.message, variant: "destructive" });
    } finally {
      setEligibleLoading(false);
    }
  };

  useEffect(() => {
    fetchPropositions();
    if (isDGTCP) fetchEligible();
  }, []);

  const eligibleCerts = certificats.filter((c) => eligibleIds.includes(c.id));

  const handlePropose = async () => {
    if (!form.certificatCreditId || !form.motif || !form.typeOperation) {
      toast({ title: t("cloture:toast.propose_required_title"), description: t("cloture:toast.propose_required_desc"), variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await clotureCreditApi.proposer(form as CreateClotureCreditRequest);
      toast({ title: t("cloture:toast.propose_success") });
      setShowPropose(false);
      setForm({});
      fetchPropositions();
      fetchEligible();
    } catch (e: any) {
      toast({ title: t("cloture:toast.error"), description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id: number, action: "valider" | "rejeter" | "finaliser") => {
    setActionLoading(id);
    try {
      if (action === "valider") await clotureCreditApi.valider(id);
      else if (action === "rejeter") await clotureCreditApi.rejeter(id);
      else await clotureCreditApi.finaliser(id);
      toast({
        title:
          action === "valider"
            ? t("cloture:toast.approved")
            : action === "rejeter"
              ? t("cloture:toast.rejected")
              : t("cloture:toast.finalized"),
      });
      fetchPropositions();
    } catch (e: any) {
      toast({ title: t("cloture:toast.error"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Archive className="h-6 w-6 text-primary" /> {t("cloture:list.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("cloture:list.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchPropositions(); if (isDGTCP) fetchEligible(); }}>
              <RefreshCw className="h-4 w-4 me-1" /> {t("cloture:list.refresh")}
            </Button>
            {isDGTCP && (
              <Button size="sm" onClick={() => setShowPropose(true)}>
                <Plus className="h-4 w-4 me-1" /> {t("cloture:list.propose")}
              </Button>
            )}
          </div>
        </div>

        {/* DGTCP: Eligible certificates */}
        {isDGTCP && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> {t("cloture:list.eligible.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eligibleLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : eligibleCerts.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">{t("cloture:list.eligible.empty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("cloture:list.eligible.columns.numero")}</TableHead>
                      <TableHead>{t("cloture:list.eligible.columns.solde_cordon")}</TableHead>
                      <TableHead>{t("cloture:list.eligible.columns.solde_tva")}</TableHead>
                      <TableHead>{t("cloture:list.eligible.columns.date_validite")}</TableHead>
                      <TableHead className="text-end">{t("cloture:list.eligible.columns.action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibleCerts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.numero || `#${c.id}`}</TableCell>
                        <TableCell>{formatAmount(c.soldeCordon)}</TableCell>
                        <TableCell>{formatAmount(c.soldeTVA)}</TableCell>
                        <TableCell>{formatDate(c.dateValidite)}</TableCell>
                        <TableCell className="text-end">
                          <Button size="sm" variant="outline" onClick={() => {
                            setForm({ certificatCreditId: c.id });
                            setShowPropose(true);
                          }}>
                            <Plus className="h-3 w-3 me-1" /> {t("cloture:list.eligible.propose_btn")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Propositions list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isPresident ? t("cloture:list.propositions.title_president") : t("cloture:list.propositions.title_default")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : propositions.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">{t("cloture:list.propositions.empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("cloture:list.propositions.columns.id")}</TableHead>
                    <TableHead>{t("cloture:list.propositions.columns.certificat")}</TableHead>
                    <TableHead>{t("cloture:list.propositions.columns.type")}</TableHead>
                    <TableHead>{t("cloture:list.propositions.columns.motif")}</TableHead>
                    <TableHead>{t("cloture:list.propositions.columns.solde_restant")}</TableHead>
                    <TableHead>{t("cloture:list.propositions.columns.date_proposition")}</TableHead>
                    <TableHead>{t("cloture:list.propositions.columns.statut")}</TableHead>
                    <TableHead className="text-end">{t("cloture:list.propositions.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propositions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.id}</TableCell>
                      <TableCell className="font-medium">{p.certificatNumero || `#${p.certificatCreditId}`}</TableCell>
                      <TableCell>
                        <Badge variant={p.typeOperation === "ANNULATION" ? "destructive" : "secondary"}>
                          {tTypeOperationCloture(p.typeOperation)}
                        </Badge>
                      </TableCell>
                      <TableCell>{tMotifCloture(p.motif)}</TableCell>
                      <TableCell>{formatAmount(p.soldeRestant)}</TableCell>
                      <TableCell>{formatDate(p.dateProposition)}</TableCell>
                      <TableCell>{approbationBadge(p.approuvee)}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => setSelected(p)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isPresident && p.approuvee === null && (
                            <>
                              <Button size="sm" variant="default" disabled={actionLoading === p.id}
                                onClick={() => handleAction(p.id, "valider")} title={t("cloture:step2.approve")}>
                                {actionLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              </Button>
                              <Button size="sm" variant="destructive" disabled={actionLoading === p.id}
                                onClick={() => handleAction(p.id, "rejeter")} title={t("cloture:step2.reject")}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {isDGTCP && p.approuvee === true && !p.dateCloture && (
                            <Button size="sm" variant="default" disabled={actionLoading === p.id}
                              onClick={() => handleAction(p.id, "finaliser")}>
                              {actionLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="h-4 w-4 me-1" /> {t("cloture:step3.finalize")}</>}
                            </Button>
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

        {/* Propose dialog (DGTCP) */}
        <Dialog open={showPropose} onOpenChange={setShowPropose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("cloture:step1.title")}</DialogTitle>
              <DialogDescription>{t("cloture:step1.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("cloture:step1.certificat_label")}</Label>
                <SearchableSelect
                  value={form.certificatCreditId?.toString() || ""}
                  onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}
                  placeholder={t("cloture:step1.certificat_placeholder")}
                  searchPlaceholder={t("cloture:step1.certificat_search")}
                  options={eligibleCerts.map((c) => ({
                    value: c.id.toString(),
                    label: c.numero || t("cloture:step1.certificat_item", { id: c.id }),
                  }))}
                />
              </div>
              <div>
                <Label>{t("cloture:step1.type_label")}</Label>
                <Select value={form.typeOperation || ""} onValueChange={(v) => setForm({ ...form, typeOperation: v as TypeOperationCloture })}>
                  <SelectTrigger><SelectValue placeholder={t("cloture:step1.type_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_OPERATION_LABELS) as TypeOperationCloture[]).map((k) => (
                      <SelectItem key={k} value={k}>{tTypeOperationCloture(k)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("cloture:step1.motif_label")}</Label>
                <Select value={form.motif || ""} onValueChange={(v) => setForm({ ...form, motif: v as MotifCloture })}>
                  <SelectTrigger><SelectValue placeholder={t("cloture:step1.motif_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MOTIF_CLOTURE_LABELS) as MotifCloture[]).map((k) => (
                      <SelectItem key={k} value={k}>{tMotifCloture(k)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPropose(false)}>{t("cloture:step1.cancel")}</Button>
              <Button onClick={handlePropose} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Plus className="h-4 w-4 me-1" />}
                {t("cloture:step1.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail dialog */}
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("cloture:detail.title", { id: selected?.id })}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">{t("cloture:detail.certificat")}</span> <span className="font-medium">{selected.certificatNumero || `#${selected.certificatCreditId}`}</span></div>
                  <div><span className="text-muted-foreground">{t("cloture:detail.type")}</span> <Badge variant={selected.typeOperation === "ANNULATION" ? "destructive" : "secondary"}>{tTypeOperationCloture(selected.typeOperation)}</Badge></div>
                  <div><span className="text-muted-foreground">{t("cloture:detail.motif")}</span> <span className="font-medium">{tMotifCloture(selected.motif)}</span></div>
                  <div><span className="text-muted-foreground">{t("cloture:detail.solde_restant")}</span> <span className="font-medium">{formatAmount(selected.soldeRestant)}</span></div>
                  <div><span className="text-muted-foreground">{t("cloture:detail.proposition")}</span> <span>{formatDateTime(selected.dateProposition)}</span></div>
                  <div><span className="text-muted-foreground">{t("cloture:detail.cloture")}</span> <span>{selected.dateCloture ? formatDateTime(selected.dateCloture) : t("cloture:detail.cloture_not_done")}</span></div>
                </div>
                <div className="pt-2">
                  <span className="text-muted-foreground">{t("cloture:detail.approbation")}</span> {approbationBadge(selected.approuvee)}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Cloture;
