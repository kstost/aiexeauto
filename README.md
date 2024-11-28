# aiexeauto

aiexeauto는 다양한 AI 언어 모델을 활용하여 자연어 명령을 분석하고 최적의 JavaScript 코드를 자동 생성하여 실행하는 Node.js 애플리케이션입니다. WebContainer 기반의 안전한 샌드박스 환경에서 로컬 데이터를 독립적으로 분석하고 처리하며, 실행 결과를 스스로 검증하고 개선하여 주어진 작업을 완수합니다.

## 설치 방법

1. Node.js 설치
   - [Node.js 공식 웹사이트](https://nodejs.org/)에서 최신 LTS 버전을 다운로드하여 설치합니다.

2. aiexeauto 설치
   ```bash
   npm install -g aiexeauto
   ```

3. 설정
   Claude 모델: 
      - "claude-3-5-sonnet-20241022"
      - "claude-3-5-haiku-20241022"
      [가격 정보](https://www.anthropic.com/pricing#anthropic-api)

   ```bash
   aiexeauto config claudeApiKey "your-claude-api-key" # Claude API 키 설정
   aiexeauto config model "claude-3-5-haiku-20241022" # 사용할 AI 모델 지정
   aiexeauto config llm "claude" # 사용할 AI 서비스 지정
   aiexeauto config maxIterations 0 # 최대 반복 횟수 (0은 무제한)
   aiexeauto config dockerImage "my-node-ubuntu" # 도커 이미지 이름
   aiexeauto config useDocker true # 도커 사용 여부
   aiexeauto config dockerWorkDir "/home/ubuntu/work" # 도커 컨테이너 내 작업 디렉토리
   ```


4. Docker 사용준비 (Docker 사용시)
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

   - 도커 설정
     ```bash
     aiexeauto config dockerImage "my-node-ubuntu" # 도커 이미지 이름
     aiexeauto config useDocker true # 도커 사용 여부
     aiexeauto config dockerWorkDir "/home/ubuntu/work" # 도커 컨테이너 내 작업 디렉토리
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
   aiexeauto "<프롬프트|프롬프트를담은파일경로>" <데이터소스경로> <데이터출력경로>
   ```

2. 프롬프트 파일 사용
   ```bash
   aiexeauto "tasks/task1.txt" ./data ./data-output
   ```

3. 실행 옵션 상세 설명
   - 프롬프트: 실행할 작업을 자연어로 설명하거나 프롬프트가 담긴 텍스트 파일 경로
   - 데이터소스경로: 입력 데이터가 있는 디렉토리 경로
   - 데이터출력경로: 결과물이 저장될 디렉토리 경로

4. 주의사항
   - 본 프로젝트는 시험적인 프로토타입의 버전입니다. 이용에 주의 부탁드립니다.
   - AI는 실수를 할수도 있습니다. 실수로 인한 손해에 주의해주세요.
   - 입력 데이터는 반드시 디렉토리 형태로 제공합니다.
   - 설정에 따라 출력 디렉토리는 만약 존재하면 기존의 디렉토리를 덮어쓸 수 있음을 유의해주세요.

5. 면책 조항
   - 사용자는 aiexeauto 사용에 대한 전적인 책임을 집니다.

