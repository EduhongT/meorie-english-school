/* 머리에 그리는 영어 연습실 — 화면 전환·자료 읽기·음성
   자료는 장면을 열 때 그 장면 것만 받아 온다. 한꺼번에 받지 않는다. */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c;
                          if (x != null) n.textContent = x; return n; };
const MAIN = $('#main'), TTL = $('#ttl'), BACK = $('#back');

/* ── 기억해 두는 것 (이 기계 안에만 남는다) ───────────────── */
const KEY = 'yeonseupsil.v1';
let mem = { seen: {}, quiz: {}, said: {}, artw: {}, made: {}, f: 1 };
try { Object.assign(mem, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
if (!mem.artw) mem.artw = {};
if (!mem.made) mem.made = {};          /* 앞서 쓰시던 분의 기록에는 없던 칸 */
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} };
const today = () => new Date().toISOString().slice(0, 10);

/* ── 글씨 크기 ──────────────────────────────────────────── */
const STEPS = [1, 1.15, 1.32];
function applyF() { document.documentElement.style.setProperty('--f', mem.f); }
applyF();
$('#bigger').onclick = () => {
  mem.f = STEPS[(STEPS.indexOf(mem.f) + 1) % STEPS.length] || 1; applyF(); save();
};

/* ── 자료 ───────────────────────────────────────────────── */
const SRC0 = p => p;
const cache = new Map();
async function get(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path).then(r => { if (!r.ok) throw new Error(path); return r.json(); });
  cache.set(path, p);
  return p.catch(e => { cache.delete(path); throw e; });
}
let INDEX = null, AUDIO = null;

/* ── 앱이 스스로 내는 소리 (미술관) ─────────────────────── */
/* 미술관 감상 문장 1,000개는 미리 만든 mp3 를 두지 않고
   기계에 들어 있는 영어 목소리로 그 자리에서 읽습니다.
   그래서 파일 1,000개를 만들지도, 올리지도, 내려받게 하지도 않습니다. */
const SPEAK = 'speechSynthesis' in window;
/* ── 목소리 고르기 ─────────────────────────────────────────
   대화문은 역할이 61가지다. 딸·손녀·며느리는 여성이고 할아버지·아들·손자는
   남성이다. 자리(나/상대)로만 가르면 딸이 남자 목소리로 나온다.
   그래서 역할 이름을 보고 고른다. 성별이 없는 역할(점원·이웃·안내원…)은
   할머니와 구별만 되면 되므로 둘째 목소리를 쓴다. */
const 여성역 = /할머니|할머님|어머니|엄마|딸|손녀|며느리|아내|아주머니|여자|이모|고모|언니|누나|아가씨|여성/;
const 남성역 = /할아버지|할아버님|아버지|아빠|아들|손자|사위|남편|아저씨|남자|삼촌|형님|오빠|남성/;
/* 「Google UK English Female」은 male 을 품고 있다 — 여성을 먼저 본다 */
const 여성목 = /female|woman|samantha|zira|aria|jenny|karen|moira|tessa|fiona|victoria|allison|ava|susan|serena|nicky|hazel|catherine|heather|sonia|libby|michelle/i;
const 남성목 = /male|man\b|alex|daniel|david|fred|tom\b|guy|aaron|arthur|oliver|ryan|mark|george|james|rishi|gordon|reed/i;
const 여자목소린가 = v => 여성목.test(v.name);
const 남자목소린가 = v => !여성목.test(v.name) && 남성목.test(v.name);

let voices = [], voice = null, voice2 = null, 여자들 = [], 남자들 = [];
function pickVoice() {
  voices = speechSynthesis.getVoices() || [];
  const en = voices.filter(v => /^en/i.test(v.lang));
  const 미국먼저 = a => (/^en-US/i.test(a.lang) ? 0 : 1);
  여자들 = en.filter(여자목소린가).sort((a, b) => 미국먼저(a) - 미국먼저(b));
  남자들 = en.filter(남자목소린가).sort((a, b) => 미국먼저(a) - 미국먼저(b));
  voice = 여자들[0] || en.find(v => /^en-US/i.test(v.lang)) || en[0] || null;   /* 할머니 */
  voice2 = 남자들[0] || en.find(v => v !== voice) || voice;                      /* 상대 기본 */
}
if (SPEAK) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

/* 역할 이름으로 목소리와 높낮이를 고른다 */
function 목소리고르기(who, role) {
  if (who !== 'other') return { v: voice, pitch: 1 };          /* 할머니 */
  const r = role || '';
  if (여성역.test(r)) {
    const 딴여자 = 여자들.find(v => v !== voice);
    /* 여자 목소리가 하나뿐이면 할머니보다 조금 높게 읽어 가른다 */
    return 딴여자 ? { v: 딴여자, pitch: 1 } : { v: voice, pitch: 1.18 };
  }
  if (남성역.test(r)) return { v: 남자들[0] || voice2, pitch: 남자들[0] ? 1 : 0.7 };
  return { v: voice2, pitch: voice2 === voice ? 0.7 : 1 };     /* 성별이 없는 역할 */
}

function speak(text, btn, who, role) {
  if (!SPEAK) return;
  speechSynthesis.cancel();
  if (!voice && !voices.length) pickVoice();
  const { v, pitch } = 목소리고르기(who, role);
  const u = new SpeechSynthesisUtterance(text);
  if (v) u.voice = v;
  u.lang = (v && v.lang) || 'en-US';
  u.rate = 0.85;                       /* 시니어가 따라 말할 수 있게 조금 천천히 */
  if (pitch !== 1) u.pitch = pitch;
  if (btn) { btn.classList.add('on');
             u.onend = u.onerror = () => btn.classList.remove('on'); }
  speechSynthesis.speak(u);
}
function speakBtn(text, who, role) {
  if (!SPEAK) return null;
  const b = el('button', 'ico hear', '🔊');
  b.setAttribute('aria-label', '들어 보기');
  b.title = '들어 보기';
  b.onclick = e => { e.stopPropagation(); speak(text, b, who, role); };
  return b;
}
window.addEventListener('hashchange', () => { if (SPEAK) speechSynthesis.cancel(); });

/* ── 발음 줄 ────────────────────────────────────────────────
   발음기호와 한글 발음을 나란히 내고, 힘주어 읽는 자리를 색으로 짚는다.
   두 곳이 같은 소리를 가리킨다 — 발음기호의 ir, 한글의 hs. */
function pronLine(w, always) {
  if (!w || (!w.ipa && !w.han)) return null;
  const p = el('div', 'pron');
  const mark = (text, from, to, cls) => {
    const s = el('span', cls);
    if (from == null) { s.textContent = text; return s; }
    s.append(document.createTextNode(text.slice(0, from)),
             el('b', 'hit', text.slice(from, to)),
             document.createTextNode(text.slice(to)));
    return s;
  };
  if (w.ipa) { const r = w.ir;
    p.append(mark('[' + w.ipa + ']', r ? r[0] + 1 : null, r ? r[1] + 1 : null, 'ipa')); }
  /* 뜻과 한글 발음이 같은 말(스케치북·실루엣)은 낱말 화면에서는 한 번만 낸다.
     미술 낱말 목록에서는 always 로 불러 힘주는 자리를 늘 보이게 한다. */
  if (w.han && (always || w.han !== w.ko))
    p.append(mark(w.han, w.hs, w.hs == null ? null : w.hs + 1, 'han'));
  return p;
}

/* ── 음성 ───────────────────────────────────────────────
   미리 만든 mp3 가 있으면 그것을 먼저 쓴다 (audio/ 에 넣고 data/audio.json 이 알려 준다).
   없으면 기계에 든 영어 목소리로 그 자리에서 읽는다 — 그래서 음성 파일이 없어도
   모든 문장에 🔊 가 나온다. mp3 를 나중에 넣으면 그 문장만 mp3 로 바뀐다.
   (2026-09-21 기획자 확정: 음성 10,000개를 따로 만들지 않는다) */
const has = k => AUDIO && AUDIO[k];
let player = null;
function play(src, btn) {
  if (player) { player.pause(); player = null; }
  const a = new Audio(src); player = a;
  if (btn) { btn.classList.add('on');
             a.onended = a.onerror = () => btn.classList.remove('on'); }
  a.play().catch(() => { if (btn) btn.classList.remove('on'); });
}
function playBtn(key, src, text, who, role) {
  if (!has(key)) return text ? speakBtn(text, who, role) : null;   /* mp3 가 없으면 앱이 읽는다 */
  const b = el('button', 'ico hear', '🔊');
  b.setAttribute('aria-label', '들어 보기');
  b.title = '들어 보기';
  b.onclick = e => { e.stopPropagation(); play(src, b); };
  return b;
}

/* ── 마이크에 대고 따라 말하기 ─────────────────────────────
   점수를 매기지 않는다. 앱이 들은 말을 그대로 적어 줄 뿐이다.
   한국인 시니어의 영어를 기계가 못 알아듣는 일은 흔하고,
   그때 「틀렸습니다」가 뜨면 앱을 닫게 된다. 그래서 채점하지 않는다.
   한 번 누르면 그만둘 때까지 계속 듣는다 — 같은 문장을 몇 번이고 따라 말한다.
   (2026-09-18 기획자 확정: 「문장을 계속 따라 말해 보는 것」) */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let mic = null;                                   /* 한 번에 하나만 듣는다 */

function stopMic() { if (mic) { mic.onend = null; try { mic.stop(); } catch (e) {} mic = null; } }
window.addEventListener('hashchange', stopMic);

const norm = s => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
function closeEnough(heard, target) {
  const a = norm(heard), b = norm(target);
  if (!b.length) return false;
  const bag = a.slice();
  let hit = 0;
  for (const w of b) { const i = bag.indexOf(w); if (i >= 0) { bag.splice(i, 1); hit++; } }
  return hit / b.length >= 0.7;
}

function micPanel(target, wide) {
  if (!SR) return null;
  const wrap = el('div', 'mic' + (wide ? ' wide' : ''));
  const btn = wide ? el('button', 'play mic-go', '🎤 따라 말하기')
                   : el('button', 'ico mic-go', '🎤');
  btn.setAttribute('aria-label', '따라 말하기'); btn.title = '따라 말하기';
  const state = el('div', 'mic-state');
  const heard = el('div', 'mic-heard');
  const count = el('div', 'mic-count');
  const stop = el('button', 'play mic-stop', '그만하기');   /* 이것은 글자가 있어야 안다 */
  stop.hidden = true; state.hidden = true; heard.hidden = true; count.hidden = true;
  wrap.append(btn, state, heard, count, stop);

  let n = 0;
  const end = (msg) => {
    stopMic(); btn.hidden = false; stop.hidden = true;
    state.textContent = msg || (n ? `${n}번 말해 보셨어요. 잘하셨습니다.` : '');
    state.hidden = !state.textContent;
  };

  btn.onclick = () => {
    stopMic();
    const r = new SR();
    r.lang = 'en-US'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    mic = r;
    btn.hidden = true; stop.hidden = false;
    state.hidden = false; state.textContent = '듣고 있어요. 문장을 소리 내어 말해 보세요.';
    heard.hidden = true; count.hidden = n === 0;

    r.onresult = e => {
      let txt = '', final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      txt = txt.trim();
      if (!txt) return;
      heard.hidden = false;
      heard.innerHTML = '';
      heard.append(el('span', 'lab', '이렇게 들렸어요'), el('span', 'txt', txt));
      if (final) {
        n++;
        const ok = closeEnough(txt, target);
        heard.classList.toggle('ok', ok);
        if (ok) heard.append(el('span', 'ok', '✓ 잘 들렸어요'));
        count.hidden = false; count.textContent = `${n}번 말했어요`;
        const d = today(); mem.said[d] = (mem.said[d] || 0) + 1; save();
      }
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        end('마이크를 쓸 수 없어요. 브라우저에서 마이크를 허락해 주세요.');
      else if (e.error === 'network') end('인터넷이 있어야 들을 수 있어요.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') end('지금은 잘 들리지 않아요.');
    };
    /* 기계에 따라 말이 끊기면 저절로 멈춘다 — 그만두기 전까지 다시 켠다.
       다만 곧바로 자꾸 끊기면 그만둔다. 휴대전화가 헛돌지 않게 한다. */
    let last = 0, quick = 0;
    r.onend = () => {
      if (mic !== r) return;
      const now = Date.now();
      quick = (now - last < 700) ? quick + 1 : 0;
      last = now;
      if (quick >= 4) return end('마이크가 자꾸 끊겨요. 잠시 뒤에 다시 해 보세요.');
      try { r.start(); } catch (e) { end(); }
    };
    try { r.start(); } catch (e) { end('지금은 마이크를 쓸 수 없어요.'); }
  };
  stop.onclick = () => end();
  return wrap;
}

/* 말하기 단추 — 마이크가 되면 따라 말하기, 안 되면 손으로 세는 단추 */
function speakPractice(target, wide) {
  const p = micPanel(target, wide);
  if (p) return p;
  const said = el('button', 'play', '말했어요 ✓');
  said.onclick = () => { const d = today(); mem.said[d] = (mem.said[d] || 0) + 1; save();
                         said.textContent = '잘하셨어요'; said.disabled = true; };
  return said;
}

/* 아이콘이 무엇인지 한 줄로 알려 준다 — 화면마다 한 번만 */
function legend(hear, mic) {
  const d = el('div', 'legend');
  if (hear) d.append(el('span', '', '🔊 들어 보기'));
  if (mic && SR) d.append(el('span', '', '🎤 따라 말하기'));
  return d.children.length ? d : null;      /* 낼 것이 없으면 줄도 만들지 않는다 */
}
const addLegend = (m, hear, mic) => { const l = legend(hear, mic); if (l) m.append(l); };

/* ── 화면 그리기 도우미 ─────────────────────────────────── */
function screen(title, back) {
  MAIN.innerHTML = ''; TTL.textContent = title;
  BACK.hidden = !back; BACK.onclick = () => { location.hash = back; };
  MAIN.scrollTop = 0; window.scrollTo(0, 0);
  return MAIN;
}
function item(onclick) { const b = el('button', 'item'); b.onclick = onclick; return b; }
function tx(t, s) { const d = el('div', 'tx'); d.append(el('b', '', t)); if (s) d.append(el('small', '', s)); return d; }

