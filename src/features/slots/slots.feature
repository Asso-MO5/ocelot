Feature: Gestion des créneaux horaires (slots)
  En tant que visiteur ou administrateur
  Je veux pouvoir consulter les créneaux horaires disponibles
  Afin de réserver un créneau pour visiter le musée

  Background:
    Étant donné que la base de données est configurée
    Et que le serveur est démarré
    Et que des horaires d'ouverture sont configurés

  Scenario: Récupérer les créneaux pour une date avec horaires d'ouverture
    Étant donné qu'un horaire d'ouverture existe pour cette date
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et la réponse contient date
    Et la réponse contient un tableau slots
    Et chaque slot contient start_time, end_time, capacity, booked, available, occupancy_percentage, is_half_price
    Et la réponse contient total_capacity, total_booked, total_available

  Scenario: Récupérer les créneaux pour une date sans horaires
    Étant donné qu'aucun horaire d'ouverture n'existe pour cette date
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et la réponse contient slots = []
    Et la réponse contient total_capacity = 0, total_booked = 0, total_available = 0

  Scenario: Récupérer les créneaux pour une date avec fermeture
    Étant donné qu'un horaire de fermeture existe pour cette date
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et la réponse contient slots = []
    Et la réponse contient total_capacity = 0, total_booked = 0, total_available = 0

  Scenario: Erreur si le paramètre date est manquant
    Quand je fais une requête GET vers "/museum/slots"
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur "Le paramètre date est requis"

  Scenario: Erreur si le format de date est invalide
    Quand je fais une requête GET vers "/museum/slots?date=25-12-2024"
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que le format de date est invalide

  Scenario: Les créneaux complets ont is_half_price = false
    Étant donné qu'un horaire d'ouverture existe de 14:00:00 à 18:00:00
    Et que slot_capacity = 2 heures
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et les créneaux qui commencent à une heure pile et ont une durée de 2h ont is_half_price = false

  Scenario: Les créneaux incomplets ont is_half_price = true
    Étant donné qu'un horaire d'ouverture existe de 14:00:00 à 17:30:00
    Et que slot_capacity = 2 heures
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et le dernier créneau (qui a une durée < 2h) a is_half_price = true

  Scenario: Les créneaux affichent le nombre de tickets réservés
    Étant donné qu'un horaire d'ouverture existe
    Et que des tickets sont réservés pour cette date
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et chaque slot contient booked avec le nombre de tickets qui commencent à cette heure
    Et chaque slot contient available = capacity - booked

  Scenario: Les créneaux affichent le pourcentage d'occupation
    Étant donné qu'un horaire d'ouverture existe avec capacity = 90
    Et que 45 tickets sont réservés pour un créneau
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et le slot correspondant a occupancy_percentage = 50

  Scenario: Le total_booked compte uniquement les tickets uniques de la journée
    Étant donné qu'un horaire d'ouverture existe
    Et que plusieurs tickets sont réservés pour cette date
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et total_booked correspond au nombre de tickets uniques (sans doublon)

  Scenario: Le total_available est calculé correctement
    Étant donné qu'un horaire d'ouverture existe avec plusieurs créneaux
    Et que des tickets sont réservés
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et total_available = total_capacity - total_booked

  Scenario: Les créneaux sont générés par tranche horaire
    Étant donné qu'un horaire d'ouverture existe de 14:00:00 à 18:00:00
    Et que slot_capacity = 2 heures
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et les créneaux générés sont : 14:00-16:00, 15:00-17:00, 16:00-18:00

  Scenario: Les exceptions d'horaire sont priorisées
    Étant donné qu'un horaire récurrent existe
    Et qu'une exception d'horaire existe pour cette date
    Quand je fais une requête GET vers "/museum/slots?date=2024-12-25"
    Alors je reçois une réponse 200
    Et les créneaux sont générés selon l'exception et non l'horaire récurrent
