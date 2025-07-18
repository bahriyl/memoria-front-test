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
        const toggleBtn = textWrapper?.querySelector(".toggle-text-btn");
        const dots = textWrapper?.querySelector(".dots");
        if (!textWrapper || !toggleBtn || !dots) return;

        toggleBtn.addEventListener("click", () => {
            const isExpanded = textWrapper.classList.toggle("expanded");
            textWrapper.classList.toggle("collapsed", !isExpanded);
            toggleBtn.textContent = isExpanded ? "менше" : "більше";
        });
    }

    try {
        // 1) Отримуємо дані
        const response = await fetch(`${API_BASE}/${ritualId}`);
        if (!response.ok) throw new Error("Не вдалося отримати дані.");
        const data = await response.json();

        // 2) Заповнюємо шапку
        document.querySelector(".ritual-banner").src = data.banner;
        document.querySelector(".ritual-name").textContent = data.name;
        document.querySelector(".ritual-address").textContent = data.address;
        document.querySelector(".ritual-phone").textContent = `тел. ${data.phone}`;

        // 3) Опис із "більше/менше"
        const fullText = data.description || "";
        const textContent = document.querySelector(".text-content");
        textContent.textContent = fullText;

        // — обрізаємо до 4 рядків
        const temp = document.createElement("span");
        Object.assign(temp.style, {
            visibility: "hidden",
            position: "absolute",
            width: getComputedStyle(textContent).width,
            font: getComputedStyle(textContent).font,
            lineHeight: getComputedStyle(textContent).lineHeight,
        });
        temp.textContent = fullText;
        document.body.appendChild(temp);

        const lineHeight = parseFloat(getComputedStyle(temp).lineHeight);
        const maxHeight = 4 * lineHeight;
        let approxCharCount = fullText.length;
        while (temp.offsetHeight > maxHeight && approxCharCount > 0) {
            approxCharCount -= 5;
            temp.textContent = fullText.slice(0, approxCharCount);
        }
        document.body.removeChild(temp);

        const cropped = fullText.slice(0, approxCharCount - 20).trim();
        textContent.textContent = cropped;
        setupTextToggle();

        // 4) Посилання
        const linkEl = document.querySelector(".ritual-link-btn");
        linkEl.href = data.link.startsWith("http")
            ? data.link
            : `https://${data.link}`;
        linkEl.querySelector(".ritual-link-text").textContent =
            data.link.replace(/^https?:\/\//, "");

        // 5) Блоки з фотографіями
        const container = document.querySelector(".ritual-container");
        data.items.forEach(([title, images]) => {
            const section = document.createElement("section");
            section.className = "ritual-item-section";

            const heading = document.createElement("h2");
            heading.className = "item-title";
            heading.textContent = title;

            const imagesContainer = document.createElement("div");
            imagesContainer.className = "item-images";

            images.forEach((url, _, allUrls) => {
                const img = document.createElement("img");
                img.src = url;
                img.alt = title;
                img.classList.add("preview-img");
                img.addEventListener("click", () => openSlideshow(allUrls));
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

    // Відкриваємо модалку логіну
    document.querySelector(".ritual-login-btn").addEventListener("click", () => {
        document.getElementById("loginModal").style.display = "flex";
    });

    // Обробник кнопки "Увійти" — тільки логіка авторизації
    document.getElementById("loginSubmit").addEventListener("click", async () => {
        const login = document.getElementById("loginInput").value.trim();
        const password = document.getElementById("passwordInput").value.trim();
        const errorEl = document.getElementById("loginError");
        errorEl.textContent = "";

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ritual_service_id: ritualId,
                    login,
                    password,
                }),
            });
            if (!res.ok) throw new Error("Невірні дані");
            const result = await res.json();
            // Перенаправляємо на сторінку редагування з токеном
            window.location.href = `/ritual_service_edit.html?id=${ritualId}&token=${result.token}`;
        } catch {
            errorEl.textContent = "Невірний логін або пароль";
        }
    });

    // Функція відкриття слайдшоу
    function openSlideshow(images) {
        const modal = document.createElement("div");
        modal.className = "slideshow-modal";

        let currentIndex = 0;
        const img = document.createElement("img");
        img.src = images[currentIndex];
        img.className = "slideshow-img";

        const closeBtn = document.createElement("span");
        closeBtn.textContent = "✕";
        closeBtn.className = "close-slideshow";
        closeBtn.onclick = () => document.body.removeChild(modal);

        const indicator = document.createElement("div");
        indicator.className = "slideshow-indicators";
        images.forEach((_, idx) => {
            const dot = document.createElement("span");
            dot.className = "slideshow-indicator";
            dot.addEventListener("click", () => {
                currentIndex = idx;
                img.src = images[currentIndex];
                updateIndicators();
            });
            indicator.appendChild(dot);
        });

        function updateIndicators() {
            indicator
                .querySelectorAll(".slideshow-indicator")
                .forEach((dot, i) => {
                    dot.classList.toggle("active", i === currentIndex);
                });
        }

        // SWIPE logic
        let touchStartX = 0;
        img.addEventListener("touchstart", (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        img.addEventListener("touchend", (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const dist = touchEndX - touchStartX;
            if (Math.abs(dist) > 50) {
                currentIndex =
                    dist > 0
                        ? (currentIndex - 1 + images.length) % images.length
                        : (currentIndex + 1) % images.length;
                img.src = images[currentIndex];
                updateIndicators();
            }
        });

        modal.appendChild(closeBtn);
        modal.appendChild(img);
        modal.appendChild(indicator);
        document.body.appendChild(modal);
        updateIndicators();
    }
});
