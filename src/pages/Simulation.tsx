import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Play, Loader2, AlertTriangle, CheckCircle, X, ChevronDown, Eye, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

const AI_SERVICE_URL = "https://superelegant-irretraceably-liv.ngrok-free.dev/api/audit-fiscale/correct-from-text";

interface ExcelData {
  fileName: string;
  sheets: { name: string; data: string[][] }[];
  rawText: string;
}

// Result types
interface ValeurDouane {
  VD: number;
  DD: number;
  RS: number;
  PSC: number;
  BaseTVA: number;
  TVA: number;
  TotalD_T: number;
}

interface CorrectionDouane {
  produit: string;
  valeurDeclaree: ValeurDouane;
  valeurCorrigee: ValeurDouane;
  ecart: ValeurDouane;
  niveauErreur: string;
}

interface ValeurInterieure {
  HT: number;
  TVA: number;
}

interface CorrectionInterieure {
  prestation: string;
  valeurDeclaree: ValeurInterieure;
  valeurCorrigee: ValeurInterieure;
  ecart: ValeurInterieure;
  niveauErreur: string;
}

interface CorrectionResult {
  correctionsDouane: CorrectionDouane[];
  correctionsInterieure: CorrectionInterieure[];
  creditImpôtCorrige: {
    creditDouanier: { DD: number; RS: number; PSC: number; TVA: number; totalA: number };
    creditInterieur: { TVAInterieure: number; TVADouane: number; TVANette: number; totalB: number };
    creditTotalCorrige: number;
  };
  ecartGlobal: { creditDeclare: number; creditCorrige: number; difference: number };
  resumeAudit: {
    nombreErreursDetectees: number;
    graviteGlobale: string;
    risqueFiscal: string;
    explications: string[];
  };
}

function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return "-";
  // Treat very small floating point errors as 0
  if (Math.abs(n) < 0.001) return "0";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

// Helper to get nested value safely from douane objects (handles both old and new API formats)
function getDouaneVal(obj: any, key: string): number | undefined {
  if (!obj) return undefined;
  return obj[key] ?? obj[key.toLowerCase()] ?? undefined;
}

function niveauBadge(niveau: string) {
  if (niveau === "Aucune") return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aucune</Badge>;
  if (niveau === "Mineure") return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Mineure</Badge>;
  if (niveau === "Majeure") return <Badge variant="destructive">Majeure</Badge>;
  return <Badge variant="outline">{niveau}</Badge>;
}

function sheetsToText(sheets: { name: string; data: string[][] }[]): string {
  return sheets.map(s => {
    const rows = s.data.map(r => r.join("\t")).join("\n");
    return `=== ${s.name} ===\n${rows}`;
  }).join("\n\n");
}

function readExcelFile(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheets = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name];
          const json: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          return { name, data: json };
        });
        const rawText = sheetsToText(sheets);
        resolve({ fileName: file.name, sheets, rawText });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

type Step = "upload" | "preview" | "results";

const Simulation = () => {
  const { toast } = useToast();
  const [offreFile, setOffreFile] = useState<ExcelData | null>(null);
  const [dqeFile, setDqeFile] = useState<ExcelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [step, setStep] = useState<Step>("upload");

  const handleFileUpload = async (file: File, type: "offre" | "dqe") => {
    try {
      const data = await readExcelFile(file);
      if (type === "offre") setOffreFile(data);
      else setDqeFile(data);
      toast({ title: `${file.name} chargé avec succès` });
    } catch {
      toast({ title: "Erreur de lecture du fichier Excel", variant: "destructive" });
    }
  };

  const handleDrop = (e: React.DragEvent, type: "offre" | "dqe") => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file, type);
  };

  const startCorrection = async () => {
    if (!offreFile) return;
    setStep("results");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(AI_SERVICE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          offreText: offreFile.rawText,
          dqeText: dqeFile?.rawText || "",
          provider: "gemini",
          model: "gemini-2.5-flash",
        }),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: CorrectionResult = await res.json();
      setResult(data);
      toast({ title: "Correction terminée avec succès" });
    } catch (err: any) {
      toast({ title: "Erreur lors de la correction", description: err.message, variant: "destructive" });
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOffreFile(null);
    setDqeFile(null);
    setResult(null);
    setStep("upload");
  };

  return (
    <DashboardLayout>
      {step === "upload" && (
        <UploadStep
          offreFile={offreFile}
          dqeFile={dqeFile}
          onUpload={handleFileUpload}
          onDrop={handleDrop}
          onRemoveOffre={() => setOffreFile(null)}
          onRemoveDqe={() => setDqeFile(null)}
          onPreview={() => setStep("preview")}
        />
      )}
      {step === "preview" && (
        <PreviewStep
          offreFile={offreFile}
          dqeFile={dqeFile}
          onBack={() => setStep("upload")}
          onStartCorrection={startCorrection}
          loading={loading}
        />
      )}
      {step === "results" && (
        <ResultsStep
          loading={loading}
          result={result}
          onReset={reset}
          onBack={() => setStep("preview")}
        />
      )}
    </DashboardLayout>
  );
};

