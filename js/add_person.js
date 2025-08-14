const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app/';

// Після завантаження сторінки заповнимо селекти року
document.addEventListener('DOMContentLoaded', () => {
    // at the very top of the DOMContentLoaded callback
    const menuBtn = document.getElementById('menu-btn');
    const sideMenu = document.getElementById('side-menu');
    const overlay = document.getElementById('overlay');

    // toggle the drawer on button click
    menuBtn.addEventListener('click', () => {
        sideMenu.classList.toggle('open');
        overlay.classList.toggle('open');
    });

    // close when clicking the backdrop
    overlay.addEventListener('click', () => {
        sideMenu.classList.remove('open');
        overlay.classList.remove('open');
    });

    const birthSelect = document.getElementById('birthYear');
    const deathSelect = document.getElementById('deathYear');
    const currentYear = new Date().getFullYear();

    // Заповнимо роки від поточного назад до 1900
    for (let y = currentYear; y >= 1900; y--) {
        const opt1 = document.createElement('option');
        opt1.value = y;
        opt1.textContent = y;
        birthSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = y;
        opt2.textContent = y;
        deathSelect.appendChild(opt2);
    }

    const cityInput = document.getElementById('city');
    const clearCityBtn = document.getElementById('clear-city');
    const citySuggest = document.getElementById('location-suggestions');

    const cemInput = document.getElementById('cemetery');
    const clearCemBtn = document.getElementById('clear-cem');
    const cemSuggest = document.getElementById('cemetery-suggestions');

    let cityTimer, cemTimer;

    async function fetchCemeteries(search = '') {
        const params = new URLSearchParams({
            search,
            area: cityInput.value || ''
        });
        try {
            const res = await fetch(`${API_URL}/api/cemeteries?${params}`);
            const list = await res.json();
            cemSuggest.innerHTML = list.length
                ? list.map(c => `<li>${c}</li>`).join('')
                : `<li class="no-results">Збігів не знайдено</li>`;
            cemSuggest.style.display = 'block';
        } catch (e) {
            console.error(e);
        }
    }

    // === CITY ===
    // show/hide clear-button
    clearCityBtn.style.display = 'none';

    // debounce fetch
    cityInput.addEventListener('input', () => {
        clearCityBtn.style.display = cityInput.value ? 'flex' : 'none';
        clearTimeout(cityTimer);
        cityTimer = setTimeout(async () => {
            if (cityInput.value.length < 1) {
                citySuggest.innerHTML = '';
                citySuggest.style.display = 'none';
                return;
            }
            try {
                const res = await fetch(`${API_URL}/api/locations?search=${encodeURIComponent(cityInput.value)}`);
                const list = await res.json();
                citySuggest.innerHTML = list.length
                    ? list.map(a => `<li>${a}</li>`).join('')
                    : `<li class="no-results">Збігів не знайдено</li>`;
                citySuggest.style.display = 'block';
            } catch (e) {
                console.error(e);
            }
        }, 300);
    });

    // клік по підказці
    citySuggest.addEventListener('click', e => {
        if (e.target.tagName === 'LI' && !e.target.classList.contains('no-results')) {
            cityInput.value = e.target.textContent;
            citySuggest.style.display = 'none';
            clearCityBtn.style.display = 'flex';
        }
    });

    // blur ховає список
    cityInput.addEventListener('blur', () => {
        setTimeout(() => citySuggest.style.display = 'none', 200);
    });

    // очищення
    clearCityBtn.addEventListener('click', () => {
        cityInput.value = '';
        clearCityBtn.style.display = 'none';
        citySuggest.innerHTML = '';
        citySuggest.style.display = 'none';
    });

    // === CEMETERY ===
    // відкладене завантаження
    clearCemBtn.style.display = 'none';

    cemInput.addEventListener('input', () => {
        clearCemBtn.style.display = cemInput.value ? 'flex' : 'none';
        clearTimeout(cemTimer);
        cemTimer = setTimeout(() => {
            if (cemInput.value.length < 1) {
                cemSuggest.innerHTML = '';
                cemSuggest.style.display = 'none';
            } else {
                fetchCemeteries(cemInput.value);
            }
        }, 300);
    });

    cemInput.addEventListener('focus', () => {
        // only show when a city is chosen
        if (!cityInput.value) return;
        // hide the clear-x until they actually pick one
        clearCemBtn.style.display = 'none';
        // fetch *all* cemeteries for that city (empty search)
        fetchCemeteries('');
    });

    cemSuggest.addEventListener('click', e => {
        if (e.target.tagName === 'LI' && !e.target.classList.contains('no-results')) {
            cemInput.value = e.target.textContent;
            cemSuggest.style.display = 'none';
            clearCemBtn.style.display = 'flex';
        }
    });

    cemInput.addEventListener('blur', () => {
        setTimeout(() => cemSuggest.style.display = 'none', 200);
    });

    clearCemBtn.addEventListener('click', () => {
        cemInput.value = '';
        clearCemBtn.style.display = 'none';
        cemSuggest.innerHTML = '';
        cemSuggest.style.display = 'none';
    });

    const notableCheckbox = document.getElementById('notablePerson');
    const notableFields = document.getElementById('notable-fields');

    // при зміні стану чекбокса показуємо/ховаємо поля
    notableCheckbox.addEventListener('change', () => {
        if (notableCheckbox.checked) {
            notableFields.style.display = 'block';
        } else {
            notableFields.style.display = 'none';
        }
    });

    // Confirm modal + toast
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

        // Build a readable summary
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

        // show modal + overlay
        document.getElementById('modal-overlay').hidden = false;
        confirmModal.hidden = false;
    }

    function closeConfirm() {
        confirmModal.hidden = true;
        document.getElementById('modal-overlay').hidden = true;
    }

    function showToast(msg) {
        toastText.textContent = msg;
        toast.hidden = false;                // show
        // optional: scroll to top so user sees it immediately
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    toastClose.addEventListener('click', (e) => { e.preventDefault(); toast.hidden = true; });

    function clearForm() {
        // Reset the entire form and all suggestion states
        form.reset();
        document.querySelectorAll('.error-message').forEach(el => { el.textContent = ''; el.style.display = 'none'; });

        // hide clear buttons and notable extra fields
        document.getElementById('clear-city').style.display = 'none';
        document.getElementById('clear-cem').style.display = 'none';
        document.getElementById('clear-birth').style.display = 'none';
        document.getElementById('clear-death').style.display = 'none';
        const nf = document.getElementById('notable-fields');
        if (nf) nf.style.display = 'none';
        document.getElementById('location-suggestions').style.display = 'none';
        document.getElementById('cemetery-suggestions').style.display = 'none';
    }

    confirmClose.addEventListener('click', closeConfirm);
    confirmEdit.addEventListener('click', closeConfirm);

    confirmSend.addEventListener('click', async () => {
        if (!pendingPayload) return;
        // send to moderation
        try {
            const res = await fetch(`${API_URL}/api/people/add_moderation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingPayload)
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
    });

    // ——— Submission + Success Modal Logic ———
    const form = document.getElementById('personForm');
    const overlayEl = document.getElementById('modal-overlay');
    const modalEl = document.getElementById('success-modal');
    const closeBtn = document.getElementById('modal-close');
    const okBtn = document.getElementById('modal-ok');

    function showModal() {
        overlayEl.hidden = false;
        modalEl.style.display = 'block';
    }
    function hideModal() {
        overlayEl.hidden = true;
        modalEl.style.display = 'none';
    }

    closeBtn.addEventListener('click', hideModal);
    okBtn.addEventListener('click', hideModal);

    form.addEventListener('submit', async e => {
        e.preventDefault();

        // clear old errors
        document.querySelectorAll('.error-message').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
        let hasError = false;

        // --- validation (same as before) ---
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

        const birthYear = document.getElementById('birthYear');
        const deathYear = document.getElementById('deathYear');
        birthYear.style.border = birthYear.value ? '' : '1px solid red';
        deathYear.style.border = deathYear.value ? '' : '1px solid red';
        if (!birthYear.value || !deathYear.value) hasError = true;

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

        // ✅ Instead of immediate POST, open confirmation
        openConfirm({
            name,
            birthYear: birthYear.value,
            deathYear: deathYear.value,
            area: city.value.trim(),
            cemetery: cemetery.value.trim(),
            occupation,
            link,
            bio
        });
    });

    // Функція для відображення помилки під полем
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

    const birthSelector = document.getElementById('birthYear');
    const deathSelector = document.getElementById('deathYear');
    const clearBirth = document.getElementById('clear-birth');
    const clearDeath = document.getElementById('clear-death');

    // init visibility
    clearBirth.style.display = birthSelector.value ? 'flex' : 'none';
    clearDeath.style.display = deathSelector.value ? 'flex' : 'none';

    // on change, toggle button
    birthSelector.addEventListener('change', () => {
        clearBirth.style.display = birthSelector.value ? 'flex' : 'none';
    });
    deathSelector.addEventListener('change', () => {
        clearDeath.style.display = deathSelector.value ? 'flex' : 'none';
    });

    // on click, clear
    clearBirth.addEventListener('click', () => {
        birthSelector.value = '';
        clearBirth.style.display = 'none';
    });
    clearDeath.addEventListener('click', () => {
        deathSelector.value = '';
        clearDeath.style.display = 'none';
    });

    const clearActivity = document.getElementById('clear-activity');
    const activitySelect = document.getElementById('activityArea');

    // init visibility
    clearActivity.style.display = activitySelect.value ? 'flex' : 'none';

    // on change, toggle button
    activitySelect.addEventListener('change', () => {
        clearActivity.style.display = activitySelect.value ? 'flex' : 'none';
    });

    // on click, clear
    clearActivity.addEventListener('click', () => {
        activitySelect.value = '';
        clearActivity.style.display = 'none';
    });
});
