import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShieldAlert, FileWarning, CheckCircle2, RefreshCw, FileUp, Wand2 } from "lucide-react";
import {
  adminProvisionApi,
  AdminProvisionEligibleDemandeDto,
  AdminProvisionDemandeResponse,
  AdminProvisionCertificatResponse,
  autoriteContractanteApi,
  entrepriseApi,
  conventionApi,
  marcheApi,
  AutoriteContractanteDto,
  EntrepriseDto,
  ConventionDto,
  MarcheDto,
} from "@/lib/api";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/searchable-select";
import { showApiError, showSuccess } from "@/lib/feedback";
import { usePageTitle } from "@/hooks/usePageTitle";

type RefMode = "create" | "id";

interface RefState {
  mode: RefMode;
  id?: number | "";
  fields: Record<string, string>;
}

const DEFAULT_AC: RefState = {
  mode: "create",
  fields: { code: "AC-INJ-001", nom: "Ministère exemple" },
};
const DEFAULT_ENT: RefState = {
  mode: "create",
  fields: { nif: "NIF-INJ-001", raisonSociale: "Entreprise exemple SARL", situationFiscale: "REGULIERE" },
};
const DEFAULT_CONV: RefState = {
  mode: "create",
  fields: { reference: "CONV-INJ-001", intitule: "Convention financement route", projectReference: "" },
};
const DEFAULT_MARCHE: RefState = {
  mode: "create",
  fields: { numeroMarche: "MP-INJ-001", dateSignature: "2025-06-01", montantContratHt: "1000000", statut: "EN_COURS" },
};

const PROVISION_PERMISSION = "admin.certificat.provision";

