/** Couleurs de badge de statut — une seule table par processus. */

export const DEMANDE_STATUT_COLORS: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-700",
  RECUE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-yellow-100 text-yellow-800",
  RECEVABLE: "bg-emerald-100 text-emerald-800",
  EN_EVALUATION: "bg-orange-100 text-orange-800",
  EN_VALIDATION: "bg-purple-100 text-purple-800",
  ADOPTEE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
  NOTIFIEE: "bg-gray-100 text-gray-800",
  ANNULEE: "bg-red-200 text-red-900",
};

export const UTILISATION_STATUT_COLORS: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-700",
  DEMANDEE: "bg-blue-100 text-blue-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION: "bg-yellow-100 text-yellow-800",
  VISE: "bg-purple-100 text-purple-800",
  VALIDEE: "bg-emerald-100 text-emerald-800",
  LIQUIDEE: "bg-green-100 text-green-800",
  APUREE: "bg-green-100 text-green-800",
  REJETEE: "bg-red-100 text-red-800",
  CERTIFICAT_EMIS: "bg-primary/15 text-primary",
  CLOTUREE: "bg-slate-200 text-slate-800",
  EN_CONTROLE_DGD: "bg-purple-100 text-purple-800",
  CHEQUE_SAISI: "bg-indigo-100 text-indigo-800",
  TRANSMISE_AU_PRESIDENT: "bg-violet-100 text-violet-800",
  ENVOYEE_AU_TRESOR: "bg-sky-100 text-sky-800",
  QUITTANCES_ENREGISTREES: "bg-teal-100 text-teal-800",
  QUITTANCE_DGI_ENREGISTREE: "bg-teal-100 text-teal-800",
};

export const CERTIFICAT_STATUT_COLORS: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-700",
  ENVOYEE: "bg-sky-100 text-sky-800",
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_CONTROLE: "bg-teal-100 text-teal-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  EN_VERIFICATION_DGI: "bg-indigo-100 text-indigo-800",
  EN_VALIDATION_PRESIDENT: "bg-purple-100 text-purple-800",
  VALIDE_PRESIDENT: "bg-violet-100 text-violet-800",
  EN_OUVERTURE_DGTCP: "bg-yellow-100 text-yellow-800",
  OUVERT: "bg-emerald-100 text-emerald-800",
  MODIFIE: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
  REJETE: "bg-red-100 text-red-800",
};

export const CONVENTION_STATUT_COLORS: Record<string, string> = {
  EN_ATTENTE: "bg-orange-100 text-orange-800",
  VALIDE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
  ANNULEE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-gray-100 text-gray-800",
};

export const MARCHE_STATUT_COLORS: Record<string, string> = {
  EN_COURS: "bg-blue-100 text-blue-800",
  AVENANT: "bg-orange-100 text-orange-800",
  CLOTURE: "bg-gray-100 text-gray-800",
  ANNULE: "bg-red-100 text-red-800",
};

export const TRANSFERT_STATUT_COLORS: Record<string, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_COURS: "bg-yellow-100 text-yellow-800",
  VALIDE: "bg-emerald-100 text-emerald-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  A_RECONTROLER: "bg-cyan-100 text-cyan-800",
  TRANSFERE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
  ANNULEE: "bg-slate-200 text-slate-700",
};

export const SOUS_TRAITANCE_STATUT_COLORS: Record<string, string> = {
  DEMANDE: "bg-blue-100 text-blue-800",
  EN_COURS: "bg-yellow-100 text-yellow-800",
  AUTORISEE: "bg-green-100 text-green-800",
  REFUSEE: "bg-red-100 text-red-800",
};

export const AVENANT_STATUT_COLORS: Record<string, string> = {
  DEPOSE: "bg-blue-100 text-blue-800",
  EN_COURS_TRAITEMENT: "bg-yellow-100 text-yellow-800",
  ADOPTE: "bg-emerald-100 text-emerald-800",
  APPLIQUE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
};

export function statutColor(map: Record<string, string>, statut?: string | null): string {
  return (statut && map[statut]) || "bg-slate-100 text-slate-700";
}
