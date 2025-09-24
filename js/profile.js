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
    const backTo = params.get('backTo');   // NEW
    const backBtn = document.querySelector('.back-button');

    if (backBtn) {
        if (from === 'premium') {
            backBtn.setAttribute('href', 'premium_qr_person.html');
        } else if (from === 'profile' && backTo) {
            backBtn.setAttribute('href', `profile.html?personId=${encodeURIComponent(backTo)}`);
        } else {
            backBtn.setAttribute('href', 'index.html');
        }
    }

    const personId = params.get('personId');
    if (!personId) return;

    // Scoped sessionStorage key for modal return state
    function relReturnKey(id) {
        return `relModalReturn:${id}`;
    }

    const tokenKey = `people_token_${personId}`;
    const token = localStorage.getItem(tokenKey);

    if (token) {
        const suffix = from ? `&from=${encodeURIComponent(from)}` : '';
        window.location.replace(`/profile_edit.html?personId=${encodeURIComponent(personId)}${suffix}`);
        return;
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

    // ─── Relatives state ───
    const relListEl = document.querySelector('.relatives-list');
    const relMenuBtn = document.getElementById('rel-menu-btn');
    const relMenu = document.getElementById('rel-menu');
    const addRelBtn = document.getElementById('add-relative-btn');
    const chooseRelBtn = document.getElementById('choose-relative-btn');
    const deleteRelBtn = document.getElementById('rel-delete-btn');
    const cancelRelBtn = document.getElementById('rel-cancel-btn');

    let relLinks = [];          // [{ personId, role }]
    let relatives = [];         // [{ id, name, years, relationship, avatarUrl }]
    let relSelecting = false;   // selection mode
    let relSelectedOrder = [];  // indexes in render order

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

    let liturgiesIndex = {}; // { 'YYYY-MM-DD': [ { _id, churchName, price, createdAt, serviceDate } ] }

    function toISOFromParts(y, m, d) {
        // y: 2025, m: 1..12, d: 1..31 -> 'YYYY-MM-DD'
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    function toISOFromUA(ddmmyyyy) {
        const m = (ddmmyyyy || '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (!m) return '';
        const [, dd, mm, yyyy] = m;
        return `${yyyy}-${mm}-${dd}`;
    }

    function isPastISO(iso) {
        // compare by local midnight
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [y, m, d] = iso.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setHours(0, 0, 0, 0);
        return dt < today;
    }

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

    const avatarMenu = document.getElementById('avatar-menu');
    const avatarAddBtn = document.getElementById('avatar-add');
    const avatarChangeBtn = document.getElementById('avatar-change');
    const avatarDeleteBtn = document.getElementById('avatar-delete');
    const avatarSpinner = document.getElementById('avatar-spinner');

    function showAvatarSpinner() {
        avatarSpinner?.classList.add('show');
    }
    function hideAvatarSpinner() {
        avatarSpinner?.classList.remove('show');
    }

    // Відкрити меню
    function openAvatarMenu() {
        if (!avatarEl || !avatarMenu) return;

        const hasAvatar = avatarEl.src && !avatarEl.src.includes('https://i.ibb.co/ycrfZ29f/Frame-542.png');

        // показ кнопок за станом
        avatarAddBtn.style.display = hasAvatar ? 'none' : '';
        avatarChangeBtn.style.display = hasAvatar ? '' : 'none';
        avatarDeleteBtn.style.display = hasAvatar ? '' : 'none';

        avatarMenu.hidden = false;
        document.body.classList.add('no-scroll');   // блокуємо скрол
    }

    // Закрити меню
    function closeAvatarMenu() {
        if (!avatarMenu) return;
        avatarMenu.hidden = true;
        document.body.classList.remove('no-scroll'); // повертаємо скрол
    }

    // Відкриття по кліку на аватар (як і було)
    avatarEl?.addEventListener('click', () => {
        if (premiumLock && !token) return;  // лише для дозволених
        openAvatarMenu();
    });

    // ❶ Закрити по кліку поза вмістом меню (по бекдропу)
    avatarMenu?.addEventListener('click', (e) => {
        if (!e.target.closest('.bottom-popup-content')) {
            closeAvatarMenu();
        }
    });

    // ❷ Закривати по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !avatarMenu.hidden) {
            closeAvatarMenu();
        }
    });

    // Elements
    const avatarInput = document.createElement('input');
    avatarInput.type = 'file';
    avatarInput.accept = 'image/*';
    avatarInput.hidden = true;
    document.body.appendChild(avatarInput);

    async function uploadAvatarToImgBB(file) {
        const form = new FormData();
        form.append('image', file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: form
        });
        const json = await res.json();
        if (!json.success) throw new Error('Upload failed');
        return json.data.url;
    }

    async function updateAvatar(url) {
        try {
            const res = await fetch(`${API_BASE}/${personId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatarUrl: url })
            });
            if (!res.ok) throw new Error(await res.text());
            const updated = await res.json();

            avatarEl.src = updated.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png';
        } catch (err) {
            console.error('Update avatar failed', err);
            alert('Не вдалося оновити фото профілю');
        }
    }

    // Add new avatar
    avatarAddBtn?.addEventListener('click', () => {
        avatarInput.click();
    });

    avatarChangeBtn?.addEventListener('click', () => {
        avatarInput.click();
    });

    function openAvatarCropper(file) {
        return new Promise((resolve, reject) => {
            const overlay = document.getElementById('avatar-cropper-overlay');
            const modal = document.getElementById('avatar-cropper');
            const stage = document.getElementById('avatar-cropper-stage');
            const img = document.getElementById('avatar-cropper-img');
            const btnOk = document.getElementById('avatar-cropper-ok');
            const btnCancel = document.getElementById('avatar-cropper-cancel');

            if (!overlay || !modal || !stage || !img || !btnOk || !btnCancel) {
                resolve(file);
                return;
            }

            // helper: wait until stage has a non-zero width (modal is visible & laid out)
            const waitForStageSize = () => new Promise((r) => {
                const tick = () => {
                    const w = stage.getBoundingClientRect().width || stage.clientWidth;
                    if (w && w > 0) r(w); else requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            });

            // cleanup to avoid stacked listeners
            const cleanup = () => {
                stage.onpointerdown = null;
                stage.onpointermove = null;
                stage.onpointerup = null;
                stage.onpointercancel = null;
                stage.onwheel = null;
                stage.ontouchmove = null;
                btnOk.onclick = null;
                btnCancel.onclick = null;
            };

            const reader = new FileReader();
            reader.onload = async () => {
                img.src = reader.result;

                img.onload = async () => {
                    if (!img.naturalWidth || !img.naturalHeight) {
                        cleanup();
                        reject(new Error('Image decode failed'));
                        return;
                    }

                    // 1) show modal FIRST, then measure
                    overlay.hidden = false;
                    modal.hidden = false;

                    // 2) wait for stage to have size
                    const S = await waitForStageSize();            // square stage (px)
                    const circlePx = S * 0.68;                     // circle diameter in stage px

                    // min scale so image covers the circle
                    const imgRatio = img.naturalWidth / img.naturalHeight;
                    const minScale = (imgRatio >= 1)
                        ? (circlePx / img.naturalHeight)
                        : (circlePx / img.naturalWidth);

                    let scale = minScale;          // fixed lower bound
                    const maxScale = minScale * 3; // or 2.5 if you prefer
                    let dx = 0, dy = 0;            // pan (in stage px)

                    const apply = () => {
                        img.style.transform =
                            `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
                    };
                    img.style.left = '50%';
                    img.style.top = '50%';
                    img.style.transformOrigin = 'center center';
                    apply();

                    /* ---------- Pan (1 finger / mouse) ---------- */
                    let dragging = false, lastX = 0, lastY = 0, pinchActive = false;

                    stage.onpointerdown = (e) => {
                        // ignore pan if pinch is active
                        if (pinchActive) return;
                        dragging = true; lastX = e.clientX; lastY = e.clientY;
                        stage.setPointerCapture?.(e.pointerId);
                    };
                    stage.onpointermove = (e) => {
                        if (!dragging || pinchActive) return;
                        dx += (e.clientX - lastX);
                        dy += (e.clientY - lastY);
                        lastX = e.clientX; lastY = e.clientY;
                        apply();
                    };
                    stage.onpointerup = () => { dragging = false; };
                    stage.onpointercancel = () => { dragging = false; };

                    /* ---------- Pinch-to-zoom (2 fingers) ---------- */
                    let startDist = 0;
                    let startScale = scale;

                    // helper: distance & midpoint between two touches
                    function touchMetrics(t1, t2) {
                        const dx = t2.clientX - t1.clientX;
                        const dy = t2.clientY - t1.clientY;
                        const dist = Math.hypot(dx, dy);
                        const midX = (t1.clientX + t2.clientX) / 2;
                        const midY = (t1.clientY + t2.clientY) / 2;
                        return { dist, midX, midY };
                    }

                    stage.addEventListener('touchstart', (e) => {
                        if (e.touches.length === 2) {
                            pinchActive = true; dragging = false; // disable pan during pinch
                            const { dist } = touchMetrics(e.touches[0], e.touches[1]);
                            startDist = Math.max(dist, 1); // avoid 0
                            startScale = scale;
                        }
                    }, { passive: true });

                    stage.addEventListener('touchmove', (e) => {
                        if (e.touches.length === 2) {
                            e.preventDefault(); // stop page zoom/scroll
                            const { dist, midX, midY } = touchMetrics(e.touches[0], e.touches[1]);
                            const factor = Math.max(dist, 1) / startDist;

                            // new scale clamped
                            const prevScale = scale;
                            const newScale = Math.min(maxScale, Math.max(minScale, startScale * factor));
                            if (newScale === prevScale) return;

                            // focal-point zoom (keep midpoint content under fingers)
                            const cx = S / 2, cy = S / 2;           // stage center
                            const fx = midX - stage.getBoundingClientRect().left;
                            const fy = midY - stage.getBoundingClientRect().top;
                            const k = newScale / prevScale;

                            // adjust pan so that focal point stays stable while scaling
                            dx = fx - k * (fx - dx);
                            dy = fy - k * (fy - dy);

                            scale = newScale;
                            apply();
                        }
                    }, { passive: false });

                    stage.addEventListener('touchend', (e) => {
                        if (e.touches.length < 2) {
                            // pinch finished
                            pinchActive = false;
                        }
                    }, { passive: true });

                    stage.addEventListener('touchcancel', () => { pinchActive = false; }, { passive: true });

                    /* ---------- (Optional) wheel/trackpad zoom on desktop ---------- */
                    stage.onwheel = (e) => {
                        // allow pinch-to-zoom on trackpads; block page scroll here
                        if (!e.ctrlKey && Math.abs(e.deltaY) < 1) return; // ignore tiny moves
                        e.preventDefault();

                        const rect = stage.getBoundingClientRect();
                        const fx = e.clientX - rect.left;
                        const fy = e.clientY - rect.top;

                        const prevScale = scale;
                        // tune 0.0015 for sensitivity; negative deltaY => zoom in
                        const kStep = Math.exp(-e.deltaY * 0.0015);
                        const newScale = Math.min(maxScale, Math.max(minScale, prevScale * kStep));
                        if (newScale === prevScale) return;

                        const k = newScale / prevScale;
                        dx = fx - k * (fx - dx);
                        dy = fy - k * (fy - dy);

                        scale = newScale;
                        apply();
                    };

                    btnCancel.onclick = () => {
                        overlay.hidden = true;
                        modal.hidden = true;
                        cleanup();
                        reject(new Error('cancelled'));
                    };

                    btnOk.onclick = () => {
                        try {
                            const outSize = 600; // export square
                            const canvas = document.createElement('canvas');
                            canvas.width = outSize; canvas.height = outSize;
                            const ctx = canvas.getContext('2d');

                            // re-measure in case layout changed
                            const Sw = stage.getBoundingClientRect().width || S;
                            const circleStage = Sw * 0.68;
                            const k = outSize / circleStage;

                            ctx.clearRect(0, 0, outSize, outSize);
                            ctx.fillStyle = '#fff';
                            ctx.fillRect(0, 0, outSize, outSize);

                            // circular clip (so the exported square matches round frame)
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(outSize / 2, outSize / 2, outSize / 2, 0, Math.PI * 2);
                            ctx.clip();

                            // draw using the same transform you see on screen
                            ctx.translate(outSize / 2 + dx * k, outSize / 2 + dy * k);
                            ctx.scale(scale * k, scale * k);
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
                            ctx.restore();

                            canvas.toBlob((blob) => {
                                overlay.hidden = true;
                                modal.hidden = true;
                                cleanup();
                                if (!blob) {
                                    reject(new Error('blob failed'));
                                    return;
                                }
                                resolve(blob);
                            }, 'image/png', 0.92);
                        } catch (e) {
                            cleanup();
                            reject(e);
                        }
                    };
                };
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    // Upload handler
    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showAvatarSpinner();
        try {
            // 1) Let user crop related to the circle
            const croppedBlob = await openAvatarCropper(file); // may throw if cancelled

            // 2) Upload the CROPPED blob (not the original)
            const hostedUrl = await uploadAvatarToImgBB(croppedBlob);
            await updateAvatar(hostedUrl);
            location.reload();
        } catch (err) {
            // cancelled or failed
            // optional: showToast('Зміни скасовано'); 
        } finally {
            avatarInput.value = ''; // reset
            hideAvatarSpinner();
            // Keep menu behavior as you have it now:
            // profile_edit: menu closes in finally; profile: same
        }
    });

    // Delete avatar
    avatarDeleteBtn?.addEventListener('click', async () => {
        showAvatarSpinner();
        // без confirm — одразу видаляємо
        await updateAvatar(null); // send null to remove
        hideAvatarSpinner();
        closeAvatarMenu();
    });

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

    if (cemeteryEl) {
        cemeteryEl.classList.add('clickable');
        cemeteryEl.addEventListener('click', () => {
            const name = cemeteryEl.textContent?.trim();
            if (name) {
                window.location.href = `cemetery.html?name=${encodeURIComponent(name)}`;
            }
        });
    }

    function setRelativesControlsVisibility() {
        if (!relListEl) return;

        const has = Array.isArray(relatives) && relatives.length > 0;

        // Якщо преміум заблокований – завжди ховаємо меню родичів
        if (premiumLock) {
            addRelBtn && (addRelBtn.style.display = 'none');
            relMenuBtn && (relMenuBtn.style.display = 'none');
            chooseRelBtn && (chooseRelBtn.style.display = 'none');
            deleteRelBtn && (deleteRelBtn.style.display = 'none');
            cancelRelBtn && (cancelRelBtn.style.display = 'none');
            return;
        }

        // Якщо родичів немає
        if (!has) {
            addRelBtn && (addRelBtn.style.display = 'inline-flex');
            relMenuBtn && (relMenuBtn.style.display = 'none');   // ← важливо
            chooseRelBtn && (chooseRelBtn.style.display = 'none');
            deleteRelBtn && (deleteRelBtn.style.display = 'none');
            cancelRelBtn && (cancelRelBtn.style.display = 'none');
            return;
        }

        // Якщо активний режим вибору
        if (relSelecting) {
            addRelBtn && (addRelBtn.style.display = 'none');
            relMenuBtn && (relMenuBtn.style.display = 'none');   // ← щоб не плутати
            chooseRelBtn && (chooseRelBtn.style.display = 'none');
            deleteRelBtn && (deleteRelBtn.style.display = 'inline-block');
            cancelRelBtn && (cancelRelBtn.style.display = 'inline-block');
            return;
        }

        // Звичайний режим → тільки меню
        addRelBtn && (addRelBtn.style.display = 'none');
        relMenuBtn && (relMenuBtn.style.display = 'inline-flex');
        chooseRelBtn && (chooseRelBtn.style.display = 'none');
        deleteRelBtn && (deleteRelBtn.style.display = 'none');
        cancelRelBtn && (cancelRelBtn.style.display = 'none');
    }

    function updateRelDeleteButtonLabel() {
        if (!deleteRelBtn) return;
        deleteRelBtn.textContent = `Видалити (${relSelectedOrder.length})`;
    }

    function exitRelSelectionMode() {
        relSelecting = false;
        relSelectedOrder = [];
        document.querySelector('.profile-relatives')?.classList.remove('selection-mode');
        if (chooseRelBtn) chooseRelBtn.textContent = 'Вибрати';
        refreshRelativesUI();
        setRelativesControlsVisibility();
    }

    function enterRelSelectionMode() {
        if (relSelecting || !relatives.length) return;
        relSelecting = true;
        document.querySelector('.profile-relatives')?.classList.add('selection-mode');
        updateRelDeleteButtonLabel();
        refreshRelativesUI();
        setRelativesControlsVisibility();
    }

    function toggleSelectRelative(index) {
        const pos = relSelectedOrder.indexOf(index);
        if (pos > -1) relSelectedOrder.splice(pos, 1);
        else relSelectedOrder.push(index);
        refreshRelativesUI();
        updateRelDeleteButtonLabel();
    }

    async function saveRelatives() {
        // Persist relLinks (pruned) to backend
        try {
            const body = JSON.stringify({ relatives: relLinks.map(r => ({ personId: r.personId, role: r.role })) });
            const res = await fetch(`${API_BASE}/${personId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body
            });
            if (!res.ok) throw new Error(res.statusText);
        } catch (e) {
            console.error('Failed to save relatives:', e);
            alert('Не вдалося зберегти зміни у розділі Родичі.');
        }
    }

    function refreshRelativesUI() {
        if (!relListEl) return;

        relListEl.innerHTML = '';

        if (!Array.isArray(relatives) || relatives.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'comments-empty';
            empty.textContent = 'Родичі не добавлені';
            relListEl.appendChild(empty);
            return;
        }

        relatives.forEach((relative, idx) => {
            const el = document.createElement('div');
            el.className = 'relative-item';
            el.dataset.index = String(idx);

            el.innerHTML = `
            <img class="relative-avatar" src="${relative.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'}" alt="">
            <div class="relative-info">
              <h3 class="relative-name" title="${relative.name || ''}">${relative.name || ''}</h3>
              <div class="relative-meta">
                <p class="relative-details">${relative.years || ''}</p>
                <span class="relative-relationship">${relative.relationship || ''}</span>
              </div>
            </div>
            <span class="select-badge"></span>
          `;

            // Selection decorations
            const orderPos = relSelectedOrder.indexOf(idx);
            const isSel = orderPos > -1;
            if (isSel) el.classList.add('is-selected');
            el.querySelector('.select-badge').textContent = isSel ? String(orderPos + 1) : '';

            // Click behavior
            el.addEventListener('click', () => {
                if (relSelecting) {
                    toggleSelectRelative(idx);
                } else {
                    window.location.href = `profile.html?personId=${encodeURIComponent(relative.id)}`;
                }
            });

            relListEl.appendChild(el);
        });

        setRelativesControlsVisibility();
    }

    // Рендер
    function refreshSharedUI() {
        if (!sharedListEl) return;
        sharedListEl.innerHTML = '';

        // PUBLIC PAGE: show only accepted photos + local blob previews
        const localPendingBlobs = sharedPending.filter(p => isBlob(p.url));
        const renderItems = [...localPendingBlobs, ...sharedPhotos];
        sharedListEl.classList.remove('rows-1', 'rows-2');
        sharedListEl.classList.add('rows-1');

        // Build arrays for slideshow from ALL visible items (pending first)
        const allUrls = renderItems.map(p => p.url);
        const allCaptions = renderItems.map(p => p.description || '');

        renderItems.forEach((p, idx) => {
            const li = document.createElement('li');
            const img = document.createElement('img');
            img.src = p.url;

            // NEW: add the same selection badge element (stays hidden here unless you enable selection)
            const badge = document.createElement('span');
            badge.className = 'select-badge';

            // uploading overlay for blob previews
            if (isBlob(p.url)) {
                li.classList.add('uploading');
                const hint = document.createElement('div');
                hint.className = 'uploading-hint';
                hint.textContent = 'Завантаження…';
                li.appendChild(hint);
            }

            // Open slideshow on ANY tile (pending local blobs or accepted)
            li.addEventListener('click', () => {
                const start = allUrls.indexOf(p.url);
                openSlideshow(
                    allUrls.length ? allUrls : [p.url],
                    allUrls.length && start >= 0 ? start : 0,
                    allCaptions.length ? allCaptions : [p.description || '']
                );
            });

            li.append(img, badge);
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
        if (photosListEl.style) photosListEl.style.display = ''; // ensure visible

        // remove old empty-state, if any
        photosScrollEl?.querySelector('.photos-empty')?.remove();

        const hasPhotos = photos.length > 0;
        setPhotosControlsVisibility();

        // 0) Empty state
        if (!hasPhotos) {
            if (photosListEl.style) photosListEl.style.display = 'none';
            const empty = document.createElement('div');
            empty.className = 'photos-empty';
            empty.textContent = 'Немає фотографій. Будь ласка, поділіться спогадами';
            photosScrollEl?.appendChild(empty);
            return;
        }

        // 1) One row if >= 5 photo, otherwise two rows
        photosListEl.classList.add(photos.length <= 5 ? 'rows-1' : 'rows-2');

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

            // NEW: numbered selection badge (matches Location page)
            const badge = document.createElement('span');
            badge.className = 'select-badge';

            // Reflect selection state + number
            const orderPos = selectedOrder.indexOf(idx);
            const isSel = orderPos > -1;
            li.classList.toggle('is-selected', isSel);
            li.classList.toggle('selected', isSel); // backward compatibility
            badge.textContent = isSel ? String(orderPos + 1) : '';

            // click behavior (open slideshow vs select)
            li.addEventListener('click', () => {
                if (isSelecting) {
                    toggleSelectPhoto(idx);
                } else {
                    // We only show real (uploaded) photos in slideshow
                    const images = realPhotoUrls();               // array of urls
                    const captions = realPhotos().map(x => x.description || '');
                    const startIndex = images.indexOf(url);
                    const safeIndex = Math.max(0, startIndex);
                    openSlideshow(
                        images.length ? images : [url],
                        images.length ? safeIndex : 0,
                        images.length ? captions : [p.description || '']
                    );
                }
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
                overlay.addEventListener('click', () => close());

                let confirmed = false;

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
                    else { confirmed = true; close(); }
                };

                open();
                renderStep();

                // Wait until dialog closes (simple polling of hidden attribute)
                await new Promise((resolve) => {
                    const iv = setInterval(() => { if (!dlg || dlg.hidden) { clearInterval(iv); resolve(); } }, 60);
                });

                if (!confirmed) {
                    // rollback temp blobs added before opening the modal
                    for (let i = previews.length - 1; i >= 0; i--) {
                        photos.splice(startIndex + i, 1);
                    }
                    refreshPhotosUI();
                    fileInput.value = '';
                    return; // abort: nothing gets uploaded
                }

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

            // reset any previous clamp
            commentsListEl.style.maxHeight = '';
            commentsListEl.style.overflowY = '';
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

            if (locationBtn) {
                locationBtn.addEventListener('click', (e) => {
                    const hasLocation = !!(data?.location?.[0]);
                    if (premiumLock && !hasLocation) {
                        e.preventDefault();
                        // open login modal
                        const loginModal = document.getElementById('loginModal');
                        if (loginModal) loginModal.style.display = 'flex';
                    }
                });
            }

            // ─── BIO ───
            const fullBio = (data.bio || '').trim();
            const bioBodyWrap = document.querySelector('.profile-bio .bio-body');
            bioBodyWrap?.querySelector('.bio-empty')?.remove();

            function applyBio(text) {
                const LINES = 4;
                const moreLabel = 'більше';
                const lessLabel = 'менше';

                bioContentEl.classList.add('manual-clamp'); // вимикаємо css-кламп
                bioContentEl.innerHTML = '';                // очистка

                // Створюємо вузли, які і під час вимірювань, і фінально будуть стояти поряд
                const textSpan = document.createElement('span'); // сам текст
                const nbsp = document.createTextNode('\u00A0');  // NBSP між "…" і toggle (щоб не ламався рядок)
                const toggle = document.createElement('span');   // перемикач
                toggle.className = 'bio-toggle';
                toggle.setAttribute('role', 'button');
                toggle.tabIndex = 0;

                const cs = getComputedStyle(bioContentEl);
                const line = parseFloat(cs.lineHeight) || (1.5 * parseFloat(cs.fontSize) || 21);
                const maxH = Math.round(LINES * line);

                // Швидка гілка: увесь текст влазить у 4 рядки — показуємо без toggle
                textSpan.textContent = text;
                bioContentEl.appendChild(textSpan);
                if (bioContentEl.clientHeight <= maxH + 1) {
                    return;
                }

                // Функція вимірювання: кладемо "префікс + ' …' + NBSP + <span class= bio-toggle>більше</span>"
                function heightForPrefix(prefixLen) {
                    bioContentEl.innerHTML = '';
                    textSpan.textContent = text.slice(0, prefixLen).trimEnd() + ' …';
                    toggle.textContent = moreLabel; // саме та ж стилістика, що буде у фіналі
                    bioContentEl.append(textSpan, nbsp, toggle);
                    return bioContentEl.clientHeight;
                }

                // Бінарний пошук максимальної довжини, щоб увесь блок лишався висотою <= 4 рядки
                let lo = 0, hi = text.length, best = 0;
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1;
                    if (heightForPrefix(mid) <= maxH + 1) {
                        best = mid; lo = mid + 1;
                    } else {
                        hi = mid - 1;
                    }
                }

                // Фіксуємо фінальну розмітку (у тому ж складі, що й під час вимірювання)
                bioContentEl.innerHTML = '';
                textSpan.textContent = text.slice(0, best).trimEnd() + ' …';
                toggle.textContent = moreLabel;
                bioContentEl.append(textSpan, document.createTextNode('\u00A0'), toggle);

                // Обробники розкриття/згортання
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
                    // Перераховуємо обрізання — це поверне toggle рівно в кінець 4-го рядка
                    applyBio(text);
                };
                const onToggle = () => (expanded ? collapse() : expand());

                toggle.addEventListener('click', onToggle);
                toggle.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
                });
            }

            if (fullBio) {
                applyBio(fullBio);
            } else {
                bioContentEl.textContent = '';
                bioContentEl.style.display = 'none';
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
                    bioEditBtn && (bioEditBtn.style.display = 'none');
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

    async function loadLiturgies() {
        try {
            const res = await fetch(`${API_URL}/api/people/${encodeURIComponent(personId)}/liturgies`);
            if (!res.ok) throw new Error(await res.text());
            const list = await res.json(); // [{_id, person, serviceDate, churchName, price, createdAt}, ...]

            // index by YYYY-MM-DD
            liturgiesIndex = {};
            (list || []).forEach(item => {
                const iso = (item.serviceDate || '').slice(0, 10);
                if (!iso) return;
                (liturgiesIndex[iso] = liturgiesIndex[iso] || []).push(item);
            });
        } catch (e) {
            console.error('Failed to load liturgies:', e);
            liturgiesIndex = {};
        }
    }

    function markDatesWithLiturgies() {
        const dateCalendar = document.querySelector('.date-calendar');
        if (!dateCalendar) return;

        dateCalendar.querySelectorAll('.date-item').forEach(it => {
            // remove previous marks
            it.querySelector('.date-dot')?.remove();

            const iso = toISOFromParts(Number(it.dataset.year), Number(it.dataset.month), Number(it.dataset.day));
            // Only mark PAST dates that have liturgies
            if (isPastISO(iso) && (liturgiesIndex[iso]?.length)) {
                const dot = document.createElement('span');
                dot.className = 'date-dot';          // small green dot
                dot.dataset.iso = iso;               // helpful for future targeting
                it.appendChild(dot);
            }
        });
    }

    generateDates();

    (async () => {
        await loadLiturgies();
        markDatesWithLiturgies();

        // ensure initial selected (today) effects
        const selectedDateText = document.querySelector('.selected-date')?.textContent || '';
        const iso = toISOFromUA(selectedDateText);
        if (iso) applyDateSelectionEffects(iso);
    })();

    function applyDateSelectionEffects(iso) {
        // If past → hide submit & details, show only history
        const submitBtn = document.querySelector('.liturgy-submit');
        const detailsEl = document.querySelector('.liturgy-details, .service-info') || document.querySelector('.service-info');
        const liturgyChurchEl = document.querySelector('.liturgy-church');
        const liturgyDonationEl = document.querySelector('.liturgy-donation');

        const isPast = isPastISO(iso);
        if (submitBtn) submitBtn.style.display = isPast ? 'none' : '';
        if (detailsEl) detailsEl.style.display = isPast ? 'none' : '';
        if (liturgyDonationEl) liturgyDonationEl.style.display = isPast ? 'none' : '';
        if (liturgyChurchEl) liturgyChurchEl.style.display = isPast ? 'none' : '';

        // Always show history section for the selected day
        renderLiturgyHistoryForISO(iso);
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('.date-item')) {
            const clickedItem = e.target.closest('.date-item');
            const selectedDateEl = document.querySelector('.selected-date');
            document.querySelectorAll('.date-item').forEach(d => d.classList.remove('selected'));
            clickedItem.classList.add('selected');

            const day = parseInt(clickedItem.dataset.day, 10);
            const month = parseInt(clickedItem.dataset.month, 10);
            const year = parseInt(clickedItem.dataset.year, 10);

            const formattedDate = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
            if (selectedDateEl) selectedDateEl.textContent = formattedDate;
            updateLiturgyDetails();

            // NEW: apply effects (past-date visibility + history render)
            const iso = toISOFromParts(year, month, day);
            applyDateSelectionEffects(iso);
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

        if (serviceInfoEl && selectedDateEl) {
            const selectedDate = selectedDateEl.textContent;

            if (selectedChurchEl) {
                const churchName = selectedChurchEl.textContent;
                serviceInfoEl.innerHTML =
                    `Божественна Літургія за упокій відбудеться у <span style="font-weight:550;">${churchName}</span>, <span style="font-weight:550;">${selectedDate}</span> р.`;
            } else {
                serviceInfoEl.innerHTML = `Божественна Літургія за упокій відбудеться у <span style="font-weight:550;">Оберіть церкву</span>, ${selectedDate} р.`;
            }
        }
    }

    function ensureLiturgyHistoryContainer() {
        const host = document.querySelector('.profile-liturgy');
        if (!host) return null;

        let history = host.querySelector('.liturgy-history');
        if (!history) {
            history = document.createElement('div');
            history.className = 'liturgy-history';
            const details = host.querySelector('.liturgy-details');
            if (details?.nextSibling) details.parentNode.insertBefore(history, details.nextSibling);
            else host.appendChild(history);
        }
        return history;
    }

    function renderLiturgyHistoryForISO(iso) {
        const history = ensureLiturgyHistoryContainer();
        if (!history) return;

        const past = isPastISO(iso); // uses your helper
        // For future dates: remove history block + any timeline dot, then exit
        if (!past) {
            history.innerHTML = '';
            history.remove?.();

            // If you mark dots like <span class="date-dot" data-iso="YYYY-MM-DD">
            const dot =
                document.querySelector(`.date-dot[data-iso="${iso}"]`) ||
                document.querySelector(`.date-dot[data-date="${iso}"]`);
            dot?.remove();
            return;
        }

        // Past only → build history
        const items = (liturgiesIndex[iso] || [])
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        history.innerHTML = '';

        const phrase = 'Божественна Літургія за упокій відбулась';
        const titleText = 'Історія';

        // Header
        const title = document.createElement('h3');
        title.className = 'liturgy-history-title';
        title.textContent = titleText;
        history.appendChild(title);

        // Empty state (for past we show “Немає історії”)
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'comments-empty';
            empty.textContent = 'Немає історії';
            history.appendChild(empty);
            return;
        }

        // List container (scrollable; max 2 cards)
        const list = document.createElement('div');
        list.className = 'liturgy-history-list';
        history.appendChild(list);

        const currentPersonName =
            document.querySelector('.profile-name')?.textContent?.trim() ||
            document.querySelector('.person-name')?.textContent?.trim() ||
            '';

        items.forEach((it) => {
            const d = new Date(it.serviceDate);
            const dateUa = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

            const card = document.createElement('div');
            card.className = 'liturgy-details liturgy-history-item';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'person-name';
            nameDiv.textContent = currentPersonName;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'service-info';
            infoDiv.textContent = `${phrase} у ${it.churchName || 'Церква'}, ${dateUa} р.`;

            card.append(nameDiv, infoDiv);
            list.appendChild(card);
        });

        // Clamp to 2 cards
        requestAnimationFrame(() => {
            const cards = list.querySelectorAll('.liturgy-history-item');
            list.style.maxHeight = '';
            list.style.overflowY = '';
            if (cards.length <= 2) return;

            const first = cards[0];
            const second = cards[1];
            const clampPx = Math.ceil(second.getBoundingClientRect().bottom - first.getBoundingClientRect().top);
            const gap = parseFloat(getComputedStyle(list).rowGap || getComputedStyle(list).gap || '0');
            const maxH = clampPx + gap;
            list.style.maxHeight = `${maxH}px`;
            list.style.overflowY = 'auto';
        });
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

    function onLiturgySubmit(e) {
        e.preventDefault(); // in case the button is inside a <form>
        const btn = e.currentTarget;

        // Re-entrancy / double-click guard
        if (btn.dataset.busy === '1') return;
        btn.dataset.busy = '1';
        btn.disabled = true;

        (async () => {
            try {
                // UI selections
                const selectedDateText = document.querySelector('.selected-date')?.textContent?.trim() || '';
                const selectedChurchEl = document.querySelector('.church-btn.selected');
                const selectedDonationBtn = document.querySelector('.donation-btn.selected');

                // Basic validation
                if (!selectedDateText) return alert('Оберіть дату');
                if (!selectedChurchEl) return alert('Оберіть церкву');
                if (!selectedDonationBtn) return alert('Оберіть суму пожертви');
                if (!personId) return alert('Не знайдено профіль (personId)');

                // Parse date "DD.MM.YYYY" -> "YYYY-MM-DD"
                let dateISO = '';
                const m = selectedDateText.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
                if (m) {
                    const [, dd, mm, yyyy] = m;
                    dateISO = `${yyyy}-${mm}-${dd}`;
                } else {
                    const d = new Date(selectedDateText);
                    if (!isNaN(d)) dateISO = d.toISOString().slice(0, 10);
                }
                if (!dateISO) return alert('Невірний формат дати');

                // churchName
                const churchName = selectedChurchEl.textContent.trim();

                // price: prefer data-amount (для "Інше"), інакше парсимо з тексту ("200 грн")
                let price = 0;
                if (selectedDonationBtn.dataset.amount) {
                    price = parseInt(selectedDonationBtn.dataset.amount, 10) || 0;
                } else {
                    price = parseInt((selectedDonationBtn.textContent || '').replace(/[^\d]/g, ''), 10) || 0;
                }
                if (price <= 0) return alert('Введіть коректну суму пожертви');

                // Build payload for the endpoint
                const payload = {
                    date: dateISO,       // server stores as serviceDate
                    churchName,          // string
                    personId,            // current profile id
                    price,               // number
                };

                // POST
                const res = await fetch(`${API_URL}/api/liturgies`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    throw new Error(text || `HTTP ${res.status}`);
                }

                // Success UX + refresh calendar & history
                try { showToast?.('Записку надіслано. Дякуємо за пожертву!'); } catch { }
                await loadLiturgies();
                markDatesWithLiturgies();
                const currentSelectedText = document.querySelector('.selected-date')?.textContent || '';
                const iso = toISOFromUA(currentSelectedText);
                if (iso) applyDateSelectionEffects(iso);

                // Optionally clear donation selection:
                // document.querySelectorAll('.donation-btn')?.forEach(b => b.classList.remove('selected'));
            } catch (err) {
                console.error('Create liturgy failed:', err);
                alert('Не вдалося надіслати записку. Спробуйте ще раз.');
            } finally {
                btn.disabled = false;
                delete btn.dataset.busy;
            }
        })();
    }

    const liturgySubmitBtn = document.querySelector('.liturgy-submit');
    if (liturgySubmitBtn && !liturgySubmitBtn.dataset.bound) {
        liturgySubmitBtn.dataset.bound = '1';
        liturgySubmitBtn.addEventListener('click', onLiturgySubmit);
    }

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

    async function loadRelatives() {
        if (!relListEl || !personId) return;

        // 1) Load this person → array of links [{personId, role}]
        try {
            const res = await fetch(`${API_BASE}/${encodeURIComponent(personId)}`);
            if (!res.ok) throw new Error('Failed to load person');
            const me = await res.json();
            relLinks = Array.isArray(me.relatives) ? me.relatives.slice() : [];
        } catch (e) {
            console.error(e);
            relListEl.innerHTML = '<div class="relatives-empty">Не вдалося завантажити родичів</div>';
            return;
        }

        if (!relLinks.length) {
            relatives = [];
            refreshRelativesUI();
            return;
        }

        // 2) Fetch details for each linked person
        const details = await Promise.all(relLinks.map(async ({ personId: rid, role }) => {
            try {
                const r = await fetch(`${API_BASE}/${encodeURIComponent(rid)}`);
                if (!r.ok) throw 0;
                const p = await r.json();

                const y1 = p.birthYear ?? (p.birthDate ? new Date(p.birthDate).getFullYear() : undefined);
                const y2 = p.deathYear ?? (p.deathDate ? new Date(p.deathDate).getFullYear() : undefined);
                const years = (!y1 && !y2) ? '' : `${y1 ?? '—'} - ${y2 ?? '—'}`;

                return {
                    id: p.id,
                    name: p.name || 'Без імені',
                    years,
                    relationship: role,
                    avatarUrl: p.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'
                };
            } catch {
                return null;
            }
        }));

        relatives = details.filter(Boolean);
        refreshRelativesUI();
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

    // Dots → Relatives “Добавити / Вибрати”
    document.getElementById('rel-add-option')?.addEventListener('click', () => addRelBtn?.click());
    document.getElementById('rel-choose-option')?.addEventListener('click', () => chooseRelBtn?.click());

    // Choose → toggle selection mode
    chooseRelBtn?.addEventListener('click', () => {
        if (relSelecting) {
            exitRelSelectionMode();
            chooseRelBtn.textContent = 'Вибрати';
        } else {
            enterRelSelectionMode();
            chooseRelBtn.textContent = 'Скасувати';
        }
    });

    cancelRelBtn?.addEventListener('click', () => {
        exitRelSelectionMode();
        if (chooseRelBtn) chooseRelBtn.textContent = 'Вибрати'; // reset label for next time
    });

    // Delete → confirm & persist
    if (deleteRelBtn) {
        const overlay = document.getElementById('modal-overlay');
        const dlg = document.getElementById('confirm-delete-modal');
        const closeX = document.getElementById('confirm-delete-close');
        const cancelBtn = document.getElementById('confirm-delete-cancel');
        const okBtn = document.getElementById('confirm-delete-ok');
        const textEl = dlg?.querySelector('.modal-text');
        const originalText = textEl?.textContent || '';

        const openConfirm = () => {
            if (!relSelecting || relSelectedOrder.length === 0) { exitRelSelectionMode(); return; }
            if (textEl) textEl.textContent = 'Видалити вибраних родичів?';
            overlay.hidden = false; dlg.hidden = false;
        };
        const closeConfirm = () => {
            overlay.hidden = true; dlg.hidden = true;
            if (textEl) textEl.textContent = originalText; // restore for photos flow
        };

        deleteRelBtn.addEventListener('click', openConfirm);
        [closeX, cancelBtn, overlay].forEach(el => el && el.addEventListener('click', closeConfirm));

        okBtn?.addEventListener('click', async () => {
            // Remove selected relatives (by index) from both arrays
            const toDelete = [...relSelectedOrder].sort((a, b) => b - a);
            toDelete.forEach(i => {
                if (i >= 0 && i < relatives.length) {
                    relatives.splice(i, 1);
                    relLinks.splice(i, 1);
                }
            });
            relSelectedOrder = [];

            await saveRelatives();
            closeConfirm();
            exitRelSelectionMode();
        });
    }

    loadRelatives();
    refreshRelativesUI();
    setRelativesControlsVisibility();

    // ─────────────────────────────────────────────────────────────────────────────
    // Relatives Add (modal) — та ж логіка, що на premium_qr_person
    // ─────────────────────────────────────────────────────────────────────────────
    (function setupRelativesModal() {
        const openers = [
            document.getElementById('rel-add-option'),
            document.getElementById('add-relative-btn')
        ].filter(Boolean);

        const overlay = document.getElementById('relativesModal');
        if (!overlay || !openers.length) return;

        const closeBtn = document.getElementById('relModalClose');
        const submitBtn = document.getElementById('relSubmit');

        // Inputs
        const nameInput = document.getElementById('relName');
        const birthInput = document.getElementById('relBirthYear');
        const deathInput = document.getElementById('relDeathYear');
        const areaInput = document.getElementById('relArea');

        // Area clear button (support either id)
        const areaClear = document.getElementById('clear-relArea') || document.getElementById('relAreaClear');

        // Cemetery is an INPUT with suggestions (not <select>)
        const cemInput = document.getElementById('relCemetery');
        // Cemetery clear button (support both historical ids)
        const cemClear = document.getElementById('relCemClear') || document.getElementById('clear-relCemetery');
        const cemSugList = document.getElementById('relCemeterySuggestions');

        // Years pill
        const pill = document.getElementById('relYearsPill');
        const panel = document.getElementById('relYearsPanel');
        const display = document.getElementById('relYearsDisplay');
        const clearYears = document.getElementById('relClearYears');
        const birthList = document.getElementById('relBirthYears');
        const deathList = document.getElementById('relDeathYears');
        const yearsDone = document.getElementById('relYearsDone');

        // Lists
        const foundList = document.getElementById('relFoundList');
        const selectedList = document.getElementById('relSelectedList');
        const foundCountEl = document.getElementById('relFoundCount');
        const selCountEl = document.getElementById('relSelectedCount');

        // We'll toggle the whole "Selected (N)" row visibility
        const selectedCountRow =
            (selCountEl && selCountEl.closest('.modal-subtitle')) || (selCountEl && selCountEl.parentElement);

        const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

        const relReturnKey = (id) => `relModalReturn:${id}`;

        let selected = [];         // [{id, name, birthYear, deathYear, avatarUrl}]
        let selectedBirth, selectedDeath;

        // ───────────────── Years (DON'T close panel on item click)
        function fillYears(el, from, to, current) {
            el.innerHTML = '';
            for (let y = to; y >= from; y--) {
                const li = document.createElement('li');
                li.textContent = y;
                if (current && Number(current) === y) li.classList.add('selected');
                // Only mark selection — do NOT close panel here
                li.addEventListener('click', () => {
                    el.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
                    li.classList.add('selected');
                    // DO NOT CLOSE PANEL - removed panel.classList.toggle('hidden');
                });
                el.appendChild(li);
            }
        }
        fillYears(birthList, 1850, new Date().getFullYear(), null);
        fillYears(deathList, 1850, new Date().getFullYear(), null);

        // Toggle panel on pill click
        pill.addEventListener('click', (e) => {
            // Prevent event bubbling that might close the panel
            e.stopPropagation();
            panel.classList.toggle('hidden');
        });

        // ONLY close panel when "Done" button is clicked
        yearsDone.addEventListener('click', () => {
            const b = birthList.querySelector('.selected')?.textContent;
            const d = deathList.querySelector('.selected')?.textContent;

            if (b && d && Number(d) < Number(b)) {
                alert('Рік смерті не може бути раніше року народження.');
                return;
            }

            selectedBirth = b; selectedDeath = d;
            birthInput.value = b || '';
            deathInput.value = d || '';
            display.textContent = (b || d) ? `${b || ''}${(b && d) ? ' – ' : ''}${d || ''}` : 'Рік народження та смерті';
            display.classList.toggle('has-value', !!(b || d));
            clearYears.hidden = !(b || d);

            // CLOSE ONLY on Done button click
            panel.classList.add('hidden');
            triggerFetch();
        });

        clearYears.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedBirth = selectedDeath = undefined;
            birthInput.value = deathInput.value = '';
            display.textContent = 'Рік народження та смерті';
            display.classList.remove('has-value');
            clearYears.hidden = true;
            birthList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            deathList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            triggerFetch();
        });

        // Prevent closing panel when clicking inside it
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Close panel if clicking outside of it
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#relYearsPill')) {
                panel.classList.add('hidden');
            }
        });

        // ───────────────── Area suggestions (keep as before) + clear button visibility
        const areaSug = document.getElementById('relAreaSuggestions');

        function updateAreaClearBtn() {
            if (!areaClear) return;
            const show = !!areaInput.value.trim();
            areaClear.style.display = show ? 'inline-flex' : 'none';
        }

        (function setupAreaSuggestions() {
            const run = debounce(async () => {
                const q = areaInput.value.trim();
                if (!q) { areaSug.innerHTML = ''; areaSug.style.display = 'none'; updateAreaClearBtn(); return; }
                const res = await fetch(`${API_URL}/api/locations?search=${encodeURIComponent(q)}`);
                const arr = await res.json();
                areaSug.innerHTML = arr.length ? arr.map(x => `<li>${x}</li>`).join('') :
                    '<li class="no-results">Збігів не знайдено</li>';
                areaSug.style.display = 'block';
                updateAreaClearBtn();
            }, 300);

            areaInput.addEventListener('input', () => { run(); /* do not fetch people yet */ updateAreaClearBtn(); });

            areaSug.addEventListener('click', (e) => {
                if (e.target.tagName !== 'LI') return;
                areaInput.value = e.target.textContent;
                areaSug.style.display = 'none';
                updateAreaClearBtn();

                // Area changed → clear cemetery to avoid mismatch
                cemInput.value = '';
                cemSugList?.classList?.remove('show');

                triggerFetch(); // area is a real filter now
            });
        })();

        // Area CLEAR → also clears cemetery (Fix #1 & #2)
        areaClear?.addEventListener('click', (e) => {
            e.preventDefault();
            areaInput.value = '';
            areaSug.style.display = 'none';
            updateAreaClearBtn();

            cemInput.value = '';
            cemSugList.classList.remove('show');

            triggerFetch();
        });

        // ───────────────── Cemetery suggestions
        const fetchRelCemeteries = async () => {
            const q = cemInput.value.trim();
            const area = areaInput.value.trim();

            const params = new URLSearchParams();
            if (q) params.set('search', q);
            if (area) params.set('area', area);

            try {
                const res = await fetch(`${API_URL}/api/cemeteries?${params.toString()}`);
                const arr = await res.json();
                const names = Array.isArray(arr) ? arr.map(x => (typeof x === 'string' ? x : (x?.name || ''))).filter(Boolean) : [];
                cemSugList.innerHTML = names.length
                    ? names.map(n => `<li>${n}</li>`).join('')
                    : '<li class="no-results">Збігів не знайдено</li>';
                cemSugList.classList.add('show');
            } catch {
                cemSugList.innerHTML = '<li class="no-results">Помилка завантаження</li>';
                cemSugList.classList.add('show');
            }
        };

        // Show list immediately on focus (no typing required)
        cemInput.addEventListener('focus', fetchRelCemeteries);
        // Filter while typing
        cemInput.addEventListener('input', fetchRelCemeteries);

        // Pick cemetery from list
        cemSugList.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (!li || li.classList.contains('no-results')) return;
            cemInput.value = li.textContent.trim();
            cemSugList.classList.remove('show');
            triggerFetch(); // cemetery filter applied
        });

        // Cemetery CLEAR (Fix #3)
        cemClear?.addEventListener('click', (e) => {
            e.preventDefault();
            cemInput.value = '';
            cemSugList.classList.remove('show');
            triggerFetch();
        });

        // Clicking outside suggestions → close them
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.suggestions-container')) {
                cemSugList.classList.remove('show');
                if (areaSug) areaSug.style.display = 'none';
            }
        });

        const triggerFetch = debounce(fetchPeople, 300);

        // ───────────────── Collect modal state (FIXED)
        function collectRelModalState() {
            return {
                reopen: true,
                filters: {
                    search: nameInput?.value?.trim() || '',
                    area: areaInput?.value?.trim() || '',
                    cemetery: cemInput?.value?.trim() || '',
                    birthYear: birthInput?.value?.trim() || '',
                    deathYear: deathInput?.value?.trim() || ''
                },
                selected: (selected || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    avatarUrl: p.avatarUrl,
                    birthYear: p.birthYear,
                    deathYear: p.deathYear,
                    relationship: p.relationship || ''
                })),
                // Also save the years display state
                yearsState: {
                    selectedBirth,
                    selectedDeath,
                    displayText: display?.textContent || 'Рік народження та смерті',
                    hasValue: display?.classList?.contains('has-value') || false
                }
            };
        }

        // ───────────────── Save modal state (FIXED)
        function saveModalState() {
            const state = collectRelModalState();
            try {
                sessionStorage.setItem(relReturnKey(personId), JSON.stringify(state));
                console.log('Modal state saved:', state);
            } catch (error) {
                console.error('Failed to save modal state:', error);
            }
        }

        // ───────────────── Fetch people (only when any filter is set)
        async function fetchPeople() {
            const foundLabel = document.getElementById('foundLabel');
            const noResults = document.getElementById('noResults');

            const hasFilter =
                (nameInput.value || '').trim() ||
                (birthInput.value || '').trim() ||
                (deathInput.value || '').trim() ||
                (areaInput.value || '').trim() ||
                (cemInput.value || '').trim();

            // No filters → clear list & counters, hide labels
            if (!hasFilter) {
                foundList.innerHTML = '';
                foundCountEl.textContent = '0';
                if (foundLabel) foundLabel.hidden = true;
                if (noResults) noResults.hidden = true;
                return;
            }

            // Build query
            const p = new URLSearchParams();
            const nm = (nameInput.value || '').trim();
            const ar = (areaInput.value || '').trim();
            const cm = (cemInput.value || '').trim();
            const by = (birthInput.value || '').trim();
            const dy = (deathInput.value || '').trim();

            if (nm) p.set('search', nm);
            if (ar) p.set('area', ar);
            if (cm) p.set('cemetery', cm);
            if (by) p.set('birthYear', by);
            if (dy) p.set('deathYear', dy);

            // Fetch
            const res = await fetch(`${API_URL}/api/people?${p.toString()}`);
            const data = await res.json().catch(() => ({ people: [] }));
            const raw = Array.isArray(data.people) ? data.people : [];

            // Exclude already selected and (optionally) the current person
            const list = raw
                .filter(x => !selected.some(s => s.id === x.id))
                .filter(x => String(x.id) !== String(personId));

            // Render
            foundList.innerHTML = list.map(p => `
              <li data-id="${p.id}" tabindex="0">
                <img class="avatar" src="${p.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'}" alt="">
                <div class="info">
                  <div class="name">${p.name || ''}</div>
                  <div class="years">${(p.birthYear || '')} – ${(p.deathYear || '')}</div>
                </div>
                <button class="select-btn" type="button" aria-label="Додати"><img src="/img/plus-icon.png" alt="Додати" class="plus-icon" width="24" height="24"></button>
              </li>`).join('');

            // Counters + empty state labels
            foundCountEl.textContent = String(list.length);
            if (foundLabel) foundLabel.hidden = list.length === 0;
            if (noResults) noResults.hidden = list.length !== 0;

            // (+) add to selected
            foundList.querySelectorAll('li button.select-btn').forEach(btn => {
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const li = btn.closest('li[data-id]');
                    if (!li) return;
                    const id = li.dataset.id;
                    const person = list.find(x => x.id === id);
                    if (!person) return;
                    selected.push(person);
                    renderSelected();
                    triggerFetch();
                });
            });

            // Row click → open profile (FIXED: moved outside fetchPeople)
        }

        // ───────────────── Handle clicks on found list items (FIXED: moved outside fetchPeople)
        foundList.addEventListener('click', (e) => {
            if (e.target.closest('button.select-btn')) return; // ignore (+)

            const li = e.target.closest('li[data-id]');
            if (!li) return;

            const id = li.dataset.id;

            // Save state before navigation
            saveModalState();

            // Navigate to profile with back reference
            window.location.href = `/profile.html?personId=${encodeURIComponent(id)}&from=profile&backTo=${encodeURIComponent(personId)}`;
        });

        // ───────────────── Render "Selected" (Fix #4: hide count row when 0)
        function renderSelected() {
            submitBtn.style.display = selected.length > 0 ? 'block' : 'none';

            selectedList.innerHTML = selected.map(p => {
                const rel = p.relationship || '';
                const label = rel || 'Вибрати';
                return `
                <li data-id="${p.id}">
                  <img class="avatar" src="${p.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'}" alt="">
                  <div class="info">
                    <div class="name">${p.name}</div>
                    <div class="meta">
                      <div class="years">${(p.birthYear || '')} – ${(p.deathYear || '')}</div>
          
                      <div class="rel-role">
                        <button class="rel-role-btn" type="button">
                          <span class="label">${label}</span>
                          <svg class="chev-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" 
                                viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" 
                                stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
          
                        <!-- reuse the same look as your search suggestions -->
                        <ul class="suggestions-list rel-role-list">
                          <li data-val="Батько">Батько</li>
                          <li data-val="Мати">Мати</li>
                          <li data-val="Брат">Брат</li>
                          <li data-val="Сестра">Сестра</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <button class="select-btn" type="button" aria-label="Прибрати"><img src="/img/minus-icon.png" alt="Видалити" class="minus-icon" width="24" height="24"></button>
                </li>`;
            }).join('');

            selCountEl.textContent = selected.length;
            if (selectedCountRow) selectedCountRow.style.display = selected.length ? '' : 'none';

            // Remove item
            selectedList.querySelectorAll('li button.select-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.closest('li').dataset.id;
                    selected = selected.filter(x => x.id !== id);
                    renderSelected();
                    triggerFetch();
                });
            });

            // Dropdown logic (open/close + pick)
            const closeAllRelRoleLists = () => {
                selectedList.querySelectorAll('.rel-role-list.show').forEach(u => u.classList.remove('show'));
            };

            // Open
            selectedList.querySelectorAll('.rel-role-btn').forEach(btn => {
                const wrap = btn.closest('.rel-role');
                const ul = wrap.querySelector('.rel-role-list');

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeAllRelRoleLists();
                    ul.classList.toggle('show');
                });

                // Pick
                ul.querySelectorAll('li[data-val]').forEach(li => {
                    li.addEventListener('click', () => {
                        const value = li.getAttribute('data-val');
                        const row = btn.closest('li[data-id]');
                        const id = row?.dataset.id;
                        const item = selected.find(x => x.id === id);
                        if (item) item.relationship = value;

                        // Update UI
                        ul.querySelectorAll('li').forEach(n => n.classList.remove('is-active'));
                        li.classList.add('is-active');
                        btn.querySelector('.label').textContent = value;
                        ul.classList.remove('show');
                    });
                });
            });

            // Close on outside click (bind once per modal)
            if (!overlay.__relRoleOutsideBound) {
                document.addEventListener('click', closeAllRelRoleLists);
                overlay.__relRoleOutsideBound = true;
            }
        }

        // Handle clicks on selected list items (FIXED)
        selectedList.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('.rel-role')) return; // ignore role picker/remove

            const li = e.target.closest('li[data-id]');
            if (!li) return;

            // Save state before navigation
            saveModalState();

            const nextId = li.dataset.id;
            window.location.href = `profile.html?personId=${encodeURIComponent(nextId)}&from=profile&backTo=${encodeURIComponent(personId)}`;
        });

        // ───────────────── Restore modal state (FIXED)
        function restoreModalState() {
            // Only restore when we are NOT navigating from another profile
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('from') === 'profile') {
                console.log('Navigation from profile detected, skipping restore');
                return;
            }

            try {
                const raw = sessionStorage.getItem(relReturnKey(personId));
                if (!raw) {
                    console.log('No saved modal state found');
                    return;
                }

                const saved = JSON.parse(raw);
                console.log('Restoring modal state:', saved);

                // Remove from session storage to prevent repeated restoration
                sessionStorage.removeItem(relReturnKey(personId));

                if (!saved?.reopen) return;

                // 1) Open modal first (this might reset some fields, but we'll restore them)
                openModal();

                // 2) Restore filters
                if (nameInput && saved.filters?.search) nameInput.value = saved.filters.search;
                if (areaInput && saved.filters?.area) areaInput.value = saved.filters.area;
                if (cemInput && saved.filters?.cemetery) cemInput.value = saved.filters.cemetery;
                if (birthInput && saved.filters?.birthYear) birthInput.value = saved.filters.birthYear;
                if (deathInput && saved.filters?.deathYear) deathInput.value = saved.filters.deathYear;

                // 3) Restore years display state
                if (saved.yearsState) {
                    selectedBirth = saved.yearsState.selectedBirth;
                    selectedDeath = saved.yearsState.selectedDeath;

                    if (display) {
                        display.textContent = saved.yearsState.displayText || 'Рік народження та смерті';
                        if (saved.yearsState.hasValue) {
                            display.classList.add('has-value');
                        } else {
                            display.classList.remove('has-value');
                        }
                    }

                    if (clearYears) {
                        clearYears.hidden = !saved.yearsState.hasValue;
                    }

                    // Restore year selections in the lists
                    if (selectedBirth && birthList) {
                        const birthItem = Array.from(birthList.children).find(li => li.textContent === selectedBirth);
                        if (birthItem) birthItem.classList.add('selected');
                    }

                    if (selectedDeath && deathList) {
                        const deathItem = Array.from(deathList.children).find(li => li.textContent === selectedDeath);
                        if (deathItem) deathItem.classList.add('selected');
                    }
                }

                // 4) Restore selected people
                selected = Array.isArray(saved.selected) ? saved.selected.slice() : [];
                renderSelected();

                // 5) Update UI elements
                updateAreaClearBtn?.();

                // 6) Trigger search with restored filters
                triggerFetch();

            } catch (error) {
                console.error('Failed to restore modal state:', error);
            }
        }

        // ───────────────── Open / Close
        function openModal() {
            // Only reset if we're not restoring state
            const isRestoring = sessionStorage.getItem(relReturnKey(personId));

            if (!isRestoring) {
                // reset fields
                nameInput.value = '';
                areaInput.value = '';
                cemInput.value = '';
                cemSugList.classList.remove('show');

                birthInput.value = deathInput.value = '';
                display.textContent = 'Рік народження та смерті';
                display.classList.remove('has-value');
                clearYears.hidden = true;

                // Reset years state
                selectedBirth = selectedDeath = undefined;
                birthList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                deathList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

                selected = [];
                renderSelected(); // will also hide selectedCountRow when empty

                foundList.innerHTML = '';
                foundCountEl.textContent = '0';
            }

            // Make sure years panel is closed when opening modal
            panel.classList.add('hidden');

            // hide Area clear initially
            if (areaClear) areaClear.style.display = 'none';

            overlay.hidden = false;
        }

        openers.forEach(el => el.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        }));

        closeBtn.addEventListener('click', () => overlay.hidden = true);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });

        // Allowed roles
        const ROLE_OPTIONS = ['Батько', 'Мати', 'Брат', 'Сестра'];

        // Submit (append to existing relatives instead of overriding)
        submitBtn.addEventListener('click', async () => {
            // 1) Build additions [{personId, role}] from this modal selection
            const additions = (selected || []).map(p => ({
                personId: p.id,
                role: p.relationship ? p.relationship : " "
            }));

            // 2) Merge with existing relLinks (append/update, no duplicates by personId)
            //    If same person already linked, new role from additions wins.
            const map = new Map(
                (Array.isArray(relLinks) ? relLinks : [])
                    .map(r => [String(r.personId), { personId: r.personId, role: r.role }])
            );
            additions.forEach(a => {
                if (String(a.personId) === String(personId)) return; // safety: не лінкуємо себе до себе
                map.set(String(a.personId), a);
            });

            const merged = Array.from(map.values());

            // 4) Persist and then reload
            try {
                const res = await fetch(`${API_BASE}/${personId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ relatives: merged })
                });
                if (!res.ok) {
                    const msg = await res.text().catch(() => res.statusText);
                    throw new Error(msg);
                }
                // Close modal then reload the page to reflect changes
                overlay.hidden = true;
                window.location.reload();
            } catch (e) {
                console.error('Failed to save relatives:', e);
                alert('Не вдалося зберегти родичів.');
            }
        });

        // Fields that can trigger fetch (after being applied/confirmed)
        nameInput.addEventListener('input', debounce(() => triggerFetch(), 300));
        // years → handled in yearsDone
        // area → on suggestion click
        // cemetery → on suggestion click

        // ───────────────── Initialize - Try to restore state on page load
        // Use a small delay to ensure all DOM elements are ready
        setTimeout(() => {
            restoreModalState();
        }, 100);

    })();
});
