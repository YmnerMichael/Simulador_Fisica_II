import { useEffect, useMemo, useRef, useState } from 'react';
import ModuloLayout from '../../components/ModuloLayout';
import Escena3D from '../../components/Escena3D';
import Formula from '../../components/Formula';
import PanelFormulas from '../../components/PanelFormulas';
import PanelResultados from '../../components/PanelResultados';
import Slider from '../../components/Slider';
import { Segmentado, Selector } from '../../components/controles';
import { formatearSI } from '../../components/formato';
import {
  DIELECTRICOS,
  analizarAsociacion,
  capacitanciaParcial,
  capacitanciaPlacas,
  densidadCargaInducida,
  densidadCargaLibre,
  densidadEnergia,
  energiaCV,
  type TipoAsociacion,
} from '../../physics/capacitor';
import Capacitor3D from './Capacitor3D';
import DiagramaAsociacion from './DiagramaAsociacion';

type Conexion = 'bateria' | 'aislado';

/** Módulo 4 — Simulador de capacitores: placas paralelas con dieléctrico y asociaciones. */
export default function SimuladorCapacitores() {
  const [vista, setVista] = useState<'placas' | 'asociacion'>('placas');

  // ── Placas paralelas ──
  const [expArea, setExpArea] = useState(-2); // A = 10^exp m²
  const [dmm, setDmm] = useState(2);
  const [V, setV] = useState(100);
  const [idDiel, setIdDiel] = useState('vidrio');
  const [fraccion, setFraccion] = useState(0);
  const [objetivo, setObjetivo] = useState<number | null>(null);
  const [conexion, setConexion] = useState<Conexion>('bateria');
  const [qAislada, setQAislada] = useState(0);

  const diel = DIELECTRICOS.find((d) => d.id === idDiel)!;
  const A = Math.pow(10, expArea);
  const d = dmm / 1000;
  const C0 = capacitanciaPlacas(A, d);
  const C = capacitanciaParcial(A, d, diel.kappa, fraccion);
  // Conectado: V fijo por la batería. Aislado: Q fija desde que se desconectó → V = Q/C
  const Q = conexion === 'bateria' ? C * V : qAislada;
  const Vact = Q / C;
  const E = Vact / d;
  const sigmaVacio = densidadCargaLibre(E);
  const sigmaDiel = densidadCargaLibre(E, diel.kappa);
  const sigmaInd = densidadCargaInducida(sigmaDiel, diel.kappa);
  const U = energiaCV(C, Vact);
  const ruptura = fraccion > 0 && diel.rigidez !== null && E > diel.rigidez;

  const cambiarConexion = (c: Conexion) => {
    if (c === 'aislado') setQAislada(C * V);
    else setV(Math.min(1000, Math.round(Vact)));
    setConexion(c);
  };

  // Animación de inserción / retiro del dieléctrico (60 % del recorrido por segundo)
  const fraccionRef = useRef(fraccion);
  fraccionRef.current = fraccion;
  useEffect(() => {
    if (objetivo === null) return;
    let id = 0;
    let previo = performance.now();
    const ciclo = (ahora: number) => {
      const paso = ((ahora - previo) / 1000) * 0.6;
      previo = ahora;
      const f = fraccionRef.current;
      const sig = f < objetivo ? Math.min(objetivo, f + paso) : Math.max(objetivo, f - paso);
      fraccionRef.current = sig;
      setFraccion(sig);
      if (sig === objetivo) setObjetivo(null);
      else id = requestAnimationFrame(ciclo);
    };
    id = requestAnimationFrame(ciclo);
    return () => cancelAnimationFrame(id);
  }, [objetivo]);

  // Escalas visuales (no físicas): el tamaño y la separación se mapean a un rango cómodo de ver
  const lado = 0.8 + (1.2 * (expArea + 4)) / 3;
  const separacion = 0.3 + (0.9 * (dmm - 0.5)) / 9.5;
  const intensidad = E > 0 ? Math.min(1, Math.max(0.05, (Math.log10(E) - 3) / 4)) : 0;
  const cargasPorLado = Q > 0 ? Math.round(Math.min(11, Math.max(2, 2 + 1.6 * Math.log10(Q / A / 1e-8)))) : 0;

  // ── Asociación ──
  const [tipo, setTipo] = useState<TipoAsociacion>('serie');
  const [n, setN] = useState(3);
  const [cs, setCs] = useState([10, 20, 30, 40]); // μF
  const [Vasoc, setVasoc] = useState(12);
  const resultado = useMemo(() => analizarAsociacion(cs.slice(0, n).map((c) => c * 1e-6), Vasoc, tipo), [cs, n, Vasoc, tipo]);

  const formulaCeq: Record<TipoAsociacion, string> = {
    serie: '\\frac{1}{C_{eq}}=\\sum_i \\frac{1}{C_i}',
    paralelo: 'C_{eq}=\\sum_i C_i',
    mixto: 'C_{eq}=\\left(\\frac{1}{C_1}+\\frac{1}{C_2+\\cdots+C_n}\\right)^{-1}',
  };

  return (
    <ModuloLayout
      titulo="Simulador de capacitores"
      explicacion={vista === 'asociacion'
        ? (tipo === 'serie' ? 'En serie, la capacitancia equivalente es menor que la de cualquiera de los capacitores.' : 'En paralelo, las capacitancias se suman.')
        : fraccion > 0 ? 'El dieléctrico aumenta la capacitancia. Prueba retirarlo y compara el resultado.'
        : 'Acerca las placas para aumentar la capacitancia o inserta un dieléctrico y compara el resultado.'}
      simulacion={
        vista === 'placas' ? (
          <>
            <Escena3D camara={[2.3, -3.3, 0.9]} ejes={false} alturaCuadricula={-separacion / 2 - 0.35}>
              <Capacitor3D lado={lado} separacion={separacion} fraccion={fraccion} dielectrico={diel} intensidad={intensidad} cargasPorLado={cargasPorLado} />
            </Escena3D>
            <div className="pointer-events-none absolute left-3 top-3 space-y-1 rounded-md bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
              <p>
                <span className="text-positiva">■</span> placa + &nbsp; <span className="text-negativa">■</span> placa − &nbsp;
                <span className="text-amber-300">●</span> sentido de E
              </p>
              {diel.kappa > 1 && <p>Conos blancos: dipolos del dieléctrico (se alinean con E al entrar)</p>}
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-[360px] items-center p-4">
            <DiagramaAsociacion tipo={tipo} V={Vasoc} resultado={resultado} />
          </div>
        )
      }
      panel={
        <>
          <Segmentado
            opciones={[
              { valor: 'placas', etiqueta: 'Placas paralelas' },
              { valor: 'asociacion', etiqueta: 'Serie / paralelo' },
            ]}
            valor={vista}
            onChange={setVista}
          />

          {vista === 'placas' ? (
            <>
              <div className="tarjeta space-y-3">
                <Segmentado
                  opciones={[
                    { valor: 'bateria', etiqueta: 'Con batería (V cte.)' },
                    { valor: 'aislado', etiqueta: 'Aislado (Q cte.)' },
                  ]}
                  valor={conexion}
                  onChange={cambiarConexion}
                />
                <Slider etiqueta="Área A" valor={expArea} min={-4} max={-1} paso={0.02} formato={(e) => formatearSI(Math.pow(10, e) * 1e4, 3)} unidad="cm²" onChange={setExpArea} />
                <Slider etiqueta="Separación d" valor={dmm} min={0.5} max={10} paso={0.1} unidad="mm" onChange={setDmm} />
                <Slider
                  etiqueta={conexion === 'bateria' ? 'Voltaje V' : 'Voltaje V (resulta de Q/C)'}
                  valor={conexion === 'bateria' ? V : Math.round(Vact)}
                  min={0}
                  max={1000}
                  paso={5}
                  unidad="V"
                  deshabilitado={conexion === 'aislado'}
                  onChange={setV}
                />
              </div>

              <div className="tarjeta space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Dieléctrico</h3>
                <Selector
                  etiqueta="Material"
                  valor={idDiel}
                  opciones={DIELECTRICOS.map((x) => ({ valor: x.id, etiqueta: `${x.nombre} (κ = ${x.kappa})` }))}
                  onChange={setIdDiel}
                />
                <Slider etiqueta="Insertado" valor={Math.round(fraccion * 100)} min={0} max={100} paso={1} unidad="%" onChange={(v) => setFraccion(v / 100)} deshabilitado={diel.kappa === 1} />
                <div className="flex gap-2">
                  <button className="boton flex-1 justify-center" disabled={diel.kappa === 1 || fraccion === 1} onClick={() => setObjetivo(1)}>
                    Insertar
                  </button>
                  <button className="boton flex-1 justify-center" disabled={fraccion === 0} onClick={() => setObjetivo(0)}>
                    Retirar
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {conexion === 'bateria'
                    ? 'Con la batería conectada V no cambia: al insertar el dieléctrico C y Q aumentan κ veces (la batería entrega más carga).'
                    : 'Aislado, Q no cambia: al insertar el dieléctrico V, E y U disminuyen κ veces (el campo atrae al dieléctrico hacia adentro).'}
                </p>
              </div>

              {ruptura && (
                <p className="rounded-md bg-red-500/10 p-2 text-xs text-red-300">
                  ¡Ruptura dieléctrica! E = {formatearSI(E, 3)} V/m supera la rigidez del {diel.nombre.toLowerCase()} ({formatearSI(diel.rigidez!, 3)} V/m).
                </p>
              )}

              <PanelResultados
                resultados={[
                  { simbolo: 'C_0', valor: C0, unidad: 'F', descripcion: 'Capacitancia sin dieléctrico' },
                  { simbolo: 'C', valor: C, unidad: 'F' },
                  { simbolo: 'C/C_0', valor: C / C0, unidad: '' },
                  { simbolo: 'Q', valor: Q, unidad: 'C' },
                  { simbolo: 'V', valor: Vact, unidad: 'V' },
                  { simbolo: 'E = V/d', valor: E, unidad: 'V/m' },
                  { simbolo: '\\sigma\\ (\\text{vacío})', valor: sigmaVacio, unidad: 'C/m²' },
                  ...(diel.kappa > 1 && fraccion > 0
                    ? [
                        { simbolo: '\\sigma\\ (\\text{con } \\kappa)', valor: sigmaDiel, unidad: 'C/m²' },
                        { simbolo: '\\sigma_{ind}', valor: sigmaInd, unidad: 'C/m²' },
                      ]
                    : []),
                  { simbolo: 'U = \\tfrac12 CV^2', valor: U, unidad: 'J' },
                  { simbolo: 'u = \\tfrac12\\varepsilon_0 E^2', valor: densidadEnergia(E), unidad: 'J/m³' },
                ]}
              />
              <PanelFormulas
                formulas={[
                  { tex: 'C=\\frac{\\kappa\\,\\varepsilon_0 A}{d}', descripcion: 'Placas paralelas' },
                  { tex: 'C=\\frac{\\varepsilon_0 A}{d}\\left[(1-f)+\\kappa f\\right]', descripcion: 'Dieléctrico insertado una fracción f' },
                  { tex: 'Q=CV,\\quad E=\\frac{V}{d},\\quad \\sigma=\\kappa\\varepsilon_0E', descripcion: '' },
                  { tex: 'U=\\tfrac12 CV^2', descripcion: 'Energía almacenada' },
                ]}
              />
            </>
          ) : (
            <>
              <div className="tarjeta space-y-3">
                <Segmentado
                  opciones={[
                    { valor: 'serie', etiqueta: 'Serie' },
                    { valor: 'paralelo', etiqueta: 'Paralelo' },
                    { valor: 'mixto', etiqueta: 'Mixto' },
                  ]}
                  valor={tipo}
                  onChange={setTipo}
                />
                <Segmentado
                  opciones={[
                    { valor: '2', etiqueta: '2 capacitores' },
                    { valor: '3', etiqueta: '3' },
                    { valor: '4', etiqueta: '4' },
                  ]}
                  valor={String(n) as '2' | '3' | '4'}
                  onChange={(v) => setN(Number(v))}
                />
                {cs.slice(0, n).map((c, i) => (
                  <Slider key={i} etiqueta={`C${i + 1}`} valor={c} min={1} max={100} paso={1} unidad="μF" onChange={(v) => setCs(cs.map((x, j) => (j === i ? v : x)))} />
                ))}
                <Slider etiqueta="Fuente V" valor={Vasoc} min={1} max={50} paso={1} unidad="V" onChange={setVasoc} />
                {tipo === 'mixto' && <p className="text-xs text-slate-400">Mixto: C1 en serie con el paralelo de los demás.</p>}
              </div>
              <div className="tarjeta overflow-x-auto">
                <Formula bloque tex={formulaCeq[tipo]} />
                <table className="w-full text-right font-mono text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="text-left font-normal"></th>
                      <th className="font-normal">C (μF)</th>
                      <th className="font-normal">V (V)</th>
                      <th className="font-normal">Q (μC)</th>
                      <th className="font-normal">U (J)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.elementos.map((e, i) => (
                      <tr key={i}>
                        <td className="text-left">C{i + 1}</td>
                        <td>{formatearSI(e.C * 1e6, 3)}</td>
                        <td>{formatearSI(e.V, 3)}</td>
                        <td>{formatearSI(e.Q * 1e6, 3)}</td>
                        <td>{formatearSI(e.U, 3)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-700 text-sky-300">
                      <td className="text-left">eq</td>
                      <td>{formatearSI(resultado.Ceq * 1e6, 3)}</td>
                      <td>{formatearSI(Vasoc, 3)}</td>
                      <td>{formatearSI(resultado.Q * 1e6, 3)}</td>
                      <td>{formatearSI(resultado.U, 3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="px-1 text-xs text-slate-400">
                En serie todos tienen la misma carga y los voltajes suman V; en paralelo todos tienen el mismo voltaje y las cargas suman Q.
              </p>
            </>
          )}
        </>
      }
      teoria={
        <>
          <p>
            Un <strong>capacitor</strong> son dos conductores separados por un aislante. Al aplicar una diferencia de potencial V
            adquieren cargas +Q y −Q proporcionales a V; la constante de proporcionalidad es la capacitancia C = Q/V (en faradios).
          </p>
          <p>Para placas paralelas de área A separadas una distancia d (con d mucho menor que el tamaño de las placas):</p>
          <Formula bloque tex="C=\frac{\kappa\,\varepsilon_0 A}{d},\qquad E=\frac{V}{d}=\frac{\sigma}{\kappa\varepsilon_0}" />
          <p>
            Un <strong>dieléctrico</strong> se polariza en el campo: sus moléculas se orientan y aparece una carga ligada σᵢ = σ(1 − 1/κ)
            en sus caras que reduce el campo interior. Por eso C aumenta κ veces. Si el capacitor sigue conectado a la batería, V es
            fija y la carga aumenta; si está aislado, Q es fija y el voltaje disminuye. Si el campo supera la{' '}
            <strong>rigidez dieléctrica</strong> del material, este se vuelve conductor (ruptura).
          </p>
          <p>Asociaciones:</p>
          <Formula bloque tex="\text{Serie: }\frac{1}{C_{eq}}=\sum_i\frac{1}{C_i}\qquad \text{Paralelo: }C_{eq}=\sum_i C_i" />
        </>
      }
    />
  );
}
