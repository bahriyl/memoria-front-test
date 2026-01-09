document.addEventListener('DOMContentLoaded', () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // Config
    // ─────────────────────────────────────────────────────────────────────────────
    // const API_URL = 'http://0.0.0.0:5000'
    const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app';
    const API_BASE = `${API_URL}/api/people`;
    const PREMIUM_AUTH = `${API_URL}/api/premium`;

    const IMGBB_API_KEY = '726ae764867cf6b3a259967071cbdd80';

    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    const backTo = params.get('backTo');
    const backBtn = document.querySelector('.back-button');

    const personId = params.get('personId');
    const liturgyInvoiceId = params.get('liturgyInvoice');
    const liturgyDateParam = params.get('liturgyDate');
    if (!personId) return;

    let liturgyPaymentState = null;
    try {
        const raw = sessionStorage.getItem('liturgyPaymentState');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.invoiceId) {
                if (!parsed.personId || String(parsed.personId) === String(personId)) {
                    liturgyPaymentState = parsed;
                } else {
                    sessionStorage.removeItem('liturgyPaymentState');
                }
            }
        }
    } catch { }

    const pendingInvoiceId = liturgyInvoiceId || liturgyPaymentState?.invoiceId || null;
    const pendingDateISO = liturgyDateParam || liturgyPaymentState?.dateISO || null;

    const tokenKey = `people_token_${personId}`;
    const token = localStorage.getItem(tokenKey);

    if (token && !pendingInvoiceId) {
        const parts = [];
        if (from) parts.push(`from=${encodeURIComponent(from)}`);
        if (backTo) parts.push(`backTo=${encodeURIComponent(backTo)}`);
        const suffix = parts.length ? `&${parts.join('&')}` : '';
        window.location.replace(`/profile_edit.html?personId=${encodeURIComponent(personId)}${suffix}`);
        return;
    }

    backBtn?.addEventListener('click', (e) => {
        document.getElementById('avatar-menu')?.setAttribute('hidden', '');
        e.stopPropagation();
    });

    if (backBtn) {
        if (backTo) {
            backBtn.setAttribute('href', `profile.html?personId=${encodeURIComponent(backTo)}`);
        } else if (from === 'notable') {
            backBtn.setAttribute('href', 'notable.html');
        } else if (from === 'add_notable_person') {
            backBtn.setAttribute('href', 'add_notable_person.html');
        } else if (from === 'premium') {
            backBtn.setAttribute('href', 'premium_qr_person.html');
        } else {
            backBtn.setAttribute('href', 'index.html');
        }
    }

    // Scoped sessionStorage key for modal return state
    function relReturnKey(id) {
        return `relModalReturn:${id}`;
    }

    const toggleBtns = document.querySelectorAll('.toggle-password');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.password-wrapper').querySelector('input');
            const isVisible = input.type === 'text';
            input.type = isVisible ? 'password' : 'text';
            btn.classList.toggle('active', !isVisible);
            btn.setAttribute('aria-label', isVisible ? 'Показати пароль' : 'Приховати пароль');
        });
    });

    // ---- Scroll lock helpers ----
    const __isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let __scrollLockCount = 0;

    function lockScroll() {
        if (__scrollLockCount++ > 0) return; // вже залочено (підтримка вкладених модалок)
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        document.body.dataset.lockScrollY = String(y);

        if (__isIOS) {
            // iOS Safari: avoid body position:fixed to prevent font/zoom glitches on rotation
            Object.assign(document.body.style, {
                overflow: 'hidden',
                overscrollBehavior: 'contain',
            });
        } else {
            Object.assign(document.body.style, {
                position: 'fixed',
                top: `-${y}px`,
                left: '0',
                right: '0',
                width: '100%',
                overscrollBehavior: 'contain', // iOS/Android: не віддавати скрол вище
            });
        }
    }

    function unlockScroll() {
        if (--__scrollLockCount > 0) return; // ще є активні модалки
        const y = parseInt(document.body.dataset.lockScrollY || '0', 10);

        if (__isIOS) {
            Object.assign(document.body.style, {
                overflow: '',
                overscrollBehavior: '',
            });
        } else {
            Object.assign(document.body.style, {
                position: '',
                top: '',
                left: '',
                right: '',
                width: '',
                overscrollBehavior: '',
            });
            window.scrollTo(0, y);
        }

        delete document.body.dataset.lockScrollY;
    }

    const lockOverlay = document.getElementById('modal-overlay');
    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    let overlayLocked = false;
    let confirmLocked = false;

    const syncOverlayLock = () => {
        if (!lockOverlay) return;
        if (confirmDeleteModal && !confirmDeleteModal.hidden) return;
        const shouldLock = !lockOverlay.hidden;
        if (shouldLock && !overlayLocked) {
            lockScroll();
            overlayLocked = true;
        } else if (!shouldLock && overlayLocked) {
            unlockScroll();
            overlayLocked = false;
        }
    };

    const syncConfirmLock = () => {
        if (!confirmDeleteModal) return;
        const shouldLock = !confirmDeleteModal.hidden;
        if (shouldLock && !confirmLocked) {
            lockScroll();
            confirmLocked = true;
        } else if (!shouldLock && confirmLocked) {
            unlockScroll();
            confirmLocked = false;
        }
        if (!shouldLock) syncOverlayLock();
    };

    if (lockOverlay) {
        const overlayObserver = new MutationObserver(syncOverlayLock);
        overlayObserver.observe(lockOverlay, { attributes: true, attributeFilter: ['hidden'] });
    }
    if (confirmDeleteModal) {
        const confirmObserver = new MutationObserver(syncConfirmLock);
        confirmObserver.observe(confirmDeleteModal, { attributes: true, attributeFilter: ['hidden'] });
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
    if (fileInput) fileInput.accept = 'image/*';
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
    const donationError = document.getElementById('donation-error');
    const donationOk = document.getElementById('donation-ok');
    const donationCancel = document.getElementById('donation-cancel');
    const donationClose = document.getElementById('donation-close');
    let overlayPrevHandler = null;
    const liturgyPhoneModal = document.getElementById('liturgy-phone-modal');
    const liturgyPhoneInput = document.getElementById('liturgy-phone-input');
    const liturgyPhoneError = document.getElementById('liturgy-phone-error');
    const liturgyPhoneSubmit = document.getElementById('liturgy-phone-submit');
    const liturgyPhoneClose = document.getElementById('liturgy-phone-close');
    const liturgyResultModal = document.getElementById('liturgy-result-modal');
    const liturgyResultText = document.getElementById('liturgy-result-text');
    const liturgyResultOk = document.getElementById('liturgy-result-ok');
    let donationLayoutKey = '';

    let liturgiesIndex = {}; // { 'YYYY-MM-DD': [ { _id, churchName, price, createdAt, serviceDate } ] }

    function openSharedUploadedModal() {
        if (!overlayEl) return;

        // Create once
        let modal = document.getElementById('shared-upload-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'shared-upload-modal';
            modal.className = 'modal';
            modal.hidden = true;
            modal.innerHTML = `
            <button id="shared-upload-close" class="modal-close" aria-label="Закрити">
                <svg viewBox="0 0 30 30" width="28" height="28" aria-hidden="true">
                <path d="M7 7l10 10M17 7L7 17" stroke="#90959C" stroke-width="2" stroke-linecap="round"></path>
                </svg>
            </button>
            <p class="modal-text" style="font-weight: 480; font-size: 15px;">Успішно відправлено на модерацію.<br>Після модераціі фото буде доступно для перегляду</p>
            <div class="modal-actions">
                <button id="shared-upload-ok" class="modal-ok">Готово</button>
            </div>
            `;
            document.body.appendChild(modal);
        }

        const ok = modal.querySelector('#shared-upload-ok');
        const closeBtn = modal.querySelector('#shared-upload-close');

        // show
        overlayEl.hidden = false;
        modal.hidden = false;
        try { lockScroll?.(); } catch { }

        const close = () => {
            modal.hidden = true;
            overlayEl.hidden = true;
            try { unlockScroll?.(); } catch { }
        };

        ok?.addEventListener('click', close, { once: true });
        closeBtn?.addEventListener('click', close, { once: true });
        // also close by tapping outside the card
        overlayEl.addEventListener('click', close, { once: true });
    }

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

    function formatUaMonthName(date) {
        return date.toLocaleDateString('uk-UA', { month: 'long' });
    }

    function formatFullDate(y, m, d) {
        return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
    }

    function setSelectedDateDisplay(selectedDateEl, y, m, d) {
        if (!selectedDateEl) return '';
        const iso = toISOFromParts(y, m, d);
        selectedDateEl.dataset.iso = iso;
        selectedDateEl.dataset.day = String(d);
        selectedDateEl.dataset.month = String(m);
        selectedDateEl.dataset.year = String(y);
        selectedDateEl.textContent = formatUaMonthName(new Date(y, m - 1, d));
        return iso;
    }

    function clearSelectedDateDisplay(selectedDateEl) {
        if (!selectedDateEl) return;
        selectedDateEl.textContent = '';
        delete selectedDateEl.dataset.iso;
        delete selectedDateEl.dataset.day;
        delete selectedDateEl.dataset.month;
        delete selectedDateEl.dataset.year;
    }

    function updateVisibleMonthLabel() {
        const dateCalendar = document.querySelector('.date-calendar');
        const selectedDateEl = document.querySelector('.selected-date');
        if (!dateCalendar || !selectedDateEl) return;

        const items = Array.from(dateCalendar.querySelectorAll('.date-item'));
        if (!items.length) return;

        const rect = dateCalendar.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        let bestItem = null;
        let bestDist = Infinity;

        items.forEach((item) => {
            const itemRect = item.getBoundingClientRect();
            const itemCenter = itemRect.left + itemRect.width / 2;
            const dist = Math.abs(itemCenter - centerX);
            if (dist < bestDist) {
                bestDist = dist;
                bestItem = item;
            }
        });

        const month = parseInt(bestItem?.dataset?.month, 10);
        const year = parseInt(bestItem?.dataset?.year, 10);
        if (!month || !year) return;

        const label = formatUaMonthName(new Date(year, month - 1, 1));
        if (label && selectedDateEl.textContent !== label) {
            selectedDateEl.textContent = label;
        }
    }

    function getSelectedFullDate(selectedDateEl) {
        const day = Number(selectedDateEl?.dataset?.day);
        const month = Number(selectedDateEl?.dataset?.month);
        const year = Number(selectedDateEl?.dataset?.year);
        if (!day || !month || !year) return '';
        return formatFullDate(year, month, day);
    }

    function isPastISO(iso) {
        // compare by local midnight
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [y, m, d] = iso.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setHours(0, 0, 0, 0);
        return dt < today;
    }

    // Use the existing .liturgy-details as:
    //  - a swipeable strip for today/future dates (first card = compose, then existing),
    //  - a single non-swipe block for past dates.
    // Adds a pager (.liturgy-pager) under the strip to match the mock.
    function renderLiturgyDetailsStrip(iso) {
        const box = document.querySelector('.liturgy-details');
        if (!box) return;

        const host = box.parentElement;
        host?.querySelectorAll('.liturgy-pager').forEach(el => el.remove());

        const past = isPastISO(iso);
        const existing = Array.isArray(liturgiesIndex[iso]) ? liturgiesIndex[iso] : [];
        const sortedExisting = existing
            .slice()
            .sort((a, b) => new Date(b.createdAt || b.serviceDate) - new Date(a.createdAt || a.serviceDate));

        // Read current "compose" fields (keep your card design)
        const storedName = box.dataset.personName || '';
        const profileName = (nameEl?.textContent || '').trim();
        let pnText =
            profileName ||
            storedName ||
            box.querySelector('.person-name')?.textContent?.trim() ||
            document.querySelector('.profile-name')?.textContent?.trim() ||
            '';
        if (!pnText) {
            const entryName = sortedExisting
                .map(it => (it.personName || '').trim())
                .find(Boolean);
            if (entryName) {
                pnText = entryName;
            }
        }
        if (pnText) {
            box.dataset.personName = pnText;
        }

        const storedInfo = box.dataset.serviceInfo || '';
        const infoText =
            storedInfo ||
            box.querySelector('.service-info')?.textContent?.trim() ||
            document.querySelector('.service-info')?.textContent?.trim() || '';
        if (infoText) {
            box.dataset.serviceInfo = infoText;
        }

        if (past) {
            box.classList.remove('is-strip');
            box.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.className = 'liturgy-details';

            const status = document.createElement('span');
            status.className = 'liturgy-status is-done';
            status.textContent = 'Завершено';

            const pnEl = document.createElement('div');
            pnEl.className = 'person-name';
            pnEl.textContent = pnText;

            const siEl = document.createElement('div');
            siEl.className = 'service-info';
            if (sortedExisting.length) {
                const latest = sortedExisting[0];
                const d = new Date(latest.serviceDate || latest.createdAt || iso);
                const dateUa = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const churchName = latest.churchName || 'Церква';
                siEl.innerHTML = `Божественна Літургія за упокій відбулась у <span style="font-weight:550;">${churchName}, ${dateUa} р.</span>`;
            } else {
                siEl.textContent = infoText;
            }

            wrap.append(status, pnEl, siEl);
            box.appendChild(wrap);
            return;
        }

        // Today/Future → swipe strip
        box.classList.add('is-strip');
        box.innerHTML = '';

        const selectedChurch = document.querySelector('.church-btn.selected')?.textContent?.trim();
        let dateUa = '';
        if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            const d = new Date(iso);
            dateUa = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        const composeInfo = selectedChurch
            ? `Божественна Літургія за упокій відбудеться у <span style="font-weight:550;">${selectedChurch}</span>${dateUa ? `, <span style="font-weight:550;">${dateUa} р.</span>` : ''}`
            : `Божественна Літургія за упокій відбудеться у <span style="font-weight:550;">Оберіть церкву</span>${dateUa ? `, <span style="font-weight:550;">${dateUa} р.</span>` : ''}`;

        // 1) compose card (first)
        const compose = document.createElement('div');
        compose.className = 'liturgy-details';
        compose.innerHTML = `
        <div class="person-name">${pnText}</div>
        <div class="service-info">${composeInfo}</div>
        `;
        box.appendChild(compose);

        // 2) existing cards
        sortedExisting.forEach((it) => {
            const d = new Date(it.serviceDate || it.createdAt || iso);
            const dateIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const isPast = isPastISO(dateIso);

            const dateUa = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const cardName = (it.personName || '').trim() || pnText;

            const card = document.createElement('div');
            card.className = 'liturgy-details';

            const status = document.createElement('span');
            status.className = 'liturgy-status' + (isPast ? ' is-done' : '');
            status.textContent = isPast ? 'Завершено' : 'На черзі';

            card.innerHTML = `
    <div class="person-name">${cardName}</div>
    <div class="service-info">Божественна Літургія за упокій відбудеться у
      <span style="font-weight:550;">${it.churchName}, ${dateUa} р.</span>
    </div>
  `;
            card.prepend(status);
            box.appendChild(card);
        });

        // --- pager (dots) under the strip, like in the mock ---
        const total = box.children.length;
        if (total > 1) {
            const pager = document.createElement('div');
            pager.className = 'liturgy-pager';
            for (let i = 0; i < total; i++) {
                const pip = document.createElement('span');
                pip.className = 'pip' + (i === 0 ? ' is-active' : '');
                pip.dataset.index = String(i);
                pager.appendChild(pip);
            }
            // insert right after the strip
            box.parentNode.insertBefore(pager, box.nextSibling);

            // tap on dot → scroll to card
            pager.addEventListener('click', (e) => {
                const pip = e.target.closest('.pip');
                if (!pip) return;
                const i = Number(pip.dataset.index);
                const target = box.children[i];
                target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            });

            // update active dot while scrolling
            const updateActive = () => {
                // find the card whose left edge is closest to the container’s left
                let best = 0;
                let bestDist = Infinity;
                for (let i = 0; i < total; i++) {
                    const el = box.children[i];
                    const dist = Math.abs(el.getBoundingClientRect().left - box.getBoundingClientRect().left);
                    if (dist < bestDist) { bestDist = dist; best = i; }
                }
                pager.querySelectorAll('.pip').forEach((p, idx) => {
                    p.classList.toggle('is-active', idx === best);
                });
            };
            box.addEventListener('scroll', () => { window.requestAnimationFrame(updateActive); }, { passive: true });
            // initial state
            updateActive();
        }
    }

    function resetLiturgyStripPosition() {
        const box = document.querySelector('.liturgy-details.is-strip');
        if (!box) return;
        box.scrollTo({ left: 0, behavior: 'smooth' });
        const pager = box.parentElement?.querySelector('.liturgy-pager');
        if (pager) {
            const dots = pager.querySelectorAll('.pip');
            dots.forEach((dot, idx) => dot.classList.toggle('is-active', idx === 0));
        }
    }

    // Mark the original "Інше" button as custom so we can always detect it
    const customDonationBtn = Array.from(donationOptions?.querySelectorAll('.donation-btn') || [])
        .find(btn => btn.textContent.trim() === 'Інше');
    if (customDonationBtn) {
        customDonationBtn.dataset.custom = '1';
    }

    function showDonationError(message) {
        if (!donationError) return;
        donationError.textContent = message;
        donationError.hidden = false;
    }

    function clearDonationError() {
        if (!donationError) return;
        donationError.textContent = '';
        donationError.hidden = true;
    }

    function openDonationModal(presetValue = '') {
        if (!donationModal || !overlayEl) return;
        donationInput.value = presetValue || '';
        clearDonationError();
        overlayEl.hidden = false;
        overlayPrevHandler = overlayEl.onclick;
        overlayEl.onclick = () => closeDonationModal();
        donationModal.hidden = false;
        // focus after paint
        requestAnimationFrame(() => donationInput?.focus());
    }

    function closeDonationModal() {
        if (!donationModal || !overlayEl) return;
        overlayEl.onclick = overlayPrevHandler;
        overlayPrevHandler = null;
        donationModal.hidden = true;
        overlayEl.hidden = true;
        clearDonationError();
    }

    function formatUaPhone(value) {
        let digits = String(value || '').replace(/\D/g, '');
        if (digits.startsWith('380')) digits = digits.slice(3);
        if (digits.startsWith('0')) digits = digits.slice(1);
        digits = digits.slice(0, 9);
        if (!digits.length) return '';
        const part1 = digits.slice(0, 2);
        const part2 = digits.slice(2, 5);
        const part3 = digits.slice(5, 9);
        let formatted = `+380(${part1}`;
        if (part1.length === 2) formatted += ')';
        if (part2.length) formatted += `-${part2}`;
        if (part3.length) formatted += `-${part3}`;
        return formatted;
    }

    function openLiturgyPhoneModal() {
        if (!liturgyPhoneModal || !overlayEl) return;
        if (liturgyPhoneError) {
            liturgyPhoneError.textContent = '';
            liturgyPhoneError.hidden = true;
        }
        if (liturgyPhoneSubmit) liturgyPhoneSubmit.disabled = false;
        if (liturgyPhoneInput) liturgyPhoneInput.value = '';
        overlayEl.hidden = false;
        overlayPrevHandler = overlayEl.onclick;
        overlayEl.onclick = () => closeLiturgyPhoneModal();
        liturgyPhoneModal.hidden = false;
        requestAnimationFrame(() => liturgyPhoneInput?.focus());
    }

    function closeLiturgyPhoneModal() {
        if (!liturgyPhoneModal || !overlayEl) return;
        overlayEl.onclick = overlayPrevHandler;
        overlayPrevHandler = null;
        liturgyPhoneModal.hidden = true;
        overlayEl.hidden = true;
        if (liturgyPhoneError) {
            liturgyPhoneError.textContent = '';
            liturgyPhoneError.hidden = true;
        }
        releaseLiturgySubmitState();
    }

    donationInput?.addEventListener('input', () => {
        if (donationError && !donationError.hidden) {
            clearDonationError();
        }
    });

    let pendingLiturgyPayload = null;
    let pendingLiturgyBtn = null;

    function releaseLiturgySubmitState() {
        if (pendingLiturgyBtn) {
            pendingLiturgyBtn.disabled = false;
            delete pendingLiturgyBtn.dataset.busy;
            pendingLiturgyBtn = null;
        }
        pendingLiturgyPayload = null;
    }

    liturgyPhoneInput?.addEventListener('input', () => {
        if (liturgyPhoneError && !liturgyPhoneError.hidden) {
            liturgyPhoneError.textContent = '';
            liturgyPhoneError.hidden = true;
        }
        liturgyPhoneInput.value = formatUaPhone(liturgyPhoneInput.value);
    });

    liturgyPhoneInput?.addEventListener('blur', () => {
        liturgyPhoneInput.value = formatUaPhone(liturgyPhoneInput.value);
    });

    liturgyPhoneClose?.addEventListener('click', () => {
        closeLiturgyPhoneModal();
        releaseLiturgySubmitState();
    });

    liturgyPhoneSubmit?.addEventListener('click', async () => {
        if (!pendingLiturgyPayload) return;
        if (!liturgyPhoneInput) return;

        const formatted = formatUaPhone(liturgyPhoneInput.value);
        liturgyPhoneInput.value = formatted;
        const digits = formatted.replace(/\D/g, '');
        if (digits.length !== 12) {
            if (liturgyPhoneError) {
                liturgyPhoneError.textContent = 'Введіть коректний номер телефону';
                liturgyPhoneError.hidden = false;
            }
            return;
        }

        liturgyPhoneSubmit.disabled = true;

        try {
            const amount = Math.round(pendingLiturgyPayload.price * 100);
            const redirectUrl = `${window.location.origin}/profile.html?personId=${encodeURIComponent(personId)}&liturgyDate=${encodeURIComponent(pendingLiturgyPayload.dateISO)}`;
            const invoiceRes = await fetch(`${API_URL}/api/merchant/invoice/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    ccy: 980,
                    redirectUrl,
                    webHookUrl: `${API_URL}/api/monopay/webhook`,
                    merchantPaymInfo: {
                        destination: 'Оплата записки',
                        comment: `Літургія ${pendingLiturgyPayload.churchName || ''}`.trim()
                    }
                })
            });
            if (!invoiceRes.ok) throw new Error('Не вдалось створити інвойс');
            const { invoiceId, pageUrl } = await invoiceRes.json();

            const personName = document.querySelector('.profile-name')?.textContent?.trim() || '';
            const createRes = await fetch(`${API_URL}/api/liturgies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personId,
                    personName,
                    date: pendingLiturgyPayload.dateISO,
                    churchName: pendingLiturgyPayload.churchName,
                    price: pendingLiturgyPayload.price,
                    phone: formatted,
                    invoiceId,
                    paymentMethod: 'online',
                    paymentStatus: 'pending'
                })
            });
            if (!createRes.ok) {
                const text = await createRes.text().catch(() => '');
                throw new Error(text || 'Не вдалося створити записку');
            }

            try {
                sessionStorage.setItem('liturgyPaymentState', JSON.stringify({
                    invoiceId,
                    dateISO: pendingLiturgyPayload.dateISO,
                    personId
                }));
            } catch { }

            window.location.href = pageUrl;
        } catch (err) {
            console.error('Liturgy payment failed:', err);
            if (liturgyPhoneError) {
                liturgyPhoneError.textContent = err.message || 'Сталася помилка під час оплати';
                liturgyPhoneError.hidden = false;
            }
            liturgyPhoneSubmit.disabled = false;
        }
    });

    function selectDonationButton(btn) {
        // clear previous selection
        donationOptions?.querySelectorAll('.donation-btn').forEach(b => b.classList.remove('selected'));
        // select this one
        btn?.classList.add('selected');
    }

    function updateDonationButtonsLayout(force = false) {
        if (!donationOptions) return;
        const buttons = Array.from(donationOptions.querySelectorAll('.donation-btn'));
        if (!buttons.length) return;

        const nextKey = `${donationOptions.clientWidth}|${buttons.map(b => b.textContent.trim()).join('|')}`;
        if (!force && nextKey === donationLayoutKey) return;
        donationLayoutKey = nextKey;

        // reset any previous wrapped state / overrides
        buttons.forEach(btn => {
            btn.classList.remove('donation-btn--wrapped');
            btn.style.order = '';
            btn.style.minWidth = '';
        });

        // measure after layout:
        //  - find first row buttons and their width
        //  - if a first-row button's free horizontal space <= 1px,
        //    move it to next line and ensure its width is at least
        //    as wide as first-row buttons.
        requestAnimationFrame(() => {
            if (!buttons.length) return;

            const tops = buttons.map(b => b.offsetTop || 0);
            const firstTop = Math.min(...tops);
            const firstRow = buttons.filter(b => (b.offsetTop || 0) <= firstTop + 1);
            if (!firstRow.length) return;

            const firstRowWidth = Math.max(...firstRow.map(b => b.clientWidth || 0));

            buttons.forEach(btn => {
                const top = btn.offsetTop || 0;
                const inFirstRow = top <= firstTop + 1;
                const client = btn.clientWidth || 0;
                const scroll = btn.scrollWidth || 0;
                const freeSpace = client - scroll; // may be negative if overflowing

                const needsWrap = inFirstRow && freeSpace <= 1;

                if (needsWrap) {
                    // push to next line and keep at least first-row width
                    btn.classList.add('donation-btn--wrapped');
                    btn.style.order = '1';
                    if (firstRowWidth > 0) {
                        btn.style.minWidth = `${firstRowWidth}px`;
                    }
                } else if (!inFirstRow) {
                    // already wrapped by layout – ensure minimum width matches first row
                    btn.classList.add('donation-btn--wrapped');
                    if (firstRowWidth > 0) {
                        btn.style.minWidth = `${firstRowWidth}px`;
                    }
                }
            });
        });
    }

    donationOptions?.addEventListener('click', (e) => {
        const btn = e.target.closest('.donation-btn');
        if (!btn) return;

        const isSelected = btn.classList.contains('selected');
        if (isSelected) {
            btn.classList.remove('selected');
            resetLiturgyStripPosition();
            updateDonationButtonsLayout();
            return;
        }

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
        resetLiturgyStripPosition();
        updateDonationButtonsLayout();
    });

    // Modal buttons
    donationCancel?.addEventListener('click', closeDonationModal);
    donationClose?.addEventListener('click', closeDonationModal);

    // Confirm custom sum
    donationOk?.addEventListener('click', () => {
        const btn = donationModal?._targetBtn || customDonationBtn;
        const raw = (donationInput?.value || '').trim();
        const amount = parseInt(raw, 10);
        const isEmpty = !raw || Number.isNaN(amount);

        if (isEmpty) {
            // No sum entered → just close modal and reset button label
            if (btn && btn.dataset && btn.dataset.custom === '1') {
                btn.textContent = 'Інше';
                delete btn.dataset.amount;
                btn.classList.remove('selected');
            }
            closeDonationModal();
            updateDonationButtonsLayout();
            return;
        }

        if (amount <= 49) {
            showDonationError('Введіть коректну суму (мінімум 50 грн).');
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
        resetLiturgyStripPosition();
        updateDonationButtonsLayout();
    });

    // Initial layout and on resize (e.g. orientation change)
    updateDonationButtonsLayout();
    window.addEventListener('resize', updateDonationButtonsLayout);

    // Dots popup options (if present)
    document.getElementById('bio-edit-option')?.addEventListener('click', () => bioEditBtn?.click());
    document.getElementById('photos-add-option')?.addEventListener('click', () => {
        const limit = typeof MAX_PHOTOS !== 'undefined' ? MAX_PHOTOS : (window.MAX_PHOTOS || 20);
        const currentCount = persistedMedia().length;
        if (currentCount >= limit) {
            openInfoModal(premiumLimitMessage());
            return;
        }
        addPhotoBtn?.click();
    });
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

    const handleAvatarMenuOutsideClick = (event) => {
        if (!avatarMenu || avatarMenu.hasAttribute('hidden')) return;

        const clickedInsideMenu = event.target.closest('#avatar-menu');
        const clickedCardButton = event.target.closest('.avatar-menu-card button');

        // Якщо клікнули по кнопці в меню → нічого не робимо
        if (clickedCardButton) return;

        // Якщо клікнули десь у меню (але не на кнопці) → закриваємо
        if (clickedInsideMenu) {
            closeAvatarMenu();
            return;
        }

        // Якщо клікнули аватар/герой або будь-де поза меню → теж закриваємо
        const clickedAvatar = event.target.closest('.profile-avatar');
        const clickedHero = event.target.closest('.profile-hero');
        if (clickedAvatar || clickedHero || !clickedInsideMenu) {
            closeAvatarMenu();
        }
    };

    function openAvatarMenu() {
        if (!avatarEl || !avatarMenu) return;

        const hasAvatar = avatarEl.src && !avatarEl.src.includes('https://i.ibb.co/ycrfZ29f/Frame-542.png');

        // показ кнопок за станом
        avatarAddBtn.style.display = hasAvatar ? 'none' : '';
        avatarChangeBtn.style.display = hasAvatar ? '' : 'none';
        avatarDeleteBtn.style.display = hasAvatar ? '' : 'none';

        avatarMenu.hidden = false;
        document.addEventListener('click', handleAvatarMenuOutsideClick, true);
    }

    // Закрити меню
    function closeAvatarMenu() {
        if (!avatarMenu) return;
        avatarMenu.hidden = true;
        document.removeEventListener('click', handleAvatarMenuOutsideClick, true);
    }

    // avatar click
    avatarEl?.addEventListener('click', (e) => {
        if (typeof premiumLock !== 'undefined' && premiumLock && !token) return; // hardened
        e.stopPropagation();
        openAvatarMenu();
    });

    // hero click
    heroEl?.addEventListener('click', (e) => {
        if (e.target.closest('.back-button')) return;
        if (typeof premiumLock !== 'undefined' && premiumLock && !token) return; // hardened
        const picker = document.getElementById('hero-picker');
        if (picker && !picker.hidden) return;
        e.stopPropagation();
        openAvatarMenu();
    });

    avatarMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
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

    async function updateAvatar(payload) {
        // payload can be: null | string (cropped only) | { avatarUrl, portraitUrl }
        let body;
        if (payload == null) {
            body = { avatarUrl: null, portraitUrl: null };          // delete both
        } else if (typeof payload === 'string') {
            body = { avatarUrl: payload };                           // backward-compat
        } else {
            body = {
                avatarUrl: payload.avatarUrl || null,
                portraitUrl: payload.portraitUrl || null
            };
        }

        try {
            const res = await fetch(`${API_BASE}/${personId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(await res.text());
            const updated = await res.json();

            // keep UI in sync with cropped avatar
            avatarEl.src = updated.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png';
        } catch (err) {
            console.error('Update avatar failed', err);
            alert('Не вдалося оновити фото профілю');
        }
    }

    // Add new avatar
    avatarAddBtn?.addEventListener('click', () => {
        closeAvatarMenu();
        avatarInput.click();
    });

    avatarChangeBtn?.addEventListener('click', () => {
        closeAvatarMenu();
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

            // Fallback when the modal isn't present:
            if (!overlay || !modal || !stage || !img || !btnOk || !btnCancel) {
                // return both pointing to the original so the rest of the flow still works
                resolve({ cropped: file, original: file });
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
                                resolve({ cropped: blob, original: file });
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
            // 1) Crop
            const { cropped, original } = await openAvatarCropper(file); // now returns both

            // 2) Upload both in parallel
            const [croppedUrl, originalUrl] = await Promise.all([
                uploadAvatarToImgBB(cropped),
                uploadAvatarToImgBB(original)
            ]);

            // 3) Save both (cropped for avatar, original for notable)
            await updateAvatar({ avatarUrl: croppedUrl, portraitUrl: originalUrl });

            location.reload();
        } catch (err) {
            // cancelled or failed
        } finally {
            avatarInput.value = '';
            hideAvatarSpinner();
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
    // HERO CHANGE (background)
    // ─────────────────────────────────────────────────────────────────────────────
    const heroChangeBtn = document.getElementById('hero-change');
    const heroOverlay = document.getElementById('hero-overlay');
    const heroPicker = document.getElementById('hero-picker');
    const heroGrid = document.getElementById('hero-grid');
    const heroCancel = document.getElementById('hero-cancel');
    const heroApply = document.getElementById('hero-apply');

    let selectedHeroUrl = '';
    let originalHeroInlineBg = '';

    const HERO_PRESETS = [
        'img/hero1.jpg',
        'img/hero2.jpg',
        'img/hero3.jpg'
    ];

    function openHeroPicker() {
        if (!heroOverlay || !heroPicker || !heroGrid || !heroEl) return;

        originalHeroInlineBg = heroEl.style.backgroundImage || '';

        document.body.classList.add('hero-changing'); // hide avatar
        heroOverlay.hidden = false;
        heroPicker.hidden = false;

        // build grid
        heroGrid.innerHTML = '';
        const currentBg = getComputedStyle(heroEl).backgroundImage
            .replace(/^url\(["']?/, '')
            .replace(/["']?\)$/, '');
        HERO_PRESETS.forEach((url) => {
            const cell = document.createElement('div');
            cell.className = 'hero-option';
            cell.innerHTML = `<img src="${url}" alt="">`;
            cell.addEventListener('click', () => {
                const alreadySelected = cell.classList.contains('is-selected');

                // clear all selections first
                heroGrid.querySelectorAll('.hero-option').forEach(o => o.classList.remove('is-selected'));

                if (alreadySelected) {
                    // toggle OFF → no selection
                    selectedHeroUrl = '';
                    if (heroApply) heroApply.disabled = true;

                    // restore the hero to whatever it had before picker opened
                    heroEl.style.backgroundImage = originalHeroInlineBg;  // '' → falls back to CSS default
                } else {
                    // select this one
                    cell.classList.add('is-selected');
                    selectedHeroUrl = url;
                    if (heroApply) heroApply.disabled = false;

                    // live preview
                    heroEl.style.backgroundImage = `url(${url})`;
                }
            });

            // preselect if matches current
            if (currentBg && currentBg === url) {
                cell.classList.add('is-selected');
                selectedHeroUrl = url;
                heroApply.disabled = false;
            }
            heroGrid.appendChild(cell);
        });

        // focus primary button for a11y
        requestAnimationFrame(() => heroApply?.focus());
    }

    function closeHeroPicker(reset = false) {
        if (!heroOverlay || !heroPicker) return;
        heroOverlay.hidden = true;
        heroPicker.hidden = true;
        document.body.classList.remove('hero-changing');
        if (reset) location.reload();
    }

    async function updateHeroImage(url) {
        try {
            const res = await fetch(`${API_BASE}/${personId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ heroImage: url })
            });
            if (!res.ok) throw new Error(await res.text());
            // ensure UI reflects server state
            location.reload();
        } catch (e) {
            console.error('Update hero failed', e);
            alert('Не вдалося оновити фон профілю');
        }
    }

    heroChangeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        // same guard as avatar menu (respect premium lock)
        if (premiumLock && !token) return;
        // close avatar menu if open
        try { document.getElementById('avatar-menu').hidden = true; } catch { }
        openHeroPicker();
    });

    heroCancel?.addEventListener('click', () => closeHeroPicker(true)); // Скасувати → reload
    heroOverlay?.addEventListener('click', () => { /* ignore clicks behind */ });
    heroApply?.addEventListener('click', () => {
        if (!selectedHeroUrl) return;
        updateHeroImage(selectedHeroUrl); // Встановити → PUT heroImage
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
                menu.style.display = '';
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
    let premiumPhoneMasked = '';
    let premiumHasPhone = false;
    let sharedPending = []; // [{url}]  — запропоновані гостями (pending)
    let sharedPhotos = []; // [{url, description?}] — прийняті
    let sharedSelecting = false;     // режим вибору для прийнятих (не використовується гостем)
    let sharedSelectedOrder = [];

    const nonBlobPhotos = () =>
        (photos || []).filter((u) => typeof u === 'string' && u && !u.startsWith('blob:'));
    const isBlobUrl = (u) => typeof u === 'string' && u.startsWith('blob:');
    function normalizeMediaItem(item) {
        if (!item) return null;
        if (typeof item === 'string') {
            const url = item.trim();
            return url ? { url, description: '' } : null;
        }
        const description =
            typeof item.description === 'string'
                ? item.description
                : item.description != null
                    ? String(item.description)
                    : '';
        if (typeof item.url === 'string' && item.url.trim()) {
            const url = item.url.trim();
            if (isBlobUrl(url)) return null;
            return { url, description };
        }
        const video = item.video;
        if (video && typeof video.player === 'string' && video.player.trim()) {
            const player = video.player.trim();
            const out = { player };
            if (typeof video.poster === 'string' && video.poster.trim()) {
                out.poster = video.poster.trim();
            }
            return { video: out, description };
        }
        return null;
    }
    const persistedMedia = () =>
        (photos || [])
            .map(normalizeMediaItem)
            .filter(Boolean);
    function isBlob(u) { return typeof u === 'string' && u.startsWith('blob:'); }

    // ─────────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────────
    // Гість: показуємо тільки “Добавити”, ховаємо “Вибрати”
    document.getElementById('shared-choose-option')?.setAttribute('hidden', '');
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
                    const url = new URL('profile.html', location.origin);
                    url.searchParams.set('personId', relative.id);
                    url.searchParams.set('from', 'profile');
                    url.searchParams.set('backTo', personId);
                    window.location.href = url.toString();
                }
            });

            relListEl.appendChild(el);
        });

        setRelativesControlsVisibility();
    }

    // Рендер
    function refreshSharedUI() {
        if (!sharedListEl) return;

        // Get the scroll container (parent of the UL)
        const sharedScroll = document.querySelector('.profile-shared .shared-scroll');
        if (!sharedScroll) return;

        const hasItems =
            (Array.isArray(sharedPending) && sharedPending.length > 0) ||
            (Array.isArray(sharedPhotos) && sharedPhotos.length > 0);

        if (!hasItems) {
            // Render full-width empty state like profile-photos
            sharedScroll.innerHTML = '<div class="photos-empty">Немає спільних фото</div>';
            return;
        }

        // Ensure UL exists inside the scroll container, then render items
        let ul = sharedScroll.querySelector('.shared-list');
        if (!ul) {
            ul = document.createElement('ul');
            ul.className = 'photos-list shared-list';
            sharedScroll.innerHTML = '';
            sharedScroll.appendChild(ul);
        }
        ul.innerHTML = '';

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
    async function submitSharedOffer(hostedUrl, description = '') {
        await fetch(`${API_BASE}/${personId}/shared/offer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: hostedUrl, description })
        });
    }

    // Клік “Добавити” → file input
    sharedAddBtn?.addEventListener('click', () => sharedInput?.click());

    // --- SHARED: keep photos-only (backend shared/offer expects {url}) ---
    if (sharedInput) sharedInput.accept = 'image/*';

    sharedInput?.addEventListener('change', async () => {
        const files = Array.from(sharedInput.files || []);
        if (!files.length) return;

        // не даємо відео
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (!imageFiles.length) {
            sharedInput.value = '';
            return;
        }

        // 1) додамо одразу локальні blob-и, щоб показати "Завантаження..."
        const optimisticBlobs = [];
        imageFiles.forEach((file) => {
            const blobUrl = URL.createObjectURL(file);
            // показуємо ПЕРШИМИ
            sharedPending.unshift({ url: blobUrl });
            optimisticBlobs.push({ file, blobUrl });
        });
        // одразу перемальовуємо з оверлеєм
        refreshSharedUI?.();

        // локальна функція аплоаду (ми її вже мали вище, але щоб не шукати)
        async function uploadToImgBB(file) {
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

        try {
            // 2) аплоадимо по одному
            for (const item of optimisticBlobs) {
                const hostedUrl = await uploadToImgBB(item.file);

                // відправляємо оффер на бек
                await fetch(`${API_BASE}/${personId}/shared/offer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: hostedUrl })
                });

                // 3) після успішного аплоаду — прибираємо саме цей blob
                const idx = sharedPending.findIndex(p => p.url === item.blobUrl);
                if (idx !== -1) {
                    sharedPending.splice(idx, 1);
                }
                refreshSharedUI?.();

                // приберемо blob з пам’яті
                try { URL.revokeObjectURL(item.blobUrl); } catch (e) { }
            }

            // 4) показуємо модал "відправлено на модерацію"
            openSharedUploadedModal?.();
        } catch (err) {
            console.error('Shared upload failed', err);
            alert('Не вдалося надіслати у Спільний альбом');

            // при помилці — прибираємо ВСІ наші тимчасові блоби
            optimisticBlobs.forEach((item) => {
                const idx = sharedPending.findIndex(p => p.url === item.blobUrl);
                if (idx !== -1) sharedPending.splice(idx, 1);
                try { URL.revokeObjectURL(item.blobUrl); } catch (e) { }
            });
            refreshSharedUI?.();
        } finally {
            // очистити інпут
            sharedInput.value = '';
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
        closeBtnX.onclick = () => { unlockScroll(); document.body.removeChild(modal); };

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
        lockScroll();

        requestAnimationFrame(() => {
            const prev = track.style.scrollBehavior;
            track.style.scrollBehavior = 'auto';
            track.scrollLeft = startIndex * track.clientWidth;
            track.style.scrollBehavior = prev;
            updateIndicators(startIndex);
        });
    }

    function openMediaSlideshow(startIndex = 0) {
        if (!Array.isArray(photos) || !photos.length) return;

        // Build slideshow entries in the same visual order
        // as the profile-photos grid (which renders in reverse).
        const order = (photos || []).map((_, i) => i).slice().reverse();
        const mediaEntries = order
            .map((idx) => ({ idx, media: normalizeMediaItem(photos[idx]) }))
            .filter(entry => entry.media);
        if (!mediaEntries.length) return;

        const overlaySvg = `
      <svg viewBox="0 0 24 24" fill="white">
        <path d="M8 5v14l11-7z"></path>
      </svg>`;
        const pauseIcon = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14"></rect>
        <rect x="14" y="5" width="4" height="14"></rect>
      </svg>`;
        const fmt = (t) => (!isFinite(t) ? '00:00'
            : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`);

        const modal = document.createElement('div');
        modal.className = 'slideshow-modal';
        modal.classList.add('slideshow-modal-media');

        const closeBtnX = document.createElement('span');
        closeBtnX.textContent = '✕';
        closeBtnX.className = 'close-slideshow';

        const track = document.createElement('div');
        track.className = 'slideshow-track';

        const indicator = document.createElement('div');
        indicator.className = 'slideshow-indicators';

        const videoRefs = [];

        mediaEntries.forEach(({ media }, slideIdx) => {
            const slide = document.createElement('div');
            slide.className = 'slideshow-slide';
            slide.dataset.slideIndex = String(slideIdx);

            if (media.video) {
                slide.classList.add('is-video');
                const videoWrapper = document.createElement('div');
                videoWrapper.className = 'slideshow-video-wrapper';

                const video = document.createElement('video');
                video.src = media.video.player;
                video.poster = media.video.poster || '';
                video.controls = false;
                video.preload = 'metadata';
                video.playsInline = true;
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', '');
                video.className = 'slideshow-video';
                videoRefs.push({ el: video, slideIdx });
                videoWrapper.appendChild(video);

                const overlayBtn = document.createElement('button');
                overlayBtn.type = 'button';
                overlayBtn.className = 'overlay-play';
                overlayBtn.innerHTML = overlaySvg;
                videoWrapper.appendChild(overlayBtn);

                const controlsBar = document.createElement('div');
                controlsBar.className = 'slideshow-controls';

                const pauseBtn = document.createElement('button');
                pauseBtn.type = 'button';
                pauseBtn.className = 'hud-pill hud-left';
                pauseBtn.innerHTML = pauseIcon;
                controlsBar.appendChild(pauseBtn);

                const timeLabel = document.createElement('span');
                timeLabel.className = 'hud-pill hud-right';
                timeLabel.textContent = '00:00';
                controlsBar.appendChild(timeLabel);

                const progress = document.createElement('input');
                progress.type = 'range';
                progress.className = 'slideshow-progress';
                progress.min = '0';
                progress.max = '100';
                progress.step = '0.1';
                progress.value = '0';
                controlsBar.appendChild(progress);

                controlsBar.style.display = 'none';
                videoWrapper.appendChild(controlsBar);

                // position controls to the bottom edge of the rendered video (object-fit: contain)
                const updateControlsOffset = () => {
                    // межі врапера і самого відео
                    const wrapRect = videoWrapper.getBoundingClientRect();
                    const vidRect = video.getBoundingClientRect();
                    if (!wrapRect.width || !vidRect.width) return;

                    // скільки «чорного поля» знизу (або 0, якщо відео торкається низу)
                    const gap = Math.max(0, Math.round(wrapRect.bottom - vidRect.bottom));

                    // піднімаємо панель рівно до низу відео
                    controlsBar.style.bottom = `${gap}px`;
                };

                // реагуємо на всі зміни, що можуть вплинути на layout
                const ro = new ResizeObserver(updateControlsOffset);
                ro.observe(videoWrapper);
                ro.observe(video);
                window.addEventListener('resize', updateControlsOffset, { passive: true });
                video.addEventListener('loadedmetadata', updateControlsOffset);
                video.addEventListener('loadeddata', updateControlsOffset);
                requestAnimationFrame(updateControlsOffset);

                // (не обов'язково, але акуратно) прибрати спостерігач при закритті модалки:
                closeBtnX?.addEventListener('click', () => ro.disconnect(), { once: true });

                video.addEventListener('play', () => {
                    videoRefs.forEach(ref => {
                        if (ref.el !== video) ref.el.pause();
                    });
                });

                const syncProgress = () => {
                    if (!progress) return;
                    const ratio = (video.duration || 0) ? (video.currentTime / video.duration) : 0;
                    const pct = Math.min(100, Math.max(0, ratio * 100));
                    progress.value = String(pct);
                    progress.style.setProperty('--p', `${pct}%`);
                };
                const syncTime = () => {
                    if (timeLabel) timeLabel.textContent = `${fmt(video.currentTime)}`;
                };
                const syncState = () => {
                    const paused = video.paused;
                    overlayBtn.hidden = !paused;
                    if (controlsBar) controlsBar.style.display = paused ? 'none' : 'flex';
                    if (indicator) indicator.style.display = paused ? '' : 'none';
                };

                overlayBtn.addEventListener('click', () => {
                    if (video.paused) video.play(); else video.pause();
                });
                pauseBtn.addEventListener('click', () => video.pause());
                progress.addEventListener('input', (ev) => {
                    if (!video.duration) return;
                    const val = Number(ev.target.value);
                    if (!Number.isFinite(val)) return;
                    const clamped = Math.min(100, Math.max(0, val));
                    video.currentTime = (clamped / 100) * video.duration;
                    syncProgress();
                    syncTime();
                });

                // Pause when user taps the video area
                video.addEventListener('click', () => {
                    if (!video.paused) video.pause();
                });

                video.addEventListener('play', () => { syncState(); });
                video.addEventListener('pause', () => { syncState(); });
                video.addEventListener('timeupdate', () => { syncProgress(); syncTime(); });
                video.addEventListener('loadedmetadata', () => { syncProgress(); syncTime(); });
                video.addEventListener('ended', () => {
                    video.pause();
                    video.currentTime = 0;
                    syncProgress();
                    syncTime();
                    syncState();
                });

                syncProgress();
                syncTime();
                syncState();

                slide.appendChild(videoWrapper);
            } else {
                const slideImg = document.createElement('img');
                slideImg.src = media.url;
                slideImg.className = 'slideshow-img';
                slide.appendChild(slideImg);
            }

            const text = media.description || '';
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

            const dot = document.createElement('span');
            dot.className = 'slideshow-indicator';
            dot.addEventListener('click', () => changeSlide(slideIdx));
            indicator.appendChild(dot);
        });

        function updateIndicators(index) {
            indicator.querySelectorAll('.slideshow-indicator').forEach((dot, i) =>
                dot.classList.toggle('active', i === index)
            );
        }

        function syncVideos(activeIndex) {
            videoRefs.forEach(({ el, slideIdx }) => {
                if (slideIdx !== activeIndex) el.pause();
            });
        }

        function changeSlide(newIndex) {
            const slides = track.querySelectorAll('.slideshow-slide');
            if (slides[newIndex]) {
                slides[newIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' });
                syncVideos(newIndex);
                updateIndicators(newIndex);
            }
        }

        track.addEventListener('scroll', () => {
            const slideWidth = track.clientWidth || 1;
            const index = Math.round(track.scrollLeft / slideWidth);
            updateIndicators(index);
            syncVideos(index);
        });

        closeBtnX.onclick = () => {
            videoRefs.forEach(({ el }) => el.pause());
            unlockScroll();
            modal.remove();
        };

        modal.append(closeBtnX, track, indicator);
        document.body.appendChild(modal);
        lockScroll();

        let initialIndex = mediaEntries.findIndex(entry => entry.idx === startIndex);
        if (initialIndex < 0) initialIndex = 0;

        requestAnimationFrame(() => {
            const prev = track.style.scrollBehavior;
            track.style.scrollBehavior = 'auto';
            track.scrollLeft = initialIndex * track.clientWidth;
            track.style.scrollBehavior = prev;
            updateIndicators(initialIndex);
            syncVideos(initialIndex);
        });
    }

    // --- VIDEO MODAL (same UI as premium_qr) ---
    function openProfileVideoModal(src, poster) {
        const modal = document.getElementById('ppVideoModal') || document.getElementById('rs-video-modal');
        // Support either markup id: pp* (your newer one) or rs* (existing premium modal)
        const v = document.getElementById('ppVideo') || document.getElementById('rsVideo');
        const playBtn = document.getElementById('ppPlayPause') || document.getElementById('rsPlayPause');
        const ov = document.getElementById('ppOverlayPlay') || document.getElementById('rsOverlayPlay');
        const time = document.getElementById('ppTime') || document.getElementById('rsTimeLabel');
        const progress = document.getElementById('ppProgress') || document.getElementById('rsProgress');
        const controls = document.getElementById('ppControls') || document.getElementById('rsControls');
        const closeX = document.getElementById('ppClose') || (modal && modal.querySelector('.close-slideshow'));

        // Clicking the video pauses playback
        v.addEventListener('click', () => {
            if (!v.paused) v.pause();
        });

        if (!modal || !v) return;

        const pauseIcon = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14"></rect>
        <rect x="14" y="5" width="4" height="14"></rect>
      </svg>`;

        if (controls) controls.style.display = 'none';

        v.src = src;
        v.poster = poster || '';

        modal.hidden = false;
        lockScroll();

        if (closeX) {
            closeX.onclick = () => {
                try { v.pause(); } catch { }
                modal.hidden = true;
                unlockScroll();
            };
        }

        if (playBtn) {
            playBtn.innerHTML = pauseIcon;
            playBtn.setAttribute('aria-label', 'Pause');
        }

        if (progress) {
            progress.value = '0';
            progress.style.setProperty('--p', '0%');
            progress.oninput = (ev) => {
                if (!v.duration) return;
                const val = Number(ev.target.value);
                if (!Number.isFinite(val)) return;
                const clamped = Math.min(100, Math.max(0, val));
                v.currentTime = (clamped / 100) * v.duration;
            };
        }

        const fmt = (t) => (!isFinite(t) ? '00:00'
            : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`);

        const syncTime = () => { if (time) time.textContent = `${fmt(v.currentTime)} / ${fmt(v.duration || 0)}`; };
        const syncBtn = () => {
            const paused = v.paused;
            if (playBtn) {
                playBtn.classList.toggle('is-paused', paused);
                if (!paused) playBtn.innerHTML = pauseIcon;
            }
            if (ov) ov.hidden = !paused;
            if (controls) controls.style.display = paused ? 'none' : 'flex';
        };
        const syncProgress = () => {
            if (!progress) return;
            const ratio = (v.duration || 0) ? (v.currentTime / v.duration) : 0;
            const pct = Math.min(100, Math.max(0, ratio * 100));
            progress.value = String(pct);
            progress.style.setProperty('--p', `${pct}%`);
        };

        const onClickPlay = () => { if (v.paused) v.play(); else v.pause(); };
        if (playBtn) playBtn.onclick = onClickPlay;
        if (ov) ov.onclick = onClickPlay;

        v.onplay = v.onpause = () => { syncBtn(); };
        v.ontimeupdate = () => { syncTime(); syncProgress(); };
        v.onloadedmetadata = () => { syncTime(); syncProgress(); };

        const close = () => {
            v.pause(); v.removeAttribute('src'); v.load();
            modal.hidden = true;
            if (playBtn) playBtn.onclick = null;
            if (ov) ov.onclick = null;
            if (closeX) closeX.onclick = null;
            if (progress) progress.oninput = null;
            if (controls) controls.style.display = 'none';
            if (progress) {
                progress.value = '0';
                progress.style.setProperty('--p', '0%');
            }
            v.onplay = v.onpause = v.ontimeupdate = v.onloadedmetadata = null;
        };
        if (closeX) closeX.onclick = close;

        // start paused with overlay visible
        syncBtn(); syncTime(); syncProgress();
    }

    function isVideoEntry(item) {
        return item && typeof item === 'object' && item.video && typeof item.video.player === 'string';
    }
    function videoThumbSrc(item) {
        return (item.video && item.video.poster) ? item.video.poster : 'img/video_placeholder.jpg';
    }

    // --- RENDERER: photos (and now videos) ---
    function refreshPhotosUI() {
        if (!photosListEl) return;

        // clear previous list
        photosListEl.innerHTML = '';
        photosListEl.classList.remove('rows-1', 'rows-2');
        if (photosListEl.style) photosListEl.style.display = '';

        // remove old empty-state, if any
        photosScrollEl?.querySelector('.photos-empty')?.remove();

        const hasItems = photos && photos.length > 0;
        setPhotosControlsVisibility?.();

        if (!hasItems) {
            if (photosListEl.style) photosListEl.style.display = 'none';
            const empty = document.createElement('div');
            empty.className = 'photos-empty';
            empty.innerHTML = 'Немає фотографій.<br>Будь ласка, поділіться спогадами';
            photosScrollEl?.appendChild(empty);
            return;
        }

        photosListEl.classList.add(photos.length <= 5 ? 'rows-1' : 'rows-2');

        // render items in reverse order, but KEEP original indexes in all logic
        const order = photos.map((_, i) => i).slice().reverse();

        order.forEach((idx) => {
            const p = photos[idx];
            const media = normalizeMediaItem(p);
            const isTempVideo = !media && p && p._temp && p._kind === 'video';
            if (!media && !isTempVideo) return;

            const isVideo = Boolean(media?.video);
            const li = document.createElement('li');
            li.dataset.index = String(idx);
            li.classList.toggle('video-tile', isVideo);

            const img = document.createElement('img');
            img.src = isVideo
                ? videoThumbSrc(media)
                : (media?.url || (typeof p?.url === 'string' ? p.url : ''));
            img.alt = '';

            if ((typeof p?.url === 'string' && p.url.startsWith('blob:')) || isTempVideo) {
                li.classList.add('uploading');
                const hint = document.createElement('div');
                hint.className = 'uploading-hint';
                hint.textContent = 'Завантаження…';
                li.appendChild(hint);
            }

            const badge = document.createElement('span');
            badge.className = 'select-badge';
            const orderPos = selectedOrder.indexOf(idx);
            const isSel = orderPos > -1;
            li.classList.toggle('is-selected', isSel);
            li.classList.toggle('selected', isSel);
            badge.textContent = isSel ? String(orderPos + 1) : '';

            if (isVideo) {
                const play = document.createElement('span');
                play.className = 'video-play-small';
                play.innerHTML = `
          <svg viewBox="0 0 24 24" width="22" height="22" fill="white" aria-hidden="true">
            <path d="M8 5v14l11-7z"></path>
          </svg>`;
                play.style.display = isSelecting ? 'none' : '';
                li.appendChild(play);
            }

            li.addEventListener('click', () => {
                if (isSelecting) {
                    // index in selectedOrder is ORIGINAL idx
                    toggleSelectPhoto(idx);
                    return;
                }
                if (!media) return;
                // ORIGINAL idx again → slideshow uses original order
                openMediaSlideshow(idx);
            });

            li.append(img);
            li.append(badge);
            photosListEl.appendChild(li);
        });

        if (photosMenuBtn) photosMenuBtn.style.visibility = isSelecting ? 'hidden' : 'visible';
    }

    async function saveProfilePhotos() {
        try {
            const clean = persistedMedia().map(item => {
                if (item.video) {
                    const video = { player: item.video.player };
                    if (item.video.poster) video.poster = item.video.poster;
                    return { video, description: item.description || '' };
                }
                return { url: item.url, description: item.description || '' };
            });
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

    // INFO modal на базі confirm-delete
    function premiumLimitMessage() {
        const limit = typeof MAX_PHOTOS !== 'undefined'
            ? MAX_PHOTOS
            : (window.MAX_PHOTOS || 20);
        return `Досягнуто ліміту ${limit} фото. <br>Для збільшення обсягу, придбайте <br><a href="premium_qr.html" style="color:black; font-size: 550;"><u>Преміум QR</u></a>.`;
    }

    function openInfoModal(message) {
        const overlay = document.getElementById('modal-overlay');
        const dlg = document.getElementById('confirm-delete-modal');
        if (!overlay || !dlg) { alert(message); return; }

        // заголовок/текст
        const titleEl = dlg.querySelector('.modal-title') || dlg.querySelector('#confirm-delete-title');
        const textEl = dlg.querySelector('.modal-text') || dlg.querySelector('#confirm-delete-text');
        if (titleEl) titleEl.textContent = 'Обмеження фото';
        if (textEl) textEl.innerHTML = message;

        // кнопки
        const cancelBtn = document.getElementById('confirm-delete-cancel');
        const okBtn = document.getElementById('confirm-delete-ok');

        // показуємо лише ОК, ховаємо "Скасувати"
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (okBtn) okBtn.textContent = 'Готово';

        // відкрити
        overlay.hidden = false;
        dlg.hidden = false;

        const close = () => {
            overlay.hidden = true;
            dlg.hidden = true;
            // повернути стан кнопок
            if (cancelBtn) cancelBtn.style.display = '';
            if (okBtn) okBtn.textContent = 'Видалити';
        };

        // закриття по overlay і ОК
        overlay.onclick = close;
        if (okBtn) okBtn.onclick = close;
        // якщо є хрестик
        const closeX = document.getElementById('confirm-delete-close');
        if (closeX) closeX.onclick = close;
    }

    function hookPhotoButtons() {
        if (addPhotoBtn)
            addPhotoBtn.addEventListener('click', () => {
                fileInput?.click();
            });

        if (choosePhotoBtn)
            choosePhotoBtn.addEventListener('click', () => {
                if (isSelecting) {
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
                    if (i >= 0 && i < photos.length) photos.splice(i, 1);
                });
                selectedOrder = [];
                await saveProfilePhotos();
                closeConfirm();
                exitSelectionMode();
            });
        }

        if (fileInput)
            fileInput.addEventListener('change', async (e) => {
                let files = Array.from(e.target.files || []);
                if (!files.length) return;

                const currentCount = persistedMedia().length; // лише збережені (без blob)
                const remaining = Math.max(0, (window.MAX_PHOTOS || 20) - currentCount);

                if (remaining <= 0) {
                    openInfoModal(premiumLimitMessage());
                    e.target.value = '';
                    return;
                }
                if (files.length > remaining) {
                    openInfoModal(premiumLimitMessage());
                    e.target.value = '';
                    return; // не відкриваємо photo-desc-modal зовсім
                }

                const videoFiles = files.filter(f => f.type.startsWith('video/'));
                if (videoFiles.length) {
                    alert('Відео можна завантажити лише на сторінці редагування профілю.');
                    files = files.filter(f => !f.type.startsWith('video/'));
                }
                if (!files.length) {
                    e.target.value = '';
                    return;
                }

                // 0) add instant previews to photos
                const startIndex = photos.length;
                const previews = files.map(f => URL.createObjectURL(f));
                const tempCaptions = new Array(previews.length).fill('');

                // додаємо тимчасові фото В КІНЕЦЬ масиву
                for (let i = 0; i < previews.length; i++) {
                    const url = previews[i];
                    photos.push({ url, description: '', _temp: true });
                }

                refreshPhotosUI();

                // --- new gallery modal ---
                const overlay = document.getElementById('modal-overlay');
                const dlg = document.getElementById('photo-desc-modal');
                const closeX = document.getElementById('photo-desc-close');
                const thumbsEl = document.getElementById('photo-desc-thumbs');
                const textEl = document.getElementById('photo-desc-text');
                const countEl = document.getElementById('photo-desc-count');
                const okBtn = document.getElementById('photo-desc-add');

                let sel = 0;
                let confirmed = false;

                function commitCurrent() {
                    // save the textarea into the caption for the currently selected photo
                    if (previews.length === 0) return;
                    tempCaptions[sel] = (textEl.value || '').trim();
                }

                function renderThumbs() {
                    thumbsEl.innerHTML = '';
                    previews.forEach((src, i) => {
                        const wrap = document.createElement('div');
                        wrap.className = 'photo-desc-thumb' + (i === sel ? ' is-selected' : '');
                        wrap.innerHTML = `
                        <img src="${src}" alt="">
                        <button class="thumb-x" data-i="${i}">
                          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                    `;
                        wrap.addEventListener('click', (ev) => {
                            if (ev.target.closest('.thumb-x')) return;
                            // before switching, save the current textarea value
                            commitCurrent();
                            sel = i;
                            renderThumbs();
                            textEl.value = tempCaptions[sel] || '';
                        });
                        thumbsEl.appendChild(wrap);
                    });
                    countEl.textContent = String(previews.length);
                }

                // delete via X (event delegation)
                thumbsEl.onclick = (ev) => {
                    const btn = ev.target.closest('.thumb-x');
                    if (!btn) return;
                    const i = Number(btn.dataset.i);

                    // persist current textarea before we mutate arrays
                    commitCurrent?.();

                    // revoke blob preview
                    try { URL.revokeObjectURL(previews[i]); } catch { }

                    // remove from ALL synced arrays
                    previews.splice(i, 1);
                    tempCaptions.splice(i, 1);
                    files.splice(i, 1);                 // <-- CRITICAL: removes the actual file to upload
                    photos.splice(startIndex + i, 1);   // UI list you've already added

                    // adjust selection
                    if (sel >= previews.length) sel = Math.max(0, previews.length - 1);

                    if (previews.length === 0) {
                        closeModal();                     // nothing left → close the modal
                        refreshPhotosUI();
                        return;
                    }

                    renderThumbs(false);
                    textEl.value = tempCaptions[sel] || '';
                    refreshPhotosUI();
                };

                function openModal() { overlay.hidden = false; dlg.hidden = false; }
                function closeModal() { overlay.hidden = true; dlg.hidden = true; }

                // close actions
                overlay.addEventListener('click', closeModal, { once: true });
                closeX.onclick = () => { closeModal(); };

                okBtn.onclick = () => {
                    // final save for the current one before closing
                    commitCurrent();
                    confirmed = true;
                    closeModal();
                };

                openModal();
                renderThumbs();
                textEl.value = tempCaptions[0] || '';

                // wait until modal closes
                await new Promise((resolve) => {
                    const iv = setInterval(() => {
                        if (dlg.hidden) { clearInterval(iv); resolve(); }
                    }, 60);
                });

                if (!confirmed) {
                    // rollback temp additions
                    for (let i = previews.length - 1; i >= 0; i--) {
                        photos.splice(startIndex + i, 1);
                    }
                    refreshPhotosUI();
                    fileInput.value = '';
                    return;
                }

                // 1) upload to ImgBB and replace temp objects
                async function uploadToImgBB(file) {
                    const form = new FormData();
                    form.append('image', file);
                    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: form });
                    const json = await res.json();
                    if (!json.success) throw new Error('Upload failed');
                    return json.data.url;
                }

                for (let i = 0; i < files.length; i++) {
                    const listIndex = startIndex + i;
                    try {
                        const hostedUrl = await uploadToImgBB(files[i]);
                        try { URL.revokeObjectURL(previews[i]); } catch { }
                        const desc = tempCaptions[i] || '';
                        photos[listIndex] = { url: hostedUrl, description: desc };
                        refreshPhotosUI();
                    } catch (err) {
                        console.error('Upload failed for', files[i].name, err);
                        alert(`Не вдалося завантажити фото ${files[i].name}`);
                        photos.splice(listIndex, 1);
                        refreshPhotosUI();
                    }
                }

                // 2) persist profile with hosted URLs + captions
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
        document.querySelectorAll('.photos-controls, #photos-menu-btn, .dots-btn')
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
        const loginBox = document.getElementById('loginMainBox') || loginModal?.querySelector('.login-box');
        const notMyPhoneBox = document.getElementById('notMyPhoneBox');
        const loginBtn = document.getElementById('profile-login-btn');
        const closeBtn = document.getElementById('loginClose');
        const notMyPhoneClose = document.getElementById('notMyPhoneClose');

        if (!loginModal || !loginBox || !loginBtn) {
            console.warn('One or more login modal elements not found');
            return;
        }

        const open = () => {
            loginModal.dispatchEvent(new CustomEvent('login:reset'));
            loginBox.hidden = false;
            if (notMyPhoneBox) notMyPhoneBox.hidden = true;
            loginModal.style.display = 'flex';
        };

        const close = () => {
            loginModal.style.display = 'none';
            document.getElementById('loginError').textContent = '';
            loginModal.dispatchEvent(new CustomEvent('login:reset'));
            loginBox.hidden = false;
            if (notMyPhoneBox) notMyPhoneBox.hidden = true;
        };

        loginBtn.addEventListener('click', open);
        closeBtn?.addEventListener('click', close);
        notMyPhoneClose?.addEventListener('click', close);

        loginModal.addEventListener('click', (e) => {
            const target = e.target;
            const activeBox = [loginBox, notMyPhoneBox].find(b => b && !b.hidden);
            if (activeBox && activeBox.contains(target)) return;
            close();
        });

        [loginBox, notMyPhoneBox].forEach(box => box && box.addEventListener('click', (e) => e.stopPropagation()));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && loginModal.style.display === 'flex') close();
        });
    }

    let selectedChurchName = null;
    const churchActiveDaysCache = {};
    let currentActiveWeekdays = null; // null/empty → no restriction (all days active)
    let unionActiveWeekdays = null;
    let selectedDateWeekday = null;
    let hasUserPickedDate = false;

    async function ensureChurchDays(churchName) {
        if (!churchName) return null;
        if (churchActiveDaysCache[churchName]) return churchActiveDaysCache[churchName];

        try {
            const res = await fetch(
                `${API_URL}/api/liturgy/church-active-days?churchName=${encodeURIComponent(churchName)}`
            );
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            let days = Array.isArray(data.activeWeekdays) ? data.activeWeekdays : [];
            days = days
                .map((v) => (typeof v === 'number' ? v : parseInt(v, 10)))
                .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
            churchActiveDaysCache[churchName] = days;
        } catch (e) {
            console.error('Failed to load church active weekdays:', e);
            churchActiveDaysCache[churchName] = [];
        }
        return churchActiveDaysCache[churchName];
    }

    function computeUnionActiveWeekdays() {
        const set = new Set();
        Object.values(churchActiveDaysCache).forEach((arr) => {
            if (!Array.isArray(arr)) return;
            arr.forEach((day) => set.add(day));
        });
        return set.size ? Array.from(set) : null;
    }

    function resetChurchButtonsState() {
        const churchBtns = document.querySelectorAll('.church-btn');
        churchBtns.forEach((btn) => {
            btn.classList.remove('church-btn--inactive');
            btn.disabled = false;
        });
    }

    function updateChurchButtonsForWeekday(weekday) {
        if (!unionActiveWeekdays || weekday === null) {
            console.log('church buttons skip update', { unionActiveWeekdays, selectedChurchName, weekday });
            resetChurchButtonsState();
            return;
        }
        const churchBtns = document.querySelectorAll('.church-btn');
        churchBtns.forEach((btn) => {
            const name = btn.textContent.trim();
            const days = churchActiveDaysCache[name];
            const allowed = !Array.isArray(days) || days.length === 0 || days.includes(weekday);
            btn.classList.toggle('church-btn--inactive', !allowed);
            btn.disabled = !allowed;
            if (!allowed) {
                btn.classList.remove('selected');
            }
        });
        console.log('church buttons updated', { weekday, unionActiveWeekdays });
    }

    async function preloadAllChurchDays() {
        const churchBtns = document.querySelectorAll('.church-btn');
        const names = Array.from(churchBtns)
            .map((btn) => btn.textContent.trim())
            .filter(Boolean);
        await Promise.all(names.map((name) => ensureChurchDays(name)));
        unionActiveWeekdays = computeUnionActiveWeekdays();
        if (!selectedChurchName) {
            currentActiveWeekdays = unionActiveWeekdays;
            applyChurchActiveDaysToCalendar();
        }
        if (selectedDateWeekday !== null && !selectedChurchName) {
            updateChurchButtonsForWeekday(selectedDateWeekday);
        }
    }

    async function loadChurchActiveDays(churchName) {
        if (!churchName) {
            currentActiveWeekdays = unionActiveWeekdays;
            applyChurchActiveDaysToCalendar();
            return;
        }

        await ensureChurchDays(churchName);
        const days = churchActiveDaysCache[churchName] || [];
        currentActiveWeekdays = days.length ? days : null;
        applyChurchActiveDaysToCalendar();
    }

    function applyChurchActiveDaysToCalendar() {
        const dateCalendar = document.querySelector('.date-calendar');
        if (!dateCalendar) return;

        const items = Array.from(dateCalendar.querySelectorAll('.date-item'));
        if (!items.length) return;

        const days = currentActiveWeekdays;
        if (!days || !days.length) {
            // No restriction → all dates active
            items.forEach((item) => {
                item.classList.remove('date-item--inactive');
                item.removeAttribute('aria-disabled');
            });
            return;
        }

        const allowed = new Set(days);

        items.forEach((item) => {
            const year = Number(item.dataset.year);
            const month = Number(item.dataset.month);
            const day = Number(item.dataset.day);
            if (!year || !month || !day) return;

            const jsDate = new Date(year, month - 1, day);
            const weekday = jsDate.getDay(); // 0..6
            const isActive = allowed.has(weekday);

            if (!isActive) {
                item.classList.add('date-item--inactive');
                item.setAttribute('aria-disabled', 'true');
                item.classList.remove('selected');
            } else {
                item.classList.remove('date-item--inactive');
                item.removeAttribute('aria-disabled');
            }
        });

        const stillSelected = dateCalendar.querySelector('.date-item.selected');
        if (!stillSelected) {
            const selectedDateEl = document.querySelector('.selected-date');
            clearSelectedDateDisplay(selectedDateEl);
            updateVisibleMonthLabel();
            updateLiturgyDetails();
        }
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
            premiumHasPhone = !!(data.premium && data.premium.hasPhone);
            premiumPhoneMasked = data?.premium?.phoneMasked || '';

            window.MAX_PHOTOS = data?.premium ? 120 : 20;

            if (premiumLock) {
                const photosTitleEl = document.querySelector('.photos-title');
                if (photosTitleEl && photosTitleEl.textContent.trim() === 'Фотографії') {
                    photosTitleEl.textContent = 'Галерея';
                }

                // Показати шапку з “Увійти” та сховати всі кнопки редагування
                document.getElementById('profile-login-header')?.removeAttribute('hidden');
                hideEditingUIForPremium?.();
                setupLoginModalOpenClose?.();

                // дублюємо безпечне підв’язування
                const loginBtn = document.getElementById('profile-login-btn');
                const loginModal = document.getElementById('loginModal');
                const loginBox = document.getElementById('loginMainBox') || loginModal?.querySelector('.login-box');
                const notMyPhoneBox = document.getElementById('notMyPhoneBox');

                if (loginBtn && loginModal && loginBox) {
                    const open = () => {
                        loginModal.dispatchEvent(new CustomEvent('login:reset'));
                        loginBox.hidden = false;
                        if (notMyPhoneBox) notMyPhoneBox.hidden = true;
                        loginModal.style.display = 'flex';
                    };
                    loginBtn.onclick = open;
                    [loginBox, notMyPhoneBox].forEach(box => box && box.addEventListener('click', (e) => e.stopPropagation()));
                    loginModal.onclick = (e) => {
                        const target = e.target;
                        const activeBox = [loginBox, notMyPhoneBox].find(b => b && !b.hidden);
                        if (activeBox && activeBox.contains(target)) return;
                        loginModal.style.display = 'none';
                    };
                }
            }

            // ─── COMMENTS ───
            comments = Array.isArray(data.comments) ? data.comments : [];
            renderComments?.();

            // ─── AVATAR / HERO ───
            if (avatarEl) avatarEl.src = data.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png';

            // prefer new heroImage; fallback to legacy backgroundUrl; else keep CSS default
            const heroUrl = data.heroImage || data.backgroundUrl || '';
            if (heroEl && heroUrl) {
                heroEl.style.backgroundImage = `url(${heroUrl})`;
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

            const selectedIso = getSelectedISO();
            if (selectedIso) {
                renderLiturgyDetailsStrip(selectedIso);
            }
            updateLiturgyDetails();

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
                textSpan.innerHTML = escapeHtml(text.slice(0, prefixLen).trimEnd()) + ' …';
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
                textSpan.innerHTML = escapeHtml(text.slice(0, best).trimEnd()) + ' …';
                toggle.textContent = moreLabel;
                bioContentEl.append(textSpan, document.createTextNode('\u00A0'), toggle);

                // Обробники розкриття/згортання
                let expanded = false;
                const expand = () => {
                    expanded = true;
                    bioContentEl.innerHTML = '';
                    textSpan.innerHTML = escapeHtml(text) + ' ';
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
                    empty.innerHTML = 'Життєпис ще не заповнено.<br>Будь ласка, додайте інформацію';
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
                        const newBio = (document.getElementById('bio-editor')?.value || '');
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
                ? data.photos.map(normalizeMediaItem).filter(Boolean)
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
            dateItem.className =
                'date-item' + (d.toDateString() === today.toDateString() ? ' selected' : '');

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

            // ✅ NEW: Mark today's date for styling (if not selected)
            if (d.toDateString() === today.toDateString()) {
                dateItem.classList.add('today');
            }
        }

        setSelectedDateDisplay(selectedDateEl, today.getFullYear(), today.getMonth() + 1, today.getDate());

        // Ensure "today" is selected and shown
        const todayItem = Array.from(dateCalendar.querySelectorAll('.date-item')).find(
            (item) =>
                parseInt(item.dataset.day) === today.getDate() &&
                parseInt(item.dataset.month) === today.getMonth() + 1 &&
                parseInt(item.dataset.year) === today.getFullYear()
        );

        // Show today's chip at the LEFT edge (no page jump)
        const scroller = dateCalendar; // the actual overflow-x container
        if (todayItem && scroller) {
            requestAnimationFrame(() => {
                scroller.scrollTo({ left: todayItem.offsetLeft, behavior: 'auto' });
                updateVisibleMonthLabel();
            });
        } else {
            updateVisibleMonthLabel();
        }

        // Update details immediately
        updateLiturgyDetails();
        setTimeout(updateLiturgyDetails, 100);

        // Apply active-days logic for currently selected church (if any)
        applyChurchActiveDaysToCalendar();

        if (!dateCalendar.dataset.monthLabelBound) {
            let raf = 0;
            dateCalendar.addEventListener('scroll', () => {
                if (raf) return;
                raf = requestAnimationFrame(() => {
                    raf = 0;
                    updateVisibleMonthLabel();
                });
            }, { passive: true });
            dateCalendar.dataset.monthLabelBound = '1';
        }
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
            // clear old mark
            it.querySelector('.date-dot')?.remove();

            const iso = toISOFromParts(Number(it.dataset.year), Number(it.dataset.month), Number(it.dataset.day));
            const has = (liturgiesIndex[iso]?.length || 0) > 0;
            if (!has) return;

            const dot = document.createElement('span');
            // use a modifier if you want different style for future/today
            dot.className = 'date-dot' + (isPastISO(iso) ? '' : ' date-dot--future');
            dot.dataset.iso = iso;
            it.appendChild(dot);
        });
    }

    generateDates();

    (async () => {
        await loadLiturgies();
        markDatesWithLiturgies();

        // ensure initial selected (today) effects
        let iso = getSelectedISO();
        if (iso) applyDateSelectionEffects(iso);
        renderLiturgyDetailsStrip(iso);

        if (pendingDateISO) {
            selectDateByISO(pendingDateISO);
            iso = pendingDateISO;
            const items = liturgiesIndex[iso] || [];
            if (items.length) {
                let targetIndex = 1;
                if (pendingInvoiceId) {
                    const found = items.findIndex((it) => it.invoiceId === pendingInvoiceId);
                    if (found >= 0) targetIndex = found + 1;
                }
                requestAnimationFrame(() => scrollToLiturgyCard(targetIndex));
            }
        }

        if (pendingInvoiceId) {
            const status = await fetchLiturgyPaymentStatus(pendingInvoiceId);
            const successStatuses = new Set(['success']);
            const failureStatuses = new Set(['failure', 'expired', 'reversed', 'cancelled', 'canceled', 'declined']);
            const normalized = String(status || '').toLowerCase();
            const isSuccess = successStatuses.has(normalized);
            const isFailure = failureStatuses.has(normalized);
            openLiturgyResultModal(
                isSuccess
                    ? 'Оплата успішна. Записку прийнято.'
                    : (isFailure ? 'Оплата не пройшла. Спробуйте ще раз.' : 'Оплата не підтверджена. Спробуйте ще раз.')
            );

            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('liturgyInvoice');
            cleanUrl.searchParams.delete('liturgyDate');
            history.replaceState(null, '', cleanUrl.toString());

            if (liturgyPaymentState) {
                try { sessionStorage.removeItem('liturgyPaymentState'); } catch { }
                liturgyPaymentState = null;
            }
        }
    })();

    function getSelectedISO() {
        const selectedDateEl = document.querySelector('.selected-date');
        return selectedDateEl?.dataset?.iso || toISOFromUA(selectedDateEl?.textContent || '');
    }

    function selectDateByISO(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
        const dateCalendar = document.querySelector('.date-calendar');
        const selectedDateEl = document.querySelector('.selected-date');
        if (!dateCalendar || !selectedDateEl) return;

        const [y, m, d] = iso.split('-').map(Number);
        setSelectedDateDisplay(selectedDateEl, y, m, d);
        dateCalendar.querySelectorAll('.date-item').forEach(it => it.classList.remove('selected'));
        const target = Array.from(dateCalendar.querySelectorAll('.date-item')).find(
            (item) =>
                parseInt(item.dataset.day) === d &&
                parseInt(item.dataset.month) === m &&
                parseInt(item.dataset.year) === y
        );
        if (target) {
            target.classList.add('selected');
            dateCalendar.scrollTo({ left: target.offsetLeft, behavior: 'auto' });
        }
        hasUserPickedDate = true;
        applyDateSelectionEffects(iso);
        renderLiturgyDetailsStrip(iso);
        updateLiturgyDetails();
        renderLiturgyHistoryForISO(iso);
    }

    function scrollToLiturgyCard(index) {
        const strip = document.querySelector('.liturgy-details.is-strip');
        if (!strip) return;
        const target = strip.children[index];
        target?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    }

    function resetLiturgySelections() {
        document.querySelectorAll('.church-btn').forEach(b => b.classList.remove('selected'));
        selectedChurchName = '';
        document.querySelectorAll('.donation-btn').forEach(b => b.classList.remove('selected'));
        loadChurchActiveDays('');

        if (customDonationBtn) {
            customDonationBtn.textContent = 'Інше';
            delete customDonationBtn.dataset.amount;
        }

        updateDonationButtonsLayout();
        resetLiturgyStripPosition();
        updateLiturgyDetails();

        const iso = getSelectedISO();
        if (iso) {
            applyDateSelectionEffects(iso);
            renderLiturgyDetailsStrip(iso);
            renderLiturgyHistoryForISO(iso);
        }
    }

    async function fetchLiturgyPaymentStatus(invoiceId) {
        try {
            const res = await fetch(`${API_URL}/api/liturgies/payment-status?invoiceId=${encodeURIComponent(invoiceId)}`);
            if (!res.ok) return 'unknown';
            const data = await res.json();
            return (data.status || 'unknown').toString().toLowerCase();
        } catch (e) {
            console.error('Failed to fetch liturgy payment status:', e);
            return 'unknown';
        }
    }

    function openLiturgyResultModal(message) {
        if (!liturgyResultModal || !liturgyResultText || !liturgyResultOk || !overlayEl) return;
        liturgyResultText.textContent = message;
        overlayEl.hidden = false;
        liturgyResultModal.hidden = false;

        const close = () => {
            liturgyResultModal.hidden = true;
            overlayEl.hidden = true;
            resetLiturgySelections();
        };

        liturgyResultOk.onclick = close;
    }

    function applyDateSelectionEffects(iso) {
        // If past → hide submit & details, show only history
        const submitBtn = document.querySelector('.liturgy-submit');
        const detailsEl = document.querySelector('.liturgy-details, .service-info') || document.querySelector('.service-info');
        const liturgyChurchEl = document.querySelector('.liturgy-church');
        const liturgyDonationEl = document.querySelector('.liturgy-donation');
        const weekday = iso ? new Date(`${iso}T00:00:00`).getDay() : null;
        selectedDateWeekday = hasUserPickedDate ? weekday : null;
        if (hasUserPickedDate) {
            updateChurchButtonsForWeekday(weekday);
        }

        const isPast = isPastISO(iso);
        if (submitBtn) submitBtn.style.display = isPast ? 'none' : '';
        if (detailsEl) detailsEl.style.display = isPast ? 'none' : '';
        if (liturgyDonationEl) liturgyDonationEl.style.display = isPast ? 'none' : '';
        if (liturgyChurchEl) liturgyChurchEl.style.display = isPast ? 'none' : '';

        // Always show history section for the selected day
        renderLiturgyHistoryForISO(iso);
    }

    document.addEventListener('click', (e) => {
        const clickedItem = e.target.closest('.date-item');
        if (!clickedItem) return;

        const isSelected = clickedItem.classList.contains('selected');
        if (clickedItem.classList.contains('date-item--inactive') && !isSelected) {
            return; // ignore clicks on inactive dates
        }

        const selectedDateEl = document.querySelector('.selected-date');
        if (isSelected) {
            document.querySelectorAll('.date-item').forEach(d => d.classList.remove('selected'));
            clearSelectedDateDisplay(selectedDateEl);
            updateVisibleMonthLabel();
            hasUserPickedDate = false;
            selectedDateWeekday = null;
            updateChurchButtonsForWeekday(null);

            const submitBtn = document.querySelector('.liturgy-submit');
            const detailsEl = document.querySelector('.liturgy-details, .service-info') || document.querySelector('.service-info');
            const liturgyChurchEl = document.querySelector('.liturgy-church');
            const liturgyDonationEl = document.querySelector('.liturgy-donation');
            if (submitBtn) submitBtn.style.display = '';
            if (detailsEl) detailsEl.style.display = '';
            if (liturgyDonationEl) liturgyDonationEl.style.display = '';
            if (liturgyChurchEl) liturgyChurchEl.style.display = '';

            document.querySelector('.liturgy-history')?.remove();
            updateLiturgyDetails();
            return;
        }

        hasUserPickedDate = true;
        document.querySelectorAll('.date-item').forEach(d => d.classList.remove('selected'));
        clickedItem.classList.add('selected');

        const day = parseInt(clickedItem.dataset.day, 10);
        const month = parseInt(clickedItem.dataset.month, 10);
        const year = parseInt(clickedItem.dataset.year, 10);

        const iso = setSelectedDateDisplay(selectedDateEl, year, month, day);

        if (selectedChurchName) {
            const churchBtns = document.querySelectorAll('.church-btn');
            churchBtns.forEach(b => {
                const isMatch = b.textContent.trim() === selectedChurchName;
                b.classList.toggle('selected', isMatch);
            });
        }

        updateLiturgyDetails();

        if (iso) {
            applyDateSelectionEffects(iso);
            renderLiturgyDetailsStrip(iso);
        }
        updateLiturgyDetails();
    });

    function updateLiturgyDetails() {
        const detailsBox = document.querySelector('.profile-liturgy .liturgy-details');
        if (!detailsBox) return;

        const profileNameEl = document.querySelector('.profile-name');
        let selectedChurchEl = document.querySelector('.church-btn.selected'); // може бути null
        const selectedDateEl = document.querySelector('.selected-date');
        const profileName = profileNameEl?.textContent?.trim() || '';

        if (profileName) {
            detailsBox.querySelectorAll('.person-name').forEach((el) => { el.textContent = profileName; });
            detailsBox.dataset.personName = profileName;
        }

        const serviceInfoEl = detailsBox.querySelector('.service-info');

        if (serviceInfoEl && selectedDateEl) {
            const selectedDate = getSelectedFullDate(selectedDateEl);
            const dateText = selectedDate ? `${selectedDate} р.` : 'оберіть дату';

            // 🔸 fallback: немає підсвіченого елемента, але назва збережена
            if (!selectedChurchEl && selectedChurchName) {
                const btn = Array.from(document.querySelectorAll('.church-btn'))
                    .find(b => b.textContent.trim() === selectedChurchName);
                if (btn) {
                    document.querySelectorAll('.church-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedChurchEl = btn;
                }
            }

            const churchText = selectedChurchEl?.textContent?.trim()
                || selectedChurchName
                || 'оберіть церкву';
            serviceInfoEl.innerHTML =
                `Божественна Літургія за упокій відбудеться у <span style="font-weight:550;">${churchText}</span>, <span style="font-weight:550;">${dateText}</span>`;

            detailsBox.dataset.serviceInfo = serviceInfoEl.textContent?.trim() || '';
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

            const status = document.createElement('span');
            status.className = 'liturgy-status is-done';
            status.textContent = 'Завершено';
            card.appendChild(status);

            const nameDiv = document.createElement('div');
            nameDiv.className = 'person-name';
            nameDiv.textContent = currentPersonName;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'service-info';
            infoDiv.innerHTML = `${phrase} у <span style="font-weight:550;">${it.churchName || 'Церква'}, ${dateUa}р.</span> `;

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
            const wasSelected = btn.classList.contains('selected');
            churchBtns.forEach(b => b.classList.remove('selected'));
            if (!wasSelected) {
                btn.classList.add('selected');
                selectedChurchName = btn.textContent.trim();
                loadChurchActiveDays(selectedChurchName);
            } else {
                selectedChurchName = '';
                loadChurchActiveDays('');
                if (selectedDateWeekday !== null) {
                    updateChurchButtonsForWeekday(selectedDateWeekday);
                }
            }
            updateLiturgyDetails();
            const iso = getSelectedISO();
            if (iso) applyDateSelectionEffects(iso);
            resetLiturgyStripPosition();
        });
    });
    preloadAllChurchDays();

    function onLiturgySubmit(e) {
        e.preventDefault(); // in case the button is inside a <form>
        const btn = e.currentTarget;

        if (btn?.dataset.busy === '1') return;
        if (btn) {
            btn.dataset.busy = '1';
            btn.disabled = true;
        }

        // UI selections
        const selectedDateEl = document.querySelector('.selected-date');
        const selectedDateText = getSelectedFullDate(selectedDateEl);
        const selectedChurchEl = document.querySelector('.church-btn.selected');
        const selectedDonationBtn = document.querySelector('.donation-btn.selected');

        if (!selectedDateText) {
            alert('Оберіть дату');
            releaseLiturgySubmitState();
            return;
        }
        if (!selectedChurchEl) {
            alert('Оберіть церкву');
            releaseLiturgySubmitState();
            return;
        }
        if (!selectedDonationBtn) {
            alert('Оберіть суму пожертви');
            releaseLiturgySubmitState();
            return;
        }
        if (!personId) {
            alert('Не знайдено профіль (personId)');
            releaseLiturgySubmitState();
            return;
        }

        let dateISO = selectedDateEl?.dataset?.iso || '';
        if (!dateISO) {
            const m = selectedDateText.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (m) {
                const [, dd, mm, yyyy] = m;
                dateISO = `${yyyy}-${mm}-${dd}`;
            } else {
                const d = new Date(selectedDateText);
                if (!isNaN(d)) dateISO = d.toISOString().slice(0, 10);
            }
        }
        if (!dateISO) {
            alert('Невірний формат дати');
            releaseLiturgySubmitState();
            return;
        }

        if (currentActiveWeekdays && currentActiveWeekdays.length) {
            const dt = new Date(`${dateISO}T00:00:00`);
            const weekday = dt.getDay();
            if (!currentActiveWeekdays.includes(weekday)) {
                alert('На цю дату в обраній церкві немає богослужінь. Оберіть інший день.');
                releaseLiturgySubmitState();
                return;
            }
        }

        const churchName = selectedChurchEl.textContent.trim();
        let price = 0;
        if (selectedDonationBtn.dataset.amount) {
            price = parseInt(selectedDonationBtn.dataset.amount, 10) || 0;
        } else {
            price = parseInt((selectedDonationBtn.textContent || '').replace(/[^\d]/g, ''), 10) || 0;
        }
        if (price <= 0) {
            alert('Введіть коректну суму пожертви');
            releaseLiturgySubmitState();
            return;
        }

        if (!liturgyPhoneModal) {
            alert('Неможливо відкрити форму оплати');
            releaseLiturgySubmitState();
            return;
        }

        pendingLiturgyPayload = { dateISO, churchName, price };
        pendingLiturgyBtn = btn;
        openLiturgyPhoneModal();
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
        const nameError = document.getElementById('comment-user-error');
        const showNameError = (msg = '') => {
            if (!nameError) return;
            if (msg) {
                nameError.textContent = msg;
                nameError.hidden = false;
            } else {
                nameError.textContent = '';
                nameError.hidden = true;
            }
        };
        const sanitizeName = (value) => value.replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґʼ'\s-]/g, '');
        nameInput?.addEventListener('input', () => {
            const clean = sanitizeName(nameInput.value);
            if (clean !== nameInput.value) {
                nameInput.value = clean;
            }
            showNameError('');
        });

        const open = () => {
            overlay.hidden = false;
            dlg.hidden = false;
            nameInput.value = '';
            showNameError('');
            nameInput.focus();
        };
        const close = () => {
            overlay.hidden = true;
            dlg.hidden = true;
            showNameError('');
        };

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
            const newComment = { author, date, text };
            comments.push(newComment);
            renderComments();
            const revertComment = () => {
                const idx = comments.indexOf(newComment);
                if (idx !== -1) {
                    comments.splice(idx, 1);
                    renderComments();
                }
            };
            const getErrorDescription = async (res) => {
                if (!res) return '';
                const contentType = res.headers?.get('content-type') || '';
                try {
                    if (contentType.includes('application/json')) {
                        const data = await res.json();
                        if (typeof data === 'string') return data;
                        return data?.description || data?.error || data?.message || '';
                    }
                    return await res.text();
                } catch {
                    return '';
                }
            };
            const isForbiddenAuthorError = (msg) => /author contains forbidden words/i.test(msg || '');

            let shouldCloseModal = true;
            try {
                const res = await fetch(`${API_BASE}/${personId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comments })
                });
                if (!res.ok) {
                    const errMsg = await getErrorDescription(res);
                    if (isForbiddenAuthorError(errMsg)) {
                        revertComment();
                        showNameError('Введіть коректне ім\'я');
                        nameInput.focus();
                        shouldCloseModal = false;
                        return;
                    }
                    throw new Error(errMsg || res.statusText);
                }
            } catch (e) {
                revertComment();
                alert('Не вдалося оновити коментарі.');
                console.error(e);
            } finally {
                if (shouldCloseModal) close();
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
    (() => {
        const modal = document.getElementById('loginModal');
        if (!modal) return;

        const box = modal.querySelector('.login-box');
        const titleEl = box?.querySelector('h2');
        const passWrap = document.getElementById('loginPasswordWrap');
        const passEl = document.getElementById('passwordInput');
        const submitBtn = document.getElementById('loginSubmit');
        const errEl = document.getElementById('loginError');
        const forgotEl = document.getElementById('forgotPassword');
        const phoneBlock = document.getElementById('resetPhoneBlock');
        const phoneInput = document.getElementById('resetPhone');
        const codeBlock = document.getElementById('resetCodeBlock');
        const codeInput = document.getElementById('resetCode');
        const resendBtn = document.getElementById('resendCodeBtn');
        const codeNoteEl = document.getElementById('codeNote');
        const newPassWrap = document.getElementById('resetNewPasswordWrap');
        const newPassEl = document.getElementById('resetNewPassword');

        const notMyPhoneLink = document.getElementById('notMyPhoneLink');
        const notMyPhoneBox = document.getElementById('notMyPhoneBox');
        const notMyPhoneBackBtn = document.getElementById('notMyPhoneBackBtn');

        if (!box || !titleEl || !passEl || !submitBtn || !errEl || !forgotEl) return;

        let authMode = 'login';
        let backLinkEl = null;
        let resendTimerId = null;
        let resendUnlockTs = 0;
        const tokenKey = `people_token_${personId}`;

        function clearMsg() {
            errEl.textContent = '';
            errEl.style.color = '#e11d48';
        }

        function ensureBackLink() {
            if (backLinkEl) return;
            backLinkEl = document.createElement('p');
            backLinkEl.className = 'forgot-password';
            backLinkEl.textContent = 'Повернутися до входу';
            backLinkEl.style.textAlign = 'center';
            backLinkEl.style.marginTop = '4px';
            backLinkEl.addEventListener('click', switchToLogin);
            errEl?.before(backLinkEl);
        }

        function showPhoneInfo() {
            if (!phoneInput) return;
            phoneInput.value = premiumPhoneMasked || 'Номер телефону не вказано';
        }

        function stopResendTimer() {
            if (resendTimerId) {
                clearInterval(resendTimerId);
                resendTimerId = null;
            }
            resendUnlockTs = 0;
            if (resendBtn) {
                resendBtn.disabled = false;
                resendBtn.textContent = 'Надіслати ще раз';
            }
        }

        function updateResendButton() {
            if (!resendBtn || !resendUnlockTs) return;
            const remaining = Math.max(0, Math.ceil((resendUnlockTs - Date.now()) / 1000));
            if (remaining <= 0) {
                stopResendTimer();
                return;
            }
            resendBtn.disabled = true;
            resendBtn.textContent = `Надіслати ще раз (${remaining})`;
        }

        function startResendTimer(seconds = 60) {
            if (!resendBtn) return;
            resendUnlockTs = Date.now() + seconds * 1000;
            updateResendButton();
            if (resendTimerId) clearInterval(resendTimerId);
            resendTimerId = setInterval(updateResendButton, 1000);
        }

        function switchToLogin() {
            document.querySelector('.login-modal')?.classList.remove('is-reset-step1');
            authMode = 'login';
            clearMsg();
            stopResendTimer();
            titleEl.textContent = 'Авторизація';
            passWrap.hidden = false;
            forgotEl.hidden = false;
            phoneBlock.hidden = true;
            codeBlock.hidden = true;
            newPassWrap.hidden = true;
            codeNoteEl.hidden = true;
            codeInput.value = '';
            newPassEl.value = '';
            passEl.value = '';
            if (backLinkEl) backLinkEl.hidden = true;
            if (resendBtn) resendBtn.hidden = true;
            if (notMyPhoneLink) notMyPhoneLink.hidden = true;
            if (box) box.hidden = false;
            if (notMyPhoneBox) notMyPhoneBox.hidden = true;
            submitBtn.textContent = 'Увійти';
        }

        function switchToResetStep1() {
            document.querySelector('.login-modal')?.classList.add('is-reset-step1');
            clearMsg();
            if (!premiumLock) {
                errEl.textContent = 'Скидання доступне лише для преміум профілів';
                return;
            }
            if (!premiumHasPhone) {
                errEl.textContent = 'Для цієї особи не додано номер телефону';
                return;
            }
            authMode = 'reset1';
            titleEl.textContent = 'Для зміни паролю вам буде надіслано код на номер телефону';
            passWrap.hidden = true;
            forgotEl.hidden = true;
            phoneBlock.hidden = false;
            showPhoneInfo();
            codeBlock.hidden = true;
            newPassWrap.hidden = true;
            codeNoteEl.hidden = true;
            if (resendBtn) resendBtn.hidden = true;
            ensureBackLink();
            if (backLinkEl) backLinkEl.hidden = false;
            if (notMyPhoneLink) notMyPhoneLink.hidden = false;
            if (box) box.hidden = true ? false : false; // просто гарантуємо, що головний бокс видимий
            if (notMyPhoneBox) notMyPhoneBox.hidden = true;
            submitBtn.textContent = 'Надіслати код';
            stopResendTimer();
        }

        function switchToResetStep2(showNote = false, { resetCode = true, resetPassword = true } = {}) {
            document.querySelector('.login-modal')?.classList.remove('is-reset-step1');
            authMode = 'reset2';
            titleEl.textContent = 'Змінити пароль';
            passWrap.hidden = true;
            forgotEl.hidden = true;
            phoneBlock.hidden = false;
            showPhoneInfo();
            codeBlock.hidden = false;
            newPassWrap.hidden = false;
            if (resetCode) codeInput.value = '';
            if (resetPassword) newPassEl.value = '';
            if (codeNoteEl) {
                if (showNote) {
                    codeNoteEl.hidden = true;
                    codeNoteEl.textContent = 'Код надіслано на ваш номер телефону';
                } else if (!codeNoteEl.textContent) {
                    codeNoteEl.hidden = true;
                }
            }
            if (resendBtn) resendBtn.hidden = false;
            ensureBackLink();
            if (backLinkEl) backLinkEl.hidden = false;
            if (notMyPhoneLink) notMyPhoneLink.hidden = true;
            submitBtn.textContent = 'Змінити пароль';
        }

        async function sendSmsCode({ advance = false } = {}) {
            if (!premiumHasPhone) {
                throw new Error('Для цієї особи не додано номер телефону');
            }

            const response = await fetch(`${API_URL}/api/send-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personId })
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const msg = data?.error || data?.details || 'Не вдалося надіслати код';
                throw new Error(msg);
            }

            if (advance) {
                switchToResetStep2(true);
            } else {
                switchToResetStep2(true, { resetCode: true, resetPassword: false });
            }
            startResendTimer();
        }

        async function completeReset() {
            const code = codeInput.value.trim();
            const newPassword = newPassEl.value.trim();
            if (!code || !newPassword) {
                throw new Error('Заповніть код та новий пароль');
            }

            const response = await fetch(`${PREMIUM_AUTH}/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personId, code, newPassword })
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || data?.ok === false) {
                const msg = data?.error || data?.description || 'Не вдалося змінити пароль';
                throw new Error(msg);
            }

            switchToLogin();
            errEl.style.color = '#1B8B59';
            errEl.textContent = 'Пароль змінено. Увійдіть з новим паролем.';
        }

        modal.addEventListener('login:reset', switchToLogin);
        forgotEl.addEventListener('click', switchToResetStep1);
        codeInput?.addEventListener('input', () => {
            codeInput.value = codeInput.value.replace(/\D+/g, '');
        });

        resendBtn?.addEventListener('click', async () => {
            if (resendBtn.disabled) return;
            clearMsg();
            try {
                await sendSmsCode({ advance: false });
            } catch (error) {
                errEl.textContent = error?.message || 'Не вдалося надіслати код';
            }
        });

        submitBtn.addEventListener('click', async () => {
            clearMsg();
            submitBtn.disabled = true;
            try {
                if (authMode === 'login') {
                    const password = passEl.value.trim();
                    if (!password) {
                        errEl.textContent = 'Вкажіть пароль';
                        return;
                    }

                    const res = await fetch(`${API_BASE}/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ person_id: personId, password })
                    });
                    const data = await res.json().catch(() => ({}));

                    if (!res.ok) {
                        const msg = data?.error || data?.description || 'Невірний пароль';
                        throw new Error(msg);
                    }

                    const params = new URLSearchParams(window.location.search);
                    const from = params.get('from');
                    const backTo = params.get('backTo');
                    const parts = [];
                    if (from) parts.push(`from=${encodeURIComponent(from)}`);
                    if (backTo) parts.push(`backTo=${encodeURIComponent(backTo)}`);
                    const suffix = parts.length ? `&${parts.join('&')}` : '';

                    localStorage.setItem(tokenKey, data.token);
                    window.location.href = `/profile_edit.html?personId=${encodeURIComponent(personId)}${suffix}`;
                    return;
                }

                if (authMode === 'reset1') {
                    // TEMP: skip /api/send-code while we tweak step 2 UI
                    // await sendSmsCode({ advance: true });
                    switchToResetStep2(true);
                    return;
                }

                if (authMode === 'reset2') {
                    await completeReset();
                    return;
                }
            } catch (error) {
                errEl.textContent = error?.message || 'Сталася помилка';
                errEl.style.color = '#e11d48';
            } finally {
                submitBtn.disabled = false;
            }
        });

        // "Не мій номер телефону" → показати окремий модал з інструкцією
        if (notMyPhoneLink && notMyPhoneBox && box) {
            notMyPhoneLink.addEventListener('click', () => {
                document.querySelector('.login-modal')?.classList.remove('is-reset-step1');
                if (authMode !== 'reset1') return; // тільки на кроці 1
                clearMsg();
                box.hidden = true;
                notMyPhoneBox.hidden = false;
            });
        }

        if (notMyPhoneBackBtn && notMyPhoneBox && box) {
            notMyPhoneBackBtn.addEventListener('click', () => {
                document.querySelector('.login-modal')?.classList.remove('is-reset-step1');
                notMyPhoneBox.hidden = true;
                box.hidden = false;
                // Повертаємось до кроку 1 reset
                if (authMode === 'reset1') {
                    switchToResetStep1();
                }
            });
        }

        switchToLogin();
    })();

    // "Забули пошту" flow
    const forgotEmailLink = document.getElementById('forgot-email');
    const forgotEmailModal = document.getElementById('forgot-email-modal');
    const backToResetBtn = document.getElementById('back-to-reset');
    const resetPasswordModal = document.getElementById('reset-password-modal'); // adjust ID if yours differs

    if (forgotEmailLink && forgotEmailModal && backToResetBtn && resetPasswordModal) {
        forgotEmailLink.addEventListener('click', () => {
            resetPasswordModal.hidden = true;
            forgotEmailModal.hidden = false;
        });

        backToResetBtn.addEventListener('click', () => {
            forgotEmailModal.hidden = true;
            resetPasswordModal.hidden = false;
        });
    }

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
    // Body scroll lock (robust on iOS/Android/Desktop)
    const BodyScrollLock = (() => {
        let y = 0, locked = false;
        return {
            lock() {
                if (locked) return;
                y = window.scrollY || document.documentElement.scrollTop || 0;
                const s = document.body.style;
                s.position = 'fixed';
                s.top = `-${y}px`;
                s.left = '0';
                s.right = '0';
                s.width = '100%';
                s.overflow = 'hidden';
                document.documentElement.style.overscrollBehavior = 'contain';
                locked = true;
            },
            unlock() {
                if (!locked) return;
                const s = document.body.style;
                s.position = '';
                s.top = '';
                s.left = '';
                s.right = '';
                s.width = '';
                s.overflow = '';
                document.documentElement.style.overscrollBehavior = '';
                window.scrollTo(0, y);
                locked = false;
            }
        };
    })();

    (function setupRelativesModal() {
        const openers = [
            document.getElementById('rel-add-option'),
            document.getElementById('add-relative-btn')
        ].filter(Boolean);

        const overlay = document.getElementById('relativesModal');
        if (!overlay || !openers.length) return;

        const closeBtn = document.getElementById('relModalClose');
        const submitBtn = document.getElementById('relSubmit');
        const submitBar = submitBtn?.closest('.rel-submit-bar');

        const syncSubmitBarVisibility = () => {
            if (!submitBar) return;
            const isHidden = !submitBtn || submitBtn.hidden || window.getComputedStyle(submitBtn).display === 'none';
            submitBar.style.display = isHidden ? 'none' : '';
        };
        syncSubmitBarVisibility();
        if (submitBtn && typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(() => syncSubmitBarVisibility());
            observer.observe(submitBtn, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
        }

        // Inputs
        const nameInput = document.getElementById('relName');
        const birthInput = document.getElementById('relBirthYear');
        const deathInput = document.getElementById('relDeathYear');
        const areaInput = document.getElementById('relArea');
        const nameClear = document.getElementById('relNameClear');

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

        function matchesNamePrefix(name, query) {
            if (!query) return true;
            if (!name) return false;
            const q = query.trim().toLowerCase();
            if (!q) return true;
            const parts = name.toLowerCase().trim().split(/\s+/).filter(Boolean);
            return parts.some(part => part.startsWith(q));
        }

        const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

        const relReturnKey = (id) => `relModalReturn:${id}`;

        let selected = [];         // [{id, name, birthYear, deathYear, avatarUrl}]
        let selectedBirth = birthInput.value ? Number(birthInput.value) : undefined;
        let selectedDeath = deathInput.value ? Number(deathInput.value) : undefined;
        let yearsPanelBackup = null;
        let relAreaId = '';

        // ───────────────── Years picker (drum)
        const YEAR_START = 1850;
        const YEAR_END = new Date().getFullYear();

        function populateYearList(listEl, placeholderLabel) {
            if (!listEl || listEl.children.length) return;

            const placeholder = document.createElement('li');
            placeholder.textContent = placeholderLabel;
            placeholder.dataset.value = '';
            listEl.appendChild(placeholder);

            for (let y = YEAR_END; y >= YEAR_START; y--) {
                const li = document.createElement('li');
                li.textContent = y;
                li.dataset.value = String(y);
                listEl.appendChild(li);
            }
        }

        populateYearList(birthList, 'Від');
        populateYearList(deathList, 'До');

        const formatYearsDisplayText = () => {
            if (selectedBirth && selectedDeath) {
                return `${selectedBirth} – ${selectedDeath}`;
            }
            if (selectedBirth) {
                return `${selectedBirth} –`;
            }
            if (selectedDeath) {
                return `– ${selectedDeath}`;
            }
            return 'Роки життя';
        };

        const updateYearsDisplay = () => {
            const hasAny = Boolean(selectedBirth || selectedDeath);
            const text = formatYearsDisplayText();
            display.textContent = text;
            display.classList.toggle('has-value', hasAny);
            clearYears.hidden = !hasAny;
            birthInput.value = selectedBirth ?? '';
            deathInput.value = selectedDeath ?? '';
        };

        function storeYearsPanelState() {
            yearsPanelBackup = {
                birthValue: birthWheel?.getValue() || birthInput.value || '',
                deathValue: deathWheel?.getValue() || deathInput.value || '',
                selectedBirth,
                selectedDeath
            };
        }

        function restoreYearsPanelState() {
            if (!yearsPanelBackup) return;
            selectedBirth = yearsPanelBackup.selectedBirth;
            selectedDeath = yearsPanelBackup.selectedDeath;
            if (birthWheel) {
                birthWheel.setValue(yearsPanelBackup.birthValue || '', { silent: true, behavior: 'auto' });
            }
            if (deathWheel) {
                deathWheel.setValue(yearsPanelBackup.deathValue || '', { silent: true, behavior: 'auto' });
            }
            updateYearsDisplay();
            yearsPanelBackup = null;
        }

        const enforceRelChronology = (source = 'birth', behavior = 'smooth') => {
            const birthYear = selectedBirth ? Number(selectedBirth) : undefined;
            const deathYear = selectedDeath ? Number(selectedDeath) : undefined;
            if (!birthYear || !deathYear) return false;
            if (birthYear === deathYear) return false;

            if (birthYear > deathYear) {
                if (source === 'death') {
                    birthWheel.setValue(String(deathYear), { silent: true, behavior });
                    selectedBirth = deathYear;
                } else {
                    deathWheel.setValue(String(birthYear), { silent: true, behavior });
                    selectedDeath = birthYear;
                }
                return true;
            }
            return false;
        };

        const applyDeathConstraints = () => {
            const birthYear = selectedBirth ? Number(selectedBirth) : undefined;
            let hasEnabledNonEmpty = false;

            Array.from(deathList.children).forEach((li) => {
                const raw = li.dataset.value ?? '';
                const year = raw === '' ? NaN : Number(raw);
                const disabled = Number.isFinite(year) && birthYear ? year < birthYear : false;
                li.classList.toggle('disabled', disabled);
                if (!disabled && raw !== '') {
                    hasEnabledNonEmpty = true;
                }
            });

            if (!deathWheel) return;

            if (birthYear && !hasEnabledNonEmpty) {
                deathWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
                selectedDeath = undefined;
            }

            deathWheel.refresh();
        };

        let deathWheel;

        const birthWheel = window.createYearWheel(birthList, {
            initialValue: birthInput.value || selectedBirth || '',
            onChange: (value) => {
                selectedBirth = value ? Number(value) : undefined;
                enforceRelChronology('birth');
                applyDeathConstraints();
                updateYearsDisplay();
            }
        });

        deathWheel = window.createYearWheel(deathList, {
            initialValue: deathInput.value || selectedDeath || '',
            onChange: (value) => {
                selectedDeath = value ? Number(value) : undefined;
                enforceRelChronology('death');
                applyDeathConstraints();
                updateYearsDisplay();
            }
        });

        enforceRelChronology('birth', 'auto');
        applyDeathConstraints();
        updateYearsDisplay();

        // Toggle panel on pill click
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = panel.hidden;
            panel.hidden = !panel.hidden;
            if (willOpen) {
                storeYearsPanelState();
                const hasBirth = !!birthWheel.getValue();
                const hasDeath = !!deathWheel.getValue();
                if (!hasBirth) birthWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
                if (!hasDeath) deathWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
            } else {
                restoreYearsPanelState();
            }
        });

        // ONLY close panel when "Done" button is clicked
        yearsDone.addEventListener('click', () => {
            const b = birthWheel.getValue() || '';
            const d = deathWheel.getValue() || '';

            selectedBirth = b ? Number(b) : undefined;
            selectedDeath = d ? Number(d) : undefined;

            enforceRelChronology('birth', 'auto');
            applyDeathConstraints();
            updateYearsDisplay();

            // CLOSE ONLY on Done button click
            panel.hidden = true;
            yearsPanelBackup = null;
            triggerFetch();
        });

        clearYears.addEventListener('click', (e) => {
            e.stopPropagation();

            // 1) reset state + hidden inputs
            selectedBirth = selectedDeath = undefined;
            birthInput.value = '';
            deathInput.value = '';

            // 2) tell wheels to clear AND remove any visual .selected
            birthWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
            deathWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
            birthList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            deathList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

            // 3) constraints + UI
            applyDeathConstraints();
            updateYearsDisplay();

            // 4) snap focus to the placeholder rows ("Від" / "До") so the panel looks reset
            requestAnimationFrame(() => {
                birthWheel.snap({ behavior: 'auto', silent: true });
                deathWheel.snap({ behavior: 'auto', silent: true });
            });

            // 5) re-fetch results
            triggerFetch();
            yearsPanelBackup = null;
        });

        // Prevent closing panel when clicking inside it
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Close panel if clicking outside of it
        document.addEventListener('click', (e) => {
            if (!panel.hidden && !e.target.closest('#relYearsPill') && !e.target.closest('#relYearsPanel')) {
                restoreYearsPanelState();
                panel.hidden = true;
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!panel.hidden) {
                    restoreYearsPanelState();
                    panel.hidden = true;
                }
            }
        });

        // ───────────────── Area suggestions (keep as before) + clear button visibility
        const areaSug = document.getElementById('relAreaSuggestions');
        const relCemSug = document.getElementById('relCemeterySuggestions');

        (function autoHideRelSuggestions() {
            const handler = (e) => {
                const target = e.target;
                if (!target) return;
                if (areaInput && (target === areaInput || areaSug?.contains(target))) return;
                if (cemInput && (target === cemInput || relCemSug?.contains(target))) return;
                if (areaSug) areaSug.style.display = 'none';
                if (relCemSug) relCemSug.classList.remove('show');
            };
            document.addEventListener('focusin', handler);
        })();
        function updateRelNameClearBtn() {
            if (!nameClear || !nameInput) return;
            nameClear.style.display = nameInput.value.trim() ? 'inline-flex' : 'none';
        }
        nameInput?.addEventListener('input', () => updateRelNameClearBtn());
        nameClear?.addEventListener('click', (e) => {
            e.preventDefault();
            if (!nameInput) return;
            nameInput.value = '';
            updateRelNameClearBtn();
            nameInput.focus();
            triggerFetch();
        });
        updateRelNameClearBtn();

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
                const items = await res.json();
                const list = Array.isArray(items) ? items : [];
                areaSug.innerHTML = list.length
                    ? list.map(item => {
                        const display = (item.display ?? '').toString();
                        const safe = display.replace(/"/g, '&quot;');
                        return `<li style="text-align: left" data-area-id="${(item.id ?? '').toString()}">${safe}</li>`;
                    }).join('')
                    : '<li class="no-results">Збігів не знайдено</li>';
                areaSug.style.display = 'block';
                updateAreaClearBtn();
            }, 300);

            areaInput.addEventListener('input', () => { run(); /* do not fetch people yet */ updateAreaClearBtn(); });

            areaSug.addEventListener('click', (e) => {
                const li = e.target.closest('li');
                if (!li || li.classList.contains('no-results')) return;

                const areaNameFull = li.textContent.trim();
                const rawAreaId = li.dataset.areaId || '';
                const areaId = rawAreaId && rawAreaId !== 'undefined' ? rawAreaId : '';

                areaInput.value = areaNameFull;
                relAreaId = areaId;
                areaSug.style.display = 'none';
                updateAreaClearBtn();

                // Area changed → clear cemetery to avoid mismatch
                cemInput.value = '';
                cemSugList?.classList?.remove('show');

                if (document.activeElement === cemInput) {
                    fetchRelCemeteries();
                }

                triggerFetch(); // area is a real filter now
            });
        })();

        // Area CLEAR → also clears cemetery (Fix #1 & #2)
        areaClear?.addEventListener('click', (e) => {
            e.preventDefault();
            areaInput.value = '';
            relAreaId = '';
            areaSug.style.display = 'none';
            updateAreaClearBtn();

            cemInput.value = '';
            cemSugList.classList.remove('show');

            if (document.activeElement === cemInput) {
                fetchRelCemeteries();
            }

            triggerFetch();
        });

        // ───────────────── Cemetery suggestions
        const fetchRelCemeteries = async () => {
            const q = cemInput.value.trim();
            const area = areaInput.value.trim();
            const allowEmptyQuery = Boolean(relAreaId || area);

            if (!allowEmptyQuery && q.length === 0) {
                cemSugList.classList.remove('show');
                return;
            }

            const params = new URLSearchParams();
            if (q) params.set('search', q);
            if (relAreaId) {
                params.set('areaId', relAreaId);
            } else if (area) {
                params.set('area', area);
            }

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

        // Show list immediately on focus when area is chosen; otherwise wait for typing
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
                    areaId: relAreaId || '',
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
                    displayText: display?.textContent || 'Роки життя',
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
            if (relAreaId) p.set('areaId', relAreaId);
            if (ar) p.set('area', ar);
            if (cm) p.set('cemetery', cm);
            if (by) p.set('birthYear', by);
            if (dy) p.set('deathYear', dy);

            // Fetch
            const res = await fetch(`${API_URL}/api/people?${p.toString()}`);
            const data = await res.json().catch(() => ({ people: [] }));
            const raw = Array.isArray(data.people) ? data.people : [];

            // Exclude already selected and (optionally) the current person
            const selectedIdSet = new Set(selected.map(s => String(s.id)));
            let list = raw
                .filter(x => String(x.id) !== String(personId));

            if (nm) {
                list = list.filter(p => matchesNamePrefix(p.name, nm));
            }

            // Render
            foundList.innerHTML = list.map(p => {
                const idStr = String(p.id);
                const isSelected = selectedIdSet.has(idStr);
                const liClassAttr = isSelected ? ' class="is-selected"' : '';
                return `
              <li data-id="${idStr}" tabindex="0"${liClassAttr}>
                <img class="avatar" src="${p.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'}" alt="">
                <div class="info">
                  <div class="name">${p.name || ''}</div>
                  <div class="years">${(p.birthYear || '')} – ${(p.deathYear || '')}</div>
                </div>
                <button class="select-btn${isSelected ? ' is-hidden' : ''}" type="button" aria-label="Додати" ${isSelected ? 'tabindex="-1" disabled aria-hidden="true"' : ''}><img src="/img/plus-icon.png" alt="Додати" class="plus-icon" width="24" height="24"></button>
              </li>`;
            }).join('');

            // Counters + empty state labels
            foundCountEl.textContent = String(list.length);
            if (foundLabel) foundLabel.hidden = list.length === 0;
            if (noResults) noResults.hidden = list.length !== 0;

            // (+) add to selected
            foundList.querySelectorAll('li button.select-btn:not(.is-hidden)').forEach(btn => {
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const li = btn.closest('li[data-id]');
                    if (!li) return;
                    const id = li.dataset.id;
                    const person = list.find(x => String(x.id) === id);
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
            overlay.classList.toggle('relatives-no-selected', selected.length === 0);

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
                    const currentlyOpen = ul.classList.contains('show');
                    closeAllRelRoleLists();
                    if (!currentlyOpen) {
                        ul.classList.add('show');
                    }
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
                relAreaId = saved.filters?.areaId || '';
                if (cemInput && saved.filters?.cemetery) cemInput.value = saved.filters.cemetery;
                if (birthInput && saved.filters?.birthYear) birthInput.value = saved.filters.birthYear;
                if (deathInput && saved.filters?.deathYear) deathInput.value = saved.filters.deathYear;

                // 3) Restore years display state
                if (saved.yearsState) {
                    selectedBirth = saved.yearsState.selectedBirth;
                    selectedDeath = saved.yearsState.selectedDeath;

                    if (display) {
                        display.textContent = saved.yearsState.displayText || 'Роки життя';
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
                updateRelNameClearBtn();
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
                display.textContent = 'Роки життя';
                display.classList.remove('has-value');
                clearYears.hidden = true;

                // Reset years state
                selectedBirth = selectedDeath = undefined;
                relAreaId = '';
                birthList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                deathList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

                selected = [];
                renderSelected(); // will also hide selectedCountRow when empty

                foundList.innerHTML = '';
                foundCountEl.textContent = '0';
            }

            updateRelNameClearBtn();

            // Make sure years panel is closed when opening modal
            panel.hidden = true;

            // hide Area clear initially
            if (areaClear) areaClear.style.display = 'none';

            overlay.hidden = false;
            BodyScrollLock.lock();
        }

        function closeModal() {
            overlay.hidden = true;
            BodyScrollLock.unlock();
        }

        openers.forEach(el => el.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        }));

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

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
                closeModal();
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
        function escapeHtml(str) {
            return (str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/\n/g, '<br>');
        }