/* ── 홈·배우기: 구역 목록 ───────────────────────────────── */
async function viewLearn() {
  const m = screen('그림으로 배우기', null);
  const ix = INDEX;
  const seen = Object.keys(mem.seen).length;
  const h = el('div', 'hero');
  h.append(el('h2', '', seen ? '오늘도 한 장면씩' : '여기서 시작합니다'));
  /* 처음 오신 분에게는 이 앱이 무엇인지 한 줄로 먼저 말씀드린다 */
  if (!seen) h.append(el('p', 'oneline',
    '그림으로 기억하고, 색깔로 문장을 발견하고, 미술을 영어로 이야기하는 말하기 앱입니다.'));
  h.append(el('p', '', seen ? `단어 ${ix.counts.words}개 가운데 ${seen}개를 보셨어요.`
                            : `장면 ${ix.counts.scenes}개에 단어 ${ix.counts.words}개가 들어 있어요. 1구역부터 한 장면씩 열어 보세요.`));
  m.append(h);
  ix.zones.forEach((z, i) => {
    const n = z.scenes.reduce((a, s) => a + s.n, 0);
    const done = z.scenes.reduce((a, s) => a + (mem.seen[s.id] ? 1 : 0), 0);
    const b = item(() => { location.hash = `#/z/${i}`; });
    b.append(el('div', 'num', String(i + 1)), tx(z.name, `장면 ${z.scenes.length}개 · 단어 ${n}개`));
    b.append(done ? el('div', 'done', `${done}/${z.scenes.length}`) : el('div', 'chev', '›'));
    m.append(b);
  });
}

/* ── 구역 → 장면 목록 ───────────────────────────────────── */
function viewZone(i) {
  const z = INDEX.zones[+i];
  if (!z) return location.replace('#/learn');
  const m = screen(z.name, '#/learn');
  z.scenes.forEach((s, k) => {
    const b = item(() => { location.hash = `#/s/${s.id}`; });
    const img = el('img', 'thumb'); img.src = `img/scene/${s.id}.jpg`; img.alt = ''; img.loading = 'lazy';
    b.append(img, tx(s.name, `단어 ${s.n}개`));
    b.append(mem.seen[s.id] ? el('div', 'done', '✓ 봄') : el('div', 'chev', '›'));
    m.append(b);
  });
}

/* ── 장면 그림 ──────────────────────────────────────────── */
async function viewScene(id) {
  const d = await get(`data/scene/${id}.json`);
  const zi = INDEX.zones.findIndex(z => z.scenes.some(s => s.id === id));
  const m = screen(d.name, `#/z/${zi}`);
  m.append(Object.assign(el('p', 'muted'),
    { textContent: '그림 위의 동그라미를 눌러 보세요. 단어와 문장이 나옵니다.' }));

  const wrap = el('div', 'scenewrap');
  const img = el('img'); img.src = `img/scene/${id}_민.jpg`; img.alt = d.name;
  wrap.append(img);
  d.words.forEach(w => {
    if (w.x == null) return;
    const s = el('button', 'spot' + (mem.seen[w.id] ? ' seen' : ''));
    s.append(el('span', 'n', String(w.slot)));
    s.style.left = (w.x / 1536 * 100) + '%';           /* 장면 원본 1536×1024 */
    s.style.top = (w.y / 1024 * 100) + '%';
    /* 그림을 가리지 않도록 그림보다 조금 크게 테두리만 두른다 */
    const bw = (w.bw || 158) * 1.18;
    s.style.width = (bw / 1536 * 100) + '%';
    s.style.height = (bw / 1024 * 100) + '%';
    s.setAttribute('aria-label', `${w.slot}번 ${w.w}`);
    s.onclick = () => { location.hash = `#/w/${id}/${w.slot}`; };
    wrap.append(s);
  });
  m.append(wrap);

  const r = el('div', 'row');
  const q = el('button', 'btn', '기억 꺼내기'); q.onclick = () => { location.hash = `#/q/${id}`; };
  const t = el('button', 'btn ghost', '이 장면 대화'); t.onclick = () => { location.hash = `#/t/${id}`; };
  r.append(q, t); m.append(r);

  m.append(el('h3', 'sechead', '이 장면의 단어'));
  d.words.forEach(w => {
    const b = item(() => { location.hash = `#/w/${id}/${w.slot}`; });
    b.append(el('div', 'num', String(w.slot)),
             tx(w.w, `${w.han && w.han !== w.ko ? w.han + ' · ' : ''}${w.ko} · ${w.pos}`));
    b.append(mem.seen[w.id] ? el('div', 'done', '✓') : el('div', 'chev', '›'));
    m.append(b);
  });
}

/* ── 또 다르게 표현하기 ────────────────────────────────────
   앱이 그 자리에서 문장을 바꾼다. 다만 **확실히 맞는 것만** 바꾼다.
   (2026-09-18 기획자 확정: 안전한 것만 앱이 바꾼다)

   영어를 규칙으로 바꾸는 일은 절반이 함정이다.
     I made my bed yesterday.  →  Did you make your bed yesterday?
   처럼 made 를 make 로 되돌려야 하는데, 그 문장의 동사가 표제어가 아닌 일이 많다.
   규칙만으로 하면 절반 가까이가 틀린 영어가 되고, 시니어는 그것을 알아채지 못한 채
   따라 말하게 된다. 그래서 여기서는 **되돌릴 것이 없는 두 가지만** 만든다.

     감탄문      「… is/are/was/were + 형용사」 →  How + 형용사 !
     권유문      「I/We will + 동사원형 …」     →  Let's + 그대로 !

   맞지 않는 문장은 아무것도 내지 않는다. 억지로 만들지 않는다. */

/* 형용사인지 아는 방법: 이 장면 단어의 품사표 + 아주 흔한 형용사 몇 개 */
const ADJ_OK = new Set([
  'good', 'bad', 'big', 'small', 'new', 'old', 'long', 'short', 'high', 'low',
  'hot', 'cold', 'warm', 'cool', 'clean', 'dirty', 'easy', 'hard', 'fast', 'slow',
  'happy', 'sad', 'busy', 'free', 'full', 'empty', 'nice', 'kind', 'ready',
  'quiet', 'loud', 'bright', 'dark', 'soft', 'strong', 'weak', 'young', 'sweet',
  'fresh', 'heavy', 'light', 'safe', 'sick', 'tired', 'right', 'wrong', 'true',
  'beautiful', 'important', 'difficult', 'delicious', 'wonderful', 'expensive']);

/* 「very·so·too」 같은 정도말은 감탄문에서 빼야 한다.
   How very long! 은 영어에서 쓰지 않는 말이다. */
const DEGREE = new Set(['very', 'so', 'too', 'quite', 'really', 'rather', 'pretty']);

/* 정도를 매길 수 없는 형용사는 「How ~!」 로 감탄하지 않는다.
   「How live!」(생방송) 같은 말은 영어가 아니다. */
const NO_HOW = new Set(['live', 'main', 'only', 'same', 'other', 'another', 'next', 'last',
  'daily', 'weekly', 'monthly', 'yearly', 'digital', 'electric', 'electronic', 'public',
  'private', 'local', 'national', 'indoor', 'outdoor', 'plastic', 'wooden', 'metal',
  'left', 'right', 'front', 'back', 'upper', 'lower', 'middle', 'whole', 'entire',
  'possible', 'certain', 'regular', 'medium', 'single', 'double', 'total', 'final']);

/* 이 말이 있으면 문장 안에 딸린 절이 있다는 뜻이다.
   「My mother cared for me when I was sick.」 를 「How sick!」 로 바꾸면
   뜻이 아주 달라진다. 그래서 이런 문장은 손대지 않는다. */
const CLAUSE = /\b(when|if|because|while|that|who|which|after|before|since|though|although|but|until|as)\b/i;

/* 마음대로 할 수 없는 일은 「함께 하자」고 권할 수 없다.
   Let's need ten cups. 는 영어가 아니다. */
/* 「I will always hope …」 처럼 동사 앞에 부사가 오면 그 부사를 동사로 잘못 본다.
   이런 문장은 그냥 건너뛴다. */
const ADV_FIRST = /^(always|never|often|usually|sometimes|soon|still|also|probably|only|just|again|already|\w+ly)$/;

const NO_LETS = new Set(['need', 'want', 'like', 'love', 'hate', 'know', 'remember',
  'forget', 'see', 'hear', 'feel', 'seem', 'become', 'own', 'have', 'get', 'cost',
  'belong', 'understand', 'believe', 'hope', 'wish', 'miss', 'mean', 'weigh',
  'blink', 'sneeze', 'cough', 'grow', 'age', 'die', 'fall', 'happen']);

function otherForms(sent, adjOfScene) {
  const out = [];
  const en = (sent.en || '').trim();
  if (CLAUSE.test(en)) return out;                 /* 딸린 절이 있으면 손대지 않는다 */

  /* 감탄문 — 「… is/are/was/were 형용사.」 한 문장일 때만 */
  const bes = en.match(/\b(is|are|was|were)\b/g);
  if (bes && bes.length === 1) {
    const m = en.match(/^(.+?) (is|are|was|were) ([A-Za-z ]+)\.$/);
    if (m) {
      let words = m[3].trim().toLowerCase().split(/\s+/);
      const known = words.every(x => x === 'and' || DEGREE.has(x) ||
                                     ADJ_OK.has(x) || adjOfScene.has(x));
      words = words.filter(x => !DEGREE.has(x));    /* very·too 를 뺀다 */
      while (words.length && words[words.length - 1] === 'and') words.pop();
      while (words.length && words[0] === 'and') words.shift();
      const adjs = words.filter(x => x !== 'and');
      const gradable = adjs.every(x => !NO_HOW.has(x));
      if (known && gradable && adjs.length && words.length <= 3)
        out.push({ tag: '느낌을 드러낼 때', en: `How ${words.join(' ')}!`,
                   hint: '「정말 ~하네요!」 하고 감탄하는 말입니다.' });
    }
  }

  /* 권유문 — 「I will / We will + 동사원형 …」 일 때만 */
  const m2 = en.match(/^(I|We) will ([a-z]+)((?: .*)?)\.$/);
  if (m2) {
    const verb = m2[2], tail = m2[3] || '';
    /* 「Let's be almost there」 같은 말은 영어가 아니다 */
    const bad = NO_LETS.has(verb) || ADV_FIRST.test(verb)
             || (verb === 'be' && /^ (almost|nearly|there|able|going)\b/.test(tail))
             || /\b(you|your)\b/i.test(tail) || /\bnot\b/i.test(tail)
             /* my → our 로 바꾸면 「our wife」가 되어 버린다 */
             || /\bmy (wife|husband)\b/i.test(tail);
    if (!bad) {
      const rest = (verb + tail).replace(/\bmy\b/g, 'our').replace(/\bme\b/g, 'us');
      out.push({ tag: '함께 하자고 할 때', en: `Let's ${rest}.`,
                 hint: '「우리 같이 ~해요」 하고 권하는 말입니다.' });
    }
  }
  return out;
}

/* ── 단어 카드 ──────────────────────────────────────────── */
const WHEN = ['지금', '어제', '내일'];
async function viewWord(id, slot) {
  const d = await get(`data/scene/${id}.json`);
  const k = d.words.findIndex(w => w.slot === +slot);
  const w = d.words[k];
  if (!w) return location.replace(`#/s/${id}`);
  const m = screen(d.name, `#/s/${id}`);
  mem.seen[w.id] = 1; mem.seen[id] = 1; save();

  addLegend(m, SPEAK, true);        /* 이제 모든 문장이 소리 난다 */
  const key = el('div', 'saykey');
  [['subj', '주어'], ['verb', '동사'], ['obj', '목적어'], ['time', '시간']]
    .forEach(([k, n]) => key.append(el('span', 'c ' + k, n)));
  m.append(key);
  const top = el('div', 'card wordtop');
  const pic = el('div', 'pic');
  if (w.img) { const i = el('img'); i.src = `img/sticker/${w.img}`; i.alt = w.w; pic.append(i); }
  const info = el('div');
  const hw = el('div', 'w', w.w); hw.append(el('span', 'tag', w.pos));
  info.append(hw);
  const pr = pronLine(w);
  if (pr) info.append(pr);
  info.append(el('div', 'ko', w.ko));
  top.append(pic, info); m.append(top);

  w.s.forEach((s, i) => {
    if (!s) return;
    const c = el('div', `sent t${i}`);
    c.append(el('div', 'when', WHEN[i]),
             segColored(s.en, s.sg, 'en saw'), segColored(s.ko, s.kg, 'ko saw'));
    const row = el('div', 'btns');
    const p = playBtn(`w/${w.id}_${['present', 'past', 'future'][i]}`,
                      `audio/word/${w.id}_${['present', 'past', 'future'][i]}.mp3`, s.en);
    if (p) row.append(p);
    row.append(speakPractice(s.en));
    c.append(row);
    m.append(c);
  });

  /* 또 다르게 표현하기 — 만들 수 있는 것이 있을 때만 나온다 */
  /* 「형용사/부사」처럼 겹치는 품사는 빼고, 형용사가 대표인 것만 쓴다 (How live! 를 막는다) */
  const adjOfScene = new Set(d.words.filter(x => /^형용사$/.test(x.pos)).map(x => x.w.toLowerCase()));
  const alt = [];
  w.s.forEach(s => { if (s) otherForms(s, adjOfScene).forEach(x => alt.push(x)); });
  const seenAlt = new Set();
  const alt2 = alt.filter(x => !seenAlt.has(x.en) && seenAlt.add(x.en));
  if (alt2.length) {
    m.append(el('h3', 'sechead', '또 다르게 표현하기'));
    alt2.forEach(x => {
      const c = el('div', 'sent alt');
      c.append(el('div', 'when', x.tag), el('div', 'en', x.en), el('div', 'ko', x.hint));
      const row = el('div', 'btns');
      const p = speakBtn(x.en);       /* 이 문장은 앱이 그 자리에서 읽는다 */
      if (p) row.append(p);
      row.append(speakPractice(x.en));
      c.append(row);
      m.append(c);
    });
  }

  if (w.ph && w.ph.length) {
    m.append(el('h3', 'sechead', '이렇게도 씁니다'));
    const p = el('div', 'phr'); w.ph.forEach(x => p.append(el('span', '', x))); m.append(p);
  }

  const r = el('div', 'row');
  if (k > 0) { const b = el('button', 'btn ghost', '← 앞 단어');
               b.onclick = () => { location.hash = `#/w/${id}/${d.words[k - 1].slot}`; }; r.append(b); }
  if (k < d.words.length - 1) { const b = el('button', 'btn', '다음 단어 →');
               b.onclick = () => { location.hash = `#/w/${id}/${d.words[k + 1].slot}`; }; r.append(b); }
  else { const b = el('button', 'btn', '기억 꺼내기');
         b.onclick = () => { location.hash = `#/q/${id}`; }; r.append(b); }
  m.append(r);
}

