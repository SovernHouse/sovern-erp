export default {
  content: ['./index.html', './src/**/*.{js,jsx}', '../shared/src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        factory: {
          50: '#fffbf0',
          100: '#fef3e2',
          200: '#fde4c4',
          300: '#fccf97',
          400: '#fab567',
          500: '#f59e3f',
          600: '#e67e22',
          700: '#d35400',
          800: '#b84600',
          900: '#7a2d0c',
        },
      },
    },
  },
  plugins: [],
};
