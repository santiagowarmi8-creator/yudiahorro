/* Yudiahorro — finanzas del hogar. Todos los datos viven SOLO en este navegador (localStorage). */
(() => {
'use strict';
const KEY = 'yudiahorro_v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const monthOf = s => (s || '').slice(0, 7);
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

/* ---------- Catálogos ---------- */
const GASTO_CATS = {
  luz:['⚡','Luz (EDENORTE/EDESUR/EDEESTE)'], agua:['💧','Agua (INAPA/CAASD/CORAASAN)'], internet:['🌐','Internet / Cable'], celular:['📱','Celular / Recargas'],
  colmado:['🛒','Colmado / Supermercado'], combustible:['⛽','Combustible'], transporte:['🚕','Transporte / Uber / Motoconcho'], gas:['🔥','Gas propano'],
  alquiler:['🏠','Alquiler / Casa'], prestamos:['🏦','Préstamos'], tarjetas:['💳','Tarjetas de crédito'], escuela:['🎓','Escuela / Estudios'],
  salud:['🩺','Salud / ARS / Farmacia'], hosting:['🖥️','Hosting / Servidores'], suscripciones:['📺','Suscripciones'], salidas:['🍻','Salidas / Diversión'],
  ropa:['👕','Ropa / Cuidado personal'], hogar:['🛋️','Hogar / Mantenimiento'], regalos:['🎁','Regalos / Familia'], rifas:['🎟️','Premios de rifas'],
  negocio:['💼','Negocio / Publicidad'], otros:['📦','Otros']
};
const INGRESO_SRCS = {
  salario:['💼','Salario / Sueldo'], fluye:['🌊','Fluye (suscripciones PayPal)'], conquer:['⚔️','Servidor Conquer'], youtube:['▶️','YouTube / Facebook / Redes'],
  rifas:['🎟️','Rifas de Yudith'], ventas:['🛍️','Ventas / Negocio'], remesas:['💌','Remesas'], freelance:['🧑‍💻','Trabajos / Freelance'], otros:['✨','Otros']
};
const INV_TIPOS = {coop:'🤝 Cooperativa', certificado:'🏛️ Certificado financiero / Banco', acciones:'📈 Acciones / Bolsa', cripto:'🪙 Cripto', negocio:'💼 Negocio propio', inmueble:'🏡 Inmueble / Solar', otro:'✨ Otro'};
const DEUDA_TIPOS = {prestamo:'🏦 Préstamo', tarjeta:'💳 Tarjeta de crédito', san:'🤝 San / Sociedad', personal:'🙋 Préstamo personal', medeben:'💰 Me deben (yo presté)'};
const QUIEN = {warmi:'Warmi', yudith:'Yudith', ambos:'Ambos'};
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

/* ---------- Estado ---------- */
const blank = () => ({
  version: 1,
  settings: { nombre1: 'Warmi', nombre2: 'Yudith', moneda: 'DOP', tasa: 63, theme: 'dark', pin: '', efectivo: 0, fondoMeses: 6, fondoAhorrado: 0, ejemplo: false },
  ingresos: [], gastos: [], presupuestos: {}, inversiones: [], rifas: [], metas: [], deudas: [], pagos: []
});
let S;
try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || 'null') || {}); S.settings = Object.assign(blank().settings, S.settings); }
catch { S = blank(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('⚠️ No se pudo guardar: ' + e.message); } };

let view = location.hash.slice(1) || 'resumen';
let curMonth = todayStr().slice(0, 7);
let charts = [];
let openRifa = null;

/* ---------- Dinero ---------- */
const toDOP = (m, cur) => cur === 'USD' ? num(m) * num(S.settings.tasa || 1) : num(m);
const toView = dop => S.settings.moneda === 'USD' ? dop / num(S.settings.tasa || 1) : dop;
const fmt = (dop, opts = {}) => {
  const v = toView(dop); const usd = S.settings.moneda === 'USD';
  const s = Math.abs(v).toLocaleString('es-DO', { minimumFractionDigits: usd ? 2 : 0, maximumFractionDigits: usd ? 2 : 0 });
  return (v < 0 ? '-' : (opts.sign && v > 0 ? '+' : '')) + (usd ? 'US$' : 'RD$') + s;
};
const fmtRaw = (m, cur) => (cur === 'USD' ? 'US$' : 'RD$') + num(m).toLocaleString('es-DO', { maximumFractionDigits: 2 });
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

/* ---------- Cálculos ---------- */
const inMonth = (arr, m) => arr.filter(x => monthOf(x.fecha) === m);
const sumDOP = arr => arr.reduce((t, x) => t + toDOP(x.monto, x.moneda), 0);
const addMonths = (m, k) => { let [y, mo] = m.split('-').map(Number); mo += k; while (mo > 12) { mo -= 12; y++; } while (mo < 1) { mo += 12; y--; } return `${y}-${pad(mo)}`; };
const monthName = m => { const [y, mo] = m.split('-'); return `${MONTHS[+mo - 1]} ${y}`; };
const totals = m => { const i = sumDOP(inMonth(S.ingresos, m)), g = sumDOP(inMonth(S.gastos, m)); return { i, g, b: i - g, rate: i ? (i - g) / i * 100 : 0 }; };
const avgGastos = () => { const ms = [1, 2, 3].map(k => totals(addMonths(todayStr().slice(0, 7), -k)).g).filter(x => x > 0); const fijos = S.pagos.filter(p => p.activo !== false).reduce((t, p) => t + toDOP(p.monto, p.moneda), 0); return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : (fijos || totals(curMonth).g); };
const deudaPend = d => Math.max(0, num(d.total) - num(d.pagado));
const netWorth = () => {
  const inv = S.inversiones.reduce((t, x) => t + toDOP(x.actual, x.moneda), 0);
  const metas = S.metas.reduce((t, x) => t + toDOP(x.ahorrado, x.moneda), 0);
  const deb = S.deudas.filter(d => d.tipo !== 'medeben').reduce((t, d) => t + toDOP(deudaPend(d), d.moneda), 0);
  const meDeben = S.deudas.filter(d => d.tipo === 'medeben').reduce((t, d) => t + toDOP(deudaPend(d), d.moneda), 0);
  const ef = num(S.settings.efectivo), fondo = num(S.settings.fondoAhorrado);
  return { inv, metas, deb, meDeben, ef, fondo, total: inv + metas + ef + fondo + meDeben - deb };
};
const daysInMonth = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const dueDate = (dia, m) => `${m}-${pad(Math.min(num(dia) || 1, daysInMonth(m)))}`;
const daysUntil = s => Math.round((new Date(s + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 864e5);
const upcoming = () => {
  const m = todayStr().slice(0, 7), list = [];
  S.pagos.filter(p => p.activo !== false).forEach(p => {
    let mm = m; if ((p.pagados || []).includes(m)) mm = addMonths(m, 1);
    const f = dueDate(p.dia, mm); list.push({ kind: 'pago', id: p.id, nombre: p.nombre, ic: (GASTO_CATS[p.categoria] || GASTO_CATS.otros)[0], monto: toDOP(p.monto, p.moneda), fecha: f, d: daysUntil(f), tipo: p.tipo });
  });
  S.deudas.filter(d => d.tipo !== 'medeben' && deudaPend(d) > 0 && num(d.dia) > 0 && num(d.cuota) > 0).forEach(d => {
    let mm = m; if ((d.pagosMes || []).includes(m)) mm = addMonths(m, 1);
    const f = dueDate(d.dia, mm); list.push({ kind: 'deuda', id: d.id, nombre: d.nombre, ic: DEUDA_TIPOS[d.tipo].split(' ')[0], monto: toDOP(d.cuota, d.moneda), fecha: f, d: daysUntil(f) });
  });
  S.rifas.filter(r => !r.ganador && r.fecha).forEach(r => list.push({ kind: 'rifa', id: r.id, nombre: 'Sorteo: ' + r.nombre, ic: '🎟️', monto: 0, fecha: r.fecha, d: daysUntil(r.fecha) }));
  return list.sort((a, b) => a.fecha.localeCompare(b.fecha));
};
const budgetAlerts = m => Object.entries(S.presupuestos).filter(([, v]) => num(v) > 0).map(([c, v]) => { const g = sumDOP(inMonth(S.gastos, m).filter(x => x.categoria === c)); return { c, v: num(v), g, p: pct(g, num(v)) }; }).filter(x => x.p >= 80).sort((a, b) => b.p - a.p);

/* ---------- UI helpers ---------- */
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); };
const closeModal = () => { $('#modalBg').classList.add('hidden'); $('#modal').className = 'modal'; };
const modal = (html, wide) => { $('#modal').innerHTML = html; $('#modal').className = 'modal' + (wide ? ' wide' : ''); $('#modalBg').classList.remove('hidden'); };
$('#modalBg').addEventListener('click', e => { if (e.target.id === 'modalBg') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
const confirmDo = (msg, fn) => { modal(`<h2>¿Seguro?</h2><p>${esc(msg)}</p><div class="modal-actions"><button class="btn" data-x>Cancelar</button><button class="btn danger" data-ok>Sí, dale</button></div>`); $('#modal [data-x]').onclick = closeModal; $('#modal [data-ok]').onclick = () => { closeModal(); fn(); }; };
const opts = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${Array.isArray(v) ? v[0] + ' ' + v[1] : v}</option>`).join('');

/* Formulario genérico */
function form(title, fields, vals = {}, onSave, extraBtns = '') {
  const f = fields.map(fd => {
    const v = vals[fd.k] ?? fd.def ?? '';
    const cls = fd.full ? 'full' : '';
    if (fd.type === 'select') return `<label class="${cls}">${fd.label}<select name="${fd.k}">${opts(fd.options, v)}</select></label>`;
    if (fd.type === 'check') return `<label class="check ${cls}"><input type="checkbox" name="${fd.k}" ${v ? 'checked' : ''}> ${fd.label}</label>`;
    if (fd.type === 'textarea') return `<label class="full">${fd.label}<textarea name="${fd.k}" rows="2">${esc(v)}</textarea></label>`;
    return `<label class="${cls}">${fd.label}<input name="${fd.k}" type="${fd.type || 'text'}" ${fd.type === 'number' ? 'step="any" inputmode="decimal"' : ''} value="${esc(v)}" ${fd.req ? 'required' : ''} placeholder="${esc(fd.ph || '')}"></label>`;
  }).join('');
  modal(`<h2>${title}</h2><form class="form" id="gform">${f}</form><div class="modal-actions">${extraBtns}<button class="btn" data-x>Cancelar</button><button class="btn primary" data-ok>Guardar ✓</button></div>`);
  $('#modal [data-x]').onclick = closeModal;
  const submit = () => {
    const fm = $('#gform'); if (!fm.reportValidity()) return;
    const out = {}; fields.forEach(fd => { const el = fm.elements[fd.k]; out[fd.k] = fd.type === 'check' ? el.checked : fd.type === 'number' ? num(el.value) : el.value.trim(); });
    onSave(out); save(); closeModal(); render();
  };
  $('#modal [data-ok]').onclick = submit;
  $('#gform').addEventListener('submit', e => { e.preventDefault(); submit(); });
  const first = $('#gform input,#gform select'); if (first && matchMedia('(min-width:820px)').matches) first.focus();
}
const monedaF = { k: 'moneda', label: 'Moneda', type: 'select', options: { DOP: 'RD$ Pesos', USD: 'US$ Dólares' }, def: 'DOP' };

/* ---------- Navegación ---------- */
const NAV = [
  ['resumen', '🏠', 'Resumen'], ['ingresos', '💰', 'Ingresos'], ['gastos', '🧾', 'Gastos'], ['presupuesto', '🎯', 'Presupuesto'],
  ['pagos', '📅', 'Pagos y calendario'], ['rifas', '🎟️', 'Rifas de Yudith'], ['inversiones', '📈', 'Inversiones'], ['metas', '🐷', 'Metas y emergencia'],
  ['deudas', '🤝', 'Deudas y sanes'], ['ajustes', '⚙️', 'Ajustes y respaldo']
];
function renderNav() {
  const due = upcoming().filter(x => x.kind !== 'rifa' && x.d <= 3).length;
  $('#sidebar').innerHTML = NAV.map(([k, e, l]) => `<button class="nav-item ${view === k ? 'active' : ''}" data-v="${k}"><span class="em">${e}</span>${l}${k === 'pagos' && due ? `<span class="badge">${due}</span>` : ''}</button>`).join('')
    + `<p class="muted small" style="padding:14px">🔐 Tus datos se guardan solo en este navegador. Haz respaldo en Ajustes.</p>`;
  const mob = ['resumen', 'gastos', 'ingresos', 'rifas', 'pagos'];
  $('#bottomNav').innerHTML = NAV.filter(n => mob.includes(n[0])).map(([k, e, l]) => `<button class="${view === k ? 'active' : ''}" data-v="${k}"><span class="em">${e}</span>${l.split(' ')[0]}</button>`).join('') + `<button data-menu><span class="em">☰</span>Más</button>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (b && (b.closest('#sidebar') || b.closest('#bottomNav') || b.dataset.go !== undefined)) { go(b.dataset.v); }
  if (e.target.closest('[data-menu]') || e.target.closest('#menuBtn')) $('#sidebar').classList.toggle('open');
  else if (!e.target.closest('#sidebar')) $('#sidebar').classList.remove('open');
});
function go(v) { view = v; openRifa = null; location.hash = v; $('#sidebar').classList.remove('open'); render(); scrollTo({ top: 0, behavior: 'smooth' }); }
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== view) { view = v; render(); } });
$('#prevMonth').onclick = () => { curMonth = addMonths(curMonth, -1); render(); };
$('#nextMonth').onclick = () => { curMonth = addMonths(curMonth, 1); render(); };
$('#themeBtn').onclick = () => { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); render(); };
function applyTheme() { document.documentElement.dataset.theme = S.settings.theme; $('#themeBtn').textContent = S.settings.theme === 'dark' ? '☀️' : '🌙'; $('meta[name=theme-color]').content = S.settings.theme === 'dark' ? '#0b1020' : '#f4f6fc'; }

