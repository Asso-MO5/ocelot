/**
 * Scénarios Gherkin/Cucumber pour les fonctionnalités d'authentification Discord OAuth2
 * Format: Feature, Scenario, Given, When, Then
 */

export const authFeature = `
Feature: Authentification Discord OAuth2
  En tant qu'utilisateur
  Je veux m'authentifier via Discord
  Afin d'accéder aux fonctionnalités protégées de l'application

  Background:
    Étant donné que le serveur est configuré avec DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET
    Et que les cookies sont activés

  Scenario: Redirection vers Discord pour l'authentification
    Étant donné que je suis un utilisateur non authentifié
    Quand je fais une requête GET vers "/auth/signin"
    Alors je devrais être redirigé vers Discord OAuth2
    Et l'URL de redirection devrait contenir le client_id
    Et l'URL de redirection devrait contenir le redirect_uri
    Et l'URL de redirection devrait contenir les scopes demandés

  Scenario: Redirection vers Discord via /auth/login
    Étant donné que je suis un utilisateur non authentifié
    Quand je fais une requête GET vers "/auth/login"
    Alors je devrais être redirigé vers Discord OAuth2
    Et le comportement devrait être identique à "/auth/signin"

  Scenario: Erreur si DISCORD_CLIENT_ID n'est pas configuré
    Étant donné que DISCORD_CLIENT_ID n'est pas défini
    Quand je fais une requête GET vers "/auth/signin"
    Alors je devrais recevoir une erreur 500
    Et le message d'erreur devrait indiquer "DISCORD_CLIENT_ID non configuré"

  Scenario: Callback OAuth2 avec code d'autorisation valide
    Étant donné que Discord a retourné un code d'autorisation valide
    Quand je fais une requête GET vers "/auth/callback?code=valid_code"
    Alors le code devrait être échangé contre un access_token et un refresh_token
    Et les tokens devraient être stockés dans des cookies HTTP-only
    Et je devrais être redirigé vers le frontend avec success=true

  Scenario: Callback OAuth2 avec erreur Discord
    Étant donné que Discord a retourné une erreur
    Quand je fais une requête GET vers "/auth/callback?error=access_denied"
    Alors je devrais être redirigé vers le frontend avec le paramètre error

  Scenario: Callback OAuth2 sans code
    Étant donné que Discord n'a pas retourné de code
    Quand je fais une requête GET vers "/auth/callback"
    Alors je devrais être redirigé vers le frontend avec error=missing_code

  Scenario: Callback OAuth2 avec configuration Discord manquante
    Étant donné que DISCORD_CLIENT_ID ou DISCORD_CLIENT_SECRET n'est pas configuré
    Quand je fais une requête GET vers "/auth/callback?code=test_code"
    Alors je devrais recevoir une erreur 500
    Et le message d'erreur devrait indiquer "Configuration Discord manquante"

  Scenario: Vérification de session - utilisateur non authentifié
    Étant donné que je n'ai pas de token d'accès
    Quand je fais une requête GET vers "/auth/session"
    Alors je devrais recevoir authenticated: false
    Et je devrais recevoir hasRefreshToken: false

  Scenario: Vérification de session - utilisateur authentifié
    Étant donné que j'ai un access_token valide
    Quand je fais une requête GET vers "/auth/session"
    Alors je devrais recevoir authenticated: true
    Et je devrais recevoir hasRefreshToken: true si un refresh_token existe

  Scenario: Récupération des données utilisateur - token valide
    Étant donné que j'ai un access_token valide
    Quand je fais une requête GET vers "/auth/me"
    Alors je devrais recevoir mes informations utilisateur
    Et la réponse devrait contenir id, username, discriminator, avatar
    Et la réponse devrait contenir email si le scope email est accordé

  Scenario: Récupération des données utilisateur - token expiré avec refresh automatique
    Étant donné que mon access_token est expiré
    Et que j'ai un refresh_token valide
    Quand je fais une requête GET vers "/auth/me"
    Alors le refresh_token devrait être utilisé pour obtenir un nouveau access_token
    Et les nouveaux tokens devraient être stockés dans les cookies
    Et je devrais recevoir mes informations utilisateur

  Scenario: Récupération des données utilisateur - token expiré sans refresh token
    Étant donné que mon access_token est expiré
    Et que je n'ai pas de refresh_token
    Quand je fais une requête GET vers "/auth/me"
    Alors je devrais recevoir une erreur 401
    Et le message d'erreur devrait indiquer "Token expiré et aucun refresh token disponible"

  Scenario: Récupération des données utilisateur - refresh token invalide
    Étant donné que mon access_token est expiré
    Et que mon refresh_token est invalide
    Quand je fais une requête GET vers "/auth/me"
    Alors je devrais recevoir une erreur 401
    Et les cookies devraient être supprimés
    Et le message d'erreur devrait indiquer "Session expirée, veuillez vous reconnecter"

  Scenario: Récupération des données utilisateur - non authentifié
    Étant donné que je n'ai pas de token d'accès
    Quand je fais une requête GET vers "/auth/me"
    Alors je devrais recevoir une erreur 401
    Et le message d'erreur devrait indiquer "Non authentifié"

  Scenario: Utilisation de scopes personnalisés
    Étant donné que DISCORD_SCOPES est configuré avec "identify email guilds"
    Quand je fais une requête GET vers "/auth/signin"
    Alors l'URL de redirection Discord devrait contenir les scopes personnalisés

  Scenario: Configuration de l'URI de redirection personnalisée
    Étant donné que DISCORD_REDIRECT_URI est configuré
    Quand je fais une requête GET vers "/auth/signin"
    Alors l'URL de redirection Discord devrait utiliser l'URI personnalisée

  Scenario: Redirection vers frontend personnalisé
    Étant donné que FRONTEND_URL est configuré
    Et que le callback OAuth2 a réussi
    Quand je suis redirigé après l'authentification
    Alors je devrais être redirigé vers l'URL du frontend configurée
    Et l'URL devrait contenir success=true
`;

