const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app';
const IMGBB_API_KEY = '726ae764867cf6b3a259967071cbdd80';

document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM =====
    const btnGeo = document.getElementById('btn-geo');
    const fileInput = document.getElementById('file-input');
    const imageGrid = document.getElementById('image-grid');
    const landmarksEl = document.getElementById('landmarks');
    const landmarksDisplay = document.getElementById('landmarks-display');
    const btnEditLandmarks = document.getElementById('btn-edit-landmarks');
    const btnAdd = document.getElementById('btn-add-photo');
    const btnSelect = document.getElementById('btn-select-photo');
    const btnSubmit = document.getElementById('btn-submit');
    const geoCard = document.querySelector('.geo-card');
    const btnRow = document.getElementById('photo-btn-row');
    const errorBox = document.getElementById('form-error');

    // Success modal
    const overlayEl = document.getElementById('modal-overlay');
    const modalEl = document.getElementById('success-modal');
    const closeBtn = document.getElementById('modal-close');
    const okBtn = document.getElementById('modal-ok');

    // Confirm modal (change location)
    const confirmModal = document.getElementById('confirm-modal');
    const confirmOk = document.getElementById('confirm-ok');
    const confirmCancel = document.getElementById('confirm-cancel');
    const confirmClose = document.getElementById('confirm-close');

    // Photo section dots menu (may be absent)
    const photoMenuBtn = document.getElementById('photo-menu-btn');
    const photoMenu = document.getElementById('photo-menu');

    // New dots menus for Location & Landmarks (may be absent if HTML not updated)
    const locChangeBtn = document.getElementById('loc-change');
    const landmarksChangeBtn = document.getElementById('landmarks-change');

    const landmarksControls = document.getElementById('landmarks-controls');
    const landmarksCancel = document.getElementById('landmarks-cancel');
    const landmarksDone = document.getElementById('landmarks-done');

    const locMenuBtn = document.getElementById('loc-menu-btn');
    const locMenu = document.getElementById('loc-menu');
    const landmarksMenuBtn = document.getElementById('landmarks-menu-btn');
    const landmarksMenu = document.getElementById('landmarks-menu');

    // ===== STATE (declare early to avoid TDZ) =====
    let currentLocation = { coords: null, landmarks: '', photos: [] };
    let hadCoordsOnLoad = false;
    let initialHasData = false;
    let changesMade = false;

    // Photo selection mode
    let isSelecting = false;
    let selectedOrder = [];

    // Map elements (outer scope)
    let mapWrap = null;
    let mapChangeBtn = null; // "Змінити" above the map (hidden, we use dots menu)

    let pendingUploads = 0; // скільки фото ще вантажаться

    let openMenu = null;
    let openMenuAnchor = null;

    let isEditingLandmarks = false;
    let prevLandmarksText = '';
    let initialLocationSnapshot = { coords: '', landmarks: '', photos: [] };

    // ===== UTIL =====
    function closeAllMenus() {
        document.querySelectorAll('.popup-menu').forEach(m => m.classList.add('hidden'));
        openMenu = null;
        openMenuAnchor = null;
    }

    const getParam = (name) =>
        new URL(window.location.href).searchParams.get(name);

    const personId = getParam('personId');
    const UPDATE_ENDPOINT = `${API_URL}/api/people/${personId}`;

    const tokenKey = `people_token_${personId}`;
    const token = localStorage.getItem(tokenKey);
    let premiumLocked = false;

    if (!personId) {
        console.error('personId missing in query string');
        return;
    }

    const clonePhotos = (arr) => Array.isArray(arr) ? arr.slice() : [];

    const normalizeLandmarks = (value) => (value || '').trim();

    const photosEqual = (a = [], b = []) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    };

    const captureInitialSnapshot = () => {
        initialLocationSnapshot = {
            coords: currentLocation.coords || '',
            landmarks: normalizeLandmarks(currentLocation.landmarks),
            photos: clonePhotos(currentLocation.photos),
        };
        if (initialHasData) {
            changesMade = false;
        }
    };

    const computeChangesMade = () => {
        if (!initialHasData) return;
        const sameCoords = (initialLocationSnapshot.coords || '') === (currentLocation.coords || '');
        const sameLandmarks = initialLocationSnapshot.landmarks === normalizeLandmarks(currentLocation.landmarks);
        const samePhotos = photosEqual(initialLocationSnapshot.photos, currentLocation.photos);
        changesMade = !(sameCoords && sameLandmarks && samePhotos);
    };

    const markChanged = () => {
        if (!initialHasData) {
            changesMade = true;
            return;
        }
        computeChangesMade();
        if (!changesMade) {
            // if nothing actually changed (same values), keep current flag
            changesMade = false;
        }
    };

    const nonBlobPhotos = () =>
        (currentLocation.photos || []).filter(
            (u) => typeof u === 'string' && u && !u.startsWith('blob:')
        );

    function isComplete() {
        return Boolean(
            currentLocation.coords &&
            (currentLocation.landmarks || '').trim() &&
            nonBlobPhotos().length > 0
        );
    }

    function missingFields() {
        const miss = [];
        if (!currentLocation.coords) miss.push('геолокація');
        if (!(currentLocation.landmarks || '').trim()) miss.push('орієнтири');
        if (nonBlobPhotos().length === 0) miss.push('фото');
        return miss;
    }

    function showErrors(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.style.display = '';
        const container = document.querySelector('.container');
        if (container) container.style.paddingBottom = '80px';
    }

    function hideErrors() {
        if (!errorBox) return;
        errorBox.textContent = '';
        errorBox.style.display = 'none';
        const container = document.querySelector('.container');
        if (container) {
            const submitVisible = btnSubmit && getComputedStyle(btnSubmit).display !== 'none';
            container.style.paddingBottom = submitVisible ? '80px' : '25px';
        }
    }

    function updateLandmarksMargin() {
        const menuBtn = document.getElementById('landmarks-menu-btn');
        const textEl = document.querySelector('.landmarks-text');
        const titleEl = document.querySelector('.section-landmarks h2');

        if (menuBtn && textEl) {
            const isHidden = menuBtn.style.display === 'none' ||
                getComputedStyle(menuBtn).display === 'none';
            textEl.classList.toggle('without-menu', isHidden);
        }

        if (titleEl) {
            const textSource = textEl ? textEl.textContent : '';
            const hasLandmarksText = Boolean((currentLocation.landmarks || '').trim())
                || Boolean((textSource || '').trim());
            titleEl.style.setProperty('margin-bottom', hasLandmarksText ? '0' : '', 'important');
        }

        // Add margin-top if location already exists
        const titlebarEl = document.querySelector('.section-landmarks .section-titlebar');
        if (titlebarEl) {
            const hasLocation = Boolean(currentLocation.coords);
            titlebarEl.style.marginTop = hasLocation ? '20px' : '';
        }
    }

    function updatePhotosHeaderSpacing() {
        const titlebar = document.querySelector('.section-photos .section-titlebar');
        if (!titlebar) return;
        const hasCoords = Boolean(currentLocation.coords);
        titlebar.style.marginTop = hasCoords ? '' : '24px';
    }

    updatePhotosHeaderSpacing();

    function showModal() {
        if (!overlayEl || !modalEl) return;
        overlayEl.hidden = false;
        modalEl.hidden = false;
    }
    function hideModal() {
        if (!overlayEl || !modalEl) return;
        overlayEl.hidden = true;
        modalEl.hidden = true;
    }

    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (okBtn)
        okBtn.addEventListener('click', () => {
            hideModal();
            window.location.href = `/profile.html?personId=${personId}`;
        });

    function showConfirm() {
        if (!overlayEl || !confirmModal) return;
        overlayEl.hidden = false;
        confirmModal.hidden = false;
    }
    function hideConfirm() {
        if (!overlayEl || !confirmModal) return;
        confirmModal.hidden = true;
        overlayEl.hidden = true;
    }
    if (confirmCancel) confirmCancel.addEventListener('click', hideConfirm);
    if (confirmClose) confirmClose.addEventListener('click', hideConfirm);
    if (confirmOk)
        confirmOk.addEventListener('click', () => {
            hideConfirm();
            requestGeolocation();
        });

    // Set submit label depending on whether there was data initially
    function setSubmitLabel() {
        if (!btnSubmit) return;
        btnSubmit.textContent = initialHasData ? 'Зберегти зміни' : 'Додати локацію';
    }

    function applyPremiumLock() {
        if (!premiumLocked) return;
        console.log('premium lock');

        // Always hide submit UI
        if (btnSubmit) btnSubmit.style.display = 'none';
        const container = document.querySelector('.container');
        if (container) container.style.paddingBottom = '16px';

        // If there is already any location data → hide only dots buttons (view-only)
        const hasAny =
            !!(currentLocation.coords ||
                (currentLocation.landmarks || '').trim() ||
                (currentLocation.photos || []).length);

        if (hasAny) {
            locMenuBtn && (locMenuBtn.style.display = 'none'); locMenu?.classList.add('hidden');
            landmarksMenuBtn && (landmarksMenuBtn.style.display = 'none'); landmarksMenu?.classList.add('hidden');
            photoMenuBtn && (photoMenuBtn.style.display = 'none'); photoMenu?.classList.add('hidden');
            updateLandmarksMargin();
        }

        // close any open menus
        closeAllMenus?.();
    }

    function renderGeoPlaceholder() {
        if (!geoCard) return;
        geoCard.innerHTML = `
          <p>Стоячи перед місцем поховання, надайте дозвіл до геолокації, щоб закріпити координати</p>
          <div style="display:flex; justify-content:center; margin-top: 14px;">
            <button id="btn-geo" class="btn btn-primary">Дозволити</button>
          </div>
        `;
        // підв'язуємо ту ж дію, що і "Змінити":
        const allowBtn = document.getElementById('btn-geo');
        allowBtn?.addEventListener('click', requestGeolocation);

        updatePhotosHeaderSpacing();
    }

    // Send current state to API (used in "existing location" mode)
    async function pushUpdate() {
        const payload = {
            location: [
                currentLocation.coords || '',
                (currentLocation.landmarks || '').trim(),
                nonBlobPhotos(),
            ],
        };
        try {
            const res = await fetch(UPDATE_ENDPOINT, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            hideErrors?.();
            captureInitialSnapshot();
            computeChangesMade();
            maybeUpdateSubmit();
        } catch (e) {
            console.error('Update failed', e);
            showErrors?.('Не вдалося оновити локацію. Спробуйте ще раз.');
        }
    }

    function updateSubmitButtonVisibility() {
        if (premiumLocked) {
            if (btnSubmit) btnSubmit.style.display = 'none';
            const container = document.querySelector('.container');
            if (container) container.style.paddingBottom = '16px';
            return;
        }

        if (!btnSubmit) return;
        const container = document.querySelector('.container');

        const hasCoords = Boolean(currentLocation.coords);
        // беримо «живе» значення з textarea, навіть якщо ще не натиснули "Готово"
        const liveLandmarks = ((currentLocation.landmarks || '').trim()) ||
            ((landmarksEl && landmarksEl.style.display !== 'none') ? (landmarksEl.value || '').trim() : '');
        const hasLandmarks = Boolean(liveLandmarks);
        const hasAnyPhoto = currentLocation.photos.length > 0;

        // показуємо Submit, коли дані заповнюються вперше або є зміни
        const showBtn = hasCoords && hasLandmarks && hasAnyPhoto && (!initialHasData || changesMade);
        btnSubmit.style.display = showBtn ? '' : 'none';

        if (container) container.style.paddingBottom = showBtn ? '80px' : '25px';

        // можна тиснути лише коли фото вже завантажені (без blob:) і все заповнено
        const canReallySubmit = hasCoords && hasLandmarks && nonBlobPhotos().length > 0 && pendingUploads === 0;
        btnSubmit.disabled = !canReallySubmit;

        if (showBtn) {
            if (pendingUploads > 0) {
                showErrors('Фото ще завантажуються. Будь ласка, дочекайтесь завершення.');
                return;
            }
            if (!(hasCoords && hasLandmarks && nonBlobPhotos().length > 0)) {
                const miss = [];
                if (!hasCoords) miss.push('геолокація');
                if (!hasLandmarks) miss.push('орієнтири');
                if (nonBlobPhotos().length === 0) miss.push('фото');
                showErrors(`Заповніть усі поля: ${miss.join(', ')}.`);
                return;
            }
        }
        if (showBtn && canReallySubmit) hideErrors();
    }

    function maybeUpdateSubmit() {
        if (!initialHasData) updateSubmitButtonVisibility();
        else if (btnSubmit) btnSubmit.style.display = 'none';
    }

    function positionMenuFor(btn, menu) {
        if (!btn || !menu) return;
        // ensure the menu is measurable
        const wasHidden = menu.classList.contains('hidden');
        if (wasHidden) {
            menu.style.visibility = 'hidden';
            menu.classList.remove('hidden');
            menu.style.left = '0px';
            menu.style.right = 'auto';
            void menu.offsetWidth; // reflow
        }

        const r = btn.getBoundingClientRect();
        const menuWidth = Math.max(menu.offsetWidth, 160);
        const vw = window.innerWidth;
        const left = Math.min(vw - 12 - menuWidth, r.right - menuWidth);
        const top = r.bottom + 8;

        menu.style.left = `${Math.max(12, left)}px`;
        menu.style.top = `${top}px`;
        menu.style.right = 'auto';
        menu.style.visibility = 'visible';
    }

    // Hide inline "Змінити" for landmarks, we use dots menu now
    if (btnEditLandmarks) btnEditLandmarks.style.display = 'none';

    // ===== Generic popup behaviour (safe even if some menus are missing) =====
    document.addEventListener('click', (e) => {
        const option = e.target.closest('.popup-option');
        if (option) {
            option.closest('.popup-menu')?.classList.add('hidden');
            return;
        }
        if (e.target.closest('.dots-btn')) {
            const btn = e.target.closest('.dots-btn');
            const menu = btn.nextElementSibling; // <div class="popup-menu">
            if (!menu) return;

            const isOpen = !menu.classList.contains('hidden');

            // закриваємо всі інші
            document.querySelectorAll('.popup-menu').forEach(m => m.classList.add('hidden'));

            if (isOpen) {
                // було відкрите → тепер закриваємо
                openMenu = null;
                openMenuAnchor = null;
            } else {
                // було закрите → тепер відкриваємо
                positionMenuFor(btn, menu);
                openMenu = menu;
                openMenuAnchor = btn;
            }
            return;
        }
        if (!e.target.closest('.popup-menu')) {
            document.querySelectorAll('.popup-menu').forEach((m) => m.classList.add('hidden'));
        }
    });

    // Reposition the open popup on scroll/resize/orientation changes
    ['scroll', 'resize', 'orientationchange'].forEach(evt => {
        window.addEventListener(evt, () => {
            if (openMenu && openMenuAnchor && !openMenu.classList.contains('hidden')) {
                positionMenuFor(openMenuAnchor, openMenu);
            }
        }, { passive: true });
    });

    // Wire new dots-menu actions (guard if absent)
    if (locChangeBtn) locChangeBtn.addEventListener('click', showConfirm);
    if (landmarksChangeBtn)
        landmarksChangeBtn.addEventListener('click', () => {
            if (!landmarksEl || !landmarksDisplay) return;

            // remember original, show editor with original value
            prevLandmarksText = currentLocation.landmarks || '';
            isEditingLandmarks = true;

            landmarksEl.value = prevLandmarksText;
            landmarksDisplay.style.display = 'none';
            if (btnEditLandmarks) btnEditLandmarks.style.display = 'none';
            landmarksEl.style.display = '';
            (landmarksControls && (landmarksControls.style.display = 'flex'));
            landmarksEl.focus();
        });

    landmarksCancel?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!landmarksEl || !landmarksDisplay) return;

        // revert UI and STATE to original
        landmarksEl.value = prevLandmarksText;
        currentLocation.landmarks = prevLandmarksText;

        if (landmarksEl.value !== '') {
            landmarksEl.style.display = 'none';
        }
        (landmarksControls && (landmarksControls.style.display = 'none'));

        if (prevLandmarksText.trim()) {
            landmarksDisplay.textContent = prevLandmarksText;
            landmarksDisplay.style.display = '';
        } else {
            landmarksDisplay.style.display = 'none';
        }

        const hasText = prevLandmarksText.trim().length > 0;
        if (landmarksMenuBtn) landmarksMenuBtn.style.display = hasText ? '' : 'none';
        updateLandmarksMargin();

        isEditingLandmarks = false;   // <<< important
        computeChangesMade();
        updateSubmitButtonVisibility?.();
    });

    landmarksDone?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!landmarksEl || !landmarksDisplay) return;

        const text = (landmarksEl.value || '').trim();
        currentLocation.landmarks = text; // commit

        // Оновити UI під текст
        if (text) {
            landmarksDisplay.textContent = text;
            landmarksDisplay.style.display = '';
            landmarksEl.style.display = 'none';
            // при заповненому тексті — ховаємо панель кнопок, як і на профілі
            if (landmarksControls) landmarksControls.style.display = 'none';
        } else {
            // Користувач видалив орієнтир і натиснув "Готово":
            // одразу показати textarea для подальшого вводу (вимога)
            landmarksDisplay.textContent = '';
            landmarksDisplay.style.display = 'none';
            landmarksEl.style.display = '';
            // кнопки можна сховати, щоб не заважали
            if (landmarksControls) landmarksControls.style.display = 'none';
        }

        // Крапки показуємо лише коли є текст
        if (landmarksMenuBtn) landmarksMenuBtn.style.display = text ? '' : 'none';
        updateLandmarksMargin();

        isEditingLandmarks = false;
        markChanged();
        maybeUpdateSubmit();

        // NEW: завжди пушимо оновлення на бек, навіть у creation flow
        try {
            await pushUpdate();
            hideErrors?.();
        } catch {
            // pushUpdate() вже показує помилку через showErrors(), тож можна нічого не робити
        }
    });

    // ===== LOAD EXISTING DATA =====
    // hide submit until we know initial state
    if (btnSubmit) btnSubmit.style.display = 'none';

    fetch(`${API_URL}/api/people/${personId}`)
        .then((r) => r.json())
        .then((data) => {
            premiumLocked = !!data.premium && !token;
            if (premiumLocked) applyPremiumLock();

            const loc = Array.isArray(data.location) ? data.location : [];

            // coords
            if (loc[0]) {
                hadCoordsOnLoad = true;
                currentLocation.coords = loc[0];
                if (geoCard) geoCard.style.display = 'none';
                const [lat, lng] = loc[0].split(',').map((s) => s.trim());
                renderMap(lat, lng);
            }

            // landmarks
            if (loc[1]) {
                currentLocation.landmarks = loc[1];
                if (landmarksDisplay) {
                    landmarksDisplay.textContent = loc[1];
                    landmarksDisplay.style.display = '';
                }
            } else {
                if (landmarksEl) landmarksEl.style.display = '';
            }

            // photos
            if (Array.isArray(loc[2])) {
                currentLocation.photos = loc[2].slice();
                refreshPlaceholders();
            }

            // determine initial state
            initialHasData = !!(
                currentLocation.coords ||
                (currentLocation.landmarks || '').trim() ||
                currentLocation.photos.length
            );

            // when there is already some location data — remove submit UX
            if (initialHasData && btnSubmit) {
                btnSubmit.style.display = 'none';
            }

            setSubmitLabel();
        })
        .catch((e) => {
            console.error('Failed to load person:', e);
        })
        .finally(() => {
            // right after you know initialHasData (e.g., in the .finally() after fetching person)
            if (!initialHasData) {
                // Creation flow: no location yet → no dots-menu, no confirm/cancel, show textarea directly
                if (landmarksMenuBtn) landmarksMenuBtn.style.display = 'none';
                updateLandmarksMargin();
                if (landmarksMenu) landmarksMenu.classList.add('hidden');

                if (landmarksDisplay) landmarksDisplay.style.display = 'none';
                if (landmarksControls) landmarksControls.style.display = 'none';

                if (landmarksEl) {
                    landmarksEl.style.display = '';          // show the textarea for immediate typing
                    landmarksEl.placeholder = 'Вкажіть орієнтири для полегшення пошуку місця поховання...';
                }
            }

            // локація: якщо координат немає — сховати крапки, показати geo-card як на макеті
            if (!currentLocation.coords) {
                if (locMenuBtn) locMenuBtn.style.display = 'none';
                if (locMenu) locMenu.classList.add('hidden');
                if (geoCard) {
                    geoCard.style.display = '';
                    renderGeoPlaceholder();
                }
            } else {
                if (locMenuBtn) locMenuBtn.style.display = '';
            }

            // орієнтири: якщо порожньо — сховати крапки
            const hasLm = Boolean((currentLocation.landmarks || '').trim());
            if (!hasLm) {
                if (landmarksMenuBtn) landmarksMenuBtn.style.display = 'none';
                updateLandmarksMargin();
                if (landmarksMenu) landmarksMenu.classList.add('hidden');
            } else {
                if (landmarksMenuBtn) landmarksMenuBtn.style.display = '';
                updateLandmarksMargin();
            }

            refreshPlaceholders();
            updatePhotosHeaderSpacing();
            setSubmitLabel();
            captureInitialSnapshot();
            computeChangesMade();
            maybeUpdateSubmit();

            if (premiumLocked) applyPremiumLock();
        });

    // ===== LANDMARKS input tracking =====
    if (landmarksEl)
        landmarksEl.addEventListener('input', () => {
            const val = (landmarksEl.value || '').trim();

            if (landmarksControls) {
                const shouldShow = true; // показуємо, щойно фокус/ввід почався
                landmarksControls.style.display = shouldShow ? 'flex' : 'none';
            }

            if (!initialHasData) {
                // CREATION: live-commit, no confirmation UI, keep dots-menu hidden
                currentLocation.landmarks = val;
                markChanged();

                if (landmarksMenuBtn) landmarksMenuBtn.style.display = 'none';
                updateLandmarksMargin();
                if (landmarksMenu) landmarksMenu.classList.add('hidden');

                hideErrors();
                maybeUpdateSubmit(); // first-time button visibility logic
            } else {
                // EDITING: don't commit yet → require "Готово"
                changesMade = true;
                hideErrors();
            }
        });

    // Keep old inline handler (button is hidden); harmless if clicked via DevTools
    if (btnEditLandmarks)
        btnEditLandmarks.addEventListener('click', () => {
            if (!landmarksEl || !landmarksDisplay) return;
            landmarksEl.value = currentLocation.landmarks;
            landmarksDisplay.style.display = 'none';
            btnEditLandmarks.style.display = 'none';
            landmarksEl.style.display = '';
            landmarksEl.focus();
            changesMade = true;
            maybeUpdateSubmit();
        });

    // ===== SLIDESHOW =====
    function openSlideshow(images, startIndex = 0) {
        const modal = document.createElement('div');
        modal.className = 'slideshow-modal';

        // Кнопка закриття
        const closeBtnX = document.createElement('span');
        closeBtnX.textContent = '✕';
        closeBtnX.className = 'close-slideshow';
        closeBtnX.onclick = () => document.body.removeChild(modal);

        // Трек зі слайдами
        const track = document.createElement('div');
        track.className = 'slideshow-track';

        images.forEach((url) => {
            const slide = document.createElement('div');
            slide.className = 'slideshow-slide';
            const slideImg = document.createElement('img');
            slideImg.src = url;
            slideImg.className = 'slideshow-img';
            slide.appendChild(slideImg);
            track.appendChild(slide);
        });

        // Індикатори
        const indicator = document.createElement('div');
        indicator.className = 'slideshow-indicators';
        images.forEach((_, idx) => {
            const dot = document.createElement('span');
            dot.className = 'slideshow-indicator';
            dot.addEventListener('click', () => {
                changeSlide(idx);
            });
            indicator.appendChild(dot);
        });

        function updateIndicators(index) {
            indicator.querySelectorAll('.slideshow-indicator').forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        }

        function changeSlide(newIndex) {
            const slides = track.querySelectorAll('.slideshow-slide');
            if (slides[newIndex]) {
                slides[newIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' });
            }
        }

        // Відслідковуємо активний слайд при прокрутці
        track.addEventListener('scroll', () => {
            const slideWidth = track.clientWidth;
            const index = Math.round(track.scrollLeft / slideWidth);
            updateIndicators(index);
        });

        // Додаємо елементи в модал
        modal.append(closeBtnX, track, indicator);
        document.body.appendChild(modal);

        // Прокручуємо до стартового слайду
        requestAnimationFrame(() => {
            const prev = track.style.scrollBehavior;
            track.style.scrollBehavior = 'auto';
            track.scrollLeft = startIndex * track.clientWidth;
            track.style.scrollBehavior = prev;
            updateIndicators(startIndex);
        });
    }

    // ===== MAP =====
    function renderMap(lat, lng) {
        // remove previous
        if (mapChangeBtn) mapChangeBtn.remove();
        if (mapWrap) mapWrap.remove();

        mapChangeBtn = document.createElement('button');
        mapChangeBtn.type = 'button';
        mapChangeBtn.textContent = 'Змінити';
        mapChangeBtn.className = 'btn btn-secondary change-btn';
        mapChangeBtn.style.display = 'none'; // hidden; we use dots menu
        mapChangeBtn.addEventListener('click', showConfirm);

        mapWrap = document.createElement('div');
        mapWrap.className = 'map-container';
        mapWrap.style.position = 'relative';

        const mapDiv = document.createElement('div');
        mapDiv.id = 'map';
        mapDiv.style = 'height: 290px; width: 100%; border-radius: 8px;';

        const routeBtn = document.createElement('button');
        routeBtn.textContent = 'Прокласти маршрут';
        routeBtn.className = 'floating-route-btn';

        const helpBtn = document.createElement('button');
        helpBtn.type = 'button';
        helpBtn.className = 'route-help-btn';
        helpBtn.textContent = 'Не можете прокласти маршрут';
        helpBtn.style.display = 'none';
        helpBtn.addEventListener('click', () => {
            window.location.href = '/route-instructions.html';
        });

        mapWrap.append(mapDiv, routeBtn, helpBtn);
        if (geoCard && geoCard.parentNode) {
            geoCard.parentNode.insertBefore(mapChangeBtn, geoCard.nextSibling);
            geoCard.parentNode.insertBefore(mapWrap, mapChangeBtn.nextSibling);
        }

        mapboxgl.accessToken =
            'pk.eyJ1IjoiYmFncml1bDEwIiwiYSI6ImNtY3pkM3lhMzB3M2MyanNidWRqZXlpN20ifQ.dgeloPQYgbOmrwVv8pYPww';

        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            zoom: 14,
            attributionControl: false,
        });

        const geolocate = new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true
        });
        let geolocateAdded = false;

        let ro = null;
        let onWinResize = null;

        map.on('load', () => {
            const latNum = parseFloat(lat);
            const lngNum = parseFloat(lng);

            new mapboxgl.Marker({ color: '#1B8B59', anchor: 'bottom' })
                .setLngLat([lngNum, latNum])
                .addTo(map);

            const isBtnVisible = () =>
                routeBtn.offsetParent !== null &&
                getComputedStyle(routeBtn).display !== 'none';

            function recenterForButton(extraPx = 60, mult = 1.2) {
                if (!isBtnVisible()) {
                    map.easeTo({ center: [lngNum, latNum], padding: { bottom: 0 }, duration: 0 });
                    return;
                }
                const btnRect = routeBtn.getBoundingClientRect();
                const yPad = Math.round(btnRect.height * mult + extraPx);
                map.easeTo({
                    center: [lngNum, latNum],
                    padding: { bottom: yPad },
                    duration: 0,
                });
            }

            recenterForButton();

            onWinResize = () => recenterForButton();
            window.addEventListener('resize', onWinResize, { passive: true });

            ro = new ResizeObserver(() => recenterForButton());
            ro.observe(routeBtn);
        });

        routeBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert('Ваш браузер не підтримує геолокацію.');
                return;
            }

            helpBtn.style.display = 'none';

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const origin = [pos.coords.longitude, pos.coords.latitude];
                    const destination = [parseFloat(lng), parseFloat(lat)];

                    fetch(
                        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
                        `${origin.join(',')};${destination.join(',')}?geometries=geojson` +
                        `&access_token=${mapboxgl.accessToken}`
                    )
                        .then((r) => r.json())
                        .then((data) => {
                            const route = data.routes?.[0]?.geometry;
                            if (!route) return;

                            if (!geolocateAdded) {
                                map.addControl(geolocate, 'top-right'); // now the button appears
                                geolocateAdded = true;
                            }

                            // remove previous route if it exists
                            if (map.getLayer('route')) map.removeLayer('route');
                            if (map.getSource('route')) map.removeSource('route');

                            map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: route } });
                            map.addLayer({
                                id: 'route',
                                type: 'line',
                                source: 'route',
                                layout: { 'line-join': 'round', 'line-cap': 'round' },
                                paint: { 'line-color': '#019CE9', 'line-width': 6 },
                            });

                            // show the whole route first
                            const bounds = new mapboxgl.LngLatBounds();
                            route.coordinates.forEach((c) => bounds.extend(c));
                            map.fitBounds(bounds, { padding: 40, duration: 1000 });

                            // then zoom in to my location when fit is done
                            map.once('moveend', () => {
                                // origin was computed above from geolocation:
                                // const origin = [pos.coords.longitude, pos.coords.latitude];
                                map.easeTo({
                                    center: origin,
                                    zoom: 16.5,          // tweak if you want closer/further
                                    duration: 1200
                                });

                                geolocate.trigger();
                            });

                            // hide the button and stop padding observers, as you already do
                            routeBtn.style.display = 'none';
                            if (ro) { ro.disconnect(); ro = null; }
                            if (onWinResize) { window.removeEventListener('resize', onWinResize); onWinResize = null; }
                        });
                },
                (err) => {
                    // Show help only when the user DENIES permission
                    if (err && (err.code === 1 || /denied/i.test(err.message))) {
                        helpBtn.style.display = '';
                        helpBtn.scrollIntoView({block:'nearest'});
                    }
                    alert('Не вдалося визначити ваше місцезнаходження: ' + err.message);
                }
            );
        });
    }

    // ===== GEOLOCATION =====
    if (btnGeo) btnGeo.addEventListener('click', requestGeolocation);
    function requestGeolocation() {
        if (!navigator.geolocation) {
            alert('Геолокація не підтримується вашим браузером.');
            return;
        }
        if (btnGeo) btnGeo.disabled = true;
        if (mapChangeBtn) mapChangeBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coordsStr = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
                currentLocation.coords = coordsStr;
                markChanged();

                if (geoCard) geoCard.style.display = 'none';
                renderMap(pos.coords.latitude, pos.coords.longitude);
                updatePhotosHeaderSpacing();

                if (initialHasData) pushUpdate();
                else maybeUpdateSubmit();

                if (btnGeo) btnGeo.disabled = false;
                if (mapChangeBtn) mapChangeBtn.disabled = false;
            },
            (err) => {
                alert('Не вдалося визначити локацію: ' + err.message);
                if (btnGeo) btnGeo.disabled = false;
                if (mapChangeBtn) mapChangeBtn.disabled = false;
            }
        );
    }

    // ===== PHOTOS =====
    if (btnAdd)
        btnAdd.addEventListener('click', () => {
            if (premiumLocked) return;
            if (photoMenu) photoMenu.classList.add('hidden'); // like other options
            if (fileInput) fileInput.click();
        });

    if (fileInput)
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            const previewUrls = files.map((f) => URL.createObjectURL(f));

            // show previews immediately
            previewUrls.forEach((url) => currentLocation.photos.push(url));
            refreshPlaceholders();
            markChanged();
            maybeUpdateSubmit();
            fileInput.value = '';

            pendingUploads += files.length;
            maybeUpdateSubmit();

            // upload each and replace blobs with real URLs
            files.forEach(async (file, idx) => {
                const previewUrl = previewUrls[idx];
                try {
                    const form = new FormData();
                    form.append('image', file);
                    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                        method: 'POST',
                        body: form,
                    });
                    const json = await res.json();
                    const realUrl = json?.data?.url;
                    const i = currentLocation.photos.indexOf(previewUrl);
                    if (i > -1 && realUrl) {
                        currentLocation.photos[i] = realUrl;
                        URL.revokeObjectURL(previewUrl);
                        refreshPlaceholders();
                        maybeUpdateSubmit();

                        if (initialHasData) await pushUpdate();
                    }
                } catch {
                    alert('Не вдалося завантажити зображення.');
                } finally {
                    pendingUploads = Math.max(0, pendingUploads - 1);
                    refreshPlaceholders();
                    maybeUpdateSubmit();
                }
            });
        });

    if (btnSelect)
        btnSelect.addEventListener('click', () => {
            if (premiumLocked) return;
            if (photoMenu) photoMenu.classList.add('hidden');
            enterSelectionMode();
        });

    function exitSelectionMode() {
        isSelecting = false;
        selectedOrder = [];
        const photosSec = document.querySelector('.section-photos');
        if (photosSec) photosSec.classList.remove('selection-mode');
        if (btnRow) {
            btnRow.innerHTML = '';
            btnRow.style.display = 'none';
        }
        refreshPlaceholders();
    }

    function enterSelectionMode() {
        if (isSelecting || currentLocation.photos.length === 0) return;
        isSelecting = true;
        const photosSec = document.querySelector('.section-photos');
        if (photosSec) photosSec.classList.add('selection-mode');

        // Build row: Скасувати + Видалити(0)
        if (!btnRow) return;
        btnRow.innerHTML = '';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'ritual-btn';
        cancelBtn.textContent = 'Скасувати';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'ritual-btn ritual-btn--danger delete-btn';
        deleteBtn.textContent = 'Видалити (0)';

        cancelBtn.addEventListener('click', exitSelectionMode);
        // Всередині enterSelectionMode()
        deleteBtn.addEventListener('click', () => {
            if (!selectedOrder.length) {
                exitSelectionMode();
                return;
            }
            // Відкрити модал підтвердження
            showDeleteConfirm();
        });

        btnRow.append(cancelBtn, deleteBtn);
        btnRow.style.display = 'flex';
    }

    function refreshPlaceholders() {
        if (!imageGrid || !btnRow) return;

        imageGrid.innerHTML = '';

        const hasPhotos = currentLocation.photos.length > 0;

        // Show row: when empty OR in selection mode
        if (!hasPhotos && !isSelecting) {
            btnRow.innerHTML = '';
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'ritual-btn';
            addBtn.textContent = 'Добавити';
            addBtn.addEventListener('click', () => fileInput && fileInput.click());
            btnRow.appendChild(addBtn);
            btnRow.style.display = 'flex';
        } else if (!isSelecting) {
            btnRow.innerHTML = '';
            btnRow.style.display = 'none';
        }

        // Dots menu visibility for photos section
        if (photoMenuBtn && photoMenu) {
            if (hasPhotos) {
                photoMenuBtn.style.display = '';
                photoMenu.classList.add('hidden');
            } else {
                photoMenuBtn.style.display = 'none';
                photoMenu.classList.add('hidden');
            }
        }

        if (!hasPhotos) {
            // Empty placeholders (tap to add)
            for (let i = 0; i < 3; i++) {
                const ph = document.createElement('div');
                ph.classList.add('image-placeholder');
                ph.style.cursor = 'pointer';
                ph.addEventListener('click', () => fileInput && fileInput.click());
                imageGrid.appendChild(ph);
            }
            return;
        }

        // Real tiles
        currentLocation.photos.forEach((url, idx) => {
            const wrap = document.createElement('div');
            wrap.className = 'image-wrap';

            const img = document.createElement('img');
            img.src = url;
            img.alt = '';
            img.className = 'item-image';

            const badge = document.createElement('span');
            badge.className = 'select-badge';

            // якщо це прев'ю (blob:), показати оверлей "завантаження"
            if (typeof url === 'string' && url.startsWith('blob:')) {
                wrap.classList.add('uploading');
                const hint = document.createElement('div');
                hint.className = 'uploading-hint';
                hint.textContent = 'Завантаження…';
                wrap.appendChild(hint);
            }

            img.addEventListener('click', () => {
                if (!isSelecting) {
                    openSlideshow(currentLocation.photos, idx);
                    return;
                }
                // toggle select
                const pos = selectedOrder.indexOf(wrap);
                if (pos === -1) selectedOrder.push(wrap);
                else selectedOrder.splice(pos, 1);
                wrap.classList.toggle('is-selected', pos === -1);

                // renumber badges
                imageGrid.querySelectorAll('.image-wrap').forEach((w) => {
                    const n = selectedOrder.indexOf(w);
                    const b = w.querySelector('.select-badge');
                    b.textContent = n === -1 ? '' : String(n + 1);
                });

                // update delete label
                const del = btnRow.querySelector('.delete-btn');
                if (del) del.textContent = `Видалити (${selectedOrder.length})`;
            });

            wrap.append(img, badge);
            imageGrid.appendChild(wrap);
        });
    }

    // ===== SUBMIT =====
    if (btnSubmit)
        btnSubmit.addEventListener('click', async () => {
            if (premiumLocked && !initialHasData) {
                e.preventDefault();
                showErrors('Щоб додати локацію, увійдіть у профіль.');
                return;
            }

            if (!isComplete()) {
                const miss = missingFields();
                showErrors(`Заповніть усі поля: ${miss.join(', ')}.`);
                return;
            }

            const payload = {
                location: [
                    currentLocation.coords,
                    (currentLocation.landmarks || '').trim(),
                    nonBlobPhotos(),
                ],
            };

            btnSubmit.disabled = true;
            hideErrors();

            try {
                const res = await fetch(UPDATE_ENDPOINT, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(await res.text());
                showModal();
            } catch (e) {
                console.error('Update failed', e);
                showErrors('Не вдалося оновити локацію. Спробуйте ще раз.');
            } finally {
                btnSubmit.disabled = false;
            }
        });

    // Confirm delete modal elements
    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    const confirmDeleteOk = document.getElementById('confirm-delete-ok');
    const confirmDeleteCancel = document.getElementById('confirm-delete-cancel');
    const confirmDeleteClose = document.getElementById('confirm-delete-close');

    function showDeleteConfirm() {
        if (!overlayEl || !confirmDeleteModal) return;
        overlayEl.hidden = false;
        confirmDeleteModal.hidden = false;
    }

    function hideDeleteConfirm() {
        if (!overlayEl || !confirmDeleteModal) return;
        overlayEl.hidden = true;
        confirmDeleteModal.hidden = true;
    }

    if (confirmDeleteCancel) confirmDeleteCancel.addEventListener('click', hideDeleteConfirm);
    if (confirmDeleteClose) confirmDeleteClose.addEventListener('click', hideDeleteConfirm);

    if (confirmDeleteOk) {
        confirmDeleteOk.addEventListener('click', () => {
            const toRemove = new Set(selectedOrder.map((w) => w.querySelector('img').src));
            currentLocation.photos = currentLocation.photos.filter((u) => !toRemove.has(u));
            hideDeleteConfirm();
            exitSelectionMode();
            markChanged();
            maybeUpdateSubmit();

            if (initialHasData) pushUpdate();
        });
    }
});
