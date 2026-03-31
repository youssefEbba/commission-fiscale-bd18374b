import { useState, useCallback, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload, FileSpreadsheet, Play, Loader2, CheckCircle, X,
  ChevronDown, Eye, ArrowLeft, FileText, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AI_SERVICE_BASE } from "@/lib/apiConfig";
import { useAuth } from "@/contexts/AuthContext";

/* ──────────────── Types ──────────────── */

interface ExcelPreviewData {
  fileName: string;
  sheets: { name: string; data: string[][] }[];
  workbook: XLSX.WorkBook;
}

interface SimulationStatus {
  exists: boolean;
  hasDqeStandard: boolean;
  hasOffreFiscale: boolean;
  meta?: any;
}

type Step = "upload" | "preview" | "processing" | "results";

/* ──────────────── Helpers ──────────────── */

function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return "-";
  if (Math.abs(n) < 0.001) return "0";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

function readExcelForPreview(file: File): Promise<ExcelPreviewData> {
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
        resolve({ fileName: file.name, sheets, workbook: wb });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/* ──────────────── Main Component ──────────────── */

const Simulation = () => {
  const { toast } = useToast();
  const [entrepriseId, setEntrepriseId] = useState("");
  const [dqeFile, setDqeFile] = useState<File | null>(null);
  const [ofFile, setOfFile] = useState<File | null>(null);
  const [dqePreview, setDqePreview] = useState<ExcelPreviewData | null>(null);
  const [ofPreview, setOfPreview] = useState<ExcelPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [progressMsg, setProgressMsg] = useState("");
  const [dqeStandard, setDqeStandard] = useState<any>(null);
  const [offreFiscale, setOffreFiscale] = useState<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFileUpload = async (file: File, type: "dqe" | "of") => {
    if (type === "dqe") {
      setDqeFile(file);
      try {
        const preview = await readExcelForPreview(file);
        setDqePreview(preview);
      } catch { setDqePreview(null); }
    } else {
      setOfFile(file);
      try {
        const preview = await readExcelForPreview(file);
        setOfPreview(preview);
      } catch { setOfPreview(null); }
    }
    toast({ title: `${file.name} chargé avec succès` });
  };

  const handleDrop = (e: React.DragEvent, type: "dqe" | "of") => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file, type);
  };

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback((eid: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${AI_SERVICE_BASE}/api/simulation/${encodeURIComponent(eid)}/status`);
        if (!res.ok) return;
        const status: SimulationStatus = await res.json();

        if (status.hasDqeStandard && status.hasOffreFiscale) {
          stopPolling();
          setProgressMsg("Récupération des résultats...");
          // Fetch both results
          const [dqeRes, ofRes] = await Promise.all([
            fetch(`${AI_SERVICE_BASE}/api/simulation/${encodeURIComponent(eid)}/dqe-standard`),
            fetch(`${AI_SERVICE_BASE}/api/simulation/${encodeURIComponent(eid)}/offre-fiscale`),
          ]);
          if (dqeRes.ok) setDqeStandard(await dqeRes.json());
          if (ofRes.ok) setOffreFiscale(await ofRes.json());
          setLoading(false);
          setStep("results");
          toast({ title: "Simulation terminée avec succès" });
        } else if (status.hasDqeStandard && !status.hasOffreFiscale) {
          setProgressMsg("DQE standard généré. Génération de l'offre fiscale corrigée...");
        } else if (status.exists) {
          setProgressMsg("Extraction et analyse des documents en cours...");
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
  }, [stopPolling, toast]);

  const startSimulation = async () => {
    if (!dqeFile || !entrepriseId.trim()) {
      toast({ title: "Veuillez renseigner l'ID entreprise et le fichier DQE", variant: "destructive" });
      return;
    }

    setStep("processing");
    setLoading(true);
    setProgressMsg("Envoi des fichiers...");
    setDqeStandard(null);
    setOffreFiscale(null);

    try {
      const fd = new FormData();
      fd.append("entrepriseId", entrepriseId.trim());
      fd.append("dqe", dqeFile);
      if (ofFile) fd.append("offreFiscale", ofFile);

      const res = await fetch(`${AI_SERVICE_BASE}/api/simulation/run`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || `Erreur ${res.status}`);
      }

      setProgressMsg("Traitement lancé. Extraction et analyse en cours...");
      // Start polling for status
      pollStatus(entrepriseId.trim());
    } catch (err: any) {
      toast({ title: "Erreur lors du lancement", description: err.message, variant: "destructive" });
      setStep("upload");
      setLoading(false);
    }
  };

  const reset = () => {
    stopPolling();
    setEntrepriseId("");
    setDqeFile(null);
    setOfFile(null);
    setDqePreview(null);
    setOfPreview(null);
    setDqeStandard(null);
    setOffreFiscale(null);
    setResult(null);
    setStep("upload");
    setLoading(false);
  };

  // Legacy compat
  const setResult = (_: any) => {};

  return (
    <DashboardLayout>
      {step === "upload" && (
        <UploadStep
          entrepriseId={entrepriseId}
          setEntrepriseId={setEntrepriseId}
          dqeFile={dqeFile}
          ofFile={ofFile}
          dqePreview={dqePreview}
          ofPreview={ofPreview}
          onUpload={handleFileUpload}
          onDrop={handleDrop}
          onRemoveDqe={() => { setDqeFile(null); setDqePreview(null); }}
          onRemoveOf={() => { setOfFile(null); setOfPreview(null); }}
          onPreview={() => setStep("preview")}
        />
      )}
      {step === "preview" && (
        <PreviewStep
          dqePreview={dqePreview}
          ofPreview={ofPreview}
          onBack={() => setStep("upload")}
          onStartSimulation={startSimulation}
          loading={loading}
        />
      )}
      {step === "processing" && (
        <ProcessingStep progressMsg={progressMsg} />
      )}
      {step === "results" && (
        <ResultsStep
          dqeStandard={dqeStandard}
          offreFiscale={offreFiscale}
          entrepriseId={entrepriseId}
          onReset={reset}
          onBack={() => setStep("upload")}
        />
      )}
    </DashboardLayout>
  );
};

/* ======== STEP 1: Upload ======== */
function UploadStep({
  entrepriseId, setEntrepriseId,
  dqeFile, ofFile, dqePreview, ofPreview,
  onUpload, onDrop, onRemoveDqe, onRemoveOf, onPreview,
}: {
  entrepriseId: string; setEntrepriseId: (v: string) => void;
  dqeFile: File | null; ofFile: File | null;
  dqePreview: ExcelPreviewData | null; ofPreview: ExcelPreviewData | null;
  onUpload: (f: File, type: "dqe" | "of") => void;
  onDrop: (e: React.DragEvent, type: "dqe" | "of") => void;
  onRemoveDqe: () => void; onRemoveOf: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Simulation Entreprise</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Uploadez vos fichiers (DQE + Offre Fiscale optionnelle) pour simuler la correction automatique.
        </p>
      </div>

      {/* Entreprise ID */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identifiant Entreprise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="entrepriseId">ID Entreprise *</Label>
            <Input
              id="entrepriseId"
              placeholder="Ex: ENT-12345"
              value={entrepriseId}
              onChange={(e) => setEntrepriseId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Identifiant unique pour cette session de simulation.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FileUploadZone
          label="DQE (obligatoire)"
          description="Fichier du Devis Quantitatif et Estimatif"
          file={dqeFile}
          onUpload={(f) => onUpload(f, "dqe")}
          onDrop={(e) => onDrop(e, "dqe")}
          onRemove={onRemoveDqe}
          accept=".xlsx,.xls,.pdf,.docx"
        />
        <FileUploadZone
          label="Offre Fiscale (optionnel)"
          description="Fichier de l'offre fiscale"
          file={ofFile}
          onUpload={(f) => onUpload(f, "of")}
          onDrop={(e) => onDrop(e, "of")}
          onRemove={onRemoveOf}
          accept=".xlsx,.xls,.pdf,.docx"
        />
      </div>

      {dqeFile && entrepriseId.trim() && (
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
  dqePreview, ofPreview, onBack, onStartSimulation, loading,
}: {
  dqePreview: ExcelPreviewData | null; ofPreview: ExcelPreviewData | null;
  onBack: () => void; onStartSimulation: () => void; loading: boolean;
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
              Vérifiez le contenu avant de lancer la simulation.
            </p>
          </div>
        </div>
      </div>

      {dqePreview && <FullExcelPreview data={dqePreview} />}
      {ofPreview && <FullExcelPreview data={ofPreview} />}

      {!dqePreview && !ofPreview && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Les fichiers uploadés ne sont pas des fichiers Excel. L'aperçu n'est pas disponible.</p>
            <p className="text-xs mt-1">Le backend extraira le contenu (PDF/Word → texte).</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center gap-4 pb-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button size="lg" onClick={onStartSimulation} disabled={loading} className="px-8">
          <Play className="h-5 w-5 mr-2" />
          Lancer la simulation
        </Button>
      </div>
    </div>
  );
}

/* ======== STEP 3: Processing ======== */
function ProcessingStep({ progressMsg }: { progressMsg: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="relative">
        <div className="h-24 w-24 rounded-full border-4 border-muted animate-pulse" />
        <Loader2 className="h-12 w-12 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Simulation en cours...</h2>
        <p className="text-muted-foreground text-sm max-w-md">{progressMsg}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Extraction → Analyse DQE → Génération offre fiscale corrigée. Cela peut prendre quelques minutes.
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

/* ======== STEP 4: Results ======== */
function ResultsStep({
  dqeStandard, offreFiscale, entrepriseId, onReset, onBack,
}: {
  dqeStandard: any; offreFiscale: any; entrepriseId: string;
  onReset: () => void; onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Résultats de la simulation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Entreprise : <span className="font-medium text-foreground">{entrepriseId}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RefreshCw className="h-4 w-4 mr-1" /> Nouvelle simulation
          </Button>
        </div>
      </div>

      {/* DQE Standard */}
      {dqeStandard && (
        <DqeStandardView data={dqeStandard} />
      )}

      {/* Offre Fiscale Corrigée */}
      {offreFiscale && (
        <OffreFiscaleView data={offreFiscale} />
      )}

      {!dqeStandard && !offreFiscale && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
            <p>Aucun résultat disponible. Le traitement a peut-être échoué.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ======== DQE Standard View ======== */
function DqeStandardView({ data }: { data: any }) {
  const dqe = data?.dqe || data;
  const items = dqe?.items || dqe?.lignes || [];

  return (
    <Collapsible defaultOpen>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-base flex items-center gap-2">
              <ChevronDown className="h-4 w-4" />
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              DQE Standard ({items.length} lignes)
              {data?.savedAt && (
                <span className="text-xs text-muted-foreground font-normal ml-auto">
                  {new Date(data.savedAt).toLocaleString("fr-FR")}
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {items.length > 0 ? (
              <ScrollArea className="w-full">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs min-w-[50px]">#</TableHead>
                        <TableHead className="text-xs min-w-[200px]">Désignation</TableHead>
                        <TableHead className="text-xs text-right">Quantité</TableHead>
                        <TableHead className="text-xs text-right">Prix Unitaire</TableHead>
                        <TableHead className="text-xs text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{item.numero || item.num || i + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{item.designation || item.description || item.libelle || "-"}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatNumber(item.quantite || item.qte)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatNumber(item.prixUnitaire || item.pu)}</TableCell>
                          <TableCell className="text-xs text-right font-mono font-medium">{formatNumber(item.montant || item.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            ) : (
              <div className="text-sm text-muted-foreground">
                <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-lg max-h-[400px] overflow-auto">
                  {JSON.stringify(dqe, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ======== Offre Fiscale Corrigée View ======== */
function OffreFiscaleView({ data }: { data: any }) {
  const of = data?.offre_fiscale || data;
  const feuilles = of?.feuilles || of?.sheets || [];
  const creditImpot = of?.creditImpot || of?.credit_impot || of?.feuille3 || null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Offre Fiscale Corrigée
            {data?.savedAt && (
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                {new Date(data.savedAt).toLocaleString("fr-FR")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feuilles.length > 0 ? (
            <div className="space-y-4">
              {feuilles.map((feuille: any, i: number) => (
                <Collapsible key={i}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                      <ChevronDown className="h-4 w-4" />
                      <span className="text-sm font-medium">{feuille.nom || feuille.name || `Feuille ${i + 1}`}</span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2">
                      {feuille.lignes?.length > 0 ? (
                        <ScrollArea className="w-full">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {Object.keys(feuille.lignes[0] || {}).map((key) => (
                                  <TableHead key={key} className="text-xs">{key}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {feuille.lignes.map((ligne: any, j: number) => (
                                <TableRow key={j}>
                                  {Object.values(ligne).map((val: any, k: number) => (
                                    <TableCell key={k} className="text-xs font-mono">
                                      {typeof val === "number" ? formatNumber(val) : String(val ?? "-")}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      ) : (
                        <pre className="text-xs bg-muted p-3 rounded max-h-[300px] overflow-auto whitespace-pre-wrap">
                          {JSON.stringify(feuille, null, 2)}
                        </pre>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-lg max-h-[500px] overflow-auto">
              {JSON.stringify(of, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Credit Impôt */}
      {creditImpot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crédit d'Impôt (Feuille 3)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-lg max-h-[400px] overflow-auto">
              {JSON.stringify(creditImpot, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ======== File Upload Zone ======== */
function FileUploadZone({
  label, description, file, onUpload, onDrop, onRemove, accept,
}: {
  label: string; description: string; file: File | null;
  onUpload: (f: File) => void; onDrop: (e: React.DragEvent) => void;
  onRemove: () => void; accept: string;
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
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(file.size / 1024).toFixed(0)} Ko)
              </span>
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
              <p className="text-xs text-muted-foreground mt-1">
                Glissez-déposez ou cliquez pour sélectionner (.xlsx, .xls, .pdf, .docx)
              </p>
            </div>
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
          </label>
        )}
      </CardContent>
    </Card>
  );
}

/* ======== Full Excel Preview (native rendering) ======== */
function FullExcelPreview({ data }: { data: ExcelPreviewData }) {
  const [openSheet, setOpenSheet] = useState(0);
  const sheetName = data.sheets[openSheet]?.name;
  if (!sheetName) return null;

  const ws = data.workbook.Sheets[sheetName];
  const htmlString = XLSX.utils.sheet_to_html(ws, { id: `excel-preview-${openSheet}`, editable: false });

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
              {data.sheets[openSheet]?.data.length || 0} lignes · {data.sheets.length} feuille{data.sheets.length > 1 ? "s" : ""}
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
                  openSheet === i ? "shadow-sm" : "hover:bg-muted text-muted-foreground"
                }`}
                onClick={() => setOpenSheet(i)}
              >
                {s.name}
              </Button>
            ))}
          </div>
        )}
        <div
          className="overflow-auto max-h-[70vh] excel-native-preview"
          dangerouslySetInnerHTML={{ __html: htmlString }}
        />
      </CardContent>
    </Card>
  );
}

export default Simulation;