/* ---------- Gráficos ---------- */
const PALETTE = ['#7c5cff', '#22d3ee', '#f43f5e', '#f59e0b', '#22c55e', '#ec4899', '#3b82f6', '#a855f7', '#14b8a6', '#f97316', '#84cc16', '#eab308', '#06b6d4', '#8b5cf6'];
function chart(id, cfg) {
  if (typeof Chart === 'undefined') { const el = document.getElementById(id); if (el) el.parentElement.innerHTML = '<p class="muted small">Gráfico no disponible (sin conexión).</p>'; return; }
  const el = document.getElementById(id); if (!el) return;
  const css = getComputedStyle(document.documentElement);
  Chart.defaults.color = css.getPropertyValue('--muted').trim(); Chart.defaults.font.family = "'Plus Jakarta Sans',system-ui"; Chart.defaults.borderColor = css.getPropertyValue('--line').trim();
  charts.push(new Chart(el, cfg));
}
const moneyTick = v => fmt(v);

/* ---------- Vistas ---------- */
const V = {};
const empty = (emoji, txt, btn = '') => `<div class="empty"><span class="big">${emoji}</span>${txt}${btn ? `<div style="margin-top:12px">${btn}</div>` : ''}</div>`;
const stat = (label, value, sub = '', cls = '') => `<div class="card stat ${cls}"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
const isEmpty = () => !S.ingresos.length && !S.gastos.length && !S.rifas.length && !S.inversiones.length && !S.metas.length && !S.deudas.length && !S.pagos.length;

V.resumen = () => {
  const t = totals(curMonth), prev = totals(addMonths(curMonth, -1)), nw = netWorth();
  const diffG = prev.g ? Math.round((t.g - prev.g) / prev.g * 100) : null;
  const up = upcoming().filter(x => x.d >= -5 && x.d <= 15).slice(0, 6);
  const alerts = budgetAlerts(curMonth);
  const byWho = { warmi: 0, yudith: 0, ambos: 0 }; inMonth(S.gastos, curMonth).forEach(g => byWho[g.quien || 'ambos'] += toDOP(g.monto, g.moneda));
  const fondoObj = avgGastos() * num(S.settings.fondoMeses || 6);
  const subs = S.pagos.filter(p => p.tipo === 'suscripcion' && p.activo !== false).reduce((a, p) => a + toDOP(p.monto, p.moneda), 0);
  const tips = [];
  if (t.i && t.rate < 10) tips.push(['😬', `Este mes estás ahorrando solo el ${t.rate.toFixed(0)}%. La meta sana es 20% o más.`]);
  if (t.i && t.rate >= 20) tips.push(['🔥', `¡Vacano! Estás ahorrando el ${t.rate.toFixed(0)}% de lo que entra.`]);
  if (t.g > t.i && t.i) tips.push(['🚨', `Gastaste ${fmt(t.g - t.i)} más de lo que entró este mes.`]);
  if (fondoObj && num(S.settings.fondoAhorrado) < fondoObj) tips.push(['🛟', `Tu fondo de emergencia cubre ${(num(S.settings.fondoAhorrado) / (avgGastos() || 1)).toFixed(1)} meses. Meta: ${S.settings.fondoMeses} meses.`]);
  if (subs) tips.push(['📺', `Pagas ${fmt(subs)} al mes en suscripciones (${fmt(subs * 12)} al año). ¿Usas todas?`]);
  if (diffG !== null && diffG > 15) tips.push(['📈', `Tus gastos subieron ${diffG}% vs el mes pasado.`]);
  const fluye = sumDOP(inMonth(S.ingresos, curMonth).filter(x => x.fuente === 'fluye')); if (fluye) tips.push(['🌊', `Fluye te dejó ${fmt(fluye)} este mes. ¡A seguir creciendo!`]);
  const rifasAct = S.rifas.filter(r => !r.ganador).length; if (rifasAct) tips.push(['🎟️', `Yudith tiene ${rifasAct} rifa(s) activa(s).`]);
  return `
  ${isEmpty() ? `<div class="welcome"><div><h2>¡Klk, ${esc(S.settings.nombre1)}! 👋 Bienvenido a Yudiahorro</h2><p>Aquí llevas los cuartos de la casa: lo que entra, lo que sale, las rifas de ${esc(S.settings.nombre2)}, inversiones y metas. Todo se guarda solo en tu navegador.</p></div><div class="btn-row"><button class="btn" id="addFirst">➕ Empezar</button><button class="btn" id="loadDemo">🧪 Cargar datos de ejemplo</button></div></div>` : ''}
  ${S.settings.ejemplo ? `<div class="tip alert-row"><span class="e">🧪</span><div><b>Estás viendo datos de EJEMPLO.</b> Cuando quieras empezar con lo tuyo, ve a Ajustes → "Borrar todo".</div></div>` : ''}
  <div class="page-head"><div><h1 class="page-title">Resumen de ${monthName(curMonth)}</h1><p class="muted">Así va la casa este mes</p></div>
  <div class="btn-row"><button class="btn success" data-quick="ingreso">➕ Ingreso</button><button class="btn danger" data-quick="gasto">➖ Gasto</button></div></div>
  <div class="grid g4">
    ${stat('💵 Balance del mes', fmt(t.b, { sign: true }), t.b >= 0 ? 'Te sobró 😎' : 'Te pasaste 😬', 'hero')}
    ${stat('💰 Ingresos', `<span class="green">${fmt(t.i)}</span>`, prev.i ? `Mes pasado: ${fmt(prev.i)}` : '')}
    ${stat('🧾 Gastos', `<span class="red">${fmt(t.g)}</span>`, diffG !== null ? `${diffG >= 0 ? '▲' : '▼'} ${Math.abs(diffG)}% vs mes pasado` : '')}
    ${stat('🐷 Tasa de ahorro', `${t.i ? t.rate.toFixed(0) : 0}%`, `<div class="progress ${t.rate >= 20 ? 'ok' : t.rate >= 10 ? 'warn' : 'bad'}" style="margin-top:6px"><div style="width:${Math.max(0, Math.min(100, t.rate))}%"></div></div>`)}
  </div>
  <div class="grid g3 section-gap">
    <div class="card"><h3>🍩 Gastos por categoría</h3>${t.g ? `<div class="chart-box" style="height:180px"><canvas id="cCat"></canvas></div><div class="section-gap">${catTop(curMonth)}</div>` : empty('🧾', 'Sin gastos este mes')}</div>
    <div class="card" style="grid-column:span 2"><h3>📊 Tendencia (últimos 6 meses)</h3><div class="chart-box"><canvas id="cTrend"></canvas></div></div>
  </div>
  <div class="grid g3 section-gap">
    <div class="card"><h3>🏦 Patrimonio neto</h3>
      <div class="stat"><div class="value ${nw.total >= 0 ? 'green' : 'red'}">${fmt(nw.total)}</div></div>
      <div class="kv"><span>📈 Inversiones</span><b>${fmt(nw.inv)}</b></div>
      <div class="kv"><span>🐷 Metas de ahorro</span><b>${fmt(nw.metas)}</b></div>
      <div class="kv"><span>🛟 Fondo de emergencia</span><b>${fmt(nw.fondo)}</b></div>
      <div class="kv"><span>💵 Efectivo / cuentas</span><b>${fmt(nw.ef)}</b></div>
      <div class="kv"><span>💰 Me deben</span><b>${fmt(nw.meDeben)}</b></div>
      <div class="kv"><span>🤝 Deudas</span><b class="red">-${fmt(nw.deb)}</b></div>
    </div>
    <div class="card"><h3>⏰ Próximos pagos <button class="btn sm" data-v="pagos" data-go>Ver todo</button></h3>
      ${up.length ? `<div class="list">${up.map(u => `<div class="row ${u.d < 0 ? 'alert-row bad' : u.d <= 3 ? 'alert-row' : ''}"><div class="ic">${u.ic}</div><div class="info"><b>${esc(u.nombre)}</b><small>${u.d < 0 ? `Vencido hace ${-u.d} día(s)` : u.d === 0 ? '¡Hoy!' : `En ${u.d} día(s)`} · ${u.fecha.slice(8)}/${u.fecha.slice(5, 7)}</small></div>${u.monto ? `<div class="amt">${fmt(u.monto)}</div>` : ''}</div>`).join('')}</div>` : empty('😌', 'Nada pendiente pronto')}
    </div>
    <div class="card"><h3>💡 Ojo con esto</h3>
      ${alerts.map(a => `<div class="tip alert-row ${a.p > 100 ? 'bad' : ''}"><span class="e">${GASTO_CATS[a.c][0]}</span><div>${GASTO_CATS[a.c][1]}: <b>${a.p}%</b> del presupuesto (${fmt(a.g)} de ${fmt(a.v)})</div></div>`).join('')}
      ${tips.map(([e, x]) => `<div class="tip"><span class="e">${e}</span><div>${x}</div></div>`).join('') || (!alerts.length ? empty('✨', 'Agrega movimientos y aquí te doy consejos') : '')}
      ${t.g ? `<div class="section-gap"><b class="small muted">¿Quién pagó este mes?</b>${Object.entries(byWho).filter(([, v]) => v).map(([k, v]) => `<div class="kv"><span>${k === 'warmi' ? '🧔 ' + esc(S.settings.nombre1) : k === 'yudith' ? '👩 ' + esc(S.settings.nombre2) : '👫 Ambos'}</span><b>${fmt(v)} · ${pct(v, t.g)}%</b></div>`).join('')}</div>` : ''}
    </div>
  </div>`;
};
function catTop(m) {
  const cats = {}; inMonth(S.gastos, m).forEach(g => cats[g.categoria] = (cats[g.categoria] || 0) + toDOP(g.monto, g.moneda));
  const tot = Object.values(cats).reduce((a, b) => a + b, 0);
  return Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v], i) => `<div class="kv"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${PALETTE[i]};margin-right:6px"></i>${(GASTO_CATS[k] || GASTO_CATS.otros).join(' ')}</span><b>${pct(v, tot)}%</b></div>`).join('');
}
V.resumen.after = () => {
  const cats = {}; inMonth(S.gastos, curMonth).forEach(g => cats[g.categoria] = (cats[g.categoria] || 0) + toDOP(g.monto, g.moneda));
  const ents = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  if (ents.length) chart('cCat', { type: 'doughnut', data: { labels: ents.map(([k]) => (GASTO_CATS[k] || GASTO_CATS.otros).join(' ')), datasets: [{ data: ents.map(e => toView(e[1])), backgroundColor: PALETTE, borderWidth: 0 }] }, options: { maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(ents[c.dataIndex][1]) } } } } });
  const ms = [-5, -4, -3, -2, -1, 0].map(k => addMonths(curMonth, k)), tt = ms.map(totals);
  chart('cTrend', { type: 'bar', data: { labels: ms.map(m => MONTHS[+m.slice(5) - 1].slice(0, 3)), datasets: [
    { label: 'Ingresos', data: tt.map(t => toView(t.i)), backgroundColor: '#22c55e', borderRadius: 8 },
    { label: 'Gastos', data: tt.map(t => toView(t.g)), backgroundColor: '#f43f5e', borderRadius: 8 },
    { label: 'Balance', type: 'line', order: -1, data: tt.map(t => toView(t.b)), borderColor: '#7c5cff', backgroundColor: '#7c5cff', tension: .35, pointRadius: 4 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmt(S.settings.moneda === 'USD' ? c.raw * S.settings.tasa : c.raw) } } }, scales: { y: { ticks: { callback: v => (S.settings.moneda === 'USD' ? 'US$' : 'RD$') + Number(v).toLocaleString('es-DO', { notation: 'compact' }) } } } } });
  const a = $('#addFirst'); if (a) a.onclick = () => editGasto();
  const d = $('#loadDemo'); if (d) d.onclick = loadDemo;
};

