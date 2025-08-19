const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app/';

document.addEventListener('DOMContentLoaded', () => {
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

    // ——— YearsPanel: use existing markup from HTML ———
    const picker = document.getElementById('lifeYearsPicker');
    const display = document.getElementById('years-display');
    const clearBtn = document.getElementById('clearYears');
    const panel = document.getElementById('years-panel');
    const birthUl = document.getElementById('birthYearsList');
    const deathUl = document.getElementById('deathYearsList');
    const doneBtn = document.getElementById('doneYears');

    // hidden inputs to keep values in the form
    let birthInput = document.getElementById('birthYear');
    let deathInput = document.getElementById('deathYear');
    const form = document.getElementById('personForm');

    if (!birthInput) {
        birthInput = document.createElement('input');
        birthInput.type = 'hidden'; birthInput.id = 'birthYear'; birthInput.name = 'birthYear';
        form.appendChild(birthInput);
    }
    if (!deathInput) {
        deathInput = document.createElement('input');
        deathInput.type = 'hidden'; deathInput.id = 'deathYear'; deathInput.name = 'deathYear';
        form.appendChild(deathInput);
    }

    // current selections
    let selectedBirth = birthInput.value ? Number(birthInput.value) : undefined;
    let selectedDeath = deathInput.value ? Number(deathInput.value) : undefined;

    // populate years
    (function populateYears() {
        if (birthUl.children.length) return;
        const now = new Date().getFullYear();
        for (let y = now; y >= 1900; y--) {
            const liB = document.createElement('li');
            liB.textContent = y; liB.dataset.value = y;
            birthUl.appendChild(liB);

            const liD = document.createElement('li');
            liD.textContent = y; liD.dataset.value = y;
            deathUl.appendChild(liD);
        }
    })();

    // restore selections in lists
    function restoreSelections() {
        if (selectedBirth) {
            [...birthUl.children].forEach(li => {
                li.classList.toggle('selected', Number(li.dataset.value) === selectedBirth);
            });
            // disable death years < birth
            [...deathUl.children].forEach(li => {
                const y = Number(li.dataset.value);
                li.classList.toggle('disabled', y < selectedBirth);
            });
        }
        if (selectedDeath) {
            [...deathUl.children].forEach(li => {
                li.classList.toggle('selected', Number(li.dataset.value) === selectedDeath);
            });
        }
    }

    function updateDisplay() {
        const hasAny = !!(selectedBirth || selectedDeath);
        if (hasAny) {
            // show just one side if only one is selected; hyphen only if both
            display.textContent = `${selectedBirth ?? ""}${(selectedBirth && selectedDeath) ? " – " : ""}${selectedDeath ?? ""}`;
            display.classList.add('has-value');
        } else {
            display.textContent = 'Роки життя';
            display.classList.remove('has-value');
        }
        picker.classList.toggle('has-value', hasAny);
        clearBtn.hidden = !hasAny;

        // sync hidden inputs for submission
        birthInput.value = selectedBirth ?? '';
        deathInput.value = selectedDeath ?? '';
    }

    // initial
    updateDisplay();
    restoreSelections();

    // events
    display.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
    });
    panel.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', e => {
        if (!picker.contains(e.target)) panel.hidden = true;
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') panel.hidden = true;
    });

    birthUl.addEventListener('click', e => {
        const li = e.target.closest('li'); if (!li) return;
        birthUl.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
        li.classList.add('selected');
        selectedBirth = Number(li.dataset.value);

        // lock invalid death years
        deathUl.querySelectorAll('li').forEach(n => {
            const y = Number(n.dataset.value);
            n.classList.toggle('disabled', y < selectedBirth);
        });
        li.scrollIntoView({ block: 'center' });
    });

    deathUl.addEventListener('click', e => {
        const li = e.target.closest('li'); if (!li || li.classList.contains('disabled')) return;
        deathUl.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
        li.classList.add('selected');
        selectedDeath = Number(li.dataset.value);
        li.scrollIntoView({ block: 'center' });
    });

    doneBtn.addEventListener('click', () => {
        updateDisplay();
        panel.hidden = true;
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedBirth = selectedDeath = undefined;
        birthUl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        deathUl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        deathUl.querySelectorAll('.disabled').forEach(el => el.classList.remove('disabled'));
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

    async function fetchCemeteries(search = '') {
        const params = new URLSearchParams({ search, area: cityInput.value || '' });
        try {
            const res = await fetch(`${API_URL}/api/cemeteries?${params}`);
            const list = await res.json();
            cemSuggest.innerHTML = list.length
                ? list.map(c => `<li>${c}</li>`).join('')
                : `<li class="no-results">Збігів не знайдено</li>`;
            cemSuggest.style.display = 'block';
        } catch (e) { console.error(e); }
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
        cityInput.value = ''; clearCityBtn.style.display = 'none';
        citySuggest.innerHTML = ''; citySuggest.style.display = 'none';
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
        if (e.target.tagName === 'LI' && !e.target.classList.contains('no-results')) {
            cemInput.value = e.target.textContent;
            cemSuggest.style.display = 'none';
            clearCemBtn.style.display = 'flex';
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
        selectedBirth = selectedDeath = undefined;
        birthUl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        deathUl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        deathUl.querySelectorAll('.disabled').forEach(el => el.classList.remove('disabled'));
        updateDisplay();
        panel.hidden = true;
    }
});
