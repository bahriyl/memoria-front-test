// js/profile.js

document.addEventListener('DOMContentLoaded', () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // Config
    // ─────────────────────────────────────────────────────────────────────────────
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
    const photosListEl = document.querySelector('.photos-list');
    const addPhotoBtn = document.getElementById('add-photo-btn');
    const choosePhotoBtn = document.getElementById('choose-photo-btn');
    const deletePhotoBtn = document.getElementById('delete-photo-btn');
    const fileInput = document.getElementById('photo-input'); // hidden <input type="file" multiple>, may be absent in older HTML
    const photosScrollEl = document.querySelector('.photos-scroll');

    // Dots popup options (if present)
    document.getElementById('bio-edit-option')?.addEventListener('click', () => bioEditBtn?.click());
    document.getElementById('photos-add-option')?.addEventListener('click', () => addPhotoBtn?.click());
    document.getElementById('photos-choose-option')?.addEventListener('click', () => choosePhotoBtn?.click());
    document.getElementById('photos-delete-option')?.addEventListener('click', () => deletePhotoBtn?.click());

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
    let premiumLock = false;
    let premiumCreds = null;

    const nonBlobPhotos = () =>
        (photos || []).filter((u) => typeof u === 'string' && u && !u.startsWith('blob:'));

    // ─────────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────────
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

    function openSlideshow(images, startIndex = 0) {
        // Same lightweight slideshow as location page
        const modal = document.createElement('div');
        modal.className = 'slideshow-modal';

        const closeBtnX = document.createElement('span');
        closeBtnX.textContent = '✕';
        closeBtnX.className = 'close-slideshow';
        closeBtnX.onclick = () => document.body.removeChild(modal);

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
        photos.forEach((url, idx) => {
            const li = document.createElement('li');
            li.dataset.index = String(idx);

            const img = document.createElement('img');
            img.src = url;

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
                    const onlyReal = nonBlobPhotos();
                    const realIndex = onlyReal.indexOf(url);
                    openSlideshow(onlyReal.length ? onlyReal : photos, Math.max(0, realIndex));
                }
            });

            li.append(img, overlay);
            photosListEl.appendChild(li);
        });

        if (photosMenuBtn) photosMenuBtn.style.visibility = isSelecting ? 'hidden' : 'visible';
    }

    async function saveProfilePhotos() {
        // Persist only non-blob URLs
        try {
            const body = JSON.stringify({ photos: nonBlobPhotos() });
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
                // Remove selected in descending order
                const toDelete = [...selectedOrder].sort((a, b) => b - a);
                toDelete.forEach(i => {
                    if (i >= 0 && i < photos.length) {
                        const u = photos[i];
                        if (u?.startsWith('blob:')) { try { URL.revokeObjectURL(u); } catch { } }
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
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;

                const previews = files.map((f) => URL.createObjectURL(f));

                // Show previews immediately
                previews.forEach((url) => photos.push(url));
                refreshPhotosUI();
                fileInput.value = '';

                // Upload each → replace blob with real URL, then persist
                pendingUploads += files.length;

                files.forEach(async (file, idx) => {
                    const previewUrl = previews[idx];
                    try {
                        const form = new FormData();
                        form.append('image', file);
                        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                            method: 'POST',
                            body: form,
                        });
                        const json = await res.json();
                        const realUrl = json?.data?.url;
                        const i = photos.indexOf(previewUrl);
                        if (i > -1 && realUrl) {
                            photos[i] = realUrl;
                            try { URL.revokeObjectURL(previewUrl); } catch { }
                            refreshPhotosUI();
                            // Save incrementally so the user doesn’t lose progress
                            await saveProfilePhotos();
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

            // PREMIUM lock
            premiumLock = !!data.premium;
            premiumCreds = data.premium || null;

            console.log(premiumLock);

            if (premiumLock) {
                // Show header with "Увійти" and hide every edit affordance
                document.getElementById('profile-login-header')?.removeAttribute('hidden');
                hideEditingUIForPremium();
                setupLoginModalOpenClose();
                // Defensive: if something prevented handler binding earlier, bind here again.
                const loginBtn = document.getElementById('profile-login-btn');
                const loginModal = document.getElementById('loginModal');
                const loginBox = loginModal?.querySelector('.login-box');
                if (loginBtn && loginModal && loginBox) {
                    const open = () => { loginModal.style.display = 'flex'; };
                    loginBtn.onclick = open;                 // direct binding
                    loginBox.onclick = (e) => e.stopPropagation();
                    loginModal.onclick = (e) => { if (!loginBox.contains(e.target)) loginModal.style.display = 'none'; };
                }
            }

            // COMMENTS: from API (may be empty or missing)
            comments = Array.isArray(data.comments) ? data.comments : [];
            renderComments();

            // Avatar & hero background
            if (avatarEl) avatarEl.src = data.avatarUrl || 'img/default-avatar.jpg';
            if (heroEl && data.backgroundUrl) {
                heroEl.style.backgroundImage = `url(${data.backgroundUrl})`;
            }

            // Name, years, cemetery
            if (nameEl) nameEl.textContent = data.name || '';
            if (yearsEl) {
                yearsEl.textContent = `${data.birthDate || ''} ${data.birthYear || ''} – ${data.deathDate || ''} ${data.deathYear || ''}`.trim();
            }
            if (cemeteryEl) cemeteryEl.textContent = (data.cemetery || '').split(', ')[0] || '';

            // Action button (view vs add location)
            if (data?.location?.[0]) {
                actionText.textContent = 'Локація місця поховання';
                locationBtn.href = `/location.html?personId=${personId}`;
            } else {
                actionText.textContent = 'Додати локацію місця поховання';
                locationBtn.href = `/location.html?personId=${personId}`;
            }

            // ─── BIO: render + toggle + edit buttons logic ───
            const fullBio = data.bio || '';

            // clean будь-який старий empty-state
            const bioBodyWrap = document.querySelector('.profile-bio .bio-body');
            bioBodyWrap?.querySelector('.bio-empty')?.remove();

            // 1) Якщо біо пусте → показати empty-state + сховати <p>
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
            } else {
                // 2) Якщо біо є → показати текст + toggle overflow
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
            }

            // 3) Логіка кнопок (лише якщо НЕ premium)
            if (!premiumLock) {
                if (!fullBio.trim()) {
                    bioAddBtn?.style && (bioAddBtn.style.display = 'inline-block');
                    bioEditBtn?.style && (bioEditBtn.style.display = 'none');
                    bioMenuBtn?.style && (bioMenuBtn.style.display = 'none');
                } else {
                    bioAddBtn?.style && (bioAddBtn.style.display = 'none');
                    bioEditBtn?.style && (bioEditBtn.style.display = 'inline-block');
                    bioMenuBtn?.style && (bioMenuBtn.style.display = 'inline-flex');
                }
            }

            // 4) Режим редагування (і коли пусте, і коли вже є)
            function enterBioEdit() {
                const bioBody = document.querySelector('.profile-bio .bio-body');
                if (!bioBody) return;
                bioBody.innerHTML = `
        <textarea id="bio-editor" placeholder="Додайте життєпис...">${fullBio || ''}</textarea>
    `;

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

                    cancel.addEventListener('click', () => {
                        window.location.reload();
                    });

                    done.addEventListener('click', async () => {
                        const newBio = (document.getElementById('bio-editor')?.value || '').trim();
                        try {
                            const res = await fetch(`${API_BASE}/${personId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bio: newBio })
                            });
                            if (!res.ok) throw new Error(res.statusText);
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

            // ─── PHOTOS (Profile) ───
            photos = Array.isArray(data.photos) ? data.photos.filter(Boolean) : [];
            hookPhotoButtons();
            refreshPhotosUI();

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
        const relativesListEl = document.querySelector('.relatives-list');
        if (!relativesListEl) return;

        const relatives = [
            { id: 1, name: 'Кравчук Леонід Макарович', years: '1975 - 2000', relationship: 'Батько', avatarUrl: 'https://via.placeholder.com/60x60' },
            { id: 2, name: 'Фаріон Ірина Олегівна', years: '1982 - 2012', relationship: 'Мати', avatarUrl: 'https://via.placeholder.com/60x60' },
            { id: 3, name: 'Кенседі Валерій Петрович', years: '1982 - 2012', relationship: 'Брат', avatarUrl: 'https://via.placeholder.com/60x60' }
        ];

        relativesListEl.innerHTML = '';
        relatives.forEach(relative => {
            const relativeEl = document.createElement('div');
            relativeEl.className = 'relative-item';
            relativeEl.innerHTML = `
                <img class="relative-avatar" src="${relative.avatarUrl}" alt="${relative.name}">
                <div class="relative-info">
                    <h3 class="relative-name">${relative.name}</h3>
                    <p class="relative-details">${relative.years}</p>
                </div>
                <span class="relative-relationship">${relative.relationship}</span>
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
