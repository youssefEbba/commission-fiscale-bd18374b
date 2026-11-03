import { apiFetch, normalizeDocs } from "./client";
import type { DocumentDto } from "./demandes";
export interface EntrepriseDto {
  id?: number;
  raisonSociale: string;
  nif: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  situationFiscale?: string;
  nomCommercial?: string;
  activite?: string;
  autre?: string;
  /** Entreprise étrangère : NIF facultatif, `registreCommerceEtranger` requis. */
  entrepriseEtrangere?: boolean;
  registreCommerceEtranger?: string;
  /** Lecture seule : NIF affichable. */
  nifAffiche?: string;
  /** Catégorie d'entreprise (indicateurs bénéficiaires). */
  categorie?: EntrepriseCategorie | null;
  secteurId?: number | null;
  /** Lecture seule : libellé du secteur d'activité. */
  secteurLibelle?: string | null;
}

export type EntrepriseCategorie = "PME" | "GRANDE_ENTREPRISE" | "NON_RENSEIGNEE";
export const ENTREPRISE_CATEGORIES: EntrepriseCategorie[] = ["PME", "GRANDE_ENTREPRISE", "NON_RENSEIGNEE"];

// Secteurs d'activité (référentiel) — lecture : tout compte connecté ; écriture : referentiel.secteur.manage.
export interface SecteurActiviteDto {
  id: number;
  code: string;
  libelle: string;
  libelleAr?: string | null;
  actif: boolean;
}
export interface SecteurActiviteRequest {
  code: string;
  libelle: string;
  libelleAr?: string | null;
  actif: boolean;
}
export const secteurActiviteApi = {
  getAll: (actifsSeulement = false) => apiFetch<SecteurActiviteDto[]>(`/secteurs-activite?actifsSeulement=${actifsSeulement}`),
  create: (data: SecteurActiviteRequest) => apiFetch<SecteurActiviteDto>("/secteurs-activite", { method: "POST", body: data }),
  update: (id: number, data: SecteurActiviteRequest) => apiFetch<SecteurActiviteDto>(`/secteurs-activite/${id}`, { method: "PUT", body: data }),
};

export const entrepriseApi = {
  getAll: () => apiFetch<EntrepriseDto[]>("/entreprises"),
  getById: (id: number) => apiFetch<EntrepriseDto>(`/entreprises/${id}`),
  create: (data: EntrepriseDto) => apiFetch<EntrepriseDto>("/entreprises", { method: "POST", body: data }),
  update: (id: number, data: EntrepriseDto) => apiFetch<EntrepriseDto>(`/entreprises/${id}`, { method: "PUT", body: data }),
  delete: (id: number) => apiFetch<void>(`/entreprises/${id}`, { method: "DELETE" }),
};

/** Réponse DGI pour un NIF (création d'entreprise en reprise d'archive). */
export interface VerificationNifDto {
  nif?: string;
  trouve: boolean;
  raisonSociale?: string;
  nomCommercial?: string;
  etat?: string;
  dateMiseAJour?: string;
}

export function verifierNifDgi(nif: string) {
  return apiFetch<VerificationNifDto>(`/entreprises/verification-dgi?nif=${encodeURIComponent(nif)}`);
}

// Groupements d'entreprises
export interface GroupementDto {
  id?: number;
  raisonSociale: string;
  nomCommercial?: string;
  adresse?: string;
  autre?: string;
  situationFiscale?: string;
  actif?: boolean;
  chefDeFileId: number;
  membreIds: number[];
  /** Lecture seule */
  chefDeFileRaisonSociale?: string;
  membres?: EntrepriseDto[];
  /** Lecture seule : NIF du chef de file. */
  nifAffiche?: string;
  dateCreation?: string;
  dateModification?: string;
}

export type GroupementWriteDto = Pick<GroupementDto,
  "raisonSociale" | "nomCommercial" | "adresse" | "autre" | "situationFiscale" | "actif" | "chefDeFileId" | "membreIds">;

export const groupementApi = {
  getAll: (actifs?: boolean) =>
    apiFetch<GroupementDto[]>(`/groupements${actifs ? "?actifs=true" : ""}`),
  getById: (id: number) => apiFetch<GroupementDto>(`/groupements/${id}`),
  create: (data: GroupementWriteDto) => apiFetch<GroupementDto>("/groupements", { method: "POST", body: data }),
  update: (id: number, data: GroupementWriteDto) => apiFetch<GroupementDto>(`/groupements/${id}`, { method: "PUT", body: data }),
  delete: (id: number) => apiFetch<void>(`/groupements/${id}`, { method: "DELETE" }),
};


