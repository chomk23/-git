# 🛡️ 보안 교육 플랫폼

> 직장인을 위한 인터랙티브 정보보안 교육 사이트. 게임, 시뮬레이션, AI 자동 출제로 지루한 보안 교육을 재미있게.

**🔗 Live Demo:** [https://your-project.vercel.app](https://git-ashen-xi.vercel.app/login.html)

---

## ✨ 주요 기능

### 👤 사용자 대시보드 (`index.html`)
- **개인 학습 현황** — 평균 점수, 목표 달성률, 부서 정보 표시
- **교육 코스 카드** — 게임별 테마 이미지 (보안 레이싱은 실제 게임 스크린샷)
- **6가지 탭 필터** — 전체 / 수강 중 / 완료 / 시험 결과 / 업적 / 리더보드
- **시험 결과** — 게임별 최고점, 통과 기준, 통과/재도전 상태
- **업적 시스템** — 학습 기록, 점수 추이 차트 (Chart.js)
- **리더보드** — 전사 개인 순위 + 부서별 평균/총점 순위 (본인 부서 하이라이트)

### 🎮 4가지 교육 콘텐츠

| 콘텐츠 | 파일 | 형식 | 설명 |
|--------|------|------|------|
| **보안 레이싱** | `security-race.html` | 80년대 픽셀 아케이드 레이싱 | 60초 안에 보안 퀴즈 풀며 AI 2대와 경주. 정답 = 부스트, 오답 = 1초 정지 |
| **CyberGuard Corp** | `cyberguard.html` | 시나리오 기반 시뮬레이션 | 가상 회사에서 보안 상황 판단 훈련 |
| **OX 퀴즈** | `gamification.html` | 게이미피케이션 퀴즈 | AI가 매 라운드 새로운 10문항 자동 생성 |
| **피싱 탐지 훈련** | `gamification.html` | 이메일 시뮬레이션 | AI 생성 6개 이메일 중 피싱/정상 판별 |

### 🎣 실전 피싱 시뮬레이션
- 관리자가 직원에게 실제 피싱 메일 발송 (Resend)
- 클릭 시 `phishing-warning.html`로 리디렉션 → 교육 콘텐츠 제공
- 클릭률, 신고율 자동 집계
- AI(Claude)로 피싱 템플릿 자동 생성

### 🔐 관리자 페이지
| 페이지 | 기능 |
|--------|------|
| `admin.html` | 메인 대시보드 — 전체 통계 |
| `admin-users.html` | 수강생 관리 — 부서·역할·점수 관리 |
| `admin-courses.html` | 강의 관리 — 코스 추가/수정/통과 기준 설정 |
| `admin-phishing.html` | 피싱 훈련 — 캠페인 발송, 결과 추적 |
| `admin-report.html` | 리포트 — CSV 내보내기, 차트 분석 |
| `admin-settings.html` | 사이트 설정 — 브랜드, 정책 관리 |

---

## 🏗️ 기술 스택

**프론트엔드**
- 순수 HTML + Tailwind CSS (CDN)
- Chart.js (점수 시각화)
- SVG 기반 픽셀 아트 (보안 레이싱)
- Press Start 2P + Noto Sans KR 폰트

**백엔드 / 인프라**
- **Vercel** — 정적 호스팅 + 서버리스 함수
- **Supabase** — Postgres DB + Row Level Security + Auth
- **Resend** — 이메일 발송 (피싱 시뮬레이션용)
- **Anthropic Claude API** (Haiku 4.5) — 퀴즈·피싱 템플릿 자동 생성

**보안 헤더 (vercel.json)**
- HSTS (preload 포함)
- Content-Security-Policy (script-src 화이트리스트)
- X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Permissions-Policy (camera, mic, geolocation 등 차단)

---

## 📁 프로젝트 구조

```
.
├── index.html              # 사용자 대시보드
├── login.html              # 로그인
├── cyberguard.html         # CyberGuard Corp 시뮬레이션
├── gamification.html       # OX 퀴즈 + 피싱 탐지
├── security-race.html      # 보안 레이싱 게임
├── phishing-warning.html   # 피싱 클릭 시 경고 페이지
├── admin*.html             # 관리자 페이지 (6개)
├── api/
│   ├── send-phishing.js              # 피싱 메일 발송 (Resend)
│   ├── generate-quiz.js              # OX 퀴즈 AI 생성
│   ├── generate-phishing-template.js # 피싱 템플릿 AI 생성
│   ├── phishing-click.js             # 피싱 클릭 추적
│   ├── reset-phishing-sessions.js    # 캠페인 리셋
│   ├── admin-courses.js              # 강의 CRUD
│   ├── admin-update-user.js          # 사용자 정보 수정
│   └── admin-settings.js             # 설정 관리
├── images/race-cover.png   # 코스 카드 이미지
├── brand_logo/             # 브랜드 로고
├── supabase.js             # Supabase 클라이언트 (anon key)
└── vercel.json             # 보안 헤더 + 라우팅
```

---

## 🗄️ 데이터베이스 스키마 (Supabase)

| 테이블 | 용도 |
|--------|------|
| `profiles` | 사용자 정보 (이메일, 이름, 부서, 역할) |
| `courses` | 교육 코스 (제목, 게임 타입, 통과 기준) |
| `game_scores` | 게임별 점수 기록 |
| `phishing_sessions` | 피싱 캠페인 세션 |
| `phishing_clicks` | 피싱 클릭/신고 이벤트 |
| `app_settings` | 사이트 글로벌 설정 |

---

## 🚀 배포 방법

1. **Supabase 프로젝트 생성** → URL/anon key 확보
2. **테이블 생성** → 위 스키마대로 SQL 실행
3. **Resend 가입** → API key 발급
4. **Anthropic 가입** → API key 발급
5. **Vercel에 GitHub 연동 후 Import**
6. **환경변수 등록**
   ```
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   RESEND_API_KEY
   ANTHROPIC_API_KEY
   SITE_URL
   ```
