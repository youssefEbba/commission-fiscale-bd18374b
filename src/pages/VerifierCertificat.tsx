import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, ScanLine, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/i18n/format";

type EtatVerificationCertificat =
  | "INCONNU"
  | "VALIDE"
  | "EXPIRE"
  | "CLOTURE"
  | "ANNULE"
  | "EN_COURS"
  | "NON_VALIDE";

type SeveriteUi = "success" | "warning" | "destructive" | "muted";

interface CertificatVerificationDto {
  trouve: boolean;
  numero: string;
  certificatId?: number;
  statutCertificat?: string;
  etatVerification: EtatVerificationCertificat;
  libelleEtat: string;
  severiteUi: SeveriteUi;
  dateEmission?: string;
  dateValidite?: string;
  expire: boolean;
  entrepriseRaisonSociale?: string;
  marcheId?: number;
  soldeCordon?: number;
  soldeTVA?: number;
  utilisableDouane: boolean;
  utilisableTVA: boolean;
  motifs: string[];
}

const badgeClass = (s: SeveriteUi) => {
  switch (s) {
    case "success":
      return "bg-emerald-600 hover:bg-emerald-600 text-white";
    case "warning":
      return "bg-amber-500 hover:bg-amber-500 text-white";
    case "destructive":
      return "bg-red-600 hover:bg-red-600 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

export default function VerifierCertificat() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("numero") || "";
  const [numero, setNumero] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CertificatVerificationDto | null>(null);

  const verify = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const dto = await apiFetch<CertificatVerificationDto>(
        `/certificats-credit/verification?numero=${encodeURIComponent(value)}`,
      );
      setResult(dto);
    } catch (e: any) {
      setError(e?.message || "Vérification impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial) verify(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(numero ? { numero } : {});
    verify(numero);
  };

  return (
    <div className="container max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <ScanLine className="h-8 w-8 text-emerald-700" />
        <div>
          <h1 className="text-2xl font-bold">Vérification d'un certificat</h1>
          <p className="text-sm text-muted-foreground">
            Scannez le QR code du certificat ou saisissez son numéro pour contrôler son authenticité.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Numéro de certificat</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
            <Input
              autoFocus
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex. CI-DEMO-SCEN-E"
              className="font-mono uppercase"
            />
            <Button type="submit" disabled={loading || !numero.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <RefreshCw className="h-4 w-4 me-1" />}
              Vérifier
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300">
          <CardContent className="pt-6 text-red-700 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> {error}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {result.severiteUi === "success" ? (
                <ShieldCheck className="h-7 w-7 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-7 w-7 text-amber-600" />
              )}
              <CardTitle className="text-xl">{result.libelleEtat}</CardTitle>
            </div>
            <Badge className={badgeClass(result.severiteUi)}>{result.etatVerification}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Numéro</div>
                <div className="font-mono font-semibold">{result.numero}</div>
              </div>
              {result.trouve && (
                <>
                  <div>
                    <div className="text-muted-foreground">Bénéficiaire</div>
                    <div className="font-semibold">{result.entrepriseRaisonSociale || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Date d'émission</div>
                    <div>{fmtDate(result.dateEmission)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Date de validité</div>
                    <div>{fmtDate(result.dateValidite)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Solde cordon douanier</div>
                    <div className="font-semibold">
                      {result.soldeCordon != null ? formatCurrency(result.soldeCordon) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Solde TVA intérieure</div>
                    <div className="font-semibold">
                      {result.soldeTVA != null ? formatCurrency(result.soldeTVA) : "—"}
                    </div>
                  </div>
                </>
              )}
            </div>

            {result.trouve && (
              <div className="flex flex-wrap gap-2">
                <Badge variant={result.utilisableDouane ? "default" : "outline"}>
                  Douane : {result.utilisableDouane ? "utilisable" : "non utilisable"}
                </Badge>
                <Badge variant={result.utilisableTVA ? "default" : "outline"}>
                  TVA intérieure : {result.utilisableTVA ? "utilisable" : "non utilisable"}
                </Badge>
              </div>
            )}

            {result.motifs?.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-1">Motifs / informations</div>
                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                  {result.motifs.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
