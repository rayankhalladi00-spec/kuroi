# Note de reprise

À lire avant de toucher au code. Ce fichier ne décrit pas l'architecture — le
README s'en charge — mais les pièges qui ont déjà fait tomber le site, avec la
raison de chacun. Ils ne se devinent pas à la lecture des sources.

---

## Avant tout

**Node 23.4 minimum.** La base passe par `node:sqlite`, disponible sans drapeau
seulement à partir de cette version. `db.js` refuse de démarrer en dessous, avec
un message clair plutôt qu'un « Cannot find module » obscur.

**La barrière, c'est la suite de tests.** `node scripts/smoke-test.js` démarre un
vrai serveur sur une base jetable et exécute ~282 vérifications. Rien ne part en
production sans qu'elle soit verte.

**Un second contrôle existe :** `node scripts/check-scripts.js`. Il relit chaque
script de page et signale tout appel vers une fonction définie nulle part. Il a
été écrit après qu'une suppression de code a emporté `skeletons()` en laissant
son appel : syntaxe valide, tests au vert, et **accueil entièrement vide en
production**.

---

## Le piège qui revient : supprimer du code par tranche

C'est ainsi que `skeletons()` a disparu. Découper un fichier entre deux
marqueurs (`s.index(début)` … `s.index(fin)`) emporte tout ce qui se trouve
entre les deux, y compris ce qu'on n'avait pas vu. La syntaxe reste valide, donc
rien ne proteste.

Supprimer en citant le texte exact à retirer, jamais une plage. Et relancer
`check-scripts.js` après toute suppression.

---

## Déploiement

```bash
git push origin main
ssh root@<vps> "bash /opt/kuroi/deploy/deploy.sh"
```

**Vérifier après coup, systématiquement :**

```bash
curl -s https://kuroi.me/api/health          # -> {"assets":"<empreinte>"}
curl -s https://kuroi.me/index.html | grep -o 'style\.css?v=[a-f0-9]*'
```

Les deux empreintes doivent être identiques. Si elles diffèrent, le
redémarrage n'a pas eu lieu : le processus sert encore l'ancien code pendant que
les pages réclament le nouveau. Ce cas s'est produit — `npm ci` avait expiré, le
`systemctl restart` n'a jamais tourné, et une route pourtant présente dans le
code répondait 404.

**Ne jamais modifier un `?v=` à la main.** `scripts/stamp-assets.js` calcule
l'empreinte à partir du contenu et réécrit les pages. Nginx met les fichiers
statiques en cache une semaine : sans nouvelle empreinte, les visiteurs gardent
l'ancienne version et « le site n'a pas changé ».

---

## Le service n'écrit que dans `data/`

L'unité systemd tourne avec `ProtectSystem=strict` et
`ReadWritePaths=/opt/kuroi/data`. Tout le reste du disque lui est en lecture
seule.

Un envoi de fichier écrit donc dans `data/`, jamais dans `public/`. Écrire
ailleurs échoue en `EROFS`, y compris pour une image qu'on croyait anodine. Les
photos de profil, les images d'épisode et les pièces jointes suivent tous cette
règle, chacune avec sa route de service dédiée.

---

## Ne jamais couper le Referer

Deux réglages ont empêché **tout lecteur vidéo de fonctionner sur iPhone**,
pendant des mois, sans le moindre symptôme sur ordinateur :

- `helmet()` pose `Referrer-Policy: no-referrer` **par défaut**. Il faut le
  surcharger — le site envoie `strict-origin-when-cross-origin`.
- Un lien `rel="noopener noreferrer"` vers un lecteur supprime le Referer du
  nouvel onglet. `noopener` seul suffit à la protection.

Safari sur iOS **propage la politique de referer** à la page ouverte, iframe
comprise. La page de l'hébergeur héritait donc de l'absence de Referer et
réclamait son propre flux sans en-tête ; l'hébergeur refusait. Mesuré chez
sibnet : 403 sans Referer, 302 avec.

Cinq tests verrouillent l'ensemble, section « Referer des lecteurs vidéo ».

---

## Base de données

**Les colonnes s'ajoutent par migration.** `CREATE TABLE IF NOT EXISTS` ne
touche pas une table existante : une colonne nouvelle doit passer par
`ensureColumn()`, sinon la production reste en arrière pendant que le code la
réclame.

**Un index sur une colonne migrée se crée APRÈS la migration**, jamais dans le
bloc `db.exec()` initial. Posé avant, il vise une colonne qui n'existe pas
encore sur une base déjà installée : le service refuse de démarrer, alors que
tout va bien sur une base neuve. Un test rejoue ce cas — section « Migration du
schéma ».

**SQLite refuse une expression dans une contrainte `UNIQUE`**, mais l'accepte
dans un index. D'où l'index `idx_watched_unique` avec son `COALESCE`, sans quoi
les lignes des films s'empileraient : deux `NULL` sont distincts pour une clé
unique.

**La table `files` n'accepte que `attachment` et `poster`** (contrainte `CHECK`),
et SQLite ne sait pas assouplir une contrainte après coup. Un nouveau type de
fichier passe donc par son propre dossier dans `data/`, comme les images
d'épisode et les photos de profil.

---

## `.gitignore` : ancrer les motifs

`data/` sans barre oblique initiale exclut **aussi** `scripts/data/`. Un dossier
entier de données d'import a disparu du dépôt sans le moindre avertissement, et
donc de l'archive envoyée au serveur. Les motifs sont ancrés (`/data/`), et
doivent le rester.

---

## Ce qui ne doit jamais sortir de la machine

Rien de tout cela n'est dans le dépôt, et c'est délibéré :

| Quoi | Où | Pourquoi |
|---|---|---|
| `.env` | racine du projet | secret de session, mot de passe administrateur |
| `~/.ssh/kuroi_vps` | clé privée SSH | accès root au serveur |
| `data/` | base SQLite | comptes des membres, empreintes de mots de passe, sessions |

`.env.example` donne la liste des variables attendues, sans valeurs.

---

## Deux détails qui font perdre du temps

**La CSP `frame-src` est construite à partir du catalogue.** Ajouter un lecteur
d'un nouvel hébergeur suffit : la liste se reconstruit toute seule. Inutile de
la modifier à la main — mais penser aux lecteurs supplémentaires, qui vivent
dans `episode_sources` et ont été oubliés une fois.

**Les scripts de page partagent l'espace global avec `common.js`.** Une fonction
homonyme définie dans une page écrase silencieusement celle de `common.js` :
c'est ainsi qu'un `renderNav` local a fait disparaître la barre de navigation de
toutes les fiches. Un test vérifie qu'aucun script de page n'écrase une fonction
commune.

---

## Outils utiles

```bash
node scripts/import-anime.js <fichier> [--dry]   # fiches et épisodes
node scripts/appliquer-lecteurs.js <fichier>     # lecteurs en masse
node scripts/affiches-tmdb.js --essai            # affiches (clé TMDB requise)
node scripts/smoke-test.js                       # la suite complète
node scripts/check-scripts.js                    # appels orphelins
```

Tous acceptent un mode d'essai qui n'écrit rien. S'en servir d'abord.
