const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app'

document.addEventListener('DOMContentLoaded', () => {
    const btnGeo = document.getElementById("btn-geo");
    const coordsTxt = document.getElementById("coords");
    const fileInput = document.getElementById("file-input");
    const placeholders = document.querySelectorAll(".image-placeholder");
    const landmarksEl = document.getElementById("landmarks");
    const btnAdd = document.getElementById("btn-add-photo");
    const btnSelect = document.getElementById("btn-select-photo");
    const btnSubmit = document.getElementById("btn-submit");
    const geoCard = document.querySelector(".geo-card");

    // helper: read ?personId=…
    function getParam(name) {
        return new URL(window.location.href)
            .searchParams.get(name);
    }
    const personId = getParam('personId');
    if (!personId) {
        console.error('personId missing in query string');
        return;
    }

    // Fetch person record
    let hadCoordsOnLoad = false;
    fetch(`${API_URL}/api/people/${personId}`)
        .then(res => {
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
        })
        .then(data => {
            const loc = data.location || [];
            // if we already have coords saved:
            if (loc[0]) {
                hadCoordsOnLoad = true;
                // hide the geo-card & show map as before…
                geoCard.style.display = 'none';
                const [lat, lng] = loc[0].split(',').map(s => s.trim());
                insertMap(lat, lng);
            }
            // populate landmarks & photos as before
            if (loc[1]) landmarksEl.value = loc[1];
            if (Array.isArray(loc[2])) {
                loc[2].forEach((url, i) => {
                    if (i >= placeholders.length) return;
                    placeholders[i].style.background =
                        `url(${url}) center/cover no-repeat`;
                    placeholders[i].textContent = '';
                });
            }
        })
        .catch(err => console.error('Failed to load person:', err));

    // helper to insert the map iframe
    function insertMap(lat, lng) {
        geoCard.style.display = 'none';

        const mapWrap = document.createElement('div');
        mapWrap.className = 'map-container';
        const iframe = document.createElement('iframe');
        iframe.src =
            `https://www.google.com/maps?q=${lat},${lng}&hl=uk&z=17&output=embed`;
        iframe.loading = 'lazy';
        mapWrap.appendChild(iframe);
        geoCard.parentNode.insertBefore(mapWrap, geoCard.nextSibling);
    }

    // —————————————————————————
    // When user clicks “Дозволити”
    btnGeo.addEventListener("click", () => {
        if (!navigator.geolocation) {
            alert("Геолокація не підтримується вашим браузером.");
            return;
        }
        btnGeo.disabled = true;
        btnGeo.textContent = "Отримання…";

        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                const coordsStr = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                insertMap(latitude, longitude);

                // Only send a PUT if there were NO coords on load
                if (!hadCoordsOnLoad) {
                    // Gather the current landmarks & photos
                    const landmarks = landmarksEl.value.trim();
                    const photos = Array.from(placeholders)
                        .map(el => {
                            const bg = el.style.backgroundImage;
                            const m = bg.match(/url\(["']?(.*?)["']?\)/);
                            return m ? m[1] : null;
                        })
                        .filter(u => u);

                    // Build the new location array
                    const newLocation = [coordsStr, landmarks, photos];

                    // Send the PUT
                    fetch(`${API_URL}/api/people/${personId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ location: newLocation })
                    })
                        .then(r => {
                            if (!r.ok) throw new Error(r.statusText);
                            return r.json();
                        })
                        .then(updated => {
                            console.log('Location updated on server:', updated.location);
                        })
                        .catch(e => {
                            console.error('Failed to update location:', e);
                            alert('Не вдалося зберегти координати на сервері.');
                        });
                }
            },
            err => {
                alert("Не вдалося визначити локацію: " + err.message);
                btnGeo.disabled = false;
                btnGeo.textContent = "Дозволити";
            }
        );
    });

    btnAdd.onclick = () => fileInput.click();
    btnSelect.onclick = () => fileInput.click();

    fileInput.addEventListener("change", e => {
        const files = Array.from(e.target.files).slice(0, placeholders.length);
        files.forEach((file, i) => {
            const reader = new FileReader();
            reader.onload = () => {
                placeholders[i].style.background =
                    `url(${reader.result}) center/cover no-repeat`;
                placeholders[i].textContent = "";
            };
            reader.readAsDataURL(file);
        });
    });

    btnSubmit.addEventListener("click", () => {
        const coords = coordsTxt.textContent;
        const landmarks = landmarksEl.value.trim();
        const images = Array.from(placeholders)
            .map(el => el.style.backgroundImage)
            .filter(bg => bg && bg !== "none");

        console.log({ personId, coords, landmarks, images });
        alert("Дані зібрані в консоль. Готові до відправки на сервер.");
        // TODO: fetch('/api/people/'+personId+'/location', { method:'POST', body:… })
    });
});
