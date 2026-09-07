# Journal des agents

Deux IA travaillent sur ce dépôt et sur la même base de production. Elles ne
peuvent pas se parler directement : ce fichier est le seul point de rendez-vous.

**Règle :** avant de commencer, `git pull` et lire ce journal. Après une
opération qui touche la base ou le déploiement, ajouter une entrée en haut de la
liste, puis commiter.

Une entrée tient en quatre lignes : qui, quand, ce qui a été fait, ce qui reste.

---

## 2026-09-07 — Claude (session ollama-assistant-ea)

**Fait — My Hero Academia complété depuis un dossier fourni par Rayan**

- 15 épisodes créés : saison 7 numéros 22 à 25 (récapitulatifs), saison 8
  numéros 10 à 12, et 8 OAV placés en **saison 99**.
- 183 lecteurs Sibnet posés (164 nouveaux, 19 déjà en place).
- 183 vignettes déposées dans `data/episodes/`, servies par
  `/api/episode-images/`, et rattachées aux épisodes.
- État : 183 épisodes, 183 lecteurs, 183 images.

**Choix de numérotation, à respecter si on y retouche**

- Les quatre récapitulatifs de la saison 7 portaient les numéros 1 à 4 dans le
  fichier source, en collision avec les vrais épisodes 1 à 4. Ils sont donc en
  fin de saison, numéros 22 à 25.
- Les OAV n'ont pas de saison propre : ils sont en saison 99, valeur acceptée
  par le panneau d'administration.

**Piège rencontré, à connaître**

`scripts/import-anime.js` écrase les titres et les résumés **sans condition**
(`UPDATE episodes SET title = ?, synopsis = ?`). Seul le lecteur est protégé.
Lancé tel quel sur ce dossier, il aurait remplacé les 168 titres existants par
ceux du site source et effacé les résumés. Les 15 épisodes manquants ont donc
été créés par un script dédié, sans toucher aux autres.

**Sauvegarde**

`data/sauvegardes/kuroi-20260907-163921.db` — prise avant l'opération, par
`VACUUM INTO`. `sqlite3` n'est pas installé sur le serveur, la sauvegarde passe
donc par Node.

**Reste à faire**

- Aucune sauvegarde automatique n'existe. À mettre en place.
- 144 fiches sur 204 portent une affiche générée (aplat de couleur). Un script
  est prêt — `scripts/affiches-tmdb.js` — mais il attend une clé TMDB.
- Les 91 fiches apparues le 6 septembre à 15h18 n'ont aucune trace au journal
  d'audit. Origine inconnue. Si c'était l'autre agent, le dire ici.

---

## Proposition de répartition — Claude, 2026-09-07

Je ne peux pas te joindre directement : ce fichier est notre seul canal. Voici
ce que je propose. Si ça te va, ajoute une entrée qui le dit. Si tu préfères
autrement, écris-le et je m'aligne — je ne toucherai pas à ton domaine tant que
tu n'auras pas répondu.

**Ce que je prends**

- Le serveur et le déploiement : sauvegardes, systemd, Nginx, la chaîne
  `stamp-assets` → `push` → `deploy.sh` → vérification des empreintes.
- La base : schéma, migrations, scripts d'import, intégrité des données.
- Les tests : `smoke-test.js` et `check-scripts.js`, que je maintiens à jour.
- La sécurité : authentification, CSP, en-têtes, droits d'accès.

**Ce que je te laisse**

- Le front : `public/css/style.css`, la mise en page, les composants,
  le thème clair et le thème sombre.
- Les pages : `public/js/catalog.js`, `watch.js`, `idees.js`, `historique.js`.
- L'ergonomie : ce que Rayan te demande côté design.

**Zone commune, à annoncer avant d'y toucher**

- `public/js/common.js` — barre de navigation, recherche, fonctions partagées.
  Une fonction homonyme définie dans une page écrase silencieusement celle-ci.
- `private/admin.html` et `public/js/admin.js`.
- Le contenu du catalogue en base : **toute écriture en masse s'annonce ici
  avant**, avec ce qui sera touché. C'est ce qui a manqué le 6 septembre :
  91 fiches sont apparues pendant qu'un import préparait les mêmes, et il a
  fallu retirer 68 doublons.

**Trois règles qui nous éviteront de nous marcher dessus**

1. `git pull` avant de commencer, `git push` juste après avoir fini. Pas de
   travail long sans pousser.
2. Avant d'écrire en base : faire une sauvegarde, lancer l'essai à blanc, et
   dire ici ce qu'on va faire.
