# Déploiement CapRover

L’image de production est construite depuis `Dockerfile`, avec Node 24 et les
seules dépendances runtime. Les fichiers `.env*`, le dépôt Git, les logs et les
dépendances locales sont exclus du contexte Docker.

## Configuration de l’application CapRover

1. Créer l’application Ocelot et utiliser le `captain-definition` inclus.
2. Définir le port HTTP du conteneur à `3000`. Le serveur écoute sur
   `HOST=0.0.0.0` et respecte `PORT` si CapRover doit en fournir un autre.
3. Saisir les variables de production dans l’interface CapRover, jamais dans
   un fichier `.env` copié dans l’image. Partir de `.env.exemple` sans y
   recopier les valeurs de démonstration.
4. Définir `NODE_ENV=production`, des valeurs HTTPS pour `CORS_ORIGINS`,
   `FRONTEND_URL` et `ZITADEL_REDIRECT_URI`, ainsi qu’un `COOKIE_SECRET`
   aléatoire et stable.
5. Configurer dans Zitadel l’URI de callback exacte
   `https://<api-domain>/auth/callback` et l’émission du claim de rôles.

Variables indispensables : `DATABASE_URL`, `COOKIE_SECRET`, `CORS_ORIGINS`,
`FRONTEND_URL`, `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`,
`ZITADEL_CLIENT_SECRET` et `ZITADEL_REDIRECT_URI`. Les variables Stripe sont
requises dès que les paiements ou leur webhook sont activés.

## Migrations

Les migrations ne s’exécutent pas au démarrage afin d’éviter une course entre
plusieurs conteneurs ou un rollback de déploiement. Les appliquer une fois,
avant le déploiement de l’image applicative, depuis un environnement de confiance
qui injecte `DATABASE_URL` :

```bash
docker build --target migration --tag ocelot-migrate .
docker run --rm --env DATABASE_URL ocelot-migrate
```

Le script de migration utilise la variable injectée et ne recherche pas de
fichier `.env.prod` lorsqu’elle est présente. Conserver une sauvegarde
PostgreSQL avant toute migration de production. Les arguments sont transmis
directement à `node-pg-migrate`, sans interprétation par un shell.

## Vérification et retour arrière

L’image vérifie `/docs/openapi.json` via son `HEALTHCHECK`. Après déploiement,
vérifier cette URL, la connexion Zitadel et le webhook Stripe avec les domaines
de production. Pour revenir en arrière, redéployer l’image précédente ; ne pas
annuler une migration ayant déjà créé ou transformé des données sans procédure
de retour arrière validée.
