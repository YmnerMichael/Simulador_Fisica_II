import { useEffect, useMemo, useState } from 'react';
import ModuloLayout from '../../components/ModuloLayout';
import Formula from '../../components/Formula';
import PanelFormulas from '../../components/PanelFormulas';
import Slider from '../../components/Slider';
import { EntradaNumero, Interruptor } from '../../components/controles';
import { formatearPrefijo, formatearSI } from '../../components/formato';
import { useCircuitoStore, type Herramienta } from '../../store/useCircuitoStore';
import EditorCircuito from './EditorCircuito';
import { nombreNodo, textoValor } from './dibujoCircuito';
import { PRESETS_CIRCUITO, analizar, type NombrePresetCircuito, type TipoComponente } from './modelo';

const HERRAMIENTAS: { valor: Herramienta; etiqueta: string; icono: string }[] = [
  { valor: 'seleccionar', etiqueta: 'Seleccionar', icono: '↖' },
  { valor: 'cable', etiqueta: 'Cable', icono: '╱' },
  { valor: 'fuente', etiqueta: 'Fuente DC', icono: '⊣|' },
  { valor: 'resistencia', etiqueta: 'Resistencia', icono: '⏛' },
  { valor: 'capacitor', etiqueta: 'Capacitor', icono: '⊣⊢' },
  { valor: 'interruptor', etiqueta: 'Interruptor', icono: '⌿' },
  { valor: 'borrar', etiqueta: 'Borrar', icono: '✕' },
];

const UNIDAD: Record<TipoComponente, string> = { fuente: 'V', resistencia: 'Ω', capacitor: 'μF', interruptor: '' };
const RANGO: Record<TipoComponente, [number, number]> = { fuente: [0, 1000], resistencia: [0.001, 1e9], capacitor: [1e-6, 1e6], interruptor: [0, 0] };

