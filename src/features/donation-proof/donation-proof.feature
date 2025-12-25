Feature: Génération de certificats de don
  En tant qu'administrateur (bureau, dev ou museum)
  Je veux générer des certificats de don CERFA 11580
  Afin de fournir des justificatifs fiscaux aux donateurs

  Background:
    Étant donné que je suis authentifié avec un rôle bureau, dev ou museum
    Et que les fichiers CERFA sont disponibles dans le dossier data/

  Scenario: Génération d'un certificat de don depuis un ticket
    Étant donné qu'un ticket avec un don existe
    Quand je fais une requête GET vers "/museum/donation-proof/generate?ticket_id=xxx"
    Alors je devrais recevoir un PDF du certificat de don
    Et le Content-Type devrait être "application/pdf"
    Et le Content-Disposition devrait contenir le nom du fichier

  Scenario: Génération avec adresse complète
    Étant donné qu'un ticket avec un don existe
    Quand je fais une requête GET vers "/museum/donation-proof/generate?ticket_id=xxx&address=123 Rue Test&postal_code=75001&city=Paris"
    Alors je devrais recevoir un PDF du certificat de don
    Et l'adresse devrait être incluse dans le certificat

  Scenario: Erreur si ticket_id est manquant
    Étant donné que je suis authentifié
    Quand je fais une requête GET vers "/museum/donation-proof/generate"
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer "ticket_id est requis"

  Scenario: Erreur si le ticket n'existe pas
    Étant donné que je suis authentifié
    Quand je fais une requête GET vers "/museum/donation-proof/generate?ticket_id=invalid-id"
    Alors je devrais recevoir une erreur 404
    Et le message d'erreur devrait indiquer "Ticket non trouvé"

  Scenario: Erreur si le ticket n'a pas de don
    Étant donné qu'un ticket sans don existe
    Quand je fais une requête GET vers "/museum/donation-proof/generate?ticket_id=xxx"
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer "Ce ticket ne contient pas de don"

  Scenario: Erreur si la génération du PDF échoue
    Étant donné qu'un ticket avec un don existe
    Et que les fichiers CERFA sont manquants
    Quand je fais une requête GET vers "/museum/donation-proof/generate?ticket_id=xxx"
    Alors je devrais recevoir une erreur 400 ou 500
    Et le message d'erreur devrait indiquer une erreur de génération

  Scenario: Génération d'un certificat de debug (dev et bureau uniquement)
    Étant donné que je suis authentifié avec un rôle dev ou bureau
    Quand je fais une requête GET vers "/museum/donation-proof/debug"
    Alors je devrais recevoir un PDF du certificat de don avec des données de test
    Et le Content-Type devrait être "application/pdf"
    Et le nom du fichier devrait être "certificat-don-debug.pdf"

  Scenario: Accès refusé pour la génération sans authentification
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête GET vers "/museum/donation-proof/generate?ticket_id=xxx"
    Alors je devrais recevoir une erreur 401
    Et le message d'erreur devrait indiquer "Non authentifié"

  Scenario: Accès refusé pour les rôles non autorisés
    Étant donné que je suis authentifié avec un rôle non autorisé
    Quand je fais une requête GET vers "/museum/donation-proof/generate?ticket_id=xxx"
    Alors je devrais recevoir une erreur 403
    Et le message d'erreur devrait indiquer "Accès refusé : rôle insuffisant"

  Scenario: Accès refusé pour le debug sans rôle dev ou bureau
    Étant donné que je suis authentifié avec un rôle museum
    Quand je fais une requête GET vers "/museum/donation-proof/debug"
    Alors je devrais recevoir une erreur 403
    Et le message d'erreur devrait indiquer "Accès refusé : rôle insuffisant"
