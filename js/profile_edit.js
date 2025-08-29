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

    // If user is not logged-in, bounce back to public profile
    if (!token) {
        window.location.replace(`/profile.html?personId=${encodeURIComponent(personId)}`);
        return;
    }

    // Enable "Вийти"
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem(tokenKey);
        window.location.replace(`/profile.html?personId=${encodeURIComponent(personId)}`);
    });

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

    // ─── Shared album (edit) ───
    const sharedMenuBtn = document.getElementById('shared-menu-btn');
    const sharedMenu = document.getElementById('shared-menu');
    const sharedListEl = document.querySelector('.shared-list');
    const sharedAddBtn = document.getElementById('shared-add-btn');
    const sharedDeleteBtn = document.getElementById('shared-delete-btn');
    const sharedInput = document.getElementById('shared-input');

    // Create inline "Скасувати" (appears next to red "Видалити" when selecting)
    let sharedCancelBtn = document.getElementById('shared-cancel-btn');
    if (!sharedCancelBtn) {
        const controls = document.querySelector('.profile-shared .shared-controls');
        if (controls) {
            sharedCancelBtn = document.createElement('button');
            sharedCancelBtn.id = 'shared-cancel-btn';
            sharedCancelBtn.className = 'btn photo-btn';
            sharedCancelBtn.textContent = 'Скасувати';
            sharedCancelBtn.style.display = 'none';
            controls.insertBefore(sharedCancelBtn, sharedDeleteBtn); // show before the red delete
        }
    }

    sharedCancelBtn?.addEventListener('click', () => {
        sharedSelecting = false;
        sharedSelectedOrder = [];
        document.querySelector('.profile-shared')?.classList.remove('selection-mode');

        // Restore dots; hide inline controls
        if (sharedMenuBtn) sharedMenuBtn.style.display = 'inline-flex';
        if (sharedDeleteBtn) sharedDeleteBtn.style.display = 'none';
        if (sharedCancelBtn) sharedCancelBtn.style.display = 'none';

        refreshSharedUI();
    });

    // Dots popup options (if present)
    document.getElementById('bio-edit-option')?.addEventListener('click', () => bioEditBtn?.click());
    document.getElementById('photos-add-option')?.addEventListener('click', () => addPhotoBtn?.click());
    document.getElementById('photos-choose-option')?.addEventListener('click', () => choosePhotoBtn?.click());
    document.getElementById('photos-delete-option')?.addEventListener('click', () => deletePhotoBtn?.click());

    // dots options
    document.getElementById('shared-add-option')?.addEventListener('click', () => sharedAddBtn?.click());
    document.getElementById('shared-choose-option')?.addEventListener('click', () => {
        // Enter selection mode
        sharedSelecting = true;
        document.querySelector('.profile-shared')?.classList.add('selection-mode');

        // Close the popup and switch controls to inline "Скасувати" + "Видалити"
        sharedMenu?.classList.remove('show');
        if (sharedMenuBtn) sharedMenuBtn.style.display = 'none';
        if (sharedDeleteBtn) sharedDeleteBtn.style.display = 'inline-block';
        if (sharedCancelBtn) sharedCancelBtn.style.display = 'inline-block';

        refreshSharedUI();
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
    let photos = [];                 // profile photos (urls and temporary blob: urls)
    let isSelecting = false;         // selection mode for photos
    let selectedOrder = [];          // array of indexes of selected photos (in click order)
    let pendingUploads = 0;
    let comments = [];  // profile comments array
    let sharedPending = []; // pending (буде першим у рендері)
    let sharedPhotos = []; // прийняті
    let sharedSelecting = false;
    let sharedSelectedOrder = [];

    const nonBlobPhotos = () =>
        (photos || []).filter((u) => typeof u === 'string' && u && !u.startsWith('blob:'));
    const toPhotoObj = (p) =>
        typeof p === 'string' ? { url: p, description: '' } : { url: p.url, description: p.description || '' };
    const realPhotos = () => (photos || []).filter(p => typeof p?.url === 'string' && !p.url.startsWith('blob:'));
    function isBlob(u) { return typeof u === 'string' && u.startsWith('blob:'); }

    // ─────────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────────
    function toggleSelectShared(idx, isPending) {
        if (isPending) return; // pending не вибираємо
        const pos = sharedSelectedOrder.indexOf(idx);
        if (pos > -1) sharedSelectedOrder.splice(pos, 1); else sharedSelectedOrder.push(idx);
        refreshSharedUI();
        sharedDeleteBtn.textContent = `Видалити (${sharedSelectedOrder.length})`;
    }

    // збереження (PUT у ваш /api/people/:id)
    async function saveSharedAlbum() {
        try {
            const body = JSON.stringify({
                sharedPending: sharedPending.map(p => ({ url: p.url })),
                sharedPhotos: sharedPhotos.map(p => ({ url: p.url, description: p.description || '' }))
            });
            const res = await fetch(`${API_BASE}/${personId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
            if (!res.ok) throw new Error(res.statusText);
        } catch (e) {
            console.error('Failed to save shared album', e);
            alert('Не вдалося зберегти спільний альбом.');
        }
    }

    // підтвердження/відхилення pending
    async function acceptPending(i) {
        const item = sharedPending[i]; if (!item) return;
        sharedPending.splice(i, 1); sharedPhotos.unshift({ url: item.url }); // accepted на початок accepted-масиву?
        await saveSharedAlbum(); refreshSharedUI();
    }

    async function declinePending(i) {
        sharedPending.splice(i, 1);
        await saveSharedAlbum(); refreshSharedUI();
    }

    // delete for accepted (selection)
    sharedDeleteBtn?.addEventListener('click', async () => {
        if (!sharedSelecting || sharedSelectedOrder.length === 0) { sharedSelecting = false; document.querySelector('.profile-shared')?.classList.remove('selection-mode'); refreshSharedUI(); return; }
        // видаляємо за індексами (у зворотньому порядку)
        [...sharedSelectedOrder].sort((a, b) => b - a).forEach(i => sharedPhotos.splice(i, 1));
        sharedSelectedOrder = [];
        await saveSharedAlbum();
        sharedSelecting = false;
        document.querySelector('.profile-shared')?.classList.remove('selection-mode');
        refreshSharedUI();
    });

    // рендер (pending завжди першими)
    function refreshSharedUI() {
        if (!sharedListEl) return;
        sharedListEl.innerHTML = '';
        const all = [...sharedPending.map(p => ({ ...p, _pending: true })), ...sharedPhotos.map(p => ({ ...p, _pending: false }))];

        sharedListEl.classList.remove('rows-1', 'rows-2');
        sharedListEl.classList.add('rows-1');

        all.forEach((p, visibleIdx) => {
            const li = document.createElement('li');
            const img = document.createElement('img'); img.src = p.url; li.appendChild(img);

            // uploading overlay для blob
            if (isBlob(p.url)) {
                li.classList.add('uploading');
                const hint = document.createElement('div'); hint.className = 'uploading-hint'; hint.textContent = 'Завантаження…';
                li.appendChild(hint);
            }

            if (p._pending) {
                // White circle X
                const close = document.createElement('button');
                close.className = 'shared-decline-x'; // new CSS class
                close.textContent = '✕';
                close.addEventListener('click', () => declinePending(visibleIdx));

                // Confirm button bottom-center
                const acceptBtn = document.createElement('button');
                acceptBtn.className = 'shared-accept';
                acceptBtn.textContent = 'Підтвердити';
                acceptBtn.addEventListener('click', () => acceptPending(visibleIdx));

                li.append(close, acceptBtn);
            } else {
                // Accepted: режим вибору
                if (sharedSelecting) {
                    li.classList.add('selected');
                    li.addEventListener('click', () => toggleSelectShared(visibleIdx - sharedPending.length, false));
                } else {
                    li.addEventListener('click', () => {
                        // показ слайдшоу тільки для accepted (як у звичайних фото)
                        const images = sharedPhotos.map(x => x.url);
                        const idx = images.indexOf(p.url);
                        openSlideshow(images, Math.max(0, idx));
                    });
                }
            }

            // Controls visibility for shared section
            const hasAnyShared = (sharedPending.length + sharedPhotos.length) > 0;

            // inline buttons
            if (sharedDeleteBtn) sharedDeleteBtn.style.display = sharedSelecting ? 'inline-block' : 'none';
            if (sharedCancelBtn) sharedCancelBtn.style.display = sharedSelecting ? 'inline-block' : 'none';

            // dots only when NOT selecting and there are items
            if (sharedMenuBtn) sharedMenuBtn.style.display = (!sharedSelecting && hasAnyShared) ? 'inline-flex' : 'none';

            // never show inline "Добавити" unless the album is empty (your requirement)
            if (sharedAddBtn) sharedAddBtn.style.display = hasAnyShared ? 'none' : 'inline-flex';

            sharedListEl.appendChild(li);
        });

        // керування видимістю контролів
        const hasAny = (sharedPending.length + sharedPhotos.length) > 0;
        // інлайнові кнопки ховаємо завжди (кнопка delete зʼявляється лише у selection-mode)
        if (sharedDeleteBtn) sharedDeleteBtn.style.display = sharedSelecting ? 'inline-block' : 'none';
        if (sharedMenuBtn) sharedMenuBtn.style.display = hasAny ? 'inline-flex' : 'none';
    }

    // додавання від редагування (залогінений теж може “додати” як гість → летить у pending)
    sharedAddBtn?.addEventListener('click', () => sharedInput?.click());
    sharedInput?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []); if (!files.length) return;
        const start = sharedPending.length;
        const previews = files.map(f => URL.createObjectURL(f));
        previews.forEach(url => sharedPending.push({ url }));
        refreshSharedUI(); sharedInput.value = '';

        for (let i = 0; i < files.length; i++) {
            try {
                const hosted = await uploadToImgBB(files[i]);
                sharedPending[start + i] = { url: hosted };
                refreshSharedUI();
                // (опційно) одразу збережемо pending на бекенді
                await saveSharedAlbum();
            } catch (err) {
                console.error('Shared upload failed', err);
                sharedPending.splice(start + i, 1);
                refreshSharedUI();
                alert('Не вдалося додати фото до спільного альбому.');
            }
        }
    });

    function updateDeleteButtonLabel() {
        if (!deletePhotoBtn) return;
        deletePhotoBtn.textContent = `Видалити (${selectedOrder.length})`;
    }

    function exitSelectionMode() {
        isSelecting = false;
        selectedOrder = [];
        document.querySelector('.profile-photos')?.classList.remove('selection-mode');
        // Restore proper state (dots if photos exist, inline only if empty)
        refreshPhotosUI()
    }

    function enterSelectionMode() {
        if (isSelecting || photos.length === 0) return;
        isSelecting = true;
        document.querySelector('.profile-photos')?.classList.add('selection-mode');
        updateDeleteButtonLabel();
        // Switch to selection UI (inline Cancel + Delete, dots hidden)
        refreshPhotosUI();
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

            // Caption with “… більше/менше” toggle, only if there is text
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

                // Show toggle only when text is truncated; then expand/collapse
                requestAnimationFrame(() => {
                    const overflowing = span.scrollHeight > span.clientHeight + 1;
                    if (overflowing) {
                        cap.classList.add('has-toggle');
                        toggle.addEventListener('click', () => {
                            const expanded = cap.classList.toggle('expanded');
                            toggle.textContent = expanded ? 'менше' : '… більше';
                        });
                    } else {
                        toggle.remove();
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
            indicator.querySelectorAll('.slideshow-indicator')
                .forEach((dot, i) => dot.classList.toggle('active', i === index));
        }
        function changeSlide(newIndex) {
            const slides = track.querySelectorAll('.slideshow-slide');
            if (slides[newIndex]) slides[newIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' });
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
        photosListEl.innerHTML = '';
        photosListEl.classList.remove('rows-1', 'rows-2');
        photosScrollEl?.querySelector('.photos-empty')?.remove();

        const hasPhotos = photos.length > 0;

        // (4), (5), (6) implement visibility here:
        setPhotosControlsVisibility_PROFILE({ isSelecting, hasPhotos });

        if (!hasPhotos) {
            photosListEl.style.display = 'none';
            const empty = document.createElement('div');
            empty.className = 'photos-empty';
            empty.textContent = 'Немає фотографій. Будь ласка, поділіться спогадами';
            photosScrollEl?.appendChild(empty);
            return;
        }

        photosListEl.style.display = '';
        photosListEl.classList.add(photos.length === 1 ? 'rows-1' : 'rows-2');

        // render items
        photos.forEach((p, idx) => {
            const li = document.createElement('li');
            li.dataset.index = String(idx);

            const img = document.createElement('img');
            img.src = p.url;

            // If this is a local preview (blob:), show uploading overlay + hint
            if (typeof p.url === 'string' && p.url.startsWith('blob:')) {
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
                    const images = realPhotos().map(pp => pp.url);
                    const captions = realPhotos().map(pp => pp.description || '');
                    const safeIndex = Math.max(0, images.indexOf(p.url));
                    openSlideshow(images.length ? images : [p.url], images.length ? safeIndex : 0, images.length ? captions : [p.description || '']);
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

    async function uploadToImgBB(file) {
        const form = new FormData();
        form.append('image', file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: form
        });
        const json = await res.json();
        if (!json.success) throw new Error('Upload failed');
        return json.data.url; // hosted image URL
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
                // Remove selected in descending order
                const toDelete = [...selectedOrder].sort((a, b) => b - a);
                toDelete.forEach(i => {
                    if (i >= 0 && i < photos.length) {
                        const u = photos[i];
                        // if (u?.startsWith('blob:')) { try { URL.revokeObjectURL(u); } catch { } }
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
            if (fileInput)
                fileInput.addEventListener('change', async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;

                    // 0) Додаємо МИТТЄВІ превʼю в photos
                    const startIndex = photos.length;
                    const previews = files.map(f => URL.createObjectURL(f));
                    const tempCaptions = new Array(previews.length).fill('');

                    previews.forEach((url) => {
                        photos.push({ url, description: '' /* тимчасово */, _temp: true });
                    });
                    refreshPhotosUI();  // покаже ліст із класом .uploading для blob:
                    // ↓ відкриваємо степпер описів як і раніше
                    const overlay = document.getElementById('modal-overlay');
                    const dlg = document.getElementById('photo-desc-modal');
                    const closeX = document.getElementById('photo-desc-close');
                    const prevBtn = document.getElementById('photo-desc-prev');
                    const nextBtn = document.getElementById('photo-desc-next');
                    const previewEl = document.getElementById('photo-desc-preview');
                    const textEl = document.getElementById('photo-desc-text');
                    const counterEl = document.getElementById('photo-desc-counter');

                    let step = 0; const total = previews.length;
                    const open = () => { overlay.hidden = false; dlg.hidden = false; };
                    const close = () => { overlay.hidden = true; dlg.hidden = true; };

                    function renderStep() {
                        previewEl.src = previews[step];
                        textEl.value = tempCaptions[step] || '';
                        counterEl.textContent = `Фото ${step + 1} з ${total}`;
                        prevBtn.style.display = step === 0 ? 'none' : '';
                        nextBtn.textContent = step === total - 1 ? 'Готово' : 'Далі';
                    }
                    function commitCurrent() { tempCaptions[step] = (textEl.value || '').trim(); }

                    closeX.onclick = () => { commitCurrent(); close(); };
                    prevBtn.onclick = () => { commitCurrent(); step = Math.max(0, step - 1); renderStep(); };
                    nextBtn.onclick = () => { commitCurrent(); if (step < total - 1) { step++; renderStep(); } else close(); };

                    open(); renderStep();

                    // чекаємо, поки користувач закриє діалог
                    await new Promise((resolve) => {
                        const iv = setInterval(() => { if (dlg.hidden) { clearInterval(iv); resolve(); } }, 60);
                    });

                    // 1) Асинхронно вантажимо на ImgBB та замінюємо blob → hosted URL
                    async function uploadToImgBB(file) {
                        const form = new FormData();
                        form.append('image', file);
                        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: form });
                        const json = await res.json();
                        if (!json.success) throw new Error('Upload failed');
                        return json.data.url;
                    }

                    for (let i = 0; i < files.length; i++) {
                        const listIndex = startIndex + i; // позиція тимчасового елемента в photos
                        try {
                            const hostedUrl = await uploadToImgBB(files[i]);
                            // звільняємо blob і підміняємо на фінальний обʼєкт
                            try { URL.revokeObjectURL(previews[i]); } catch { }
                            const desc = tempCaptions[i] || '';
                            photos[listIndex] = { url: hostedUrl, description: desc }; // прибираємо _temp
                            refreshPhotosUI(); // оновимо картку (зникне оверлей "Завантаження…")
                        } catch (err) {
                            console.error('Upload failed for', files[i].name, err);
                            alert(`Не вдалося завантажити фото ${files[i].name}`);
                            // видаляємо зірване превʼю
                            photos.splice(listIndex, 1);
                            refreshPhotosUI();
                        }
                    }

                    // 2) Зберігаємо профіль уже з hosted URL’ами
                    await saveProfilePhotos();
                    e.target.value = '';
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

                console.log(clampPx, maxPx);

                commentsListEl.style.maxHeight = `${maxPx}px`;
                commentsListEl.style.overflowY = 'auto';
            });
        }
    }

    function setBioControlsVisibility(fullBio) {
        const bioButtons = document.querySelector('.profile-bio .bio-buttons');
        const bioAddBtn = document.getElementById('bio-add');
        const bioEditBtn = document.getElementById('bio-edit');
        const bioMenuBtn = document.getElementById('bio-menu-btn');

        if (!bioButtons) return;

        if (!fullBio.trim()) {
            bioAddBtn?.classList.add('show');
            bioEditBtn?.classList.remove('show');
            bioMenuBtn?.style && (bioMenuBtn.style.display = 'none');
        } else {
            bioAddBtn?.classList.remove('show');
            bioEditBtn?.classList.remove('show');
            bioMenuBtn?.style && (bioMenuBtn.style.display = 'inline-flex');
        }
    }

    function setPhotosControlsVisibility_PROFILE(spec = { isSelecting: false, hasPhotos: false }) {
        const controls = document.querySelector('.profile-photos .photos-controls');
        const dotsBtn = document.getElementById('photos-menu-btn');
        const chooseBtn = document.getElementById('choose-photo-btn');
        const delBtn = document.getElementById('delete-photo-btn');
        const addBtn = document.getElementById('add-photo-btn');

        if (!controls) return;

        // (4) No photos → show empty text elsewhere + ONLY "Додати" in controls; hide dots
        if (!spec.hasPhotos) {
            controls.style.display = 'flex';
            addBtn && (addBtn.style.display = '');
            chooseBtn && (chooseBtn.style.display = 'none');
            delBtn && (delBtn.style.display = 'none');
            dotsBtn && (dotsBtn.style.display = 'none');
            return;
        }

        // (6) Selecting → show "Скасувати" + red "Видалити (count)" in controls; hide dots
        if (spec.isSelecting) {
            controls.style.display = 'flex';
            addBtn && (addBtn.style.display = 'none');
            chooseBtn && (chooseBtn.style.display = '');
            chooseBtn && (chooseBtn.textContent = 'Скасувати');
            delBtn && (delBtn.style.display = 'inline-block');
            dotsBtn && (dotsBtn.style.display = 'none');
            return;
        }

        // (5) Has photos + not selecting → show dots with "Вибрати" і "Добавити"; hide inline controls
        controls.style.display = 'none';
        dotsBtn && (dotsBtn.style.display = 'inline-flex');
    }

    function setRelativesControlsVisibility(hasRelatives) {
        const relControls = document.querySelector('.profile-relatives .relatives-controls');
        const relDots = document.getElementById('rel-menu-btn');
        if (!relControls) return;

        // (8) No relatives → empty text elsewhere + ONLY "Додати" button; hide dots
        if (!hasRelatives) {
            relControls.style.display = 'flex';
            document.getElementById('add-relative-btn')?.style && (document.getElementById('add-relative-btn').style.display = 'inline-block');
            document.getElementById('choose-relative-btn')?.style && (document.getElementById('choose-relative-btn').style.display = 'none');
            relDots && (relDots.style.display = 'none');
            return;
        }

        // (9) Has relatives → hide inline controls; show dots menu with "Додати" + "Вибрати"
        relControls.style.display = 'none';
        relDots && (relDots.style.display = 'inline-flex');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Load person
    // ─────────────────────────────────────────────────────────────────────────────
    (async () => {
        try {
            const res = await fetch(`${API_BASE}/${personId}`);
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();

            // ─── COMMENTS ───
            comments = Array.isArray(data.comments) ? data.comments : [];
            renderComments();

            // ─── AVATAR / HERO ───
            if (avatarEl) avatarEl.src = data.avatarUrl || 'img/default-avatar.jpg';
            if (heroEl && data.backgroundUrl) {
                heroEl.style.backgroundImage = `url(${data.backgroundUrl})`;
            }

            // ─── NAME / YEARS / CEMETERY ───
            if (nameEl) nameEl.textContent = data.name || '';
            if (yearsEl) {
                yearsEl.textContent = `${data.birthDate || ''} ${data.birthYear || ''} – ${data.deathDate || ''} ${data.deathYear || ''}`.trim();
            }
            if (cemeteryEl) cemeteryEl.textContent = (data.cemetery || '').split(', ')[0] || '';

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
            const bioBtnsWrap = document.querySelector('.profile-bio .bio-buttons');
            bioBodyWrap?.querySelector('.bio-empty')?.remove();

            if (!fullBio.trim()) {
                // empty-state UI
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

                // show ONLY "Додати"
                if (bioBtnsWrap) bioBtnsWrap.style.display = 'flex';
                if (bioAddBtn) {
                    bioAddBtn.style.display = 'inline-flex';
                    bioAddBtn.classList.add('show');
                }
                if (bioEditBtn) bioEditBtn.classList.remove('show');
                if (bioMenuBtn) bioMenuBtn.style.display = 'none';
            } else {
                // has bio
                if (bioContentEl) {
                    bioContentEl.style.display = '';
                    bioContentEl.textContent = fullBio;
                }
                bioToggleEl?.remove();
                const isOverflowing = bioContentEl && (bioContentEl.scrollHeight > bioContentEl.clientHeight);
                if (isOverflowing && bioContentEl && bioToggleEl) {
                    bioContentEl.appendChild(bioToggleEl);
                    bioToggleEl.style.display = 'inline';
                    bioToggleEl.textContent = '... більше';
                    bioContentEl.style.paddingRight = '0.1rem';
                    bioToggleEl.addEventListener('click', () => {
                        const expanded = bioContentEl.classList.toggle('expanded');
                        bioToggleEl.textContent = expanded ? 'менше' : '... більше';
                    });
                }

                if (bioBtnsWrap) bioBtnsWrap.style.display = 'none';
                if (bioAddBtn) bioAddBtn.classList.remove('show');
                if (bioEditBtn) bioEditBtn.classList.remove('show');
                if (bioMenuBtn) bioMenuBtn.style.display = 'inline-flex';
            }

            function enterBioEdit() {
                const bioBody = document.querySelector('.profile-bio .bio-body');
                if (!bioBody) return;
                bioBody.innerHTML = `<textarea id="bio-editor" placeholder="Додайте життєпис...">${fullBio || ''}</textarea>`;

                const btnsWrap = document.querySelector('.profile-bio .bio-buttons');
                if (btnsWrap) {
                    btnsWrap.style.display = 'flex';
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
                    bioMenuBtn && (bioMenuBtn.style.display = 'none');

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
            document.getElementById('bio-edit-option')?.addEventListener('click', () => {
                document.getElementById('bio-menu')?.classList.add('hidden');
                enterBioEdit();
            });

            // ─── PHOTOS (звичайні) ───
            photos = Array.isArray(data.photos) ? data.photos.filter(Boolean) : [];
            hookPhotoButtons();
            refreshPhotosUI();

            // ──────────────────────────────────────────────────────────────
            // SHARED ALBUM (edit page) – pending + accepted
            // ──────────────────────────────────────────────────────────────
            const sharedSection = document.querySelector('.profile-shared');
            if (sharedSection && data.premium) {
                sharedSection.removeAttribute('hidden');

                sharedPending = Array.isArray(data.sharedPending)
                    ? data.sharedPending.filter(p => p && typeof p.url === 'string' && p.url.trim())
                    : [];
                sharedPhotos = Array.isArray(data.sharedPhotos)
                    ? data.sharedPhotos.filter(p => p && typeof p.url === 'string' && p.url.trim())
                    : [];

                // тут для редактора доступні всі функції: accept/decline pending, вибір accepted
                typeof refreshSharedUI === 'function' && refreshSharedUI();
            } else if (sharedSection) {
                sharedSection.setAttribute('hidden', 'hidden');
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

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);

            const dateItem = document.createElement('div');
            dateItem.className = 'date-item' + (i === 0 ? ' selected' : '');

            const dateNumber = document.createElement('span');
            dateNumber.className = 'date-number';
            dateNumber.textContent = date.getDate();

            const dateDay = document.createElement('span');
            dateDay.className = 'date-day';
            dateDay.textContent = dayNames[date.getDay()];

            dateItem.appendChild(dateNumber);
            dateItem.appendChild(dateDay);
            dateCalendar.appendChild(dateItem);

            dateItem.dataset.day = String(date.getDate());
            dateItem.dataset.month = String(date.getMonth() + 1);
            dateItem.dataset.year = String(date.getFullYear());
        }

        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
        selectedDateEl.textContent = todayFormatted;

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
        const list = document.querySelector('.relatives-list');
        if (!list) return;

        // TODO: replace with API in future
        const relatives = []; // ← set [] to see empty-state; or keep your sample array

        list.innerHTML = '';

        const hasRel = Array.isArray(relatives) && relatives.length > 0;

        if (!hasRel) {
            // (8) Empty message
            const empty = document.createElement('div');
            empty.className = 'relatives-empty';
            empty.textContent = 'Родичів ще не додано';
            list.appendChild(empty);
            setRelativesControlsVisibility(false);
            // Only "Добавити" works:
            document.getElementById('add-relative-btn')?.addEventListener('click', () => {
                window.location.href = `add-relative.html?personId=${personId}`;
            });
            return;
        }

        // Render relatives
        relatives.forEach(r => {
            const el = document.createElement('div');
            el.className = 'relative-item';
            el.innerHTML = `
            <img class="relative-avatar" src="${r.avatarUrl}" alt="${r.name}">
            <div class="relative-info">
              <h3 class="relative-name">${r.name}</h3>
              <p class="relative-details">${r.years}</p>
            </div>
            <span class="relative-relationship">${r.relationship}</span>
          `;
            el.addEventListener('click', () => {
                window.location.href = `profile.html?personId=${r.id}`;
            });
            list.appendChild(el);
        });

        // (9) Has relatives → dots menu shows "Добавити" + "Вибрати"
        setRelativesControlsVisibility(true);

        // Wire inline controls if user chooses to show them later
        document.getElementById('add-relative-btn')?.addEventListener('click', () => {
            window.location.href = `add-relative.html?personId=${personId}`;
        });
        document.getElementById('choose-relative-btn')?.addEventListener('click', () => {
            window.location.href = `choose-relative.html?personId=${personId}`;
        });
    }

    loadRelatives();
});
