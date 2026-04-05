

## Plan : Corriger le CORS / ngrok pour SockJS WebSocket

### Problème

SockJS effectue une requête HTTP `GET /ws/info` avant d'établir la connexion WebSocket. Sur ngrok (plan gratuit), cette requête reçoit la page d'avertissement au lieu de la réponse JSON attendue, car le header `ngrok-skip-browser-warning` n'est pas envoyé. SockJS ne permet pas d'injecter des headers HTTP personnalisés.

### Solution

**Fichier : `src/hooks/useNotifications.ts`**

Remplacer `SockJS` par une **WebSocket native** dans `webSocketFactory`. Cela permet d'utiliser l'URL `wss://` directe (sans le roundtrip `/info` de SockJS) et d'éviter complètement le blocage ngrok.

Étapes :
1. Construire l'URL WebSocket en remplaçant `https://` par `wss://` sur `WS_BASE`
2. Ajouter le token en query param
3. Supprimer l'import et l'usage de `sockjs-client`

```typescript
// Avant
webSocketFactory: () => new SockJS(WS_BASE + "?token=...")

// Après
webSocketFactory: () => {
  const wsUrl = WS_BASE.replace(/^https/, "wss").replace(/^http/, "ws")
    + "?token=" + encodeURIComponent(user.token);
  return new WebSocket(wsUrl);
}
```

Cela élimine le problème `/ws/info` bloqué par ngrok. Le backend Spring accepte déjà les connexions WebSocket natives via le endpoint `/ws`.

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useNotifications.ts` | Remplacer SockJS par WebSocket natif |

