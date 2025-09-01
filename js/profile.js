// js/profile.js

document.addEventListener('DOMContentLoaded', () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // Config
    // ─────────────────────────────────────────────────────────────────────────────
    // const API_URL = 'http://0.0.0.0:5000'
    const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app';
    const API_BASE = `${API_URL}/api/people`;
    const IMGBB_API_KEY = '726ae764867cf6b3a259967071cbdd80';

    const params = new URLSearchParams(window.location.search);
    const personId = params.get('personId');
    if (!personId) return;

    const tokenKey = `people_token_${personId}`;
    const token = localStorage.getItem(tokenKey);

    if (token) {
        window.location.replace(`/profile_edit.html?personId=${encodeURIComponent(personId)}`);
        return; // важливо: далі скрипт profile.js не виконуємо
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Grab key elements
    // ─────────────────────────────────────────────────────────────────────────────
    const avatarEl = document.querySelector('.profile-avatar');
    const heroEl = document.querySelector('.profile-hero');
    const nameEl = document.querySelector('.profile-name');
    const yearsEl = document.querySelector('.profile-years');
    const cemeteryEl = document.querySelector('.profile-cemetery');
    const actionText = document.getElementById('action-btn');
    const locationBtn = document.getElementById('location-btn');

    // Bio
    const bioContentEl = document.getElementById('bio-content'); // <p id="bio-content">
    const bioToggleEl = document.getElementById('bio-toggle');   // <span id="bio-toggle">
    const bioEditBtn = document.getElementById('bio-edit');      // "Змінити"
    const bioAddBtn = document.getElementById('bio-add');       // "Додати" (hidden by default)
    const bioMenuBtn = document.getElementById('bio-menu-btn');  // dots

    // Photos (profile)
    const photosMenuBtn = document.getElementById('photos-menu-btn');
    const photosMenu = document.getElementById('photos-menu');
    const photosListEl = document.querySelector('.profile-photos .photos-list');
    const addPhotoBtn = document.getElementById('add-photo-btn');
    const choosePhotoBtn = document.getElementById('choose-photo-btn');
    const deletePhotoBtn = document.getElementById('delete-photo-btn');
    const fileInput = document.getElementById('photo-input'); // hidden <input type="file" multiple>, may be absent in older HTML
    const photosScrollEl = document.querySelector('.profile-photos .photos-scroll');

    // ─── Shared album elements ───
    const sharedMenuBtn = document.getElementById('shared-menu-btn');
    const sharedMenu = document.getElementById('shared-menu');
    const sharedListEl = document.querySelector('.shared-list');
    const sharedAddBtn = document.getElementById('shared-add-btn');
    const sharedDeleteBtn = document.getElementById('shared-delete-btn');
    const sharedInput = document.getElementById('shared-input');

    // Toast wiring
    const toastEl = document.getElementById('toast');
    const toastTextEl = document.getElementById('toast-text');
    const toastCloseEl = document.getElementById('toast-close');
    function showToast(msg) {
        if (!toastEl || !toastTextEl) return;
        toastTextEl.textContent = msg;
        toastEl.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    toastCloseEl?.addEventListener('click', (e) => {
        e.preventDefault();
        if (toastEl) toastEl.hidden = true;
    });

    // ─── Liturgy: custom donation (“Інше”) ───
    const donationOptions = document.querySelector('.donation-options');
    const overlayEl = document.getElementById('modal-overlay');         // already exists in your HTML
    const donationModal = document.getElementById('donation-modal');
    const donationInput = document.getElementById('donation-input');
    const donationOk = document.getElementById('donation-ok');
    const donationCancel = document.getElementById('donation-cancel');
    const donationClose = document.getElementById('donation-close');

    // Mark the original "Інше" button as custom so we can always detect it
    const customDonationBtn = Array.from(donationOptions?.querySelectorAll('.donation-btn') || [])
        .find(btn => btn.textContent.trim() === 'Інше');
    if (customDonationBtn) {
        customDonationBtn.dataset.custom = '1';
    }

    function openDonationModal(presetValue = '') {
        if (!donationModal || !overlayEl) return;
        donationInput.value = presetValue || '';
        overlayEl.hidden = false;
        donationModal.hidden = false;
        // focus after paint
        requestAnimationFrame(() => donationInput?.focus());
    }

    function closeDonationModal() {
        if (!donationModal || !overlayEl) return;
        donationModal.hidden = true;
        overlayEl.hidden = true;
    }

    function selectDonationButton(btn) {
        // clear previous selection
        donationOptions?.querySelectorAll('.donation-btn').forEach(b => b.classList.remove('selected'));
        // select this one
        btn?.classList.add('selected');
    }

    donationOptions?.addEventListener('click', (e) => {
        const btn = e.target.closest('.donation-btn');
        if (!btn) return;

        // If it's our custom (“Інше”) button → open modal
        if (btn.dataset.custom === '1') {
            // If user previously entered a custom amount, show it again
            const current = btn.textContent.trim();
            const preset = current !== 'Інше' ? current.replace(/[^\d]/g, '') : '';
            openDonationModal(preset);
            // remember which button we are editing
            donationModal._targetBtn = btn;
            return;
        }

        // Otherwise: normal predefined amount → just select it
        selectDonationButton(btn);
    });

    // Modal buttons
    donationCancel?.addEventListener('click', closeDonationModal);
    donationClose?.addEventListener('click', closeDonationModal);

    // Confirm custom sum
    donationOk?.addEventListener('click', () => {
        const btn = donationModal?._targetBtn || customDonationBtn;
        const raw = (donationInput?.value || '').trim();
        const amount = parseInt(raw, 10);

        if (!amount || amount <= 0) {
            alert('Введіть коректну суму (мінімум 1 грн).');
            donationInput?.focus();
            return;
        }

        // Format like “123 грн”
        const label = `${amount} грн`;
        if (btn) {
            btn.textContent = label;
            // also keep data-amount if you later need to read it
            btn.dataset.amount = String(amount);
            selectDonationButton(btn);
        }

        closeDonationModal();
    });

    // Dots popup options (if present)
    document.getElementById('bio-edit-option')?.addEventListener('click', () => bioEditBtn?.click());
    document.getElementById('photos-add-option')?.addEventListener('click', () => addPhotoBtn?.click());
    document.getElementById('photos-choose-option')?.addEventListener('click', () => choosePhotoBtn?.click());
    document.getElementById('photos-delete-option')?.addEventListener('click', () => deletePhotoBtn?.click());

    // Підвʼязка опцій дотс-меню
    document.getElementById('shared-add-option')?.addEventListener('click', () => sharedAddBtn?.click());
    document.getElementById('shared-choose-option')?.addEventListener('click', () => {
        /* гість не може вибирати → ігноруємо */
    });

    // Comments
    const commentsListEl = document.querySelector('.comments-list');

    // ─────────────────────────────────────────────────────────────────────────────
    // Global click delegation for dots menus
    // ─────────────────────────────────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
        const option = e.target.closest('.popup-option');
        if (option) {
            option.closest('.popup-menu')?.classList.remove('show');
            return;
        }

        if (e.target.closest('.dots-btn')) {
            const btn = e.target.closest('.dots-btn');
            const menu = btn.nextElementSibling;

            // Якщо меню вже відкрите → просто закриваємо
            if (menu && menu.classList.contains('show')) {
                menu.classList.remove('show');
                return;
            }

            // Закриваємо всі перед відкриттям
            document.querySelectorAll('.popup-menu').forEach(m => m.classList.remove('show'));

            if (menu) {
                // Тимчасово робимо видимим для вимірювання
                menu.classList.add('show');

                const btnRect = btn.getBoundingClientRect();
                const parentRect = menu.offsetParent
                    ? menu.offsetParent.getBoundingClientRect()
                    : { left: 0, top: 0, width: window.innerWidth };

                const menuW = Math.max(menu.offsetWidth, 160);

                const left = Math.min(
                    parentRect.width - 12 - menuW,
                    (btnRect.right - parentRect.left) - menuW
                );
                const top = (btnRect.bottom - parentRect.top) + 8;

                menu.style.left = `${Math.max(12, left)}px`;
                menu.style.top = `${top}px`;
            }
            return;
        }

        // Клік поза меню → закрити
        if (!e.target.closest('.popup-menu')) {
            document.querySelectorAll('.popup-menu').forEach(m => m.classList.remove('show'));
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────────
    let photos = [];                 // Array<Photo>  [{url, description}]
    let isSelecting = false;         // selection mode for photos
    let selectedOrder = [];          // array of indexes of selected photos (in click order)
    let pendingUploads = 0;
    let comments = [];  // profile comments array
    let premiumLock = false;
    let premiumCreds = null;
    let sharedPending = []; // [{url}]  — запропоновані гостями (pending)
    let sharedPhotos = []; // [{url, description?}] — прийняті
    let sharedSelecting = false;     // режим вибору для прийнятих (не використовується гостем)
    let sharedSelectedOrder = [];

    const nonBlobPhotos = () =>
        (photos || []).filter((u) => typeof u === 'string' && u && !u.startsWith('blob:'));
    const isBlobUrl = (u) => typeof u === 'string' && u.startsWith('blob:');
    const realPhotos = () => (photos || []).filter(p => p && typeof p.url === 'string' && !isBlobUrl(p.url));
    const realPhotoUrls = () => realPhotos().map(p => p.url);
    function isBlob(u) { return typeof u === 'string' && u.startsWith('blob:'); }

    // ─────────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────────
    // Гість: показуємо тільки “Добавити”, ховаємо “Вибрати”
    if (sharedMenu) {
        sharedMenu.querySelector('#shared-choose-option')?.classList.add('hidden');
    }
    if (sharedDeleteBtn) sharedDeleteBtn.style.display = 'none';

    const sharedRealPhotos = () =>
        (sharedPhotos || []).filter(p => p && typeof p.url === 'string' && !isBlob(p.url));
    const sharedRealUrls = () => sharedRealPhotos().map(p => p.url);

    // Рендер
    function refreshSharedUI() {
        if (!sharedListEl) return;
        sharedListEl.innerHTML = '';

        // PUBLIC PAGE: show only accepted photos + local blob previews
        const localPendingBlobs = sharedPending.filter(p => isBlob(p.url));
        const renderItems = [...localPendingBlobs, ...sharedPhotos];
        const hasAny = renderItems.length > 0;
        sharedListEl.classList.remove('rows-1', 'rows-2');
        sharedListEl.classList.add('rows-1');

        // pending first
        renderItems.forEach((p, idx) => {
            const li = document.createElement('li');
            const img = document.createElement('img');
            img.src = p.url; li.appendChild(img);

            // uploading overlay for blob previews
            if (isBlob(p.url)) {
                li.classList.add('uploading');
                const hint = document.createElement('div');
                hint.className = 'uploading-hint'; hint.textContent = 'Завантаження…';
                li.appendChild(hint);
            }

            const isAccepted = !isBlob(p.url); // in public view we only render blobs (local) or accepted
            if (isAccepted) {
                // Accepted → open slideshow on click
                li.addEventListener('click', () => {
                    const images = sharedRealUrls();
                    const captions = sharedRealPhotos().map(x => x.description || '');
                    const start = images.indexOf(p.url);
                    openSlideshow(
                        images.length ? images : [p.url],
                        images.length && start >= 0 ? start : 0,
                        images.length ? captions : [p.description || '']
                    );
                });
            }

            sharedListEl.appendChild(li);
        });
    }


    // Аплоад на ImgBB (як у фото)
    async function uploadToImgBB(file) {
        const form = new FormData(); form.append('image', file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: form });
        const json = await res.json(); if (!json.success) throw new Error('Upload failed');
        return json.data.url;
    }

    // Заглушка бекенду: відправка оферів (зробіть на бекенді як зручно)
    async function submitSharedOffer(hostedUrl) {
        await fetch(`${API_BASE}/${personId}/shared/offer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: hostedUrl })
        });
    }

    // Клік “Добавити” → file input
    sharedAddBtn?.addEventListener('click', () => sharedInput?.click());

    // File input → миттєві превʼю → аплоад → POST як pending
    sharedInput?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []); if (!files.length) return;

        // миттєво додаємо превʼю pending
        const start = sharedPending.length;
        const previews = files.map(f => URL.createObjectURL(f));
        previews.forEach(url => sharedPending.push({ url }));
        refreshSharedUI();
        sharedInput.value = '';

        for (let i = 0; i < files.length; i++) {
            try {
                const hosted = await uploadToImgBB(files[i]);
                // замінюємо blob на hosted
                await submitSharedOffer(hosted);
                showToast("Успішно відправлено на модерацію! Ми сповістимо вас коли буде готово");
                // remove the local preview entry; server-side pending should not be shown on public page
                sharedPending.splice(start + i, 1);
                refreshSharedUI();
            } catch (err) {
                console.error('Offer upload failed', err);
                sharedPending.splice(start + i, 1);
                refreshSharedUI();
                alert('Не вдалося надіслати фото в спільний альбом.');
            }
        }
    });

    function setPhotosControlsVisibility() {
        if (premiumLock) {
            const controls = document.querySelector('.profile-photos .photos-controls');
            if (controls) controls.style.display = 'none';
            if (photosMenuBtn) photosMenuBtn.style.display = 'none';
            return;
        }

        const controls = document.querySelector('.profile-photos .photos-controls');
        const has = photos.length > 0;

        // 1) No photos → show only "Добавити" controls, hide dots
        if (!has) {
            if (controls) controls.style.display = 'flex';
            if (addPhotoBtn) addPhotoBtn.style.display = '';
            if (choosePhotoBtn) choosePhotoBtn.style.display = 'none';
            if (deletePhotoBtn) deletePhotoBtn.style.display = 'none';
            if (photosMenuBtn) photosMenuBtn.style.display = 'none';
            return;
        }

        // 3) Selection mode → show "Скасувати" + "Видалити (n)", hide dots
        if (isSelecting) {
            if (controls) controls.style.display = 'flex';
            if (addPhotoBtn) addPhotoBtn.style.display = 'none';
            if (choosePhotoBtn) { choosePhotoBtn.style.display = ''; choosePhotoBtn.textContent = 'Скасувати'; }
            if (deletePhotoBtn) deletePhotoBtn.style.display = 'inline-block';
            if (photosMenuBtn) photosMenuBtn.style.display = 'none';
            return;
        }

        // 2) Has photos (not selecting) → hide controls, show only dots menu
        if (controls) controls.style.display = 'none';
        if (photosMenuBtn) photosMenuBtn.style.display = 'inline-flex';
    }

    function updateDeleteButtonLabel() {
        if (!deletePhotoBtn) return;
        deletePhotoBtn.textContent = `Видалити (${selectedOrder.length})`;
    }

    function exitSelectionMode() {
        isSelecting = false;
        selectedOrder = [];
        document.querySelector('.profile-photos')?.classList.remove('selection-mode');
        refreshPhotosUI();
        setPhotosControlsVisibility();
    }

    function enterSelectionMode() {
        if (isSelecting || photos.length === 0) return;
        isSelecting = true;
        document.querySelector('.profile-photos')?.classList.add('selection-mode');
        updateDeleteButtonLabel();
        refreshPhotosUI();
        setPhotosControlsVisibility();
    }

    function toggleSelectPhoto(index) {
        const pos = selectedOrder.indexOf(index);
        if (pos > -1) {
            selectedOrder.splice(pos, 1);
        } else {
            selectedOrder.push(index);
        }
        refreshPhotosUI();
        updateDeleteButtonLabel();
    }

    function openSlideshow(images, startIndex = 0, captions = []) {
        const modal = document.createElement('div');
        modal.className = 'slideshow-modal';

        const closeBtnX = document.createElement('span');
        closeBtnX.textContent = '✕';
        closeBtnX.className = 'close-slideshow';
        closeBtnX.onclick = () => document.body.removeChild(modal);

        const track = document.createElement('div');
        track.className = 'slideshow-track';

        images.forEach((url, i) => {
            const slide = document.createElement('div');
            slide.className = 'slideshow-slide';

            const slideImg = document.createElement('img');
            slideImg.src = url;
            slideImg.className = 'slideshow-img';
            slide.appendChild(slideImg);

            // Caption overlay (if present)
            // Caption overlay (if present)
            const text = captions[i] || '';
            if (text && text.trim()) {
                const cap = document.createElement('div');
                cap.className = 'slideshow-caption';

                const span = document.createElement('span');
                span.className = 'caption-text';
                span.textContent = text;

                const toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'caption-toggle';
                toggle.textContent = '… більше';

                cap.append(span, toggle);
                slide.appendChild(cap);

                // Після вставки в DOM міряємо переповнення й показуємо “більше”, якщо треба
                requestAnimationFrame(() => {
                    const overflowing = span.scrollHeight > span.clientHeight + 1;
                    if (overflowing) {
                        cap.classList.add('has-toggle');
                        toggle.addEventListener('click', () => {
                            const expanded = cap.classList.toggle('expanded');
                            toggle.textContent = expanded ? 'менше' : '… більше';
                        });
                    } else {
                        toggle.remove(); // текст короткий — кнопка не потрібна
                    }
                });
            }

            track.appendChild(slide);
        });

        const indicator = document.createElement('div');
        indicator.className = 'slideshow-indicators';
        images.forEach((_, idx) => {
            const dot = document.createElement('span');
            dot.className = 'slideshow-indicator';
            dot.addEventListener('click', () => changeSlide(idx));
            indicator.appendChild(dot);
        });

        function updateIndicators(index) {
            indicator.querySelectorAll('.slideshow-indicator').forEach((dot, i) =>
                dot.classList.toggle('active', i === index)
            );
        }
        function changeSlide(newIndex) {
            const slides = track.querySelectorAll('.slideshow-slide');
            if (slides[newIndex]) {
                slides[newIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' });
            }
        }
        track.addEventListener('scroll', () => {
            const slideWidth = track.clientWidth;
            const index = Math.round(track.scrollLeft / slideWidth);
            updateIndicators(index);
        });

        modal.append(closeBtnX, track, indicator);
        document.body.appendChild(modal);

        requestAnimationFrame(() => {
            changeSlide(startIndex);
            updateIndicators(startIndex);
        });
    }

    function refreshPhotosUI() {
        if (!photosListEl) return;

        // clear previous list
        photosListEl.innerHTML = '';
        photosListEl.classList.remove('rows-1', 'rows-2');
        if (photosListEl.style) photosListEl.style.display = ''; // ensure visible by default

        // remove old empty-state, if any
        photosScrollEl?.querySelector('.photos-empty')?.remove();

        const hasPhotos = photos.length > 0;
        setPhotosControlsVisibility();

        // 0) Empty state
        if (!hasPhotos) {
            // hide the UL and show the text block
            if (photosListEl.style) photosListEl.style.display = 'none';
            const empty = document.createElement('div');
            empty.className = 'photos-empty';
            empty.textContent = 'Немає фотографій. Будь ласка, поділіться спогадами';
            photosScrollEl?.appendChild(empty);
            return;
        }

        // 1) One row if exactly 1 photo, otherwise two rows
        photosListEl.classList.add(photos.length === 1 ? 'rows-1' : 'rows-2');

        // render items
        photos.forEach((p, idx) => {
            const url = p.url;

            const li = document.createElement('li');
            li.dataset.index = String(idx);

            const img = document.createElement('img');
            img.src = url;

            // If this is a local preview (blob:), show uploading overlay + hint
            if (typeof url === 'string' && url.startsWith('blob:')) {
                li.classList.add('uploading');
                const hint = document.createElement('div');
                hint.className = 'uploading-hint';
                hint.textContent = 'Завантаження…';
                li.appendChild(hint);
            }

            const overlay = document.createElement('div');
            overlay.className = 'photo-selection-overlay';

            const circle = document.createElement('div');
            circle.className = 'photo-selection-circle';
            const check = document.createElement('div');
            check.className = 'selection-check';
            check.textContent = '✓';
            circle.appendChild(check);
            overlay.appendChild(circle);

            // selection badge
            const orderPos = selectedOrder.indexOf(idx);
            if (orderPos > -1) {
                li.classList.add('selected');
                circle.textContent = String(orderPos + 1);
            }

            // click behavior (open slideshow vs select)
            li.addEventListener('click', () => {
                if (isSelecting) {
                    toggleSelectPhoto(idx);
                } else {
                    // We only show real (uploaded) photos in slideshow
                    const images = realPhotoUrls();               // array of urls
                    const captions = realPhotos().map(p => p.description || '');
                    const startIndex = images.indexOf(url);
                    const safeIndex = Math.max(0, startIndex);
                    openSlideshow(
                        images.length ? images : [url],
                        images.length ? safeIndex : 0,
                        images.length ? captions : [p.description || '']
                    );
                }
            });

            li.append(img, overlay);
            photosListEl.appendChild(li);
        });

        if (photosMenuBtn) photosMenuBtn.style.visibility = isSelecting ? 'hidden' : 'visible';
    }

    async function saveProfilePhotos() {
        try {
            const clean = realPhotos().map(p => ({ url: p.url, description: p.description || '' }));
            const body = JSON.stringify({ photos: clean });
            const res = await fetch(`${API_BASE}/${personId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body
            });
            if (!res.ok) throw new Error(res.statusText);
        } catch (e) {
            console.error('Failed to save profile photos:', e);
            alert('Не вдалося зберегти фотографії профілю.');
        }
    }

    function hookPhotoButtons() {
        if (addPhotoBtn)
            addPhotoBtn.addEventListener('click', () => {
                fileInput?.click();
            });

        if (choosePhotoBtn)
            choosePhotoBtn.addEventListener('click', () => {
                if (isSelecting) {
                    // cancel
                    exitSelectionMode();
                    choosePhotoBtn.textContent = 'Вибрати';
                } else {
                    enterSelectionMode();
                    choosePhotoBtn.textContent = 'Скасувати';
                }
            });

        if (deletePhotoBtn) {
            const overlay = document.getElementById('modal-overlay');
            const dlg = document.getElementById('confirm-delete-modal');
            const closeX = document.getElementById('confirm-delete-close');
            const cancelBtn = document.getElementById('confirm-delete-cancel');
            const okBtn = document.getElementById('confirm-delete-ok');

            const openConfirm = () => { overlay.hidden = false; dlg.hidden = false; };
            const closeConfirm = () => { overlay.hidden = true; dlg.hidden = true; };

            deletePhotoBtn.addEventListener('click', () => {
                if (!isSelecting || selectedOrder.length === 0) { exitSelectionMode(); return; }
                openConfirm();
            });

            [closeX, cancelBtn, overlay].forEach(el => el && el.addEventListener('click', closeConfirm));

            okBtn?.addEventListener('click', async () => {
                const toDelete = [...selectedOrder].sort((a, b) => b - a);
                toDelete.forEach(i => {
                    if (i >= 0 && i < photos.length) {
                        const u = photos[i]?.url;
                        if (isBlobUrl(u)) { try { URL.revokeObjectURL(u); } catch { } }
                        photos.splice(i, 1);
                    }
                });
                selectedOrder = [];
                await saveProfilePhotos();
                closeConfirm();
                exitSelectionMode();
            });
        }

        if (fileInput)
            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;

                // Create blob previews and temp caption map (by index)
                const previews = files.map((f) => URL.createObjectURL(f));
                const tempCaptions = new Array(previews.length).fill('');

                // === 1) SHOW CAPTION MODAL (stepper) ===
                const overlay = document.getElementById('modal-overlay');
                const dlg = document.getElementById('photo-desc-modal');
                const closeX = document.getElementById('photo-desc-close');
                const prevBtn = document.getElementById('photo-desc-prev');
                const nextBtn = document.getElementById('photo-desc-next');
                const previewEl = document.getElementById('photo-desc-preview');
                const textEl = document.getElementById('photo-desc-text');
                const counterEl = document.getElementById('photo-desc-counter');

                let step = 0;
                const total = previews.length;

                const open = () => { overlay.hidden = false; dlg.hidden = false; };
                const close = () => { overlay.hidden = true; dlg.hidden = true; };

                function renderStep() {
                    previewEl.src = previews[step];
                    textEl.value = tempCaptions[step] || '';
                    counterEl.textContent = `Фото ${step + 1} з ${total}`;
                    prevBtn.style.display = step === 0 ? 'none' : '';
                    nextBtn.textContent = step === total - 1 ? 'Готово' : 'Далі';
                }

                function commitCurrent() {
                    tempCaptions[step] = (textEl.value || '').trim();
                }

                closeX.onclick = () => { commitCurrent(); close(); };
                prevBtn.onclick = () => { commitCurrent(); step = Math.max(0, step - 1); renderStep(); };
                nextBtn.onclick = () => {
                    commitCurrent();
                    if (step < total - 1) { step++; renderStep(); }
                    else close();
                };

                open();
                renderStep();

                // Wait until dialog closes (simple polling of hidden attribute)
                await new Promise((resolve) => {
                    const iv = setInterval(() => { if (!dlg || dlg.hidden) { clearInterval(iv); resolve(); } }, 60);
                });

                // === 2) Optimistically show previews with captions ===
                previews.forEach((url, i) => {
                    photos.push({ url, description: tempCaptions[i] || '' });  // push object
                });
                refreshPhotosUI();
                fileInput.value = '';

                // === 3) Upload each → replace blob.url with real URL and keep description ===
                pendingUploads += files.length;

                files.forEach(async (file, idx) => {
                    const previewUrl = previews[idx];

                    try {
                        const form = new FormData();
                        form.append('image', file);
                        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                            method: 'POST', body: form,
                        });
                        const json = await res.json();
                        const realUrl = json?.data?.url;

                        const i = photos.findIndex(p => p.url === previewUrl);
                        if (i > -1 && realUrl) {
                            photos[i].url = realUrl;                          // keep its description
                            try { URL.revokeObjectURL(previewUrl); } catch { }
                            refreshPhotosUI();
                            await saveProfilePhotos(); // incremental save
                        }
                    } catch (err) {
                        console.error('Upload failed:', err);
                        alert('Не вдалося завантажити зображення.');
                    } finally {
                        pendingUploads = Math.max(0, pendingUploads - 1);
                        refreshPhotosUI();
                    }
                });
            });
    }

    function renderComments() {
        if (!commentsListEl) return;

        commentsListEl.innerHTML = '';

        // 1) Empty-state
        if (!Array.isArray(comments) || comments.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'comments-empty';
            empty.textContent = 'Немає коментарів';
            commentsListEl.appendChild(empty);

            // reset any previous clamp
            commentsListEl.style.maxHeight = '';
            commentsListEl.style.overflowY = '';
            return;
        }

        // 2) Items
        comments.forEach(c => {
            const item = document.createElement('div');
            item.className = 'comment-item';
            const author = c.author ?? '';
            const date = c.date ?? '';
            const text = c.text ?? '';
            item.innerHTML = `
            <div class="comment-header">
              <span class="comment-author">${author}</span>
              <span class="comment-date">${date}</span>
            </div>
            <p class="comment-text">${text}</p>
          `;
            commentsListEl.appendChild(item);
        });

        // 3) Clamp to 4 items (scroll if more)
        const items = commentsListEl.querySelectorAll('.comment-item');
        // clear any previous inline clamp first
        commentsListEl.style.maxHeight = '';
        commentsListEl.style.overflowY = '';

        if (items.length > 4) {
            // measure after layout to get accurate heights
            requestAnimationFrame(() => {
                const first = items[0];
                const fourth = items[3];
                if (!first || !fourth) return;

                const firstRect = first.getBoundingClientRect();
                const fourthRect = fourth.getBoundingClientRect();

                // exact height of first 4 items (includes inter-item margins)
                const clampPx = Math.ceil(fourthRect.bottom - firstRect.top);
                // guard against overshoot
                const maxPx = Math.min(clampPx, commentsListEl.scrollHeight);

                commentsListEl.style.maxHeight = `${maxPx}px`;
                commentsListEl.style.overflowY = 'auto';
            });
        }
    }

    function hideEditingUIForPremium() {
        // Bio
        const bioEdit = document.getElementById('bio-edit');
        if (bioEdit) bioEdit.style.display = 'none';

        const bioAdd = document.getElementById('bio-add');
        if (bioAdd) bioAdd.style.display = 'none';

        const bioMenuBtn = document.getElementById('bio-menu-btn');
        if (bioMenuBtn) bioMenuBtn.style.display = 'none';

        // Photos controls + any dots
        document.querySelectorAll('.photos-controls, #photos-menu-btn, .dots-btn, .popup-menu')
            .forEach(el => {
                if (el) el.style.display = 'none';
            });

        // Relatives
        const addRelative = document.getElementById('add-relative-btn');
        if (addRelative) addRelative.style.display = 'none';

        const chooseRelative = document.getElementById('choose-relative-btn');
        if (chooseRelative) chooseRelative.style.display = 'none';
    }

    function setupLoginModalOpenClose() {
        const loginModal = document.getElementById('loginModal');
        const loginBox = loginModal?.querySelector('.login-box');
        const loginBtn = document.getElementById('profile-login-btn');
        const closeBtn = document.getElementById('loginClose');

        if (!loginModal || !loginBox || !loginBtn) {
            console.warn('One or more login modal elements not found');
            return;
        }

        const open = () => {
            loginModal.style.display = 'flex';
        };
        const close = () => {
            loginModal.style.display = 'none';
            document.getElementById('loginInput').value = '';
            document.getElementById('passwordInput').value = '';
            document.getElementById('loginError').textContent = '';
        };

        loginBtn.addEventListener('click', open);
        closeBtn?.addEventListener('click', close);
        loginModal.addEventListener('click', (e) => { if (!loginBox.contains(e.target)) close(); });
        loginBox.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && loginModal.style.display === 'flex') close(); });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Load person
    // ─────────────────────────────────────────────────────────────────────────────
    (async () => {
        try {
            const res = await fetch(`${API_BASE}/${personId}`);
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();

            // PREMIUM lock (означає, що сторінка преміум і редагування заблоковане поки не увійти)
            premiumLock = !!data.premium;
            premiumCreds = data.premium || null;

            if (premiumLock) {
                // Показати шапку з “Увійти” та сховати всі кнопки редагування
                document.getElementById('profile-login-header')?.removeAttribute('hidden');
                hideEditingUIForPremium?.();
                setupLoginModalOpenClose?.();

                // дублюємо безпечне підв’язування
                const loginBtn = document.getElementById('profile-login-btn');
                const loginModal = document.getElementById('loginModal');
                const loginBox = loginModal?.querySelector('.login-box');
                if (loginBtn && loginModal && loginBox) {
                    const open = () => { loginModal.style.display = 'flex'; };
                    loginBtn.onclick = open;
                    loginBox.onclick = (e) => e.stopPropagation();
                    loginModal.onclick = (e) => {
                        if (!loginBox.contains(e.target)) loginModal.style.display = 'none';
                    };
                }
            }

            // ─── COMMENTS ───
            comments = Array.isArray(data.comments) ? data.comments : [];
            renderComments?.();

            // ─── AVATAR / HERO ───
            if (avatarEl) avatarEl.src = data.avatarUrl || 'https://i.ibb.co/mrQJL133/Frame-519.jpg';
            if (heroEl && data.backgroundUrl) {
                heroEl.style.backgroundImage = `url(${data.backgroundUrl})`;
            }

            // ─── NAME / YEARS / CEMETERY ───
            if (nameEl) nameEl.textContent = data.name || '';
            if (yearsEl) {
                yearsEl.textContent = `${data.birthDate || ''} ${data.birthYear || ''} – ${data.deathDate || ''} ${data.deathYear || ''}`.trim();
            }
            if (cemeteryEl) cemeteryEl.textContent = (data.cemetery || '').split(', ')[0] || '';

            // Ensure liturgy person-name is always visible
            const liturgyPersonNameEl = document.querySelector('.person-name');
            if (liturgyPersonNameEl && nameEl) {
                liturgyPersonNameEl.textContent = nameEl.textContent;
            }

            // ─── ACTION BTN (location) ───
            if (data?.location?.[0]) {
                actionText.textContent = 'Локація місця поховання';
                locationBtn.href = `/location.html?personId=${personId}`;
            } else {
                actionText.textContent = 'Додати локацію місця поховання';
                locationBtn.href = `/location.html?personId=${personId}`;
            }

            // ─── BIO ───
            const fullBio = data.bio || '';
            const bioBodyWrap = document.querySelector('.profile-bio .bio-body');
            bioBodyWrap?.querySelector('.bio-empty')?.remove();

            if (fullBio.trim()) {
                bioContentEl.textContent = fullBio;

                // measure overflow
                requestAnimationFrame(() => {
                    const overflowing = bioContentEl.scrollHeight > bioContentEl.clientHeight + 1;
                    if (overflowing) {
                        // create toggle button
                        const toggle = document.createElement('button');
                        toggle.type = 'button';
                        toggle.className = 'bio-toggle';
                        toggle.textContent = '…\u00A0більше';

                        toggle.addEventListener('click', () => {
                            const expanded = bioContentEl.classList.toggle('expanded');
                            toggle.textContent = expanded ? 'менше' : '… більше';
                        });

                        bioContentEl.appendChild(toggle);
                    }
                });
            }
            if (!fullBio.trim()) {
                if (bioContentEl) {
                    bioContentEl.textContent = '';
                    bioContentEl.style.display = 'none';
                }
                if (bioBodyWrap) {
                    const empty = document.createElement('div');
                    empty.className = 'bio-empty';
                    empty.textContent = 'Життєпис ще не заповнено. Будь ласка, додайте інформацію';
                    bioBodyWrap.prepend(empty);
                }
            }

            // Кнопки біо показуємо/ховаємо лише якщо НЕ premium (на публічній сторінці це й так read-only)
            if (!premiumLock) {
                if (!fullBio.trim()) {
                    bioAddBtn && (bioAddBtn.style.display = 'inline-block');
                    bioEditBtn && (bioEditBtn.style.display = 'none');
                    bioMenuBtn && (bioMenuBtn.style.display = 'none');
                } else {
                    bioAddBtn && (bioAddBtn.style.display = 'none');
                    bioEditBtn && (bioEditBtn.style.display = 'inline-block');
                    bioMenuBtn && (bioMenuBtn.style.display = 'inline-flex');
                }
            }

            // Редагування біо (для випадку, якщо дозволено)
            function enterBioEdit() {
                const bioBody = document.querySelector('.profile-bio .bio-body');
                if (!bioBody) return;
                bioBody.innerHTML = `<textarea id="bio-editor" placeholder="Додайте життєпис...">${fullBio || ''}</textarea>`;

                const btnsWrap = document.querySelector('.profile-bio .bio-buttons');
                if (btnsWrap) {
                    btnsWrap.innerHTML = '';
                    const cancel = document.createElement('button');
                    cancel.className = 'btn bio-edit-btn';
                    cancel.id = 'bio-cancel-btn';
                    cancel.textContent = 'Скасувати';

                    const done = document.createElement('button');
                    done.className = 'btn bio-edit-btn';
                    done.id = 'bio-done-btn';
                    done.textContent = 'Готово';

                    btnsWrap.append(cancel, done);

                    cancel.addEventListener('click', () => window.location.reload());

                    done.addEventListener('click', async () => {
                        const newBio = (document.getElementById('bio-editor')?.value || '').trim();
                        try {
                            const up = await fetch(`${API_BASE}/${personId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bio: newBio })
                            });
                            if (!up.ok) throw new Error(up.statusText);
                            window.location.reload();
                        } catch (e) {
                            console.error('Failed to update bio:', e);
                            alert('Не вдалося оновити життєпис.');
                        }
                    });
                }
            }
            bioAddBtn?.addEventListener('click', enterBioEdit);
            bioEditBtn?.addEventListener('click', enterBioEdit);

            // ─── PHOTOS (звичайні) ───
            photos = Array.isArray(data.photos)
                ? data.photos
                    .filter(p => p && typeof p.url === 'string' && p.url.trim())
                    .map(p => ({ url: p.url.trim(), description: (p.description ?? '').toString() }))
                : [];
            hookPhotoButtons?.();
            refreshPhotosUI?.();

            // ─────────────────────────────────────────────────────────────────────────
            // SHARED ALBUM (показується лише якщо є premium у цієї особи)
            // ─────────────────────────────────────────────────────────────────────────
            const sharedSection = document.querySelector('.profile-shared');
            const sharedChooseOpt = document.getElementById('shared-choose-option');
            const sharedDeleteBtn = document.getElementById('shared-delete-btn');

            if (sharedSection) {
                if (data.premium) {
                    // секція активна
                    sharedSection.removeAttribute('hidden');

                    // Ініціалізація масивів (ВАЖЛИВО: у локальні змінні, не window.*)
                    sharedPending = Array.isArray(data.sharedPending)
                        ? data.sharedPending
                            .filter(p => p && typeof p.url === 'string' && p.url.trim())
                            .map(p => ({ url: p.url.trim() }))
                        : [];

                    sharedPhotos = Array.isArray(data.sharedPhotos)
                        ? data.sharedPhotos
                            .filter(p => p && typeof p.url === 'string' && p.url.trim())
                            .map(p => ({ url: p.url.trim(), description: (p.description ?? '').toString() }))
                        : [];

                    // Публічна сторінка → “гостьовий” режим:
                    // ховаємо "Вибрати" та кнопку масового видалення
                    sharedChooseOpt?.classList.add('hidden');
                    if (sharedDeleteBtn) sharedDeleteBtn.style.display = 'none';

                    // Рендер (pending → першими)
                    if (typeof refreshSharedUI === 'function') refreshSharedUI();
                } else {
                    // нема преміуму — секцію ховаємо
                    sharedSection.setAttribute('hidden', 'hidden');
                }
            }

        } catch (err) {
            console.error(err);
            document.querySelector('.profile-info')?.insertAdjacentHTML(
                'beforeend',
                '<p>Не вдалося завантажити профіль.</p>'
            );
        }
    })();

    // ─────────────────────────────────────────────────────────────────────────────
    // Liturgy Section (unchanged visual behavior, minor robustness)
    // ─────────────────────────────────────────────────────────────────────────────
    function generateDates() {
        const dateCalendar = document.querySelector('.date-calendar');
        const selectedDateEl = document.querySelector('.selected-date');

        if (!dateCalendar || !selectedDateEl) return;
        dateCalendar.innerHTML = '';

        const today = new Date();
        const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

        // From one month before today to one month after today
        const startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);

        const endDate = new Date(today);
        endDate.setMonth(today.getMonth() + 1);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateItem = document.createElement('div');
            dateItem.className = 'date-item' +
                (d.toDateString() === today.toDateString() ? ' selected' : '');

            const dateNumber = document.createElement('span');
            dateNumber.className = 'date-number';
            dateNumber.textContent = d.getDate();

            const dateDay = document.createElement('span');
            dateDay.className = 'date-day';
            dateDay.textContent = dayNames[d.getDay()];

            dateItem.appendChild(dateNumber);
            dateItem.appendChild(dateDay);
            dateCalendar.appendChild(dateItem);

            dateItem.dataset.day = String(d.getDate());
            dateItem.dataset.month = String(d.getMonth() + 1);
            dateItem.dataset.year = String(d.getFullYear());
        }

        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
        selectedDateEl.textContent = todayFormatted;

        // Ensure "today" is selected and shown
        const todayItem = Array.from(dateCalendar.querySelectorAll('.date-item'))
            .find(item =>
                parseInt(item.dataset.day) === today.getDate() &&
                parseInt(item.dataset.month) === today.getMonth() + 1 &&
                parseInt(item.dataset.year) === today.getFullYear()
            );

        // Show today's chip at the LEFT edge (no page jump)
        const scroller = dateCalendar; // the actual overflow-x container
        if (todayItem && scroller) {
            requestAnimationFrame(() => {
                scroller.scrollTo({ left: todayItem.offsetLeft, behavior: 'auto' });
            });
        }

        // Update details immediately
        updateLiturgyDetails();

        setTimeout(updateLiturgyDetails, 100);
    }
    generateDates();

    document.addEventListener('click', (e) => {
        if (e.target.closest('.date-item')) {
            const clickedItem = e.target.closest('.date-item');
            const selectedDateEl = document.querySelector('.selected-date');
            document.querySelectorAll('.date-item').forEach(d => d.classList.remove('selected'));
            clickedItem.classList.add('selected');

            const day = parseInt(clickedItem.dataset.day);
            const month = parseInt(clickedItem.dataset.month);
            const year = parseInt(clickedItem.dataset.year);

            const formattedDate = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
            if (selectedDateEl) selectedDateEl.textContent = formattedDate;
            updateLiturgyDetails();
        }
    });

    function updateLiturgyDetails() {
        const personNameEl = document.querySelector('.person-name');
        const serviceInfoEl = document.querySelector('.service-info');
        const profileNameEl = document.querySelector('.profile-name');
        const selectedChurchEl = document.querySelector('.church-btn.selected');
        const selectedDateEl = document.querySelector('.selected-date');

        if (personNameEl && profileNameEl) {
            personNameEl.textContent = profileNameEl.textContent;
        }
        if (serviceInfoEl && selectedChurchEl && selectedDateEl) {
            const churchName = selectedChurchEl.textContent;
            const selectedDate = selectedDateEl.textContent;
            serviceInfoEl.textContent = `Божественна Літургія за упокій відбудеться у ${churchName}, ${selectedDate} р.`;
        }
    }

    const churchBtns = document.querySelectorAll('.church-btn');
    churchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            churchBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateLiturgyDetails();
        });
    });

    const donationBtns = document.querySelectorAll('.donation-btn');
    donationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            donationBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    const liturgySubmitBtn = document.querySelector('.liturgy-submit');
    liturgySubmitBtn?.addEventListener('click', () => {
        const selectedDate = document.querySelector('.selected-date')?.textContent || '';
        const selectedChurch = document.querySelector('.church-btn.selected')?.textContent || '';
        const selectedDonation = document.querySelector('.donation-btn.selected')?.textContent || '';

        console.log('Liturgy request:', { personId, date: selectedDate, church: selectedChurch, donation: selectedDonation });
        alert('Записка надіслана до церкви!');
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Comments (sample), Relatives (sample) – unchanged
    // ─────────────────────────────────────────────────────────────────────────────
    // Template → enter user name → create comment → PUT
    (function hookCommentTemplates() {
        const overlay = document.getElementById('modal-overlay');
        const dlg = document.getElementById('comment-template-modal');
        const closeX = document.getElementById('comment-template-close');
        const cancelBtn = document.getElementById('comment-template-cancel');
        const okBtn = document.getElementById('comment-template-ok');
        const nameInput = document.getElementById('comment-user-input');

        const open = () => { overlay.hidden = false; dlg.hidden = false; nameInput.value = ''; nameInput.focus(); };
        const close = () => { overlay.hidden = true; dlg.hidden = true; };

        [closeX, cancelBtn, overlay].forEach(el => el && el.addEventListener('click', close));

        // Click on a template opens modal
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                dlg.dataset.templateText = btn.textContent || '';
                open();
            });
        });

        // Confirm → create + PUT
        okBtn?.addEventListener('click', async () => {
            const author = (nameInput.value || '').trim();
            const text = dlg.dataset.templateText || '';
            if (!author || !text) { nameInput.focus(); return; }

            // dd.mm.yyyy
            const d = new Date();
            const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

            // optimistic update
            comments = Array.isArray(comments) ? comments : [];
            comments.push({ author, date, text });
            renderComments();

            try {
                const res = await fetch(`${API_BASE}/${personId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comments })
                });
                if (!res.ok) throw new Error(res.statusText);
            } catch (e) {
                alert('Не вдалося оновити коментарі.');
                console.error(e);
            } finally {
                close();
            }
        });
    })();

    function loadRelatives() {
        const relativesListEl = document.querySelector('.relatives-list');
        if (!relativesListEl) return;

        const relatives = [
            { id: 1, name: 'Кравчук Леонід Макарович', years: '1975 - 2000', relationship: 'Батько', avatarUrl: 'https://i.stopcor.org/person/2022/5/31/farion.jpeg?size=1000x1000' },
            { id: 2, name: 'Фаріон Ірина Олегівна', years: '1982 - 2012', relationship: 'Мати', avatarUrl: 'https://i.stopcor.org/person/2022/5/31/farion.jpeg?size=1000x1000' },
            { id: 3, name: 'Кенседі Валерій Петрович', years: '1982 - 2012', relationship: 'Брат', avatarUrl: 'https://i.stopcor.org/person/2022/5/31/farion.jpeg?size=1000x1000' }
        ];

        relativesListEl.innerHTML = '';
        relatives.forEach(relative => {
            const relativeEl = document.createElement('div');
            relativeEl.className = 'relative-item';
            // inside loadRelatives() when building each relativeEl:
            relativeEl.innerHTML = `
                <img class="relative-avatar" src="${relative.avatarUrl}" alt="${relative.name}">
                <div class="relative-info">
                <h3 class="relative-name">${relative.name}</h3>
                <div class="relative-meta">
                    <p class="relative-details">${relative.years}</p>
                    <span class="relative-relationship">${relative.relationship}</span>
                </div>
                </div>
            `;
            relativeEl.addEventListener('click', () => {
                window.location.href = `profile.html?personId=${relative.id}`;
            });
            relativesListEl.appendChild(relativeEl);
        });

        document.getElementById('add-relative-btn')?.addEventListener('click', () => {
            window.location.href = `add-relative.html?personId=${personId}`;
        });
        document.getElementById('choose-relative-btn')?.addEventListener('click', () => {
            window.location.href = `choose-relative.html?personId=${personId}`;
        });
    }

    // Handle click "Увійти" – same UX as ritual_service pages
    document.getElementById('loginSubmit')?.addEventListener('click', () => {
        const login = document.getElementById('loginInput').value.trim();
        const pass = document.getElementById('passwordInput').value.trim();
        const errEl = document.getElementById('loginError');
        errEl.textContent = '';

        if (!premiumLock || !premiumCreds) {
            errEl.textContent = 'Авторизація недоступна';
            return;
        }

        if (login === premiumCreds.login && pass === premiumCreds.password) {
            // Persist a token – mirror ritual_service flow but scoped per person
            const tokenKey = `people_token_${personId}`;
            localStorage.setItem(tokenKey, btoa(`${personId}:${Date.now()}`));

            // Redirect to edit page (token read there)
            window.location.href = `/profile_edit.html?personId=${personId}`;
        } else {
            errEl.textContent = 'Невірний логін або пароль';
        }
    });

    loadRelatives();
});
