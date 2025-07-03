document.addEventListener("DOMContentLoaded", async () => {
    const API_BASE =
        "https://memoria-test-app-ifisk.ondigitalocean.app/api/ritual_services";
    const params = new URLSearchParams(window.location.search);
    const ritualId = params.get("id");

    if (!ritualId) {
        document.body.innerHTML =
            '<p style="text-align:center;margin-top:50px;">Не вказано ID ритуальної служби.</p>';
        return;
    }

    function setupTextToggle() {
        const textWrapper = document.querySelector(".ritual-text");
        const toggleBtn = textWrapper.querySelector(".toggle-text-btn");
        const dots = textWrapper.querySelector(".dots");

        if (!textWrapper || !toggleBtn || !dots) return;

        toggleBtn.addEventListener("click", () => {
            const isExpanded = textWrapper.classList.toggle("expanded");
            textWrapper.classList.toggle("collapsed", !isExpanded);
            toggleBtn.textContent = isExpanded ? "менше" : "більше";
        });
    }

    try {
        const response = await fetch(`${API_BASE}/${ritualId}`);
        if (!response.ok) throw new Error("Не вдалося отримати дані.");

        const data = await response.json();

        // Заповнення даних
        document.querySelector(".ritual-banner").src = data.banner;
        document.querySelector(".ritual-name").textContent = data.name;
        document.querySelector(".ritual-address").textContent = data.address;
        document.querySelector(".ritual-phone").textContent = `тел. ${data.phone}`;

        const fullText = data.description || "";
        const textContent = document.querySelector(".text-content");
        const toggleBtn = document.querySelector(".toggle-text-btn");
        const dots = document.querySelector(".dots");

        textContent.textContent = fullText;

        // Тимчасово додаємо текст, щоб виміряти довжину рядків
        const temp = document.createElement("span");
        temp.style.visibility = "hidden";
        temp.style.position = "absolute";
        temp.style.width = getComputedStyle(textContent).width;
        temp.style.font = getComputedStyle(textContent).font;
        temp.style.lineHeight = getComputedStyle(textContent).lineHeight;
        temp.textContent = fullText;
        document.body.appendChild(temp);

        // Підраховуємо кількість символів у 4 рядках (приблизно)
        const lineHeight = parseFloat(getComputedStyle(temp).lineHeight);
        const maxHeight = 4 * lineHeight;
        let approxCharCount = fullText.length;
        while (temp.offsetHeight > maxHeight && approxCharCount > 0) {
            approxCharCount -= 5;
            temp.textContent = fullText.slice(0, approxCharCount);
        }
        document.body.removeChild(temp);

        // Залишаємо трохи місця для "... більше"
        const cropped = fullText.slice(0, approxCharCount - 20).trim();
        textContent.textContent = cropped;

        setupTextToggle();

        const linkEl = document.querySelector(".ritual-link-btn");
        linkEl.href = data.link.startsWith("http")
            ? data.link
            : "https://" + data.link;
        linkEl.querySelector(".ritual-link-text").textContent = data.link.replace(
            /^https?:\/\//,
            ""
        );

        // Додавання блоків з фотографіями
        const container = document.querySelector(".ritual-container");

        data.items.forEach(([title, images]) => {
            const section = document.createElement("section");
            section.className = "ritual-item-section";

            const heading = document.createElement("h2");
            heading.className = "item-title";
            heading.textContent = title;

            const imagesContainer = document.createElement("div");
            imagesContainer.className = "item-images";

            images.forEach((url) => {
                const img = document.createElement("img");
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
        document.body.innerHTML =
            '<p style="text-align:center;margin-top:50px;">Сталася помилка при завантаженні даних.</p>';
    }

    document.querySelector(".ritual-login-btn").addEventListener("click", () => {
        document.getElementById("loginModal").style.display = "flex";
    });

    document.getElementById("loginSubmit").addEventListener("click", async () => {
        const login = document.getElementById("loginInput").value.trim();
        const password = document.getElementById("passwordInput").value.trim();
        const errorEl = document.getElementById("loginError");
        errorEl.textContent = "";

        try {
            const res = await fetch(`${API_BASE}/${ritualId}`);
            if (!res.ok) throw new Error('Не вдалося отримати дані.');
            const data = await res.json();

            document.querySelector('.ritual-banner').src = data.banner;
            document.querySelector('.ritual-name').textContent = data.name;
            document.querySelector('.ritual-address').textContent = data.address;
            document.querySelector('.ritual-phone').textContent = `тел. ${data.phone}`;
            document.querySelector('.ritual-text').textContent = data.description;

            const linkEl = document.querySelector('.ritual-link-btn');
            linkEl.href = data.link.startsWith('http') ? data.link : 'https://' + data.link;
            linkEl.querySelector('.ritual-link-text').textContent = data.link.replace(/^https?:\/\//, '');

            const container = document.querySelector('.ritual-container');

            data.items.forEach(([title, images]) => {
                const section = document.createElement('section');
                section.className = 'ritual-item-section';

                const heading = document.createElement('h2');
                heading.className = 'item-title';
                heading.textContent = title;

                const imagesContainer = document.createElement('div');
                imagesContainer.className = 'item-images';

                images.forEach(([mainUrl, additional]) => {
                    // 1) Обгортка
                    const wrapper = document.createElement('div');
                    wrapper.className = 'image-wrapper';

                    // 2) Саме прев’ю
                    const img = document.createElement('img');
                    img.src = mainUrl;
                    img.alt = title;
                    img.classList.add('preview-img');
                    img.addEventListener('click', () => {
                        openSlideshow([mainUrl, ...additional]);
                    });

                    // 3) Лічильник
                    const counter = document.createElement('span');
                    counter.className = 'image-counter';
                    // +1 тому що count = основна + додаткові
                    counter.textContent = additional.length + 1;

                    // 4) Збираємо докупи
                    wrapper.appendChild(img);
                    wrapper.appendChild(counter);
                    imagesContainer.appendChild(wrapper);
                });

                section.appendChild(heading);
                section.appendChild(imagesContainer);
                container.appendChild(section);
            });
        } catch (err) {
            errorEl.textContent = "Невірний логін або пароль";
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
                window.location.href = `/ritual_service_edit.html?id=${ritualId}&token=${result.token}`;
            } catch {
                errorEl.textContent = 'Невірний логін або пароль';
            }
        });
    });

    function openSlideshow(images) {
        const modal = document.createElement('div');
        modal.className = 'slideshow-modal';

        let currentIndex = 0;

        // — Тег для самої картинки
        const img = document.createElement('img');
        img.src = images[currentIndex];
        img.className = 'slideshow-img';

        // — Кнопка закриття
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '✕';
        closeBtn.className = 'close-slideshow';
        closeBtn.onclick = () => document.body.removeChild(modal);

        // — Контейнер для індикаторів
        const indicator = document.createElement('div');
        indicator.className = 'slideshow-indicators';

        // — Створюємо крапки
        images.forEach((_, idx) => {
            const dot = document.createElement('span');
            dot.className = 'slideshow-indicator';
            dot.addEventListener('click', () => {
                currentIndex = idx;
                img.src = images[currentIndex];
                updateIndicators();
            });
            indicator.appendChild(dot);
        });

        // — Функція, що підсвічує активну крапку
        function updateIndicators() {
            const dots = indicator.querySelectorAll('.slideshow-indicator');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        // — SWIPE logic
        let touchStartX = 0;
        let touchEndX = 0;

        img.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        img.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });

        function handleSwipe() {
            const swipeDistance = touchEndX - touchStartX;
            if (Math.abs(swipeDistance) > 50) {
                if (swipeDistance > 0) {
                    // Swipe right
                    currentIndex = (currentIndex - 1 + images.length) % images.length;
                } else {
                    // Swipe left
                    currentIndex = (currentIndex + 1) % images.length;
                }
                img.src = images[currentIndex];
                updateIndicators();
            }
        }

        // — Збираємо модалку
        modal.appendChild(closeBtn);
        modal.appendChild(img);
        modal.appendChild(indicator);
        document.body.appendChild(modal);

        // — Вмикаємо підсвічування одразу після вставки
        updateIndicators();
    }
});