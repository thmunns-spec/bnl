const STORAGE_KEY = "bnl_finimport_v2";
const DEFAULT_CATEGORIES = [
  "Spesa","Casa","Salute","Trasporti","Auto","Prelievi",
  "Bollette","Abbonamenti","Lavoro","Tempo libero","Ristoranti","Varie"
];

let transactions = [];
let state = loadState();

const els = {
  status: document.getElementById("status"),
  stats: document.getElementById("stats"),
  fileInput: document.getElementById("fileInput"),
  reloadPreloadedBtn: document.getElementById("reloadPreloadedBtn"),
  exportBtn: document.getElementById("exportBtn"),
  searchInput: document.getElementById("searchInput"),
  kindFilter: document.getElementById("kindFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  newCategoryInput: document.getElementById("newCategoryInput"),
  addCategoryBtn: document.getElementById("addCategoryBtn"),
  bulkCategorySelect: document.getElementById("bulkCategorySelect"),
  applyVisibleBtn: document.getElementById("applyVisibleBtn"),
  txBody: document.getElementById("txBody")
};

init();

async function init(){
  bindEvents();
  ensureDefaultCategories();
  refreshCategorySelectors();
  await loadPreloadedData();
  render();
}

function bindEvents(){
  els.fileInput.addEventListener("change", importFile);
  els.reloadPreloadedBtn.addEventListener("click", loadPreloadedData);
  els.exportBtn.addEventListener("click", exportCSV);
  els.searchInput.addEventListener("input", render);
  els.kindFilter.addEventListener("change", render);
  els.categoryFilter.addEventListener("change", render);
  els.addCategoryBtn.addEventListener("click", addCategory);
  els.applyVisibleBtn.addEventListener("click", applyBulkCategory);
}

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
      categories: [],
      assignments: {}
    };
  }catch{
    return { categories: [], assignments: {} };
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureDefaultCategories(){
  if(!state.categories || !state.categories.length){
    state.categories = [...DEFAULT_CATEGORIES];
    saveState();
  }
}

function setStatus(msg, type=""){
  els.status.textContent = msg;
  els.status.className = "status" + (type ? " " + type : "");
}

async function loadPreloadedData(){
  try{
    setStatus("Caricamento dei movimenti inclusi…");
    const res = await fetch("data.json?v=2");
    if(!res.ok) throw new Error("data.json non trovato");
    transactions = await res.json();
    setStatus(`Movimenti caricati: ${transactions.length}`, "ok");
    render();
  }catch(err){
    setStatus("Errore caricamento dati inclusi: " + err.message, "err");
  }
}

async function importFile(event){
  const file = event.target.files[0];
  if(!file) return;

  try{
    const ext = file.name.toLowerCase().split(".").pop();
    setStatus("Import in corso…");

    if(ext === "csv"){
      const text = await file.text();
      transactions = parseCSV(text);
      setStatus(`CSV importato: ${transactions.length} movimenti`, "ok");
      render();
      return;
    }

    if(ext === "xlsx"){
      if(typeof XLSX === "undefined"){
        throw new Error("libreria XLSX non caricata");
      }
      const buffer = await file.arrayBuffer();
      transactions = parseXLSX(buffer);
      setStatus(`XLSX importato: ${transactions.length} movimenti`, "ok");
      render();
      return;
    }

    throw new Error("Formato non supportato");
  }catch(err){
    setStatus("Import fallito: " + err.message, "err");
  }finally{
    event.target.value = "";
  }
}

function parseXLSX(buffer){
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  const out = [];
  for(const row of rows){
    if(!row || row.length < 3) continue;
    const date = row[0] ?? "";
    const amount = Number(row[1] ?? 0);
    const description = row[2] ?? "";
    const type = row[3] ?? "";
    if(String(date).trim()==="" && String(description).trim()==="") continue;
    out.push(makeTx(date, amount, description, type));
  }
  if(!out.length) throw new Error("0 movimenti letti");
  return out;
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  const out = [];
  for(const line of lines){
    const cols = splitCSVLine(line);
    if(cols.length < 3) continue;
    const date = cols[0];
    const amount = normalizeAmount(cols[1]);
    const description = cols[2] || "";
    const type = cols[3] || "";
    out.push(makeTx(date, amount, description, type));
  }
  if(!out.length) throw new Error("0 movimenti letti");
  return out;
}

function splitCSVLine(line){
  const result = [];
  let cur = "";
  let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){
      if(inQuotes && line[i+1] === '"'){
        cur += '"';
        i++;
      }else{
        inQuotes = !inQuotes;
      }
    }else if(ch === "," && !inQuotes){
      result.push(cur);
      cur = "";
    }else{
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function normalizeAmount(value){
  const s = String(value).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function makeTx(date, amount, description, type){
  const norm = {
    date: String(date),
    amount: Number(amount),
    description: String(description || ""),
    type: String(type || "")
  };
  norm.id = hashId([norm.date, norm.amount, norm.description, norm.type].join("|"));
  return norm;
}

function hashId(str){
  let h = 2166136261;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24);
  }
  return (h >>> 0).toString(16);
}

function addCategory(){
  const name = els.newCategoryInput.value.trim();
  if(!name) return;
  if(!state.categories.includes(name)){
    state.categories.push(name);
    state.categories.sort((a,b)=>a.localeCompare(b, "it"));
    saveState();
    refreshCategorySelectors();
    render();
  }
  els.newCategoryInput.value = "";
}

function refreshCategorySelectors(){
  const currentFilter = els.categoryFilter.value;
  const currentBulk = els.bulkCategorySelect.value;
  els.categoryFilter.innerHTML = '<option value="">Tutte le categorie</option>';
  els.bulkCategorySelect.innerHTML = '<option value="">Categoria massiva</option>';

  for(const cat of state.categories){
    const opt1 = document.createElement("option");
    opt1.value = cat;
    opt1.textContent = cat;
    els.categoryFilter.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = cat;
    opt2.textContent = cat;
    els.bulkCategorySelect.appendChild(opt2);
  }
  els.categoryFilter.value = currentFilter;
  els.bulkCategorySelect.value = currentBulk;
}

function getVisibleTransactions(){
  const q = els.searchInput.value.trim().toLowerCase();
  const kind = els.kindFilter.value;
  const catFilter = els.categoryFilter.value;

  return transactions.filter(tx=>{
    const assigned = state.assignments[tx.id] || "";
    const hay = (tx.description + " " + tx.type).toLowerCase();

    if(q && !hay.includes(q)) return false;
    if(kind === "uscite" && !(tx.amount < 0)) return false;
    if(kind === "entrate" && !(tx.amount > 0)) return false;
    if(catFilter && assigned !== catFilter) return false;
    return true;
  });
}

function applyBulkCategory(){
  const cat = els.bulkCategorySelect.value;
  if(!cat) return;
  const visible = getVisibleTransactions();
  for(const tx of visible){
    state.assignments[tx.id] = cat;
  }
  saveState();
  setStatus(`Categoria "${cat}" applicata a ${visible.length} movimenti visibili`, "ok");
  render();
}

function render(){
  const visible = getVisibleTransactions();
  els.txBody.innerHTML = "";

  for(const tx of visible){
    const tr = document.createElement("tr");

    const amountClass = tx.amount < 0 ? "neg" : (tx.amount > 0 ? "pos" : "");
    tr.innerHTML = `
      <td>${escapeHtml(tx.date)}</td>
      <td class="amount ${amountClass}">${formatEuro(tx.amount)}</td>
      <td>${escapeHtml(tx.description)}</td>
      <td>${escapeHtml(tx.type)}</td>
      <td></td>
    `;

    const select = document.createElement("select");
    select.className = "small-select";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "";
    select.appendChild(empty);

    for(const cat of state.categories){
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      if((state.assignments[tx.id] || "") === cat) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener("change", ()=>{
      if(select.value){
        state.assignments[tx.id] = select.value;
      }else{
        delete state.assignments[tx.id];
      }
      saveState();
      renderStats();
    });

    tr.children[4].appendChild(select);
    els.txBody.appendChild(tr);
  }

  renderStats();
}

function renderStats(){
  const total = transactions.length;
  const visible = getVisibleTransactions().length;
  const assignedCount = transactions.filter(tx => !!state.assignments[tx.id]).length;
  const uncategorized = total - assignedCount;

  els.stats.textContent =
    `Movimenti totali: ${total} · Visibili: ${visible} · Categorizzati: ${assignedCount} · Senza categoria: ${uncategorized}`;
}

function exportCSV(){
  const rows = [["Data","Importo","Descrizione","Tipo","Categoria"]];
  for(const tx of transactions){
    rows.push([
      tx.date,
      String(tx.amount),
      tx.description,
      tx.type,
      state.assignments[tx.id] || ""
    ]);
  }
  const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "movimenti_categorizzati.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n]/.test(s)){
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

function formatEuro(n){
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(n) || 0);
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