/* Ingresos / Gastos */
function editIngreso(x = null) {
  form(x ? '✏️ Editar ingreso' : '💰 Nuevo ingreso', [
    { k: 'fuente', label: 'Fuente', type: 'select', options: INGRESO_SRCS, full: true },
    { k: 'desc', label: 'Descripción', ph: 'Ej: Pago quincena, suscripciones de Fluye…', full: true },
    { k: 'monto', label: 'Monto', type: 'number', req: true }, monedaF,
    { k: 'fecha', label: 'Fecha', type: 'date', def: curMonth === todayStr().slice(0, 7) ? todayStr() : curMonth + '-01', req: true },
    { k: 'quien', label: '¿De quién?', type: 'select', options: QUIEN, def: 'warmi' },
    { k: 'recurrente', label: '🔁 Se repite cada mes', type: 'check', full: true }
  ], x || {}, v => { if (x) Object.assign(x, v); else S.ingresos.push({ id: uid(), ...v }); toast('💰 Ingreso guardado'); });
}
function editGasto(x = null) {
  form(x ? '✏️ Editar gasto' : '🧾 Nuevo gasto', [
    { k: 'categoria', label: 'Categoría', type: 'select', options: GASTO_CATS, full: true },
    { k: 'desc', label: 'Descripción', ph: 'Ej: Compra del colmado, factura de luz…', full: true },
    { k: 'monto', label: 'Monto', type: 'number', req: true }, monedaF,
    { k: 'fecha', label: 'Fecha', type: 'date', def: curMonth === todayStr().slice(0, 7) ? todayStr() : curMonth + '-01', req: true },
    { k: 'quien', label: '¿Quién pagó?', type: 'select', options: QUIEN, def: 'ambos' },
    { k: 'recurrente', label: '🔁 Gasto fijo que se repite cada mes', type: 'check', full: true }
  ], x || {}, v => { if (x) Object.assign(x, v); else S.gastos.push({ id: uid(), ...v }); toast('🧾 Gasto guardado'); });
}
let filt = { q: '', cat: '', quien: '' };
function movView(kind) {
  const isI = kind === 'ingresos', arr = S[kind], cats = isI ? INGRESO_SRCS : GASTO_CATS, ck = isI ? 'fuente' : 'categoria';
  let items = inMonth(arr, curMonth).filter(x => (!filt.cat || x[ck] === filt.cat) && (!filt.quien || x.quien === filt.quien) && (!filt.q || (x.desc || '').toLowerCase().includes(filt.q.toLowerCase())));
  items.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const tot = sumDOP(items), all = sumDOP(inMonth(arr, curMonth));
  const groups = {}; inMonth(arr, curMonth).forEach(x => groups[x[ck]] = (groups[x[ck]] || 0) + toDOP(x.monto, x.moneda));
  const recPrev = inMonth(arr, addMonths(curMonth, -1)).filter(x => x.recurrente).length;
  return `<div class="page-head"><div><h1 class="page-title">${isI ? '💰 Ingresos' : '🧾 Gastos'}</h1><p class="muted">${monthName(curMonth)} · Total: <b class="${isI ? 'green' : 'red'}">${fmt(all)}</b></p></div>
    <div class="btn-row">${recPrev ? `<button class="btn" id="copyRec">🔁 Copiar ${recPrev} fijo(s) del mes pasado</button>` : ''}<button class="btn primary" id="addMov">➕ ${isI ? 'Nuevo ingreso' : 'Nuevo gasto'}</button></div></div>
  <div class="grid g3">
    <div class="card" style="grid-column:span 2">
      <div class="filters"><input id="fq" placeholder="🔎 Buscar…" value="${esc(filt.q)}"><select id="fcat"><option value="">Todas las ${isI ? 'fuentes' : 'categorías'}</option>${opts(cats, filt.cat)}</select><select id="fquien"><option value="">Todos</option>${opts(QUIEN, filt.quien)}</select></div>
      ${items.length ? `<div class="list">${items.map(x => { const c = cats[x[ck]] || cats.otros; return `<div class="row"><div class="ic">${c[0]}</div><div class="info"><b>${esc(x.desc || c[1])}</b><small>${x.fecha.slice(8)}/${x.fecha.slice(5, 7)} · ${c[1]} · ${QUIEN[x.quien] || ''} ${x.recurrente ? '· 🔁' : ''}</small></div><div class="amt ${isI ? 'green' : 'red'}">${isI ? '+' : '-'}${fmt(toDOP(x.monto, x.moneda))}${x.moneda === 'USD' ? `<br><small class="muted">${fmtRaw(x.monto, 'USD')}</small>` : ''}</div><div class="acts"><button data-ed="${x.id}" title="Editar">✏️</button><button data-del="${x.id}" title="Borrar">🗑️</button></div></div>`; }).join('')}</div>${filt.q || filt.cat || filt.quien ? `<p class="muted small">Filtrado: ${fmt(tot)}</p>` : ''}` : empty(isI ? '💸' : '🧾', `No hay ${kind} en ${monthName(curMonth)}`, `<button class="btn primary" id="addMov2">➕ Agregar</button>`)}
    </div>
    <div class="card"><h3>${isI ? '🌊 Por fuente' : '📂 Por categoría'}</h3>
      ${Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="budget-item"><div class="budget-top"><span>${(cats[k] || cats.otros)[0]} ${(cats[k] || cats.otros)[1]}</span><b>${fmt(v)}</b></div><div class="progress"><div style="width:${pct(v, all)}%"></div></div></div>`).join('') || empty('📊', 'Sin datos')}
    </div>
  </div>`;
}
function movAfter(kind) {
  const isI = kind === 'ingresos', ed = isI ? editIngreso : editGasto;
  ['#addMov', '#addMov2'].forEach(s => { const b = $(s); if (b) b.onclick = () => ed(); });
  $('#fq').oninput = e => { filt.q = e.target.value; render(); const el = $('#fq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
  $('#fcat').onchange = e => { filt.cat = e.target.value; render(); };
  $('#fquien').onchange = e => { filt.quien = e.target.value; render(); };
  document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => ed(S[kind].find(x => x.id === b.dataset.ed)));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDo('Se borrará este movimiento.', () => { S[kind] = S[kind].filter(x => x.id !== b.dataset.del); save(); render(); toast('🗑️ Borrado'); }));
  const c = $('#copyRec'); if (c) c.onclick = () => {
    const prev = inMonth(S[kind], addMonths(curMonth, -1)).filter(x => x.recurrente); let n = 0;
    prev.forEach(x => { const exists = inMonth(S[kind], curMonth).some(y => y.desc === x.desc && (y.categoria || y.fuente) === (x.categoria || x.fuente)); if (!exists) { S[kind].push({ ...x, id: uid(), fecha: dueDate(x.fecha.slice(8), curMonth) }); n++; } });
    save(); render(); toast(n ? `🔁 ${n} copiado(s)` : 'Ya estaban copiados');
  };
}
V.ingresos = () => movView('ingresos'); V.ingresos.after = () => movAfter('ingresos');
V.gastos = () => movView('gastos'); V.gastos.after = () => movAfter('gastos');

/* Presupuesto */
V.presupuesto = () => {
  const g = {}; inMonth(S.gastos, curMonth).forEach(x => g[x.categoria] = (g[x.categoria] || 0) + toDOP(x.monto, x.moneda));
  const totB = Object.values(S.presupuestos).reduce((a, b) => a + num(b), 0), totG = Object.entries(g).filter(([k]) => num(S.presupuestos[k])).reduce((a, [, v]) => a + v, 0);
  const t = totals(curMonth);
  const rows = Object.keys(GASTO_CATS).map(k => ({ k, b: num(S.presupuestos[k]), g: g[k] || 0 })).filter(r => r.b || r.g).sort((a, b) => (b.b ? b.g / b.b : 9) - (a.b ? a.g / a.b : 9));
  return `<div class="page-head"><div><h1 class="page-title">🎯 Presupuesto mensual</h1><p class="muted">Ponle un tope a cada categoría y te aviso cuando te estés pasando</p></div><div class="btn-row"><button class="btn" id="b503020">🧮 Sugerir 50/30/20</button><button class="btn primary" id="editB">✏️ Editar presupuesto</button></div></div>
  <div class="grid g3">${stat('🎯 Presupuestado', fmt(totB))}${stat('🧾 Gastado (en categorías con tope)', fmt(totG), `${pct(totG, totB)}% usado`)}${stat('💵 Queda disponible', `<span class="${totB - totG >= 0 ? 'green' : 'red'}">${fmt(totB - totG)}</span>`, t.i ? `Ingresos del mes: ${fmt(t.i)}` : '')}</div>
  <div class="card section-gap">${rows.length ? rows.map(r => { const p = r.b ? pct(r.g, r.b) : 0, c = !r.b ? '' : p > 100 ? 'bad' : p >= 80 ? 'warn' : 'ok'; return `<div class="budget-item"><div class="budget-top"><span>${GASTO_CATS[r.k][0]} <b>${GASTO_CATS[r.k][1]}</b> ${!r.b ? '<span class="chip">sin tope</span>' : p > 100 ? '<span class="chip bad">¡Te pasaste!</span>' : p >= 80 ? '<span class="chip warn">Cuidado</span>' : '<span class="chip ok">Bien</span>'}</span><span>${fmt(r.g)} ${r.b ? `/ ${fmt(r.b)} · <b>${p}%</b>` : ''}</span></div><div class="progress ${c}"><div style="width:${Math.min(100, r.b ? p : 100)}%"></div></div>${r.b ? `<small class="muted">${r.b - r.g >= 0 ? `Te quedan ${fmt(r.b - r.g)}` : `Pasado por ${fmt(r.g - r.b)}`}</small>` : ''}</div>`; }).join('') : empty('🎯', 'Aún no tienes presupuesto. ¡Ponle tope a tus gastos!', '<button class="btn primary" id="editB2">✏️ Crear presupuesto</button>')}</div>`;
};
V.presupuesto.after = () => {
  const ed = () => form('🎯 Presupuesto mensual (en RD$)', Object.entries(GASTO_CATS).map(([k, [e, l]]) => ({ k, label: `${e} ${l}`, type: 'number', ph: '0' })), Object.fromEntries(Object.entries(S.presupuestos).map(([k, v]) => [k, v || ''])), v => { S.presupuestos = Object.fromEntries(Object.entries(v).filter(([, x]) => x > 0)); toast('🎯 Presupuesto guardado'); });
  $('#editB').onclick = ed; const b2 = $('#editB2'); if (b2) b2.onclick = ed;
  $('#b503020').onclick = () => {
    const i = totals(curMonth).i || totals(addMonths(curMonth, -1)).i;
    if (!i) return toast('Primero registra tus ingresos del mes');
    modal(`<h2>🧮 Regla 50/30/20</h2><p>Con ingresos de <b>${fmt(i)}</b>:</p><div class="kv"><span>🏠 50% Necesidades (luz, agua, comida, alquiler…)</span><b>${fmt(i * .5)}</b></div><div class="kv"><span>🎉 30% Gustos (salidas, suscripciones, ropa…)</span><b>${fmt(i * .3)}</b></div><div class="kv"><span>🐷 20% Ahorro e inversión</span><b class="green">${fmt(i * .2)}</b></div><p class="muted small">Úsalo como guía para repartir tu presupuesto por categoría.</p><div class="modal-actions"><button class="btn primary" data-x>Entendido</button></div>`);
    $('#modal [data-x]').onclick = closeModal;
  };
};

/* Pagos fijos, suscripciones y calendario */
function editPago(x = null) {
  form(x ? '✏️ Editar pago fijo' : '📅 Nuevo pago fijo / suscripción', [
    { k: 'nombre', label: 'Nombre', req: true, ph: 'Ej: EDESUR, Claro, Netflix, VPS…', full: true },
    { k: 'tipo', label: 'Tipo', type: 'select', options: { fijo: '📌 Pago fijo mensual', suscripcion: '📺 Suscripción' } },
    { k: 'categoria', label: 'Categoría', type: 'select', options: GASTO_CATS },
    { k: 'monto', label: 'Monto', type: 'number', req: true }, monedaF,
    { k: 'dia', label: 'Día de pago (1-31)', type: 'number', req: true, def: 1 },
    { k: 'quien', label: '¿Quién lo paga?', type: 'select', options: QUIEN, def: 'ambos' },
    { k: 'activo', label: '✅ Activo', type: 'check', def: true, full: true }
  ], x || {}, v => { if (x) Object.assign(x, v); else S.pagos.push({ id: uid(), pagados: [], ...v }); toast('📅 Guardado'); },
  x ? '<button class="btn danger" id="delPago" style="margin-right:auto">🗑️ Borrar</button>' : '');
  const d = $('#delPago'); if (d) d.onclick = () => confirmDo('Se borrará este pago fijo.', () => { S.pagos = S.pagos.filter(p => p.id !== x.id); save(); render(); });
}
V.pagos = () => {
  const m = curMonth, act = S.pagos.filter(p => p.activo !== false);
  const totFijo = act.reduce((a, p) => a + toDOP(p.monto, p.moneda), 0), subs = act.filter(p => p.tipo === 'suscripcion');
  const pagadoMes = act.filter(p => (p.pagados || []).includes(m)).reduce((a, p) => a + toDOP(p.monto, p.moneda), 0);
  const row = p => { const paid = (p.pagados || []).includes(m), f = dueDate(p.dia, m), d = daysUntil(f), c = GASTO_CATS[p.categoria] || GASTO_CATS.otros;
    const st = paid ? '<span class="chip ok">✓ Pagado</span>' : d < 0 ? `<span class="chip bad">Vencido ${-d}d</span>` : d <= 3 ? `<span class="chip warn">${d === 0 ? 'Hoy' : `En ${d}d`}</span>` : `<span class="chip">Día ${p.dia}</span>`;
    return `<div class="row ${p.activo === false ? 'muted' : ''}"><div class="ic">${c[0]}</div><div class="info"><b>${esc(p.nombre)}</b><small>${p.tipo === 'suscripcion' ? '📺 Suscripción' : '📌 Fijo'} · día ${p.dia} · ${QUIEN[p.quien] || ''} ${p.activo === false ? '· pausado' : ''}</small><div>${st}</div></div><div class="amt">${fmtRaw(p.monto, p.moneda)}</div><div class="acts" style="flex-direction:column">${p.activo !== false ? `<button data-pay="${p.id}" title="${paid ? 'Desmarcar' : 'Marcar pagado'}">${paid ? '↩️' : '✅'}</button>` : ''}<button data-edp="${p.id}" title="Editar">✏️</button></div></div>`; };
  return `<div class="page-head"><div><h1 class="page-title">📅 Pagos fijos, suscripciones y calendario</h1><p class="muted">Que no se te pase ninguna factura en ${monthName(m)}</p></div><button class="btn primary" id="addPago">➕ Nuevo pago fijo</button></div>
  <div class="grid g4">${stat('📌 Total fijo al mes', fmt(totFijo))}${stat('✅ Pagado este mes', `<span class="green">${fmt(pagadoMes)}</span>`, `${pct(pagadoMes, totFijo)}%`)}${stat('⏳ Falta por pagar', `<span class="red">${fmt(totFijo - pagadoMes)}</span>`)}${stat('📺 Suscripciones', fmt(subs.reduce((a, p) => a + toDOP(p.monto, p.moneda), 0)), `${subs.length} activas · ${fmt(subs.reduce((a, p) => a + toDOP(p.monto, p.moneda), 0) * 12)}/año`)}</div>
  <div class="grid g2 section-gap">
    <div class="card"><h3>📌 Pagos del mes</h3>${S.pagos.filter(p => p.tipo !== 'suscripcion').length ? `<div class="list">${S.pagos.filter(p => p.tipo !== 'suscripcion').sort((a, b) => a.dia - b.dia).map(row).join('')}</div>` : empty('📌', 'Agrega la luz, agua, internet, alquiler…')}</div>
    <div class="card"><h3>📺 Suscripciones</h3>${subs.length || S.pagos.some(p => p.tipo === 'suscripcion') ? `<div class="list">${S.pagos.filter(p => p.tipo === 'suscripcion').sort((a, b) => a.dia - b.dia).map(row).join('')}</div>` : empty('📺', 'Netflix, Spotify, hosting, dominios, ChatGPT…')}</div>
  </div>
  <div class="card section-gap"><h3>🗓️ Calendario de ${monthName(m)}</h3>${calendar(m)}<div class="legend"><span><i style="background:rgba(124,92,255,.5)"></i>Pago fijo</span><span><i style="background:rgba(34,197,94,.5)"></i>Pagado</span><span><i style="background:rgba(244,63,94,.5)"></i>Cuota de deuda</span><span><i style="background:rgba(236,72,153,.5)"></i>Sorteo de rifa</span></div></div>`;
};
function calendar(m) {
  const [y, mo] = m.split('-').map(Number), first = new Date(y, mo - 1, 1).getDay(), dim = daysInMonth(m), ev = {};
  const add = (d, h) => (ev[d] = ev[d] || []).push(h);
  S.pagos.filter(p => p.activo !== false).forEach(p => add(Math.min(num(p.dia), dim), `<div class="ev ${(p.pagados || []).includes(m) ? 'paid' : ''}" title="${esc(p.nombre)}">${esc(p.nombre)}</div>`));
  S.deudas.filter(d => d.tipo !== 'medeben' && num(d.dia) && deudaPend(d) > 0).forEach(d => add(Math.min(num(d.dia), dim), `<div class="ev deuda ${(d.pagosMes || []).includes(m) ? 'paid' : ''}">${esc(d.nombre)}</div>`));
  S.rifas.filter(r => monthOf(r.fecha) === m).forEach(r => add(+r.fecha.slice(8), `<div class="ev rifa">🎟️ ${esc(r.nombre)}</div>`));
  let h = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < first; i++) h += '<div class="day out"></div>';
  for (let d = 1; d <= dim; d++) h += `<div class="day ${`${m}-${pad(d)}` === todayStr() ? 'today' : ''}"><div class="d">${d}</div>${(ev[d] || []).join('')}</div>`;
  return `<div class="cal">${h}</div>`;
}
V.pagos.after = () => {
  $('#addPago').onclick = () => editPago();
  document.querySelectorAll('[data-edp]').forEach(b => b.onclick = () => editPago(S.pagos.find(p => p.id === b.dataset.edp)));
  document.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => {
    const p = S.pagos.find(x => x.id === b.dataset.pay); p.pagados = p.pagados || [];
    if (p.pagados.includes(curMonth)) { p.pagados = p.pagados.filter(x => x !== curMonth); S.gastos = S.gastos.filter(g => !(g.pagoId === p.id && monthOf(g.fecha) === curMonth)); toast('↩️ Desmarcado'); }
    else { p.pagados.push(curMonth); S.gastos.push({ id: uid(), pagoId: p.id, categoria: p.categoria, desc: p.nombre, monto: p.monto, moneda: p.moneda, fecha: dueDate(p.dia, curMonth), quien: p.quien || 'ambos', recurrente: false }); toast('✅ Pagado y anotado en gastos'); }
    save(); render();
  });
};

/* Rifas */
function editRifa(x = null) {
  form(x ? '✏️ Editar rifa' : '🎟️ Nueva rifa', [
    { k: 'nombre', label: 'Nombre de la rifa', req: true, ph: 'Ej: Rifa del Air Fryer', full: true },
    { k: 'premio', label: 'Premio', req: true, ph: 'Ej: Air Fryer Ninja 5.5L', full: true },
    { k: 'costoPremio', label: 'Costo del premio (RD$)', type: 'number', req: true },
    { k: 'precio', label: 'Precio por número (RD$)', type: 'number', req: true },
    { k: 'cantidad', label: 'Cantidad de números', type: 'number', req: true, def: 100 },
    { k: 'inicio', label: 'Empieza en el número', type: 'select', options: { 0: '00 (00-99)', 1: '1' }, def: '0' },
    { k: 'fecha', label: 'Fecha del sorteo', type: 'date', req: true },
    { k: 'loteria', label: 'Juega con (opcional)', ph: 'Ej: Lotería Nacional, Leidsa…' },
    { k: 'notas', label: 'Notas', type: 'textarea' }
  ], x || {}, v => { v.cantidad = Math.max(1, Math.min(1000, Math.round(v.cantidad))); if (x) Object.assign(x, v); else { const r = { id: uid(), numeros: {}, ganador: null, ...v }; S.rifas.push(r); openRifa = r.id; } toast('🎟️ Rifa guardada'); },
  x ? '<button class="btn danger" id="delRifa" style="margin-right:auto">🗑️ Borrar</button>' : '');
  const d = $('#delRifa'); if (d) d.onclick = () => confirmDo('Se borrará la rifa y todos sus números.', () => { S.rifas = S.rifas.filter(r => r.id !== x.id); openRifa = null; save(); render(); });
}
const rifaNums = r => { const st = +(r.inicio || 0), w = String(st + r.cantidad - 1).length; return Array.from({ length: r.cantidad }, (_, i) => String(st + i).padStart(Math.max(2, w), '0')); };
const rifaStats = r => { const ns = Object.values(r.numeros || {}); const vend = ns.length, pag = ns.filter(n => n.pagado).length, p = num(r.precio), c = num(r.costoPremio);
  return { vend, pag, libres: r.cantidad - vend, recaudado: pag * p, pendiente: (vend - pag) * p, proy: r.cantidad * p - c, real: pag * p - c, punto: p ? Math.ceil(c / p) : 0 }; };
V.rifas = () => {
  if (openRifa) { const r = S.rifas.find(x => x.id === openRifa); if (r) return rifaDetail(r); openRifa = null; }
  const tot = S.rifas.reduce((a, r) => { const s = rifaStats(r); a.g += r.ganador ? s.real : 0; a.r += s.recaudado; return a; }, { g: 0, r: 0 });
  return `<div class="page-head"><div><h1 class="page-title">🎟️ Rifas de ${esc(S.settings.nombre2)}</h1><p class="muted">Controla números vendidos, quién pagó y saca el ganador</p></div><button class="btn primary" id="addRifa">➕ Nueva rifa</button></div>
  <div class="grid g3">${stat('🎟️ Rifas', S.rifas.length, `${S.rifas.filter(r => !r.ganador).length} activas`)}${stat('💵 Total cobrado', fmt(tot.r))}${stat('🏆 Ganancia (rifas terminadas)', `<span class="${tot.g >= 0 ? 'green' : 'red'}">${fmt(tot.g)}</span>`, '', 'hero')}</div>
  <div class="grid g3 section-gap">${S.rifas.length ? S.rifas.slice().reverse().map(r => { const s = rifaStats(r), d = daysUntil(r.fecha || todayStr()); return `<div class="card rifa-card" data-rifa="${r.id}"><h3>🎁 ${esc(r.nombre)} ${r.ganador ? '<span class="chip ok">🏆 Terminada</span>' : d < 0 ? '<span class="chip bad">Pendiente sorteo</span>' : `<span class="chip brand">${d === 0 ? '¡Hoy!' : `En ${d} días`}</span>`}</h3><p class="muted small" style="margin:0 0 10px">${esc(r.premio)} · ${fmtRaw(r.precio, 'DOP')} c/u · sorteo ${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</p><div class="budget-top"><span>${s.vend}/${r.cantidad} vendidos</span><b>${pct(s.vend, r.cantidad)}%</b></div><div class="progress ${s.vend >= s.punto ? 'ok' : 'warn'}"><div style="width:${pct(s.vend, r.cantidad)}%"></div></div><div class="kv section-gap"><span>Cobrado</span><b class="green">${fmt(s.recaudado)}</b></div><div class="kv"><span>Ganancia real hoy</span><b class="${s.real >= 0 ? 'green' : 'red'}">${fmt(s.real)}</b></div>${r.ganador ? `<div class="kv"><span>🏆 Ganó</span><b>#${esc(r.ganador)} ${esc((r.numeros[r.ganador] || {}).nombre || '')}</b></div>` : ''}</div>`; }).join('') : `<div class="card" style="grid-column:1/-1">${empty('🎟️', `${esc(S.settings.nombre2)} todavía no tiene rifas aquí. ¡Crea la primera!`, '<button class="btn primary" id="addRifa2">➕ Crear rifa</button>')}</div>`}</div>`;
};
function rifaDetail(r) {
  const s = rifaStats(r), f = r._f || 'todos';
  const nums = rifaNums(r);
  const buyers = {}; Object.entries(r.numeros).forEach(([n, v]) => { const k = (v.nombre || '¿?').trim().toLowerCase(); (buyers[k] = buyers[k] || { nombre: v.nombre || '¿?', tel: v.tel, nums: [], debe: 0 }).nums.push(n); if (!v.pagado) buyers[k].debe += num(r.precio); });
  return `<div class="page-head"><div><button class="btn sm" id="backRifas">‹ Rifas</button><h1 class="page-title" style="margin-top:8px">🎁 ${esc(r.nombre)}</h1><p class="muted">${esc(r.premio)} · ${fmtRaw(r.precio, 'DOP')} por número · Sorteo: ${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'} ${r.loteria ? '· ' + esc(r.loteria) : ''}</p></div>
  <div class="btn-row"><button class="btn" id="shareRifa">📋 Copiar números libres</button><button class="btn" id="editRifa">✏️ Editar</button><button class="btn primary" id="drawRifa">🎲 Sacar ganador</button></div></div>
  <div class="grid g4">${stat('🎟️ Vendidos', `${s.vend}/${r.cantidad}`, `${s.libres} libres · ${s.pag} pagados`)}${stat('💵 Cobrado', `<span class="green">${fmt(s.recaudado)}</span>`, `Por cobrar: ${fmt(s.pendiente)}`)}${stat('📊 Ganancia proyectada', fmt(s.proy), `Si se venden todos · premio cuesta ${fmtRaw(r.costoPremio, 'DOP')}`)}${stat('🏆 Ganancia real', fmt(s.real), s.vend >= s.punto ? '✅ Ya pasaste el punto de equilibrio' : `Necesitas vender ${s.punto - s.pag} pagados más para cubrir el premio`, 'hero')}</div>
  ${r.ganador ? `<div class="winner-box"><div>🏆 ¡Número ganador!</div><div class="n">#${esc(r.ganador)}</div><div>${esc((r.numeros[r.ganador] || {}).nombre || 'Número no vendido')} ${(r.numeros[r.ganador] || {}).tel ? '· 📞 ' + esc(r.numeros[r.ganador].tel) : ''}</div>${!r.ingresoRegistrado ? `<button class="btn section-gap" id="regRifa" style="background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.4)">💰 Anotar ganancia en ingresos</button>` : '<small>✓ Ganancia anotada en ingresos</small>'}</div>` : ''}
  <div class="grid g3 section-gap">
    <div class="card" style="grid-column:span 2"><h3>🔢 Números <span class="filters" style="margin:0"><select id="rifaF"><option value="todos">Todos</option><option value="libres" ${f === 'libres' ? 'selected' : ''}>Libres</option><option value="apartados" ${f === 'apartados' ? 'selected' : ''}>Apartados (sin pagar)</option><option value="pagados" ${f === 'pagados' ? 'selected' : ''}>Pagados</option></select></span></h3>
      <div class="legend"><span><i style="background:var(--card2);border:1px solid var(--line)"></i>Libre</span><span><i style="background:var(--yellow)"></i>Apartado</span><span><i style="background:var(--green)"></i>Pagado</span><span>👆 Toca un número para venderlo</span></div>
      <div class="num-grid" id="numGrid">${nums.filter(n => { const v = r.numeros[n]; return f === 'todos' || (f === 'libres' && !v) || (f === 'apartados' && v && !v.pagado) || (f === 'pagados' && v && v.pagado); }).map(n => { const v = r.numeros[n]; return `<div class="num ${v ? (v.pagado ? 'paid' : 'sold') : ''} ${r.ganador === n ? 'winner' : ''}" data-n="${n}" title="${v ? esc(v.nombre) : 'Libre'}">${n}</div>`; }).join('')}</div>
    </div>
    <div class="card"><h3>👥 Compradores (${Object.keys(buyers).length})</h3>${Object.values(buyers).length ? `<div class="list">${Object.values(buyers).sort((a, b) => b.debe - a.debe).map(b => `<div class="row"><div class="ic">${b.debe ? '⏳' : '✅'}</div><div class="info"><b>${esc(b.nombre)}</b><small>#${b.nums.join(', #')} ${b.tel ? `· <a href="https://wa.me/${esc(b.tel.replace(/\D/g, '').replace(/^(?=[89]\d{9}$)/, '1'))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</small></div><div class="amt ${b.debe ? 'red' : 'green'}">${b.debe ? 'Debe ' + fmtRaw(b.debe, 'DOP') : 'Pagó'}</div></div>`).join('')}</div>` : empty('👥', 'Nadie ha comprado todavía')}</div>
  </div>`;
}
function sellNumber(r, n) {
  const v = r.numeros[n] || {};
  form(`🎟️ Número #${n}`, [
    { k: 'nombre', label: 'Nombre del comprador', req: true, full: true, ph: 'Ej: Doña Carmen' },
    { k: 'tel', label: 'Teléfono / WhatsApp', type: 'tel', ph: '809-555-0000', full: true },
    { k: 'pagado', label: '💵 Ya pagó', type: 'check', full: true }
  ], v, out => { r.numeros[n] = out; toast(out.pagado ? `✅ #${n} pagado` : `⏳ #${n} apartado`); },
  r.numeros[n] ? '<button class="btn danger" id="freeNum" style="margin-right:auto">🔓 Liberar</button>' : '');
  const fr = $('#freeNum'); if (fr) fr.onclick = () => { delete r.numeros[n]; save(); closeModal(); render(); toast(`🔓 #${n} liberado`); };
}
function drawWinner(r) {
  const sold = Object.entries(r.numeros); const paid = sold.filter(([, v]) => v.pagado);
  if (!sold.length) return toast('No hay números vendidos todavía');
  modal(`<h2>🎲 Sacar ganador</h2><p>¿De dónde sacamos el número?</p><div class="list"><button class="btn primary" data-pool="paid" ${paid.length ? '' : 'disabled'}>✅ Solo números pagados (${paid.length})</button><button class="btn" data-pool="sold">🎟️ Todos los vendidos (${sold.length})</button><button class="btn" data-pool="all">🔢 Cualquier número (${r.cantidad}) — simular lotería</button></div><p class="muted small">Si la rifa juega con la lotería, mejor anota el número que salió con "Anotar ganador manual".</p><div class="modal-actions"><button class="btn" data-manual>✍️ Anotar ganador manual</button><button class="btn" data-x>Cancelar</button></div>`);
  $('#modal [data-x]').onclick = closeModal;
  $('#modal [data-manual]').onclick = () => form('✍️ Número ganador', [{ k: 'n', label: 'Número que salió', req: true }], {}, v => { const n = rifaNums(r).find(x => +x === +v.n) || v.n; r.ganador = n; setTimeout(confetti, 200); });
  document.querySelectorAll('#modal [data-pool]').forEach(b => b.onclick = () => {
    const pool = b.dataset.pool === 'paid' ? paid.map(x => x[0]) : b.dataset.pool === 'sold' ? sold.map(x => x[0]) : rifaNums(r);
    closeModal(); r._f = 'todos'; render();
    const winner = pool[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * pool.length)];
    let i = 0, delay = 50; const cells = [...document.querySelectorAll('#numGrid .num')];
    const step = () => {
      cells.forEach(c => c.classList.remove('flash'));
      if (delay > 380) { r.ganador = winner; save(); render(); confetti(); toast(`🏆 ¡Ganó el #${winner}!`); return; }
      const pick = pool[Math.floor(Math.random() * pool.length)]; const el = cells.find(c => c.dataset.n === pick); if (el) el.classList.add('flash');
      i++; delay *= 1.07; setTimeout(step, delay);
    };
    step();
  });
}
V.rifas.after = () => {
  ['#addRifa', '#addRifa2'].forEach(s => { const b = $(s); if (b) b.onclick = () => editRifa(); });
  document.querySelectorAll('[data-rifa]').forEach(c => c.onclick = () => { openRifa = c.dataset.rifa; render(); scrollTo({ top: 0 }); });
  if (!openRifa) return;
  const r = S.rifas.find(x => x.id === openRifa); if (!r) return;
  $('#backRifas').onclick = () => { openRifa = null; render(); };
  $('#editRifa').onclick = () => editRifa(r);
  $('#drawRifa').onclick = () => r.ganador ? confirmDo(`Ya hay ganador (#${r.ganador}). ¿Sortear de nuevo?`, () => { r.ganador = null; save(); drawWinner(r); }) : drawWinner(r);
  $('#rifaF').onchange = e => { r._f = e.target.value; render(); };
  $('#numGrid').onclick = e => { const n = e.target.closest('[data-n]'); if (n) sellNumber(r, n.dataset.n); };
  $('#shareRifa').onclick = () => {
    const libres = rifaNums(r).filter(n => !r.numeros[n]);
    const txt = `🎟️ *${r.nombre}*\n🎁 Premio: ${r.premio}\n💵 ${fmtRaw(r.precio, 'DOP')} por número\n📅 Sorteo: ${r.fecha ? r.fecha.split('-').reverse().join('/') : ''}${r.loteria ? ' con ' + r.loteria : ''}\n\n✅ Números disponibles (${libres.length}):\n${libres.join(' · ')}`;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('📋 Copiado, pégalo en WhatsApp')).catch(() => { modal(`<h2>📋 Copia este texto</h2><textarea style="width:100%;height:240px" class="form">${esc(txt)}</textarea><div class="modal-actions"><button class="btn primary" data-x>Listo</button></div>`); $('#modal [data-x]').onclick = closeModal; });
  };
  const rg = $('#regRifa'); if (rg) rg.onclick = () => { const s = rifaStats(r); S.ingresos.push({ id: uid(), fuente: 'rifas', desc: `Ganancia rifa: ${r.nombre}`, monto: s.real, moneda: 'DOP', fecha: r.fecha || todayStr(), quien: 'yudith' }); r.ingresoRegistrado = true; save(); render(); toast('💰 Anotado en ingresos'); };
};

