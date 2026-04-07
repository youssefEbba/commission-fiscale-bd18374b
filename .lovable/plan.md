

## Plan : Générer un manuel d'utilisation Word (.docx)

### Objectif
Créer un document Word structuré décrivant l'utilisation complète de la plateforme SGCI (Commission Fiscale de Mauritanie), organisé par rôle et par module fonctionnel.

### Structure du document

1. **Page de garde** : Logo, titre "Manuel d'utilisation — SGCI", sous-titre "Commission Fiscale de Mauritanie", date
2. **Table des matières**
3. **Introduction** : Présentation de la plateforme, objectif, périmètre
4. **Connexion et inscription** : Login, Register, rôles disponibles
5. **Tableau de bord** : Vue d'ensemble, actions rapides par rôle, notifications
6. **Modules fonctionnels** (un chapitre par module) :
   - Conventions / Projets (AC, DGB, Président)
   - Demandes de correction (AC soumet, DGD/DGI/DGB/DGTCP traite, Président valide)
   - Mise en place du CI (AC soumet, workflow de visa multi-acteurs)
   - Marchés / Attributions (AC crée, gestion des marchés)
   - Délégués (AC gère ses UPM/UEP)
   - Certificats de crédit (émission, consultation, détail)
   - Utilisations du crédit (Douane et TVA intérieure, Entreprise/Sous-traitant)
   - Transferts de crédit (Entreprise demande, DGTCP/Président valide)
   - Sous-traitance (Entreprise/Sous-traitant, DGTCP)
   - Modifications / Avenants
   - Clôture et reporting
   - Simulation (Entreprise)
7. **Administration** (ADMIN_SI uniquement) :
   - Gestion des utilisateurs
   - Rôles et permissions
   - GED (Configuration et Dossiers)
   - Journal d'audit
8. **Matrice des accès par rôle** : Tableau récapitulatif rôle vs module
9. **Glossaire** : Termes métier (CI, AC, DGD, DGTCP, etc.)

### Approche technique

- Script Node.js utilisant la librairie `docx` (docx-js)
- Format A4 avec marges standard
- En-tête avec nom de la plateforme, pied de page avec numérotation
- Couleur d'accent institutionnelle (vert/or du logo)
- Tableaux pour la matrice des rôles et les descriptions de workflow
- Le fichier sera généré dans `/mnt/documents/Manuel_Utilisation_SGCI.docx`

### Fichiers à lire pour alimenter le contenu

| Source | Information |
|--------|------------|
| `src/components/dashboard/DashboardLayout.tsx` | Navigation, menus, rôles par module |
| `src/pages/*.tsx` | Fonctionnalités de chaque module |
| `src/contexts/AuthContext.tsx` | Rôles et permissions |
| `src/lib/api.ts` | Labels de statuts, workflows |

