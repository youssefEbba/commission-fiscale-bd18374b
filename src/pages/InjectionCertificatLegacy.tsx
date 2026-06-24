import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  autoriteContractanteApi,
  entrepriseApi,
  conventionApi,
  marcheApi,
  legacyCertificatApi,
  documentRequirementApi,
  formatApiErrorMessage,
  type AutoriteContractanteDto,
  type EntrepriseDto,
  type ConventionDto,
  type MarcheDto,
  type LegacyCertificatInjectionRequest,
  type LegacyCertificatInjectionResult,
  type DocumentRequirementDto,
  CONVENTION_DOCUMENT_TYPES,
  MARCHE_DOCUMENT_TYPES,
} from "@/lib/api";

type RefMode = "select" | "create";

const fmt = (n: number | undefined | null) =>
  typeof n === "number" && Number.isFinite(n)
    ? new Intl.NumberFormat("fr-FR").format(n) + " MRU"
    : "—";

const toNum = (v: string): number | undefined => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const toIsoInstant = (d?: string) =>
  d ? new Date(`${d}T00:00:00Z`).toISOString() : undefined;

interface RefSection<T> {
  mode: RefMode;
  selectedId?: number;
  create: T;
}

const InjectionCertificatLegacy = () => {
  const { user } = useAuth();
  const hasPermission = user?.permissions?.includes("admin.certificat.legacy.inject") ?? false;

  // Référentiels existants
  const [acs, setAcs] = useState<AutoriteContractanteDto[]>([]);
  const [entreprises, setEntreprises] = useState<EntrepriseDto[]>([]);
  const [conventions, setConventions] = useState<ConventionDto[]>([]);
  const [marches, setMarches] = useState<MarcheDto[]>([]);

  useEffect(() => {
    if (!hasPermission) return;
    Promise.allSettled([
      autoriteContractanteApi.getAll(),
      entrepriseApi.getAll(),
      conventionApi.getAll(),
      marcheApi.getAll(),
    ]).then(([a, e, c, m]) => {
      if (a.status === "fulfilled") setAcs(a.value);
      if (e.status === "fulfilled") setEntreprises(e.value);
      if (c.status === "fulfilled") setConventions(c.value);
      if (m.status === "fulfilled") setMarches(m.value);
    });
  }, [hasPermission]);

  // Sections
  const [ac, setAc] = useState<RefSection<any>>({
    mode: "select",
    create: { code: "", nom: "", contact: "", adresse: "", telephone: "", email: "" },
  });
  const [ent, setEnt] = useState<RefSection<any>>({
    mode: "select",
    create: { nif: "", raisonSociale: "", adresse: "", telephone: "", email: "" },
  });
  const [conv, setConv] = useState<RefSection<any>>({
    mode: "select",
    create: { reference: "", intitule: "", dateSignature: "" },
  });
  const [marche, setMarche] = useState<RefSection<any>>({
    mode: "select",
    create: { numeroMarche: "", intitule: "", dateSignature: "", montantContratHt: "" },
  });

  // Demande de correction
  const [numeroDemandeCorrection, setNumeroDemandeCorrection] = useState("");
  const [dateDepot, setDateDepot] = useState("");

  // Certificat
  const [cert, setCert] = useState({
    numeroCertificat: "",
    dateValidite: "",
    dateEmission: "",
    valeurDouaneFournitures: "",
    droitsEtTaxesDouaneHorsTva: "",
    tvaImportationDouaneAccordee: "",
    montantMarcheHt: "",
    tvaCollecteeTravaux: "",
    montantCordon: "",
    montantTVAInterieure: "",
    soldeCordon: "",
    soldeTVA: "",
    tvaImportationDouane: "",
  });

  const b = toNum(cert.droitsEtTaxesDouaneHorsTva);
  const d = toNum(cert.tvaImportationDouaneAccordee);
  const g = toNum(cert.tvaCollecteeTravaux);
  const computedE = b !== undefined && d !== undefined ? b + d : undefined;
  const computedH = g !== undefined && d !== undefined ? g - d : undefined;
  const total =
    computedE !== undefined && computedH !== undefined ? computedE + computedH : undefined;

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LegacyCertificatInjectionResult | null>(null);

  const buildRef = <T,>(s: RefSection<T>): { id?: number; create?: T } => {
    if (s.mode === "select") {
      if (!s.selectedId) throw new Error("Sélection manquante");
      return { id: s.selectedId };
    }
    return { create: s.create };
  };

  const handleSubmit = async () => {
    try {
      const payload: LegacyCertificatInjectionRequest = {
        numeroDemandeCorrection: numeroDemandeCorrection || undefined,
        dateDepot: toIsoInstant(dateDepot),
        autoriteContractante: buildRef(ac),
        entreprise: buildRef(ent),
        convention: buildRef(conv) as any,
        marche: buildRef(marche) as any,
        certificat: {
          numeroCertificat: cert.numeroCertificat,
          dateValidite: cert.dateValidite ? new Date(cert.dateValidite).toISOString() : "",
          dateEmission: cert.dateEmission ? new Date(cert.dateEmission).toISOString() : undefined,
          valeurDouaneFournitures: toNum(cert.valeurDouaneFournitures) ?? 0,
          droitsEtTaxesDouaneHorsTva: toNum(cert.droitsEtTaxesDouaneHorsTva) ?? 0,
          tvaImportationDouaneAccordee: toNum(cert.tvaImportationDouaneAccordee) ?? 0,
          montantMarcheHt: toNum(cert.montantMarcheHt) ?? 0,
          tvaCollecteeTravaux: toNum(cert.tvaCollecteeTravaux) ?? 0,
          montantCordon: toNum(cert.montantCordon),
          montantTVAInterieure: toNum(cert.montantTVAInterieure),
          soldeCordon: toNum(cert.soldeCordon),
          soldeTVA: toNum(cert.soldeTVA),
          tvaImportationDouane: toNum(cert.tvaImportationDouane),
        },
      };

      // Coercition montant marché (create)
      if (marche.mode === "create" && payload.marche.create) {
        const m = marche.create.montantContratHt;
        (payload.marche.create as any).montantContratHt =
          m === "" || m === undefined ? undefined : Number(m);
      }

      setSubmitting(true);
      const res = await legacyCertificatApi.inject(payload);
      setResult(res);
      toast.success("Certificat injecté avec succès");
    } catch (err: any) {
      toast.error(formatApiErrorMessage(err, "Échec de l'injection"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasPermission) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto p-6">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Accès refusé</AlertTitle>
            <AlertDescription>
              La permission <code>admin.certificat.legacy.inject</code> est requise pour accéder à
              cette page.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Injection certificat (legacy)</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Injection directe d'un certificat de crédit existant, sans parcourir le workflow
              correction → visas → mise en place.
            </p>
          </div>
          <Badge variant="outline" className="border-amber-500 text-amber-700">
            Injection legacy
          </Badge>
        </div>

        <Alert className="border-amber-500/60 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Solution provisoire</AlertTitle>
          <AlertDescription>
            Réservée à l'injection de certificats historiques. Aucune notification e-mail n'est
            envoyée. La demande de correction est créée en statut <strong>NOTIFIEE</strong> et le
            certificat en statut <strong>OUVERT</strong> avec visas simulés.
          </AlertDescription>
        </Alert>

        {/* AC */}
        <RefBlock
          title="1. Autorité contractante"
          mode={ac.mode}
          onModeChange={(m) => setAc({ ...ac, mode: m })}
          selectedId={ac.selectedId}
          onSelect={(id) => setAc({ ...ac, selectedId: id })}
          options={acs.map((a) => ({ id: a.id!, label: `${a.nom}${a.sigle ? ` (${a.sigle})` : ""}` }))}
        >
          <Grid>
            <Field label="Code">
              <Input
                value={ac.create.code}
                onChange={(e) => setAc({ ...ac, create: { ...ac.create, code: e.target.value } })}
              />
            </Field>
            <Field label="Nom *">
              <Input
                value={ac.create.nom}
                onChange={(e) => setAc({ ...ac, create: { ...ac.create, nom: e.target.value } })}
              />
            </Field>
            <Field label="Contact">
              <Input
                value={ac.create.contact}
                onChange={(e) => setAc({ ...ac, create: { ...ac.create, contact: e.target.value } })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={ac.create.email}
                onChange={(e) => setAc({ ...ac, create: { ...ac.create, email: e.target.value } })}
              />
            </Field>
          </Grid>
        </RefBlock>

        {/* Entreprise */}
        <RefBlock
          title="2. Entreprise"
          mode={ent.mode}
          onModeChange={(m) => setEnt({ ...ent, mode: m })}
          selectedId={ent.selectedId}
          onSelect={(id) => setEnt({ ...ent, selectedId: id })}
          options={entreprises.map((e) => ({ id: e.id!, label: `${e.raisonSociale} — ${e.nif}` }))}
        >
          <Grid>
            <Field label="NIF *">
              <Input
                value={ent.create.nif}
                onChange={(e) => setEnt({ ...ent, create: { ...ent.create, nif: e.target.value } })}
              />
            </Field>
            <Field label="Raison sociale *">
              <Input
                value={ent.create.raisonSociale}
                onChange={(e) =>
                  setEnt({ ...ent, create: { ...ent.create, raisonSociale: e.target.value } })
                }
              />
            </Field>
            <Field label="Adresse">
              <Input
                value={ent.create.adresse}
                onChange={(e) =>
                  setEnt({ ...ent, create: { ...ent.create, adresse: e.target.value } })
                }
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={ent.create.email}
                onChange={(e) =>
                  setEnt({ ...ent, create: { ...ent.create, email: e.target.value } })
                }
              />
            </Field>
          </Grid>
        </RefBlock>

        {/* Convention */}
        <RefBlock
          title="3. Convention"
          mode={conv.mode}
          onModeChange={(m) => setConv({ ...conv, mode: m })}
          selectedId={conv.selectedId}
          onSelect={(id) => setConv({ ...conv, selectedId: id })}
          options={conventions.map((c) => ({
            id: c.id,
            label: `${c.reference ?? "—"} — ${c.intitule ?? ""}`,
          }))}
        >
          <Grid>
            <Field label="Référence *">
              <Input
                value={conv.create.reference}
                onChange={(e) =>
                  setConv({ ...conv, create: { ...conv.create, reference: e.target.value } })
                }
              />
            </Field>
            <Field label="Intitulé *">
              <Input
                value={conv.create.intitule}
                onChange={(e) =>
                  setConv({ ...conv, create: { ...conv.create, intitule: e.target.value } })
                }
              />
            </Field>
            <Field label="Date de signature">
              <Input
                type="date"
                value={conv.create.dateSignature}
                onChange={(e) =>
                  setConv({ ...conv, create: { ...conv.create, dateSignature: e.target.value } })
                }
              />
            </Field>
          </Grid>
        </RefBlock>

        {/* Marché */}
        <RefBlock
          title="4. Marché"
          mode={marche.mode}
          onModeChange={(m) => setMarche({ ...marche, mode: m })}
          selectedId={marche.selectedId}
          onSelect={(id) => setMarche({ ...marche, selectedId: id })}
          options={marches.map((m) => ({
            id: m.id,
            label: `${m.numeroMarche ?? "—"} — ${m.intitule ?? ""}`,
          }))}
        >
          <Grid>
            <Field label="Numéro marché *">
              <Input
                value={marche.create.numeroMarche}
                onChange={(e) =>
                  setMarche({
                    ...marche,
                    create: { ...marche.create, numeroMarche: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Intitulé *">
              <Input
                value={marche.create.intitule}
                onChange={(e) =>
                  setMarche({ ...marche, create: { ...marche.create, intitule: e.target.value } })
                }
              />
            </Field>
            <Field label="Date de signature *">
              <Input
                type="date"
                value={marche.create.dateSignature}
                onChange={(e) =>
                  setMarche({
                    ...marche,
                    create: { ...marche.create, dateSignature: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Montant contrat HT">
              <Input
                type="number"
                value={marche.create.montantContratHt}
                onChange={(e) =>
                  setMarche({
                    ...marche,
                    create: { ...marche.create, montantContratHt: e.target.value },
                  })
                }
              />
            </Field>
          </Grid>
        </RefBlock>

        {/* Demande de correction */}
        <Card>
          <CardHeader>
            <CardTitle>5. Demande de correction (méta)</CardTitle>
            <CardDescription>Optionnel — généré automatiquement si laissé vide.</CardDescription>
          </CardHeader>
          <CardContent>
            <Grid>
              <Field label="Numéro demande correction">
                <Input
                  value={numeroDemandeCorrection}
                  onChange={(e) => setNumeroDemandeCorrection(e.target.value)}
                  placeholder="DC-LEG-2024-001"
                />
              </Field>
              <Field label="Date de dépôt">
                <Input
                  type="date"
                  value={dateDepot}
                  onChange={(e) => setDateDepot(e.target.value)}
                />
              </Field>
            </Grid>
          </CardContent>
        </Card>

        {/* Certificat */}
        <Card>
          <CardHeader>
            <CardTitle>6. Certificat</CardTitle>
            <CardDescription>
              Récapitulatif fiscal (a–g). Les champs <strong>e</strong> et <strong>h</strong> sont
              calculés automatiquement si laissés vides.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Grid>
              <Field label="Numéro certificat *">
                <Input
                  value={cert.numeroCertificat}
                  onChange={(e) => setCert({ ...cert, numeroCertificat: e.target.value })}
                />
              </Field>
              <Field label="Date de validité *">
                <Input
                  type="date"
                  value={cert.dateValidite}
                  onChange={(e) => setCert({ ...cert, dateValidite: e.target.value })}
                />
              </Field>
              <Field label="Date d'émission">
                <Input
                  type="date"
                  value={cert.dateEmission}
                  onChange={(e) => setCert({ ...cert, dateEmission: e.target.value })}
                />
              </Field>
            </Grid>
            <Separator />
            <Grid>
              <Field label="(a) Valeur en douane fournitures">
                <Input
                  type="number"
                  value={cert.valeurDouaneFournitures}
                  onChange={(e) => setCert({ ...cert, valeurDouaneFournitures: e.target.value })}
                />
              </Field>
              <Field label="(b) Droits et taxes douane hors TVA">
                <Input
                  type="number"
                  value={cert.droitsEtTaxesDouaneHorsTva}
                  onChange={(e) => setCert({ ...cert, droitsEtTaxesDouaneHorsTva: e.target.value })}
                />
              </Field>
              <Field label="(d) TVA importation douane accordée">
                <Input
                  type="number"
                  value={cert.tvaImportationDouaneAccordee}
                  onChange={(e) =>
                    setCert({ ...cert, tvaImportationDouaneAccordee: e.target.value })
                  }
                />
              </Field>
              <Field label="(f) Montant marché HT">
                <Input
                  type="number"
                  value={cert.montantMarcheHt}
                  onChange={(e) => setCert({ ...cert, montantMarcheHt: e.target.value })}
                />
              </Field>
              <Field label="(g) TVA collectée travaux">
                <Input
                  type="number"
                  value={cert.tvaCollecteeTravaux}
                  onChange={(e) => setCert({ ...cert, tvaCollecteeTravaux: e.target.value })}
                />
              </Field>
            </Grid>

            <div className="rounded-md border bg-muted/40 p-3 text-sm grid gap-2 sm:grid-cols-3">
              <div>
                Crédit extérieur (e = b + d) : <strong>{fmt(computedE)}</strong>
              </div>
              <div>
                Crédit intérieur (h = g − d) :{" "}
                <strong className={computedH !== undefined && computedH < 0 ? "text-destructive" : ""}>
                  {fmt(computedH)}
                </strong>
              </div>
              <div>
                Total (e + h) : <strong>{fmt(total)}</strong>
              </div>
            </div>

            <Separator />
            <div className="text-sm font-medium">Soldes partiels (optionnels)</div>
            <Grid>
              <Field label="Solde cordon">
                <Input
                  type="number"
                  placeholder={`Défaut: ${fmt(b)}`}
                  value={cert.soldeCordon}
                  onChange={(e) => setCert({ ...cert, soldeCordon: e.target.value })}
                />
              </Field>
              <Field label="Solde TVA">
                <Input
                  type="number"
                  placeholder={`Défaut: ${fmt(computedH)}`}
                  value={cert.soldeTVA}
                  onChange={(e) => setCert({ ...cert, soldeTVA: e.target.value })}
                />
              </Field>
              <Field label="TVA importation douane (restant)">
                <Input
                  type="number"
                  placeholder={`Défaut: ${fmt(d)}`}
                  value={cert.tvaImportationDouane}
                  onChange={(e) => setCert({ ...cert, tvaImportationDouane: e.target.value })}
                />
              </Field>
            </Grid>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button onClick={handleSubmit} disabled={submitting} size="lg">
            {submitting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            Injecter le certificat
          </Button>
        </div>

        {result && <ResultPanel result={result} />}
      </div>
    </DashboardLayout>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

interface RefBlockProps {
  title: string;
  mode: RefMode;
  onModeChange: (m: RefMode) => void;
  selectedId?: number;
  onSelect: (id: number) => void;
  options: { id: number; label: string }[];
  children: React.ReactNode;
}

const RefBlock = ({
  title,
  mode,
  onModeChange,
  selectedId,
  onSelect,
  options,
  children,
}: RefBlockProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as RefMode)}>
        <TabsList>
          <TabsTrigger value="select">Sélectionner existant</TabsTrigger>
          <TabsTrigger value="create">Créer inline</TabsTrigger>
        </TabsList>
        <TabsContent value="select" className="pt-4">
          <Select
            value={selectedId ? String(selectedId) : undefined}
            onValueChange={(v) => onSelect(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="— Choisir —" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TabsContent>
        <TabsContent value="create" className="pt-4">
          {children}
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
);

// ============================================================================
// Result + upload
// ============================================================================

const ResultPanel = ({ result }: { result: LegacyCertificatInjectionResult }) => {
  const [correctionDocs, setCorrectionDocs] = useState<DocumentRequirementDto[]>([]);
  const [certificatDocs, setCertificatDocs] = useState<DocumentRequirementDto[]>([]);

  useEffect(() => {
    Promise.allSettled([
      documentRequirementApi.getByProcessus("CORRECTION_OFFRE_FISCALE"),
      documentRequirementApi.getByProcessus("MISE_EN_PLACE_CI"),
    ]).then(([c, m]) => {
      if (c.status === "fulfilled") setCorrectionDocs(c.value);
      if (m.status === "fulfilled") setCertificatDocs(m.value);
    });
  }, []);

  return (
    <Card className="border-green-500/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          Injection réussie
        </CardTitle>
        <CardDescription>
          Certificat <strong>{result.certificatNumero}</strong> ({result.statutCertificat}) —
          Demande de correction <strong>{result.demandeCorrectionNumero}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <div>Cordon : <strong>{fmt(result.montantCordon)}</strong></div>
          <div>TVA intérieure : <strong>{fmt(result.montantTVAInterieure)}</strong></div>
          <div>Solde cordon : <strong>{fmt(result.soldeCordon)}</strong></div>
          <div>Solde TVA : <strong>{fmt(result.soldeTVA)}</strong></div>
        </div>

        <Separator />
        <h3 className="font-semibold">Upload de documents (optionnel)</h3>

        <UploadGroup
          title="Documents de correction"
          options={correctionDocs.map((d) => ({
            value: d.codeDocument ?? d.typeDocument ?? "",
            label: d.libelle ?? d.codeDocument ?? "",
          }))}
          onUpload={(code, file) =>
            legacyCertificatApi.uploadCorrectionDoc(result.demandeCorrectionId, code, file)
          }
        />
        <UploadGroup
          title="Documents convention"
          options={CONVENTION_DOCUMENT_TYPES.map((t) => ({ value: t, label: t }))}
          onUpload={(type, file) =>
            legacyCertificatApi.uploadConventionDoc(result.conventionId, type, file)
          }
        />
        <UploadGroup
          title="Documents marché"
          options={MARCHE_DOCUMENT_TYPES.map((t) => ({ value: t, label: t }))}
          onUpload={(type, file) =>
            legacyCertificatApi.uploadMarcheDoc(result.marcheId, type, file)
          }
        />
        <UploadGroup
          title="Documents certificat (mise en place)"
          options={certificatDocs.map((d) => ({
            value: d.codeDocument ?? d.typeDocument ?? "",
            label: d.libelle ?? d.codeDocument ?? "",
          }))}
          onUpload={(code, file) =>
            legacyCertificatApi.uploadCertificatDoc(result.certificatCreditId, code, file)
          }
        />

        <Separator />
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to={`/dashboard/certificats/${result.certificatCreditId}`}>
              Voir le certificat
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to={`/dashboard/demandes/${result.demandeCorrectionId}`}>Voir la demande</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const UploadGroup = ({
  title,
  options,
  onUpload,
}: {
  title: string;
  options: { value: string; label: string }[];
  onUpload: (code: string, file: File) => Promise<unknown>;
}) => {
  const [code, setCode] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!code) {
      toast.error("Sélectionner d'abord un type de document");
      return;
    }
    setBusy(true);
    try {
      await onUpload(code, file);
      toast.success("Document téléversé");
    } catch (err: any) {
      toast.error(formatApiErrorMessage(err, "Échec du téléversement"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={code} onValueChange={setCode}>
          <SelectTrigger className="sm:w-72">
            <SelectValue placeholder="Type / code document" />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">Aucun type disponible</div>
            ) : (
              options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer hover:bg-accent">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          <span>Téléverser…</span>
          <input
            type="file"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
};

export default InjectionCertificatLegacy;
