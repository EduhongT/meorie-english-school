#!/usr/bin/env python3
"""미술 전문어휘 37개를 앱의 「말할 때 알아듣는 낱말」로 만든다.

  python3 미술어휘.py

이 낱말들은 그림·장면·퀴즈에 넣지 않는다. 2,000단어와 성격이 다르다.
미술로 이야기하기에서 자유롭게 말할 때 귀로 알아듣고,
「이번에 이 미술 낱말을 쓰셨어요」로 되돌려 주는 데 쓴다.
(2026-09-20 기획자 확정: 「추가단어는 음성인식등에 사용」)

  갈래  말 — 직접 말해 보기까지 하는 낱말 (25개)
        귀 — 알아듣기만 하면 되는 낱말 (12개). 사조·화파·어려운 기법.
             2차 대화문 원칙과 같다 — 사조를 맞히게 하지 않는다.

발음은 손으로 적는다.
  발음사전(cmudict)에 맡겼더니 cubism→큐비점, expressionism→익습레셔니점 이
  나왔다. -ism 의 마지막 모음을 「어」로 읽고 자음 덩어리를 뭉갠다.
  2,000단어 때 666개를 고쳐야 했던 것과 같은 일이다. 37개뿐이니 손으로 적는다.
  힘주는 자리는 | 로 표시한다 — ˈ 다음 모음, 그리고 | 다음 글자.
"""
import json, pathlib, re, openpyxl

HERE = pathlib.Path(__file__).parent
SRC  = pathlib.Path('/home/claude/life/미술어휘_추가제안.xlsx')
V    = 'iɪeɛæɑɔoʊuʌɜəayː'

# 낱말: (발음기호, 한글발음)  — 둘 다 힘주는 자리 앞에 ˈ 와 | 를 둔다
P = {
 'cubism':        ('ˈkjuːbɪzəm',      '|큐비즘'),
 'surrealism':    ('səˈriːəlɪzəm',    '서|리얼리즘'),
 'expressionism': ('ɪkˈspreʃənɪzəm',  '익스프|레셔니즘'),
 'baroque':       ('bəˈroʊk',         '버|로크'),
 'romanticism':   ('roʊˈmæntɪsɪzəm',  '로|맨티시즘'),
 'realism':       ('ˈriːəlɪzəm',      '|리얼리즘'),
 'contemporary':  ('kənˈtempəreri',   '컨|템퍼레리'),
 'avant-garde':   ('ævɑːnˈɡɑːrd',     '아방|가르드'),
 'fresco':        ('ˈfreskoʊ',        '프|레스코'),
 'mural':         ('ˈmjʊərəl',        '|뮤럴'),
 'engraving':     ('ɪnˈɡreɪvɪŋ',      '인그|레이빙'),
 'etching':       ('ˈetʃɪŋ',          '|에칭'),
 'glaze':         ('ˈɡleɪz',          '글|레이즈'),
 'varnish':       ('ˈvɑːrnɪʃ',        '|바니시'),
 'ceramics':      ('səˈræmɪks',       '서|래믹스'),
 'easel':         ('ˈiːzl',           '|이즐'),
 'sketchbook':    ('ˈsketʃbʊk',       '스|케치북'),
 'silhouette':    ('sɪluˈet',         '실루|엣'),
 'vibrant':       ('ˈvaɪbrənt',       '|바이브런트'),
 'muted':         ('ˈmjuːtɪd',        '|뮤티드'),
 'monochrome':    ('ˈmɑːnəkroʊm',     '|마너크롬'),
 'gradient':      ('ˈɡreɪdiənt',      '그|레이디언트'),
 'replica':       ('ˈreplɪkə',        '|레플리커'),
 'original':      ('əˈrɪdʒənl',       '어|리저널'),
 'authentic':     ('ɔːˈθentɪk',       '오|센틱'),
 'restoration':   ('restəˈreɪʃn',     '레스터|레이션'),
 'elegant':       ('ˈelɪɡənt',        '|엘리건트'),
 'graceful':      ('ˈɡreɪsfl',        '그|레이스풀'),
 'serene':        ('səˈriːn',         '서|린'),
 'complementary': ('kɑːmplɪˈmentri',  '캄플러|멘트리'),
 'saturation':    ('sætʃəˈreɪʃn',     '새처|레이션'),
 'primary':       ('ˈpraɪmeri',       '프|라이메리'),
 'secondary':     ('ˈsekənderi',      '|세컨데리'),
 'tint':          ('ˈtɪnt',           '|틴트'),
 'shading':       ('ˈʃeɪdɪŋ',         '|셰이딩'),
 'transparent':   ('trænsˈpærənt',    '트랜스|패런트'),
 'opaque':        ('oʊˈpeɪk',         '오|페이크'),
 # 연결 표현
 'still life':    ('stɪl ˈlaɪf',      '스틸 |라이프'),
 'self-portrait': ('self ˈpɔːrtrət',  '셀프 |포트릿'),
 'oil painting':  ('ˈɔɪl peɪntɪŋ',    '|오일 페인팅'),
 'acrylic paint': ('əˈkrɪlɪk peɪnt',  '어|크릴릭 페인트'),
 'brushstroke':   ('ˈbrʌʃstroʊk',     '|브러시스트로크'),
}

