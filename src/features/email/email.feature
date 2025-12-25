Feature: Envoi d'emails
  En tant que système
  Je veux envoyer des emails transactionnels
  Afin de communiquer avec les utilisateurs (confirmations, notifications, etc.)

  Background:
    Étant donné que les variables d'environnement EMAIL_API_URL et EMAIL_API_KEY sont configurées
    Et que l'API d'envoi d'emails est disponible

  Scenario: Envoi d'un email simple sans pièce jointe
    Étant donné que je veux envoyer un email
    Quand j'appelle sendEmail avec un email, un nom, un sujet, un corps HTML et une langue
    Alors l'email devrait être envoyé via l'API
    Et la réponse de l'API devrait être retournée

  Scenario: Envoi d'un email avec pièces jointes
    Étant donné que je veux envoyer un email avec des pièces jointes
    Quand j'appelle sendEmail avec des attachments (nom, contenu base64, type MIME)
    Alors l'email devrait être envoyé avec les pièces jointes
    Et les pièces jointes devraient être correctement formatées pour l'API

  Scenario: Utilisation de l'expéditeur français
    Étant donné que la langue est "fr"
    Quand j'envoie un email
    Alors l'expéditeur devrait être "Le Musée du Jeu Vidéo" <ne-pas-repondre@lemuseedujeuvideo.fr>

  Scenario: Utilisation de l'expéditeur anglais
    Étant donné que la langue est "en"
    Quand j'envoie un email
    Alors l'expéditeur devrait être "The Video Game Museum" <no-reply@lemuseedujeuvideo.fr>

  Scenario: Gestion des erreurs lors de l'envoi
    Étant donné que l'API d'envoi d'emails est indisponible
    Quand j'appelle sendEmail
    Alors une erreur devrait être levée
    Et l'erreur devrait être propagée à l'appelant

  Scenario: Envoi d'email sans pièces jointes
    Étant donné que je veux envoyer un email sans pièces jointes
    Quand j'appelle sendEmail sans paramètre attachments
    Alors l'email devrait être envoyé sans le champ attachment dans le payload