/* Inversiones */
function editInv(x = null) {
  form(x ? '✏️ Editar inversión' : '📈 Nueva inversión', [
    { k: 'nombre', label: 'Nombre', req: true, full: true, ph: 'Ej: Certificado Banreservas, Cooperativa, BTC…' },
    { k: 'tipo', label: 'Tipo', type: 'select', options: INV_TIPOS }, monedaF,
    { k: 'invertido', label: 'Monto invertido', type: 'number', req: true },
    { k: 'actual', label: 'Valor actual', type: 'number', req: true },
    { k: 'tasa', label: 'Tasa anual % (opcional)', type: 'number' },
    { k: 'fecha', label: 'Fecha de inicio', type: 'date', def: todayStr() },
    { k: 'notas', label: 'Notas', type: 'textarea' }
  ], x || {}, v => { if (x) Object.assign(x, v); else S.inversiones.push({ id: uid(), ...v }); toast('📈 Guardado'); },
  x ? '<button class="btn danger" id="delInv" style="margin-right:auto">🗑️ Borrar</button>' : '');
  const d = $('#delInv'); if (d) d.onclick = () => confirmDo('Se borrará esta inversión.', () => { S.inversiones = S.inversiones.filter(i => i.id !== x.id); save(); render(); });
}
V.inversiones = () => {
  const inv = S.inversiones.reduce((a, x) => a + toDOP(x.invertido, x.moneda), 0), act = S.inversiones.reduce((a, x) => a + toDOP(x.actual, x.moneda), 0), g = act - inv;
  return `<div class="page-head"><div><h1 class="page-title">📈 Inversiones</h1><p class="muted">Pon tus cuartos a trabajar</p></div><button class="btn primary" id="addInv">➕ Nueva inversión</button></div>
  <div class="grid g3">${stat('💸 Total invertido', fmt(inv))}${stat('💎 Valor actual', fmt(act), '', 'hero')}${stat('📊 Ganancia / pérdida', `<span class="${g >= 0 ? 'green' : 'red'}">${fmt(g, { sign: true })}</span>`, `${inv ? (g / inv * 100).toFixed(1) : 0}%`)}</div>
  <div class="grid g3 section-gap"><div class="card" style="grid-column:span 2"><h3>💼 Portafolio</h3>${S.inversiones.length ? `<div class="list">${S.inversiones.map(x => { const gg = num(x.actual) - num(x.invertido), p = num(x.invertido) ? gg / num(x.invertido) * 100 : 0; return `<div class="row"><div class="ic">${INV_TIPOS[x.tipo].split(' ')[0]}</div><div class="info"><b>${esc(x.nombre)}</b><small>${INV_TIPOS[x.tipo].slice(2)} · invertido ${fmtRaw(x.invertido, x.moneda)} ${x.tasa ? `· ${x.tasa}% anual` : ''}</small></div><div class="amt">${fmtRaw(x.actual, x.moneda)}<br><small class="${gg >= 0 ? 'green' : 'red'}">${gg >= 0 ? '▲' : '▼'} ${p.toFixed(1)}%</small></div><div class="acts" style="flex-direction:column"><button data-upd="${x.id}" title="Actualizar valor">🔄</button><button data-edi="${x.id}" title="Editar">✏️</button></div></div>`; }).join('')}</div>` : empty('📈', 'Agrega tus certificados, cooperativa, cripto o negocio')}</div>
  <div class="card"><h3>🥧 Distribución</h3><div class="chart-box">${S.inversiones.length ? '<canvas id="cInv"></canvas>' : empty('🥧', 'Sin datos')}</div></div></div>`;
};
V.inversiones.after = () => {
  $('#addInv').onclick = () => editInv();
  document.querySelectorAll('[data-edi]').forEach(b => b.onclick = () => editInv(S.inversiones.find(x => x.id === b.dataset.edi)));
  document.querySelectorAll('[data-upd]').forEach(b => b.onclick = () => { const x = S.inversiones.find(i => i.id === b.dataset.upd); form(`🔄 Valor actual de ${esc(x.nombre)}`, [{ k: 'actual', label: `Valor actual (${x.moneda})`, type: 'number', req: true }], x, v => { x.actual = v.actual; toast('🔄 Actualizado'); }); });
  if (S.inversiones.length) { const by = {}; S.inversiones.forEach(x => by[x.tipo] = (by[x.tipo] || 0) + toDOP(x.actual, x.moneda)); const e = Object.entries(by); chart('cInv', { type: 'doughnut', data: { labels: e.map(([k]) => INV_TIPOS[k]), datasets: [{ data: e.map(x => toView(x[1])), backgroundColor: PALETTE, borderWidth: 0 }] }, options: { maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: c => ' ' + fmt(e[c.dataIndex][1]) } } } } }); }
};

