// PWA extras: offline service worker, "install as app" and "share" in the ⋯ menu.
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ }));
  }
  const pop = document.getElementById('menuPop');
  if (!pop) return;
  let timer;
  function toast(msg) {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show'); t.classList.remove('good');
    clearTimeout(timer); timer = setTimeout(() => t.classList.remove('show'), 3200);
  }
  function item(label, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => { pop.hidden = true; fn(); });
    pop.prepend(b); return b;
  }
  const url = () => location.href.split('#')[0];

  item('공유하기', async () => {
    const data = { title: '파란 선 마을', text: '파란 선 집으로 마을을 짓고 틀린 그림 찾기를 해 봐요!', url: url() };
    if (navigator.share) { try { await navigator.share(data); } catch (e) { /* closed the share sheet */ } return; }
    try { await navigator.clipboard.writeText(data.url); toast('링크를 복사했어요. 메신저에 붙여 보내세요'); }
    catch (e) { toast('이 주소를 보내 주세요: ' + data.url); }
  });

  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let deferred = null;
  const install = item('앱으로 설치', async () => {
    if (deferred) {
      deferred.prompt();
      const r = await deferred.userChoice.catch(() => null);
      deferred = null;
      if (r && r.outcome === 'accepted') install.hidden = true;
    } else if (ios) toast('Safari 아래쪽 공유 버튼 → "홈 화면에 추가"를 눌러 주세요');
    else toast('브라우저 주소창 오른쪽의 설치 아이콘이나 메뉴의 "앱 설치"를 눌러 주세요');
  });
  install.hidden = standalone;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; install.hidden = false; });
  window.addEventListener('appinstalled', () => { install.hidden = true; toast('앱으로 설치했어요. 홈 화면에서 열 수 있어요'); });
})();
