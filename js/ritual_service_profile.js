document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = 'https://memoria-test-app-ifisk.ondigitalocean.app/api/ritual_services';
    const params = new URLSearchParams(window.location.search);
    const ritualId = params.get('id');

    if (!ritualId) {
        document.body.innerHTML = '<p style="text-align:center;margin-top:50px;">Не вказано ID ритуальної служби.</p>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/${ritualId}`);
        if (!response.ok) throw new Error('Не вдалося отримати дані.');

        const data = await response.json();

        // Заповнення даних
        document.querySelector('.ritual-banner').src = data.banner;
        document.querySelector('.ritual-name').textContent = data.name;
        document.querySelector('.ritual-address').textContent = data.address;
        document.querySelector('.ritual-phone').textContent = `тел. ${data.phone}`;
        document.querySelector('.ritual-text').textContent = data.description;

        const linkEl = document.querySelector('.ritual-link-btn');
        linkEl.href = data.link.startsWith('http') ? data.link : 'https://' + data.link;
        linkEl.querySelector('.ritual-link-text').textContent = data.link.replace(/^https?:\/\//, '');

        // Додавання блоків з фотографіями
        const container = document.querySelector('.ritual-container');

        data.items.forEach(([title, images]) => {
            const section = document.createElement('section');
            section.className = 'ritual-item-section';

            const heading = document.createElement('h2');
            heading.className = 'item-title';
            heading.textContent = title;

            const imagesContainer = document.createElement('div');
            imagesContainer.className = 'item-images';

            images.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = title;
                imagesContainer.appendChild(img);
            });

            section.appendChild(heading);
            section.appendChild(imagesContainer);
            container.appendChild(section);
        });
    } catch (err) {
        console.error(err);
        document.body.innerHTML = '<p style="text-align:center;margin-top:50px;">Сталася помилка при завантаженні даних.</p>';
    }

    document.querySelector('.ritual-login-btn').addEventListener('click', () => {
        document.getElementById('loginModal').style.display = 'flex';
    });

    document.getElementById('loginSubmit').addEventListener('click', async () => {
        const login = document.getElementById('loginInput').value.trim();
        const password = document.getElementById('passwordInput').value.trim();
        const errorEl = document.getElementById('loginError');
        errorEl.textContent = '';

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ritual_service_id: ritualId, login, password })
            });

            if (!res.ok) throw new Error('Невірні дані');

            const result = await res.json();

            // redirect to editable version with token
            window.location.href = `/ritual_service_edit.html?id=${ritualId}&token=${result.token}`;
        } catch (err) {
            errorEl.textContent = 'Невірний логін або пароль';
        }
    });
});