/* ── 기억 꺼내기 ─────────────────────────────────────────────
   배운 것을 여러 방향에서 확인한다. 한 방향으로만 물으면
   그 방향으로만 기억되기 때문이다.
     그림→낱말 · 낱말→그림 · 뜻→낱말 · 문장 빈칸 · 언제 이야기인가
   한 자리를 비운 장면 그림을 따로 만들지 않는다. 낱장 그림을 크게 내면 같다. */
const QKIND = {
  pic:   { q: '이 그림은 어떤 단어를 나타낼까요?', g: '그림을 보고 알맞은 단어를 찾아보세요.' },
  topic: { q: '이 단어는 어떤 그림이었을까요?',   g: '단어를 보고 알맞은 그림을 찾아보세요.' },
  ko:    { q: '이 뜻은 어떤 단어일까요?',         g: '뜻을 보고 알맞은 단어를 찾아보세요.' },
  blank: { q: '빈칸에는 어떤 단어가 들어갈까요?', g: '문장을 읽고 알맞은 단어를 찾아보세요.' },
  when:  { q: '이 문장은 언제 이야기일까요?',     g: '지금·어제·내일 가운데 골라 보세요.' },
};
const WHEN_KO = ['지금', '어제', '내일'];

function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }

/* 문장 안에서 표제어(굴절형 포함)를 찾아 빈칸으로 만든다.
   확실히 찾은 것만 문제로 낸다 — 억지로 만들지 않는다. */
function blankOut(sentence, word) {
  const stem = word.length > 4 ? word.slice(0, word.length - 1) : word;
  const re = new RegExp(`\\b${stem}[a-z]{0,3}\\b`, 'i');
  const m = sentence.match(re);
  if (!m) return null;
  return { text: sentence.replace(re, '______'), was: m[0] };
}

async function viewQuiz(id) {
  const d = await get(`data/scene/${id}.json`);
  const m = screen('기억 꺼내기', `#/s/${id}`);
  const pool = d.words.filter(w => w.img);
  if (pool.length < 4) { m.append(el('p', 'muted', '이 장면은 아직 문제를 낼 수 없어요.')); return; }

  /* 단어마다 낼 수 있는 문제를 모아 두고 섞는다 */
  function makeQs() {
    const qs = [];
    for (const w of pool) {
      const kinds = ['pic', 'topic', 'ko'];
      const si = Math.floor(Math.random() * 3);
      const s = w.s[si];
      if (s) {
        const b = blankOut(s.en, w.w);
        if (b) kinds.push('blank');
        kinds.push('when');
      }
      qs.push({ w, kind: kinds[Math.floor(Math.random() * kinds.length)], si });
    }
    return shuffle(qs);
  }

  let qs = makeQs(), at = 0, right = 0;
  const head = el('p', 'muted');
  const bar = el('div', 'bar'); const fill = el('i'); bar.append(fill);
  const box = el('div', 'qbox');
  m.append(head, bar, box);

  function done() {
    box.innerHTML = ''; head.textContent = ''; fill.style.width = '100%';
    const h = el('div', 'hero');
    h.append(el('h2', '', `${qs.length}개 가운데 ${right}개를 맞히셨어요`),
             el('p', '', right === qs.length ? '모두 맞히셨습니다.'
                : right >= qs.length * 0.7 ? '잘하고 계십니다. 틀린 것만 다시 보시면 됩니다.'
                : '그림을 한 번 더 보고 오시면 훨씬 잘 떠오릅니다.'));
    box.append(h);
    mem.quiz[id] = { n: qs.length, r: right, at: today() }; save();
    const r = el('div', 'row');
    const A = el('button', 'btn', '다시 풀기');
    A.onclick = () => { qs = makeQs(); at = 0; right = 0; ask(); };
    const B = el('button', 'btn ghost', '장면으로');
    B.onclick = () => { location.hash = `#/s/${id}`; };
    r.append(A, B); box.append(r);
  }

  function ask() {
    if (at >= qs.length) return done();
    const { w, kind, si } = qs[at];
    head.textContent = `${at + 1} / ${qs.length}`;
    fill.style.width = (at / qs.length * 100) + '%';
    box.innerHTML = '';

    const others = shuffle(pool.filter(x => x !== w)).slice(0, 3);
    let choices = shuffle([w, ...others]);
    let answer = w, labelOf = x => x.w;

    if (kind === 'pic') {
      const p = el('div', 'bigpic');
      const i = el('img'); i.src = SRC0(`img/sticker/${w.img}`); i.alt = ''; p.append(i);
      box.append(p);
    } else if (kind === 'topic') {
      const p = el('div', 'bigword'); p.textContent = w.w; box.append(p);
    } else if (kind === 'ko') {
      const p = el('div', 'bigword ko'); p.textContent = w.ko; box.append(p);
    } else if (kind === 'blank') {
      const b = blankOut(w.s[si].en, w.w);
      const p = el('div', 'qsent');
      p.append(el('div', 'en', b.text));      /* 한국어는 답한 뒤에 보여 준다 */
      box.append(p);
    } else if (kind === 'when') {
      const p = el('div', 'qsent');
      p.append(el('div', 'en', w.s[si].en));  /* 한국어에 「~거예요」가 있어 답이 새어 나간다 */
      box.append(p);
      choices = WHEN_KO.map((t, k) => ({ w: t, k }));
      answer = choices[si]; labelOf = x => x.w;
    }
    const ask2 = el('div', 'qask');
    ask2.append(el('b', '', QKIND[kind].q), el('span', '', QKIND[kind].g));
    box.append(ask2);

    const g = el('div', kind === 'topic' ? 'choices pics' : 'choices');
    choices.forEach(c => {
      const btn = el('button', 'choice');
      if (kind === 'topic') {
        const i = el('img'); i.src = SRC0(`img/sticker/${c.img}`); i.alt = labelOf(c); btn.append(i);
      } else btn.textContent = labelOf(c);
      btn.onclick = () => {
        [...g.children].forEach(x => x.disabled = true);
        const ok = c === answer;
        if (ok) { btn.classList.add('right'); right++; }
        else {
          btn.classList.add('wrong');
          [...g.children][choices.indexOf(answer)].classList.add('right');
        }
        const tell = el('div', 'tell' + (ok ? ' ok' : ''));
        tell.append(el('b', '', ok ? '맞았어요' : '아니에요'),
                    el('span', '', kind === 'when'
                        ? `${WHEN_KO[si]} 이야기예요.`
                        : `${w.w} — ${w.ko}`));
        box.append(tell);
        if (kind === 'blank' || kind === 'when') {      /* 이제 온전한 문장과 뜻을 보여 준다 */
          const s = el('div', 'qsent');
          s.append(el('div', 'en', w.s[si].en), el('div', 'ko', w.s[si].ko));
          box.append(s);
        }
        const nx = el('button', 'btn', at + 1 < qs.length ? '다음 →' : '결과 보기');
        nx.onclick = () => { at++; ask(); }; box.append(nx);
        nx.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };
      g.append(btn);
    });
    box.append(g);
  }
  ask();
}

/* ── 대화 ───────────────────────────────────────────────── */
function viewTalkList() {
  const m = screen('함께 말하기', null);
  m.append(Object.assign(el('p', 'muted'),
    { textContent: '장면마다 짧은 대화 두 편이 있습니다. 한 편은 열 줄입니다.' }));
  INDEX.zones.forEach((z, i) => {
    m.append(el('h3', 'sechead', z.name));
    z.scenes.forEach(s => {
      const b = item(() => { location.hash = `#/t/${s.id}`; });
      const img = el('img', 'thumb'); img.src = `img/scene/${s.id}.jpg`; img.alt = ''; img.loading = 'lazy';
      b.append(img, tx(s.name, '두 편 · 스무 줄'), el('div', 'chev', '›'));
      m.append(b);
    });
  });
}
async function viewTalk(id) {
  const [d, sc] = await Promise.all([get(`data/dialog/${id}.json`), get(`data/scene/${id}.json`)]);
  const m = screen(sc.name, '#/talk');
  addLegend(m, SPEAK, false);
  d.dialogs.forEach(dg => {
    m.append(el('h3', 'sechead', `${dg.part}편 — ${dg.about || ''}`));
    dg.lines.forEach(l => {
      const row = el('div', `line ${l.who}`);
      row.append(el('div', 'who', l.role));
      const b = el('div', 'bub');
      b.append(el('div', 'en', l.en), el('div', 'ko', l.ko));
      const key = `d/${id}_${dg.part}_${String(l.n).padStart(2, '0')}`;
      /* 역할을 보고 목소리를 고른다 — 딸은 여자, 할아버지는 남자 */
      const p = playBtn(key, `audio/dialog/${id}_${dg.part}_${String(l.n).padStart(2, '0')}.mp3`,
                        l.en, l.who, l.role);
      if (p) b.append(p);
      row.append(b); m.append(row);
    });
  });
  const b = el('button', 'btn ghost', '이 장면 그림 보기');
  b.onclick = () => { location.hash = `#/s/${id}`; }; m.append(b);
}

/* ── 색이 곧 문법 (그림으로 배우기) ─────────────────────────
   「내 말, 영어로」와 같은 네 색을 이미 검수된 6,000문장에도 입힌다.
   문장을 다시 만들지 않는다 — 있는 문장을 그대로 두고 자리만 나눈다.
   나눔은 만들 때 미리 적어 두었다(sg·kg). 없으면 그냥 검은 글씨로 낸다.
   대화문에는 넣지 않았다 — 인사말·물음·두 문장이 섞여 네 색이 오히려 틀린다. */
function segColored(text, code, cls) {
  const d = el('div', cls);
  if (!code) { d.textContent = text; return d; }
  const body = text.replace(/[.!?]+$/, ''), end = text.slice(body.length);
  const toks = body.split(' ');
  const KN = { s: 'subj', v: 'verb', o: 'obj', t: 'time' };
  const marks = [...code.matchAll(/([svot])(\d+)/g)].map(m => [KN[m[1]], +m[2]]);
  if (!marks.length) { d.textContent = text; return d; }
  marks.forEach((m, i) => {
    const to = i + 1 < marks.length ? marks[i + 1][1] : toks.length;
    if (to <= m[1]) return;
    d.append(el('span', 'c ' + m[0], toks.slice(m[1], to).join(' ')));
    if (to < toks.length) d.append(document.createTextNode(' '));
  });
  if (end) d.append(document.createTextNode(end));
  return d;
}


/* ── 아니요·물음도 같은 네 색으로 ─────────────────────────────
   「did not paint」·「can paint」는 흩어진 낱말이 아니라 한 덩이다.
   그래서 주어·목적어·시간을 먼저 찾고, 그 사이에 남은 것을 통째로 주황으로 칠한다.
   (물음에서는 「Did … paint」처럼 주황이 둘로 갈린다 — 그것이 영어 물음의 생김새다) */
function 색문장(text, subj, obj, time, cls) {
  const d = el('div', cls || 'saw en');
  const body = text.replace(/[.?!]+$/, ''), end = text.slice(body.length);
  const toks = body.split(' ');
  const n = toks.length;
  const norm = w => w.replace(/[.,?!]+$/, '').toLowerCase();
  const 찾기 = 구 => {
    if (!구) return -1;
    const q = 구.trim().split(/\s+/);
    for (let i = 0; i + q.length <= n; i++) {
      let ok = true;
      for (let j = 0; j < q.length; j++)
        if (norm(toks[i + j]) !== norm(q[j])) { ok = false; break; }
      if (ok) return i;
    }
    return -1;
  };
  const len = x => x ? x.trim().split(/\s+/).length : 0;
  let tAt = 찾기(time);
  if (tAt < 0 || tAt + len(time) !== n) tAt = -1;
  const 끝 = tAt >= 0 ? tAt : n;
  let oAt = 찾기(obj);
  if (oAt < 0 || oAt + len(obj) > 끝) oAt = -1;
  const oEnd = oAt >= 0 ? oAt + len(obj) : -1;
  const sAt = 찾기(subj), sEnd = sAt >= 0 ? sAt + len(subj) : -1;
  if (sAt < 0 || sEnd > 끝) { d.textContent = text; return d; }
  const marks = [];
  if (sAt > 0) marks.push(['verb', 0, sAt]);
  marks.push(['subj', sAt, sEnd]);
  if (oAt >= sEnd) { marks.push(['verb', sEnd, oAt]); marks.push(['obj', oAt, oEnd]); }
  else marks.push(['verb', sEnd, 끝]);
  const 뒤 = oEnd > 0 ? oEnd : 끝;
  if (뒤 < 끝) marks.push(['obj', 뒤, 끝]);
  if (tAt >= 0) marks.push(['time', tAt, n]);
  marks.filter(m => m[2] > m[1]).sort((a, b) => a[1] - b[1]).forEach((m, i, all) => {
    d.append(el('span', 'c ' + m[0], toks.slice(m[1], m[2]).join(' ')));
    if (i + 1 < all.length) d.append(document.createTextNode(' '));
  });
  if (end) d.append(document.createTextNode(end));
  return d;
}

/* ── 내 말, 영어로 — 한국어를 영어로 옮기는 부분 ───────────── */
/* 한국어를 영어로 옮긴다 — 파이썬 옮기기.py 와 같은 규칙.
   자료는 data/say.json. 닫힌 낱말판 안에서만 옮기고, 모르면 모른다고 한다. */
