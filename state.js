/** Hàm thuần của app checklist mẻ (test bằng node: tests/web_state.test.js). Không chạm DOM, mạng, localStorage. */
// Lỗi tạm: thao tác nằm lại hàng đợi, tự gửi lại. Lỗi khác = máy chủ từ chối (xem src/ApiLogic.js, src/Api.js).
var LOI_GUI_LAI = ["NETWORK", "BAN", "LOI_MAY_CHU"];
function guiLai(loi) { return LOI_GUI_LAI.indexOf(loi) >= 0; }
// Lỗi đăng nhập: không phải thao tác sai -> giữ nguyên hàng đợi, bắt đăng nhập lại
var LOI_DANG_NHAP = ["SAI_MA", "KHOA", "SAI_TEN", "CHUA_CO_MA"];
function loiDangNhap(loi) { return LOI_DANG_NHAP.indexOf(loi) >= 0; }
// Thao tác đầu hàng đợi của đúng người đang đăng nhập (thao tác cũ chưa có "cua" coi như của người này)
function opCuaNguoi(q, nguoi) { return q.filter(function (x) { return !x.cua || x.cua === nguoi; })[0]; }
// Ảnh chụp lưu trên máy chỉ dùng cho đúng người đã lưu nó
function anhChupDungNguoi(cu, nguoi) { return !!cu && cu.nguoi === nguoi; }
// Đang gõ vào ô: việc nền (tự gửi hàng đợi) không được vẽ lại màn hình
function dangGoVaoO(tag) { return /^(INPUT|TEXTAREA|SELECT)$/.test(tag || ""); }

// "13,1" / "13.1" / 13.1 -> 13.1 · "" / "abc" / "1,2,3" -> null
function docSo(x) {
  if (typeof x === "number") return isFinite(x) ? x : null;
  var s = String(x === undefined || x === null ? "" : x).trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

// 30.6 -> "30,6"; chuSo = số chữ số sau dấu phẩy tối đa (bỏ số 0 thừa)
function soVN(x, chuSo) {
  if (x === null || x === undefined || !isFinite(x)) return "";
  var p = Math.pow(10, chuSo === undefined ? 2 : chuSo);
  return String(Math.round(x * p) / p).replace(".", ",");
}

// % hao hụt = (vào − ra) / vào × 100, làm tròn 0,1 (= công thức cột H Sheet 01)
function haoHut(vao, ra) { return vao > 0 && ra > 0 && ra <= vao ? Math.round((vao - ra) / vao * 1000) / 10 : null; }

// nguong = [dòng, thấp, cao] | null -> "xanh" trong ngưỡng · "do" ngoài · "xam" chưa có ngưỡng / chưa gõ
function mauHaoHut(hh, nguong) {
  if (hh === null || !nguong) return "xam";
  return hh >= nguong[1] && hh <= nguong[2] ? "xanh" : "do";
}

// Hàng đợi: [{ id, ... thao tác }]. Cùng id = cùng thao tác (gửi lại không ghi đôi: máy chủ nhớ id)
function themHangDoi(q, op) { return q.filter(function (x) { return x.id !== op.id; }).concat([op]); }
function boHangDoi(q, id) { return q.filter(function (x) { return x.id !== id; }); }
function choGuiCuaLo(q, khoa) { return q.filter(function (x) { return x.khoa === khoa; }); }

function taoMaThaoTac(ngauNhien) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + "-" + (ngauNhien || Math.random)().toString(36).slice(2, 10);
}

// Đếm ngược tới cupping T6: "Cupping T6 23/10 · còn 3 ngày" / "· hôm nay" / "· đã qua"
function demNguoc(homNay, cupping) {
  var n = Math.round((Date.parse(cupping + "T00:00:00Z") - Date.parse(homNay + "T00:00:00Z")) / 864e5);
  return "Cupping T6 " + cupping.slice(8, 10) + "/" + cupping.slice(5, 7) + " · " + (n > 0 ? "còn " + n + " ngày" : n === 0 ? "hôm nay" : "đã qua");
}

// Thẻ màn Hôm nay: lô của ngày + máy đang chọn, lô dở trên, lô xong xuống cuối (giữ thứ tự máy chủ trả)
function loCuaNgay(lo, ngay, may) {
  var ds = lo.filter(function (l) { return l.ngay === ngay && (!may || l.may === may); });
  return ds.filter(function (l) { return !l.xong; }).concat(ds.filter(function (l) { return l.xong; }));
}

// ⓪ "Đúng" = gửi đúng gợi ý; "Sửa" = gợi ý với các ô đã sửa. sua = { "vao|tp|loai": "3,5" }
function thucNhanXanh(goiY0, sua) {
  return goiY0.map(function (g) {
    return { vao: g.vao, tp: g.tp, dong: g.dong.map(function (d) {
      var k = g.vao + "|" + g.tp + "|" + d.loai;
      return { loai: d.loai, kg: sua && sua.hasOwnProperty(k) ? docSo(sua[k]) : d.kg };
    }) };
  });
}

if (typeof module !== "undefined") {
  module.exports = { LOI_GUI_LAI: LOI_GUI_LAI, guiLai: guiLai, loiDangNhap: loiDangNhap, opCuaNguoi: opCuaNguoi,
    anhChupDungNguoi: anhChupDungNguoi, dangGoVaoO: dangGoVaoO, docSo: docSo, soVN: soVN, haoHut: haoHut, mauHaoHut: mauHaoHut,
    themHangDoi: themHangDoi, boHangDoi: boHangDoi, choGuiCuaLo: choGuiCuaLo, taoMaThaoTac: taoMaThaoTac,
    demNguoc: demNguoc, loCuaNgay: loCuaNgay, thucNhanXanh: thucNhanXanh };
}
