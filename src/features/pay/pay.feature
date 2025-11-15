Feature: Paiement SumUp
  En tant qu'utilisateur
  Je veux pouvoir effectuer des paiements via SumUp
  Afin de payer pour des services ou produits

Background:
    Étant donné que l'API SumUp est configurée avec SUMUP_API_KEY et SUMUP_MERCHANT_CODE
    Et que le serveur est démarré

Scenario: Créer un checkout SumUp avec succès
    Quand je fais une requête POST vers "/pay/checkout"
    Et que je fournis un montant valide dans le body
    Alors je reçois une réponse 200
    Et la réponse contient un "checkout_id"
    Et la réponse contient le "checkout_reference"
    Et la réponse contient le "amount"
    Et la réponse contient la "currency"
    Et la réponse contient le "status"

Scenario: Créer un checkout avec un montant invalide
    Quand je fais une requête POST vers "/pay/checkout"
    Et que je fournis un montant négatif ou nul dans le body
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur indiquant que le montant doit être supérieur à 0

Scenario: Créer un checkout avec une devise personnalisée
    Quand je fais une requête POST vers "/pay/checkout"
    Et que je fournis un montant valide
    Et que je spécifie une devise dans le body(par exemple "USD")
    Alors je reçois une réponse 200
    Et la réponse contient la devise spécifiée

Scenario: Créer un checkout avec une description
    Quand je fais une requête POST vers "/pay/checkout"
    Et que je fournis un montant valide
    Et que je fournis une description dans le body
    Alors je reçois une réponse 200
    Et le checkout est créé avec la description fournie

Scenario: Créer un checkout avec une référence personnalisée
    Quand je fais une requête POST vers "/pay/checkout"
    Et que je fournis un montant valide
    Et que je fournis une "checkout_reference" personnalisée dans le body
    Alors je reçois une réponse 200
    Et la réponse contient la référence personnalisée fournie

Scenario: Vérifier le statut d'un checkout existant
    Étant donné qu'un checkout a été créé avec succès
    Quand je fais une requête GET vers "/pay/checkout/{checkoutId}"
    Alors je reçois une réponse 200
    Et la réponse contient l'ID du checkout
    Et la réponse contient le statut du checkout(PENDING, PAID, FAILED, ou CANCELLED)
    Et la réponse contient le montant
    Et la réponse contient la devise

Scenario: Vérifier le statut d'un checkout inexistant
    Quand je fais une requête GET vers "/pay/checkout/{checkoutId}"
    Et que le checkoutId n'existe pas
    Alors je reçois une réponse 404
    Et la réponse contient un message d'erreur indiquant que le checkout n'a pas été trouvé

Scenario: Créer un checkout sans montant
    Quand je fais une requête POST vers "/pay/checkout"
    Et que je ne fournis pas de montant dans le body
    Alors je reçois une réponse 400
    Et la réponse contient un message d'erreur de validation

Scenario: Créer un checkout avec configuration SumUp manquante
    Étant donné que SUMUP_API_KEY n'est pas configurée
    Quand je fais une requête POST vers "/pay/checkout"
    Et que je fournis un montant valide
    Alors je reçois une réponse 500
    Et la réponse contient un message indiquant que la configuration SumUp est manquante

Scenario: Vérifier le statut d'un checkout payé
    Étant donné qu'un checkout a été créé
    Et que le paiement a été effectué avec succès
    Quand je fais une requête GET vers "/pay/checkout/{checkoutId}"
    Alors je reçois une réponse 200
    Et le statut du checkout est "PAID"
    Et la réponse contient un "transaction_code" si disponible

Scenario: Gérer les erreurs de l'API SumUp
    Étant donné que l'API SumUp retourne une erreur
    Quand je fais une requête POST vers "/pay/checkout"
    Et que je fournis un montant valide
    Alors je reçois une réponse 500
    Et la réponse contient un message d'erreur générique
    Et les détails de l'erreur sont loggés côté serveur