function makeSay(D) {
  const VFORMS = Object.keys(D.verb).sort((a, b) => b.length - a.length);
  const ALSO_PL = D.alwaysPl, NO_ART = new Set(D.noArt), THE_ART = new Set(D.theArt),
        PL = new Set(D.plural), BEFORE_V = new Set(D.beforeV), JOSA = D.josa.slice()
          .sort((a, b) => b.length - a.length);
  const PRONV = new Set(Object.values(D.pron));
  const PROPER = new Set(D.proper || []);      /* 나라·도시 이름 — 관사를 붙이지 않는다 */
  const STEMS = Object.keys(D.stem2pres || {}).sort((a, b) => b.length - a.length);
  const PLAN = D.plan || {}, OBJP = D.objPhrase || {};
  const VPREP = D.vprep || {}, VPREPP = D.vprepPerson || {}, VNOOBJ = new Set(D.vnoobj || []);
  const PP = D.pp || {}, DBL = new Set(D.dbl || []), ASPECT = D.aspect || {}, BEN = D.beN || {};
  const CONNK = Object.keys(D.conn || {}).sort((a, b) => b.length - a.length);
  const MODAL = D.modal || {}, MODALF = Object.keys(MODAL).sort((a, b) => b.length - a.length);
  const PERFT = new Set(D.perfTime || []);
  const LET = D.let || {}, LETWHO = D.letWho || {}, A_ART = new Set(D.aArt || []);
  const VPREPA = D.vprepAfter || {}, DOOBJ = new Set(D.doObj || []);
  const PLAYOBJ = new Set(D.playObj || []), ONPLACE = new Set(D.onPlace || []);
  const NUMW = D.numw || {};

  /* 「그녀는 제가 그리게 했어요 → She let me paint.」 목적어 자리에 동사가 온다 */
  function letSent(subjKo, subj, s3, rest, timeKo, timeEn, orig, leadPlace) {
    const suf = Object.keys(LET).sort((a, b) => b.length - a.length).find(x => rest.endsWith(x));
    if (!suf) return null;
    const body = rest.slice(0, -suf.length).trim();
    const st = STEMS.find(x => body.endsWith(x));
    if (!st) return null;
    const inner = D.verb[D.stem2pres[st]];
    if (!inner) return null;
    const vIn = inner.slice().sort((a, b) => order(a) - order(b))[0][0];
    let who = ''; const io = [], extra = [];
    for (const tok of body.slice(0, -st.length).trim().split(/\s+/).filter(Boolean)) {
      if (LETWHO[tok]) { who = LETWHO[tok]; continue; }
      if (D.det[tok] || D.det2[tok]) { io.push(D.det[tok] || D.det2[tok]); continue; }
      const a = lookAdj(tok);
      if (a) { io.push(a); continue; }
      const n = pickNoun(tok);
      if (n && !who && D.cat[n.toLowerCase()] === '사람') {
        who = [article(n, ''), n].filter(Boolean).join(' '); continue;
      }
      if (n) { io.push([io.length ? '' : article(n, ''), n].filter(Boolean).join(' ')); continue; }
      extra.push(tok);
    }
    if (extra.length || !who) return null;
    const past = LET[suf] === '과거';
    const v = (past || !s3) ? 'let' : 'lets';
    const iow = io.length ? ' ' + io.join(' ') : '';
    let en = `${subj} ${v} ${who} ${vIn}${iow}`;
    if (leadPlace) en += leadTail(leadPlace);
    if (timeEn && !BEFORE_V.has(timeEn)) en += ' ' + timeEn;
    return { en: en + '.', subj: [subjKo, subj], verb: [suf, v], obj: ['', `${who} ${vIn}${iow}`],
             time: [timeKo, BEFORE_V.has(timeEn) ? '' : timeEn], tense: past ? '과거' : '현재',
             many: null, unsure: [], ven: 'let', adv: '', koOrig: orig, s3,
             let: true, letWho: who, letV: vIn + iow };
  }

  /* can · might · should · have to · want to — 동사 앞에 얹고 원형으로 되돌린다 */
  function modalWrap(r, md) {
    const subj = r.subj[1], ven = r.ven, s3 = r.s3;
    const t = (r.time[1] && r.time[1] !== r.adv) ? ' ' + r.time[1] : '';
    let head = md;
    if (md === 'have to' && s3) head = 'has to';
    if (md === 'want to' && s3) head = 'wants to';
    const o = Object.assign({}, r);
    o.en = `${subj} ${head} ${ven} ${r.obj[1]}${t}`.replace(/\s+/g, ' ').trim() + '.';
    o.verb = [r.verb[0], `${head} ${ven}`];
    o.modal = md; o.time = [r.time[0], t.trim()];
    return o;
  }
  const ing = v => DBL.has(v) ? v + v.slice(-1) + 'ing'
                 : (/e$/.test(v) && !/ee$/.test(v)) ? v.slice(0, -1) + 'ing' : v + 'ing';
  const beOf = (subj, s3, past) =>
    past ? ((subj === 'I' || s3 || subj === 'This' || subj === 'That') ? 'was' : 'were')
         : (subj === 'I' ? 'am' : (s3 || subj === 'This' || subj === 'That') ? 'is' : 'are');

  /* 「이것은 그림이에요 → This is a painting.」 이름씨가 보어로 온다 */
  function beNoun(subjKo, subj, s3, rest, timeKo, timeEn, orig, leadPlace) {
    const suf = Object.keys(BEN).sort((a, b) => b.length - a.length).find(x => rest.endsWith(x));
    if (!suf) return null;
    const head = rest.slice(0, -suf.length).trim();
    if (!head) return null;
    let det = '', noun = null; const adjs = [];
    for (const tok of head.split(/\s+/)) {
      if (D.det[tok]) { det = D.det[tok]; continue; }
      if (D.det2[tok]) { det = D.det2[tok]; continue; }
      const a = lookAdj(tok) || QUANT[tok];
      if (a) { adjs.push(a); continue; }
      const n = lookAll(tok).length ? lookAll(tok) : lookAll(stripJosa(tok));
      if (n.length) { noun = n[0]; continue; }
      return null;
    }
    if (!noun) return null;
    const past = BEN[suf] === '과거';
    let be = beOf(subj, s3, past);
    if (past && PERFT.has(timeKo))
      be = (s3 || subj === 'This' || subj === 'That') ? 'has been' : 'have been';
    const art = det || (D.cat[noun.toLowerCase()] === '사람'
      ? ('aeiou'.includes(noun[0].toLowerCase()) ? 'an' : 'a') : article(noun, ''));
    const comp = [art, ...adjs, noun].filter(Boolean).join(' ');
    let en = `${subj} ${be} ${comp}`;
    if (leadPlace) en += leadTail(leadPlace);
    if (timeEn && !BEFORE_V.has(timeEn)) en += ' ' + timeEn;
    return { en: en + '.', subj: [subjKo, subj], verb: [suf, be], obj: ['', comp],
             time: [timeKo, BEFORE_V.has(timeEn) ? '' : timeEn], tense: past ? '과거' : '현재', many: null, unsure: [noun],
             ven: 'be', adv: '', koOrig: orig, s3, be: true, adj: comp, adjStem: null };
  }

  /* 진행·완료·수동 — 동사 꼴만 바꾸고 나머지는 그대로 둔다 */
  function aspectWrap(r, asp) {
    const [kind, tn] = asp, subj = r.subj[1], ven = r.ven, s3 = r.s3;
    const body = r.obj[1];
    const t = (r.time[1] && r.time[1] !== r.adv) ? ' ' + r.time[1] : '';
    const o = Object.assign({}, r);
    let v, tail2 = t;
    const hv0 = (s3 || subj === 'This' || subj === 'That') ? 'has' : 'have';
    if (kind === '완료진행') v = `${hv0} been ${ing(ven)}`;
    else if (kind === '완료수동') v = `${hv0} been ${PP[ven] || ven}`;
    else if (kind === '진행')
      v = (tn === '과거' && PERFT.has(r.time[0])) ? `${hv0} been ${ing(ven)}`
                                                 : `${beOf(subj, s3, tn === '과거')} ${ing(ven)}`;
    else if (kind === '수동') v = `${beOf(subj, s3, tn === '과거')} ${PP[ven] || ven}`;
    else {
      const hv = (s3 || subj === 'This' || subj === 'That') ? 'has' : 'have';
      v = `${hv} ${r.adv ? r.adv + ' ' : ''}${PP[ven] || ven}`;
      if (kind === '완료경험' && !r.adv) tail2 = ' before' + t;
    }
    o.en = `${subj} ${v} ${body}${tail2}`.replace(/\s+/g, ' ').trim() + '.';
    o.verb = [r.verb[0], v]; o.tense = tn; o.aspect = kind;
    o.time = [r.time[0], tail2.trim()];      /* 늘(always)은 동사에 들어갔으니 뒤에 또 내지 않는다 */
    return o;
  }
  const ADJSTEM_INV = {};
  const SJOSA = (D.subjJosa || []).slice().sort((a, b) => b.length - a.length);
  const ADJP = D.adjp || {}, ADJPAST = D.adjPast || {}, ADJSTEM = D.adjStem || {};
  const ADJF = Object.keys(ADJP).concat(Object.keys(ADJPAST)).sort((a, b) => b.length - a.length);

  /* ★ be 는 층A의 유일한 예외 ★  「이 그림은 아름다워요 → This painting is beautiful.」 */
  function beSent(subjKo, subj, s3, rest, timeKo, timeEn, orig, leadPlace) {
    const form = ADJF.find(f => rest.endsWith(f));
    if (!form) return null;
    if (rest.slice(0, -form.length).trim()) return null;
    const past = ADJPAST[form] !== undefined;
    const key = past ? ADJPAST[form] : form;
    const adj = ADJP[key];
    let be = past ? ((subj === 'I' || s3 || subj === 'This' || subj === 'That') ? 'was' : 'were')
                  : (subj === 'I' ? 'am'
                     : (s3 || subj === 'This' || subj === 'That') ? 'is' : 'are');
    if (past && PERFT.has(timeKo))
      be = (s3 || subj === 'This' || subj === 'That') ? 'has been' : 'have been';
    let en = `${subj} ${be} ${adj}`;
    if (leadPlace) en += leadTail(leadPlace);
    if (timeEn && !BEFORE_V.has(timeEn)) en += ' ' + timeEn;
    return { en: en + '.', subj: [subjKo, subj], verb: [form, be], obj: ['', adj],
             time: [timeKo, BEFORE_V.has(timeEn) ? '' : timeEn], tense: past ? '과거' : '현재', many: null,
             unsure: [], ven: 'be', adv: '', koOrig: orig, s3,
             be: true, adj, adjStem: ADJSTEM[key] };
  }
  const PLSUBJ = new Set(D.plSubj || []), IRREG = D.irregPl || {}, QUANT = D.quant || {};

  /* 맨 앞에서 주어를 떼어 낸다 — 대이름씨, 아니면 「많은 사람들이」 같은 이름씨 주어 */
  function findSubj(parts) {
    if (parts.length && D.subj[parts[0]])
      return { ko: parts[0], en: D.subj[parts[0]][0], poss: D.subj[parts[0]][1],
               s3: ['She', 'He'].includes(D.subj[parts[0]][0]), rest: parts.slice(1) };
    let det = '', noun = null, k = 0, pl = false;
    const adjs = [];
    for (let i = 0; i < Math.min(parts.length, 4); i++) {
      const tok = parts[i];
      if (D.det[tok] || D.det2[tok]) { det = D.det[tok] || D.det2[tok]; continue; }
      let a = lookAdj(tok) || QUANT[tok];            /* 조사를 떼기 전에 먼저 본다 */
      if (a) { adjs.push(a); continue; }
      const j = SJOSA.find(x => tok.endsWith(x) && tok.length > x.length);
      const bare = j ? tok.slice(0, -j.length) : tok;
      let n = lookAll(bare);
      if (bare.endsWith('들') && bare.length > 1) { pl = true; if (!n.length) n = lookAll(bare.slice(0, -1)); }
      if (n.length) { noun = n[0]; k = i + 1; break; }
      a = lookAdj(bare) || QUANT[bare];
      if (a) { adjs.push(a); continue; }
      break;
    }
    if (!noun) return null;
    if (PLSUBJ.has(noun.toLowerCase()) || noun.toLowerCase().endsWith('s')) pl = true;
    if (pl && !PLSUBJ.has(noun.toLowerCase()) && !noun.toLowerCase().endsWith('s'))
      noun = IRREG[noun.toLowerCase()] || noun + (/(s|sh|ch|x)$/.test(noun) ? 'es' : 's');
    if (adjs.some(a => ['many', 'several', 'all'].includes(a))) pl = true;
    const art = det || (pl ? '' : (article(noun, '') ||
      (PROPER.has(noun) || NO_ART.has(noun.toLowerCase()) ? ''
       : ('aeiou'.includes(noun[0].toLowerCase()) ? 'an' : 'a'))));
    let en = [art, ...adjs, noun].filter(Boolean).join(' ');
    en = en[0].toUpperCase() + en.slice(1);
    return { ko: parts.slice(0, k).join(' '), en, poss: pl ? 'their' : 'his', s3: !pl,
             rest: parts.slice(k) };
  }
  /* 문장 맨 앞에 온 장소는 영어에서 뒤로 간다 — 「대한민국에서 …」 → … in Korea */
  const leadTail = pl => pl ? ' in ' + [article(pl, ''), pl].filter(Boolean).join(' ') : '';

  const stripJosa = w => {
    for (const j of JOSA) if (w.endsWith(j) && w.length > j.length) return w.slice(0, -j.length);
    return w;
  };
  const lookAll = k => (D.noun[k] || []).slice();
  const lookAdj = k => D.adj[k] || null;
  const pickNoun = k => { const n = lookAll(k); if (n.length) return n[0];
                          const m = lookAll(stripJosa(k)); return m.length ? m[0] : null; };

  const sForm = e => /(s|sh|ch|x|o)$/.test(e) ? e + 'es'
                   : (/y$/.test(e) && !'aeiou'.includes(e[e.length - 2])) ? e.slice(0, -1) + 'ies'
                   : e + 's';
  const plural = e => { const k = e.toLowerCase();
    if (ALSO_PL[k]) return ALSO_PL[k];
    if (!PL.has(k)) return e;
    if (/y$/.test(e) && !'aeiou'.includes(e[e.length - 2])) return e.slice(0, -1) + 'ies';
    return e + (/(s|sh|ch|x)$/.test(e) ? 'es' : 's'); };
  const article = (en, det) => {
    if (PROPER.has(en)) return '';
    if (det) return det;
    const k = en.toLowerCase();
    if (NO_ART.has(k) || ALSO_PL[k]) return '';
    if (k.endsWith('s') && (PL.has(k) || PL.has(k.slice(0, -1)) || k.endsWith('es'))) return '';
    if (A_ART.has(k)) return 'aeiou'.includes(en[0].toLowerCase()) ? 'an' : 'a';
    if (THE_ART.has(k)) return 'the';
    const a = D.art[k] || '';
    if (!a || a === '—' || a.startsWith('무관사')) return '';
    if (a.startsWith('the') || a.startsWith('my')) return 'the';
    return 'aeiou'.includes(en[0].toLowerCase()) ? 'an' : 'a';
  };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function build(subjKo, subj, ven, tense, obj, tail, timeKo, timeEn, verbKo, objKo, many, nouns, koOrig, s3) {
    let v = tense === '과거' ? (D.pastv[ven] || ven + 'ed')
          : tense === '미래' ? 'will ' + ven
          : s3 ? sForm(ven) : ven;
    let adv = '';
    if (BEFORE_V.has(timeEn)) {
      adv = timeEn; timeEn = '';
      v = v.startsWith('will ') ? 'will ' + adv + ' ' + v.slice(5) : adv + ' ' + v;
    }
    let en = (subj + ' ' + v + ' ' + obj).replace(/\s+/g, ' ').trim() + tail;
    if (timeEn) en += ' ' + timeEn;
    /* 관사를 손으로 정한 낱말만 쓰였는가 — 소리를 낼지 말지를 가른다 */
    const unsure = nouns.filter(n => !D.sure[n.toLowerCase()]);
    return { en: en + '.', subj: [subjKo, subj], verb: [verbKo, v], obj: [objKo, obj + tail],
             time: [timeKo, timeEn || adv], tense, many, unsure, ven, adv, koOrig, s3 };
  }

  const say = function (ko) {
    const t = String(ko || '').trim().replace(/[.!?]+$/, '');
    const orig = t;
    const order = c => { const i = D.vpri.indexOf(c[0]); return i < 0 ? 99 : i; };
    let parts = t.split(/\s+/).filter(Boolean);
    if (!parts.length) return { 모름: '문장을 적어 주세요' };

    let leadPlace = '';
    if (!D.subj[parts[0]]) {
      const tok = parts[0];
      for (const suf of ['에서는', '에서', '으로', '에는', '에']) {
        if (tok.endsWith(suf) && tok.length > suf.length) {
          const n = pickNoun(tok.slice(0, -suf.length));
          if (n && ['장소', '사물'].includes(D.cat[n.toLowerCase()])) { leadPlace = n; parts = parts.slice(1); }
          break;
        }
      }
    }
    const S = findSubj(parts);
    if (!S) return { 모름: `주어를 못 찾았어요 — ${parts[0] || ''}`,
                     도움: '「저는 · 그녀는」으로 시작하거나 「많은 사람들이」처럼 이름씨에 「이/가/은/는」을 붙여 주세요.' };
    const subj = S.en, poss = S.poss, subjKo = S.ko, s3 = S.s3;
    let rest = S.rest.join(' ');

    let timeKo = '', timeEn = '';
    for (const k of Object.keys(D.time).sort((a, b) => b.length - a.length)) {
      const re = new RegExp('(^|\\s)' + esc(k) + '($|\\s)');
      if (re.test(rest)) { timeKo = k; timeEn = D.time[k];
                           rest = rest.replace(re, ' ').trim(); break; }
    }
    let about = false;
    const mAb = rest.match(/(\S+)에\s*대(?:해서|해|하여)/);
    if (mAb) { about = true; rest = rest.replace(mAb[0], mAb[1] + '를'); }

    const bs = beSent(subjKo, subj, s3, rest, timeKo, timeEn, orig, leadPlace);
    if (bs) return bs;
    const bn = beNoun(subjKo, subj, s3, rest, timeKo, timeEn, orig, leadPlace);
    if (bn) return bn;

    const lr = letSent(subjKo, subj, s3, rest, timeKo, timeEn, orig, leadPlace);
    if (lr) return lr;

    let modal = null;
    const md = MODALF.find(f => rest.endsWith(f));
    if (md) { modal = MODAL[md][0]; rest = (rest.slice(0, -md.length).trim() + ' ' + MODAL[md][1]).trim(); }

    let aspect = null;
    for (const suf of Object.keys(ASPECT).sort((a, b) => b.length - a.length)) {
      if (!rest.endsWith(suf)) continue;
      const body = rest.slice(0, -suf.length).trim();
      const [kind, tn] = ASPECT[suf];
      if (kind === '진행') {
        const st = STEMS.find(x => body.endsWith(x));
        if (st) { aspect = [kind, tn]; rest = (body.slice(0, -st.length).trim() + ' ' + D.stem2pres[st]).trim(); }
      } else {
        const cn = CONNK.find(c => body.endsWith(c));
        if (cn) { aspect = [kind, tn]; rest = (body.slice(0, -cn.length).trim() + ' ' + D.conn[cn]).trim(); }
      }
      break;
    }

    for (const idi of Object.keys(D.idiom)) {
      if (rest.endsWith(idi)) { const [ven, obj, tense] = D.idiom[idi];
        return build(subjKo, subj, ven, tense, obj, leadTail(leadPlace), timeKo, timeEn, idi, rest, null, [], orig, s3); }
    }
    /* 「-기로 했어요」 — 마음먹은 것. 동사 어간에 붙는다 */
    let plan = null;
    for (const suf in PLAN) {
      if (!rest.endsWith(suf)) continue;
      const body = rest.slice(0, -suf.length).trim();
      const st = STEMS.find(x => body.endsWith(x));
      if (st) { plan = [PLAN[suf][0], PLAN[suf][1], suf];
                rest = (body.slice(0, -st.length).trim() + ' ' + D.stem2pres[st]).trim(); }
      break;
    }
    const vb = VFORMS.find(f => rest.endsWith(f));
    if (!vb) return { 모름: `동사를 못 찾았어요 — …${rest.slice(-8)}` };
    const cands = D.verb[vb];
    const verbKo = plan ? plan[2] : vb;
    rest = rest.slice(0, -vb.length).trim();

    let place = '', person = '';
    const keep = [];
    for (const tok of rest.split(/\s+/).filter(Boolean)) {
      if (D.pron[tok]) { person = D.pron[tok]; continue; }
      if ((tok.endsWith('에게') || tok.endsWith('께')) && tok.length > 2) {
        const n = pickNoun(tok.endsWith('에게') ? tok.slice(0, -2) : tok.slice(0, -1));
        if (n) { person = n; continue; }
      }
      if ((tok.endsWith('으로') || tok.endsWith('로')) && tok.length > 2) {
        const n = pickNoun(tok.endsWith('으로') ? tok.slice(0, -2) : tok.slice(0, -1));
        if (n && ['장소', '사물'].includes(D.cat[n.toLowerCase()])) { place = n; continue; }
      }
      if (tok.endsWith('에서') && tok.length > 2) {
        const n = pickNoun(tok.slice(0, -2));
        if (n && ['장소', '사물'].includes(D.cat[n.toLowerCase()])) { place = n; continue; }
      }
      if (tok.endsWith('에') && tok.length > 1 && !tok.endsWith('에는')) {
        const n = pickNoun(tok.slice(0, -1));
        if (n && ['장소', '사물'].includes(D.cat[n.toLowerCase()])) { place = n; continue; }
      }
      keep.push(tok);
    }
    let det = '', num = '', unit = '', senses = [];
    const adjs = [], unknown = [];
    for (const tok of keep) {
      if (D.det[tok]) { det = D.det[tok]; continue; }   /* 「제」는 늘 my */
      if (D.det2[tok]) { det = D.det2[tok]; continue; }
      if (D.count[tok] != null) { num = tok; continue; }
      const u = stripJosa(tok);
      if (num && D.unit[u] != null) { unit = D.unit[u]; continue; }
      const a = lookAdj(tok) || lookAdj(u);
      if (a) { adjs.push(a); continue; }
      const n = lookAll(tok).length ? lookAll(tok) : lookAll(u);
      if (n.length) { senses = n; continue; }
      unknown.push(tok);
    }
    const adjByStem = st => { for (const f in ADJSTEM) if (ADJSTEM[f] === st) return ADJP[f]; return null; };
    if (unknown.length) {
      const fe = cands.find(c => c[0] === 'feel');
      if (fe && unknown.length === 1 && unknown[0].endsWith('게')) {
        const adj = adjByStem(unknown[0].slice(0, -1));
        if (adj) return build(subjKo, subj, 'feel', fe[1], adj, '', timeKo, timeEn,
                              verbKo, keep.join(' '), null, [], orig, s3);
      }
      return { 모름: `아직 모르는 말 — ${unknown.join(', ')}`, 모르는말: unknown };
    }
    if (!senses.length) {                       /* 「슬프게 느껴져요」 */
      const fe = cands.find(c => c[0] === 'feel');
      const last = keep[keep.length - 1];
      if (fe && last && last.endsWith('게')) {
        const adj = adjByStem(last.slice(0, -1));
        if (adj) return build(subjKo, subj, 'feel', fe[1], adj, '', timeKo, timeEn,
                              verbKo, keep.join(' '), null, [], orig, s3);
      }
      if (aspect && (aspect[0] === '수동' || aspect[0] === '완료수동')) {   /* 「이 그림은 그려졌어요」 */
        const c0 = cands.slice().sort((a, b) => order(a) - order(b))[0];
        return aspectWrap(build(subjKo, subj, c0[0], c0[1], '', leadTail(leadPlace),
                                timeKo, timeEn, verbKo, keep.join(' '), null, [], orig, s3), aspect);
      }
      const nb = cands.find(c => VNOOBJ.has(c[0]));   /* 「사고가 일어났어요」 */
      if (nb) return build(subjKo, subj, nb[0], nb[1], '', '', timeKo, timeEn,
                           verbKo, keep.join(' '), null, [], orig, s3);
    }
    if (!senses.length && person) { senses = [person]; person = ''; }   /* 딸에게 전화해요 */
    else if (person && senses.length && D.cat[senses[0].toLowerCase()] === '사람'
             && D.cat[person.toLowerCase()] === '사람') person = '';   /* 의사 선생님께 */
    if (!senses.length && place) {            /* 영화관에 갔어요 — 장소를 받는 동사 */
      const mv = cands.find(c => D.vmove[c[0]] !== undefined);
      if (mv) {
        const prep = D.vmove[mv[0]];
        const where = [article(place, det), place].filter(Boolean).join(' ');
        let rr = build(subjKo, subj, mv[0], mv[1], prep ? prep + ' ' + where : where,
                       leadTail(leadPlace), timeKo, timeEn, verbKo, keep.join(' '), null, [place], orig, s3);
        if (!aspect && !modal && PERFT.has(timeKo)) aspect = ['완료', '현재'];
        if (aspect) rr = aspectWrap(rr, aspect);
        if (modal) rr = modalWrap(rr, modal);
        return plan ? planWrap(rr, plan) : rr;
      }
    }
    if (!senses.length) return { 모름: '목적어를 못 찾았어요' };

    /* 목적어가 있으면 장소만 받는 동사(live·go…)는 뒤로 민다 — 「꽃을 살 거예요」는 buy */
    const mv = c => (senses.length && D.vmove[c[0]] !== undefined) ? 1 : 0;
    const sorted = about ? cands.slice().sort((a, b) => (a[0] === 'talk' ? 0 : 1) - (b[0] === 'talk' ? 0 : 1))
                         : cands.slice().sort((a, b) => mv(a) - mv(b) || order(a) - order(b));
    let best = null;
    for (const [vv, OB] of [['do', DOOBJ], ['play', PLAYOBJ]]) {
      const c0 = cands.find(c => c[0] === vv);
      if (c0 && senses.some(n => OB.has(n.toLowerCase()))) {
        best = [c0[0], c0[1], senses.find(n => OB.has(n.toLowerCase()))]; break;
      }
    }
    for (const c of (best ? [] : sorted)) {
      for (const n of senses)
        if ((D.vcat[c[0]] || []).includes(D.cat[n.toLowerCase()])) { best = [c[0], c[1], n]; break; }
      if (best) break;
    }
    if (!best) best = [sorted[0][0], sorted[0][1], senses[0]];
    let [ven, tense, noun] = best;

    noun = plural(noun);
    const used = [noun];
    let obj;
    if (OBJP[ven + '|' + noun.toLowerCase()] && !num) obj = OBJP[ven + '|' + noun.toLowerCase()];
    else if (num) {
      const n = D.count[num];
      const w = NUMW[String(n)] || String(n);
      if (unit) obj = `${w} ${unit}` + (n > 1 ? 's of ' : ' of ') + [...adjs, noun].join(' ');
      else obj = `${w} ` + [...adjs, noun + (n > 1 ? 's' : '')].join(' ');
    } else {
      let art0 = article(noun, det);
      const pl0 = noun.toLowerCase().endsWith('s') || ALSO_PL[noun.toLowerCase()];
      if (art0 === 'this' && pl0) art0 = 'these';
      if (art0 === 'that' && pl0) art0 = 'those';
      obj = [art0, ...adjs, noun].filter(Boolean).join(' ');
    }
    if (VPREP[ven]) obj = VPREP[ven] + ' ' + obj;
    else if (VPREPP[ven] && D.cat[noun.toLowerCase()] === '사람') obj = VPREPP[ven] + ' ' + obj;
    if (about) obj = 'about ' + obj.replace(/^(at|for|about|from) /, '');
    let tail = '';
    if (place) {
      used.push(place);
      const prep = (D.vmove[ven] !== undefined ? D.vmove[ven]
                    : (ONPLACE.has(place.toLowerCase()) ? 'on' : 'in')) || 'in';
      tail = ' ' + prep + ' ' + [article(place, ''), place].filter(Boolean).join(' ');
    }
    if (person) {
      const who = PRONV.has(person) ? person
                : [article(person, ''), person].filter(Boolean).join(' ');
      if (!PRONV.has(person)) used.push(person);
      if (VPREPP[ven]) tail = ` ${VPREPP[ven]} ${who}` + tail;   /* hear the news from her */
      else if (VPREPA[ven] && obj) obj = `${who} ${VPREPA[ven]} ${obj}`;  /* ask her about … */
      else obj = who + ' ' + obj;
    }
    let rr = build(subjKo, subj, ven, tense, obj, tail + leadTail(leadPlace), timeKo, timeEn,
                   verbKo, keep.join(' '), senses.length > 1 ? senses : null, used, orig, s3);
    if (!aspect && !modal && PERFT.has(timeKo)) aspect = ['완료', '현재'];
    if (aspect) rr = aspectWrap(rr, aspect);
    if (modal) rr = modalWrap(rr, modal);
    return plan ? planWrap(rr, plan) : rr;
  };

  /* 「-기로 했어요」 — 안쪽 동사는 원형 그대로 두고 앞에 얹는다 */
  function planWrap(r, plan) {
    const tn = plan[1], subj = r.subj[1];
    let head = plan[0] === 'decided to' ? 'decided to' : 'plan to';
    if (tn === '현재' && r.s3) head = 'plans to';
    const t = (r.time[1] && r.time[1] !== r.adv) ? ' ' + r.time[1] : '';
    const o = Object.assign({}, r);
    o.en = `${subj} ${head} ${r.ven} ${r.obj[1]}${t}.`.replace(/\s+/g, ' ');
    o.verb = [r.verb[0], `${head} ${r.ven}`];
    o.tense = tn; o.plan = head; o.time = [r.time[0], t.trim()];
    return o;
  }

  /* 기본 문장 → 부정문·의문문. 층A_v2 규칙 그대로(be 말고는 전부 do-support).
     문법이 맞다고 시켜도 되는 것은 아니다 — love·like 는 부정을 만들지 않고 find 는 cannot 이다. */
  say.change = function (r) {
    const ven = r.ven, tense = r.tense, subj = r.subj[1];
    const body = r.obj[1];
    if (r.let) {
      const who = r.letWho, iv = r.letV;
      const tp = r.time[1] ? ' ' + r.time[1] : '';
      const past = tense === '과거';
      const flip = (subj === 'I' || subj === 'We');
      const qSubj = flip ? 'you' : subj.toLowerCase();
      const aux = past ? 'did' : ((r.s3 && !flip) ? 'does' : 'do');
      const one = (...xs) => xs.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      return { neg: one(subj, aux + ' not', 'let', who, iv, tp) + '.', negKo: null,
               ques: one(aux[0].toUpperCase() + aux.slice(1), qSubj, 'let', who, iv, tp) + '?',
               quesKo: (r.koOrig || '').replace(/\.$/, '') + '?' };
    }
    if (r.modal) {
      const md = r.modal, tp = r.time[1] ? ' ' + r.time[1] : '';
      const flip = (subj === 'I' || subj === 'We');
      const qSubj = flip ? 'you' : subj.toLowerCase();
      const qBody = flip ? body.replace(/\bmy\b/g, 'your') : body;
      const ko = r.koOrig || '';
      const one = (...xs) => xs.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      let neg, ques, negKo = null;
      if (md === 'have to' || md === 'want to') {          /* 이 둘만 do-support */
        const aux = (r.s3 && !flip) ? 'does' : 'do';
        neg = one(subj, aux + ' not', md, ven, body, tp) + '.';
        ques = one((r.s3 && !flip) ? 'Does' : 'Do', qSubj, md, ven, qBody, tp) + '?';
        if (md === 'want to' && ko) negKo = ko.replace('고 싶어요', '고 싶지 않아요');
      } else {
        const NW = { can: 'cannot', might: 'might not', should: 'should not' };
        const QH = { can: 'Can', might: 'Might', should: 'Should' };
        neg = one(subj, NW[md], ven, body, tp) + '.';
        ques = one(QH[md], qSubj, ven, qBody, tp) + '?';
        if (md === 'can' && ko) negKo = ko.replace('수 있어요', '수 없어요');
      }
      if (negKo === ko) negKo = null;
      let qk = ko;
      if (ko && ['저는', '제가', '나는', '내가'].includes(r.subj[0]))
        qk = ko.replace(r.subj[0], '당신은').replace(/(^|\s)제 /g, '$1당신의 ');
      return { neg, negKo, ques, quesKo: qk ? qk.replace(/\.$/, '') + '?' : null };
    }
    if (r.aspect) {
      /* 진행·완료·수동은 앞에 조동사가 있다 — not 만 붙이고 도치한다 */
      const vp = r.verb[1].split(' '), aux = vp[0], restV = vp.slice(1).join(' ');
      const tp = (r.time[1] && r.time[1] !== r.adv) ? ' ' + r.time[1] : '';
      const flip = (subj === 'I' || subj === 'We');
      const qSubj = flip ? 'you' : subj.toLowerCase();
      const qAux = flip ? ({ am: 'are', is: 'are', was: 'were', has: 'have' }[aux] || aux) : aux;
      const qBody = flip ? body.replace(/\bmy\b/g, 'your') : body;
      const ko = r.koOrig || '';
      let negKo = (ko && r.aspect === '진행')
        ? ko.replace('고 있어요', '고 있지 않아요').replace('고 있었어요', '고 있지 않았어요') : null;
      if (negKo === ko) negKo = null;
      let qk = ko;
      if (ko && ['저는', '제가', '나는', '내가'].includes(r.subj[0]))
        qk = ko.replace(r.subj[0], '당신은').replace(/(^|\s)제 /g, '$1당신의 ');
      const one = (...xs) => xs.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      return { neg: one(subj, aux, 'not', restV, body, tp) + '.', negKo,
               ques: one(qAux[0].toUpperCase() + qAux.slice(1), qSubj, restV, qBody, tp) + '?',
               quesKo: qk ? qk.replace(/\.$/, '') + '?' : null };
    }
    if (r.be) {
      /* do-support 없이 not 만 붙이고 주어-동사를 뒤집는다 */
      const be = r.verb[1], adj = r.adj;
      const tp = r.time[1] ? ' ' + r.time[1] : '';
      const flip = (subj === 'I' || subj === 'We');
      const qSubj = flip ? 'you' : subj.toLowerCase();
      const bw = be.split(' '), aux = bw[0], restBe = bw.slice(1).join(' ');
      const qAux = flip ? ({ am: 'are', is: 'are', was: 'were', has: 'have' }[aux] || aux) : aux;
      const one2 = (...xs) => xs.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const ko = r.koOrig || '', st = r.adjStem;
      const end = tense === '과거' ? '지 않았어요' : '지 않아요';
      let qk = ko;
      if (ko && ['저는', '제가', '나는', '내가'].includes(r.subj[0]))
        qk = ko.replace(r.subj[0], '당신은').replace(/(^|\s)제 /g, '$1당신의 ');
      return { neg: one2(subj, aux, 'not', restBe, adj, tp) + '.',
               negKo: (st && ko) ? ko.replace(r.verb[0], st + end) : null,
               ques: one2(qAux[0].toUpperCase() + qAux.slice(1), qSubj, restBe, adj, tp) + '?',
               quesKo: qk ? qk.replace(/\.$/, '') + '?' : null };
    }
    if (r.plan) {                       /* 마음먹은 것 자체를 부정·질문한다 */
      const inner = `to ${ven} ${body}`.trim();
      const did = tense === '과거' ? 'did not decide' : (r.s3 ? 'does not plan' : 'do not plan');
      const aux = tense === '과거' ? 'Did' : (r.s3 ? 'Does' : 'Do');
      const vb2 = tense === '과거' ? 'decide' : 'plan';
      const flip = (subj === 'I' || subj === 'We');
      const qs = flip ? 'you' : subj.toLowerCase();
      const qi = flip ? inner.replace(/\bmy\b/g, 'your') : inner;
      const tt = (r.time[1] && r.time[1] !== r.adv) ? ' ' + r.time[1] : '';
      let qk = r.koOrig || '';
      if (qk && ['저는', '제가', '나는', '내가'].includes(r.subj[0]))
        qk = qk.replace(r.subj[0], '당신은').replace(/(^|\s)제 /g, '$1당신의 ');
      return { neg: `${subj} ${did} ${inner}${tt}.`, negKo: null,
               ques: `${aux} ${qs} ${vb2} ${qi}${tt}?`,
               quesKo: qk ? qk.replace(/\.$/, '') + '?' : null };
    }
    const t = (r.time[1] && r.time[1] !== r.adv) ? ' ' + r.time[1] : '';
    const o = {};
    if (D.noNeg.includes(ven)) { o.neg = null; o.negWhy = '이 동사는 부정문으로 바꾸지 않습니다'; }
    else if (D.cannot.includes(ven))
      o.neg = `${subj} ${tense === '과거' ? 'could not' : 'cannot'} ${ven} ${body}${t}.`;
    else {
      const v = tense === '미래' ? 'will not ' + ven : tense === '과거' ? 'did not ' + ven
              : (r.s3 ? 'does not ' : 'do not ') + ven;
      o.neg = `${subj} ${v} ${body}${t}.`;
    }
    /* 「나·우리」로 말한 것을 물으면 상대에게 묻는 말이 된다. 그·그녀·그들은 그대로 둔다. */
    const flip = (subj === 'I' || subj === 'We');
    const qSubj = flip ? 'you' : subj.toLowerCase();
    const qBody = flip ? body.replace(/\bmy\b/g, 'your') : body;
    const aux = tense === '미래' ? 'Will' : tense === '과거' ? 'Did'
              : ((!flip && r.s3) ? 'Does' : 'Do');
    o.ques = `${aux} ${qSubj} ${ven} ${qBody}${t}?`;

    const ko = r.koOrig || '', vk = r.verb[0];
    let stem = D.stem[vk];
    if (!stem) for (const k in D.koPast) if (D.koPast[k] === vk) { stem = D.stem[k]; break; }
    if (!stem) for (const k in D.koFut)  if (D.koFut[k]  === vk) { stem = D.stem[k]; break; }
    const END = { 현재: '지 않아요', 과거: '지 않았어요', 미래: '지 않을 거예요' };
    o.negKo = (!o.neg || !ko) ? null
            : D.cannot.includes(ven) ? ko.replace(vk, '못 ' + vk)
            : stem ? ko.replace(vk, stem + END[tense]) : null;
    if (ko) {
      let q = ko;
      if (['저는', '제가', '나는', '내가'].includes(r.subj[0]))
        /* 「어제」 안의 「제」가 바뀌지 않도록 낱말 첫머리에서만 바꾼다 */
        q = q.replace(r.subj[0], '당신은').replace(/(^|\s)제 /g, '$1당신의 ');
      o.quesKo = q.replace(/\.$/, '') + '?';
    } else o.quesKo = null;
    for (const k of ['neg', 'ques'])
      if (o[k]) o[k] = o[k].replace(/\s+/g, ' ').replace(' .', '.').replace(' ?', '?');
    return o;
  };

  // ── 식구는 「the」가 아니라 「내」다 — 파이썬 식구고치기() 와 같다 ──
  const 식구 = new Set(('father mother brother sister son daughter husband wife ' +
    'grandfather grandmother grandma grandson granddaughter grandchild grandchildren ' +
    'uncle aunt cousin parent parents relative family baby').split(' '));
  const 내것 = { I: 'my', We: 'our', She: 'her', He: 'his', They: 'their', You: 'your',
                 we: 'our', she: 'her', he: 'his', they: 'their' };
  const 식구재 = new RegExp('\\bthe (' +
    [...식구].sort((a, b) => b.length - a.length).join('|') + ')\\b', 'g');
  const 식구고치기 = r => {
    if (!r || !r.en) return r;
    const my = 내것[(r.subj || ['', ''])[1]];
    if (!my) return r;
    const 바꿔 = s => s.replace(식구재, my + ' $1');
    r.en = 바꿔(r.en);
    for (const k of ['obj', 'verb', 'time'])
      if (Array.isArray(r[k]) && typeof r[k][1] === 'string') r[k] = [r[k][0], 바꿔(r[k][1])];
    for (const k of ['neg', 'ques']) if (typeof r[k] === 'string') r[k] = 바꿔(r[k]);
    return r;
  };
  const 겉 = ko => 식구고치기(say(ko));
  for (const k of Object.keys(say)) 겉[k] = say[k];   // say.change 같은 것을 잃지 않는다
  겉.change = r => 식구고치기(say.change(r));
  return 겉;
}

