/**
 * Entrée du menu à mettre en évidence : la plus longue dont le chemin est le préfixe de la page
 * (« /dashboard/marches/12 » → Marchés, « /dashboard/satisfaction/enquetes » → Enquêtes et pas Satisfaction).
 * L'accueil « /dashboard » ne correspond qu'à lui-même.
 */
export function activeNavHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const match = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
    if (match && (!best || href.length > best.length)) best = href;
  }
  return best;
}
