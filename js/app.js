'use strict';



const DEFAULT_VIEW = { lat: 15.5007, lng: 32.5599, zoom: 6 }; // Khartoum
const FAVORITES_KEY = 'weathermap:favorites';
const OWM_ICON_URL = 'https://openweathermap.org/img/wn/';

const els = {
  form: document.getElementById('search-form'),
  input: document.getElementById('location-input'),
  button: document.getElementById('submit-btn'),
  favorites: document.getElementById('favorites'),
  spinner: document.getElementById('spinner'),
  alert: document.getElementById('alert'),
  alertText: document.getElementById('alert-text'),
  alertClose: document.getElementById('alert-close')
};

let map = null;
let marker = null;
let busy = false;


function initMap() {
  map = L.map('map').setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
}


function setLoading(isLoading) {
  busy = isLoading;
  els.spinner.hidden = !isLoading;
  els.button.disabled = isLoading;
}

function showError(message) {
  els.alertText.textContent = message;
  els.alert.hidden = false;
}

function hideError() {
  els.alert.hidden = true;
  els.alertText.textContent = '';
}

function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}


async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function hasApiKey() {
  return typeof CONFIG !== 'undefined' && CONFIG.OWM_API_KEY && !CONFIG.OWM_API_KEY.startsWith('YOUR_');
}


async function geocode(query) {
  try {
    const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' });
    const results = await fetchJSON(`https://nominatim.openstreetmap.org/search?${params}`);
    if (results.length > 0) {
      const hit = results[0];
      return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), name: hit.name || hit.display_name.split(',')[0] };
    }
  } catch (error) {
    console.warn('Nominatim unavailable, trying OpenWeatherMap geocoding.', error);
  }

  
  const params = new URLSearchParams({ q: query, limit: '1', appid: CONFIG.OWM_API_KEY });
  const results = await fetchJSON(`https://api.openweathermap.org/geo/1.0/direct?${params}`);
  if (results.length === 0) return null;
  return { lat: results[0].lat, lng: results[0].lon, name: results[0].name };
}


function fetchWeather(lat, lng) {
  const params = new URLSearchParams({ lat, lon: lng, appid: CONFIG.OWM_API_KEY, units: 'metric' });
  return fetchJSON(`https://api.openweathermap.org/data/2.5/weather?${params}`);
}


function buildShareText(place, weather) {
  const condition = weather.weather[0].description;
  return `Weather in ${place.name}: ${Math.round(weather.main.temp)}°C, ${condition}. ` +
    `Humidity ${weather.main.humidity}%, wind ${weather.wind.speed} m/s, clouds ${weather.clouds.all}%. ` +
    `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=11/${place.lat}/${place.lng}`;
}

async function shareWeather(button, text) {
  const original = button.textContent;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'WeatherMap', text });
    } else {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied!';
      setTimeout(() => { button.textContent = original; }, 1800);
    }
  } catch (error) {
    if (error.name !== 'AbortError') showError('Sharing is not available in this browser. Please copy the weather details manually.');
  }
}

function buildCard(place, weather) {
  const info = weather.weather[0];
  const card = createEl('div', 'weather-card');
  const country = weather.sys && weather.sys.country ? `, ${weather.sys.country}` : '';
  card.appendChild(createEl('h2', 'card-city', `${place.name}${country}`));

  const main = createEl('div', 'card-main');
  const icon = createEl('img', 'card-icon');
  icon.src = `${OWM_ICON_URL}${info.icon}@2x.png`;
  icon.alt = info.main;
  main.append(icon, createEl('span', 'card-temp', `${Math.round(weather.main.temp)}°C`));
  card.appendChild(main);
  card.appendChild(createEl('p', 'card-desc', info.description));

  const stats = createEl('dl', 'card-stats');
  [['Clouds', `${weather.clouds.all}%`],
   ['Humidity', `${weather.main.humidity}%`],
   ['Wind speed', `${weather.wind.speed} m/s`]].forEach(([label, value]) => {
    stats.append(createEl('dt', '', label), createEl('dd', '', value));
  });
  card.appendChild(stats);

  const actions = createEl('div', 'card-actions');
  const shareBtn = createEl('button', 'card-btn', 'Share');
  shareBtn.type = 'button';
  shareBtn.addEventListener('click', () => shareWeather(shareBtn, buildShareText(place, weather)));

  const favBtn = createEl('button', 'card-btn card-btn-alt', isFavorite(place) ? 'Saved ★' : 'Save ☆');
  favBtn.type = 'button';
  favBtn.addEventListener('click', () => {
    addFavorite(place);
    favBtn.textContent = 'Saved ★';
  });
  actions.append(shareBtn, favBtn);
  card.appendChild(actions);
  return card;
}


function showOnMap(place, weather) {
  if (marker) map.removeLayer(marker);           // clear previous marker
  map.flyTo([place.lat, place.lng], 11, { duration: 1.5 });
  marker = L.marker([place.lat, place.lng])
    .addTo(map)
    .bindPopup(buildCard(place, weather), { maxWidth: 300, autoPan: false })
    .openPopup();
}


function describeError(error) {
  if (error.status === 404) return 'Weather data was not found for this location. Please try another place.';
  if (error.status === 401) return 'The OpenWeatherMap API key is invalid or not yet active. Check js/config.js.';
  if (error.status === 429) return 'Too many requests. Please wait a minute and try again.';
  if (error instanceof TypeError) return 'Network error. Check your internet connection and try again.';
  return 'Something went wrong while loading the weather. Please try again.';
}

async function searchLocation(query, knownPlace = null) {
  if (busy) return;
  hideError();

  if (!hasApiKey()) {
    showError('Missing API key. Add your OpenWeatherMap key to js/config.js (see README).');
    return;
  }

  setLoading(true);
  try {
    const place = knownPlace || await geocode(query);
    if (!place) {
      showError(`Location "${query}" was not found. Check the spelling or try a nearby city.`);
      return;
    }
    const weather = await fetchWeather(place.lat, place.lng);
    showOnMap(place, weather);
  } catch (error) {
    console.error(error);
    showError(describeError(error));
  } finally {
    setLoading(false);
  }
}


function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function saveFavorites(list) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch (error) {
    showError('Could not save favorites in this browser.');
  }
}

function isFavorite(place) {
  return loadFavorites().some((fav) => fav.name === place.name && fav.lat === place.lat && fav.lng === place.lng);
}

function addFavorite(place) {
  if (isFavorite(place)) return;
  saveFavorites([...loadFavorites(), { name: place.name, lat: place.lat, lng: place.lng }]);
  renderFavorites();
}

function removeFavorite(index) {
  const list = loadFavorites();
  list.splice(index, 1);
  saveFavorites(list);
  renderFavorites();
}

function renderFavorites() {
  els.favorites.replaceChildren();
  loadFavorites().forEach((place, index) => {
    const chip = createEl('div', 'fav-chip');
    const go = createEl('button', 'fav-go', place.name);
    go.type = 'button';
    go.addEventListener('click', () => searchLocation(place.name, place));
    const remove = createEl('button', 'fav-remove', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${place.name} from favorites`);
    remove.addEventListener('click', () => removeFavorite(index));
    chip.append(go, remove);
    els.favorites.appendChild(chip);
  });
}


els.form.addEventListener('submit', (event) => {
  event.preventDefault();                          // no full-page redraw
  const query = els.input.value.trim();
  if (!query) {
    showError('Please type a location first, for example "Port Sudan".');
    els.input.focus();
    return;
  }
  searchLocation(query);
});

els.alertClose.addEventListener('click', hideError);

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  renderFavorites();
});
