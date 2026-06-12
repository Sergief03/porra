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