/* ======== STEP 1: Upload ======== */
function UploadStep({
  offreFile, dqeFile, onUpload, onDrop, onRemoveOffre, onRemoveDqe, onPreview,
}: {
  offreFile: ExcelData | null; dqeFile: ExcelData | null;
  onUpload: (f: File, type: "offre" | "dqe") => void;
  onDrop: (e: React.DragEvent, type: "offre" | "dqe") => void;
  onRemoveOffre: () => void; onRemoveDqe: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Simulation de correction</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Uploadez vos fichiers Excel pour simuler la correction fiscale par l'IA.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UploadZone
          label="Offre Fiscale"
          description="Fichier Excel de l'offre fiscale (modèle fiscal)"
          file={offreFile}
          onUpload={(f) => onUpload(f, "offre")}
          onDrop={(e) => onDrop(e, "offre")}
          onRemove={onRemoveOffre}
        />
        <UploadZone
          label="DQE (optionnel)"
          description="Fichier Excel du Devis Quantitatif et Estimatif"
          file={dqeFile}
          onUpload={(f) => onUpload(f, "dqe")}
          onDrop={(e) => onDrop(e, "dqe")}
          onRemove={onRemoveDqe}
        />
      </div>

      {offreFile && (
        <div className="flex justify-center">
          <Button size="lg" onClick={onPreview} className="px-8">
            <Eye className="h-5 w-5 mr-2" />
            Aperçu des fichiers
          </Button>
        </div>
      )}
    </div>
  );
}

/* ======== STEP 2: Preview ======== */
function PreviewStep({
  offreFile, dqeFile, onBack, onStartCorrection, loading,
}: {
  offreFile: ExcelData | null; dqeFile: ExcelData | null;
  onBack: () => void; onStartCorrection: () => void; loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Aperçu des fichiers</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Vérifiez le contenu extrait de vos fichiers avant de lancer la correction.
            </p>
          </div>
        </div>
      </div>

      {offreFile && <FullExcelPreview data={offreFile} />}
      {dqeFile && <FullExcelPreview data={dqeFile} />}

      <div className="flex justify-center gap-4 pb-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button size="lg" onClick={onStartCorrection} disabled={loading} className="px-8">
          <Play className="h-5 w-5 mr-2" />
          Démarrer la correction
        </Button>
      </div>
    </div>
  );
}

/* ======== STEP 3: Results ======== */
function ResultsStep({
  loading, result, onReset, onBack,
}: {
  loading: boolean; result: CorrectionResult | null;
  onReset: () => void; onBack: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative">
          <div className="h-24 w-24 rounded-full border-4 border-muted animate-pulse" />
          <Loader2 className="h-12 w-12 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Analyse en cours par l'IA...</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            Veuillez patienter, la correction de l'offre fiscale est en cours de traitement. Cela peut prendre quelques instants.
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Résultats de la correction</h1>
          <p className="text-muted-foreground text-sm mt-1">Analyse complète de votre offre fiscale.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Aperçu
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <X className="h-4 w-4 mr-1" /> Nouvelle simulation
          </Button>
        </div>
      </div>

      <CorrectionResults result={result} />
    </div>
  );
}

/* ======== Upload Zone ======== */
function UploadZone({
  label, description, file, onUpload, onDrop, onRemove,
}: {
  label: string; description: string; file: ExcelData | null;
  onUpload: (f: File) => void; onDrop: (e: React.DragEvent) => void; onRemove: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {file ? (
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">{file.fileName}</span>
              <span className="text-xs text-muted-foreground">({file.sheets.length} feuille{file.sheets.length > 1 ? "s" : ""})</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onRemove}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <Upload className="h-8 w-8 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">{description}</p>
              <p className="text-xs text-muted-foreground mt-1">Glissez-déposez ou cliquez pour sélectionner (.xlsx, .xls)</p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
          </label>
        )}
      </CardContent>
    </Card>
  );
}

