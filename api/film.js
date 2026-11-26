// Fiche d'un film de la sélection, lue dans le Strapi de Culture Relax :
// résumé, durée, genre, réalisateur et bande-annonce (vidéo AlloCiné, adresse renouvelée à chaque appel).
const STRAPI = process.env.STRAPI_URL || 'https://strapi.culture-relax.org';

module.exports = async (req, res) => {
  const slug = String((req.query && req.query.slug) || '').replace(/[^a-z0-9-]/gi, '');
  if (!slug) { res.status(400).json({ erreur: 'slug manquant' }); return; }
  try {
    const r = await fetch(`${STRAPI}/api/movies?filters[slug][$eq]=${slug}`);
    const j = await r.json();
    const a = j && j.data && j.data[0] && j.data[0].attributes;
    if (!a) throw new Error('Film introuvable');
    const duree = (a.duration || '').match(/^(\d+):(\d+)/);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      titre: a.title, resume: a.description || '', realisateur: a.director || '', acteurs: a.actor || '',
      genres: a.genres || '', sortie: a.release || '',
      duree: duree ? `${+duree[1]} h ${duree[2]}` : '',
      affiche: a.featured_image_url || '', bandeAnnonce: a.trailer || '',
      fiche: `https://culture-relax.org/movie/${slug}`,
    });
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(502).json({ erreur: String(e.message || e) });
  }
};
