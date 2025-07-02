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

        // gather values
        const fullNameInput = document.getElementById('fullName');
        const name = fullNameInput.value.trim();
        const fullNameError = document.getElementById('fullNameError');
        const birthYear = document.getElementById('birthYear').value;
        const deathYear = document.getElementById('deathYear').value;
        const area = document.getElementById('city').value.trim();
        const cemetery = document.getElementById('cemetery').value.trim();

        let occupation = '';
        let link = '';
        let bio = '';

        // clear any previous error
        fullNameError.textContent = '';
        fullNameError.style.display = 'none';

        // 1) no dots allowed
        if (name.includes('.')) {
            fullNameError.textContent = "Введіть повне ім'я";
            fullNameError.style.display = 'block';
            fullNameInput.focus();
            return;
        }

        // split name once
        const parts = name.split(/\s+/).filter(Boolean);

        // 2) must contain at least three words
        if (parts.length < 3) {
            fullNameError.textContent = "Введіть повне ім'я";
            fullNameError.style.display = 'block';
            fullNameInput.focus();
            return;
        }

        // 3) each word must be longer than 1 character
        if (parts.some(part => part.length <= 1)) {
            fullNameError.textContent = "Введіть повне ім'я";
            fullNameError.style.display = 'block';
            fullNameInput.focus();
            return;
        }

        if (document.getElementById('notablePerson').checked) {
            occupation = document.getElementById('activityArea').value;
            link = document.getElementById('internetLinks').value.trim();
            bio = document.getElementById('achievements').value.trim();
        }

        try {
            const res = await fetch(`${API_URL}/api/people/add_moderation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    birthYear,
                    deathYear,
                    area,
                    cemetery,
                    occupation,
                    link,
                    bio
                })
            });
            const json = await res.json();
            if (json.success) {
                showModal();
                const closeBtn = document.getElementById('modal-close');
                const okBtn = document.getElementById('modal-ok');

                closeBtn.addEventListener('click', hideModal);

                // ← replace your existing line with this:
                okBtn.addEventListener('click', () => {
                    hideModal();
                    window.location.reload();
                });
            }
            else {
                alert('Щось пішло не так. Спробуйте ще раз.');
            }
        } catch (err) {
            console.error(err);
            alert('Помилка мережі. Перевірте підключення.');
        }
    });

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
