Feature: Paiement
  En tant qu'utilisateur
  Je veux pouvoir effectuer des paiements
  Afin de payer pour des services ou produits

  Background:
    Étant donné que l'API Stripe est configurée avec STRIPE_SECRET_KEY
    Et que le serveur est démarré

  Scenario: Vérifier le statut d'une session de checkout existante
    Étant donné qu'une session de checkout a été créée avec succès
    Quand je fais une requête GET vers "/pay/checkout/{sessionId}"
    Alors je reçois une réponse 200
    Et la réponse contient l'ID de la session
    Et la réponse contient le statut de paiement (paid, unpaid, no_payment_required)
    Et la réponse contient le montant
    Et la réponse contient la devise

  Scenario: Vérifier le statut d'une session inexistante
    Quand je fais une requête GET vers "/pay/checkout/{sessionId}"
    Et que le sessionId n'existe pas
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur indiquant que la session n'a pas été trouvée

  Scenario: Vérifier le statut d'une session payée
    Étant donné qu'une session de checkout a été créée
    Et que le paiement a été effectué avec succès
    Quand je fais une requête GET vers "/pay/checkout/{sessionId}"
    Alors je reçois une réponse 200
    Et le statut de paiement est "paid"
    Et la réponse contient un "transaction_code" si disponible

  Scenario: Gérer les erreurs de l'API Stripe
    Étant donné que l'API Stripe retourne une erreur
    Quand je fais une requête GET vers "/pay/checkout/{sessionId}"
    Alors je reçois une réponse 500
    Et la réponse contient un message d'erreur générique
    Et les détails de l'erreur sont loggés côté serveur
