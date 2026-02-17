# Angular UI Blueprint

This folder contains Angular source files for a local-only Takeout UI.

## How to apply once npm/network is available

1. Scaffold Angular app:

```bash
npx @angular/cli@20 new ui-angular-run --skip-git --standalone --routing --style=css --ssr=false
```

2. Install zip dependency:

```bash
cd ui-angular-run
npm i @zip.js/zip.js
```

3. Copy files from this blueprint into the generated app:

- `ui-angular/src/main.ts` -> `ui-angular-run/src/main.ts`
- `ui-angular/src/index.html` -> `ui-angular-run/src/index.html`
- `ui-angular/src/styles.css` -> `ui-angular-run/src/styles.css`
- `ui-angular/src/app/app.component.ts` -> `ui-angular-run/src/app/app.component.ts`
- `ui-angular/src/app/app.component.html` -> `ui-angular-run/src/app/app.component.html`
- `ui-angular/src/app/app.component.css` -> `ui-angular-run/src/app/app.component.css`
- `ui-angular/src/app/takeout-fs.service.ts` -> `ui-angular-run/src/app/takeout-fs.service.ts`

4. Run:

```bash
npm start
```

Use Chromium browser and allow folder access. No remote backend is used.
