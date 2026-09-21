# 머리에 그리는 영어 스쿨

2026년 9월 21일 앱·장면 자료와 9월 20일 단어그림 1·2·3을 합친 통합본입니다.
압축을 한 번만 풀면 됩니다. 원본 ZIP 네 개를 다시 합칠 필요가 없습니다.

포함된 자료

- 장면 200개와 장면 그림 400장
- 단어 2,000개와 단어 그림 2,000장
- 시제 문장 6,000개, 대화문 4,000줄
- 미술 작품 100점과 감상 문장 1,000개
- 미술 낱말 56개

앱 탭 제목과 첫 화면 이름을 ‘머리에 그리는 영어 스쿨’로 변경했습니다.
기존 학습 내용과 기능은 유지했습니다. 한글 파일명을 정상적으로 복원하고
이미지 경로에 맞추어 폴더를 합쳤습니다. 빈 음성 목록(data/audio.json)을 넣어
미리 녹음된 MP3가 없다는 상태를 명시했습니다.

음성은 기존 앱의 브라우저 음성합성 기능을 이용합니다. MP3 파일은 포함되어
있지 않습니다. 실제 목소리와 마이크 동작은 사용하는 기기와 브라우저에 따라
달라집니다. 이번 통합 작업에서는 실제 소리 재생과 마이크 입력은 검증하지
않았습니다.

## GitHub에 올리기

파일이 3,000개 이상이므로 GitHub Desktop을 사용하세요.

1. https://desktop.github.com/ 에서 Mac용 GitHub Desktop을 설치하고 EduhongT 계정으로 로그인합니다.
2. File → Clone Repository → URL에서 다음 저장소를 지정합니다.

   https://github.com/EduhongT/meorie-english-school.git

3. Clone을 누르고, Repository → Show in Finder로 복제한 폴더를 엽니다.
4. 통합 ZIP을 풀어 만든 meorie-english-school 폴더 안의 내용물을 복제한 폴더 안에 복사합니다. 바깥 폴더 자체를 넣지 않습니다.
5. 복제한 폴더를 열었을 때 index.html, app.js, app.css, data, img가 바로 보여야 합니다.
6. GitHub Desktop에서 변경 목록을 확인하고 Summary에 ‘머리에 그리는 영어 스쿨 최초 등록’을 입력합니다.
7. Commit to main을 누른 다음 Push origin을 누릅니다. 첫 업로드에서는 Publish branch가 표시될 수 있습니다.

원본 ZIP 네 개나 통합 ZIP 자체는 저장소에 올리지 않습니다.

공식 복제 안내: https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop

## 웹 주소로 실행하기

파일 업로드 후 웹사이트 게시 설정을 별도로 진행합니다.
이 통합본은 아직 GitHub에 업로드하거나 게시하지 않았습니다.

현재 저장소는 Private입니다. GitHub Free에서는 비공개 저장소의 GitHub Pages를
사용할 수 없으므로, 게시 전에 계정 요금제와 공개 범위를 확인해야 합니다.
비공개 저장소에서 Pages를 지원하는 요금제여도 일반적인 Pages 사이트는
인터넷에 공개됩니다. 저장소를 비공개로 두는 것과 사이트의 접근 제한은 다릅니다.

공식 게시 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## 컴퓨터에서 먼저 확인하기

index.html을 더블클릭해 여는 방식으로는 JSON 자료를 읽지 못할 수 있습니다.
Python 3가 설치된 컴퓨터에서 이 폴더를 터미널로 열고 다음을 실행합니다.

```sh
python3 -m http.server 8000
```

브라우저에서 http://localhost:8000 을 엽니다. 종료할 때는 터미널에서 Ctrl+C를 누릅니다.

통합 검증: 원본의 검사.py가 모든 그림 연결·자료 개수 검사를 통과했으며,
JavaScript 문법 검사 및 하위 경로에서 주요 파일을 HTTP로 읽는 검사를 통과했습니다.
화면을 실제 브라우저에서 클릭하는 검사는 이번 작업 환경에서 수행하지 못했습니다.
