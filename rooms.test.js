import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomManager, MAX_PLAYERS_PER_ROOM } from './rooms.js';
import { CATEGORIES, QUESTIONS, PUBLIC_QUESTIONS } from './questions.js';

function fixture() {
  const events = [];
  const manager = createRoomManager({ emitRoom: (code, event, payload) => events.push({ code, event, payload }), questionMs: 60000, lobbyMs: 25 });
  return { manager, events };
}

test('creates a host room and lets another player join with a case-insensitive code', () => {
  const { manager } = fixture();
  const created = manager.create('host', 'Host');
  assert.match(created.code, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(created.snapshot.players[0].name, 'Host');
  const joined = manager.join('guest', created.code.toLowerCase(), 'Guest');
  assert.equal(joined.snapshot.players.length, 2);
  manager.close();
});

test('allows exactly eight seats including the host and rejects a ninth player', () => {
  const { manager } = fixture();
  const room = manager.create('host', 'Host');
  for (let index = 2; index <= MAX_PLAYERS_PER_ROOM; index += 1) {
    assert.equal(manager.join(`player-${index}`, room.code, `Player ${index}`).snapshot.players.length, index);
  }
  const full = manager.get(room.code);
  assert.equal(full.players.length, 8);
  assert.deepEqual(full.players.map(player => player.name), ['Host', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6', 'Player 7', 'Player 8']);
  assert.match(manager.join('player-9', room.code, 'Player 9').error, /8 players max, including the host/);
  assert.equal(manager.get(room.code).players.length, 8);
  manager.close();
});

test('rejects invalid rooms and only host can start', () => {
  const { manager } = fixture();
  assert.match(manager.join('guest', 'XXXXX', 'Guest').error, /find that room/);
  const room = manager.create('host', 'Host');
  manager.join('guest', room.code, 'Guest');
  assert.equal(manager.start('guest', room.code), false);
  assert.equal(manager.start('host', room.code), true);
  assert.equal(manager.get(room.code).phase, 'question');
  manager.close();
});

test('accepts one valid answer per player and reports correct answer on reveal', async () => {
  const { manager } = fixture();
  const room = manager.create('host', 'Host');
  manager.join('guest', room.code, 'Guest');
  manager.start('host', room.code);
  const question = manager.get(room.code);
  const answerIndex = QUESTIONS.find(item => item.prompt === question.question.prompt).answer;
  assert.deepEqual(manager.answer('host', room.code, answerIndex), { ok: true });
  assert.match(manager.answer('host', room.code, answerIndex).error, /already locked/);
  manager.answer('guest', room.code, answerIndex === 0 ? 1 : 0);
  await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(manager.get(room.code).phase, 'reveal');
  assert.equal(manager.get(room.code).results.correctCount, 1);
  assert.ok(manager.get(room.code).players[0].score >= 100);
  assert.ok(question.totalQuestions > 0);
  manager.close();
});

test('marks disconnected players and promotes the next connected host', () => {
  const { manager } = fixture();
  const room = manager.create('host', 'Host');
  manager.join('guest', room.code, 'Guest');
  manager.disconnect('host');
  assert.equal(manager.get(room.code).hostId, 'guest');
  assert.equal(manager.get(room.code).players.find(p => p.id === 'host').connected, false);
  manager.close();
});

test('finishes with a ranked results board and lets the host replay', async () => {
  const manager = createRoomManager({ questionMs: 60000, lobbyMs: 1 });
  const room = manager.create('host', 'Host');
  manager.start('host', room.code);
  for (let index = 0; index < manager.get(room.code).totalQuestions; index += 1) {
    while (manager.get(room.code).phase !== 'question') await new Promise(resolve => setTimeout(resolve, 2));
    manager.answer('host', room.code, 0);
  }
  for (let tries = 0; manager.get(room.code).phase !== 'results' && tries < 50; tries += 1) {
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  const finished = manager.get(room.code);
  assert.equal(finished.phase, 'results');
  assert.equal(finished.results[0].name, 'Host');
  assert.equal(manager.reset('host', room.code), true);
  assert.equal(manager.get(room.code).phase, 'lobby');
  manager.close();
});

test('ships ten reusable questions in each category without exposing answer keys', () => {
  assert.equal(CATEGORIES.length, 6);
  for (const category of CATEGORIES) {
    assert.equal(QUESTIONS.filter(question => question.category === category).length, 10, `${category} question count`);
  }
  assert.ok(PUBLIC_QUESTIONS.every(question => !('answer' in question)));
});

test('category selection is host-only, rejects empty or unknown categories, and controls the question pool', () => {
  const { manager } = fixture();
  const created = manager.create('host', 'Host');
  assert.equal(manager.configure('guest', created.code, ['Science']), false);
  assert.equal(manager.configure('host', created.code, []), false);
  assert.equal(manager.configure('host', created.code, ['Space']), false);
  assert.equal(manager.configure('host', created.code, ['Science', 'Movies']), true);
  assert.deepEqual(manager.get(created.code).selectedCategories, ['Science', 'Movies']);
  assert.equal(manager.start('host', created.code), true);
  assert.equal(manager.get(created.code).totalQuestions, 12);
  assert.ok(QUESTIONS.some(question => question.category === manager.get(created.code).question.category));
  manager.close();
});

test('validates all power-ups, privately removes wrong choices, freezes the timer, and arms Double Points', () => {
  const privateEvents = [];
  const manager = createRoomManager({ emitPlayer: (...args) => privateEvents.push(args), questionMs: 60000, lobbyMs: 25 });
  const created = manager.create('host', 'Host');
  manager.join('guest', created.code, 'Guest');
  manager.start('host', created.code);
  const before = manager.get(created.code);
  const correct = QUESTIONS.find(question => question.prompt === before.question.prompt).answer;
  assert.match(manager.usePowerup('stranger', created.code, 'doublePoints').error, /only available/);
  assert.match(manager.usePowerup('host', created.code, 'unknown').error, /not available/);
  const half = manager.usePowerup('host', created.code, 'fiftyFifty');
  assert.equal(half.removedChoices.length, 2);
  assert.ok(!half.removedChoices.includes(correct));
  assert.equal(privateEvents[0][0], 'host');
  assert.equal(privateEvents[0][2].removedChoices.length, 2);
  assert.match(manager.usePowerup('host', created.code, 'fiftyFifty').error, /already used/);
  const double = manager.usePowerup('host', created.code, 'doublePoints');
  assert.equal(double.ok, true);
  assert.equal(manager.get(created.code).players.find(player => player.id === 'host').powerups.doubleArmed, true);
  const oldDeadline = manager.get(created.code).deadline;
  assert.equal(manager.usePowerup('host', created.code, 'timeFreeze').ok, true);
  assert.equal(manager.get(created.code).deadline, oldDeadline + 5000);
  assert.match(manager.usePowerup('host', created.code, 'timeFreeze').error, /already used/);
  assert.match(manager.usePowerup('host', created.code, 'doublePoints').error, /already used/);
  manager.close();
});

async function waitForRound(manager, code, index) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const snapshot = manager.get(code);
    if (snapshot.questionIndex === index && snapshot.phase === 'question') return snapshot;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error(`Round ${index + 1} did not start`);
}

test('Speed Round and Bonus Round award their server-defined score multipliers', async () => {
  let clock = 1000;
  const manager = createRoomManager({ now: () => clock, questionMs: 15000, speedMs: 8000, lobbyMs: 15 });
  const created = manager.create('host', 'Host');
  manager.start('host', created.code);
  for (let index = 0; index <= 7; index += 1) {
    const question = await waitForRound(manager, created.code, index);
    assert.equal(question.question.roundType, index === 3 ? 'speed' : index === 7 ? 'bonus' : 'standard');
    const answer = QUESTIONS.find(item => item.prompt === question.question.prompt).answer;
    const beforeScore = manager.get(created.code).players[0].score;
    assert.equal(manager.answer('host', created.code, answer).ok, true);
    const after = manager.get(created.code);
    assert.equal(after.phase, 'reveal');
    const difference = after.players[0].score - beforeScore;
    if (index === 3) assert.equal(difference, 270, 'speed round: 150 base plus speed bonus');
    if (index === 7) assert.equal(difference, 500, 'bonus round: standard score doubled');
    clock += 1;
  }
  manager.close();
});

test('Double Points remains armed after a wrong answer and doubles the next correct score', async () => {
  const manager = createRoomManager({ questionMs: 60000, lobbyMs: 25 });
  const created = manager.create('host', 'Host');
  manager.join('guest', created.code, 'Guest');
  manager.start('host', created.code);
  const question = manager.get(created.code).question;
  const correct = QUESTIONS.find(item => item.prompt === question.prompt).answer;
  manager.usePowerup('host', created.code, 'doublePoints');
  assert.deepEqual(manager.answer('host', created.code, correct === 0 ? 1 : 0), { ok: true });
  const host = manager.get(created.code).players.find(player => player.id === 'host');
  assert.equal(host.score, 0);
  assert.equal(host.powerups.doubleArmed, true);
  manager.answer('guest', created.code, 0);
  const nextQuestion = await waitForRound(manager, created.code, 1);
  const nextCorrect = QUESTIONS.find(item => item.prompt === nextQuestion.question.prompt).answer;
  manager.answer('host', created.code, nextCorrect);
  const scoredHost = manager.get(created.code).players.find(player => player.id === 'host');
  assert.ok(scoredHost.score >= 200);
  assert.equal(scoredHost.powerups.doubleArmed, false);
  manager.close();
});

test('late joiners are listed immediately but cannot answer or use power-ups until the next round', async () => {
  const { manager } = fixture();
  const created = manager.create('host', 'Host');
  manager.start('host', created.code);
  const activeQuestion = manager.get(created.code);
  const joined = manager.join('late', created.code, 'Late Joiner');
  const late = joined.snapshot.players.find(player => player.id === 'late');
  assert.equal(late.eligible, false);
  assert.equal(late.canAnswer, false);
  assert.deepEqual(joined.snapshot.question, activeQuestion.question);
  assert.equal(joined.snapshot.deadline, activeQuestion.deadline);
  assert.match(manager.answer('late', created.code, 0).error, /starting next round/);
  assert.match(manager.usePowerup('late', created.code, 'doublePoints').error, /first round begins/);

  const correct = QUESTIONS.find(item => item.prompt === activeQuestion.question.prompt).answer;
  manager.answer('host', created.code, correct);
  const reveal = manager.get(created.code);
  assert.equal(reveal.phase, 'reveal');
  assert.deepEqual(reveal.question, activeQuestion.question);
  assert.equal(reveal.results.correctCount, 1);

  const next = await waitForRound(manager, created.code, 1);
  const nextPlayer = next.players.find(player => player.id === 'late');
  assert.equal(nextPlayer.eligible, true);
  assert.equal(nextPlayer.canAnswer, true);
  assert.deepEqual(manager.answer('late', created.code, 0), { ok: true });
  manager.close();
});

test('a new player cannot be stranded by joining during the final question', async () => {
  const manager = createRoomManager({ questionMs: 60000, lobbyMs: 1 });
  const created = manager.create('host', 'Host');
  manager.configure('host', created.code, ['Science']);
  manager.start('host', created.code);
  for (let index = 0; index < 9; index += 1) {
    const question = await waitForRound(manager, created.code, index);
    const correct = QUESTIONS.find(item => item.prompt === question.question.prompt).answer;
    manager.answer('host', created.code, correct);
  }
  await waitForRound(manager, created.code, 9);
  assert.match(manager.join('late', created.code, 'Late').error, /final question/);
  manager.close();
});

test('room updates carry one shared question, deadline, power-up state, and score snapshot', () => {
  const { manager, events } = fixture();
  const created = manager.create('host', 'Host');
  manager.join('guest', created.code, 'Guest');
  manager.start('host', created.code);
  const initial = events.at(-1).payload;
  assert.equal(initial.players.length, 2);
  assert.ok(initial.question.prompt);
  assert.ok(initial.deadline);

  const deadline = initial.deadline;
  assert.equal(manager.usePowerup('host', created.code, 'timeFreeze').ok, true);
  const frozen = events.at(-1).payload;
  assert.equal(frozen.deadline, deadline + 5000);
  assert.equal(frozen.players.find(player => player.id === 'host').powerups.timeFreeze, false);

  const answer = QUESTIONS.find(item => item.prompt === frozen.question.prompt).answer;
  manager.answer('host', created.code, answer);
  const scored = events.at(-1).payload;
  assert.ok(scored.players.find(player => player.id === 'host').score > 0);
  assert.equal(scored.deadline, frozen.deadline);
  assert.equal(scored.question.prompt, frozen.question.prompt);
  assert.equal(scored.players.length, 2);
  manager.close();
});