/* ======== Full Excel Preview (dedicated view) ======== */
function FullExcelPreview({ data }: { data: ExcelData }) {
  const [openSheet, setOpenSheet] = useState(0);
  const sheet = data.sheets[openSheet];
  if (!sheet || sheet.data.length === 0) return null;

  const maxCols = Math.max(...sheet.data.map(r => r.length));
  const padRow = (row: string[]) => {
    const padded = [...row];
    while (padded.length < maxCols) padded.push("");
    return padded;
  };

  const headerRow = padRow(sheet.data[0]);
  const bodyRows = sheet.data.slice(1);

  // Detect if a cell looks like a number
  const isNumeric = (val: string) => val !== "" && !isNaN(Number(val.replace(/\s/g, "").replace(",", ".")));

  return (
    <Card className="overflow-hidden shadow-sm border-border/60">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent border-b">
        <CardTitle className="text-sm flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{data.fileName}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {bodyRows.length} lignes · {maxCols} colonnes · {data.sheets.length} feuille{data.sheets.length > 1 ? "s" : ""}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.sheets.length > 1 && (
          <div className="flex gap-1.5 px-4 py-3 bg-muted/30 border-b flex-wrap">
            {data.sheets.map((s, i) => (
              <Button
                key={i}
                variant={openSheet === i ? "default" : "ghost"}
                size="sm"
                className={`text-xs h-8 rounded-full px-4 transition-all ${
                  openSheet === i
                    ? "shadow-sm"
                    : "hover:bg-muted text-muted-foreground"
                }`}
                onClick={() => setOpenSheet(i)}
              >
                {s.name}
              </Button>
            ))}
          </div>
        )}
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-[13px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-primary/8 border-b-2 border-primary/15">
                <th className="px-3 py-2.5 text-center font-semibold text-primary/60 w-12 text-xs">#</th>
                {headerRow.map((cell, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left font-semibold text-foreground/80 whitespace-nowrap text-xs uppercase tracking-wider"
                  >
                    {String(cell) || `Col ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => {
                const paddedRow = padRow(row);
                const isEmpty = paddedRow.every(c => String(c).trim() === "");
                return (
                  <tr
                    key={ri}
                    className={`
                      border-b border-border/30 transition-colors
                      ${isEmpty ? "h-6" : "hover:bg-primary/[0.03]"}
                      ${ri % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    `}
                  >
                    <td className="px-3 py-2 text-center text-muted-foreground/40 font-mono text-[11px] select-none">
                      {ri + 1}
                    </td>
                    {paddedRow.map((cell, ci) => {
                      const val = String(cell);
                      const numeric = isNumeric(val);
                      return (
                        <td
                          key={ci}
                          className={`
                            px-4 py-2 whitespace-nowrap
                            ${numeric ? "text-right font-mono tabular-nums text-foreground/90" : "text-foreground/80"}
                            ${val.trim() === "" ? "" : ""}
                          `}
                        >
                          {numeric
                            ? Number(val.replace(/\s/g, "").replace(",", ".")).toLocaleString("fr-FR", { maximumFractionDigits: 6 })
                            : val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ======== Correction Results ======== */
function CorrectionResults({ result }: { result: CorrectionResult }) {
  const resumeAudit = result.resumeAudit || { nombreErreursDetectees: 0, graviteGlobale: "Aucune", risqueFiscal: "Inconnu", explications: [] };
  const ecartGlobal = result.ecartGlobal || { creditDeclare: 0, creditCorrige: 0, difference: 0 };
  const correctionsDouane = result.correctionsDouane || [];
  const correctionsInterieure = result.correctionsInterieure || [];
  const creditImpot = result.creditImpôtCorrige || { creditDouanier: { DD: 0, RS: 0, PSC: 0, TVA: 0, totalA: 0 }, creditInterieur: { TVAInterieure: 0, TVADouane: 0, TVANette: 0, totalB: 0 }, creditTotalCorrige: 0 };

  return (
    <div className="space-y-6">
      {/* Audit Summary */}
      <Card className={resumeAudit.graviteGlobale === "Majeure" ? "border-destructive/50" : "border-yellow-300"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${resumeAudit.graviteGlobale === "Majeure" ? "text-destructive" : "text-yellow-500"}`} />
            Résumé de l'audit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Erreurs détectées</p>
              <p className="text-2xl font-bold">{resumeAudit.nombreErreursDetectees}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Gravité globale</p>
              <p className="text-lg font-bold">{niveauBadge(resumeAudit.graviteGlobale)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Risque fiscal</p>
              <p className="text-lg font-semibold">{resumeAudit.risqueFiscal}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Explications :</p>
            <ul className="space-y-1">
              {(resumeAudit.explications || []).map((exp, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-2">
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>{exp}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Ecart Global */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Écart Global</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground">Crédit déclaré</p>
              <p className="text-lg font-bold">{formatNumber(ecartGlobal.creditDeclare)} MRU</p>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground">Crédit corrigé</p>
              <p className="text-lg font-bold">{formatNumber(ecartGlobal.creditCorrige)} MRU</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${ecartGlobal.difference !== 0 ? "bg-destructive/10" : "bg-green-50"}`}>
              <p className="text-xs text-muted-foreground">Différence</p>
              <p className={`text-lg font-bold ${ecartGlobal.difference !== 0 ? "text-destructive" : "text-green-700"}`}>
                {formatNumber(ecartGlobal.difference)} MRU
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Corrections Douane */}
      {correctionsDouane.length > 0 && (
      <Collapsible defaultOpen>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center gap-2">
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                Corrections Douane ({correctionsDouane.length} produits)
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs min-w-[200px]">Produit</TableHead>
                        <TableHead className="text-xs text-right">Val. Douane (Décl.)</TableHead>
                        <TableHead className="text-xs text-right">Val. Douane (Corr.)</TableHead>
                        <TableHead className="text-xs text-right">Total D&T (Décl.)</TableHead>
                        <TableHead className="text-xs text-right">Total D&T (Corr.)</TableHead>
                        <TableHead className="text-xs text-right">Écart Total</TableHead>
                        <TableHead className="text-xs">Erreur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {correctionsDouane.map((c, i) => (
                        <TableRow key={i} className={c.niveauErreur !== "Aucune" ? "bg-yellow-50/50" : ""}>
                          <TableCell className="text-xs font-medium max-w-[250px] truncate" title={c.produit}>{c.produit}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(c.valeurDeclaree?.VD)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(c.valeurCorrigee?.VD)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber((c.valeurDeclaree as any)?.TotalD_T ?? (c.valeurDeclaree as any)?.TotalDT ?? (c.valeurDeclaree as any)?.totalDroitsEtTaxes)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber((c.valeurCorrigee as any)?.TotalD_T ?? (c.valeurCorrigee as any)?.TotalDT ?? (c.valeurCorrigee as any)?.totalDroitsEtTaxes)}</TableCell>
                          <TableCell className={`text-xs text-right font-medium ${((c.ecart as any)?.TotalD_T ?? (c.ecart as any)?.TotalDT ?? 0) !== 0 ? "text-destructive" : ""}`}>
                            {formatNumber((c.ecart as any)?.TotalD_T ?? (c.ecart as any)?.TotalDT ?? (c.ecart as any)?.totalDroitsEtTaxes)}
                          </TableCell>
                          <TableCell className="text-xs">{niveauBadge(c.niveauErreur)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      )}

      {/* Corrections Intérieure */}
      {correctionsInterieure.length > 0 && (
        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-base flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" />
                  Corrections Fiscalité Intérieure ({correctionsInterieure.length})
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Prestation</TableHead>
                      <TableHead className="text-xs text-right">Montant HT (Décl.)</TableHead>
                      <TableHead className="text-xs text-right">Montant HT (Corr.)</TableHead>
                      <TableHead className="text-xs text-right">TVA (Décl.)</TableHead>
                      <TableHead className="text-xs text-right">TVA (Corr.)</TableHead>
                      <TableHead className="text-xs text-right">Écart Total DGI</TableHead>
                      <TableHead className="text-xs">Erreur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {correctionsInterieure.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{c.prestation}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(c.valeurDeclaree?.HT)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(c.valeurCorrigee?.HT)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(c.valeurDeclaree?.TVA)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(c.valeurCorrigee?.TVA)}</TableCell>
                        <TableCell className={`text-xs text-right font-medium ${(c.ecart?.HT !== 0 || c.ecart?.TVA !== 0) ? "text-destructive" : ""}`}>
                          {formatNumber((c.ecart?.HT || 0) + (c.ecart?.TVA || 0))}
                        </TableCell>
                        <TableCell className="text-xs">{niveauBadge(c.niveauErreur)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Crédit d'Impôt Corrigé */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crédit d'Impôt Corrigé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Crédit Douanier</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>DD</span><span>{formatNumber(creditImpot.creditDouanier?.DD)}</span></div>
                <div className="flex justify-between"><span>RS</span><span>{formatNumber(creditImpot.creditDouanier?.RS)}</span></div>
                <div className="flex justify-between"><span>PSC</span><span>{formatNumber(creditImpot.creditDouanier?.PSC)}</span></div>
                <div className="flex justify-between"><span>TVA</span><span>{formatNumber(creditImpot.creditDouanier?.TVA)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Total A</span><span>{formatNumber(creditImpot.creditDouanier?.totalA)}</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Crédit Intérieur</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>TVA Intérieure</span><span>{formatNumber(creditImpot.creditInterieur?.TVAInterieure)}</span></div>
                <div className="flex justify-between"><span>TVA Douane</span><span>{formatNumber(creditImpot.creditInterieur?.TVADouane)}</span></div>
                <div className="flex justify-between"><span>TVA Nette</span><span>{formatNumber(creditImpot.creditInterieur?.TVANette)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Total B</span><span>{formatNumber(creditImpot.creditInterieur?.totalB)}</span></div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-primary/10 text-center">
            <p className="text-xs text-muted-foreground">Crédit Total Corrigé</p>
            <p className="text-xl font-bold text-primary">{formatNumber(creditImpot.creditTotalCorrige)} MRU</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Simulation;
