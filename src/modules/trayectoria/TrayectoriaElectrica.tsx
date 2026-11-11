import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ModuloLayout from '../../components/ModuloLayout';
import Formula from '../../components/Formula';
import PanelFormulas from '../../components/PanelFormulas';
import PanelResultados from '../../components/PanelResultados';
import Slider from '../../components/Slider';
import { EntradaNumero, Segmentado } from '../../components/controles';
import { formatearSI, marcasEje } from '../../components/formato';
import { aPantallaX, aPantallaY, dibujarFlecha, type Vista } from '../../components/vista2d';
import { CARGA_ELEMENTAL, MASA_ELECTRON, MASA_PROTON, VELOCIDAD_LUZ } from '../../physics/constants';
import type { Vec2 } from '../../physics/vector';
import { useCargasStore } from '../../store/useCargasStore';
import LienzoCargas from '../cargas/LienzoCargas';
import { COLOR_NEGATIVO, COLOR_POSITIVO } from '../cargas/dibujo';
import { SimulacionParticula, type FuenteCampo } from './simulacion';

type TipoParticula = 'electron' | 'proton' | 'alfa' | 'personalizada';

/** Partículas predefinidas, con una rapidez inicial adecuada para cada tipo de campo. */
const PARTICULAS: Record<Exclude<TipoParticula, 'personalizada'>, { nombre: string; q: number; m: number; v0: Record<FuenteCampo, number> }> = {
  electron: { nombre: 'Electrón', q: -CARGA_ELEMENTAL, m: MASA_ELECTRON, v0: { uniforme: 1e7, cargas: 6e7 } },
  proton: { nombre: 'Protón', q: CARGA_ELEMENTAL, m: MASA_PROTON, v0: { uniforme: 2.5e5, cargas: 4e6 } },
  alfa: { nombre: 'Partícula α', q: 2 * CARGA_ELEMENTAL, m: 6.6446573357e-27, v0: { uniforme: 1.8e5, cargas: 4e6 } },
};

const POSICION_INICIAL: Record<FuenteCampo, Vec2> = { uniforme: { x: -1, y: 0 }, cargas: { x: -1.1, y: 0.15 } };

interface PuntoEnergia {
  t: number;
  K: number;
  U: number;
  E: number;
}

