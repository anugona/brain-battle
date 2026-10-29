import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io({ autoConnect: false, reconnection: true });
const CATEGORIES = ['General Knowledge', 'Science', 'Technology', 'Sports', 'Movies', 'Logical Reasoning'];
const LETTERS = ['A', 'B', 'C', 'D'];
const POWERUP_LABELS = { fiftyFifty: '50/50', doublePoints: 'Double Points', timeFreeze: 'Time Freeze' };

function App() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState(new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(sessionStorage.getItem('brainBattlePlayerId'));
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [copied, setCopied] = useState(false);
  const [eliminatedChoices, setEliminatedChoices] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    socket.connect();
    const update = snapshot => { setRoom(previous => { if (previous?.questionIndex !== snapshot.questionIndex) setEliminatedChoices([]); return snapshot; }); setRoomCode(snapshot.code); setServerOffset((snapshot.serverNow ?? Date.now()) - Date.now()); };
    const powerup = result => { if (result.type === 'fiftyFifty') setEliminatedChoices(result.removedChoices ?? []); };
    socket.on('room:update', update);
    socket.on('player:powerup', powerup);
    socket.on('connect', () => {
      const savedCode = sessionStorage.getItem('brainBattleRoomCode');
      const savedId = sessionStorage.getItem('brainBattlePlayerId');
      if (savedCode && savedId && !room) socket.emit('room:rejoin', { code: savedCode, playerId: savedId }, response => {
        if (response?.ok) { setRoom(response.snapshot); setServerOffset((response.snapshot.serverNow ?? Date.now()) - Date.now()); setPlayerId(socket.id); sessionStorage.setItem('brainBattlePlayerId', socket.id); }
      });
    });
    socket.on('connect_error', () => setError('Could not connect to the game server. Please refresh in a moment.'));
    return () => { clearInterval(timer); socket.off('room:update', update); socket.off('player:powerup', powerup); socket.disconnect(); };
  }, []);

  const self = room?.players.find(p => p.id === socket.id || p.id === playerId);
  const isHost = room?.hostId === socket.id || room?.hostId === playerId;
  const serverNow = now + serverOffset;
  const secondsLeft = room?.deadline ? Math.max(0, Math.ceil((room.deadline - serverNow) / 1000)) : 0;
  const progress = room?.deadline ? Math.max(0, Math.min(100, (room.deadline - serverNow) / ((room.question?.durationMs ?? 15_000) + (room.freezeUsedMs ?? 0)) * 100)) : 0;

  const joinOrCreate = useCallback((mode) => {
    setError(''); setConnecting(true);
    socket.emit(mode === 'create' ? 'room:create' : 'room:join', mode === 'create' ? { name } : { name, code: roomCode }, response => {
      setConnecting(false);
      if (!response?.ok) { setError(response?.error ?? 'Something went wrong.'); return; }
      setRoom(response.snapshot); setRoomCode(response.code); setServerOffset((response.snapshot.serverNow ?? Date.now()) - Date.now()); setPlayerId(socket.id);
      sessionStorage.setItem('brainBattlePlayerId', socket.id); sessionStorage.setItem('brainBattleRoomCode', response.code);
      history.replaceState(null, '', `?room=${response.code}`);
    });
  }, [name, roomCode]);

  function sendAnswer(choice) {
    if (!self?.canAnswer || room?.phase !== 'question') return;
    socket.emit('game:answer', { code: room.code, choice }, response => { if (response?.error) setError(response.error); });
  }

  function configureCategories(categories) {
    socket.emit('game:configure', { code: room.code, categories }, response => {
      if (!response?.ok) setError('Choose at least one valid category before the game starts.');
    });
  }

  function usePowerup(type) {
    setError('');
    socket.emit('game:powerup', { code: room.code, type }, response => { if (!response?.ok) setError(response?.error ?? 'That power-up could not be used.'); });
  }

  async function copyInvite() {
    const url = `${location.origin}${location.pathname}?room=${room?.code}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setError(`Share this room code: ${room?.code}`); }
  }

  const ranked = (players) => [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return <main className="page-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">✦</span><span>BRAIN<span className="brand-accent">BATTLE</span></span></a><div className="top-note"><span className="live-dot" /> LIVE QUIZ ARENA</div></header>
    <section className="arena">
      {!room ? <div className="home-grid">
        <div className="hero-copy"><div className="eyebrow"><span>✦</span> THE ULTIMATE QUIZ ARENA</div><h1>Big brains.<br /><span>Brighter</span> battles.</h1><p className="hero-subtitle">Gather your crew, pick your answers, and race to the top. Your next favorite game night starts here.</p>
          <div className="category-preview">{CATEGORIES.map((category, i) => <span className={`category-chip chip-${i}`} key={category}>{category}</span>)}</div>
          <div className="social-proof"><div className="avatar-stack"><i>🧑🏽</i><i>👩🏻</i><i>🧑🏼</i><i>👩🏾</i></div><span>One room. Everyone plays.</span></div>
        </div>
        <div className="join-card"><div className="card-topline"><span className="card-icon">⚡</span><span className="tiny-label">QUICK PLAY</span></div><h2>Jump into<br />the arena</h2><p className="muted">No accounts. No downloads. Just game on.</p>
          <label className="field-label" htmlFor="player-name">YOUR PLAYER NAME</label><input id="player-name" className="text-field" maxLength="18" placeholder="e.g. Quiz Wizard" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && roomCode && joinOrCreate('join')} />
          <label className="field-label" htmlFor="room-code">ROOM CODE <span>· HAVE A CODE?</span></label><input id="room-code" className="text-field code-field" maxLength="5" placeholder="ENTER CODE" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={e => e.key === 'Enter' && joinOrCreate('join')} />
          {error && <div className="error-message">{error}</div>}
          <button className="button button-primary full-width" onClick={() => joinOrCreate('create')} disabled={!name.trim() || connecting}>{connecting ? 'Connecting…' : '✦  Create a room'}<span>→</span></button>
          <button className="button button-secondary full-width" onClick={() => joinOrCreate('join')} disabled={!name.trim() || roomCode.length < 4 || connecting}>Join a room <span>↗</span></button>
          <div className="privacy-note"><span>🔒</span> Your name is only used in this game</div>
        </div>
      </div> : <>
        <div className="game-topline"><div><div className="eyebrow"><span>✦</span> BRAIN BATTLE ARENA</div><div className="room-tag">ROOM <strong>{room.code}</strong> <span className="live-pill"><i /> LIVE</span></div></div><button className="button button-secondary invite-button" onClick={copyInvite}>{copied ? '✓ Link copied' : '↗ Invite players'}</button></div>
        {error && <div className="error-message game-error">{error}</div>}
        {room.phase === 'lobby' && <div className="lobby-layout"><div className="lobby-main"><div className="round-label">✦  READY ROOM</div><h1>Bring on the<br /><span>brain power.</span></h1><p className="muted lobby-description">Share your room code and get your crew together. Pick your topics, then start the battle.</p><div className="room-code-card"><span>YOUR ROOM CODE</span><strong>{room.code}</strong><button onClick={copyInvite}>{copied ? 'COPIED ✓' : 'COPY INVITE LINK ↗'}</button></div><div className="category-picker"><div className="picker-heading"><span>QUIZ CATEGORIES</span><small>{room.selectedCategories.length} SELECTED · 10 QUESTIONS PER TOPIC</small></div><div className="category-options">{CATEGORIES.map(category => <button key={category} disabled={!isHost} className={`category-toggle ${room.selectedCategories.includes(category) ? 'selected' : ''}`} onClick={() => configureCategories(room.selectedCategories.includes(category) ? room.selectedCategories.filter(item => item !== category) : [...room.selectedCategories, category])}><span>{room.selectedCategories.includes(category) ? '✓' : '+'}</span>{category}</button>)}</div></div>{isHost ? <button className="button button-primary start-button" onClick={() => socket.emit('game:start', { code: room.code })}>Start {room.selectedCategories.length === 1 ? 10 : 12}-question battle <span>→</span></button> : <div className="waiting-state"><span className="waiting-spinner" /> Waiting for the host to start…</div>}</div><PlayerPanel players={room.players} hostId={room.hostId} /></div>}
        {(room.phase === 'question' || room.phase === 'reveal') && <div className="quiz-layout"><div className="quiz-main"><div className={`round-banner ${room.question?.roundType}`}><span>{room.question?.roundType === 'speed' ? '⚡ SPEED ROUND' : room.question?.roundType === 'bonus' ? '✦ BONUS ROUND · 2× POINTS' : `ROUND ${room.roundNumber} / ${room.totalQuestions}`}</span><span className="category-label">{room.question?.category}</span><span className={`timer-badge ${secondsLeft <= 5 ? 'urgent' : ''}`}>◷ <strong>{room.phase === 'reveal' ? '0:00' : `0:${String(secondsLeft).padStart(2, '0')}`}</strong></span></div><div className={`timer-track ${room.freezeUsedMs ? 'frozen-track' : ''}`}><span style={{ width: `${room.phase === 'reveal' ? 0 : progress}%` }} /></div>{room.phase === 'question' ? <><h1 className="question-title">{room.question?.prompt}</h1><div className="answer-grid">{room.question?.choices.map((choice, index) => <button key={choice} disabled={!self?.canAnswer || eliminatedChoices.includes(index)} onClick={() => sendAnswer(index)} className={`answer-option ${self?.answered ? 'locked' : ''} ${eliminatedChoices.includes(index) ? 'eliminated' : ''}`}><span className="answer-letter">{LETTERS[index]}</span><span>{choice}</span><span className="answer-arrow">↗</span></button>)}</div><div className="answer-status">{self?.answered ? <><span className="status-check">✓</span> Answer locked in — good luck!</> : !self?.eligible ? <><span className="status-pulse" /> You joined mid-round; your first question starts next round.</> : <><span className="status-pulse" /> Pick your answer before time runs out</>}</div><div className="powerup-bar"><span className="powerup-caption">POWER-UPS</span>{Object.entries(POWERUP_LABELS).map(([type, label]) => <button key={type} className={`powerup-button ${self?.powerups?.[type] ? '' : 'used'} ${type === 'doublePoints' && self?.powerups?.doubleArmed ? 'armed' : ''}`} disabled={!self?.canAnswer || !self?.powerups?.[type]} onClick={() => usePowerup(type)}><span>{type === 'fiftyFifty' ? '½' : type === 'doublePoints' ? '×2' : '❄'}</span>{type === 'doublePoints' && self?.powerups?.doubleArmed ? 'DOUBLE ARMED' : label}</button>)}</div></> : <div className="reveal-card"><div className="reveal-icon">✦</div><div className="round-label">ANSWER REVEALED</div><h2>The correct answer was<br /><span>{LETTERS[room.results?.correctAnswer]} · {room.question?.choices[room.results?.correctAnswer]}</span></h2><p className="muted">{room.results?.correctCount} {room.results?.correctCount === 1 ? 'player got' : 'players got'} it right</p></div>}</div><aside className="scoreboard"><PlayerPanel players={room.players} hostId={room.hostId} compact phase={room.phase} /><div className="scoreboard-foot">SCORES UPDATE LIVE <span>✦</span></div></aside></div>}
        {room.phase === 'results' && <div className="results-layout"><div className="confetti-field" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div><div className="results-heading"><div className="trophy">🏆</div><div className="eyebrow"><span>✦</span> GAME COMPLETE</div><h1>What a <span>battle.</span></h1><p className="muted">The arena has spoken. Here’s how your crew stacked up.</p></div><div className="winner-callout"><span>👑</span><div><small>ARENA CHAMPION</small><strong>{ranked(room.results ?? room.players)[0]?.name ?? '—'}</strong></div><b>✦</b></div><div className="final-board">{ranked(room.results ?? room.players).map((player, index) => <div className={`final-row ${index === 0 ? 'first-place' : ''}`} key={player.id}><span className="rank-number">{['01', '02', '03'][index] ?? String(index + 1).padStart(2, '0')}</span><span className="rank-medal">{['👑', '🥈', '🥉'][index] ?? '✦'}</span><span className="rank-name">{player.name}{player.id === room.hostId && <span className="host-badge">HOST</span>}</span><strong className="rank-score">{player.score}<small> PTS</small></strong></div>)}</div>{isHost ? <button className="button button-primary start-button replay-button" onClick={() => socket.emit('game:replay', { code: room.code })}>↻  Play again</button> : <div className="waiting-state"><span className="waiting-spinner" /> Waiting for the host to play again…</div>}</div>}
      </>}
    </section>
    <footer className="footer"><span>© 2026 BRAIN BATTLE ARENA</span><span>BUILT FOR THE LOVE OF A LITTLE FRIENDLY COMPETITION <b>✦</b></span></footer>
  </main>;
}

function PlayerPanel({ players, hostId, compact = false, phase }) {
  const list = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return <aside className={`player-panel ${compact ? 'compact-panel' : ''}`}><div className="panel-heading"><div><div className="round-label">✦  THE CREW</div><h3>Players <span>{players.length}/8</span></h3></div><div className="online-indicator"><i /> {players.filter(p => p.connected).length} ONLINE</div></div><div className="player-list">{list.map((player, index) => <div className="player-row" key={player.id}><span className={`player-rank ${index === 0 && player.score > 0 ? 'leader-rank' : ''}`}>{String(index + 1).padStart(2, '0')}</span><span className={`player-avatar avatar-${index % 4}`}>{player.name.trim()[0]?.toUpperCase()}</span><span className="player-name">{player.name}<small>{player.id === hostId ? 'HOST' : !player.connected ? 'RECONNECTING…' : phase === 'question' && !player.eligible ? 'NEXT ROUND' : player.answered ? 'ANSWERED ✓' : 'READY'}</small></span><span className="player-score">{player.score}<small> PTS</small></span></div>)}</div>{players.length === 0 && <p className="muted">Waiting for players…</p>}</aside>;
}

export default App;
