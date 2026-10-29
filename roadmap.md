# Roadmap — recette Commission Fiscale (06/10/2026)

## Écritures selon le stade (17/10/2026)
- [x] Centraliser les restrictions crédits, marchés et activation des conventions.
- [x] Adapter montants, transitions, corrections administrateur et modification des marchés.
- [x] Distinguer les erreurs de chargement des documents du marché d'une liste vide.
- [x] Préserver les messages serveur, traduire les explications FR/AR et tester les règles.

## 1. Conventions : périmètre, activation, échéance
- [x] `ConventionDto.actif` + `conventionApi.setActivation` (PATCH /api/conventions/{id}/activation)
- [x] Interrupteur d'activation sur la fiche (permission `convention.activate`), confirmation avant désactivation
- [x] Badge « Désactivée » dans la liste et sur la fiche
- [x] Alerte échéance depuis `dateFin` (`src/lib/conventionEcheance.ts` : 90 j / 30 j / dépassée), liste + fiche
- [x] i18n FR/AR

## 2. Lignes de tableau cliquables partout
- [x] `ClickableTableRow` (vrai lien sur la référence, clic ignoré sur boutons/liens/menus, curseur/survol, clavier)
- [x] Appliqué : conventions, marchés, demandes, mise en place, certificats, utilisations, transferts, groupements
- Note : pas de page liste « entreprises » dans l'app (fiche atteinte via demandes/groupements)

## 3. Retour de navigation entre fiches
- [x] `useSmartBack` : navigate(-1) si historique interne, sinon liste
- [x] Appliqué aux fiches : convention, marché, demande, mise en place, certificat, utilisation, transfert, entreprise, groupement, fiche crédit

## Vérifications
- [x] i18n-check + typecheck OK
- [x] Tests vitest (9) : ligne cliquable + seuils d'échéance
- [ ] Contrôle visuel authentifié — bloqué : aucune session de test disponible dans le bac à sable

## Réunion d'équipe — partie 1 (29/10/2026)
- [x] GED : sections Inscription (RATTACHEMENT_COMPTE), Modification, Clôture
- [x] Rejets temporaires : pièces proposées = GED du processus (correction, utilisation, transfert, mise en place)
- [x] Offre corrigée visible des membres de la Commission avant adoption
- [x] Colonne N° dans toutes les listes
- [x] « Nom de l'entreprise », « Intitulé du projet de marché », champ `referenceAppelOffre`
- [x] Nouveau format des références (exemples, encodage des liens)
- Hors périmètre : conventions/marchés multi-liens (partie 2)
