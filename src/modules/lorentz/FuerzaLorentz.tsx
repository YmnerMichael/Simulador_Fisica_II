import { useCallback, useEffect, useRef, useState } from 'react';
import ModuloLayout from '../../components/ModuloLayout';
import Formula from '../../components/Formula';
import PanelFormulas from '../../components/PanelFormulas';
import Slider from '../../components/Slider';
import { Interruptor, Selector } from '../../components/controles';
import { formatearPrefijo, formatearSI } from '../../components/formato';
import { CARGA_ELEMENTAL } from '../../physics/constants';
import { periodoCiclotron, radioCiclotron } from '../../physics/magnetism';
import { CASOS, PARTICULAS, UMA, crearEscenario, type Controles, type IdCaso, type IdParticula } from './casos';
import EscenaLorentz from './EscenaLorentz';
import { SimulacionLorentz } from './simulacion';

const INICIALES: Record<IdCaso, Partial<Controles>> = {
  circular: { B: 0.1, v0: 1e6 },
  helicoidal: { B: 0.1, v0: 1e6, angulo: 60 },
  deriva: { B: 0.1, E: 2e4 },
  selector: { B: 0.1, E: 2e4 },
  espectrometro: { B: 0.1, v0: 1e5 },
};

interface Fila {
  nombre: string;
  teorico: number;
  simulado: number | null;
  unidad: string;
}

