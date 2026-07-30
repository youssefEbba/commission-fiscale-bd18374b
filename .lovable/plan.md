# État des lieux — Tâches commission (consolidé sans distinction front/back)

## Déjà réalisé

1. Ligne d'upload cliquable sur les documents.
2. Tri A→Z des entreprises + renommage « Organisme » → « Membre ».
3. Reporting scindé en deux onglets (applicatif / statistiques crédits d'impôt).
4. Refonte de la page d'accueil (Hero, Process, CTA).
5. Demande de correction sans création de marché (`intituleMarche`).
6. Crédits intérieur / extérieur sur la correction avec validation « au moins un > 0 ».
7. Entreprise étrangère (NIF facultatif, registre de commerce étranger).
8. Ministère de tutelle affiché et injecté dans les PDF officiels.
9. Groupements d'entreprises avec chef de file persistant + page de gestion + création inline.
10. Références lisibles `DC-NN/AAAA`, `DM-NN/AAAA`, etc. propagées dans listes, détails, PDF et notifications.
11. Journal / fiche / recherche de crédits d'impôt (NIF, marché, convention/projet).
12. Visas dynamiques et ordre de visa mis à jour : les 4 acteurs visent toujours, document pré-visa conditionnel selon les montants.
13. Génération PDF de la lettre d'adoption pour le Président.
14. Certificat de crédit d'impôts : design Ouguiya, logo officiel, QR code de vérification.
15. Page publique de vérification de certificat avec génération PDF.
16. Navigation profonde (deep-link) depuis les notifications workflow.
17. Gestion utilisateurs : modification profil, administration comptes, permissions `user.*`, demandes de reset.
18. Upload fail-fast MinIO avec rollback en cas d'erreur 503.
19. Injection des documents selon la configuration GED.
20. Info dialogs « Plus de détails » sur convention/marché sans quitter l'écran.
21. Retrait de la situation fiscale des affichages entreprise.
22. Modules masqués temporairement : simulation, sous-traitance, modifications/avenants.
23. Correction des libellés de documents requis (remplacement des « — »).
24. Corrections de précision/arrondi sur les montants (utilisations, mise en place).
25. Certificat téléchargeable par le Président avant signature/upload.
26. Vérification de l'éligibilité du certificat avant soumission d'utilisation.
27. Optimisation de l'affichage et du scrolling des notifications.
28. Commission relais : impersonation Entreprise / AC avec bandeau et release.
29. Divers ajustements UX (badges statut non cliquables, intitulés marché/convention, etc.).

## Reste à faire

1. Bouton « Retirer » sur chaque fichier sélectionné avant soumission.
2. Respect de la charte graphique officielle de l'État mauritanien (tokens couleurs/typo).
3. Révision des statuts dans tous les circuits workflow.
4. Révision du workflow de Mise en place pour le rendre conforme au processus attendu.
5. Affichage des montants de crédit dans l'écran de visa DGD / DGI.
6. Possibilité de modifier les montants des crédits après leur saisie.
7. Clarification du point « Les crédits intérieurs ne doivent pas être chargés ».
8. Possibilité pour le profil Commission Relais de créer une autorité contractante.
9. Développement d'un script de validation des workflows.
10. Mise en place d'un historique des utilisations (journal des actions).
11. Mécanisme permettant de lier les demandes existantes à un numéro de crédit déjà existant.

## Prochain lot recommandé

Commencer par les points 1, 5 et 2 (front immédiat / visuel) dès que la charte graphique est disponible, puis passer aux points 6, 8, 10 et 11 qui nécessitent un contrat back, enfin 3, 4, 7 et 9 en coordination avec le back.