/* ── 내 말, 영어로 ──────────────────────────────────────────
   한국어로 말하거나 단추로 고르면 영어로 옮겨 준다.
   색이 곧 문법이다 — 보라 주어 · 주황 동사 · 초록 목적어 · 회색 시간.
   주황이 한국어에서는 끝에, 영어에서는 주어 바로 뒤에 선다. 설명하지 않아도 보인다.

   소리를 낼지 말지를 가린다 (미술관의 55문장과 같은 방식)
     단추로 고른 것    — 사람이 통과시킨 짝이다. 바로 읽어 준다
     내가 지어낸 것    — 관사가 아직 확인 전인 낱말이 끼면 보여만 주고 소리는 내지 않는다
     모르는 말이 있을 때 — 지어내지 않고 어느 말인지 짚어 준다            */
let SAY = null, sayFn = null;
async function sayReady() {
  if (!sayFn) { SAY = await get('data/say.json'); sayFn = makeSay(SAY); }
  return sayFn;
}
const ROLE = { subj: '주어', verb: '동사', obj: '목적어', time: '시간' };

/* 한국어 원문에 색을 입힌다 — 조각을 찾아 그 자리만 물들인다 */
function koColored(ko, r) {
  const marks = [];
  ['subj', 'time', 'obj', 'verb'].forEach(k => {
    const piece = r[k] && r[k][0];
    if (!piece) return;
    const i = ko.indexOf(piece);
    if (i >= 0) marks.push({ i, len: piece.length, k });
  });
  marks.sort((a, b) => a.i - b.i);
  const out = el('div', 'saw ko'); let at = 0;
  marks.forEach(m => {
    if (m.i < at) return;
    if (m.i > at) out.append(document.createTextNode(ko.slice(at, m.i)));
    out.append(el('span', 'c ' + m.k, ko.slice(m.i, m.i + m.len)));
    at = m.i + m.len;
  });
  if (at < ko.length) out.append(document.createTextNode(ko.slice(at)));
  return out;
}
/* 영어는 옮기는 프로그램이 조각을 알고 있으므로 그대로 세운다 */
function enColored(r) {
  const out = el('div', 'saw en');
  const put = (k, t) => { if (t) { out.append(el('span', 'c ' + k, t)); out.append(document.createTextNode(' ')); } };
  put('subj', r.subj[1]);
  put('verb', r.verb[1]);
  put('obj', r.obj[1]);
  put('time', r.time[1]);
  if (out.lastChild && out.lastChild.nodeType === 3) out.removeChild(out.lastChild);
  out.append(document.createTextNode('.'));
  return out;
}

