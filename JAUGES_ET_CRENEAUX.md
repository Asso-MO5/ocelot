# Documentation : Système de Jauges et Créneaux

## Vue d'ensemble

Le système de gestion des créneaux et jauges du musée permet de gérer la réservation de tickets avec des créneaux glissants (sliding slots) et des jauges horaires indépendantes. Cette documentation explique le fonctionnement détaillé du système avec les valeurs de production actuelles.

## Paramètres de production

- **Capacité quotidienne (`capacity`)**: **90 personnes**
- **Durée d'un créneau (`slot_capacity`)**: **2 heures**

## Concepts fondamentaux

### 1. Créneaux glissants (Sliding Slots)

Les créneaux sont générés de manière glissante, c'est-à-dire qu'ils commencent toutes les heures et se chevauchent.

**Exemple avec les paramètres de production (2h de durée)** :

Si le musée est ouvert de **14h à 18h**, les créneaux générés seront :

- **14h-16h** (créneau complet, 2h)
- **15h-17h** (créneau complet, 2h)
- **16h-18h** (créneau complet, 2h)
- **17h-18h** (créneau incomplet, 1h, demi-tarif)

**Règles de génération** :

- Les créneaux commencent à des heures pleines (14:00, 15:00, 16:00, etc.)
- Chaque créneau complet dure exactement `slot_capacity` heures (2h en production)
- Si il reste moins de `slot_capacity` heures avant la fermeture mais au moins 1 heure, un créneau incomplet est généré (demi-tarif)

### 2. Jauges horaires indépendantes (sans chevauchement)

**Principe fondamental** : Chaque créneau a sa propre jauge de **90 personnes**, indépendamment des autres créneaux. On ne tient **pas compte du chevauchement** entre créneaux.

**Règle de comptage** : On compte uniquement les tickets qui **commencent exactement** à l'heure de début du créneau. Chaque ticket n'est compté qu'une seule fois, dans le créneau où il commence.

**Pourquoi ?**

Avec une visite de 2 heures, si un visiteur arrive à 14h, il partira à 16h. Chaque créneau a sa propre jauge de 90 personnes, et on compte uniquement les visiteurs qui commencent leur visite à cette heure précise.

### 3. Comptage des tickets par créneau

Un ticket est compté dans un créneau **uniquement** s'il commence exactement à l'heure de début du créneau :

- `slot_start_time = heure_debut_du_créneau`

**Exemples concrets avec les paramètres de production** :

#### Créneau 14h-16h

| Ticket  | Compté ? | Raison                    |
| ------- | -------- | ------------------------- |
| 13h-15h | ❌ Non   | Ne commence pas à 14h     |
| 14h-16h | ✅ Oui   | Commence exactement à 14h |
| 15h-17h | ❌ Non   | Ne commence pas à 14h     |
| 16h-18h | ❌ Non   | Ne commence pas à 14h     |

#### Créneau 15h-17h

| Ticket  | Compté ? | Raison                    |
| ------- | -------- | ------------------------- |
| 13h-15h | ❌ Non   | Ne commence pas à 15h     |
| 14h-16h | ❌ Non   | Ne commence pas à 15h     |
| 15h-17h | ✅ Oui   | Commence exactement à 15h |
| 16h-18h | ❌ Non   | Ne commence pas à 15h     |

#### Créneau 16h-18h

| Ticket  | Compté ? | Raison                    |
| ------- | -------- | ------------------------- |
| 13h-15h | ❌ Non   | Ne commence pas à 16h     |
| 14h-16h | ❌ Non   | Ne commence pas à 16h     |
| 15h-17h | ❌ Non   | Ne commence pas à 16h     |
| 16h-18h | ✅ Oui   | Commence exactement à 16h |

## Scénario complet : Journée type

### Configuration

- **Ouverture** : 14h
- **Fermeture** : 18h
- **Capacité** : 90 personnes
- **Durée créneau** : 2h

### Créneaux générés

1. **14h-16h** (complet, plein tarif)
2. **15h-17h** (complet, plein tarif)
3. **16h-18h** (complet, plein tarif)
4. **17h-18h** (incomplet, demi-tarif)

### Exemple de réservations

Supposons les réservations suivantes :

- **10 tickets** pour 14h-16h
- **15 tickets** pour 15h-17h
- **20 tickets** pour 16h-18h
- **5 tickets** pour 17h-18h

### Calcul des jauges par créneau

#### Créneau 14h-16h

- Tickets qui commencent à 14h :
  - 10 tickets (14h-16h) ✅
- **Total** : 10 personnes
- **Disponible** : 90 - 10 = **80 places**
- **Taux d'occupation** : 11%

#### Créneau 15h-17h

- Tickets qui commencent à 15h :
  - 15 tickets (15h-17h) ✅
