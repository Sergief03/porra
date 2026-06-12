import { useState, useEffect, useCallback, Fragment } from 'react';
import Head from 'next/head';
import { PARTIDOS, FASES, CAMPEON_DEADLINE, INSCRIPCION, REPARTO_PREMIOS, calcularPuntos, calcularPuntosEliminatoria, calcularBonus, ganadorResultado, getEquipos, PEORES_SELECCIONES } from '../lib/datos';

const COLOR_MAP = {
  verde: 'bg-green-500 text-white',
  amarillo: 'bg-yellow-400 text-gray-900',
  rojo: 'bg-red-500 text-white',
};

const EQUIPOS = getEquipos();
const FLAGS = Object.fromEntries(EQUIPOS.map(e => [e.nombre, e.flag]));
const OTRAS_SELECCIONES = EQUIPOS.filter(e => !PEORES_SELECCIONES.includes(e.nombre));

const SESSION_KEY = 'porra_session';

export default function Home() {
  const [jugadores, setJugadores] = useState([]);
  const [pronosticos, setPronosticos] = useState({});
  const [resultados, setResultados] = useState({});
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState('tabla'); // 'tabla' | 'partidos' | 'clasificacion'
  const [nuevoJugador, setNuevoJugador] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('TODOS');
  const [editandoResultado, setEditandoResultado] = useState(null);
  const [liveData, setLiveData] = useState({});
  const [saving, setSaving] = useState(false);
  const [pagos, setPagos] = useState({});
  const [bonusEquipos, setBonusEquipos] = useState({});
  const [eliminatorias, setEliminatorias] = useState([]);
  const [gruposApi, setGruposApi] = useState([]);
  const [campeones, setCampeones] = useState({});
  const [sincronizando, setSincronizando] = useState(false);
  const [showReglas, setShowReglas] = useState(false);
  const [user, setUser] = useState(null); // { token, nombre, isAdmin }
  const [showLogin, setShowLogin] = useState(false);

  const adminMode = user?.isAdmin === true;

  // Cargar sesión guardada y elegir vista inicial según dispositivo
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      } else {
        setShowLogin(true);
      }
    } catch {}
    if (window.innerWidth < 640) setVista('partidos');
  }, []);

  const login = (data) => {
    setUser(data);
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    setShowLogin(false);
    // La primera vez, mostrar el reglamento
    if (!localStorage.getItem('porra_reglas_vistas')) {
      setShowReglas(true);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const cargarDatos = useCallback(async () => {
    try {
      const r = await fetch('/api/porra');
      const data = await r.json();
      setJugadores(data.jugadores);
      setPronosticos(data.pronosticos);
      setResultados(data.resultados);
      setPagos(data.pagos || {});
      setBonusEquipos(data.bonusEquipos || {});
      setCampeones(data.campeones || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarLive = useCallback(async () => {
    try {
      const r = await fetch('/api/resultados-live');
      const data = await r.json();
      if (data.partidos?.length > 0) {
        const map = {};
        data.partidos.forEach(p => {
          if (p.partido_id && p.golesLocal !== null && p.golesLocal !== undefined) {
            map[p.partido_id] = {
              golesLocal: p.golesLocal,
              golesVisitante: p.golesVisitante,
              estado: p.estado,
            };
          }
        });
        setLiveData(map);
      }
    } catch (e) {}
  }, []);

  const cargarEliminatorias = useCallback(async (force = false, token = null) => {
    try {
      const r = await fetch(`/api/sync-eliminatorias${force ? '?force=1' : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await r.json();
      if (Array.isArray(data.partidos)) setEliminatorias(data.partidos);
      if (Array.isArray(data.grupos)) setGruposApi(data.grupos);
    } catch (e) {}
  }, []);

  const sincronizarAhora = async () => {
    setSincronizando(true);
    try {
      await cargarEliminatorias(true, user?.token);
    } finally {
      setSincronizando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    cargarLive();
    cargarEliminatorias();
    const interval = setInterval(() => {
      cargarLive();
      cargarEliminatorias(); // el servidor cachea: solo llama a la API si pasaron 10 min
    }, 60000);
    return () => clearInterval(interval);
  }, [cargarDatos, cargarLive, cargarEliminatorias]);

  const api = async (action, payload) => {
    setSaving(true);
    try {
      const r = await fetch('/api/porra', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify({ action, payload }),
      });
      const data = await r.json();
      if (r.status === 401) {
        logout();
        setShowLogin(true);
        throw new Error(data.error || 'Sesión caducada, inicia sesión de nuevo');
      }
      if (!r.ok) throw new Error(data.error);
      return data;
    } finally {
      setSaving(false);
    }
  };

  const addJugador = async () => {
    if (!nuevoJugador.trim()) return;
    try {
      const data = await api('addJugador', { nombre: nuevoJugador.trim() });
      setJugadores(data.jugadores);
      setNuevoJugador('');
    } catch (e) {
      alert(e.message);
    }
  };

  const removeJugador = async (nombre) => {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return;
    try {
      const data = await api('removeJugador', { nombre });
      setJugadores(data.jugadores);
    } catch (e) {
      alert(e.message);
    }
  };

  const guardarPronostico = async (jugador, partidoId, golesLocal, golesVisitante) => {
    const key = `${jugador}_${partidoId}`;
    const previo = pronosticos[key];
    setPronosticos(prev => ({ ...prev, [key]: { golesLocal, golesVisitante } }));
    try {
      await api('savePronostico', { jugador, partidoId, golesLocal, golesVisitante });
    } catch (e) {
      setPronosticos(prev => {
        const copia = { ...prev };
        if (previo) copia[key] = previo; else delete copia[key];
        return copia;
      });
      alert(e.message);
    }
  };

  const borrarPronostico = async (jugador, partidoId) => {
    const key = `${jugador}_${partidoId}`;
    const previo = pronosticos[key];
    setPronosticos(prev => {
      const copia = { ...prev };
      delete copia[key];
      return copia;
    });
    try {
      await api('deletePronostico', { jugador, partidoId });
    } catch (e) {
      if (previo) setPronosticos(prev => ({ ...prev, [key]: previo }));
      alert(e.message);
    }
  };

  const guardarResultado = async (partidoId, golesLocal, golesVisitante, ganadorPenales = null) => {
    const nuevo = { golesLocal, golesVisitante, ...(ganadorPenales ? { ganadorPenales } : {}) };
    setResultados(prev => ({ ...prev, [partidoId]: nuevo }));
    try {
      await api('saveResultado', { partidoId, golesLocal, golesVisitante, ganadorPenales });
    } catch (e) {
      alert(e.message);
      cargarDatos();
    }
    setEditandoResultado(null);
  };

  const togglePago = async (nombre) => {
    const nuevo = !pagos[nombre];
    setPagos(prev => ({ ...prev, [nombre]: nuevo }));
    try {
      await api('setPago', { nombre, pagado: nuevo });
    } catch (e) {
      setPagos(prev => ({ ...prev, [nombre]: !nuevo }));
      alert(e.message);
    }
  };

  const asignarBonusEquipo = async (jugador, equipo) => {
    const previo = bonusEquipos[jugador];
    setBonusEquipos(prev => {
      const copia = { ...prev };
      if (equipo) copia[jugador] = equipo; else delete copia[jugador];
      return copia;
    });
    try {
      await api('setBonusEquipo', { jugador, equipo: equipo || null });
    } catch (e) {
      setBonusEquipos(prev => {
        const copia = { ...prev };
        if (previo) copia[jugador] = previo; else delete copia[jugador];
        return copia;
      });
      alert(e.message);
    }
  };

  const borrarResultado = async (partidoId) => {
    setResultados(prev => {
      const copia = { ...prev };
      delete copia[partidoId];
      return copia;
    });
    try {
      await api('deleteResultado', { partidoId });
    } catch (e) {
      alert(e.message);
      cargarDatos();
    }
    setEditandoResultado(null);
  };

  // Fecha y hora legibles a partir de la fecha UTC de la API
  const conFechaLocal = (e) => {
    const d = new Date(e.utcDate);
    return {
      ...e,
      fecha: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      hora: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  // Fase de grupos: si la API ya sincronizó el calendario completo (72 partidos),
  // se usa ese; si no, los 24 partidos originales del Excel
  const partidosGrupos = gruposApi.length > 0 ? gruposApi.map(conFechaLocal) : PARTIDOS;

  // Partidos de eliminatoria con formato común al resto de la app
  const partidosEliminatorias = eliminatorias.map(e => ({
    ...conFechaLocal(e),
    esEliminatoria: true,
    grupo: FASES[e.fase]?.corto || '?',
    faseNombre: FASES[e.fase]?.nombre || e.fase,
    local: e.local || 'Por definir',
    visitante: e.visitante || 'Por definir',
  }));

  const todosPartidos = [...partidosGrupos, ...partidosEliminatorias];

  // Resultados que vienen de la API (grupos y eliminatorias sincronizados)
  const resultadosApi = {};
  [...gruposApi, ...eliminatorias].forEach(p => {
    if (p.resultado?.golesLocal !== undefined && p.resultado?.golesLocal !== null) {
      resultadosApi[p.id] = p.resultado;
    }
  });

  const getResultado = (partidoId) => {
    // Prioridad: resultado manual del admin > sincronizado > live
    if (resultados[partidoId]?.golesLocal !== undefined) return resultados[partidoId];
    if (resultadosApi[partidoId]) return resultadosApi[partidoId];
    if (liveData[partidoId]) return liveData[partidoId];
    return null;
  };

  const getPronostico = (jugador, partidoId) => pronosticos[`${jugador}_${partidoId}`];

  const puedeEditar = (jugador) => adminMode || user?.nombre === jugador;

  const calcularPuntosPartido = (partido, pron, res) =>
    partido.esEliminatoria ? calcularPuntosEliminatoria(pron, res) : calcularPuntos(pron, res);

  // Campeón del Mundo: se detecta solo cuando la final tiene resultado
  const partidoFinal = partidosEliminatorias.find(p => p.fase === 'FINAL' && p.definido);
  const resFinal = partidoFinal ? getResultado(partidoFinal.id) : null;
  const ganadorFinal = resFinal ? ganadorResultado(resFinal) : null;
  const campeonReal = ganadorFinal === 'local' ? partidoFinal.local
    : ganadorFinal === 'visitante' ? partidoFinal.visitante
    : null;
  const plazoCampeonAbierto = Date.now() < new Date(CAMPEON_DEADLINE).getTime();

  const elegirCampeon = async (jugador, equipo) => {
    const previo = campeones[jugador];
    setCampeones(prev => {
      const copia = { ...prev };
      if (equipo) copia[jugador] = equipo; else delete copia[jugador];
      return copia;
    });
    try {
      await api('setCampeon', { jugador, equipo: equipo || null });
    } catch (e) {
      setCampeones(prev => {
        const copia = { ...prev };
        if (previo) copia[jugador] = previo; else delete copia[jugador];
        return copia;
      });
      alert(e.message);
    }
  };

  // Clasificación
  const clasificacion = jugadores.map(j => {
    let ptsPronosticos = 0, perfectos = 0, tendencias = 0, errores = 0, jugados = 0;
    todosPartidos.forEach(p => {
      const res = getResultado(p.id);
      const pron = getPronostico(j, p.id);
      const calc = calcularPuntosPartido(p, pron, res);
      if (calc !== null) {
        jugados++;
        ptsPronosticos += calc.puntos;
        if (calc.color === 'verde') perfectos++;
        else if (calc.color === 'amarillo') tendencias++;
        else errores++;
      }
    });
    const equipoBonus = bonusEquipos[j] || null;
    const bonus = equipoBonus ? calcularBonus(equipoBonus, getResultado, partidosGrupos) : null;
    const ptsBonus = bonus?.pts || 0;
    const campeon = campeones[j] || null;
    const acertoCampeon = !!(campeonReal && campeon === campeonReal);
    return {
      nombre: j,
      pts: ptsPronosticos + ptsBonus,
      ptsPronosticos,
      ptsBonus,
      equipoBonus,
      bonus,
      campeon,
      acertoCampeon,
      pagado: pagos[j] === true,
      perfectos, tendencias, errores, jugados,
    };
  }).sort((a, b) =>
    b.pts - a.pts ||
    b.perfectos - a.perfectos ||
    Number(b.acertoCampeon) - Number(a.acertoCampeon)
  );

  // Bote y premios: inscripción × participantes, repartido 60/25/15
  const bote = jugadores.length * INSCRIPCION;
  const premios = REPARTO_PREMIOS.map(p => bote * p);
  const formatEuros = (n) => (Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`);

  const fasesDisponibles = [...new Set(partidosEliminatorias.map(p => p.fase))];
  const grupos = ['TODOS', ...new Set(partidosGrupos.map(p => p.grupo)), ...fasesDisponibles];
  const partidosFiltrados = filtroGrupo === 'TODOS'
    ? todosPartidos
    : todosPartidos.filter(p => p.grupo === filtroGrupo || p.fase === filtroGrupo);

  const VISTAS = [
    { id: 'tabla', icono: '📊', label: 'Tabla' },
    { id: 'partidos', icono: '⚽', label: 'Partidos' },
    { id: 'clasificacion', icono: '🏆', label: 'Clasif.' },
  ];

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-2xl animate-pulse">⚽ Cargando porra...</div>
    </div>
  );

  return (
    <>
      <Head>
        <title>🏆 Porra Mundial 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <header className="bg-gradient-to-r from-green-900 via-gray-900 to-red-900 border-b border-gray-700 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <h1 className="text-lg sm:text-xl font-black tracking-tight whitespace-nowrap">
              ⚽ <span className="text-yellow-400">PORRA</span> <span className="hidden xs:inline">MUNDIAL 2026</span>
            </h1>

            {/* Navegación de escritorio */}
            <div className="hidden sm:flex gap-2 flex-wrap items-center">
              {VISTAS.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVista(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    vista === v.id ? 'bg-yellow-400 text-gray-900' : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {v.icono} {v.label}
                </button>
              ))}
            </div>

            {/* Usuario */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowReglas(true)}
                className="w-8 h-8 flex items-center justify-center bg-gray-800/80 hover:bg-gray-700 rounded-full text-sm font-bold"
                title="Reglamento y cómo funciona"
              >
                ❓
              </button>
              {user ? (
                <div className="flex items-center gap-2 bg-gray-800/80 rounded-full pl-3 pr-1.5 py-1">
                  <span className={`text-sm font-semibold capitalize max-w-[100px] truncate ${adminMode ? 'text-red-400' : 'text-yellow-400'}`}>
                    {adminMode ? '🔓 admin' : user.nombre}
                  </span>
                  <button
                    onClick={() => confirm('¿Cerrar sesión?') && logout()}
                    className="text-xs bg-gray-700 hover:bg-gray-600 rounded-full px-2 py-1"
                    title="Cerrar sesión"
                  >
                    Salir
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-4 py-1.5 bg-yellow-400 text-gray-900 rounded-lg text-sm font-bold hover:bg-yellow-300"
                >
                  Entrar
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-2 py-4 pb-24 sm:pb-6">

          {/* Aviso si no ha iniciado sesión */}
          {!user && (
            <div className="mb-4 p-3 bg-yellow-400/10 border border-yellow-400/40 rounded-xl text-sm flex items-center justify-between gap-2 flex-wrap">
              <span>👀 Estás en modo solo lectura. Entra con tu nombre para poner tus pronósticos.</span>
              <button onClick={() => setShowLogin(true)} className="px-3 py-1.5 bg-yellow-400 text-gray-900 rounded-lg font-bold text-sm">
                Entrar
              </button>
            </div>
          )}

          {/* ===== VISTA TABLA ===== */}
          {vista === 'tabla' && (
            <div>
              <div className="mb-4 flex items-center gap-4 flex-wrap">
                <div className="flex gap-3 text-xs sm:text-sm flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Perfecto (3 pts)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span> Tendencia (1 pt)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Error (0 pts)</span>
                </div>
                {saving && <span className="text-yellow-400 text-sm animate-pulse">Guardando...</span>}
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-700">
                <table className="min-w-max w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-900">
                      <th className="sticky left-0 bg-gray-900 z-10 px-3 py-2 text-left font-semibold border-r border-gray-700">Partido</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-400 border-r border-gray-700">Resultado</th>
                      {jugadores.map(j => (
                        <th
                          key={j}
                          className={`px-2 py-2 text-center font-semibold capitalize border-r border-gray-700 last:border-r-0 whitespace-nowrap ${
                            user?.nombre === j ? 'bg-yellow-400/20 text-yellow-300' : ''
                          }`}
                        >
                          {user?.nombre === j ? `⭐ ${j}` : j}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todosPartidos.map((partido, idx) => {
                      const resultado = getResultado(partido.id);
                      const isLive = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(partido.estado)
                        || liveData[partido.id]?.estado === 'IN_PLAY' || liveData[partido.id]?.estado === 'PAUSED';
                      const primeraEliminatoria = partido.esEliminatoria && !todosPartidos[idx - 1]?.esEliminatoria;
                      return (
                        <Fragment key={partido.id}>
                          {primeraEliminatoria && (
                            <tr className="border-t-2 border-yellow-400/50 bg-yellow-400/10">
                              <td colSpan={2 + jugadores.length} className="px-3 py-1.5 text-xs font-black text-yellow-400 tracking-widest">
                                ⚔️ ELIMINATORIAS — sin empates, los penaltis deciden el ganador
                              </td>
                            </tr>
                          )}
                          <tr className={`border-t border-gray-800 ${idx % 2 === 0 ? 'bg-gray-900/30' : ''}`}>
                          {/* Partido */}
                          <td className="sticky left-0 bg-gray-950 z-10 px-3 py-2 border-r border-gray-700">
                            <div className="flex items-center gap-1 whitespace-nowrap">
                              <span className="text-xs text-gray-500 w-5 text-center font-mono" title={partido.faseNombre}>{partido.grupo}</span>
                              <span className="text-xs">{partido.flagLocal}</span>
                              <span className="text-xs text-gray-300 max-w-[70px] truncate">{partido.local}</span>
                              <span className="text-gray-500 text-xs">vs</span>
                              <span className="text-xs text-gray-300 max-w-[70px] truncate">{partido.visitante}</span>
                              <span className="text-xs">{partido.flagVisitante}</span>
                            </div>
                            <div className="text-xs text-gray-500">{partido.fecha} {partido.hora}</div>
                          </td>

                          {/* Resultado */}
                          <td className="px-2 py-2 text-center border-r border-gray-700">
                            {isLive && (
                              <span className="text-xs text-red-400 animate-pulse block">🔴 LIVE</span>
                            )}
                            {resultado ? (
                              <button
                                onClick={() => adminMode && setEditandoResultado(partido.id)}
                                className={`font-mono font-bold text-sm ${adminMode ? 'hover:text-yellow-400 cursor-pointer' : 'cursor-default'}`}
                              >
                                {resultado.golesLocal} - {resultado.golesVisitante}
                                <PenalesInfo resultado={resultado} />
                              </button>
                            ) : (
                              adminMode ? (
                                <button
                                  onClick={() => setEditandoResultado(partido.id)}
                                  className="text-xs text-gray-500 hover:text-yellow-400 cursor-pointer"
                                >
                                  + añadir
                                </button>
                              ) : (
                                <span className="text-gray-600 text-xs">-</span>
                              )
                            )}
                            {editandoResultado === partido.id && (
                              <ResultadoEditor
                                partido={partido}
                                resultadoActual={resultados[partido.id]?.golesLocal !== undefined ? resultados[partido.id] : null}
                                onSave={guardarResultado}
                                onDelete={borrarResultado}
                                onClose={() => setEditandoResultado(null)}
                              />
                            )}
                          </td>

                          {/* Pronósticos de cada jugador */}
                          {jugadores.map(j => {
                            const pron = getPronostico(j, partido.id);
                            const calc = resultado ? calcularPuntosPartido(partido, pron, resultado) : null;
                            const esPropio = user?.nombre === j;
                            return (
                              <td
                                key={j}
                                className={`px-1 py-1 text-center border-r border-gray-700 last:border-r-0 ${
                                  calc ? COLOR_MAP[calc.color] : esPropio ? 'bg-yellow-400/5' : ''
                                }`}
                              >
                                <PronosticoCell
                                  jugador={j}
                                  partido={partido}
                                  pronostico={pron}
                                  onSave={guardarPronostico}
                                  onDelete={borrarPronostico}
                                  resultado={resultado}
                                  adminMode={adminMode}
                                  editable={puedeEditar(j)}
                                />
                              </td>
                            );
                          })}
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                  {/* Fila de totales */}
                  <tfoot>
                    <tr className="border-t-2 border-gray-600 bg-gray-900">
                      <td className="sticky left-0 bg-gray-900 z-10 px-3 py-2 font-bold text-yellow-400">TOTAL</td>
                      <td className="border-r border-gray-700"></td>
                      {jugadores.map(j => {
                        const c = clasificacion.find(x => x.nombre === j);
                        return (
                          <td key={j} className="px-2 py-2 text-center border-r border-gray-700 last:border-r-0">
                            <span className="font-black text-yellow-400 text-base">{c?.pts ?? 0}</span>
                            <span className="text-gray-400 text-xs block">
                              pts{c?.ptsBonus > 0 && <span className="text-purple-300" title={`Incluye +${c.ptsBonus} del bonus de ${c.equipoBonus}`}> (+{c.ptsBonus} 🎯)</span>}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Gestión de jugadores (solo admin) */}
              {adminMode && (
                <div className="mt-6 p-4 bg-gray-900 rounded-xl border border-gray-700">
                  <h3 className="text-sm font-bold text-yellow-400 mb-3">👥 Gestionar jugadores</h3>
                  <div className="flex gap-2 mb-3">
                    <input
                      value={nuevoJugador}
                      onChange={e => setNuevoJugador(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addJugador()}
                      placeholder="Nombre del jugador..."
                      className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                    />
                    <button
                      onClick={addJugador}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold"
                    >
                      Añadir
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {jugadores.map(j => (
                      <span key={j} className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-full text-sm">
                        {j}
                        <button onClick={() => removeJugador(j)} className="text-red-400 hover:text-red-300 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== VISTA PARTIDOS ===== */}
          {vista === 'partidos' && (
            <div>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-2 px-2 sm:flex-wrap sm:overflow-visible">
                {grupos.map(g => {
                  let label = `Grupo ${g}`;
                  if (g === 'TODOS') label = 'Todos';
                  else if (FASES[g]) label = `⚔️ ${FASES[g].nombre}`;
                  return (
                    <button
                      key={g}
                      onClick={() => setFiltroGrupo(g)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                        filtroGrupo === g ? 'bg-yellow-400 text-gray-900' : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {saving && <p className="text-yellow-400 text-sm animate-pulse mb-2">Guardando...</p>}

              {/* Estado de las eliminatorias */}
              {eliminatorias.length === 0 && (
                <div className="mb-3 p-3 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-400 flex items-center justify-between gap-2 flex-wrap">
                  <span>⚔️ Las eliminatorias (dieciseisavos → final) aparecerán aquí automáticamente cuando la FIFA confirme los cruces (a partir del 28 de junio).</span>
                  {adminMode && (
                    <button
                      onClick={sincronizarAhora}
                      disabled={sincronizando}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold disabled:opacity-50 flex-shrink-0"
                    >
                      {sincronizando ? 'Sincronizando...' : '🔄 Sincronizar ahora'}
                    </button>
                  )}
                </div>
              )}
              {eliminatorias.length > 0 && adminMode && (
                <div className="mb-3 flex justify-end">
                  <button
                    onClick={sincronizarAhora}
                    disabled={sincronizando}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    {sincronizando ? 'Sincronizando...' : '🔄 Sincronizar eliminatorias'}
                  </button>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                {partidosFiltrados.map(partido => {
                  const resultado = getResultado(partido.id);
                  const isLive = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(partido.estado)
                    || liveData[partido.id]?.estado === 'IN_PLAY';
                  const miPron = user && !adminMode ? getPronostico(user.nombre, partido.id) : null;
                  const bloqueado = (partidoEmpezado(partido) || !!resultado || partido.definido === false) && !adminMode;
                  return (
                    <div key={partido.id} className={`bg-gray-900 border rounded-xl p-4 ${partido.esEliminatoria ? 'border-yellow-400/40' : 'border-gray-700'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">
                          {partido.fecha} · {partido.hora} · {partido.esEliminatoria ? `⚔️ ${partido.faseNombre}` : `Grupo ${partido.grupo}`}
                        </span>
                        {isLive && <span className="text-xs text-red-400 animate-pulse font-bold">🔴 EN VIVO</span>}
                      </div>
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-2xl">{partido.flagLocal}</span>
                          <span className="font-semibold text-sm sm:text-base truncate">{partido.local}</span>
                        </div>
                        <div className="text-center flex-shrink-0">
                          {resultado ? (
                            <span className="text-xl font-black">
                              {resultado.golesLocal} - {resultado.golesVisitante}
                              <PenalesInfo resultado={resultado} />
                            </span>
                          ) : (
                            <span className="text-gray-500">vs</span>
                          )}
                          {adminMode && (
                            <button
                              onClick={() => setEditandoResultado(partido.id)}
                              className="block text-xs text-yellow-400 hover:text-yellow-300 mt-1 mx-auto"
                            >
                              {resultado ? 'Editar' : '+ Resultado'}
                            </button>
                          )}
                          {editandoResultado === partido.id && (
                            <ResultadoEditor
                              partido={partido}
                              resultadoActual={resultados[partido.id]?.golesLocal !== undefined ? resultados[partido.id] : null}
                              onSave={guardarResultado}
                              onDelete={borrarResultado}
                              onClose={() => setEditandoResultado(null)}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="font-semibold text-sm sm:text-base truncate">{partido.visitante}</span>
                          <span className="text-2xl">{partido.flagVisitante}</span>
                        </div>
                      </div>

                      {/* Mi pronóstico (editor grande, ideal para móvil) */}
                      {user && !adminMode && (
                        <MiPronosticoEditor
                          partido={partido}
                          pronostico={miPron}
                          bloqueado={bloqueado}
                          resultado={resultado}
                          onSave={(gL, gV) => guardarPronostico(user.nombre, partido.id, gL, gV)}
                          onDelete={() => borrarPronostico(user.nombre, partido.id)}
                        />
                      )}

                      {/* Pronósticos en vista partidos */}
                      <div className="border-t border-gray-800 pt-2 mt-2">
                        <p className="text-xs text-gray-500 mb-2">Pronósticos:</p>
                        <div className="flex flex-wrap gap-2">
                          {jugadores.map(j => {
                            const pron = getPronostico(j, partido.id);
                            const calc = resultado ? calcularPuntosPartido(partido, pron, resultado) : null;
                            const bgClass = calc ? COLOR_MAP[calc.color] : 'bg-gray-800';
                            return (
                              <div key={j} className={`rounded-lg px-2 py-1 text-xs ${bgClass} ${user?.nombre === j ? 'ring-1 ring-yellow-400' : ''}`}>
                                <span className="font-semibold capitalize">{j}</span>
                                {pron ? (
                                  <span className="ml-1 font-mono">{pron.golesLocal}-{pron.golesVisitante}</span>
                                ) : (
                                  <span className="ml-1 text-gray-400">-</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== VISTA CLASIFICACIÓN ===== */}
          {vista === 'clasificacion' && (
            <div className="max-w-lg mx-auto">
              <h2 className="text-xl font-black mb-4 text-yellow-400">🏆 Clasificación</h2>

              {/* Bote y premios */}
              <div className="mb-4 p-3 bg-gray-900 border border-gray-700 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-green-400">💶 Bote total</p>
                  <p className="text-lg font-black text-green-400">{formatEuros(bote)}</p>
                </div>
                <p className="text-xs text-gray-500 mb-2">{jugadores.length} participantes × {INSCRIPCION} € de inscripción</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-yellow-400/10 border border-yellow-400/40 rounded-lg py-1.5">
                    <span className="block">🥇 60%</span>
                    <span className="font-black text-yellow-400">{formatEuros(premios[0])}</span>
                  </div>
                  <div className="bg-gray-400/10 border border-gray-400/40 rounded-lg py-1.5">
                    <span className="block">🥈 25%</span>
                    <span className="font-black text-gray-300">{formatEuros(premios[1])}</span>
                  </div>
                  <div className="bg-orange-900/20 border border-orange-700/60 rounded-lg py-1.5">
                    <span className="block">🥉 15%</span>
                    <span className="font-black text-orange-400">{formatEuros(premios[2])}</span>
                  </div>
                </div>
              </div>

              {/* Mi apuesta de Campeón del Mundo */}
              {user && !adminMode && (
                <div className="mb-4 p-3 bg-gray-900 border border-gray-700 rounded-xl">
                  <p className="text-sm font-bold text-yellow-400 mb-1">👑 Tu Campeón del Mundo</p>
                  {plazoCampeonAbierto ? (
                    <>
                      <p className="text-xs text-gray-500 mb-2">
                        Elige quién crees que ganará el Mundial (puedes cambiarlo hasta que empiecen las eliminatorias el 28 de junio). Sirve de desempate en la clasificación final.
                      </p>
                      <select
                        value={campeones[user.nombre] || ''}
                        onChange={e => elegirCampeon(user.nombre, e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-400"
                      >
                        <option value="">— Elige tu campeón —</option>
                        {EQUIPOS.map(eq => (
                          <option key={eq.nombre} value={eq.nombre}>{eq.flag} {eq.nombre}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <p className="text-sm">
                      {campeones[user.nombre]
                        ? <>Tu apuesta: <span className="font-bold">{FLAGS[campeones[user.nombre]]} {campeones[user.nombre]}</span> (plazo cerrado)</>
                        : <span className="text-gray-500">No elegiste campeón antes del cierre del plazo.</span>}
                    </p>
                  )}
                </div>
              )}

              {campeonReal && (
                <div className="mb-4 p-3 bg-yellow-400/10 border border-yellow-400 rounded-xl text-center">
                  <p className="text-sm font-black text-yellow-400">👑 CAMPEÓN DEL MUNDO: {FLAGS[campeonReal]} {campeonReal}</p>
                </div>
              )}

              <div className="space-y-2">
                {clasificacion.map((j, i) => (
                  <div
                    key={j.nombre}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${
                      i === 0 ? 'bg-yellow-400/10 border-yellow-400' :
                      i === 1 ? 'bg-gray-400/10 border-gray-400' :
                      i === 2 ? 'bg-orange-900/20 border-orange-700' :
                      'bg-gray-900 border-gray-700'
                    } ${user?.nombre === j.nombre ? 'ring-2 ring-yellow-400/60' : ''}`}
                  >
                    <span className="text-2xl font-black w-8 text-center">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold capitalize text-base">
                        {j.nombre} {user?.nombre === j.nombre && <span className="text-yellow-400 text-xs">(tú)</span>}
                      </p>
                      <div className="flex gap-3 text-xs mt-1 flex-wrap">
                        <span className="text-green-400">✅ {j.perfectos}</span>
                        <span className="text-yellow-400">🟡 {j.tendencias}</span>
                        <span className="text-red-400">❌ {j.errores}</span>
                        <span className="text-gray-400">{j.jugados} jugados</span>
                      </div>
                      <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                        {/* Estado de pago (visible para todos, editable por admin) */}
                        {adminMode ? (
                          <button
                            onClick={() => togglePago(j.nombre)}
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                              j.pagado
                                ? 'bg-green-500/15 border-green-500 text-green-400 hover:bg-green-500/30'
                                : 'bg-red-500/15 border-red-500 text-red-400 hover:bg-red-500/30'
                            }`}
                            title="Toca para cambiar el estado de pago"
                          >
                            {j.pagado ? '💰 Pagado' : '💸 No pagado'}
                          </button>
                        ) : (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            j.pagado
                              ? 'bg-green-500/15 border-green-500 text-green-400'
                              : 'bg-red-500/15 border-red-500 text-red-400'
                          }`}>
                            {j.pagado ? '💰 Pagado' : '💸 No pagado'}
                          </span>
                        )}
                        {/* Equipo bonus */}
                        {j.equipoBonus && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full border border-purple-500 bg-purple-500/15 text-purple-300"
                            title={`Bonus: ${j.bonus.golesFavor} goles a favor, ${j.bonus.golesContra} en contra en ${j.bonus.jugados} partidos`}
                          >
                            🎯 {FLAGS[j.equipoBonus]} {j.equipoBonus}
                            {j.ptsBonus > 0 && <span className="ml-1 font-black">+{j.ptsBonus}</span>}
                          </span>
                        )}
                        {/* Apuesta de campeón */}
                        {j.campeon && (
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              j.acertoCampeon
                                ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300'
                                : 'border-gray-600 bg-gray-800 text-gray-300'
                            }`}
                            title={j.acertoCampeon ? '¡Acertó el Campeón del Mundo!' : 'Su apuesta de campeón (desempate)'}
                          >
                            👑 {FLAGS[j.campeon]} {j.campeon} {j.acertoCampeon && '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-3xl font-black text-yellow-400">{j.pts}</span>
                      <span className="text-gray-400 text-sm"> pts</span>
                      {j.ptsBonus > 0 && (
                        <p className="text-xs text-purple-300">{j.ptsPronosticos} + {j.ptsBonus} 🎯</p>
                      )}
                      {i < 3 && (
                        <p className="text-xs font-bold text-green-400">💶 {formatEuros(premios[i])}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Leyenda del bonus */}
              <div className="mt-4 p-3 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-400">
                <p className="font-semibold text-purple-300 mb-1">🎯 Bonus peores selecciones</p>
                <p>Cada participante tiene asignada una de las 14 peores selecciones del Mundial: +1 punto por cada gol a favor de tu equipo y +1 punto por cada 3 goles en contra en un partido. Se suma automáticamente al total.</p>
              </div>

              {/* Panel admin: pagos y asignación de equipos bonus */}
              {adminMode && (
                <div className="mt-4 p-4 bg-gray-900 rounded-xl border border-gray-700">
                  <h3 className="text-sm font-bold text-yellow-400 mb-1">🎯 Bonus y 👑 campeón de cada participante</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Primer desplegable: una de las 14 peores selecciones (bonus). Segundo: su apuesta de Campeón del Mundo.
                    El estado de pago se cambia tocando la insignia 💰/💸 de cada uno en la lista de arriba.
                  </p>
                  <div className="space-y-2">
                    {jugadores.map(j => {
                      const asignado = bonusEquipos[j] || '';
                      const repetido = asignado && jugadores.some(otro => otro !== j && bonusEquipos[otro] === asignado);
                      return (
                        <div key={j} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <span className="capitalize text-sm w-28 truncate flex-shrink-0">{j}</span>
                          <select
                            value={asignado}
                            onChange={e => asignarBonusEquipo(j, e.target.value)}
                            className="flex-1 min-w-[140px] bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-yellow-400"
                            title="Equipo bonus (peores selecciones)"
                          >
                            <option value="">🎯 Sin equipo bonus</option>
                            <optgroup label="Peores selecciones (sugeridas)">
                              {PEORES_SELECCIONES.map(eq => (
                                <option key={eq} value={eq}>{FLAGS[eq]} {eq}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Resto de selecciones">
                              {OTRAS_SELECCIONES.map(eq => (
                                <option key={eq.nombre} value={eq.nombre}>{eq.flag} {eq.nombre}</option>
                              ))}
                            </optgroup>
                          </select>
                          <select
                            value={campeones[j] || ''}
                            onChange={e => elegirCampeon(j, e.target.value)}
                            className="flex-1 min-w-[140px] bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-yellow-400"
                            title="Apuesta de Campeón del Mundo"
                          >
                            <option value="">👑 Sin campeón</option>
                            {EQUIPOS.map(eq => (
                              <option key={eq.nombre} value={eq.nombre}>{eq.flag} {eq.nombre}</option>
                            ))}
                          </select>
                          {repetido && <span className="text-xs text-orange-400 flex-shrink-0" title="Este equipo está asignado a más de un participante">⚠️</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Navegación inferior (móvil) */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-20 pb-[env(safe-area-inset-bottom)]">
          <div className="flex">
            {VISTAS.map(v => (
              <button
                key={v.id}
                onClick={() => setVista(v.id)}
                className={`flex-1 flex flex-col items-center py-2.5 text-xs font-semibold transition-colors ${
                  vista === v.id ? 'text-yellow-400' : 'text-gray-400'
                }`}
              >
                <span className="text-xl leading-none mb-0.5">{v.icono}</span>
                {v.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Modal de login */}
      {showLogin && (
        <LoginModal onLogin={login} onClose={() => setShowLogin(false)} />
      )}

      {/* Modal de reglamento */}
      {showReglas && (
        <ReglasModal
          onClose={() => {
            localStorage.setItem('porra_reglas_vistas', '1');
            setShowReglas(false);
          }}
        />
      )}
    </>
  );
}

// ===== Modal con el reglamento y el funcionamiento de la app =====
function ReglasModal({ onClose }) {
  const Seccion = ({ titulo, children }) => (
    <div className="mb-4">
      <h4 className="font-bold text-yellow-400 text-sm mb-1.5">{titulo}</h4>
      <div className="text-sm text-gray-300 space-y-1.5">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 pb-3 border-b border-gray-800">
          <h3 className="font-black text-lg">📋 Reglamento de la porra</h3>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <Seccion titulo="🔑 Cómo funciona la app">
            <p>Entra con tu <b>nombre de participante</b>. La primera vez crearás tu contraseña.</p>
            <p>Solo puedes poner, cambiar o borrar <b>tus propios pronósticos</b> (tu columna está marcada con ⭐), y solo <b>hasta que el partido empiece</b>.</p>
            <p>En el móvil, la pestaña <b>⚽ Partidos</b> es la más cómoda: cada partido tiene tu casilla de pronóstico en grande.</p>
          </Seccion>

          <Seccion titulo="🎯 Puntuación">
            <p><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span><b>3 puntos</b> — Acierto perfecto: marcador exacto (pusiste 2-1 y quedó 2-1).</p>
            <p><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1"></span><b>1 punto</b> — Tendencia: aciertas quién gana o el empate, sin el marcador exacto.</p>
            <p><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1"></span><b>0 puntos</b> — Error total.</p>
          </Seccion>

          <Seccion titulo="⚔️ Eliminatorias (desde el 28 de junio)">
            <p>Los cruces aparecen solos en la app cuando la FIFA los confirma.</p>
            <p><b>No se puede pronosticar empate</b>: pon siempre un ganador.</p>
            <p>Cuenta el marcador de los <b>90 minutos + prórroga</b>. Si hay penaltis, el que los gane cuenta como ganador para la tendencia (1 punto como máximo, como dice el reglamento).</p>
          </Seccion>

          <Seccion titulo="🎯 Bonus: peores selecciones">
            <p>Cada participante tiene asignada una de las 14 peores selecciones del Mundial. Con ella sumas extra en sus partidos de grupos:</p>
            <p>• <b>+1 punto</b> por cada gol a favor de tu equipo.</p>
            <p>• <b>+1 punto</b> por cada 3 goles en contra en un partido.</p>
          </Seccion>

          <Seccion titulo="👑 Campeón del Mundo">
            <p>En la pestaña 🏆 Clasificación puedes elegir tu campeón <b>hasta el 28 de junio</b>. Acertarlo es el segundo criterio de desempate.</p>
          </Seccion>

          <Seccion titulo="🏆 Desempates en la clasificación final">
            <p>1º Más aciertos perfectos (3 puntos). 2º Haber acertado el Campeón del Mundo. 3º Si sigue el empate, el premio se reparte.</p>
          </Seccion>

          <Seccion titulo="💰 Inscripción y premios">
            <p>Inscripción: <b>5 € por persona</b>. El bote se reparte: 🥇 ganador <b>60%</b>, 🥈 subcampeón <b>25%</b>, 🥉 tercero <b>15%</b>.</p>
            <p>El bote y los premios se ven en la pestaña 🏆 Clasificación. Ahí también aparece quién ha pagado (💰) y quién no (💸); lo gestiona el admin.</p>
          </Seccion>
        </div>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-3 bg-yellow-400 text-gray-900 font-bold rounded-lg active:scale-95 transition-transform"
          >
            ¡Entendido, a jugar! ⚽
          </button>
        </div>
      </div>
    </div>
  );
}

// Devuelve true si el partido ya ha empezado
function partidoEmpezado(partido) {
  // Eliminatorias: la API ya da la fecha exacta en UTC
  if (partido.utcDate) return new Date() >= new Date(partido.utcDate);
  const [h, m] = partido.hora.split(':').map(Number);
  const utcH = h - 2; // CEST = UTC+2
  const utcDay = utcH < 0 ? 1 : 0;
  const utcHAdj = utcH < 0 ? utcH + 24 : utcH;
  const fechaStr = `${partido.fecha}T${String(utcHAdj).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`;
  return new Date() >= new Date(fechaStr);
}

// Marcador de penaltis junto al resultado (solo eliminatorias)
function PenalesInfo({ resultado }) {
  if (resultado?.penalesLocal !== undefined && resultado?.penalesLocal !== null) {
    return <span className="block text-xs text-gray-400 font-normal">🥅 {resultado.penalesLocal}-{resultado.penalesVisitante} pen</span>;
  }
  if (resultado?.ganadorPenales) {
    return <span className="block text-xs text-gray-400 font-normal">🥅 gana {resultado.ganadorPenales} en penaltis</span>;
  }
  return null;
}

// ===== Modal de login / registro =====
function LoginModal({ onLogin, onClose }) {
  const [step, setStep] = useState('nombre'); // 'nombre' | 'password' | 'crear' | 'admin'
  const [nombre, setNombre] = useState('');
  const [canonical, setCanonical] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const authApi = async (action, payload) => {
    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error inesperado');
    return data;
  };

  const comprobarNombre = async () => {
    setError('');
    const n = nombre.trim();
    if (!n) return;
    if (n.toLowerCase() === 'admin') {
      setStep('admin');
      return;
    }
    setBusy(true);
    try {
      const data = await authApi('check', { nombre: n });
      if (!data.exists) {
        setError('No hay ningún participante con ese nombre. Comprueba que esté bien escrito.');
        return;
      }
      setCanonical(data.nombre);
      setStep(data.hasPassword ? 'password' : 'crear');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const crearPassword = async () => {
    setError('');
    if (pass.trim().length < 4) { setError('La contraseña debe tener al menos 4 caracteres'); return; }
    if (pass !== pass2) { setError('Las contraseñas no coinciden'); return; }
    setBusy(true);
    try {
      onLogin(await authApi('register', { nombre: canonical, password: pass.trim() }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const entrar = async () => {
    setError('');
    setBusy(true);
    try {
      onLogin(await authApi('login', { nombre: canonical, password: pass }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const entrarAdmin = async () => {
    setError('');
    setBusy(true);
    try {
      onLogin(await authApi('loginAdmin', { password: pass }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const volver = () => {
    setStep('nombre');
    setPass('');
    setPass2('');
    setError('');
  };

  const inputClass = 'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-3 text-base focus:outline-none focus:border-yellow-400';
  const btnPrimary = 'flex-1 py-3 bg-yellow-400 text-gray-900 font-bold rounded-lg disabled:opacity-50 active:scale-95 transition-transform';
  const btnSecondary = 'flex-1 py-3 bg-gray-700 rounded-lg active:scale-95 transition-transform';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        {step === 'nombre' && (
          <>
            <h3 className="font-bold text-lg mb-1">👋 ¡Hola!</h3>
            <p className="text-sm text-gray-400 mb-4">Escribe tu nombre de participante para entrar.</p>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && comprobarNombre()}
              placeholder="Tu nombre..."
              autoFocus
              className={`${inputClass} mb-3`}
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={comprobarNombre} disabled={busy || !nombre.trim()} className={btnPrimary}>
                {busy ? '...' : 'Continuar'}
              </button>
              <button onClick={onClose} className={btnSecondary}>Solo mirar</button>
            </div>
            <p className="text-xs text-gray-500 mt-3">¿Eres el administrador? Escribe <code className="text-gray-400">admin</code> como nombre.</p>
          </>
        )}

        {step === 'crear' && (
          <>
            <h3 className="font-bold text-lg mb-1">🔐 Crea tu contraseña</h3>
            <p className="text-sm text-gray-400 mb-4">
              Primera vez de <span className="text-yellow-400 font-semibold capitalize">{canonical}</span>.
              Elige una contraseña para proteger tus pronósticos.
            </p>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="Contraseña (mín. 4 caracteres)"
              autoFocus
              className={`${inputClass} mb-2`}
            />
            <input
              type="password"
              value={pass2}
              onChange={e => setPass2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && crearPassword()}
              placeholder="Repite la contraseña"
              className={`${inputClass} mb-3`}
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={crearPassword} disabled={busy} className={btnPrimary}>
                {busy ? '...' : 'Crear y entrar'}
              </button>
              <button onClick={volver} className={btnSecondary}>Volver</button>
            </div>
          </>
        )}

        {step === 'password' && (
          <>
            <h3 className="font-bold text-lg mb-1">🔑 Hola de nuevo, <span className="capitalize text-yellow-400">{canonical}</span></h3>
            <p className="text-sm text-gray-400 mb-4">Introduce tu contraseña.</p>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && entrar()}
              placeholder="Contraseña..."
              autoFocus
              className={`${inputClass} mb-3`}
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={entrar} disabled={busy || !pass} className={btnPrimary}>
                {busy ? '...' : 'Entrar'}
              </button>
              <button onClick={volver} className={btnSecondary}>Volver</button>
            </div>
            <p className="text-xs text-gray-500 mt-3">¿Olvidaste la contraseña? Pídele al admin que te la resetee.</p>
          </>
        )}

        {step === 'admin' && (
          <>
            <h3 className="font-bold text-lg mb-1">🔒 Acceso admin</h3>
            <p className="text-sm text-gray-400 mb-4">Introduce la contraseña de administrador.</p>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && entrarAdmin()}
              placeholder="Contraseña admin..."
              autoFocus
              className={`${inputClass} mb-3`}
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={entrarAdmin} disabled={busy || !pass} className={btnPrimary}>
                {busy ? '...' : 'Entrar'}
              </button>
              <button onClick={volver} className={btnSecondary}>Volver</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== Editor grande de "mi pronóstico" (vista partidos, pensado para móvil) =====
function MiPronosticoEditor({ partido, pronostico, bloqueado, resultado, onSave, onDelete }) {
  const [gL, setGL] = useState(pronostico?.golesLocal ?? '');
  const [gV, setGV] = useState(pronostico?.golesVisitante ?? '');

  useEffect(() => {
    setGL(pronostico?.golesLocal ?? '');
    setGV(pronostico?.golesVisitante ?? '');
  }, [pronostico]);

  const cambiado = String(gL) !== String(pronostico?.golesLocal ?? '') || String(gV) !== String(pronostico?.golesVisitante ?? '');
  const calc = resultado && pronostico
    ? (partido.esEliminatoria ? calcularPuntosEliminatoria(pronostico, resultado) : calcularPuntos(pronostico, resultado))
    : null;

  const guardar = () => {
    if (partido.esEliminatoria && parseInt(gL) === parseInt(gV)) {
      alert('⚔️ En eliminatorias no puede haber empate: pon un ganador (los penaltis deciden).');
      return;
    }
    onSave(parseInt(gL), parseInt(gV));
  };

  if (bloqueado) {
    return (
      <div className="bg-gray-800/60 rounded-lg px-3 py-2 mb-2 flex items-center justify-between text-sm">
        <span className="text-gray-400">⏰ Tu pronóstico:</span>
        <span className={`font-mono font-bold px-2 py-0.5 rounded ${calc ? COLOR_MAP[calc.color] : ''}`}>
          {pronostico ? `${pronostico.golesLocal} - ${pronostico.golesVisitante}` : 'sin poner'}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/60 rounded-lg px-3 py-2.5 mb-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-yellow-400 font-semibold flex-shrink-0">⭐ Tu pronóstico</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number" inputMode="numeric" min="0" max="20"
            value={gL}
            onChange={e => setGL(e.target.value)}
            className="w-11 h-11 text-center bg-gray-900 border border-gray-600 rounded-lg text-lg font-bold focus:outline-none focus:border-yellow-400"
          />
          <span className="text-gray-400 font-bold">-</span>
          <input
            type="number" inputMode="numeric" min="0" max="20"
            value={gV}
            onChange={e => setGV(e.target.value)}
            className="w-11 h-11 text-center bg-gray-900 border border-gray-600 rounded-lg text-lg font-bold focus:outline-none focus:border-yellow-400"
          />
          {cambiado && gL !== '' && gV !== '' && (
            <button
              onClick={guardar}
              className="h-11 px-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-sm active:scale-95 transition-transform"
            >
              ✓
            </button>
          )}
          {pronostico && (
            <button
              onClick={() => confirm('¿Borrar tu pronóstico de este partido?') && onDelete()}
              className="h-11 px-3 bg-gray-700 hover:bg-red-600 rounded-lg text-sm active:scale-95 transition-transform"
              title="Borrar pronóstico"
            >
              🗑
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente celda de pronóstico
function PronosticoCell({ jugador, partido, pronostico, onSave, onDelete, resultado, adminMode, editable }) {
  const [editing, setEditing] = useState(false);
  const [gL, setGL] = useState('');
  const [gV, setGV] = useState('');

  const bloqueado = !editable || partido.definido === false || ((partidoEmpezado(partido) || !!resultado) && !adminMode);

  const startEdit = () => {
    if (bloqueado) return;
    setGL(pronostico?.golesLocal ?? '');
    setGV(pronostico?.golesVisitante ?? '');
    setEditing(true);
  };

  const save = async () => {
    if (gL === '' || gV === '') return;
    if (partido.esEliminatoria && parseInt(gL) === parseInt(gV)) {
      alert('⚔️ En eliminatorias no puede haber empate: pon un ganador (los penaltis deciden).');
      return;
    }
    setEditing(false);
    await onSave(jugador, partido.id, parseInt(gL), parseInt(gV));
  };

  const borrar = async () => {
    if (!confirm(`¿Borrar el pronóstico de ${jugador} para este partido?`)) return;
    setEditing(false);
    await onDelete(jugador, partido.id);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-0.5">
        <input
          type="number" inputMode="numeric" min="0" max="20" value={gL} onChange={e => setGL(e.target.value)}
          className="w-8 h-8 text-center bg-gray-800 text-white rounded text-sm p-0.5 border border-yellow-400"
          autoFocus
        />
        <span className="text-xs">-</span>
        <input
          type="number" inputMode="numeric" min="0" max="20" value={gV} onChange={e => setGV(e.target.value)}
          className="w-8 h-8 text-center bg-gray-800 text-white rounded text-sm p-0.5 border border-yellow-400"
          onKeyDown={e => e.key === 'Enter' && save()}
        />
        <button onClick={save} className="text-sm text-green-400 hover:text-green-300 ml-0.5 px-0.5">✓</button>
        {pronostico && (
          <button onClick={borrar} className="text-sm hover:opacity-80 px-0.5" title="Borrar pronóstico">🗑</button>
        )}
        <button onClick={() => setEditing(false)} className="text-sm text-red-400 hover:text-red-300 px-0.5">✕</button>
      </div>
    );
  }

  const titulo = !editable
    ? `Pronóstico de ${jugador} (solo ${jugador} puede modificarlo)`
    : bloqueado
      ? '⏰ Partido ya empezado — no se puede modificar'
      : `Pronóstico de ${jugador} — toca para editar`;

  return (
    <button
      onClick={startEdit}
      disabled={bloqueado}
      className={`font-mono text-xs w-full py-2 rounded transition-all ${
        bloqueado ? 'cursor-not-allowed opacity-60' : 'hover:bg-white/10 cursor-pointer'
      }`}
      title={titulo}
    >
      {pronostico !== undefined
        ? `${pronostico.golesLocal}-${pronostico.golesVisitante}`
        : <span className={bloqueado ? 'text-gray-600' : 'text-gray-500'}>-</span>
      }
    </button>
  );
}

// Componente editor de resultado (modal)
function ResultadoEditor({ partido, resultadoActual, onSave, onDelete, onClose }) {
  const [gL, setGL] = useState(resultadoActual?.golesLocal ?? '');
  const [gV, setGV] = useState(resultadoActual?.golesVisitante ?? '');
  const [ganadorPen, setGanadorPen] = useState(resultadoActual?.ganadorPenales ?? null);

  const esEmpate = gL !== '' && gV !== '' && parseInt(gL) === parseInt(gV);
  const necesitaPenales = partido.esEliminatoria && esEmpate;
  const puedeGuardar = gL !== '' && gV !== '' && (!necesitaPenales || ganadorPen);

  const guardar = () => {
    if (!puedeGuardar) return;
    onSave(partido.id, parseInt(gL), parseInt(gV), necesitaPenales ? ganadorPen : null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-yellow-400 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-1">Resultado</h3>
        <p className="text-sm text-gray-400 mb-4">{partido.flagLocal} {partido.local} vs {partido.visitante} {partido.flagVisitante}</p>
        <div className="flex items-center gap-4 justify-center mb-4">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">{partido.local}</p>
            <input
              type="number" inputMode="numeric" min="0" max="20" value={gL} onChange={e => setGL(e.target.value)}
              className="w-16 text-center bg-gray-800 border border-gray-600 rounded-lg p-2 text-xl font-bold focus:outline-none focus:border-yellow-400"
              autoFocus
            />
          </div>
          <span className="text-2xl font-black text-gray-400">-</span>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">{partido.visitante}</p>
            <input
              type="number" inputMode="numeric" min="0" max="20" value={gV} onChange={e => setGV(e.target.value)}
              className="w-16 text-center bg-gray-800 border border-gray-600 rounded-lg p-2 text-xl font-bold focus:outline-none focus:border-yellow-400"
              onKeyDown={e => e.key === 'Enter' && guardar()}
            />
          </div>
        </div>
        {/* Empate en eliminatoria: hay que indicar quién ganó los penaltis */}
        {necesitaPenales && (
          <div className="mb-4">
            <p className="text-xs text-yellow-400 font-semibold mb-2">🥅 Empate: ¿quién ganó en los penaltis?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setGanadorPen('local')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                  ganadorPen === 'local' ? 'bg-yellow-400 text-gray-900 border-yellow-400' : 'bg-gray-800 border-gray-600 hover:border-yellow-400'
                }`}
              >
                {partido.flagLocal} {partido.local}
              </button>
              <button
                onClick={() => setGanadorPen('visitante')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                  ganadorPen === 'visitante' ? 'bg-yellow-400 text-gray-900 border-yellow-400' : 'bg-gray-800 border-gray-600 hover:border-yellow-400'
                }`}
              >
                {partido.flagVisitante} {partido.visitante}
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={guardar}
            disabled={!puedeGuardar}
            className="flex-1 py-2 bg-yellow-400 text-gray-900 font-bold rounded-lg disabled:opacity-50"
          >
            Guardar
          </button>
          <button onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded-lg">Cancelar</button>
        </div>
        {resultadoActual && (
          <button
            onClick={() => confirm('¿Borrar el resultado manual de este partido?') && onDelete(partido.id)}
            className="w-full mt-2 py-2 bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-300 rounded-lg text-sm font-semibold"
          >
            🗑 Borrar resultado
          </button>
        )}
      </div>
    </div>
  );
}
