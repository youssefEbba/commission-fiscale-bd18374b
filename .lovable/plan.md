

## Contexte

Création d'un nouveau rôle **`COMMISSION_RELAIS`** (ou nom à valider) permettant à un agent de la Commission Fiscale de prendre le relais opérationnel d'une **Entreprise** ou d'une **Autorité Contractante** défaillante. L'agent choisit dynamiquement :
1. Le **mode d'incarnation** (Entreprise ou Autorité Contractante)
2. L'**entité cible** à gérer (quelle entreprise / quelle AC)

Une fois ce contexte choisi, il agit avec les **mêmes droits fonctionnels** que le rôle incarné, **sans pouvoir changer le mot de passe ni gérer les délégués** de l'entité.

## Spécifications backend requises

### 1. Nouveau rôle et permissions

- Ajouter `COMMISSION_RELAIS` dans l'enum `AppRole` côté backend.
- Permissions associées : superset technique des permissions `AUTORITE_CONTRACTANTE` + `ENTREPRISE`, **conditionnées** au contexte d'incarnation actif.

### 2. Endpoints de listing des cibles

- **`GET /api/commission-relais/entreprises`** — liste paginée `{id, raisonSociale, nif, actif}` de toutes les entreprises gérables.
- **`GET /api/commission-relais/autorites-contractantes`** — liste paginée `{id, libelle, code, actif}` de toutes les AC gérables.
- Filtres `q` (recherche texte) et `actif`.

### 3. Mécanisme d'incarnation (impersonation contrôlée)

Deux options à trancher avec le back :

**Option A — JWT enrichi à la sélection (recommandée)** :
- **`POST /api/commission-relais/impersonate`** corps `{ "mode": "ENTREPRISE" | "AUTORITE_CONTRACTANTE", "targetId": <id> }` → renvoie un **nouveau JWT** contenant :
  - `role`: rôle natif `COMMISSION_RELAIS`
  - `actingAs`: `"ENTREPRISE" | "AUTORITE_CONTRACTANTE"`
  - `actingEntrepriseId` ou `actingAutoriteContractanteId`
  - `permissions`: celles du rôle incarné
  - `originalUserId`: id de l'agent réel (pour audit)
- **`POST /api/commission-relais/release`** → renvoie un JWT "neutre" (sans contexte d'incarnation).

**Option B — Header `X-Acting-As` sur chaque requête** : moins sûr, plus complexe à propager.

### 4. Application du contexte côté back

Tous les endpoints existants (`/demandes`, `/certificats-credit`, `/utilisations-credit`, `/transferts-credit`, `/marches`, `/conventions`, etc.) doivent :
- Lire `actingEntrepriseId` / `actingAutoriteContractanteId` du JWT **comme s'ils étaient** `entrepriseId` / `autoriteContractanteId` du user.
- Utiliser ces ids pour les filtres de visibilité ET pour la création de ressources.

### 5. Audit obligatoire

- Chaque action effectuée en mode incarnation doit logger : `originalUserId`, `actingAs`, `targetId`, action, payload — visible dans `/dashboard/audit`.
- Endpoint `GET /api/audit-logs?actingAs=true` pour filtrer.

### 6. Restrictions de sécurité

Le rôle `COMMISSION_RELAIS` ne doit **jamais** pouvoir :
- Modifier le mot de passe ou activer/désactiver l'entité incarnée
- Gérer les délégués de l'AC incarnée
- S'auto-attribuer des permissions admin

### 7. Erreurs attendues

| Code | Contexte |
|------|----------|
| `403 ACCESS_DENIED` | Action sans contexte d'incarnation actif |
| `404 RESOURCE_NOT_FOUND` | Cible inexistante |
| `409 BUSINESS_RULE_VIOLATION` | Tentative d'action interdite (changement mdp, etc.) |

## Implémentation front (à faire après livraison back)

### Phase 1 — Plomberie auth
- Ajouter `COMMISSION_RELAIS` dans `AppRole` (`src/contexts/AuthContext.tsx`).
- Étendre `AuthUser` avec `actingAs`, `actingEntrepriseId`, `actingAutoriteContractanteId`, `originalUserId`.
- Helper `getEffectiveRole()` retournant `actingAs` si défini, sinon `role`.
- Adapter `hasRole()` et `ProtectedRoute` pour utiliser `getEffectiveRole()`.

### Phase 2 — Écran de sélection
- Nouvelle page **`/dashboard/relais`** (route protégée `COMMISSION_RELAIS` uniquement) :
  - Étape 1 : choix mode (deux cartes : Entreprise / AC)
  - Étape 2 : recherche + sélection de l'entité cible (table avec filtre)
  - Bouton "Prendre le relais" → appelle `/impersonate`, met à jour le JWT, redirige vers `/dashboard`.
- Redirection forcée vers `/dashboard/relais` si `COMMISSION_RELAIS` connecté sans contexte actif.

### Phase 3 — Bandeau permanent
- Bandeau ambré en haut du `DashboardLayout` quand `actingAs` est actif :
  - "Vous agissez en tant que **[Entreprise XYZ]** (mode Entreprise)"
  - Bouton "Quitter le relais" → appelle `/release`, retour à `/dashboard/relais`.

### Phase 4 — Mémoire et documentation
- Créer `mem://features/commission-relais` documentant la règle métier.
- Mettre à jour `mem://auth/roles-permissions`.

## Questions pour le back

1. Quel **nom officiel** pour le rôle ? (`COMMISSION_RELAIS`, `RELAIS_COMMISSION`, `AGENT_RELAIS`...)
2. **Option A ou B** pour l'incarnation ?
3. Une session de relais doit-elle **expirer** au bout d'un délai (ex: 2h) ?
4. Faut-il une **trace côté entité incarnée** ("Action effectuée par la Commission le ...") visible dans les écrans métier, ou uniquement dans l'audit ?
5. Un agent relais peut-il avoir un **scope restreint** (ex: seulement certaines AC), ou accès à toutes ?

