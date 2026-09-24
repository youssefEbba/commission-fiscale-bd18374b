import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CreditLinkProps {
  id?: number | null;
  reference?: string | null;
  numero?: string | null;
  className?: string;
}

/** Libellé lisible d'un crédit : référence (CR-001-01/2026) sinon numéro, sinon #id. */
export function creditLabel(p: { id?: number | null; reference?: string | null; numero?: string | null }) {
  return p.reference || p.numero || (p.id != null ? `#${p.id}` : "—");
}

/** Numéro de crédit cliquable, ouvre le détail du crédit via son identifiant. */
export default function CreditLink({ id, reference, numero, className }: CreditLinkProps) {
  const label = creditLabel({ id, reference, numero });
  if (id == null) return <span className={className}>{label}</span>;
  return (
    <Link
      to={`/dashboard/certificats/${id}`}
      onClick={(e) => e.stopPropagation()}
      className={cn("font-medium text-primary underline-offset-2 hover:underline", className)}
    >
      {label}
    </Link>
  );
}
