import { Badge } from "@/components/ui/badge";
import type { StatutAvenant } from "@/lib/api";
import { tStatutAvenant } from "@/i18n/enums";

const STATUT_COLORS: Record<StatutAvenant, string> = {
  DEPOSE: "bg-blue-100 text-blue-800",
  EN_COURS_TRAITEMENT: "bg-yellow-100 text-yellow-800",
  ADOPTE: "bg-emerald-100 text-emerald-800",
  APPLIQUE: "bg-green-100 text-green-800",
  REJETE: "bg-red-100 text-red-800",
};

export default function AvenantStatutBadge({ statut, className = "" }: { statut: StatutAvenant; className?: string }) {
  return <Badge className={`text-xs ${STATUT_COLORS[statut] ?? ""} ${className}`}>{tStatutAvenant(statut)}</Badge>;
}
