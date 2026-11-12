# BriefPay (브리프페이) 기획서 및 구현 가이드

PayPal AI Hackathon: Build What's Next with PayPal and AI  
작성일: 2026-11-11 (KST)  
대상 독자: 이 문서를 읽고 바로 구현할 개발 에이전트(Grok)와 제출자  
문서 목적: 해커톤 제출용 작동 프로토타입을 짧은 시간 안에 완성하기 위한 단일 기준 문서

---

## 0. 한 줄 요약

**BriefPay는 의뢰인이 올린 작업 브리프와 프리랜서의 결과물을 AI가 대조해 검증하고, 통과할 때만 PayPal로 대금을 지급하는 결과물 검증형 에스크로입니다.**

“작업 완료 버튼을 누르면 송금”이 아닙니다. 에이전트가 제출된 웹사이트, GitHub, 스테이징 URL을 직접 열어보고, 브리프의 수용 기준(acceptance criteria)과 맞춰 본 뒤에만 승인을 캡처합니다.

---

## 1. 해커톤 제약 (반드시 지킬 것)

- 공식 제출: https://paypalaihackathon.devpost.com/
- 규칙: https://paypalaihackathon.devpost.com/rules
- **제출 마감: 2026-11-13 05:00 KST** (2026-11-12 12:00 PST)
- 심사 기간: 2026-12-02 07:00 KST ~ 2026-12-16 01:00 KST
- 수상 발표: 2026-12-22 07:00 KST 전후
- 참가 자격: 거주지 성년. 한국 거주자 가능. 제외 지역은 브라질, 퀘벡, 러시아, 크림, 쿠바, 이란, 북한 및 OFAC 제재국. 팀 전원 자격이 있어야 함.
- 필수 조건: PayPal과 AI를 **둘 다 의미 있게** 사용할 것. 시안/목업만 있으면 실격.
- 제출물:
  1. 작동하는 프로토타입 (저장소에 실행 방법이 명확하거나, 호스팅된 데모 URL)
  2. 공개 GitHub/GitLab/Bitbucket 저장소 + 상단 About에 보이는 오픈소스 라이선스 파일 (MIT 권장)
  3. 3분 미만 공개 YouTube 데모. 실제 동작 화면이 나와야 함. 제3자 상표/저작권 음악 금지.
  4. 사용한 AI/도구와 PayPal API를 설명하는 텍스트
- 상금 규칙: 한 작품은 **대상(1~3등) 또는 특별상 하나** + **스폰서상 하나**까지 가능. 스폰서 도구를 여러 개 써도 스폰서상은 하나만 수상.
- 본상 심사에 협력사 도구 가산점은 없음. 협력사 도구는 별도 스폰서상 자격과, 의미 있게 쓰였을 때의 기술 구현 점수에만 영향.
- 기존 프로젝트여도 제출 기간 중 의미 있는 진전이 있으면 가능. 이 프로젝트는 신규로 만든다.

### 노릴 상

1. 본상 또는 특별상 중 하나: **Best Use of Agentic Commerce ($5,000)** 또는 Most Creative ($5,000). 종합 대상도 열려 있지만 참가자가 약 3만 4천 명이므로 에이전틱 커머스/창의성 レーン을 1순위로 한다.
2. 스폰서상 하나: **Best Use of Bryntum ($1,000, 3팀)** 을 1순위로 한다. 대시보드용 AG Grid는 많은 팀이 쓸 가능성이 높아, 일정/마일스톤 Gantt가 더 차별화된다. 여유 있으면 APIMatic($1,000, 3팀)과 Render 크레딧도 자격은 만들어 두되, 수상은 하나라는 점을 기억한다.

### 심사 5항목 (동일 비중)에 맞추는 방법

| 항목 | BriefPay에서 증명하는 방법 |
| --- | --- |
| Technological Implementation | PayPal Authorize/Capture, Invoice, 웹훅 + Agent Toolkit 다단계 툴 호출 + Kernel 브라우징이 한 파이프라인으로 동작 |
| Design | 의뢰인/프리랜서 역할이 나뉜 완결된 제품 화면. 데모 계정이 바로 들어가지게 할 것 |
| Potential Impact | 프리랜서 거래의 실제 분쟁(결과물이 브리프와 다름)을 구체적으로 해결. 대상 사용자를 “프리랜서 마켓플레이스의 의뢰인”으로 고정 |
| Innovation/Idea | 주최 측 예시인 “완료 체크 후 자동 송금”과 분명히 다를 것. **결과물 검증 후 지급**이 핵심 메시지 |
| Presentation | 3분 영상이 문제 → 검증 → 지급/반려를 끝까지 보여 줄 것 |

