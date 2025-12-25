Feature: Gestion des paramètres du musée
  En tant qu'administrateur ou visiteur
  Je veux pouvoir gérer et consulter les paramètres de configuration du musée
  Afin de configurer le comportement de l'application

  Background:
    Étant donné que la base de données est configurée
    Et que le serveur est démarré

  Scenario: Créer un nouveau paramètre
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/settings"
    Et que je fournis key et value
    Alors je reçois une réponse 201
    Et la réponse contient le paramètre créé avec un id
    Et la réponse contient key, value et value_type

  Scenario: Mettre à jour un paramètre existant (upsert)
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'un paramètre existe avec une clé spécifique
    Quand je fais une requête POST vers "/museum/settings"
    Et que je fournis la même clé avec une nouvelle valeur
    Alors je reçois une réponse 200
    Et la réponse contient le paramètre mis à jour

  Scenario: Créer un paramètre avec un type spécifique
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/settings"
    Et que je fournis key, value et value_type
    Alors je reçois une réponse 201
    Et la réponse contient value_type correspondant au type fourni

  Scenario: Créer un paramètre avec auto-détection du type
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/settings"
    Et que je fournis key et value (sans value_type)
    Alors je reçois une réponse 201
    Et la réponse contient value_type auto-détecté selon le type de value

  Scenario: Erreur lors de la création d'un paramètre avec valeur invalide
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/settings"
    Et que je fournis value_type="number" avec une value qui n'est pas un nombre
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que la valeur ne peut pas être convertie

  Scenario: Récupérer tous les paramètres
    Étant donné que des paramètres existent en base de données
    Quand je fais une requête GET vers "/museum/settings"
    Alors je reçois une réponse 200
    Et la réponse contient un tableau de paramètres

  Scenario: Récupérer les paramètres filtrés par clé
    Étant donné que des paramètres existent avec différentes clés
    Quand je fais une requête GET vers "/museum/settings?key=max_capacity"
    Alors je reçois une réponse 200
    Et tous les paramètres retournés ont key = "max_capacity"

  Scenario: Récupérer un paramètre par sa clé
    Étant donné qu'un paramètre existe avec une clé spécifique
    Quand je fais une requête GET vers "/museum/settings/:key"
    Alors je reçois une réponse 200
    Et la réponse contient le paramètre avec la clé demandée

  Scenario: Erreur lors de la récupération d'un paramètre inexistant
    Étant donné qu'aucun paramètre n'existe avec cette clé
    Quand je fais une requête GET vers "/museum/settings/invalid-key"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Paramètre non trouvé"

  Scenario: Supprimer un paramètre
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'un paramètre existe
    Quand je fais une requête DELETE vers "/museum/settings/:key"
    Alors je reçois une réponse 204
    Et le paramètre est supprimé de la base de données

  Scenario: Erreur lors de la suppression d'un paramètre inexistant
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'aucun paramètre n'existe avec cette clé
    Quand je fais une requête DELETE vers "/museum/settings/invalid-key"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur "Paramètre non trouvé"

  Scenario: Récupérer la capacité maximale
    Étant donné qu'un paramètre max_capacity existe
    Quand je fais une requête GET vers "/museum/capacity/max"
    Alors je reçois une réponse 200
    Et la réponse contient max_capacity
    Et max_capacity est un nombre

  Scenario: Récupérer la capacité maximale par défaut
    Étant donné qu'aucun paramètre max_capacity n'existe
    Quand je fais une requête GET vers "/museum/capacity/max"
    Alors je reçois une réponse 200
    Et la réponse contient max_capacity = 0

  Scenario: Définir la capacité maximale
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/capacity/max"
    Et que je fournis max_capacity = 90
    Alors je reçois une réponse 200
    Et la réponse contient le paramètre max_capacity mis à jour
    Et un message WebSocket est envoyé pour rafraîchir la capacité

  Scenario: Erreur lors de la définition d'une capacité maximale négative
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/capacity/max"
    Et que je fournis max_capacity = -10
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que la capacité doit être positive ou nulle

  Scenario: Accès non autorisé pour créer un paramètre sans authentification
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête POST vers "/museum/settings"
    Alors je reçois une réponse 401
    Et la réponse contient un message d'erreur "Non authentifié"

  Scenario: Accès non autorisé pour créer un paramètre sans les rôles requis
    Étant donné que je suis authentifié mais sans les rôles bureau ou dev
    Quand je fais une requête POST vers "/museum/settings"
    Alors je reçois une réponse 403
    Et la réponse contient un message d'erreur "Accès refusé : rôle insuffisant"

  Scenario: Accès public pour lire les paramètres
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête GET vers "/museum/settings"
    Alors je reçois une réponse 200
    Et la réponse contient un tableau de paramètres

  Scenario: Accès public pour lire la capacité maximale
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête GET vers "/museum/capacity/max"
    Alors je reçois une réponse 200
    Et la réponse contient max_capacity

