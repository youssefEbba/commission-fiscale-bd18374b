# Audit lecture seule — 13 points

Chaque statut s'appuie sur une lecture du code actuel. Aucun fichier source n'est modifié.

## 1. Suppression de la création de marché dans la demande de correction
**Fait côté UI, résidu mort dans le code.**
- `CreateDemandeWizard.tsx` : le bloc de sélection/création de marché a été remplacé par un champ libre `intituleMarche` (obligatoire, commentaire « Phase A — Intitulé libre du marché (aucune création de marché ici) »). Aucun bouton « Créer un marché » n'est rendu à l'écran (aucun usage de `showCreateMarche` dans le JSX).
- Résidus non rendus : `handleCreateMarche()` (appelle `marcheApi.create`), les états `showCreateMarche`, `newMarche`, `creatingMarche`, `marches`, `marcheId` (encore lus/écrits, envoyés au payload via `selectedMarche`) subsistent. Code mort ou quasi-mort, sans action utilisateur possible.
- Doute : si « supprimer » = nettoyer le code et cesser d'envoyer `marcheId`, alors **Partiel** (front, nettoyage simple).

## 2. Blocage des deux crédits à 0
**Fait.** `CreateDemandeWizard.tsx` ligne ~672 : à la soumission non-brouillon, `if (creditExterieur <= 0 && creditInterieur <= 0)` bloque avant tout appel API. Le front ne dépend donc pas de l'erreur backend. Le brouillon reste autorisé avec 0/0.

## 3. Nouveau format `PREFIXE-NNN-MM/AAAA`
**Fait / aucun changement requis.** Aucun endroit du code ne parse ni ne recompose une référence : recherche de `split/match/replace/slice` sur `reference` → 0 occurrence ; aucun gabarit `DC-`/`DM-`/`DU-`/`CR-` construit en code. `displayRef()` affiche `reference` brute (fallback `numero` puis `#id`). Seuls des **commentaires** de `api.ts` et `displayRef.ts` documentent encore l'ancien format `DC-NN/AAAA` — cosmétique.

## 4. Référence lisible partout (listes, en-têtes, PDF, notifications)
**Partiel.**
- Listes / en-têtes / fiches : fait via `displayRef()` (Demandes, DemandeDetail, DemandesMiseEnPlace, MiseEnPlaceDetail, Marches, Certificats, CorrectionDouaniere, CreditsRecherche, CreditFiche).
- PDF : fait. `adoptionLetterPdf.ts` (`d.reference || d.numero`) et `certificatSignaturePdf.ts` (`c.reference || c.numero`, y compris le nom de fichier et la référence de convention).
- Notifications : **le contenu du message est produit par le backend** ; `NotificationBell.tsx` n'y injecte aucune référence (aucune occurrence de `reference`). Si les messages ne contiennent pas la référence lisible, c'est un point **backend**, pas front.

## 5. NIF groupement = NIF du chef de file
**Fait.** `GroupementFormDialog.tsx` : sélection du chef parmi les membres, `nifDerive` calculé depuis le chef, champ NIF `readOnly disabled`, validations « chef obligatoire », « chef ∈ membres », refus d'un chef sans NIF.

## 6. Entreprises étrangères
**Fait.** Flag `entrepriseEtrangere`, NIF facultatif, `registreCommerceEtranger` obligatoire dans ce cas — validé à la création inline du wizard (ligne ~396) et à l'inscription (`Register.tsx` ligne ~101), bouton désactivé tant que le RC étranger est vide. Affichage du RC dans la liste de sélection et dans `CreditFiche`.

## 7. Champ Intitulé convention ET marché
**Fait.** Convention : `intitule` obligatoire à la création inline (bouton désactivé sans référence + intitulé), affiché dans le libellé de sélection. Marché : `intitule` / `marcheIntitule` / `intituleMarche` privilégié à la référence brute dans `DemandeDetail`, `CreditFiche`, GED, listes.

## 8. « Organisme » → « Membre » (FR + AR)
**Fait sur le périmètre confirmé.** `fr/demandes.json` et `fr/mise_en_place.json` : « Statut par membre » ; `ar/demandes.json` et `ar/mise_en_place.json` : « الحالة حسب العضو ». Il ne reste « organisme » que dans des **commentaires de code** (`visas.ts`, `DemandeDetail.tsx`, `MiseEnPlaceDetail.tsx`, `CorrectionDouaniere.tsx`) — invisibles pour l'utilisateur. Le PDF certificat conserve « ORGANISME DE FINANCEMENT », conforme au scope.

