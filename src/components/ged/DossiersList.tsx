import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { dossierGedApi, DossierGedDto, DossierDocumentGed, demandeCorrectionApi, marcheApi, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FolderOpen, FileText, Search, ArrowLeft, Download, ChevronRight, Eye, MoreHorizontal, Building2, Landmark, ShoppingCart, Upload, ShieldCheck } from "lucide-react";
import { formatDate } from "@/i18n/format";
import { tTypeDocument } from "@/i18n/enums";
import { toast } from "sonner";

/** Codes documents proposés par étape pour l'injection GED Président. */
const ETAPE_DOC_CODES: Record<string, string[]> = {
  DEMANDE_CORRECTION: ["LETTRE_SAISINE", "OFFRE_FISCALE", "DAO_DQE", "DECOMPOSITION_PRIX", "CONVENTION", "MARCHE"],
  TRAITEMENT_CORRECTION: ["OFFRE_FISCALE_CORRIGEE", "CREDIT_INTERIEUR", "CREDIT_EXTERIEUR"],
  RETOUR_CORRECTION: ["LETTRE_ADOPTION"],
  EMISSION_CERTIFICAT: ["CERTIFICAT_CREDIT_IMPOTS", "LETTRE_CORRECTION"],
  UTILISATION_DOUANE: ["BULLETIN_LIQUIDATION", "DECLARATION_DOUANE"],
  UTILISATION_TVA: ["FACTURE", "DECLARATION_TVA", "DECOMPTE"],
  TRANSFERT_CREDIT: ["DEMANDE_MOTIVEE_TRANSFERT"],
  CLOTURE_CREDIT: ["DOCUMENT_CLOTURE"],
  MODIFICATION_AVENANT: ["AVENANT"],
  SOUS_TRAITANCE: ["CONTRAT_SOUS_TRAITANCE"],
};

import { API_BASE } from "@/lib/apiConfig";