/* Metas + fondo de emergencia */
function editMeta(x = null) {
  form(x ? '✏️ Editar meta' : '🐷 Nueva meta de ahorro', [
    { k: 'emoji', label: 'Emoji', def: '🎯', ph: '🏠 🚗 ✈️ 🎓 💍' }, { k: 'nombre', label: 'Meta', req: true, ph: 'Ej: Inicial de la casa' },
    { k: 'objetivo', label: 'Cuánto necesitas', type: 'number', req: true }, monedaF,
    { k: 'ahorrado', label: 'Ya ahorrado', type: 'number', def: 0 }, { k: 'fecha', label: 'Para cuándo', type: 'date' }
  ], x || {}, v => { if (x) Object.assign(x, v); else S.metas.push({ id: uid(), ...v }); toast('🐷 Meta guardada'); },
  x ? '<button class="btn danger" id="delMeta" style="margin-right:auto">🗑️ Borrar</button>' : '');
  const d = $('#delMeta'); if (d) d.onclick = () => confirmDo('Se borrará esta meta.', () => { S.metas = S.metas.filter(i => i.id !== x.id); save(); render(); });
}
V.metas = () => {
  const avg = avgGastos(), meses = num(S.settings.fondoMeses) || 6, obj = avg * meses, ah = num(S.settings.fondoAhorrado), cub = avg ? ah / avg : 0;
  return `<div class="page-head"><div><h1 class="page-title">🐷 Metas y fondo de emergencia</h1><p class="muted">Ahorra con propósito</p></div><button class="btn primary" id="addMeta">➕ Nueva meta</button></div>
  <div class="card stat hero"><div class="label">🛟 Fondo de emergencia</div><div class="value">${fmt(ah)} <small style="font-size:.9rem;opacity:.85">de ${fmt(obj)}</small></div><div class="progress" style="background:rgba(255,255,255,.25);border:none;margin:10px 0"><div style="width:${Math.min(100, pct(ah, obj))}%;background:#fff"></div></div><div class="sub">Cubre <b>${cub.toFixed(1)} de ${meses} meses</b> de gastos (promedio ${fmt(avg)}/mes). Si mañana no entra nada, aguantas ${Math.floor(cub * 30)} días.</div><div class="btn-row section-gap"><button class="btn" id="fondoAdd" style="background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.4)">➕ Aportar / retirar</button><button class="btn" id="fondoCfg" style="background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.4)">⚙️ Meses objetivo</button></div></div>
  <div class="grid g3 section-gap">${S.metas.length ? S.metas.map(m => { const p = pct(num(m.ahorrado), num(m.objetivo)), falta = num(m.objetivo) - num(m.ahorrado); let mens = ''; if (m.fecha && falta > 0) { const mm = Math.max(1, Math.ceil(daysUntil(m.fecha) / 30)); mens = `Ahorra ${fmtRaw(Math.ceil(falta / mm), m.moneda)}/mes para llegar a tiempo`; } return `<div class="card"><h3><span>${esc(m.emoji || '🎯')} ${esc(m.nombre)}</span>${p >= 100 ? '<span class="chip ok">🎉 ¡Lograda!</span>' : `<span class="chip brand">${p}%</span>`}</h3><div class="progress ${p >= 100 ? 'ok' : ''}"><div style="width:${Math.min(100, p)}%"></div></div><div class="kv section-gap"><span>Ahorrado</span><b>${fmtRaw(m.ahorrado, m.moneda)}</b></div><div class="kv"><span>Meta</span><b>${fmtRaw(m.objetivo, m.moneda)}</b></div>${m.fecha ? `<div class="kv"><span>Fecha</span><b>${m.fecha.split('-').reverse().join('/')}</b></div>` : ''}${mens ? `<p class="muted small">💡 ${mens}</p>` : ''}<div class="btn-row"><button class="btn sm success" data-apm="${m.id}">➕ Aportar</button><button class="btn sm" data-edm="${m.id}">✏️ Editar</button></div></div>`; }).join('') : `<div class="card" style="grid-column:1/-1">${empty('🐷', 'Crea metas: la casa, el carro, un viaje, la boda, el colegio de los niños…', '<button class="btn primary" id="addMeta2">➕ Crear meta</button>')}</div>`}</div>`;
};
V.metas.after = () => {
  ['#addMeta', '#addMeta2'].forEach(s => { const b = $(s); if (b) b.onclick = () => editMeta(); });
  document.querySelectorAll('[data-edm]').forEach(b => b.onclick = () => editMeta(S.metas.find(x => x.id === b.dataset.edm)));
  document.querySelectorAll('[data-apm]').forEach(b => b.onclick = () => { const m = S.metas.find(x => x.id === b.dataset.apm); form(`➕ Aportar a ${esc(m.nombre)}`, [{ k: 'm', label: `Monto (${m.moneda}) — negativo para retirar`, type: 'number', req: true }], {}, v => { const before = num(m.ahorrado); m.ahorrado = before + v.m; if (before < num(m.objetivo) && m.ahorrado >= num(m.objetivo)) setTimeout(confetti, 300); toast('🐷 ¡Así se hace!'); }); });
  $('#fondoAdd').onclick = () => form('🛟 Fondo de emergencia', [{ k: 'm', label: 'Monto RD$ (negativo para retirar)', type: 'number', req: true }], {}, v => { S.settings.fondoAhorrado = num(S.settings.fondoAhorrado) + v.m; toast('🛟 Actualizado'); });
  $('#fondoCfg').onclick = () => form('⚙️ Fondo de emergencia', [{ k: 'fondoMeses', label: 'Meses de gastos a cubrir (recomendado 3-6)', type: 'number', req: true }, { k: 'fondoAhorrado', label: 'Ahorrado actualmente (RD$)', type: 'number' }], S.settings, v => Object.assign(S.settings, v));
};