---

## 2. 문제와 타깃

- 대상: 웹/디자인/개발 작업을 외주하는 소규모 의뢰인과, 그 일을 받는 프리랜서.
- 문제: 의뢰인은 돈을 먼저 주기 두렵고, 프리랜서는 일을 끝내고도 못 받을까 봐 두렵다. 기존 “에스크로”는 대개 사람이 ‘완료’를 누르거나 분쟁이 난 뒤에야 움직인다. 결과물이 브리프를 충족했는지는 자동으로 확인되지 않는다.
- 핵심 가치: 대금은 PayPal에 먼저 묶여 있고, AI가 결과물을 브리프와 대조해 통과할 때만 지급된다. 반려 시에는 무엇이 부족한지 근거와 함께 수정 요청이 간다. 의뢰인의 수동 오버라이드도 가능하다.

이 문서를 구현할 때 제품을 일반 “AI 쇼핑몰”이나 “영수증 더치페이”로 넓히지 말 것. 수직을 지킨다.

---

## 3. 데모에서 반드시 보여줄 해피 패스 / 실패 패스

시간이 부족하므로 **기능은 이 두 시나리오만 완벽하게** 만든다. 그 외는 넣지 않는다.

### 시나리오 A (통과 → 지급)

1. 의뢰인 `client@demo.com`으로 로그인한다.
2. 새 작업 “랜딩페이지 리뉴얼”을 만든다.
   - 예산: USD 150 (샌드박스)
   - 마감: 3일 후
   - 브리프와 수용 기준 3~4개를 미리 넣어 둔 데모 데이터로 바로 진행해도 된다.
   - 수용 기준 예시:
     - 히어로 영역에 제품명과 CTA 버튼이 있다
     - 가격표 섹션이 있고 플랜이 3개다
     - 모바일 너비에서도 CTA가 보인다
     - 연락처 또는 문의 폼이 있다
3. PayPal Checkout(샌드박스)으로 USD 150을 **승인(Authorize, 캡처 전)** 한다. 화면에는 “대금이 에스크로로 묶였습니다”라고 표시한다.
4. 프리랜서 `freelancer@demo.com`으로 전환(또는 한 브라우저 시크릿/역할 전환 버튼)한다.
5. 작업을 수락하고, 결과물로 **미리 준비된 스테이징 URL**을 제출한다. (데모용 정적 페이지를 이 저장소에 함께 둔다. 통과용 `/demo/pass`, 반려용 `/demo/fail` 두 페이지.)
6. “AI 검증 시작”을 누른다.
7. 에이전트가 Kernel로 URL을 열고, 각 수용 기준에 대해 근거(발췌/스크린샷 URL/관찰)와 pass/fail을 표로 보여 준다. Bryntum 타임라인에 “제출됨 → 검증 중 → 통과”가 반영된다.
8. 종합 통과 시 PayPal **Capture**가 실행되고, 인보이스 영수증이 생성되며, 상태가 “지급 완료”가 된다.

### 시나리오 B (미통과 → 대금 유지, 수정 요청)

1. 같은 작업 흐름에서 결과물을 `/demo/fail` (CTA 없음, 요금제 1개만 있음)로 제출한다.
2. 에이전트가 실패한 기준과 이유를 명시한다.
3. **Capture를 호출하지 않는다.** 대금은 계속 홀드.
4. 프리랜서에게 수정 요청이 생성되고, 의뢰인은 “강제 승인(수동 지급)” 또는 “작업 취소 후 승인 취소(Void)”를 할 수 있다. 데모에서는 수정 요청 화면까지 보여 주면 충분하다.

---

## 4. 스코프

### Must (없으면 제출하지 말 것)

