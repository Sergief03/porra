// API gratuita: football-data.org (necesita API key gratuita)
// Registro en: https://www.football-data.org/client/register
// La clave gratuita permite 10 req/min, suficiente para esto

export default async function handler(req, res) {
  // Cache de 60 segundos para no superar límites
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const apiKey = process.env.FOOTBALL_API_KEY;

  if (!apiKey) {
    return res.json({ partidos: [], error: 'Configura FOOTBALL_API_KEY en Vercel' });
  }

  try {
    // Copa del Mundo FIFA 2026 - intentamos obtener los partidos
    // football-data.org: competición WC = FIFA World Cup
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?stage=GROUP_STAGE&status=FINISHED,LIVE,IN_PLAY,PAUSED',
      {
        headers: {
          'X-Auth-Token': apiKey,
        },
      }
    );

    if (!response.ok) {
      // Si no está disponible aún el mundial 2026, intentamos datos mock
      return res.json({ partidos: [], apiStatus: response.status });
    }

    const data = await response.json();
    const partidos = (data.matches || []).map(m => ({
      id_externo: m.id,
      local: m.homeTeam?.name,
      visitante: m.awayTeam?.name,
      golesLocal: m.score?.fullTime?.home,
      golesVisitante: m.score?.fullTime?.away,
      estado: m.status, // FINISHED, LIVE, IN_PLAY, SCHEDULED
      fecha: m.utcDate,
    }));

    return res.json({ partidos });
  } catch (e) {
    console.error(e);
    return res.json({ partidos: [], error: e.message });
  }
}
