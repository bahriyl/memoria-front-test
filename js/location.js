const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app';
const IMGBB_API_KEY = '726ae764867cf6b3a259967071cbdd80';

document.addEventListener('DOMContentLoaded', () => {
    const btnGeo = document.getElementById("btn-geo");
    const fileInput = document.getElementById("file-input");
    const placeholders = Array.from(document.querySelectorAll(".image-placeholder"));
    const landmarksEl = document.getElementById("landmarks");
    const btnAdd = document.getElementById("btn-add-photo");
    const btnSelect = document.getElementById("btn-select-photo");
    const btnSubmit = document.getElementById("btn-submit");
    const geoCard = document.querySelector(".geo-card");

    // State
    let currentLocation = { coords: null, landmarks: "", photos: [] };
    let hadCoordsOnLoad = false;
    let mapWrap, changeBtn;
    let deleteMode = false;
    const selected = new Set();

    // Helper to read ?personId=…
    function getParam(name) {
        return new URL(window.location.href).searchParams.get(name);
    }
    const personId = getParam('personId');
    if (!personId) {
        console.error('personId missing in query string');
        return;
    }

    // 1) Load existing data
    fetch(`${API_URL}/api/people/${personId}`)
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(data => {
            const loc = data.location || [];

            // coords → map
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
                landmarksEl.value = loc[1];
            }

            // photos
            if (Array.isArray(loc[2])) {
                currentLocation.photos = loc[2].slice();
                refreshPlaceholders();
            }
        })
        .catch(e => console.error('Failed to load person:', e));

    // 2) Render “Змінити” + map
    function renderMap(lat, lng) {
        if (changeBtn) changeBtn.remove();
        if (mapWrap) mapWrap.remove();

        // “Змінити”
        changeBtn = document.createElement('button');
        changeBtn.type = 'button';
        changeBtn.textContent = 'Змінити';
        changeBtn.className = 'btn btn-secondary change-btn';
        changeBtn.addEventListener('click', requestGeolocation);

        // map
        mapWrap = document.createElement('div');
        mapWrap.className = 'map-container';
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.google.com/maps?q=${lat},${lng}&hl=uk&z=17&output=embed`;
        iframe.loading = 'lazy';
        mapWrap.appendChild(iframe);

        geoCard.parentNode.insertBefore(changeBtn, geoCard.nextSibling);
        geoCard.parentNode.insertBefore(mapWrap, changeBtn.nextSibling);
    }

    // 3) Geolocation + PUT
    btnGeo.addEventListener('click', requestGeolocation);
    function requestGeolocation() {
        if (!navigator.geolocation) {
            alert("Геолокація не підтримується вашим браузером.");
            return;
        }
        btnGeo.disabled = true;
        if (changeBtn) changeBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            async pos => {
                const { latitude, longitude } = pos.coords;
                const coordsStr = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                currentLocation.coords = coordsStr;
                geoCard.style.display = 'none';
                renderMap(latitude, longitude);

                if (!hadCoordsOnLoad) {
                    try {
                        await fetch(`${API_URL}/api/people/${personId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                location: [
                                    currentLocation.coords,
                                    currentLocation.landmarks,
                                    currentLocation.photos
                                ]
                            })
                        });
                        hadCoordsOnLoad = true;
                    } catch (e) {
                        console.error('Save coords failed', e);
                        alert('Не вдалося зберегти координати.');
                    }
                }
                btnGeo.disabled = false;
                if (changeBtn) changeBtn.disabled = false;
            },
            err => {
                alert("Не вдалося визначити локацію: " + err.message);
                btnGeo.disabled = false;
                if (changeBtn) changeBtn.disabled = false;
            }
        );
    }

    // 4) Photo upload (Imgbb) + server update
    btnAdd.onclick = () => fileInput.click();
    fileInput.addEventListener('change', async e => {
        const files = Array.from(e.target.files).slice(0, placeholders.length);
        const uploaded = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const form = new FormData();
                form.append('image', file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                    method: 'POST',
                    body: form
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error.message);

                currentLocation.photos.push(json.data.url);
                uploaded.push(json.data.url);
            } catch (err) {
                console.error('Upload failed', err);
                alert('Не вдалося завантажити зображення.');
            }
        }
        if (uploaded.length) {
            await updateLocationOnServer();
            refreshPlaceholders();
        }
    });

    // 5) Delete-selection flow
    btnSelect.addEventListener('click', () => {
        if (!deleteMode) {
            // enter selection mode
            deleteMode = true;
            selected.clear();
            btnSelect.textContent = 'Видалити обрані';
        } else {
            // perform deletion of selected indices
            // remove URLs
            const newPhotos = currentLocation.photos.filter((_, idx) => !selected.has(idx));
            currentLocation.photos = newPhotos.slice();
            // exit delete mode
            deleteMode = false;
            btnSelect.textContent = 'Вибрати';
            selected.clear();
            // update server & UI
            updateLocationOnServer().then(refreshPlaceholders);
        }
    });

    // Click on placeholders toggles selection only in deleteMode
    placeholders.forEach((ph, idx) => {
        ph.addEventListener('click', () => {
            if (!deleteMode) return;
            if (!ph.classList.contains('filled')) return;
            if (selected.has(idx)) {
                ph.classList.remove('selected');
                selected.delete(idx);
            } else {
                ph.classList.add('selected');
                selected.add(idx);
            }
        });
    });

    // Helper: PUT updated location to server
    async function updateLocationOnServer() {
        try {
            const r = await fetch(`${API_URL}/api/people/${personId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: [
                        currentLocation.coords,
                        currentLocation.landmarks,
                        currentLocation.photos
                    ]
                })
            });
            if (!r.ok) throw new Error(r.statusText);
        } catch (e) {
            console.error('Save photos failed', e);
            alert('Не вдалося зберегти зміни.');
        }
    }

    // Redraw placeholders from currentLocation.photos
    function refreshPlaceholders() {
        // clear all
        placeholders.forEach(ph => {
            ph.style.background = '';
            ph.classList.remove('filled', 'selected');
            ph.style.display = '';
        });
        // render photos
        currentLocation.photos.forEach((url, i) => {
            const ph = placeholders[i];
            ph.style.background = `url(${url}) center/cover no-repeat`;
            ph.classList.add('filled');
        });
        // hide extras
        for (let i = currentLocation.photos.length; i < placeholders.length; i++) {
            placeholders[i].style.display = 'none';
        }
    }

    // 6) Submit (unchanged)
    btnSubmit.addEventListener('click', () => {
        console.log({
            personId,
            coords: currentLocation.coords,
            landmarks: currentLocation.landmarks,
            photos: currentLocation.photos
        });
        alert("Дані зібрані в консоль. Готові до відправки на сервер.");
    });
});
