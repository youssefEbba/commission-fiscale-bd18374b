import { useLocation, useNavigate } from "react-router-dom";

/**
 * Retour intelligent : revient à la page précédente quand on est arrivé
 * depuis l'application, et retombe sur `fallback` quand la fiche est ouverte
 * directement par son URL (lien partagé, favori, rechargement).
 *
 * React Router donne `location.key === "default"` à la première entrée de
 * l'historique : c'est le signal d'une ouverture directe.
 */
export function useSmartBack(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };
}

export default useSmartBack;