- 의뢰인/프리랜서 두 역할. 데모용 시드 계정과 “역할 전환”이 있어야 한다. 복잡한 회원가입은 생략 가능 (매직 로그인 또는 고정 데모 로그인).
- 작업 생성: 제목, 예산, 통화(USD), 마감, 브리프 본문, 수용 기준 목록(체크리스트).
- PayPal Sandbox 주문: `intent: AUTHORIZE` → 구매자 승인 → 이후 `capture`. 최종 취소 시 `void`.
- 결과물 제출: 1개 이상의 URL + 메모. 파일 업로드는 없어도 된다 (시간 부족 시 URL만).
- 검증 에이전트: 브리프/수용 기준을 읽고, Kernel로 URL을 방문하고, 기준별 pass/fail/unsure + 근거를 구조화해 저장한다.
- 통과 시 Capture + PayPal Invoicing으로 영수증성 인보이스 생성/발송(또는 생성까지). 실패 시 Capture 금지.
- Bryntum Gantt 또는 Scheduler로 작업 마일스톤을 보여 준다. (생성, 에스크로 홀드, 제출, 검증, 지급/반려)
- 웹훅 또는 폴링으로 PayPal 결제 상태 동기화. 최소: 승인 완료, 캡처 완료.
- 공개 README (실행 방법, 샌드박스 테스트 계정, 데모 시나리오, 사용 도구).
- MIT LICENSE.
- 환경변수 예시 파일. 비밀값은 커밋하지 않음.

### Nice (시간이 남을 때만, 우선순위 순)

1. APIMatic Context Plugin을 에이전트에 연결해 PayPal API 호출이 문서 맥락을 쓰게 한다. (스폰서상 자격)
2. Render에 배포하고 공개 URL을 제출한다. (스폰서 크레딧 자격 + 심사위원이 바로 실행 가능)
3. 검증 결과 화면에 페이지 스크린샷 썸네일.
4. 의뢰인의 수동 승인/거절 및 부분 지급은 **하지 않는 것을 기본**으로 하고, 전액 수동 승인(캡처)과 전액 취소(void)만 넣는다.
5. Elastic 의미 검색은 넣지 않는 것을 기본으로 한다. 33시간 안에 품질을 담보하기 어렵다.

### Out (명시적으로 하지 말 것)

- 실물 배송, Channel3 상품 검색, 분쟁(Disputes) API, 구독, 마켓플레이스 분할 정산
- 멀티커런시 정교한 FX, 세금/부가세 엔진
- 모바일 네이티브 앱
- 실제 은행 에스크로, 법률 검토된 에스크로 라이선스 주장. UI 카피는 “PayPal 승인 홀드(authorization hold)로 대금을 묶어 두고, 검증 후 캡처합니다”라고 정확히 쓴다. “면허 에스크로”라고 과장하지 말 것.
- AG Grid 대시보드. Bryntum을 스폰서 도구의 주력으로 쓴다. 표를 만들어야 하면 일반 HTML/간단한 테이블이면 충분하다.
- 일반 쇼핑 에이전트, 채팅만 있는 ChatGPT 래퍼.

---

## 5. 권장 기술 스택

시간을 위해 선택이 아니라 **이 조합으로 고정**한다.

- 앱: **Next.js (App Router) + TypeScript + Tailwind CSS**
- 데모 인증: 시드된 두 계정 + 서버 세션 쿠키. NextAuth까지 갈 필요 없음. `POST /api/demo/login`으로 role을 바꾼다.
- DB: **SQLite + Prisma** (로컬/랜더 단일 인스턴스). 배포가 여러 인스턴스가 되면 그제야 Postgres로 바꿀 것. 해커톤은 SQLite로 충분.
- AI: **Vercel AI SDK** + OpenAI 또는 동일 인터페이스의 모델. PayPal 도구는 **`@paypal/agent-toolkit`** (`PayPalAgentToolkit` from `@paypal/agent-toolkit/ai-sdk`). 샌드박스 컨텍스트를 반드시 켠다.
- PayPal: REST Orders v2 (AUTHORIZE/CAPTURE/VOID) + Invoicing + Webhooks. 개발자 대시보드에서 샌드박스 앱을 만든다. 문서:
  - https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart
  - https://docs.paypal.ai/developer/tools/ai/agent-tools-ref
  - https://developer.paypal.com/api/rest/
  - https://github.com/paypal/agent-toolkit
  - https://github.com/paypal/AI-Toolkit
