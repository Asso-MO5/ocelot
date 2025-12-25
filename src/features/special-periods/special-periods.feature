Feature: Gestion des périodes spéciales
  En tant qu'administrateur ou membre du musée
  Je veux pouvoir gérer les périodes spéciales (vacances, fermetures)
  Afin de configurer les horaires et tarifs spéciaux du musée

  Background:
    Étant donné que la base de données est configurée
    Et que le serveur est démarré

  Scenario: Créer une période de vacances
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/special-periods"
    Et que je fournis type="holiday", start_date, end_date, name, zone
    Alors je reçois une réponse 201
    Et la réponse contient la période créée avec un id
    Et la réponse contient type, start_date, end_date, name, zone, is_active

  Scenario: Créer une période de fermeture
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/special-periods"
    Et que je fournis type="closure", start_date, end_date, name
    Alors je reçois une réponse 201
    Et la réponse contient la période créée avec type="closure"

  Scenario: Erreur si la date de fin est antérieure à la date de début
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/special-periods"
    Et que je fournis start_date="2024-12-25" et end_date="2024-12-24"
    Alors je reçois une réponse 500
    Et la réponse contient un message d'erreur indiquant que la date de fin doit être supérieure ou égale à la date de début

  Scenario: Récupérer toutes les périodes spéciales
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et que des périodes spéciales existent
    Quand je fais une requête GET vers "/museum/special-periods"
    Alors je reçois une réponse 200
    Et la réponse contient un tableau de périodes spéciales

  Scenario: Filtrer les périodes par type
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et que des périodes de type "holiday" et "closure" existent
    Quand je fais une requête GET vers "/museum/special-periods?type=holiday"
    Alors je reçois une réponse 200
    Et toutes les périodes retournées ont type="holiday"

  Scenario: Filtrer les périodes par date
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'une période existe du 2024-12-20 au 2024-12-30
    Quand je fais une requête GET vers "/museum/special-periods?date=2024-12-25"
    Alors je reçois une réponse 200
    Et la période du 2024-12-20 au 2024-12-30 est incluse dans les résultats

  Scenario: Filtrer les périodes par zone
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et que des périodes existent avec différentes zones
    Quand je fais une requête GET vers "/museum/special-periods?zone=A"
    Alors je reçois une réponse 200
    Et toutes les périodes retournées ont zone="A" ou zone="all" ou zone IS NULL

  Scenario: Filtrer les périodes par statut actif
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et que des périodes actives et inactives existent
    Quand je fais une requête GET vers "/museum/special-periods?is_active=true"
    Alors je reçois une réponse 200
    Et toutes les périodes retournées ont is_active=true

  Scenario: Récupérer une période spéciale par ID
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'une période spéciale existe avec un ID spécifique
    Quand je fais une requête GET vers "/museum/special-periods/:id"
    Alors je reçois une réponse 200
    Et la réponse contient la période avec l'ID demandé

  Scenario: Erreur si la période n'existe pas
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'aucune période n'existe avec cet ID
    Quand je fais une requête GET vers "/museum/special-periods/invalid-id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Période spéciale non trouvée"

  Scenario: Mettre à jour une période spéciale
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'une période spéciale existe
    Quand je fais une requête PUT vers "/museum/special-periods/:id"
    Et que je fournis de nouvelles valeurs pour name et description
    Alors je reçois une réponse 200
    Et la réponse contient la période mise à jour

  Scenario: Erreur lors de la mise à jour d'une période inexistante
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'aucune période n'existe avec cet ID
    Quand je fais une requête PUT vers "/museum/special-periods/invalid-id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Période spéciale non trouvée"

  Scenario: Erreur si la date de fin est antérieure à la date de début lors de la mise à jour
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'une période spéciale existe
    Quand je fais une requête PUT vers "/museum/special-periods/:id"
    Et que je fournis start_date="2024-12-25" et end_date="2024-12-24"
    Alors je reçois une réponse 500
    Et la réponse contient un message d'erreur indiquant que la date de fin doit être supérieure ou égale à la date de début

  Scenario: Supprimer une période spéciale
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'une période spéciale existe
    Quand je fais une requête DELETE vers "/museum/special-periods/:id"
    Alors je reçois une réponse 204
    Et la période est supprimée de la base de données

  Scenario: Erreur lors de la suppression d'une période inexistante
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'aucune période n'existe avec cet ID
    Quand je fais une requête DELETE vers "/museum/special-periods/invalid-id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Période spéciale non trouvée"

  Scenario: Accès non autorisé pour créer une période sans authentification
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête POST vers "/museum/special-periods"
    Alors je reçois une réponse 401
    Et la réponse contient un message d'erreur "Non authentifié"

  Scenario: Accès non autorisé pour créer une période sans les rôles requis
    Étant donné que je suis authentifié mais sans les rôles bureau ou dev
    Quand je fais une requête POST vers "/museum/special-periods"
    Alors je reçois une réponse 403
    Et la réponse contient un message d'erreur "Accès refusé : rôle insuffisant"

  Scenario: Vérifier si une date est dans une période de vacances
    Étant donné qu'une période de vacances existe du 2024-12-20 au 2024-12-30
    Quand la fonction isHolidayPeriod est appelée avec date="2024-12-25"
    Alors elle retourne true

  Scenario: Vérifier si une date est dans une période de fermeture
    Étant donné qu'une période de fermeture existe du 2024-12-24 au 2024-12-26
    Quand la fonction isClosurePeriod est appelée avec date="2024-12-25"
    Alors elle retourne true
