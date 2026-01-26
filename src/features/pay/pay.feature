Feature: Gestion des paiements Stripe
  En tant qu'utilisateur ou administrateur
  Je veux gérer les paiements via Stripe
  Afin de traiter les transactions et suivre les statistiques

  Background:
    Étant donné que l'API Stripe est configurée avec STRIPE_SECRET_KEY
    Et que le serveur est démarré

  Scenario: Vérifier le statut d'une session de checkout existante
    Étant donné qu'une session de checkout a été créée avec succès
    Quand je fais une requête GET vers "/pay/checkout/{sessionId}"
    Alors je reçois une réponse 200
    Et la réponse contient l'ID de la session
    Et la réponse contient le statut de paiement (PAID, PENDING, CANCELLED)
    Et la réponse contient le montant converti en euros
    Et la réponse contient la devise en majuscules
    Et la réponse contient un checkout_reference égal à l'ID de la session

  Scenario: Vérifier le statut d'une session inexistante
    Quand je fais une requête GET vers "/pay/checkout/invalid-session-id"
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur indiquant "Session non trouvée"

  Scenario: Vérifier le statut d'une session payée
    Étant donné qu'une session de checkout a été créée
    Et que le paiement a été effectué avec succès
    Quand je fais une requête GET vers "/pay/checkout/{sessionId}"
    Alors je reçois une réponse 200
    Et le statut de paiement est "PAID"
    Et la réponse contient un "transaction_code" si disponible

  Scenario: Vérifier le statut d'une session expirée
    Étant donné qu'une session de checkout a expiré
    Quand je fais une requête GET vers "/pay/checkout/{sessionId}"
    Alors je reçois une réponse 200
    Et le statut est "CANCELLED"

  Scenario: Gérer les erreurs de l'API Stripe
    Étant donné que l'API Stripe retourne une erreur
    Quand je fais une requête GET vers "/pay/checkout/{sessionId}"
    Alors je reçois une réponse 500
    Et la réponse contient un message d'erreur générique
    Et les détails de l'erreur sont loggés côté serveur

  Scenario: Erreur si sessionId est manquant
    Quand je fais une requête GET vers "/pay/checkout/"
    Alors je reçois une erreur 400
    Et le message d'erreur indique "sessionId est requis"


  Scenario: Réception d'un webhook checkout.session.completed
    Étant donné qu'un webhook Stripe est reçu
    Quand je fais une requête POST vers "/pay/webhook" avec un événement checkout.session.completed
    Alors je reçois une réponse 200
    Et les tickets associés sont mis à jour avec le statut de paiement
    Et les emails de confirmation sont envoyés si le paiement est réussi
    Et les certificats de don sont envoyés si des dons sont présents

  Scenario: Réception d'un webhook payment_intent.succeeded
    Étant donné qu'un webhook Stripe est reçu
    Quand je fais une requête POST vers "/pay/webhook" avec un événement payment_intent.succeeded
    Alors je reçois une réponse 200
    Et les tickets associés sont mis à jour avec le statut PAID

  Scenario: Réception d'un webhook payment_intent.payment_failed
    Étant donné qu'un webhook Stripe est reçu
    Quand je fais une requête POST vers "/pay/webhook" avec un événement payment_intent.payment_failed
    Alors je reçois une réponse 200
    Et les tickets associés sont mis à jour avec le statut FAILED

  Scenario: Réception d'un webhook checkout.session.expired
    Étant donné qu'un webhook Stripe est reçu
    Quand je fais une requête POST vers "/pay/webhook" avec un événement checkout.session.expired
    Alors je reçois une réponse 200
    Et les tickets associés sont mis à jour avec le statut CANCELLED

  Scenario: Erreur si la signature du webhook est invalide (production)
    Étant donné que l'environnement est en production
    Et qu'un webhook avec une signature invalide est reçu
    Quand je fais une requête POST vers "/pay/webhook"
    Alors je reçois une erreur 400
    Et le message d'erreur indique "Signature invalide"

  Scenario: Webhook accepté avec signature invalide en développement
    Étant donné que l'environnement est en développement
    Et qu'un webhook avec une signature invalide est reçu
    Quand je fais une requête POST vers "/pay/webhook"
    Alors je reçois une réponse 200
    Et le webhook est traité malgré la signature invalide

  Scenario: Erreur si la signature est manquante
    Étant donné qu'un webhook sans signature est reçu
    Quand je fais une requête POST vers "/pay/webhook"
    Alors je reçois une erreur 400
    Et le message d'erreur indique "Signature manquante"

  Scenario: Erreur si le raw body n'est pas disponible
    Étant donné qu'un webhook est reçu mais le raw body n'est pas disponible
    Quand je fais une requête POST vers "/pay/webhook"
    Alors je reçois une erreur 500
    Et le message d'erreur indique "Raw body non disponible"

  Scenario: Mise à jour des informations client depuis customer_details
    Étant donné qu'un webhook checkout.session.completed est reçu
    Et que la session contient customer_details avec email, first_name, last_name
    Quand je fais une requête POST vers "/pay/webhook"
    Alors les tickets associés sont mis à jour avec les informations client

  Scenario: Traitement d'un événement non géré
    Étant donné qu'un webhook avec un type d'événement non géré est reçu
    Quand je fais une requête POST vers "/pay/webhook"
    Alors je reçois une réponse 200
    Et la réponse indique success: true avec tickets_updated: 0
