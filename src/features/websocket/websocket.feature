Feature: WebSocket pour les mises à jour en temps réel
  En tant que client
  Je veux recevoir des mises à jour via le fournisseur WebSocket
  Afin de recevoir des mises à jour en temps réel du musée

  Background:
    Étant donné que le serveur est démarré
    Et que le fournisseur WebSocket est configuré

  Scenario: Envoyer une action à une room spécifique
    Étant donné qu'une room du musée est configurée chez le fournisseur
    Quand la fonction sendToRoom est appelée avec un nom de room et une action
    Alors le fournisseur reçoit une requête avec le nom de la room et l'action
    Et les clients abonnés à cette room reçoivent la mise à jour

  Scenario: Continuer le flux métier si le fournisseur WebSocket est indisponible
    Étant donné que le fournisseur WebSocket ne répond pas
    Quand la fonction sendToRoom est appelée
    Alors l’erreur est journalisée
    Et le flux métier appelant reste disponible
