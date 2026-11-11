import { useState } from 'react';
import ModuloLayout from '../../components/ModuloLayout';
import PanelFormulas from '../../components/PanelFormulas';
import Slider from '../../components/Slider';
import Formula from '../../components/Formula';
import { Interruptor, Segmentado } from '../../components/controles';
import { formatearSI } from '../../components/formato';
import { useCargasStore } from '../../store/useCargasStore';
import LienzoCargas, { type Capas } from './LienzoCargas';
import PanelCargas from './PanelCargas';
import Escena3DCargas from './Escena3DCargas';

/** Módulo 1 — Visualizador de cargas puntuales (2D y 3D). */
export default function VisualizadorCargas() {
  const cargas = useCargasStore((s) => s.cargas);
  const [modo, setModo] = useState<'2d' | '3d'>('2d');
  const [capas, setCapas] = useState<Required<Capas>>({ mapa: false, vectores: false, lineas: true, equipotenciales: false });
  const [densidad, setDensidad] = useState(6);
  const [lineas3D, setLineas3D] = useState(true);
  const [iso, setIso] = useState(false);
  const [expIso, setExpIso] = useState(4.5); // nivel de la isosuperficie: V = 10^exp V

  const capa = (k: keyof Capas, etiqueta: string) => (
    <Interruptor etiqueta={etiqueta} activo={capas[k]} onChange={(v) => setCapas({ ...capas, [k]: v })} />
  );

  return (
    <ModuloLayout
      titulo="Visualizador de cargas puntuales"
      explicacion={cargas.length === 0 ? 'Agrega una carga para ver cómo aparece su campo eléctrico.'
        : modo === '3d' ? (iso ? 'Cada superficie reúne puntos con el mismo potencial eléctrico.' : 'Gira la escena para ver cómo se distribuyen las líneas en el espacio.')
        : capas.equipotenciales ? 'Cada curva equipotencial une puntos con el mismo potencial eléctrico.'
        : capas.mapa ? 'El mapa de colores representa el potencial eléctrico en cada punto.'
        : cargas.length === 2 && cargas[0].q === cargas[1].q && cargas[0].q !== 0
          ? 'Entre dos cargas iguales, los campos se cancelan justo en el punto medio.'
          : 'Las líneas de campo salen de las cargas positivas y entran en las negativas. Mueve una carga para ver cómo se reorganizan.'}
      simulacion={
        modo === '2d' ? (
          <LienzoCargas cargas={cargas} capas={capas} densidadLineas={densidad} editable etiqueta="Campo eléctrico de las cargas en 2D" />
        ) : (
          <Escena3DCargas
            cargas={cargas}
            lineasPorMicroC={2 * densidad /* en 3D las líneas se reparten sobre una esfera: hacen falta más */}
            mostrarLineas={lineas3D}
            mostrarIso={iso}
            nivelIso={Math.pow(10, expIso)}
          />
        )
      }
      panel={
        <>
          <Segmentado
            opciones={[
              { valor: '2d', etiqueta: 'Vista 2D' },
              { valor: '3d', etiqueta: 'Vista 3D' },
            ]}
            valor={modo}
            onChange={setModo}
          />
          <div className="tarjeta space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Capas</h3>
            {modo === '2d' ? (
              <div className="grid grid-cols-2 gap-2">
                {capa('lineas', 'Líneas de campo')}
                {capa('equipotenciales', 'Equipotenciales')}
                {capa('mapa', 'Mapa de potencial')}
                {capa('vectores', 'Vectores E')}
              </div>
            ) : (
              <div className="space-y-2">
                <Interruptor etiqueta="Líneas de campo 3D" activo={lineas3D} onChange={setLineas3D} />
                <Interruptor etiqueta="Superficies equipotenciales" activo={iso} onChange={setIso} />
                {iso && (
                  <Slider
                    etiqueta="Nivel ±V₀"
                    valor={expIso}
                    min={3.5}
                    max={6}
                    paso={0.05}
                    formato={(e) => formatearSI(Math.pow(10, e), 3)}
                    unidad="V"
                    onChange={setExpIso}
                  />
                )}
                <p className="text-xs text-slate-500">Arrastra para rotar, rueda para zoom. Las cargas se editan en la vista 2D.</p>
              </div>
            )}
            <Slider etiqueta="Densidad de líneas" valor={densidad} min={2} max={12} paso={1} unidad="por μC" onChange={setDensidad} />
          </div>
          <PanelCargas />
          <div className="tarjeta space-y-1 text-xs text-slate-400">
            <p>
              <span className="text-positiva">■</span> V &gt; 0 &nbsp; <span className="text-negativa">■</span> V &lt; 0 &nbsp; ┅ V = 0
            </p>
            <p>Equipotenciales en 0 V y ±1 kV·(√2)ᵏ. Las líneas de campo son siempre perpendiculares a ellas.</p>
          </div>
          <PanelFormulas
            formulas={[
              { tex: '\\vec E(\\vec r)=\\sum_i \\frac{k\\,q_i}{|\\vec r-\\vec r_i|^{2}}\\,\\hat r_i', descripcion: 'Principio de superposición' },
              { tex: 'V(\\vec r)=\\sum_i \\frac{k\\,q_i}{|\\vec r-\\vec r_i|}', descripcion: 'Potencial (V = 0 en el infinito)' },
              { tex: '\\vec E=-\\nabla V', descripcion: 'E apunta hacia donde V disminuye más rápido' },
            ]}
          />
        </>
      }
      teoria={
        <>
          <p>
            Una carga puntual q crea a su alrededor un <strong>campo eléctrico</strong> radial cuya magnitud disminuye con el
            cuadrado de la distancia (ley de Coulomb):
          </p>
          <Formula bloque tex="\vec E=\frac{k\,q}{r^{2}}\,\hat r,\qquad k=\frac{1}{4\pi\varepsilon_0}=8.99\times10^{9}\ \mathrm{N\,m^2/C^2}" />
          <p>
            Con varias cargas, el campo total es la <strong>suma vectorial</strong> de los campos de cada una (superposición). El
            potencial, en cambio, es una suma escalar:
          </p>
          <Formula bloque tex="V=\sum_i \frac{k\,q_i}{r_i}" />
          <p>
            Las <strong>líneas de campo</strong> son tangentes a E en cada punto: nacen en cargas positivas y terminan en
            negativas (o en el infinito), y su número es proporcional a la carga (ley de Gauss, Φ = q/ε₀). Aquí se trazan
            resolviendo dr/ds = E/|E| con el método de Runge–Kutta de orden 4.
          </p>
          <p>
            Las <strong>equipotenciales</strong> unen puntos con el mismo V y son perpendiculares a las líneas de campo, pues
            E = −∇V. Se calculan con el algoritmo <em>marching squares</em> en 2D y <em>surface nets</em> en 3D.
          </p>
          <p>
            Para evitar la singularidad r → 0 se usa un radio mínimo de suavizado r<sub>min</sub> = 2 cm dentro de cada carga.
          </p>
        </>
      }
    />
  );
}
