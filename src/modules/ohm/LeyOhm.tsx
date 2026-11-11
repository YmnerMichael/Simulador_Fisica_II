import { useCallback, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ModuloLayout from '../../components/ModuloLayout';
import Canvas2D from '../../components/Canvas2D';
import Formula from '../../components/Formula';
import PanelFormulas from '../../components/PanelFormulas';
import PanelResultados from '../../components/PanelResultados';
import Slider from '../../components/Slider';
import { Selector } from '../../components/controles';
import { formatearPrefijo, formatearSI, formatearTex, marcasEje } from '../../components/formato';
import { MATERIALES, areaCircular, leyOhm, resistenciaConductor, resistividadTemperatura } from '../../physics/circuits';

const V_MAX = 24;

/** Dibuja el circuito: batería, resistencia que brilla según la potencia, amperímetro y voltímetro. */
function dibujarCircuitoOhm(ctx: CanvasRenderingContext2D, ancho: number, alto: number, V: number, R: number, fase: number) {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, ancho, alto);
  const e = Math.min(ancho / 560, alto / 320, 1.5);
  const w = 360 * e;
  const h = 190 * e;
  const izq = (ancho - w) / 2;
  const arr = (alto - h) / 2 + 10 * e;
  const der = izq + w;
  const abj = arr + h;
  const I = leyOhm(V, R);
  const P = V * I;

  // Cables y puntos de corriente (rapidez ∝ √I, escala visual)
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5 * e;
  ctx.strokeRect(izq, arr, w, h);
  const camino: [number, number][] = [[izq, abj], [izq, arr], [der, arr], [der, abj], [izq, abj]];
  const largo = 2 * (w + h);
  const sep = 24 * e;
  if (I > 0) {
    ctx.fillStyle = '#fde047';
    for (let s0 = 0; s0 < largo; s0 += sep) {
      let s = (s0 + fase) % largo;
      for (let k = 1; k < camino.length; k++) {
        const [x1, y1] = camino[k - 1];
        const [x2, y2] = camino[k];
        const l = Math.hypot(x2 - x1, y2 - y1);
        if (s <= l) {
          const x = x1 + ((x2 - x1) * s) / l;
          const y = y1 + ((y2 - y1) * s) / l;
          const enResistencia = Math.abs(x - der) < 1 && Math.abs(y - (arr + abj) / 2) < 40 * e;
          const enBateria = Math.abs(x - izq) < 1 && Math.abs(y - (arr + abj) / 2) < 12 * e;
          if (!enResistencia && !enBateria) {
            ctx.beginPath();
            ctx.arc(x, y, 3 * e, 0, 2 * Math.PI);
            ctx.fill();
          }
          break;
        }
        s -= l;
      }
    }
  }

  // Batería
  const yb = (arr + abj) / 2;
  ctx.fillStyle = '#020617';
  ctx.fillRect(izq - 24 * e, yb - 12 * e, 48 * e, 24 * e);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3 * e;
  ctx.beginPath();
  ctx.moveTo(izq - 20 * e, yb - 6 * e);
  ctx.lineTo(izq + 20 * e, yb - 6 * e);
  ctx.stroke();
  ctx.lineWidth = 6 * e;
  ctx.beginPath();
  ctx.moveTo(izq - 10 * e, yb + 6 * e);
  ctx.lineTo(izq + 10 * e, yb + 6 * e);
  ctx.stroke();
  ctx.font = `${13 * e}px system-ui, sans-serif`;
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'right';
  ctx.fillText(`${formatearPrefijo(V, 'V')}`, izq - 30 * e, yb + 5 * e);

  // Resistencia vertical: el color pasa de gris a rojo-amarillo según log P
  const brillo = P > 0 ? Math.min(1, Math.max(0, (Math.log10(P) + 2) / 4.5)) : 0;
  const yr = yb;
  const alturaR = 70 * e;
  if (brillo > 0) {
    const g = ctx.createRadialGradient(der, yr, 2, der, yr, 60 * e);
    g.addColorStop(0, `rgba(251,146,60,${0.55 * brillo})`);
    g.addColorStop(1, 'rgba(251,146,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(der - 60 * e, yr - 60 * e, 120 * e, 120 * e);
  }
  ctx.fillStyle = '#020617';
  ctx.fillRect(der - 14 * e, yr - alturaR / 2 - 2, 28 * e, alturaR + 4);
  ctx.strokeStyle = `hsl(${40 - 40 * brillo}, ${30 + 70 * brillo}%, ${55 + 15 * brillo}%)`;
  ctx.lineWidth = 3 * e;
  ctx.beginPath();
  ctx.moveTo(der, yr - alturaR / 2);
  for (let i = 0; i < 6; i++) ctx.lineTo(der + (i % 2 ? 10 : -10) * e, yr - alturaR / 2 + (alturaR * (i + 0.5)) / 6);
  ctx.lineTo(der, yr + alturaR / 2);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`R = ${formatearPrefijo(R, 'Ω')}`, der + 20 * e, yr + 5 * e);

  // Medidores digitales
  const medidor = (x: number, y: number, titulo: string, valor: string, color: string) => {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - 55 * e, y - 22 * e, 110 * e, 44 * e, 6 * e);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `${10 * e}px system-ui, sans-serif`;
    ctx.fillText(titulo, x, y - 8 * e);
    ctx.fillStyle = color;
    ctx.font = `bold ${15 * e}px ui-monospace, monospace`;
    ctx.fillText(valor, x, y + 12 * e);
  };
  medidor((izq + der) / 2, arr, 'AMPERÍMETRO', formatearPrefijo(I, 'A'), '#fde047');
  medidor((izq + der) / 2, abj, 'POTENCIA', formatearPrefijo(P, 'W'), '#fb923c');
}

