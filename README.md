# Tous Ensemble au Cinéma avec Culture Relax, 2e édition

Landing page de l'opération (9 et 10 janvier 2027), destinée au domaine tousensembleaucinema.fr.

- Site statique : `index.html` + dossier `assets/`. Aucun build, déployable tel quel sur Vercel.
- Accessibilité : panneau « Affichage et FALC » (lecture FALC, couleurs Standard / Sombre / Contraste renforcé, taille du texte, réduction des animations), réglages mémorisés, audit axe sans erreur dans les trois modes.
- **Programmation en direct** : `api/seances.js` lit le tableau de l'article Culture Relax (Strapi) et place chaque ville sur la carte (geo.api.gouv.fr). Il suffit de modifier l'article ; la page suit en 10 minutes environ.
- **Liens de réservation** : `data/liens.json`, un lien par cinéma. Sans lien, le bouton propose de chercher le site du cinéma.
- Une page par film (/film/le-corset…) : bande-annonce et résumé lus dans Strapi par `api/film.js`, liste des cinémas qui le projettent.
- La liste des 5 films est dans le bloc `<script id="data">` de `index.html`.
- Illustration © Marie Charlemagne.
- Les logos partenaires sont dans `assets/partenaires/`, dans l'ordre fourni par Culture Relax. Logos encore manquants (affichés en texte) : Ciné Relax, Cinewest, Grand Écran, Premium Events, Satellifacts.
