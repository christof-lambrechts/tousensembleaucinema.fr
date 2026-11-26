// Programmation « Tous Ensemble au Cinéma » lue dans l'article Culture Relax (Strapi),
// cinémas placés sur la carte grâce à la base officielle des communes (geo.api.gouv.fr).
// Mise en cache 10 minutes par Vercel : une modification de l'article apparaît sur la page dans ce délai.
const LIENS = require('../data/liens.json');

const SLUG = 'tous-ensemble-au-cinema-revient-les-9-et-10-janvier-2027-pour-sa-deuxieme-edition';
const STRAPI = process.env.STRAPI_URL || 'https://strapi.culture-relax.org';
const REGIONS = {
  'auvergne rhone alpes': ['Auvergne-Rhône-Alpes', '84'], 'bourgogne franche comte': ['Bourgogne-Franche-Comté', '27'],
  'bretagne': ['Bretagne', '53'], 'centre val de loire': ['Centre-Val de Loire', '24'], 'corse': ['Corse', '94'],
  'grand est': ['Grand Est', '44'], 'hauts de france': ['Hauts-de-France', '32'], 'ile de france': ['Île-de-France', '11'],
  'normandie': ['Normandie', '28'], 'nouvelle aquitaine': ['Nouvelle-Aquitaine', '75'], 'occitanie': ['Occitanie', '76'],
  'pays de la loire': ['Pays de la Loire', '52'], "provence alpes cote d'azur": ["Provence-Alpes-Côte d'Azur", '93'],
};
const geoCache = new Map(); // garde les villes déjà placées tant que la fonction reste active

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-’]/g, m => (m === '-' ? ' ' : "'")).replace(/\s+/g, ' ').trim();
const decode = s => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&rsquo;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
// Noms écrits en capitales : remis en casse normale (« GRAND ECRAN VICHY » → « Grand Ecran Vichy »)
const pretty = s => (/[a-zà-ÿ]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()));