// ── Rattachement (demande publique → validation du Président) ──
export type RattachementRole = "ENTREPRISE" | "AUTORITE_CONTRACTANTE" | "AUTORITE_UPM" | "AUTORITE_UEP";
export type TypeEntite = "ENTREPRISE" | "AUTORITE_CONTRACTANTE";
export type StatutRattachement = "EN_ATTENTE" | "APPROUVEE" | "REFUSEE";
export const RATTACHEMENT_ROLES: readonly RattachementRole[] = ["ENTREPRISE", "AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP"];
/** Le type d'entité se déduit de la qualité demandée. */
export const typeEntiteForRole = (r: RattachementRole): TypeEntite => (r === "ENTREPRISE" ? "ENTREPRISE" : "AUTORITE_CONTRACTANTE");

export interface EntitePubliqueDto { id: number; nom: string; }

export interface DemandeRattachementDto {
  id: number;
  reference?: string;
  statut: StatutRattachement;
  username?: string;
  nomComplet?: string;
  email?: string;
  telephone?: string;
  roleDemande?: RattachementRole;
  typeEntite?: TypeEntite;
  entiteId?: number | null;
  /** Nom de l'entité existante choisie, résolu par le serveur (champ réellement renvoyé). */
  entiteNomResolu?: string | null;
  /** Ancien nom supposé — conservé en repli uniquement. */
  entiteNomAffiche?: string | null;
  /** true = l'entité n'existe pas encore et sera créée telle que décrite à l'approbation. */
  entiteNouvelle?: boolean;
  entiteNom?: string | null;
  entiteSigle?: string | null;
  entiteNif?: string | null;
  entiteAdresse?: string | null;
  entiteActivite?: string | null;
  entiteMinistereTutelle?: string | null;
  motifRefus?: string | null;
  /** Date de dépôt renvoyée par le serveur. */
  dateCreation?: string;
  dateDemande?: string;
  dateDecision?: string | null;
  /** Champs de la réponse publique de suivi (volontairement pauvre : pas de nom ni de téléphone). */
  dateDepot?: string;
  dateTraitement?: string | null;
  traiteParUsername?: string | null;
  decideurNom?: string | null;
  documents?: DocumentDto[];
}

export interface CompteEntiteDto {
  id: number;
  username: string;
  nomComplet?: string;
  email?: string;
  role: string;
  actif: boolean;
}

export const rattachementPublicApi = {
  getPieces: () => apiFetch<DocumentRequirementDto[]>("/public/rattachement/pieces", { noAuth: true, skipAuthRedirect: true }),
  searchEntites: (type: TypeEntite, q: string) =>
    apiFetch<EntitePubliqueDto[]>(`/public/rattachement/entites?type=${type}&q=${encodeURIComponent(q)}`, { noAuth: true, skipAuthRedirect: true }),
  /** Champs texte + un champ fichier par code document (ex. `MANDAT_REPRESENTATION`). */
  submit: (fields: Record<string, string | undefined>, files: Record<string, File>) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => { if (v != null && v !== "") fd.append(k, v); });
    Object.entries(files).forEach(([code, f]) => fd.append(code, f));
    return apiFetch<DemandeRattachementDto>("/public/rattachement", { method: "POST", rawBody: fd, noAuth: true, skipAuthRedirect: true });
  },
  /** Suivi public d'une demande : référence (ex. RT-0002-10-2026) + e-mail du dépôt, les deux obligatoires. */
  suivi: (reference: string, email: string) =>
    apiFetch<DemandeRattachementDto>(
      `/public/rattachement/suivi?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`,
      { noAuth: true, skipAuthRedirect: true },
    ),
};

export const demandeRattachementApi = {
  getAll: (statut?: StatutRattachement) => apiFetch<DemandeRattachementDto[]>(`/demandes-rattachement${statut ? `?statut=${statut}` : ""}`),
  getById: (id: number) => apiFetch<DemandeRattachementDto>(`/demandes-rattachement/${id}`),
  approuver: (id: number) => apiFetch<DemandeRattachementDto>(`/demandes-rattachement/${id}/approuver`, { method: "POST" }),
  refuser: (id: number, motif: string) =>
    apiFetch<DemandeRattachementDto>(`/demandes-rattachement/${id}/refuser?motif=${encodeURIComponent(motif)}`, { method: "POST" }),
};

