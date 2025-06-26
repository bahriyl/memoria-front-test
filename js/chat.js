// public/chat.js
; (async function () {
    const API = 'https://memoria-test-app-ifisk.ondigitalocean.app/api';
    const msgsDiv = document.getElementById('messages');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('msgInput');

    // 1) Get or create chatId
    let chatId = sessionStorage.getItem('chatId');
    if (!chatId) {
        const res = await fetch(`${API}/chats`, { method: 'POST' });
        const body = await res.json();
        chatId = body.chatId;
        sessionStorage.setItem('chatId', chatId);
    }

    // 2) Connect & join room
    const socket = io('https://memoria-test-app-ifisk.ondigitalocean.app', {
        path: '/socket.io',
        transports: ['websocket', 'polling']
    });
    socket.emit('joinRoom', chatId);

    // 3) Render helper
    function render(msg) {
        const bubble = document.createElement('div');
        bubble.className = `bubble ${msg.sender === 'user' ? 'user' : 'admin'}`;
        bubble.textContent = msg.text;
        msgsDiv.append(bubble);
        msgsDiv.scrollTop = msgsDiv.scrollHeight;
    }

    // 4) Load full history
    async function loadHistory() {
        const msgs = await (await fetch(`${API}/chats/${chatId}/messages`)).json();
        msgsDiv.innerHTML = '';
        msgs.forEach(render);
    }

    await loadHistory();

    // 5) Listen for live updates
    socket.on('newMessage', () => {
        loadHistory();
    });

    // 6) Send new message
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        await fetch(`${API}/chats/${chatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: 'user', text })
        });
        // no need to manually reload—server will broadcast newMessage → loadHistory()
    });
})();
