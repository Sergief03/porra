import { kv } from '@vercel/kv';
import { JUGADORES_INICIALES } from '../../lib/datos';
import { getUserFromReq } from '../../lib/auth';

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

    // Todas las acciones de escritura requieren sesión válida
    const user = getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ error: 'Sesión no válida o caducada. Inicia sesión de nuevo.' });
    }

    const esAdmin = user.isAdmin === true;
    const soloAdmin = ['addJugador', 'removeJugador', 'saveResultado', 'deleteResultado'];
    if (soloAdmin.includes(action) && !esAdmin) {
      return res.status(403).json({ error: 'Solo el admin puede hacer esto' });
    }

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
        // Limpiar también su contraseña y sus pronósticos
        const [passwords, pronosticos] = await Promise.all([
          kv.get('passwords'),
          kv.get('pronosticos'),
        ]);
        if (passwords && passwords[payload.nombre]) {
          delete passwords[payload.nombre];
          await kv.set('passwords', passwords);
        }
        if (pronosticos) {
          const prefix = `${payload.nombre}_`;
          let cambiado = false;
          Object.keys(pronosticos).forEach(k => {
            if (k.startsWith(prefix)) {
              delete pronosticos[k];
              cambiado = true;
            }
          });
          if (cambiado) await kv.set('pronosticos', pronosticos);
        }
        await kv.set('jugadores', jugadores);
        return res.json({ ok: true, jugadores });
      }

      if (action === 'savePronostico') {
        // Cada participante solo puede modificar SU columna (el admin, todas)
        if (!esAdmin && user.nombre !== payload.jugador) {
          return res.status(403).json({ error: 'Solo puedes modificar tus propios pronósticos' });
        }
        const pronosticos = (await kv.get('pronosticos')) || {};
        const key = `${payload.jugador}_${payload.partidoId}`;
        pronosticos[key] = { golesLocal: payload.golesLocal, golesVisitante: payload.golesVisitante };
        await kv.set('pronosticos', pronosticos);
        return res.json({ ok: true });
      }

      if (action === 'deletePronostico') {
        if (!esAdmin && user.nombre !== payload.jugador) {
          return res.status(403).json({ error: 'Solo puedes borrar tus propios pronósticos' });
        }
        const pronosticos = (await kv.get('pronosticos')) || {};
        delete pronosticos[`${payload.jugador}_${payload.partidoId}`];
        await kv.set('pronosticos', pronosticos);
        return res.json({ ok: true });
      }

      if (action === 'saveResultado') {
        const resultados = (await kv.get('resultados')) || {};
        resultados[payload.partidoId] = { golesLocal: payload.golesLocal, golesVisitante: payload.golesVisitante };
        await kv.set('resultados', resultados);
        return res.json({ ok: true });
      }

      if (action === 'deleteResultado') {
        const resultados = (await kv.get('resultados')) || {};
        delete resultados[payload.partidoId];
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