const InjectionCertificats = () => {
  usePageTitle("Injection certificat");
  const { hasPermission, user } = useAuth();
  const isAdminSi = (user?.nativeRole ?? user?.role) === "ADMIN_SI";
  const canProvision = hasPermission(PROVISION_PERMISSION) || isAdminSi;

  // ---------- Étape 1 — state ----------
  const [ac, setAc] = useState<RefState>(DEFAULT_AC);
  const [ent, setEnt] = useState<RefState>(DEFAULT_ENT);
  const [conv, setConv] = useState<RefState>(DEFAULT_CONV);
  const [marche, setMarche] = useState<RefState>(DEFAULT_MARCHE);

  const [convContrat, setConvContrat] = useState<File | null>(null);
  const [marcheContrat, setMarcheContrat] = useState<File | null>(null);
  const [offreCorrigee, setOffreCorrigee] = useState<File | null>(null);
  const [creditInterieur, setCreditInterieur] = useState<File | null>(null);
  const [lettreAdoption, setLettreAdoption] = useState<File | null>(null);

  const [submittingStep1, setSubmittingStep1] = useState(false);
  const [step1Result, setStep1Result] = useState<AdminProvisionDemandeResponse | null>(null);

  // ---------- Listes pour sélection d'entités existantes ----------
  const [acList, setAcList] = useState<AutoriteContractanteDto[]>([]);
  const [entList, setEntList] = useState<EntrepriseDto[]>([]);
  const [convList, setConvList] = useState<ConventionDto[]>([]);
  const [marcheList, setMarcheList] = useState<MarcheDto[]>([]);
  const [loadingLists, setLoadingLists] = useState<Record<string, boolean>>({});

  const loadList = async <T,>(key: string, fn: () => Promise<T[]>, setter: (v: T[]) => void) => {
    setLoadingLists((s) => ({ ...s, [key]: true }));
    try {
      const data = await fn();
      setter(Array.isArray(data) ? data : []);
    } catch (err) {
      showApiError(err, `Impossible de charger la liste (${key})`);
    } finally {
      setLoadingLists((s) => ({ ...s, [key]: false }));
    }
  };


  // ---------- Étape 2 — state ----------
  const [eligibles, setEligibles] = useState<AdminProvisionEligibleDemandeDto[]>([]);
  const [loadingEligibles, setLoadingEligibles] = useState(false);
  const [selectedDemandeId, setSelectedDemandeId] = useState<number | "">("");
  const [step2Form, setStep2Form] = useState({
    montantCordon: "4000000",
    montantTVAInterieure: "2000000",
    valeurDouaneFournitures: "5000000",
    droitsEtTaxesDouaneHorsTva: "3000000",
    tvaImportationDouane: "1000000",
    montantMarcheHt: "8000000",
    tvaCollecteeTravaux: "3000000",
  });
  const [submittingStep2, setSubmittingStep2] = useState(false);
  const [step2Result, setStep2Result] = useState<AdminProvisionCertificatResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"step1" | "step2">("step1");

  // ---------- Helpers ----------
  const setRefField = (
    setter: (s: RefState) => void,
    current: RefState,
    key: string,
    value: string,
  ) => setter({ ...current, fields: { ...current.fields, [key]: value } });

  const buildRefPayload = (ref: RefState, allowedKeys: string[], numericKeys: string[] = []) => {
    if (ref.mode === "id") {
      return ref.id ? { id: Number(ref.id) } : null;
    }
    const out: Record<string, unknown> = {};
    allowedKeys.forEach((k) => {
      const v = ref.fields[k];
      if (v !== undefined && v !== "") {
        out[k] = numericKeys.includes(k) ? Number(v) : v;
      }
    });
    return { create: out };
  };

  const fetchEligibles = async () => {
    setLoadingEligibles(true);
    try {
      const list = await adminProvisionApi.listEligibles();
      setEligibles(list);
    } catch (err) {
      showApiError(err, "Impossible de charger les demandes éligibles");
    } finally {
      setLoadingEligibles(false);
    }
  };

  useEffect(() => {
    if (canProvision && activeTab === "step2") fetchEligibles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canProvision, activeTab]);

  // ---------- Submit étape 1 ----------
  const submitStep1 = async () => {
    // Validation minimale
    if (!offreCorrigee || !creditInterieur || !lettreAdoption) {
      showApiError(
        new Error("Les 3 documents de correction sont obligatoires (OFFRE_FISCALE_CORRIGEE, CREDIT_INTERIEUR, LETTRE_ADOPTION)."),
        "Documents manquants",
      );
      return;
    }
    const acPayload = buildRefPayload(ac, ["code", "nom"]);
    const entPayload = buildRefPayload(ent, ["nif", "raisonSociale", "situationFiscale"]);
    const convPayloadBase = buildRefPayload(conv, ["reference", "intitule", "projectReference"]);
    const marchePayloadBase = buildRefPayload(marche, ["numeroMarche", "dateSignature", "statut", "montantContratHt"], ["montantContratHt"]);

    if (!acPayload || !entPayload || !convPayloadBase || !marchePayloadBase) {
      showApiError(new Error("Renseigner un id ou les champs de création pour chaque référentiel."), "Référentiels incomplets");
      return;
    }

    const files: Record<string, File> = {
      offreCorrigee,
      creditInterieur,
      lettreAdoption,
    };

    const convPayload: any = { ...convPayloadBase };
    if (conv.mode === "create" && convContrat) {
      convPayload.documents = [{ type: "CONVENTION_CONTRAT", fileKey: "convContrat" }];
      files.convContrat = convContrat;
    }
    const marchePayload: any = { ...marchePayloadBase };
    if (marche.mode === "create" && marcheContrat) {
      marchePayload.documents = [{ type: "CONTRAT_SIGNE", fileKey: "marcheContrat" }];
      files.marcheContrat = marcheContrat;
    }

    const payload = {
      autoriteContractante: acPayload,
      entreprise: entPayload,
      convention: convPayload,
      marche: marchePayload,
      modeleFiscal: {},
      dqe: {},
      documentsCorrection: [
        { codeDocument: "OFFRE_FISCALE_CORRIGEE", fileKey: "offreCorrigee" },
        { codeDocument: "CREDIT_INTERIEUR", fileKey: "creditInterieur" },
        { codeDocument: "LETTRE_ADOPTION", fileKey: "lettreAdoption" },
      ],
    };

    setSubmittingStep1(true);
    try {
      const res = await adminProvisionApi.createDemandeCorrection(payload, files);
      setStep1Result(res);
      setSelectedDemandeId(res.demandeCorrectionId);
      showSuccess("Demande de correction créée", `Statut : ${res.statut} — ${res.demandeNumero}`);
    } catch (err) {
      showApiError(err, "Échec de la création de la demande de correction");
    } finally {
      setSubmittingStep1(false);
    }
  };

  // ---------- Submit étape 2 ----------
  const submitStep2 = async () => {
    if (!selectedDemandeId) {
      showApiError(new Error("Sélectionner une demande éligible."), "Sélection manquante");
      return;
    }
    const body = {
      demandeCorrectionId: Number(selectedDemandeId),
      montantCordon: Number(step2Form.montantCordon || 0),
      montantTVAInterieure: Number(step2Form.montantTVAInterieure || 0),
      valeurDouaneFournitures: step2Form.valeurDouaneFournitures ? Number(step2Form.valeurDouaneFournitures) : undefined,
      droitsEtTaxesDouaneHorsTva: step2Form.droitsEtTaxesDouaneHorsTva ? Number(step2Form.droitsEtTaxesDouaneHorsTva) : undefined,
      tvaImportationDouane: step2Form.tvaImportationDouane ? Number(step2Form.tvaImportationDouane) : undefined,
      montantMarcheHt: step2Form.montantMarcheHt ? Number(step2Form.montantMarcheHt) : undefined,
      tvaCollecteeTravaux: step2Form.tvaCollecteeTravaux ? Number(step2Form.tvaCollecteeTravaux) : undefined,
    };
    setSubmittingStep2(true);
    try {
      const res = await adminProvisionApi.createCertificat(body);
      setStep2Result(res);
      showSuccess("Certificat ouvert", `${res.certificatNumero} — solde cordon ${res.soldeCordon} / solde TVA ${res.soldeTVA}`);
    } catch (err) {
      showApiError(err, "Échec de la création du certificat");
    } finally {
      setSubmittingStep2(false);
    }
  };

  // ---------- Cohérence indicative côté front ----------
  const coherence = useMemo(() => {
    const b = Number(step2Form.droitsEtTaxesDouaneHorsTva || 0);
    const d = Number(step2Form.tvaImportationDouane || 0);
    const g = Number(step2Form.tvaCollecteeTravaux || 0);
    const cordon = Number(step2Form.montantCordon || 0);
    const tva = Number(step2Form.montantTVAInterieure || 0);
    const hasBDG = b > 0 && d > 0 && g > 0;
    if (!hasBDG) return { hasBDG, cordonOk: cordon > 0, tvaOk: tva > 0 };
    return {
      hasBDG,
      cordonOk: Math.abs(cordon - (b + d)) <= 1,
      tvaOk: Math.abs(tva - (g - d)) <= 1,
      expectedCordon: b + d,
      expectedTva: g - d,
    };
  }, [step2Form]);

  if (!canProvision) {
    return (
      <DashboardLayout>
        <Alert variant="destructive" className="max-w-2xl">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Accès restreint</AlertTitle>
          <AlertDescription>
            Cette fonctionnalité requiert la permission <code>{PROVISION_PERMISSION}</code>.
            Contactez l'administrateur si vous pensez devoir y accéder.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const renderRefSection = (
    title: string,
    ref: RefState,
    setter: (s: RefState) => void,
    fields: { key: string; label: string; type?: string; placeholder?: string }[],
    lookup?: {
      listKey: string;
      options: SearchableSelectOption[];
      load: () => void;
    },
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">{title}</h4>
        <div className="flex gap-1 rounded-md border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setter({ ...ref, mode: "create" })}
            className={`px-2 py-1 rounded ${ref.mode === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >Créer</button>
          <button
            type="button"
            onClick={() => {
              setter({ ...ref, mode: "id" });
              if (lookup && lookup.options.length === 0) lookup.load();
            }}
            className={`px-2 py-1 rounded ${ref.mode === "id" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >Sélectionner existant</button>
        </div>
      </div>
      {ref.mode === "id" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Choisir dans la liste</Label>
            {lookup && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={lookup.load}
                disabled={loadingLists[lookup.listKey]}
              >
                {loadingLists[lookup.listKey] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </Button>
            )}
          </div>
          {lookup ? (
            <SearchableSelect
              options={lookup.options}
              value={ref.id ? String(ref.id) : ""}
              onValueChange={(v) => setter({ ...ref, id: v === "" ? "" : Number(v) })}
              placeholder={loadingLists[lookup.listKey] ? "Chargement…" : "Rechercher…"}
              searchPlaceholder="Filtrer…"
              emptyMessage={loadingLists[lookup.listKey] ? "Chargement…" : "Aucun élément."}
              clearable
            />
          ) : (
            <Input
              type="number"
              value={ref.id ?? ""}
              onChange={(e) => setter({ ...ref, id: e.target.value === "" ? "" : Number(e.target.value) })}
              placeholder="ex. 12"
            />
          )}
          {ref.id && <p className="text-[11px] text-muted-foreground">ID sélectionné : <strong>{ref.id}</strong></p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key}>
              <Label className="text-xs">{f.label}</Label>
              <Input
                type={f.type ?? "text"}
                value={ref.fields[f.key] ?? ""}
                onChange={(e) => setRefField(setter, ref, f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );


  const fileField = (label: string, file: File | null, setFile: (f: File | null) => void, required?: boolean) => (
    <div>
      <Label className="text-xs flex items-center gap-1">
        <FileUp className="h-3 w-3" /> {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {file && <p className="text-[11px] text-muted-foreground mt-1 truncate">{file.name}</p>}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" /> Injection certificat
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Solution provisoire — automatise le parcours métier complet (correction → visas → mise en place → certificat OUVERT) pour injecter des certificats existants hors circuit normal.
          </p>
        </div>

        <Alert>
          <FileWarning className="h-4 w-4" />
          <AlertTitle>Avertissement — outil d'administration</AlertTitle>
          <AlertDescription>
            Réservé aux comptes <strong>ADMIN_SI</strong> disposant de la permission <code>admin.certificat.provision</code>.
            Les actions sont tracées dans le journal d'audit. À utiliser uniquement durant les fenêtres d'injection contrôlées.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "step1" | "step2")}>
          <TabsList>
            <TabsTrigger value="step1">Étape 1 — Correction (ADOPTEE)</TabsTrigger>
            <TabsTrigger value="step2">Étape 2 — Certificat (OUVERT)</TabsTrigger>
          </TabsList>

          {/* ÉTAPE 1 */}
          <TabsContent value="step1" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Référentiels</CardTitle>
                <CardDescription>Créer ou réutiliser AC, entreprise, convention et marché.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderRefSection("Autorité Contractante", ac, setAc, [
                  { key: "code", label: "Code" },
                  { key: "nom", label: "Nom" },
                ], {
                  listKey: "ac",
                  options: acList
                    .filter((a) => a.id != null)
                    .map((a) => ({
                      value: String(a.id),
                      label: a.nom,
                      description: `ID ${a.id}${a.sigle ? ` · ${a.sigle}` : ""}`,
                      keywords: `${a.sigle ?? ""} ${a.id}`,
                    })),
                  load: () => loadList("ac", () => autoriteContractanteApi.getAll(), setAcList),
                })}
                <Separator />
                {renderRefSection("Entreprise", ent, setEnt, [
                  { key: "nif", label: "NIF" },
                  { key: "raisonSociale", label: "Raison sociale" },
                  { key: "situationFiscale", label: "Situation fiscale", placeholder: "REGULIERE" },
                ], {
                  listKey: "ent",
                  options: entList
                    .filter((e) => e.id != null)
                    .map((e) => ({
                      value: String(e.id),
                      label: e.raisonSociale,
                      description: `ID ${e.id} · NIF ${e.nif}`,
                      keywords: `${e.nif} ${e.id}`,
                    })),
                  load: () => loadList("ent", () => entrepriseApi.getAll(), setEntList),
                })}
                <Separator />
                {renderRefSection("Convention", conv, setConv, [
                  { key: "reference", label: "Référence" },
                  { key: "intitule", label: "Intitulé" },
                  { key: "projectReference", label: "Référence projet (optionnel)" },
                ], {
                  listKey: "conv",
                  options: convList.map((c) => ({
                    value: String(c.id),
                    label: c.intitule || c.reference || `Convention #${c.id}`,
                    description: `ID ${c.id}${c.reference ? ` · ${c.reference}` : ""}${c.autoriteContractanteNom ? ` · ${c.autoriteContractanteNom}` : ""}`,
                    keywords: `${c.reference ?? ""} ${c.projectReference ?? ""}`,
                  })),
                  load: () => loadList("conv", () => conventionApi.getAll(), setConvList),
                })}
                {conv.mode === "create" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fileField("Contrat convention (PDF)", convContrat, setConvContrat)}
                  </div>
                )}
                <Separator />
                {renderRefSection("Marché", marche, setMarche, [
                  { key: "numeroMarche", label: "Numéro marché" },
                  { key: "dateSignature", label: "Date signature", type: "date" },
                  { key: "montantContratHt", label: "Montant HT", type: "number" },
                  { key: "statut", label: "Statut", placeholder: "EN_COURS" },
                ], {
                  listKey: "marche",
                  options: marcheList.map((m) => ({
                    value: String(m.id),
                    label: m.numeroMarche || m.intitule || `Marché #${m.id}`,
                    description: `ID ${m.id}${m.intitule ? ` · ${m.intitule}` : ""} · ${m.statut}`,
                    keywords: `${m.intitule ?? ""}`,
                  })),
                  load: () => loadList("marche", () => marcheApi.getAll(), setMarcheList),
                })}
                {marche.mode === "create" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fileField("Contrat signé (PDF)", marcheContrat, setMarcheContrat)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documents de correction (obligatoires)</CardTitle>
                <CardDescription>3 PDF requis — joués par AC, DGI puis Président dans le simulateur backend.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {fileField("OFFRE_FISCALE_CORRIGEE (AC)", offreCorrigee, setOffreCorrigee, true)}
                {fileField("CREDIT_INTERIEUR (DGI)", creditInterieur, setCreditInterieur, true)}
                {fileField("LETTRE_ADOPTION (Président)", lettreAdoption, setLettreAdoption, true)}
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-2">
              <Button onClick={submitStep1} disabled={submittingStep1}>
                {submittingStep1 ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
                Créer la demande (ADOPTEE)
              </Button>
            </div>

            {step1Result && (
              <Card className="border-green-300 bg-green-50/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-700" /> Demande créée — {step1Result.demandeNumero}
                  </CardTitle>
                  <CardDescription>
                    Statut <Badge variant="secondary">{step1Result.statut}</Badge> — ID {step1Result.demandeCorrectionId}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>AC : <strong>{step1Result.autoriteContractanteId}</strong></div>
                    <div>Entreprise : <strong>{step1Result.entrepriseId}</strong></div>
                    <div>Convention : <strong>{step1Result.conventionId}</strong></div>
                    <div>Marché : <strong>{step1Result.marcheId}</strong></div>
                  </div>
                  <Separator className="my-2" />
                  <p className="font-medium">Étapes jouées :</p>
                  <ul className="space-y-1">
                    {step1Result.steps.map((s, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Badge variant="outline">{s.step}</Badge>
                        {s.actorRole && <span className="text-muted-foreground">[{s.actorRole}]</span>}
                        <span className="text-muted-foreground">{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setActiveTab("step2")}>
                    Continuer vers l'étape 2 →
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ÉTAPE 2 */}
          <TabsContent value="step2" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Demande éligible</CardTitle>
                  <CardDescription>Statut ADOPTEE/NOTIFIEE, marché signé, sans certificat actif.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={fetchEligibles} disabled={loadingEligibles}>
                  {loadingEligibles ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                {loadingEligibles ? (
                  <div className="text-sm text-muted-foreground">Chargement…</div>
                ) : eligibles.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucune demande éligible.</div>
                ) : (
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={selectedDemandeId}
                    onChange={(e) => setSelectedDemandeId(e.target.value === "" ? "" : Number(e.target.value))}
                  >
                    <option value="">— Sélectionner —</option>
                    {eligibles.map((d) => (
                      <option key={d.demandeCorrectionId} value={d.demandeCorrectionId}>
                        {d.numero} · {d.entrepriseRaisonSociale} · marché {d.marcheNumero} ({d.statut})
                      </option>
                    ))}
                  </select>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Récapitulatif fiscal</CardTitle>
                <CardDescription>Montants en MRU. Tolérance backend ±1 sur les règles de cohérence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Montant cordon (extérieur)</Label>
                    <Input type="number" value={step2Form.montantCordon}
                      onChange={(e) => setStep2Form({ ...step2Form, montantCordon: e.target.value })} />
                  </div>
                  <div>
                    <Label>Montant TVA intérieure</Label>
                    <Input type="number" value={step2Form.montantTVAInterieure}
                      onChange={(e) => setStep2Form({ ...step2Form, montantTVAInterieure: e.target.value })} />
                  </div>
                </div>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground">Lignes détaillées (optionnelles — activent les contrôles b/d/g)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Valeur douane fournitures (a)</Label>
                    <Input type="number" value={step2Form.valeurDouaneFournitures}
                      onChange={(e) => setStep2Form({ ...step2Form, valeurDouaneFournitures: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Droits & taxes douane hors TVA (b)</Label>
                    <Input type="number" value={step2Form.droitsEtTaxesDouaneHorsTva}
                      onChange={(e) => setStep2Form({ ...step2Form, droitsEtTaxesDouaneHorsTva: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">TVA importation douane (d)</Label>
                    <Input type="number" value={step2Form.tvaImportationDouane}
                      onChange={(e) => setStep2Form({ ...step2Form, tvaImportationDouane: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Montant marché HT</Label>
                    <Input type="number" value={step2Form.montantMarcheHt}
                      onChange={(e) => setStep2Form({ ...step2Form, montantMarcheHt: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">TVA collectée travaux (g)</Label>
                    <Input type="number" value={step2Form.tvaCollecteeTravaux}
                      onChange={(e) => setStep2Form({ ...step2Form, tvaCollecteeTravaux: e.target.value })} />
                  </div>
                </div>

                {coherence.hasBDG && (
                  <Alert variant={coherence.cordonOk && coherence.tvaOk ? "default" : "destructive"}>
                    <AlertTitle>Cohérence (indicatif)</AlertTitle>
                    <AlertDescription className="text-xs space-y-1">
                      <div>Cordon ≈ b + d → attendu <strong>{coherence.expectedCordon}</strong> {coherence.cordonOk ? "✓" : "✗"}</div>
                      <div>TVA intérieure ≈ g − d → attendu <strong>{coherence.expectedTva}</strong> {coherence.tvaOk ? "✓" : "✗"}</div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-2">
              <Button onClick={submitStep2} disabled={submittingStep2 || !selectedDemandeId}>
                {submittingStep2 ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
                Créer le certificat (OUVERT)
              </Button>
            </div>

            {step2Result && (
              <Card className="border-green-300 bg-green-50/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-700" /> Certificat ouvert — {step2Result.certificatNumero}
                  </CardTitle>
                  <CardDescription>
                    Statut <Badge variant="secondary">{step2Result.statut}</Badge> — ID {step2Result.certificatCreditId}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>Cordon : <strong>{step2Result.montantCordon}</strong></div>
                    <div>TVA intérieure : <strong>{step2Result.montantTVAInterieure}</strong></div>
                    <div>Solde cordon : <strong>{step2Result.soldeCordon}</strong></div>
                    <div>Solde TVA : <strong>{step2Result.soldeTVA}</strong></div>
                  </div>
                  <Separator className="my-2" />
                  <p className="font-medium">Étapes jouées :</p>
                  <ul className="space-y-1">
                    {step2Result.steps.map((s, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Badge variant="outline">{s.step}</Badge>
                        {s.actorRole && <span className="text-muted-foreground">[{s.actorRole}]</span>}
                        <span className="text-muted-foreground">{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default InjectionCertificats;