function sayCard(ko, approved, again) {
  const r = sayFn(ko);
  const card = el('div', 'card saycard');
  if (r.모름) {
    card.classList.add('dunno');
    card.append(el('div', 'ko', ko), el('div', 'why', r.모름),
                el('div', 'muted', r.도움 ||
                   '아직 모르는 말은 지어내지 않습니다. 다른 말로 바꿔 보세요.'));
    const row0 = el('div', 'btns');
    const b0 = el('button', 'play', '다시 만들기'); b0.onclick = again; row0.append(b0);
    card.append(row0);
    return card;
  }

  /* 같은 뜻이 같은 칸에 선다 — 한국어와 영어가 자리를 바꾸는 것이 보인다 */
  const grid = el('div', 'fourcol');
  const cells = [['subj', r.subj], ['verb', r.verb], ['obj', r.obj], ['time', r.time]];
  cells.forEach(([k, v]) => {
    const c = el('div', 'fc');
    c.append(el('div', 'ko c ' + k, v[0] || ''), el('div', 'en c ' + k, v[1] || ''));
    if (!v[0] && !v[1]) c.classList.add('empty');
    grid.append(c);
  });
  card.append(grid);

  const line = el('div', 'saw en big');
  [['subj', r.subj[1]], ['verb', r.verb[1]], ['obj', r.obj[1]], ['time', r.time[1]]]
    .forEach(([k, t]) => { if (!t) return;
      line.append(el('span', 'c ' + k, t), document.createTextNode(' ')); });
  if (line.lastChild) line.removeChild(line.lastChild);
  line.append(document.createTextNode('.'));
  const veil = el('div', 'enwrap'); veil.append(line);
  card.append(veil);

  const 읽어도되나 = approved || r.unsure.length === 0;
  const row = el('div', 'btns three');
  if (읽어도되나 && SPEAK) {
    const b = el('button', 'play'); b.append(el('span', '', '🔊 영어 듣기'));
    b.onclick = () => speak(r.en, b); row.append(b);
  }
  row.append(speakPractice(r.en, true));
  const re = el('button', 'play', '↻ 다시 만들기'); re.onclick = again; row.append(re);
  card.append(row);

  if (!읽어도되나)
    card.append(el('div', 'checking',
      `아직 검토 전인 낱말(${r.unsure.join(', ')})이 있어 소리는 들려드리지 않아요`));
  if (r.many)
    card.append(el('div', 'muted', `「${r.obj[0]}」는 ${r.many.join(' · ')} 가운데 하나로 읽었어요`));

  /* 가리고 말해 보기 — 결과가 나온 뒤에 나온다 */
  const hide = el('button', 'fold small', '영어 가리고 말하기');
  hide.onclick = () => {
    veil.classList.toggle('veil');
    hide.textContent = veil.classList.contains('veil') ? '영어 보기' : '영어 가리고 말하기';
  };
  /* 해요 · 안 해요 · 물어봐요 — 접어 둔다. 셋 다 같은 네 색으로 보여 준다. */
  const ch = sayFn.change(r);
  const flip = (r.subj[1] === 'I' || r.subj[1] === 'We');
  const qSubj = flip ? 'you' : r.subj[1];
  const qObj = flip ? (r.obj[1] || '').replace(/\bmy\b/g, 'your') : r.obj[1];
  const more = el('div', 'more'); more.hidden = true;
  const mline = (lab, en, ko2, 물음, why) => {
    const d = el('div', 'mline');
    d.append(el('span', 'mlab', lab));
    const t = el('div', 'mtx');
    if (en) {
      t.append(색문장(en, 물음 ? qSubj : r.subj[1], 물음 ? qObj : r.obj[1], r.time[1], 'saw en'));
      if (ko2) t.append(el('div', 'ko', ko2));
    } else t.append(el('div', 'muted', why));
    d.append(t);
    if (en && 읽어도되나) { const b = speakBtn(en); if (b) d.append(b); }
    more.append(d);
  };
  mline('해요', r.en, r.ko_orig || r.koOrig || null, false);
  mline('안 해요', ch.neg, ch.negKo, false, ch.negWhy);
  mline('물어봐요', ch.ques, ch.quesKo, true);
  const 접힘 = '해요 · 안 해요 · 물어봐요 ▾';
  const moreBtn = el('button', 'fold small', 접힘);
  moreBtn.onclick = () => { more.hidden = !more.hidden;
    moreBtn.textContent = more.hidden ? 접힘 : '접기 ▴'; };
  const folds = el('div', 'folds'); folds.append(hide, moreBtn);
  card.append(folds, more);

  const d = today(); mem.made[d] = (mem.made[d] || 0) + 1; save();
  return card;
}

