import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { QUESTIONS } from '../server/questions.js';

const url = process.env.GAME_URL ?? 'http://localhost:3001';
const host = io(url, { reconnection: false, timeout: 15_000 });
const guest = io(url, { reconnection: false, timeout: 15_000 });
const late = io(url, { reconnection: false, timeout: 15_000 });
const sockets = [host, guest, late];
const received = new Map(sockets.map(socket => [socket, []]));

function once(socket, predicate, timeout = 15_000) {
  const current = received.get(socket).findLast(predicate);
  if (current) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('room:update', onUpdate); reject(new Error('Timed out waiting for a room update')); }, timeout);
    const onUpdate = snapshot => {
      if (!predicate(snapshot)) return;
      clearTimeout(timer); socket.off('room:update', onUpdate); resolve(snapshot);
    };
    socket.on('room:update', onUpdate);
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timed out`)), 15_000);
    socket.emit(event, payload, response => { clearTimeout(timer); resolve(response); });
  });
}

try {
  await Promise.all(sockets.map(socket => new Promise((resolve, reject) => {
    socket.once('connect', resolve); socket.once('connect_error', reject);
  })));
  for (const socket of sockets) socket.on('room:update', snapshot => received.get(socket).push(snapshot));

  const created = await emitAck(host, 'room:create', { name: 'Host' });
  assert.equal(created.ok, true);
  assert.equal((await emitAck(guest, 'room:join', { name: 'Guest', code: 'XXXXX' })).error?.includes('find that room'), true);
  assert.equal((await emitAck(guest, 'room:join', { name: 'Guest', code: created.code })).ok, true);
  const lobby = await once(host, snapshot => snapshot.phase === 'lobby' && snapshot.players.length === 2);
  assert.equal(lobby.players.length, 2);

  assert.equal((await emitAck(host, 'game:configure', { code: created.code, categories: ['Science'] })).ok, true);
  assert.deepEqual((await once(guest, snapshot => snapshot.phase === 'lobby' && snapshot.selectedCategories?.[0] === 'Science')).selectedCategories, ['Science']);
  assert.equal((await emitAck(host, 'game:start', { code: created.code })).ok, true);
  const questionHost = await once(host, snapshot => snapshot.phase === 'question');
  const questionGuest = await once(guest, snapshot => snapshot.phase === 'question');
  assert.equal(questionHost.question.prompt, questionGuest.question.prompt);
  assert.equal(questionHost.deadline, questionGuest.deadline);

  const removed = await emitAck(host, 'game:powerup', { code: created.code, type: 'fiftyFifty' });
  const correct = QUESTIONS.find(item => item.prompt === questionHost.question.prompt).answer;
  assert.equal(removed.ok, true);
  assert.equal(removed.removedChoices.length, 2);
  assert.ok(!removed.removedChoices.includes(correct));
  assert.equal((await emitAck(host, 'game:powerup', { code: created.code, type: 'doublePoints' })).ok, true);
  const oldDeadline = received.get(host).at(-1).deadline;
  assert.equal((await emitAck(host, 'game:powerup', { code: created.code, type: 'timeFreeze' })).ok, true);
  const frozen = received.get(host).at(-1);
  assert.equal(frozen.deadline, oldDeadline + 5000);

  const lateJoin = await emitAck(late, 'room:join', { name: 'Late Joiner', code: created.code });
  assert.equal(lateJoin.ok, true);
  assert.equal(lateJoin.snapshot.players.find(player => player.id === late.id).canAnswer, false);
  assert.match((await emitAck(late, 'game:answer', { code: created.code, choice: 0 })).error, /starting next round/);

  const revealWaits = [host, guest, late].map(socket => once(socket, snapshot => snapshot.phase === 'reveal'));
  assert.equal((await emitAck(host, 'game:answer', { code: created.code, choice: correct })).ok, true);
  const wrong = correct === 0 ? 1 : 0;
  assert.equal((await emitAck(guest, 'game:answer', { code: created.code, choice: wrong })).ok, true);
  const reveals = await Promise.all(revealWaits);
  assert.deepEqual(reveals[0].results, reveals[1].results);
  assert.deepEqual(reveals[1].results, reveals[2].results);
  assert.equal(reveals[0].players.length, 3);
  assert.ok(reveals[0].players.find(player => player.id === host.id).score > 0);

  const next = await once(late, snapshot => snapshot.phase === 'question' && snapshot.questionIndex === 1);
  assert.equal(next.players.find(player => player.id === late.id).canAnswer, true);
  console.log('PASS: configured category, synchronized server-time deadline and scoring, all three server-validated power-ups, and next-round late joining.');
} finally {
  sockets.forEach(socket => socket.disconnect());
}
