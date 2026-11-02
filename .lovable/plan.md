# Guide de captures pour la présentation d'avancement

## Objectif
Produire un document Word (nouveau fichier, sans modifier l'application) qui donne à la personne chargée des captures un parcours clair : pour chaque partie de la présentation, le titre de la diapositive, le compte avec lequel se connecter, l'écran à ouvrir, les actions à faire avant la capture, le nombre de captures et ce que chaque capture doit montrer.

## Structure du document
1. **Page de garde et mode d'emploi** : comment nommer les captures (ex. `02-3_suivi_demande.png`), le format conseillé (plein écran, sans données personnelles réelles) et comment changer d'acteur ou de langue.
2. **Tableau des comptes à préparer** : Visiteur (non connecté), Entreprise, Autorité contractante, DGD, DGI, DGTCP, DGB, Président, Administrateur SI, Commission relais.
3. **Parties de la présentation**, chacune avec une fiche « Se connecter en tant que / Aller à / Faire / Capturer / Ce qu'on doit voir » :
   1. Page d'accueil et adaptation à l'écran — Visiteur — 3 captures minimum : ordinateur, tablette, téléphone, puis accueil en français et en arabe (sens de lecture droite-gauche).
   2. Authentification et demande de rattachement — Visiteur puis Président : formulaire de connexion, formulaire d'inscription / rattachement, confirmation d'envoi, suivi de la demande, validation par le Président, mot de passe oublié.
   3. Tableau de bord par acteur — un écran par rôle pour montrer que chacun voit ses propres éléments.
   4. Référentiels — Président / Administrateur : entreprises, autorités contractantes, bailleurs, fiche détaillée d'une entité.
   5. Conventions — Autorité contractante puis DGB : création (autorités et bailleurs multiples), liste, fiche, validation.
   6. Marchés — Autorité contractante : liste paginée, création, liaison à plusieurs conventions, fiche.
   7. Mise en place du crédit d'impôt — AC, puis DGI / DGD / DGTCP (visas), puis Président (certificat signé) : création, visas, validation, crédit ouvert.
   8. Demande de correction — Entreprise, puis DGD / DGI / DGTCP / DGB, puis Président : formulaire, reçu PDF, circuit de visas, rejet temporaire, adoption avec lettre.
   9. Utilisation, transferts et avenants — Entreprise / DGTCP / Président : suivi des soldes, transfert, avenant et pièce de la commission.
   10. Gestion documentaire (GED) — Administrateur SI : paramétrage des pièces, dossier d'un processus.
   11. Documents générés — reçu, certificat, lettre d'adoption, en police officielle Ouguiya.
   12. Notifications, main courante et rapports — Président / acteurs : indicateurs, notifications en temps réel.
   13. Commission relais et sécurité — Commission relais : bandeau de prise de relais, fin de relais, déconnexion, session expirée.
4. **Liste de contrôle finale** : toutes les captures cochées, avec une colonne pour les remarques.

## Points signalés dans le document
- Les droits réels des comptes dépendent du serveur : si un écran est refusé, noter le message et passer à la suite.
- Les données de démonstration doivent être fictives.
- Ordre conseillé : faire d'abord les parties 5 à 8, qui créent les données réutilisées par les captures suivantes.

## Détails techniques
- Généré avec la bibliothèque docx en JavaScript, format A4, police Arial, aux couleurs vert et or du projet, sans emoji.
- Chemins d'écran repris des routes réelles de l'application (`/dashboard/...`).
- Enregistré dans Files sous `guide_captures_presentation.docx` ; chaque page sera convertie en image et vérifiée avant livraison.
