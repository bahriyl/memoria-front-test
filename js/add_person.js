const API_URL = 'http://192.168.42.192:5000';

// Після завантаження сторінки заповнимо селекти року
document.addEventListener('DOMContentLoaded', () => {
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
        cemTimer = setTimeout(async () => {
            if (cemInput.value.length < 1) {
                cemSuggest.innerHTML = '';
                cemSuggest.style.display = 'none';
                return;
            }
            try {
                const params = new URLSearchParams({
                    search: cemInput.value,
                    area: cityInput.value || ''
                });
                const res = await fetch(`${API_URL}/api/cemeteries?${params}`);
                const list = await res.json();
                cemSuggest.innerHTML = list.length
                    ? list.map(c => `<li>${c}</li>`).join('')
                    : `<li class="no-results">Збігів не знайдено</li>`;
                cemSuggest.style.display = 'block';
            } catch (e) {
                console.error(e);
            }
        }, 300);
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
        const name = document.getElementById('fullName').value.trim();
        const birthYear = document.getElementById('birthYear').value;
        const deathYear = document.getElementById('deathYear').value;
        const area = document.getElementById('city').value.trim();
        const cemetery = document.getElementById('cemetery').value.trim();

        let occupation = '';
        let link = '';
        let bio = '';

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
                form.reset();
                // hide notable-fields if needed
                document.getElementById('notable-fields').style.display = 'none';
            } else {
                alert('Щось пішло не так. Спробуйте ще раз.');
            }
        } catch (err) {
            console.error(err);
            alert('Помилка мережі. Перевірте підключення.');
        }
    });
});
