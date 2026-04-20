---
name: Commission Relais
description: Rôle COMMISSION_RELAIS d'impersonation contrôlée Entreprise ou AC, JWT acting*, bandeau et release
type: feature
---

Rôle `COMMISSION_RELAIS` (compte de démo `commission_relais` / `123456`) permet à un agent de la Commission de prendre le relais opérationnel d'une entreprise ou d'une autorité contractante défaillante.

## Flux
1. Login standard → JWT `role=COMMISSION_RELAIS`, `impersonating=false`. ProtectedRoute force la redirection vers `/dashboard/relais`.
2. L'utilisateur choisit le mode (Entreprise / AC) puis l'entité cible via `/api/commission-relais/{entreprises|autorites-contractantes}?q=...`.
3. `POST /api/commission-relais/impersonate/{entreprise|autorite-contractante}` → nouveau JWT avec `role` effectif (`ENTREPRISE` ou `AUTORITE_CONTRACTANTE`), `impersonating=true`, `actingEntrepriseId` / `actingAutoriteContractanteId`. Token remplacé via `applyImpersonation()`.
4. Bandeau ambré permanent dans `DashboardLayout` avec bouton "Quitter le relais" → `POST /api/commission-relais/release` retourne au JWT relais neutre.
5. Durée de vie JWT impersonation : 4 h (`app.jwt.relais-expiration-ms`).

## Côté front
- `AuthContext` expose `nativeRole` (préservé entre impersonations), `isCommissionRelais`, `isImpersonating`, `applyImpersonation()`, `actingTargetLabel`.
- `ProtectedRoute` :
  - Redirige vers `/dashboard/relais` si `nativeRole=COMMISSION_RELAIS` et `!impersonating`.
  - Autorise `/dashboard/relais` même quand le rôle effectif diffère du natif.
- En impersonation, `hasRole(["ENTREPRISE"])` ou `hasRole(["AUTORITE_CONTRACTANTE"])` réussit naturellement → toute la sidebar et toutes les routes métier deviennent disponibles sans modification.

## Restrictions
- Le back interdit les actions sensibles en impersonation (gestion délégués notamment).
- Ne jamais ajouter le rôle `COMMISSION_RELAIS` dans les `allowedRoles` des routes métier : laisser le rôle effectif faire le travail.
