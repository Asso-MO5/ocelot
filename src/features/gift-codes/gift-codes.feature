Feature: Gestion des codes cadeaux
  En tant qu'administrateur (bureau, dev ou museum)
  Je veux gérer les codes cadeaux
  Afin de les distribuer aux visiteurs et de suivre leur utilisation

  Background:
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et que la base de données est disponible

  Scenario: Création d'un pack de codes cadeaux
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/gift-codes/packs" avec une quantité
    Alors je devrais recevoir un pack_id et une liste de codes
    Et le nombre de codes devrait correspondre à la quantité demandée

  Scenario: Création d'un pack avec date d'expiration
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/gift-codes/packs" avec une quantité et une date d'expiration
    Alors je devrais recevoir un pack avec des codes ayant la date d'expiration spécifiée

  Scenario: Erreur si la quantité est invalide
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/gift-codes/packs" avec une quantité <= 0
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer que la quantité doit être supérieure à 0

  Scenario: Erreur si la quantité dépasse 1000
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête POST vers "/museum/gift-codes/packs" avec une quantité > 1000
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer que la quantité ne peut pas dépasser 1000

  Scenario: Distribution de codes par email
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un pack de codes existe
    Quand je fais une requête POST vers "/museum/gift-codes/distribute" avec des code_ids et un recipient_email
    Alors les codes devraient être associés à l'email du destinataire
    Et un email devrait être envoyé au destinataire avec les codes

  Scenario: Erreur si certains codes n'existent pas lors de la distribution
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête POST vers "/museum/gift-codes/distribute" avec des code_ids invalides
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer que certains codes n'existent pas

  Scenario: Erreur si certains codes sont déjà utilisés lors de la distribution
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et que certains codes sont déjà utilisés
    Quand je fais une requête POST vers "/museum/gift-codes/distribute" avec ces codes
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer quels codes sont déjà utilisés

  Scenario: Récupération des codes cadeaux avec filtres
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête GET vers "/museum/gift-codes" avec des paramètres de filtre
    Alors je devrais recevoir une liste paginée de codes correspondant aux filtres

  Scenario: Récupération des packs de codes cadeaux
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Quand je fais une requête GET vers "/museum/gift-codes/packs"
    Alors je devrais recevoir une liste paginée de packs avec leurs codes associés
    Et chaque pack devrait contenir les statistiques (unused_count, used_count, expired_count)

  Scenario: Recherche d'un pack par code
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et qu'un code existe dans un pack
    Quand je fais une requête GET vers "/museum/gift-codes/packs?code=XXXX"
    Alors je devrais recevoir le pack contenant ce code

  Scenario: Validation d'un code cadeau (route publique)
    Étant donné qu'un code cadeau valide existe
    Quand je fais une requête GET vers "/museum/gift-codes/validate/XXXX"
    Alors je devrais recevoir les informations du code
    Et le statut devrait être "unused"

  Scenario: Erreur si le code n'existe pas
    Étant donné qu'aucun code n'existe avec ce code
    Quand je fais une requête GET vers "/museum/gift-codes/validate/INVALID"
    Alors je devrais recevoir une erreur 404
    Et le message d'erreur devrait indiquer que le code est invalide

  Scenario: Erreur si le code est déjà utilisé
    Étant donné qu'un code cadeau a déjà été utilisé
    Quand je fais une requête GET vers "/museum/gift-codes/validate/XXXX"
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer que le code a déjà été utilisé

  Scenario: Erreur si le code a expiré
    Étant donné qu'un code cadeau a expiré
    Quand je fais une requête GET vers "/museum/gift-codes/validate/XXXX"
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer que le code a expiré

  Scenario: Achat public de codes cadeaux
    Étant donné que le prix des codes cadeaux est configuré
    Quand je fais une requête POST vers "/museum/gift-codes/purchase" avec une quantité et un email
    Alors je devrais recevoir un checkout_id et un checkout_url
    Et une session Stripe devrait être créée

  Scenario: Erreur si la quantité d'achat est invalide
    Étant donné que le prix des codes cadeaux est configuré
    Quand je fais une requête POST vers "/museum/gift-codes/purchase" avec une quantité <= 0
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer que la quantité doit être au moins 1

  Scenario: Erreur si la quantité d'achat dépasse 100
    Étant donné que le prix des codes cadeaux est configuré
    Quand je fais une requête POST vers "/museum/gift-codes/purchase" avec une quantité > 100
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer que la quantité maximale est 100

  Scenario: Confirmation d'un achat après paiement
    Étant donné qu'une session de paiement existe avec payment_status = paid
    Quand je fais une requête POST vers "/museum/gift-codes/purchase/confirm" avec le checkout_id
    Alors un pack de codes devrait être créé
    Et un email devrait être envoyé à l'acheteur avec les codes
    Et les codes devraient être associés à l'email de l'acheteur

  Scenario: Erreur si le paiement n'est pas confirmé
    Étant donné qu'une session de paiement existe avec payment_status != paid
    Quand je fais une requête POST vers "/museum/gift-codes/purchase/confirm" avec le checkout_id
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer que le paiement n'est pas confirmé

  Scenario: Accès refusé pour la création de pack sans authentification
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête POST vers "/museum/gift-codes/packs"
    Alors je devrais recevoir une erreur 401
    Et le message d'erreur devrait indiquer "Non authentifié"

  Scenario: Accès refusé pour les rôles non autorisés
    Étant donné que je suis authentifié avec un rôle non autorisé
    Quand je fais une requête POST vers "/museum/gift-codes/packs"
    Alors je devrais recevoir une erreur 403
    Et le message d'erreur devrait indiquer "Accès refusé : rôle insuffisant"
