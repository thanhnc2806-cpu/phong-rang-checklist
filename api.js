/** localStorage an toàn + gọi Apps Script + hàng đợi gửi lại. Phụ thuộc: config.js, state.js.
 *  Chép cách làm của cupping-app/taste-web/api.js (POST text/plain, credentials "omit", hết giờ 45 giây). */
var KHOA_HANG_DOI = "checklist:hangdoi", KHOA_DANG_NHAP = "checklist:dangnhap", KHOA_ANH_CHUP = "checklist:anhchup";
var HET_GIO_MS = 45000;

// localStorage có thể ném lỗi (chế độ riêng tư, bộ nhớ đầy): không bao giờ làm sập trang
function docMay(k, macDinh) { try { var v = localStorage.getItem(k); return v === null ? macDinh : JSON.parse(v); } catch (e) { return macDinh; } }
function ghiMay(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
function xoaMay(k) { try { localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } }

// dangNhap = { nguoi: "minh", ma: "123456" } — lưu trên máy, gửi kèm mỗi yêu cầu
function goiApi(dangNhap, than) {
  if (!CHECKLIST_API_URL) return goiGia(than);  // chưa có máy chủ: chạy bằng dữ liệu mẫu (lúc dựng giao diện)
  var body = Object.assign({ nguoi: dangNhap.nguoi, ma: dangNhap.ma }, than);
  var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  var hen = ctl ? setTimeout(function () { ctl.abort(); }, HET_GIO_MS) : null;
  return fetch(CHECKLIST_API_URL, {
    method: "POST", redirect: "follow", credentials: "omit",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body),
    signal: ctl ? ctl.signal : undefined
  })
    .then(function (r) { return r.json(); })
    .then(function (j) { return j && typeof j === "object" ? j : { ok: false, loi: "LOI_MAY_CHU" }; })
    .catch(function () { return { ok: false, loi: "NETWORK" }; })  // gồm cả hết giờ: máy chủ nhớ id nên gửi lại an toàn
    .finally(function () { if (hen) clearTimeout(hen); });
}

function goiGia(than) {
  if (than.loai === "doc") return fetch("mau-du-lieu.json").then(function (r) { return r.json(); });
  console.log("[dữ liệu mẫu] thao tác", than);
  return Promise.resolve({ ok: true });
}

// Ảnh chụp mới nhất; mất mạng thì trả bản đã lưu (kèm cuDaLuu: true để trang hiện "dữ liệu lúc …")
function taiAnhChup(dangNhap) {
  return goiApi(dangNhap, { loai: "doc" }).then(function (a) {
    if (a.ok) { a.luc = Date.now(); ghiMay(KHOA_ANH_CHUP, a); return a; }
    var cu = docMay(KHOA_ANH_CHUP, null);
    return cu && guiLai(a.loi) ? Object.assign(cu, { cuDaLuu: true, loi: a.loi }) : a;
  });
}

// Mỗi lần bấm: vào hàng đợi trước rồi mới gửi
function guiThaoTac(op) {
  op.id = op.id || taoMaThaoTac();
  ghiMay(KHOA_HANG_DOI, themHangDoi(docMay(KHOA_HANG_DOI, []), op));
  return op.id;
}
function soChoGui() { return docMay(KHOA_HANG_DOI, []).length; }

var dangXa_ = false;
// Gửi lần lượt từ đầu hàng đợi. Lỗi tạm -> dừng, giữ nguyên. Bị từ chối -> bỏ mục đó, báo "tuChoi".
// suKien({ loai: "xong" | "tam" | "tuChoi" | "da", op, kq })
function xaHangDoi(dangNhap, suKien) {
  if (dangXa_) return;
  dangXa_ = true;
  (function tiep() {
    var q = docMay(KHOA_HANG_DOI, []);
    if (!q.length) { dangXa_ = false; suKien({ loai: "xong" }); return; }
    var op = q[0];
    goiApi(dangNhap, op).then(function (kq) {
      if (!kq.ok && guiLai(kq.loi)) { dangXa_ = false; suKien({ loai: "tam", op: op, kq: kq }); return; }
      ghiMay(KHOA_HANG_DOI, boHangDoi(docMay(KHOA_HANG_DOI, []), op.id));
      suKien({ loai: kq.ok ? "da" : "tuChoi", op: op, kq: kq });
      tiep();
    });
  })();
}
