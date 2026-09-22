import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 900: '#140F1A', 800: '#1C1524', 700: '#251C30' },
        accent: { gold: '#F2A93B', mint: '#5EEAD4', coral: '#FF6B57', violet: '#B39CFF' }
      }
    }
  },
  plugins: []
};

export default config;
