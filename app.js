/* Election Pins App (Leaflet + local data.json) */
let map;
let markersLayer;
let userMarker = null;

// District-colored pins (ตามเขตเลือกตั้ง)
const pinIcons = {
  1: L.icon({ iconUrl: './marker_d1_purple.svg', iconSize: [34,34], iconAnchor: [17,34], popupAnchor: [0,-30]}),
  2: L.icon({ iconUrl: './marker_d2_gold.svg',   iconSize: [34,34], iconAnchor: [17,34], popupAnchor: [0,-30]}),
  3: L.icon({ iconUrl: './marker_d3_blue.svg',   iconSize: [34,34], iconAnchor: [17,34], popupAnchor: [0,-30]}),
  0: L.icon({ iconUrl: './marker.svg',           iconSize: [34,34], iconAnchor: [17,34], popupAnchor: [0,-30]})
};

function iconFor(r){
  const d = Number(r.เขตเลือกตั้ง || 0);
  return pinIcons[d] || pinIcons[0];
}

const state = {
  all: [],
  filtered: [],
  byId: new Map()
};

function el(id){ return document.getElementById(id); }

function formatMeta(r){
  const parts = [];
  if (r.หน่วยเลือกตั้ง != null) parts.push(`หน่วยเลือกตั้งที่ ${r.หน่วยเลือกตั้ง}`);
  if (r.หมู่ที่ != null) parts.push(`หมู่ ${r.หมู่ที่}`);
  return parts.length ? parts.join(" • ") : "—";
}

