/* ============================================================
   COMPRALOCAL — ÍCONOS (SVG de trazo)
   ============================================================ */
(function () {
  const PATHS = {
    arrow: '<path d="m9 18 6-6-6-6" />',
    back: '<path d="m15 18-6-6 6-6" />',
    check: '<path d="m5 12 4 4L19 6" />',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" />',
    google: '<path d="M21 12.2a9 9 0 1 1-2.6-6.4" /><path d="M21 12h-9M17 12c0 3-2 5-5 5" />',
    image: '<rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="2" /><path d="m21 15-5-5L5 20" />',
    info: '<circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />',
    location: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />',
    shop: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M8 20v-6h5v6" /><path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2" />',
    user: '<circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />',
    users: '<circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a6 6 0 0 1 4 6" />',
    upload: '<path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 14v6h14v-6" />',
    ball: '<circle cx="12" cy="12" r="9" /><path d="m8 5 4 3 4-3M6 15l2-5h8l2 5M8 20v-5h8v5" />',
    cart: '<circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M3 4h2l2.4 11h10.8l2-7H6" />',
    close: '<path d="m6 6 12 12M18 6 6 18" />',
    food: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18M17 3c3 2 3 8 0 10" />',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" />',
    heart: '<path d="M20.8 5.7a5.3 5.3 0 0 0-7.5 0L12 7l-1.3-1.3a5.3 5.3 0 1 0-7.5 7.5L12 22l8.8-8.8a5.3 5.3 0 0 0 0-7.5Z" />',
    home: '<path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" />',
    laptop: '<rect x="5" y="4" width="14" height="11" rx="1" /><path d="M3 19h18l-2-4H5l-2 4Z" />',
    menu: '<path d="M4 7h16M4 12h16M4 17h16" />',
    phone: '<path d="M6 3h4l2 5-3 2a15 15 0 0 0 5 5l2-3 5 2v4c0 2-2 3-4 3A17 17 0 0 1 3 7c0-2 1-4 3-4Z" />',
    search: '<circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />',
    shirt: '<path d="m8 4-5 3 3 5 2-1v9h8v-9l2 1 3-5-5-3a4 4 0 0 1-8 0Z" />',
    sparkle: '<path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" /><path d="m18 15 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />',
    tools: '<path d="m14 7 3-3 3 3-3 3M14 7 4 17l3 3 10-10M5 5l5 5" />',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" />',
    shopping: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />',
    truck: '<path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />',
    
    // Nuevos íconos específicos para rubros y categorías
    appliances: '<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M5 9h14" /><circle cx="9" cy="14" r="2" /><line x1="15" y1="13" x2="17" y2="13" /><line x1="15" y1="15" x2="17" y2="15" />',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-3-4H9L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />',
    pet: '<circle cx="6" cy="10" r="2.5" /><circle cx="18" cy="10" r="2.5" /><circle cx="9" cy="5" r="2" /><circle cx="15" cy="5" r="2" /><path d="M12 13c-3 0-5 2-5 5s2 3 5 3 5-1 5-3-2-5-5-5z" />',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />',
    plant: '<path d="M12 22v-8" /><path d="M12 14c0-4-3-7-7-7 0 5 3 7 7 7z" /><path d="M12 14c0-4 3-7 7-7 0 5-3 7-7 7z" />',
    music: '<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />',
    map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />'
  };

  /** Devuelve el SVG (string) del ícono name. */
  window.Icon = function Icon(name, size = 20) {
    return `<svg aria-hidden="true" class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || PATHS['grid']}</svg>`;
  };
})();