async function geocode(ville, codeRegion) {
  const key = norm(ville) + '|' + codeRegion;
  if (geoCache.has(key)) return geoCache.get(key);
  const ask = async withRegion => {
    const nomCommune = ville.replace(/-/g, ' ').replace(/\bste\b\.?/i, 'Sainte').replace(/\bst\b\.?/i, 'Saint');
    const u = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(nomCommune)}&fields=nom,codesPostaux,centre&boost=population&limit=1${withRegion && codeRegion ? '&codeRegion=' + codeRegion : ''}`;
    const r = await fetch(u); const j = await r.json(); return j && j[0];
  };
  let c = null;
  try { c = (await ask(true)) || (await ask(false)); } catch (e) { c = null; }
  const out = c && c.centre ? { ville: c.nom, cp: (c.codesPostaux || [''])[0], lat: c.centre.coordinates[1], lng: c.centre.coordinates[0] } : null;
  geoCache.set(key, out);
  return out;
}

module.exports = async (req, res) => {
  try {
    const r = await fetch(`${STRAPI}/api/articles?filters[slug][$eq]=${SLUG}&fields[0]=editor&fields[1]=updatedAt`);
    const j = await r.json();
    const art = j && j.data && j.data[0] && j.data[0].attributes;
    if (!art || !art.editor) throw new Error('Article introuvable');
    const rows = [...art.editor.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => decode(c[1])))
      .filter(c => c.length >= 6 && /janvier/i.test(c[3]));

    const cinemas = [];
    for (const [region, nomBrut, villeBrute, date, heure, film] of rows) {
      const [regionNom, codeRegion] = REGIONS[norm(region).replace(/'/g, "'")] || [region, ''];
      let ville = villeBrute;
      const mobile = nomBrut.match(/^Cin[ée]mobile\s*-\s*(.+)$/i); // le Cinémobile s'arrête dans la commune citée dans son nom
      if (mobile) ville = mobile[1];
      if (/quend/i.test(villeBrute)) ville = 'Quend';
      const nom = pretty(nomBrut);
      const s = { jour: /dimanche/i.test(date) ? 'dim' : 'sam', heure: (heure.match(/\d{1,2}[:h]\d{2}/) || [heure])[0].replace('h', ':').padStart(5, '0'), film: pretty(film) };
      // Même cinéma écrit deux fois de façon proche (« Megarama Chalon » / « Mégarama ») : regroupé
      let c = cinemas.find(x => norm(x.villeSource) === norm(ville) && (norm(x.nom).includes(norm(nom)) || norm(nom).includes(norm(x.nom))));
      if (!c) { c = { nom, villeSource: ville, region: regionNom, codeRegion, seances: [] }; cinemas.push(c); }
      else if (nom.length > c.nom.length) c.nom = nom;
      if (!c.seances.some(x => x.jour === s.jour && x.heure === s.heure && x.film === s.film)) c.seances.push(s);
    }

    // Toutes les villes en une seule requête (géocodage groupé de la Base adresse nationale)
    const villes = [...new Set(cinemas.map(c => c.villeSource))].filter(v => !geoCache.has(norm(v)));
    if (villes.length) {
      try {
        const csv = 'ville\n' + villes.map(v => '"' + v.replace(/"/g, '') + '"').join('\n');
        const fd = new FormData();
        fd.append('data', new Blob([csv], { type: 'text/csv' }), 'villes.csv');
        fd.append('columns', 'ville');
        fd.append('result_type', 'municipality');
        const out = await (await fetch('https://api-adresse.data.gouv.fr/search/csv/', { method: 'POST', body: fd })).text();
        const lignes = out.trim().split(/\r?\n/);
        const tete = lignes.shift().split(',');
        const col = k => tete.indexOf(k);
        for (const l of lignes) {
          const cells = []; let cur = '', q = false;
          for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch; }
          cells.push(cur);
          const score = parseFloat(cells[col('result_score')]);
          if (score >= 0.5 && cells[col('latitude')]) geoCache.set(norm(cells[0]), { ville: cells[col('result_city')] || cells[0], cp: cells[col('result_postcode')] || '', lat: +cells[col('latitude')], lng: +cells[col('longitude')], ctx: cells[col('result_context')] || '' });
        }
      } catch (e) { /* repli ville par ville ci-dessous */ }
    }

    await Promise.all(cinemas.map(async (c, i) => {
      // Homonymes (deux communes du même nom) : on garde le résultat groupé seulement s'il est dans la bonne région
      // et seulement si la commune trouvée porte bien le nom demandé (« Le Pontet » ne doit pas donner « Lambesc »)
      const brut = geoCache.get(norm(c.villeSource));
      const nomOk = x => { const a = norm(x.ville).replace(/\bst\b/g, 'saint'), b = norm(c.villeSource).replace(/\bst\b/g, 'saint'); return a === b || a.startsWith(b + ' ') || b.startsWith(a + ' '); };
      let g = brut && norm(brut.ctx).includes(norm(c.region)) && nomOk(brut) ? brut : null;
      if (!g) g = await geocode(c.villeSource, c.codeRegion);
      if (!g && brut && nomOk(brut)) g = brut;
      if (g) { g = { ...g }; delete g.ctx; }
      c.id = 'c' + i;
      Object.assign(c, g || { ville: pretty(c.villeSource), cp: '', lat: null, lng: null });
      // Fiche complémentaire du cinéma (data/liens.json) : un lien, ou { url, lat, lng } pour le placer précisément
      let fiche = LIENS[norm(c.nom) + '|' + norm(c.ville)] || LIENS[norm(c.nom) + '|' + norm(c.villeSource)] || null;
      if (typeof fiche === 'string') fiche = { url: fiche };
      c.url = (fiche && fiche.url) || null;
      if (fiche && fiche.lat != null) { c.lat = fiche.lat; c.lng = fiche.lng; }
      const ordre = s => (s.jour === 'sam' ? '0' : '1') + s.heure;
      c.seances.sort((a, b) => ordre(a).localeCompare(ordre(b)));
      delete c.villeSource; delete c.codeRegion;
    }));

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
    res.status(200).json({ source: `https://culture-relax.org/post/${SLUG}`, majArticle: art.updatedAt, cinemas });
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(502).json({ erreur: String(e.message || e) });
  }
};
