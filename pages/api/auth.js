import { kv } from '@vercel/kv';
import { JUGADORES_INICIALES } from '../../lib/datos';
import { hashPassword, verifyPassword, createToken, getUserFromReq, normalizar } from '../../lib/auth';

const ADMIN_PASS =
  process.env.ADMIN_PASS || process.env.NEXT_PUBLIC_ADMIN_PASS || 'mundial2026';

async function getJugadores() {
  try {
    return (await kv.get('jugadores')) || JUGADORES_INICIALES;
  } catch {
    return JUGADORES_INICIALES;
  }
}

async function getPasswords() {
  try {
    return (await kv.get('passwords')) || {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { action, payload = {} } = req.body || {};

  try {
    // Paso 1 del login: comprobar si el nombre existe y si ya tiene contraseña
    if (action === 'check') {
      const jugadores = await getJugadores();
      const canonical = jugadores.find(j => normalizar(j) === normalizar(payload.nombre));
      if (!canonical) {
        return res.json({ exists: false });
      }
      const passwords = await getPasswords();
      return res.json({ exists: true, nombre: canonical, hasPassword: !!passwords[canonical] });
    }

    // Primera vez: crear contraseña vinculada al participante
    if (action === 'register') {
      const jugadores = await getJugadores();
      const canonical = jugadores.find(j => normalizar(j) === normalizar(payload.nombre));
      if (!canonical) {
        return res.status(400).json({ error: 'Ese nombre no coincide con ningún participante' });
      }
      const password = (payload.password || '').trim();
      if (password.length < 4) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
      }
      const passwords = await getPasswords();
      if (passwords[canonical]) {
        return res.status(400).json({ error: 'Este participante ya tiene contraseña. Inicia sesión.' });
      }
      passwords[canonical] = hashPassword(password);
      await kv.set('passwords', passwords);
      const token = createToken({ nombre: canonical, isAdmin: false });
      return res.json({ token, nombre: canonical, isAdmin: false });
    }

    // Login normal de participante
    if (action === 'login') {
      const jugadores = await getJugadores();
      const canonical = jugadores.find(j => normalizar(j) === normalizar(payload.nombre));
      const passwords = await getPasswords();
      if (!canonical || !verifyPassword(payload.password || '', passwords[canonical])) {
        return res.status(401).json({ error: 'Nombre o contraseña incorrectos' });
      }
      const token = createToken({ nombre: canonical, isAdmin: false });
      return res.json({ token, nombre: canonical, isAdmin: false });
    }

    // Login de administrador
    if (action === 'loginAdmin') {
      if ((payload.password || '') !== ADMIN_PASS) {
        return res.status(401).json({ error: 'Contraseña de admin incorrecta' });
      }
      const token = createToken({ nombre: 'admin', isAdmin: true });
      return res.json({ token, nombre: 'admin', isAdmin: true });
    }

    // Admin puede resetear la contraseña de un participante
    if (action === 'resetPassword') {
      const user = getUserFromReq(req);
      if (!user?.isAdmin) return res.status(403).json({ error: 'Solo el admin puede hacer esto' });
      const passwords = (await kv.get('passwords')) || {};
      delete passwords[payload.nombre];
      await kv.set('passwords', passwords);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Acción desconocida' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error de base de datos. Configura Vercel KV.' });
  }
}
