// public/admin.js
; (async function () {
    const API = 'https://memoria-test-app-ifisk.ondigitalocean.app/api';
    const list = document.getElementById('chatList');
    const title = document.getElementById('chatTitle');
    const msgsDiv = document.getElementById('messages');
    const form = document.getElementById('adminForm');
    const input = document.getElementById('adminInput');
    let socket, currentChatId;

    // Render helper (flip bubble classes so admin appears on right)
    function render(msg) {
        const bubble = document.createElement('div');
        // admin messages look like user-bubbles on the admin side
        bubble.className = `bubble ${msg.sender === 'admin' ? 'user' : 'admin'}`;
        bubble.textContent = msg.text;
        msgsDiv.append(bubble);
        msgsDiv.scrollTop = msgsDiv.scrollHeight;
    }

    // Load all chat sessions
    const chats = await (await fetch(`${API}/chats`)).json();
    chats.forEach(c => {
        const btn = document.createElement('button');
        btn.textContent = `Chat ${c.chatId.slice(-4)}`;
        btn.onclick = () => openChat(c.chatId);
        list.append(btn);
    });

    // Open a specific chat room
    async function openChat(chatId) {
        currentChatId = chatId;
        title.textContent = `Чат ${chatId.slice(-6)}`;
        msgsDiv.innerHTML = '';

        // Disconnect previous socket (if any)
        if (socket) socket.disconnect();

        // Reconnect & join new room
        socket = io('https://memoria-test-app-ifisk.ondigitalocean.app', {
            path: '/socket.io',              // this is the default path on Flask-SocketIO
            transports: ['websocket', 'polling']
        });
        socket.emit('joinRoom', chatId);

        // Fetch & render history
        const history = await (await fetch(`${API}/chats/${chatId}/messages`)).json();
        history.forEach(render);

        // Listen for live updates in *this* room
        socket.on('newMessage', () => {
            // upon new message, re-fetch & re-render
            (async () => {
                const msgs = await (await fetch(`${API}/chats/${chatId}/messages`)).json();
                msgsDiv.innerHTML = '';
                msgs.forEach(render);
            })();
        });
    }

    // Admin sending a reply
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentChatId) return alert('Спочатку оберіть чат');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        await fetch(`${API}/chats/${currentChatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: 'admin', text })
        });
        // `newMessage` broadcast will trigger openChat’s listener to reload
    });
})();
