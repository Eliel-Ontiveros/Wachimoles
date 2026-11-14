// Inicializa el modo de esquema de color en 'class' antes de que NativeWind observe el DOM web
if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.style.setProperty('--css-interop-darkMode', 'class dark');
}