- 브라우징: **Kernel** (해커톤 스폰서). 문서와 자격은 https://paypalaihackathon.devpost.com/details/kernel 에서 확인하고 연동한다. 에이전트 도구로 `browse_delivery_url(url)`을 만들고, Kernel이 페이지 텍스트/스크린샷을 돌려주면 LLM이 수용 기준과 대조한다. Kernel 연동이 막히면 Playwright로 같은 인터페이스를 구현하되, README와 제출 설명에 **1순위는 Kernel**이며 로컬 폴백임을 명시한다. 가능하면 Kernel을 살릴 것. (Kernel은 스폰서 현금 상은 없지만, 이 제품의 창의성과 에이전틱 커머스 스토리의 핵심이다.)
- UI 일정: **Bryntum Gantt 또는 Scheduler** (React). 해커톤/트라이얼 라이선스는 https://paypalaihackathon.devpost.com/details/bryntum 지침을 따른다. 라이선스 키는 환경변수. 저장소에 비밀 키를 올리지 말 것.
- PayPal 도구 맥락: **APIMatic Context Plugin**. https://paypalaihackathon.devpost.com/details/apimatic
- 배포: **Render** Web Service. https://paypalaihackathon.devpost.com/details/render
- 스타일: 신뢰감을 주는 결제 제품. 과장된 네온/해커톤 테마 금지. 한글 UI를 기본으로 하고, 주요 라벨은 한/영을 병기해도 된다.

---

## 6. 데이터 모델

Prisma 모델 초안. 필드명은 이 이름을 그대로 쓴다.

```prisma
enum UserRole { CLIENT FREELANCER }
enum JobStatus {
  DRAFT
  FUNDED          // PayPal authorization 완료, 아직 작업 중
  IN_PROGRESS     // 프리랜서 수락
  SUBMITTED
  VERIFYING
  PASSED
  FAILED
  PAID            // capture 완료
  CANCELED        // void 완료
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      UserRole
  jobsPosted    Job[] @relation("ClientJobs")
  jobsAccepted  Job[] @relation("FreelancerJobs")
}

model Job {
  id          String    @id @default(cuid())
  title       String
  brief       String    // 마크다운/일반 텍스트
  budgetCents Int       // 15000 = $150.00. 부동소수점 금지
  currency    String    @default("USD")
  dueAt       DateTime
  status      JobStatus @default(DRAFT)
  clientId    String
  client      User      @relation("ClientJobs", fields: [clientId], references: [id])
  freelancerId String?
  freelancer   User?    @relation("FreelancerJobs", fields: [freelancerId], references: [id])
  paypalOrderId          String?
  paypalAuthorizationId  String?
  paypalCaptureId        String?
  paypalInvoiceId        String?
  criteria    Criterion[]
  submissions Submission[]
  events      JobEvent[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Criterion {
  id          String @id @default(cuid())
  jobId       String
  job         Job    @relation(fields: [jobId], references: [id])
  label       String
  sortOrder   Int
  results     CriterionResult[]
}

model Submission {
  id          String   @id @default(cuid())
  jobId       String
  job         Job      @relation(fields: [jobId], references: [id])
  deliveryUrl String
  notes       String   @default("")
  createdAt   DateTime @default(now())
  verification Verification?
}

model Verification {
  id              String   @id @default(cuid())
  submissionId    String   @unique
  submission      Submission @relation(fields: [submissionId], references: [id])
  status          String   // PASS | FAIL | ERROR
  summary         String   // 한국어 요약 (2~5문장)
  rawAgentTrace   String   // 디버그/심사위원용 툴 호출 로그
  results         CriterionResult[]
  createdAt       DateTime @default(now())
}

model CriterionResult {
  id             String @id @default(cuid())
  verificationId String
  verification   Verification @relation(fields: [verificationId], references: [id])
  criterionId    String
  criterion      Criterion @relation(fields: [criterionId], references: [id])
  verdict        String   // PASS | FAIL | UNSURE
  evidence       String   // 페이지에서 관찰한 근거
  confidence     Float
}

model JobEvent {
  id        String   @id @default(cuid())
  jobId     String
  job       Job      @relation(fields: [jobId], references: [id])
  type      String   // CREATED, FUNDED, ACCEPTED, SUBMITTED, VERIFYING, PASSED, FAILED, PAID, CANCELED
  at        DateTime @default(now())
  payload   String   @default("{}")
}
```

