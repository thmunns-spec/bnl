# BNL FinImport

App web statica pensata per GitHub Pages.

## Come pubblicarla
1. crea o apri un repository GitHub pubblico
2. carica `index.html` e `.nojekyll` nella root
3. vai su **Settings → Pages**
4. in **Build and deployment** scegli:
   - **Source**: Deploy from a branch
   - **Branch**: `main`
   - **Folder**: `/ (root)`
5. salva e aspetta il link pubblico

## Cosa fa
- importa il file XLSX BNL
- mostra i movimenti in tabella
- permette di assegnare merchant, categoria e sottocategoria
- salva regole riutilizzabili
- esporta un nuovo XLSX arricchito
- salva/carica un archivio JSON completo

## Nota
La libreria XLSX viene caricata da CDN, quindi l'app deve essere online.
