const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4173;

const dealers = Array.from({ length: 36 }, (_, i) => ({
  id: `dealer-${i + 1}`,
  name: `대리점 ${String(i + 1).padStart(2, '0')}지점`,
  region: ['서울', '경기', '인천', '부산', '대구', '광주'][i % 6],
}));

const users = [];
dealers.forEach((dealer, idx) => {
  users.push({ id: `u-dm-${idx + 1}`, name: `${dealer.name} 매니저`, role: 'dealer', dealerId: dealer.id });
  users.push({ id: `u-ds-${idx + 1}`, name: `${dealer.name} 영업`, role: 'dealer', dealerId: dealer.id });
});
for (let i = 1; i <= 28; i += 1) {
  users.push({ id: `u-hq-${i}`, name: `HQ 담당 ${i}`, role: 'hq', team: `HQ 영업${(i % 7) + 1}팀` });
}

const rooms = dealers.map((dealer, i) => ({
  id: `room-${dealer.id}`,
  dealerId: dealer.id,
  title: `${dealer.name} ↔ 본사`,
  hqTeam: `HQ 영업${(i % 7) + 1}팀`,
  messages: [],
  unreadByUser: {},
}));

function nowString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

rooms.forEach((room, i) => {
  room.messages.push({
    id: `seed-${room.id}`,
    senderId: `u-hq-${(i % 28) + 1}`,
    senderName: `HQ 담당 ${(i % 28) + 1}`,
    senderRole: 'hq',
    text: `${room.title} 데모 채널입니다. 실시간으로 메시지를 주고받아 보세요.`,
    time: nowString(),
  });
});

app.use(express.static(path.join(__dirname)));

io.on('connection', (socket) => {
  socket.emit('bootstrap', { dealers, users, rooms });

  socket.on('joinRoom', ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on('sendMessage', ({ roomId, senderId, senderName, senderRole, text }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room || !text || !senderId) return;

    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      senderId,
      senderName,
      senderRole,
      text: text.trim(),
      time: nowString(),
    };

    room.messages.push(message);

    users.forEach((u) => {
      if (u.id !== senderId) {
        room.unreadByUser[u.id] = (room.unreadByUser[u.id] || 0) + 1;
      }
    });
    room.unreadByUser[senderId] = 0;

    io.emit('roomUpdated', { roomId, room });
    io.to(roomId).emit('messageAdded', { roomId, message });
  });

  socket.on('markRead', ({ roomId, userId }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room || !userId) return;
    room.unreadByUser[userId] = 0;
    io.emit('roomUpdated', { roomId, room });
  });

  socket.on('clearRoom', ({ roomId }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    room.messages = [];
    room.unreadByUser = {};
    users.forEach((u) => {
      room.unreadByUser[u.id] = 0;
    });
    io.emit('roomUpdated', { roomId, room });
  });
});

server.listen(PORT, () => {
  console.log(`Messenger demo running at http://localhost:${PORT}`);
});