async function viewSay() {
  await sayReady();
  const m = screen('내 말, 영어로', null);
  m.append(el('p', 'muted', '한국어로 말하면 색깔 영어 문장이 돼요.'));

  const out = el('div', 'sayout');
  const show = (ko, approved) => { out.innerHTML = ''; out.append(sayCard(ko, approved, again));
                                   out.scrollIntoView({ block: 'nearest' }); };

  /* ── 들어가는 길 둘 — 마이크가 크고, 쓰기는 보조 ── */
  const ways = el('div', 'ways');
  const micBtn = el('button', 'way big');
  micBtn.append(el('span', 'ic', '🎤'), el('span', 'lb', '한국어로 말하기'));
  const typeBtn = el('button', 'way');
  typeBtn.append(el('span', 'ic', '⌨️'), el('span', 'lb', '직접 쓰기'));
  ways.append(micBtn, typeBtn);
  m.append(ways);

  const heard = el('div', 'mic-state'); heard.hidden = true;
  const typeBox = el('div', 'saybox'); typeBox.hidden = true;
  const inp = el('input', 'sayinp'); inp.type = 'text';
  inp.placeholder = '저는 어제 빵을 샀어요';
  inp.setAttribute('aria-label', '한국어 문장');
  const go = el('button', 'play', '영어로 바꾸기');
  go.onclick = () => { if (inp.value.trim()) show(inp.value.trim(), false); };
  inp.onkeydown = e => { if (e.key === 'Enter') go.onclick(); };
  typeBox.append(inp, go);
  typeBtn.onclick = () => { typeBox.hidden = !typeBox.hidden; if (!typeBox.hidden) inp.focus(); };
  m.append(heard, typeBox, out);

  const again = () => { out.innerHTML = ''; heard.hidden = true;
                        if (typeBox.hidden) micBtn.onclick(); else inp.select(); };

  micBtn.onclick = () => {
    if (!SR) { heard.hidden = false; heard.textContent = '이 기계에서는 마이크를 쓸 수 없어요. 「직접 쓰기」로 해 보세요.'; return; }
    stopMic();
    const r = new SR(); r.lang = 'ko-KR'; r.continuous = false; r.interimResults = true;
    mic = r; heard.hidden = false; heard.textContent = '듣고 있어요. 한국어로 말씀하세요.';
    r.onresult = e => {
      let txt = '', fin = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript; if (e.results[i].isFinal) fin = true;
      }
      txt = txt.trim(); if (!txt) return;
      heard.textContent = '이렇게 들렸어요 — ' + txt;
      if (fin) { inp.value = txt; show(txt, false); }
    };
    r.onerror = () => { heard.textContent = '지금은 잘 들리지 않아요. 「직접 쓰기」로 해 보세요.'; };
    r.onend = () => { if (mic === r) mic = null; };
    try { r.start(); } catch (e) { heard.textContent = '지금은 마이크를 쓸 수 없어요.'; }
  };

  /* ── 직접 골라 만들기 — 눌렀을 때만 한 칸씩 열린다 ── */
  const pickOpen = el('button', 'fold');
  pickOpen.textContent = '직접 골라 만들기 ▾';
  const pickWrap = el('div', 'card pick'); pickWrap.hidden = true;
  pickOpen.onclick = () => {
    pickWrap.hidden = !pickWrap.hidden;
    pickOpen.textContent = pickWrap.hidden ? '직접 골라 만들기 ▾' : '직접 골라 만들기 ▴';
    if (!pickWrap.hidden) { step = 0; redraw(); }
  };
  m.append(pickOpen, pickWrap);

  let subj = '저는', time = '', vi = 0, oi = 0, tense = '현재', step = 0;
  const rows = [];
  const rowOf = (label, cls) => {
    const d = el('div', 'prow'); d.append(el('div', 'plab', label));
    const c = el('div', cls); d.append(c); pickWrap.append(d); rows.push(d); return c;
  };
  const cSubj = rowOf('누가?', 'chips subj');
  const cTime = rowOf('언제?', 'chips time');
  const cVerb = rowOf('무엇을 해요?', 'chips verb');
  const cObj = rowOf('무엇을?', 'chips obj');

  const build = () => {
    const v = SAY.pick[vi], it = v.items[oi];
    const vk = (tense === '과거' ? SAY.koPast[it.vk]
              : tense === '미래' ? SAY.koFut[it.vk] : it.vk) || it.vk;
    show([subj, time, it.obj, vk].filter(Boolean).join(' ') + '.', true);
  };
  const chips = (box, list, cur, set, label) => {
    box.innerHTML = '';
    list.forEach(x => {
      const b = el('button', 'chip', label ? label(x) : x);
      if (cur() === x) b.setAttribute('aria-current', 'true');
      b.onclick = () => set(x);
      box.append(b);
    });
  };
  const redraw = () => {
    const isBe = SAY.pick[vi].en === 'be';
    rows[3].firstChild.textContent = isBe ? '어떤가요?' : '무엇을?';
    chips(cSubj, SAY.subjPick, () => subj,
          x => { subj = x; step = Math.max(step, 1); redraw(); });
    chips(cTime, isBe ? ['늘 하는 일', '어제'] : ['늘 하는 일', '어제', '내일'],
          () => tense === '과거' ? '어제' : tense === '미래' ? '내일' : '늘 하는 일',
          x => { tense = x === '어제' ? '과거' : x === '내일' ? '미래' : '현재';
                 time = x === '늘 하는 일' ? '' : x; step = Math.max(step, 2); redraw(); });
    chips(cVerb, SAY.pick.map((v, i) => i), () => vi,
          x => { vi = x; oi = 0;
                 if (SAY.pick[x].en === 'be' && !['이 그림은', '이것은'].includes(subj)) subj = '이 그림은';
                 if (SAY.pick[x].en !== 'be' && ['이 그림은', '이것은'].includes(subj)) subj = '저는';
                 if (tense === '미래' && SAY.pick[x].en === 'be') { tense = '현재'; time = ''; }
                 step = Math.max(step, 3); redraw(); },
          x => SAY.pick[x].en === 'be' ? '어때요' : SAY.pick[x].ko);
    chips(cObj, SAY.pick[vi].items.map((_, i) => i), () => oi,
          x => { oi = x; step = 4; redraw(); build(); },
          x => SAY.pick[vi].items[x].obj || SAY.pick[vi].items[x].vk);
    rows.forEach((d, i) => { d.hidden = i > step; });
  };
  redraw();

  /* ── 미술과 잇기 — 작은 딱지 하나 ── */
  const art = item(() => { location.hash = '#/art'; });
  art.append(el('div', 'num', '🎨'),
             tx('그림을 영어로 말하기', '그림에서 보이는 것을 말해 보세요.'),
             el('div', 'chev', '›'));
  m.append(art);
}

/* ── 미술 낱말 ──────────────────────────────────────────────
   2,000단어와 따로 둔다. 그림도 퀴즈도 붙이지 않는다.
   미술로 이야기하기에서 자유롭게 말할 때 귀로 알아듣는 데만 쓴다.
   (2026-09-20 기획자 확정: 「추가단어는 음성인식등에 사용」)

   갈래 「귀」는 사조·화파다 — cubism 을 말하게 하지 않는다.
   상대가 알려 주면 느낌으로 받는 것, 2차 대화문에서 정한 원칙 그대로다. */
let AW = null;
const awAll = () => AW ? AW.words.concat(AW.pairs) : [];
async function artWords() { AW = AW || await get('data/artword.json'); return AW; }

/* 들은 말 안에 미술 낱말이 있는가 — 낱말 경계로만 찾는다 */
function findArtWords(heard) {
  const t = ' ' + heard.toLowerCase().replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const hit = [];
  for (const w of awAll()) {
    const k = w.w.toLowerCase();
    if (t.includes(' ' + k + ' ') || t.includes(' ' + k.replace(/-/g, ' ') + ' ')) hit.push(w);
  }
  return hit;
}

/* 자유롭게 말하기 — 따라 말하기와 다르다. 맞출 문장이 없다.
   떠오르는 대로 말하고, 그 안에 든 미술 낱말만 되돌려 준다. */
function freeTalk() {
  if (!SR) return null;
  const wrap = el('div', 'card free');
  wrap.append(el('b', '', '내 말로 이야기하기'),
              el('div', 'muted', '그림을 보고 떠오르는 대로 말해 보세요. 채점하지 않습니다.'));
  const btn = el('button', 'ico mic-go', '🎤');
  btn.setAttribute('aria-label', '내 말로 이야기하기'); btn.title = '내 말로 이야기하기';
  const stop = el('button', 'play mic-stop', '그만하기');
  const state = el('div', 'mic-state'), heard = el('div', 'mic-heard'), got = el('div', 'awrow');
  stop.hidden = state.hidden = heard.hidden = true;
  wrap.append(btn, state, heard, got, stop);

  const shown = new Set();
  const end = msg => {
    stopMic(); btn.hidden = false; stop.hidden = true;
    state.textContent = msg || (shown.size ? `미술 낱말 ${shown.size}개를 쓰셨어요.`
                                           : '다음에는 색이나 느낌을 한 마디 넣어 보세요.');
    state.hidden = false;
  };
  btn.onclick = () => {
    stopMic();
    const r = new SR();
    r.lang = 'en-US'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    mic = r;
    btn.hidden = true; stop.hidden = false;
    state.hidden = false; state.textContent = '듣고 있어요. 편하게 말씀하세요.';
    r.onresult = e => {
      let txt = '', final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      txt = txt.trim();
      if (!txt) return;
      heard.hidden = false; heard.innerHTML = '';
      heard.append(el('span', 'lab', '이렇게 들렸어요'), el('span', 'txt', txt));
      if (!final) return;
      const d = today();
      mem.said[d] = (mem.said[d] || 0) + 1;
      findArtWords(txt).forEach(w => {
        mem.artw[w.w] = (mem.artw[w.w] || 0) + 1;
        if (shown.has(w.w)) return;
        shown.add(w.w);
        const c = el('span', 'aw');
        c.append(el('b', '', w.w), el('small', '', w.ko));
        got.append(c);
      });
      save();
      if (shown.size) { state.hidden = false; state.textContent = `미술 낱말 ${shown.size}개를 쓰셨어요.`; }
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        end('마이크를 쓸 수 없어요. 브라우저에서 마이크를 허락해 주세요.');
      else if (e.error === 'network') end('인터넷이 있어야 들을 수 있어요.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') end('지금은 잘 들리지 않아요.');
    };
    let last = 0, quick = 0;
    r.onend = () => {
      if (mic !== r) return;
      const now = Date.now();
      quick = (now - last < 700) ? quick + 1 : 0; last = now;
      if (quick >= 4) return end('마이크가 자꾸 끊겨요. 잠시 뒤에 다시 해 보세요.');
      try { r.start(); } catch (e) { end(); }
    };
    try { r.start(); } catch (e) { end('지금은 마이크를 쓸 수 없어요.'); }
  };
  stop.onclick = () => end();
  return wrap;
}

