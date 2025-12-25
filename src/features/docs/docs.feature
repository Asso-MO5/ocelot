Feature: Documentation API
  En tant que développeur ou utilisateur de l'API
  Je veux accéder à la documentation OpenAPI
  Afin de comprendre et utiliser l'API correctement

  Background:
    Étant donné que la documentation a été générée dans le dossier docs/

  Scenario: Accès à la documentation OpenAPI en JSON
    Étant donné que le fichier openapi.json existe
    Quand je fais une requête GET vers "/docs/openapi.json"
    Alors je devrais recevoir le contenu JSON de la documentation
    Et le Content-Type devrait être "application/json"

  Scenario: Accès à la documentation OpenAPI en YAML
    Étant donné que le fichier openapi.yaml existe
    Quand je fais une requête GET vers "/docs/openapi.yaml"
    Alors je devrais recevoir le contenu YAML de la documentation
    Et le Content-Type devrait être "text/yaml"

  Scenario: Accès à l'interface de documentation HTML
    Étant donné que le fichier index.html existe
    Quand je fais une requête GET vers "/docs"
    Alors je devrais recevoir le contenu HTML de la documentation
    Et le Content-Type devrait être "text/html"

  Scenario: Redirection depuis /docs/ vers /docs
    Étant donné que je suis sur "/docs/"
    Quand je fais une requête GET vers "/docs/"
    Alors je devrais être redirigé vers "/docs"

  Scenario: Erreur si le fichier OpenAPI JSON n'existe pas
    Étant donné que le fichier openapi.json n'existe pas
    Quand je fais une requête GET vers "/docs/openapi.json"
    Alors je devrais recevoir une erreur 500
    Et le message d'erreur devrait indiquer "Impossible de charger la documentation OpenAPI"

  Scenario: Erreur si le fichier OpenAPI YAML n'existe pas
    Étant donné que le fichier openapi.yaml n'existe pas
    Quand je fais une requête GET vers "/docs/openapi.yaml"
    Alors je devrais recevoir une erreur 500
    Et le message d'erreur devrait indiquer "Impossible de charger la documentation OpenAPI"

  Scenario: Erreur si le fichier HTML n'existe pas
    Étant donné que le fichier index.html n'existe pas
    Quand je fais une requête GET vers "/docs"
    Alors je devrais recevoir une erreur 500
    Et le message d'erreur devrait indiquer "Impossible de charger la documentation"

  Scenario: Erreur si le fichier OpenAPI JSON est invalide
    Étant donné que le fichier openapi.json contient du JSON invalide
    Quand je fais une requête GET vers "/docs/openapi.json"
    Alors je devrais recevoir une erreur 500
    Et le message d'erreur devrait indiquer "Impossible de charger la documentation OpenAPI"