const ETAPE_COLORS: Record<string, string> = {
  DEMANDE_CORRECTION: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  TRAITEMENT_CORRECTION: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  RETOUR_CORRECTION: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  DEMANDE_CREDIT_IMPOT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  EMISSION_CERTIFICAT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  UTILISATION_DOUANE: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  UTILISATION_TVA: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  MODIFICATION_AVENANT: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  TRANSFERT_CREDIT: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  SOUS_TRAITANCE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  CLOTURE_CREDIT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

interface EnrichedDossier extends DossierGedDto {
  _entreprise?: string;
  _ac?: string;
  _marcheNum?: string;
  _marcheIntitule?: string;
}

const DossiersList = () => {
  const { t } = useTranslation();
  const [selectedDossier, setSelectedDossier] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const dossiersQuery = useQuery({
    queryKey: ["dossiers-ged"],
    queryFn: () => dossierGedApi.getAll(),
  });

  const dossiers = dossiersQuery.data || [];

  const correctionIds = useMemo(
    () => [...new Set(dossiers.map((d) => d.demandeCorrectionId).filter(Boolean))],
    [dossiers]
  );

  const correctionQueries = useQueries({
    queries: correctionIds.map((id) => ({
      queryKey: ["demande-correction", id],
      queryFn: () => demandeCorrectionApi.getById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const marcheQueries = useQueries({
    queries: correctionIds.map((id) => ({
      queryKey: ["marche-by-correction", id],
      queryFn: () => marcheApi.getByCorrection(id).catch(() => null),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const correctionMap = useMemo(() => {
    const map: Record<number, { entreprise?: string; ac?: string; marcheNum?: string; marcheIntitule?: string }> = {};
    correctionIds.forEach((id, i) => {
      const correction = correctionQueries[i]?.data;
      const marche = marcheQueries[i]?.data;
      if (correction) {
        map[id] = {
          entreprise: correction.entrepriseRaisonSociale,
          ac: correction.autoriteContractanteNom,
          marcheNum: marche?.numeroMarche,
          marcheIntitule: marche?.intitule,
        };
      }
    });
    return map;
  }, [correctionIds, correctionQueries, marcheQueries]);

  const enrichedDossiers: EnrichedDossier[] = useMemo(
    () =>
      dossiers.map((d) => {
        const info = correctionMap[d.demandeCorrectionId];
        return {
          ...d,
          _entreprise: d.entrepriseRaisonSociale || info?.entreprise,
          _ac: d.autoriteContractanteNom || info?.ac,
          _marcheNum: d.marcheNumero || info?.marcheNum,
          _marcheIntitule: d.marcheIntitule || info?.marcheIntitule,
        };
      }),
    [dossiers, correctionMap]
  );

  const detailQuery = useQuery({
    queryKey: ["dossier-ged", selectedDossier],
    queryFn: () => dossierGedApi.getById(selectedDossier!),
    enabled: selectedDossier !== null,
  });

  if (selectedDossier !== null) {
    const enriched = enrichedDossiers.find((d) => d.id === selectedDossier);
    return (
      <DossierDetail
        dossier={detailQuery.data}
        enrichment={enriched}
        isLoading={detailQuery.isLoading}
        onBack={() => setSelectedDossier(null)}
      />
    );
  }

  const filtered = enrichedDossiers.filter(
    (d) =>
      d.reference.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toString().includes(search) ||
      (d._entreprise || "").toLowerCase().includes(search.toLowerCase()) ||
      (d._ac || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("ged:dossiers.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Badge variant="secondary">{t("ged:dossiers.count_label", { count: filtered.length })}</Badge>
      </div>

      {dossiersQuery.isLoading ? (
        <p className="text-muted-foreground text-sm py-12 text-center">{t("ged:dossiers.loading")}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">{t("ged:dossiers.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((dossier) => {
            const totalDocs = dossier.etapes?.reduce((sum, e) => sum + (e.documents?.length || 0), 0) || 0;
            const etapesAvecDocs = dossier.etapes?.filter((e) => e.documents?.length > 0).length || 0;
            return (
              <Card
                key={dossier.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-s-4 border-s-primary"
                onClick={() => setSelectedDossier(dossier.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{dossier.reference}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("ged:dossiers.created_on", { date: formatDate(dossier.dateCreation) })}
                          {dossier.certificatId && ` • ${t("ged:dossiers.certificat_short", { id: dossier.certificatId })}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-end text-sm">
                        <p className="text-foreground font-medium">{t("ged:dossiers.documents_count", { count: totalDocs })}</p>
                        <p className="text-xs text-muted-foreground">{t("ged:dossiers.etapes_progress", { done: etapesAvecDocs, total: 11 })}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground rtl:rotate-180" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 ps-14 text-xs text-muted-foreground">
                    {dossier._entreprise && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {dossier._entreprise}
                      </span>
                    )}
                    {dossier._ac && (
                      <span className="flex items-center gap-1">
                        <Landmark className="h-3.5 w-3.5" />
                        {dossier._ac}
                      </span>
                    )}
                    {(dossier._marcheNum || dossier._marcheIntitule) && (
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        {dossier._marcheNum || dossier._marcheIntitule}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface DossierDetailProps {
  dossier?: DossierGedDto;
  enrichment?: EnrichedDossier;
  isLoading: boolean;
  onBack: () => void;
}

const DossierDetail = ({ dossier, enrichment, isLoading, onBack }: DossierDetailProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t("ged:dossiers.back_short")}
        </Button>
        <p className="text-muted-foreground text-sm py-12 text-center">{t("ged:dossiers.loading_detail")}</p>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t("ged:dossiers.back_short")}
        </Button>
        <p className="text-muted-foreground text-sm py-12 text-center">{t("ged:dossiers.not_found")}</p>
      </div>
    );
  }

  const totalDocs = dossier.etapes.reduce((sum, e) => sum + (e.documents?.length || 0), 0);
  const entreprise = dossier.entrepriseRaisonSociale || enrichment?._entreprise;
  const ac = dossier.autoriteContractanteNom || enrichment?._ac;
  const marcheNum = dossier.marcheNumero || enrichment?._marcheNum;
  const marcheIntitule = dossier.marcheIntitule || enrichment?._marcheIntitule;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t("ged:dossiers.back")}
        </Button>
        <Badge variant="outline">{t("ged:dossiers.total_documents", { count: totalDocs })}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{dossier.reference}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("ged:dossiers.created_on", { date: formatDate(dossier.dateCreation) })}
                {dossier.certificatId && ` • ${t("ged:dossiers.certificat_short", { id: dossier.certificatId })}`}
                {` • ${t("ged:dossiers.correction_short", { ref: dossier.demandeCorrectionNumero || `#${dossier.demandeCorrectionId}` })}`}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 ps-[52px]">
            {entreprise && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("ged:dossiers.entreprise")}</p>
                  <p className="font-medium text-foreground">{entreprise}</p>
                </div>
              </div>
            )}
            {ac && (
              <div className="flex items-center gap-2 text-sm">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("ged:dossiers.autorite_contractante")}</p>
                  <p className="font-medium text-foreground">{ac}</p>
                </div>
              </div>
            )}
            {(marcheNum || marcheIntitule) && (
              <div className="flex items-center gap-2 text-sm">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("ged:dossiers.marche")}</p>
                  <p className="font-medium text-foreground">{marcheNum}{marcheIntitule && ` – ${marcheIntitule}`}</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <ScrollArea className="h-[calc(100vh-280px)]">
        <Accordion type="multiple" defaultValue={dossier.etapes.filter(e => e.documents?.length > 0).map(e => e.etape)} className="space-y-2">
          {dossier.etapes.map((etape) => (
            <AccordionItem key={etape.etape} value={etape.etape} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge className={ETAPE_COLORS[etape.etape] || "bg-muted text-muted-foreground"} variant="secondary">
                    {etape.documents?.length || 0}
                  </Badge>
                  <span className="font-medium text-foreground">{etape.label}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {!etape.documents || etape.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center italic">
                    {t("ged:dossiers.table.empty_etape")}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("ged:dossiers.table.document")}</TableHead>
                        <TableHead>{t("ged:dossiers.table.type")}</TableHead>
                        <TableHead>{t("ged:dossiers.table.date")}</TableHead>
                        <TableHead className="w-[80px]">{t("ged:dossiers.table.action")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {etape.documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {doc.nom}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{tTypeDocument(doc.type)}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {doc.dateUpload ? formatDate(doc.dateUpload) : "—"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={t("ged:dossiers.table.action")}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <a
                                    href={doc.url || `${API_BASE}/documents/${doc.id}/download`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Eye className="h-4 w-4 me-2" />
                                    {t("ged:dossiers.table.open")}
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a
                                    href={doc.url || `${API_BASE}/documents/${doc.id}/download`}
                                    download={doc.nom}
                                  >
                                    <Download className="h-4 w-4 me-2" />
                                    {t("ged:dossiers.table.download")}
                                  </a>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  );
};

export default DossiersList;
