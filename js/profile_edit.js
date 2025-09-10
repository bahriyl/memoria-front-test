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

    const from = params.get('from');
    const backBtn = document.querySelector('.back-button');

    if (from === 'premium') {
        backBtn.setAttribute('href', 'premium_qr_person.html');
    } else {
        backBtn.setAttribute('href', 'index.html');
    }

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

        // Merge pending (first) + accepted (second)
        const all = [
            ...sharedPending.map(p => ({ ...p, _pending: true })),
            ...sharedPhotos.map(p => ({ ...p, _pending: false }))
        ];

        // Arrays for slideshow (match visible order)
        const allUrls = all.map(p => p.url);
        const allCaptions = all.map(p => p.description || '');

        sharedListEl.classList.remove('rows-1', 'rows-2');
        sharedListEl.classList.add('rows-1');

        all.forEach((p, visibleIdx) => {
            const li = document.createElement('li');
            const img = document.createElement('img');
            img.src = p.url;

            // Badge (like Location)
            const badge = document.createElement('span');
            badge.className = 'select-badge';

            // Blob overlay (uploading)
            if (isBlob(p.url)) {
                li.classList.add('uploading');
                const hint = document.createElement('div');
                hint.className = 'uploading-hint';
                hint.textContent = 'Завантаження…';
                li.appendChild(hint);
            }

            if (p._pending) {
                // Pending items are NOT selectable; show close + accept
                const close = document.createElement('button');
                close.className = 'shared-decline-x';
                close.setAttribute('aria-label', 'Відхилити фото');
                close.innerHTML = `
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>`;
                close.addEventListener('click', (e) => { e.stopPropagation(); declinePending(visibleIdx); });

                const acceptBtn = document.createElement('button');
                acceptBtn.className = 'shared-accept';
                acceptBtn.textContent = 'Підтвердити';
                acceptBtn.addEventListener('click', (e) => { e.stopPropagation(); acceptPending(visibleIdx); });

                li.append(close, acceptBtn);
            } else {
                // ACCEPTED item → can be selected in selection mode
                li.classList.add('accepted');

                if (sharedSelecting) {
                    // map visibleIdx → accepted index
                    const acceptedIdx = visibleIdx - sharedPending.length;
                    const pos = sharedSelectedOrder.indexOf(acceptedIdx);
                    const isSel = pos > -1;

                    li.classList.toggle('is-selected', isSel);
                    badge.textContent = isSel ? String(pos + 1) : '';

                    li.addEventListener('click', () => toggleSelectShared(acceptedIdx, false));
                }
            }

            // Slideshow on ANY tile when not selecting
            if (!sharedSelecting) {
                li.addEventListener('click', () => {
                    openSlideshow(allUrls, visibleIdx, allCaptions);
                });
            }

            li.append(img, badge);
            sharedListEl.appendChild(li);
        });

        // Controls visibility for shared section
        const hasAnyShared = (sharedPending.length + sharedPhotos.length) > 0;
        if (sharedDeleteBtn) sharedDeleteBtn.style.display = sharedSelecting ? 'inline-block' : 'none';
        if (sharedCancelBtn) sharedCancelBtn.style.display = sharedSelecting ? 'inline-block' : 'none';
        if (sharedMenuBtn) sharedMenuBtn.style.display = (!sharedSelecting && hasAnyShared) ? 'inline-flex' : 'none';
        if (sharedAddBtn) sharedAddBtn.style.display = hasAnyShared ? 'none' : 'inline-flex';
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

        // reset container
        photosListEl.innerHTML = '';
        photosListEl.classList.remove('rows-1', 'rows-2');
        photosScrollEl?.querySelector('.photos-empty')?.remove();

        const hasPhotos = photos.length > 0;

        // visibility of controls (your existing helper)
        setPhotosControlsVisibility_PROFILE({ isSelecting, hasPhotos });

        // empty state
        if (!hasPhotos) {
            photosListEl.style.display = 'none';
            const empty = document.createElement('div');
            empty.className = 'photos-empty';
            empty.textContent = 'Немає фотографій. Будь ласка, поділіться спогадами';
            photosScrollEl?.appendChild(empty);
            return;
        }

        photosListEl.style.display = '';
        photosListEl.classList.add(photos.length <= 5 ? 'rows-1' : 'rows-2');

        // render items
        photos.forEach((p, idx) => {
            const li = document.createElement('li');
            li.dataset.index = String(idx);

            const img = document.createElement('img');
            img.src = p.url;

            // uploading overlay for local previews
            if (typeof p.url === 'string' && p.url.startsWith('blob:')) {
                li.classList.add('uploading');
                const hint = document.createElement('div');
                hint.className = 'uploading-hint';
                hint.textContent = 'Завантаження…';
                li.appendChild(hint);
            }

            // NEW: Location-style selection badge
            const badge = document.createElement('span');
            badge.className = 'select-badge';

            // reflect selection state + number
            const orderPos = selectedOrder.indexOf(idx);
            const isSel = orderPos > -1;
            li.classList.toggle('is-selected', isSel);
            li.classList.toggle('selected', isSel); // backward compat with older CSS
            badge.textContent = isSel ? String(orderPos + 1) : '';

            // click behavior (open slideshow vs select)
            li.addEventListener('click', () => {
                if (isSelecting) {
                    toggleSelectPhoto(idx);
                    return;
                }
                // slideshow: show only real uploaded photos
                const real = realPhotos();                              // [{url, description}, ...]
                const images = real.map(pp => pp.url);
                const captions = real.map(pp => pp.description || '');
                const start = Math.max(0, images.indexOf(p.url));
                openSlideshow(
                    images.length ? images : [p.url],
                    images.length ? start : 0,
                    images.length ? captions : [p.description || '']
                );
            });

            li.append(img, badge);
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

    // Robust parser for "DD.MM.YYYY" (e.g., "01.09.2025")
    function parseUaDate(d) {
        if (!d || typeof d !== 'string') return null;
        const m = d.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!m) return null;
        const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
        // basic bounds check
        if (!yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
        return new Date(yyyy, mm - 1, dd);
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

        // 2) Items — sort newest → oldest
        comments
            .slice()
            .sort((a, b) => {
                const da = parseUaDate(a?.date);
                const db = parseUaDate(b?.date);
                if (da && db) return db - da;          // newest → oldest
                if (db && !da) return 1;               // put valid dates first
                if (da && !db) return -1;
                return 0;                              // both invalid → keep relative order
            })
            .forEach(c => {
                const item = document.createElement('div');
                item.className = 'comment-item';
                item.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${c.author ?? ''}</span>
                    <span class="comment-date">${c.date ?? ''}</span>
                </div>
                <p class="comment-text">${c.text ?? ''}</p>
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

    if (cemeteryEl) {
        cemeteryEl.classList.add('clickable');
        cemeteryEl.addEventListener('click', () => {
            const name = cemeteryEl.textContent?.trim();
            if (name) {
                window.location.href = `cemetery.html?name=${encodeURIComponent(name)}`;
            }
        });
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
            if (avatarEl) avatarEl.src = data.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png';
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
            const bioBtnsWrap = document.querySelector('.profile-bio .bio-buttons');
            bioBodyWrap?.querySelector('.bio-empty')?.remove();

            function applyBio(text) {
                const LINES = 4;
                const moreLabel = 'більше';
                const lessLabel = 'менше';

                bioContentEl.classList.add('manual-clamp');
                bioContentEl.innerHTML = '';

                const textSpan = document.createElement('span');
                const nbsp = document.createTextNode('\u00A0');
                const toggle = document.createElement('span');
                toggle.className = 'bio-toggle';
                toggle.setAttribute('role', 'button');
                toggle.tabIndex = 0;

                const cs = getComputedStyle(bioContentEl);
                const line = parseFloat(cs.lineHeight) || (1.5 * parseFloat(cs.fontSize) || 21);
                const maxH = Math.round(LINES * line);

                // Quick path: fits within 4 lines → no toggle
                textSpan.textContent = text;
                bioContentEl.appendChild(textSpan);
                if (bioContentEl.clientHeight <= maxH + 1) return;

                // Measure height for "prefix + … + <toggle>"
                function heightForPrefix(prefixLen) {
                    bioContentEl.innerHTML = '';
                    textSpan.textContent = text.slice(0, prefixLen).trimEnd() + ' …';
                    toggle.textContent = moreLabel;
                    bioContentEl.append(textSpan, nbsp, toggle);
                    return bioContentEl.clientHeight;
                }

                // Binary search for the longest prefix that fits 4 lines
                let lo = 0, hi = text.length, best = 0;
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1;
                    if (heightForPrefix(mid) <= maxH + 1) { best = mid; lo = mid + 1; }
                    else { hi = mid - 1; }
                }

                // Final layout: trimmed text + toggle
                bioContentEl.innerHTML = '';
                textSpan.textContent = text.slice(0, best).trimEnd() + ' …';
                toggle.textContent = moreLabel;
                bioContentEl.append(textSpan, document.createTextNode('\u00A0'), toggle);

                // Expand/Collapse handlers
                let expanded = false;
                const expand = () => {
                    expanded = true;
                    bioContentEl.innerHTML = '';
                    textSpan.textContent = text + ' ';
                    toggle.textContent = lessLabel;
                    bioContentEl.append(textSpan, toggle);
                };
                const collapse = () => {
                    expanded = false;
                    applyBio(text); // recalculates to put toggle right at the end of the 4th line
                };
                const onToggle = () => (expanded ? collapse() : expand());

                toggle.addEventListener('click', onToggle);
                toggle.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
                });
            }

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
                if (bioContentEl) {
                    bioContentEl.style.display = '';
                    applyBio(fullBio.trim());
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
    // 2-row layout for comment templates (no holes)
    (function makeTwoRowTemplates() {
        const wrap = document.querySelector('.comment-templates');
        if (!wrap) return;

        const btns = Array.from(wrap.querySelectorAll('.template-btn'));
        if (btns.length < 2) return;

        // Створюємо трек з двома рядами
        const track = document.createElement('div');
        track.className = 'templates-track';
        const rowTop = document.createElement('div');
        rowTop.className = 'templates-row';
        const rowBottom = document.createElement('div');
        rowBottom.className = 'templates-row';

        // Розкладання “в змійку”: 1-ша вгорі, 2-га внизу, 3-тя вгорі, 4-та внизу…
        btns.forEach((btn, i) => (i % 2 === 0 ? rowTop : rowBottom).appendChild(btn));

        // Очищаємо контейнер і додаємо нову структуру
        wrap.textContent = '';
        track.append(rowTop, rowBottom);
        wrap.appendChild(track);
    })();

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
