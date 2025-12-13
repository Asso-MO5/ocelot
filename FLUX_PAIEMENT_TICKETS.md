# Flux de Création de Tickets avec Paiement

## 📋 Vue d'ensemble

Le système permet de créer plusieurs tickets avec paiement via Stripe. Le flux complet se déroule en plusieurs étapes synchrones et asynchrones.

## 🔄 Flux Complet

### 1. **Requête Frontend → Backend**

```
POST /museum/tickets/payment
```

**Body de la requête :**

```json
{
  "email": "visiteur@example.com",
  "first_name": "Jean",
  "last_name": "Dupont",
  "language": "fr",
  "tickets": [
    {
      "reservation_date": "2024-12-25",
      "slot_start_time": "14:00:00",
      "slot_end_time": "16:00:00",
      "ticket_price": 10,
      "donation_amount": 5,
      "pricing_info": {
        "price_id": "uuid",
        "price_name": "Tarif plein",
        "price_amount": 10,
        "audience_type": "public"
      }
    }
  ],
  "gift_codes": ["ABC123DEF456"], // Optionnel
  "guided_tour": true, // Optionnel
  "guided_tour_price": 5, // Optionnel
  "currency": "EUR", // Optionnel, défaut: EUR
  "description": "Réservation...", // Optionnel
  "success_url": "https://.../success?session_id={CHECKOUT_SESSION_ID}", // OBLIGATOIRE
  "cancel_url": "https://.../cancel" // OBLIGATOIRE
}
```

### 2. **Validations Backend** (`createTicketsWithPayment`)

#### 2.1 Validations de base

- ✅ Email obligatoire
- ✅ Au moins 1 ticket, maximum 10 tickets
- ✅ Dates et heures valides pour chaque ticket
- ✅ Prix positifs ou nuls

#### 2.2 Validation des tickets membres

Si des tickets membres sont détectés (`price_name` contient "membre") :

- ✅ Vérification de l'adhésion via API Galette (`GALETTE_URL` + `GALETTE_API_TOKEN`)
- ✅ Limitation du nombre de places gratuites selon le nombre d'enfants + 1 (parent)
- ✅ Vérification de la limite : 1 réservation par semaine pour les membres

#### 2.3 Validation des codes cadeaux

Si des codes cadeaux sont fournis :

- ✅ Validation de chaque code (format, existence, non utilisé)
- ✅ Application automatique aux tickets les plus chers en premier
- ✅ 1 code = 1 place gratuite

#### 2.4 Validation de la visite guidée

Si `guided_tour: true` :

- ✅ Vérification du prix via les settings
- ✅ Le prix est appliqué à **chaque ticket** (pas réparti)

#### 2.5 Calcul du montant total

- Somme de tous les `ticket_price` + `donation_amount`
- - Prix visite guidée × nombre de tickets (si activée)
- Ajustement automatique pour créneaux incomplets (demi-tarif)

### 3. **Création du Checkout Stripe** (si montant > 0)

**⚠️ NOTE ACTUELLE :** Le code contient `const isFreeOrder = true;` (ligne 1122), ce qui **désactive temporairement le paiement**. Tous les tickets sont créés avec le statut `paid` directement.

**Quand le paiement sera réactivé :**

```typescript
// Création de la session Stripe
const session = await createCheckout(
  app,
  totalAmount,
  description,
  currency,
  data.success_url, // URL frontend après succès
  data.cancel_url, // URL frontend après annulation
  { checkout_type: 'tickets' }
)
```

**Réponse Stripe :**

```json
{
  "id": "cs_...", // session_id
  "url": "https://...", // URL de redirection Stripe
  "amount_total": 1500, // En centimes
  "currency": "eur",
  "status": "open"
}
```

### 4. **Création des Tickets en Base de Données**

Tous les tickets sont créés dans une **transaction PostgreSQL** (tout ou rien) :

```sql
INSERT INTO tickets (
  qr_code,              -- Code QR unique (8 caractères)
  first_name,
  last_name,
  email,
  reservation_date,
  slot_start_time,
  slot_end_time,
  checkout_id,          -- session_id Stripe (ou index si gratuit)
  checkout_reference,   -- Référence du checkout
  transaction_status,   -- Statut de la transaction
  ticket_price,
  donation_amount,
  guided_tour_price,
  total_amount,
  status,               -- 'pending' si paiement requis, 'paid' si gratuit
  notes,                -- JSON avec pricing_info
  language
) VALUES (...)
```

**Statut initial :**

- Si `totalAmount === 0` → `status = 'paid'` (gratuit)
- Sinon → `status = 'pending'` (en attente de paiement)

### 5. **Réponse au Frontend**

```json
{
  "checkout_id": "cs_...",        // null si gratuit
  "checkout_reference": "cs_...", // null si gratuit
  "checkout_url": "https://...",  // null si gratuit
  "tickets": [
    {
      "id": "uuid",
      "qr_code": "ABC12345",
      "email": "visiteur@example.com",
      "reservation_date": "2024-12-25",
      "slot_start_time": "14:00:00",
      "slot_end_time": "16:00:00",
      "status": "pending",  // ou "paid" si gratuit
      "ticket_price": 10,
      "donation_amount": 5,
      "total_amount": 15,
      ...
    }
  ]
}
```

