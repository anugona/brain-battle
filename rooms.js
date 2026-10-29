import { randomInt } from 'node:crypto';
import { CATEGORIES, QUESTIONS, PUBLIC_QUESTIONS } from './questions.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const QUESTION_MS = 15_000;
const SPEED_MS = 8_000;
const LOBBY_MS = 3_000;
const FREEZE_MS = 5_000;
const MAX_FREEZE_PER_QUESTION_MS = 10_000;
export const MAX_PLAYERS_PER_ROOM = 8;
const POWERUPS = ['fiftyFifty', 'doublePoints', 'timeFreeze'];

const shuffle = values => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

function freshPowerups() { return { fiftyFifty: true, doublePoints: true, timeFreeze: true, doubleArmed: false }; }

export function createRoomManager({ emitRoom, emitPlayer, now = Date.now, questionMs = QUESTION_MS, speedMs = SPEED_MS, lobbyMs = LOBBY_MS } = {}) {
  const rooms = new Map();

  function roundType(index) { return index === 3 ? 'speed' : index === 7 ? 'bonus' : 'standard'; }
  function questionDuration(room) { return roundType(room.questionIndex) === 'speed' ? speedMs : questionMs; }

  function roomSnapshot(room) {
    const id = room.questionIds[room.questionIndex];
    const publicQuestion = ['question', 'reveal'].includes(room.phase) && id !== undefined ? PUBLIC_QUESTIONS[id] : null;
    return {
      code: room.code, phase: room.phase, hostId: room.hostId, selectedCategories: [...room.selectedCategories],
      players: [...room.players.values()].map(({ id: playerId, name, score, connected, answer, powerups, eligibleFromQuestionIndex }) => ({
        id: playerId, name, score, connected, answered: answer !== null,
        eligible: room.questionIndex >= eligibleFromQuestionIndex,
        canAnswer: room.phase === 'question' && room.questionIndex >= eligibleFromQuestionIndex && answer === null,
        powerups: { ...powerups }
      })),
      questionIndex: room.questionIndex, totalQuestions: room.questionIds.length,
      question: publicQuestion ? { ...publicQuestion, roundType: roundType(room.questionIndex), durationMs: questionDuration(room) } : null,
      deadline: room.deadline, serverNow: now(), roundNumber: room.questionIndex + 1, results: room.results ?? null,
      answersLocked: room.answersLocked ?? false, freezeUsedMs: room.freezeUsedMs ?? 0
    };
  }

  function broadcast(room) { emitRoom?.(room.code, 'room:update', roomSnapshot(room)); }

  function newCode() {
    let code;
    do { code = Array.from({ length: 5 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(code));
    return code;
  }

  function pickQuestions(categories) {
    const grouped = categories.map(category => shuffle(QUESTIONS.map((question, index) => ({ question, index })).filter(item => item.question.category === category)));
    const selected = [];
    while (selected.length < 12 && grouped.some(group => group.length)) {
      for (const group of grouped) {
        if (group.length && selected.length < 12) selected.push(group.pop().index);
      }
    }
    return shuffle(selected);
  }

  function startQuestion(room) {
    if (!rooms.has(room.code)) return;
    if (room.questionIndex >= room.questionIds.length) {
      room.phase = 'results'; room.deadline = null; room.results = leaderboard(room); broadcast(room); return;
    }
    room.phase = 'question'; room.deadline = now() + questionDuration(room); room.results = null; room.freezeUsedMs = 0;
    room.players.forEach(player => { player.answer = null; player.eliminated = []; });
    broadcast(room);
    clearTimeout(room.timer);
    room.timer = setTimeout(() => finishQuestion(room), questionDuration(room));
    room.timer.unref?.();
  }

  function finishQuestion(room) {
    if (room.phase !== 'question') return;
    clearTimeout(room.timer);
    room.phase = 'reveal'; room.deadline = now() + lobbyMs;
    const current = QUESTIONS[room.questionIds[room.questionIndex]];
    room.results = { correctAnswer: current.answer, correctCount: [...room.players.values()].filter(player => room.questionIndex >= player.eligibleFromQuestionIndex && player.answer === current.answer).length, leaderboard: leaderboard(room) };
    broadcast(room);
    room.timer = setTimeout(() => { room.questionIndex += 1; startQuestion(room); }, lobbyMs);
    room.timer.unref?.();
  }

  function leaderboard(room) {
    return [...room.players.values()].map(({ id, name, score, connected }) => ({ id, name, score, connected }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  function create(socketId, name) {
    const code = newCode();
    const room = { code, phase: 'lobby', hostId: socketId, players: new Map(), selectedCategories: [...CATEGORIES], questionIds: [], questionIndex: 0, deadline: null, timer: null };
    rooms.set(code, room);
    room.players.set(socketId, { id: socketId, name, score: 0, connected: true, answer: null, powerups: freshPowerups(), eliminated: [], eligibleFromQuestionIndex: 0 });
    broadcast(room);
    return { code, snapshot: roomSnapshot(room) };
  }

  function join(socketId, code, name) {
    const room = rooms.get(String(code ?? '').trim().toUpperCase());
    if (!room) return { error: 'We couldn’t find that room. Check the code and try again.' };
    if (room.phase === 'results') return { error: 'That game has ended. Ask the host to start a new room.' };
    if (['question', 'reveal'].includes(room.phase) && room.questionIndex + 1 >= room.questionIds.length) return { error: 'This game is on its final question. Ask the host to start a replay, then join.' };
    if (room.players.size >= MAX_PLAYERS_PER_ROOM && !room.players.has(socketId)) return { error: `This room is full (${MAX_PLAYERS_PER_ROOM} players max, including the host).` };
    const eligibleFromQuestionIndex = room.phase === 'lobby' ? room.questionIndex : room.questionIndex + 1;
    room.players.set(socketId, { id: socketId, name, score: 0, connected: true, answer: null, powerups: freshPowerups(), eliminated: [], eligibleFromQuestionIndex });
    broadcast(room);
    return { code: room.code, snapshot: roomSnapshot(room) };
  }

  function configure(socketId, code, categories) {
    const room = rooms.get(code);
    if (!room || room.hostId !== socketId || room.phase !== 'lobby' || !Array.isArray(categories)) return false;
    const selected = [...new Set(categories.filter(category => CATEGORIES.includes(category)))];
    if (!selected.length || selected.length !== categories.length) return false;
    room.selectedCategories = selected;
    broadcast(room);
    return true;
  }

  function start(socketId, code) {
    const room = rooms.get(code);
    if (!room || room.hostId !== socketId || room.phase !== 'lobby') return false;
    if (room.players.size < 1) return false;
    room.questionIds = pickQuestions(room.selectedCategories);
    room.questionIndex = 0;
    room.players.forEach(player => { player.score = 0; player.powerups = freshPowerups(); player.eligibleFromQuestionIndex = 0; });
    startQuestion(room);
    return true;
  }

  function answer(socketId, code, choice) {
    const room = rooms.get(code);
    if (!room || room.phase !== 'question' || room.answersLocked) return { error: 'This question is no longer accepting answers.' };
    if (now() >= room.deadline) { finishQuestion(room); return { error: 'Time is up for this question.' }; }
    const player = room.players.get(socketId);
    if (!player?.connected) return { error: 'Join the room before answering.' };
    if (room.questionIndex < player.eligibleFromQuestionIndex) return { error: 'You joined during this round. You can answer starting next round.' };
    if (player.answer !== null) return { error: 'Your answer is already locked in.' };
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return { error: 'Choose one of the four answers.' };
    player.answer = choice;
    if (choice === QUESTIONS[room.questionIds[room.questionIndex]].answer) {
      const remaining = Math.max(0, room.deadline - now());
      const type = roundType(room.questionIndex);
      const base = type === 'speed' ? 150 : 100;
      const speedBonus = Math.floor(remaining / 1000) * (type === 'speed' ? 15 : 10);
      const roundMultiplier = type === 'bonus' ? 2 : 1;
      const powerMultiplier = player.powerups.doubleArmed ? 2 : 1;
      player.score += (base + speedBonus) * roundMultiplier * powerMultiplier;
    }
    if (choice === QUESTIONS[room.questionIds[room.questionIndex]].answer && player.powerups.doubleArmed) player.powerups.doubleArmed = false;
    broadcast(room);
    if ([...room.players.values()].filter(p => p.connected && room.questionIndex >= p.eligibleFromQuestionIndex).every(p => p.answer !== null)) finishQuestion(room);
    return { ok: true };
  }

  function usePowerup(socketId, code, type) {
    const room = rooms.get(code);
    const player = room?.players.get(socketId);
    if (!room || room.phase !== 'question' || !player?.connected || player.answer !== null) return { error: 'Power-ups are only available before you answer.' };
    if (room.questionIndex < player.eligibleFromQuestionIndex) return { error: 'Power-ups unlock when your first round begins.' };
    if (now() >= room.deadline) { finishQuestion(room); return { error: 'Time is up for this question.' }; }
    if (!POWERUPS.includes(type)) return { error: 'That power-up is not available.' };
    if (!player.powerups[type]) return { error: 'You have already used that power-up this game.' };
    if (type === 'timeFreeze' && room.freezeUsedMs >= MAX_FREEZE_PER_QUESTION_MS) return { error: 'The arena timer is already frozen for this question.' };
    player.powerups[type] = false;
    if (type === 'fiftyFifty') {
      const correct = QUESTIONS[room.questionIds[room.questionIndex]].answer;
      const wrongChoices = shuffle([0, 1, 2, 3].filter(index => index !== correct)).slice(0, 2);
      player.eliminated = wrongChoices;
      emitPlayer?.(socketId, 'player:powerup', { type, removedChoices: wrongChoices });
    }
    if (type === 'doublePoints') player.powerups.doubleArmed = true;
    if (type === 'timeFreeze') {
      const extension = Math.min(FREEZE_MS, MAX_FREEZE_PER_QUESTION_MS - room.freezeUsedMs);
      room.freezeUsedMs += extension; room.deadline += extension;
      clearTimeout(room.timer);
      room.timer = setTimeout(() => finishQuestion(room), Math.max(0, room.deadline - now()));
      room.timer.unref?.();
    }
    broadcast(room);
    return { ok: true, type, removedChoices: player.eliminated };
  }

  function disconnect(socketId) {
    for (const room of rooms.values()) {
      const player = room.players.get(socketId);
      if (!player) continue;
      player.connected = false;
      if (room.hostId === socketId) {
        const nextHost = [...room.players.values()].find(p => p.connected);
        if (nextHost) room.hostId = nextHost.id;
      }
      broadcast(room);
    }
  }

  function rejoin(socketId, code, oldId) {
    const room = rooms.get(String(code ?? '').trim().toUpperCase());
    const previous = room?.players.get(oldId);
    if (!room || !previous) return { error: 'Your previous seat could not be restored. Join as a new player.' };
    room.players.delete(oldId); previous.id = socketId; previous.connected = true; room.players.set(socketId, previous);
    if (room.hostId === oldId) room.hostId = socketId;
    if (previous.eliminated.length) emitPlayer?.(socketId, 'player:powerup', { type: 'fiftyFifty', removedChoices: previous.eliminated });
    broadcast(room);
    return { code: room.code, snapshot: roomSnapshot(room) };
  }

  function reset(socketId, code) {
    const room = rooms.get(code);
    if (!room || room.hostId !== socketId || room.phase !== 'results') return false;
    clearTimeout(room.timer);
    room.phase = 'lobby'; room.questionIndex = 0; room.questionIds = []; room.deadline = null; room.results = null;
    room.players.forEach(p => { p.score = 0; p.answer = null; p.powerups = freshPowerups(); p.eliminated = []; p.eligibleFromQuestionIndex = 0; });
    broadcast(room);
    return true;
  }

  function get(code) { const room = rooms.get(code); return room ? roomSnapshot(room) : null; }
  function close() { for (const room of rooms.values()) clearTimeout(room.timer); rooms.clear(); }

  return { create, join, configure, start, answer, usePowerup, disconnect, rejoin, reset, get, close };
}
