// ── Supabase 클라이언트 설정 ──
// 이 파일을 수정할 때는 아래 두 값만 바꾸면 됩니다.
const SUPABASE_URL  = 'https://daazlwcsxpearvqfbidn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhYXpsd2NzeHBlYXJ2cWZiaWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODYzMjUsImV4cCI6MjA5NDM2MjMyNX0.K7ANn2ol5znJrkPxsI5tdudK9LAyUeE7cZ1736vdh5w';

// supabase-js CDN이 먼저 로드되어야 합니다.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
