# Tester les Webhooks Stripe en Local

## 🎯 Solutions pour tester les webhooks en local

Il y a plusieurs façons de tester les webhooks Stripe en local. La plus simple est d'utiliser la **Stripe CLI**.

## ✅ Solution 1 : Stripe CLI (Recommandée)

### Installation

```bash
# Windows (avec Scoop)
scoop install stripe

# Ou télécharger depuis : https://stripe.com/docs/stripe-cli
```

### Configuration

1. **Se connecter à Stripe CLI**

   ```bash
   stripe login
   ```

   Cela ouvre votre navigateur pour vous authentifier.

2. **Forwarder les webhooks vers votre serveur local**

   ```bash
   stripe listen --forward-to localhost:3000/pay/webhook
   ```

   La CLI affichera quelque chose comme :

   ```
   > Ready! Your webhook signing secret is whsec_... (^C to quit)
   ```

3. **Copier le secret de signature**
   Copiez le `whsec_...` affiché et ajoutez-le dans votre `.env.local` :

   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. **Déclencher des événements de test**

   ```bash
   # Simuler un paiement réussi
   stripe trigger checkout.session.completed

   # Simuler un paiement échoué
   stripe trigger payment_intent.payment_failed

   # Simuler une session expirée
   stripe trigger checkout.session.expired
   ```

### Avantages

- ✅ Simple et rapide
- ✅ Pas besoin de tunnel public
- ✅ Événements de test réalistes
- ✅ Secret de signature valide

## 🔧 Solution 2 : ngrok (Tunnel public)

Si vous préférez utiliser un tunnel public :

### Installation

```bash
# Télécharger depuis : https://ngrok.com/download
# Ou avec npm
npm install -g ngrok
```

### Utilisation

1. **Démarrer votre serveur local**

   ```bash
   yarn dev
   # Serveur sur http://localhost:3000
   ```

2. **Créer un tunnel**

   ```bash
   ngrok http 3000
   ```

   Cela affichera :

   ```
   Forwarding  https://abc123.ngrok.io -> http://localhost:3000
   ```

3. **Configurer le webhook dans Stripe Dashboard**

   - Aller dans **Developers → Webhooks**
   - Cliquer sur **Add endpoint**
   - URL : `https://abc123.ngrok.io/pay/webhook`
   - Sélectionner les événements à écouter
   - Copier le **Signing secret** dans `.env.local`

4. **Tester**
   - Créer une session de checkout de test
   - Effectuer un paiement de test
   - Le webhook sera envoyé via ngrok

### Inconvénients

- ⚠️ URL change à chaque redémarrage (gratuit)
- ⚠️ Nécessite une configuration dans Stripe Dashboard
- ⚠️ Plus lent que Stripe CLI

## 🧪 Solution 3 : Tester manuellement (Simulation)

Pour tester la logique sans Stripe réel :

### Créer un script de test

```typescript
// test-webhook.ts
import { FastifyInstance } from 'fastify'
import { webhookHandler } from './src/features/pay/pay.ctrl.ts'

// Simuler un webhook checkout.session.completed
const mockWebhook = {
  id: 'evt_test_123',
  type: 'checkout.session.completed',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'cs_test_123', // session_id
      object: 'checkout.session',
      amount_total: 1500,
      currency: 'eur',
      status: 'complete',
      payment_status: 'paid',
      payment_intent: 'pi_test_123',
    },
  },
}

// Appeler le handler directement
await webhookHandler(
  { body: mockWebhook, headers: {} } as any,
  { code: () => ({ send: (data) => console.log(data) }) } as any,
  app as FastifyInstance
)
```

### Inconvénients

- ⚠️ Ne teste pas la vérification de signature
- ⚠️ Nécessite de créer les tickets en base d'abord
- ⚠️ Moins réaliste

## 📝 Configuration pour les Tests

### Variables d'environnement (`.env.local`)

```env
# Clé de test Stripe (commence par sk_test_)
STRIPE_SECRET_KEY=sk_test_...

# Secret webhook (depuis Stripe CLI ou Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...

# Mode développement
NODE_ENV=development
```

### Créer une session de test

```bash
# Avec Stripe CLI
stripe checkout sessions create \
  --success-url "http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}" \
  --cancel-url "http://localhost:3000/cancel" \
  --mode payment \
  --line-items '[{"price_data":{"currency":"eur","product_data":{"name":"Test"},"unit_amount":1000},"quantity":1}]'
```

## 🎯 Workflow de Test Recommandé

1. **Démarrer le serveur local**

   ```bash
   yarn dev
   ```

2. **Dans un autre terminal, lancer Stripe CLI**

   ```bash
   stripe listen --forward-to localhost:3000/pay/webhook
   ```

3. **Copier le secret dans `.env.local`**

   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. **Créer des tickets via l'API**

   ```bash
   curl -X POST http://localhost:3000/museum/tickets/payment \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "tickets": [...],
       "success_url": "http://localhost:3000/success",
       "cancel_url": "http://localhost:3000/cancel"
     }'
   ```

5. **Déclencher un événement de test**

   ```bash
   stripe trigger checkout.session.completed
   ```

6. **Vérifier les logs du serveur**
   - Les tickets doivent être mis à jour
   - Les emails doivent être envoyés
   - Les certificats de don doivent être générés

## 🔍 Vérification

### Logs à surveiller

```bash
# Dans les logs du serveur, vous devriez voir :
✅ Session Stripe créée
✅ Webhook traité avec succès
✅ Tickets mis à jour: X
✅ Emails de confirmation envoyés
✅ Certificats de don générés (si applicable)
```

### Vérifier en base de données

```sql
-- Vérifier que les tickets sont passés de 'pending' à 'paid'
SELECT id, qr_code, status, transaction_status, checkout_id
FROM tickets
WHERE checkout_id = 'cs_test_123';
```

## ⚠️ Points d'Attention

1. **Secret de signature différent**

   - Le secret de Stripe CLI est différent de celui de production
   - Utiliser le bon secret selon l'environnement

2. **Mode test vs production**

   - Utiliser les clés `sk_test_...` en local
   - Les webhooks de test n'affectent pas la production

3. **Session ID de test**
   - Les sessions créées en local ont des IDs de test (`cs_test_...`)
   - S'assurer que les tickets en base utilisent le bon `checkout_id`

## 🚀 Alternative : Endpoint de Test

Vous pouvez aussi créer un endpoint de test pour simuler les webhooks :

```typescript
// Dans pay.ctrl.ts (uniquement en développement)
if (process.env.NODE_ENV === 'development') {
  app.post('/pay/webhook/test', async (req, reply) => {
    const { sessionId, status } = req.body
    // Simuler un webhook
    const mockWebhook = {
      id: 'evt_test',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: sessionId,
          payment_status: status === 'paid' ? 'paid' : 'unpaid',
          status: 'complete',
        },
      },
    }
    return webhookHandler({ body: mockWebhook, headers: {} } as any, reply, app)
  })
}
```

## 📚 Ressources

- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks Locally](https://stripe.com/docs/webhooks/test)
- [Stripe Testing](https://stripe.com/docs/testing)
