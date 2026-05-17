// ── 세션 타임아웃 & 로그인 가드 ──
// 보호된 모든 페이지에서 include. 사용 방법:
//   <script src="auth.js"></script>  (sessionStorage 'user' 체크 후 30분 비활동 자동 로그아웃)
(function () {
  const TIMEOUT_MS = 30 * 60 * 1000;   // 30분 비활동
  const KEY_LAST   = 'lastActivity';
  const KEY_USER   = 'user';
  const LOGIN_PAGE = 'login.html';

  // 로그인 안 됐으면 로그인 페이지로
  if (!sessionStorage.getItem(KEY_USER)) {
    // 로그인 페이지 자체에서는 동작 안 함
    if (!/login\.html$/i.test(location.pathname)) {
      location.href = LOGIN_PAGE;
    }
    return;
  }

  // 활동 갱신
  function touch() {
    sessionStorage.setItem(KEY_LAST, String(Date.now()));
  }

  // 시작 시 타임아웃 확인
  const last = parseInt(sessionStorage.getItem(KEY_LAST) || '0');
  if (last && Date.now() - last > TIMEOUT_MS) {
    sessionStorage.clear();
    alert('30분 이상 활동이 없어 자동 로그아웃되었습니다.');
    location.href = LOGIN_PAGE;
    return;
  }
  touch();

  // 활동 감지
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, touch, { passive: true })
  );

  // 1분마다 타임아웃 체크
  setInterval(() => {
    const l = parseInt(sessionStorage.getItem(KEY_LAST) || '0');
    if (l && Date.now() - l > TIMEOUT_MS) {
      sessionStorage.clear();
      alert('30분 이상 활동이 없어 자동 로그아웃되었습니다.');
      location.href = LOGIN_PAGE;
    }
  }, 60 * 1000);
})();