def unmark(w):
    """ˈ 와 | 를 떼고, 힘주는 자리를 숫자로 바꾼다."""
    ipa_m, han_m = P[w]
    i = ipa_m.index('ˈ'); ipa = ipa_m.replace('ˈ', '')
    m = re.compile(f'[{V}]+').search(ipa, i)
    ir = [m.start(), m.end()] if m else None
    h = han_m.index('|'); han = han_m.replace('|', '')
    d = {'ipa': ipa, 'han': han, 'hs': h}
    if ir: d['ir'] = ir
    return d


# ── 「귀」 12개 — 작품 안에서 안내하는 분이 한 번씩 말해 준다 ──────
# 사조를 맞히게 하지 않는다. 상대가 알려 주고 학습자는 느낌으로 받는다.
# (2차 대화문에서 정한 원칙 그대로. 2026-09-20 확정)
# 고른 작품은 그 말이 실제로 맞는 그림이다 — 지어내지 않았다.
GUIDE = [
 ('cubism',        'A027', 'Cezanne painted with simple shapes. That idea grew into cubism.',
                           '세잔은 단순한 모양으로 그렸어요. 그 생각이 자라서 입체파가 되었습니다.'),
 ('surrealism',    'A079', 'This strange dream world came long before surrealism.',
                           '이 이상한 꿈속 세계는 초현실주의보다 훨씬 먼저 나왔어요.'),
 ('expressionism', 'A069', 'Marc used color for feeling. We call this expressionism.',
                           '마르크는 느낌을 색으로 나타냈어요. 이것을 표현주의라고 합니다.'),
 ('baroque',       'A023', 'Strong light and deep shadow. This is baroque painting.',
                           '센 빛과 짙은 그림자. 이런 그림을 바로크라고 합니다.'),
 ('romanticism',   'A034', 'One small person before a huge sky. That is romanticism.',
                           '커다란 하늘 앞에 선 작은 사람. 그것이 낭만주의입니다.'),
 ('realism',       'A019', 'Millet painted working people as they really were. That is realism.',
                           '밀레는 일하는 사람들을 있는 그대로 그렸어요. 그것이 사실주의입니다.'),
 ('avant-garde',   'A073', 'Rousseau taught himself. Young avant-garde painters loved his work.',
                           '루소는 혼자 배웠어요. 젊은 전위 화가들이 그의 그림을 좋아했습니다.'),
 ('fresco',        'A076', 'This is a fresco. The paint went onto wet wall plaster.',
                           '이것은 프레스코화예요. 젖은 벽 회반죽 위에 색을 칠했습니다.'),
 ('engraving',     'A043', 'This is a woodblock print. In engraving the artist cuts into metal.',
                           '이것은 목판화예요. 판화는 금속을 새겨서 찍는 것입니다.'),
 ('etching',       'A009', 'Rembrandt also made many etchings, drawn with a needle on metal.',
                           '렘브란트는 에칭도 많이 만들었어요. 바늘로 금속에 그리는 방법입니다.'),
 ('glaze',         'A093', 'Van Eyck laid thin glaze over glaze. That is why it glows.',
                           '반에이크는 얇은 광택칠을 겹겹이 올렸어요. 그래서 그림이 빛납니다.'),
 ('varnish',       'A002', 'The old varnish has turned yellow over many years.',
                           '오래된 바니시가 여러 해 동안 누렇게 변했어요.'),
]

# ── 색채이론 8개 — 짝을 마주 보게 한다 ───────────────────────────
# 짝의 한쪽이 이미 2,000단어에 있으면 그 자료를 그대로 끌어다 쓴다.
PAIR = [
 ('primary', 'secondary', '원색과 이차색'),
 ('transparent', 'opaque', '비치는 것과 막힌 것'),
 ('tint', 'shade', '흰색을 섞으면 · 검정을 섞으면', '그늘 — 색에서는 검정을 섞어 어둡게 한 색'),
 ('complementary', 'contrast', '보색과 대비'),
 ('saturation', 'saturated', '채도 — 이름씨와 그림씨'),
 ('shading', 'shadow', '음영 기법과 그림자'),
]