/** Tabla teórico vs simulado con error porcentual. */
function TablaComparacion({ filas }: { filas: Fila[] }) {
  return (
    <div className="tarjeta overflow-x-auto">
      <h3 className="mb-2 text-sm font-semibold text-slate-300">Teoría vs simulación (Boris)</h3>
      <table className="w-full text-right font-mono text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="text-left font-normal"></th>
            <th className="font-normal">Teórico</th>
            <th className="font-normal">Simulado</th>
            <th className="font-normal">Error</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const err = f.simulado === null ? null : (100 * Math.abs(f.simulado - f.teorico)) / Math.abs(f.teorico);
            return (
              <tr key={f.nombre}>
                <td className="text-left">{f.nombre}</td>
                <td>{formatearPrefijo(f.teorico, f.unidad)}</td>
                <td>{f.simulado === null ? '…' : formatearPrefijo(f.simulado, f.unidad)}</td>
                <td className={err === null ? '' : err < 1 ? 'text-emerald-300' : 'text-amber-300'}>{err === null ? '' : `${formatearSI(err, 2)} %`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Módulo 9 — Fuerza de Lorentz con el integrador de Boris. */
export default function FuerzaLorentz() {
  const [c, setC] = useState<Controles>({ caso: 'circular', particula: 'proton', B: 0.1, E: 2e4, v0: 1e6, angulo: 60 });
  const [conEuler, setConEuler] = useState(false);
  const [corriendo, setCorriendo] = useState(true);
  const [velocidad, setVelocidad] = useState(2);
  const [idSim, setIdSim] = useState(0);
  const [, setVersion] = useState(0);

  // La comparación con Euler solo se ofrece en los casos circular y helicoidal
  const usarEuler = conEuler && (c.caso === 'circular' || c.caso === 'helicoidal');
  const sim = useRef<SimulacionLorentz>(null!);
  if (sim.current === null) sim.current = new SimulacionLorentz(crearEscenario(c), usarEuler);
  // Cualquier cambio de parámetros crea una simulación nueva
  const reiniciar = useCallback(() => {
    sim.current = new SimulacionLorentz(crearEscenario(c), usarEuler);
    setIdSim((n) => n + 1);
    setCorriendo(true);
  }, [c, usarEuler]);
  useEffect(reiniciar, [reiniciar]);
  const onTick = useCallback(() => setVersion((n) => n + 1), []);

  const cambiar = (cambios: Partial<Controles>) => setC((x) => ({ ...x, ...cambios }));
  const elegirCaso = (caso: IdCaso) => setC((x) => ({ ...x, ...INICIALES[caso], caso, particula: caso === 'espectrometro' ? 'proton' : x.particula }));

  const s = sim.current;
  const p0 = s.particulas[0];
  const par = PARTICULAS[c.particula];
  const T = periodoCiclotron(par.m, par.q, c.B);
  const terminado = s.terminada;
  const angulo = c.caso === 'helicoidal' ? (c.angulo * Math.PI) / 180 : Math.PI / 2;
  const vPerp = c.v0 * Math.sin(angulo);
  const vPar = c.v0 * Math.cos(angulo);

  // Conservación de |v| (solo B): Boris vs Euler
  const vBoris = Math.hypot(p0.v.x, p0.v.y, p0.v.z);
  const vEuler = p0.euler ? Math.hypot(p0.euler.v.x, p0.euler.v.y, p0.euler.v.z) : null;

  let filas: Fila[] = [];
  let formulas: { tex: string; descripcion?: string }[] = [];
  if (c.caso === 'circular' || c.caso === 'helicoidal') {
    filas = [
      { nombre: 'r', teorico: radioCiclotron(par.m, vPerp, par.q, c.B), simulado: SimulacionLorentz.radioMedido(p0), unidad: 'm' },
      { nombre: 'T', teorico: T, simulado: p0.periodo, unidad: 's' },
    ];
    if (c.caso === 'helicoidal') filas.push({ nombre: 'paso p', teorico: vPar * T, simulado: p0.desplazamientoVuelta?.z ?? null, unidad: 'm' });
    formulas = [
      { tex: 'r=\\frac{m v_\\perp}{|q|B}', descripcion: 'Radio de giro' },
      { tex: 'T=\\frac{2\\pi m}{|q|B},\\quad f=\\frac{|q|B}{2\\pi m}', descripcion: 'Período y frecuencia de ciclotrón' },
      ...(c.caso === 'helicoidal' ? [{ tex: 'p=v_\\parallel T', descripcion: 'Paso de la hélice' }] : []),
    ];
  } else if (c.caso === 'deriva') {
    filas = [
      { nombre: 'v_d', teorico: c.E / c.B, simulado: SimulacionLorentz.derivaMedida(p0), unidad: 'm/s' },
      { nombre: 'T', teorico: T, simulado: null, unidad: 's' },
    ];
    formulas = [
      { tex: '\\vec v_d=\\frac{\\vec E\\times\\vec B}{B^2}', descripcion: 'Velocidad de deriva (independiente de q y m)' },
      { tex: 'd=\\frac{2mE}{|q|B^2}', descripcion: 'Altura de la cicloide (desde el reposo)' },
    ];
  } else if (c.caso === 'selector') {
    formulas = [
      { tex: 'qE = qvB\\;\\Rightarrow\\; v=\\frac{E}{B}', descripcion: 'Condición para no desviarse' },
      { tex: '\\vec F=q\\left(\\vec E+\\vec v\\times\\vec B\\right)', descripcion: 'Fuerza de Lorentz' },
    ];
  } else {
    formulas = [
      { tex: 'r=\\frac{mv}{qB}\\;\\Rightarrow\\; m=\\frac{qBr}{v}', descripcion: 'Masa a partir del radio medido' },
      { tex: 'x_{impacto}=2r', descripcion: 'Distancia al detector' },
    ];
  }

  return (
    <ModuloLayout
      titulo="Fuerza de Lorentz"
      explicacion={{
        circular: 'Fíjate en la trayectoria. El campo magnético va cambiando la dirección de la partícula y la hace girar en un círculo.',
        helicoidal: 'La partícula gira mientras avanza a lo largo del campo magnético. Por eso dibuja una hélice.',
        deriva: 'Mira cómo la partícula se curva y, al mismo tiempo, se desplaza de lado. Ese desplazamiento se llama deriva.',
        selector: 'Observa cuál de las partículas pasa en línea recta. A esa velocidad, la fuerza eléctrica y la magnética se equilibran.',
        espectrometro: 'Compara las curvas. Si dos iones tienen la misma carga y rapidez, el de mayor masa describe una curva más amplia.',
      }[c.caso]}
      simulacion={
        <>
          <EscenaLorentz key={c.caso} sim={sim} idSim={idSim} caso={c.caso} corriendo={corriendo} pasosPorCuadro={velocidad} hayE={c.caso === 'deriva' || c.caso === 'selector'} onTick={onTick} />
          <div className="pointer-events-none absolute left-3 top-3 max-w-[75%] space-y-1 rounded-md bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
            <p>{CASOS[c.caso].descripcion}</p>
            <p>
              <span className="text-violet-400">→ B</span>
              {(c.caso === 'deriva' || c.caso === 'selector') && <span className="text-amber-300"> &nbsp;→ E</span>}
              {usarEuler && <span className="text-red-400"> &nbsp;━ Euler</span>} &nbsp;· 1 cuadro de la grilla = {formatearPrefijo(s.esc.escala, 'm')}
            </p>
          </div>
          {terminado && <div className="absolute bottom-3 left-3 rounded-md bg-slate-900/85 px-3 py-1.5 text-sm text-amber-300">{s.particulas.map((p) => p.fin).find(Boolean)}</div>}
        </>
      }
      panel={
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(CASOS) as IdCaso[]).map((k) => (
              <button
                key={k}
                className={`rounded-md px-2 py-1.5 text-xs transition ${c.caso === k ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                onClick={() => elegirCaso(k)}
              >
                {CASOS[k].nombre}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button className="boton-primario flex-1 justify-center" disabled={terminado} onClick={() => setCorriendo(!corriendo)}>
              {corriendo && !terminado ? '❚❚ Pausa' : '▶ Play'}
            </button>
            <button className="boton flex-1 justify-center" onClick={reiniciar}>
              ↺ Reiniciar
            </button>
          </div>

          <div className="tarjeta space-y-3">
            {c.caso !== 'espectrometro' && (
              <Selector
                etiqueta="Partícula"
                valor={c.particula}
                opciones={(Object.keys(PARTICULAS) as IdParticula[]).map((k) => ({ valor: k, etiqueta: PARTICULAS[k].nombre }))}
                onChange={(particula) => cambiar({ particula })}
              />
            )}
            <Slider etiqueta="|B| (eje z)" valor={c.B} min={0.01} max={1} paso={0.01} unidad="T" onChange={(B) => cambiar({ B })} />
            {(c.caso === 'deriva' || c.caso === 'selector') && (
              <Slider etiqueta="|E| (eje y)" valor={c.E / 1000} min={1} max={200} paso={1} unidad="kV/m" onChange={(E) => cambiar({ E: E * 1000 })} />
            )}
            {c.caso !== 'deriva' && c.caso !== 'selector' && (
              <Slider etiqueta="Rapidez v₀" valor={Math.log10(c.v0)} min={4} max={7} paso={0.01} formato={(x) => formatearPrefijo(Math.pow(10, x), 'm/s')} onChange={(x) => cambiar({ v0: Number(Math.pow(10, x).toPrecision(3)) })} />
            )}
            {c.caso === 'helicoidal' && <Slider etiqueta="Ángulo entre v₀ y B" valor={c.angulo} min={10} max={90} paso={1} unidad="°" onChange={(angulo) => cambiar({ angulo })} />}
            <Slider etiqueta="Velocidad de simulación" valor={velocidad} min={1} max={20} paso={1} unidad="pasos/cuadro" onChange={setVelocidad} />
            {(c.caso === 'circular' || c.caso === 'helicoidal') && (
              <Interruptor etiqueta="Comparar con Euler explícito" activo={conEuler} onChange={setConEuler} />
            )}
          </div>

          {filas.length > 0 && <TablaComparacion filas={filas} />}

          {(c.caso === 'circular' || c.caso === 'helicoidal') && (
            <div className="tarjeta space-y-1 text-xs">
              <h3 className="text-sm font-semibold text-slate-300">Conservación de la energía cinética</h3>
              <p className="font-mono text-slate-300">
                Boris: |Δv|/v₀ = <span className="text-emerald-300">{formatearSI(Math.abs(vBoris - c.v0) / c.v0, 2)}</span>
              </p>
              {vEuler !== null && (
                <p className="font-mono text-slate-300">
                  Euler: |Δv|/v₀ = <span className="text-red-300">{formatearSI(Math.abs(vEuler - c.v0) / c.v0, 2)}</span>
                </p>
              )}
              <p className="text-slate-500">
                B no realiza trabajo, así que |v| debe ser constante. Boris aplica una rotación exacta a v; Euler hace crecer |v| en cada paso y la órbita
                se abre en espiral.
              </p>
            </div>
          )}

          {c.caso === 'selector' && (
            <div className="tarjeta overflow-x-auto text-xs">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">Velocidad seleccionada: E/B = {formatearPrefijo(c.E / c.B, 'm/s')}</h3>
              <table className="w-full text-right font-mono">
                <thead className="text-slate-400">
                  <tr>
                    <th className="text-left font-normal">Partícula</th>
                    <th className="font-normal">v</th>
                    <th className="font-normal">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {s.particulas.map((p) => (
                    <tr key={p.cfg.nombre} style={{ color: p.cfg.color }}>
                      <td className="text-left">v = {p.cfg.nombre}</td>
                      <td>{formatearPrefijo(p.cfg.v0.x, 'm/s')}</td>
                      <td>{p.fin ? (p.fin.includes('rendija') && Math.abs(p.final!.y) < 0.1 * s.esc.escala ? 'pasa ✓' : p.fin.includes('rendija') ? 'desviada' : 'choca') : '…'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {c.caso === 'espectrometro' && (
            <div className="tarjeta overflow-x-auto text-xs">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">Detector</h3>
              <table className="w-full text-right font-mono">
                <thead className="text-slate-400">
                  <tr>
                    <th className="text-left font-normal">Ion</th>
                    <th className="font-normal">r teórico</th>
                    <th className="font-normal">x impacto</th>
                    <th className="font-normal">m = qBr/v</th>
                  </tr>
                </thead>
                <tbody>
                  {s.particulas.map((p) => (
                    <tr key={p.cfg.nombre} style={{ color: p.cfg.color }}>
                      <td className="text-left">{p.cfg.nombre}</td>
                      <td>{formatearPrefijo(radioCiclotron(p.cfg.m, c.v0, CARGA_ELEMENTAL, c.B), 'm')}</td>
                      <td>{p.final ? formatearPrefijo(p.final.x, 'm') : '…'}</td>
                      <td>{p.final ? `${((CARGA_ELEMENTAL * c.B * (p.final.x / 2)) / c.v0 / UMA).toFixed(2)} u` : '…'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-slate-500">Iones ¹²C⁺, ¹³C⁺ y ¹⁴C⁺ con la misma rapidez: los más pesados describen semicírculos más grandes.</p>
            </div>
          )}

          <PanelFormulas formulas={[{ tex: '\\vec F=q\\left(\\vec E+\\vec v\\times\\vec B\\right)', descripcion: 'Fuerza de Lorentz' }, ...formulas]} />
        </>
      }
      teoria={
        <>
          <p>Una carga q que se mueve con velocidad v en campos eléctrico y magnético siente la <strong>fuerza de Lorentz</strong>:</p>
          <Formula bloque tex="\vec F=q\left(\vec E+\vec v\times\vec B\right)" />
          <p>
            La parte magnética es siempre perpendicular a v: cambia la dirección del movimiento pero no la rapidez (no realiza trabajo). Si v ⊥ B
            la partícula gira en un círculo; igualando qvB con mv²/r:
          </p>
          <Formula bloque tex="r=\frac{mv}{|q|B},\qquad T=\frac{2\pi m}{|q|B}" />
          <p>
            El período no depende de la rapidez (principio del ciclotrón). Si v tiene una componente paralela a B, el movimiento es una hélice. Con
            E ⊥ B aparece una deriva con velocidad E×B/B², igual para cualquier carga. En el <strong>selector de velocidades</strong> solo pasan
            las partículas con v = E/B, y en el <strong>espectrómetro de masas</strong> el radio revela la masa: m = qBr/v.
          </p>
          <p>
            Para integrar se usa el <strong>método de Boris</strong>: aplica medio impulso eléctrico, una rotación exacta de v debida a B y otro
            medio impulso eléctrico. Al ser una rotación exacta conserva |v| sin error acumulado, mientras que Euler hace que la órbita se abra en
            espiral (actívalo para compararlos).
          </p>
        </>
      }
    />
  );
}
