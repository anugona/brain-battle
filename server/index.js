import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import { createRoomManager } from './rooms.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });
const rooms = createRoomManager({
  emitRoom: (code, event, payload) => io.to(code).emit(event, payload),
  emitPlayer: (socketId, event, payload) => io.to(socketId).emit(event, payload)
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/room/:code', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  return res.json(room);
});

io.on('connection', socket => {
  socket.on('room:create', ({ name } = {}, reply = () => {}) => {
    const cleanName = cleanPlayerName(name);
    if (!cleanName) return reply({ error: 'Enter a name between 1 and 18 characters.' });
    const room = rooms.create(socket.id, cleanName);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    reply({ ok: true, ...room });
  });

  socket.on('room:join', ({ code, name } = {}, reply = () => {}) => {
    const cleanName = cleanPlayerName(name);
    if (!cleanName) return reply({ error: 'Enter a name between 1 and 18 characters.' });
    const room = rooms.join(socket.id, code, cleanName);
    if (room.error) return reply(room);
    socket.join(room.code); socket.data.roomCode = room.code;
    reply({ ok: true, ...room });
  });

  socket.on('room:rejoin', ({ code, playerId } = {}, reply = () => {}) => {
    const room = rooms.rejoin(socket.id, code, playerId);
    if (room.error) return reply(room);
    socket.join(room.code); socket.data.roomCode = room.code;
    reply({ ok: true, ...room });
  });

  socket.on('game:start', ({ code } = {}, reply = () => {}) => reply({ ok: rooms.start(socket.id, code) }));
  socket.on('game:configure', ({ code, categories } = {}, reply = () => {}) => reply({ ok: rooms.configure(socket.id, code, categories) }));
  socket.on('game:answer', ({ code, choice } = {}, reply = () => {}) => reply(rooms.answer(socket.id, code, choice)));
  socket.on('game:powerup', ({ code, type } = {}, reply = () => {}) => reply(rooms.usePowerup(socket.id, code, type)));
  socket.on('game:replay', ({ code } = {}, reply = () => {}) => reply({ ok: rooms.reset(socket.id, code) }));
  socket.on('disconnect', () => rooms.disconnect(socket.id));
});

function cleanPlayerName(name) {
  if (typeof name !== 'string') return null;
  const clean = name.trim().replace(/\s+/g, ' ');
  return clean.length > 0 && clean.length <= 18 ? clean : null;
}

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const port = Number(process.env.PORT) || 3001;
httpServer.listen(port, '0.0.0.0', () => console.log(`Brain Battle server listening on http://localhost:${port}`));

function shutdown() { rooms.close(); httpServer.close(() => process.exit(0)); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