wb = openpyxl.load_workbook(SRC)
items, seen = [], set()
def add(w, ko, grp, how, memo=''):
    w = str(w).strip()
    if w.lower() in seen: return
    seen.add(w.lower())
    items.append(dict(w=w, ko=str(ko).strip(), grp=grp,
                      kind='말' if '말하기 가능' in (how or '') else '귀',
                      memo=(memo or '').strip(), **unmark(w)))

for r in list(wb['미술어휘_추가제안'].iter_rows(values_only=True))[1:]:
    add(r[1], r[2], re.sub(r'\(.*\)', '', str(r[0])).strip(), r[3], r[4])
for r in list(wb['색채이론_추가'].iter_rows(values_only=True))[1:]:
    add(r[0], r[1], '색채이론', r[3], r[2])

KO = {'still life': '정물화', 'self-portrait': '자화상', 'oil painting': '유화',
      'acrylic paint': '아크릴 물감', 'brushstroke': '붓질, 붓 자국'}
pairs = []
for r in list(wb['연결표현_처리'].iter_rows(values_only=True))[1:]:
    if not r[0]: continue
    w = str(r[1]).strip()
    pairs.append(dict(base=str(r[0]).strip(), w=w, ko=KO.get(w, ''),
                      memo=(r[2] or '').strip(), **unmark(w)))

app = set()
for f in (HERE/'data'/'scene').glob('S*.json'):
    for x in json.loads(f.read_text(encoding='utf-8'))['words']: app.add(x['w'].lower())
dup = [x['w'] for x in items if x['w'].lower() in app]
if dup: raise SystemExit(f'※ 2,000단어와 겹칩니다: {dup}')

# 2,000단어에서 짝의 반대쪽을 끌어온다
old2000 = {}
for f in (HERE/'data'/'scene').glob('S*.json'):
    for x in json.loads(f.read_text(encoding='utf-8'))['words']:
        old2000[x['w'].lower()] = x

by = {x['w']: x for x in items}
guide = []
for w, aid, en, ko in GUIDE:
    if w not in by: raise SystemExit(f'※ 안내 말의 낱말 {w} 가 목록에 없습니다')
    if w.lower() not in en.lower().replace('-', '-'): raise SystemExit(f'※ 안내 말에 {w} 가 안 들어 있습니다')
    by[w]['at'] = aid                     # 낱말 목록에서 어느 그림으로 갈지
    guide.append({'id': aid, 'w': w, 'en': en, 'ko': ko})

colorpair = []
for row in PAIR:
    a, b, label = row[0], row[1], row[2]
    ko2 = row[3] if len(row) > 3 else None     # 2,000단어의 뜻이 색 이야기에 안 맞을 때
    if a not in by: raise SystemExit(f'※ 색 짝의 {a} 가 목록에 없습니다')
    if b in by:
        side = {k: by[b][k] for k in ('w', 'ko', 'ipa', 'han', 'hs', 'ir')}
        side['old'] = False
        by[b]['paired'] = True
    elif b.lower() in old2000:
        o = old2000[b.lower()]
        side = {'w': o['w'], 'ko': o['ko'], 'ipa': o.get('ipa'), 'han': o.get('han'),
                'hs': o.get('hs'), 'ir': o.get('ir'), 'old': True, 'id': o['id']}
    else:
        raise SystemExit(f'※ 색 짝의 {b} 를 2,000단어에서도 못 찾았습니다')
    left = {k: by[a][k] for k in ('w', 'ko', 'ipa', 'han', 'hs', 'ir')}
    if ko2: side['ko'] = ko2
    left['old'] = False
    by[a]['paired'] = True
    colorpair.append({'label': label, 'a': left, 'b': side})

out = {'note': '미술로 이야기하기에서 귀로 알아듣는 낱말. 그림·퀴즈에는 넣지 않는다.',
       'words': items, 'pairs': pairs, 'guide': guide, 'colorpair': colorpair}
(HERE/'data'/'artword.json').write_text(
    json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
n = sum(1 for x in items if x['kind'] == '말')
print(f'미술 낱말 {len(items)}개 (말 {n} · 귀 {len(items)-n}) · 연결표현 {len(pairs)}개')
bad = [x['w'] for x in items + pairs if not x.get('ir') or not x.get('han')]
if bad: raise SystemExit('※ 발음이 빠진 것: ' + ', '.join(bad))
print(f'안내 말 {len(guide)}개 (「귀」 12개가 모두 어느 그림엔가 들어갔는가: '
      f'{sorted(x["w"] for x in items if x["kind"]=="귀") == sorted(x["w"] for x in guide)})')
print(f'색 짝 {len(colorpair)}개 · 2,000단어에서 끌어온 쪽 {sum(1 for c in colorpair if c["b"]["old"])}개')
print('발음기호·한글발음·힘주는 자리 모두 들어 있습니다')
