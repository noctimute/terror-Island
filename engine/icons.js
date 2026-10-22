// Small stroke icons (24×24) for carried items, drawn with currentColor.
const P = {
  lantern: '<path d="M12 3v2M8 6h8M8 18h8M12 18v3"/><path d="M8 6c-2 3-2 9 0 12M16 6c2 3 2 9 0 12M12 6v12"/>',
  ticket: '<path d="M4 7h16v3a2 2 0 000 4v3H4v-3a2 2 0 000-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  bandage: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="M10.5 11.5h.01M13.5 12.5h.01"/>',
  straw: '<path d="M12 21V9M12 9c-3-2-5-5-5-7M12 9c3-2 5-5 5-7M12 13c-2-1-4-3-5-5M12 13c2-1 4-3 5-5"/>',
  thread: '<circle cx="9" cy="9" r="5"/><path d="M14 9c4 0 6 3 6 6s-3 5-6 4-4-4-1-6"/>',
  seed: '<path d="M12 21v-7"/><path d="M12 14c-4 0-6-3-6-7 4 0 6 3 6 7zM12 14c4 0 6-3 6-7-4 0-6 3-6 7z"/>',
  balloon: '<ellipse cx="12" cy="9" rx="5" ry="6"/><path d="M12 15l-1 2h2l-1-2M12 17c0 2-2 2-1 5"/>',
  umbrella: '<path d="M3 12a9 9 0 0118 0z"/><path d="M12 12v7a2 2 0 01-4 0"/>',
  cake: '<rect x="4" y="9" width="16" height="10" rx="1"/><path d="M4 13h16M12 9v10M9 6c0-2 3-2 3 0 0-2 3-2 3 0"/>',
  film: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="7" r="1.5"/><circle cx="17" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/><circle cx="7" cy="12" r="1.5"/>',
  bale: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M9 11.5l2 1.5M14 14l1.5 1"/>',
  bucket: '<path d="M5 8h14l-1.5 12h-11z"/><path d="M4 8h16M8 8a4 4 0 018 0M9 13h6"/>',
  civic: '<path d="M4 20h16M6 20V10M18 20V10M10 20v-6h4v6M3 10l9-6 9 6z"/>',
  talisman: '<path d="M7 3h10v18l-5-3-5 3z"/><path d="M10 7h4M12 7v8M10 11l4 2"/>',
  skull: '<path d="M12 3a7 7 0 00-7 7c0 2.6 1.3 4.2 3 5v3h8v-3c1.7-.8 3-2.4 3-5a7 7 0 00-7-7z"/><circle cx="9.5" cy="10.5" r="1.5"/><circle cx="14.5" cy="10.5" r="1.5"/><path d="M10 18v3M14 18v3"/>',
};

export function icon(name, cls = "ico") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.skull}</svg>`;
}

export function skulls(n, max = 5) {
  let s = "";
  for (let i = 0; i < max; i++) s += `<span class="sk${i < n ? " on" : ""}">${icon("skull", "ico sk-i")}</span>`;
  return `<span class="skulls" aria-label="危險度 ${n} / ${max}">${s}</span>`;
}
