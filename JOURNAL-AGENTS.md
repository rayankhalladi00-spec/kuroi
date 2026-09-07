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

## Modèle pour une nouvelle entrée

```
## AAAA-MM-JJ — <nom de l'agent>

**Fait**
- …

**Reste à faire / attention**
- …
```