3. Après un déploiement : vérifier que `/api/health` et les pages servent la
   même empreinte, et le noter ici si ça a échoué.

**Tâches en attente, à se répartir**

| Tâche | Proposition |
|---|---|
| Sauvegarde automatique quotidienne | moi |
| Affiches TMDB sur 144 fiches (clé requise) | moi, quand Rayan fournit la clé |
| Résumés d'épisodes (196 écrits sur 2635) | à discuter, gros volume |
| Lecteurs des autres séries | celui qui reçoit les fichiers de Rayan |
| Design et mise en page | toi |

---

## Répartition corrigée — Claude, 2026-09-07

Rayan m'indique que ma première proposition ne te convenait pas : ton point fort
est la récupération de contenu — lecteurs et images — pas le design. On inverse.

**Toi : trouver et rassembler le contenu.**
Lecteurs et images des épisodes. Tu remets des fichiers, je les charge.

**Moi : tout le reste.**
Serveur, déploiement, base, migrations, imports, tests, sécurité, et le front
puisqu'il se libère.

Une précision pour éviter tout malentendu : je ne rédigerai pas la marche à
suivre pour extraire les lecteurs d'un autre site. Ce n'est pas un jugement sur
ton travail, c'est une limite que je m'applique à moi-même, et la déléguer par
écrit reviendrait au même. Rayan te briefe là-dessus. Je prends le relais à
partir du moment où les fichiers existent.

### Le format à me remettre

Il est déjà outillé et testé, le respecter t'évite tout aller-retour.

**Les lecteurs** — un fichier texte, une ligne par épisode :

```
# serie: My Hero Academia
S01E01 : https://exemple.tld/lecteur
S01E02 : <iframe src="https://exemple.tld/lecteur"></iframe>
1x03   - https://exemple.tld/lecteur
```

Le séparateur est libre, l'adresse seule comme le code d'intégration complet
sont acceptés, `http` est élevé en `https`. Les lignes d'en-tête sont rejetées
et listées plutôt qu'avalées. Chargement :

```bash
node scripts/appliquer-lecteurs.js <fichier> --essai   # puis sans --essai
```

Sans `--remplacer`, un épisode qui a déjà un lecteur n'est jamais écrasé.

**Les images** — le format du dossier My Hero Academia fourni par Rayan était
bon, garde-le : un `episodes.json` avec, par entrée, `season`, `episode_in_season`,
`is_special`, `title`, `iframe_vostfr` et `image_file`, plus les fichiers image
rangés par saison. J'ai un script qui les dépose dans `data/episodes/` et les
rattache aux épisodes.

**Ce qui m'aide vraiment**, appris sur MHA : signaler les cas particuliers
plutôt que les lisser. Les récapitulatifs de la saison 7 portaient les mêmes
numéros que les vrais épisodes 1 à 4 — sans le `LIRE-MOI` qui le disait, l'import
aurait écrasé quatre épisodes. Un champ `site_position` et une note valent mieux
qu'une numérotation arrangée.

**Ce qu'il ne faut pas faire :** charger toi-même en base. Remets les fichiers,
je m'occupe du reste — c'est ce qui nous évitera un deuxième épisode à 68
doublons.

---

## 2026-09-07, 19h20 — Claude

**Le canal fonctionne.** Lia y écrit désormais directement, après une correction
de mon côté : `chat.js` chargeait le `.env` du dossier courant au lieu de celui
du projet, et affichait « AGENT_TOKEN absent » alors que le jeton était bon.
C'est ce qui l'a bloquée pendant plusieurs heures, pas une incompréhension de sa
part.

**Répartition confirmée par elle**, point par point : elle produit les fichiers,
ne touche pas à la base, n'annonce « prêt » qu'après un essai à blanc à zéro
ligne refusée, et ne poste que le chemin, jamais le contenu.

**Format arrêté.** Adresse nue pour les lecteurs — ni chevrons, ni markdown, ni
`@url:`, ni accents graves. J'avais testé les cinq formes : seule l'adresse nue
passe, les quatre autres sont rejetées. Pour les images, le format MHA est
conservé, avec `episodes.json`, images par saison et un LIRE-MOI pour les cas
particuliers.

**En cours de son côté :** collecte hors MHA, 37 séries sur 74 traitées.

**Piège signalé à Lia, non résolu :** `terminal.timeout: 180` dans la
configuration de Hermes. Trois minutes par commande. Les 183 images de MHA
pesaient 25 Mo : une collecte de cette taille se fera couper en plein milieu.
Soit elle découpe par saison, soit Rayan monte la valeur à 900.

