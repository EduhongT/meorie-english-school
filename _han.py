
import re
CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
JUNG='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
JONG=' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'
def syl(c,v,t=' '): return chr(0xAC00+(CHO.index(c)*21+JUNG.index(v))*28+JONG.index(t))

SHORT={'AE','EH','IH','AH','UH','AA','AO'}
DIPH={'EY':'이','AY':'이','OY':'이','AW':'우'}
VOW={'AA':'ㅏ','AE':'ㅐ','AH':'ㅓ','AO':'ㅗ','EH':'ㅔ','ER':'ㅓ','IH':'ㅣ','IY':'ㅣ',
     'UH':'ㅜ','UW':'ㅜ','OW':'ㅗ','EY':'ㅔ','AY':'ㅏ','AW':'ㅏ','OY':'ㅗ'}
ONSET={'P':'ㅍ','B':'ㅂ','T':'ㅌ','D':'ㄷ','K':'ㅋ','G':'ㄱ','F':'ㅍ','V':'ㅂ','TH':'ㅅ',
       'DH':'ㄷ','S':'ㅅ','Z':'ㅈ','SH':'ㅅ','ZH':'ㅈ','CH':'ㅊ','JH':'ㅈ','M':'ㅁ','N':'ㄴ',
       'NG':'ㅇ','L':'ㄹ','R':'ㄹ','HH':'ㅎ'}
EU={'P':'ㅍ','B':'ㅂ','T':'ㅌ','D':'ㄷ','K':'ㅋ','G':'ㄱ','F':'ㅍ','V':'ㅂ','TH':'ㅅ',
    'DH':'ㄷ','S':'ㅅ','Z':'ㅈ','M':'ㅁ','N':'ㄴ','L':'ㄹ','HH':'ㅎ'}
STOPC={'P':'ㅂ','T':'ㅅ','K':'ㄱ'}
NASL={'M':'ㅁ','N':'ㄴ','NG':'ㅇ','L':'ㄹ'}
YMERGE={'ㅏ':'ㅑ','ㅐ':'ㅒ','ㅓ':'ㅕ','ㅔ':'ㅖ','ㅗ':'ㅛ','ㅜ':'ㅠ','ㅣ':'ㅣ'}
WMERGE={'ㅏ':'ㅘ','ㅐ':'ㅙ','ㅓ':'ㅝ','ㅔ':'ㅞ','ㅣ':'ㅟ','ㅗ':'ㅝ','ㅜ':'ㅜ'}
EXC={'coffee':'커피','water':'워터','orange':'오렌지','radio':'라디오','video':'비디오',
     'camera':'카메라','banana':'바나나','tomato':'토마토','piano':'피아노','model':'모델',
     'hotel':'호텔','pizza':'피자','sofa':'소파','toilet':'화장실','energy':'에너지',
     'idea':'아이디어','area':'에어리어','city':'시티','party':'파티','study':'스터디'}

def _b(p): return re.sub(r'\d','',p)

