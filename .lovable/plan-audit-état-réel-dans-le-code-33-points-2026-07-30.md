# Audit — état réel dans le code (33 points)

Chaque statut ci-dessous s'appuie sur une lecture du code actuel. Les points où la définition de « fait » est ambiguë sont signalés.

## 1. Upload — ligne entière cliquable
**Fait.** `src/components/ui/upload-row.tsx` : toute la surface est un `<label htmlFor>` lié à l'input caché, + bouton X pour retirer la sélection locale.
Réserve : le composant n'est utilisé que dans `Utilisations.tsx` et `MiseEnPlaceDetail.tsx`. Les autres écrans d'upload (DocumentGED, DossiersList, wizard) utilisent encore leurs propres contrôles. Si « fait » = partout, alors **Partiel**.

## 2. Tri A→Z entreprises + scroll mobile
**Partiel.** Tri A→Z confirmé (`localeCompare(..., "fr", {sensitivity:"base"})`) dans `CreateDemandeWizard.tsx` (2 listes) et `GroupementFormDialog.tsx`. Pas de tri explicite côté listes serveur (Entreprises/Utilisateurs) — dépend de l'ordre backend.
Le volet « scroll mobile » n'est pas vérifiable de façon fiable en statique : seules des hauteurs `max-h-[50vh] overflow-y-auto` / `max-h-[92vh]` existent dans le wizard. Je ne peux pas affirmer que le problème mobile signalé est résolu sans test navigateur.

