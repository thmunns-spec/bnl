
let transactions = []
let categories = JSON.parse(localStorage.getItem("categories")||"[]")
let savedCats = JSON.parse(localStorage.getItem("txCats")||"{}")

const fileInput = document.getElementById("fileInput")
const tableBody = document.querySelector("#table tbody")
const filterCategory = document.getElementById("filterCategory")

fileInput.addEventListener("change", handleFile)

function handleFile(e){
const file = e.target.files[0]
const reader = new FileReader()

reader.onload = function(evt){
const data = new Uint8Array(evt.target.result)
const workbook = XLSX.read(data, {type:"array"})
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet,{header:1})

transactions = []

for(let i=0;i<rows.length;i++){
let r = rows[i]
if(!r || r.length<3) continue

transactions.push({
id:i,
date:r[0],
amount:r[1],
description:r[2]||"",
type:r[3]||""
})
}

renderTable()
}

reader.readAsArrayBuffer(file)
}

function addCategory(){
const input = document.getElementById("newCategory")
const val = input.value.trim()
if(!val) return

categories.push(val)
localStorage.setItem("categories",JSON.stringify(categories))

input.value=""
updateCategoryFilters()
renderTable()
}

function updateCategoryFilters(){
filterCategory.innerHTML='<option value="">Tutte le categorie</option>'
categories.forEach(c=>{
const opt=document.createElement("option")
opt.value=c
opt.textContent=c
filterCategory.appendChild(opt)
})
}

function renderTable(){

tableBody.innerHTML=""

transactions.forEach(t=>{

const cat = savedCats[t.id] || ""

if(filterCategory.value && cat!==filterCategory.value) return

const tr=document.createElement("tr")

tr.innerHTML=`
<td>${t.date}</td>
<td>${t.amount}</td>
<td>${t.description}</td>
<td>${t.type}</td>
<td></td>
`

const select=document.createElement("select")

const empty=document.createElement("option")
empty.value=""
empty.textContent=""
select.appendChild(empty)

categories.forEach(c=>{
const opt=document.createElement("option")
opt.value=c
opt.textContent=c
if(cat===c) opt.selected=true
select.appendChild(opt)
})

select.onchange=function(){
savedCats[t.id]=this.value
localStorage.setItem("txCats",JSON.stringify(savedCats))
}

tr.children[4].appendChild(select)

tableBody.appendChild(tr)

})

}

function exportCSV(){

let rows = [["Data","Importo","Descrizione","Tipo","Categoria"]]

transactions.forEach(t=>{

rows.push([
t.date,
t.amount,
t.description,
t.type,
savedCats[t.id]||""
])

})

let csv = rows.map(r=>r.join(",")).join("\n")

let blob = new Blob([csv],{type:"text/csv"})
let url = URL.createObjectURL(blob)

let a=document.createElement("a")
a.href=url
a.download="spese_categorizzate.csv"
a.click()

}

updateCategoryFilters()
