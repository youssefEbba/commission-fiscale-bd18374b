import React from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ClickableTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Destination ouverte au clic sur la ligne. */
  to: string;
}

/**
 * Ligne de tableau cliquable : ouvre `to` au clic, sauf si le clic provient
 * d'un élément interactif (lien, bouton, menu, champ) de la ligne.
 * Garder un vrai <Link> sur la colonne de référence pour l'ouverture dans un
 * nouvel onglet et la navigation clavier.
 */
export function ClickableTableRow({ to, className, children, onClick, ...rest }: ClickableTableRowProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, [role='button'], [role='menuitem'], [role='checkbox'], [data-no-row-click]")) return;
    navigate(to);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(to);
    }
  };

  return (
    <tr
      {...rest}
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className
      )}
    >
      {children}
    </tr>
  );
}

export default ClickableTableRow;
