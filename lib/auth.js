// Utilidades de autenticación (solo servidor)
import crypto from 'node:crypto';

const SECRET =
  process.env.AUTH_SECRET ||
  process.env.ADMIN_PASS ||
  process.env.NEXT_PUBLIC_ADMIN_PASS ||
  'porra-mundial-secret-dev';

const TOKEN_TTL_MS = 120 * 24 * 60 * 60 * 1000; // 120 días

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const calc = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'));
  } catch {
    return false;
  }
}

export function createToken({ nombre, isAdmin }) {
  const payload = Buffer.from(
    JSON.stringify({ nombre, isAdmin: !!isAdmin, exp: Date.now() + TOKEN_TTL_MS })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return { nombre: data.nombre, isAdmin: !!data.isAdmin };
  } catch {
    return null;
  }
}

export function getUserFromReq(req) {
  const auth = req.headers.authorization || '';
  return verifyToken(auth.replace(/^Bearer\s+/i, ''));
}

// Normaliza nombres para comparar: minúsculas, sin tildes, sin espacios extra
export function normalizar(s) {
  return (s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
