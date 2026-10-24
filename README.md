# WeatherMap

Advanced Web Technologies -Project 2.
An asynchronous, client-side Single Page Application: type any place, get its live weather in an interactive map popup. No page reloads, no frameworks.

**Live demo:** [https://x7hero108.github.io/weather_map/](https://x7hero108.github.io/weather_map/)

## Features

- Map initialised on Khartoum (15.5007, 32.5599) at zoom 6
- Chained async flow: Nominatim geocoding -> OpenWeatherMap Current Weather -> map update
- Smooth `flyTo` animation, one marker at a time (previous marker is removed)
- Rich popup card: city, temperature, weather icon, clouds, humidity, wind speed, **Share** button
- CSS spinner while loading; friendly alert cards for empty input, unknown place, 401/404/429 and network errors
- Bonus: Share via Web Share API (clipboard fallback) and Favorites saved in `localStorage`

## APIs used

| Purpose | Service |
|---|---|
| Weather (JSON, metric units) | OpenWeatherMap Current Weather `data/2.5/weather` |
| Geocoding | Nominatim (OpenStreetMap); falls back to OpenWeatherMap Geocoding |
| Map | Leaflet 1.9.4 + OpenStreetMap tiles (no key needed) |

## Setup

1. Create a free account at [openweathermap.org](https://openweathermap.org) and copy your API key (activation can take up to 2 hours).
2. Open `js/config.js` and replace `YOUR_API_KEY_HERE` with your key.
3. Serve the folder (any static server) or open `index.html`:
   ```bash
   python -m http.server 8000   # then visit http://localhost:8000
   ```

> The key is visible to anyone who opens the deployed site (unavoidable in a pure front-end app). Use a free-tier key and never reuse a paid or private one.

## Deploy to GitHub Pages

1. Push the project to a GitHub repository.
2. *Settings -> Pages -> Deploy from a branch -> `main` / root*.
3. Put the resulting URL in the **Live demo** line above.

## Project structure

```
index.html        structure only (no inline JS/CSS)
css/styles.css    all presentation
js/config.js      API key
js/app.js         all behaviour (listeners via addEventListener)
```

## Constraints respected

Pure vanilla JS (no React/Vue/Angular/jQuery/d3) - separate HTML/CSS/JS files - no inline handlers or styles - `event.preventDefault()` on submit - `async/await` with `try/catch/finally` - map container exactly `70vh` with navy border - Google Font (Roboto) - page title `2em` with box shadow.

