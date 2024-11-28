# aiexeauto

aiexeauto는 컴퓨터에서 필요한 작업을 명령을 받아 대신 수행해주는 인공지능 에이전트입니다.

## 설치 방법

1. **Node.js 설치**
   - [Node.js 공식 웹사이트](https://nodejs.org/)에서 최신 LTS 버전을 다운로드하여 설치합니다.

2. **aiexeauto 설치**

   **Windows:**
   - 작업표시줄 검색창에서 `PowerShell`을 검색하여 `PowerShell` 아이콘을 더블클릭합니다.
   - 명령어 입력창에 다음 명령어를 입력합니다:
     ```powershell
     npm install -g aiexeauto
     ```

   **macOS:**
   - 터미널을 열고 다음 명령어를 입력합니다:
     ```bash
     sudo npm install -g aiexeauto
     ```

3. **설정**

   aiexeauto는 Anthropic의 Claude AI 모델을 사용하여 작업을 수행합니다.

   **지원 모델:**
   - Claude 3 Haiku (추천) - 빠른 응답, 합리적인 가격
   - Claude 3 Sonnet - 더 정교한 작업 수행 가능

   [Claude 요금제 확인하기](https://www.anthropic.com/pricing#anthropic-api)

   **기본 설정:**

   Windows와 macOS 공통으로 PowerShell 또는 터미널에서 다음 명령어를 입력하여 설정합니다:

   ```bash
   # API 키 및 모델 설정
   aiexeauto config claudeApiKey "sk-ant-api...."          # Claude API 키 (기본값: "") https://console.anthropic.com/settings/keys 에서 발급 가능
   aiexeauto config model "claude-3-5-haiku-20241022"      # AI 모델 선택 (기본값: "claude-3-5-haiku-20241022")
   aiexeauto config llm "claude"                           # AI 서비스 지정 (기본값: "claude")

   # 실행 환경 설정
   aiexeauto config maxIterations 0                        # 반복 횟수 (0=무제한) (기본값: 0)
   aiexeauto config overwriteOutputDir false               # 덮어쓰기 여부 (false: 덮어쓰지 않음, true: 덮어씀) (기본값: false)

   # 도커 설정 (Docker 사용 시)
   aiexeauto config useDocker true                         # Docker 사용 여부 (true: 사용, false: 사용 안 함) (기본값: false)
   aiexeauto config dockerImage "my-node-ubuntu"           # Docker 이미지 (기본값: "my-node-ubuntu")
   aiexeauto config dockerWorkDir "/home/ubuntu/work"      # 작업 디렉터리 (기본값: "/home/ubuntu/work")
   ```

4. **Docker 환경 구성 (선택사항, macOS에서만 사용 가능)**

   - **Docker Desktop 설치**
     - [Docker 공식 웹사이트](https://www.docker.com/)에서 운영체제에 맞는 버전을 다운로드 및 설치합니다.

   - **aiexeauto Docker 이미지 생성**
     ```bash
     # 저장소 클론 및 이미지 빌드
     git clone https://github.com/kstost/aiexeauto.git
     cd aiexeauto/my-docker-app
     docker build -t my-node-ubuntu .
     docker images
     ```

   - **Docker 실행 환경 설정**
     ```bash
     # 기본 설정값으로 자동 구성됩니다
     aiexeauto config dockerImage "my-node-ubuntu"      # 이미지명
     aiexeauto config useDocker true                    # Docker 활성화
     aiexeauto config dockerWorkDir "/home/ubuntu/work" # 작업 디렉터리
     ```

## 사용법

1. **기본 실행**
   ```bash
   aiexeauto "<프롬프트|프롬프트를담은파일경로>" <데이터소스경로> <데이터출력경로>
   ```

2. **실행 옵션 상세 설명**
   - **프롬프트**: 실행할 작업을 자연어로 설명하거나 프롬프트가 담긴 텍스트 파일 경로 (필수)
   - **데이터소스경로**: 입력 데이터가 있는 디렉터리 경로 (선택사항: 빈칸으로 두면 현재 디렉터리에 소스 폴더를 생성함)
   - **데이터출력경로**: 결과물이 저장될 디렉터리 경로 (선택사항: 빈칸으로 두면 현재 디렉터리에 출력 폴더를 생성함)

3. **프롬프트 텍스트 사용**
   ```bash
   aiexeauto "폴더 안에 담긴 중복 파일을 모두 찾아서 고유한 파일 하나 남기고 다 지워줘." ./data ./data-output
   ```

4. **프롬프트 파일 사용**
   ```bash
   aiexeauto "task1.txt" ./data ./data-output
   ```

5. **주의사항**
   - 본 프로젝트는 시험적인 프로토타입 버전입니다. 이용에 주의 부탁드립니다.
   - AI는 실수를 할 수도 있습니다. 실수로 인한 손해에 주의해주세요.
   - 입력 데이터는 반드시 디렉터리 형태로 제공합니다.
   - 설정에 따라 출력 디렉터리는 기존 디렉터리를 덮어쓸 수 있으니 유의해주세요.

6. **면책 조항**
   - 사용자는 aiexeauto 사용에 대한 전적인 책임을 집니다.