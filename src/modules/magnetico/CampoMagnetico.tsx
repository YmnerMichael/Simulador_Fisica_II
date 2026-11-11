import { useMemo, useState } from 'react';
import ModuloLayout from '../../components/ModuloLayout';
import Formula from '../../components/Formula';
import PanelFormulas from '../../components/PanelFormulas';
import PanelResultados from '../../components/PanelResultados';
import Slider from '../../components/Slider';
import { Interruptor, Segmentado } from '../../components/controles';
import { formatearSI, formatearTex } from '../../components/formato';
import { campoMagnetico } from '../../physics/magnetism';
import type { Vec3 } from '../../physics/vector';
import Escena3DMagnetica from './Escena3DMagnetica';
import { construirFuente, formulaAnalitica, geometria, type ParamsFuente, type TipoFuente } from './fuentes';
import { useLineasB } from './useLineasB';

const VALORES_INICIALES: Record<TipoFuente, Omit<ParamsFuente, 'tipo'>> = {
  hilo: { I: 10, R: 0.5, L: 1, N: 10 },
  espira: { I: 10, R: 0.6, L: 1, N: 10 },
  solenoide: { I: 5, R: 0.35, L: 1.4, N: 12 },
  iman: { I: 5, R: 0.2, L: 0.9, N: 10 },
};
const SONDA_INICIAL: Record<TipoFuente, Vec3> = {
  hilo: { x: 0.5, y: 0, z: 0 },
  espira: { x: 0, y: 0, z: 0.3 },
  solenoide: { x: 0, y: 0, z: 0 },
  iman: { x: 0, y: 0, z: 1.2 },
};

/** Ilustración de la regla de la mano derecha: pulgar = I, dedos = sentido de B. */
function ManoDerecha() {
  return (
    <svg viewBox="0 0 220 120" className="h-28 w-full" aria-label="Regla de la mano derecha">
      <defs>
        <marker id="pI" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#fde047" />
        </marker>
        <marker id="pB" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#a855f7" />
        </marker>
      </defs>
      <line x1="60" y1="108" x2="60" y2="14" stroke="#fde047" strokeWidth="4" markerEnd="url(#pI)" />
      <text x="70" y="22" fill="#fde047" fontSize="12">I (pulgar)</text>
      <path d="M 28 70 A 32 12 0 1 0 92 70" fill="none" stroke="#a855f7" strokeWidth="3" markerEnd="url(#pB)" />
      <path d="M 92 70 A 32 12 0 0 0 28 70" fill="none" stroke="#a855f7" strokeWidth="3" strokeDasharray="4 4" />
      <text x="100" y="84" fill="#c4b5fd" fontSize="12">B (dedos)</text>
      <text x="120" y="56" fill="#94a3b8" fontSize="11">Si el pulgar apunta</text>
      <text x="120" y="70" fill="#94a3b8" fontSize="11">como I, los dedos</text>
      <text x="120" y="98" fill="#94a3b8" fontSize="11">rodean el hilo.</text>
    </svg>
  );
}

