import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Play, Loader2, AlertTriangle, CheckCircle, X, ChevronDown, ChevronRight } from "lucide-react";
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
  valeurEnDouane: number;
  montantDD: number;
  montantRS: number;
  montantPSC: number;
  baseTVA: number;
  tva: number;
  totalDroitsEtTaxes: number;
}

interface CorrectionDouane {
  produit: string;
  valeurDeclaree: ValeurDouane;
  valeurCorrigee: ValeurDouane;
  ecart: ValeurDouane;
  niveauErreur: string;
}

interface ValeurInterieure {
  montantHT: number;
  tva: number;
  totalDGI: number;
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

function formatNumber(n: number | undefined): string {
  if (n === undefined || n === null) return "-";
  return n.toLocaleString("fr-FR");
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

const Simulation = () => {
  const { toast } = useToast();
  const [offreFile, setOffreFile] = useState<ExcelData | null>(null);
  const [dqeFile, setDqeFile] = useState<ExcelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);

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
    if (!offreFile || !dqeFile) return;
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
          dqeText: dqeFile.rawText,
          provider: "openai",
          model: "gpt-4o-mini",
        }),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: CorrectionResult = await res.json();
      setResult(data);
      toast({ title: "Correction terminée avec succès" });
    } catch (err: any) {
      toast({ title: "Erreur lors de la correction", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOffreFile(null);
    setDqeFile(null);
    setResult(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Simulation de correction</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Uploadez vos fichiers Excel (Offre Fiscale et DQE) pour simuler la correction automatique.
            </p>
          </div>
          {(offreFile || dqeFile || result) && (
            <Button variant="outline" size="sm" onClick={reset}>
              <X className="h-4 w-4 mr-1" /> Réinitialiser
            </Button>
          )}
        </div>

        {/* Upload Section */}
        {!result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UploadZone
              label="Offre Fiscale"
              description="Fichier Excel de l'offre fiscale (modèle fiscal)"
              file={offreFile}
              onUpload={(f) => handleFileUpload(f, "offre")}
              onDrop={(e) => handleDrop(e, "offre")}
              onRemove={() => setOffreFile(null)}
            />
            <UploadZone
              label="DQE"
              description="Fichier Excel du Devis Quantitatif et Estimatif"
              file={dqeFile}
              onUpload={(f) => handleFileUpload(f, "dqe")}
              onDrop={(e) => handleDrop(e, "dqe")}
              onRemove={() => setDqeFile(null)}
            />
          </div>
        )}

        {/* Preview Section */}
        {!result && (offreFile || dqeFile) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {offreFile && <ExcelPreview data={offreFile} />}
            {dqeFile && <ExcelPreview data={dqeFile} />}
          </div>
        )}

        {/* Action Button */}
        {!result && offreFile && dqeFile && (
          <div className="flex justify-center">
            <Button size="lg" onClick={startCorrection} disabled={loading} className="px-8">
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Correction en cours...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Démarrer la correction
                </>
              )}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium text-muted-foreground">Analyse en cours par l'IA...</p>
              <p className="text-sm text-muted-foreground">
                Veuillez patienter, la correction de l'offre fiscale et du DQE est en cours de traitement.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && <CorrectionResults result={result} />}
      </div>
    </DashboardLayout>
  );
};

// Upload Zone Component
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

