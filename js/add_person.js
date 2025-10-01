const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app/';

document.addEventListener('DOMContentLoaded', () => {
    // ------- DEBUG helper -------
    const D = (...args) => console.log('[YEARS]', ...args);

    // ——— Drawer menu ———
    const menuBtn = document.getElementById('menu-btn');
    const sideMenu = document.getElementById('side-menu');
    const overlay = document.getElementById('overlay');

    menuBtn.addEventListener('click', () => {
        sideMenu.classList.toggle('open');
        overlay.classList.toggle('open');
    });
    overlay.addEventListener('click', () => {
        sideMenu.classList.remove('open');
        overlay.classList.remove('open');
    });

    // ——— YearsPanel ———
    const picker = document.getElementById('lifeYearsPicker');
    const display = document.getElementById('years-display');
    const clearBtn = document.getElementById('clearYears');
    const panel = document.getElementById('years-panel');
    const birthUl = document.getElementById('birthYearsList');
    const deathUl = document.getElementById('deathYearsList');
    const doneBtn = document.getElementById('doneYears');
    D('INIT: years elements fetched', { panelHidden: panel?.hidden });

    // hidden inputs to keep values in the form
    let birthInput = document.getElementById('birthYear');
    let deathInput = document.getElementById('deathYear');
    const form = document.getElementById('personForm');

    if (!birthInput) {
        birthInput = document.createElement('input');
        birthInput.type = 'hidden'; birthInput.id = 'birthYear'; birthInput.name = 'birthYear';
        form.appendChild(birthInput);
        D('INIT: created hidden #birthYear');
    }
    if (!deathInput) {
        deathInput = document.createElement('input');
        deathInput.type = 'hidden'; deathInput.id = 'deathYear'; deathInput.name = 'deathYear';
        form.appendChild(deathInput);
        D('INIT: created hidden #deathYear');
    }

    // current selections
    let selectedBirth = birthInput.value ? Number(birthInput.value) : undefined;
    let selectedDeath = deathInput.value ? Number(deathInput.value) : undefined;
    D('INIT: selectedBirth/selectedDeath from hidden inputs', { selectedBirth, selectedDeath });

    // populate years
    (function populateYears() {
        if (birthUl.children.length) return;

        // FIRST ROWS (selectable clear-rows): data-value=""
        const bClear = document.createElement('li');
        bClear.textContent = 'Від';
        bClear.dataset.value = '';           // empty value → “not selected”
        birthUl.appendChild(bClear);

        const dClear = document.createElement('li');
        dClear.textContent = 'До';
        dClear.dataset.value = '';           // empty value → “not selected”
        deathUl.appendChild(dClear);

        // YEARS
        const now = new Date().getFullYear();
        for (let y = now; y >= 1900; y--) {
            const liB = document.createElement('li');
            liB.textContent = y;
            liB.dataset.value = String(y);
            birthUl.appendChild(liB);

            const liD = document.createElement('li');
            liD.textContent = y;
            liD.dataset.value = String(y);
            deathUl.appendChild(liD);
        }

        D('POPULATE: birth/death lists ready', {
            birthCount: birthUl.children.length,
            deathCount: deathUl.children.length,
            birthFirst: birthUl.children[0]?.dataset?.value ?? null,
            deathFirst: deathUl.children[0]?.dataset?.value ?? null
        });
    })();

    function updateDisplay() {
        const hasAny = !!(selectedBirth || selectedDeath);
        const text = hasAny
            ? `${selectedBirth ?? ""}${(selectedBirth && selectedDeath) ? " – " : ""}${selectedDeath ?? ""}`
            : 'Роки життя';

        display.textContent = text;
        display.classList.toggle('has-value', hasAny);
        picker.classList.toggle('has-value', hasAny);
        clearBtn.hidden = !hasAny;

        // sync hidden inputs for submission
        birthInput.value = selectedBirth ?? '';
        deathInput.value = selectedDeath ?? '';

        D('updateDisplay()', {
            selectedBirth, selectedDeath, text,
            birthInput: birthInput.value, deathInput: deathInput.value
        });
    }

    const enforceChronology = (source = 'birth', behavior = 'smooth') => {
        const birthYear = selectedBirth;
        const deathYear = selectedDeath;

        // If either side is unset (empty placeholder “Від/До”), skip enforcement
        if (birthYear === undefined || deathYear === undefined) {
            return false;
        }

        if (birthYear === deathYear) {
            return false;
        }

        if (birthYear > deathYear) {
            if (source === 'death') {
                D('enforceChronology(): adjusting birth down to match death', { birthYear, deathYear, source });
                birthWheel.setValue(String(deathYear), { silent: true, behavior });
                selectedBirth = deathYear;
            } else {
                D('enforceChronology(): adjusting death up to match birth', { birthYear, deathYear, source });
                deathWheel.setValue(String(birthYear), { silent: true, behavior });
                selectedDeath = birthYear;
            }
            return true;
        }

        return false;
    };

    const applyDeathConstraints = () => {
        if (!deathWheel) return;

        const birthYear = selectedBirth;
        let hasEnabledNonEmpty = false;

        Array.from(deathUl.children).forEach((li) => {
            const raw = li.dataset.value ?? '';
            const year = raw === '' ? NaN : Number(raw);
            // Only disable real years, never disable the placeholder “До”
            const disabled = (raw !== '' && Number.isFinite(year) && birthYear) ? year < birthYear : false;
            li.classList.toggle('disabled', disabled);
            if (!disabled && raw !== '') {
                hasEnabledNonEmpty = true;
            }
        });

        if (birthYear && !hasEnabledNonEmpty) {
            D('applyDeathConstraints(): no enabled death years remain → clear death selection', { birthYear });
            deathWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
            selectedDeath = undefined;
        }

        D('applyDeathConstraints(): refresh death wheel state', {
            birthYear,
            selectedDeath
        });
        deathWheel.refresh();
    };

    let deathWheel;

    const birthWheel = window.createYearWheel(birthUl, {
        initialValue: selectedBirth ? String(selectedBirth) : '',
        onChange: (value) => {
            const prev = selectedBirth;
            selectedBirth = value ? Number(value) : undefined;
            D('birthWheel.onChange()', { prev, value, selectedBirth });
            const adjusted = enforceChronology('birth', 'smooth');
            applyDeathConstraints();
            if (adjusted) {
                D('birthWheel.onChange(): chronology adjusted, syncing death wheel');
            }
            updateDisplay();
        }
    });
    D('birthWheel created', { initial: selectedBirth ?? '' });

    deathWheel = window.createYearWheel(deathUl, {
        initialValue: selectedDeath ? String(selectedDeath) : '',
        onChange: (value) => {
            const prev = selectedDeath;
            selectedDeath = value ? Number(value) : undefined;
            D('deathWheel.onChange()', { prev, value, selectedDeath });
            const adjusted = enforceChronology('death', 'smooth');
            applyDeathConstraints();
            if (adjusted) {
                D('deathWheel.onChange(): chronology adjusted, syncing birth wheel');
            }
            updateDisplay();
        }
    });
    D('deathWheel created', { initial: selectedDeath ?? '' });

    enforceChronology('birth', 'auto');
    applyDeathConstraints();
    updateDisplay();

    // open/close panel
    display.addEventListener('click', () => {
        const before = { birth: birthWheel.getValue(), death: deathWheel.getValue() };
        panel.hidden = !panel.hidden;
        D('display.click → toggle panel', { hidden: panel.hidden, before });

        if (!panel.hidden) {
            const hasBirth = !!birthWheel.getValue();
            const hasDeath = !!deathWheel.getValue();

            // Снепимо тільки якщо є зафіксоване значення (щоб не тягнутися до "Від/До")
            if (hasBirth) {
                D('display.click → opening: snap birth (has value)');
                birthWheel.snap({ behavior: 'auto', silent: true });
            }
            if (hasDeath) {
                D('display.click → opening: snap death (has value)');
                deathWheel.snap({ behavior: 'auto', silent: true });
            }
        }
    });

    panel.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', e => {
        if (!picker.contains(e.target)) {
            panel.hidden = true;
            D('document.click → close panel');
        }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            panel.hidden = true;
            D('keydown[Escape] → close panel');
        }
    });

    doneBtn.addEventListener('click', () => {
        const birthValue = birthWheel.getValue();
        const deathValue = deathWheel.getValue();
        D('doneBtn.click()', { birthValue, deathValue });

        selectedBirth = birthValue ? Number(birthValue) : undefined;
        selectedDeath = deathValue ? Number(deathValue) : undefined;

        const adjusted = enforceChronology('birth', 'auto');
        if (adjusted) {
            D('doneBtn.click(): chronology adjusted before closing panel', {
                selectedBirth,
                selectedDeath
            });
        }
        applyDeathConstraints();
        updateDisplay();
        panel.hidden = true;
        D('doneBtn.click() → panel.hidden=true');
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        D('clearBtn.click() → clearing both wheels & selections', {
            before: { selectedBirth, selectedDeath }
        });
        selectedBirth = undefined;
        selectedDeath = undefined;
        birthWheel.clear({ silent: true, keepActive: false });
        deathWheel.clear({ silent: true, keepActive: false });
        applyDeathConstraints();
        updateDisplay();
    });

    // ——— City & Cemetery suggestions (unchanged) ———
    const cityInput = document.getElementById('city');
    const clearCityBtn = document.getElementById('clear-city');
    const citySuggest = document.getElementById('location-suggestions');
    const cemInput = document.getElementById('cemetery');
    const clearCemBtn = document.getElementById('clear-cem');
    const cemSuggest = document.getElementById('cemetery-suggestions');

    let cityTimer, cemTimer;

    // додамо невеличкий escape, щоб уникнути XSS у розмітці
    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    async function fetchCemeteries(search = '') {
        const params = new URLSearchParams({
            search,
            // якщо бек досі підтримує фільтр area — залишаємо; інакше бек проігнорує
            area: cityInput.value || ''
        });

        try {
            const res = await fetch(`${API_URL}/api/cemeteries?${params}`);
            const list = await res.json(); // тепер це [{ area, name }, ...]
            cemSuggest.innerHTML = (Array.isArray(list) && list.length)
                ? list.map(c => {
                    const name = esc(c.name);
                    const area = esc(c.area);
                    return `<li data-name="${name}" data-area="${area}">${name}</li>`;
                }).join('')
                : `<li class="no-results">Збігів не знайдено</li>`;
            cemSuggest.style.display = 'block';
        } catch (e) {
            console.error(e);
        }
    }

    // CITY
    clearCityBtn.style.display = 'none';
    cityInput.addEventListener('input', () => {
        clearCityBtn.style.display = cityInput.value ? 'flex' : 'none';
        clearTimeout(cityTimer);
        cityTimer = setTimeout(async () => {
            if (cityInput.value.length < 1) {
                citySuggest.innerHTML = ''; citySuggest.style.display = 'none'; return;
            }
            try {
                const res = await fetch(`${API_URL}/api/locations?search=${encodeURIComponent(cityInput.value)}`);
                const list = await res.json();
                citySuggest.innerHTML = list.length
                    ? list.map(a => `<li>${a}</li>`).join('')
                    : `<li class="no-results">Збігів не знайдено</li>`;
                citySuggest.style.display = 'block';
            } catch (e) { console.error(e); }
        }, 300);
    });
    citySuggest.addEventListener('click', e => {
        if (e.target.tagName === 'LI' && !e.target.classList.contains('no-results')) {
            cityInput.value = e.target.textContent;
            citySuggest.style.display = 'none';
            clearCityBtn.style.display = 'flex';
        }
    });
    cityInput.addEventListener('blur', () => { setTimeout(() => citySuggest.style.display = 'none', 200); });
    clearCityBtn.addEventListener('click', () => {
        // очистити місто
        cityInput.value = '';
        clearCityBtn.style.display = 'none';
        citySuggest.innerHTML = '';
        citySuggest.style.display = 'none';

        // одночасно очистити кладовище
        cemInput.value = '';
        clearCemBtn.style.display = 'none';
        cemSuggest.innerHTML = '';
        cemSuggest.style.display = 'none';
    });

    // CEMETERY
    clearCemBtn.style.display = 'none';
    cemInput.addEventListener('input', () => {
        clearCemBtn.style.display = cemInput.value ? 'flex' : 'none';
        clearTimeout(cemTimer);
        cemTimer = setTimeout(() => {
            if (cemInput.value.length < 1) {
                cemSuggest.innerHTML = ''; cemSuggest.style.display = 'none';
            } else {
                fetchCemeteries(cemInput.value);
            }
        }, 300);
    });
    cemInput.addEventListener('focus', () => {
        if (!cityInput.value) return;
        clearCemBtn.style.display = 'none';
        fetchCemeteries('');
    });
    cemSuggest.addEventListener('click', e => {
        const li = e.target.closest('li');
        if (!li || li.classList.contains('no-results')) return;

        const name = li.getAttribute('data-name') || li.textContent.trim();
        const area = li.getAttribute('data-area') || '';

        // Заповнюємо поле "Кладовище"
        cemInput.value = name;
        cemSuggest.style.display = 'none';
        clearCemBtn.style.display = 'flex';

        // Якщо населений пункт ще порожній — підставляємо area з підказки
        if (!cityInput.value && area) {
            cityInput.value = area;
            clearCityBtn.style.display = 'flex';
        }
    });
    cemInput.addEventListener('blur', () => { setTimeout(() => cemSuggest.style.display = 'none', 200); });
    clearCemBtn.addEventListener('click', () => {
        cemInput.value = ''; clearCemBtn.style.display = 'none';
        cemSuggest.innerHTML = ''; cemSuggest.style.display = 'none';
    });

    // activityArea clear button behavior
    const activitySelect = document.getElementById('activityArea');
    const clearActivityBtn = document.getElementById('clear-activity');

    if (activitySelect && clearActivityBtn) {
        activitySelect.addEventListener('change', () => {
            // CSS handles visibility via :required:valid; no JS needed here
        });

        clearActivityBtn.addEventListener('click', () => {
            activitySelect.selectedIndex = 0;                      // back to placeholder
            activitySelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    // ——— ActivityArea: custom suggestions-style dropdown ———
    (function initActivityAreaDropdown() {
        const select = document.getElementById('activityArea');
        const clearBtn = document.getElementById('clear-activity');
        if (!select || !clearBtn) return;

        // 1) Build a display input (readonly) that triggers the list
        const pill = select.closest('.year-pill') || select.parentElement;
        const display = document.createElement('input');
        display.classList.add('input-with-chevron');
        display.type = 'text';
        display.id = 'activityDisplay';
        display.placeholder = select.options[0]?.text || 'Сфера діяльності';
        display.readOnly = true;

        // style: reuse your input styles (same as other text inputs)
        display.setAttribute('autocomplete', 'off');
        display.style.width = '100%';
        display.style.height = '49px';
        display.style.padding = '12px 12px 12px 22px';
        display.style.border = 'none';
        display.style.borderRadius = '12px';
        // display.style.background = '#EFF2F5';
        display.style.fontFamily = 'Montserrat, sans-serif';
        display.style.fontSize = '16px';
        display.style.fontWeight = '460';
        display.style.color = '#222';
        display.style.cursor = 'pointer';

        // insert the display input before the (now hidden) select
        pill.insertBefore(display, select);

        // hide the native select (keep it for value/validation)
        select.style.display = 'none';

        // 2) Suggestions list (styled like city/cemetery suggestions)
        const list = document.createElement('ul');
        list.className = 'suggestions-list';
        list.id = 'activity-suggestions';
        pill.appendChild(list);

        // helper: fill list from <select> options (skip placeholder)
        function populate() {
            const items = [];
            for (let i = 0; i < select.options.length; i++) {
                const opt = select.options[i];
                if (!opt.value) continue; // skip placeholder
                items.push(`<li data-value="${opt.value}">${opt.text}</li>`);
            }
            list.innerHTML = items.join('') || `<li class="no-results">Немає опцій</li>`;
        }

        // open/close
        function openList() {
            populate();
            list.style.display = 'block';
            display.classList.add('open');
        }
        function closeList() {
            list.style.display = 'none';
            display.classList.remove('open');
        }

        // interactions
        display.addEventListener('click', (e) => {
            e.stopPropagation();
            (list.style.display === 'block') ? closeList() : openList();
        });

        list.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (!li || li.classList.contains('no-results')) return;

            const val = li.getAttribute('data-value');
            const txt = li.textContent;

            // set both UI + underlying select
            select.value = val;
            display.value = txt;

            // dispatch change so any listeners/validation update
            select.dispatchEvent(new Event('change', { bubbles: true }));

            // show clear
            clearBtn.style.display = 'flex';

            closeList();
        });

        // outside click / esc
        document.addEventListener('click', (e) => {
            if (!pill.contains(e.target)) closeList();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeList();
        });

        // keep display in sync if something sets select.value elsewhere
        select.addEventListener('change', () => {
            const opt = select.options[select.selectedIndex];
            if (opt && opt.value) {
                display.value = opt.text;
                clearBtn.style.display = 'flex';
                display.classList.add('has-value');   // <— add this
            } else {
                display.value = '';
                display.placeholder = select.options[0]?.text || 'Сфера діяльності';
                clearBtn.style.display = 'none';
                display.classList.remove('has-value'); // <— remove when empty
            }
        });

        // clear behavior
        clearBtn.addEventListener('click', () => {
            select.selectedIndex = 0; // back to placeholder
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    })();

    // ——— Notable toggle ———
    const notableCheckbox = document.getElementById('notablePerson');
    const notableFields = document.getElementById('notable-fields');
    notableCheckbox.addEventListener('change', () => {
        notableFields.style.display = notableCheckbox.checked ? 'block' : 'none';
    });

    // ——— Confirm modal + toast ———
    const confirmModal = document.getElementById('confirm-modal');
    const confirmClose = document.getElementById('confirm-close');
    const confirmEdit = document.getElementById('confirm-edit');
    const confirmSend = document.getElementById('confirm-send');
    const confirmSummary = document.getElementById('confirm-summary');
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toast-text');
    const toastClose = document.getElementById('toast-close');

    let pendingPayload = null;

    function openConfirm(payload) {
        pendingPayload = payload;
        const rows = [
            ['ПІБ', payload.name],
            ['Рік народження', payload.birthYear],
            ['Рік смерті', payload.deathYear],
            ['Населений пункт', payload.area],
            ['Кладовище', payload.cemetery]
        ];
        if (payload.occupation) rows.push(['Сфера діяльності', payload.occupation]);
        if (payload.link) rows.push(['Посилання', payload.link]);
        if (payload.bio) rows.push(['Опис', payload.bio]);

        confirmSummary.innerHTML = rows
            .map(([k, v]) => `<div class="row"><span class="k">${k}:</span> <span class="v">${(v || '').toString()}</span></div>`)
            .join('');
        document.getElementById('modal-overlay').hidden = false;
        confirmModal.hidden = false;
    }
    function closeConfirm() {
        confirmModal.hidden = true;
        document.getElementById('modal-overlay').hidden = true;
    }
    function showToast(msg) {
        toastText.textContent = msg;
        toast.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    toastClose.addEventListener('click', (e) => { e.preventDefault(); toast.hidden = true; });

    async function sendModeration(payload) {
        try {
            const res = await fetch(`${API_URL}/api/people/add_moderation`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const json = await res.json();
            closeConfirm();
            if (json.success) {
                showToast("Успішно відправлено на модерацію! Ми сповістимо вас коли буде готово");
                clearForm();
            } else {
                alert('Щось пішло не так. Спробуйте ще раз.');
            }
        } catch (e) {
            console.error(e);
            alert('Помилка мережі. Перевірте підключення.');
        } finally {
            pendingPayload = null;
        }
    }

    confirmClose.addEventListener('click', closeConfirm);
    confirmEdit.addEventListener('click', closeConfirm);
    confirmSend.addEventListener('click', () => { if (pendingPayload) sendModeration(pendingPayload); });

    // ——— Submission ———
    const overlayEl = document.getElementById('modal-overlay');
    const modalEl = document.getElementById('success-modal');
    const closeBtn = document.getElementById('modal-close');
    const okBtn = document.getElementById('modal-ok');

    function showModal() { overlayEl.hidden = false; modalEl.style.display = 'block'; }
    function hideModal() { overlayEl.hidden = true; modalEl.style.display = 'none'; }
    closeBtn.addEventListener('click', hideModal);
    okBtn.addEventListener('click', hideModal);

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // clear previous errors
        document.querySelectorAll('.error-message').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
        let hasError = false;

        // Name validation
        const fullNameInput = document.getElementById('fullName');
        const fullNameError = document.getElementById('fullNameError');
        const name = fullNameInput.value.trim();

        if (!name) {
            fullNameError.textContent = "Введіть ПІБ";
            fullNameError.style.display = 'block';
            hasError = true;
        } else {
            const parts = name.split(/\s+/).filter(Boolean);
            if (name.includes('.') || parts.length < 3 || parts.some(p => p.length <= 1)) {
                fullNameError.textContent = "Введіть повне ім'я та по-батькові";
                fullNameError.style.display = 'block';
                hasError = true;
            }
        }

        // Years validation (require both for submission)
        if (!selectedBirth || !selectedDeath) {
            showError(display, "Оберіть роки життя");
            hasError = true;
        }

        const city = document.getElementById('city');
        if (!city.value.trim()) { showError(city, "Введіть населений пункт"); hasError = true; }

        const cemetery = document.getElementById('cemetery');
        if (!cemetery.value.trim()) { showError(cemetery, "Введіть назву кладовища"); hasError = true; }

        let occupation = '', link = '', bio = '';
        if (document.getElementById('notablePerson').checked) {
            const occupationSelect = document.getElementById('activityArea');
            const linkInput = document.getElementById('internetLinks');
            const bioInput = document.getElementById('achievements');
            occupation = occupationSelect.value;
            link = linkInput.value.trim();
            bio = bioInput.value.trim();

            if (!occupation) { showError(occupationSelect, "Оберіть сферу діяльності"); hasError = true; }
            if (!link) { showError(linkInput, "Введіть посилання на інтернет джерела"); hasError = true; }
            if (!bio) { showError(bioInput, "Введіть опис"); hasError = true; }
        }

        if (hasError) return;

        // Open confirmation with the correct years
        openConfirm({
            name,
            birthYear: selectedBirth,
            deathYear: selectedDeath,
            area: city.value.trim(),
            cemetery: cemetery.value.trim(),
            occupation,
            link,
            bio
        });
    });

    // error helper
    function showError(inputElement, message) {
        let errorDiv = inputElement.parentElement.querySelector('.error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.classList.add('error-message');
            inputElement.parentElement.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    function clearForm() {
        form.reset();
        document.querySelectorAll('.error-message').forEach(el => { el.textContent = ''; el.style.display = 'none'; });

        // reset suggestions & clear buttons
        document.getElementById('clear-city').style.display = 'none';
        document.getElementById('clear-cem').style.display = 'none';
        document.getElementById('location-suggestions').style.display = 'none';
        document.getElementById('cemetery-suggestions').style.display = 'none';

        // reset notable
        const nf = document.getElementById('notable-fields');
        if (nf) nf.style.display = 'none';

        // reset years panel
        D('clearForm(): reset years');
        selectedBirth = selectedDeath = undefined;
        birthUl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        deathUl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        deathUl.querySelectorAll('.disabled').forEach(el => el.classList.remove('disabled'));
        updateDisplay();
        panel.hidden = true;
    }
});
