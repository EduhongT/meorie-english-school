#!/usr/bin/env python3
"""미술관 100점 자료를 앱 형식으로 옮긴다.

  python3 build_museum.py

문장 1,000개는 여기 있다. 그림 100장은 기획자가 갖고 계신 것을
img/art/ 에 넣으면 앱이 그대로 읽는다(파일명은 아래 JSON 이 정한 그대로).
"""
import json, pathlib, collections

HERE = pathlib.Path(__file__).parent
src = json.loads((HERE/'_src_museum.json').read_text(encoding='utf-8'))
tag = {x['artwork_id']: x for x in
       json.loads(pathlib.Path('/tmp/art/tagging_100.json').read_text(encoding='utf-8'))} \
      if pathlib.Path('/tmp/art/tagging_100.json').exists() else {}

# 층위를 시니어가 알아볼 네 갈래로 묶는다
GROUP = {'관찰': '보이는 것', '사실(출처 확인)': '보이는 것',
         '감상': '느낌', '해석': '느낌', '해석(가능성)': '느낌',
         '상상(표시)': '떠오르는 것', '이야기': '떠오르는 것',
         '질문': '물어보기'}
ORDER = ['보이는 것', '느낌', '떠오르는 것', '물어보기']

out, n_s, n_v = [], 0, 0
for a in src:
    ss = []
    for s in a['sentences']:
        g = GROUP.get(s['layer'], '보이는 것')
        ss.append({'id': s['id'], 'g': g, 'en': s['en'], 'ko': s['ko'],
                   'v': bool(s.get('voice_ready'))})
        n_s += 1; n_v += bool(s.get('voice_ready'))
    ss.sort(key=lambda x: ORDER.index(x['g']))
    t = tag.get(a['artwork_id'], {})
    out.append({'id': a['artwork_id'], 'img': a['image_file'],
                'cat': t.get('category', ''),
                'en': a['title_en'], 'ko': a['title_ko'],
                'by': a['artist'], 'year': str(a['year']),
                'where': a.get('museum_source', ''), 's': ss})

(HERE/'data'/'art.json').write_text(json.dumps(
    {'groups': ORDER, 'works': out}, ensure_ascii=False, separators=(',', ':')),
    encoding='utf-8')

have = {f.name for f in (HERE/'img'/'art').glob('*')}
miss = [w['img'] for w in out if w['img'] not in have]
print(f'작품 {len(out)} · 문장 {n_s} (음성 만들 것 {n_v}, 확인 권장 {n_s-n_v})')
print(f'갈래: ' + ' · '.join(f'{g} {sum(1 for w in out for s in w["s"] if s["g"]==g)}' for g in ORDER))
print(f'그림 {len(have)}장 있음 · {len(miss)}장 없음')
if miss: print('  없는 것 예:', ', '.join(miss[:3]))