/* 미술 낱말 목록 화면 */
/* 낱말 한 칸 — 이름·발음·뜻과 소리 단추 */
function awCard(w, opt) {
  opt = opt || {};
  const c = el('div', 'card awone');
  const info = el('div');
  const hw = el('div', 'w', w.w);
  if (opt.tag) hw.append(el('span', 'tag', opt.tag));
  info.append(hw);
  const pr = pronLine(w, true); if (pr) info.append(pr);
  if (w.ko && w.ko !== w.han) info.append(el('div', 'ko', w.ko));
  /* 쓰는 법이 뜻만으로는 안 되는 낱말에는 한 줄을 붙인다 — 자료에 tip 이 있을 때만 */
  if (w.tip) info.append(el('div', 'tip', w.tip));
  if (opt.note) info.append(opt.note);
  c.append(info);
  const row = el('div', 'btns');
  const b = speakBtn(w.w); if (b) row.append(b);
  if (opt.mic) row.append(speakPractice(w.w));
  c.append(row);
  return c;
}

async function viewArtWords() {
  await artWords();
  ART = ART || await get('data/art.json');
  const title = id => { const x = ART.works.find(y => y.id === id); return x ? x.ko : ''; };
  const m = screen('미술 낱말', '#/art');
  m.append(el('p', 'muted',
    '그림 이야기에 자주 나오는 말입니다. 외우지 않으셔도 됩니다. ' +
    '「내 말로 이야기하기」에서 이 말이 나오면 앱이 알아듣고 짚어 드립니다.'));
  addLegend(m, SPEAK, true);
  const grp = {};
  AW.words.forEach(w => (grp[w.grp] = grp[w.grp] || []).push(w));

  Object.entries(grp).forEach(([g, ws]) => {
    if (g === '색채이론') return;                 /* 짝으로 따로 낸다 */
    m.append(el('h3', 'grp', g));
    if (AW.grpnote && AW.grpnote[g]) m.append(el('p', 'muted grpnote', AW.grpnote[g]));
    ws.forEach(w => {
      /* 「귀」 낱말은 어느 그림에서 들을 수 있는지 알려 준다 — 외우지 않아도 만나게 된다 */
      let note = null;
      const at = w.at && title(w.at);          /* 그 그림이 없으면 길을 내지 않는다 */
      if (at) {
        note = el('button', 'goart');
        note.append(el('span', '', `「${at}」 앞에서 들을 수 있어요`), el('span', 'chev', '›'));
        note.onclick = () => { location.hash = `#/a/${w.at}`; };
      }
      m.append(awCard(w, { tag: w.kind === '말' ? '말해 보기' : '알아듣기',
                           mic: w.kind === '말', note: note }));
    });
  });

  /* 색채이론은 짝으로 마주 본다 — 한쪽은 이미 배운 말인 것도 있다 */
  m.append(el('h3', 'grp', '색채이론 — 짝으로 익히기'));
  m.append(el('p', 'muted', '반대되거나 짝이 되는 말끼리 붙여 놓았습니다. 하나를 알면 다른 하나가 쉬워집니다.'));
  AW.colorpair.forEach(cp => {
    const box = el('div', 'cpair');
    box.append(el('div', 'cplab', cp.label));
    const two = el('div', 'cptwo');
    [cp.a, cp.b].forEach(x => {
      const c = el('div', 'cpside');
      const hw = el('div', 'w', x.w);
      if (x.old) hw.append(el('span', 'tag old', '이미 배운 말'));
      c.append(hw);
      const pr = pronLine(x, true); if (pr) c.append(pr);
      c.append(el('div', 'ko', x.ko));
      const row = el('div', 'btns');
      const b = speakBtn(x.w); if (b) row.append(b);
      if (!x.old) row.append(speakPractice(x.w));
      c.append(row);
      two.append(c);
    });
    box.append(two);
    m.append(box);
  });
  m.append(el('h3', 'grp', '이어서 쓰는 말'));
  AW.pairs.forEach(w => {
    m.append(awCard(w, { mic: true, note: el('div', 'muted', `${w.base} 에서 이어진 말`) }));
  });
}

/* ── 미술관 ─────────────────────────────────────────────── */
let ART = null;
async function viewArt() {
  ART = ART || await get('data/art.json');
  const m = screen('미술로 이야기하기', null);
  m.append(Object.assign(el('p', 'muted'),
    { textContent: SPEAK ? '그림을 고르고, 보이는 것부터 한 문장씩 말해 보세요. 정답은 없습니다.'
                         : '그림을 고르고, 보이는 것부터 한 문장씩 말해 보세요. (이 기계에는 영어 목소리가 없어 듣기 단추가 나오지 않습니다.)' }));
  const aw = item(() => { location.hash = '#/aw'; });
  aw.append(el('div', 'num', '낱말'), tx('미술 낱말 37개', '그림 이야기에 자주 나오는 말'),
            el('div', 'chev', '›'));
  m.append(aw);
  const g = el('div', 'artgrid');
  ART.works.forEach(w => {
    const b = el('button', 'artcell'); b.onclick = () => { location.hash = `#/a/${w.id}`; };
    const ph = el('div', 'ph');
    const i = el('img'); i.src = `img/art/작게/${w.img}`; i.alt = ''; i.loading = 'lazy';
    i.onerror = () => { i.remove(); ph.textContent = w.ko; };
    ph.append(i);
    const t = el('div', 'tx'); t.append(el('b', '', w.ko), el('small', '', w.by));
    b.append(ph, t); g.append(b);
  });
  m.append(g);
}
async function viewArtOne(id) {
  ART = ART || await get('data/art.json');
  const w = ART.works.find(x => x.id === id);
  if (!w) return location.replace('#/art');
  const m = screen('미술로 이야기하기', '#/art');
  addLegend(m, SPEAK, true);
  const key = el('div', 'saykey');
  [['subj', '주어'], ['verb', '동사'], ['obj', '목적어'], ['time', '시간']]
    .forEach(([k, n]) => key.append(el('span', 'c ' + k, n)));
  m.append(key);
  const box = el('div', 'artbig');
  const i = el('img'); i.src = `img/art/${w.img}`; i.alt = w.ko;
  i.onerror = () => { i.remove(); const p = el('div', 'ph'); p.textContent = `${w.ko}\n(그림 파일이 아직 없습니다)`;
                      p.style.whiteSpace = 'pre-line'; box.prepend(p); };
  box.append(i); m.append(box);
  const c = el('div', 'card');
  c.append(el('b', '', w.ko), el('div', 'muted', `${w.en} · ${w.by} · ${w.year}`),
           el('div', 'muted', w.where));
  m.append(c);

  /* 안내하는 분의 말 — 어려운 말은 상대가 알려 주고 듣는 사람은 느낌으로 받는다.
     따라 말하라고 하지 않는다. 그래서 🎤 를 달지 않는다. */
  await artWords();
  const gd = AW.guide.find(x => x.id === w.id);
  if (gd) {
    const g = el('div', 'guide');
    g.append(el('div', 'lab', '안내하는 분이 이렇게 말해요'));
    const t = el('div', 'gtx');
    t.append(el('div', 'en', gd.en), el('div', 'ko', gd.ko));
    g.append(t);
    const row = el('div', 'btns');
    const b = speakBtn(gd.en); if (b) row.append(b);
    row.append(el('div', 'muted', '따라 말하지 않으셔도 됩니다. 듣기만 하세요.'));
    g.append(row);
    m.append(g);
  }

  ART.groups.forEach(g => {
    const ss = w.s.filter(s => s.g === g);
    if (!ss.length) return;
    m.append(el('h3', 'grp', g));
    ss.forEach(s => {
      const d = el('div', 'sent t0');
      d.append(segColored(s.en, s.sg, 'en saw'), segColored(s.ko, s.kg, 'ko saw'));
      /* 사람 확인이 아직 남은 문장(55개)은 소리로 들려주지 않는다.
         문장이 바뀔 수 있으므로 귀로 먼저 익히지 않게 한다. */
      const row = el('div', 'btns');
      if (s.v) { const p = speakBtn(s.en); if (p) row.append(p); }
      else row.append(el('div', 'checking', '확인 중인 문장이라 소리는 아직 들려드리지 않아요'));
      row.append(speakPractice(s.en));
      d.append(row);
      m.append(d);
    });
  });

  /* 보기글을 따라 말한 뒤, 끝으로 자기 말로 해 본다 */
  await artWords();
  const f = freeTalk();
  if (f) m.append(f);
}

/* ── 내 기록 ────────────────────────────────────────────── */
function viewMe() {
  const m = screen('나의 기록 보기', null);
  const t = today();
  const words = Object.keys(mem.seen).filter(k => k[0] === 'W').length;
  const scenes = Object.keys(mem.seen).filter(k => k[0] === 'S').length;
  const saidToday = mem.said[t] || 0;
  const saidAll = Object.values(mem.said).reduce((a, b) => a + b, 0);

  const h = el('div', 'hero');
  h.append(el('h2', '', saidToday ? `오늘 ${saidToday}문장을 말했어요` : '오늘은 아직 시작 전이에요'),
           el('p', '', saidToday ? '한 문장이라도 소리 내어 말한 날이 쌓입니다.'
                                 : '장면 하나를 열고 한 문장만 말해 보세요.'));
  m.append(h);

  const s = el('div', 'stats');
  [[words, '본 단어'], [scenes, '연 장면'], [saidAll, '말한 문장'],
   [Object.keys(mem.said).length, '나온 날']].forEach(([n, l]) => {
    const c = el('div', 'stat'); c.append(el('b', '', String(n)), el('small', '', l)); s.append(c);
  });
  m.append(s);

  const madeToday = mem.made[t] || 0;
  const madeAll = Object.values(mem.made || {}).reduce((a, b) => a + b, 0);
  if (madeAll) {
    const c0 = el('div', 'card');
    c0.append(el('b', '', madeToday ? `오늘 내 말로 ${madeToday}문장을 만드셨어요`
                                    : `지금까지 ${madeAll}문장을 만드셨어요`),
              el('div', 'muted', '한국어로 말한 것을 영어로 바꿔 본 횟수입니다.'));
    m.append(c0);
  }

  const aw = Object.keys(mem.artw || {}).length;
  if (aw) {
    const c = el('div', 'card');
    c.append(el('b', '', `미술 낱말 ${aw}개를 말하셨어요`));
    const row = el('div', 'awrow');
    Object.entries(mem.artw).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([w, n]) => {
      const t = el('span', 'aw'); t.append(el('b', '', w), el('small', '', `${n}번`)); row.append(t);
    });
    c.append(row);
    m.append(c);
  }

  const pct = Math.round(words / INDEX.counts.words * 100);
  const c = el('div', 'card');
  c.append(el('b', '', `단어 ${words} / ${INDEX.counts.words}`));
  const bar = el('div', 'bar'); const f = el('i'); f.style.width = pct + '%'; bar.append(f);
  c.append(bar, el('div', 'muted', `${pct}% 보셨습니다.`));
  m.append(c);

  const qs = Object.entries(mem.quiz);
  if (qs.length) {
    m.append(el('h3', 'sechead', '기억 꺼내기'));
    qs.slice(-10).reverse().forEach(([id, q]) => {
      const b = item(() => { location.hash = `#/q/${id}`; });
      b.append(el('div', 'num', `${q.r}/${q.n}`), tx(id, q.at), el('div', 'chev', '›'));
      m.append(b);
    });
  }
  const r = el('div', 'card');
  r.append(el('div', 'muted', '기록은 이 기계 안에만 남습니다. 앱을 지우면 함께 사라집니다.'));
  m.append(r);
}

/* ── 길 찾기 ────────────────────────────────────────────── */
const TABS = { learn: '#/learn', talk: '#/talk', art: '#/art', say: '#/say', me: '#/me' };
document.querySelectorAll('.tab').forEach(b => {
  b.onclick = () => { location.hash = TABS[b.dataset.tab]; };
});
function markTab(name) {
  document.querySelectorAll('.tab').forEach(b =>
    b.dataset.tab === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
}

async function route() {
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const k = p[0] || 'learn';
  try {
    if (k === 'learn') { markTab('learn'); await viewLearn(); }
    else if (k === 'z') { markTab('learn'); viewZone(p[1]); }
    else if (k === 's') { markTab('learn'); await viewScene(p[1]); }
    else if (k === 'w') { markTab('learn'); await viewWord(p[1], p[2]); }
    else if (k === 'q') { markTab('learn'); await viewQuiz(p[1]); }
    else if (k === 'talk') { markTab('talk'); p[1] ? await viewTalk(p[1]) : viewTalkList(); }
    else if (k === 't') { markTab('talk'); await viewTalk(p[1]); }
    else if (k === 'art') { markTab('art'); await viewArt(); }
    else if (k === 'a') { markTab('art'); await viewArtOne(p[1]); }
    else if (k === 'aw') { markTab('art'); await viewArtWords(); }
    else if (k === 'say') { markTab('say'); await viewSay(); }
    else if (k === 'me') { markTab('me'); viewMe(); }
    else location.replace('#/learn');
  } catch (e) {
    const m = screen('잠깐만요', '#/learn');
    m.append(el('div', 'notice', '자료를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 들어와 주세요.'));
    console.error(e);
  }
}
window.addEventListener('hashchange', route);

(async function start() {
  INDEX = await get('data/index.json');
  try { AUDIO = await get('data/audio.json'); } catch (e) { AUDIO = null; }
  route();
})();
