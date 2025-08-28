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

    const nonBlobPhotos = () =>
        (photos || []).filter((u) => typeof u === 'string' && u && !u.startsWith('blob:'));

    // ─────────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────────
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

            // elements you'll already have grabbed earlier in the file:
            // bioContentEl, bioToggleEl, bioAddBtn, bioEditBtn, bioMenuBtn

            // clean old empty-state
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

                // show ONLY "Додати" inline
                if (bioBtnsWrap) bioBtnsWrap.style.display = 'flex';
                if (bioAddBtn) {
                    bioAddBtn.style.display = 'inline-flex';  // override any old inline style
                    bioAddBtn.classList.add('show');          // pairs with CSS to make it visible
                }
                if (bioEditBtn) {
                    bioEditBtn.classList.remove('show');      // keep hidden
                    bioEditBtn.style.display = 'inline-flex'; // safe default
                }
                if (bioMenuBtn) bioMenuBtn.style.display = 'none';

            } else {
                // has bio → show text & dots, hide inline buttons area
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

            // (3) entering edit mode (from Add or from dots→"Змінити")
            function enterBioEdit() {
                const bioBody = document.querySelector('.profile-bio .bio-body');
                if (!bioBody) return;

                // swap body to textarea
                bioBody.innerHTML = `
    <textarea id="bio-editor" placeholder="Додайте життєпис...">${fullBio || ''}</textarea>
  `;

                // in edit mode: show only "Скасувати" + "Готово" buttons inline; hide dots
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

                    // hide dots while editing
                    bioMenuBtn && (bioMenuBtn.style.display = 'none');

                    cancel.addEventListener('click', () => window.location.reload());

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

            // wire actions:
            // – inline Add (for empty state)
            // – inline Edit (if you keep it)
            // – dots menu item "Змінити" (make sure the popup option has id="bio-edit-option")
            bioAddBtn?.addEventListener('click', enterBioEdit);
            bioEditBtn?.addEventListener('click', enterBioEdit);
            document.getElementById('bio-edit-option')?.addEventListener('click', () => {
                document.getElementById('bio-menu')?.classList.add('hidden'); // close popup if open
                enterBioEdit();
            });

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
