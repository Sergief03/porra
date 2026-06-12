// Mapa de nombres en inglés (API) → ID de partido en nuestro sistema
const NOMBRE_A_ID = {
  // Grupo A
  "Mexico": 1, "South Africa": 1,
  "South Korea": 2, "Czechia": 2, "Czech Republic": 2,
  // Grupo B
  "Canada": 3, "Bosnia and Herzegovina": 3, "Bosnia & Herzegovina": 3,
  "Qatar": 5, "Switzerland": 5,
  // Grupo C
  "Brazil": 6, "Morocco": 6,
  "Haiti": 7, "Scotland": 7,
  // Grupo D
  "United States": 4, "USA": 4, "Paraguay": 4,
  "Australia": 8, "Turkey": 8, "Türkiye": 8,
  // Grupo E
  "Germany": 9, "Curaçao": 9, "Curacao": 9,
  "Ivory Coast": 11, "Côte d'Ivoire": 11, "Ecuador": 11,
  // Grupo F
  "Netherlands": 10, "Japan": 10,
  "Sweden": 12, "Tunisia": 12,
  // Grupo G
  "Belgium": 14, "Egypt": 14,
  "Iran": 16, "New Zealand": 16,
  // Grupo H
  "Spain": 13, "Cape Verde": 13,
  "Saudi Arabia": 15, "Uruguay": 15,
  // Grupo I
  "France": 17, "Senegal": 17,
  "Iraq": 18, "Norway": 18,
  // Grupo J
  "Argentina": 19, "Algeria": 19,
  "Austria": 20, "Jordan": 20,
  // Grupo K
  "Portugal": 21, "DR Congo": 21, "Congo DR": 21,
  "Uzbekistan": 24, "Colombia": 24,
  // Grupo L
  "England": 22, "Croatia": 22,
  "Ghana": 23, "Panama": 23, "Panamá": 23,
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return res.json({ partidos: [], error: 'Configura FOOTBALL_API_KEY en Vercel' });
  }

  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?stage=GROUP_STAGE',
      { headers: { 'X-Auth-Token': apiKey } }
    );

    if (!response.ok) {
      return res.json({ partidos: [], apiStatus: response.status });
    }

    const data = await response.json();
    const partidos = [];

    for (const m of (data.matches || [])) {
      const localNombre = m.homeTeam?.name;
      const visitanteNombre = m.awayTeam?.name;
      const golesLocal = m.score?.fullTime?.home;
      const golesVisitante = m.score?.fullTime?.away;
      const estado = m.status;

      // Buscar el partido por nombre de equipo local O visitante
      const partidoId = NOMBRE_A_ID[localNombre] || NOMBRE_A_ID[visitanteNombre];

      if (partidoId && (golesLocal !== null && golesLocal !== undefined)) {
        partidos.push({
          id_externo: m.id,
          partido_id: partidoId,
          local: localNombre,
          visitante: visitanteNombre,
          golesLocal,
          golesVisitante,
          estado,
          fecha: m.utcDate,
        });
      }
    }

    return res.json({ partidos });
  } catch (e) {
    console.error(e);
    return res.json({ partidos: [], error: e.message });
  }
}