/** Módulo 3 — Trayectoria de una partícula cargada en un campo eléctrico. */
export default function TrayectoriaElectrica() {
  const cargas = useCargasStore((s) => s.cargas);

  // ── Configuración ──
  const [fuente, setFuente] = useState<FuenteCampo>('uniforme');
  const [magE, setMagE] = useState(200);
  const [angE, setAngE] = useState(90);
  const [tipo, setTipo] = useState<TipoParticula>('electron');
  const [q, setQ] = useState(PARTICULAS.electron.q);
  const [m, setM] = useState(PARTICULAS.electron.m);
  const [r0, setR0] = useState<Vec2>(POSICION_INICIAL.uniforme);
  const [v0, setV0] = useState(PARTICULAS.electron.v0.uniforme);
  const [angV, setAngV] = useState(0);
  const [velocidad, setVelocidad] = useState(8);

  // ── Simulación ──
  const [corriendo, setCorriendo] = useState(false);
  // `version` cambia al reiniciar y durante la animación: sirve para redibujar el lienzo
  const [version, setVersion] = useState(0);
  const sim = useRef<SimulacionParticula | null>(null);
  const trayectoria = useRef<Vec2[]>([]);
  const historial = useRef<PuntoEnergia[]>([]);

  const campoUniforme = useMemo(
    () => ({ x: magE * Math.cos((angE * Math.PI) / 180), y: magE * Math.sin((angE * Math.PI) / 180), z: 0 }),
    [magE, angE],
  );
  const v0vec = useMemo(() => ({ x: v0 * Math.cos((angV * Math.PI) / 180), y: v0 * Math.sin((angV * Math.PI) / 180) }), [v0, angV]);

  const registrar = (s: SimulacionParticula) => {
    const e = s.energias();
    historial.current.push({ t: s.t, K: e.K, U: e.U, E: e.total });
  };

  const reiniciar = useCallback(() => {
    setCorriendo(false);
    const s = new SimulacionParticula({ q, m, r0, v0: v0vec, fuente, campoUniforme, cargas });
    sim.current = s;
    trayectoria.current = [{ ...r0 }];
    historial.current = [];
    registrar(s);
    setVersion((n) => n + 1);
  }, [q, m, r0, v0vec, fuente, campoUniforme, cargas]);

  // Cualquier cambio de configuración reinicia la simulación
  useEffect(reiniciar, [reiniciar]);

  // Bucle de animación: `velocidad` pasos de RK4 por cuadro
  useEffect(() => {
    if (!corriendo) return;
    let id = 0;
    let cuadro = 0;
    const ciclo = () => {
      const s = sim.current;
      if (!s) return;
      for (let k = 0; k < velocidad && !s.fin; k++) {
        s.paso();
        trayectoria.current.push({ x: s.s[0], y: s.s[1] });
        if (s.pasos % 4 === 0) registrar(s);
      }
      // Limita la memoria: conserva uno de cada dos puntos si el historial crece demasiado
      if (historial.current.length > 4000) historial.current = historial.current.filter((_, i) => i % 2 === 0);
      if (++cuadro % 4 === 0 || s.fin) setVersion((n) => n + 1);
      if (s.fin) {
        registrar(s);
        setCorriendo(false);
        return;
      }
      id = requestAnimationFrame(ciclo);
    };
    id = requestAnimationFrame(ciclo);
    return () => cancelAnimationFrame(id);
  }, [corriendo, velocidad]);

  const elegirParticula = (t: TipoParticula) => {
    setTipo(t);
    if (t === 'personalizada') return;
    setQ(PARTICULAS[t].q);
    setM(PARTICULAS[t].m);
    setV0(PARTICULAS[t].v0[fuente]);
  };

  const elegirFuente = (f: FuenteCampo) => {
    setFuente(f);
    setR0(POSICION_INICIAL[f]);
    setAngV(0);
    if (tipo !== 'personalizada') setV0(PARTICULAS[tipo].v0[f]);
  };

  // ── Dibujo de la trayectoria sobre el lienzo ──
  const dibujarExtra = useCallback(
    (ctx: CanvasRenderingContext2D, v: Vista) => {
      ctx.save();
      if (fuente === 'uniforme' && magE > 0) {
        // Flechas tenues del campo uniforme
        ctx.strokeStyle = ctx.fillStyle = 'rgba(251,191,36,0.25)';
        ctx.lineWidth = 1.5;
        const ux = campoUniforme.x / magE;
        const uy = -campoUniforme.y / magE;
        for (let py = 30; py < v.alto; py += 60)
          for (let px = 30; px < v.ancho; px += 60) dibujarFlecha(ctx, px - 12 * ux, py - 12 * uy, px + 12 * ux, py + 12 * uy, 6);
      }
      const tr = trayectoria.current;
      if (tr.length > 1) {
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(aPantallaX(v, tr[0].x), aPantallaY(v, tr[0].y));
        for (let i = 1; i < tr.length; i++) ctx.lineTo(aPantallaX(v, tr[i].x), aPantallaY(v, tr[i].y));
        ctx.stroke();
      }
      const s = sim.current;
      if (s) {
        const px = aPantallaX(v, s.s[0]);
        const py = aPantallaY(v, s.s[1]);
        const rap = s.rapidez();
        if (rap > 0) {
          ctx.strokeStyle = ctx.fillStyle = '#34d399';
          ctx.lineWidth = 2;
          dibujarFlecha(ctx, px, py, px + (36 * s.s[3]) / rap, py - (36 * s.s[4]) / rap, 7);
        }
        ctx.fillStyle = q >= 0 ? COLOR_POSITIVO : COLOR_NEGATIVO;
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    },
    // `version` fuerza el redibujado cuando la simulación está en pausa
    [fuente, magE, campoUniforme, q, version],
  );

  // ── Resultados ──
  const s = sim.current;
  const e = s?.energias();
  const e0 = s?.energiaInicial;
  const rapidez = s?.rapidez() ?? 0;
  const derivaEnergia = e && e0 ? Math.abs(e.total - e0.total) / Math.max(Math.abs(e0.K), Math.abs(e0.U), 1e-300) : 0;
  const analitica = s && fuente === 'uniforme' ? s.posicionAnalitica() : null;
  const errorAnalitico =
    s && analitica ? Math.hypot(s.s[0] - analitica.x, s.s[1] - analitica.y) / Math.max(Math.hypot(analitica.x - r0.x, analitica.y - r0.y), 1e-12) : 0;

  // El gráfico usa como máximo ~300 puntos
  const h = historial.current;
  const submuestreo = Math.max(1, Math.ceil(h.length / 300));
  const datosGrafico = h.filter((_, i) => i % submuestreo === 0 || i === h.length - 1);
  const tGrafico = h.length ? h[h.length - 1].t : 0;

  const relativista = Math.max(rapidez, v0) > 0.1 * VELOCIDAD_LUZ;
  const parado = !corriendo && (s?.pasos ?? 0) === 0;

  return (
    <ModuloLayout
      titulo="Trayectoria en campo eléctrico"
      explicacion={q === 0 ? 'Sin carga eléctrica, el campo no ejerce fuerza sobre la partícula.' : q > 0 ? 'La fuerza sobre esta partícula positiva apunta en la dirección del campo eléctrico local.' : 'La fuerza sobre esta partícula negativa apunta en sentido contrario al campo eléctrico local.'}
      simulacion={
        <>
          <LienzoCargas
            cargas={fuente === 'cargas' ? cargas : []}
            capas={{ lineas: fuente === 'cargas' }}
            opacidadLineas={0.35}
            editable={fuente === 'cargas' && !corriendo}
            onClicVacio={corriendo ? undefined : (p) => setR0(p)}
            dibujarExtra={dibujarExtra}
            animado={corriendo}
            etiqueta="Trayectoria de la partícula"
          />
          {s?.fin && (
            <div className="absolute left-3 top-3 rounded-md bg-slate-900/85 px-3 py-1.5 text-sm text-amber-300">{s.fin}</div>
          )}
          {parado && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-300">
              Clic en el lienzo para elegir la posición inicial
            </div>
          )}
        </>
      }
      panel={
        <>
          <div className="flex gap-2">
            <button className="boton-primario flex-1 justify-center" disabled={!!s?.fin} onClick={() => setCorriendo(!corriendo)}>
              {corriendo ? '❚❚ Pausa' : '▶ Play'}
            </button>
            <button className="boton flex-1 justify-center" onClick={reiniciar}>
              ↺ Reiniciar
            </button>
          </div>
          <Slider etiqueta="Velocidad de simulación" valor={velocidad} min={1} max={80} paso={1} unidad="pasos/cuadro" onChange={setVelocidad} />

          <div className="tarjeta space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Campo eléctrico</h3>
            <Segmentado
              opciones={[
                { valor: 'uniforme', etiqueta: 'Uniforme' },
                { valor: 'cargas', etiqueta: 'Cargas (módulo 1)' },
              ]}
              valor={fuente}
              onChange={elegirFuente}
            />
            {fuente === 'uniforme' ? (
              <>
                <Slider etiqueta="|E|" valor={magE} min={0} max={2000} paso={10} unidad="N/C" onChange={setMagE} />
                <Slider etiqueta="Dirección de E" valor={angE} min={0} max={360} paso={5} unidad="°" onChange={setAngE} />
              </>
            ) : (
              <p className="text-xs text-slate-400">
                Se usan las cargas configuradas en el módulo 1 ({cargas.length}). Con la simulación detenida puedes arrastrarlas aquí.
              </p>
            )}
          </div>

          <div className="tarjeta space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Partícula</h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PARTICULAS) as (keyof typeof PARTICULAS)[]).map((k) => (
                <button key={k} className={`boton justify-center ${tipo === k ? 'ring-2 ring-sky-500' : ''}`} onClick={() => elegirParticula(k)}>
                  {PARTICULAS[k].nombre}
                </button>
              ))}
              <button className={`boton justify-center ${tipo === 'personalizada' ? 'ring-2 ring-sky-500' : ''}`} onClick={() => elegirParticula('personalizada')}>
                Personalizada
              </button>
            </div>
            <EntradaNumero etiqueta="Carga q" valor={q} unidad="C" onChange={(v) => { setQ(v); setTipo('personalizada'); }} />
            <EntradaNumero etiqueta="Masa m" valor={m} unidad="kg" min={1e-35} onChange={(v) => { setM(v); setTipo('personalizada'); }} />
          </div>

          <div className="tarjeta space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Lanzamiento</h3>
            <Slider etiqueta="x₀" valor={Number(r0.x.toFixed(2))} min={-1.5} max={1.5} paso={0.01} unidad="m" onChange={(x) => setR0({ ...r0, x })} />
            <Slider etiqueta="y₀" valor={Number(r0.y.toFixed(2))} min={-1.2} max={1.2} paso={0.01} unidad="m" onChange={(y) => setR0({ ...r0, y })} />
            <EntradaNumero etiqueta="Rapidez v₀" valor={v0} unidad="m/s" min={0} max={VELOCIDAD_LUZ} onChange={setV0} />
            <Slider etiqueta="Ángulo de v₀" valor={angV} min={-180} max={180} paso={1} unidad="°" onChange={setAngV} />
          </div>

          {relativista && (
            <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-300">
              v &gt; 0.1c: a esta rapidez la mecánica clásica empieza a perder precisión (aquí no se incluyen efectos relativistas).
            </p>
          )}

          <PanelResultados
            resultados={[
              { simbolo: 't', valor: s?.t ?? 0, unidad: 's' },
              { simbolo: '|\\vec v|', valor: rapidez, unidad: 'm/s' },
              { simbolo: 'K', valor: e?.K ?? 0, unidad: 'J' },
              { simbolo: 'U = qV', valor: e?.U ?? 0, unidad: 'J' },
              { simbolo: 'E = K + U', valor: e?.total ?? 0, unidad: 'J' },
              { simbolo: '|\\Delta E|/E_0', valor: derivaEnergia, unidad: '' },
            ]}
          />
          {analitica && (s?.pasos ?? 0) > 0 && (
            <div className="tarjeta space-y-1 font-mono text-xs text-slate-300">
              <p className="font-sans text-sm font-semibold text-slate-300">Comparación con la parábola analítica</p>
              <p>
                simulado: ({s!.s[0].toFixed(4)}, {s!.s[1].toFixed(4)}) m
              </p>
              <p>
                analítico: ({analitica.x.toFixed(4)}, {analitica.y.toFixed(4)}) m
              </p>
              <p className={errorAnalitico < 0.01 ? 'text-emerald-300' : 'text-amber-300'}>error relativo: {formatearSI(errorAnalitico * 100, 3)} %</p>
            </div>
          )}

          <div className="tarjeta">
            <h3 className="mb-2 text-sm font-semibold text-slate-300">Energía vs tiempo</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosGrafico} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke="#1e293b" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={[0, tGrafico]}
                    ticks={marcasEje(tGrafico)}
                    tickFormatter={(v: number) => formatearSI(v, 2)}
                    stroke="#64748b"
                    fontSize={10}
                  />
                  <YAxis tickFormatter={(v: number) => formatearSI(v, 2)} stroke="#64748b" fontSize={10} width={70} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }}
                    formatter={(v: number) => `${formatearSI(v)} J`}
                    labelFormatter={(t: number) => `t = ${formatearSI(t)} s`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="K" name="K (cinética)" stroke="#34d399" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="U" name="U (potencial)" stroke="#60a5fa" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="E" name="E total" stroke="#fbbf24" dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-slate-500">La energía total debe mantenerse constante: el campo electrostático es conservativo.</p>
          </div>

          <PanelFormulas
            formulas={[
              { tex: 'm\\,\\frac{d\\vec v}{dt}=q\\,\\vec E(\\vec r)', descripcion: '2.ª ley de Newton' },
              { tex: '\\vec r(t)=\\vec r_0+\\vec v_0 t+\\tfrac12\\frac{q\\vec E}{m}t^2', descripcion: 'Solución en campo uniforme' },
              { tex: 'K+qV=\\text{constante}', descripcion: 'Conservación de la energía' },
            ]}
          />
        </>
      }
      teoria={
        <>
          <p>
            Una partícula de carga q y masa m en un campo eléctrico experimenta la fuerza F = qE. Por la segunda ley de Newton su
            aceleración es a = qE/m: las partículas positivas se aceleran en el sentido de E y las negativas en sentido contrario.
          </p>
          <p>
            En un <strong>campo uniforme</strong> la aceleración es constante y el movimiento es análogo al tiro parabólico:
          </p>
          <Formula bloque tex="\vec r(t)=\vec r_0+\vec v_0\,t+\frac{1}{2}\frac{q\vec E}{m}\,t^{2}" />
          <p>
            Con <strong>cargas puntuales</strong> el campo depende de la posición y no hay solución cerrada general, por lo que se
            integra numéricamente el sistema dr/dt = v, dv/dt = qE(r)/m con el método de <strong>Runge–Kutta de orden 4</strong>.
            El paso Δt se adapta para que la partícula no avance más de 3 mm por paso: Δt = min(L/|v|, √(2L/|a|)).
          </p>
          <p>Como la fuerza eléctrica es conservativa, la energía mecánica se conserva y sirve para verificar la precisión numérica:</p>
          <Formula bloque tex="E=\tfrac12 m v^2+qV(\vec r)=\text{constante}" />
        </>
      }
    />
  );
}
