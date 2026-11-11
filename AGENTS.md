# AGENTS.md — Simulador EM (Física 2, UPeU)

Producto final del curso Física 2 (Ingeniería de Sistemas, UPeU): **Simulador interactivo de campos
eléctricos y magnéticos en 2D/3D**. Aplicación web con 9 módulos agrupados en 4 unidades.

## Idioma
Toda la interfaz, comentarios y documentación en **español**.

## Stack (obligatorio)
Vite + React 18 + TypeScript (strict) · Three.js con @react-three/fiber v8 y @react-three/drei v9 ·
Canvas 2D nativo · Recharts · Tailwind CSS v3 (tema oscuro por defecto) · Zustand · KaTeX (react-katex) ·
React Router (HashRouter, por GitHub Pages) · Vitest · despliegue en GitHub Pages (`base: '/simulador-em/'`).

## Comandos
- `npm run dev` — servidor de desarrollo
- `npm run build` — verificación de tipos + build de producción
- `npm test` — pruebas (Vitest)

## Arquitectura: separar FÍSICA de INTERFAZ
- `src/physics/` — funciones puras, **sin React**, 100 % testeadas. Archivos previstos: `constants.ts`,
  `vector.ts`, `electrostatics.ts`, `fieldLines.ts` (RK4), `equipotential.ts` (marching squares),
  `capacitor.ts`, `circuits.ts` (MNA + Gauss), `magnetism.ts` (Biot–Savart), `integrators.ts` (RK4, Boris).
- `src/physics/__tests__/` — pruebas contra resultados analíticos (error < 1 %).
- `src/modules/` — un componente (página) por módulo. `registry.ts` define unidades y módulos; el menú,
  la página de inicio y el router se generan desde ahí.
- `src/components/` — UI reutilizable: `ModuloLayout` (simulación al centro + panel derecho + botón
  Teoría), `Modal`, `Slider`, `Formula`, `PanelFormulas`, `PanelResultados`, `formato.ts` (`formatearSI`).
- `src/store/` — estado global con Zustand.

## Reglas
- No usar librerías de física ya hechas: toda la física se implementa en `physics/`.
- Unidades SI internamente; mostrar unidades SI en todos los resultados (notación científica con
  `formatearSI` cuando corresponda).
- Comentarios en español explicando la física, incluyendo la fórmula.
- Movimiento en campo magnético: integrador de **Boris** (no Euler). Trayectorias en E: RK4.
- Evitar singularidades cerca de cargas puntuales con un radio mínimo de suavizado.
- Rendimiento: `requestAnimationFrame`, `useMemo`, Web Workers si el cálculo es pesado. Objetivo 60 FPS.
  Los módulos se cargan con `lazy()` desde `App.tsx`; `vite.config.ts` separa las librerías en chunks
  `vendor-*` (no importar Three.js ni Recharts desde código que use la página de inicio). Los lienzos
  solo se animan mientras la simulación corre. Las líneas de B se trazan en `magnetico/lineas.worker.ts`.
- Cada módulo nuevo debe agregarse en `modules/registry.ts` (con `instrucciones`) y en `COMPONENTES` de `App.tsx`.
- Despliegue: `.github/workflows/deploy.yml` (GitHub Pages; `BASE_PATH` = nombre del repositorio).
- Responsive.
- Trabajo por fases (ver README). Al terminar cada fase: `npm run build` y `npm test` sin errores,
  resumen corto de lo hecho y cómo probarlo, y commit descriptivo.
