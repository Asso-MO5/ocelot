Feature: Gestion des tarifs du musée
  En tant qu'administrateur ou visiteur
  Je veux pouvoir gérer et consulter les tarifs d'entrée du musée
  Afin de communiquer les prix au public et aux membres

  Background:
    Étant donné que la base de données est configurée
    Et que le serveur est démarré

  Scenario: Créer un tarif pour le public
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis amount, audience_type="public" et translations avec au moins un name
    Alors je reçois une réponse 201
    Et la réponse contient le tarif créé avec un id
    Et la réponse contient amount, audience_type et translations

  Scenario: Créer un tarif pour les membres
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis amount, audience_type="member" et translations avec au moins un name
    Alors je reçois une réponse 201
    Et la réponse contient le tarif créé avec audience_type = "member"

  Scenario: Créer un tarif avec dates de validité
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis start_date et end_date valides
    Et que je fournis amount, audience_type et translations avec au moins un name
    Alors je reçois une réponse 201
    Et la réponse contient start_date et end_date

  Scenario: Créer un tarif inactif
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis is_active = false
    Et que je fournis amount, audience_type et translations avec au moins un name
    Alors je reçois une réponse 201
    Et la réponse contient is_active = false

  Scenario: Créer un tarif nécessitant un justificatif
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis requires_proof = true
    Et que je fournis amount, audience_type et translations avec au moins un name
    Alors je reçois une réponse 201
    Et la réponse contient requires_proof = true

  Scenario: Mettre à jour un tarif existant (upsert)
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un tarif existe avec un id spécifique
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis cet id avec les nouvelles données
    Alors je reçois une réponse 200
    Et la réponse contient le tarif mis à jour

  Scenario: Erreur lors de la création d'un tarif avec montant négatif
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis un amount négatif
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que le montant doit être positif

  Scenario: Erreur lors de la création d'un tarif avec dates invalides
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis start_date sans end_date
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que start_date et end_date doivent être définis ensemble

  Scenario: Erreur lors de la création d'un tarif avec start_date après end_date
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis start_date après end_date
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que start_date doit être antérieure à end_date

  Scenario: Erreur lors de la création d'un tarif sans traduction name
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Et que je fournis translations sans aucun champ name
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant qu'au moins une traduction pour le champ "name" est requise

  Scenario: Récupérer tous les tarifs actifs
    Étant donné que des tarifs existent en base de données
    Quand je fais une requête GET vers "/museum/prices?is_active=true"
    Alors je reçois une réponse 200
    Et la réponse contient un tableau de tarifs dans prices
    Et la réponse contient guided_tour_price
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

  Scenario: Récupérer les tarifs dans une langue spécifique
    Étant donné que des tarifs existent avec des traductions en français et anglais
    Quand je fais une requête GET vers "/museum/prices?lang=fr"
    Alors je reçois une réponse 200
    Et les tarifs contiennent les champs name et description dans la langue demandée

  Scenario: Récupérer un tarif par son ID
    Étant donné qu'un tarif existe avec un id spécifique
    Quand je fais une requête GET vers "/museum/prices/:id"
    Alors je reçois une réponse 200
    Et la réponse contient le tarif avec l'id demandé

  Scenario: Récupérer un tarif par son ID dans une langue spécifique
    Étant donné qu'un tarif existe avec des traductions
    Quand je fais une requête GET vers "/museum/prices/:id?lang=fr"
    Alors je reçois une réponse 200
    Et la réponse contient les champs name et description dans la langue demandée

  Scenario: Erreur lors de la récupération d'un tarif inexistant
    Étant donné qu'aucun tarif n'existe avec cet id
    Quand je fais une requête GET vers "/museum/prices/invalid-id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Tarif non trouvé"

  Scenario: Mettre à jour un tarif
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un tarif existe
    Quand je fais une requête PUT vers "/museum/prices/:id"
    Et que je fournis les champs à mettre à jour
    Alors je reçois une réponse 200
    Et la réponse contient le tarif mis à jour

  Scenario: Désactiver un tarif
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un tarif existe
    Quand je fais une requête PUT vers "/museum/prices/:id"
    Et que je fournis is_active = false
    Alors je reçois une réponse 200
    Et la réponse contient is_active = false

  Scenario: Erreur lors de la mise à jour d'un tarif inexistant
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'aucun tarif n'existe avec cet id
    Quand je fais une requête PUT vers "/museum/prices/invalid-id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Tarif non trouvé"

  Scenario: Supprimer un tarif
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un tarif existe
    Quand je fais une requête DELETE vers "/museum/prices/:id"
    Alors je reçois une réponse 204
    Et le tarif est supprimé de la base de données

  Scenario: Erreur lors de la suppression d'un tarif inexistant
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'aucun tarif n'existe avec cet id
    Quand je fais une requête DELETE vers "/museum/prices/invalid-id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Tarif non trouvé"

  Scenario: Réordonner les tarifs
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et que plusieurs tarifs existent
    Quand je fais une requête POST vers "/museum/prices/reorder"
    Et que je fournis un tableau price_ids dans l'ordre souhaité
    Alors je reçois une réponse 200
    Et la réponse contient les tarifs dans le nouvel ordre

  Scenario: Erreur lors du réordonnancement avec un tableau vide
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices/reorder"
    Et que je fournis un tableau price_ids vide
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que le tableau ne peut pas être vide

  Scenario: Erreur lors du réordonnancement avec des IDs invalides
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices/reorder"
    Et que je fournis un tableau price_ids contenant des IDs inexistants
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que des IDs sont invalides

  Scenario: Accès non autorisé pour créer un tarif sans authentification
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête POST vers "/museum/prices"
    Alors je reçois une réponse 401
    Et la réponse contient un message d'erreur "Non authentifié"

  Scenario: Accès non autorisé pour créer un tarif sans les rôles requis
    Étant donné que je suis authentifié mais sans les rôles bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/prices"
    Alors je reçois une réponse 403
    Et la réponse contient un message d'erreur "Accès refusé : rôle insuffisant"

  Scenario: Accès public pour lire les tarifs
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête GET vers "/museum/prices"
    Alors je reçois une réponse 200
    Et la réponse contient un tableau de tarifs
