import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { PARTIDOS, calcularPuntos } from '../lib/datos';

const COLOR_MAP = {
  verde: 'bg-green-500 text-white',
  amarillo: 'bg-yellow-400 text-gray-900',
  rojo: 'bg-red-500 text-white',
};

export default function Home() {
  const [jugadores, setJugadores] = useState([]);
  const [pronosticos, setPronosticos] = useState({});
  const [resultados, setResultados] = useState({});
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState('tabla'); // 'tabla' | 'partidos' | 'clasificacion'
  const [nuevoJugador, setNuevoJugador] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('TODOS');
  const [editandoResultado, setEditandoResultado] = useState(null);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [liveData, setLiveData] = useState({});
  const [saving, setSaving] = useState(false);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const data = await r.json();
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
    const data = await api('removeJugador', { nombre });
    setJugadores(data.jugadores);
  };

  const guardarPronostico = async (jugador, partidoId, golesLocal, golesVisitante) => {
    const key = `${jugador}_${partidoId}`;
    setPronosticos(prev => ({ ...prev, [key]: { golesLocal, golesVisitante } }));
    await api('savePronostico', { jugador, partidoId, golesLocal, golesVisitante });
  };

  const guardarResultado = async (partidoId, golesLocal, golesVisitante) => {
    setResultados(prev => ({ ...prev, [partidoId]: { golesLocal, golesVisitante } }));
    await api('saveResultado', { partidoId, golesLocal, golesVisitante });
    setEditandoResultado(null);
  };

  const getResultado = (partidoId) => {
    // Prioridad: resultado manual > live API
    if (resultados[partidoId]?.golesLocal !== undefined) return resultados[partidoId];
    if (liveData[partidoId]) return liveData[partidoId];
    return null;
  };

  const getPronostico = (jugador, partidoId) => pronosticos[`${jugador}_${partidoId}`];

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

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-2xl animate-pulse">⚽ Cargando porra...</div>
    </div>
  );

  return (
    <>
      <Head>
        <title>🏆 Porra Mundial 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <header className="bg-gradient-to-r from-green-900 via-gray-900 to-red-900 border-b border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-xl font-black tracking-tight">
              ⚽ <span className="text-yellow-400">PORRA</span> MUNDIAL 2026
            </h1>
            <div className="flex gap-2 flex-wrap">
              {['tabla', 'partidos', 'clasificacion'].map(v => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${
                    vista === v ? 'bg-yellow-400 text-gray-900' : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {v === 'tabla' ? '📊 Tabla' : v === 'partidos' ? '⚽ Partidos' : '🏆 Clasificación'}
                </button>
              ))}
              <button
                onClick={() => setShowAdminModal(true)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  adminMode ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {adminMode ? '🔓 Admin' : '🔒'}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-2 py-4">

          {/* ===== VISTA TABLA ===== */}
          {vista === 'tabla' && (
            <div>
              <div className="mb-4 flex items-center gap-4 flex-wrap">
                <div className="flex gap-3 text-sm">
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
                        <th key={j} className="px-2 py-2 text-center font-semibold capitalize border-r border-gray-700 last:border-r-0 whitespace-nowrap">
                          {j}
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
                                resultadoActual={resultado}
                                onSave={guardarResultado}
                                onClose={() => setEditandoResultado(null)}
                              />
                            )}
                          </td>

                          {/* Pronósticos de cada jugador */}
                          {jugadores.map(j => {
                            const pron = getPronostico(j, partido.id);
                            const calc = resultado ? calcularPuntos(pron, resultado) : null;
                            return (
                              <td key={j} className={`px-1 py-1 text-center border-r border-gray-700 last:border-r-0 ${calc ? COLOR_MAP[calc.color] : ''}`}>
                                <PronosticoCell
                                  jugador={j}
                                  partido={partido}
                                  pronostico={pron}
                                  onSave={guardarPronostico}
                                  resultado={resultado}
                                  adminMode={adminMode}
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
              <div className="flex gap-2 flex-wrap mb-4">
                {grupos.map(g => (
                  <button
                    key={g}
                    onClick={() => setFiltroGrupo(g)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      filtroGrupo === g ? 'bg-yellow-400 text-gray-900' : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    {g === 'TODOS' ? 'Todos' : `Grupo ${g}`}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {partidosFiltrados.map(partido => {
                  const resultado = getResultado(partido.id);
                  const isLive = liveData[partido.id]?.estado === 'IN_PLAY';
                  return (
                    <div key={partido.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">{partido.fecha} · {partido.hora} · Grupo {partido.grupo}</span>
                        {isLive && <span className="text-xs text-red-400 animate-pulse font-bold">🔴 EN VIVO</span>}
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{partido.flagLocal}</span>
                          <span className="font-semibold">{partido.local}</span>
                        </div>
                        <div className="text-center">
                          {resultado ? (
                            <span className="text-xl font-black">{resultado.golesLocal} - {resultado.golesVisitante}</span>
                          ) : (
                            <span className="text-gray-500">vs</span>
                          )}
                          {adminMode && (
                            <button
                              onClick={() => setEditandoResultado(partido.id)}
                              className="block text-xs text-yellow-400 hover:text-yellow-300 mt-1"
                            >
                              {resultado ? 'Editar' : '+ Resultado'}
                            </button>
                          )}
                          {editandoResultado === partido.id && (
                            <ResultadoEditor
                              partido={partido}
                              resultadoActual={resultado}
                              onSave={guardarResultado}
                              onClose={() => setEditandoResultado(null)}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{partido.visitante}</span>
                          <span className="text-2xl">{partido.flagVisitante}</span>
                        </div>
                      </div>

                      {/* Pronósticos en vista partidos */}
                      <div className="border-t border-gray-800 pt-2 mt-2">
                        <p className="text-xs text-gray-500 mb-2">Pronósticos:</p>
                        <div className="flex flex-wrap gap-2">
                          {jugadores.map(j => {
                            const pron = getPronostico(j, partido.id);
                            const calc = resultado ? calcularPuntos(pron, resultado) : null;
                            const bgClass = calc ? COLOR_MAP[calc.color] : 'bg-gray-800';
                            return (
                              <div key={j} className={`rounded-lg px-2 py-1 text-xs ${bgClass}`}>
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
                    }`}
                  >
                    <span className="text-2xl font-black w-8 text-center">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold capitalize text-base">{j.nombre}</p>
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
      </div>

      {/* Modal Admin */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">{adminMode ? '🔓 Modo admin activo' : '🔒 Acceso admin'}</h3>
            {!adminMode ? (
              <>
                <input
                  type="password"
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (adminPass === (process.env.NEXT_PUBLIC_ADMIN_PASS || 'mundial2026')) {
                        setAdminMode(true);
                        setShowAdminModal(false);
                        setAdminPass('');
                      } else {
                        alert('Contraseña incorrecta');
                      }
                    }
                  }}
                  placeholder="Contraseña..."
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-yellow-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (adminPass === (process.env.NEXT_PUBLIC_ADMIN_PASS || 'mundial2026')) {
                        setAdminMode(true);
                        setShowAdminModal(false);
                        setAdminPass('');
                      } else alert('Contraseña incorrecta');
                    }}
                    className="flex-1 py-2 bg-yellow-400 text-gray-900 font-bold rounded-lg"
                  >
                    Entrar
                  </button>
                  <button onClick={() => setShowAdminModal(false)} className="flex-1 py-2 bg-gray-700 rounded-lg">
                    Cancelar
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Contraseña por defecto: <code>mundial2026</code></p>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => { setAdminMode(false); setShowAdminModal(false); }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold"
                >
                  Desactivar admin
                </button>
                <button onClick={() => setShowAdminModal(false)} className="flex-1 py-2 bg-gray-700 rounded-lg">
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
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

// Componente celda de pronóstico
function PronosticoCell({ jugador, partido, pronostico, onSave, resultado, adminMode }) {
  const [editing, setEditing] = useState(false);
  const [gL, setGL] = useState('');
  const [gV, setGV] = useState('');

  const bloqueado = partidoEmpezado(partido) && !adminMode;

  const startEdit = () => {
    if (bloqueado) return;
    if (resultado && !adminMode) return;
    setGL(pronostico?.golesLocal ?? '');
    setGV(pronostico?.golesVisitante ?? '');
    setEditing(true);
  };

  const save = async () => {
    if (gL === '' || gV === '') return;
    await onSave(jugador, partido.id, parseInt(gL), parseInt(gV));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-0.5">
        <input
          type="number" min="0" max="20" value={gL} onChange={e => setGL(e.target.value)}
          className="w-7 text-center bg-gray-800 text-white rounded text-xs p-0.5 border border-yellow-400"
          autoFocus
        />
        <span className="text-xs">-</span>
        <input
          type="number" min="0" max="20" value={gV} onChange={e => setGV(e.target.value)}
          className="w-7 text-center bg-gray-800 text-white rounded text-xs p-0.5 border border-yellow-400"
          onKeyDown={e => e.key === 'Enter' && save()}
        />
        <button onClick={save} className="text-xs text-green-400 hover:text-green-300 ml-0.5">✓</button>
        <button onClick={() => setEditing(false)} className="text-xs text-red-400 hover:text-red-300">✕</button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      disabled={bloqueado}
      className={`font-mono text-xs w-full py-1 rounded transition-all ${
        bloqueado ? 'cursor-not-allowed opacity-60' : 'hover:bg-white/10 cursor-pointer'
      }`}
      title={bloqueado ? '⏰ Partido ya empezado — no se puede modificar' : `Pronóstico de ${jugador}`}
    >
      {pronostico !== undefined
        ? `${pronostico.golesLocal}-${pronostico.golesVisitante}`
        : <span className={bloqueado ? 'text-gray-600' : 'text-gray-500'}>-</span>
      }
    </button>
  );
}
// Componente editor de resultado (modal)
function ResultadoEditor({ partido, resultadoActual, onSave, onClose }) {
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
              type="number" min="0" max="20" value={gL} onChange={e => setGL(e.target.value)}
              className="w-16 text-center bg-gray-800 border border-gray-600 rounded-lg p-2 text-xl font-bold focus:outline-none focus:border-yellow-400"
              autoFocus
            />
          </div>
          <span className="text-2xl font-black text-gray-400">-</span>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">{partido.visitante}</p>
            <input
              type="number" min="0" max="20" value={gV} onChange={e => setGV(e.target.value)}
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
      </div>
    </div>
  );
}
