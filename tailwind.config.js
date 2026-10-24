/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'stratefix-yellow': '#FDB913',
        'stratefix-black': '#000000',
        // Greys are a step darker than Tailwind's so secondary text stays readable on laptops.
        gray: {
          50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
          400: '#8b93a1', 500: '#5f6877', 600: '#454d5b', 700: '#333a46', 800: '#1f2530', 900: '#111318',
        },
      },
    },
  },
  plugins: [],
};
