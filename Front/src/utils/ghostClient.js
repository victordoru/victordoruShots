// ghostClient.js
import GhostContentAPI from '@tryghost/content-api';
const api = new GhostContentAPI({
  url: 'https://blog.winto.app',
  key: import.meta.env.VITE_GHOST_CONTENT_API_KEY,
  version: 'v5.0'
});

export default api;