export const entiteComptesApi = {
  list: (type: TypeEntite, entiteId: number) => apiFetch<CompteEntiteDto[]>(`/entites/${type}/${entiteId}/comptes`),
  create: (type: TypeEntite, entiteId: number, p: { username: string; motDePasse: string; role: string; nomComplet?: string; email?: string }) => {
    const q = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, v); });
    return apiFetch<CompteEntiteDto>(`/entites/${type}/${entiteId}/comptes?${q.toString()}`, { method: "POST" });
  },
  setActif: (type: TypeEntite, entiteId: number, utilisateurId: number, actif: boolean) =>
    apiFetch<void>(`/entites/${type}/${entiteId}/comptes/${utilisateurId}/actif?actif=${actif}`, { method: "PATCH" }),
};

// Autorités Contractantes
export interface AutoriteContractanteDto { id?: number; nom: string; sigle?: string; adresse?: string; telephone?: string; email?: string; ministereTutelleNom?: string; ministereTutelleCode?: string; }

export const autoriteContractanteApi = {
  getAll: () => apiFetch<AutoriteContractanteDto[]>("/autorites-contractantes"),
  getById: (id: number) => apiFetch<AutoriteContractanteDto>(`/autorites-contractantes/${id}`),
  create: (data: AutoriteContractanteDto) => apiFetch<AutoriteContractanteDto>("/autorites-contractantes", { method: "POST", body: data }),
  update: (id: number, data: AutoriteContractanteDto) => apiFetch<AutoriteContractanteDto>(`/autorites-contractantes/${id}`, { method: "PUT", body: data }),
  delete: (id: number) => apiFetch<void>(`/autorites-contractantes/${id}`, { method: "DELETE" }),
};

// Référentiel Projet (P1)
export type ReferentielStatut = "EN_ATTENTE" | "VALIDE" | "REJETE" | "ANNULE";

export interface ReferentielProjetDto {
  id: number;
  numero?: string;
  reference?: string;
  intitule?: string;
  autoriteContractanteId?: number;
  autoriteContractanteNom?: string;
  bailleurFonds?: string;
  dateSignature?: string;
  dateDebut?: string;
  dateFinPrevue?: string;
  montantTotal?: number;
  deviseOrigine?: string;
  equivalentMRU?: number;
  tauxChange?: number;
  statut: ReferentielStatut;
  nomProjet?: string;
  administrateurProjet?: string;
  referenceBciSecteur?: string;
  dateCreation?: string;
  dateDepot?: string;
  dateMiseAJour?: string;
  description?: string;
  conventionId?: number;
  conventionReference?: string;
  conventionIntitule?: string;
  conventionBailleur?: string;
  conventionBailleurDetails?: string;
  conventionDateSignature?: string;
  conventionDateDebut?: string;
  conventionDateFin?: string;
  conventionMontantDevise?: number;
  conventionMontantMru?: number;
  conventionDeviseOrigine?: string;
  conventionTauxChange?: number;
  valideParUserId?: number;
  /** Nom de la personne qui a validé (affiché à la place de l'identifiant). */
  valideParNom?: string | null;
  dateValidation?: string;
  motifRejet?: string;
}

export interface CreateReferentielProjetRequest {
  autoriteContractanteId?: number | null;
  conventionId?: number;
  nomProjet?: string;
  administrateurProjet?: string;
  referenceBciSecteur?: string;
}

/**
 * Valeurs ordonnées de ReferentielStatut pour les filtres / dropdowns.
 * Libellés via `tStatutReferentiel(code)` (cf. `enums.statut_referentiel.*`).
 */
export const REFERENTIEL_STATUT_VALUES: readonly ReferentielStatut[] = [
  "EN_ATTENTE", "VALIDE", "REJETE", "ANNULE",
] as const;

export type TypeDocumentProjet =
  | "CONVENTION_CONTRAT"
  | "BAILLEUR_INFOS"
  | "DATES_CLES"
  | "AUTORITE_RESPONSABLE"
  | "MONTANT_TOTAL_DEVISE"
  | "MONTANT_MRU_TAUX_CHANGE";

export const REFERENTIEL_DOCUMENT_TYPES: { value: TypeDocumentProjet; label: string }[] = [
  { value: "CONVENTION_CONTRAT", label: "Convention / Contrat de financement" },
  { value: "BAILLEUR_INFOS", label: "Informations bailleur de fonds" },
  { value: "DATES_CLES", label: "Dates clés (signature, début, fin)" },
  { value: "AUTORITE_RESPONSABLE", label: "Autorité contractante responsable" },
  { value: "MONTANT_TOTAL_DEVISE", label: "Montant total et devise d'origine" },
  { value: "MONTANT_MRU_TAUX_CHANGE", label: "Équivalent MRU + taux de change" },
];

