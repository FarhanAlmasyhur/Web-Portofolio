/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        "young-blue": "#99BCF0",
        "light-blue-gradient": "#102C57",
        "dark-blue-gradient": "#080F15",
      },
    },
  },
  plugins: [],
};
