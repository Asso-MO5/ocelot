# Guidelines du projet Ocelot

## Suivi du travail

- Le suivi fonctionnel et technique est géré dans [htboard.xyz](https://htboard.xyz/) au moyen de la CLI `htb`.
- Le projet de référence est `MO5/OCELOT`.
- Toute évolution fonctionnelle est créée comme une user story ; son implémentation est découpée en tâches techniques rattachées à cette US avec `htb ticket create --type technical_task --parent <US-REF>`.
- Tout bug est rattaché à l'US concernée. Ne pas créer de ticket orphelin.
- Avant de modifier le code, consulter le ticket et ses critères d'acceptation ; y documenter les décisions, risques, migrations et vérifications réalisées.
- Les scénarios Gherkin et les tests associés sont mis à jour avec la tâche technique qui change le comportement.