export const referentielProjetApi = {
  getAll: () => apiFetch<ReferentielProjetDto[]>("/referentiels-projet"),
  getById: (id: number) => apiFetch<ReferentielProjetDto>(`/referentiels-projet/${id}`),
  getByStatut: (statut: ReferentielStatut) => apiFetch<ReferentielProjetDto[]>(`/referentiels-projet/by-statut?statut=${statut}`),
  getByAutorite: (autoriteId: number) => apiFetch<ReferentielProjetDto[]>(`/referentiels-projet/by-autorite/${autoriteId}`),
  create: (data: CreateReferentielProjetRequest) => apiFetch<ReferentielProjetDto>("/referentiels-projet", { method: "POST", body: data }),
  updateStatut: (id: number, statut: "VALIDE" | "REJETE" | "ANNULE", motifRejet?: string) => apiFetch<ReferentielProjetDto>(`/referentiels-projet/${id}/statut?statut=${statut}${motifRejet ? `&motifRejet=${encodeURIComponent(motifRejet)}` : ""}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/referentiels-projet/${id}/documents`).then(normalizeDocs),
  uploadDocument: (id: number, type: TypeDocumentProjet, file: File) => {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/referentiels-projet/${id}/documents`, {
      method: "POST",
      rawBody: formData,
    });
  },
  deleteDocument: (projetId: number, docId: number) => apiFetch<void>(`/referentiels-projet/${projetId}/documents/${docId}`, { method: "DELETE" }),
  replaceDocument: (projetId: number, docId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/referentiels-projet/${projetId}/documents/${docId}`, {
      method: "PUT",
      rawBody: formData,
    });
  },
};

// Conventions
export type ConventionStatut = "EN_ATTENTE" | "VALIDE" | "REJETE" | "ANNULEE";

export interface ConventionDto {
  id: number;
  reference?: string;
  /** Référence projet (distincte de `reference`). */
  projectReference?: string;
  intitule?: string;
  /** ID du bailleur lié (relation @ManyToOne). */
  bailleurId?: number;
  /** Nom du bailleur lié (lecture seule, fourni par le back). */
  bailleurNom?: string;
  /** @deprecated remplacé par `bailleurId` + `bailleurNom`. Conservé pour compat ascendante. */
  bailleur?: string;
  bailleurDetails?: string;
  dateSignature?: string;
  dateDebut?: string;
  dateFin?: string;
  montantDevise?: number;
  deviseOrigine?: string;
  montantMru?: number;
  tauxChange?: number;
  statut: ConventionStatut;
  dateCreation?: string;
  autoriteContractanteId?: number;
  autoriteContractanteNom?: string;
  creeParAutoriteContractanteId?: number;
  creeParAutoriteContractanteNom?: string;
  valideParUserId?: number;
  /** Nom de la personne qui a validé (affiché à la place de l'identifiant). */
  valideParNom?: string | null;
  dateValidation?: string;
  motifRejet?: string;
  /** false = convention désactivée : plus de nouveau rattachement, invisible aux AC. */
  actif?: boolean;
  /** Toutes les autorités contractantes reliées, la principale (`autoriteContractanteId`) en tête. */
  autorites?: EntiteRefDto[];
  /** Tous les bailleurs, le principal (`bailleurId`) en tête. */
  bailleurs?: EntiteRefDto[];
}

/** Référence courte {id, nom} renvoyée dans les listes liées (autorités, bailleurs). */
export interface EntiteRefDto { id: number; nom: string; }

export interface CreateConventionRequest {
  reference?: string;
  projectReference?: string;
  intitule?: string;
  /** ID du bailleur (issu de GET /api/bailleurs). Le descriptif provient désormais du bailleur lui-même. */
  bailleurId?: number | null;
  /** Tous les bailleurs (facultatif) ; le premier devient le principal. */
  bailleurIds?: number[];
  dateSignature?: string;
  dateFin?: string;
  montantDevise?: number;
  deviseOrigine?: string;
  montantMru?: number;
  tauxChange?: number;
  statut?: ConventionStatut;
  autoriteContractanteId?: number;
}

/**
 * Corps de PUT /api/conventions/{id} — remplacement complet : un champ omis ou `null` est effacé.
 * Pas d'`autoriteContractanteId` : l'autorité titulaire ne se change pas.
 */
