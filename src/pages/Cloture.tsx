import { useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Archive, RefreshCw, Loader2, Plus, CheckCircle2, XCircle, Lock, Search, Eye,
} from "lucide-react";

const APPROBATION_BADGE = (approuvee: boolean | null | undefined) => {
  if (approuvee === null || approuvee === undefined)
    return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>;
  if (approuvee) return <Badge className="bg-green-100 text-green-800">Approuvée</Badge>;
  return <Badge className="bg-red-100 text-red-800">Rejetée</Badge>;
};

const Cloture = () => {
  const { user } = useAuth();
  const role = user?.role as AppRole;
  const { toast } = useToast();

  const [propositions, setPropositions] = useState<ClotureCreditDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // DGTCP: eligible + propose
  const [eligibleIds, setEligibleIds] = useState<number[]>([]);
  const [certificats, setCertificats] = useState<CertificatCreditDto[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [showPropose, setShowPropose] = useState(false);
  const [form, setForm] = useState<Partial<CreateClotureCreditRequest>>({});
  const [creating, setCreating] = useState(false);

  // Detail
  const [selected, setSelected] = useState<ClotureCreditDto | null>(null);

  const isDGTCP = role === "DGTCP";
  const isPresident = role === "PRESIDENT";

  const fetchPropositions = async () => {
    setLoading(true);
    try {
      const res = await clotureCreditApi.getPropositions();
      setPropositions(res);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
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
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
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
      toast({ title: "Champs obligatoires", description: "Remplissez tous les champs", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await clotureCreditApi.proposer(form as CreateClotureCreditRequest);
      toast({ title: "Proposition soumise" });
      setShowPropose(false);
      setForm({});
      fetchPropositions();
      fetchEligible();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
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
      toast({ title: action === "valider" ? "Approuvée" : action === "rejeter" ? "Rejetée" : "Finalisée" });
      fetchPropositions();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
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
              <Archive className="h-6 w-6 text-primary" /> Clôture / Annulation
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestion du cycle de clôture et annulation des certificats de crédit
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchPropositions(); if (isDGTCP) fetchEligible(); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Actualiser
            </Button>
            {isDGTCP && (
              <Button size="sm" onClick={() => setShowPropose(true)}>
                <Plus className="h-4 w-4 mr-1" /> Proposer clôture/annulation
              </Button>
            )}
          </div>
        </div>

        {/* DGTCP: Eligible certificates */}
        {isDGTCP && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> Certificats éligibles à la clôture
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eligibleLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : eligibleCerts.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Aucun certificat éligible détecté</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Solde Cordon</TableHead>
                      <TableHead>Solde TVA</TableHead>
                      <TableHead>Date validité</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibleCerts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.numero || `#${c.id}`}</TableCell>
                        <TableCell>{c.soldeCordon?.toLocaleString() ?? "-"}</TableCell>
                        <TableCell>{c.soldeTVA?.toLocaleString() ?? "-"}</TableCell>
                        <TableCell>{c.dateValidite ? new Date(c.dateValidite).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => {
                            setForm({ certificatCreditId: c.id });
                            setShowPropose(true);
                          }}>
                            <Plus className="h-3 w-3 mr-1" /> Proposer
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
              {isPresident ? "Propositions en attente d'approbation" : "Propositions de clôture / annulation"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : propositions.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Aucune proposition</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Certificat</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Solde restant</TableHead>
                    <TableHead>Date proposition</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propositions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.id}</TableCell>
                      <TableCell className="font-medium">{p.certificatNumero || `#${p.certificatCreditId}`}</TableCell>
                      <TableCell>
                        <Badge variant={p.typeOperation === "ANNULATION" ? "destructive" : "secondary"}>
                          {TYPE_OPERATION_LABELS[p.typeOperation]}
                        </Badge>
                      </TableCell>
                      <TableCell>{MOTIF_CLOTURE_LABELS[p.motif]}</TableCell>
                      <TableCell>{p.soldeRestant?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell>{p.dateProposition ? new Date(p.dateProposition).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>{APPROBATION_BADGE(p.approuvee)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => setSelected(p)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* President: approve/reject */}
                          {isPresident && p.approuvee === null && (
                            <>
                              <Button size="sm" variant="default" disabled={actionLoading === p.id}
                                onClick={() => handleAction(p.id, "valider")}>
                                {actionLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              </Button>
                              <Button size="sm" variant="destructive" disabled={actionLoading === p.id}
                                onClick={() => handleAction(p.id, "rejeter")}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {/* DGTCP: finalize after approval */}
                          {isDGTCP && p.approuvee === true && !p.dateCloture && (
                            <Button size="sm" variant="default" disabled={actionLoading === p.id}
                              onClick={() => handleAction(p.id, "finaliser")}>
                              {actionLoading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="h-4 w-4 mr-1" /> Finaliser</>}
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
              <DialogTitle>Proposer une clôture / annulation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Certificat</Label>
                <Select value={form.certificatCreditId?.toString() || ""} onValueChange={(v) => setForm({ ...form, certificatCreditId: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un certificat" /></SelectTrigger>
                  <SelectContent>
                    {eligibleCerts.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.numero || `Certificat #${c.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type d'opération</Label>
                <Select value={form.typeOperation || ""} onValueChange={(v) => setForm({ ...form, typeOperation: v as TypeOperationCloture })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_OPERATION_LABELS) as TypeOperationCloture[]).map((k) => (
                      <SelectItem key={k} value={k}>{TYPE_OPERATION_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motif</Label>
                <Select value={form.motif || ""} onValueChange={(v) => setForm({ ...form, motif: v as MotifCloture })}>
                  <SelectTrigger><SelectValue placeholder="Choisir un motif" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MOTIF_CLOTURE_LABELS) as MotifCloture[]).map((k) => (
                      <SelectItem key={k} value={k}>{MOTIF_CLOTURE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPropose(false)}>Annuler</Button>
              <Button onClick={handlePropose} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Soumettre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail dialog */}
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Détail proposition #{selected?.id}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Certificat:</span> <span className="font-medium">{selected.certificatNumero || `#${selected.certificatCreditId}`}</span></div>
                  <div><span className="text-muted-foreground">Type:</span> <Badge variant={selected.typeOperation === "ANNULATION" ? "destructive" : "secondary"}>{TYPE_OPERATION_LABELS[selected.typeOperation]}</Badge></div>
                  <div><span className="text-muted-foreground">Motif:</span> <span className="font-medium">{MOTIF_CLOTURE_LABELS[selected.motif]}</span></div>
                  <div><span className="text-muted-foreground">Solde restant:</span> <span className="font-medium">{selected.soldeRestant?.toLocaleString() ?? "-"}</span></div>
                  <div><span className="text-muted-foreground">Proposition:</span> <span>{selected.dateProposition ? new Date(selected.dateProposition).toLocaleString() : "-"}</span></div>
                  <div><span className="text-muted-foreground">Clôture:</span> <span>{selected.dateCloture ? new Date(selected.dateCloture).toLocaleString() : "Non finalisée"}</span></div>
                </div>
                <div className="pt-2">
                  <span className="text-muted-foreground">Approbation:</span> {APPROBATION_BADGE(selected.approuvee)}
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
