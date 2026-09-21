#!/usr/bin/env python3
"""앱에 넣을 그림을 만든다 — 스티커 2,000 · 장면 400.

  python3 build_assets.py

스티커는 여백을 잘라내고 300픽셀로 줄인다(단어 카드·퀴즈 정답용).
장면은 900×600 JPG. 글자 있는 판과 없는 판 둘 다 담는다.
기억 꺼내기 판은 만들지 않는다 — 앱이 스티커 한 장을 감추면 같은 화면이 나온다.
"""
import json, pathlib
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent
IS, IC = HERE/'img'/'sticker', HERE/'img'/'scene'
IS.mkdir(parents=True, exist_ok=True); IC.mkdir(parents=True, exist_ok=True)

n_st = n_sc = 0
blank = []
name_of = {}                                   # (scene, slot) -> 파일명
for z in range(1, 21):
    src = ROOT/'scenes'/f'zone{z:02d}'
    if not src.exists(): print(f'※ zone{z:02d} 없음'); continue
    for f in sorted((src/'stickers').glob('*.png')):
        im = Image.open(f).convert('RGBA')
        bb = im.split()[3].getbbox()
        if bb: im = im.crop(bb)
        k = 300/max(im.width, im.height)
        im = im.resize((max(1, int(im.width*k)), max(1, int(im.height*k))), Image.LANCZOS)
        if (np.asarray(im)[:, :, 3] > 10).mean() < 0.005:   # 파일은 있는데 그림이 없는 것
            blank.append(f.name)                              # (S001 이 이래서 빈 채로 나갔다)
        im.save(IS/f.name, optimize=True)
        sc, slot, _ = f.stem.split('_', 2)
        name_of[(sc, int(slot))] = f.name
        n_st += 1
    for f in sorted((src/'composed').glob('*_장면*.jpg')):
        sc = f.stem.split('_')[0]
        out = IC/(f'{sc}_민.jpg' if '글자없음' in f.stem else f'{sc}.jpg')
        Image.open(f).resize((900, 600), Image.LANCZOS).save(out, 'JPEG', quality=86,
                                                             optimize=True, progressive=True)
        n_sc += 1

# 그림 이름은 build_data.py 가 스스로 찾는다. 여기서 JSON 을 고치지 않는다.

mb = lambda p: sum(f.stat().st_size for f in p.rglob('*') if f.is_file())/1e6
print(f'스티커 {n_st}장 {mb(IS):.0f} MB · 장면 {n_sc}장 {mb(IC):.0f} MB')
print(f'그림 합계 {mb(HERE/"img"):.0f} MB')
if blank:
    print(f'※ 그림이 들어 있지 않은 스티커 {len(blank)}장 — ' + ', '.join(blank[:8]))
    raise SystemExit(1)
print('빈 그림 없음')
