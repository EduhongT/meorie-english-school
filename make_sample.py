#!/usr/bin/env python3
"""보여 드릴 견본 한 장을 만든다 — 자료와 그림을 한 파일 안에 넣는다.

  python3 make_sample.py

앱 본체(index.html·app.css·app.js)는 그대로 쓰고, fetch 로 받던 자료를
파일 안에 넣고 그림 주소를 data: 로 바꾼다. 그래서 견본에서 보이는 것은
실제 앱과 같은 화면이다.
"""
import base64, json, mimetypes, pathlib

HERE = pathlib.Path(__file__).parent
SCENES = ['S001', 'S031', 'S051', 'S085', 'S101', 'S141', 'S181', 'S191']
# 견본에 담을 작품 — 안내하는 분의 말이 붙은 것을 섞어 넣는다
ARTS = ['A001', 'A002', 'A003', 'A009', 'A019', 'A023', 'A025', 'A034',
        'A043', 'A053', 'A069', 'A076']

def b64(p):
    t = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
    return f'data:{t};base64,' + base64.b64encode(p.read_bytes()).decode()

# ── 자료 ──────────────────────────────────────────────────────
ix = json.loads((HERE/'data'/'index.json').read_text(encoding='utf-8'))
zones = []
for z in ix['zones']:
    ss = [s for s in z['scenes'] if s['id'] in SCENES]
    if ss: zones.append({'name': z['name'], 'scenes': ss})
ix = {'zones': zones, 'counts': {**ix['counts']}}

D = {'data/index.json': ix}
for sc in SCENES:
    D[f'data/scene/{sc}.json'] = json.loads((HERE/'data'/'scene'/f'{sc}.json').read_text(encoding='utf-8'))
    D[f'data/dialog/{sc}.json'] = json.loads((HERE/'data'/'dialog'/f'{sc}.json').read_text(encoding='utf-8'))
art = json.loads((HERE/'data'/'art.json').read_text(encoding='utf-8'))
art['works'] = [w for w in art['works'] if w['id'] in ARTS]
D['data/art.json'] = art
D['data/artword.json'] = json.loads((HERE/'data'/'artword.json').read_text(encoding='utf-8'))
D['data/say.json'] = json.loads((HERE/'data'/'say.json').read_text(encoding='utf-8'))

# ── 그림 ──────────────────────────────────────────────────────
IMG = {}
for sc in SCENES:
    for n in (f'{sc}.jpg', f'{sc}_민.jpg'):
        p = HERE/'img'/'scene'/n
        if p.exists(): IMG[f'img/scene/{n}'] = b64(p)
    for w in D[f'data/scene/{sc}.json']['words']:
        if w['img']:
            IMG[f"img/sticker/{w['img']}"] = b64(HERE/'img'/'sticker'/w['img'])
for w in art['works']:
    IMG[f"img/art/{w['img']}"] = b64(HERE/'img'/'art'/w['img'])
    IMG[f"img/art/작게/{w['img']}"] = b64(HERE/'img'/'art'/'작게'/w['img'])

# ── 앱 본체를 한 장으로 ────────────────────────────────────────
css = (HERE/'app.css').read_text(encoding='utf-8')
js = (HERE/'app.js').read_text(encoding='utf-8')

# 1) 자료는 fetch 대신 안에 든 것을 쓴다
js = js.replace("""const cache = new Map();
async function get(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path).then(r => { if (!r.ok) throw new Error(path); return r.json(); });
  cache.set(path, p);
  return p.catch(e => { cache.delete(path); throw e; });
}""",
"""/* 견본판 — 자료가 이 파일 안에 들어 있다 */
async function get(path) {
  if (!(path in DATA)) throw new Error(path);
  return DATA[path];
}
const SRC = p => IMG[p] || p;""")

# 2) 그림 주소를 안에 든 것으로
for a, b in [
    ("img.src = `img/scene/${s.id}.jpg`", "img.src = SRC(`img/scene/${s.id}.jpg`)"),
    ("img.src = `img/scene/${id}_민.jpg`", "img.src = SRC(`img/scene/${id}_민.jpg`)"),
    ("i.src = `img/sticker/${w.img}`", "i.src = SRC(`img/sticker/${w.img}`)"),
    ("i.src = `img/art/작게/${w.img}`", "i.src = SRC(`img/art/작게/${w.img}`)"),
    ("i.src = `img/art/${w.img}`", "i.src = SRC(`img/art/${w.img}`)"),
]:
    n = js.count(a)
    assert n, f'못 찾음: {a}'
    js = js.replace(a, b)

# 3) 기억해 두는 자리를 견본용으로 따로 (진짜 앱의 기록과 섞이지 않게)
js = js.replace("const KEY = 'yeonseupsil.v1';", "const KEY = 'yeonseupsil.sample.v1';")

body = (HERE/'index.html').read_text(encoding='utf-8')
body = body[body.index('<div class="shell">'):body.index('<script src="app.js">')]
# 견본 알림 띠를 둥근 판 안에 넣는다 (판의 맨 위 자리를 그것이 차지한다)
body = body.replace('<div class="shell">',
                    '<div class="shell">\n<div class="sampletag">견본입니다 — '
                    '200장면 가운데 8개, 작품 100점 가운데 12점만 담았습니다.</div>')

out = f'''<title>머리에 그리는 영어 연습실</title>
<meta name="description" content="말하고 싶은 미술 이야기를 꺼내는 곳">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap">
<style>
{css}
/* 견본판이 놓이는 자리는 위·아래 여백을 바깥에서 이미 더해 준다.
   그래서 앱이 스스로 더하던 여백을 여기서는 뺀다. */
html,body{{min-height:100%}}
.topbar{{padding-top:12px}}
.tabbar{{padding-bottom:0}}

/* 견본 알림 띠 — 둥근 판의 맨 위 자리 */
.sampletag{{
  background:var(--gold);color:#3a2d10;font-weight:700;text-align:center;
  padding:9px 16px;font-size:calc(14.5px * var(--f));line-height:1.45;
}}

.sampletag b{{color:#2b2005}}
</style>

{body}
<script>
const DATA = {json.dumps(D, ensure_ascii=False, separators=(',', ':'))};
const IMG = {json.dumps(IMG, ensure_ascii=False, separators=(',', ':'))};
{js}
</script>
'''
p = HERE/'견본.html'
p.write_text(out, encoding='utf-8')
print(f'견본.html {p.stat().st_size/1e6:.1f} MB · 장면 {len(SCENES)} · 작품 {len(ARTS)} · 그림 {len(IMG)}장')
