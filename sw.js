// Chỉ đệm vỏ trang để mở được khi mất mạng (spec §6.3). Dữ liệu lô KHÔNG đệm ở đây: api.js giữ ảnh chụp cuối trong localStorage.
// Có mạng thì luôn lấy bản mới (sửa giao diện không bị kẹt bản cũ); mất mạng mới dùng bản đệm.
var BAN = "checklist-v7";
var VO = ["./", "index.html", "styles.css", "config.js", "state.js", "api.js", "app.js", "manifest.webmanifest",
  "icon-192.png", "icon-512.png", "logo-mark.png", "handle.png", "fonts/inter-latin.woff2", "fonts/inter-latin-ext.woff2", "fonts/inter-vietnamese.woff2",
  "fonts/jbmono-latin.woff2", "fonts/jbmono-latin-ext.woff2", "fonts/jbmono-vietnamese.woff2", "fonts/material-symbols.woff2"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(BAN).then(function (c) { return c.addAll(VO); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== BAN; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;  // POST lên Apps Script đi thẳng
  e.respondWith(fetch(e.request).then(function (r) {
    var sao = r.clone();
    if (r.ok) caches.open(BAN).then(function (c) { c.put(e.request, sao); });
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
