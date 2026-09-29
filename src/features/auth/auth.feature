Feature: Authentification Zitadel OpenID Connect
  En tant qu'utilisateur du musée
  Je veux m'authentifier avec Zitadel
  Afin d'accéder aux fonctionnalités protégées avec les rôles attribués à mon compte

  Background:
    Étant donné que Zitadel est configuré avec un issuer, un client et un secret
    Et que l'application a activé l'émission du claim de rôles demandé

  Scenario: Démarrer une connexion OIDC protégée par PKCE
    Étant donné que je ne suis pas authentifié
    Quand je fais une requête GET vers "/auth/signin"
    Alors je suis redirigé vers l'endpoint d'autorisation Zitadel
    Et la requête contient un state, un nonce et un code_challenge S256
    Et les valeurs de transaction sont conservées dans des cookies HTTP-only signés et temporaires

  Scenario: Refuser une configuration Zitadel incomplète
    Étant donné que ZITADEL_ISSUER, ZITADEL_CLIENT_ID ou ZITADEL_CLIENT_SECRET est absent
    Quand je fais une requête GET vers "/auth/signin"
    Alors je reçois une erreur 500 sans détail de secret

  Scenario: Finaliser un callback OIDC valide
    Étant donné qu'un state, un nonce et un verifier valides ont été conservés
    Et que Zitadel retourne un code d'autorisation et un ID token valide
    Quand je fais une requête GET vers "/auth/callback"
    Alors le code est échangé avec le verifier PKCE
    Et la signature, l'issuer, l'audience et le nonce de l'ID token sont vérifiés
    Et les jetons de session sont stockés dans des cookies HTTP-only
    Et je suis redirigé vers le frontend avec success=true

  Scenario: Refuser un callback qui ne correspond pas à la transaction
    Étant donné que le state retourné est absent, invalide ou expiré
    Quand je fais une requête GET vers "/auth/callback"
    Alors aucun jeton n'est échangé
    Et je suis redirigé vers le frontend avec error=invalid_state

  Scenario: Récupérer ma session et mes rôles Zitadel
    Étant donné que j'ai un access token Zitadel valide
    Quand je fais une requête GET vers "/auth/me"
    Alors je reçois mon identité et les rôles présents dans le claim configuré
    Et mon subject Zitadel est conservé comme identité locale

  Scenario: Renouveler une session expirée
    Étant donné que mon access token est refusé par Zitadel
    Et que j'ai un refresh token valide
    Quand je fais une requête protégée
    Alors le refresh token obtient une nouvelle session
    Et les nouveaux jetons remplacent les cookies de session

  Scenario: Invalider une session non renouvelable
    Étant donné que mon access token est refusé et que le refresh token est absent ou invalide
    Quand je fais une requête protégée
    Alors je reçois une erreur 401
    Et les cookies de session Zitadel sont supprimés

  Scenario: Déconnexion de l'utilisateur
    Étant donné que je suis authentifié avec Zitadel
    Quand je fais une requête GET vers "/auth/signout"
    Alors les cookies Zitadel et les cookies temporaires sont supprimés
    Et je reçois une réponse avec success=true
