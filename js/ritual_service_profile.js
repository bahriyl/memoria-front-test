document.addEventListener("DOMContentLoaded", async () => {
  const API_BASE = "https://memoria-test-app-ifisk.ondigitalocean.app/api/ritual_services";
  // const API_BASE = "http://0.0.0.0:5000/api/ritual_services"
  const params = new URLSearchParams(window.location.search);
  const ritualId = params.get("id");

  function parseJwt(token) {
    try {
      const b64 = token.split(".")[1] || "";
      const b64url = b64.replace(/-/g, "+").replace(/_/g, "/");
      const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
      return JSON.parse(atob(b64url + pad));
    } catch {
      return {};
    }
  }

  function doLogout() {
    localStorage.removeItem("token");
    // повертаємо на публічну сторінку профілю/логіна
    window.location.href = `/ritual_service_profile.html?id=${new URLSearchParams(location.search).get("id") || ""}`;
  }

  let __logoutTimer;
  function scheduleLogout(expSeconds) {
    clearTimeout(__logoutTimer);
    const ms = expSeconds * 1000 - Date.now();
    if (ms <= 0) return doLogout();
    __logoutTimer = setTimeout(doLogout, ms);
  }

  function checkTokenAndSchedule() {
    const t = localStorage.getItem("token");
    if (!t) return;
    const { exp } = parseJwt(t);
    if (!exp) return;                  // якщо бекенд не додає exp
    if (exp * 1000 <= Date.now()) return doLogout();
    scheduleLogout(exp);
  }

  checkTokenAndSchedule();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkTokenAndSchedule(); // перевірка при поверненні у вкладку
  });

  // If exp is missing (parse failed), confirm with server; 401 → logout
  (async () => {
    const t = localStorage.getItem("token");
    if (!t) return;
    const { exp } = parseJwt(t) || {};
    if (typeof exp === "number") return;
    try {
      const res = await fetch(`${API_BASE}/verify_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t })
      });
      if (!res.ok) doLogout();
    } catch {
      doLogout();
    }
  })();

  if (!ritualId) {
    document.body.innerHTML =
      '<p style="text-align:center;margin-top:50px;">Не вказано ID ритуальної служби.</p>';
    return;
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

  function renderJointContacts(addressEl, phoneEl, rawAddresses, rawPhones) {
    const toList = v => Array.isArray(v)
      ? v.map(String).map(s => s.trim()).filter(Boolean)
      : (v ? [String(v).trim()] : []);
    const joiner = "\n"; // кожен елемент з нового рядка

    const addresses = toList(rawAddresses);
    const phones = toList(rawPhones);

    // Гарантуємо окремі span-и для тексту (щоб не зносити кнопку при .textContent)
    let addressText = addressEl.querySelector(".contacts-address-text");
    if (!addressText) {
      addressEl.textContent = "";
      addressText = document.createElement("span");
      addressText.className = "contacts-address-text";
      addressEl.appendChild(addressText);
    }

    let phoneText = phoneEl.querySelector(".contacts-phone-text");
    if (!phoneText) {
      phoneEl.textContent = "";
      phoneText = document.createElement("span");
      phoneText.className = "contacts-phone-text";
      phoneEl.appendChild(phoneText);
    }

    // Єдина кнопка всередині .ritual-phone — в одному рядку з текстом
    let btn = phoneEl.querySelector(".joint-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bio-toggle joint-toggle";
      btn.textContent = "... більше";
      phoneEl.appendChild(document.createTextNode(" "));
      phoneEl.appendChild(btn);
    }

    const hasMore = (addresses.length > 1) || (phones.length > 1);

    let expanded = false;
    const collapse = () => {
      expanded = false;
      addressText.textContent = addresses[0] || "";
      phoneText.textContent = phones[0] || "";
      if (hasMore) {
        btn.textContent = "... більше";
        btn.setAttribute("aria-expanded", "false");
      }
    };

    const expand = () => {
      expanded = true;
      addressText.textContent = addresses.join(joiner);
      phoneText.textContent = phones.join(joiner);
      btn.textContent = "... менше";
      btn.setAttribute("aria-expanded", "true");
    };

    if (hasMore) {
      btn.onclick = () => (expanded ? collapse() : expand());
      btn.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
      };
      collapse(); // старт: згорнуто
    } else {
      // якщо немає що показувати — прибираємо кнопку і лишаємо по одному значенню
      btn.remove();
      addressText.textContent = addresses[0] || "";
      phoneText.textContent = phones[0] || "";
    }
  }

  try {
    // 1) Отримуємо дані
    const response = await fetch(`${API_BASE}/${ritualId}`);
    if (!response.ok) throw new Error("Не вдалося отримати дані.");
    const data = await response.json();

    // 2) Заповнюємо шапку
    document.querySelector(".ritual-banner").src = data.banner;
    document.querySelector(".ritual-name").textContent = data.name;
    const addressEl = document.querySelector(".ritual-address");
    const phoneEl = document.querySelector(".ritual-phone");

    renderJointContacts(addressEl, phoneEl, data.address, data.phone);

    // 3) Опис із "більше/менше" — як на profile (bio-body)
    const fullText = (data.description || "").trim();
    const aboutEl = document.getElementById("ritual-text");

    function applyAbout(text) {
      const LINES = 4;
      const moreLabel = "більше";
      const lessLabel = "менше";

      aboutEl.innerHTML = "";

      if (!text) {
        const empty = document.createElement("div");
        empty.className = "description-empty";
        empty.textContent = "Немає опису";
        aboutEl.replaceWith(empty);
        return;
      }

      const textSpan = document.createElement("span");
      const createToggle = (label = "більше") => {
        const t = document.createElement("span");
        t.className = "bio-toggle";
        t.setAttribute("role", "button");
        t.tabIndex = 0;
        t.textContent = label;
        return t;
      };

      // базові метрики
      const cs = getComputedStyle(aboutEl);
      const line =
        parseFloat(cs.lineHeight) || 1.5 * parseFloat(cs.fontSize) || 21;
      const maxH = Math.round(LINES * line);

      // --- вимір повного тексту БЕЗ клампу ---
      aboutEl.classList.add("__measure");
      aboutEl.innerHTML = "";
      textSpan.textContent = text;
      aboutEl.appendChild(textSpan);
      const fullH = aboutEl.clientHeight;
      aboutEl.innerHTML = "";
      aboutEl.classList.remove("__measure");

      if (fullH <= maxH + 1) {
        // все влізло → без toggle
        aboutEl.appendChild(textSpan);
        return;
      }

      // хелпер вимірювання префікса: теж БЕЗ клампу
      function heightForPrefix(prefixLen) {
        aboutEl.classList.add("__measure");
        aboutEl.innerHTML = "";
        const s = document.createElement("span");
        s.textContent = text.slice(0, prefixLen).trimEnd() + " … ";
        s.appendChild(createToggle()); // toggle inside the same span
        aboutEl.appendChild(s);
        const h = aboutEl.clientHeight;
        aboutEl.innerHTML = "";
        aboutEl.classList.remove("__measure");
        return h;
      }

      // бінарний пошук максимальної довжини, що влазить у 4 рядки
      let lo = 0,
        hi = text.length,
        best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (heightForPrefix(mid) <= maxH + 1) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      // фінальний рендер (уже З клампом, без __measure)
      const toggle = createToggle(moreLabel);
      textSpan.textContent = text.slice(0, best).trimEnd() + " … ";
      toggle.textContent = moreLabel;
      textSpan.appendChild(toggle);
      aboutEl.innerHTML = "";
      aboutEl.appendChild(textSpan);

      let expanded = false;
      const expand = () => {
        expanded = true;
        aboutEl.classList.add("expanded");
        aboutEl.innerHTML = "";
        textSpan.textContent = text + " ";
        toggle.textContent = "менше";
        textSpan.appendChild(toggle);
        aboutEl.appendChild(textSpan);
      };

      const collapse = () => {
        expanded = false;
        aboutEl.classList.remove("expanded"); // <<< важливо
        applyAbout(text);
      };
      const onToggle = () => (expanded ? collapse() : expand());
      toggle.addEventListener("click", onToggle);
      toggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      });
    }

    applyAbout(fullText);

    // 4) Посилання
    const linkEl = document.querySelector(".ritual-link-btn");
    linkEl.href = data.link.startsWith("http")
      ? data.link
      : `https://${data.link}`;
    linkEl.querySelector(".ritual-link-text").textContent = data.link.replace(
      /^https?:\/\//,
      ""
    );

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
      const albums = (
        Array.isArray(rawImagesOrAlbums) ? rawImagesOrAlbums : []
      ).map((x) => {
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
          const captions = album.photos.map(() => album.description || "");
          openSlideshow(album.photos, 0, captions);
        });

        wrapper.appendChild(img);
        if (album.photos.length > 1) wrapper.appendChild(counter);
        imagesContainer.appendChild(wrapper);
      });

      const totalAlbums = albums.length;

      if (totalAlbums <= 5) {
        imagesContainer.classList.add("one-row");
        imagesContainer.classList.remove("two-rows");
      } else {
        imagesContainer.classList.add("two-rows");
        imagesContainer.classList.remove("one-row");
      }

      section.appendChild(heading);

      if (albums.length === 0) {
        const empty = document.createElement("div");
        empty.className = "photos-empty";
        empty.textContent = "Немає фотографій";
        section.appendChild(empty);
      } else {
        section.appendChild(imagesContainer);
      }

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
      localStorage.setItem("token", result.token);

      const payload = parseJwt(result.token);
      if (payload?.exp) scheduleLogout(payload.exp);
      // 2) Redirect (URL param optional now)
      window.location.href = `/ritual_service_edit.html?id=${ritualId}`;
    } catch {
      errorEl.textContent = "Невірний логін або пароль";
    }
  });

  /** Open slideshow with swipe (same behavior as profile page) */
  function openSlideshow(images, startIndex = 0, captions = []) {
    const modal = document.createElement("div");
    modal.className = "slideshow-modal";

    const closeBtnX = document.createElement("span");
    closeBtnX.textContent = "✕";
    closeBtnX.className = "close-slideshow";
    closeBtnX.onclick = () => {
      document.body.style.overflow = ""; // restore scroll
      document.body.removeChild(modal);
    };

    const track = document.createElement("div");
    track.className = "slideshow-track";

    images.forEach((url, i) => {
      const slide = document.createElement("div");
      slide.className = "slideshow-slide";

      const img = document.createElement("img");
      img.src = url;
      img.className = "slideshow-img";
      slide.appendChild(img);

      // Optional caption
      const text = Array.isArray(captions) ? captions[i] || "" : captions || "";
      if (text && text.trim()) {
        const cap = document.createElement("div");
        cap.className = "slideshow-caption";

        const span = document.createElement("span");
        span.className = "caption-text";
        span.textContent = text;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "caption-toggle";
        toggle.textContent = "… більше";

        cap.append(span, toggle);
        slide.appendChild(cap);

        // Show "… більше" only if text overflows
        requestAnimationFrame(() => {
          const overflowing = span.scrollHeight > span.clientHeight + 1;
          if (overflowing) {
            cap.classList.add("has-toggle");
            toggle.addEventListener("click", () => {
              const expanded = cap.classList.toggle("expanded");
              toggle.textContent = expanded ? "менше" : "… більше";
            });
          } else {
            toggle.remove();
          }
        });
      }

      track.appendChild(slide);
    });

    // Dots
    const indicator = document.createElement("div");
    indicator.className = "slideshow-indicators";

    if (images.length > 1) {
      images.forEach((_, idx) => {
        const dot = document.createElement("span");
        dot.className = "slideshow-indicator";
        dot.addEventListener("click", () => changeSlide(idx));
        indicator.appendChild(dot);
      });
    }

    function updateIndicators(index) {
      if (images.length > 1) {
        indicator
          .querySelectorAll(".slideshow-indicator")
          .forEach((dot, i) => dot.classList.toggle("active", i === index));
      }
    }

    function changeSlide(newIndex) {
      const slides = track.querySelectorAll(".slideshow-slide");
      if (slides[newIndex]) {
        slides[newIndex].scrollIntoView({
          behavior: "smooth",
          inline: "center",
        });
      }
    }
    track.addEventListener("scroll", () => {
      const slideWidth = track.clientWidth;
      const index = Math.round(track.scrollLeft / slideWidth);
      updateIndicators(index);
    });

    modal.append(closeBtnX, track, indicator);
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden"; // prevent background scroll

    requestAnimationFrame(() => {
      const prev = track.style.scrollBehavior;
      track.style.scrollBehavior = 'auto';
      track.scrollLeft = startIndex * track.clientWidth;
      track.style.scrollBehavior = prev;
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