/** Módulo 6 — Simulador de circuitos de corriente continua (MNA). */
export default function SimuladorCircuitos() {
  const { circuito, seleccion, herramienta, setHerramienta, rotarSeleccion, cambiarValor, alternarInterruptor, eliminar, cargarPreset, limpiar } =
    useCircuitoStore();
  const [mostrarValores, setMostrarValores] = useState(true);
  const [animar, setAnimar] = useState(true);
  const analisis = useMemo(() => analizar(circuito), [circuito]);
  const sel = circuito.componentes.find((c) => c.id === seleccion);
  const selCable = circuito.cables.find((w) => w.id === seleccion);
  const resSel = sel ? analisis.componentes.get(sel.id) : undefined;

  // Atajos: R rota, Supr/Retroceso elimina, Esc vuelve a seleccionar
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
      if (e.key === 'r' || e.key === 'R') rotarSeleccion();
      else if ((e.key === 'Delete' || e.key === 'Backspace') && seleccion) eliminar(seleccion);
      else if (e.key === 'Escape') setHerramienta('seleccionar');
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [rotarSeleccion, eliminar, seleccion, setHerramienta]);

  // Balance de potencia: lo que entregan las fuentes = lo que disipan las resistencias
  let entregada = 0;
  let disipada = 0;
  for (const c of circuito.componentes) {
    const r = analisis.componentes.get(c.id);
    if (!r) continue;
    if (c.tipo === 'fuente') entregada -= r.potencia;
    if (c.tipo === 'resistencia') disipada += r.potencia;
  }
  const maxKCL = analisis.kcl.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
  const nodosUsados = [...new Set(analisis.nodoDe.values())].sort((a, b) => a - b);

  return (
    <ModuloLayout
      titulo="Simulador de circuitos"
      explicacion={'Selecciona una resistencia para ver su voltaje, corriente y potencia. Prueba abrir un interruptor y observa qué ramas dejan de conducir.'}
      simulacion={
        <>
          <EditorCircuito analisis={analisis} mostrarValores={mostrarValores} animar={animar} />
          <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-300">
            {herramienta === 'cable'
              ? 'Arrastra de un punto a otro para dibujar un cable'
              : herramienta === 'seleccionar'
                ? 'Clic para seleccionar · arrastra para mover · R rota · Supr elimina · doble clic abre/cierra un interruptor'
                : herramienta === 'borrar'
                  ? 'Clic sobre un elemento para borrarlo'
                  : 'Clic en un punto de la grilla para colocar el componente'}
          </div>
          {analisis.error && (
            <div className="absolute bottom-3 left-3 right-3 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-300">{analisis.error}</div>
          )}
        </>
      }
      panel={
        <>
          <div className="tarjeta space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Herramientas</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {HERRAMIENTAS.map((h) => (
                <button
                  key={h.valor}
                  title={h.etiqueta}
                  className={`flex flex-col items-center rounded-md px-1 py-1.5 text-xs transition ${
                    herramienta === h.valor ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  onClick={() => setHerramienta(h.valor)}
                >
                  <span className="text-base leading-none">{h.icono}</span>
                  <span className="mt-1">{h.etiqueta}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="boton flex-1 justify-center" disabled={!sel} onClick={rotarSeleccion}>
                ⟳ Rotar
              </button>
              <button className="boton flex-1 justify-center" disabled={!seleccion} onClick={() => seleccion && eliminar(seleccion)}>
                Eliminar
              </button>
              <button className="boton flex-1 justify-center" onClick={limpiar}>
                Limpiar
              </button>
            </div>
          </div>

          <div className="tarjeta space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Circuitos de ejemplo</h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PRESETS_CIRCUITO) as NombrePresetCircuito[]).map((p) => (
                <button key={p} className="boton justify-center" onClick={() => cargarPreset(p)}>
                  {PRESETS_CIRCUITO[p].nombre}
                </button>
              ))}
            </div>
            <div className="flex gap-4 pt-1">
              <Interruptor etiqueta="Mostrar I y V" activo={mostrarValores} onChange={setMostrarValores} />
              <Interruptor etiqueta="Animar corriente" activo={animar} onChange={setAnimar} />
            </div>
          </div>

          {sel && (
            <div className="tarjeta space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">
                {sel.nombre} · <span className="font-normal text-slate-400">{textoValor(sel)}</span>
              </h3>
              {sel.tipo === 'interruptor' ? (
                <button className="boton-primario w-full justify-center" onClick={() => alternarInterruptor(sel.id)}>
                  {sel.cerrado ? 'Abrir interruptor' : 'Cerrar interruptor'}
                </button>
              ) : (
                <>
                  <EntradaNumero
                    etiqueta="Valor"
                    valor={sel.valor}
                    unidad={UNIDAD[sel.tipo]}
                    min={RANGO[sel.tipo][0]}
                    max={RANGO[sel.tipo][1]}
                    onChange={(v) => cambiarValor(sel.id, v)}
                  />
                  {sel.tipo === 'resistencia' && (
                    <Slider
                      etiqueta="Ajuste rápido"
                      valor={Math.log10(sel.valor)}
                      min={0}
                      max={6}
                      paso={0.01}
                      formato={(x) => formatearPrefijo(Math.pow(10, x), 'Ω')}
                      onChange={(x) => cambiarValor(sel.id, Number(Math.pow(10, x).toPrecision(3)))}
                    />
                  )}
                  {sel.tipo === 'fuente' && (
                    <Slider etiqueta="Ajuste rápido" valor={sel.valor} min={0} max={48} paso={0.5} unidad="V" onChange={(v) => cambiarValor(sel.id, v)} />
                  )}
                </>
              )}
              {resSel && analisis.ok && (
                <dl className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                  <div className="rounded bg-slate-800 p-1.5">
                    <dt className="text-slate-400">I</dt>
                    <dd>{formatearPrefijo(Math.abs(resSel.corriente), 'A')}</dd>
                  </div>
                  <div className="rounded bg-slate-800 p-1.5">
                    <dt className="text-slate-400">V</dt>
                    <dd>{formatearPrefijo(Math.abs(resSel.voltaje), 'V')}</dd>
                  </div>
                  <div className="rounded bg-slate-800 p-1.5">
                    <dt className="text-slate-400">{sel.tipo === 'capacitor' ? 'Q' : 'P'}</dt>
                    <dd>{sel.tipo === 'capacitor' ? formatearPrefijo(resSel.carga ?? 0, 'C') : formatearPrefijo(Math.abs(resSel.potencia), 'W')}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}
          {selCable && (
            <div className="tarjeta text-sm text-slate-300">
              Tramo de cable · I = <span className="font-mono">{formatearPrefijo(Math.abs(analisis.cables.get(selCable.id) ?? 0), 'A')}</span>
            </div>
          )}

          {analisis.ok && analisis.ramas.length > 0 && (
            <>
              <div className="tarjeta overflow-x-auto">
                <h3 className="mb-2 text-sm font-semibold text-slate-300">Resultados (MNA)</h3>
                <table className="w-full text-right font-mono text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="text-left font-normal">Elem.</th>
                      <th className="font-normal">Valor</th>
                      <th className="font-normal">V</th>
                      <th className="font-normal">I</th>
                      <th className="font-normal">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {circuito.componentes.map((c) => {
                      const r = analisis.componentes.get(c.id);
                      return (
                        <tr key={c.id} className={c.id === seleccion ? 'text-sky-300' : ''}>
                          <td className="text-left">{c.nombre}</td>
                          <td>{textoValor(c)}</td>
                          <td>{r ? formatearPrefijo(Math.abs(r.voltaje), 'V') : '—'}</td>
                          <td>{r ? formatearPrefijo(Math.abs(r.corriente), 'A') : '—'}</td>
                          <td>{r && c.tipo !== 'capacitor' && c.tipo !== 'interruptor' ? formatearPrefijo(Math.abs(r.potencia), 'W') : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="tarjeta space-y-2 text-xs">
                <h3 className="text-sm font-semibold text-slate-300">Verificación de Kirchhoff</h3>
                <p className="text-slate-400">
                  <strong className="text-slate-200">Nodos (KCL):</strong> ΣI que sale de cada nodo = 0. Máximo residuo:{' '}
                  <span className={`font-mono ${maxKCL < 1e-9 ? 'text-emerald-300' : 'text-amber-300'}`}>{formatearSI(maxKCL, 2)} A</span>
                </p>
                <div className="flex flex-wrap gap-1 font-mono">
                  {nodosUsados.map((n) => (
                    <span key={n} className="rounded bg-slate-800 px-1.5 py-0.5">
                      {nombreNodo(n)}: {formatearPrefijo(analisis.voltajes[n], 'V')}
                      {n === analisis.tierra ? ' ⏚' : ''}
                    </span>
                  ))}
                </div>
                <p className="pt-1 text-slate-400">
                  <strong className="text-slate-200">Mallas (KVL):</strong> ΣV a lo largo de cada malla independiente = 0
                </p>
                <ul className="space-y-0.5 font-mono">
                  {analisis.mallas.map((m, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate text-slate-300">{m.ramas.map((r) => r.id).join(' → ')}</span>
                      <span className={Math.abs(m.suma) < 1e-6 ? 'text-emerald-300' : 'text-amber-300'}>ΣV = {formatearSI(m.suma, 2)} V</span>
                    </li>
                  ))}
                  {analisis.mallas.length === 0 && <li className="text-slate-500">No hay mallas cerradas.</li>}
                </ul>
                <p className="pt-1 text-slate-400">
                  <strong className="text-slate-200">Potencia:</strong> entregada por fuentes {formatearPrefijo(entregada, 'W')} · disipada en
                  resistencias {formatearPrefijo(disipada, 'W')}
                </p>
              </div>
            </>
          )}

          <PanelFormulas
            formulas={[
              { tex: 'V = IR,\\qquad P = VI = I^2R', descripcion: 'Ley de Ohm y potencia' },
              { tex: '\\sum_{\\text{nodo}} I = 0,\\qquad \\sum_{\\text{malla}} V = 0', descripcion: 'Leyes de Kirchhoff' },
              { tex: '\\begin{bmatrix} G & B \\\\ B^{T} & 0 \\end{bmatrix}\\begin{bmatrix} \\mathbf v \\\\ \\mathbf i \\end{bmatrix} = \\begin{bmatrix} \\mathbf 0 \\\\ \\boldsymbol\\varepsilon \\end{bmatrix}', descripcion: 'Análisis Nodal Modificado' },
            ]}
          />
        </>
      }
      teoria={
        <>
          <p>
            Un circuito de corriente continua se resuelve con las <strong>leyes de Kirchhoff</strong>: la suma de corrientes que salen
            de un nodo es cero (conservación de la carga) y la suma de voltajes alrededor de una malla es cero (conservación de la
            energía). Cada resistencia cumple la <strong>ley de Ohm</strong>, V = IR.
          </p>
          <p>
            El simulador usa el <strong>Análisis Nodal Modificado (MNA)</strong>, el método de programas como SPICE. Las incógnitas
            son los voltajes de nodo v y las corrientes i de las fuentes. Cada resistencia aporta su conductancia G = 1/R a la matriz
            G; cada fuente agrega una fila que impone V<sub>+</sub> − V<sub>−</sub> = ε:
          </p>
          <Formula bloque tex="\begin{bmatrix} G & B \\ B^{T} & 0 \end{bmatrix}\begin{bmatrix} \mathbf v \\ \mathbf i \end{bmatrix} = \begin{bmatrix} \mathbf 0 \\ \boldsymbol\varepsilon \end{bmatrix}" />
          <p>
            El sistema lineal se resuelve por <strong>eliminación de Gauss</strong> con pivoteo parcial. Los cables son conductores
            ideales: todos los puntos unidos por cables forman un mismo nodo. En régimen estacionario de CC un capacitor no conduce
            (circuito abierto) y almacena Q = CV.
          </p>
          <p>
            Para verificar, el panel muestra el residuo de KCL en cada nodo y la suma de voltajes en cada malla independiente
            (obtenidas de un árbol generador del circuito: hay ramas − nodos + 1 mallas).
          </p>
        </>
      }
    />
  );
}
