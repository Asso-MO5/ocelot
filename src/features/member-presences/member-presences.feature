Feature: Gestion des présences des membres
  En tant que membre du musée
  Je veux indiquer mes présences
  Afin que les administrateurs puissent planifier les activités

  Background:
    Étant donné que je suis authentifié
    Et que la base de données est disponible

  Scenario: Création d'une présence
    Étant donné que je suis authentifié
    Quand je fais une requête POST vers "/museum/member-presences" avec une date et une période
    Alors je devrais recevoir la présence créée
    Et la présence devrait contenir mon user_id et mon user_name

  Scenario: Mise à jour d'une présence existante
    Étant donné qu'une présence existe déjà pour cette date
    Quand je fais une requête POST vers "/museum/member-presences" avec la même date et une nouvelle période
    Alors la présence devrait être mise à jour
    Et la période devrait être la nouvelle valeur

  Scenario: Erreur si la date est invalide
    Étant donné que je suis authentifié
    Quand je fais une requête POST vers "/museum/member-presences" avec une date invalide
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer "Date invalide"

  Scenario: Erreur si l'utilisateur n'existe pas
    Étant donné que mon discord_id n'existe pas dans la base de données
    Quand je fais une requête POST vers "/museum/member-presences"
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer "Utilisateur non trouvé"

  Scenario: Récupération de mes propres présences
    Étant donné que je suis authentifié
    Et que j'ai des présences enregistrées
    Quand je fais une requête GET vers "/museum/member-presences" avec start_date et end_date
    Alors je devrais recevoir mes présences organisées par jour
    Et chaque jour devrait contenir la date, le nom du jour et les présences

  Scenario: Récupération de toutes les présences (admin)
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête GET vers "/museum/member-presences" avec start_date et end_date
    Alors je devrais recevoir toutes les présences de tous les membres
    Et les présences devraient être organisées par jour

  Scenario: Récupération avec une seule date
    Étant donné que je suis authentifié
    Quand je fais une requête GET vers "/museum/member-presences" avec seulement start_date
    Alors je devrais recevoir les présences pour cette date uniquement
    Et end_date devrait être égal à start_date

  Scenario: Refus d'une présence (admin uniquement)
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'une présence existe
    Quand je fais une requête PUT vers "/museum/member-presences/:id/refuse" avec refused=true
    Alors la présence devrait être marquée comme refusée
    Et refused_by_admin devrait être true

  Scenario: Acceptation d'une présence refusée (admin uniquement)
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'une présence est refusée
    Quand je fais une requête PUT vers "/museum/member-presences/:id/refuse" avec refused=false
    Alors la présence devrait être acceptée
    Et refused_by_admin devrait être false

  Scenario: Erreur si la présence n'existe pas lors du refus
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Quand je fais une requête PUT vers "/museum/member-presences/invalid-id/refuse"
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer "Présence non trouvée"

  Scenario: Suppression de ma propre présence
    Étant donné que je suis authentifié
    Et qu'une de mes présences existe
    Quand je fais une requête DELETE vers "/museum/member-presences/:id"
    Alors la présence devrait être supprimée
    Et je devrais recevoir { success: true }

  Scenario: Suppression d'une présence par un admin
    Étant donné que je suis authentifié avec un rôle bureau ou dev
    Et qu'une présence existe
    Quand je fais une requête DELETE vers "/museum/member-presences/:id"
    Alors la présence devrait être supprimée
    Et je devrais recevoir { success: true }

  Scenario: Erreur si je tente de supprimer une présence qui ne m'appartient pas
    Étant donné que je suis authentifié
    Et qu'une présence d'un autre membre existe
    Quand je fais une requête DELETE vers "/museum/member-presences/:id"
    Alors je devrais recevoir une erreur 400
    Et le message d'erreur devrait indiquer "Vous ne pouvez supprimer que vos propres présences"

  Scenario: Erreur si la présence n'existe pas lors de la suppression
    Étant donné que je suis authentifié
    Quand je fais une requête DELETE vers "/museum/member-presences/invalid-id"
    Alors je devrais recevoir une erreur 404
    Et le message d'erreur devrait indiquer "Présence non trouvée"

  Scenario: Accès refusé sans authentification
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête POST vers "/museum/member-presences"
    Alors je devrais recevoir une erreur 401
    Et le message d'erreur devrait indiquer "Non authentifié"

  Scenario: Accès refusé pour refuser une présence sans rôle admin
    Étant donné que je suis authentifié sans rôle bureau ou dev
    Quand je fais une requête PUT vers "/museum/member-presences/:id/refuse"
    Alors je devrais recevoir une erreur 403
    Et le message d'erreur devrait indiquer "Accès refusé : rôle insuffisant"
