const STORAGE_KEYS = {
  categories: 'bnl-categorizer-categories-v1',
  assignments: 'bnl-categorizer-assignments-v1',
  dataset: 'bnl-categorizer-dataset-v1'
};

const DEFAULT_CATEGORIES = [
  'Spesa alimentare', 'Ristoranti / Bar', 'Casa', 'Salute', 'Trasporti',
  'Contanti / Prelievi', 'Abbonamenti', 'Lavoro', 'Tasse / Commissioni', 'Altro'
];

let state = {
  transactions: [],
  categories: loadJson(STORAGE_KEYS.categories, DEFAULT_CATEGORIES),
  assignments: loadJson(STORAGE_KEYS.assignments, {}),
  filters: { search: '', category: '', type: '' }
};

const els = {
  body: document.getElementById('transactionsBody'),
  tableMeta: document.getElementById('tableMeta'),
  categoriesList: document.getElementById('categoriesList'),
  categoryFilter: document.getElementById('categoryFilter'),
  summaryBox: document.getElementById('summaryBox'),
  searchInput: document.getElementById('searchInput'),
  typeFilter: document.getElementById('typeFilter'),
  fileInput: document.getElementById('fileInput'),
  newCategoryInput: document.getElementById('newCategoryInput')
};

init();

async function init() {
  const savedDataset = loadJson(STORAGE_KEYS.dataset, null);
  if (savedDataset?.length) {
    state.transactions = savedDataset;
    renderAll();
  } else {
    await loadSeedData();
  }
  bindEvents();
}

function bindEvents() {
  document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
  document.getElementById('exportBtn').addEventListener('click', exportCsv);
  document.getElementById('reloadSeedBtn').addEventListener('click', async () => {
    await loadSeedData(true);
  });
  document.getElementById('resetAssignmentsBtn').addEventListener('click', () => {
    if (!confirm('Vuoi davvero cancellare tutte le categorie assegnate?')) return;
    state.assignments = {};
    persistAssignments();
    renderAll();
  });
  els.searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value.trim().toLowerCase();
    renderTable();
  });
  els.categoryFilter.addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    renderTable();
  });
  els.typeFilter.addEventListener('change', (e) => {
    state.filters.type = e.target.value;
    renderTable();
  });
  els.fileInput.addEventListener('change', handleFileImport);
  els.newCategoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCategory();
  });
}

async function loadSeedData(override = false) {
  const res = await fetch('data.json');
  const data = await res.json();
  state.transactions = data;
  if (override) {
    localStorage.removeItem(STORAGE_KEYS.dataset);
  }
  persistDataset();
  renderAll();
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function persistDataset() {
  localStorage.setItem(STORAGE_KEYS.dataset, JSON.stringify(state.transactions));
}
function persistCategories() {
  localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(state.categories));
}
function persistAssignments() {
  localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(state.assignments));
}

function renderAll() {
  renderCategories();
  renderCategoryFilter();
  renderTable();
  renderSummary();
}

function renderCategories() {
  els.categoriesList.innerHTML = '';
  state.categories.forEach((cat) => {
    const row = document.createElement('div');
    row.className = 'category-item';
    row.innerHTML = `<span>${escapeHtml(cat)}</span>`;
    const btn = document.createElement('button');
    btn.className = 'ghost danger';
    btn.textContent = 'Elimina';
    btn.addEventListener('click', () => deleteCategory(cat));
    row.appendChild(btn);
    els.categoriesList.appendChild(row);
  });
}

function renderCategoryFilter() {
  const current = state.filters.category;
  els.categoryFilter.innerHTML = '<option value="">Tutte le categorie</option><option value="__uncategorized__">Solo senza categoria</option>';
  state.categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === current) opt.selected = true;
    els.categoryFilter.appendChild(opt);
  });
}

function getFilteredTransactions() {
  return state.transactions.filter((tx) => {
    const assigned = state.assignments[tx.id] || '';
    const haystack = `${tx.description} ${tx.detail}`.toLowerCase();
    const searchOk = !state.filters.search || haystack.includes(state.filters.search);
    const categoryOk = !state.filters.category
      || (state.filters.category === '__uncategorized__' ? !assigned : assigned === state.filters.category);
    const typeOk = !state.filters.type
      || (state.filters.type === 'expense' ? tx.amount < 0 : tx.amount > 0);
    return searchOk && categoryOk && typeOk;
  });
}

function renderTable() {
  const rows = getFilteredTransactions();
  els.body.innerHTML = '';
  rows.forEach((tx) => {
    const tr = document.createElement('tr');
    const amountClass = tx.amount < 0 ? 'amount-negative' : 'amount-positive';
    const select = categorySelect(tx.id);
    tr.innerHTML = `
      <td>${escapeHtml(tx.date)}</td>
      <td>${escapeHtml(tx.description)}</td>
      <td>${escapeHtml(tx.detail || '')}</td>
      <td class="right ${amountClass}">${formatCurrency(tx.amount)}</td>
      <td></td>
    `;
    tr.children[4].appendChild(select);
    els.body.appendChild(tr);
  });

  const total = rows.reduce((sum, tx) => sum + tx.amount, 0);
  els.tableMeta.innerHTML = `${rows.length} movimenti visibili · saldo filtro <span class="pill">${formatCurrency(total)}</span>`;
  renderSummary();
}

