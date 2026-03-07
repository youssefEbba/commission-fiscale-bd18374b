

# Plan : Page de Présentation Client

Créer une nouvelle page `/presentation` avec un design professionnel (HTML/CSS inline via Tailwind) qui présente les fonctionnalités clés du système en 6 sections.

## Structure de la page

Une page standalone, accessible sans authentification, avec un design moderne type "slide deck" vertical. Chaque section occupe un bloc visuellement distinct avec icones Lucide.

### Sections :

1. **Les Modifications** -- Corrections douanières, workflow de validation multi-acteurs (AC → DGI → DGTCP → Président), suivi des statuts en temps réel.

2. **Les Améliorations** -- Taux de change automatique, bailleurs en référentiel avec ajout inline, devises dynamiques, fusion de fichiers, interface optimisée.

3. **La GED (Gestion Électronique des Documents)** -- Configuration dynamique par processus, séparation Douane/TVA Intérieure, exigences documentaires par type d'opération, upload obligatoire avant soumission.

4. **L'Assistant IA** -- Chatbot intégré pour assistance contextuelle, connecté via API dédiée, aide à la navigation et aux procédures.

5. **Les Délégués (UPM/UEP)** -- Accès identique à l'AC sur leur périmètre, filtrage automatique par marchés affectés, visibilité conventions/demandes/certificats liés.

6. **Demande de Mise en Place CI** -- Workflow AC → DGI → DGTCP → Président, saisie montants Cordon/TVA, génération certificat PDF, ouverture automatique des soldes.

7. **Demande d'Utilisation CI** -- Deux flux : Douanier (DGD → DGTCP) et TVA Intérieure (DGTCP seul), documents GED obligatoires, débit automatique du solde.

## Implémentation

- **Nouveau fichier** : `src/pages/Presentation.tsx`
- **Route** : Ajouter `/presentation` dans `App.tsx` (sans ProtectedRoute)
- Design : fond sombre avec cartes colorées, animations subtiles via Framer Motion, icones Lucide, palette verte du projet (primary: `hsl(153, 60%, 28%)`)
- Header avec logo et titre "Commission Fiscale -- Présentation"
- Chaque section : icone + titre + liste de points clés avec checkmarks

