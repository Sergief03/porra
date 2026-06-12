import { kv } from '@vercel/kv';
import { JUGADORES_INICIALES, PARTIDOS } from '../../lib/datos';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const [jugadores, pronosticos, resultados] = await Promise.all([
        kv.get('jugadores'),
        kv.get('pronosticos'),
        kv.get('resultados'),
      ]);

      return res.json({
        jugadores: jugadores || JUGADORES_INICIALES,
        pronosticos: pronosticos || {},
        resultados: resultados || {},
      });
    } catch (e) {
      // KV not configured - return defaults
      return res.json({
        jugadores: JUGADORES_INICIALES,
        pronosticos: {},
        resultados: {},
      });
    }
  }

  if (req.method === 'POST') {
    const { action, payload } = req.body;

    try {
      if (action === 'addJugador') {
        const jugadores = (await kv.get('jugadores')) || JUGADORES_INICIALES;
        const nombre = payload.nombre.trim();
        if (!nombre || jugadores.includes(nombre)) {
          return res.status(400).json({ error: 'Jugador inválido o ya existe' });
        }
        jugadores.push(nombre);
        await kv.set('jugadores', jugadores);
        return res.json({ ok: true, jugadores });
      }

      if (action === 'removeJugador') {
        let jugadores = (await kv.get('jugadores')) || JUGADORES_INICIALES;
        jugadores = jugadores.filter(j => j !== payload.nombre);
        await kv.set('jugadores', jugadores);
        return res.json({ ok: true, jugadores });
      }

      if (action === 'savePronostico') {
        const pronosticos = (await kv.get('pronosticos')) || {};
        const key = `${payload.jugador}_${payload.partidoId}`;
        pronosticos[key] = { golesLocal: payload.golesLocal, golesVisitante: payload.golesVisitante };
        await kv.set('pronosticos', pronosticos);
        return res.json({ ok: true });
      }

      if (action === 'saveResultado') {
        const resultados = (await kv.get('resultados')) || {};
        resultados[payload.partidoId] = { golesLocal: payload.golesLocal, golesVisitante: payload.golesVisitante };
        await kv.set('resultados', resultados);
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: 'Acción desconocida' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Error de base de datos. Configura Vercel KV.' });
    }
  }

  res.status(405).end();
}
