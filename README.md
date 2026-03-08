# BNL Categorizer

Mini app statica pronta per GitHub Pages.

## Cosa fa
- carica i movimenti già estratti dal file Numbers allegato
- permette di assegnare categorie manualmente a ogni riga
- salva categorie e assegnazioni nel browser con localStorage
- importa anche file CSV/XLSX
- esporta un CSV con colonna `Categoria`

## Limite importante
Una web app statica non gestisce in modo affidabile i file `.numbers` direttamente nel browser. Per questo ho già convertito il file allegato in `data.json` e `sample-export.csv`.
Per i futuri import conviene esportare da Numbers in **CSV** o **XLSX**.

## Pubblicazione su GitHub
1. crea una repository
2. carica dentro questi file:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `data.json`
3. abilita GitHub Pages sulla branch principale
4. apri l'URL pubblicato