## 9. Refonte de la page d'accueil
**Fait structurellement, en attente de contenu client.** `Index.tsx` assemble Navbar / Hero / Process / Features / CTA / Footer (404 lignes au total), textes issus du namespace `landing` i18n FR+AR, aucun « lorem » ni TODO.
À fournir par le client : textes définitifs (accroche, descriptions), visuels/photos officiels, et charte graphique officielle de l'État. Aucun asset image dédié n'est utilisé aujourd'hui hors `logo.svg` — la mise en page repose sur des icônes et des dégradés du thème.

## 10. Ministère de tutelle : en-tête des demandes + tous les PDF
**Partiel.**
- Saisie : OK (`Utilisateurs.tsx`, `Register.tsx`).
- Lettre d'adoption : OK (`adoptionLetterPdf.ts` ligne 226).
- Certificat : OK (`certificatSignaturePdf.ts` ligne 240) — corrigé depuis l'audit précédent.
- **Manque** : aucun affichage dans l'en-tête des écrans de demande (`DemandeDetail.tsx`, `DemandesMiseEnPlace.tsx`, `CorrectionDouaniere.tsx` : zéro occurrence de `ministereTutelle`). Seul `CreditFiche.tsx` l'affiche. Faisable en front **si** l'objet demande expose l'AC avec son ministère ; sinon dépendance backend (champ à exposer sur le DTO demande).
- **Manque** : `liquidationPdf.ts` n'affiche pas le ministère (à confirmer si ce PDF est dans le périmètre « PDF officiels »).

## 11. Ligne d'upload entièrement cliquable
**Partiel.** `src/components/ui/upload-row.tsx` (label plein-surface + bouton retirer) n'est utilisé que dans **`Utilisations.tsx`** et **`MiseEnPlaceDetail.tsx`**.
Non couverts : `components/ged/DocumentGED.tsx`, `components/ged/DossiersList.tsx`, upload de documents du `CreateDemandeWizard` (création convention), `Conventions.tsx`, `Marches.tsx`. Travail purement front.

## 12. Scroll vertical de la liste entreprises sur mobile (clavier virtuel)
**Doute — non vérifiable en statique.** Le code prévoit `max-h-[50vh] overscroll-contain` sur la `CommandList` de `SearchableSelect` et `max-h-[92vh] overflow-y-auto` sur le dialog du wizard, ce qui est cohérent avec un scroll interne. Mais l'effet du clavier virtuel (réduction du viewport, `vh` non réactif sur iOS Safari) **ne peut pas être conclu sans test réel sur appareil**. `50vh` calculé sur la hauteur plein écran est précisément le motif classique d'échec avec clavier ouvert : je signale un **risque** plutôt qu'un statut « Fait ».

## 13. Tri A→Z de la liste des entreprises
**Partiel.** Tri `localeCompare(..., "fr", { sensitivity: "base" })` confirmé dans :
- `CreateDemandeWizard.tsx` (2 listes : titulaire et membres de groupement),
- `GroupementFormDialog.tsx` (2 endroits : sélection membres et chef de file).
Non trié : il n'existe pas d'écran « Entreprises » dédié ; les entreprises listées dans `Utilisateurs.tsx` et `Reporting.tsx` suivent l'ordre renvoyé par l'API, sans tri explicite côté front.

---

# Synthèse des restes

| Point | Reste à faire | Côté |
|---|---|---|
| 1 | Nettoyer le code mort de création de marché | Front (cosmétique) |
| 4 | Référence lisible dans le **texte** des notifications | Backend |
| 10 | Ministère dans l'en-tête des écrans de demande (+ liquidationPdf ?) | Front, + backend si le DTO ne l'expose pas |
| 11 | Généraliser `UploadRow` (GED, DossiersList, wizard, Conventions, Marches) | Front |
| 12 | Test réel mobile clavier ouvert avant de conclure | Vérification |
| 13 | Tri des listes d'entreprises hors wizard/groupement | Front |

Aucune modification de code n'est proposée ici : dis-moi lesquels de ces restes tu veux que je traite et je prépare un plan d'implémentation dédié.
