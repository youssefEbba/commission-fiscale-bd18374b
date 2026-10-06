# Roadmap — recette Commission Fiscale (06/10/2026)

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
