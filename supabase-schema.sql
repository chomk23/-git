-- ============================================================
-- 보안 교육 플랫폼 — Supabase 스키마
-- Supabase > SQL Editor에서 전체 복사 후 실행
-- ============================================================

-- 1. 사용자 프로필 (Supabase Auth users 테이블과 연결)
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name        TEXT NOT NULL,
  department  TEXT,
  role        TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 강의 목록
CREATE TABLE courses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT,                        -- 'required' | 'infra' | 'latest'
  duration    TEXT,                        -- 예: '15:00'
  is_new      BOOLEAN DEFAULT false,
  order_index INT DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 수강 현황 (사용자 × 강의)
CREATE TABLE enrollments (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id    UUID REFERENCES courses(id)  ON DELETE CASCADE,
  status       TEXT DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  progress_pct INT  DEFAULT 0,
  enrolled_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, course_id)
);

-- 4. 퀴즈 문제 (사전/사후)
CREATE TABLE quiz_questions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   UUID REFERENCES courses(id) ON DELETE CASCADE,
  quiz_type   TEXT NOT NULL CHECK (quiz_type IN ('pre', 'post')),
  question    TEXT NOT NULL,
  options     JSONB NOT NULL,              -- ["선택지1", "선택지2", ...]
  answer_idx  INT  NOT NULL,              -- 정답 인덱스 (0-based)
  order_index INT  DEFAULT 0
);

-- 5. 퀴즈 응시 결과
CREATE TABLE quiz_attempts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id    UUID REFERENCES courses(id)  ON DELETE CASCADE,
  quiz_type    TEXT NOT NULL CHECK (quiz_type IN ('pre', 'post')),
  score        INT  NOT NULL,             -- 맞힌 문항 수
  total        INT  NOT NULL,             -- 전체 문항 수
  score_pct    INT  GENERATED ALWAYS AS (ROUND(score * 100.0 / total)) STORED,
  answers      JSONB,                     -- 사용자 응답 배열
  taken_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id, quiz_type)   -- 1인 1회 응시
);

-- 6. 피싱 모의훈련 캠페인
CREATE TABLE phishing_campaigns (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  sent_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by  UUID REFERENCES profiles(id)
);

-- 7. 피싱 훈련 결과 (사용자별)
CREATE TABLE phishing_results (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id   UUID REFERENCES phishing_campaigns(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  clicked       BOOLEAN DEFAULT false,
  clicked_at    TIMESTAMP WITH TIME ZONE,
  UNIQUE(campaign_id, user_id)
);

-- 8. 행동 변화 설문 응답
CREATE TABLE survey_responses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES courses(id)  ON DELETE CASCADE,
  responses   JSONB NOT NULL,             -- { "q1": 0, "q2": 1, "q3": 0 }
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- ============================================================
-- Row Level Security (RLS) 설정
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE phishing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE phishing_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses  ENABLE ROW LEVEL SECURITY;

-- profiles: 본인 조회 가능, admin은 전체 조회
CREATE POLICY "본인 프로필 조회" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admin 전체 조회" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "본인 프로필 수정" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- courses: 로그인한 사용자 전체 조회
CREATE POLICY "강의 목록 조회" ON courses
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin 강의 관리" ON courses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- enrollments: 본인 것만 조회/수정, admin은 전체
CREATE POLICY "본인 수강 조회" ON enrollments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인 수강 등록" ON enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "본인 수강 업데이트" ON enrollments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin 수강 전체 조회" ON enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- quiz_questions: 로그인 사용자 조회, admin 관리
CREATE POLICY "퀴즈 문제 조회" ON quiz_questions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin 퀴즈 관리" ON quiz_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- quiz_attempts: 본인 결과 조회/입력, admin 전체 조회
CREATE POLICY "본인 퀴즈 결과 조회" ON quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인 퀴즈 결과 입력" ON quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin 퀴즈 결과 전체" ON quiz_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- phishing_results: 본인 결과 입력, admin 전체 조회
CREATE POLICY "피싱 결과 입력" ON phishing_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin 피싱 결과 조회" ON phishing_results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- survey_responses: 본인 입력/조회, admin 전체 조회
CREATE POLICY "설문 입력" ON survey_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "본인 설문 조회" ON survey_responses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admin 설문 전체" ON survey_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 관리자 분석용 뷰 (admin.html 차트 데이터 소스)
-- ============================================================

-- 부서별 이수율 뷰
CREATE VIEW dept_completion_rate AS
SELECT
  p.department,
  COUNT(DISTINCT p.id)                                          AS total_users,
  COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.user_id END) AS completed_users,
  ROUND(
    COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.user_id END)
    * 100.0 / NULLIF(COUNT(DISTINCT p.id), 0)
  )                                                             AS completion_rate
