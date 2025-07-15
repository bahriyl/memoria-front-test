// js/location.js

const API_URL            = 'https://memoria-test-app-ifisk.ondigitalocean.app';
const IMGBB_API_KEY      = '726ae764867cf6b3a259967071cbdd80';
const MODERATION_ENDPOINT = `${API_URL}/api/people/location_moderation`;

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const btnGeo            = document.getElementById('btn-geo');
  const fileInput         = document.getElementById('file-input');
  const imageGrid         = document.getElementById('image-grid');
  const landmarksEl       = document.getElementById('landmarks');
  const landmarksDisplay  = document.getElementById('landmarks-display');
  const btnEditLandmarks  = document.getElementById('btn-edit-landmarks');
  const btnAdd            = document.getElementById('btn-add-photo');
  const btnSelect         = document.getElementById('btn-select-photo');
  const btnSubmit         = document.getElementById('btn-submit');
  const geoCard           = document.querySelector('.geo-card');

  // State
  let currentLocation = { coords: null, landmarks: '', photos: [] };
  let initialHasData  = false;
  let changesMade     = false;
  let deleteMode      = false;
  const selected      = new Set();

  // Success Modal
  const overlayEl = document.getElementById('modal-overlay');
  const modalEl   = document.getElementById('success-modal');
  const closeBtn  = document.getElementById('modal-close');
  const okBtn     = document.getElementById('modal-ok');

  function showModal() {
    overlayEl.hidden = false;
    modalEl.hidden   = false;
  }
  function hideModal() {
    overlayEl.hidden = true;
    modalEl.hidden   = true;
  }
  closeBtn.addEventListener('click', hideModal);
  okBtn.addEventListener('click', () => {
    hideModal();
    window.location.reload();
  });

  // Submit visibility
  function updateSubmitButtonVisibility() {
    btnSubmit.style.display = (!initialHasData || changesMade) ? '' : 'none';
  }
  btnSubmit.style.display = 'none';

  // Load existing data
  const personId = new URL(window.location.href).searchParams.get('personId');
  if (!personId) {
    console.error('personId missing in query string');
    return;
  }

  fetch(`${API_URL}/api/people/${personId}`)
    .then(r => r.json())
    .then(data => {
      const loc = data.location || [];

      // Coordinates
      if (loc[0]) {
        currentLocation.coords = loc[0];
        geoCard.style.display   = 'none';
        const [lat, lng]        = loc[0].split(',').map(s => s.trim());
        renderMap(lat, lng);
      }

      // Landmarks
      if (loc[1]) {
        currentLocation.landmarks      = loc[1];
        landmarksDisplay.textContent   = loc[1];
        landmarksDisplay.style.display = '';
        btnEditLandmarks.style.display = '';
      } else {
        landmarksEl.style.display = '';
      }

      // Photos
      if (Array.isArray(loc[2])) {
        currentLocation.photos = loc[2].slice();
        refreshPlaceholders();
      }

      initialHasData = !!(
        currentLocation.coords ||
        currentLocation.landmarks.trim() ||
        currentLocation.photos.length
      );
    })
    .catch(e => console.error('Failed to load person:', e))
    .finally(updateSubmitButtonVisibility);

  // LANDMARKS: edit & input
  landmarksEl.addEventListener('input', () => {
    currentLocation.landmarks = landmarksEl.value;
    changesMade = true;
    updateSubmitButtonVisibility();
  });
  btnEditLandmarks.addEventListener('click', () => {
    landmarksEl.value               = currentLocation.landmarks;
    landmarksDisplay.style.display  = 'none';
    btnEditLandmarks.style.display  = 'none';
    landmarksEl.style.display       = '';
    landmarksEl.focus();
    changesMade = true;
    updateSubmitButtonVisibility();
  });

  // GEOLOCATION
  btnGeo.addEventListener('click', requestGeolocation);
  function requestGeolocation() {
    if (!navigator.geolocation) {
      alert('Ваш браузер не підтримує геолокацію.');
      return;
    }
    btnGeo.disabled = true;
    navigator.geolocation.getCurrentPosition(pos => {
      const coordsStr = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
      currentLocation.coords = coordsStr;
      changesMade = true;
      updateSubmitButtonVisibility();
      geoCard.style.display = 'none';
      renderMap(pos.coords.latitude, pos.coords.longitude);
      btnGeo.disabled = false;
    }, err => {
      alert('Не вдалося визначити локацію: ' + err.message);
      btnGeo.disabled = false;
    });
  }

  // MAP RENDERER
  let mapWrap, changeBtn;
  function renderMap(lat, lng) {
    if (changeBtn) changeBtn.remove();
    if (mapWrap)  mapWrap.remove();

    changeBtn = document.createElement('button');
    changeBtn.type = 'button';
    changeBtn.textContent = 'Змінити';
    changeBtn.className   = 'btn btn-secondary change-btn';
    changeBtn.addEventListener('click', requestGeolocation);

    mapWrap = document.createElement('div');
    mapWrap.className = 'map-container';

    const mapDiv = document.createElement('div');
    mapDiv.id = 'map';
    mapDiv.style = 'height:290px;width:100%;border-radius:8px;';

    mapWrap.append(mapDiv);
    geoCard.after(changeBtn, mapWrap);

    mapboxgl.accessToken = 'pk.eyJ1IjoiYmFncml1bDEw...';
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v12',
      zoom: 14
    });
    map.on('load', () => {
      map.jumpTo({ center: [parseFloat(lng), parseFloat(lat)] });
      new mapboxgl.Marker().setLngLat([parseFloat(lng), parseFloat(lat)]).addTo(map);
    });
  }

  // PHOTO UPLOAD & PREVIEW
  btnAdd.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const files = Array.from(e.target.files);
    const previewUrls = files.map(f => URL.createObjectURL(f));

    // immediate previews
    previewUrls.forEach(url => currentLocation.photos.push(url));
    refreshPlaceholders();
    changesMade = true;
    updateSubmitButtonVisibility();
    fileInput.value = '';

    // upload & replace
    files.forEach(async (file, idx) => {
      const previewUrl = previewUrls[idx];
      try {
        const form = new FormData();
        form.append('image', file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: form
        });
        const json = await res.json();
        const realUrl = json.data.url;
        const i = currentLocation.photos.indexOf(previewUrl);
        if (i > -1) {
          currentLocation.photos[i] = realUrl;
          URL.revokeObjectURL(previewUrl);
          refreshPlaceholders();
        }
      } catch {
        alert('Не вдалося завантажити зображення.');
      }
    });
  });

  // DELETE SELECTION
  btnSelect.addEventListener('click', () => {
    deleteMode = !deleteMode;
    selected.clear();
    btnSelect.textContent = deleteMode ? 'Видалити обрані' : 'Вибрати';
  });

  // RENDER PHOTO GRID
  function refreshPlaceholders() {
    imageGrid.innerHTML = '';
    currentLocation.photos.forEach((url, idx) => {
      const ph = document.createElement('div');
      ph.className = 'image-placeholder filled';
      ph.style.background = `url(${url}) center/cover no-repeat`;
      if (deleteMode && selected.has(idx)) ph.classList.add('selected');
      ph.addEventListener('click', () => {
        if (!deleteMode) return;
        if (selected.has(idx)) selected.delete(idx);
        else selected.add(idx);
        ph.classList.toggle('selected');
      });
      imageGrid.append(ph);
    });
  }

  // FINAL SUBMIT
  btnSubmit.addEventListener('click', async () => {
    const payload = {
      personId,
      location: [
        currentLocation.coords,
        currentLocation.landmarks,
        currentLocation.photos
      ]
    };
    try {
      const res = await fetch(MODERATION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(res.statusText);
      showModal();
    } catch {
      alert('Не вдалося відправити дані на модерацію.');
    }
  });
});
