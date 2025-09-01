document.addEventListener("DOMContentLoaded", async () => {
    const API_BASE = "https://memoria-test-app-ifisk.ondigitalocean.app/api/ritual_services";
    // const API_BASE = "http://0.0.0.0:5000/api/ritual_services"
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
        data.items.forEach(([title, rawImagesOrAlbums]) => {
            const section = document.createElement("section");
            section.className = "ritual-item-section";

            const heading = document.createElement("h2");
            heading.className = "item-title";
            heading.textContent = title;

            const imagesContainer = document.createElement("div");
            imagesContainer.className = "item-images";

            // --- Normalize to albums ---
            const albums = (Array.isArray(rawImagesOrAlbums) ? rawImagesOrAlbums : []).map((x) => {
                if (typeof x === "string") return { photos: [x], description: "" };
                if (Array.isArray(x)) return { photos: x, description: "" }; // safety
                // assume new shape
                return {
                    photos: Array.isArray(x?.photos) ? x.photos : [],
                    description: (x?.description || "").toString(),
                };
            });

            albums.forEach((album) => {
                if (!album.photos?.length) return;
                const coverUrl = album.photos[0];

                const wrapper = document.createElement("div");
                wrapper.className = "image-wrapper";

                const img = document.createElement("img");
                img.src = coverUrl;
                img.alt = title;
                img.classList.add("preview-img");

                // little counter badge
                const counter = document.createElement("div");
                counter.className = "image-counter";
                counter.textContent = `${album.photos.length}`;

                img.addEventListener("click", () => {
                    // repeat the album description for every image (or build per-image captions array if you have it)
                    const captions = album.photos.map(() => album.description || '');
                    openSlideshow(album.photos, 0, captions);
                });

                wrapper.appendChild(img);
                if (album.photos.length > 1) wrapper.appendChild(counter);
                imagesContainer.appendChild(wrapper);
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

    // ----- Login modal close logic -----
    const loginModal = document.getElementById("loginModal");
    const loginBox = loginModal.querySelector(".login-box");
    const loginClose = document.getElementById("loginClose");

    function closeLoginModal() {
        loginModal.style.display = "none";
        // optional: clear fields & error on close
        document.getElementById("loginInput").value = "";
        document.getElementById("passwordInput").value = "";
        document.getElementById("loginError").textContent = "";
    }

    loginClose.addEventListener("click", closeLoginModal);

    // Click outside the box -> close
    loginModal.addEventListener("click", (e) => {
        if (!loginBox.contains(e.target)) closeLoginModal();
    });

    // Prevent clicks inside the box from closing
    loginBox.addEventListener("click", (e) => e.stopPropagation());

    // Close on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && loginModal.style.display === "flex") {
            closeLoginModal();
        }
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
            // 1) Persist token
            localStorage.setItem('token', result.token);
            // 2) Redirect (URL param optional now)
            window.location.href = `/ritual_service_edit.html?id=${ritualId}`;
        } catch {
            errorEl.textContent = "Невірний логін або пароль";
        }
    });



    /** Open slideshow with swipe (same behavior as profile page) */
    function openSlideshow(images, startIndex = 0, captions = []) {
        const modal = document.createElement('div');
        modal.className = 'slideshow-modal';

        const closeBtnX = document.createElement('span');
        closeBtnX.textContent = '✕';
        closeBtnX.className = 'close-slideshow';
        closeBtnX.onclick = () => {
            document.body.style.overflow = ''; // restore scroll
            document.body.removeChild(modal);
        };

        const track = document.createElement('div');
        track.className = 'slideshow-track';

        images.forEach((url, i) => {
            const slide = document.createElement('div');
            slide.className = 'slideshow-slide';

            const img = document.createElement('img');
            img.src = url;
            img.className = 'slideshow-img';
            slide.appendChild(img);

            // Optional caption
            const text = Array.isArray(captions) ? (captions[i] || '') : (captions || '');
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

                // Show "… більше" only if text overflows
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
        });

        // Dots
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
        document.body.style.overflow = 'hidden'; // prevent background scroll

        requestAnimationFrame(() => {
            changeSlide(startIndex);
            updateIndicators(startIndex);
        });
    }

    const backBtn = document.querySelector(".ritual-back-btn");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            window.location.href = "/ritual_services.html";
        });
    }

});
