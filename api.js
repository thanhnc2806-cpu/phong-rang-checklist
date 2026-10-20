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
// choDungCu = false (màn đăng nhập): không bao giờ lấy bản cũ, vì mã chưa được máy chủ kiểm
function taiAnhChup(dangNhap, choDungCu) {
  return goiApi(dangNhap, { loai: "doc" }).then(function (a) {
    if (a.ok) { a.luc = Date.now(); ghiMay(KHOA_ANH_CHUP, a); return a; }
    var cu = docMay(KHOA_ANH_CHUP, null);
    return choDungCu !== false && anhChupDungNguoi(cu, dangNhap.nguoi) && guiLai(a.loi) ? Object.assign(cu, { cuDaLuu: true, loi: a.loi }) : a;
  });
}

// Mỗi lần bấm: vào hàng đợi trước rồi mới gửi
function guiThaoTac(op, nguoi) {
  op.id = op.id || taoMaThaoTac();
  op.cua = nguoi;  // đổi người trên máy: thao tác chỉ gửi dưới tên người đã bấm
  ghiMay(KHOA_HANG_DOI, themHangDoi(docMay(KHOA_HANG_DOI, []), op));
  return op.id;
}
function soChoGui() { return docMay(KHOA_HANG_DOI, []).length; }

var dangXa_ = false;
// Gửi lần lượt từ đầu hàng đợi (chỉ thao tác của người đang đăng nhập). Lỗi tạm -> dừng, giữ nguyên.
// Lỗi đăng nhập -> dừng, giữ nguyên, báo "dangNhapLai". Bị từ chối -> bỏ mục đó, báo "tuChoi".
// suKien({ loai: "xong" | "tam" | "dangNhapLai" | "tuChoi" | "da", op, kq })
function xaHangDoi(dangNhap, suKien0) {
  if (dangXa_) return;
  dangXa_ = true;
  // Người nghe ném lỗi (vd. đã Đổi người giữa chừng) không được làm kẹt cờ dangXa_ -> hàng đợi ngừng gửi tới khi tải lại trang
  function suKien(e) { try { suKien0(e); } catch (x) { console.error(x); } }
  (function tiep() {
    var q = docMay(KHOA_HANG_DOI, []);
    if (!q.length) { dangXa_ = false; suKien({ loai: "xong" }); return; }
    var op = opCuaNguoi(q, dangNhap.nguoi);
    if (!op) { dangXa_ = false; suKien({ loai: "xong" }); return; }
    goiApi(dangNhap, op).then(function (kq) {
      if (!kq.ok && loiDangNhap(kq.loi)) { dangXa_ = false; suKien({ loai: "dangNhapLai", op: op, kq: kq }); return; }
      if (!kq.ok && guiLai(kq.loi)) {
        var xet = demThuLai(op, kq.loi);
        if (xet.tuChoi) {
          ghiMay(KHOA_HANG_DOI, boHangDoi(docMay(KHOA_HANG_DOI, []), op.id));
          suKien({ loai: "tuChoi", op: op, kq: { ok: false, loi: kq.loi, chu: xet.chu } });
          tiep();
          return;
        }
        ghiMay(KHOA_HANG_DOI, docMay(KHOA_HANG_DOI, []).map(function (x) { return x.id === op.id ? op : x; }));
        dangXa_ = false;
        suKien({ loai: "tam", op: op, kq: kq });
        return;
      }
      ghiMay(KHOA_HANG_DOI, boHangDoi(docMay(KHOA_HANG_DOI, []), op.id));
      suKien({ loai: kq.ok ? "da" : "tuChoi", op: op, kq: kq });
      tiep();
    });
  })();
}
