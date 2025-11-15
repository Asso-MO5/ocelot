Feature: Gestion des horaires du musée
  En tant qu'administrateur
  Je veux pouvoir gérer les horaires d'ouverture du musée
  Afin de communiquer les heures d'ouverture au public et aux membres

  Background:
    Étant donné que la base de données est configurée
    Et que le serveur est démarré

  Scenario: Créer un horaire récurrent pour le public
    Étant donné que je veux créer un horaire récurrent
    Quand je fais une requête POST vers "/museum/schedules"
    Et que je fournis un day_of_week (0-6)
    Et que je fournis start_time et end_time
    Et que je fournis audience_type = "public"
    Alors je reçois une réponse 201
    Et la réponse contient l'horaire créé avec un id
    Et la réponse contient day_of_week, start_time, end_time, audience_type

  Scenario: Créer un horaire récurrent pour les membres
    Étant donné que je veux créer un horaire récurrent pour les membres
    Quand je fais une requête POST vers "/museum/schedules"
    Et que je fournis un day_of_week (0-6)
    Et que je fournis start_time et end_time
    Et que je fournis audience_type = "member"
    Alors je reçois une réponse 201
    Et la réponse contient l'horaire créé avec audience_type = "member"

  Scenario: Créer une exception (horaires spécifiques pour une période)
    Étant donné que je veux créer une exception pour les vacances
    Quand je fais une requête POST vers "/museum/schedules"
    Et que je fournis is_exception = true
    Et que je fournis start_date et end_date
    Et que je fournis start_time et end_time
    Et que je fournis audience_type
    Alors je reçois une réponse 201
    Et la réponse contient is_exception = true
    Et la réponse contient start_date et end_date

  Scenario: Créer une fermeture exceptionnelle
    Étant donné que je veux créer une fermeture exceptionnelle
    Quand je fais une requête POST vers "/museum/schedules"
    Et que je fournis is_exception = true
    Et que je fournis is_closed = true
    Et que je fournis start_date et end_date
    Et que je fournis une description
    Alors je reçois une réponse 201
    Et la réponse contient is_closed = true
    Et la réponse contient la description

  Scenario: Erreur lors de la création d'un horaire récurrent sans day_of_week
    Étant donné que je veux créer un horaire récurrent
    Quand je fais une requête POST vers "/museum/schedules"
    Et que je ne fournis pas day_of_week
    Et que is_exception = false
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que day_of_week est requis

  Scenario: Erreur lors de la création d'une exception sans dates
    Étant donné que je veux créer une exception
    Quand je fais une requête POST vers "/museum/schedules"
    Et que je fournis is_exception = true
    Et que je ne fournis pas start_date ou end_date
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que start_date et end_date sont requis

  Scenario: Récupérer tous les horaires
    Étant donné que des horaires existent en base de données
    Quand je fais une requête GET vers "/museum/schedules"
    Alors je reçois une réponse 200
    Et la réponse contient un tableau d'horaires

  Scenario: Récupérer les horaires filtrés par jour de la semaine
    Étant donné que des horaires existent pour différents jours
    Quand je fais une requête GET vers "/museum/schedules?day_of_week=1"
    Alors je reçois une réponse 200
    Et tous les horaires retournés ont day_of_week = 1

  Scenario: Récupérer les horaires filtrés par type d'audience
    Étant donné que des horaires existent pour public et member
    Quand je fais une requête GET vers "/museum/schedules?audience_type=public"
    Alors je reçois une réponse 200
    Et tous les horaires retournés ont audience_type = "public"

  Scenario: Récupérer les horaires pour une date spécifique
    Étant donné que des horaires récurrents et des exceptions existent
    Quand je fais une requête GET vers "/museum/schedules?date=2024-12-25"
    Alors je reçois une réponse 200
    Et la réponse contient les horaires récurrents pour le jour de la semaine de cette date
    Et la réponse contient les exceptions qui couvrent cette date

  Scenario: Récupérer un horaire par son ID
    Étant donné qu'un horaire existe avec un id spécifique
    Quand je fais une requête GET vers "/museum/schedules/:id"
    Alors je reçois une réponse 200
    Et la réponse contient l'horaire avec l'id demandé

  Scenario: Erreur lors de la récupération d'un horaire inexistant
    Étant donné qu'aucun horaire n'existe avec cet id
    Quand je fais une requête GET vers "/museum/schedules/:id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Horaire non trouvé"

  Scenario: Mettre à jour un horaire
    Étant donné qu'un horaire existe
    Quand je fais une requête PUT vers "/museum/schedules/:id"
    Et que je fournis les champs à mettre à jour
    Alors je reçois une réponse 200
    Et la réponse contient l'horaire mis à jour

  Scenario: Supprimer un horaire
    Étant donné qu'un horaire existe
    Quand je fais une requête DELETE vers "/museum/schedules/:id"
    Alors je reçois une réponse 204
    Et l'horaire est supprimé de la base de données

  Scenario: Erreur lors de la suppression d'un horaire inexistant
    Étant donné qu'aucun horaire n'existe avec cet id
    Quand je fais une requête DELETE vers "/museum/schedules/:id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Horaire non trouvé"
