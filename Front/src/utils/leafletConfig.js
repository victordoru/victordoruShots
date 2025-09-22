// src/utils/leafletConfig.js
import L from 'leaflet';

// Importar las imágenes de los iconos utilizando importaciones ESM
// import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// import markerIcon from 'leaflet/dist/images/marker-icon.png';
// import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import 'leaflet-extra-markers/dist/css/leaflet.extra-markers.min.css';
import 'leaflet-extra-markers';

// import markerIcon2x from '/icon.png';
// import markerIcon from '/icon.png';
// import markerShadow from 'leaflet/dist/images/marker-shadow.png';


// Crear un icono personalizado usando Leaflet.AwesomeMarkers
// export const awesomeMarker = L.AwesomeMarkers.icon({
//   icon: 'glass', // Nombre del icono de Font Awesome
//   prefix: 'fa', // Prefijo de Font Awesome
//   markerColor: 'red', // Colores disponibles: red, blue, green, orange, purple, dark
// });



// Crear un icono personalizado usando Leaflet.ExtraMarkers
export const awesomeMarker = L.ExtraMarkers.icon({
  icon: 'fa-map-marker', // Puedes usar iconos de Font Awesome
  markerColor: 'red',
  shape: 'penta', // 'circle' o 'square' 'star' 'penta' 'hexa' 'octa'
  prefix: 'fa', // Prefix de Font Awesome
});

// Configurar los iconos predeterminados de Leaflet
// delete L.Icon.Default.prototype._getIconUrl;

// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: markerIcon2x,
//   iconUrl: markerIcon,
//   shadowUrl: markerShadow,
// });