/* Deudas */
function editDeuda(x = null) {
  form(x ? '✏️ Editar' : '🤝 Nueva deuda / san', [
    { k: 'tipo', label: 'Tipo', type: 'select', options: DEUDA_TIPOS, full: true },
    { k: 'nombre', label: 'Nombre', req: true, ph: 'Ej: Préstamo Popular, San de la oficina', full: true },
    { k: 'acreedor', label: 'Con quién / banco', ph: 'Ej: Banco Popular, Doña Rosa' }, monedaF,
    { k: 'total', label: 'Monto total', type: 'number', req: true }, { k: 'pagado', label: 'Ya pagado / cobrado', type: 'number', def: 0 },
    { k: 'cuota', label: 'Cuota mensual', type: 'number' }, { k: 'dia', label: 'Día de pago (1-31)', type: 'number' },
    { k: 'tasa', label: 'Tasa de interés anual %', type: 'number' }, { k: 'turno', label: 'Mi turno del san (fecha)', type: 'date' },
    { k: 'notas', label: 'Notas', type: 'textarea' }
  ], x || {}, v => { if (x) Object.assign(x, v); else S.deudas.push({ id: uid(), pagosMes: [], ...v }); toast('🤝 Guardado'); },
  x ? '<button class="btn danger" id="delDeuda" style="margin-right:auto">🗑️ Borrar</button>' : '');
  const d = $('#delDeuda'); if (d) d.onclick = () => confirmDo('Se borrará este registro.', () => { S.deudas = S.deudas.filter(i => i.id !== x.id); save(); render(); });
}
V.deudas = () => {
  const debo = S.deudas.filter(d => d.tipo !== 'medeben'), meDeben = S.deudas.filter(d => d.tipo === 'medeben');
  const totDebo = debo.reduce((a, d) => a + toDOP(deudaPend(d), d.moneda), 0), cuotas = debo.filter(d => deudaPend(d) > 0).reduce((a, d) => a + toDOP(d.cuota, d.moneda), 0);
  const t = totals(curMonth), ratio = t.i ? cuotas / t.i * 100 : 0;
  const card = d => { const p = pct(num(d.pagado), num(d.total)), pend = deudaPend(d), mesesF = num(d.cuota) ? Math.ceil(pend / num(d.cuota)) : null, paidM = (d.pagosMes || []).includes(curMonth);
    return `<div class="card"><h3><span>${DEUDA_TIPOS[d.tipo].split(' ')[0]} ${esc(d.nombre)}</span>${pend <= 0 ? '<span class="chip ok">🎉 Saldada</span>' : paidM ? '<span class="chip ok">✓ Cuota del mes</span>' : d.dia ? `<span class="chip">día ${d.dia}</span>` : ''}</h3><p class="muted small" style="margin:0 0 8px">${DEUDA_TIPOS[d.tipo].slice(2)} ${d.acreedor ? '· ' + esc(d.acreedor) : ''} ${d.tasa ? `· ${d.tasa}%` : ''}</p><div class="progress ${p >= 100 ? 'ok' : ''}"><div style="width:${Math.min(100, p)}%"></div></div><div class="kv section-gap"><span>${d.tipo === 'medeben' ? 'Me falta cobrar' : d.tipo === 'san' ? 'Me falta aportar' : 'Pendiente'}</span><b class="${d.tipo === 'medeben' ? 'green' : 'red'}">${fmtRaw(pend, d.moneda)}</b></div><div class="kv"><span>Total</span><b>${fmtRaw(d.total, d.moneda)}</b></div>${d.cuota ? `<div class="kv"><span>Cuota</span><b>${fmtRaw(d.cuota, d.moneda)}${mesesF ? ` · faltan ${mesesF}` : ''}</b></div>` : ''}${d.turno ? `<div class="kv"><span>🎉 Mi turno</span><b>${d.turno.split('-').reverse().join('/')} ${daysUntil(d.turno) >= 0 ? `(en ${daysUntil(d.turno)} días)` : ''}</b></div>` : ''}${d.notas ? `<p class="muted small">${esc(d.notas)}</p>` : ''}<div class="btn-row">${pend > 0 ? `<button class="btn sm success" data-abo="${d.id}">${d.tipo === 'medeben' ? '💰 Me pagaron' : '💸 Abonar'}</button>` : ''}<button class="btn sm" data-edd="${d.id}">✏️ Editar</button></div></div>`; };
  return `<div class="page-head"><div><h1 class="page-title">🤝 Deudas, préstamos y sanes</h1><p class="muted">Lo que debes, lo que te deben y tus sanes</p></div><button class="btn primary" id="addDeuda">➕ Agregar</button></div>
  <div class="grid g3">${stat('🔻 Debo en total', `<span class="red">${fmt(totDebo)}</span>`)}${stat('📆 Cuotas al mes', fmt(cuotas), t.i ? `${ratio.toFixed(0)}% de tus ingresos ${ratio > 35 ? '⚠️ alto' : '👍'}` : '')}${stat('💰 Me deben', `<span class="green">${fmt(meDeben.reduce((a, d) => a + toDOP(deudaPend(d), d.moneda), 0))}</span>`)}</div>
  ${debo.length > 1 ? `<div class="tip section-gap"><span class="e">❄️</span><div><b>Método bola de nieve:</b> paga primero <b>${esc(debo.filter(d => deudaPend(d) > 0).sort((a, b) => toDOP(deudaPend(a), a.moneda) - toDOP(deudaPend(b), b.moneda))[0]?.nombre || '—')}</b> (la más pequeña) y luego pasa esa cuota a la siguiente. O la de mayor interés primero (método avalancha): <b>${esc(debo.filter(d => deudaPend(d) > 0).sort((a, b) => num(b.tasa) - num(a.tasa))[0]?.nombre || '—')}</b>.</div></div>` : ''}
  <h3 class="section-gap">🔻 Lo que debo</h3><div class="grid g3">${debo.length ? debo.map(card).join('') : `<div class="card" style="grid-column:1/-1">${empty('🙌', 'Sin deudas registradas. ¡Bendición!')}</div>`}</div>
  <h3 class="section-gap">💰 Lo que me deben</h3><div class="grid g3">${meDeben.length ? meDeben.map(card).join('') : `<div class="card" style="grid-column:1/-1">${empty('💰', 'Anota a quién le prestaste para que no se te olvide')}</div>`}</div>`;
};
V.deudas.after = () => {
  $('#addDeuda').onclick = () => editDeuda();
  document.querySelectorAll('[data-edd]').forEach(b => b.onclick = () => editDeuda(S.deudas.find(x => x.id === b.dataset.edd)));
  document.querySelectorAll('[data-abo]').forEach(b => b.onclick = () => { const d = S.deudas.find(x => x.id === b.dataset.abo);
    form(d.tipo === 'medeben' ? `💰 Cobro de ${esc(d.nombre)}` : `💸 Abono a ${esc(d.nombre)}`, [{ k: 'm', label: `Monto (${d.moneda})`, type: 'number', req: true, def: d.cuota || '' }, { k: 'reg', label: d.tipo === 'medeben' ? 'Anotar como ingreso' : 'Anotar como gasto del mes', type: 'check', def: true }], {}, v => {
      d.pagado = num(d.pagado) + v.m; d.pagosMes = d.pagosMes || []; if (!d.pagosMes.includes(todayStr().slice(0, 7))) d.pagosMes.push(todayStr().slice(0, 7));
      if (v.reg) { if (d.tipo === 'medeben') S.ingresos.push({ id: uid(), fuente: 'otros', desc: `Cobro: ${d.nombre}`, monto: v.m, moneda: d.moneda, fecha: todayStr(), quien: 'ambos' }); else S.gastos.push({ id: uid(), categoria: d.tipo === 'tarjeta' ? 'tarjetas' : 'prestamos', desc: `Abono: ${d.nombre}`, monto: v.m, moneda: d.moneda, fecha: todayStr(), quien: 'ambos' }); }
      if (deudaPend(d) <= 0) setTimeout(confetti, 300); toast('✅ Registrado'); }); });
};

