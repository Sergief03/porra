import { kv } from '@vercel/kv';
import { getUserFromReq } from '../../lib/auth';
import { PARTIDOS, FASES, EQUIPOS_EN_ES, getEquipos } from '../../lib/datos';

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // máx. 1 petición a la API cada 10 min

const FLAGS = Object.fromEntries(getEquipos().map(e => [e.nombre, e.flag]));

// Para mantener los pronósticos ya hechos: si un partido de grupos de la API
// coincide en equipos con uno de los 24 originales, reutilizamos su id numérico
const ID_POR_PAREJA = {};
PARTIDOS.forEach(p => {
  ID_POR_PAREJA[[p.local, p.visitante].sort().join('|')] = p.id;
});

function traducir(nombreEn) {
  if (!nombreEn) return null;
  return EQUIPOS_EN_ES[nombreEn] || nombreEn;
}

// Marcador de los 90' + prórroga (sin goles de la tanda de penaltis).
// En la API v4, fullTime incluye los goles del shootout, así que en ese
// caso usamos regularTime + extraTime.
function extraerMarcador(score) {
  const ft = score?.fullTime;
  if (ft?.home === null || ft?.home === undefined) return null;
  if (score.duration === 'PENALTY_SHOOTOUT' && score.regularTime) {
    return {
      golesLocal: (score.regularTime.home ?? 0) + (score.extraTime?.home ?? 0),
      golesVisitante: (score.regularTime.away ?? 0) + (score.extraTime?.away ?? 0),
      penalesLocal: score.penalties?.home ?? null,
      penalesVisitante: score.penalties?.away ?? null,
    };
  }
  return { golesLocal: ft.home, golesVisitante: ft.away, penalesLocal: null, penalesVisitante: null };
}

function mapearPartido(m) {
  const local = traducir(m.homeTeam?.name);
  const visitante = traducir(m.awayTeam?.name);
  const marcador = extraerMarcador(m.score);
  let ganador = null;
  if (m.score?.winner === 'HOME_TEAM') ganador = 'local';
  else if (m.score?.winner === 'AWAY_TEAM') ganador = 'visitante';
  return {
    local,
    visitante,
    flagLocal: (local && FLAGS[local]) || '🏳️',
    flagVisitante: (visitante && FLAGS[visitante]) || '🏳️',
    definido: !!(local && visitante),
    utcDate: m.utcDate,
    estado: m.status,
    resultado: marcador ? { ...marcador, ganador } : null,
  };
}

async function leerGuardadas() {
  try {
    return (await kv.get('eliminatorias')) || { partidos: [], grupos: [], lastSync: 0 };
  } catch {
    return { partidos: [], grupos: [], lastSync: 0 };
  }
}

export default async function handler(req, res) {
  const guardadas = await leerGuardadas();
  const apiKey = process.env.FOOTBALL_API_KEY;

  if (!apiKey) {
    return res.json({ ...guardadas, aviso: 'Configura FOOTBALL_API_KEY para sincronizar los partidos' });
  }

  // Solo el admin puede forzar una sincronización fuera del intervalo
  const force = req.query.force === '1' && getUserFromReq(req)?.isAdmin === true;
  if (!force && Date.now() - (guardadas.lastSync || 0) < SYNC_INTERVAL_MS) {
    return res.json(guardadas);
  }

  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches',
      { headers: { 'X-Auth-Token': apiKey } }
    );

    if (!response.ok) {
      return res.json({ ...guardadas, apiStatus: response.status });
    }

    const data = await response.json();
    const matches = data.matches || [];

    // Fase de grupos completa (72 partidos)
    const grupos = matches
      .filter(m => m.stage === 'GROUP_STAGE')
      .map(m => {
        const base = mapearPartido(m);
        const pareja = [base.local, base.visitante].sort().join('|');
        return {
          ...base,
          // id original si el partido ya existía en la porra, si no uno nuevo
          id: ID_POR_PAREJA[pareja] ?? `g${m.id}`,
          grupo: (m.group || '').replace('GROUP_', '') || '?',
        };
      })
      .filter(p => p.definido)
      .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

    // Eliminatorias (dieciseisavos → final)
    const partidos = matches
      .filter(m => FASES[m.stage])
      .map(m => ({
        ...mapearPartido(m),
        id: `e${m.id}`,
        fase: m.stage,
      }))
      .sort((a, b) => (FASES[a.fase].orden - FASES[b.fase].orden) || a.utcDate.localeCompare(b.utcDate));

    const resultado = { partidos, grupos, lastSync: Date.now() };
    try {
      await kv.set('eliminatorias', resultado);
    } catch (e) {
      console.error('No se pudo guardar en KV:', e.message);
    }
    return res.json(resultado);
  } catch (e) {
    console.error(e);
    return res.json({ ...guardadas, error: e.message });
  }
}
