/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bg: '#070810',
        surface: '#0d0f1a',
        surface2: '#12152a',
        surface3: '#1a1f38',
        accent: '#4f8eff',
        accent2: '#7c5cfc',
        accent3: '#00e5b0',
        danger: '#ff4f6a',
        warn: '#ffb84f',
      }
    }
  },
  plugins: []
}
