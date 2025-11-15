Feature: Gestion des tarifs du musée
  En tant qu'administrateur
  Je veux pouvoir gérer les tarifs d'entrée du musée
  Afin de communiquer les prix au public et aux membres

  Background:
    Étant donné que la base de données est configurée
    Et que le serveur est démarré

  Scenario: Créer un tarif pour le public
    Étant donné que je veux créer un tarif pour le public
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis un name
    Et que je fournis un amount en euros
    Et que je fournis audience_type = "public"
    Alors je reçois une réponse 201
    Et la réponse contient le tarif créé avec un id
    Et la réponse contient name, amount, audience_type

  Scenario: Créer un tarif pour les membres
    Étant donné que je veux créer un tarif pour les membres
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis un name
    Et que je fournis un amount en euros
    Et que je fournis audience_type = "member"
    Alors je reçois une réponse 201
    Et la réponse contient le tarif créé avec audience_type = "member"

  Scenario: Créer un tarif avec dates de validité
    Étant donné que je veux créer un tarif valide pour une période spécifique
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis start_date et end_date
    Et que je fournis name, amount, audience_type
    Alors je reçois une réponse 201
    Et la réponse contient start_date et end_date

  Scenario: Créer un tarif inactif
    Étant donné que je veux créer un tarif inactif
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis is_active = false
    Et que je fournis name, amount, audience_type
    Alors je reçois une réponse 201
    Et la réponse contient is_active = false

  Scenario: Créer un tarif nécessitant un justificatif
    Étant donné que je veux créer un tarif réduit nécessitant un justificatif
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis requires_proof = true
    Et que je fournis name, amount, audience_type
    Alors je reçois une réponse 201
    Et la réponse contient requires_proof = true

  Scenario: Erreur lors de la création d'un tarif avec montant négatif
    Étant donné que je veux créer un tarif
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis un amount négatif
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que le montant doit être positif

  Scenario: Erreur lors de la création d'un tarif avec dates invalides
    Étant donné que je veux créer un tarif avec dates
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis start_date sans end_date
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que start_date et end_date doivent être définis ensemble

  Scenario: Erreur lors de la création d'un tarif avec start_date après end_date
    Étant donné que je veux créer un tarif avec dates
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis start_date après end_date
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que start_date doit être antérieure à end_date

  Scenario: Récupérer tous les tarifs actifs
    Étant donné que des tarifs existent en base de données
    Quand je fais une requête GET vers "/museum/prices"
    Alors je reçois une réponse 200
    Et la réponse contient un tableau de tarifs
    Et tous les tarifs retournés ont is_active = true

  Scenario: Récupérer les tarifs filtrés par type d'audience
    Étant donné que des tarifs existent pour public et member
    Quand je fais une requête GET vers "/museum/prices?audience_type=public"
    Alors je reçois une réponse 200
    Et tous les tarifs retournés ont audience_type = "public"

  Scenario: Récupérer les tarifs valides pour une date spécifique
    Étant donné que des tarifs existent avec et sans dates de validité
    Quand je fais une requête GET vers "/museum/prices?date=2024-12-25"
    Alors je reçois une réponse 200
    Et la réponse contient les tarifs sans dates de validité
    Et la réponse contient les tarifs dont les dates de validité couvrent la date demandée

  Scenario: Récupérer un tarif par son ID
    Étant donné qu'un tarif existe avec un id spécifique
    Quand je fais une requête GET vers "/museum/prices/:id"
    Alors je reçois une réponse 200
    Et la réponse contient le tarif avec l'id demandé

  Scenario: Erreur lors de la récupération d'un tarif inexistant
    Étant donné qu'aucun tarif n'existe avec cet id
    Quand je fais une requête GET vers "/museum/prices/:id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Tarif non trouvé"

  Scenario: Mettre à jour un tarif
    Étant donné qu'un tarif existe
    Quand je fais une requête PUT vers "/museum/prices/:id"
    Et que je fournis les champs à mettre à jour
    Alors je reçois une réponse 200
    Et la réponse contient le tarif mis à jour

  Scenario: Désactiver un tarif
    Étant donné qu'un tarif existe
    Quand je fais une requête PUT vers "/museum/prices/:id"
    Et que je fournis is_active = false
    Alors je reçois une réponse 200
    Et la réponse contient is_active = false

  Scenario: Supprimer un tarif
    Étant donné qu'un tarif existe
    Quand je fais une requête DELETE vers "/museum/prices/:id"
    Alors je reçois une réponse 204
    Et le tarif est supprimé de la base de données

  Scenario: Erreur lors de la suppression d'un tarif inexistant
    Étant donné qu'aucun tarif n'existe avec cet id
    Quand je fais une requête DELETE vers "/museum/prices/:id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Tarif non trouvé"

  Scenario: Accès non autorisé pour créer un tarif sans authentification
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête POST vers "/museum/prices"
    Alors je reçois une réponse 401
    Et la réponse contient un message d'erreur "Non authentifié"

  Scenario: Accès non autorisé pour créer un tarif sans les rôles requis
    Étant donné que je suis authentifié mais sans les rôles bureau ou dev
    Quand je fais une requête POST vers "/museum/prices"
    Alors je reçois une réponse 403
    Et la réponse contient un message d'erreur "Accès refusé : rôle insuffisant"