/** Módulo 8 — Campo magnético 3D por Biot–Savart. */
export default function CampoMagnetico() {
  const [params, setParams] = useState<ParamsFuente>({ tipo: 'solenoide', ...VALORES_INICIALES.solenoide });
  const [mostrarLineas, setMostrarLineas] = useState(true);
  const [mostrarBrujulas, setMostrarBrujulas] = useState(false);
  const [sonda, setSonda] = useState<Vec3>(SONDA_INICIAL.solenoide);

  // Las líneas de campo son costosas (Biot–Savart × RK4): se trazan en un Web Worker
  const { lineas, paramsLineas, calculando } = useLineasB(params);
  const polilineas = useMemo(() => geometria(params), [params]);
  const fuente = useMemo(() => construirFuente(params), [params]);
  const B = useMemo(() => campoMagnetico(fuente, sonda, 0.005), [fuente, sonda]);
  const magB = Math.hypot(B.x, B.y, B.z);
  const an = formulaAnalitica(params, sonda);
  const errorPct = an.valor ? (100 * Math.abs(magB - an.valor)) / an.valor : null;

  const cambiar = (cambios: Partial<ParamsFuente>) => setParams((p) => ({ ...p, ...cambios }));
  const elegirTipo = (tipo: TipoFuente) => {
    setParams({ tipo, ...VALORES_INICIALES[tipo] });
    setSonda(SONDA_INICIAL[tipo]);
  };

  return (
    <ModuloLayout
      titulo="Campo magnético 3D"
      explicacion={mostrarBrujulas ? 'Cada brújula se alinea con el campo magnético en su posición.' : 'Mueve la sonda para comparar la dirección y la intensidad del campo en distintos puntos.'}
      simulacion={
        <>
          <Escena3DMagnetica
            params={params}
            polilineas={polilineas}
            fuente={fuente}
            lineas={paramsLineas?.tipo === params.tipo ? lineas : []}
            mostrarLineas={mostrarLineas}
            mostrarBrujulas={mostrarBrujulas}
            sonda={sonda}
            Bsonda={B}
            onSonda={setSonda}
          />
          <div className="pointer-events-none absolute left-3 top-3 space-y-1 rounded-md bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
            <p>
              <span className="text-violet-400">━</span> líneas de B &nbsp; <span className="text-yellow-300">●</span> sentido de la corriente &nbsp;
              <span className="text-cyan-300">●→</span> sonda y dirección de B
            </p>
            <p>Clic en el plano vertical (y = 0) para mover la sonda · arrastra para rotar</p>
            {calculando && <p className="text-amber-300">Calculando líneas de campo…</p>}
          </div>
        </>
      }
      panel={
        <>
          <Segmentado
            opciones={[
              { valor: 'hilo', etiqueta: 'Hilo' },
              { valor: 'espira', etiqueta: 'Espira' },
              { valor: 'solenoide', etiqueta: 'Solenoide' },
              { valor: 'iman', etiqueta: 'Imán' },
            ]}
            valor={params.tipo}
            onChange={elegirTipo}
          />
          <div className="tarjeta space-y-3">
            <Slider
              etiqueta={params.tipo === 'iman' ? 'Corriente equivalente I' : 'Corriente I'}
              valor={params.I}
              min={0.5}
              max={20}
              paso={0.5}
              unidad="A"
              onChange={(I) => cambiar({ I })}
            />
            {params.tipo !== 'hilo' && (
              <Slider
                etiqueta="Radio R"
                valor={params.R}
                min={params.tipo === 'espira' ? 0.2 : 0.1}
                max={params.tipo === 'espira' ? 1 : 0.5}
                paso={0.01}
                unidad="m"
                onChange={(R) => cambiar({ R })}
              />
            )}
            {(params.tipo === 'solenoide' || params.tipo === 'iman') && (
              <Slider etiqueta="Longitud L" valor={params.L} min={0.4} max={2} paso={0.05} unidad="m" onChange={(L) => cambiar({ L })} />
            )}
            {params.tipo === 'solenoide' && <Slider etiqueta="Vueltas N" valor={params.N} min={3} max={30} paso={1} onChange={(N) => cambiar({ N })} />}
            <div className="flex gap-4">
              <Interruptor etiqueta="Líneas de B" activo={mostrarLineas} onChange={setMostrarLineas} />
              <Interruptor etiqueta="Brújulas" activo={mostrarBrujulas} onChange={setMostrarBrujulas} />
            </div>
          </div>

          <div className="tarjeta space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Sonda</h3>
            <Slider etiqueta="x" valor={sonda.x} min={-2} max={2} paso={0.01} unidad="m" onChange={(x) => setSonda({ ...sonda, x })} />
            <Slider etiqueta="y" valor={sonda.y} min={-2} max={2} paso={0.01} unidad="m" onChange={(y) => setSonda({ ...sonda, y })} />
            <Slider etiqueta="z" valor={sonda.z} min={-2} max={2} paso={0.01} unidad="m" onChange={(z) => setSonda({ ...sonda, z })} />
          </div>

          <PanelResultados
            resultados={[
              { simbolo: '|\\vec B|\\ (\\text{Biot–Savart})', valor: magB, unidad: 'T' },
              { simbolo: 'B_x', valor: B.x, unidad: 'T' },
              { simbolo: 'B_y', valor: B.y, unidad: 'T' },
              { simbolo: 'B_z', valor: B.z, unidad: 'T' },
            ]}
          />
          <div className="tarjeta space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Fórmula analítica</h3>
            <Formula bloque tex={an.tex} />
            {an.valor !== null ? (
              <>
                <Formula bloque tex={`B_{\\text{analítico}} = ${formatearTex(an.valor)}\\ \\mathrm{T}`} />
                <p className={`text-center font-mono text-xs ${errorPct! < 1 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  diferencia con Biot–Savart: {formatearSI(errorPct!, 3)} %
                </p>
              </>
            ) : null}
            <p className="text-xs text-slate-400">{an.nota}</p>
          </div>

          <div className="tarjeta">
            <h3 className="text-sm font-semibold text-slate-300">Regla de la mano derecha</h3>
            <ManoDerecha />
          </div>

          <PanelFormulas
            formulas={[
              { tex: 'd\\vec B=\\frac{\\mu_0 I}{4\\pi}\\,\\frac{d\\vec l\\times\\hat r}{r^2}', descripcion: 'Ley de Biot–Savart' },
              { tex: '\\oint \\vec B\\cdot d\\vec l=\\mu_0 I_{enc}', descripcion: 'Ley de Ampère' },
              { tex: '\\nabla\\cdot\\vec B = 0', descripcion: 'Las líneas de B son cerradas' },
            ]}
          />
        </>
      }
      teoria={
        <>
          <p>
            Toda corriente eléctrica crea un <strong>campo magnético</strong>. La contribución de un pequeño tramo dl de conductor la da la{' '}
            <strong>ley de Biot–Savart</strong>:
          </p>
          <Formula bloque tex="d\vec B=\frac{\mu_0 I}{4\pi}\,\frac{d\vec l\times\hat r}{r^{2}},\qquad \mu_0=4\pi\times10^{-7}\ \mathrm{T\,m/A}" />
          <p>
            El simulador divide cada conductor en cientos de tramos y suma sus contribuciones (integración numérica). Para geometrías simétricas
            existen fórmulas exactas con las que se compara el resultado:
          </p>
          <Formula bloque tex="\text{Hilo: } B=\frac{\mu_0 I}{2\pi r}\qquad \text{Espira (centro): } B=\frac{\mu_0 I}{2R}\qquad \text{Solenoide: } B=\frac{\mu_0 N I}{L}" />
          <p>
            La dirección sigue la <strong>regla de la mano derecha</strong>. Como no existen monopolos magnéticos (∇·B = 0), las líneas de B
            no empiezan ni terminan: son lazos cerrados. Un <strong>imán de barra</strong> equivale a un solenoide corto (sus corrientes
            atómicas se suman como una corriente superficial); lejos de él su campo es el de un dipolo de momento m.
          </p>
        </>
      }
    />
  );
}