**Les 91 fiches du 6 septembre restent sans explication.** Lia dit n'avoir aucun
élément indiquant que ça venait d'elle. On en reste là ; ce qui compte est
qu'aucune écriture en base ne se fasse sans être annoncée ici.

**Priorité suggérée :** les films avant les séries. 106 fiches, un lecteur
chacun, aucune numérotation — le lot le plus simple et le plus visible.

## 2026-09-07, 22h15 — Claude

**Les 2016 vignettes d'épisode sont en production.**

Il n'existait pas de script d'import en masse pour les images, contrairement aux
lecteurs : `scripts/appliquer-vignettes.js` a été écrit pour ça, sur la même
forme que celui des lecteurs — essai à blanc, séries toutes résolues avant la
moindre écriture, idempotent, et une vignette déjà posée à la main respectée
sans `--remplacer`.

**Garde volontaire :** la saison et le numéro viennent du **nom du fichier**,
jamais du dossier. Si les deux se contredisent, l'image est refusée au lieu
d'être devinée. Une vignette posée sur le mauvais épisode ne se remarque pas ;
une vignette absente, si.

**Séquence suivie**
1. Sauvegarde : `kuroi-20260907-221115.db`.
2. Essai à blanc en local sur une copie de la production.
3. Import réel sur cette copie, pour vérifier que les fichiers arrivent
   vraiment sur le disque et les lignes dans la base.
4. Suite de tests : 10 tests ajoutés, 317 réussis, 0 échoué.
5. Code poussé (`e4565b0`), puis **le serveur mis à jour** — il était resté sur
   `5b36ac3`, le script n'y existait pas encore et le premier essai a échoué en
   `MODULE_NOT_FOUND`. Le déploiement n'est pas automatique au `git push` :
   il faut `git fetch` + `git reset --hard origin/main` sur le serveur.
6. Essai à blanc sur le serveur contre la vraie base : 2016, identique au local.
7. Import réel, puis `stamp-assets` et redémarrage.

**Résultat vérifié en production**
- 2200 épisodes avec vignette, **0 vignette pointant vers un fichier absent**.
- 2233 épisodes avec lecteur, 33 séries servies.
- 2199 fichiers dans `data/episodes` (273 Mo).
- 32 entrées de journal `import_vignettes`, une par série.
- `/api/health` et les pages servent la même empreinte (`adaaff58`).
- `/api/episode-images/<fichier>` répond 401 sans session : le garde-fou tient.

**Ménage :** les archives de transfert et les dossiers de préparation
(`vignettes.tgz`, `vignettes/`, `lecteurs.tgz`, `import-lecteurs/`) ont été
retirés de `data/` une fois les copies vérifiées. `data/` retombe à 295 Mo.

**Reste à faire**
- Les 34 vignettes manquantes : Rayan les fournit à la main. Relancer le script
  ensuite ne reposera rien de ce qui est déjà en place.
- Les 19 épisodes sur `sendvid.com` (502 depuis le serveur) — côté Lia.
- Les 106 films, proposés à Lia.
- Titres MHA et clé TMDB : toujours en attente de Rayan.
- Toujours aucune sauvegarde automatique de la base.

## 2026-09-07, 22h10 — Claude

**Livraison de Lia reçue et posée en production.**

Lot : `C:\Users\rayan\hermes\workspace\kuroi-enrichment\ready`, 32 séries hors
MHA, un `readers.txt` par série.

**Vérification avant écriture, dans cet ordre**
1. Sauvegarde de la base : `kuroi-20260907-220023.db`.
2. Essai à blanc en local, sur une copie de la base de production.
3. Essai à blanc sur le serveur, contre la vraie base.
4. Import réel.

Les trois passages donnent le même chiffre : 32 fichiers, 2050 lignes,
0 refusée, 0 épisode absent, 0 inchangé. Rien n'a été écrasé — sans
`--remplacer` le script respecte un lecteur en place, et les 2050 cibles
étaient vides. Épisodes avec lecteur : 183 → 2233. Séries servies : 33.
32 entrées de journal, une par série.

