document.addEventListener("DOMContentLoaded", async () => {
  const API_BASE =
    "https://memoria-test-app-ifisk.ondigitalocean.app/api/ritual_services";
  // const API_BASE = "http://0.0.0.0:5000/api/ritual_services"
  const params = new URLSearchParams(window.location.search);
  const ritualId = params.get("id");

  if (!ritualId) {
    document.body.innerHTML =
      '<p style="text-align:center;margin-top:50px;">Не вказано ID ритуальної служби.</p>';
    return;
  }

  function renderListWithToggle(el, rawItems, opts = {}) {
    const { prefix = "", joiner = "; " } = opts;

    // Normalize to array of strings
    const items = Array.isArray(rawItems)
      ? rawItems.map(String).map(s => s.trim()).filter(Boolean)
      : (rawItems ? [String(rawItems).trim()] : []);

    // Reset container
    el.innerHTML = "";
    if (!items.length) return;

    // Single inline span holds everything to keep in one line
    const contentSpan = document.createElement("span");
    contentSpan.className = "text-content";
    el.appendChild(contentSpan);

    // Prefix (e.g., "тел. ") stays inline too
    if (prefix) {
      const prefixNode = document.createElement("span");
      prefixNode.textContent = prefix;
      contentSpan.appendChild(prefixNode);
    }

    // If ≤2 items — just render joined in one line
    if (items.length <= 2) {
      const textNode = document.createElement("span");
      textNode.textContent = items.join(joiner);
      contentSpan.appendChild(textNode);
      return;
    }

    // >2 items — add inline toggle inside the same span
    let expanded = false;

    // Create the text holder so we can re-render easily
    const listText = document.createElement("span");
    contentSpan.appendChild(listText);

    // Inline toggle button
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "bio-toggle";
    toggle.textContent = "Більше";
    // force inline layout in case CSS sets it to block
    toggle.style.display = "inline"; // or "inline-block" if you prefer
    // small non-breaking space before toggle to separate from text
    contentSpan.appendChild(document.createTextNode(" "));
    contentSpan.appendChild(toggle);

    const renderCollapsed = () => {
      listText.textContent = items.slice(0, 2).join(joiner) + " … ";
      toggle.textContent = "Більше";
    };

    const renderExpanded = () => {
      listText.textContent = items.join(joiner) + " ";
      toggle.textContent = "Менше";
    };

    const onToggle = () => {
      expanded = !expanded;
      expanded ? renderExpanded() : renderCollapsed();
    };

    // Initial state — collapsed
    renderCollapsed();

    toggle.addEventListener("click", onToggle);
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
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
    const addressEl = document.querySelector(".ritual-address");
    const phoneEl = document.querySelector(".ritual-phone");

    // address: масив адрес (або один рядок), префікс не потрібен
    renderListWithToggle(addressEl, data.address);

    // phone: масив телефонів (або один рядок), з префіксом
    renderListWithToggle(phoneEl, data.phone);

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
      const nbsp = document.createTextNode("\u00A0");
      const toggle = document.createElement("span");
      toggle.className = "bio-toggle";
      toggle.setAttribute("role", "button");
      toggle.tabIndex = 0;

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
        textSpan.textContent = text.slice(0, prefixLen).trimEnd() + " …";
        toggle.textContent = moreLabel;
        aboutEl.append(textSpan, nbsp, toggle);
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
      aboutEl.innerHTML = "";
      textSpan.textContent = text.slice(0, best).trimEnd() + " …";
      toggle.textContent = moreLabel;
      aboutEl.classList.remove("expanded");
      aboutEl.append(textSpan, document.createTextNode("\u00A0"), toggle);

      let expanded = false;
      const expand = () => {
        expanded = true;
        aboutEl.classList.add("expanded"); // <<< важливо
        aboutEl.innerHTML = "";
        textSpan.textContent = text + " ";
        toggle.textContent = "менше";
        aboutEl.append(textSpan, toggle);
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
          ...(x?.video?.player
            ? { video: { player: x.video.player, poster: x.video.poster || "" } }
            : { photos: Array.isArray(x?.photos) ? x.photos : [] }),
          description: (x?.description || "").toString(),
        };
      });

      albums.forEach((album) => {
        // --- VIDEO tile ---
        if (album.video?.player) {
          const wrapper = document.createElement("div");
          wrapper.className = "image-wrapper";
          const img = document.createElement("img");
          img.src = album.video.poster || "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23e9eef3'/%3E%3Cpolygon points='160,110 160,190 230,150' fill='%23888'/%3E%3C/svg%3E";
          img.alt = title;
          img.classList.add("preview-img");
          const play = document.createElement("div");
          play.className = "image-counter";
          play.textContent = "▶";
          img.addEventListener("click", () => openVideoPlayer(album.video.player));
          wrapper.appendChild(img);
          wrapper.appendChild(play);
          imagesContainer.appendChild(wrapper);
          return;
        }
        // --- PHOTO tile ---
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
      // 2) Redirect (URL param optional now)
      window.location.href = `/ritual_service_edit.html?id=${ritualId}`;
    } catch {
      errorEl.textContent = "Невірний логін або пароль";
    }
  });

  function openVideoPlayer(src) {
    const modal = document.createElement("div");
    modal.className = "slideshow-modal";
    const closeBtn = document.createElement("span");
    closeBtn.textContent = "✕";
    closeBtn.className = "close-slideshow";
    closeBtn.onclick = () => { document.body.style.overflow = ""; modal.remove(); };
    const video = document.createElement("video");
    video.src = src;
    video.controls = true;
    video.playsInline = true;
    video.style.width = "100%";
    video.style.height = "70vh";
    modal.append(closeBtn, video);
    document.body.style.overflow = "hidden";
    document.body.appendChild(modal);
  }

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
