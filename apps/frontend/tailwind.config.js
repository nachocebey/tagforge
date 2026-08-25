/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Anton', 'Impact', 'sans-serif'],
        sans: ['Barlow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        forge: {
          bg: '#100c0a',
          surface: '#1c1512',
          'surface-hover': '#251c17',
          border: '#3a2c22',
          ember: '#ff7a1a',
          'ember-dark': '#d9600a',
          text: '#f3ead9',
          'text-muted': '#a89584',
        },
      },
    },
  },
  plugins: [],
}
