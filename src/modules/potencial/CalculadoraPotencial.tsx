import { useCallback, useMemo, useState } from 'react';
import ModuloLayout from '../../components/ModuloLayout';
import Formula from '../../components/Formula';
import PanelResultados from '../../components/PanelResultados';
import Slider from '../../components/Slider';
import { Segmentado } from '../../components/controles';
import { formatearSI, formatearTex } from '../../components/formato';
import { aPantallaX, aPantallaY, dibujarFlecha, type Vista } from '../../components/vista2d';
import { K_COULOMB, MICRO } from '../../physics/constants';
import { campoYPotencial, R_SUAVIZADO, trabajoCampo } from '../../physics/electrostatics';
import type { Vec2 } from '../../physics/vector';
import { useCargasStore } from '../../store/useCargasStore';
import LienzoCargas from '../cargas/LienzoCargas';
import PanelCargas from '../cargas/PanelCargas';

const CAPAS = { mapa: true, equipotenciales: true, lineas: false, vectores: false };

/** Módulo 2 — Calculadora de potencial: V, E y trabajo entre dos puntos. */
export default function CalculadoraPotencial() {
  const cargas = useCargasStore((s) => s.cargas);
  const [A, setA] = useState<Vec2>({ x: 0, y: 0.5 });
  const [B, setB] = useState<Vec2>({ x: 0.7, y: -0.3 });
  const [colocar, setColocar] = useState<'A' | 'B'>('A');
  const [qMicro, setQMicro] = useState(1);

  const resA = useMemo(() => campoYPotencial(cargas, { ...A, z: 0 }), [cargas, A]);
  const resB = useMemo(() => campoYPotencial(cargas, { ...B, z: 0 }), [cargas, B]);
  const EA = Math.hypot(resA.E.x, resA.E.y, resA.E.z);
  const q = qMicro * MICRO;
  const W = trabajoCampo(q, resA.V, resB.V);

  // Contribución de cada carga en el punto A
  const contribuciones = cargas.map((c, i) => {
    const r = Math.hypot(A.x - c.x, A.y - c.y);
    const re = Math.max(r, R_SUAVIZADO);
    return { i: i + 1, q: c.q, r, V: (K_COULOMB * c.q) / re, E: (K_COULOMB * Math.abs(c.q) * r) / re ** 3 };
  });
  const dentroSuavizado = contribuciones.some((c) => c.r < R_SUAVIZADO);

  // Fórmula con los valores numéricos sustituidos (se abrevia si hay muchas cargas)
  const terminos = contribuciones.slice(0, 3).map((c) => `\\frac{${formatearTex(c.q, 3)}}{${formatearTex(c.r, 3)}}`);
  const texV =
    cargas.length === 0
      ? 'V_A = 0'
      : `V_A = k\\left(${terminos.join(' + ').replace(/\+ \\frac\{-/g, '- \\frac{')}${cargas.length > 3 ? ' + \\cdots' : ''}\\right)`;

  const dibujarPuntos = useCallback(
    (ctx: CanvasRenderingContext2D, v: Vista) => {
      const ax = aPantallaX(v, A.x);
      const ay = aPantallaY(v, A.y);
      const bx = aPantallaX(v, B.x);
      const by = aPantallaY(v, B.y);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(226,232,240,0.6)';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
      // Vector E en A (longitud fija, solo dirección)
      if (EA > 0) {
        ctx.strokeStyle = ctx.fillStyle = '#fbbf24';
        ctx.lineWidth = 2;
        dibujarFlecha(ctx, ax, ay, ax + (40 * resA.E.x) / EA, ay - (40 * resA.E.y) / EA, 8);
      }
      for (const [x, y, nombre, color] of [
        [ax, ay, 'A', '#fbbf24'],
        [bx, by, 'B', '#34d399'],
      ] as const) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(nombre, x + 9, y - 9);
      }
      ctx.restore();
    },
    [A, B, resA, EA],
  );

  const alClic = (p: Vec2) => {
    if (colocar === 'A') {
      setA(p);
      setColocar('B');
    } else {
      setB(p);
      setColocar('A');
    }
  };

  return (
    <ModuloLayout
      titulo="Calculadora de potencial"
      explicacion={`Estás colocando el punto ${colocar}. Al moverlo, cambia su distancia a cada carga y se recalculan sus aportes al potencial.`}
      simulacion={
        <>
          <LienzoCargas
            cargas={cargas}
            capas={CAPAS}
            editable
            onClicVacio={alClic}
            dibujarExtra={dibujarPuntos}
            etiqueta="Mapa de potencial con los puntos A y B"
          />
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-300">
            Clic para colocar el punto <strong className={colocar === 'A' ? 'text-amber-300' : 'text-emerald-300'}>{colocar}</strong>
          </div>
        </>
      }
      panel={
        <>
          <Segmentado
            opciones={[
              { valor: 'A', etiqueta: 'Colocar A' },
              { valor: 'B', etiqueta: 'Colocar B' },
            ]}
            valor={colocar}
            onChange={setColocar}
          />
          <PanelResultados
            resultados={[
              { simbolo: 'V_A', valor: resA.V, unidad: 'V' },
              { simbolo: '|\\vec E_A|', valor: EA, unidad: 'N/C' },
              { simbolo: 'E_x', valor: resA.E.x, unidad: 'N/C' },
              { simbolo: 'E_y', valor: resA.E.y, unidad: 'N/C' },
              { simbolo: 'E_z', valor: resA.E.z, unidad: 'N/C' },
              { simbolo: 'V_B', valor: resB.V, unidad: 'V' },
            ]}
          />
          <p className="-mt-2 px-1 font-mono text-xs text-slate-400">
            A = ({A.x.toFixed(3)}, {A.y.toFixed(3)}) m · B = ({B.x.toFixed(3)}, {B.y.toFixed(3)}) m
          </p>
          {dentroSuavizado && (
            <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-300">
              A está a menos de {R_SUAVIZADO * 100} cm de una carga: se usa el radio de suavizado y el valor no es el de una carga puntual ideal.
            </p>
          )}

          <div className="tarjeta space-y-2 overflow-x-auto">
            <h3 className="text-sm font-semibold text-slate-300">Cálculo en A</h3>
            <Formula bloque tex={texV} />
            <Formula bloque tex={`V_A = ${formatearTex(resA.V)}\\ \\mathrm{V}`} />
            <Formula bloque tex={`|\\vec E_A| = \\sqrt{E_x^2+E_y^2} = ${formatearTex(EA)}\\ \\mathrm{N/C}`} />
            <table className="w-full text-right font-mono text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left font-normal">i</th>
                  <th className="font-normal">qᵢ (μC)</th>
                  <th className="font-normal">rᵢ (m)</th>
                  <th className="font-normal">Vᵢ (V)</th>
                  <th className="font-normal">|Eᵢ| (N/C)</th>
                </tr>
              </thead>
              <tbody>
                {contribuciones.map((c) => (
                  <tr key={c.i}>
                    <td className="text-left">{c.i}</td>
                    <td>{(c.q / MICRO).toFixed(1)}</td>
                    <td>{c.r.toFixed(3)}</td>
                    <td>{formatearSI(c.V, 3)}</td>
                    <td>{formatearSI(c.E, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tarjeta space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Trabajo de A a B</h3>
            <Slider etiqueta="Carga de prueba q" valor={qMicro} min={-10} max={10} paso={0.1} unidad="μC" onChange={setQMicro} />
            <Formula bloque tex={`W_{A\\to B} = q\\,(V_A - V_B) = ${formatearTex(W)}\\ \\mathrm{J}`} />
            <PanelResultados
              resultados={[
                { simbolo: '\\Delta V = V_B - V_A', valor: resB.V - resA.V, unidad: 'V' },
                { simbolo: 'W_{\\text{campo}}', valor: W, unidad: 'J' },
                { simbolo: 'W_{\\text{externo}}', valor: -W, unidad: 'J' },
                { simbolo: '\\Delta U = q\\,\\Delta V', valor: -W, unidad: 'J' },
              ]}
            />
            <p className="text-xs text-slate-500">
              {W > 0
                ? 'El campo realiza trabajo positivo: la carga se mueve de forma espontánea de A a B.'
                : W < 0
                  ? 'El campo realiza trabajo negativo: un agente externo debe empujar la carga de A a B.'
                  : 'A y B están al mismo potencial: no se realiza trabajo.'}{' '}
              El trabajo no depende del camino (el campo electrostático es conservativo).
            </p>
          </div>
          <PanelCargas />
        </>
      }
      teoria={
        <>
          <p>
            El <strong>potencial eléctrico</strong> V es la energía potencial por unidad de carga. Para un sistema de cargas
            puntuales se obtiene sumando las contribuciones (escalares) de cada carga:
          </p>
          <Formula bloque tex="V(\vec r)=\sum_i \frac{k\,q_i}{|\vec r-\vec r_i|}" />
          <p>El campo eléctrico es la suma vectorial de los campos individuales, y se relaciona con V por E = −∇V:</p>
          <Formula bloque tex="\vec E(\vec r)=\sum_i \frac{k\,q_i\,(\vec r-\vec r_i)}{|\vec r-\vec r_i|^{3}}" />
          <p>
            Como el campo electrostático es <strong>conservativo</strong>, el trabajo que realiza sobre una carga q al llevarla de A
            a B solo depende de los potenciales en los extremos:
          </p>
          <Formula bloque tex="W_{A\to B}=q\,(V_A-V_B)=-\Delta U" />
          <p>
            Un agente externo que mueva la carga lentamente (sin cambiar su energía cinética) realiza el trabajo opuesto,
            W<sub>ext</sub> = q(V<sub>B</sub> − V<sub>A</sub>).
          </p>
        </>
      }
    />
  );
}
