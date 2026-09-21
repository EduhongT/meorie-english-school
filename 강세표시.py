#!/usr/bin/env python3
"""발음기호와 한글 발음에서 힘주어 읽는 자리를 찾아 표시해 둔다.

  python3 강세표시.py

장면 자료에 두 가지를 더한다.
  hs   한글 발음에서 힘주는 글자가 몇 번째인가 (0부터)
  ir   발음기호에서 힘주는 모음이 어디부터 어디까지인가 [시작, 끝]

찾는 방법
  발음사전이 알려 주는 「몇 번째 모음에 힘이 들어가는가」를 그대로 쓴다.
  한글에서는 「으」가 든 글자를 건너뛴다 — 그것은 영어에 없는 소리이고
  자음을 적으려고 붙인 글자이기 때문이다 (슬립의 「슬」).
"""
import json, pathlib, re
import cmudict

CMU = cmudict.dict()
HERE = pathlib.Path(__file__).parent
IPA_V = 'iɪeɛæɑɔoʊuʌɜəaæyː'          # 발음기호에서 모음으로 볼 글자
JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'

def stressed_vowel_index(phones):
    """몇 번째 모음에 힘이 들어가는가 (0부터). 없으면 0."""
    k = 0
    for p in phones:
        if p[-1].isdigit():
            if p[-1] == '1': return k
            k += 1
    return 0

CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'

def hangul_stress(han, k):
    """한글에서 k번째(0부터) 소리 글자를 찾는다.
       「으」 글자는 자음을 적으려고 붙인 것이라 세지 않는다 (슬립의 「슬」).
       앞 글자에 딸린 「이·우」도 세지 않는다 — 타이푼의 「이」는 ai 한 소리의 일부다."""
    idx = []
    for i, c in enumerate(han):
        if not ('가' <= c <= '힣'): continue
        code = ord(c) - 0xAC00
        cho = CHO[code // 588]; jung = JUNG[(code // 28) % 21]
        if jung == 'ㅡ': continue
        if idx and cho == 'ㅇ' and jung in ('ㅣ', 'ㅜ') and (code % 28) == 0:
            continue
        idx.append(i)
    if not idx: return None
    return idx[k] if k < len(idx) else idx[-1]

def ipa_stress(ipa, k):
    """발음기호에서 k번째 모음 덩어리가 어디부터 어디까지인가."""
    runs = [(m.start(), m.end()) for m in re.finditer(f'[{IPA_V}]+', ipa)]
    if not runs: return None
    return list(runs[k] if k < len(runs) else runs[-1])

def main():
    n_h = n_i = n_no = 0
    for f in sorted((HERE/'data'/'scene').glob('S*.json')):
        d = json.loads(f.read_text(encoding='utf-8'))
        for w in d['words']:
            ph = CMU.get(w['w'].strip().lower())
            if not ph and w['w'].lower().endswith('s'): ph = CMU.get(w['w'][:-1].lower())
            if not ph: n_no += 1; continue
            k = stressed_vowel_index(ph[0])
            if w.get('han'):
                h = hangul_stress(w['han'], k)
                if h is not None: w['hs'] = h; n_h += 1
            if w.get('ipa'):
                r = ipa_stress(w['ipa'].replace('ˈ', '').replace('ˌ', ''), k)
                # ˈ 를 지운 뒤 자리를 재므로 발음기호도 지운 것으로 바꿔 둔다
                if r: w['ipa'] = w['ipa'].replace('ˈ', '').replace('ˌ', ''); w['ir'] = r; n_i += 1
        f.write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'한글 {n_h}개 · 발음기호 {n_i}개에 힘주는 자리를 표시했습니다')
    if n_no: print(f'※ 발음사전에 없어 건너뛴 낱말 {n_no}개')

if __name__ == '__main__':
    main()