def to_hangul(phones, word=''):
    if word.lower() in EXC: return EXC[word.lower()]
    ph=[_b(p) for p in phones]
    stress=[p[-1] if p[-1].isdigit() else '0' for p in phones]
    n=len(ph); out=[]
    # 모음 자리
    vi=[i for i,p in enumerate(ph) if p in VOW]
    if not vi:
        return ''.join(syl(EU.get(p,'ㅇ'),'ㅡ') for p in ph)
    prev_end=0; skip=set()
    for k,i in enumerate(vi):
        if i in skip: continue
        cl=ph[prev_end:i]                       # 이 모음 앞의 자음 덩어리
        v=VOW[ph[i]]; cho='ㅇ'; glide=DIPH.get(ph[i])
        if ph[i]=='AH' and stress[i]=='0':
            rest=ph[i+1:]
            if not rest: v='ㅏ'                                   # umbrella 엄브렐라
            elif len(rest)==1 and rest[0] in ('N','L') \
                 and not (ph[i-1:i] and ph[i-1] in ('SH','ZH','CH','JH')):
                v='ㅡ'                                            # open 오픈 · table 테이블
        if ph[i]=='OW': glide=None              # pillow 필로, open 오픈
        # Y·W 반모음 흡수
        if cl and cl[-1]=='Y':
            cl=cl[:-1]; v=YMERGE.get(v,v)
        elif cl and cl[-1]=='W':
            cl=cl[:-1]; v=WMERGE.get(v,v)
        if not cl and k>0 and ph[vi[k-1]]=='ER':
            cho='ㄹ'                                              # gallery 갤러리
        if cl:
            last=cl[-1]
            cho=ONSET.get(last,'ㅇ')
            if last in ('SH','ZH','CH','JH'):
                if last=='SH': v=YMERGE.get(v,v)          # station 스테이션
                cho={'SH':'ㅅ','ZH':'ㅈ','CH':'ㅊ','JH':'ㅈ'}[last]
            # 앞의 자음들은 받침이나 「으」 음절로
            for j,c in enumerate(cl[:-1]):
                nxt=cl[j+1]
                if c=='R': continue                              # morning 모닝
                if c in NASL and out and (ord(out[-1])-0xAC00)%28==0 and 0xAC00<=ord(out[-1])<=0xD7A3:
                    out[-1]=chr(ord(out[-1])+JONG.index(NASL[c]))
                elif c in STOPC and out and (ord(out[-1])-0xAC00)%28==0 \
                     and 0xAC00<=ord(out[-1])<=0xD7A3 and k>0 and ph[vi[k-1]] in SHORT:
                    out[-1]=chr(ord(out[-1])+JONG.index(STOPC[c]))   # picture 픽처
                else:
                    t='ㄹ' if nxt=='L' else ' '                      # class 클래스
                    out.append(syl(EU.get(c,'ㅇ'),'ㅡ',t))
            if last=='L' and out and 0xAC00<=ord(out[-1])<=0xD7A3 \
               and (ord(out[-1])-0xAC00)%28==0 and k>0:
                out[-1]=chr(ord(out[-1])+JONG.index('ㄹ'))           # gallery 갤러리
        nxt_v = ph[vi[k+1]] if k+1 < len(vi) else None
        if glide=='우' and nxt_v=='ER' and i+1==vi[k+1]:
            out.append(syl(cho,v)); out.append('워')
            skip.add(vi[k+1]); prev_end=vi[k+1]+1
            continue                                              # flower 플라워
        out.append(syl(cho,v))
        if glide: out.append(glide)
        prev_end=i+1
    # 마지막 모음 뒤의 자음
    lastv_i=vi[-1]
    tail=ph[lastv_i+1:]
    lastv=ph[lastv_i]
    short=lastv not in DIPH                                       # sleep 슬립 · cake 케이크
    for j,c in enumerate(tail):
        end=(j==len(tail)-1)
        if c=='R' and end: continue
        if c=='R':
            out.append(syl('ㄹ','ㅓ')); continue
        if c in NASL and 0xAC00<=ord(out[-1])<=0xD7A3 and (ord(out[-1])-0xAC00)%28==0:
            out[-1]=chr(ord(out[-1])+JONG.index(NASL[c])); continue
        if c in STOPC and short and 0xAC00<=ord(out[-1])<=0xD7A3 \
           and (ord(out[-1])-0xAC00)%28==0:
            out[-1]=chr(ord(out[-1])+JONG.index(STOPC[c])); continue
        if c in ('SH','ZH'): out.append('시' if c=='SH' else '지'); continue
        if c in ('CH','JH'): out.append('치' if c=='CH' else '지'); continue
        if c in ('TH','DH','S','Z','F','V'):
            out.append(syl({'TH':'ㅅ','DH':'ㄷ','S':'ㅅ','Z':'ㅈ','F':'ㅍ','V':'ㅂ'}[c],'ㅡ')); continue
        out.append(syl(EU.get(c,'ㅇ'),'ㅡ'))
    return ''.join(out)

