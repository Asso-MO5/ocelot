Feature: WebSocket pour les mises à jour en temps réel
  En tant que client
  Je veux me connecter via WebSocket
  Afin de recevoir des mises à jour en temps réel du musée

  Background:
    Étant donné que le serveur est démarré
    Et que le serveur WebSocket est configuré

  Scenario: Se connecter au WebSocket
    Étant donné qu'un client souhaite se connecter
    Quand le client établit une connexion WebSocket vers "/"
    Alors la connexion est acceptée
    Et le client reçoit un message de bienvenue
    Et le message indique le nombre de clients connectés

  Scenario: Recevoir une notification lorsqu'un nouveau client se connecte
    Étant donné qu'un client est déjà connecté
    Quand un nouveau client se connecte
    Alors le client existant reçoit une notification
    Et la notification indique qu'un nouvel utilisateur a rejoint
    Et la notification indique le nombre total d'utilisateurs

  Scenario: Envoyer un message via WebSocket
    Étant donné qu'un client est connecté
    Quand le client envoie un message
    Alors le message est reçu par le serveur
    Et tous les autres clients reçoivent le message
    Et le message est préfixé par "User says:"

  Scenario: Recevoir une notification lorsqu'un client se déconnecte
    Étant donné que plusieurs clients sont connectés
    Quand un client se déconnecte
    Alors les autres clients reçoivent une notification
    Et la notification indique qu'un utilisateur est parti
    Et la notification indique le nombre total d'utilisateurs restants

  Scenario: Gérer les erreurs de connexion
    Étant donné qu'un client est connecté
    Quand une erreur se produit sur la connexion
    Alors l'erreur est loggée
    Et la connexion est nettoyée

  Scenario: Nettoyer les connexions fermées
    Étant donné qu'une connexion est fermée
    Quand le serveur tente d'envoyer un message
    Alors la connexion fermée est supprimée de la liste des connexions actives

  Scenario: Envoyer un message à une room spécifique
    Étant donné que plusieurs clients sont connectés
    Quand la fonction sendToRoom est appelée avec un nom de room et une action
    Alors tous les clients connectés reçoivent le message
    Et le message contient le nom de la room et l'action

  Scenario: Diffuser un message à tous les clients sauf l'expéditeur
    Étant donné que plusieurs clients sont connectés
    Quand un client envoie un message via broadcast
    Alors tous les autres clients reçoivent le message
    Et l'expéditeur ne reçoit pas son propre message
