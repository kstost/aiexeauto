# aiexeauto

aiexeauto는 다양한 AI 언어 모델을 활용하여 자연어 명령을 분석하고 최적의 JavaScript 코드를 자동 생성하여 실행하는 Node.js 애플리케이션입니다. WebContainer 기반의 안전한 샌드박스 환경에서 로컬 데이터를 독립적으로 분석하고 처리하며, 실행 결과를 스스로 검증하고 개선하여 주어진 작업을 완수합니다.

## 설치 방법

1. Node.js 설치
   - [Node.js 공식 웹사이트](https://nodejs.org/)에서 최신 LTS 버전을 다운로드하여 설치합니다.

2. 프로젝트 클론
   ```bash
   git clone https://github.com/kstost/aiexeauto.git
   cd aiexeauto
   ```

3. 의존성 패키지 설치
   ```bash
   npm install
   ```

4. config.js 설정
   - config.js 파일을 다음과 같이 설정합니다:
   ```javascript
   export const config = {
       openaiApiKey: "",                   // OpenAI API 키 입력
       groqApiKey: "",                     // Groq API 키 입력  
       geminiApiKey: "",                   // Google Gemini API 키 입력
       claudeApiKey: "",                   // Anthropic Claude API 키 입력
       model: "claude-3-5-haiku-20241022", // 사용할 AI 모델 지정
       llm: "claude",                      // 사용할 AI 서비스 지정
       maxIterations: 0,                   // 최대 반복 횟수 (0은 무제한)
       threeBackticks: '```',              // 코드 블록 구분자
       useFirstPlan: false,                // 첫 번째 계획 사용 여부
       dockerImage: 'my-node-ubuntu',      // 도커 이미지 이름
       useDocker: true,                    // 도커 사용 여부
       useEvaluation: false,               // AI 평가 기능 사용 여부
       dockerWorkDir: '/home/ubuntu/work'  // 도커 컨테이너 내 작업 디렉토리
   }
   ```

   - 설정 항목 설명
     - API 키 설정
       - `openaiApiKey`: OpenAI API 키
       - `groqApiKey`: Groq API 키
       - `geminiApiKey`: Google API 키
       - `claudeApiKey`: Anthropic Claude API 키

     - `llm`: 사용할 AI 서비스
       - 지원 서비스: "claude", "openai", "groq", "gemini"

     - `model`: 사용할 AI 모델
       - Claude 모델: 
           - "claude-3-5-sonnet-20241022"
           - "claude-3-5-haiku-20241022"
           [가격 정보](https://www.anthropic.com/pricing#anthropic-api)
       - OpenAI 모델:
           - "gpt-4o"
           - "gpt-4o-mini"
           - "gpt-3.5-turbo"
           [가격 정보](https://openai.com/api/pricing/)
           
       - Groq 모델:
           - "llama-3.1-70b-versatile"
           - "llama3-70b-8192"
           - "llama3-8b-8192"
           [가격 정보](https://groq.com/pricing)
       - Gemini 모델:
           - "gemini-1.5-flash"
           - "gemini-1.5-flash-8b"
           - "gemini-1.5-pro"
           - "gemini-1.0-pro"
           [가격 정보](https://ai.google.dev/pricing)

     - `maxIterations`: 최대 반복 횟수
       - 0: 무제한 반복
       - 양수: 지정된 횟수만큼만 반복

     - `useDocker`: 도커 사용 여부
       - true: 도커 컨테이너에서 코드 실행
       - false: WebContainer에서 코드 실행

     - `useFirstPlan`: AI 해결 계획 수립 여부
       - true: AI가 코드 생성 전에 해결 계획을 먼저 수립
       - false: 해결 계획 없이 바로 코드 생성 시작

     - `dockerImage`: 도커 이미지 이름
       - 커스텀 이미지 사용 가능

     - `dockerWorkDir`: 도커 작업 디렉토리
       - 컨테이너 내부 작업 경로 지정

     - `useEvaluation`: AI 평가 기능 사용 여부
       - true: AI가 각 실행 결과를 평가하고 개선 방향을 제시
       - false: 실행 결과 평가 없이 다음 단계로 진행


5. Docker 사용준비 (Docker 사용시)
   - 도커 설치
     - [도커 공식 웹사이트](https://www.docker.com/)에서 Docker Desktop 설치

   - 도커 이미지 빌드
     ```bash
     # 도커 이미지 빌드
     cd my-docker-app
     docker build -t my-node-ubuntu .

     # 이미지 확인
     docker images
     ```

   - config.js 도커 설정
     ```javascript
     export const config = {
         // ... 다른 설정들 ...
         dockerImage: 'my-node-ubuntu', // 기본값으로 둬도 됨.
         useDocker: true, // 기본값으로 둬도 됨.
         dockerWorkDir: '/home/ubuntu/work' // 기본값으로 둬도 됨.
     };
     ```



## 핵심 기능

- AI 자율 실행 및 문제해결
  - AI의 자율적 의사결정 및 코드 생성
  - 자연어 명령을 스스로 분석하여 최적의 JavaScript 코드 도출
  - 로컬 데이터를 독립적으로 분석하고 처리 방법 결정
  - 데이터 컨텍스트를 기반으로 AI 스스로 실행 전략 수립
  - 필요한 npm 패키지를 자동으로 식별하고 설치
  - 실행 결과를 스스로 검증하고 개선점 도출 및 재시도

- WebContainer 및 Docker 기반 안전한 실행 환경
  - Stackblitz WebContainer 샌드박스 활용
  - Docker 컨테이너 기반 격리 실행 환경 제공
  - 시스템 리소스 보호 및 제한된 권한 실행
  - 악성 코드 실행 방지를 위한 샌드박스 환경

## 사용법

1. 기본 실행
   ```bash
   node aiexeauto.js "<프롬프트|프롬프트를담은파일경로>" <데이터소스경로> <데이터출력경로>
   ```

2. 프롬프트 파일 사용
   ```bash
   node aiexeauto.js "tasks/task1.txt" ./data ./data-output
   ```

3. 실행 옵션 상세 설명
   - 프롬프트: 실행할 작업을 자연어로 설명하거나 프롬프트가 담긴 텍스트 파일 경로
   - 데이터소스경로: 입력 데이터가 있는 디렉토리 경로
   - 데이터출력경로: 결과물이 저장될 디렉토리 경로

4. 실행 예시
   ```bash
   # 직접 프롬프트 입력
   node aiexeauto.js "이미지 파일들의 해상도를 1024x768로 변경" ./images ./output

   # 프롬프트 파일 사용
   node aiexeauto.js "tasks/task1.txt" ./source ./result

   # ZIP 파일 처리
   node aiexeauto.js "data.zip 압축을 풀고 CSV 파일들을 병합" ./data ./processed

   # Task 1: JPG 이미지 파일 처리
   node aiexeauto.js "tasks/task1/mission.txt" "tasks/task1/input" "tasks/task1/output"

   # Task 2: 이미지 리사이즈 (320x320, 비율유지)
   node aiexeauto.js "tasks/task2/mission.txt" "tasks/task2/input" "tasks/task2/output"

   # Task 3: 파일 크기 분포 시각화
   node aiexeauto.js "tasks/task3/mission.txt" "tasks/task3/input" "tasks/task3/output"

   # Task 4: 중복 파일 제거
   node aiexeauto.js "tasks/task4/mission.txt" "tasks/task4/input" "tasks/task4/output"

   # Task 5: 추가 작업
   node aiexeauto.js "tasks/task5/mission.txt" "tasks/task5/input" "tasks/task5/output"

   # Task 6: 텍스트 파일을 읽고 이미지 생성
   node aiexeauto.js "tasks/task6/mission.txt" "tasks/task6/input" "tasks/task6/output"

   # Task 7: 모든 빈 폴더 제거
   node aiexeauto.js "tasks/task7/mission.txt" "tasks/task7/input" "tasks/task7/output"

   # 엑셀 작업 예시
   node aiexeauto.js "모든 CSV 파일을 읽어서 중복된 행을 제거하고, 결과를 Excel 파일로 저장" ./data ./result

   # 파일 정리 작업 예시
   node aiexeauto.js "파일들을 확장자별로 분류하여 각각의 폴더에 정리" ./messy ./organized

   # 아주간단한 산수계산
   node aiexeauto.js "밑변이 3이고 높이가 4인 삼각형의 넓이를 구해줘. 결과는 result.txt에 저장해줘. 그리고 그런 삼각형을 그려줘." ./data ./data-output
   ```


5. 주의사항
   - 본 프로젝트는 시험적인 프로토타입의 버전입니다. 이용에 주의 부탁드립니다.
   - AI는 실수를 할수도 있습니다. 실수로 인한 손해에 주의해주세요.
   - 입력 데이터는 반드시 디렉토리 형태로 제공합니다.
   - 설정에 따라 출력 디렉토리는 만약 존재하면 기존의 디렉토리를 덮어쓸 수 있음을 유의해주세요.

6. 면책 조항
   - 사용자는 aiexeauto 사용에 대한 전적인 책임을 집니다.

