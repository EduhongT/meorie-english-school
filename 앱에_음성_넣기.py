#!/usr/bin/env python3
"""음성을 다 만든 뒤 한 번 돌리면 앱에 음성이 켜집니다.

  python3 앱에_음성_넣기.py --시제문장 ../pipeline/out --대화문 ../대화문_1차 ../대화문_2차

하는 일
  1. 음성 만드는 프로그램이 내놓은 mp3 를 앱이 찾는 이름으로 audio/ 에 옮깁니다.
  2. data/audio.json 을 만듭니다 — 앱은 이 목록을 보고 들어 보기 단추를 냅니다.
     이 파일이 없으면 단추가 나오지 않습니다. 그러니 음성이 없는 동안에도 앱은 그대로 돌아갑니다.

옮기는 규칙
  시제문장  <run>/audio/<장면>/W0001-present-v1.mp3  →  audio/word/W0001_present.mp3
  대화문    <src>/audio/<장면>/D001-A-01-v1.mp3      →  audio/dialog/S001_A_01.mp3
  버전이 여럿이면 가장 높은 것(v2 > v1)을 씁니다.

  미술관 감상 문장 1,000개는 여기서 다루지 않습니다.
  앱이 기계에 들어 있는 영어 목소리로 그 자리에서 읽습니다 (2026-09-18 기획자 확정).
"""
import argparse, json, pathlib, re, shutil, collections

HERE = pathlib.Path(__file__).parent
A = HERE/'audio'
for d in ('word', 'dialog'): (A/d).mkdir(parents=True, exist_ok=True)

def newest(paths):
    """같은 것의 여러 버전 가운데 v 숫자가 가장 큰 것을 고른다."""
    best = {}
    for p, key in paths:
        v = int(m.group(1)) if (m := re.search(r'-v(\d+)\.mp3$', p.name)) else 1
        if key not in best or v > best[key][0]: best[key] = (v, p)
    return {k: p for k, (v, p) in best.items()}

def take(found, sub, label):
    n = 0
    for key, src in sorted(found.items()):
        dst = A/sub/f'{key}.mp3'
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            shutil.copy2(src, dst)
        n += 1
    print(f'  {label} {n}개')
    return n

ap = argparse.ArgumentParser()
ap.add_argument('--시제문장', nargs='*', default=[], help='pipeline 의 out 폴더 (그 아래 <run>/audio/)')
ap.add_argument('--대화문', nargs='*', default=[], help='대화문_1차 · 대화문_2차 폴더')
a = ap.parse_args()

# 1) 시제문장 — W0001-present-v1.mp3
pool = []
for root in a.시제문장:
    for p in pathlib.Path(root).rglob('*.mp3'):
        if (m := re.match(r'(W\d+)-(present|past|future)(-v\d+)?\.mp3$', p.name)):
            pool.append((p, f'{m.group(1)}_{m.group(2)}'))
n_w = take(newest(pool), 'word', '시제문장')

# 2) 대화문 — D001-A-01-v1.mp3 (장면 폴더 이름이 S001)
pool = []
for root in a.대화문:
    for p in pathlib.Path(root).rglob('*.mp3'):
        if (m := re.match(r'D(\d+)-([AB])-(\d+)(-v\d+)?\.mp3$', p.name)):
            pool.append((p, f'S{int(m.group(1)):03d}_{m.group(2)}_{int(m.group(3)):02d}'))
n_d = take(newest(pool), 'dialog', '대화문')

# 3) 목록 — 앱은 이것만 보고 단추를 낸다
man = {}
for p in (A/'word').glob('*.mp3'):   man['w/' + p.stem] = 1
for p in (A/'dialog').glob('*.mp3'): man['d/' + p.stem] = 1
(HERE/'data'/'audio.json').write_text(json.dumps(man, separators=(',', ':')), encoding='utf-8')

mb = sum(p.stat().st_size for p in A.rglob('*.mp3'))/1e6
print(f'\n음성 {len(man)}개 · {mb:.0f} MB')
print(f'data/audio.json 을 새로 썼습니다. 이제 앱에 들어 보기 단추가 나옵니다.')
if not man:
    print('※ 옮겨 온 음성이 없습니다. 폴더 경로가 맞는지 보십시오.')
