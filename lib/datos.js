// Datos de partidos extraídos del Excel de la porra
export const PARTIDOS = [
  { id: 1, fecha: "2026-06-11", hora: "21:00", grupo: "A", local: "México", visitante: "Sudáfrica", flagLocal: "🇲🇽", flagVisitante: "🇿🇦" },
  { id: 2, fecha: "2026-06-12", hora: "04:00", grupo: "A", local: "Corea del Sur", visitante: "República Checa", flagLocal: "🇰🇷", flagVisitante: "🇨🇿" },
  { id: 3, fecha: "2026-06-12", hora: "21:00", grupo: "B", local: "Canadá", visitante: "Bosnia y Herzegovina", flagLocal: "🇨🇦", flagVisitante: "🇧🇦" },
  { id: 4, fecha: "2026-06-13", hora: "03:00", grupo: "D", local: "Estados Unidos", visitante: "Paraguay", flagLocal: "🇺🇸", flagVisitante: "🇵🇾" },
  { id: 5, fecha: "2026-06-13", hora: "21:00", grupo: "B", local: "Catar", visitante: "Suiza", flagLocal: "🇶🇦", flagVisitante: "🇨🇭" },
  { id: 6, fecha: "2026-06-14", hora: "00:00", grupo: "C", local: "Brasil", visitante: "Marruecos", flagLocal: "🇧🇷", flagVisitante: "🇲🇦" },
  { id: 7, fecha: "2026-06-14", hora: "03:00", grupo: "C", local: "Haití", visitante: "Escocia", flagLocal: "🇭🇹", flagVisitante: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { id: 8, fecha: "2026-06-14", hora: "06:00", grupo: "D", local: "Australia", visitante: "Turquía", flagLocal: "🇦🇺", flagVisitante: "🇹🇷" },
  { id: 9, fecha: "2026-06-14", hora: "19:00", grupo: "E", local: "Alemania", visitante: "Curazao", flagLocal: "🇩🇪", flagVisitante: "🇨🇼" },
  { id: 10, fecha: "2026-06-14", hora: "22:00", grupo: "F", local: "Países Bajos", visitante: "Japón", flagLocal: "🇳🇱", flagVisitante: "🇯🇵" },
  { id: 11, fecha: "2026-06-15", hora: "01:00", grupo: "E", local: "Costa de Marfil", visitante: "Ecuador", flagLocal: "🇨🇮", flagVisitante: "🇪🇨" },
  { id: 12, fecha: "2026-06-15", hora: "04:00", grupo: "F", local: "Suecia", visitante: "Túnez", flagLocal: "🇸🇪", flagVisitante: "🇹🇳" },
  { id: 13, fecha: "2026-06-15", hora: "18:00", grupo: "H", local: "España", visitante: "Cabo Verde", flagLocal: "🇪🇸", flagVisitante: "🇨🇻" },
  { id: 14, fecha: "2026-06-15", hora: "21:00", grupo: "G", local: "Bélgica", visitante: "Egipto", flagLocal: "🇧🇪", flagVisitante: "🇪🇬" },
  { id: 15, fecha: "2026-06-16", hora: "00:00", grupo: "H", local: "Arabia Saudí", visitante: "Uruguay", flagLocal: "🇸🇦", flagVisitante: "🇺🇾" },
  { id: 16, fecha: "2026-06-16", hora: "03:00", grupo: "G", local: "Irán", visitante: "Nueva Zelanda", flagLocal: "🇮🇷", flagVisitante: "🇳🇿" },
  { id: 17, fecha: "2026-06-16", hora: "21:00", grupo: "I", local: "Francia", visitante: "Senegal", flagLocal: "🇫🇷", flagVisitante: "🇸🇳" },
  { id: 18, fecha: "2026-06-17", hora: "00:00", grupo: "I", local: "Irak", visitante: "Noruega", flagLocal: "🇮🇶", flagVisitante: "🇳🇴" },
  { id: 19, fecha: "2026-06-17", hora: "03:00", grupo: "J", local: "Argentina", visitante: "Argelia", flagLocal: "🇦🇷", flagVisitante: "🇩🇿" },
  { id: 20, fecha: "2026-06-17", hora: "06:00", grupo: "J", local: "Austria", visitante: "Jordania", flagLocal: "🇦🇹", flagVisitante: "🇯🇴" },
  { id: 21, fecha: "2026-06-17", hora: "19:00", grupo: "K", local: "Portugal", visitante: "RD Congo", flagLocal: "🇵🇹", flagVisitante: "🇨🇩" },
  { id: 22, fecha: "2026-06-17", hora: "22:00", grupo: "L", local: "Inglaterra", visitante: "Croacia", flagLocal: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", flagVisitante: "🇭🇷" },
  { id: 23, fecha: "2026-06-18", hora: "01:00", grupo: "L", local: "Ghana", visitante: "Panamá", flagLocal: "🇬🇭", flagVisitante: "🇵🇦" },
  { id: 24, fecha: "2026-06-18", hora: "04:00", grupo: "K", local: "Uzbekistán", visitante: "Colombia", flagLocal: "🇺🇿", flagVisitante: "🇨🇴" },
];

export const JUGADORES_INICIALES = [
  "vaquero", "jaime", "antonio", "javier", "josé",
  "pablo", "juan carlos", "Raúl", "alonso", "Don Alberto", "juan"
];

// ============================================================
// ELIMINATORIAS (Mundial 2026: 12 grupos de 4)
// Pasan a dieciseisavos: los 2 primeros de cada grupo (24) +
// los 8 mejores terceros = 32 equipos. Después: octavos,
// cuartos, semifinales, 3er puesto y final.
// Los cruces se sincronizan automáticamente desde football-data.org
// cuando la FIFA los confirme (no los calculamos nosotros porque
// la porra solo registra una parte de los partidos de grupos).
// ============================================================
export const FASES = {
  LAST_32: { orden: 1, nombre: 'Dieciseisavos', corto: '16º' },
  LAST_16: { orden: 2, nombre: 'Octavos', corto: '8º' },
  QUARTER_FINALS: { orden: 3, nombre: 'Cuartos', corto: '4º' },
  SEMI_FINALS: { orden: 4, nombre: 'Semifinales', corto: 'SF' },
  THIRD_PLACE: { orden: 5, nombre: '3er puesto', corto: '3º' },
  FINAL: { orden: 6, nombre: 'Final', corto: '🏆' },
};

// Traducción de los nombres que devuelve la API (inglés) a los nuestros
export const EQUIPOS_EN_ES = {
  "Mexico": "México", "South Africa": "Sudáfrica",
  "South Korea": "Corea del Sur", "Korea Republic": "Corea del Sur",
  "Czechia": "República Checa", "Czech Republic": "República Checa",
  "Canada": "Canadá", "Bosnia and Herzegovina": "Bosnia y Herzegovina", "Bosnia & Herzegovina": "Bosnia y Herzegovina",
  "Qatar": "Catar", "Switzerland": "Suiza",
  "Brazil": "Brasil", "Morocco": "Marruecos",
  "Haiti": "Haití", "Scotland": "Escocia",
  "United States": "Estados Unidos", "USA": "Estados Unidos",
  "Paraguay": "Paraguay", "Australia": "Australia",
  "Turkey": "Turquía", "Türkiye": "Turquía",
  "Germany": "Alemania", "Curaçao": "Curazao", "Curacao": "Curazao",
  "Netherlands": "Países Bajos", "Japan": "Japón",
  "Ivory Coast": "Costa de Marfil", "Côte d'Ivoire": "Costa de Marfil",
  "Ecuador": "Ecuador", "Sweden": "Suecia", "Tunisia": "Túnez",
  "Spain": "España", "Cape Verde": "Cabo Verde",
  "Belgium": "Bélgica", "Egypt": "Egipto",
  "Saudi Arabia": "Arabia Saudí", "Uruguay": "Uruguay",
  "Iran": "Irán", "IR Iran": "Irán", "New Zealand": "Nueva Zelanda",
  "France": "Francia", "Senegal": "Senegal",
  "Iraq": "Irak", "Norway": "Noruega",
  "Argentina": "Argentina", "Algeria": "Argelia",
  "Austria": "Austria", "Jordan": "Jordania",
  "Portugal": "Portugal", "DR Congo": "RD Congo", "Congo DR": "RD Congo",
  "England": "Inglaterra", "Croatia": "Croacia",
  "Ghana": "Ghana", "Panama": "Panamá", "Panamá": "Panamá",
  "Uzbekistan": "Uzbekistán", "Colombia": "Colombia",
};

// Quién gana un partido de eliminatoria.
// El marcador guardado es el de los 90' + prórroga; si hay empate,
// deciden los penaltis (penalesLocal/penalesVisitante de la API o
// ganadorPenales si el resultado lo puso el admin a mano).
export function ganadorResultado(res) {
  if (!res || res.golesLocal === null || res.golesLocal === undefined) return null;
  const gL = parseInt(res.golesLocal);
  const gV = parseInt(res.golesVisitante);
  if (gL > gV) return 'local';
  if (gV > gL) return 'visitante';
  if (res.penalesLocal !== undefined && res.penalesLocal !== null) {
    return parseInt(res.penalesLocal) > parseInt(res.penalesVisitante) ? 'local' : 'visitante';
  }
  if (res.ganadorPenales) return res.ganadorPenales;
  return 'empate';
}

// Puntuación en eliminatorias (regla de los 90 minutos):
// - No se permiten pronósticos de empate.
// - Acierto perfecto (3): marcador exacto de los 90' + prórroga.
//   Si el partido acaba en empate y va a penaltis, no puede haber
//   perfecto (nadie pudo pronosticar empate).
// - Tendencia (1): acertar el ganador del partido (penaltis incluidos).
export function calcularPuntosEliminatoria(pronostico, resultado) {
  if (!resultado || resultado.golesLocal === null || resultado.golesLocal === undefined) return null;
  if (!pronostico || pronostico.golesLocal === null || pronostico.golesLocal === undefined) return { puntos: 0, color: "rojo" };

  const pL = parseInt(pronostico.golesLocal);
  const pV = parseInt(pronostico.golesVisitante);
  const rL = parseInt(resultado.golesLocal);
  const rV = parseInt(resultado.golesVisitante);

  if (pL === rL && pV === rV && pL !== pV) return { puntos: 3, color: "verde" };

  const tendenciaP = pL > pV ? "local" : "visitante";
  if (tendenciaP === ganadorResultado(resultado)) return { puntos: 1, color: "amarillo" };

  return { puntos: 0, color: "rojo" };
}

// Lista de equipos únicos del mundial (derivada de los partidos), con su bandera
export function getEquipos() {
  const map = new Map();
  PARTIDOS.forEach(p => {
    if (!map.has(p.local)) map.set(p.local, p.flagLocal);
    if (!map.has(p.visitante)) map.set(p.visitante, p.flagVisitante);
  });
  return [...map.entries()]
    .map(([nombre, flag]) => ({ nombre, flag }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// Las 14 peores selecciones del mundial (sugerencia editable, ordenadas alfabéticamente).
// Los nombres deben coincidir exactamente con los de PARTIDOS.
export const PEORES_SELECCIONES = [
  "Arabia Saudí",
  "Bosnia y Herzegovina",
  "Cabo Verde",
  "Catar",
  "Curazao",
  "Ghana",
  "Haití",
  "Irak",
  "Jordania",
  "Nueva Zelanda",
  "Panamá",
  "RD Congo",
  "Sudáfrica",
  "Uzbekistán",
];

// Fecha límite para elegir tu Campeón del Mundo (empiezan las eliminatorias)
export const CAMPEON_DEADLINE = '2026-06-28T00:00:00Z';

// Inscripción y reparto de premios
export const INSCRIPCION = 5; // euros por persona
export const REPARTO_PREMIOS = [0.60, 0.25, 0.15]; // ganador, subcampeón, tercero

// Bonus "peores selecciones":
// +1 punto por cada gol a favor del equipo asignado
// +1 punto por cada 3 goles en contra (por partido)
// getResultado: función (partidoId) => { golesLocal, golesVisitante } | null
export function calcularBonus(equipo, getResultado, partidos = PARTIDOS) {
  let pts = 0, golesFavor = 0, golesContra = 0, jugados = 0;
  partidos.forEach(p => {
    if (p.local !== equipo && p.visitante !== equipo) return;
    const res = getResultado(p.id);
    if (!res || res.golesLocal === null || res.golesLocal === undefined) return;
    const favor = p.local === equipo ? parseInt(res.golesLocal) : parseInt(res.golesVisitante);
    const contra = p.local === equipo ? parseInt(res.golesVisitante) : parseInt(res.golesLocal);
    jugados++;
    golesFavor += favor;
    golesContra += contra;
    pts += favor + Math.floor(contra / 3);
  });
  return { pts, golesFavor, golesContra, jugados };
}

// Sistema de puntuación:
// Verde (3 pts): Acierto Perfecto - marcador exacto
// Amarillo (1 pt): Acierto de Tendencia - ganador correcto o empate correcto
// Rojo (0 pts): Error Total
export function calcularPuntos(pronostico, resultado) {
  if (!resultado || resultado.golesLocal === null || resultado.golesVisitante === null) return null;
  if (!pronostico || pronostico.golesLocal === null || pronostico.golesVisitante === null) return { puntos: 0, color: "rojo" };

  const pL = parseInt(pronostico.golesLocal);
  const pV = parseInt(pronostico.golesVisitante);
  const rL = parseInt(resultado.golesLocal);
  const rV = parseInt(resultado.golesVisitante);

  // Acierto perfecto
  if (pL === rL && pV === rV) return { puntos: 3, color: "verde" };

  // Acierto de tendencia
  const tendenciaP = pL > pV ? "local" : pL < pV ? "visitante" : "empate";
  const tendenciaR = rL > rV ? "local" : rL < rV ? "visitante" : "empate";
  if (tendenciaP === tendenciaR) return { puntos: 1, color: "amarillo" };

  return { puntos: 0, color: "rojo" };
}
