// public/chat.js
(async function () {
  const API = "https://memoria-test-app-ifisk.ondigitalocean.app/api";
  const msgsDiv = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("msgInput");
  const fileInput = document.getElementById("fileInput");
  const previewContainer = document.getElementById("previewContainer");
  const attachBtn = document.querySelector(".attach-btn");
  let selectedFile = null;

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

  // init once
  autosize(input);
  updateSpacer();

  // grow on each keystroke
  input.addEventListener("input", () => autosize(input));

  // keep spacer correct on viewport changes
  window.addEventListener("resize", updateSpacer);

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
    if (msg.imageData) {
      const img = document.createElement("img");
      img.src = msg.imageData;
      bubble.append(img);
      attachChatImagePreview(img, msg.imageData);
    }

    // час створення
    if (msg.createdAt) {
      const time = new Date(msg.createdAt);
      const timeDiv = document.createElement("div");
      timeDiv.className = "msg-time";
      timeDiv.textContent = time.toLocaleTimeString("uk-UA", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
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

    if (imageData) {
      const img = document.createElement("img");
      img.src = imageData;
      bubble.append(img);
      attachChatImagePreview(img, imageData);
    }

    const status = document.createElement("div");
    status.className = "sending-status";
    status.innerHTML = `
      <span>Надсилається</span>
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

  function attachChatImagePreview(img, src) {
    img.classList.add('chat-image-preview');
    img.addEventListener('click', () => {
      openChatImageFullscreen(src);
    });
  }

  function openChatImageFullscreen(src) {
    const modal = document.createElement('div');
    modal.className = 'slideshow-modal chat-slideshow';

    const track = document.createElement('div');
    track.className = 'slideshow-track';

    const slide = document.createElement('div');
    slide.className = 'slideshow-slide';

    const img = document.createElement('img');
    img.className = 'slideshow-img';
    img.src = src;

    slide.appendChild(img);
    track.appendChild(slide);

    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-slideshow';
    closeBtn.textContent = '✕';

    modal.appendChild(track);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);

    const cleanup = () => {
      document.removeEventListener('keydown', handleEsc);
      modal.remove();
    };

    closeBtn.addEventListener('click', cleanup);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
      }
    });

    const handleEsc = (ev) => {
      if (ev.key === 'Escape') cleanup();
    };
    document.addEventListener('keydown', handleEsc);
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
  fileInput.addEventListener("change", (e) => {
    previewContainer.innerHTML = ""; // очищаємо попереднє
    selectedFile = e.target.files[0]; // зберігаємо в змінну

    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      // Створюємо <div class="thumb"><img src="…"><button class="remove">×</button></div>
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      thumb.innerHTML = `
            <img src="${reader.result}" />
            <div class="remove">×</div>
          `;
      previewContainer.append(thumb);

      // обробник для скасування
      thumb.querySelector(".remove").onclick = () => {
        selectedFile = null;
        fileInput.value = "";
        previewContainer.innerHTML = "";
      };
    };
    reader.readAsDataURL(selectedFile);
  });

  // 7) Send new message (FormData із файлом)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text && !selectedFile) return;

    // знімок попереднього перегляду (якщо є) для pending
    let previewData = null;
    if (selectedFile) {
      previewData = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(selectedFile);
      });
    }

    // створюємо FormData
    const formData = new FormData();
    formData.append("sender", "user");
    formData.append("text", text || "");
    if (selectedFile) {
      formData.append("image", selectedFile);
    }

    // рендеримо pending
    const pendingId = uid();
    const pendingBubble = renderPending({
      text,
      imageData: previewData,
      pendingId
    });

    // очистка полів вводу
    input.value = "";
    autosize(input);
    selectedFile = null;
    fileInput.value = "";
    previewContainer.innerHTML = "";

    try {
      const resp = await fetch(`${API}/chats/${chatId}/messages`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) throw new Error("HTTP " + resp.status);

      // Успіх: чекаємо socket->newMessage, який сам перезавантажить історію.
      // Нічого не робимо тут — pending зникне у clearPending().
    } catch (err) {
      // Помилка відправки: показати статус «Помилка. Повторити»
      if (pendingBubble) {
        const status = pendingBubble.querySelector(".sending-status");
        if (status) {
          status.innerHTML = `<span style="color:#D80032">Помилка. Спробуйте ще раз</span>`;
        }
        pendingBubble.classList.remove("pending");
      }
      console.error("Send failed:", err);
    }
  });

  window.addEventListener("load", () => {
    setTimeout(scrollToBottom, 100); // delay to ensure Safari renders layout
  });
})();
