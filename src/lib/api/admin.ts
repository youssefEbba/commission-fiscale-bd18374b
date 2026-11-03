import { apiFetch } from "./client";
import type { DemandeCorrectionDto, DocumentDto } from "./demandes";
import type { CertificatCreditDto } from "./marches";
import type {
  AdminCorrectionCertificatPayload,
  AdminCorrectionDemandePayload,
  AdminCorrectionUtilisationPayload,
  UtilisationCreditDto,
} from "./utilisations";
export const adminCorrectionApi = {
  /** Patch partiel d'une demande de correction — tout statut. */
  patchDemande: (id: number, motif: string, data: AdminCorrectionDemandePayload) =>
    apiFetch<DemandeCorrectionDto>(
      `/demandes-correction/${id}/admin-correction?motif=${encodeURIComponent(motif)}`,
      { method: "PATCH", body: data },
    ),
  replaceDemandeDocument: (id: number, codeDocument: string, motif: string, file: File) =>
    adminCorrectionDoc<DocumentDto>("/demandes-correction", id, codeDocument, motif, file),

  /**
   * Patch partiel d'un certificat de crédit — tout statut.
   * 409 si des utilisations existent et que montantCordon / montantTVAInterieure changent.
   */
  patchCertificat: (id: number, motif: string, data: AdminCorrectionCertificatPayload) =>
    apiFetch<CertificatCreditDto>(
      `/certificats-credit/${id}/admin-correction?motif=${encodeURIComponent(motif)}`,
      { method: "PATCH", body: data },
    ),
  replaceCertificatDocument: (id: number, codeDocument: string, motif: string, file: File) =>
    adminCorrectionDoc<DocumentDto>("/certificats-credit", id, codeDocument, motif, file),

  /** Patch partiel d'une demande d'utilisation — tout statut. */
  patchUtilisation: (id: number, motif: string, data: AdminCorrectionUtilisationPayload) =>
    apiFetch<UtilisationCreditDto>(
      `/utilisations-credit/${id}/admin-correction?motif=${encodeURIComponent(motif)}`,
      { method: "PATCH", body: data },
    ),
  replaceUtilisationDocument: (id: number, codeDocument: string, motif: string, file: File) =>
    adminCorrectionDoc<DocumentDto>("/utilisations-credit", id, codeDocument, motif, file),
};

// Audit Logs (P8 / Admin)
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "ADMIN_CORRECTION";

export interface AuditLogDto {
  id: number;
  username: string;
  action: AuditAction | string;
  entityType: string;
  entityId?: number;
  details?: string;
  /** Motif saisi (substitutions administrateur notamment). */
  motif?: string | null;
  /** Date et heure de l'action. */
  timestamp?: string;
  /** @deprecated ancien nom de la date — repli si `timestamp` est absent. */
  dateAction?: string;
  /** Référence lisible du dossier (DC-…, CR-…, UT-…, AV-…). */
  entityReference?: string | null;
  /** Instantané de l'objet au moment de l'action (objet ou texte JSON). */
  objectSnapshot?: unknown;
}


export interface PageAuditLogDto {
  content: AuditLogDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

