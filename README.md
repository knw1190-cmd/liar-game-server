# 🎭 라이어 게임 서버

초등학교 수업용 실시간 라이어 게임. Socket.io 기반 멀티플레이.

## 기술 스택

- **Runtime:** Node.js 18
- **Real-time:** Socket.io
- **DB:** SQLite
- **Frontend:** React + Vite (별도 저장소)
- **Deploy:** Docker + Caddy

## 프로젝트 구조

```
liar-game-server/
├── server.js          # 메인 서버 (Socket.io + REST API)
├── __tests__/         # Jest 테스트
├── public/            # 빌드된 프론트엔드 (Docker 빌드시 자동 포함)
├── data/              # SQLite DB (볼륨 마운트)
└── Dockerfile         # 멀티스테이지 빌드 (프론트 포함)
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/teacher/login` | 교사 로그인 |
| GET | `/api/word-sets` | 단어세트 목록 |
| POST | `/api/word-sets` | 단어세트 추가 |
| PUT | `/api/word-sets/:id` | 단어세트 수정 |
| DELETE | `/api/word-sets/:id` | 단어세트 삭제 |
| POST | `/api/rooms` | 방 생성 |
| GET | `/api/rooms` | 전체 방 목록 |
| GET | `/api/rooms/:code` | 방 조회 |
| DELETE | `/api/rooms/:code` | 방 삭제 |

## Socket.io 이벤트

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `joinRoom` | client→server | 방 입장 |
| `startGame` | client→server | 게임 시작 |
| `confirmWord` | client→server | 단어 확인 |
| `submitExplanation` | client→server | 설명 제출 |
| `submitVote` | client→server | 투표 |
| `submitWordGuess` | client→server | 단어 맞히기 |
| `nextRound` | client→server | 다음 라운드 |
| `endGame` | client→server | 게임 종료 |
| `chatMessage` | 양방향 | 채팅 |

## 로컬 개발

```bash
# 서버
cd liar-game-server
npm install
npm run dev

# 프론트 (별도 터미널)
cd liar-game-frontend
npm install
npm run dev
```

## 테스트

```bash
cd liar-game-server
npm test
```

## 배포

GitHub Actions CI/CD: `main` 브랜치 푸시 시 자동 빌드 + 배포

## DB 백업

매일 새벽 3시 자동 백업 (`/home/ubuntu/backups/liar-game/`), 7일치 보관
