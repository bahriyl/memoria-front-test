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
    const msgsDiv = document.getElementById("messages");
    msgsDiv.scrollTo({ top: msgsDiv.scrollHeight, behavior: "smooth" });
  }

  // 3) Render helper
  function render(msg) {
    // якщо це повідомлення від адміна — додаємо лейбл «Memoria»
    if (msg.sender === "admin") {
      const label = document.createElement("div");
      label.className = "sender-label";
      label.textContent = "Memoria";
      msgsDiv.append(label);
    }

    // потім рендеримо саму бульбашку
    const bubble = document.createElement("div");
    bubble.className = `bubble ${msg.sender === "user" ? "user" : "admin"}`;
    if (msg.text) {
      const p = document.createElement("p");
      p.textContent = msg.text;
      bubble.append(p);
    }
    if (msg.imageData) {
      const img = document.createElement("img");
      img.src = msg.imageData;
      bubble.append(img);
    }
    msgsDiv.append(bubble);
    scrollToBottom();
  }

  // 4) Load full history
  async function loadHistory() {
    const msgs = await (await fetch(`${API}/chats/${chatId}/messages`)).json();
    msgsDiv.innerHTML = "";
    msgs.forEach(render);
  }

  await loadHistory();

  // 5) Listen for live updates
  socket.on("newMessage", () => {
    loadHistory();
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

    const formData = new FormData();
    formData.append("sender", "user");
    formData.append("text", text || "");
    if (selectedFile) {
      formData.append("image", selectedFile);
    }

    // очитка UI
    input.value = "";
    selectedFile = null;
    fileInput.value = "";
    previewContainer.innerHTML = "";

    await fetch(`${API}/chats/${chatId}/messages`, {
      method: "POST",
      body: formData,
    });
    // далі socket сам оновить історію через loadHistory()
  });
})();
