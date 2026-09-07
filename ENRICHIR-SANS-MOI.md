# Enrichir le catalogue sans moi

Ce document permet de remplir le catalogue de Kuroi — lecteurs et vignettes —
sans passer par un agent qui connaît déjà le projet. Il s'adresse à Rayan et à
l'agent qui collecte (Lia).

Tout ce qui est décrit ici est déployé, testé et vérifié en production au
7 septembre 2026, 23 h.

---

## 1. Qui fait quoi

**L'agent qui collecte** trouve les adresses des lecteurs et les images. Il
produit des fichiers texte et des dossiers d'images. **Il ne touche jamais à la
base ni au serveur.**

**Celui qui importe** (Rayan, ou n'importe quel agent avec un accès au serveur)
lance les commandes de la section 5.

La méthode de collecte n'est pas décrite ici : elle appartient à celui qui
collecte. Ce document ne définit que **le format de livraison** et **la façon
d'importer**.

---

## 2. Ce qui est déjà fait — ne pas le refaire

| | |
|---|---|
| Épisodes avec un lecteur | 2233 |
| Séries servies | 33 |
| Épisodes avec une vignette | 2200 |
| Fichiers de vignettes sur le serveur | 2199 |

Les 2050 lecteurs et les 2016 vignettes du lot « hors MHA » sont **posés et en
ligne**. Il ne faut ni les recollecter, ni les relivrer. Les scripts sont de
toute façon idempotents : relancer ne repose rien.

34 vignettes manquent ; Rayan les fournit à la main. La liste est dans
`IMAGES-MANQUANTES-34.json`, dans l'espace de travail de l'agent.

---

## 3. Ce qui reste

- **107 films** sans aucun lecteur
- **417 épisodes** sans lecteur, sur **8 séries** : Re:Zero 81, Rick et Morty 81,
  Kuroko's Basket 76, Demon Slayer 63, Mushoku Tensei 47, Konosuba 31,
  Cowboy Bebop 26, « Presque mariés, loin d'être amoureux » 12
- **450 épisodes** sans vignette
- **2233 épisodes** qui n'ont qu'un seul lecteur, sans secours

Pour connaître l'état à tout moment, voir la section 6.

**Consigne en vigueur :** deux lecteurs par épisode quand ils existent, Sibnet
en première ligne, le second en secours. Un seul lecteur trouvé : on le pose et
on note le trou. Aucun lecteur : on note le trou. On ne vérifie pas que la
vidéo se lance.

---

## 4. Le format de livraison

### Les lecteurs

Un fichier `.txt`. Une section par titre, introduite par `# serie:`. Une ligne
par lecteur.

```
# serie: Demon Slayer
S01E01 : https://video.sibnet.ru/shell.php?videoid=1234567
S01E01 : https://autre.tld/secours
S01E02 : https://video.sibnet.ru/shell.php?videoid=1234568
```

**Répéter le numéro d'un épisode donne plusieurs lecteurs.** Le premier devient
le lecteur principal, les suivants des lecteurs de secours entre lesquels le
visiteur bascule depuis la page de lecture.

Un film s'écrit de la même façon, avec une seule ligne `S01E01` par lecteur :

```
# serie: Akira
S01E01 : https://a.tld/akira
S01E01 : https://b.tld/akira
```

Oui, on écrit `# serie:` même pour un film, et `S01E01` même quand il n'y a pas
d'épisode. C'est la syntaxe : ne pas la changer.

**Trois règles qui évitent de perdre le travail :**

1. **Les titres doivent être ceux du site, exactement.** Un titre approximatif
   fait écarter toute la section. La liste exacte se génère avec la commande de
   la section 6.
2. **Plusieurs séries peuvent tenir dans un même fichier** : chaque `# serie:`
   ouvre sa propre section.
3. **Une section vide est acceptable** : elle signifie « rien trouvé ». C'est
   une information utile, pas un échec.

Sont aussi acceptés : le code d'intégration complet (`<iframe src="...">`,
seule l'adresse est gardée), les écritures `1x02` et `S1 E2`, et un numéro seul
(saison 1 par défaut).

### Les vignettes

Un dossier par série, un sous-dossier par saison :

```
Bleach/
  readers.txt          (facultatif : sa ligne « # serie: » nomme la série)
  Saison-01/S01E01.jpg
  Saison-01/S01E02.jpg
  Saison-02/S02E01.jpg
```

Le nom du fichier fait foi pour la saison et le numéro. S'il contredit son
dossier, l'image est refusée plutôt que devinée — une vignette posée sur le
mauvais épisode ne se remarque pas, une vignette absente si.

Extensions acceptées : `.jpg`, `.jpeg`, `.png`, `.webp`.

---

## 5. Importer

**Node 23.4 ou plus est obligatoire** (le projet utilise `node:sqlite`). Sur le
serveur, Node 24 est installé. En local, vérifier avec `node -v`.

### 5.1 Sauvegarder — toujours, avant toute écriture

```bash
ssh -i ~/.ssh/kuroi_vps -o IdentitiesOnly=yes root@31.70.133.100 \
  "node /tmp/sauvegarde.js $(date +%Y%m%d-%H%M%S)"
```

La sauvegarde atterrit dans `/opt/kuroi/data/sauvegardes/`.

### 5.2 Envoyer le fichier sur le serveur

```bash
scp -i ~/.ssh/kuroi_vps -o IdentitiesOnly=yes films-01.txt \
  root@31.70.133.100:/opt/kuroi/data/import/
```

Créer le dossier au préalable si besoin :

```bash
ssh -i ~/.ssh/kuroi_vps -o IdentitiesOnly=yes root@31.70.133.100 \
  "mkdir -p /opt/kuroi/data/import && chown kuroi:kuroi /opt/kuroi/data/import"
```

`data/` est le seul endroit où le service peut écrire : ailleurs, l'envoi
échoue en `EROFS`.

### 5.3 Essai à blanc — lire le bilan avant d'écrire

```bash
ssh -i ~/.ssh/kuroi_vps -o IdentitiesOnly=yes root@31.70.133.100 \
  "cd /opt/kuroi && sudo -u kuroi node scripts/appliquer-lecteurs.js data/import/films-01.txt --essai"
```

Le bilan indique, série par série : lecteurs principaux posés, lecteurs de
secours, inchangés, épisodes absents du catalogue, lignes refusées.

**Ne pas importer si des séries sont « écartées »** : cela signifie que leur
titre ne correspond à rien dans le catalogue, et leurs lignes seraient perdues.
Corriger les titres d'abord.

### 5.4 Importer pour de vrai

La même commande, sans `--essai`.

### 5.5 Redémarrer — indispensable

```bash
ssh -i ~/.ssh/kuroi_vps -o IdentitiesOnly=yes root@31.70.133.100 \
  "systemctl restart kuroi"
```

**Pourquoi c'est obligatoire :** le serveur n'autorise en iframe que les
domaines présents dans le catalogue, et il garde cette liste en mémoire depuis
son démarrage. Un import lancé en ligne de commande écrit dans la base depuis
un autre processus : le serveur n'en sait rien. Sans redémarrage, les épisodes
dont le lecteur vient d'un domaine nouveau s'affichent **en cadre noir**.

C'est arrivé le 7 septembre : 464 épisodes auraient été noirs.

### 5.6 Les vignettes

Même principe, avec l'autre script :

```bash
ssh -i ~/.ssh/kuroi_vps -o IdentitiesOnly=yes root@31.70.133.100 \
  "cd /opt/kuroi && sudo -u kuroi node scripts/appliquer-vignettes.js data/import/vignettes --essai"
```

Le dossier passé en argument peut être celui d'une seule série, ou un dossier
qui en contient plusieurs.

Pour transférer les images, une archive vaut mieux que des fichiers un par un :

```bash
tar czf vignettes.tgz mon-dossier
scp -i ~/.ssh/kuroi_vps -o IdentitiesOnly=yes vignettes.tgz root@31.70.133.100:/opt/kuroi/data/
ssh -i ~/.ssh/kuroi_vps -o IdentitiesOnly=yes root@31.70.133.100 \
  "cd /opt/kuroi/data && mkdir -p import/vignettes && tar xzf vignettes.tgz -C import/vignettes && chown -R kuroi:kuroi import"
```

### 5.7 Vérifier après coup

```bash
curl -s https://kuroi.me/api/health
curl -s https://kuroi.me/connexion | grep -o 'v=[a-f0-9]*' | sort -u
```

Les deux doivent afficher **la même empreinte**. Si elles diffèrent, le
déploiement n'est pas allé au bout.

Et pour voir les domaines autorisés en iframe :

```bash
curl -s -D- -o /dev/null https://kuroi.me/connexion | tr ';' '\n' | grep -i frame-src
```

---

## 6. Connaître l'état du catalogue

Cette commande écrit la liste exacte des titres et ce qui manque pour chacun :

```bash
ssh -i ~/.ssh/kuroi_vps -o IdentitiesOnly=yes root@31.70.133.100 \
  "cd /opt/kuroi && sudo -u kuroi node -e \"
const {db}=require('./db');
for (const f of db.prepare(\\\"SELECT title,video_url FROM content WHERE type='film' ORDER BY title\\\").all())
  console.log((f.video_url?'[ok]     ':'[A FAIRE]')+' '+f.title);
for (const s of db.prepare(\\\"SELECT id,title FROM content WHERE type='serie' ORDER BY title\\\").all()) {
  const l=db.prepare('SELECT video_url,thumbnail_url FROM episodes WHERE content_id=?').all(s.id);
  const sans=l.filter(e=>!e.video_url).length, img=l.filter(e=>!e.thumbnail_url).length;
  console.log(s.title+' — '+l.length+' episodes, '+sans+' sans lecteur, '+img+' sans image');
}
\""
```

Les titres qu'elle affiche sont ceux à recopier tels quels après `# serie:`.

---

## 7. Ce qu'il ne faut pas faire

- **Ne pas écrire en base sans sauvegarde ni essai à blanc.** Les deux prennent
  dix secondes et ont déjà évité une perte ce soir-là.
- **Ne pas oublier le redémarrage** après un import de lecteurs (section 5.5).
- **Ne pas déduire un déploiement d'un `git push`.** Le serveur ne se met pas à
  jour tout seul : il faut `git fetch` puis `git reset --hard origin/main` sur
  la machine, puis redémarrer.
- **Ne pas mettre de secret dans ce dépôt** : il est public. Jetons, mots de
  passe et clés restent dans les `.env`, qui sont ignorés par git.
- **Ne pas recommencer un lot entier à cause de quelques trous.** Un trou se
  note et se comble plus tard ; une reprise complète coûte des heures. Les
  scripts étant idempotents, un second passage ne pose que ce qui manquait.

---

## 8. Si quelque chose se passe mal

| Symptôme | Cause la plus probable |
|---|---|
| « Aucun titre ne correspond à … » | Le titre ne correspond pas exactement au catalogue (section 6) |
| Beaucoup d'« épisodes absents du catalogue » | Les épisodes n'existent pas encore dans la fiche |
| Lecteur en cadre noir | Service non redémarré après l'import (section 5.5) |
| `EROFS` à l'écriture | Fichier envoyé ailleurs que dans `data/` |
| `MODULE_NOT_FOUND` | Le serveur est en retard sur le dépôt : `git fetch` + `git reset --hard` |
| Page inchangée après déploiement | Empreintes différentes entre `/api/health` et la page |

La suite de tests répond de l'ensemble : `node scripts/smoke-test.js`, 328 tests.
Elle se lance en local et n'a besoin d'aucun accès au serveur. Un test rouge
avant un import vaut mieux qu'une base à restaurer après.
