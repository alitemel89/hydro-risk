export function validateArea(input) {
  if (!input || typeof input !== 'object') throw new Error('Alan bilgisi gerekli');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 120) throw new Error('Alan adı 1–120 karakter olmalı');
  const g = input.geometry;
  if (g?.type !== 'Polygon' || !Array.isArray(g.coordinates) || g.coordinates.length !== 1) throw new Error('Tek dış halkalı GeoJSON Polygon gerekli');
  const ring = g.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > 1001) throw new Error('3–1000 köşe gerekli');
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length !== 2 || !pt.every(Number.isFinite) || Math.abs(pt[0]) > 180 || Math.abs(pt[1]) > 85) throw new Error('Geçersiz boylam/enlem');
  }
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw new Error('Polygon kapalı olmalı');
  if (new Set(ring.slice(0,-1).map(p=>p.join(','))).size !== ring.length - 1) throw new Error('Tekrarlanan köşe');
  return {name, geometry:{type:'Polygon',coordinates:[ring.map(p=>[...p])]}};
}