시드 데이터:

- 사용자: 의뢰인 `client@demo.com` / 프리랜서 `freelancer@demo.com` (비밀번호 `demo` 또는 원클릭 로그인)
- 작업 1개 “랜딩페이지 리뉴얼”, 수용 기준 4개, 예산 $150
- 통과용/반려용 데모 페이지를 `/demo/pass`, `/demo/fail`에 둔다

---

## 7. 화면 구성

라우트는 App Router 기준으로 고정한다.

- `/` 랜딩: 한 줄 가치 제안, “데모 시작(의뢰인)” / “데모 시작(프리랜서)” 버튼, 해커톤용 짧은 설명
- `/jobs/new` 의뢰인: 작업 생성 폼
- `/jobs/[id]` 작업 상세 (역할에 따라 버튼이 달라짐)
  - 상단: 상태 배지, 예산, 마감
  - 브리프와 수용 기준
  - **Bryntum Gantt/Scheduler**: 마일스톤 (작업 생성, 에스크로 홀드, 수락, 제출, 검증, 지급/반려). JobEvent를 이 뷰의 데이터 소스로 쓴다. 이것이 Bryntum 스폰서 요구를 충족하는 핵심 화면이다. 장식이 아니라 상태가 바뀔 때마다 실제 데이터가 갱신되어야 한다.
  - 의뢰인 + DRAFT: “PayPal로 대금 묶기”
  - 프리랜서 + FUNDED: “작업 수락”
  - 프리랜서 + IN_PROGRESS/FAILED: 결과물 URL 제출
  - 제출 후: “AI 검증 실행” (또는 제출 시 자동 실행)
  - 검증 결과 카드: 기준별 pass/fail, 근거, 종합 요약
  - 의뢰인 + PASSED: 자동 캡처가 실패했을 때만 수동 “지급 확정”
  - 의뢰인 + FAILED: “강제 지급” / “작업 취소(환불 홀드 해제)”
- `/demo/pass`, `/demo/fail`: 검증 대상이 되는 정적 랜딩 페이지
- 모든 화면에 “지금 역할: 의뢰인/프리랜서” 전환 스위치

시각적으로 완결된 제품처럼 보이게 할 것. 폼 유효성, 빈 상태, 로딩(검증 중 스피너와 “페이지를 열고 기준을 대조하는 중” 로그 스트리밍)을 넣는다.

---

## 8. API 설계

Route Handlers:

- `POST /api/demo/login` `{ role: "CLIENT" | "FREELANCER" }`
- `POST /api/jobs` 작업 생성
- `GET /api/jobs/[id]`
- `POST /api/jobs/[id]/accept`
- `POST /api/jobs/[id]/submit` `{ deliveryUrl, notes }`
- `POST /api/jobs/[id]/verify` 검증 에이전트 실행. 가능하면 SSE로 진행 로그를 흘린다.
- `POST /api/jobs/[id]/capture` 통과 후 캡처 (verify 성공 시 서버가 자동 호출하는 것을 기본으로 하고, 이 엔드포인트는 재시도용)
- `POST /api/jobs/[id]/void` 작업 취소
- `POST /api/paypal/create-order` 해당 job의 AUTHORIZE 주문 생성, client id 반환
- `POST /api/paypal/capture-order` 사용하지 말 것. 결제 수단 승인 직후 **캡처하지 않는다**. 승인 완료만 기록한다.
- `POST /api/paypal/webhook` 서명 검증 필수
- `GET /api/jobs/[id]/timeline` Bryntum이 소비할 마일스톤 JSON

프론트 결제: PayPal JS SDK v6 또는 공식 버튼으로 샌드박스 체크아웃. create-order는 서버에서만 수행.

---

## 9. PayPal 연동 상세

