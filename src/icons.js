'use strict';
// Jednoduché stroke ikony 24×24
const ICONS = {
  select: '<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 2.5"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6-6 6-2.6 0-4.2-1.4-5.2-3.2L4 13.5a1.4 1.4 0 0 1 2.3-1.5L8 13.5"/>',
  brush: '<path d="M20 4c-5 1-9 5-10.5 9.5"/><path d="M9.5 13.5C7 13 5 15 5 17.5c0 1.5-1 2.5-2 2.5 3 1.5 8 1 9-2.5.7-2.400-.5-3.600-2.500-4z"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  marker: '<path d="M6 20h5"/><path d="M14 4l6 6-8 8-6-6z"/><path d="M9 15l-3 5"/>',
  spray: '<rect x="4" y="11" width="8" height="10" rx="1.500"/><path d="M6 11V8h4v3"/><circle cx="16" cy="6" r=".6"/><circle cx="19" cy="9" r=".6"/><circle cx="16" cy="10" r=".6"/><circle cx="19" cy="4" r=".6"/><circle cx="21" cy="7" r=".6"/>',
  calligraphy: '<path d="M4 20c4-1 6-3 8-8l4-4 4 4-4 4c-5 2-7 4-8 8z" transform="translate(-0 -2)"/><path d="M12 12l3 3"/>',
  eraser: '<path d="M15 4l5 5-9 10H7l-3-3z"/><path d="M9 10l5 5"/><path d="M11 19h9"/>',
  fill: '<path d="M5 11l7-7 7 7-7 7z"/><path d="M5 11h14"/><path d="M20 14c1 2 2 3 2 4.500a2 2 0 0 1-4 0c0-1.500 1-2.500 2-4.500z"/>',
  gradient: '<rect x="4" y="4" width="16" height="16" rx="1.500"/><path d="M8 4v16M12 4v16M16 4v16" opacity=".45"/>',
  picker: '<path d="M20 4a2.500 2.500 0 0 0-3.500 0L13 7.500l-1-1-2 2 8 8 2-2-1-1L21 10a2.500 2.500 0 0 0-1-6z" transform="translate(0 0)"/><path d="M11 10l-7 7-1 4 4-1 7-7"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  line: '<path d="M5 19L19 5"/>',
  arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
  rect: '<rect x="4" y="6" width="16" height="12"/>',
  rrect: '<rect x="4" y="6" width="16" height="12" rx="4"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6"/>',
  triangle: '<path d="M12 4l9 16H3z"/>',
  star: '<path d="M12 3l2.900 6 6.600.800-4.900 4.500L18 21l-6-3.400L6 21l1.400-6.700L2.500 9.800 9.100 9z"/>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}
