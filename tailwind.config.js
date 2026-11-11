/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Grafito cálido para superficies y cobre para la navegación y los controles.
        slate: {
          50: '#faf8f5', 100: '#f4f0eb', 200: '#e8e1d9', 300: '#d2c8bd',
          400: '#b8ada1', 500: '#9d9084', 600: '#71655b', 700: '#504740',
          800: '#39322e', 900: '#27221f', 950: '#181513',
        },
        sky: {
          50: '#fff7eb', 100: '#ffebd1', 200: '#ffdbad', 300: '#f6c38c',
          400: '#e9a663', 500: '#b77037', 600: '#915226', 700: '#74411f',
          800: '#5a331d', 900: '#472b1c', 950: '#301e16',
        },
        // Colores físicos usados en toda la app (carga +, carga −, campo B)
        positiva: '#ef4444',
        negativa: '#3b82f6',
        magnetico: '#a855f7',
      },
    },
  },
  plugins: [],
};
