/* =====================================================================
   Service Worker — 高齢DLBCL問診アプリ（オフライン対応）
   旭川赤十字病院 血液腫瘍内科　方式B

   役割：一度開いたアプリをキャッシュし、圏外・機内モードでも起動可能にする。
   アプリは単一HTML（外部依存なし）なので、HTMLドキュメントをキャッシュすれば完結。
   ※ 患者データは一切キャッシュ・保存しない（HTMLの画面だけをキャッシュ）。

   【更新方法】アプリHTMLを更新したら、下の CACHE_VERSION の数字を必ず上げる。
   これで各iPadが次回オンライン起動時に新しい版を取得し、古い版を破棄する。
===================================================================== */
var CACHE_VERSION = 'v2';                       // ★HTML更新時はここを v2, v3... と上げる
var CACHE_NAME = 'akr-monshin-' + CACHE_VERSION;

/* キャッシュ対象（このSWと同じ階層の相対パス） */
var ASSETS = [
  './',
  './monshin_triage_app.html',
  './monshin_app.html',
  './manifest.json'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(ASSETS);
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE_NAME) return caches.delete(k);   // 古い版を掃除
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* 取得戦略：キャッシュ優先＋裏でネット更新（stale-while-revalidate）
   - オフライン時：キャッシュから即返す
   - オンライン時：キャッシュを返しつつ、裏で最新を取り込み次回に反映 */
self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;                 // 送信(POST)は素通し（GASへ直接）
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;  // 外部（GAS等）はキャッシュしない

  event.respondWith(
    caches.match(req).then(function(cached){
      var network = fetch(req).then(function(res){
        if(res && res.status === 200){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        }
        return res;
      }).catch(function(){ return cached; });      // 圏外ならキャッシュ
      return cached || network;
    })
  );
});
