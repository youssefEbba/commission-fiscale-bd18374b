// Reçu de dépôt : émission après chaque soumission réussie, pour tous les processus de demande.
// Générer → proposer au téléchargement → téléverser en RECU_DEPOT (nouvelle version à chaque dépôt).
// Un échec n'annule jamais la soumission, déjà acquise côté serveur.
import { toast as sonnerToast } from "sonner";
import i18n from "@/i18n";
import {
  avenantApi,
  certificatCreditApi,
  demandeCorrectionApi,
  formatApiErrorMessage,
  sousTraitanceApi,
  transfertCreditApi,
  utilisationCreditApi,
  type AvenantDto,
  type CertificatCreditDto,
  type DemandeCorrectionDto,
  type DocumentDto,
  type SousTraitanceDto,
  type TransfertCreditDto,
  type UtilisationCreditDto,
} from "@/lib/api";
import { presentBlob, trackDocumentTask } from "@/lib/openDocument";
import type { SubmitOutcome } from "@/lib/submission";
import {
  generateRecuPdf,
  recuAvenant,
  recuCorrection,
  recuFileName,
  recuMiseEnPlace,
  recuSousTraitance,
  recuTransfert,
  recuUtilisation,
  type RecuAdapterOptions,
  type RecuModele,
} from "@/lib/recuDepotPdf";

export const RECU_DEPOT = "RECU_DEPOT";

export interface RecuCible {
  id: number;
  modele: RecuModele;
  getDocuments: () => Promise<DocumentDto[]>;
  upload: (file: File) => Promise<unknown>;
  libelles?: Record<string, string>;
}

type Opts = RecuAdapterOptions & { libelles?: Record<string, string> };

/** Une cible par processus : modèle du reçu, pièces du dossier, route de dépôt. */
export const recuCibles = {
  correction: (d: DemandeCorrectionDto, o: Opts = {}): RecuCible => ({
    id: d.id, modele: recuCorrection(d, o), libelles: o.libelles,
    getDocuments: () => demandeCorrectionApi.getDocuments(d.id).catch(() => d.documents || []),
    upload: (f) => demandeCorrectionApi.uploadDocument(d.id, RECU_DEPOT, f),
  }),
  miseEnPlace: (c: CertificatCreditDto, o: Opts = {}): RecuCible => ({
    id: c.id, modele: recuMiseEnPlace(c, o), libelles: o.libelles,
    getDocuments: () => certificatCreditApi.getDocuments(c.id),
    upload: (f) => certificatCreditApi.uploadDocument(c.id, RECU_DEPOT, f),
  }),
  utilisation: (u: UtilisationCreditDto, o: Opts = {}): RecuCible => ({
    id: u.id, modele: recuUtilisation(u, o), libelles: o.libelles,
    getDocuments: () => utilisationCreditApi.getDocuments(u.id),
    upload: (f) => utilisationCreditApi.uploadDocument(u.id, RECU_DEPOT, f),
  }),
  transfert: (tr: TransfertCreditDto, o: Opts = {}): RecuCible => ({
    id: tr.id, modele: recuTransfert(tr, o), libelles: o.libelles,
    getDocuments: () => transfertCreditApi.getDocuments(tr.id) as Promise<DocumentDto[]>,
    upload: (f) => transfertCreditApi.uploadDocument(tr.id, RECU_DEPOT, f),
  }),
  avenant: (a: AvenantDto, o: Opts = {}): RecuCible => ({
    id: a.id, modele: recuAvenant(a, o), libelles: o.libelles,
    getDocuments: () => avenantApi.getDocuments(a.id).then((l) => l.map((d) => ({ ...d, type: d.codeDocument } as DocumentDto))),
    upload: (f) => avenantApi.uploadDocument(a.id, RECU_DEPOT, f),
  }),
  sousTraitance: (s: SousTraitanceDto, o: Opts = {}): RecuCible => ({
    id: s.id, modele: recuSousTraitance(s, o), libelles: o.libelles,
    getDocuments: () => sousTraitanceApi.getDocuments(s.id) as Promise<DocumentDto[]>,
    upload: (f) => sousTraitanceApi.uploadDocument(s.id, RECU_DEPOT, f),
  }),
};

/** Dossier réellement soumis d'après `submitIfDraft` (DTO renvoyé par la soumission), sinon `null`. */
export function soumisDepuis<T extends { statut?: string | null }>(outcome: SubmitOutcome<T>): T | null {
  if (outcome.kind !== "submitted" && outcome.kind !== "already_sent") return null;
  return outcome.result && outcome.result.statut !== "BROUILLON" ? outcome.result : null;
}

const tr = (k: string, o?: Record<string, unknown>) => i18n.t(`demandes:recu.${k}`, o) as string;

/**
 * Génère le reçu, le propose au téléchargement puis le téléverse. Ne lève jamais :
 * renvoie `false` (avertissement affiché, bouton « Régénérer ») si une étape échoue.
 */
export async function emettreRecuDepot(cible: RecuCible): Promise<boolean> {
  const { modele } = cible;
  const name = recuFileName(modele);
  try {
    await trackDocumentTask(`recu-depot:${modele.processus}:${cible.id}:issue`, "generate", name, async () => {
      const documents = await cible.getDocuments().catch(() => [] as DocumentDto[]);
      const blob = await generateRecuPdf(modele, { documents, libelles: cible.libelles });
      // Téléchargé d'abord : le déposant garde son reçu même si l'enregistrement échoue.
      presentBlob(blob, name, "download");
      await cible.upload(new globalThis.File([blob], name, { type: "application/pdf" }));
    });
    sonnerToast.success(tr("toast_ok"));
    return true;
  } catch (e) {
    console.warn("Reçu de dépôt non enregistré :", e);
    sonnerToast.warning(tr("toast_fail_title"), {
      // Raison donnée par le serveur (ex. stockage des fichiers indisponible).
      description: [tr("toast_fail_body", { numero: modele.reference }), formatApiErrorMessage(e, "")].filter(Boolean).join(" — "),
      duration: 30000,
      action: { label: tr("regenerate"), onClick: () => { void emettreRecuDepot(cible); } },
    });
    return false;
  }
}

/** Versions du reçu, la plus récente en tête (une par dépôt ; l'ancienne reste dans l'historique). */
export function recuVersions<D extends { id: number; type?: string; codeDocument?: string; version?: number; actif?: boolean }>(docs: D[]): D[] {
  return docs
    .filter((d) => (d.codeDocument ?? d.type) === RECU_DEPOT)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0) || Number(b.actif !== false) - Number(a.actif !== false) || b.id - a.id);
}

/** Côté déposant d'un dossier (autorité contractante, entreprise, sous-traitant ; en relais, le rôle représenté). */
export const RECU_DEPOSANT_ROLES = ["AUTORITE_CONTRACTANTE", "AUTORITE_UPM", "AUTORITE_UEP", "ENTREPRISE", "SOUS_TRAITANT"] as const;

/** La carte « Reçu de dépôt » (et sa reconstitution) est offerte au déposant dès que le dossier est déposé. */
export const peutVoirRecu = (role: string | null | undefined, statut: string | null | undefined) =>
  !!role && (RECU_DEPOSANT_ROLES as readonly string[]).includes(role) && !!statut && statut !== "BROUILLON";
