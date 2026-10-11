# WasteFlow AI - frontend

Dashboard, Live Map, Bins, Trucks & Routes, AI Recommendations, Analytics, Forecasts, Alerts and Simulation (hash routes #/dash, #/map, #/bins, #/trucks, #/ai, #/analytics, #/forecast, #/alerts, #/sim) (plain HTML, CSS, JS, Three.js from CDN).

## Run
Option 1: double-click `index.html`.
Option 2 (recommended): in this folder run `python -m http.server 8000` and open http://localhost:8000

Internet is needed for Three.js (cdnjs) and Google Fonts.

## Files
- `index.html`   page structure
- `css/styles.css`  colour tokens (top of file, light + dark), layout, components
- `js/app.js`    demo model (calc), assumptions register, Sankey, tornado, 3D scene

## Change colours
Edit the `:root` variables at the top of `css/styles.css`. 3D colours are hex values inside `initScene()` in `js/app.js`.

## Connect your AWS API
In `js/app.js` set `API_URL` and replace `calc(state)` inside `render()` with the JSON returned by your `/scenario` endpoint (same field names as `calc()` returns).

## Notes
Demo data is synthetic. Emission and biogas factors are typical values: verify them before real use.