function categorySelect(id) {
  const select = document.createElement('select');
  select.className = 'category-select';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '—';
  select.appendChild(empty);
  state.categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
  select.value = state.assignments[id] || '';
  select.addEventListener('change', (e) => {
    const value = e.target.value;
    if (value) state.assignments[id] = value;
    else delete state.assignments[id];
    persistAssignments();
    renderSummary();
  });
  return select;
}

function renderSummary() {
  const filtered = getFilteredTransactions();
  const total = filtered.length;
  const categorized = filtered.filter((tx) => state.assignments[tx.id]).length;
  const uncategorized = total - categorized;
  const expenses = filtered.filter((tx) => tx.amount < 0);
  const grouped = {};
  expenses.forEach((tx) => {
    const cat = state.assignments[tx.id] || 'Senza categoria';
    grouped[cat] = (grouped[cat] || 0) + Math.abs(tx.amount);
  });
  const entries = Object.entries(grouped).sort((a,b) => b[1]-a[1]).slice(0,8);

  els.summaryBox.innerHTML = `
    <div class="summary-card"><strong>Movimenti visibili</strong>${total}</div>
    <div class="summary-card"><strong>Categorizzati</strong>${categorized}</div>
    <div class="summary-card"><strong>Senza categoria</strong>${uncategorized}</div>
    <div class="summary-card"><strong>Top uscite</strong>${entries.length ? entries.map(([cat,val]) => `<div>${escapeHtml(cat)} · ${formatCurrency(-val)}</div>`).join('') : 'Nessuna uscita'}</div>
  `;
}

function addCategory() {
  const value = els.newCategoryInput.value.trim();
  if (!value) return;
  if (state.categories.includes(value)) {
    alert('Categoria già presente.');
    return;
  }
  state.categories.push(value);
  state.categories.sort((a,b) => a.localeCompare(b, 'it'));
  els.newCategoryInput.value = '';
  persistCategories();
  renderAll();
}

function deleteCategory(cat) {
  const inUse = Object.values(state.assignments).includes(cat);
  if (inUse && !confirm(`La categoria "${cat}" è già assegnata ad alcuni movimenti. Eliminarla rimuoverà anche quelle assegnazioni. Continuare?`)) {
    return;
  }
  state.categories = state.categories.filter((x) => x !== cat);
  Object.keys(state.assignments).forEach((key) => {
    if (state.assignments[key] === cat) delete state.assignments[key];
  });
  persistCategories();
  persistAssignments();
  renderAll();
}

async function handleFileImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const name = file.name.toLowerCase();
  try {
    let transactions = [];
    if (name.endsWith('.csv')) {
      const text = await file.text();
      transactions = parseCsv(text);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      transactions = parseWorkbook(buffer);
    } else {
      throw new Error('Formato non supportato. Usa CSV o XLSX.');
    }
    if (!transactions.length) throw new Error('Nessun movimento trovato nel file.');
    state.transactions = transactions;
    persistDataset();
    renderAll();
    alert(`Import riuscito: ${transactions.length} movimenti.`);
  } catch (err) {
    console.error(err);
    alert(err.message || 'Errore durante l'import.');
  } finally {
    event.target.value = '';
  }
}

function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return normalizeRows(rows);
}

function parseCsv(text) {
  const wb = XLSX.read(text, { type: 'string' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return normalizeRows(rows);
}

function normalizeRows(rows) {
  if (!rows?.length) return [];
  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const idx = {
    date: findIndex(header, ['data valuta', 'data', 'date']),
    amount: findIndex(header, ['importo', 'amount']),
    description: findIndex(header, ['descrizione', 'description']),
    detail: findIndex(header, ['dettaglio', 'detail', 'causale'])
  };
  if ([idx.date, idx.amount, idx.description].some((v) => v < 0)) {
    throw new Error('Colonne richieste non trovate. Servono almeno Data, Importo e Descrizione.');
  }
  return rows.slice(1)
    .filter((r) => r.some((cell) => String(cell).trim() !== ''))
    .map((r) => {
      const tx = {
        date: String(r[idx.date] ?? '').trim(),
        amount: parseAmount(r[idx.amount]),
        description: String(r[idx.description] ?? '').trim(),
        detail: idx.detail >= 0 ? String(r[idx.detail] ?? '').trim() : ''
      };
      tx.id = hashId([tx.date, tx.amount, tx.description, tx.detail].join('|'));
      return tx;
    });
}

function parseAmount(value) {
  if (typeof value === 'number') return value;
  const clean = String(value).trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findIndex(header, aliases) {
  return header.findIndex((col) => aliases.includes(col));
}

function exportCsv() {
  const lines = [['Data valuta','Importo','Descrizione','Dettaglio','Categoria']];
  state.transactions.forEach((tx) => {
    lines.push([tx.date, tx.amount, tx.description, tx.detail, state.assignments[tx.id] || '']);
  });
  const csv = lines.map((row) => row.map(csvCell).join(';')).join('
');
  const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'movimenti-categorizzati.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"
]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}
function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return 'tx_' + Math.abs(h);
}