1. 개발자 대시보드에서 Sandbox 앱 생성. Client ID/Secret을 환경변수로 둔다.
2. 주문 생성 시 `intent: "AUTHORIZE"`, `purchase_units[0].amount`는 job.budgetCents와 일치, `custom_id` 또는 `reference_id`에 job.id를 넣는다.
3. 의뢰인이 샌드박스 구매자 계정으로 승인한다. (README에 샌드박스 구매자 이메일/안내를 적는다. 비밀 비밀번호를 공개 저장소에 올리지 말고, 심사위원이 자신의 샌드박스 구매자를 쓰거나, 제출 설명의 **비공개 메모/테스트 계정 칸**에 넣는다.)
4. 승인 완료 웹훅 또는 onApprove 콜백에서 `authorization id`를 저장하고 status=FUNDED. **여기서 capture 금지.**
5. 검증 PASS 시에만 Payments Capture를 호출한다. Agent Toolkit의 `pay_order` / 공식 capture API 중 실제로 authorization capture가 되는 쪽을 확인하고 사용한다. Toolkit이 authorize-then-capture를 제대로 지원하지 않으면 REST v2를 직접 호출한다. 추측으로 구현하지 말 것. 샌드박스에서 반드시 한 번 검증한다.
6. 통과 후 `create_invoice` + `send_invoice`(또는 영수증용 인보이스)로 “BriefPay 작업명, $150, 검증 통과 후 지급”을 남긴다. 이중 청구가 되면 안 된다. 인보이스는 **이미 캡처된 대금의 기록/영수증**이지, 두 번째 결제 요청이 아니다. 인보이스에 이미 지급됨을 명시하고, 필요하면 `record_payment_for_invoice`를 사용한다.
7. 취소 시 authorization void. 이미 capture된 건 refund.
8. 에이전트가 직접 돈을 움직이게 하지 말 것. 에이전트는 검증과 근거 작성만 하고, **지급/취소는 서버의 결정론적 코드**가 `verification.status`를 보고 실행한다. 이 분리가 데모에서 “AI가 마음대로 송금하지 않는다”는 신뢰를 만든다.

Agent Toolkit 설정: `context.sandbox: true`. invoices, orders, 필요 시 products만 활성화. disputes는 이 제품에서 쓰지 않는다.

APIMatic: 에이전트/개발 보조에 PayPal API 컨텍스트를 붙인다. 제출 텍스트에 APIMatic을 어떻게 썼는지 한 단락 적는다.

---

## 10. 검증 에이전트 설계

시스템 프롬프트 요지 (구현 시 한국어+영어 모두 이해하게 작성):

- 당신은 BriefPay의 검증 에이전트다. 목표는 의뢰인의 수용 기준이 결과물 URL에서 충족됐는지 증거를 들어 판정하는 것이다.
- 추측으로 PASS 하지 말 것. 페이지에서 확인되지 않으면 UNSURE 또는 FAIL.
- 최종 출력은 JSON만. 스키마:

```json
{
  "summary": "한국어 2~5문장",
  "overall": "PASS | FAIL",
  "results": [
    { "criterionId": "...", "verdict": "PASS | FAIL | UNSURE", "evidence": "...", "confidence": 0.0 }
  ]
}
```

- overall PASS 조건: 모든 필수 기준이 PASS. 하나라도 FAIL이면 overall FAIL. UNSURE가 있고 FAIL이 없으면 overall FAIL로 보수적으로 처리한다 (잘못된 지급이 잘못된 반려보다 위험하다).
- 도구:
  1. `browse_delivery(url)` → Kernel (폴백 Playwright). 텍스트, 주요 링크, 스크린샷 경로를 반환.
  2. `browse_again(url, instruction)` → 특정 섹션을 더 볼 때.
- PayPal 도구는 이 에이전트에 넣지 말 것.

검증 API는 job을 VERIFYING으로 바꾸고, 결과를 저장한 뒤 PASSED/FAILED로 전환한다. PASS면 같은 요청의 트랜잭션에서 바로 capture를 시도하고, 실패하면 PAID가 아닌 PASSED로 남겨 재시도 버튼을 보여 준다.

---

## 11. 폴더 구조

