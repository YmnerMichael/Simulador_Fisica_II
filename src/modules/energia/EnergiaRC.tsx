import { useCallback, useEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ModuloLayout from '../../components/ModuloLayout';
import Canvas2D from '../../components/Canvas2D';
import Formula from '../../components/Formula';
import PanelFormulas from '../../components/PanelFormulas';
import PanelResultados from '../../components/PanelResultados';
import Slider from '../../components/Slider';
import { Segmentado, Selector } from '../../components/controles';
import { formatearPrefijo, formatearSI, formatearTex, marcasEje } from '../../components/formato';
import { EPSILON_0 } from '../../physics/constants';
import { DIELECTRICOS, balanceTramoRC, densidadEnergia, energiaCV, energiaQC, energiaQV, respuestaRC } from '../../physics/capacitor';
import { dibujarCircuitoRC, geometriaRC } from './circuitoRC';

interface Tramo {
  t0: number;
  Q0: number;
  cargando: boolean;
  /** Energía acumulada antes de este tramo */
  bateria0: number;
  resistencia0: number;
}

interface Muestra {
  t: number;
  Q: number;
  I: number;
  Vc: number;
  Vr: number;
}

/** Duración visual de 5τ a velocidad 1× [s reales] */
const SEGUNDOS_POR_5TAU = 8;

/** Módulo 5 — Energía almacenada y circuito RC. */
export default function EnergiaRC() {
  const [expR, setExpR] = useState(3); // R = 10^exp Ω
  const [expC, setExpC] = useState(-3); // C = 10^exp F
  const [V, setV] = useState(12);
  const [velocidad, setVelocidad] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [corriendo, setCorriendo] = useState(false);
  // `version` cambia al reiniciar, conmutar y durante la animación: sirve para redibujar el lienzo
  const [version, setVersion] = useState(0);

  // Densidad de energía
  const [dmm, setDmm] = useState(0.1);
  const [idDiel, setIdDiel] = useState('papel');

  const R = Math.pow(10, expR);
  const C = Math.pow(10, expC);
  const tau = R * C;

  const t = useRef(0);
  const tramo = useRef<Tramo>({ t0: 0, Q0: 0, cargando: true, bateria0: 0, resistencia0: 0 });
  const historial = useRef<Muestra[]>([]);
  const fase = useRef(0);

  const estado = (tt = t.current) => {
    const tr = tramo.current;
    return respuestaRC(tt - tr.t0, R, C, V, tr.Q0, tr.cargando);
  };

  const reiniciar = useCallback(() => {
    setCorriendo(false);
    t.current = 0;
    // Al reiniciar en modo descarga el capacitor parte completamente cargado
    tramo.current = { t0: 0, Q0: cargando ? 0 : C * V, cargando, bateria0: 0, resistencia0: 0 };
    const s = respuestaRC(0, R, C, V, tramo.current.Q0, cargando);
    historial.current = [{ t: 0, ...s }];
    setVersion((n) => n + 1);
    // Solo los parámetros del circuito reinician (`cargando` se omite a propósito):
    // mover el interruptor abre un tramo nuevo en lugar de reiniciar
  }, [R, C, V]);
  useEffect(reiniciar, [reiniciar]);

  /** Mover el interruptor: empieza un tramo nuevo desde la carga actual, conservando el balance de energía. */
  const conmutar = (nuevo: boolean) => {
    if (nuevo === tramo.current.cargando) return;
    const tr = tramo.current;
    const Q = estado().Q;
    const b = balanceTramoRC(tr.Q0, Q, C, V, tr.cargando);
    tramo.current = { t0: t.current, Q0: Q, cargando: nuevo, bateria0: tr.bateria0 + b.bateria, resistencia0: tr.resistencia0 + b.resistencia };
    setCargando(nuevo);
    setCorriendo(true);
  };

  // Bucle de animación: el tiempo simulado avanza 5τ cada SEGUNDOS_POR_5TAU segundos reales (× velocidad)
  useEffect(() => {
    if (!corriendo) return;
    let id = 0;
    let previo = performance.now();
    let cuadro = 0;
    const ciclo = (ahora: number) => {
      const dtReal = Math.min(0.05, (ahora - previo) / 1000);
      previo = ahora;
      t.current += (dtReal * velocidad * 5 * tau) / SEGUNDOS_POR_5TAU;
      const s = estado();
      historial.current.push({ t: t.current, ...s });
      if (historial.current.length > 3000) historial.current = historial.current.filter((_, i) => i % 2 === 0);
      if (++cuadro % 3 === 0) setVersion((n) => n + 1);
      // Pausa automática al llegar al régimen estacionario (7τ ≈ 99.9 %)
      if (t.current - tramo.current.t0 > 7 * tau) {
        setCorriendo(false);
        setVersion((n) => n + 1);
        return;
      }
      id = requestAnimationFrame(ciclo);
    };
    id = requestAnimationFrame(ciclo);
    return () => cancelAnimationFrame(id);
    // `estado` lee refs; depende de R, C y V, cuyo cambio reinicia y detiene la simulación
  }, [corriendo, velocidad, tau]);

  const s = estado();
  const tr = tramo.current;
  const b = balanceTramoRC(tr.Q0, s.Q, C, V, tr.cargando);
  const energia = { bateria: tr.bateria0 + b.bateria, capacitor: b.capacitor, resistencia: tr.resistencia0 + b.resistencia };
  const I0 = V / R;

  const dibujar = useCallback(
    (ctx: CanvasRenderingContext2D, ancho: number, alto: number) => {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, ancho, alto);
      const g = geometriaRC(ancho, alto);
      const e = estado();
      if (corriendo) fase.current += (e.I / I0) * 2.2 * g.escala;
      dibujarCircuitoRC(ctx, g, {
        cargando: tramo.current.cargando,
        nivel: Math.max(0, Math.min(1, e.Q / (C * V))),
        corrienteRel: e.I / I0,
        fase: fase.current,
        etiquetas: {
          bateria: `ε = ${formatearPrefijo(V, 'V')}`,
          resistencia: `R = ${formatearPrefijo(R, 'Ω')}`,
          capacitor: `C = ${formatearPrefijo(C, 'F')}`,
          corriente: `I = ${formatearPrefijo(Math.abs(e.I), 'A')}`,
          vr: `V_R = ${formatearPrefijo(Math.abs(e.Vr), 'V')}`,
          vc: `V_C = ${formatearPrefijo(e.Vc, 'V')}`,
        },
      });
    },
    // El estado del circuito se lee de refs en cada cuadro (el lienzo es animado)
    [R, C, V, corriendo, I0, version],
  );

  // Densidad de energía para un capacitor de placas equivalente con el mismo C
  const diel = DIELECTRICOS.find((x) => x.id === idDiel)!;
  const d = dmm / 1000;
  const Ecampo = s.Vc / d;
  const u = densidadEnergia(Ecampo, diel.kappa);
  const areaNecesaria = (C * d) / (diel.kappa * EPSILON_0);

  const h = historial.current;
  const sub = Math.max(1, Math.ceil(h.length / 300));
  const datos = h.filter((_, i) => i % sub === 0 || i === h.length - 1);
  // El eje de tiempo abarca al menos 5τ para ver la curva completa desde el inicio
  const tMax = Math.max(t.current, 5 * tau);
  const maxEnergia = Math.max(energia.bateria, energia.capacitor, energia.resistencia, 1e-30);

  const grafico = (titulo: string, lineas: { clave: keyof Muestra; nombre: string; color: string }[], unidad: string) => (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
      <p className="mb-1 text-xs font-semibold text-slate-300">{titulo}</p>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, tMax]}
              ticks={marcasEje(tMax)}
              tickFormatter={(v: number) => formatearSI(v, 2)}
              stroke="#64748b"
              fontSize={10}
            />
            <YAxis tickFormatter={(v: number) => formatearSI(v, 2)} stroke="#64748b" fontSize={10} width={58} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }}
              formatter={(v: number) => `${formatearSI(v)} ${unidad}`}
              labelFormatter={(x: number) => `t = ${formatearSI(x)} s`}
            />
            <ReferenceLine x={tr.t0 + tau} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'τ', fill: '#94a3b8', fontSize: 11, position: 'insideTopRight' }} />
            {lineas.map((l) => (
              <Line key={l.clave} type="monotone" dataKey={l.clave} name={l.nombre} stroke={l.color} dot={false} isAnimationActive={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <ModuloLayout
      titulo="Energía almacenada y circuito RC"
      explicacion={cargando ? 'El capacitor se carga: su voltaje se acerca al de la fuente y la corriente va disminuyendo.' : 'El capacitor se descarga por la resistencia: su voltaje va cayendo hacia cero.'}
      simulacion={
        <div className="flex h-full flex-col">
          <div className="relative min-h-[260px] flex-1">
            <Canvas2D dibujar={dibujar} animado={corriendo} etiqueta="Circuito RC con interruptor de carga y descarga" />
          </div>
          <div className="grid shrink-0 gap-2 border-t border-slate-800 p-2 md:grid-cols-3">
            {grafico('Carga Q(t) [C]', [{ clave: 'Q', nombre: 'Q', color: '#fbbf24' }], 'C')}
            {grafico('Corriente I(t) [A]', [{ clave: 'I', nombre: 'I', color: '#fde047' }], 'A')}
            {grafico('Voltajes V_C, V_R [V]', [
              { clave: 'Vc', nombre: 'V_C', color: '#60a5fa' },
              { clave: 'Vr', nombre: 'V_R', color: '#fb923c' },
            ], 'V')}
          </div>
        </div>
      }
      panel={
        <>
          <div className="flex gap-2">
            <button className="boton-primario flex-1 justify-center" onClick={() => setCorriendo(!corriendo)}>
              {corriendo ? '❚❚ Pausa' : '▶ Play'}
            </button>
            <button className="boton flex-1 justify-center" onClick={reiniciar}>
              ↺ Reiniciar
            </button>
          </div>
          <div className="tarjeta space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Interruptor</h3>
            <Segmentado
              opciones={[
                { valor: 'carga', etiqueta: 'A · Cargar' },
                { valor: 'descarga', etiqueta: 'B · Descargar' },
              ]}
              valor={cargando ? 'carga' : 'descarga'}
              onChange={(v) => conmutar(v === 'carga')}
            />
            <Slider etiqueta="Resistencia R" valor={expR} min={1} max={6} paso={0.05} formato={(x) => formatearPrefijo(Math.pow(10, x), 'Ω')} onChange={setExpR} />
            <Slider etiqueta="Capacitancia C" valor={expC} min={-6} max={-2} paso={0.05} formato={(x) => formatearPrefijo(Math.pow(10, x), 'F')} onChange={setExpC} />
            <Slider etiqueta="Fuente ε" valor={V} min={1} max={50} paso={1} unidad="V" onChange={setV} />
            <Slider etiqueta="Velocidad de animación" valor={velocidad} min={0.25} max={4} paso={0.25} unidad="×" onChange={setVelocidad} />
          </div>

          <PanelResultados
            resultados={[
              { simbolo: '\\tau = RC', valor: tau, unidad: 's' },
              { simbolo: 't', valor: t.current, unidad: 's' },
              { simbolo: '(t-t_0)/\\tau', valor: (t.current - tr.t0) / tau, unidad: '' },
              { simbolo: 'Q', valor: s.Q, unidad: 'C' },
              { simbolo: 'I', valor: s.I, unidad: 'A' },
              { simbolo: 'V_C', valor: s.Vc, unidad: 'V' },
              { simbolo: 'V_R', valor: s.Vr, unidad: 'V' },
            ]}
          />

          <div className="tarjeta space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Energía almacenada en C</h3>
            <Formula bloque tex={`\\tfrac12 CV_C^2 = ${formatearTex(energiaCV(C, s.Vc))}\\ \\mathrm{J}`} />
            <Formula bloque tex={`\\frac{Q^2}{2C} = ${formatearTex(energiaQC(s.Q, C))}\\ \\mathrm{J}`} />
            <Formula bloque tex={`\\tfrac12 QV_C = ${formatearTex(energiaQV(s.Q, s.Vc))}\\ \\mathrm{J}`} />
            <h3 className="pt-2 text-sm font-semibold text-slate-300">Balance de energía</h3>
            {[
              { nombre: 'Entregada por la batería', valor: energia.bateria, color: 'bg-slate-300' },
              { nombre: 'Almacenada en C', valor: energia.capacitor, color: 'bg-sky-400' },
              { nombre: 'Disipada en R (calor)', valor: energia.resistencia, color: 'bg-orange-400' },
            ].map((x) => (
              <div key={x.nombre} className="text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>{x.nombre}</span>
                  <span className="font-mono text-slate-200">{formatearSI(x.valor, 3)} J</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div className={`h-2 rounded ${x.color}`} style={{ width: `${(100 * Math.max(0, x.valor)) / maxEnergia}%` }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500">
              Al cargar desde cero, la batería entrega CV² y exactamente la mitad se disipa en R, sin importar el valor de R.
            </p>
          </div>

          <div className="tarjeta space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Densidad de energía</h3>
            <p className="text-xs text-slate-400">Si este C fuera de placas paralelas con separación d y dieléctrico κ:</p>
            <Slider etiqueta="Separación d" valor={dmm} min={0.01} max={2} paso={0.01} unidad="mm" onChange={setDmm} />
            <Selector
              etiqueta="Dieléctrico"
              valor={idDiel}
              opciones={DIELECTRICOS.map((x) => ({ valor: x.id, etiqueta: `${x.nombre} (κ = ${x.kappa})` }))}
              onChange={setIdDiel}
            />
            <PanelResultados
              resultados={[
                { simbolo: 'A = Cd/\\kappa\\varepsilon_0', valor: areaNecesaria, unidad: 'm²', descripcion: 'Área que tendrían las placas' },
                { simbolo: 'E = V_C/d', valor: Ecampo, unidad: 'V/m' },
                { simbolo: 'u = \\tfrac12\\kappa\\varepsilon_0E^2', valor: u, unidad: 'J/m³' },
                { simbolo: 'u\\cdot A d', valor: u * areaNecesaria * d, unidad: 'J' },
              ]}
            />
            <p className="text-xs text-slate-500">u·(A·d) coincide con ½CV²: la energía está almacenada en el campo eléctrico.</p>
          </div>

          <PanelFormulas
            formulas={[
              { tex: 'Q(t)=CV\\left(1-e^{-t/\\tau}\\right)', descripcion: 'Carga (A)' },
              { tex: 'Q(t)=Q_0\\,e^{-t/\\tau}', descripcion: 'Descarga (B)' },
              { tex: 'I(t)=\\frac{dQ}{dt},\\quad \\tau=RC', descripcion: '' },
              { tex: 'U=\\tfrac12CV^2=\\frac{Q^2}{2C}=\\tfrac12QV', descripcion: 'Energía almacenada' },
            ]}
          />
        </>
      }
      teoria={
        <>
          <p>
            Cargar un capacitor requiere trabajo: cada carga dq que se agrega debe vencer el voltaje q/C ya presente. Integrando
            de 0 a Q se obtiene la energía almacenada:
          </p>
          <Formula bloque tex="U=\int_0^Q\frac{q}{C}\,dq=\frac{Q^2}{2C}=\tfrac12CV^2=\tfrac12QV" />
          <p>
            Esa energía reside en el campo eléctrico entre las placas, con densidad <Formula tex="u=\tfrac12\kappa\varepsilon_0E^2" /> (J/m³).
          </p>
          <p>
            En un <strong>circuito RC</strong> la ley de voltajes de Kirchhoff da <Formula tex="\varepsilon = IR + Q/C" />, con I = dQ/dt.
            Su solución es exponencial con constante de tiempo τ = RC:
          </p>
          <Formula bloque tex="\text{Carga: } Q=CV\left(1-e^{-t/\tau}\right),\quad I=\frac{V}{R}e^{-t/\tau}" />
          <Formula bloque tex="\text{Descarga: } Q=Q_0e^{-t/\tau},\quad I=-\frac{Q_0}{RC}e^{-t/\tau}" />
          <p>
            En t = τ el capacitor alcanza el 63.2 % de su carga final (o conserva el 36.8 % al descargarse); tras unos 5τ el proceso
            se considera terminado.
          </p>
        </>
      }
    />
  );
}
