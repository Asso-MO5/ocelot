# Configuration WebSocket en Production

## Problèmes identifiés et solutions

### 1. Configuration CORS ✅ (Corrigé dans le code)

- La route WebSocket `/` est maintenant dans la liste des routes publiques
- Les headers WebSocket sont autorisés dans CORS

### 2. Configuration Nginx (Reverse Proxy)

Si vous utilisez Nginx comme reverse proxy, vous devez configurer le support WebSocket :

```nginx
server {
    listen 443 ssl http2;
    server_name ocelot.mo5.com;

    # ... configuration SSL ...

    location / {
        proxy_pass http://localhost:3000;  # Port de votre application
        proxy_http_version 1.1;

        # Headers essentiels pour WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts pour WebSocket (important pour les connexions longues)
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;

        # Cache désactivé pour WebSocket
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Configuration Apache (si utilisé)

Si vous utilisez Apache avec mod_proxy :

```apache
<VirtualHost *:443>
    ServerName ocelot.mo5.com

    # ... configuration SSL ...

    ProxyPreserveHost On
    ProxyRequests Off

    # Configuration WebSocket
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:3000/$1" [P,L]

    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # Headers pour WebSocket
    ProxyPass / ws://localhost:3000/
    ProxyPassReverse / ws://localhost:3000/
</VirtualHost>
```

### 4. Variables d'environnement

Assurez-vous que `CORS_ORIGINS` inclut votre domaine de production :

```env
CORS_ORIGINS=https://ocelot.mo5.com,https://www.ocelot.mo5.com
```

### 5. Test de connexion WebSocket

Pour tester si WebSocket fonctionne :

```javascript
// Dans la console du navigateur
const ws = new WebSocket('wss://ocelot.mo5.com/')
ws.onopen = () => console.log('WebSocket connecté !')
ws.onerror = (error) => console.error('Erreur WebSocket:', error)
ws.onmessage = (event) => console.log('Message reçu:', event.data)
```

### 6. Vérification des logs

Vérifiez les logs du serveur pour voir si les connexions WebSocket sont acceptées :

```bash
# Les logs devraient afficher :
# "Client connected from ..."
# "Total connections: X"
```

### 7. Problèmes courants

- **Erreur 502 Bad Gateway** : Le reverse proxy ne supporte pas WebSocket → Configurer Nginx/Apache
- **Erreur de connexion** : CORS bloque → Vérifier `CORS_ORIGINS`
- **Connexion fermée immédiatement** : Timeout du proxy → Augmenter `proxy_read_timeout`
- **SSL/TLS** : Utiliser `wss://` (WebSocket Secure) en production, pas `ws://`
