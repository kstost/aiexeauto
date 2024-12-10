# aiexeauto

**aiexeauto**는 자율적으로 사고하고 행동하는 인공지능 에이전트입니다. 사람의 자연어 명령을 이해하고 스스로 판단하여 컴퓨터 작업을 수행하는 혁신적인 CLI 도구입니다. 복잡한 작업도 AI 에이전트가 상황을 분석하고 최적의 방법을 찾아 자동으로 처리합니다.

## 주요 기능

- **자연어로 컴퓨터 제어**: "파일 정리해줘", "동영상 편집해줘"처럼 일상적인 말로 지시하면 AI가 알아서 실행
- **복잡한 작업도 자동으로**: 파일 관리, 이미지 편집, 문서 작업 등 번거로운 컴퓨터 작업을 AI가 대신 처리
- **Windows/Mac 모두 사용 가능**: 주요 운영체제를 모두 지원
- **작업 진행 상황 실시간 확인**: AI가 무엇을 하고 있는지 실시간으로 보여주는 깔끔한 화면 제공

## 데모 영상 보기

YouTube에서 **aiexeauto**의 기능을 한눈에 확인할 수 있는 데모 영상을 시청해보세요!.  
[여기](https://www.youtube.com/watch?v=GkOZ6fG99RI)를 클릭하여 영상을 시청할 수 있습니다.  
[![비디오 라벨](http://img.youtube.com/vi/GkOZ6fG99RI/0.jpg)](https://www.youtube.com/watch?v=GkOZ6fG99RI)

## 시스템 요구사항

- **Node.js**
- **운영체제**: 
  - Windows
  - macOS
- **Docker**

## 설치 방법

1. **Node.js 설치**
   - [Node.js 공식 웹사이트](https://nodejs.org/)에서 최신 LTS 버전을 다운로드하여 설치

2. **Docker 설치**
   - [Docker Desktop](https://www.docker.com/)에서 최신 버전을 다운로드하여 설치

3. **Docker 이미지 빌드**

   **macOS**의 경우:
   ```bash
   git clone https://github.com/kstost/aiexeauto.git && cd aiexeauto/my-docker-app && docker build --platform linux/x86_64 -t my-node-ubuntu .
   ```

   **Windows**의 경우 윈도우 검색창에서 "PowerShell"을 검색하여 관리자 권한으로 실행 후 아래 명령어를 실행합니다:
   ```powershell
   # 실행 정책 변경
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

   # 디렉토리 생성
   New-Item -ItemType Directory -Path "my-docker-app" -Force

   # 작업 디렉토리 이동
   cd my-docker-app

   # Dockerfile 다운로드
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/kstost/aiexeauto/refs/heads/main/my-docker-app/Dockerfile" -OutFile "Dockerfile"

   # Docker 이미지 빌드
   docker build --platform linux/x86_64 -t my-node-ubuntu .

   # End
   ```

4. **aiexeauto 설치**

   **Windows**의 경우:
   1. 윈도우 검색창에서 "PowerShell"을 검색하여 실행합니다
   2. PowerShell 창이 열리면 아래 명령어를 복사해서 붙여넣고 Enter를 누릅니다:
   ```powershell
   npm install -g aiexeauto
   ```

   **macOS**의 경우:
   1. Spotlight(⌘ + Space)에서 "터미널"을 검색하여 실행합니다
   2. 터미널 창이 열리면 아래 명령어를 복사해서 붙여넣고 Enter를 누릅니다:
   ```bash
   sudo npm install -g aiexeauto
   ```
   3. 관리자 암호를 입력하라는 메시지가 나타나면 Mac의 로그인 비밀번호를 입력합니다

## 기본 설정

**aiexeauto**는 Anthropic의 Claude AI 모델을 사용합니다.

### API 키 발급

1. [Claude API Console](https://console.anthropic.com/settings/keys)에 접속
2. 계정 생성 및 로그인
3. [결제 설정 페이지](https://console.anthropic.com/settings/billing)에서 신용카드 등록 및 비용 결제 설정
4. API 키 발급

### 설정 명령어

```bash
# 필수 설정
aiexeauto config claudeApiKey "sk-ant-api..."    # Claude API 키 설정

# AI 모델 설정
aiexeauto config model "claude-3-5-haiku-20241022"  # 빠르고 경제적
# 또는
aiexeauto config model "claude-3-5-sonnet-20241022" # 더 정교한 작업 수행

# 실행 환경 설정
aiexeauto config maxIterations 0                 # 반복 횟수 (0=무제한)
aiexeauto config overwriteOutputDir false        # 출력 디렉토리 덮어쓰기 여부

# Docker 설정 (선택사항)
aiexeauto config useDocker true                  # Docker 사용 여부
aiexeauto config dockerImage "my-node-ubuntu"    # Docker 이미지 이름
aiexeauto config dockerWorkDir "/home/ubuntu/work" # Docker 작업 디렉토리
```


## 사용 방법

### 기본 명령어 구조

```bash
aiexeauto "<작업_설명>" <입력_경로> <출력_경로>
```

- **작업_설명**: 수행할 작업을 자연어로 설명 (또는 설명이 담긴 텍스트 파일 경로)
- **입력_경로**: 작업에 필요한 데이터가 있는 디렉토리 (선택사항, 생략시 현재 디렉토리에 새 폴더 생성)
- **출력_경로**: 결과물을 저장할 디렉토리 (선택사항, 생략시 입력 디렉토리가 위치한 디렉토리에 새 폴더 생성)

### 사용 예시

1. **직접 명령어 입력**
   ```bash
   # 중복 파일 제거
   aiexeauto "이 폴더에서 중복된 파일들을 찾아서 하나만 남기고 삭제해줘" ./data ./output
   
   # 이미지 처리
   aiexeauto "모든 JPG 파일을 PNG로 변환하고 사이즈를 절반으로 줄여줘" ./images ./processed
   
   # 데이터 분석
   aiexeauto "CSV 파일들을 분석해서 월별 매출 통계를 차트로 만들어줘" ./sales ./report
   ```

2. **텍스트 파일로 명령어 입력**
   ```bash
   # task.txt 파일에 작업 설명을 작성
   aiexeauto "task.txt" ./data ./output
   ```

### 작업 설명 작성 팁

- **구체적으로 작성**: 원하는 결과를 명확하게 설명
- **단계별 작성**: 복잡한 작업은 여러 단계로 나누어 설명
- **조건 명시**: 특별한 조건이나 제약사항이 있다면 명확히 기술

## 주의사항

1. **데이터**
   - 중요한 데이터는 반드시 백업 후 사용
   - 실수로 인한 데이터 손실 가능성 있음

2. **인터넷과 보안**
   - AIEXEAUTO에서 기본적으로 준비하는 가상환경은 인터넷 공간에 연결되어있으며 AI는 인터넷 세계에 연결되어 현실세계에서 활동할 가능성이 존재하므로 이 부분에 주의해주시기 바랍니다.

3. **비용**
   - Claude API 사용에 따른 비용 발생
   - [Claude 요금제 확인](https://www.anthropic.com/pricing#anthropic-api)

## 문제 해결

1. **일반적인 오류**
   - API 키 오류: API 키가 올바르게 설정되었는지 확인
   - 경로 오류: 입/출력 경로가 올바른지 확인
   - 권한 오류: 필요한 디렉토리 접근 권한 확인

2. **Docker 관련 오류**
   - Docker Desktop 실행 상태 확인
   - 이미지 빌드 상태 확인
   - 리소스 할당 상태 확인

3. **도움 요청**
   - 문제 해결이 어려운 경우 [코드깎는노인 클래스](https://cokac.com)에 방문하여 도움을 요청할 수 있습니다.
   - 코드깎는노인이 친절하게 도와드립니다.

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

## 기여하기

버그 리포트, 기능 제안, 풀 리퀘스트 환영합니다.
- GitHub 이슈 트래커 사용
- 코드 기여 시 테스트 코드 포함

## 면책 조항

본 소프트웨어는 프로토타입 단계이며, 사용자는 모든 책임을 부담합니다. 중요한 데이터나 시스템에는 신중히 사용해주세요.