/** Módulo 7 — Ley de Ohm, gráfica V–I, potencia y resistividad. */
export default function LeyOhm() {
  const [V, setV] = useState(12);
  const [expR, setExpR] = useState(2); // R = 10^exp Ω
  const R = Number(Math.pow(10, expR).toPrecision(4));
  const I = leyOhm(V, R);
  const P = V * I;

  // Resistividad
  const [idMat, setIdMat] = useState('nicrom');
  const [expL, setExpL] = useState(0); // L = 10^exp m
  const [dmm, setDmm] = useState(0.5);
  const [T, setT] = useState(20);
  const mat = MATERIALES.find((m) => m.id === idMat)!;
  const L = Math.pow(10, expL);
  const A = areaCircular(dmm / 1000);
  const rhoT = resistividadTemperatura(mat.rho, mat.alfa, T);
  const Rcond = resistenciaConductor(rhoT, L, A);

  const fase = useRef(0);
  const previo = useRef(performance.now());
  const dibujar = useCallback(
    (ctx: CanvasRenderingContext2D, ancho: number, alto: number) => {
      const ahora = performance.now();
      const dt = Math.min(0.05, (ahora - previo.current) / 1000);
      previo.current = ahora;
      fase.current += dt * 160 * Math.sqrt(Math.min(1, I / 2));
      dibujarCircuitoOhm(ctx, ancho, alto, V, R, fase.current);
    },
    [V, R, I],
  );

  // Recta V = R·I (y R/2, 2R como referencia) y parábola P = I²R
  const iMax = V_MAX / R;
  const datosVI = useMemo(
    () => [0, iMax].map((i) => ({ I: i, R: R * i, mitad: (R / 2) * i, doble: 2 * R * i })),
    [R, iMax],
  );
  const datosP = useMemo(() => Array.from({ length: 41 }, (_, k) => ({ I: (iMax * k) / 40, P: R * ((iMax * k) / 40) ** 2 })), [R, iMax]);
  const estiloTooltip = { background: '#0f172a', border: '1px solid #334155', fontSize: 12 };

  return (
    <ModuloLayout
      titulo="Ley de Ohm y resistividad"
      explicacion={`Con ${V} voltios y ${R} ohmios, la corriente es de ${I.toLocaleString('es-PE', { maximumSignificantDigits: 3, useGrouping: false })} amperios. Ahora sube la resistencia sin mover el voltaje. Verás que baja la corriente.`}
      simulacion={
        <div className="flex h-full flex-col">
          <div className="relative min-h-[240px] flex-1">
            <Canvas2D dibujar={dibujar} animado etiqueta="Circuito con fuente y resistencia" />
          </div>
          <div className="grid shrink-0 gap-2 border-t border-slate-800 p-2 md:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
              <p className="mb-1 text-xs font-semibold text-slate-300">Curva V–I (pendiente = R)</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datosVI} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#1e293b" />
                    <XAxis dataKey="I" type="number" domain={[0, iMax]} ticks={marcasEje(iMax)} tickFormatter={(v: number) => formatearSI(v, 2)} stroke="#64748b" fontSize={10} unit=" A" />
                    <YAxis domain={[0, V_MAX]} ticks={marcasEje(V_MAX)} allowDataOverflow stroke="#64748b" fontSize={10} width={40} unit=" V" />
                    <Tooltip contentStyle={estiloTooltip} formatter={(v: number) => `${formatearSI(v, 3)} V`} labelFormatter={(x: number) => `I = ${formatearSI(x, 3)} A`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line dataKey="doble" name="2R" stroke="#475569" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                    <Line dataKey="R" name={`R = ${formatearPrefijo(R, 'Ω')}`} stroke="#38bdf8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    <Line dataKey="mitad" name="R/2" stroke="#475569" strokeDasharray="2 3" dot={false} isAnimationActive={false} />
                    <ReferenceDot x={I} y={V} r={6} fill="#fde047" stroke="#020617" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
              <p className="mb-1 text-xs font-semibold text-slate-300">Potencia P = I²R</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datosP} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#1e293b" />
                    <XAxis dataKey="I" type="number" domain={[0, iMax]} ticks={marcasEje(iMax)} tickFormatter={(v: number) => formatearSI(v, 2)} stroke="#64748b" fontSize={10} unit=" A" />
                    <YAxis tickFormatter={(v: number) => formatearSI(v, 2)} stroke="#64748b" fontSize={10} width={52} unit=" W" />
                    <Tooltip contentStyle={estiloTooltip} formatter={(v: number) => `${formatearSI(v, 3)} W`} labelFormatter={(x: number) => `I = ${formatearSI(x, 3)} A`} />
                    <Line dataKey="P" name="P" stroke="#fb923c" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    <ReferenceDot x={I} y={P} r={6} fill="#fde047" stroke="#020617" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      }
      panel={
        <>
          <div className="tarjeta space-y-3">
            <Slider etiqueta="Voltaje V" valor={V} min={0} max={V_MAX} paso={0.1} unidad="V" onChange={setV} />
            <Slider etiqueta="Resistencia R" valor={expR} min={-1} max={4} paso={0.01} formato={(x) => formatearPrefijo(Math.pow(10, x), 'Ω')} onChange={setExpR} />
          </div>
          <PanelResultados
            resultados={[
              { simbolo: 'I = V/R', valor: I, unidad: 'A' },
              { simbolo: 'P = VI', valor: V * I, unidad: 'W' },
              { simbolo: 'P = I^2R', valor: I * I * R, unidad: 'W' },
              { simbolo: 'P = V^2/R', valor: (V * V) / R, unidad: 'W' },
            ]}
          />
          <div className="tarjeta">
            <Formula bloque tex={`I = \\frac{V}{R} = \\frac{${formatearTex(V)}\\ \\mathrm{V}}{${formatearTex(R)}\\ \\Omega} = ${formatearTex(I)}\\ \\mathrm{A}`} />
          </div>
          {I > 10 && <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-300">Corriente muy alta: un conductor real se calentaría peligrosamente.</p>}

          <div className="tarjeta space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Resistencia de un conductor</h3>
            <Selector
              etiqueta="Material"
              valor={idMat}
              opciones={MATERIALES.map((m) => ({ valor: m.id, etiqueta: m.nombre }))}
              onChange={setIdMat}
            />
            <Slider etiqueta="Longitud L" valor={expL} min={-1} max={3} paso={0.01} formato={(x) => formatearPrefijo(Math.pow(10, x), 'm')} onChange={setExpL} />
            <Slider etiqueta="Diámetro" valor={dmm} min={0.05} max={5} paso={0.05} unidad="mm" onChange={setDmm} />
            <Slider etiqueta="Temperatura" valor={T} min={-50} max={300} paso={1} unidad="°C" onChange={setT} />

            {/* Esquema del conductor: el largo y el grosor se dibujan en escala logarítmica */}
            <svg viewBox="0 0 300 70" className="w-full" aria-label="Esquema del conductor">
              {(() => {
                const largo = 60 + 60 * (expL + 1);
                const grosor = 4 + 8 * Math.log10(1 + dmm * 2);
                return (
                  <>
                    <rect x={150 - largo / 2} y={35 - grosor} width={largo} height={2 * grosor} rx={grosor} fill="#b45309" opacity={0.85} />
                    <ellipse cx={150 - largo / 2 + grosor * 0.4} cy={35} rx={grosor * 0.4} ry={grosor} fill="#fbbf24" />
                    <text x={150} y={14} fill="#94a3b8" fontSize={11} textAnchor="middle">
                      L = {formatearPrefijo(L, 'm')}
                    </text>
                    <text x={150} y={66} fill="#94a3b8" fontSize={11} textAnchor="middle">
                      A = {formatearSI(A, 3)} m²
                    </text>
                  </>
                );
              })()}
            </svg>

            <PanelResultados
              resultados={[
                { simbolo: '\\rho_{20}', valor: mat.rho, unidad: 'Ω·m' },
                { simbolo: '\\rho(T)', valor: rhoT, unidad: 'Ω·m' },
                { simbolo: 'R = \\rho L/A', valor: Rcond, unidad: 'Ω' },
              ]}
            />
            <button
              className="boton w-full justify-center"
              onClick={() => setExpR(Math.min(4, Math.max(-1, Math.log10(Rcond))))}
              title="La resistencia del circuito se limita al rango 0.1 Ω – 10 kΩ"
            >
              Usar esta R en el circuito
            </button>
          </div>

          <PanelFormulas
            formulas={[
              { tex: 'V = IR', descripcion: 'Ley de Ohm' },
              { tex: 'P = VI = I^2R = \\frac{V^2}{R}', descripcion: 'Potencia disipada (efecto Joule)' },
              { tex: 'R = \\frac{\\rho L}{A}', descripcion: 'Resistencia de un conductor' },
              { tex: '\\rho(T) = \\rho_0\\left[1+\\alpha\\,(T-T_0)\\right]', descripcion: 'Variación con la temperatura' },
            ]}
          />
        </>
      }
      teoria={
        <>
          <p>
            La <strong>corriente eléctrica</strong> I = dQ/dt es la carga que atraviesa una sección del conductor por unidad de tiempo
            (en amperios). En muchos materiales la corriente es proporcional al voltaje aplicado: es la <strong>ley de Ohm</strong>,
          </p>
          <Formula bloque tex="V = IR" />
          <p>
            donde R es la resistencia (en ohmios). Por eso la gráfica V–I de un resistor óhmico es una recta que pasa por el origen y cuya
            pendiente es R. La energía que pierden las cargas se convierte en calor (efecto Joule) a razón de
          </p>
          <Formula bloque tex="P = VI = I^2R = \frac{V^2}{R}" />
          <p>
            La resistencia de un conductor uniforme depende del material (resistividad ρ), de su longitud L y del área A de su sección:
          </p>
          <Formula bloque tex="R = \frac{\rho L}{A},\qquad \rho(T)=\rho_0\left[1+\alpha\,(T-T_0)\right]" />
          <p>
            En los metales α &gt; 0 (la resistencia aumenta con la temperatura); en el carbono α &lt; 0. El nicrom tiene una resistividad
            unas 60 veces mayor que la del cobre y casi no varía con T, por eso se usa en resistencias calefactoras.
          </p>
        </>
      }
    />
  );
}
