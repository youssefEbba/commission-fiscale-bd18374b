import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import SignatureManager from "@/components/signatures/SignatureManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { PenLine, RefreshCw } from "lucide-react";
import {
  signatureApi,
  utilisateurApi,
  formatApiErrorMessage,
  ROLE_LABELS,
  type SignatureDto,
  type UtilisateurDto,
} from "@/lib/api";

const SIGNATAIRE_ROLES = ["PRESIDENT", "DGD", "DGI", "DGTCP", "DGB"];

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("fr-FR"); } catch { return "—"; }
};

const Signatures = () => {
  const { toast } = useToast();
  const [signatures, setSignatures] = useState<SignatureDto[]>([]);
  const [users, setUsers] = useState<UtilisateurDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterUser, setFilterUser] = useState<string>("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [targetRole, setTargetRole] = useState<string>("PRESIDENT");
  const [targetUser, setTargetUser] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const list = await signatureApi.list({
        role: filterRole || undefined,
        utilisateurId: filterUser ? Number(filterUser) : undefined,
        activeOnly: activeOnly || undefined,
      });
      setSignatures(Array.isArray(list) ? list : []);
    } catch (err) {
      toast({ title: "Erreur", description: formatApiErrorMessage(err, "Impossible de charger les signatures"), variant: "destructive" });
      setSignatures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filterRole, filterUser, activeOnly]);

  useEffect(() => {
    utilisateurApi.getAll()
      .then((u) => setUsers(Array.isArray(u) ? u : []))
      .catch(() => setUsers([]));
  }, []);

  const roleOptions = useMemo(
    () => SIGNATAIRE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] || r })),
    [],
  );

  const userOptions = useMemo(
    () =>
      users
        .filter((u) => SIGNATAIRE_ROLES.includes(u.role))
        .sort((a, b) => (a.nomComplet || a.username).localeCompare(b.nomComplet || b.username, "fr"))
        .map((u) => ({
          value: String(u.id),
          label: u.nomComplet || u.username,
          description: `${ROLE_LABELS[u.role] || u.role} — ${u.username}`,
          keywords: `${u.username} ${u.role}`,
        })),
    [users],
  );

  const targetUserRole = users.find((u) => String(u.id) === targetUser)?.role;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PenLine className="h-6 w-6 text-primary" />
            Signatures
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez les images de signature (PNG à fond transparent) apposées sur les documents générés.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gérer une signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rôle signataire</Label>
                <SearchableSelect
                  options={roleOptions}
                  value={targetRole}
                  onValueChange={(v) => { setTargetRole(v); setTargetUser(""); }}
                  placeholder="Sélectionner un rôle"
                />
              </div>
              <div className="space-y-2">
                <Label>Utilisateur (facultatif — signature institutionnelle si vide)</Label>
                <SearchableSelect
                  options={userOptions.filter((o) => !targetRole || users.find((u) => String(u.id) === o.value)?.role === targetRole)}
                  value={targetUser}
                  onValueChange={setTargetUser}
                  placeholder="Signature du rôle (aucun utilisateur)"
                  clearable
                />
              </div>
            </div>

            <SignatureManager
              key={`${targetRole}-${targetUser}`}
              role={targetRole}
              utilisateurId={targetUser ? Number(targetUser) : undefined}
              utilisateurNom={users.find((u) => String(u.id) === targetUser)?.nomComplet}
              title="Signature ciblée"
              card={false}
              onChanged={load}
            />
            {targetUser && targetUserRole && targetUserRole !== targetRole && (
              <p className="text-xs text-amber-600">
                L'utilisateur sélectionné a le rôle {ROLE_LABELS[targetUserRole] || targetUserRole} : le serveur peut refuser cette combinaison.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signatures enregistrées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Filtrer par rôle</Label>
                <SearchableSelect options={roleOptions} value={filterRole} onValueChange={setFilterRole} placeholder="Tous les rôles" clearable />
              </div>
              <div className="space-y-2">
                <Label>Filtrer par utilisateur</Label>
                <SearchableSelect options={userOptions} value={filterUser} onValueChange={setFilterUser} placeholder="Tous les utilisateurs" clearable />
              </div>
              <div className="space-y-2">
                <Label>Actives uniquement</Label>
                <div className="h-10 flex items-center gap-2">
                  <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
                  <span className="text-sm text-muted-foreground">{activeOnly ? "Oui" : "Non"}</span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center text-muted-foreground text-sm">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Chargement…
              </div>
            ) : signatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune signature enregistrée.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Dimensions</TableHead>
                      <TableHead>Créée le</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signatures.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{ROLE_LABELS[s.role] || s.role}</TableCell>
                        <TableCell>{s.utilisateurNom || "—"}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{s.nomAffiche || "—"}</TableCell>
                        <TableCell>{s.version ?? 1}</TableCell>
                        <TableCell>{s.largeurPx && s.hauteurPx ? `${s.largeurPx}x${s.hauteurPx}` : "—"}</TableCell>
                        <TableCell>{fmtDate(s.dateCreation)}</TableCell>
                        <TableCell>
                          {s.active ? (
                            <Badge className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setTargetRole(s.role); setTargetUser(s.utilisateurId ? String(s.utilisateurId) : ""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          >
                            Gérer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Signatures;
