const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app';
const IMGBB_API_KEY = '726ae764867cf6b3a259967071cbdd80';
// moderation endpoint only
const MODERATION_ENDPOINT = `${API_URL}/api/people/location_moderation`;

document.addEventListener('DOMContentLoaded', () => {
    const btnGeo = document.getElementById("btn-geo");
    const fileInput = document.getElementById("file-input");
    const imageGrid = document.getElementById("image-grid");
    const landmarksEl = document.getElementById("landmarks");
    const landmarksDisplay = document.getElementById("landmarks-display");
    const btnEditLandmarks = document.getElementById("btn-edit-landmarks");
    const btnAdd = document.getElementById("btn-add-photo");
    const btnSelect = document.getElementById("btn-select-photo");
    const btnSubmit = document.getElementById("btn-submit");
    const geoCard = document.querySelector(".geo-card");

    let currentLocation = { coords: null, landmarks: "", photos: [] };
    let hadCoordsOnLoad = false;
    let deleteMode = false;
    const selected = new Set();

    // ---- Success Modal Elements ----
    const overlayEl = document.getElementById('modal-overlay');
    const modalEl = document.getElementById('success-modal');
    const closeBtn = document.getElementById('modal-close');
    const okBtn = document.getElementById('modal-ok');

    function showModal() {
        overlayEl.hidden = false;
        modalEl.hidden = false;
    }
    function hideModal() {
        overlayEl.hidden = true;
        modalEl.hidden = true;
    }
    closeBtn.addEventListener('click', hideModal);
    okBtn.addEventListener('click', () => {
        hideModal();
        // Optionally, reload or navigate after OK
        window.location.reload();
    });

    // track initial vs. modified state
    let initialHasData = false;
    let changesMade = false;

    // helper to show/hide submit
    function updateSubmitButtonVisibility() {
        // if no data initially OR user has made any change → show
        if (!initialHasData || changesMade) {
            btnSubmit.style.display = '';
        } else {
            btnSubmit.style.display = 'none';
        }
    }

    // hide submit until we know initial state
    btnSubmit.style.display = 'none';

    // get personId
    function getParam(name) {
        return new URL(window.location.href).searchParams.get(name);
    }
    const personId = getParam('personId');
    if (!personId) {
        console.error('personId missing in query string');
        return;
    }

    // 1) Load existing data (to pre-fill UI & set initialHasData)
    fetch(`${API_URL}/api/people/${personId}`)
        .then(r => r.json())
        .then(data => {
            const loc = data.location || [];

            // coords
            if (loc[0]) {
                hadCoordsOnLoad = true;
                currentLocation.coords = loc[0];
                geoCard.style.display = 'none';
                const [lat, lng] = loc[0].split(',').map(s => s.trim());
                renderMap(lat, lng);
            }

            // landmarks
            if (loc[1]) {
                currentLocation.landmarks = loc[1];
                landmarksDisplay.textContent = loc[1];
                landmarksDisplay.style.display = '';
                btnEditLandmarks.style.display = '';
            } else {
                // no landmarks: show textarea directly
                landmarksEl.style.display = '';
            }

            // photos
            if (Array.isArray(loc[2])) {
                currentLocation.photos = loc[2].slice();
                refreshPlaceholders();
            }

            // did we load *any* data?
            initialHasData = !!(
                currentLocation.coords ||
                currentLocation.landmarks.trim() ||
                currentLocation.photos.length
            );
        })
        .catch(e => {
            console.error('Failed to load person:', e);
            // treat as “no data” (initialHasData stays false)
        })
        .finally(() => {
            updateSubmitButtonVisibility();
        });

    // LANDMARKS: track edits
    landmarksEl.addEventListener('input', () => {
        currentLocation.landmarks = landmarksEl.value;
        changesMade = true;
        updateSubmitButtonVisibility();
    });

    // LANDMARKS: edit button
    btnEditLandmarks.addEventListener('click', () => {
        landmarksEl.value = currentLocation.landmarks;
        landmarksDisplay.style.display = 'none';
        btnEditLandmarks.style.display = 'none';
        landmarksEl.style.display = '';
        landmarksEl.focus();
        changesMade = true;
        updateSubmitButtonVisibility();
    });

    // MAP RENDERER (unchanged)
    let mapWrap, changeBtn;
    function renderMap(lat, lng) {
        if (changeBtn) changeBtn.remove();
        if (mapWrap) mapWrap.remove();

        changeBtn = document.createElement('button');
        changeBtn.type = 'button';
        changeBtn.textContent = 'Змінити';
        changeBtn.className = 'btn btn-secondary change-btn';
        changeBtn.addEventListener('click', requestGeolocation);

        mapWrap = document.createElement('div');
        mapWrap.className = 'map-container';
        mapWrap.style.position = 'relative';

        const mapDiv = document.createElement('div');
        mapDiv.id = 'map';
        mapDiv.style = 'height: 290px; width: 100%; border-radius: 8px;';

        const routeBtn = document.createElement('button');
        routeBtn.textContent = 'Прокласти маршрут';
        routeBtn.className = 'floating-route-btn';

        mapWrap.append(mapDiv, routeBtn);
        geoCard.parentNode.insertBefore(changeBtn, geoCard.nextSibling);
        geoCard.parentNode.insertBefore(mapWrap, changeBtn.nextSibling);

        mapboxgl.accessToken = 'pk.eyJ1IjoiYmFncml1bDEwIiwiYSI6ImNtY3pkM3lhMzB3M2MyanNidWRqZXlpN20ifQ.dgeloPQYgbOmrwVv8pYPww';
        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            zoom: 14,
            attributionControl: false
        });

        map.on('load', () => {
            map.jumpTo({
                center: [parseFloat(lng), parseFloat(lat)],
                offset: [-100, -100]
            });
            new mapboxgl.Marker({ color: '#d00' })
                .setLngLat([parseFloat(lng), parseFloat(lat)])
                .addTo(map);
        });

        routeBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert('Ваш браузер не підтримує геолокацію.');
                return;
            }
            navigator.geolocation.getCurrentPosition(pos => {
                const origin = [pos.coords.longitude, pos.coords.latitude];
                const destination = [parseFloat(lng), parseFloat(lat)];
                fetch(
                    `https://api.mapbox.com/directions/v5/mapbox/driving/`
                    + `${origin.join(',')};${destination.join(',')}?geometries=geojson`
                    + `&access_token=${mapboxgl.accessToken}`
                )
                    .then(r => r.json())
                    .then(data => {
                        const route = data.routes[0].geometry;
                        map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: route } });
                        map.addLayer({
                            id: 'route',
                            type: 'line',
                            source: 'route',
                            layout: { 'line-join': 'round', 'line-cap': 'round' },
                            paint: { 'line-color': '#12794f', 'line-width': 6 }
                        });
                        const bounds = new mapboxgl.LngLatBounds();
                        route.coordinates.forEach(c => bounds.extend(c));
                        map.fitBounds(bounds, { padding: 40 });
                        routeBtn.style.display = 'none';
                    });
            }, err => {
                alert("Не вдалося визначити ваше місцезнаходження: " + err.message);
            });
        });
    }

    // GEOLOCATION: track as change
    btnGeo.addEventListener('click', requestGeolocation);
    function requestGeolocation() {
        if (!navigator.geolocation) {
            alert("Геолокація не підтримується вашим браузером.");
            return;
        }
        btnGeo.disabled = true;
        if (changeBtn) changeBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(pos => {
            const coordsStr = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
            currentLocation.coords = coordsStr;
            changesMade = true;
            updateSubmitButtonVisibility();

            geoCard.style.display = 'none';
            renderMap(pos.coords.latitude, pos.coords.longitude);

            btnGeo.disabled = false;
            if (changeBtn) changeBtn.disabled = false;
        }, err => {
            alert("Не вдалося визначити локацію: " + err.message);
            btnGeo.disabled = false;
            if (changeBtn) changeBtn.disabled = false;
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
        if (!deleteMode) {
            // Enter delete mode
            deleteMode = true;
            selected.clear();
            btnSelect.textContent = 'Видалити обрані';
        } else {
            // Exiting delete mode → actually remove the selected photos
            currentLocation.photos = currentLocation.photos.filter((_, idx) => !selected.has(idx));
            deleteMode = false;
            selected.clear();
            btnSelect.textContent = 'Вибрати';
            refreshPlaceholders();
            changesMade = true;
            updateSubmitButtonVisibility();
        }
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

    // FINAL SUBMIT → moderation
    btnSubmit.addEventListener('click', async () => {
        const payload = {
            personId: personId,
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
            // Show success modal instead of alert
            showModal();
        } catch (e) {
            console.error('Moderation submit failed', e);
            alert('Не вдалося відправити дані на модерацію.');
        }
    });
});