/* Ajustes */
V.ajustes = () => `<div class="page-head"><div><h1 class="page-title">⚙️ Ajustes y respaldo</h1><p class="muted">Tus datos, tus reglas</p></div></div>
  <div class="grid g2">
    <div class="card"><h3>👫 General</h3><form class="form" id="setForm">
      <label>Nombre 1<input name="nombre1" value="${esc(S.settings.nombre1)}"></label><label>Nombre 2<input name="nombre2" value="${esc(S.settings.nombre2)}"></label>
      <label>Mostrar montos en<select name="moneda">${opts({ DOP: 'RD$ Pesos dominicanos', USD: 'US$ Dólares' }, S.settings.moneda)}</select></label>
      <label>Tasa del dólar (RD$ por US$1)<input name="tasa" type="number" step="any" value="${esc(S.settings.tasa)}"></label>
      <label class="full">💵 Efectivo + cuentas de banco (RD$, para patrimonio)<input name="efectivo" type="number" step="any" value="${esc(S.settings.efectivo)}"></label>
    </form><div class="modal-actions"><button class="btn primary" id="saveSet">Guardar ✓</button></div></div>
    <div class="card"><h3>🔒 PIN de bloqueo</h3><p class="muted small">Pide un PIN de 4 dígitos al abrir la página en este dispositivo. Es una comodidad para que nadie vea tus números de pasada, <b>no es seguridad real</b>.</p>
      <div class="btn-row"><button class="btn primary" id="setPin">${S.settings.pin ? '🔁 Cambiar PIN' : '🔒 Poner PIN'}</button>${S.settings.pin ? '<button class="btn danger" id="rmPin">Quitar PIN</button>' : ''}</div>
      <h3 class="section-gap">🎨 Tema</h3><div class="btn-row"><button class="btn" data-theme-set="dark">🌙 Oscuro</button><button class="btn" data-theme-set="light">☀️ Claro</button></div></div>
    <div class="card"><h3>💾 Respaldo</h3><p class="muted small">Los datos viven <b>solo en este navegador</b>. Si borras el historial o cambias de teléfono, se pierden. Descarga un respaldo de vez en cuando e impórtalo en el otro dispositivo.</p>
      <div class="btn-row"><button class="btn primary" id="expJson">⬇️ Descargar respaldo (JSON)</button><label class="btn">⬆️ Importar respaldo<input type="file" id="impJson" accept=".json,application/json" hidden></label></div>
      <h3 class="section-gap">📊 Exportar a Excel</h3><div class="btn-row"><button class="btn" id="expCsv">⬇️ Movimientos (CSV)</button><button class="btn" id="expCsvR">⬇️ Rifas (CSV)</button></div></div>
    <div class="card"><h3>🧪 Datos</h3><p class="muted small">Carga datos de ejemplo para ver cómo funciona todo (no son tus datos reales). Luego bórralos y empieza con lo tuyo.</p>
      <div class="btn-row"><button class="btn" id="demo">🧪 Cargar datos de ejemplo</button><button class="btn danger" id="wipe">🗑️ Borrar todo</button></div>
      <p class="muted small section-gap">Yudiahorro v1 · hecho con 💜 para la casa de ${esc(S.settings.nombre1)} & ${esc(S.settings.nombre2)}</p></div>
  </div>`;
const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
const csv = rows => '\ufeff' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
V.ajustes.after = () => {
  $('#saveSet').onclick = () => { const f = $('#setForm').elements; S.settings.nombre1 = f.nombre1.value.trim() || 'Warmi'; S.settings.nombre2 = f.nombre2.value.trim() || 'Yudith'; S.settings.moneda = f.moneda.value; S.settings.tasa = num(f.tasa.value) || 1; S.settings.efectivo = num(f.efectivo.value); save(); render(); toast('✓ Ajustes guardados'); };
  document.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => { S.settings.theme = b.dataset.themeSet; save(); applyTheme(); render(); });
  $('#setPin').onclick = () => form('🔒 Nuevo PIN', [{ k: 'p', label: 'PIN de 4 dígitos', type: 'password', req: true }], {}, v => { if (!/^\d{4}$/.test(v.p)) { toast('El PIN debe ser de 4 números'); return; } S.settings.pin = hash(v.p); toast('🔒 PIN activado'); });
  const rp = $('#rmPin'); if (rp) rp.onclick = () => { S.settings.pin = ''; save(); render(); toast('🔓 PIN quitado'); };
  $('#expJson').onclick = () => download(`yudiahorro-respaldo-${todayStr()}.json`, JSON.stringify(S, null, 2), 'application/json');
  $('#impJson').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const d = JSON.parse(rd.result); if (!d.settings || !Array.isArray(d.gastos)) throw new Error('formato'); confirmDo('Esto reemplaza los datos actuales con el respaldo.', () => { S = Object.assign(blank(), d); S.settings = Object.assign(blank().settings, d.settings); save(); applyTheme(); render(); toast('✅ Respaldo importado'); }); } catch { toast('⚠️ Archivo no válido'); } }; rd.readAsText(f); };
  $('#expCsv').onclick = () => { const rows = [['Tipo', 'Fecha', 'Categoría/Fuente', 'Descripción', 'Monto', 'Moneda', 'Monto RD$', 'Quién', 'Recurrente']];
    S.ingresos.forEach(x => rows.push(['Ingreso', x.fecha, (INGRESO_SRCS[x.fuente] || [])[1], x.desc, x.monto, x.moneda, toDOP(x.monto, x.moneda).toFixed(2), QUIEN[x.quien], x.recurrente ? 'Sí' : 'No']));
    S.gastos.forEach(x => rows.push(['Gasto', x.fecha, (GASTO_CATS[x.categoria] || [])[1], x.desc, x.monto, x.moneda, toDOP(x.monto, x.moneda).toFixed(2), QUIEN[x.quien], x.recurrente ? 'Sí' : 'No']));
    rows.splice(1, rows.length, ...rows.slice(1).sort((a, b) => a[1].localeCompare(b[1])));
    download(`yudiahorro-movimientos-${todayStr()}.csv`, csv(rows), 'text/csv;charset=utf-8'); };
  $('#expCsvR').onclick = () => { const rows = [['Rifa', 'Premio', 'Fecha sorteo', 'Número', 'Comprador', 'Teléfono', 'Pagado', 'Precio']]; S.rifas.forEach(r => Object.entries(r.numeros).forEach(([n, v]) => rows.push([r.nombre, r.premio, r.fecha, n, v.nombre, v.tel, v.pagado ? 'Sí' : 'No', r.precio]))); download(`yudiahorro-rifas-${todayStr()}.csv`, csv(rows), 'text/csv;charset=utf-8'); };
  $('#demo').onclick = () => isEmpty() ? loadDemo() : confirmDo('Esto reemplaza tus datos actuales con datos de EJEMPLO. Descarga un respaldo antes si tienes datos reales.', loadDemo);
  $('#wipe').onclick = () => confirmDo('Se borrará TODO de este navegador. Descarga un respaldo antes si lo necesitas.', () => { const keep = { theme: S.settings.theme }; S = blank(); Object.assign(S.settings, keep); save(); render(); toast('🗑️ Todo borrado'); });
};

