# Kuroi — dossier pour une passe de design

À coller tel quel dans une session dédiée au design.

## Ce qu'est le site

Site de streaming **privé**, un seul utilisateur administrateur et quelques
proches. Catalogue de 151 titres : 79 films, 71 séries, 1 jeu. Les séries ont
jusqu'à 2555 épisodes au total.

Public : des amis, sur téléphone autant que sur ordinateur. Pas de visiteurs
anonymes — tout est derrière une connexion.

## Contraintes techniques, non négociables

- **CSS écrit à la main, un seul fichier** (`public/css/style.css`, 2064 lignes).
  Pas de Tailwind, pas de Sass, pas de build CSS. Le fichier est servi tel quel.
- **Pas de framework front.** JavaScript natif, un script par page, un
  `common.js` partagé. Pas de React.
- **Deux thèmes obligatoires** : sombre (référence) et clair. Le clair redéfinit
  les mêmes jetons sous `:root[data-theme='light']`. Aucune couleur en dur
  ailleurs que dans les jetons.
- Le HTML est produit par des gabarits JavaScript, pas de fichiers de composants.
- Empreinte de cache : le CSS est servi avec `?v=<hash>`, un script s'en charge.

## Jetons actuels (thème sombre)

```css
--bg:            #08080c;    --bg-elev:     #121219;
--bg-card:       #17171f;    --bg-hover:    #1f1f2a;
--line:          #26262f;    --line-strong: #35353f;

--text:          #f4f4f7;    --text-muted:  #9b9baa;   --text-faint: #6c6c7c;

--accent:        #e50914;    --accent-hover: #ff2b36;
--accent-soft:   rgba(229, 9, 20, .14);   --on-accent: #ffffff;

--ok: #3ddc84;   --warn: #ffb020;   --danger: #ff6b72;   (+ variantes -soft)

--radius: 13px;  --radius-lg: 20px;  --radius-media: 18px;
--shadow: 0 10px 40px rgba(0,0,0,.55);   --shadow-soft: 0 2px 12px rgba(0,0,0,.3);

--fast: 140ms;   --normal: 240ms;   --slow: 400ms;
--ease: cubic-bezier(.22, .61, .36, 1);
```

Polices : **Inter** pour l'interface, **Bebas Neue** pour le logotype seulement.

**L'accent rouge est imposé.** Un essai en orange a été rejeté par le
propriétaire. Ne pas le remettre en question.

## Le vrai problème à résoudre

Il n'y a **ni échelle typographique ni échelle d'espacement** en jetons. Les
tailles (`font-size: 13px`, `15px`, `21px`, `23px`…) et les marges (`9px`,
`14px`, `18px`, `26px`, `44px`, `52px`…) sont posées à la main, cas par cas, sur
180 classes. Conséquence : chaque nouveau bloc demande un réglage au pixel, et
rien ne garantit la cohérence entre deux écrans.

**C'est la demande principale** : proposer une échelle de tailles de texte et
une échelle d'espacement, sous forme de jetons, puis dire quelles valeurs
existantes s'y rattachent. Le remplacement dans le fichier sera fait ensuite.

Second sujet, plus léger : les **états** des composants (survol, focus clavier,
désactivé, chargement) sont traités inégalement. Une règle générale serait utile.

## Inventaire des composants

Barre de navigation (liens en pastille, recherche, thème, profil) · carrousel de
une (affiche + compteur + badges + bandeau de vignettes + flèches) · rangées
horizontales de cartes d'affiche · carte « Reprendre » en paysage · grille
d'épisodes en 6 colonnes avec vignette et bouton « vu » · lecteur vidéo ·
notes sur 10 · fil de commentaires avec réponses et j'aime · fenêtre de
recherche en surimpression · boîte à idées avec votes · historique · panneau
d'administration (tableaux, formulaires, fenêtres modales, onglets).

Préfixes de classes existants : `.nav-`, `.hero-`, `.card-`, `.row-`, `.ep-`,
`.recherche-`, `.commentaire-`, `.note-`, `.idea-`, `.hist-`, `.admin-`.

## Cadrage déjà arrêté, à conserver

- **Cartes d'affiche** : largeur proportionnelle à l'écran, calculée pour qu'il
  en tienne 6,15 par rangée sur ordinateur, 2,5 sur téléphone.
- **Grille d'épisodes** : 6 colonnes, puis 4, 3, 2 selon la largeur. On réduit le
  nombre de colonnes, jamais la taille des cartes.
- La page d'un titre occupe toute la largeur ; seul le texte (synopsis,
  commentaires) garde une colonne de lecture à 1120 px.

## Ce qu'on attend en retour

1. Une échelle typographique et une échelle d'espacement, en jetons CSS, avec la
   correspondance vers les valeurs actuelles.
2. Une règle unique pour les états (survol, focus, désactivé).
3. Les incohérences repérées dans l'inventaire ci-dessus, classées par gêne
   réelle.

**Sous forme de CSS et de valeurs, pas de maquettes** : il n'y a pas d'outil de
maquette dans la boucle, tout est écrit directement dans la feuille de style.

## Ce qu'on ne demande pas

- Changer l'accent, la police, ou la structure des pages.
- Un système de composants, un build, ou une bibliothèque.
- Copier un autre site à l'identique — cette partie-là est déjà traitée.