FROM profiles p
LEFT JOIN enrollments e ON p.id = e.user_id
WHERE p.role = 'user'
GROUP BY p.department;

-- 교육 전후 점수 비교 뷰
CREATE VIEW pre_post_score_comparison AS
SELECT
  p.id         AS user_id,
  p.name,
  p.department,
  c.title      AS course_title,
  pre.score_pct  AS pre_score,
  post.score_pct AS post_score,
  (post.score_pct - pre.score_pct) AS improvement
FROM profiles p
JOIN quiz_attempts pre  ON pre.user_id  = p.id AND pre.quiz_type  = 'pre'
JOIN quiz_attempts post ON post.user_id = p.id AND post.quiz_type = 'post'
                        AND post.course_id = pre.course_id
JOIN courses c ON c.id = pre.course_id;

-- 피싱 캠페인 클릭률 뷰
CREATE VIEW phishing_click_rate AS
SELECT
  pc.id,
  pc.title,
  pc.sent_at,
  COUNT(pr.user_id)                                         AS total_sent,
  SUM(CASE WHEN pr.clicked THEN 1 ELSE 0 END)              AS clicked_count,
  ROUND(
    SUM(CASE WHEN pr.clicked THEN 1 ELSE 0 END)
    * 100.0 / NULLIF(COUNT(pr.user_id), 0)
  )                                                         AS click_rate
FROM phishing_campaigns pc
LEFT JOIN phishing_results pr ON pr.campaign_id = pc.id
GROUP BY pc.id, pc.title, pc.sent_at;

-- ============================================================
-- 트리거: Auth 회원가입 시 profiles 자동 생성
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, department, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'department', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 샘플 강의 데이터 (테스트용)
-- ============================================================
INSERT INTO courses (title, description, category, duration, is_new, order_index) VALUES
  ('피싱 메일 대응 전략',   '피싱 공격 유형과 대응 방법을 학습합니다.',     'required', '15:00', false, 1),
  ('개인정보 보호 가이드',  '개인정보 보호법과 실무 가이드라인.',           'required', '12:00', false, 2),
  ('클라우드 보안 아키텍처','클라우드 환경의 보안 설계와 운영.',            'infra',    '20:00', true,  3),
  ('랜섬웨어 예방 교육',    '랜섬웨어 감염 예방 및 대응 절차.',            'required', '10:00', false, 4),
  ('네트워크 보안 기초',    '네트워크 보안의 기본 개념과 위협.',            'infra',    '18:00', false, 5),
  ('보안 인식 제고 훈련',   '전 직원 보안 인식 향상을 위한 교육.',          'required', '08:00', true,  6),
  ('제로트러스트 보안 전략','제로트러스트 아키텍처 개념과 도입 방안.',      'infra',    '20:00', false, 7),
  ('사회공학 공격 대응',    '사회공학 기법과 실제 사례 분석.',              'required', '15:00', false, 8),
  ('모바일 보안 위협 대응', '모바일 기기 보안 위협과 대응 방안.',           'infra',    '10:00', false, 9);
