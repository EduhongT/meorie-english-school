#!/usr/bin/env python3
"""앱 자료층을 만든다 — 장면 200개분 JSON + 대화 200개분 JSON + 색인.

  python3 build_data.py

읽는 것
  ../2000단어_통합_v1_파이프라인용.xlsx        단어 2,000 (장면·자리·품사·뜻·연결 표현)
  ../scenes/zoneNN/자리좌표.json               그림 위 자리 좌표
  ../pipeline/out/3000_chatgpt/sentences.json  1차 시제문장 3,000
  ../pipeline/out/2차3000/sentences.json       2차 시제문장 3,000
  ../dialog_src/dialog/SNNN.json               1차 대화문 (S001~S100)
  ../dialog2/dialog/SNNN.json                  2차 대화문 (S101~S200)

쓰는 것
  data/scene/SNNN.json    장면 하나 = 단어 10개 + 자리 + 시제문장 30개
  data/dialog/SNNN.json   장면 하나 = 대화 2편 20줄
  data/index.json         구역·장면 목록 (앱이 처음 받는 것, 가벼워야 한다)
"""
import json, pathlib, collections
import openpyxl

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent
DS, DD = HERE/'data'/'scene', HERE/'data'/'dialog'
DS.mkdir(parents=True, exist_ok=True); DD.mkdir(parents=True, exist_ok=True)

# ---------- 1. 단어 ----------
wb = openpyxl.load_workbook(ROOT/'2000단어_통합_v1_파이프라인용.xlsx', read_only=True, data_only=True)
ws = wb['1000개 표제어']; it = ws.iter_rows(values_only=True)
h = list(next(it)); c = {x: i for i, x in enumerate(h)}
words = {}                                     # scene -> [word dict]
zone_of, scene_name = {}, {}
for r in it:
    sc = r[c['장면 ID']]
    if not sc: continue
    zone_of[sc] = str(r[c['구역']]); scene_name[sc] = str(r[c['장면']])
    ph = r[c['연결 표현']]
    words.setdefault(sc, []).append({
        'id': r[c['단어 ID']], 'slot': int(r[c['위치']]),
        'w': str(r[c['표제어']]).strip(), 'pos': str(r[c['대표 품사']]),
        'ko': str(r[c['대표 한국어 뜻']]),
        'ph': [p.strip() for p in str(ph).split('|') if p.strip()] if ph else [],
    })
for sc in words: words[sc].sort(key=lambda x: x['slot'])

# ---------- 2. 좌표 ----------
coords = {}
for f in sorted((ROOT/'scenes').glob('zone*/자리좌표.json')):
    for sc, arr in json.loads(f.read_text(encoding='utf-8')).items():
        coords[sc] = {int(a['slot']): a for a in arr}

# ---------- 2-2. 스티커 파일명 ----------
# build_assets.py 가 나중에 채워 주기를 기다리지 않는다. 그렇게 두면 이 파일을
# 다시 돌릴 때마다 그림 연결이 지워진다(실제로 한 번 그랬다).
sticker = {}
for f in (HERE/'img'/'sticker').glob('*.png'):
    sc, slot, _ = f.stem.split('_', 2)
    sticker[(sc, int(slot))] = f.name
if not sticker:                                   # 아직 그림을 안 만들었을 때
    for f in (ROOT/'scenes').glob('zone*/stickers/*.png'):
        sc, slot, _ = f.stem.split('_', 2)
        sticker[(sc, int(slot))] = f.name

# ---------- 3. 시제문장 ----------
sent = collections.defaultdict(dict)           # word_id -> {tense: {en,ko}}
n_sent = 0
for p in ['pipeline/out/3000_chatgpt/sentences.json', 'pipeline/out/2차3000/sentences.json']:
    d = json.loads((ROOT/p).read_text(encoding='utf-8'))
    for x in (d['items'] if isinstance(d, dict) else d):
        if x.get('review_status') != 'approved': continue
        sent[x['word_id']][x['tense']] = {'en': x['en'], 'ko': x['ko']}
        n_sent += 1

# ---------- 4. 장면 파일 ----------
TENSES = ('present', 'past', 'future')
n_miss = 0
for sc in sorted(words):
    ws_ = []
    for w in words[sc]:
        co = coords.get(sc, {}).get(w['slot'], {})
        s = sent.get(w['id'], {})
        if len(s) < 3: n_miss += 1
        ws_.append({**w,
                    'x': co.get('cx'), 'y': co.get('cy'), 'bw': co.get('w'),
                    'img': sticker.get((sc, w['slot'])),
                    's': [s.get(t) for t in TENSES]})
    (DS/f'{sc}.json').write_text(json.dumps({
        'id': sc, 'zone': zone_of[sc], 'name': scene_name[sc], 'words': ws_
    }, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

# ---------- 5. 대화 ----------
n_dlg = 0
for src, rng in ((ROOT/'dialog_src'/'dialog', range(1, 101)),
                 (ROOT/'dialog2'/'dialog', range(101, 201))):
    for i in rng:
        sc = f'S{i:03d}'
        f = src/f'{sc}.json'
        if not f.exists(): print(f'※ 대화 없음 {sc}'); continue
        d = json.loads(f.read_text(encoding='utf-8'))
        out = []
        for dg in d['dialogs']:
            out.append({'part': dg['part'], 'about': dg.get('situation', ''),
                        'lines': [{'n': l['n'], 'who': l['speaker'], 'role': l['role'],
                                   'en': l['en'], 'ko': l['ko']} for l in dg['lines']]})
            n_dlg += len(out[-1]['lines'])
        (DD/f'{sc}.json').write_text(json.dumps({'id': sc, 'dialogs': out},
                                     ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

# ---------- 6. 색인 ----------
zones = collections.OrderedDict()
for sc in sorted(words):
    zones.setdefault(zone_of[sc], []).append({'id': sc, 'name': scene_name[sc],
                                              'n': len(words[sc])})
idx = {'zones': [{'name': k, 'scenes': v} for k, v in zones.items()],
       'counts': {'words': sum(len(v) for v in words.values()),
                  'scenes': len(words), 'sentences': n_sent, 'dialog_lines': n_dlg}}
(HERE/'data'/'index.json').write_text(json.dumps(idx, ensure_ascii=False,
                                      separators=(',', ':')), encoding='utf-8')

n_noimg = sum(1 for sc in words for w in words[sc] if not sticker.get((sc, w['slot'])))
print(f"장면 {len(words)} · 단어 {idx['counts']['words']} · 시제문장 {n_sent} · 대화 {n_dlg}줄")
if n_noimg: print(f'※ 그림이 연결되지 않은 단어 {n_noimg}개 — 단어 카드와 퀴즈가 빕니다')
if n_miss: print(f'※ 세 문장이 다 갖춰지지 않은 단어 {n_miss}개')
print(f"자료 크기 {sum(f.stat().st_size for f in (HERE/'data').rglob('*.json'))/1e6:.1f} MB")
