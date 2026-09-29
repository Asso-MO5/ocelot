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

## Rôles et permissions musée

Les clés de rôle Zitadel sont en minuscules et sont évaluées côté API selon le
principe du moindre privilège. Les rôles historiques `dev` et `museum` restent
visibles dans Zitadel pour faciliter la migration, mais n’accordent plus de
droit applicatif : chaque personne doit recevoir l’un des rôles ci-dessous.

| Rôle Zitadel | Accès accordé |
| --- | --- |
| `administrateur` | Tous les droits du musée. |
| `bureau` | Tous les droits opérationnels du musée. |
| `membre` | Espace membre et ses propres présences uniquement. |
| `museum_administrateur` | Tous les droits du musée, sans rôle associatif global. |
| `museum_configuration` | Paramétrage des tarifs, horaires, périodes, événements et réglages. Aucun accès aux billets, statistiques, dons ou scans. |
| `museum_ticket_scan` | Lecture d’un billet par QR et contrôle entrée/zone réservée aux majeurs. Aucun accès à la configuration, aux données de commande ou à l’administration des billets. |

Les permissions appliquées par l’API sont : `configuration`, `ticket_manage`,
`ticket_scan`, `member_presence_manage` et `donation_proof_manage`. Elles sont
centralisées dans `src/features/auth/auth.permissions.ts` ; une route métier ne
doit pas réintroduire une liste de rôles locale.

L’évaluation des rôles compare explicitement les rôles attendus à ceux du jeton
validé. Aucun rôle présent dans le jeton ne doit, à lui seul, être interprété
comme un rôle administrateur.

### Recette de sécurité avant mise en production

1. Dans Zitadel, attribuer les nouveaux rôles aux comptes de test avant le
   déploiement, puis retirer les anciens rôles techniques.
2. Vérifier qu’un compte `museum_ticket_scan` peut valider un QR sans consulter
   une commande ni modifier un tarif.
3. Vérifier qu’un compte `museum_configuration` peut modifier un horaire sans
   consulter les billets, statistiques ou justificatifs de don.
4. Vérifier qu’un compte `membre` ne consulte que ses propres présences.

## Retour arrière

La migration `017` refuse explicitement de revenir en arrière si une identité
Zitadel a été créée ou si un utilisateur sans `discord_id` existe. Dans ce cas,
restaurer la sauvegarde ou déployer l’image précédente en conservant le schéma
étendu ; ne jamais supprimer ces identités pour forcer un rollback.
