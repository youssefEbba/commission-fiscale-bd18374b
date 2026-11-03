import type { DemandeStatut } from "@/lib/api";
import { CheckCircle, XCircle, type LucideIcon } from "lucide-react";

export const DEMANDE_ALL_STATUTS_CIRCUIT: DemandeStatut[] = [
  "RECUE", "INCOMPLETE", "RECEVABLE", "EN_EVALUATION", "EN_VALIDATION",
];

export type DemandeTransition = {
  from: DemandeStatut[];
  to: DemandeStatut;
  labelKey: string;
  icon: LucideIcon;
  isVisa?: boolean;
  isDecisionFinale?: boolean;
};

const ALL = DEMANDE_ALL_STATUTS_CIRCUIT;

export const DEMANDE_ROLE_TRANSITIONS: Record<string, DemandeTransition[]> = {
  DGD: [
    { from: ALL, to: "ADOPTEE", labelKey: "transitions.DGD.visa", icon: CheckCircle, isVisa: true },
    { from: ALL, to: "REJETEE", labelKey: "transitions.reject", icon: XCircle },
  ],
  DGTCP: [
    { from: ALL, to: "ADOPTEE", labelKey: "transitions.DGTCP.visa", icon: CheckCircle, isVisa: true },
    { from: ALL, to: "REJETEE", labelKey: "transitions.reject", icon: XCircle },
  ],
  DGI: [
    { from: ALL, to: "ADOPTEE", labelKey: "transitions.DGI.visa", icon: CheckCircle, isVisa: true },
    { from: ALL, to: "REJETEE", labelKey: "transitions.reject", icon: XCircle },
  ],
  DGB: [
    { from: ALL, to: "ADOPTEE", labelKey: "transitions.DGB.visa", icon: CheckCircle, isVisa: true },
    { from: ALL, to: "REJETEE", labelKey: "transitions.reject", icon: XCircle },
  ],
  PRESIDENT: [
    { from: ALL, to: "ADOPTEE", labelKey: "transitions.PRESIDENT.adopt", icon: CheckCircle, isDecisionFinale: true },
    { from: ALL, to: "REJETEE", labelKey: "transitions.PRESIDENT.reject", icon: XCircle, isDecisionFinale: true },
  ],
};