```
briefpay/
  README.md
  LICENSE                 # MIT
  .env.example
  prisma/schema.prisma
  prisma/seed.ts
  public/
  src/
    app/
      page.tsx
      jobs/new/page.tsx
      jobs/[id]/page.tsx
      demo/pass/page.tsx
      demo/fail/page.tsx
      api/...
    components/
      JobTimeline.tsx     # Bryntum
      VerificationReport.tsx
      RoleSwitch.tsx
      PayPalFundButton.tsx
    lib/
      db.ts
      paypal.ts           # Orders authorize/capture/void, invoice
      paypal-webhook.ts
      kernel.ts           # browse_delivery
      agent.ts            # 검증 에이전트
      timeline.ts
    types/
  scripts/
```

---

## 12. 환경변수

`.env.example`에만 이름을 적고, 실제 값은 커밋하지 않는다.

```
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=SANDBOX
PAYPAL_WEBHOOK_ID=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
OPENAI_API_KEY=          # 또는 선택한 모델 키
KERNEL_API_KEY=
BRYNTUM_LICENSE_KEY=
APIMATIC_API_KEY=        # 사용하는 경우
DATABASE_URL=file:./dev.db
APP_BASE_URL=http://localhost:3000
DEMO_LOGIN_SECRET=       # 데모 로그인 쿠키 서명
```

README의 “Judges: how to run” 섹션에 필요 키와, 키가 없을 때 어떤 기능이 빠지는지를 적는다. Kernel 키가 없으면 로컬 브라우징 폴백이 동작해야 한다.

---

## 13. 구현 순서 (이 순서를 지키면 데모가 먼저 산다)

하루 반(마감 2026-11-13 05:00 KST) 기준.

1. 저장소 초기화, MIT LICENSE, Next.js + Prisma + 시드, 데모 로그인, 작업 CRUD, `/demo/pass` `/demo/fail` 페이지. UI를 처음부터 깔끔하게.
2. PayPal AUTHORIZE 체크아웃. FUNDED 상태와 샌드박스 왕복 확인. 이 단계가 실패하면 다른 기능을 추가하지 말 것.
3. 결과물 제출 + 검증 에이전트(일단 Playwright/직접 fetch로라도 동작) + 결과 화면. PASS/FAIL 분기.
4. PASS 시 capture + 인보이스, FAIL 시 홀드 유지, VOID 경로.
5. JobEvent와 Bryntum 타임라인 연동. 상태 변경마다 이벤트 기록.
6. Kernel로 browse를 교체. APIMatic 연결. Render 배포.
7. README, 테스트 계정 안내, 데모 영상 촬영(3분 미만), Devpost 제출.

중간에 시간이 부족하면 6번을 줄여도 된다. 1~5와 7은 필수다.

---

## 14. 데모 영상 스크립트 (3분 이내)

언어: 한국어 나레이션 또는 화면 자막. 영어 자막이 있으면 심사에 유리하다. 배경음악은 저작권 없는 것만, 가능하면 음악 없이.

0:00–0:20 문제. “외주는 돈을 언제 줘야 할지 애매합니다. 완료 버튼만으로는 결과물이 브리프를 지켰는지 알 수 없습니다.”  
0:20–0:40 제품 한 줄. “BriefPay는 대금을 PayPal에 먼저 묶어 두고, AI가 결과물을 직접 열어 본 뒤에만 지급합니다.”  
0:40–1:10 의뢰인이 작업과 수용 기준을 만들고 PayPal 샌드박스로 $150를 홀드. 화면에 authorization이지 capture가 아님을 보여 준다.  
1:10–1:30 프리랜서가 통과용 데모 URL을 제출.  
1:30–2:10 검증 로그: Kernel/브라우저가 페이지를 열고, 기준별 PASS, 타임라인 갱신, Capture + 지급 완료.  
2:10–2:40 같은 작업의 실패 시나리오 또는 두 번째 짧은 클립. CTA가 없는 페이지 → FAIL, 대금은 그대로 홀드, 수정 요청.  
2:40–3:00 정리. “PayPal authorization/capture, 검증 에이전트, Bryntum 일정. 완료 버튼이 아니라 결과물로 지급이 결정됩니다.”

화면이 실제 동작이어야 한다. 슬라이드만으로 채우지 말 것.

---

## 15. Devpost 제출 초안

**프로젝트명:** BriefPay (브리프페이) — Pay after the brief is met

