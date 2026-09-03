# timeline-scope

Fork ciblé d'`immich-server` : un participant peut demander qu'un album partagé dont il est
destinataire apparaisse dans sa timeline principale (web et PWA), sans partenariat complet.

Motivation, décisions et limites : `docs/superpowers/specs/2026-09-02-timeline-scopee-par-album-design.md`
du dépôt `immich-custom`. En deux phrases : le partner sharing d'Immich est tout-ou-rien par
bibliothèque entière, et l'app mobile calcule sa timeline en local — ce patch ne change donc
**rien** à ce que l'app iOS affiche, par construction.

## Ce que porte le patch

| Couche  | Changement                                                                                   |
| ------- | -------------------------------------------------------------------------------------------- |
| schéma  | `album_user.showInTimeline` (booléen, défaut `false`) + index partiel sur `userId`           |
| API     | `PUT /albums/:id/user/:userId/preferences` — chacun ne règle que sa propre préférence        |
| requête | `withSharedAlbums` sur `/timeline/buckets` et `/timeline/bucket`, plus la colonne `isShared` |
| web     | bascule dans le menu contextuel de la liste d'albums ; la timeline principale l'active       |

## Règles de vie

- Base : le **tag** amont écrit dans `upstream.env`, jamais `main`.
- La branche `timeline-scope` est **force-pushée** à chaque rebase. Ne rien y baser à long terme.
- Modifier le patch : committer, incrémenter `PATCH_REVISION` dans `upstream.env`, pousser.
- Le rebase est automatique tant qu'il ne conflicte pas ; sinon une issue est ouverte et
  **rien n'est publié** (D6).
- `mobile/` est hors périmètre. Un diff qui y touche est un bug du rebase.
