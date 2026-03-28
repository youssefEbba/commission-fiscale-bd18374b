

# Fix API Endpoint Mismatches

## Mismatches Found

Comparing `src/lib/api.ts` against the backend endpoint list:

### 1. Convention `getByStatut` — Wrong URL
- **Frontend**: `/conventions/statut/${statut}` (line 304)
- **Backend**: `/conventions/by-statut?statut={statut}`

### 2. Convention `update` (PUT) — Not in backend
- **Frontend**: `PUT /conventions/${id}` (line 306)
- **Backend**: No PUT endpoint listed
- **Action**: Remove `update` method

### 3. Convention `deleteDocument` — Not in backend
- **Frontend**: `DELETE /conventions/${conventionId}/documents/${docId}` (line 309)
- **Backend**: No delete document endpoint
- **Action**: Remove `deleteDocument` method

### 4. Utilisateur `update` — Not in backend
- **Frontend**: `PUT /utilisateurs/${id}` (line 111)
- **Backend**: No PUT endpoint
- **Action**: Remove

### 5. Utilisateur `delete` — Not in backend
- **Frontend**: `DELETE /utilisateurs/${id}` (line 112)
- **Backend**: No DELETE endpoint
- **Action**: Remove

### 6. Utilisateur `resetPassword` — Not in backend
- **Frontend**: `PATCH /utilisateurs/${id}/reset-password` (line 113)
- **Backend**: No reset-password endpoint
- **Action**: Remove

### 7. Avenant `getAll` — Not in backend
- **Frontend**: `GET /avenants` (line 1302)
- **Backend**: Only document endpoints exist (`GET/POST /avenants/{id}/documents`)
- **Action**: Remove `getAll` and `getById`

### 8. Cloture — Missing document endpoints
- **Backend**: `GET /clotures-credit/{id}/documents` and `POST /clotures-credit/{id}/documents`
- **Frontend**: Missing
- **Action**: Add `getDocuments` and `uploadDocument` to `clotureCreditApi`

### 9. Marche `assign` — Wrong format
- **Frontend**: `PATCH /marches/${id}/assign?delegueId=${delegueId}` (line 578)
- **Backend**: `PATCH /marches/{id}/assign` (body-based)
- **Action**: Fix to send body instead of query param

## Files to modify

**`src/lib/api.ts`** — All fixes above

**Pages using removed methods** — Search for usages and remove/comment out:
- `conventionApi.update` → used in Conventions page for AC modification
- `conventionApi.deleteDocument` → used in Conventions page
- `utilisateurApi.update/delete/resetPassword` → used in Utilisateurs page
- `avenantApi.getAll/getById` → used in Modifications page

Since the backend doesn't support these operations, the UI buttons/actions calling them should be disabled or hidden to avoid runtime errors. We'll keep the method signatures but add `// NOT SUPPORTED BY BACKEND` comments, or remove them and update the UI to hide those actions.

## Approach

Given that some of these methods (convention update, user management) are actively used in the UI, I'll:
1. Fix the URL mismatches (convention getByStatut)
2. Remove truly non-existent endpoints (avenant getAll/getById)
3. Add missing endpoints (cloture documents)
4. Keep convention update/deleteDocument and user update/delete/resetPassword but mark them clearly — since the UI relies on them, removing would break features. The backend team may add them later.
5. Fix marche assign format

