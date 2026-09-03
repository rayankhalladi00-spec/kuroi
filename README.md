# Kuroi

Plateforme de streaming façon Netflix : films, séries et jeux, avec comptes
utilisateurs et panneau d'administration.

- **Films / séries** : lecteur intégré. Le champ accepte un lien, un partage
  Google Drive, ou tout un code d'intégration `<iframe>` — seule l'adresse en
  est extraite.
- **Jeux** : fichiers joints téléchargeables (`.torrent`, archives) servis aux
  seuls membres, ou lien externe.
- **Affiches** : envoyées depuis l'administration, signature du fichier vérifiée.
- **Comptes** : inscription, connexion, sessions persistantes.
- **Ma liste** : favoris propres à chaque membre.
- **Recherche** dans le catalogue (titre, genre, année, description).
- **Boîte à idées** : les membres proposent des titres et votent ; l'équipe
  répond et suit chaque proposition (proposé, prévu, ajouté, refusé).
- **Thème clair / sombre** au choix, mémorisé, aligné par défaut sur le système.
- **Administration** : gestion des comptes (rôles, bannissement, réinitialisation
  de mot de passe, suppression), gestion du catalogue, journal des actions.

Aucune dépendance native : la base est SQLite via le module `node:sqlite` intégré
à Node. Rien à compiler, rien à installer à côté.

## Prérequis

Node **24 ou plus récent** (`node:sqlite` est disponible sans drapeau depuis
Node 23.4).

## Lancer en local

```bash
npm install
cp .env.example .env     # renseigner SESSION_SECRET
npm start
```

Le site répond sur http://127.0.0.1:3000. Au tout premier démarrage, le compte
administrateur est créé : les identifiants s'affichent dans la console et sont
écrits dans `data/ADMIN_CREDENTIALS.txt`.

## Tests

```bash
npm run smoke
```

92 vérifications de bout en bout : authentification, cloisonnement des droits,
CRUD du catalogue, envois de fichiers, extraction des lecteurs, boîte à idées,
favoris, bannissement, garde-fous administrateur et anti-force-brute.

## Déploiement sur le VPS

Première installation, en root sur un Ubuntu 24.04 vierge :

```bash
curl -fsSL https://raw.githubusercontent.com/rayankhalladi00-spec/kuroi/main/deploy/install.sh | bash -s -- https://github.com/rayankhalladi00-spec/kuroi.git
```

Le script installe Node 24, Nginx, le pare-feu, crée le service systemd et
démarre le site.

Mises à jour suivantes :

```bash
ssh root@IP 'bash /opt/kuroi/deploy/deploy.sh'
```

### Domaine et HTTPS

Une fois le domaine pointé sur l'IP du VPS (enregistrement `A`) :

```bash
certbot --nginx -d exemple.com -d www.exemple.com
```

## Structure

```
server.js            point d'entrée Express
db.js                schéma SQLite et journal d'audit
session-store.js     magasin de sessions adossé à SQLite
middleware/auth.js   chargement de l'utilisateur, gardes auth/admin
routes/auth.js       inscription, connexion, déconnexion
routes/content.js    catalogue (lecture, réservé aux membres)
routes/admin.js      gestion des comptes et du catalogue
public/              pages et ressources publiques
private/admin.html   panneau d'administration (servi seulement aux admins)
deploy/              systemd, Nginx, scripts d'installation et de mise à jour
```

## Sécurité

- Mots de passe hachés avec bcrypt (coût 12). Ils ne sont **jamais** stockés ni
  affichables en clair : l'administrateur peut réinitialiser un mot de passe,
  pas le consulter.
- Sessions en base, cookie `httpOnly` + `sameSite=lax`, `secure` en production.
- Limitation à 10 tentatives de connexion par quart d'heure et par IP.
- Rôle et bannissement relus à chaque requête : un bannissement coupe la session
  en cours immédiatement.
- En-têtes de sécurité et politique CSP via Helmet.
- Le dernier administrateur ne peut être ni supprimé, ni banni, ni rétrogradé.
