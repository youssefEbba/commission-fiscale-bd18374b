# Roadmap — recette Commission Fiscale (06/10/2026)

## 1. Conventions : périmètre, activation, échéance
- [ ] `ConventionDto.actif` + `conventionApi.setActivation` (PATCH /api/conventions/{id}/activation)
- [ ] Interrupteur d'activation sur la fiche (permission `convention.activate`), confirmation avant désactivation
- [ ] Badge « Désactivée » dans la liste et sur la fiche
- [ ] Alerte échéance depuis `dateFin` (constantes nommées : 90 j / 30 j / dépassée), liste + fiche
- [ ] i18n FR/AR

## 2. Lignes de tableau cliquables partout
- [ ] Composant de ligne cliquable réutilisable (vrai lien sur la référence, stopPropagation sur les actions, curseur/survol)
- [ ] Appliquer : conventions, marchés, demandes, mise en place, certificats, utilisations, transferts, entreprises, groupements

## 3. Retour de navigation entre fiches
- [ ] Utilitaire « retour intelligent » : navigate(-1) si historique interne, sinon liste
- [ ] Appliquer aux fiches : convention, marché, demande, mise en place, certificat, utilisation, transfert, entreprise, groupement

## Vérifications
- [ ] i18n-check + typecheck
- [ ] Contrôle visuel Playwright
