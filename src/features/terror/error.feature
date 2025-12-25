Feature: Gestion des erreurs
  En tant que système
  Je veux capturer, logger et notifier les erreurs
  Afin de faciliter le débogage et la maintenance

  Background:
    Étant donné que le serveur est démarré
    Et que la base de données est configurée

  Scenario: Capturer une erreur de route (500)
    Étant donné qu'une erreur serveur se produit dans une route
    Quand l'erreur est levée
    Alors l'erreur est loggée
    Et l'erreur est sauvegardée en base de données
    Et l'erreur est envoyée à Discord si elle n'est pas un doublon
    Et une réponse 500 est renvoyée au client

  Scenario: Capturer une erreur de validation (400)
    Étant donné qu'une erreur de validation se produit
    Quand l'erreur est levée
    Alors l'erreur est loggée
    Et l'erreur n'est pas envoyée à Discord (seulement les 500+)
    Et une réponse 400 est renvoyée au client
    Et le message d'erreur de validation est inclus dans la réponse

  Scenario: Capturer une erreur CORS
    Étant donné qu'une erreur CORS se produit
    Quand l'erreur est levée
    Alors une réponse 403 est renvoyée
    Et le message "Origin required in production" est inclus
    Et l'erreur n'est pas envoyée à Discord

  Scenario: Détecter et ignorer les erreurs dupliquées
    Étant donné qu'une erreur identique s'est produite récemment
    Quand la même erreur se produit à nouveau dans la fenêtre de temps configurée
    Alors l'erreur est sauvegardée en base de données
    Et l'erreur n'est pas envoyée à Discord (doublon détecté)
    Et un log de debug indique que c'est un doublon

  Scenario: Envoyer une erreur à Discord
    Étant donné qu'une nouvelle erreur serveur se produit
    Et que DISCORD_LOG_WEBHOOK_URL est configuré
    Quand l'erreur est traitée
    Alors un webhook est envoyé à Discord avec les détails de l'erreur
    Et le statut sent_to_discord est mis à jour en base de données

  Scenario: Ne pas envoyer à Discord si le webhook n'est pas configuré
    Étant donné qu'une erreur serveur se produit
    Et que DISCORD_LOG_WEBHOOK_URL n'est pas configuré
    Quand l'erreur est traitée
    Alors un avertissement est loggé
    Et aucun webhook n'est envoyé à Discord

  Scenario: Capturer une promesse rejetée non gérée
    Étant donné qu'une promesse est rejetée sans être capturée
    Quand l'événement unhandledRejection est déclenché
    Alors l'erreur est loggée
    Et l'erreur est envoyée à Discord avec le type "Unhandled Rejection"

  Scenario: Capturer une exception non gérée
    Étant donné qu'une exception non gérée se produit
    Quand l'événement uncaughtException est déclenché
    Alors l'erreur est loggée
    Et l'erreur est envoyée à Discord avec le type "Uncaught Exception"
    Et la fonction shutdown est appelée

  Scenario: Générer un hash unique pour chaque erreur
    Étant donné qu'une erreur se produit
    Quand l'erreur est traitée
    Alors un hash SHA256 est généré basé sur le nom, message, stack et type de l'erreur
    Et ce hash est utilisé pour détecter les doublons

  Scenario: Sauvegarder le contexte de l'erreur
    Étant donné qu'une erreur se produit dans une route
    Quand l'erreur est traitée
    Alors l'URL, la méthode HTTP et l'IP sont sauvegardées en base de données
    Et le type d'erreur est sauvegardé (Route Error, Unhandled Rejection, etc.)

  Scenario: Gérer les erreurs lors de l'envoi au webhook Discord
    Étant donné qu'une erreur serveur se produit
    Et que l'envoi au webhook Discord échoue
    Quand l'erreur est traitée
    Alors l'erreur d'envoi est loggée
    Et l'erreur originale est toujours sauvegardée en base de données

  Scenario: Gérer les erreurs de validation avec message personnalisé pour body invalide
    Étant donné qu'une requête avec un body invalide est envoyée
    Quand l'erreur de validation est levée
    Alors une réponse 400 est renvoyée
    Et le message "Le body doit être un objet JSON valide avec Content-Type: application/json" est inclus