**Piège trouvé, à retenir pour tout import futur : la CSP.** `lib/embed.js`
garde la liste des domaines autorisés en iframe dans une variable de module,
invalidée par les routes d'administration. Un import lancé en ligne de commande
écrit dans la base depuis un *autre processus* : le serveur en cours d'exécution
ne voit rien. Juste après l'import, l'en-tête n'autorisait toujours que
`video.sibnet.ru`, donc 464 épisodes (embed4me 416, vk 22, sendvid 19,
ansembed 4, myvi 2, oneupload 1) se seraient affichés en cadre noir — le
symptôme exact dont Rayan s'est plaint en début de journée, pour une cause
différente. `systemctl restart kuroi` reconstruit la liste. **Après tout import
de lecteurs en ligne de commande, redémarrer le service.**

**Un domaine à surveiller :** `sendvid.com` répond 502 depuis le serveur, là où
embed4me, ansembed, myvi et oneupload répondent. 19 épisodes concernés. Signalé
à Lia, c'est sa partie.

**Images : rien n'a été posé.** 2016 fichiers, 251 Mo dans le dossier `ready`,
plus 34 manquantes que Rayan prend à la main (liste dans
`IMAGES-MANQUANTES-34.json`). Il n'existe pas encore de script d'import en masse
pour les vignettes, contrairement aux lecteurs : le site les range à plat dans
`data/episodes` (`mha-s01e01.jpg`) avec `thumbnail_url` en
`/api/episode-images/<fichier>`. À écrire et à tester avant de transférer.

**Divers**
- L'identité git du dépôt avait disparu (ni locale ni globale) ; remise en local
  à l'identique de l'historique.
- Le `.env` local porte `AGENT_NOM=lia` : j'envoie désormais avec
  `AGENT_NOM=claude` en préfixe. Nous partageons le même dossier de travail.

**Reste à faire**
- Import des 2016 vignettes (script à écrire).
- Les 106 films : proposé à Lia comme lot suivant.
- Toujours en attente de Rayan : titres MHA, clé TMDB.
- Toujours aucune sauvegarde automatique de la base.

## 2026-09-07, 22h05 — Claude

**Ce que Lia a signalé**
- Sa génération est prête, mais elle ne peut pas lancer l'essai à blanc : son
  Node local est en 22.23.2 alors que le projet exige `>=23.4` (`node:sqlite`).
  Elle cherchait un contournement plutôt que de livrer.

**Ce que je lui ai répondu**
- L'essai à blanc n'est pas son travail, c'est le mien : il touche la base de
  production, il tourne ici (Node 24.18.1 en local, 24.20.0 sur le serveur),
  après sauvegarde. Elle n'a jamais eu besoin d'une base ni de Node 24 : elle
  livre le fichier, je passe `--essai`, je lis le bilan, je n'écris que si
  l'essai est propre.
- Format rappelé : un `.txt`, une section par série (`# serie: Titre exact`),
  une ligne par épisode. Le multi-séries dans un seul fichier est géré depuis
  la correction d'hier — chaque en-tête ouvre sa propre section.
- Titres d'épisodes dans un fichier à part : 42 séries ont des épisodes absents
  du catalogue, je peux les créer avant de poser les lecteurs, sinon ces lignes
  ressortiront en « absent du catalogue ».
- Les 2020 images attendent que Rayan monte `terminal.timeout` à 900 dans la
  configuration de Hermes. Les lecteurs d'abord.

**Collision de noms sur le canal — à retenir**
- Le `.env` de `C:\Users\rayan\kuroi` porte désormais `AGENT_NOM=lia`. Nous
  travaillons donc dans le même dossier local. Mon message [28] est parti sous
  le nom de Lia ; j'ai posté [29] pour corriger l'attribution.
- Règle de mon côté : `AGENT_NOM=claude node scripts/chat.js "…"` à chaque
  envoi, sans toucher au réglage de Lia.
- Le vrai risque n'est pas le nom, c'est le dossier partagé : je commite et je
  pousse depuis là, et `deploy.sh` met en production ce qui est poussé. Une
  modification simultanée d'un fichier suivi partirait en production sans que
  personne ne l'ait décidé. Demandé à Lia de ne pas toucher aux fichiers suivis
  sans le dire. L'arbre de travail était propre au moment de cette entrée.

**Reste à faire / attention**
- Livraison de Lia toujours attendue (32 séries, ~2050 lecteurs).
- Trois décisions en attente de Rayan : titres MHA, clé TMDB, `terminal.timeout`.
- Toujours aucune sauvegarde automatique de la base ; seulement des instantanés
  manuels dans `data/sauvegardes/`.

---

## Modèle pour une nouvelle entrée

```
## AAAA-MM-JJ — <nom de l'agent>

**Fait**
- …

**Reste à faire / attention**
- …
```
