# Migration des identités vers Zitadel

## Principes

La migration ajoute `users.zitadel_subject` sans supprimer `users.discord_id`.
Les identités Discord existantes restent donc utilisables pendant la bascule. Une
identité Zitadel est créée à sa première connexion avec le claim `sub` validé.

Il ne faut pas rapprocher automatiquement un compte Discord et un compte Zitadel
sur le nom ou l’email : ces attributs ne constituent pas une preuve de propriété.
Le rapprochement, s’il est requis pour reprendre un historique de présences, doit
être effectué manuellement par un administrateur habilité et tracé.

## Déploiement

1. Sauvegarder la base PostgreSQL et appliquer la migration `017`.
2. Configurer l’application Zitadel et ses rôles, puis les variables
   `ZITADEL_*` dans l’environnement de l’API.
3. Déployer la version qui accepte l’identité Zitadel, puis réaliser une recette
   de connexion et d’autorisation avec des comptes de test.
4. Conserver les variables et les routes Discord tant que les comptes et les
   consommateurs concernés n’ont pas été migrés et validés.
5. Retirer l’ancien fournisseur seulement dans une migration ultérieure et
   planifiée.

## Retour arrière

La migration `017` refuse explicitement de revenir en arrière si une identité
Zitadel a été créée ou si un utilisateur sans `discord_id` existe. Dans ce cas,
restaurer la sauvegarde ou déployer l’image précédente en conservant le schéma
étendu ; ne jamais supprimer ces identités pour forcer un rollback.
