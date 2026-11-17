// N° de déclaration (douane) et de facture (TVA intérieure) : une utilisation peut en porter plusieurs.
// Le serveur nettoie les listes (espaces, vides, doublons sans casse) et refuse en 409
// (`JUSTIFICATIF_DEJA_UTILISE`) un numéro déjà utilisé sur le même crédit par une autre demande non rejetée.

interface AvecNumeros {
  numeroDeclaration?: string | null;
  numerosDeclaration?: string[] | null;
  numeroFacture?: string | null;
  numerosFacture?: string[] | null;
}

const liste = (many: string[] | null | undefined, one: string | null | undefined): string[] =>
  many && many.length ? many : one ? [one] : [];

/** Numéros de déclaration (liste du serveur, repli sur l'ancien champ unique). */
export const numerosDeclaration = (u: AvecNumeros) => liste(u.numerosDeclaration, u.numeroDeclaration);
/** Numéros de facture (liste du serveur, repli sur l'ancien champ unique). */
export const numerosFacture = (u: AvecNumeros) => liste(u.numerosFacture, u.numeroFacture);

/** Affichage : numéros joints par « , » (vide si aucun). */
export const joinNumeros = (numeros: string[]) => numeros.filter((n) => n && n.trim()).join(", ");

/** Même nettoyage que le serveur : espaces retirés, vides écartés, doublons (casse ignorée) supprimés. */
export function cleanNumeros(numeros: (string | null | undefined)[]): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  for (const raw of numeros) {
    const n = (raw ?? "").trim();
    if (!n) continue;
    const k = n.toLocaleLowerCase("fr");
    if (vus.has(k)) continue;
    vus.add(k);
    out.push(n);
  }
  return out;
}

/** Lignes du formulaire : au moins une ligne (vide) affichée. */
export const lignesNumeros = (numeros: string[] | null | undefined) => (numeros && numeros.length ? numeros : [""]);
export const ajouterNumero = (numeros: string[] | null | undefined) => [...lignesNumeros(numeros), ""];
/** Retire une ligne ; la dernière ligne restante est vidée plutôt que supprimée. */
export function retirerNumero(numeros: string[] | null | undefined, index: number): string[] {
  const l = lignesNumeros(numeros).filter((_, i) => i !== index);
  return l.length ? l : [""];
}
export const modifierNumero = (numeros: string[] | null | undefined, index: number, value: string) =>
  lignesNumeros(numeros).map((n, i) => (i === index ? value : n));

/**
 * Corps envoyé (création POST et modification PUT) : les listes nettoyées remplacent l'ancien champ unique,
 * qui n'est plus envoyé seul.
 */
export function withNumerosListes<T extends Record<string, unknown>>(body: T, type: string | null | undefined): T {
  const out: Record<string, unknown> = { ...body };
  delete out.numeroDeclaration;
  delete out.numeroFacture;
  if (type === "DOUANIER") {
    out.numerosDeclaration = cleanNumeros((body.numerosDeclaration as string[] | undefined) ?? []);
    delete out.numerosFacture;
  } else if (type === "TVA_INTERIEURE") {
    out.numerosFacture = cleanNumeros((body.numerosFacture as string[] | undefined) ?? []);
    delete out.numerosDeclaration;
  }
  return out as T;
}