### 6. **Redirection vers Stripe** (Frontend)

Si `checkout_url` est fourni :

```javascript
window.location.href = checkout_url
```

L'utilisateur est redirigé vers la page de paiement Stripe.

### 7. **Paiement sur Stripe**

L'utilisateur paie sur la page Stripe.

### 8. **Redirection après Paiement** (Stripe → Frontend)

- **Succès** : Redirection vers `success_url` avec `?session_id=cs_...`
- **Annulation** : Redirection vers `cancel_url`

### 9. **Webhook Stripe** (Asynchrone)

Stripe envoie un webhook à :

```
POST /pay/webhook
```

**Événements traités :**

- `checkout.session.completed` → Statut `PAID` ou `PENDING`
- `checkout.session.expired` → Statut `CANCELLED`
- `checkout.session.async_payment_succeeded` → Statut `PAID`
- `checkout.session.async_payment_failed` → Statut `FAILED`
- `payment_intent.succeeded` → Statut `PAID`
- `payment_intent.payment_failed` → Statut `FAILED`

**Actions automatiques du webhook :**

1. **Vérification de signature** (sécurité)

   ```typescript
   verifyWebhookSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET)
   ```

2. **Mise à jour des tickets**

   ```typescript
   updateTicketsByCheckoutStatus(
     app,
     sessionId,
     checkoutStatus,
     transactionCode
   )
   ```

   - Met à jour `status` : `pending` → `paid` (ou `cancelled`)
   - Met à jour `transaction_status` avec le code de transaction

3. **Envoi d'emails de confirmation** (si `PAID`)

   ```typescript
   sendTicketsConfirmationEmails(app, tickets)
   ```

   - Email avec PDF des tickets
   - Un email par ticket

4. **Génération et envoi des certificats de don** (si `donation_amount > 0`)

   ```typescript
   generateDonationProofFromTicket(ticket)
   ```

   - Génère un PDF CERFA 11580
   - Envoie par email avec le certificat en pièce jointe

5. **Notification WebSocket**
   ```typescript
   app.ws.send('tickets_stats', 'refetch')
   ```
   - Notifie les clients connectés de rafraîchir les statistiques

### 10. **Vérification du Statut** (Frontend - Optionnel)

Le frontend peut vérifier le statut du paiement :

```
GET /pay/checkout/:sessionId
```

**Réponse :**

```json
{
  "id": "cs_...",
  "amount_total": 1500,
  "currency": "eur",
  "status": "complete",
  "payment_status": "paid",
  "payment_intent": "pi_..."
}
```

### 11. **Validation du Ticket** (Scan QR)

Quand le visiteur arrive au musée :

```
POST /museum/tickets/validate
{
  "qr_code": "ABC12345"
}
```

**Validations effectuées :**

- ✅ Ticket existe
- ✅ Ticket non déjà utilisé
- ✅ Statut = `paid`
- ✅ Date de réservation = aujourd'hui (timezone Europe/Paris)
- ✅ Heure actuelle dans le créneau (avec tolérance de 30 min)

**Actions :**

- Marque le ticket comme `used`
- Met à jour `used_at` avec le timestamp
- Notifie via WebSocket (`capacity` room)

## 🔍 Points Importants

### ⚠️ État Actuel

- **Paiement désactivé** : `isFreeOrder = true` (ligne 1122)
- Tous les tickets sont créés avec `status = 'paid'` directement
- Pas de checkout Stripe créé
- Emails envoyés immédiatement

### ✅ Quand le Paiement sera Réactivé

1. Changer `const isFreeOrder = true;` → `const isFreeOrder = totalAmount === 0;`
2. Décommenter le return avec `checkout_url` (lignes 1249-1257)
3. Supprimer le return actuel (lignes 1243-1247)

### 🔐 Sécurité

- Vérification de signature des webhooks Stripe (HMAC SHA256)
- Validation des tarifs avant création
- Transaction PostgreSQL pour garantir l'intégrité
- Validation des codes cadeaux avant utilisation

### 📧 Emails

- **Commandes gratuites** : Email envoyé immédiatement après création
- **Commandes payantes** : Email envoyé après confirmation du paiement (webhook)
- **Certificats de don** : Envoyés automatiquement si `donation_amount > 0`

### 🎫 Codes Cadeaux

- Validation avant création des tickets
- Application automatique aux tickets les plus chers
- Marquage comme utilisé après création réussie

### 👥 Tickets Membres

- Vérification de l'adhésion via API Galette
- Limitation selon le nombre d'enfants
- Limite : 1 réservation par semaine

### ⏰ Timezone

- Validation des tickets utilise le timezone **Europe/Paris** (via PostgreSQL)
- Pas de décalage horaire même si le serveur est en UTC