- **Total** : 15 personnes
- **Disponible** : 90 - 15 = **75 places**
- **Taux d'occupation** : 17%

#### Créneau 16h-18h

- Tickets qui commencent à 16h :
  - 20 tickets (16h-18h) ✅
- **Total** : 20 personnes
- **Disponible** : 90 - 20 = **70 places**
- **Taux d'occupation** : 22%

#### Créneau 17h-18h

- Tickets qui commencent à 17h :
  - 5 tickets (17h-18h) ✅
- **Total** : 5 personnes
- **Disponible** : 90 - 5 = **85 places**
- **Taux d'occupation** : 6%

### Total unique de tickets dans la journée

Le **total unique** de tickets pour la journée est : **50 tickets** (10 + 15 + 20 + 5).

**Cohérence** : La somme des créneaux (10 + 15 + 20 + 5 = 50) est égale au total unique, car chaque ticket n'est compté qu'une seule fois dans le créneau où il commence.

## Tarification

### Créneaux complets vs incomplets

- **Créneau complet** : Durée exactement égale à `slot_capacity` (2h), commence à une heure pleine
  - **Tarif** : Plein tarif (prix de base)
- **Créneau incomplet** : Durée inférieure à `slot_capacity` (ex: 1h), mais au moins 1 heure
  - **Tarif** : Demi-tarif (prix de base / 2, arrondi à l'inférieur)

**Exemple** :

- Prix de base : 10€
- Créneau 14h-16h (complet) : **10€**
- Créneau 17h-18h (incomplet) : **5€** (10€ / 2)

## Endpoints API

### 1. Récupérer les créneaux d'une date

**GET** `/museum/slots?date=YYYY-MM-DD`

**Réponse** :

```json
{
  "date": "2024-12-22",
  "slots": [
    {
      "start_time": "14:00:00",
      "end_time": "16:00:00",
      "capacity": 90,
      "booked": 10,
      "available": 80,
      "occupancy_percentage": 11,
      "is_half_price": false
    },
    {
      "start_time": "15:00:00",
      "end_time": "17:00:00",
      "capacity": 90,
      "booked": 25,
      "available": 65,
      "occupancy_percentage": 28,
      "is_half_price": false
    },
    {
      "start_time": "16:00:00",
      "end_time": "18:00:00",
      "capacity": 90,
      "booked": 35,
      "available": 55,
      "occupancy_percentage": 39,
      "is_half_price": false
    },
    {
      "start_time": "17:00:00",
      "end_time": "18:00:00",
      "capacity": 90,
      "booked": 25,
      "available": 65,
      "occupancy_percentage": 28,
      "is_half_price": true
    }
  ],
  "total_capacity": 360,
  "total_booked": 50,
  "total_available": 310
}
```

**Explication des champs** :

- `capacity` : Capacité maximale du créneau (90 en production)
- `booked` : Nombre de tickets qui commencent à cette heure (sans chevauchement)
- `available` : Places disponibles (capacity - booked)
- `occupancy_percentage` : Pourcentage d'occupation (0-100)
- `is_half_price` : `true` si créneau incomplet (demi-tarif)
- `total_capacity` : Nombre de créneaux × capacité (4 × 90 = 360)
- `total_booked` : Nombre unique de tickets dans la journée (50)
- `total_available` : Capacité totale - tickets uniques (360 - 50 = 310)

**Note importante** : La somme des `booked` de tous les créneaux est égale au `total_booked`, car chaque ticket n'est compté qu'une seule fois dans le créneau où il commence.

### 2. Statistiques hebdomadaires par créneau

**GET** `/museum/tickets/weekly-slots-stats` (protégé : dev, bureau)

**Réponse** :

```json
{
  "week_start": "2024-12-16",
  "week_end": "2024-12-22",
  "slots_stats": [
    {
      "date": "2024-12-22",
      "day_name": "lundi",
      "start_time": "14:00:00",
      "end_time": "16:00:00",
      "expected_people": 21,
      "capacity": 90,
      "occupancy_percentage": 23,
      "is_half_price": false
    },
    {
      "date": "2024-12-22",
      "day_name": "lundi",
      "start_time": "15:00:00",
      "end_time": "17:00:00",
      "expected_people": 60,
      "capacity": 90,
      "occupancy_percentage": 67,
      "is_half_price": false
    }
  ],
  "daily_totals": [
    {
      "date": "2024-12-22",
      "day_name": "lundi",
      "total_unique_tickets": 93
    }
  ]
}
```

**Explication** :

- `expected_people` : Nombre de personnes attendues (tickets pending + paid) qui commencent exactement à cette heure
- `daily_totals.total_unique_tickets` : Nombre unique de tickets attendus dans la journée (sans double comptage)

**Cohérence** : La somme des `expected_people` de tous les créneaux d'un jour est égale au `total_unique_tickets` de ce jour, car chaque ticket n'est compté qu'une seule fois.

### 3. Statistiques globales des tickets

**GET** `/museum/tickets/stats` (protégé : dev, bureau)

**Réponse** (extrait concernant les stats horaires) :

```json
{
  "hourly_stats": [
    {
      "start_time": "15:00:00",
      "tickets_count": 60,
      "percentage": 64.52
    },
    {
      "start_time": "16:00:00",
      "tickets_count": 65,
      "percentage": 69.89
    },
    {
      "start_time": "14:00:00",
      "tickets_count": 21,
      "percentage": 22.58
    }
  ]
}
```

**Explication** :

- `tickets_count` : Nombre de tickets **actifs** à cette heure (pas seulement ceux qui commencent à cette heure)
- `percentage` : Pourcentage par rapport au total de tickets vendus

## Implémentation technique

### Fonction de comptage des tickets par créneau

```typescript
// On compte uniquement les tickets qui commencent exactement à l'heure de début du créneau
// Pas de chevauchement : chaque ticket n'est compté qu'une seule fois

SELECT COUNT(*) as count
FROM tickets
WHERE reservation_date = $1
AND status IN ('pending', 'paid')
AND slot_start_time = $2
```

### Génération des créneaux

1. **Créneaux complets** : Générés toutes les heures, durée = `slot_capacity` (2h)
2. **Créneaux incomplets** : Générés si il reste au moins 1h mais moins de `slot_capacity` heures avant la fermeture

**Algorithme** :

```
Pour chaque heure de début (14h, 15h, 16h, ...) :
  Si (heure_debut + slot_capacity) <= heure_fermeture :
    Créer créneau complet (heure_debut → heure_debut + slot_capacity)
  Sinon si (heure_fermeture - heure_debut) >= 1h :
    Créer créneau incomplet (heure_debut → heure_fermeture)
```

## Cas limites et règles métier

### 1. Ticket qui commence exactement à l'heure de début d'un créneau

**Exemple** : Ticket 14h-16h, créneau 14h-16h

- Le ticket commence à **14h**
- Le créneau commence à **14h**
- **Résultat** : Le ticket **est compté** dans ce créneau car `slot_start_time = '14:00:00'`

### 2. Ticket qui commence à une autre heure

**Exemple** : Ticket 14h-16h, créneau 15h-17h

- Le ticket commence à **14h**
- Le créneau commence à **15h**
- **Résultat** : Le ticket **n'est pas compté** dans ce créneau car `14h ≠ 15h`

### 3. Capacité maximale par créneau

Chaque créneau a une capacité maximale de **90 personnes**. Si 90 tickets sont déjà actifs à une heure donnée, aucun nouveau ticket ne peut être réservé pour un créneau commençant à cette heure.

**Exemple** :

- 90 tickets actifs à 15h
- Un visiteur essaie de réserver pour 15h-17h
- **Résultat** : Réservation refusée, créneau complet

### 4. Total unique vs présences horaires

Il est important de distinguer :

- **Total unique de tickets** : Nombre réel de visiteurs dans la journée (chaque ticket compte une seule fois)
- **Présences horaires** : Nombre de tickets actifs à chaque heure (un même ticket peut compter plusieurs fois s'il couvre plusieurs heures)

**Exemple** :

- 50 tickets uniques dans la journée
- Mais ces tickets peuvent générer plus de 50 présences horaires car ils se chevauchent

## Questions fréquentes

### Q1 : Pourquoi ne pas tenir compte du chevauchement ?

**R** : Chaque créneau a sa propre jauge de 90 personnes. On compte uniquement les tickets qui commencent exactement à l'heure de début du créneau, donc chaque ticket n'est compté qu'une seule fois.

### Q2 : Que se passe-t-il si un créneau dépasse la capacité ?

**R** : Le système empêche la réservation si la jauge est pleine. Un ticket ne peut être réservé que si `booked < capacity` pour le créneau concerné.

### Q3 : Comment sont calculés les créneaux incomplets ?

**R** : Si il reste moins de 2h (en production) mais au moins 1h avant la fermeture, un créneau incomplet est généré. Il est facturé au demi-tarif.

### Q4 : Un ticket peut-il être compté dans plusieurs créneaux ?

**R** : Non, chaque ticket est compté uniquement dans le créneau où il commence (où `slot_start_time` correspond exactement à l'heure de début du créneau). La somme des créneaux est donc égale au total unique de tickets.

## Conclusion

Le système de jauges et créneaux permet une gestion flexible et précise de la capacité du musée avec des créneaux glissants. Chaque créneau a sa propre jauge indépendante de 90 personnes. On compte uniquement les tickets qui commencent exactement à l'heure de début du créneau, ce qui garantit que chaque ticket n'est compté qu'une seule fois et que la somme des créneaux est égale au total unique de tickets dans la journée.