**짧은 설명 (영문, 제출 폼용):**  
BriefPay holds a client’s payment with a PayPal authorization, then sends an AI agent to inspect the freelancer’s delivered URL against the written brief. Funds are captured only when the acceptance criteria pass. No “mark as complete” button can release the money.

**What it does:**  
의뢰인은 브리프와 수용 기준을 올리고 PayPal로 대금을 승인 홀드합니다. 프리랜서가 결과물 URL을 제출하면 에이전트가 Kernel로 페이지를 열고 기준과 대조합니다. 통과 시에만 PayPal Capture와 인보이스 기록이 진행되고, 실패하면 대금은 묶인 채 수정 요청이 갑니다. 작업 진행은 Bryntum 타임라인에 표시됩니다.

**Tools:**  
PayPal Orders (Authorize/Capture/Void), PayPal Invoicing, PayPal Webhooks, PayPal Agent Toolkit, Vercel AI SDK, Kernel (page browsing), Bryntum Gantt/Scheduler, APIMatic Context Plugin (사용한 경우), Render (배포한 경우), OpenAI(또는 실제 사용한 모델), Next.js, Prisma, SQLite.

**How PayPal and AI are used (심사 핵심 문단):**  
AI is not a chatbot wrapper around a checkout button. The agent’s verdict is the release condition for a PayPal authorization already taken on the job. Payment movement (capture/void) is executed by server-side business logic after a structured pass/fail result, not by a free-form model call.

---

## 16. README에 꼭 넣을 섹션

- 한 줄 소개와 문제
- 아키텍처 다이어그램 (텍스트/ mermaid: Client → App → PayPal Authorize, Agent → Kernel → Verdict → Capture)
- 로컬 실행: `npm i`, `.env`, `npx prisma migrate dev`, `npx prisma db seed`, `npm run dev`
- 데모 계정과 시나리오 A/B 클릭 순서
- 샌드박스 PayPal 설정 방법
- 심사위원용 테스트 방법 (호스팅 URL이 있으면 최상단에)
- 사용 도구와 라이선스
- 해커톤 기간 중 만든 프로젝트임을 명시

---

## 17. 리스크와 구현 시 주의

- Authorize와 Capture를 바꾸지 말 것. Checkout 직후 capture하면 이 제품의 논리가 무너진다.
- 에이전트에게 PayPal 지급 도구를 직접 주지 말 것.
- 샌드박스에서만 테스트. 라이브 키 금지.
- PayPal 승인 홀드는 만료 기간이 있다(보통 약 29일). 해커톤 데모에는 문제 없으나 README에 한 줄 적는다.
- “에스크로” 과장 금지. 카피는 authorization hold로 정확히.
- Bryntum과 Kernel은 문서의 해커톤 접근 방법을 따른다. 페이지를 스크랩해서 키를 넣지 말 것.
- 한국에서 PayPal 개발자/샌드박스 계정 생성이 막히면 PayPal Discord (https://discord.gg/sJ2G6DyvSK)에서 문의. 자격과 계정 생성은 별개다.
- 비밀키, 실제 개인정보, 저작권 음악, 타사 로고 남용 금지.
- 제출 직전: 저장소 public, LICENSE 루트 존재, `npm run build` 통과, 시나리오 A와 B를 영상과 동일한 순서로 한 번 더 실행.

---

## 18. 완료의 정의

아래가 모두 참이면 구현 완료다.

1. 데모 의뢰인이 작업을 만들고 PayPal 샌드박스에서 $150가 authorize된다. 잔액이 아직 최종 캡처되지 않은 것이 화면 또는 대시보드/로그로 확인된다.
2. 통과용 URL 제출 시 기준이 PASS로 나오고, capture가 성공하고, 상태가 PAID가 된다.
3. 반려용 URL 제출 시 FAIL 근거가 나오고, capture가 호출되지 않으며, 상태가 FAILED이고 홀드가 유지된다.
4. Bryntum 타임라인이 위 상태 변화를 실제 데이터로 보여 준다.
5. README만 보고 제3자가 실행하거나, Render URL로 같은 흐름을 재현할 수 있다.
6. 라이선스가 있는 공개 저장소가 있다.

이 문서를 우선순위의 유일한 기준으로 삼고, 범위를 넓히지 말 것.
