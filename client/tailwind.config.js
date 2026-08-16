/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a4d3e',
          dark: '#0f2e26',
          light: '#2a6b58',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#f0d060',
          dark: '#a8892a',
        },
        chip: {
          white: '#f5f5f0',
          yellow: '#ffd54f',
          orange: '#ff9800',
          red: '#ef5350',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 14px rgba(0,0,0,0.45)',
        chip: '0 2px 8px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