// Excel Preview Component
function ExcelPreview({ data }: { data: ExcelData }) {
  const [openSheet, setOpenSheet] = useState(0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Aperçu : {data.fileName}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.sheets.length > 1 && (
          <div className="flex gap-1 mb-2 flex-wrap">
            {data.sheets.map((s, i) => (
              <Button key={i} variant={openSheet === i ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setOpenSheet(i)}>
                {s.name}
              </Button>
            ))}
          </div>
        )}
        <ScrollArea className="h-[250px] border rounded-md">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {data.sheets[openSheet]?.data[0]?.map((cell, i) => (
                    <TableHead key={i} className="text-xs whitespace-nowrap">{String(cell)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sheets[openSheet]?.data.slice(1, 20).map((row, ri) => (
                  <TableRow key={ri}>
                    {row.map((cell, ci) => (
                      <TableCell key={ci} className="text-xs py-1 whitespace-nowrap">{String(cell)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {(data.sheets[openSheet]?.data.length || 0) > 20 && (
                  <TableRow>
                    <TableCell colSpan={data.sheets[openSheet]?.data[0]?.length || 1} className="text-xs text-center text-muted-foreground py-2">
                      ... {data.sheets[openSheet].data.length - 20} lignes supplémentaires
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Correction Results Component
function CorrectionResults({ result }: { result: CorrectionResult }) {
  return (
    <div className="space-y-6">
      {/* Audit Summary */}
      <Card className={result.resumeAudit.graviteGlobale === "Majeure" ? "border-destructive/50" : "border-yellow-300"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${result.resumeAudit.graviteGlobale === "Majeure" ? "text-destructive" : "text-yellow-500"}`} />
            Résumé de l'audit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Erreurs détectées</p>
              <p className="text-2xl font-bold">{result.resumeAudit.nombreErreursDetectees}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Gravité globale</p>
              <p className="text-lg font-bold">{niveauBadge(result.resumeAudit.graviteGlobale)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Risque fiscal</p>
              <p className="text-lg font-semibold">{result.resumeAudit.risqueFiscal}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Explications :</p>
            <ul className="space-y-1">
              {result.resumeAudit.explications.map((exp, i) => (
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
              <p className="text-lg font-bold">{formatNumber(result.ecartGlobal.creditDeclare)} MRU</p>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground">Crédit corrigé</p>
              <p className="text-lg font-bold">{formatNumber(result.ecartGlobal.creditCorrige)} MRU</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${result.ecartGlobal.difference !== 0 ? "bg-destructive/10" : "bg-green-50"}`}>
              <p className="text-xs text-muted-foreground">Différence</p>
              <p className={`text-lg font-bold ${result.ecartGlobal.difference !== 0 ? "text-destructive" : "text-green-700"}`}>
                {formatNumber(result.ecartGlobal.difference)} MRU
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Corrections Douane */}
      <Collapsible defaultOpen>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base flex items-center gap-2">
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                Corrections Douane ({result.correctionsDouane.length} produits)
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
                      {result.correctionsDouane.map((c, i) => (
                        <TableRow key={i} className={c.niveauErreur !== "Aucune" ? "bg-yellow-50/50" : ""}>
                          <TableCell className="text-xs font-medium max-w-[250px] truncate" title={c.produit}>{c.produit}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(c.valeurDeclaree.valeurEnDouane)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(c.valeurCorrigee.valeurEnDouane)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(c.valeurDeclaree.totalDroitsEtTaxes)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(c.valeurCorrigee.totalDroitsEtTaxes)}</TableCell>
                          <TableCell className={`text-xs text-right font-medium ${c.ecart.totalDroitsEtTaxes !== 0 ? "text-destructive" : ""}`}>
                            {formatNumber(c.ecart.totalDroitsEtTaxes)}
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

      {/* Corrections Intérieure */}
      {result.correctionsInterieure.length > 0 && (
        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-base flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" />
                  Corrections Fiscalité Intérieure ({result.correctionsInterieure.length})
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
                    {result.correctionsInterieure.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{c.prestation}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(c.valeurDeclaree.montantHT)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(c.valeurCorrigee.montantHT)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(c.valeurDeclaree.tva)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(c.valeurCorrigee.tva)}</TableCell>
                        <TableCell className={`text-xs text-right font-medium ${c.ecart.totalDGI !== 0 ? "text-destructive" : ""}`}>
                          {formatNumber(c.ecart.totalDGI)}
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
                <div className="flex justify-between"><span>DD</span><span>{formatNumber(result.creditImpôtCorrige.creditDouanier.DD)}</span></div>
                <div className="flex justify-between"><span>RS</span><span>{formatNumber(result.creditImpôtCorrige.creditDouanier.RS)}</span></div>
                <div className="flex justify-between"><span>PSC</span><span>{formatNumber(result.creditImpôtCorrige.creditDouanier.PSC)}</span></div>
                <div className="flex justify-between"><span>TVA</span><span>{formatNumber(result.creditImpôtCorrige.creditDouanier.TVA)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Total A</span><span>{formatNumber(result.creditImpôtCorrige.creditDouanier.totalA)}</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Crédit Intérieur</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>TVA Intérieure</span><span>{formatNumber(result.creditImpôtCorrige.creditInterieur.TVAInterieure)}</span></div>
                <div className="flex justify-between"><span>TVA Douane</span><span>{formatNumber(result.creditImpôtCorrige.creditInterieur.TVADouane)}</span></div>
                <div className="flex justify-between"><span>TVA Nette</span><span>{formatNumber(result.creditImpôtCorrige.creditInterieur.TVANette)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Total B</span><span>{formatNumber(result.creditImpôtCorrige.creditInterieur.totalB)}</span></div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-primary/10 text-center">
            <p className="text-xs text-muted-foreground">Crédit Total Corrigé</p>
            <p className="text-xl font-bold text-primary">{formatNumber(result.creditImpôtCorrige.creditTotalCorrige)} MRU</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Simulation;