function googleDirLink(lat,lng){
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function buildPopup(r){
  const safeName = (r.ชื่อสถานที่เลือกตั้ง || "").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const meta = formatMeta(r);
  const nav = googleDirLink(r.lat, r.lng);
  const open = r.ลิงก์ || nav;

  return `
    <div style="font-family:ui-sans-serif,system-ui; min-width:220px">
      <div style="font-weight:800; margin-bottom:6px">${safeName}</div>
      <div style="color:#6b7280; font-size:12px; margin-bottom:10px">${meta}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <a href="${nav}" target="_blank" rel="noopener" style="padding:8px 10px; border-radius:10px; background:#d4af37; color:#2a1200; font-weight:800; text-decoration:none">นำทาง</a>
        <a href="${open}" target="_blank" rel="noopener" style="padding:8px 10px; border-radius:10px; border:1px solid #3a1460; color:#1f2937; font-weight:800; text-decoration:none">เปิดลิงก์</a>
      </div>
      <div style="margin-top:10px; color:#9ca3af; font-size:11px">
        พิกัด: ${r.lat?.toFixed?.(6)}, ${r.lng?.toFixed?.(6)}
      </div>
    </div>
  `;
}

function initMap(){
  map = L.map('map', { zoomControl: true }).setView([13.865, 100.456], 13);

  // OSM tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function renderMarkers(rows){
  markersLayer.clearLayers();
  rows.forEach(r => {
    if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return;
    const m = L.marker([r.lat, r.lng], { icon: iconFor(r) }).addTo(markersLayer);
    m.bindPopup(buildPopup(r));
    state.byId.set(getId(r), m);
  });
}

function getId(r){
  // stable-ish id
  return `${r.เขตเลือกตั้ง ?? 'x'}-${r.หน่วยเลือกตั้ง ?? 'x'}-${r.หมู่ที่ ?? 'x'}-${(r.ลิงก์||'').slice(-6)}`;
}

function renderList(rows){
  const list = el('list');
  list.innerHTML = '';
  rows.forEach(r => {
    const id = getId(r);
    const div = document.createElement('div');
    div.className = 'item';
    div.setAttribute('role','listitem');
    div.dataset.id = id;

    const meta = formatMeta(r);
    const link = r.ลิงก์ || googleDirLink(r.lat, r.lng);

    div.innerHTML = `
      <div class="meta">
        <span class="badge">${r.หน่วยเลือกตั้ง != null ? 'หน่วยเลือกตั้งที่ '+r.หน่วยเลือกตั้ง : 'หน่วย -'}</span>
        <span class="badge">${r.หมู่ที่ != null ? 'หมู่ '+r.หมู่ที่ : 'หมู่ -'}</span>
      </div>
      <div class="name">${r.ชื่อสถานที่เลือกตั้ง || '-'}</div>
      <a class="link" href="${link}" target="_blank" rel="noopener">เปิดลิงก์สถานที่</a>
    `;

    div.addEventListener('click', (e) => {
      // avoid hijacking link click
      if (e.target && e.target.tagName === 'A') return;
      focusRow(r);
    });

    list.appendChild(div);
  });

  if (!rows.length){
    list.innerHTML = '<div style="color:#9ca3af; padding:14px">ไม่พบรายการที่ตรงเงื่อนไข (ลองพิมพ์น้อยลงหน่อย—ความจริงก็เหมือนกัน)</div>';
  }
}

function focusRow(r){
  if (typeof r.lat === 'number' && typeof r.lng === 'number'){
    map.setView([r.lat, r.lng], Math.max(map.getZoom(), 16), { animate:true });
    const m = state.byId.get(getId(r));
    if (m) m.openPopup();
  } else {
    window.open(r.ลิงก์, '_blank');
  }
}

function uniqueSorted(arr){
  return Array.from(new Set(arr)).sort((a,b)=> (a??0) - (b??0));
}

function setupFilters(){
  const mooSel = el('filterMoo');
  const moos = uniqueSorted(state.all.map(r => r.หมู่ที่).filter(v => v!=null));

  moos.forEach(v => {
    const o=document.createElement('option');
    o.value=String(v);
    o.textContent=`หมู่ ${v}`;
    mooSel.appendChild(o);
  });

  ['q','filterMoo'].forEach(id => {
    el(id).addEventListener('input', applyFilters);
    el(id).addEventListener('change', applyFilters);
  });

  el('btnFit').addEventListener('click', fitAll);
  el('btnLocate').addEventListener('click', locateUser);
}

function normalizeSearchText(value){
  return String(value ?? '')
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/[.,()\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSearchText(value){
  return normalizeSearchText(value).replace(/\s+/g,'');
}

function extractNumber(query, labels){
  const q = normalizeSearchText(query);
  for (const label of labels){
    const re = new RegExp(label + '\\s*(?:ที่\\s*)?(\\d+)', 'i');
    const m = q.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

function smartMatches(r, rawQuery){
  const q = normalizeSearchText(rawQuery);
  const qc = compactSearchText(rawQuery);
  if (!q) return true;

  const district = Number(r.เขตเลือกตั้ง ?? 0);
  const unit = Number(r.หน่วยเลือกตั้ง ?? 0);
  const moo = Number(r.หมู่ที่ ?? 0);

  // เข้าใจคำที่ผู้ใช้มักพิมพ์จริง
  const qDistrict = extractNumber(q, ['เขตเลือกตั้ง', 'เขต']);
  const qUnit = extractNumber(q, ['หน่วยเลือกตั้ง', 'หน่วย']);
  const qMoo = extractNumber(q, ['หมู่ที่', 'หมู่', 'ม']);

  if (qDistrict !== null && district !== qDistrict) return false;
  if (qUnit !== null && unit !== qUnit) return false;
  if (qMoo !== null && moo !== qMoo) return false;

  // ถ้าพิมพ์เป็นตัวเลขล้วน เช่น "5" ให้หาได้ทั้งหน่วย/หมู่/เขต
  if (/^\d+$/.test(q)){
    const n = Number(q);
    return unit === n || moo === n;
  }

  // สร้างคลังคำค้นทั้งแบบเว้นวรรคและไม่เว้นวรรค
  const searchable = [
    r.ชื่อสถานที่เลือกตั้ง ?? '',
    `หน่วย ${unit}`, `หน่วย${unit}`, `หน่วยที่ ${unit}`, `หน่วยเลือกตั้ง ${unit}`, `หน่วยเลือกตั้งที่ ${unit}`,
    `หมู่ ${moo}`, `หมู่${moo}`, `หมู่ที่ ${moo}`, `ม ${moo}`, `ม.${moo}`,
  ];

  const hay = normalizeSearchText(searchable.join(' '));
  const hayCompact = compactSearchText(searchable.join(' '));

  // ตัดคำบอกประเภทออก เพื่อเหลือ keyword สถานที่
  let keyword = q
    .replace(/เขตเลือกตั้ง\s*(?:ที่\s*)?\d+/g,' ')
    .replace(/เขต\s*(?:ที่\s*)?\d+/g,' ')
    .replace(/หน่วยเลือกตั้ง\s*(?:ที่\s*)?\d+/g,' ')
    .replace(/หน่วย\s*(?:ที่\s*)?\d+/g,' ')
    .replace(/หมู่ที่\s*\d+/g,' ')
    .replace(/หมู่\s*(?:ที่\s*)?\d+/g,' ')
    .replace(/ม\.?\s*\d+/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  // ถ้ามีเงื่อนไขเขต/หน่วย/หมู่แล้ว และไม่มี keyword อื่น ถือว่าตรง
  if (!keyword && (qDistrict !== null || qUnit !== null || qMoo !== null)) return true;

  // รองรับการพิมพ์ติดกัน เช่น เขต1, หน่วย5, หมู่3
  if (hay.includes(q) || hayCompact.includes(qc)) return true;

  // ค้นคำสถานที่หลายคำแบบ AND เช่น "เพอร์เฟค ราชพฤกษ์"
  if (keyword){
    const words = keyword.split(' ').filter(Boolean);
    return words.every(w => hay.includes(w) || hayCompact.includes(w.replace(/\s+/g,'')));
  }

  return false;
}

function updateSearchFeedback(rows, query){
  let box = document.getElementById('searchFeedback');
  if (!box){
    box = document.createElement('div');
    box.id = 'searchFeedback';
    box.className = 'search-feedback';
    const filters = document.querySelector('.filters');
    if (filters) filters.appendChild(box);
  }

  const q = (query || '').trim();
  if (!q){
    box.textContent = '';
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';
  if (rows.length){
    box.textContent = `พบ ${rows.length} หน่วย จากคำค้น “${q}”`;
  }else{
    box.innerHTML = `ไม่พบข้อมูลจาก “${q}”<br><small>ลองพิมพ์ เช่น เขต 1, หน่วย 5, หมู่ 3, วัดบางรักน้อย หรือ เพอร์เฟค</small>`;
  }
}

function applyFilters(){
  const q = (el('q').value || '').trim();
  const moo = el('filterMoo').value;

  let rows = state.all.slice();

  if (moo) rows = rows.filter(r => String(r.หมู่ที่ ?? '') === moo);

  if (q) rows = rows.filter(r => smartMatches(r, q));

  state.filtered = rows;
  renderMarkers(rows);
  renderList(rows);
  updateSearchFeedback(rows, q);

  // ถ้าพบรายการเดียว ให้ซูมไปยังหน่วยนั้นอัตโนมัติแบบนุ่มนวล
  if (q && rows.length === 1 && typeof rows[0].lat === 'number' && typeof rows[0].lng === 'number'){
    map.setView([rows[0].lat, rows[0].lng], Math.max(map.getZoom(), 16), {animate:true});
  }
}

function fitAll(){
  const pts = state.filtered.length ? state.filtered : state.all;
  const latlngs = pts
    .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number')
    .map(r => [r.lat, r.lng]);

  if (!latlngs.length) return;
  const bounds = L.latLngBounds(latlngs);
  map.fitBounds(bounds.pad(0.15));
}

function locateUser(){
  if (!navigator.geolocation){
    alert('เบราว์เซอร์นี้ไม่รองรับการหาตำแหน่ง');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude, longitude} = pos.coords;
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.circleMarker([latitude, longitude], { radius: 8 }).addTo(map);
    userMarker.bindPopup('ตำแหน่งของเครื่อง').openPopup();
    map.setView([latitude, longitude], 15, { animate:true });
  }, err => {
    alert('ขออนุญาตตำแหน่งไม่สำเร็จ: ' + err.message);
  }, { enableHighAccuracy:true, timeout: 10000 });
}

async function boot(){
  initMap();
  const res = await fetch('./data.json', { cache: 'no-store' });
  const rows = await res.json();
  state.all = rows;
  state.filtered = rows;

  setupFilters();
  renderMarkers(rows);
  renderList(rows);
  fitAll();

  // PWA
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}

boot().catch(err => {
  console.error(err);
  alert('โหลดข้อมูลไม่สำเร็จ (เช็คว่าเปิดผ่านเว็บเซิร์ฟเวอร์หรือไม่)\n' + err);
});