export interface UpdateConventionRequest {
  reference: string;
  intitule: string;
  bailleurId: number | null;
  /** Remplace la liste des bailleurs ; le premier devient le principal (= `bailleurId`). */
  bailleurIds?: number[];
  /** AAAA-MM-JJ */
  dateSignature: string | null;
  /** AAAA-MM-JJ */
  dateFin: string | null;
  montantDevise: number | null;
  montantMru: number | null;
  deviseOrigine: string | null;
  tauxChange: number | null;
  projectReference: string | null;
}

/**
 * Valeurs ordonnées de ConventionStatut pour les filtres / dropdowns.
 * Libellés via `tStatutConvention(code)` (cf. `enums.statut_convention.*`).
 */
export const CONVENTION_STATUT_VALUES: readonly ConventionStatut[] = [
  "EN_ATTENTE", "VALIDE", "REJETE", "ANNULEE",
] as const;

export type TypeDocumentConvention =
  | "CONVENTION_CONTRAT"
  | "AVENANT"
  | "ACCORD_FINANCEMENT"
  | "AUTRE";

/**
 * Codes des types de documents Convention.
 * Libellés résolus via `tTypeDocument(code)` côté UI (cf. `enums.type_document.*`).
 */
export const CONVENTION_DOCUMENT_TYPES: readonly TypeDocumentConvention[] = [
  "CONVENTION_CONTRAT", "AVENANT", "ACCORD_FINANCEMENT", "AUTRE",
] as const;


export const conventionApi = {
  /** Liste avec recherche optionnelle. `q` = recherche sur référence / intitulé / projectReference. */
  getAll: (q?: string) => apiFetch<ConventionDto[]>(`/conventions${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getById: (id: number) => apiFetch<ConventionDto>(`/conventions/${id}`),
  getByStatut: (statut: ConventionStatut) => apiFetch<ConventionDto[]>(`/conventions/by-statut?statut=${statut}`),
  create: (data: CreateConventionRequest) => apiFetch<ConventionDto>("/conventions", { method: "POST", body: data }),
  /** Remplacement complet (`convention.update`) : AC titulaire/créatrice en EN_ATTENTE, Président/administrateur à tout statut sauf ANNULEE. */
  update: (id: number, data: UpdateConventionRequest) => apiFetch<ConventionDto>(`/conventions/${id}`, { method: "PUT", body: data }),
  updateStatut: (id: number, statut: ConventionStatut | "ANNULEE", motifRejet?: string) => apiFetch<ConventionDto>(`/conventions/${id}/statut?statut=${statut}${motifRejet ? `&motifRejet=${encodeURIComponent(motifRejet)}` : ""}`, { method: "PATCH" }),
  /** Annulation par l'autorité titulaire ou créatrice (permission `convention.annuler`, convention EN_ATTENTE). Motif facultatif. */
  annuler: (id: number, motif?: string) => apiFetch<ConventionDto>(`/conventions/${id}/annuler${motif ? `?motif=${encodeURIComponent(motif)}` : ""}`, { method: "POST" }),
  /** Relie une autorité contractante (Président / administrateur, `convention.update`). */
  lierAutorite: (id: number, autoriteId: number) => apiFetch<ConventionDto | void>(`/conventions/${id}/autorites/${autoriteId}`, { method: "POST" }),
  /** Délie une autorité : 409 si elle a un marché ou une demande sous cette convention, 400 si c'est la dernière. */
  delierAutorite: (id: number, autoriteId: number) => apiFetch<ConventionDto | void>(`/conventions/${id}/autorites/${autoriteId}`, { method: "DELETE" }),
  /** Active/désactive une convention (permission `convention.activate`). */
  setActivation: (id: number, actif: boolean) => apiFetch<ConventionDto>(`/conventions/${id}/activation?actif=${actif}`, { method: "PATCH" }),
  getDocuments: (id: number) => apiFetch<DocumentDto[]>(`/conventions/${id}/documents`).then(normalizeDocs),
  deleteDocument: (conventionId: number, docId: number) => apiFetch<void>(`/conventions/${conventionId}/documents/${docId}`, { method: "DELETE" }),
  replaceDocument: (conventionId: number, docId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/conventions/${conventionId}/documents/${docId}`, {
      method: "PUT",
      rawBody: formData,
    });
  },
  uploadDocument: (id: number, type: TypeDocumentConvention, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<DocumentDto>(`/conventions/${id}/documents?type=${encodeURIComponent(type)}`, {
      method: "POST",
      rawBody: formData,
    });
  },
};

// Demandes de correction (P2)
