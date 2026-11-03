import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FolderOpen, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadRow } from "@/components/ui/upload-row";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RowNumberCell, RowNumberHead } from "@/components/ui/row-number";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/i18n/format";
import { archiveLotApi, formatApiErrorMessage, type ArchiveLotDto } from "@/lib/api";
import { isRouteUnavailable } from "@/lib/submission";
import { ArchiveLotCounters } from "./ArchiveLotStatut";

/** Onglet « Fichier de période » : analyse d'un fichier en lot et liste des lots en cours. */
export function ArchiveLotsTab() {
  const { t } = useTranslation(["archive", "common"]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [lots, setLots] = useState<ArchiveLotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ArchiveLotDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    archiveLotApi.getAll()
      .then((v) => setLots(Array.isArray(v) ? v : []))
      .catch((e) => {
        setLots([]);
        setError(isRouteUnavailable(e) ? t("archive:lots.unavailable") : formatApiErrorMessage(e, t("archive:lots.error_load")));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const analyse = async (f: File | null) => {
    setFile(f);
    setAnalyseError(null);
    if (!f) return;
    setAnalysing(true);
    try {
      const lot = await archiveLotApi.analyser(f);
      if (lot.dejaAnalyse) toast({ title: t("archive:lots.deja_analyse"), description: lot.nomFichier });
      navigate(`/dashboard/archive/lots/${lot.id}`);
    } catch (e) {
      // Fichier conservé dans le champ : l'opérateur peut relancer.
      setAnalyseError(isRouteUnavailable(e) ? t("archive:lots.unavailable") : formatApiErrorMessage(e, t("archive:lots.error_analyse")));
    } finally {
      setAnalysing(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await archiveLotApi.delete(toDelete.id);
      setLots((cur) => cur.filter((l) => l.id !== toDelete.id));
      toast({ title: t("archive:lots.deleted") });
      setToDelete(null);
    } catch (e) {
      toast({ title: t("common:errors.generic_title"), description: formatApiErrorMessage(e, t("archive:lots.error_delete")), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("archive:lots.upload_title")}</CardTitle>
          <CardDescription>{t("archive:lots.upload_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <UploadRow
            id="archive-lot-file"
            label={t("archive:lots.upload_label")}
            helperText={t("archive:lots.upload_helper")}
            accept=".xls,.xlsx"
            file={file}
            disabled={analysing}
            onFileChange={(f) => void analyse(f)}
          />
          {analysing && (
            <p className="text-sm text-muted-foreground flex items-center gap-2" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("archive:lots.analysing")}
            </p>
          )}
          {analyseError && <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{analyseError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("archive:lots.list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="text-sm text-destructive whitespace-pre-wrap">{error}</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <RowNumberHead />
                    <TableHead>{t("archive:lots.col_fichier")}</TableHead>
                    <TableHead>{t("archive:lots.col_date")}</TableHead>
                    <TableHead>{t("archive:lots.col_par")}</TableHead>
                    <TableHead className="text-end">{t("archive:lots.col_credits")}</TableHead>
                    <TableHead>{t("archive:lots.col_statuts")}</TableHead>
                    <TableHead className="text-end">{t("archive:lots.col_nifs")}</TableHead>
                    <TableHead className="text-end">{t("archive:lots.col_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                  ) : lots.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("archive:lots.empty")}</TableCell></TableRow>
                  ) : lots.map((l, i) => (
                    <TableRow key={l.id}>
                      <RowNumberCell n={i + 1} />
                      <TableCell className="font-medium">
                        <Link to={`/dashboard/archive/lots/${l.id}`} className="hover:underline text-primary">{l.nomFichier}</Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(l.dateAnalyse)}</TableCell>
                      <TableCell>{l.analyseParNom || "—"}</TableCell>
                      <TableCell className="text-end tabular-nums">{l.nbCredits}</TableCell>
                      <TableCell><ArchiveLotCounters parStatut={l.parStatut} /></TableCell>
                      <TableCell className="text-end tabular-nums">{l.nifsSansEntreprise}</TableCell>
                      <TableCell className="text-end whitespace-nowrap">
                        <Button asChild variant="ghost" size="icon" title={t("archive:lots.open")} aria-label={t("archive:lots.open")}>
                          <Link to={`/dashboard/archive/lots/${l.id}`}><FolderOpen className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(l)} title={t("archive:lots.delete")} aria-label={t("archive:lots.delete")}>
                          <Trash2 className="h-4 w-4" />
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

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("archive:lots.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("archive:lots.delete_desc", { fichier: toDelete?.nomFichier ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("archive:lots.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
