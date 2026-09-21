#!/usr/bin/env python3
"""2,000단어에 발음기호(IPA)와 한글 발음을 붙인다.

  python3 발음만들기.py

발음기호  1차 1,000단어는 사전정보 엑셀의 「발음 IPA」 열을 그대로 쓰고,
          없는 것은 CMU 발음사전에서 만든다.
한글      CMU 발음사전의 소리마디를 외래어 표기법에 가깝게 한글로 옮긴다.
          「영어 소리를 한글로 적어 둔 것」이지 한글로 읽으면 된다는 뜻은 아니다.
          정확한 소리는 발음기호와 음성이 맡는다.
"""
import json, pathlib, re, sys
import cmudict, openpyxl

HERE = pathlib.Path(__file__).parent
CMU = cmudict.dict()

# ── ARPAbet → IPA ──────────────────────────────────────────────
IPA = {
 'AA':'ɑ','AE':'æ','AH':'ʌ','AO':'ɔ','AW':'aʊ','AY':'aɪ','EH':'ɛ','ER':'ɜr','EY':'eɪ',
 'IH':'ɪ','IY':'i','OW':'oʊ','OY':'ɔɪ','UH':'ʊ','UW':'u',
 'B':'b','CH':'tʃ','D':'d','DH':'ð','F':'f','G':'ɡ','HH':'h','JH':'dʒ','K':'k','L':'l',
 'M':'m','N':'n','NG':'ŋ','P':'p','R':'r','S':'s','SH':'ʃ','T':'t','TH':'θ','V':'v',
 'W':'w','Y':'j','Z':'z','ZH':'ʒ'}

def to_ipa(phones):
    out = []
    for i, p in enumerate(phones):
        b = re.sub(r'\d', '', p)
        st = p[-1] if p[-1].isdigit() else ''
        s = IPA.get(b, '')
        if st == '1': out.append('ˈ' + s)
        elif st == '2': out.append('ˌ' + s)
        else: out.append(s)
    return ''.join(out)

from _han import to_hangul            # 한글 옮기기 규칙은 _han.py 에 있다

# ── 1차 IPA 가져오기 ───────────────────────────────────────────
def load_ipa_xlsx(path):
    if not pathlib.Path(path).exists(): return {}
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb['1000개 표제어']; it = ws.iter_rows(values_only=True)
    h = list(next(it)); c = {x: i for i, x in enumerate(h)}
    out = {}
    for r in it:
        w = r[c['표제어']]; p = r[c.get('발음 IPA')] if '발음 IPA' in c else None
        if w and p: out[str(w).strip().lower()] = str(p).strip()
    return out

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else ''
    from_xlsx = load_ipa_xlsx(src)
    print(f'엑셀에서 가져온 발음기호 {len(from_xlsx)}개')

    n_ipa = n_han = n_miss = 0
    miss = []
    for f in sorted((HERE/'data'/'scene').glob('S*.json')):
        d = json.loads(f.read_text(encoding='utf-8'))
        for w in d['words']:
            key = w['w'].strip().lower()
            ph = CMU.get(key)
            if not ph and key.endswith('s'): ph = CMU.get(key[:-1])
            ph = ph[0] if ph else None
            ipa = from_xlsx.get(key) or (to_ipa(ph) if ph else None)
            han = to_hangul(ph, w['w']) if ph else None
            if ipa: w['ipa'] = ipa; n_ipa += 1
            if han: w['han'] = w.get('han') or han; n_han += 1
            if not ph: n_miss += 1; miss.append(w['w'])
        f.write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'발음기호 {n_ipa}/2000 · 한글 {n_han}/2000')
    if miss: print(f'※ 발음사전에 없는 낱말 {len(miss)}개: ' + ', '.join(miss[:20]))

if __name__ == '__main__':
    main()
