// public/chat.js
(async function () {
  const API = "https://memoria-test-app-ifisk.ondigitalocean.app/api";
  const msgsDiv = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("msgInput");
  const fileInput = document.getElementById("fileInput");
  const previewContainer = document.getElementById("previewContainer");
  const attachBtn = document.querySelector(".attach-btn");
  const limitOverlay = document.getElementById("limit-modal-overlay");
  const limitModal = document.getElementById("limit-modal");
  const limitModalText = document.getElementById("limit-modal-text");
  const limitModalOk = document.getElementById("limit-modal-ok");
  const limitModalClose = document.getElementById("limit-modal-close");
  const maxPhotos = 5;
  let selectedFiles = [];

  function updateSpacer() {
    const bar = document.querySelector(".input-bar");
    const spacer = document.getElementById("bottomSpacer");
    // if (bar && spacer) spacer.style.height = (bar.offsetHeight + 10) + "px";
    if (bar && spacer) spacer.style.height = 0 + "px";
  }

  function autosize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px"; // keep in sync with CSS max-height
    updateSpacer();
  }

  function openLimitModal(message) {
    if (!limitOverlay || !limitModal) {
      window.alert(message);
      return;
    }
    if (limitModalText) limitModalText.textContent = message;
    limitOverlay.hidden = false;
    limitModal.hidden = false;
  }

  function closeLimitModal() {
    if (!limitOverlay || !limitModal) return;
    limitOverlay.hidden = true;
    limitModal.hidden = true;
  }

  // init once
  autosize(input);
  updateSpacer();

  // grow on each keystroke
  input.addEventListener("input", () => autosize(input));

  // keep spacer correct on viewport changes
  window.addEventListener("resize", updateSpacer);

  if (limitOverlay) limitOverlay.addEventListener("click", closeLimitModal);
  if (limitModalOk) limitModalOk.addEventListener("click", closeLimitModal);
  if (limitModalClose) limitModalClose.addEventListener("click", closeLimitModal);

  // 1) Get or create chatId
  let chatId = sessionStorage.getItem("chatId");
  if (!chatId) {
    const res = await fetch(`${API}/chats`, { method: "POST" });
    const body = await res.json();
    chatId = body.chatId;
    sessionStorage.setItem("chatId", chatId);
  }

  // 2) Connect & join room
  const socket = io("https://memoria-test-app-ifisk.ondigitalocean.app", {
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });
  socket.emit("joinRoom", chatId);

  function scrollToBottom() {
    const scroller = document.querySelector('.chat-scroll-wrapper');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  // 3) Render helper
  // small id helper for pending messages
  function uid() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeImages(imageData) {
    if (Array.isArray(imageData)) {
      return imageData.filter(Boolean);
    }
    return imageData ? [imageData] : [];
  }

  function render(msg) {
    // якщо це повідомлення від адміна — додаємо лейбл «Memoria»
    if (msg.sender === "admin") {
      const label = document.createElement("div");
      label.className = "sender-label";
      label.textContent = "Memoria";
      msgsDiv.append(label);
    }

    // головна бульбашка
    const bubble = document.createElement("div");
    bubble.className = `bubble ${msg.sender === "user" ? "user" : "admin"}`;

    // текст
    if (msg.text) {
      const p = document.createElement("p");
      p.textContent = msg.text;
      bubble.append(p);
    }

    // фото
    const images = normalizeImages(msg.imageData);
    images.forEach((src, index) => {
      const img = document.createElement("img");
      img.src = src;
      bubble.append(img);
      attachChatImagePreview(img, images, index);
    });

    // час створення
    if (msg.createdAt) {
      const raw = String(msg.createdAt);
      const hasTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(raw);
      const time = new Date(hasTz ? raw : `${raw}Z`);
      const timeDiv = document.createElement("div");
      timeDiv.className = "msg-time";
      timeDiv.textContent = time.toLocaleTimeString("uk-UA", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Kyiv"
      });
      bubble.append(timeDiv);
    }

    msgsDiv.append(bubble);
    scrollToBottom();
  }

  // Render "pending" bubble while sending
  function renderPending({ text, imageData, sender = "user", pendingId }) {
    if (sender === "admin") return; // нам треба лише для юзера

    const bubble = document.createElement("div");
    bubble.className = `bubble user pending`;
    bubble.dataset.pendingId = pendingId;

    if (text) {
      const p = document.createElement("p");
      p.textContent = text;
      bubble.append(p);
    }

    const images = normalizeImages(imageData);
    images.forEach((src, index) => {
      const img = document.createElement("img");
      img.src = src;
      bubble.append(img);
      attachChatImagePreview(img, images, index);
    });

    const status = document.createElement("div");
    status.className = "sending-status";
    status.innerHTML = `
      <span class="typing">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      </span>
    `;
    bubble.append(status);

    msgsDiv.append(bubble);
    scrollToBottom();
    return bubble;
  }

  // remove all pending bubbles (on server confirm or reload)
  function clearPending() {
    document.querySelectorAll('.bubble.pending').forEach(el => el.remove());
  }

  function attachChatImagePreview(img, images, startIndex) {
    img.classList.add('chat-image-preview');
    img.addEventListener('click', () => {
      openChatSlideshow(images, startIndex);
    });
  }

  function openChatSlideshow(images, startIndex = 0) {
    if (!images || images.length === 0) return;

    const modal = document.createElement('div');
    modal.className = 'slideshow-modal';

    const closeBtnX = document.createElement('span');
    closeBtnX.textContent = '✕';
    closeBtnX.className = 'close-slideshow';

    const track = document.createElement('div');
    track.className = 'slideshow-track';

    images.forEach((src) => {
      const slide = document.createElement('div');
      slide.className = 'slideshow-slide';

      const slideImg = document.createElement('img');
      slideImg.src = src;
      slideImg.className = 'slideshow-img';
      slide.appendChild(slideImg);

      track.appendChild(slide);
    });

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

    const cleanup = () => {
      document.removeEventListener('keydown', handleEsc);
      modal.remove();
    };

    const handleEsc = (ev) => {
      if (ev.key === 'Escape') cleanup();
    };
    document.addEventListener('keydown', handleEsc);

    closeBtnX.addEventListener('click', cleanup);

    modal.append(closeBtnX, track, indicator);
    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      const prev = track.style.scrollBehavior;
      track.style.scrollBehavior = 'auto';
      track.scrollLeft = startIndex * track.clientWidth;
      track.style.scrollBehavior = prev;
      updateIndicators(startIndex);
    });
  }

  // 4) Load full history
  async function loadHistory() {
    clearPending();
    const msgs = await (await fetch(`${API}/chats/${chatId}/messages`)).json();
    msgsDiv.innerHTML = "";
    msgs.forEach(render);
  }

  await loadHistory();
  setTimeout(scrollToBottom, 100);
  updateSpacer();

  // 5) Listen for live updates
  socket.on("newMessage", async () => {
    clearPending();
    await loadHistory();
    setTimeout(scrollToBottom, 100);
  });

  // 6) Attach button → вибір файлу
  attachBtn.addEventListener("click", () => fileInput.click());
  function renderPreview() {
    previewContainer.innerHTML = "";
    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        const thumb = document.createElement("div");
        thumb.className = "thumb";
        thumb.innerHTML = `
          <img src="${reader.result}" />
          <div class="remove">×</div>
        `;
        previewContainer.append(thumb);

        thumb.querySelector(".remove").onclick = () => {
          selectedFiles = selectedFiles.filter((_, i) => i !== index);
          renderPreview();
        };
      };
      reader.readAsDataURL(file);
    });
  }

  fileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > maxPhotos) {
      openLimitModal("Максимум 5 фото за раз.");
    }
    selectedFiles = files.slice(0, maxPhotos);
    renderPreview();
  });

  // 7) Send new message (FormData із файлом)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    const hasText = text.length > 0;
    const filesToSend = selectedFiles.slice();
    const hasImages = filesToSend.length > 0;
    if (!hasText && !hasImages) return;

    // знімок попереднього перегляду (якщо є) для pending
    let previewData = null;
    if (hasImages) {
      previewData = await Promise.all(
        filesToSend.map(
          (file) =>
            new Promise((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result);
              r.readAsDataURL(file);
            })
        )
      );
    }

    let imagesPendingBubble = null;
    let textPendingBubble = null;
    if (hasImages) {
      imagesPendingBubble = renderPending({
        text: "",
        imageData: previewData,
        pendingId: uid()
      });
    } else if (hasText) {
      textPendingBubble = renderPending({
        text,
        imageData: null,
        pendingId: uid()
      });
    }

    // очистка полів вводу
    input.value = "";
    autosize(input);
    selectedFiles = [];
    fileInput.value = "";
    previewContainer.innerHTML = "";

    const sendFormData = async (formData, pendingBubble) => {
      try {
        const resp = await fetch(`${API}/chats/${chatId}/messages`, {
          method: "POST",
          body: formData,
        });

        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return true;
      } catch (err) {
        if (pendingBubble) {
          const status = pendingBubble.querySelector(".sending-status");
          if (status) {
            status.innerHTML = `<span style="color:#D80032">Помилка. Спробуйте ще раз</span>`;
          }
          pendingBubble.classList.remove("pending");
        }
        console.error("Send failed:", err);
        return false;
      }
    };

    if (hasImages) {
      const imagesForm = new FormData();
      imagesForm.append("sender", "user");
      imagesForm.append("text", "");
      filesToSend.forEach((file) => {
        imagesForm.append("image", file);
      });

      const ok = await sendFormData(imagesForm, imagesPendingBubble);
      if (!ok) return;
    }

    if (hasText) {
      const textForm = new FormData();
      textForm.append("sender", "user");
      textForm.append("text", text);
      await sendFormData(textForm, hasImages ? null : textPendingBubble);
    }
  });

  window.addEventListener("load", () => {
    setTimeout(scrollToBottom, 100); // delay to ensure Safari renders layout
  });
})();