## 3. Renommage « Organisme » → « Membre »
**Pas commencé** (au sens du renommage d'un libellé UI). Aucune occurrence utilisateur de « Organisme » sauf : commentaires de code, titre `Statut par organisme` dans `DemandeDetail.tsx` et `DemandesMiseEnPlace.tsx`, et une entête du PDF certificat (« ORGANISME DE FINANCEMENT »).
Doute explicite : « Membre » existe déjà dans le module Groupements (membres du groupement) — je ne sais pas si le point vise les onglets de visa (« Statut par organisme ») ou autre chose. À confirmer.

## 4. Reporting scindé en deux onglets
**Fait.** `src/pages/Reporting.tsx` : `Tabs` avec `app` (applicatif) et `stats` (statistiques crédits d'impôt).

## 5. Références lisibles avec numéro incrémental (`DC-112/01/2026`)
**Pas commencé / bloqué backend.** Le format actuellement documenté et consommé est `DC-NN/AAAA` / `DM-NN/AAAA` (`src/lib/api.ts`, `src/lib/displayRef.ts`). Le front n'assemble jamais la référence : il affiche `entity.reference` telle que fournie. Passer à `DC-112/01/2026` est un changement **100 % backend** ; le front n'a rien à modifier tant que le champ reste `reference` (l'affichage suivra automatiquement).

## 6. Workflow dynamique DGI/DGD selon les crédits
**Fait, mais avec deux règles différentes** (`src/lib/visas.ts`) :
- Mise en place : DGI exclu si `creditInterieur = 0`, DGD exclu si `creditExterieur = 0` (`isRoleExcluded`).
- Correction : les 4 acteurs visent toujours ; seuls les documents pré-visa et l'ordre du premier visa dépendent des montants.

## 7. Chef de file des groupements
**Fait.** `GroupementFormDialog.tsx` : sélection obligatoire parmi les membres, validation « chef ∈ membres », refus d'un chef sans NIF ; affiché en liste (`Groupements.tsx`), dans la fiche crédit et le PDF de lettre d'adoption.

## 8. Demande de correction sans création de marché
**Fait.** `CreateDemandeWizard.tsx` : champ `intituleMarche` persistant, validation « marché OU intitulé requis » à la soumission, envoi `intituleMarche` dans le payload.

## 9. Crédits intérieur / extérieur sur les corrections
**Fait.** Saisie dans le wizard, résolution robuste côté lecture (`resolveCredits` avec fallback `modeleFiscal.recapitulatif` / `fiscaliteInterieure`), et exploitation dans les règles de visa.

## 10. Entreprises étrangères sans NIF
**Fait.** Flag `entrepriseEtrangere`, NIF facultatif (contrôle des 8 caractères appliqué uniquement aux non-étrangères), registre de commerce étranger, et blocage explicite « une entreprise étrangère sans NIF ne peut pas être chef de file ».

## 11. Champ « Intitulé » marché / convention
**Fait.** `intitule` présent sur convention (création inline dans le wizard, obligatoire avec la référence) et sur marché (`marcheIntitule` / `intituleMarche`), affiché en priorité sur la référence brute dans GED, listes et détails.

## 12. Ministère de tutelle
**Partiel.** Saisi à la création d'AC (`Utilisateurs.tsx`, `Register.tsx` → `ministereTutelleNom` / `ministereTutelleCode`) et injecté dans la lettre d'adoption (`adoptionLetterPdf.ts`).
Manque vérifié : aucune occurrence de `ministere` dans `certificatSignaturePdf.ts` — le ministère n'apparaît donc pas sur le certificat lui-même, contrairement à ce qui avait été annoncé.

## 13. NIF groupement = NIF du chef de file
**Fait.** `nifDerive` calculé depuis le chef, champ en lecture seule/désactivé dans le formulaire, colonne « NIF (chef de file) » en liste, mention explicite dans l'écran.

## 14. Propagation des références lisibles
**Fait.** Helper `displayRef()` (priorité `reference` → `numero` → `#id`) utilisé dans Demandes, DemandeDetail, DemandesMiseEnPlace, MiseEnPlaceDetail, Marches, MarcheDetail, Certificats, CertificatDetail, CorrectionDouaniere, CreditsRecherche, CreditFiche.

## 15. Journal / fiche / recherche des crédits d'impôt
**Partiel.** `CreditsRecherche.tsx` + `CreditFiche.tsx` existent, avec endpoint `/certificats-credit/fiche?reference=`.
Manque : le « journal » au sens historique des actions/utilisations n'existe pas comme écran dédié (point resté ouvert dans le suivi précédent). Dépend d'un endpoint d'historique backend.

## 16. Visas dynamiques et ordre des visas
**Fait.** `visas.ts` expose `requiredVisasCorrection` (4 acteurs), `requiredVisasCertificat` (filtré par montants), `requiredPreVisaDocCorrection`, `firstVisaRoleCorrection` (DGD si extérieur > 0, sinon DGI si intérieur > 0), `allRequiredVisasPosed`. Consommé par Demandes, DemandeDetail, CorrectionDouaniere, MiseEnPlaceDetail.

## 17. PDF lettre d'adoption
**Fait.** `src/lib/adoptionLetterPdf.ts`, déclenché par le Président en phase `EN_VALIDATION`.

## 18. Certificat de crédit d'impôt avec QR code
**Fait.** `certificatSignaturePdf.ts` : jsPDF + `qrcode` (`QRCode.toDataURL(verifyUrl)`), mise en page Ouguiya/emblème.
Réserve : voir point 12 (ministère absent du certificat).

## 19. Page publique de vérification
**Fait.** `src/pages/VerifierCertificat.tsx`, cible du QR, avec génération PDF.

## 20. Navigation profonde depuis les notifications
**Fait.** `NotificationBell.tsx` : priorité à `payload.redirectPath`, fallback par type.

## 21. Gestion des utilisateurs et permissions
**Fait.** `Utilisateurs.tsx` (liste, filtres, création AC, activation, reset), `MonProfil.tsx`, `Roles.tsx`, permissions `user.*`.

## 22. Upload MinIO avec rollback
**Fait.** Séquence fail-fast + rollback sur 503 dans `DossiersList.tsx` / `api.ts` (code d'erreur structuré dédié).

## 23. Injection des documents selon la configuration GED
**Fait.** Les exigences proviennent du référentiel GED (`GedConfiguration.tsx`, configuration réservée ADMIN_SI) et pilotent les lignes d'upload.

## 24. Dialogues « Plus de détails »
**Fait.** Info dialogs convention/marché dans `DemandeDetail.tsx`, avec lien direct vers l'entité concernée.

## 25. Retrait de la situation fiscale
**Partiel.** Retirée des affichages (`DemandeDetail`, `Demandes`, `CorrectionDouaniere`, `DemandesMiseEnPlace`), mais le champ `situationFiscale` subsiste dans les types/payloads `api.ts` (`EntrepriseDto`). Sans impact UI ; à nettoyer seulement si « fait » = suppression du modèle.

## 26. Masquage simulation / sous-traitance / modifications
**Fait.** Routes et entrées de menu commentées dans `App.tsx` et `DashboardLayout.tsx`. Les fichiers de pages restent présents (masquage, pas suppression) — conforme à la demande initiale.

## 27. Libellés des documents requis
**Fait.** Helper `tDocRequirementLabel(req)` dans `src/i18n/enums.ts`, utilisé pour supprimer les « — » vides.

## 28. Arrondis et précision des montants
**Partiel.** Corrections appliquées sur les utilisations et la mise en place (tolérance de comparaison des soldes, `formatCurrency` centralisé). Il n'existe pas de règle d'arrondi unique appliquée systématiquement à tous les écrans ; je ne peux pas garantir la couverture exhaustive sans une revue montant par montant.

## 29. Téléchargement du certificat par le Président avant signature
**Fait.** Bouton de génération/téléchargement en `EN_VALIDATION_PRESIDENT` dans `MiseEnPlaceDetail.tsx`.

## 30. Éligibilité du certificat avant utilisation
**Fait.** `GET /certificats-credit/{id}/eligibilite-utilisation?type=` appelé depuis `Utilisations.tsx`, blocage de la soumission si non éligible.

## 31. Optimisation des notifications
**Fait.** `NotificationBell.tsx` refondu : onglets, icônes par type, scroll optimisé, fallback polling 30 s si WebSocket indisponible.

## 32. Impersonation Commission Relais → Entreprise / AC
**Partiel.** `CommissionRelais.tsx` : choix du mode, recherche paginée, impersonation, bandeau + release, expiration 4 h. **Manque** : la création d'une autorité contractante par le profil Commission Relais (point identifié comme restant). Dépend d'une autorisation backend sur `/api/autorites-contractantes` pour un JWT en impersonation.

## 33. Divers ajustements UX
**Fait** (identifiés dans le code) :
- badge « Stade » rendu non cliquable dans `Demandes.tsx` ;
- recherche entreprises insensible à la casse et aux accents ;
- libellés « Montant HT » au lieu de TTC à la création de marché ;
- montant du marché retiré du libellé de sélection ;
- affichage du NIF corrigé dans la liste de choix d'entreprise ;
- ouverture authentifiée des documents via `openDocument.ts` (JWT + en-tête ngrok) ;
- refonte de la page d'accueil (Hero / Process / CTA).

# Points restants confirmés par cet audit

1. Format de référence `DC-112/01/2026` — backend.
2. Ministère de tutelle sur le certificat PDF — front, faisable si le champ est exposé sur le dossier.
3. Création d'AC par Commission Relais — backend + front.
4. Journal / historique des utilisations — backend.
5. `UploadRow` à généraliser aux écrans d'upload restants — front.
6. Renommage « Organisme » → « Membre » : périmètre à clarifier avant toute modification.
7. Scroll mobile des listes : à valider par un test réel avant de conclure.
