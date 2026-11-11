import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { MODULOS } from '../modules/registry';
import Modal from './Modal';
import GuiaSimulacion from './GuiaSimulacion';

interface Props {
  titulo: string;
  explicacion: string;
  /** Área central de simulación (Canvas 2D o escena 3D) */
  simulacion: ReactNode;
  /** Panel derecho: controles, fórmulas y resultados */
  panel: ReactNode;
  /** Contenido del modal de teoría */
  teoria?: ReactNode;
}

/**
 * Plantilla común a los 9 módulos: simulación al centro y panel a la derecha.
 * En pantallas angostas la simulación ocupa la parte superior y el panel queda debajo.
 */
export default function ModuloLayout({ titulo, explicacion, simulacion, panel, teoria }: Props) {
  const [verTeoria, setVerTeoria] = useState(false);
  const { pathname } = useLocation();
  const modulo = MODULOS.find((m) => `/${m.ruta}` === pathname);

  useEffect(() => {
    document.title = `${titulo} — Simulador EM`;
    return () => {
      document.title = 'Simulador EM — Física 2';
    };
  }, [titulo]);

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
      <section className="relative min-h-[60vh] bg-slate-950 lg:min-h-0 lg:flex-1">{simulacion}</section>
      <aside className="w-full space-y-4 border-t border-slate-800 bg-slate-900/50 p-4 lg:w-96 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{titulo}</h1>
          {teoria && (
            <button className="boton shrink-0" onClick={() => setVerTeoria(true)}>
              Teoría
            </button>
          )}
        </div>
        <GuiaSimulacion key={pathname} explicacion={explicacion} />
        {panel}
      </aside>
      {teoria && (
        <Modal abierto={verTeoria} titulo={`Teoría — ${titulo}`} onCerrar={() => setVerTeoria(false)}>
          {modulo && (
            <div className="rounded-lg border border-sky-900/60 bg-sky-950/30 p-3">
              <h3 className="mb-1 font-semibold text-sky-300">Cómo usar este módulo</h3>
              <ol className="list-decimal space-y-0.5 pl-5">
                {modulo.instrucciones.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          )}
          {teoria}
        </Modal>
      )}
    </div>
  );
}
