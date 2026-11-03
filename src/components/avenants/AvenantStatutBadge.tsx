import { AVENANT_STATUT_COLORS } from "@/lib/statutColors";
import { Badge } from "@/components/ui/badge";
import type { StatutAvenant } from "@/lib/api";
import { tStatutAvenant } from "@/i18n/enums";

const STATUT_COLORS = AVENANT_STATUT_COLORS;

export default function AvenantStatutBadge({ statut, className = "" }: { statut: StatutAvenant; className?: string }) {
  return <Badge className={`text-xs ${STATUT_COLORS[statut] ?? ""} ${className}`}>{tStatutAvenant(statut)}</Badge>;
}
