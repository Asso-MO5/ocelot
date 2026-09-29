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

## Rôles d’organisation et scopes musée

L’API applique un modèle de scopes : chaque route musée vérifie **un seul**
scope exact porté par le claim Zitadel. Il n’y a ni héritage, ni rôle
administrateur implicite dans le serveur. Les rôles d’organisation servent à
gérer les populations dans Zitadel ; l’attribution des scopes reste explicite.

| Rôle d’organisation | Usage |
| --- | --- |
| `administrateur` | Administration MO5 globale ; aucun droit API musée implicite. |
| `bureau` | Fonction associative ; aucun droit API musée implicite. |
| `membre` | Appartenance à MO5 ; accès à ses propres présences uniquement. |
| `museum_administrateur` | Fonction de responsable musée ; aucun droit API musée implicite. |

| Scope Zitadel | Une route qui le demande autorise |
| --- | --- |
| `museum_mediateur` | Recherche et contrôle de billets, entrée et zone réservée aux majeurs. |
| `museum_ticket_manage` | Billets, commandes, statistiques, PDF et codes cadeaux. |
| `museum_configuration` | Tarifs, horaires, périodes, événements et réglages. |
| `museum_member_presence_manage` | Consultation, refus et suppression des présences de l’ensemble des membres. |
| `museum_donation_proof_manage` | Génération des justificatifs de don. |

Attributions minimales recommandées :

| Personne | Rôles/scopes Zitadel à attribuer |
| --- | --- |
| Membre médiateur | `membre` + `museum_mediateur` |
| Responsable de configuration | `museum_configuration` |
| Gestionnaire de billetterie | `museum_ticket_manage` |
| Administrateur musée | `museum_administrateur` + les scopes nécessaires à son périmètre (souvent les cinq) |
| Bureau ou administrateur MO5 intervenant au musée | Son rôle d’organisation + les scopes nécessaires ; jamais le rôle seul |

Les scopes sont centralisés dans `src/features/auth/auth.permissions.ts`. Une
route métier ne doit pas accepter une liste de rôles ni reconstituer une
hiérarchie côté serveur.

### Retrait des anciens rôles

Après attribution et recette des nouveaux scopes à tous les comptes concernés,
supprimer dans Zitadel les rôles techniques historiques `dev`, `museum` et
`museum_ticket_scan`, ainsi que les rôles Discord devenus inutiles. Ils ne sont
plus définis ni interprétés par l’API : un claim inconnu est refusé pour toute
route protégée.

### Recette de sécurité avant mise en production

1. Tester un membre médiateur avec `membre` + `museum_mediateur` : le scan est
   autorisé, la configuration et les commandes sont refusées.
2. Tester chaque scope seul : il n’autorise que les routes de son tableau.
3. Tester un compte `administrateur`, `bureau` ou `museum_administrateur` sans
   scope : toute route musée sensible est refusée.
4. Retirer les anciens rôles de comptes de test, se reconnecter, puis vérifier
   que leur claim Zitadel ne contient que les rôles/scopes attendus.

## Retour arrière

La migration `017` refuse explicitement de revenir en arrière si une identité
Zitadel a été créée ou si un utilisateur sans `discord_id` existe. Dans ce cas,
restaurer la sauvegarde ou déployer l’image précédente en conservant le schéma
étendu ; ne jamais supprimer ces identités pour forcer un rollback.
