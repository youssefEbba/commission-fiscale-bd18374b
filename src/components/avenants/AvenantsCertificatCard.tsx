import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FilePen, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { avenantApi, AvenantDto, CertificatCreditDto } from "@/lib/api";
import { AVENANT_VIEW_PERMS, canDeposerAvenant } from "@/lib/avenants";
import { tTypeAvenant } from "@/i18n/enums";
import { formatDate } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { RowNumberHead, RowNumberCell } from "@/components/ui/row-number";
import AvenantStatutBadge from "./AvenantStatutBadge";
import AvenantCreateDialog from "./AvenantCreateDialog";

/** Carte « Avenants » de la fiche crédit : liste du crédit et dépôt par l'entreprise / l'autorité. */
export default function AvenantsCertificatCard({ certificat }: { certificat: CertificatCreditDto }) {
  const { t } = useTranslation(["modifications"]);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<AvenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const canView = AVENANT_VIEW_PERMS.some(hasPermission) || hasPermission("modification.submit");
  const canDeposer = canDeposerAvenant(certificat.statut, hasPermission);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setList(await avenantApi.getByCertificat(certificat.id));
    } catch (e: any) {
      setList([]);
      setError(e?.message || t("modifications:certificat_card.error"));
    } finally {
      setLoading(false);
    }
  }, [certificat.id, t]);

  useEffect(() => { if (canView) load(); }, [canView, load]);

  if (!canView) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FilePen className="h-5 w-5 text-primary" />
            {t("modifications:certificat_card.title", { count: list.length })}
          </CardTitle>
          {canDeposer && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 me-2" /> {t("modifications:actions.deposer")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <RowNumberHead />
              <TableHead>{t("modifications:list.columns.numero")}</TableHead>
              <TableHead>{t("modifications:list.columns.type")}</TableHead>
              <TableHead>{t("modifications:list.columns.statut")}</TableHead>
              <TableHead>{t("modifications:list.columns.date_depot")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" /></TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-destructive text-sm">{error}</TableCell></TableRow>
            ) : list.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">{t("modifications:certificat_card.empty")}</TableCell></TableRow>
            ) : list.map((a, idx) => (
              <ClickableTableRow key={a.id} to={`/dashboard/modifications/${a.id}`}>
                <RowNumberCell n={idx + 1} />
                <TableCell className="font-medium">
                  <Link to={`/dashboard/modifications/${a.id}`} className="text-primary hover:underline">{a.numero || `#${a.id}`}</Link>
                </TableCell>
                <TableCell className="text-sm">{tTypeAvenant(a.type)}</TableCell>
                <TableCell><AvenantStatutBadge statut={a.statut} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.dateDepot ? formatDate(a.dateDepot) : "—"}</TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <AvenantCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        certificat={certificat}
        onCreated={(a) => navigate(`/dashboard/modifications/${a.id}?pieces=1`)}
      />
    </Card>
  );
}
