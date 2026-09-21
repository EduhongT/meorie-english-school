#!/usr/bin/env python3
"""음성을 넣은 뒤 제대로 들어갔는지 봅니다.

    python3 음성검사.py

앱을 고치지 않습니다. 보기만 하고, 마지막에 「음성검사_결과.txt」를 남깁니다.
그 파일 하나만 클로드에 올리시면 무엇이 빠졌는지 함께 볼 수 있습니다.
(mp3 자체는 올리지 않으셔도 됩니다 — 300 MB 라 올라가지도 않습니다)
"""
import json, glob, pathlib, collections, datetime

HERE = pathlib.Path(__file__).parent
A = HERE / 'audio'

# ── 있어야 할 것을 자료에서 뽑는다 ─────────────────────────
있어야 = {}
for f in sorted(glob.glob(str(HERE / 'data/scene/S*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    for w in d['words']:
        for i, t in enumerate(('present', 'past', 'future')):
            if w['s'][i]: 있어야[f"word/{w['id']}_{t}"] = w['s'][i]['en']
for f in sorted(glob.glob(str(HERE / 'data/dialog/S*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    for g in d['dialogs']:
        for l in g['lines']:
            있어야[f"dialog/{d['id']}_{g['part']}_{l['n']:02d}"] = l['en']

# ── 실제로 있는 것 ────────────────────────────────────────
있는 = {}
for sub in ('word', 'dialog'):
    for p in (A / sub).glob('*.mp3'):
        있는[f'{sub}/{p.stem}'] = p.stat().st_size

빠진 = sorted(set(있어야) - set(있는))
남는 = sorted(set(있는) - set(있어야))          # 이름이 틀렸거나 쓰지 않는 것
작은 = sorted(k for k, v in 있는.items() if v < 3000)   # 3 KB 미만 — 빈 파일일 수 있다
큰   = sorted(k for k, v in 있는.items() if v > 500_000)

줄 = []
def 쓰기(s=''):
    print(s); 줄.append(s)

쓰기(f'음성 검사 — {datetime.date.today()}')
쓰기('=' * 52)
쓰기(f'있어야 할 것  {len(있어야):,}개   (시제문장 6,000 + 대화문 4,000)')
쓰기(f'들어 있는 것  {len(있는):,}개')
mb = sum(있는.values()) / 1e6
쓰기(f'크기        {mb:,.0f} MB' + (f' · 하나 평균 {mb*1000/len(있는):.0f} KB' if 있는 else ''))
쓰기()

if not 있는:
    쓰기('※ audio/word/ 와 audio/dialog/ 가 비어 있습니다.')
    쓰기('  mp3 를 넣으신 뒤 다시 돌려 보십시오. 넣는 법은 audio/넣는법.txt 에 있습니다.')
elif not 빠진 and not 남는:
    쓰기('✓ 빠진 것도 남는 것도 없습니다. 이제 앱에_음성_넣기.py 를 돌리십시오.')
else:
    if 빠진:
        쓰기(f'빠진 것 {len(빠진):,}개')
        묶 = collections.Counter(k.split('/')[0] for k in 빠진)
        for k, v in 묶.items(): 쓰기(f'   {k} {v:,}개')
        쓰기('   앞에서 열 개만 적습니다 —')
        for k in 빠진[:10]: 쓰기(f'     audio/{k}.mp3    {있어야[k]}')
        쓰기()
    if 남는:
        쓰기(f'앱이 쓰지 않는 것 {len(남는):,}개 — 이름이 틀렸을 수 있습니다')
        for k in 남는[:10]: 쓰기(f'     audio/{k}.mp3')
        쓰기()

if 작은:
    쓰기(f'※ 너무 작은 파일 {len(작은)}개 (3 KB 미만 — 소리가 안 들어갔을 수 있습니다)')
    for k in 작은[:10]: 쓰기(f'     audio/{k}.mp3  {있는[k]:,} 바이트')
    쓰기()
if 큰:
    쓰기(f'※ 너무 큰 파일 {len(큰)}개 (500 KB 넘음 — 한 문장치고 깁니다)')
    for k in 큰[:10]: 쓰기(f'     audio/{k}.mp3  {있는[k]/1024:,.0f} KB')
    쓰기()

# 빠진 것 전부를 따로 남긴다 — 다시 만들 때 이 목록을 그대로 쓰면 된다
if 빠진:
    (HERE / '음성_다시만들_목록.txt').write_text(
        '\n'.join(f'audio/{k}.mp3\t{있어야[k]}' for k in 빠진), encoding='utf-8')
    쓰기(f'빠진 것 전부를 「음성_다시만들_목록.txt」에 적어 두었습니다 ({len(빠진):,}줄).')
    쓰기('이 파일을 음성 만드는 쪽에 그대로 넘기시면 됩니다.')

(HERE / '음성검사_결과.txt').write_text('\n'.join(줄), encoding='utf-8')
print('\n→ 음성검사_결과.txt 를 남겼습니다. 이 파일 하나만 클로드에 올리시면 됩니다.')