/* ---------- Datos de ejemplo (ficticios) ---------- */
function loadDemo() {
  const d = blank(); d.settings = Object.assign(d.settings, { theme: S.settings.theme, ejemplo: true, efectivo: 18500, fondoAhorrado: 42000 });
  const m0 = todayStr().slice(0, 7), dd = (k, day) => dueDate(day, addMonths(m0, k));
  const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
  for (let k = -5; k <= 0; k++) {
    d.ingresos.push({ id: uid(), fuente: 'salario', desc: 'Sueldo (ejemplo)', monto: 45000, moneda: 'DOP', fecha: dd(k, 15), quien: 'warmi', recurrente: true });
    d.ingresos.push({ id: uid(), fuente: 'fluye', desc: 'Suscripciones Fluye (ejemplo)', monto: rnd(80, 260), moneda: 'USD', fecha: dd(k, 2), quien: 'warmi', recurrente: true });
    d.ingresos.push({ id: uid(), fuente: 'conquer', desc: 'Donaciones servidor (ejemplo)', monto: rnd(3000, 9000), moneda: 'DOP', fecha: dd(k, 10), quien: 'warmi' });
    if (k % 2 === 0) d.ingresos.push({ id: uid(), fuente: 'youtube', desc: 'Monetización redes (ejemplo)', monto: rnd(20, 70), moneda: 'USD', fecha: dd(k, 21), quien: 'warmi' });
    d.ingresos.push({ id: uid(), fuente: 'ventas', desc: 'Ventas de Yudith (ejemplo)', monto: rnd(4000, 8000), moneda: 'DOP', fecha: dd(k, 18), quien: 'yudith' });
    [['luz', 'EDESUR (ejemplo)', rnd(2800, 4200), 5, 'warmi'], ['agua', 'Agua (ejemplo)', 450, 8, 'ambos'], ['internet', 'Internet Claro (ejemplo)', 2190, 12, 'warmi'], ['celular', 'Recargas (ejemplo)', rnd(800, 1400), 20, 'yudith'], ['alquiler', 'Alquiler (ejemplo)', 18000, 1, 'ambos'], ['colmado', 'Compra supermercado (ejemplo)', rnd(9000, 14000), 7, 'yudith'], ['colmado', 'Colmado (ejemplo)', rnd(2500, 4500), 22, 'yudith'], ['combustible', 'Gasolina (ejemplo)', rnd(3000, 5000), 14, 'warmi'], ['hosting', 'VPS servidor (ejemplo)', 25, 3, 'warmi'], ['salidas', 'Salida en familia (ejemplo)', rnd(1500, 4500), 25, 'ambos'], ['gas', 'Gas propano (ejemplo)', 1300, 16, 'ambos'], ['salud', 'ARS / farmacia (ejemplo)', rnd(900, 2500), 19, 'yudith']]
      .forEach(([c, ds, m, day, q]) => d.gastos.push({ id: uid(), categoria: c, desc: ds, monto: m, moneda: c === 'hosting' ? 'USD' : 'DOP', fecha: dd(k, day), quien: q, recurrente: ['alquiler', 'internet', 'hosting'].includes(c) }));
  }
  d.presupuestos = { luz: 4000, colmado: 15000, combustible: 4500, salidas: 3000, celular: 1200, salud: 2000, alquiler: 18000 };
  d.pagos = [
    { id: uid(), nombre: 'Alquiler (ejemplo)', tipo: 'fijo', categoria: 'alquiler', monto: 18000, moneda: 'DOP', dia: 1, quien: 'ambos', activo: true, pagados: [m0] },
    { id: uid(), nombre: 'EDESUR (ejemplo)', tipo: 'fijo', categoria: 'luz', monto: 3500, moneda: 'DOP', dia: 5, quien: 'warmi', activo: true, pagados: [] },
    { id: uid(), nombre: 'Internet Claro (ejemplo)', tipo: 'fijo', categoria: 'internet', monto: 2190, moneda: 'DOP', dia: 12, quien: 'warmi', activo: true, pagados: [] },
    { id: uid(), nombre: 'Colegio (ejemplo)', tipo: 'fijo', categoria: 'escuela', monto: 6500, moneda: 'DOP', dia: 28, quien: 'ambos', activo: true, pagados: [] },
    { id: uid(), nombre: 'Netflix (ejemplo)', tipo: 'suscripcion', categoria: 'suscripciones', monto: 9.99, moneda: 'USD', dia: 9, quien: 'warmi', activo: true, pagados: [] },
    { id: uid(), nombre: 'Spotify (ejemplo)', tipo: 'suscripcion', categoria: 'suscripciones', monto: 5.99, moneda: 'USD', dia: 17, quien: 'yudith', activo: true, pagados: [] },
    { id: uid(), nombre: 'VPS servidor (ejemplo)', tipo: 'suscripcion', categoria: 'hosting', monto: 25, moneda: 'USD', dia: 3, quien: 'warmi', activo: true, pagados: [m0] },
    { id: uid(), nombre: 'Dominio web (ejemplo)', tipo: 'suscripcion', categoria: 'hosting', monto: 1.5, moneda: 'USD', dia: 24, quien: 'warmi', activo: true, pagados: [] }
  ];
  d.inversiones = [
    { id: uid(), nombre: 'Certificado financiero (ejemplo)', tipo: 'certificado', invertido: 100000, actual: 108500, moneda: 'DOP', tasa: 9, fecha: dd(-10, 1) },
    { id: uid(), nombre: 'Cooperativa (ejemplo)', tipo: 'coop', invertido: 35000, actual: 37800, moneda: 'DOP', tasa: 8, fecha: dd(-8, 1) },
    { id: uid(), nombre: 'Bitcoin (ejemplo)', tipo: 'cripto', invertido: 300, actual: 365, moneda: 'USD', fecha: dd(-6, 1) },
    { id: uid(), nombre: 'Equipo para el negocio (ejemplo)', tipo: 'negocio', invertido: 25000, actual: 25000, moneda: 'DOP', fecha: dd(-4, 1) }
  ];
  d.metas = [
    { id: uid(), emoji: '🏠', nombre: 'Inicial de la casa (ejemplo)', objetivo: 600000, ahorrado: 145000, moneda: 'DOP', fecha: `${+m0.slice(0, 4) + 2}-12-31` },
    { id: uid(), emoji: '✈️', nombre: 'Viaje a Punta Cana (ejemplo)', objetivo: 40000, ahorrado: 31000, moneda: 'DOP', fecha: dd(4, 15) },
    { id: uid(), emoji: '🎄', nombre: 'Navidad y regalos (ejemplo)', objetivo: 25000, ahorrado: 25000, moneda: 'DOP' }
  ];
  d.deudas = [
    { id: uid(), tipo: 'prestamo', nombre: 'Préstamo del motor (ejemplo)', acreedor: 'Banco (ejemplo)', total: 120000, pagado: 70000, cuota: 5500, dia: 20, tasa: 18, moneda: 'DOP', pagosMes: [] },
    { id: uid(), tipo: 'tarjeta', nombre: 'Tarjeta de crédito (ejemplo)', acreedor: 'Banco (ejemplo)', total: 28000, pagado: 6000, cuota: 3000, dia: 26, tasa: 60, moneda: 'DOP', pagosMes: [] },
    { id: uid(), tipo: 'san', nombre: 'San del barrio (ejemplo)', acreedor: 'Doña (ejemplo)', total: 50000, pagado: 20000, cuota: 5000, dia: 30, moneda: 'DOP', turno: dd(3, 30), pagosMes: [], notas: '10 personas × RD$5,000. Me toca el turno 7.' },
    { id: uid(), tipo: 'medeben', nombre: 'Préstamo a un primo (ejemplo)', acreedor: 'Primo (ejemplo)', total: 8000, pagado: 3000, moneda: 'DOP', pagosMes: [] }
  ];
  const names = ['María (ejemplo)', 'José (ejemplo)', 'Carmen (ejemplo)', 'Luis (ejemplo)', 'Ana (ejemplo)', 'Pedro (ejemplo)', 'Rosa (ejemplo)', 'Juan (ejemplo)'];
  const mkRifa = (nombre, premio, costo, precio, cant, fecha, vend, ganador) => { const r = { id: uid(), nombre, premio, costoPremio: costo, precio, cantidad: cant, inicio: '0', fecha, loteria: 'Lotería Nacional', numeros: {}, ganador: null };
    const nums = rifaNums(r).sort(() => Math.random() - .5).slice(0, vend); nums.forEach((n, i) => r.numeros[n] = { nombre: names[i % names.length], tel: '809-555-01' + pad(i % 100), pagado: Math.random() < .75 || !!ganador });
    if (ganador) { r.ganador = nums[0]; r.ingresoRegistrado = true; } return r; };
  d.rifas = [mkRifa('Rifa del Air Fryer (ejemplo)', 'Air Fryer 5L', 4500, 100, 100, dd(0, 28), 63), mkRifa('Rifa del celular (ejemplo)', 'Celular nuevo', 15000, 300, 100, dd(-1, 25), 92, true)];
  d.ingresos.push({ id: uid(), fuente: 'rifas', desc: 'Ganancia rifa del celular (ejemplo)', monto: 92 * 300 - 15000, moneda: 'DOP', fecha: dd(-1, 25), quien: 'yudith' });
  S = d; save(); applyTheme(); render(); toast('🧪 Datos de ejemplo cargados');
}

/* ---------- Confetti ---------- */
function confetti() {
  const cv = $('#confetti'), ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - .5) * 16, vy: Math.random() * -14 - 4, s: 4 + Math.random() * 6, c: PALETTE[Math.floor(Math.random() * PALETTE.length)], r: Math.random() * 6 }));
  let f = 0; (function tick() { ctx.clearRect(0, 0, cv.width, cv.height); ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.vx *= .99; p.r += .1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); }); if (++f < 160) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height); })();
}

/* ---------- PIN ---------- */
function hash(s) { let h = 5381; for (const c of 'yudi:' + s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); }
function lockScreen() {
  if (!S.settings.pin || sessionStorage.getItem('yudi_unlocked') === '1') return;
  const lock = $('#lock'); lock.classList.remove('hidden'); let entry = '';
  const dots = () => $('#pinDots').innerHTML = [0, 1, 2, 3].map(i => `<span class="${i < entry.length ? 'f' : ''}"></span>`).join('');
  $('#pinPad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : `<button data-k="${k}">${k}</button>`).join('');
  dots();
  const press = k => { if (k === '⌫') entry = entry.slice(0, -1); else if (entry.length < 4) entry += k; dots();
    if (entry.length === 4) { if (hash(entry) === S.settings.pin) { sessionStorage.setItem('yudi_unlocked', '1'); lock.classList.add('hidden'); } else { const c = $('.lock-card'); c.classList.add('shake'); setTimeout(() => c.classList.remove('shake'), 400); entry = ''; setTimeout(dots, 300); } } };
  $('#pinPad').onclick = e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
  document.addEventListener('keydown', e => { if (lock.classList.contains('hidden')) return; if (/^\d$/.test(e.key)) press(e.key); if (e.key === 'Backspace') press('⌫'); });
}

/* ---------- Render ---------- */
function render() {
  charts.forEach(c => c.destroy()); charts = [];
  if (!V[view]) view = 'resumen';
  $('#monthLabel').textContent = monthName(curMonth);
  $('#hello').textContent = `${S.settings.nombre1} & ${S.settings.nombre2}`;
  renderNav();
  $('#main').innerHTML = V[view]();
  if (V[view].after) V[view].after();
  document.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => b.dataset.quick === 'ingreso' ? editIngreso() : editGasto());
}
applyTheme(); render(); lockScreen();
window.addEventListener('load', () => { if (view === 'resumen') render(); }); // re-dibuja gráficos cuando Chart.js cargue
})();
