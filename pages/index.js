import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { PARTIDOS, calcularPuntos } from '../lib/datos';

const COLOR_MAP = {
  verde: 'bg-green-500 text-white',
  amarillo: 'bg-yellow-400 text-gray-900',
  rojo: 'bg-red-500 text-white',
};

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

  useEffect(() => {
    cargarDatos();
    cargarLive();
    const interval = setInterval(cargarLive, 60000); // refresh cada minuto
    return () => clearInterval(interval);
  }, [cargarDatos, cargarLive]);

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

  const guardarResultado = async (partidoId, golesLocal, golesVisitante) => {
    setResultados(prev => ({ ...prev, [partidoId]: { golesLocal, golesVisitante } }));
    try {
      await api('saveResultado', { partidoId, golesLocal, golesVisitante });
    } catch (e) {
      alert(e.message);
      cargarDatos();
    }
    setEditandoResultado(null);
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

  const getResultado = (partidoId) => {
    // Prioridad: resultado manual > live API
    if (resultados[partidoId]?.golesLocal !== undefined) return resultados[partidoId];
    if (liveData[partidoId]) return liveData[partidoId];
    return null;
  };

  const getPronostico = (jugador, partidoId) => pronosticos[`${jugador}_${partidoId}`];

  const puedeEditar = (jugador) => adminMode || user?.nombre === jugador;

  // Clasificación
  const clasificacion = jugadores.map(j => {
    let pts = 0, perfectos = 0, tendencias = 0, errores = 0, jugados = 0;
    PARTIDOS.forEach(p => {
      const res = getResultado(p.id);
      const pron = getPronostico(j, p.id);
      const calc = calcularPuntos(pron, res);
      if (calc !== null) {
        jugados++;
        pts += calc.puntos;
        if (calc.color === 'verde') perfectos++;
        else if (calc.color === 'amarillo') tendencias++;
        else errores++;
      }
    });
    return { nombre: j, pts, perfectos, tendencias, errores, jugados };
  }).sort((a, b) => b.pts - a.pts || b.perfectos - a.perfectos);

  const grupos = ['TODOS', ...new Set(PARTIDOS.map(p => p.grupo))];
  const partidosFiltrados = filtroGrupo === 'TODOS' ? PARTIDOS : PARTIDOS.filter(p => p.grupo === filtroGrupo);

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
                    {PARTIDOS.map((partido, idx) => {
                      const resultado = getResultado(partido.id);
                      const isLive = liveData[partido.id]?.estado === 'IN_PLAY' || liveData[partido.id]?.estado === 'PAUSED';
                      return (
                        <tr key={partido.id} className={`border-t border-gray-800 ${idx % 2 === 0 ? 'bg-gray-900/30' : ''}`}>
                          {/* Partido */}
                          <td className="sticky left-0 bg-gray-950 z-10 px-3 py-2 border-r border-gray-700">
                            <div className="flex items-center gap-1 whitespace-nowrap">
                              <span className="text-xs text-gray-500 w-5 text-center font-mono">{partido.grupo}</span>
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
                            const calc = resultado ? calcularPuntos(pron, resultado) : null;
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
                            <span className="text-gray-400 text-xs block">pts</span>
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
                {grupos.map(g => (
                  <button
                    key={g}
                    onClick={() => setFiltroGrupo(g)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                      filtroGrupo === g ? 'bg-yellow-400 text-gray-900' : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    {g === 'TODOS' ? 'Todos' : `Grupo ${g}`}
                  </button>
                ))}
              </div>
              {saving && <p className="text-yellow-400 text-sm animate-pulse mb-2">Guardando...</p>}

              <div className="grid gap-3 md:grid-cols-2">
                {partidosFiltrados.map(partido => {
                  const resultado = getResultado(partido.id);
                  const isLive = liveData[partido.id]?.estado === 'IN_PLAY';
                  const miPron = user && !adminMode ? getPronostico(user.nombre, partido.id) : null;
                  const bloqueado = (partidoEmpezado(partido) || !!resultado) && !adminMode;
                  return (
                    <div key={partido.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">{partido.fecha} · {partido.hora} · Grupo {partido.grupo}</span>
                        {isLive && <span className="text-xs text-red-400 animate-pulse font-bold">🔴 EN VIVO</span>}
                      </div>
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-2xl">{partido.flagLocal}</span>
                          <span className="font-semibold text-sm sm:text-base truncate">{partido.local}</span>
                        </div>
                        <div className="text-center flex-shrink-0">
                          {resultado ? (
                            <span className="text-xl font-black">{resultado.golesLocal} - {resultado.golesVisitante}</span>
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
                            const calc = resultado ? calcularPuntos(pron, resultado) : null;
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
                    <div className="flex-1">
                      <p className="font-bold capitalize text-base">
                        {j.nombre} {user?.nombre === j.nombre && <span className="text-yellow-400 text-xs">(tú)</span>}
                      </p>
                      <div className="flex gap-3 text-xs mt-1">
                        <span className="text-green-400">✅ {j.perfectos}</span>
                        <span className="text-yellow-400">🟡 {j.tendencias}</span>
                        <span className="text-red-400">❌ {j.errores}</span>
                        <span className="text-gray-400">{j.jugados} jugados</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-yellow-400">{j.pts}</span>
                      <span className="text-gray-400 text-sm"> pts</span>
                    </div>
                  </div>
                ))}
              </div>
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
    </>
  );
}

// Devuelve true si el partido ya ha empezado
function partidoEmpezado(partido) {
  const [h, m] = partido.hora.split(':').map(Number);
  const utcH = h - 2; // CEST = UTC+2
  const utcDay = utcH < 0 ? 1 : 0;
  const utcHAdj = utcH < 0 ? utcH + 24 : utcH;
  const fechaStr = `${partido.fecha}T${String(utcHAdj).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`;
  return new Date() >= new Date(fechaStr);
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
  const calc = resultado && pronostico ? calcularPuntos(pronostico, resultado) : null;

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
              onClick={() => onSave(parseInt(gL), parseInt(gV))}
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

  const bloqueado = !editable || ((partidoEmpezado(partido) || !!resultado) && !adminMode);

  const startEdit = () => {
    if (bloqueado) return;
    setGL(pronostico?.golesLocal ?? '');
    setGV(pronostico?.golesVisitante ?? '');
    setEditing(true);
  };

  const save = async () => {
    if (gL === '' || gV === '') return;
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
              onKeyDown={e => e.key === 'Enter' && gL !== '' && gV !== '' && onSave(partido.id, parseInt(gL), parseInt(gV))}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => gL !== '' && gV !== '' && onSave(partido.id, parseInt(gL), parseInt(gV))}
            disabled={gL === '' || gV === ''}
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
