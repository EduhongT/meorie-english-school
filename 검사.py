#!/usr/bin/env python3
"""앱이 제대로 만들어졌는지 본다. 파일이 있는지가 아니라 안이 찼는지를 본다."""
import json, pathlib, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).parent
bad = []

ix = json.loads((HERE/'data'/'index.json').read_text(encoding='utf-8'))
n_sc = sum(len(z['scenes']) for z in ix['zones'])
n_w = n_s = n_img = 0
words_all = set()          # 2,000단어 — 미술 낱말과 겹치는지 보려고 모아 둔다
for z in ix['zones']:
    for s in z['scenes']:
        f = HERE/'data'/'scene'/f"{s['id']}.json"
        if not f.exists(): bad.append(f'장면 자료 없음 {s["id"]}'); continue
        d = json.loads(f.read_text(encoding='utf-8'))
        for w in d['words']:
            n_w += 1
            words_all.add(w['w'].lower())
            if not w.get('img'): bad.append(f'그림 연결 없음 {s["id"]} {w["w"]}')
            elif not (HERE/'img'/'sticker'/w['img']).exists(): bad.append(f'그림 파일 없음 {w["img"]}')
            else: n_img += 1
            if sum(1 for x in w['s'] if x) != 3: bad.append(f'문장이 셋이 아님 {w["w"]}')
            if not w.get('ipa'): bad.append(f'발음기호 없음 {w["w"]}')
            if not w.get('han'): bad.append(f'한글 발음 없음 {w["w"]}')
            elif not all('\uac00' <= c <= '\ud7a3' or c in ' ·' for c in w['han']):
                bad.append(f'한글 발음에 딴 글자 {w["w"]} {w["han"]}')
            n_s += sum(1 for x in w['s'] if x)
        for n in (f"{s['id']}.jpg", f"{s['id']}_민.jpg"):
            if not (HERE/'img'/'scene'/n).exists(): bad.append(f'장면 그림 없음 {n}')
        g = HERE/'data'/'dialog'/f"{s['id']}.json"
        if not g.exists(): bad.append(f'대화 없음 {s["id"]}')

art = json.loads((HERE/'data'/'art.json').read_text(encoding='utf-8'))
n_a = 0
for w in art['works']:
    if not (HERE/'img'/'art'/w['img']).exists(): bad.append(f'작품 그림 없음 {w["img"]}')
    if not (HERE/'img'/'art'/'작게'/w['img']).exists(): bad.append(f'작은 그림 없음 {w["img"]}')
    n_a += len(w['s'])

empty = []
for f in (HERE/'img'/'sticker').glob('*.png'):
    a = np.asarray(Image.open(f).convert('RGBA'))[:, :, 3]
    if (a > 10).mean() < 0.005: empty.append(f.name)
if empty: bad.append(f'속이 빈 그림 {len(empty)}장 — ' + ', '.join(empty[:5]))

import collections
by = collections.defaultdict(set)
for z in ix['zones']:
    for s_ in z['scenes']:
        for w in json.loads((HERE/'data'/'scene'/f"{s_['id']}.json").read_text(encoding='utf-8'))['words']:
            if w.get('han'): by[(w['w'].lower(), w['pos'])].add(w['han'])
dup = {k: v for k, v in by.items() if len(v) > 1}
if dup: bad.append(f'같은 낱말인데 한글 발음이 갈린 것 {len(dup)}개 — ' + str(list(dup)[:3]))
# ── 미술 낱말 — 2,000단어와 겹치지 않는가, 발음이 다 들어 있는가 ──
aw_p = HERE/'data'/'artword.json'
n_aw = 0
if not aw_p.exists():
    bad.append('미술 낱말 자료(data/artword.json)가 없습니다 — 미술어휘.py 를 돌리세요')
else:
    aw = json.loads(aw_p.read_text(encoding='utf-8'))
    all_aw = aw['words'] + aw['pairs']
    n_aw = len(all_aw)
    seen_w = set()
    for x in all_aw:
        w = x['w']
        if w.lower() in words_all:
            bad.append(f'미술 낱말 {w} 가 2,000단어와 겹칩니다')
        if w.lower() in seen_w: bad.append(f'미술 낱말 {w} 가 두 번 있습니다')
        seen_w.add(w.lower())
        for k in ('ipa', 'han', 'ko'):
            if not x.get(k): bad.append(f'미술 낱말 {w} 에 {k} 가 비어 있습니다')
        if x.get('hs') is None or not x.get('ir'):
            bad.append(f'미술 낱말 {w} 에 힘주는 자리가 없습니다')
        elif not (0 <= x['hs'] < len(x['han'])):
            bad.append(f'미술 낱말 {w} 의 한글 힘주는 자리가 글자 수를 벗어납니다')
        elif x['ir'][1] > len(x['ipa']):
            bad.append(f'미술 낱말 {w} 의 발음기호 힘주는 자리가 길이를 벗어납니다')

print(f'장면 {n_sc} · 단어 {n_w} · 그림 연결 {n_img} · 시제문장 {n_s} · 작품 {len(art["works"])} · 감상문장 {n_a} · 미술 낱말 {n_aw}')
if bad:
    print(f'\n✗ 문제 {len(bad)}건')
    for b in bad[:20]: print('   ', b)
    sys.exit(1)
print('✓ 빠진 것도 빈 것도 없습니다')
