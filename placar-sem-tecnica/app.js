/* ==========================================================
   Placar de vôlei — Sem Técnica F.C.
   Regras:
   - Quadra: melhor de 5, sets de 25, tie-break de 15, 2 tempos por set,
     troca de lado a cada set e aos 8 pontos no tie-break.
   - Praia: melhor de 3, sets de 21, tie-break de 15, 1 tempo por set,
     troca de lado a cada 7 pontos (5 no tie-break).
   - Todo set precisa de 2 pontos de vantagem.
   - Quem marca o ponto passa a sacar (rally point).
   ========================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'semtecnica-placar:v1';
  const UNDO_LIMIT = 200;
  const HOME = 0;
  const AWAY = 1;

  const PRESETS = {
    quadra: { setsToWin: 3, points: 25, tiebreak: 15, timeouts: 2 },
    praia: { setsToWin: 2, points: 21, tiebreak: 15, timeouts: 1 },
  };
  const MODE_NAMES = { quadra: 'Vôlei de quadra', praia: 'Vôlei de praia' };
  const DEFAULT_NAMES = ['Sem Técnica F.C.', 'Adversário'];
  const DEFAULT_CONFIG = {
    mode: 'quadra',
    ...PRESETS.quadra,
    timeoutSeconds: 30,
    autoSwitch: true,
    sound: true,
  };

  const BALL_SVG = `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="#f6f2e8"/>
      <path d="M24 3c-6 7-6 17 0 21 5 3 13 3 21-2" fill="#1e3a8a"/>
      <path d="M24 24c-2 7-9 13-18 13 4 5 11 8 18 8 4 0 8-1 11-3-3-8-6-14-11-18z" fill="#f7931e"/>
      <circle cx="24" cy="24" r="21" fill="none" stroke="#111" stroke-width="2.5"/>
      <path d="M24 3c-6 7-6 17 0 21M24 24c5 3 13 3 21-2M24 24c-2 7-9 13-18 13M24 24c5 4 8 10 11 18M5 16c7-1 14 2 19 8"
            fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`;

  // ---------------------------------------------------------------- estado
  let state;
  let undoStack = [];

  function freshMatch(config, names) {
    return {
      config: { ...config },
      names: names ? [...names] : [...DEFAULT_NAMES],
      score: [0, 0],
      sets: [0, 0],
      timeouts: [0, 0],
      history: [],          // [{ score: [h, a], winner }]
      serving: HOME,
      firstServer: HOME,    // quem começou sacando no set atual
      swapped: false,       // false = nosso time na esquerda
      tbSwitched: false,    // quadra: já trocou de lado no tie-break
      lastSwitchAt: 0,      // praia: total de pontos da última troca
      setOver: false,
      finished: false,
      winner: null,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.state && Array.isArray(data.state.score)) {
          state = data.state;
          state.config = { ...DEFAULT_CONFIG, ...state.config };
          undoStack = Array.isArray(data.undo) ? data.undo.slice(-UNDO_LIMIT) : [];
          return;
        }
      }
    } catch (_) { /* armazenamento indisponível ou corrompido */ }
    state = freshMatch(DEFAULT_CONFIG);
    undoStack = [];
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, undo: undoStack }));
    } catch (_) { /* modo anônimo etc. */ }
  }

  function snapshot() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }

  function commit() {
    save();
    render();
  }

  // ---------------------------------------------------------------- regras
  const other = (t) => 1 - t;
  const maxSets = () => state.config.setsToWin * 2 - 1;
  const playingSet = () => state.history.length + 1;
  const isTiebreak = () => maxSets() > 1 && playingSet() === maxSets();
  const target = () => (isTiebreak() ? state.config.tiebreak : state.config.points);
  const canPlay = () => !state.setOver && !state.finished;
  const leftTeam = () => (state.swapped ? AWAY : HOME);

  function wouldWinSet(t) {
    const s = state.score[t] + 1;
    return s >= target() && s - state.score[other(t)] >= 2;
  }

  function addPoint(t) {
    if (!canPlay()) return;
    snapshot();
    state.score[t] += 1;
    state.serving = t;

    const s = state.score[t];
    const o = state.score[other(t)];
    let ended = false;
    if (s >= target() && s - o >= 2) {
      endSet(t);
      ended = true;
    } else {
      checkSideSwitch();
    }

    commit();
    bump(t);
    feedback(ended ? 'set' : 'point');
    if (ended) showResult();
  }

  function removePoint(t) {
    if (!canPlay() || state.score[t] === 0) return;
    snapshot();
    state.score[t] -= 1;
    commit();
    feedback('minus');
  }

  function endSet(t) {
    state.sets[t] += 1;
    state.history.push({ score: [...state.score], winner: t });
    if (state.sets[t] >= state.config.setsToWin) {
      state.finished = true;
      state.winner = t;
    } else {
      state.setOver = true;
    }
  }

  function checkSideSwitch() {
    if (!state.config.autoSwitch) return;
    const [a, b] = state.score;
    const total = a + b;

    if (state.config.mode === 'praia') {
      const every = isTiebreak() ? 5 : 7;
      if (total > 0 && total % every === 0 && total > state.lastSwitchAt) {
        state.lastSwitchAt = total;
        switchSides(`Troca de lado! (${total} pontos)`);
      }
    } else if (isTiebreak() && !state.tbSwitched && Math.max(a, b) === 8) {
      state.tbSwitched = true;
      switchSides('Tie-break: troca de lado aos 8 pontos');
    }
  }

  function switchSides(message) {
    state.swapped = !state.swapped;
    toast(message);
  }

  function startNextSet() {
    if (!state.setOver) return;
    snapshot();
    state.setOver = false;
    state.score = [0, 0];
    state.timeouts = [0, 0];
    state.tbSwitched = false;
    state.lastSwitchAt = 0;
    state.firstServer = other(state.firstServer);
    state.serving = state.firstServer;
    if (state.config.autoSwitch) state.swapped = !state.swapped;
    closeDialog(dom.resultDialog);
    commit();
    toast(isTiebreak()
      ? 'Tie-break! Toque na bola para definir quem saca'
      : `${playingSet()}º set — times trocam de lado`);
  }

  function setServe(t) {
    if (!canPlay() || state.serving === t) return;
    snapshot();
    state.serving = t;
    if (state.score[0] + state.score[1] === 0) state.firstServer = t;
    commit();
  }

  function callTimeout(t) {
    if (!canPlay()) return;
    if (state.timeouts[t] >= state.config.timeouts) {
      toast('Sem tempos restantes neste set');
      return;
    }
    snapshot();
    state.timeouts[t] += 1;
    commit();
    openTimeout(t);
  }

  function undo() {
    if (!undoStack.length) {
      toast('Nada para desfazer');
      return;
    }
    state = JSON.parse(undoStack.pop());
    closeDialog(dom.resultDialog);
    commit();
    toast('Desfeito');
  }

  function swapSidesManual() {
    snapshot();
    state.swapped = !state.swapped;
    commit();
  }

  function newMatch() {
    snapshot(); // dá para desfazer se clicar sem querer
    state = freshMatch(state.config, state.names);
    closeDialog(dom.resultDialog);
    commit();
    toast('Nova partida! (Desfazer volta para a anterior)');
  }

  // ---------------------------------------------------------------- DOM
  const $ = (sel, root = document) => root.querySelector(sel);
  const dom = {
    setLabel: $('#setLabel'),
    modeLabel: $('#modeLabel'),
    setsLeft: $('#setsLeft'),
    setsRight: $('#setsRight'),
    history: $('#history'),
    btnNextSet: $('#btnNextSet'),
    btnNewCenter: $('#btnNewCenter'),
    btnUndo: $('#btnUndo'),
    btnServe: $('#btnServe'),
    btnSwap: $('#btnSwap'),
    btnNew: $('#btnNew'),
    btnSettings: $('#btnSettings'),
    btnFullscreen: $('#btnFullscreen'),
    resultDialog: $('#resultDialog'),
    resultLogo: $('#resultLogo'),
    resultTitle: $('#resultTitle'),
    resultWinner: $('#resultWinner'),
    resultScore: $('#resultScore'),
    resultPartials: $('#resultPartials'),
    resultUndo: $('#resultUndo'),
    resultShare: $('#resultShare'),
    resultNext: $('#resultNext'),
    resultNew: $('#resultNew'),
    timeoutDialog: $('#timeoutDialog'),
    timeoutTeam: $('#timeoutTeam'),
    timeoutCount: $('#timeoutCount'),
    timeoutClose: $('#timeoutClose'),
    settingsDialog: $('#settingsDialog'),
    settingsForm: $('#settingsForm'),
    settingsCancel: $('#settingsCancel'),
    toast: $('#toast'),
  };

  const panels = ['#panelLeft', '#panelRight'].map((sel) => {
    const el = $(sel);
    return {
      el,
      name: $('.team-name', el),
      serve: $('.serve', el),
      badge: $('.badge', el),
      scoreBtn: $('.score-btn', el),
      score: $('.score', el),
      minus: $('.minus', el),
      dots: $('.to-dots', el),
      toBtn: $('.timeout-btn', el),
    };
  });

  panels.forEach((p) => {
    p.serve.innerHTML = BALL_SVG;
    const team = () => Number(p.el.dataset.team);
    p.scoreBtn.addEventListener('click', () => addPoint(team()));
    p.minus.addEventListener('click', () => removePoint(team()));
    p.toBtn.addEventListener('click', () => callTimeout(team()));
    p.serve.addEventListener('click', () => setServe(team()));
  });

  // ---------------------------------------------------------------- render
  function render() {
    const order = [leftTeam(), other(leftTeam())];
    const playing = canPlay();

    panels.forEach((p, i) => {
      const t = order[i];
      p.el.dataset.team = String(t);
      p.el.classList.toggle('home', t === HOME);
      p.el.classList.toggle('away', t === AWAY);
      p.el.classList.toggle('serving', playing && state.serving === t);
      p.name.textContent = state.names[t];
      p.name.title = state.names[t];
      p.score.textContent = String(state.score[t]);
      p.scoreBtn.setAttribute('aria-label', `Adicionar ponto para ${state.names[t]}`);

      let badge = '';
      if (playing && wouldWinSet(t)) {
        badge = state.sets[t] + 1 >= state.config.setsToWin ? 'Match point' : 'Set point';
      }
      p.badge.textContent = badge || ' ';
      p.badge.classList.toggle('show', Boolean(badge));
      p.badge.classList.toggle('match', badge === 'Match point');

      p.dots.innerHTML = Array.from({ length: state.config.timeouts }, (_, k) =>
        `<span class="to-dot${k < state.timeouts[t] ? ' used' : ''}"></span>`).join('');
      p.toBtn.disabled = !playing || state.timeouts[t] >= state.config.timeouts;
      p.toBtn.parentElement.querySelector('.timeouts').hidden = state.config.timeouts === 0;
      p.toBtn.hidden = state.config.timeouts === 0;
      p.minus.disabled = !playing || state.score[t] === 0;
    });

    // sets
    dom.setsLeft.textContent = String(state.sets[order[0]]);
    dom.setsRight.textContent = String(state.sets[order[1]]);
    dom.setsLeft.className = order[0] === HOME ? 'home' : 'away';
    dom.setsRight.className = order[1] === HOME ? 'home' : 'away';

    // parciais (só números, nada de texto do usuário aqui)
    dom.history.innerHTML = state.history.map((h, idx) => {
      const cell = (t) => `<span class="${h.winner === t ? 'win ' : ''}${t === HOME ? 'home' : 'away'}">${h.score[t]}</span>`;
      return `<li>${cell(order[0])}<span class="n">${idx + 1}º</span>${cell(order[1])}</li>`;
    }).join('');

    // títulos
    const n = state.history.length;
    if (state.finished) dom.setLabel.textContent = 'Fim de jogo';
    else if (state.setOver) dom.setLabel.textContent = `Fim do ${n}º set`;
    else if (isTiebreak()) dom.setLabel.textContent = `Tie-break · ${playingSet()}º set`;
    else dom.setLabel.textContent = `${playingSet()}º set`;

    const bestOf = maxSets();
    dom.modeLabel.textContent = `${MODE_NAMES[state.config.mode] || 'Vôlei'} · ${bestOf === 1 ? 'set único' : `melhor de ${bestOf}`} · ${target()} pts`;

    dom.btnNextSet.hidden = !state.setOver;
    dom.btnNewCenter.hidden = !state.finished;
    dom.btnUndo.disabled = undoStack.length === 0;
    dom.btnServe.disabled = !playing;

    document.title = `${state.score[HOME]} × ${state.score[AWAY]} · ${state.names[HOME]}`;
  }

  function bump(t) {
    const p = panels.find((x) => Number(x.el.dataset.team) === t);
    if (!p) return;
    p.score.classList.remove('bump');
    void p.score.offsetWidth; // reinicia a animação
    p.score.classList.add('bump');
  }

  // ---------------------------------------------------------------- resultado
  function showResult() {
    const last = state.history[state.history.length - 1];
    if (!last) return;
    const isMatch = state.finished;
    const t = isMatch ? state.winner : last.winner;
    const weWon = t === HOME;

    dom.resultLogo.hidden = !weWon;
    if (isMatch) {
      dom.resultTitle.textContent = weWon ? 'Vitória do Sem Técnica!' : 'Fim de jogo';
      dom.resultWinner.textContent = `${state.names[t]} vence por ${state.sets[t]} × ${state.sets[other(t)]}`;
    } else {
      dom.resultTitle.textContent = `Fim do ${state.history.length}º set`;
      dom.resultWinner.textContent = `${state.names[t]} venceu o set`;
    }
    dom.resultScore.textContent = `${state.sets[HOME]} × ${state.sets[AWAY]}`;

    dom.resultPartials.replaceChildren(...state.history.map((h, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1}º: ${h.score[HOME]}-${h.score[AWAY]}`;
      return li;
    }));

    dom.resultNext.hidden = isMatch;
    dom.resultNew.hidden = !isMatch;
    dom.resultShare.hidden = !isMatch;

    if (!dom.resultDialog.open) dom.resultDialog.showModal();
    (isMatch ? dom.resultNew : dom.resultNext).focus();
    if (isMatch && weWon) confetti(dom.resultDialog);
  }

  function resultText() {
    const partials = state.history.map((h) => `${h.score[HOME]}-${h.score[AWAY]}`).join(', ');
    return `🏐 ${state.names[HOME]} ${state.sets[HOME]} × ${state.sets[AWAY]} ${state.names[AWAY]}\nParciais: ${partials}`;
  }

  async function shareResult() {
    const text = resultText();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Resultado', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast('Resultado copiado!');
    } catch (err) {
      if (err && err.name !== 'AbortError') toast('Não foi possível compartilhar');
    }
  }

  // ---------------------------------------------------------------- tempo
  let timeoutTimer = null;
  function openTimeout(t) {
    clearInterval(timeoutTimer);
    let left = state.config.timeoutSeconds;
    dom.timeoutTeam.textContent = state.names[t];
    dom.timeoutCount.textContent = String(left);
    dom.timeoutCount.classList.remove('done');
    if (!dom.timeoutDialog.open) dom.timeoutDialog.showModal();
    timeoutTimer = setInterval(() => {
      left -= 1;
      dom.timeoutCount.textContent = String(Math.max(left, 0));
      if (left <= 0) {
        clearInterval(timeoutTimer);
        dom.timeoutCount.classList.add('done');
        feedback('whistle');
      }
    }, 1000);
  }
  function closeTimeout() {
    clearInterval(timeoutTimer);
    closeDialog(dom.timeoutDialog);
  }

  // ---------------------------------------------------------------- configurações
  function openSettings() {
    const f = dom.settingsForm.elements;
    const c = state.config;
    f.home.value = state.names[HOME];
    f.away.value = state.names[AWAY];
    f.mode.value = c.mode;
    f.bestOf.value = String(c.setsToWin * 2 - 1);
    f.points.value = c.points;
    f.tiebreak.value = c.tiebreak;
    f.timeouts.value = c.timeouts;
    f.timeoutSeconds.value = c.timeoutSeconds;
    f.autoSwitch.checked = c.autoSwitch;
    f.sound.checked = c.sound;
    dom.settingsDialog.showModal();
  }

  dom.settingsForm.elements.mode.addEventListener('change', (e) => {
    const p = PRESETS[e.target.value];
    const f = dom.settingsForm.elements;
    f.bestOf.value = String(p.setsToWin * 2 - 1);
    f.points.value = p.points;
    f.tiebreak.value = p.tiebreak;
    f.timeouts.value = p.timeouts;
  });

  const clampInt = (v, min, max, fallback) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  dom.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = dom.settingsForm.elements;
    const c = state.config;
    snapshot();
    state.names = [
      f.home.value.trim().slice(0, 30) || DEFAULT_NAMES[HOME],
      f.away.value.trim().slice(0, 30) || DEFAULT_NAMES[AWAY],
    ];
    state.config = {
      mode: f.mode.value === 'praia' ? 'praia' : 'quadra',
      setsToWin: (clampInt(f.bestOf.value, 1, 5, 5) + 1) / 2,
      points: clampInt(f.points.value, 1, 99, c.points),
      tiebreak: clampInt(f.tiebreak.value, 1, 99, c.tiebreak),
      timeouts: clampInt(f.timeouts.value, 0, 5, c.timeouts),
      timeoutSeconds: clampInt(f.timeoutSeconds.value, 5, 300, c.timeoutSeconds),
      autoSwitch: f.autoSwitch.checked,
      sound: f.sound.checked,
    };
    state.timeouts = state.timeouts.map((x) => Math.min(x, state.config.timeouts));
    closeDialog(dom.settingsDialog);
    commit();
    toast('Configurações salvas');
  });

  dom.settingsCancel.addEventListener('click', () => closeDialog(dom.settingsDialog));

  // ---------------------------------------------------------------- utilidades
  function closeDialog(d) {
    if (d && d.open) d.close();
  }

  let toastTimer = null;
  function toast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2600);
  }

  let audioCtx = null;
  function beep(freq, ms, type = 'sine', gain = 0.08) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
      osc.connect(g).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + ms / 1000);
    } catch (_) { /* sem áudio */ }
  }

  function feedback(kind) {
    if (!state.config.sound) return;
    const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} };
    switch (kind) {
      case 'point': beep(880, 120); vibrate(25); break;
      case 'minus': beep(330, 120); vibrate(15); break;
      case 'set': beep(660, 160); setTimeout(() => beep(990, 260), 170); vibrate([60, 40, 120]); break;
      case 'whistle': beep(2600, 500, 'square', 0.04); vibrate([200, 80, 200]); break;
      default: break;
    }
  }

  function confetti(host) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    (host && host.open ? host : document.body).append(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    const colors = ['#f2b33d', '#f7931e', '#3e66e0', '#f6f2e8'];
    const parts = Array.from({ length: 170 }, () => ({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * 0.6,
      w: (6 + Math.random() * 6) * dpr,
      h: (10 + Math.random() * 8) * dpr,
      vx: (Math.random() - 0.5) * 3 * dpr,
      vy: (2 + Math.random() * 4) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const end = performance.now() + 4500;
    (function frame(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (now < end) requestAnimationFrame(frame);
      else canvas.remove();
    })(performance.now());
  }

  function toggleFullscreen() {
    const d = document;
    if (!d.fullscreenElement) {
      (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen)?.call(d.documentElement)
        ?.catch?.(() => {});
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
    }
  }

  // Mantém a tela do celular ligada durante o jogo
  let wakeLock = null;
  async function keepAwake() {
    if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (_) { /* sem permissão */ }
  }
  document.addEventListener('pointerdown', keepAwake);
  document.addEventListener('visibilitychange', keepAwake);

  // ---------------------------------------------------------------- eventos
  dom.btnUndo.addEventListener('click', undo);
  dom.btnServe.addEventListener('click', () => setServe(other(state.serving)));
  dom.btnSwap.addEventListener('click', swapSidesManual);
  dom.btnNew.addEventListener('click', newMatch);
  dom.btnNewCenter.addEventListener('click', newMatch);
  dom.btnNextSet.addEventListener('click', startNextSet);
  dom.btnSettings.addEventListener('click', openSettings);
  dom.btnFullscreen.addEventListener('click', toggleFullscreen);
  dom.resultUndo.addEventListener('click', undo);
  dom.resultNext.addEventListener('click', startNextSet);
  dom.resultNew.addEventListener('click', newMatch);
  dom.resultShare.addEventListener('click', shareResult);
  dom.timeoutClose.addEventListener('click', closeTimeout);
  dom.timeoutDialog.addEventListener('close', () => clearInterval(timeoutTimer));

  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (dom.settingsDialog.open || dom.timeoutDialog.open) return;
    const k = e.key.toLowerCase();

    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;

    const left = leftTeam();
    const right = other(left);
    switch (k) {
      case 'a': case 'arrowleft': addPoint(left); break;
      case 'l': case 'arrowright': addPoint(right); break;
      case 'z': removePoint(left); break;
      case 'm': removePoint(right); break;
      case 'u': case 'backspace': undo(); break;
      case 's': swapSidesManual(); break;
      case 'n': startNextSet(); break;
      case 'f': toggleFullscreen(); break;
      default: return;
    }
    e.preventDefault();
  });

  // ---------------------------------------------------------------- início
  load();
  render();
  if (state.setOver || state.finished) dom.btnNextSet.focus?.();
})();
