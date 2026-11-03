// Reprise d'un fichier de période : règles d'écran du lot (le serveur calcule les statuts et décide).
import {
  autoriteContractanteApi,
  conventionApi,
  entrepriseApi,
  getApiErrorBusinessCode,
  marcheApi,
  type ArchiveLotCreditDto,
  type ArchiveLotDto,
  type ArchiveLotSource,
  type AutoriteContractanteDto,
  type ConventionDto,
  type EntrepriseDto,
  type MarcheDto,
} from "./api";
import { cachedList, invalidateList } from "./listCache";

/** Taille d'un envoi à `/importer` (une transaction par crédit côté serveur). */
export const IMPORT_BATCH_SIZE = 10;

/** Écart de solde affiché (arrondi au centime). */
export const SOLDE_TOLERANCE = 0.005;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Rattachement proposé par le serveur (badge « proposé ») : tout sauf un choix manuel. */
export const isProposed = (source: ArchiveLotSource | null | undefined) => !!source && source !== "MANUEL";

export function soldeEcart(calcule: number | null | undefined, declare: number | null | undefined): boolean {
  if (calcule == null || declare == null) return false;
  return Math.abs(declare - calcule) > SOLDE_TOLERANCE;
}

/** DGI injoignable ou fonction coupée : message affiché, l'écran reste utilisable. */
export function isDgiUnavailable(err: unknown): boolean {
  const code = getApiErrorBusinessCode(err);
  return code === "DGI_SERVICE_UNAVAILABLE" || code === "FEATURE_DISABLED";
}

export interface NifInconnu {
  nif: string;
  nbCredits: number;
  raisonSocialeDgi: string | null;
  nomCommercialDgi: string | null;
  etatDgi: string | null;
  inconnuDgi: boolean;
}

/** Un NIF par ligne parmi les crédits non importés sans entreprise, dans l'ordre du fichier. */
export function nifsInconnus(credits: ArchiveLotCreditDto[]): NifInconnu[] {
  const byNif = new Map<string, NifInconnu>();
  for (const c of [...credits].sort((a, b) => a.ordre - b.ordre)) {
    const nif = c.nif?.trim();
    if (!nif || c.entrepriseId != null || c.statut === "IMPORTE") continue;
    const cur = byNif.get(nif);
    if (cur) {
      cur.nbCredits += 1;
      cur.raisonSocialeDgi ??= c.raisonSocialeDgi;
      cur.nomCommercialDgi ??= c.nomCommercialDgi;
      cur.etatDgi ??= c.etatDgi;
      cur.inconnuDgi ||= c.inconnuDgi;
    } else {
      byNif.set(nif, {
        nif,
        nbCredits: 1,
        raisonSocialeDgi: c.raisonSocialeDgi,
        nomCommercialDgi: c.nomCommercialDgi,
        etatDgi: c.etatDgi,
        inconnuDgi: c.inconnuDgi,
      });
    }
  }
  return [...byNif.values()];
}

/** Crédits qu'une action groupée peut viser (un crédit importé n'est plus modifiable). */
export const isSelectable = (c: ArchiveLotCreditDto) => c.statut !== "IMPORTE";

/** Identifiants PRET, dans l'ordre du fichier. */
export const pretIds = (credits: ArchiveLotCreditDto[]) =>
  [...credits].sort((a, b) => a.ordre - b.ordre).filter((c) => c.statut === "PRET").map((c) => c.id);

/** Valeur commune d'un champ sur la sélection, ou `null` si elle diffère (sert à filtrer les listes). */
export function commonValue<K extends keyof ArchiveLotCreditDto>(credits: ArchiveLotCreditDto[], key: K): ArchiveLotCreditDto[K] | null {
  if (!credits.length) return null;
  const first = credits[0][key];
  return credits.every((c) => c[key] === first) ? first : null;
}

/** Remplace dans le lot les crédits renvoyés par l'import (les compteurs sont relus ensuite). */
export function mergeCredits(lot: ArchiveLotDto, updated: ArchiveLotCreditDto[]): ArchiveLotDto {
  if (!lot.credits || !updated.length) return lot;
  const byId = new Map(updated.map((c) => [c.id, c]));
  return { ...lot, credits: lot.credits.map((c) => byId.get(c.id) ?? c) };
}

// ---- Listes de référence (règle listCache : compte + entité représentée dans la clé) ----

interface CacheUser {
  userId?: number;
  actingEntrepriseId?: number;
  actingAutoriteContractanteId?: number;
}

export type ArchiveRefList = "entreprises" | "autorites" | "conventions" | "marches";

export const archiveRefKey = (list: ArchiveRefList, user?: CacheUser | null) =>
  `archive:${list}:${user?.userId ?? "anon"}:${user?.actingEntrepriseId ?? ""}:${user?.actingAutoriteContractanteId ?? ""}`;

const asArray = <T,>(v: T[] | unknown): T[] => (Array.isArray(v) ? v : []);

export const loadArchiveEntreprises = (user?: CacheUser | null) =>
  cachedList(archiveRefKey("entreprises", user), () => entrepriseApi.getAll().then((v) => asArray<EntrepriseDto>(v)));
export const loadArchiveAutorites = (user?: CacheUser | null) =>
  cachedList(archiveRefKey("autorites", user), () => autoriteContractanteApi.getAll().then((v) => asArray<AutoriteContractanteDto>(v)));
export const loadArchiveConventions = (user?: CacheUser | null) =>
  cachedList(archiveRefKey("conventions", user), () => conventionApi.getAll().then((v) => asArray<ConventionDto>(v)));
export const loadArchiveMarches = (user?: CacheUser | null) =>
  cachedList(archiveRefKey("marches", user), () => marcheApi.getAll().then((v) => asArray<MarcheDto>(v)));

export const invalidateArchiveRef = (list: ArchiveRefList, user?: CacheUser | null) => invalidateList(archiveRefKey(list, user));
