// Checklist mẻ — ứng dụng PWA phòng rang (JS thuần, không framework, không CDN).
// Giao diện chép y nguyên docs/superpowers/giao-dien/checklist-stitch-pro.html (anh chọn 17/10); lớp Tailwind dựng sẵn ở styles.css (npm run css).
(function () {
  "use strict";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () { /* bỏ qua lỗi đăng ký sw */ });
  }

  // Trạng thái ứng dụng
  var currentView = "today"; // "login" | "today" | "detail" | "samples" | "exceptions"
  var dangNhap = docMay(KHOA_DANG_NHAP, null);
  var anhChup = null;
  var activeNgay = "";
  var activeMay = "";
  var selectedBatchKeys = {}; // ngay -> khoa lô đang chọn làm thẻ to
  var expandedStepInActiveCard = {}; // khoa -> số bước đang mở
  var editModeNhanXanh = {}; // khoa -> đang bật ô sửa bước ⓪
  var detailBatchKhoa = "";
  var tamError = false;
  var globalError = null;
  var globalNotice = null;

  var DANH_SACH_NGUOI = [
    { ma: "thanh", ten: "anh Thanh" },
    { ma: "minh", ten: "Minh" },
    { ma: "ban", ten: "B.An" },
    { ma: "vinh", ten: "Vinh" },
    { ma: "doan", ten: "Đoan" }
  ];

  // ---------- Lớp Tailwind (chuỗi đầy đủ để Tailwind quét được) ----------
  var C = {
    nutChinh: "flex items-center justify-center gap-1.5 h-[50px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 text-[12px] font-mono-num font-bold shadow-lg shadow-amber-900/40 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed",
    nutPhu: "flex items-center justify-center gap-1.5 h-[50px] rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface text-[12px] font-mono-num font-semibold border border-surface-container-highest active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed",
    nutTim: "flex items-center justify-center gap-1.5 h-[50px] rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[12px] font-mono-num font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed",
    o: "flex flex-col bg-surface-container-lowest p-2.5 rounded-xl border border-surface-container-highest",
    nhan: "text-[10px] font-mono-num text-on-surface-variant uppercase",
    nhapSo: "w-full bg-surface-container text-on-surface font-mono-num text-[18px] font-bold px-2 py-1 rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary select-text",
    nhapChu: "w-full bg-surface-container text-on-surface font-mono-num text-[14px] font-semibold px-2 py-2 rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary"
  };
  // Theo màu trạng thái bước: xanh ✓ · vang ? · do ! · xam ○
  var VUONG = {
    xanh: "w-9 h-9 rounded-lg bg-emerald-500/20 text-secondary border border-emerald-500/30 flex items-center justify-center shrink-0",
    vang: "w-9 h-9 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0",
    do: "w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0",
    xam: "w-9 h-9 rounded-lg bg-surface-container-highest text-on-surface-variant border border-surface-container-highest flex items-center justify-center shrink-0"
  };
  var ICON_TT = { xanh: "check_circle", vang: "help", do: "error", xam: "radio_button_unchecked" };
  var KY = {
    xanh: "text-[15px] leading-none text-secondary font-bold w-5 shrink-0",
    vang: "text-[15px] leading-none text-amber-400 font-bold w-5 shrink-0",
    do: "text-[15px] leading-none text-rose-400 font-bold w-5 shrink-0",
    xam: "text-[15px] leading-none text-on-surface-variant font-bold w-5 shrink-0"
  };
  var HANG = {
    xanh: "flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-surface-container-highest/60 transition-all cursor-pointer",
    vang: "flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-amber-500/30 transition-all cursor-pointer",
    do: "flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-rose-500/30 transition-all cursor-pointer",
    xam: "flex items-center justify-between p-2.5 rounded-xl bg-surface-container/60 border border-surface-container-highest/40 opacity-80 transition-all cursor-pointer"
  };
  var VIEN = {
    xanh: "px-2 py-0.5 rounded-full bg-emerald-500/20 text-secondary font-mono-num text-[9px] font-bold uppercase tracking-wider border border-emerald-500/30",
    vang: "px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono-num text-[9px] font-bold uppercase tracking-wider border border-amber-500/40",
    do: "px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono-num text-[9px] font-bold uppercase tracking-wider border border-rose-500/40",
    xam: "px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono-num text-[9px] font-bold uppercase tracking-wider border border-primary/30"
  };
  // Hao hụt: trong ngưỡng / dưới / trên / chưa có (cùng ngưỡng của mauHaoHut, chỉ tách màu dưới–trên)
  var HH = {
    xanh: { the: "px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold bg-emerald-500/20 text-secondary border border-emerald-500/30", so: "font-mono-num text-[22px] font-bold text-secondary", chu: "text-secondary font-bold", kim: "w-2.5 h-full bg-secondary rounded shadow-lg shadow-emerald-500/50", nhan: "TRONG", ten: "Trong ngưỡng" },
    thap: { the: "px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40", so: "font-mono-num text-[22px] font-bold text-amber-400", chu: "text-amber-400 font-bold", kim: "w-2.5 h-full bg-amber-400 rounded shadow-lg shadow-amber-500/50", nhan: "DƯỚI", ten: "Dưới ngưỡng" },
    cao: { the: "px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40", so: "font-mono-num text-[22px] font-bold text-rose-400", chu: "text-rose-400 font-bold", kim: "w-2.5 h-full bg-rose-400 rounded shadow-lg shadow-rose-500/50", nhan: "TRÊN", ten: "Trên ngưỡng" },
    xam: { the: "px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold bg-surface-container-highest text-on-surface-variant border border-surface-container-highest", so: "font-mono-num text-[22px] font-bold text-on-surface-variant", chu: "text-on-surface-variant font-bold", kim: "w-2.5 h-full bg-on-surface-variant rounded", nhan: "—", ten: "Chưa có ngưỡng" }
  };
  var ICON_BUOC = ["inventory_2", "timer", "done_all", "checklist", "scale", "blender", "science"];

  // ---------- Trợ thủ DOM (chỉ textContent / createElement) ----------
  function el(tag, className, textContent) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (textContent !== undefined && textContent !== null) e.textContent = textContent;
    return e;
  }
  function ic(ten, cls) { return el("span", "material-symbols-outlined " + (cls || ""), ten); }
  function nut(cls, icon, chu, iconCls) {
    var b = el("button", cls);
    b.type = "button";
    if (icon) b.appendChild(ic(icon, iconCls || "text-[18px]"));
    b.appendChild(el("span", null, chu));
    return b;
  }
  // "10,4" + chữ "kg" nhỏ như bản stitch
  function soKg(cls, so, chuSo) {
    var s = el("span", cls, so === null || so === undefined ? "—" : soVN(so, chuSo === undefined ? 1 : chuSo));
    if (so !== null && so !== undefined) {
      s.appendChild(document.createTextNode(" "));
      s.appendChild(el("span", "text-[10px] text-on-surface-variant font-normal", "kg"));
    }
    return s;
  }

  function kyHieuTrangThai(mau) {
    if (mau === "xanh") return "✓";
    if (mau === "vang") return "?";
    if (mau === "do") return "!";
    return "○";
  }
  function chuTrangThai(mau) {
    if (mau === "xanh") return "Đã xong";
    if (mau === "vang") return "Quên bấm?";
    if (mau === "do") return "Lệch";
    return "Chưa làm";
  }
  function mauCua(st) { return VUONG[st.mau] ? st.mau : "xam"; }

  function demBuoc(batch) {
    var hien = (batch.buoc || []).filter(function (b) { return b.mau !== "an"; });
    return { tong: hien.length, xong: hien.filter(function (b) { return b.mau === "xanh"; }).length };
  }
  function tenMay(l) { return l.may ? "Máy " + String(l.may).replace(/K$/, "KG") : (l.mayTen || ""); }
  function tenLo(l) { return l.sp ? l.sp : "Chưa rõ: " + (l.tenGoc || ""); }
  function dinhDangGio(iso) { return iso && iso.length >= 16 ? iso.slice(11, 16) : (iso || ""); }
  function dinhDangNgayThang(ngay) { return ngay && ngay.length >= 10 ? ngay.slice(8, 10) + "/" + ngay.slice(5, 7) : (ngay || ""); }
  function thuCua(ngay) {
    var d = new Date(ngay + "T00:00:00");
    return isNaN(d) ? "" : ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
  }
  function coChoGui(khoa) { return choGuiCuaLo(docMay(KHOA_HANG_DOI, []), khoa).length > 0; }
  // Dòng phụ của bước: ai bấm lúc nào, không thì ký hiệu + trạng thái
  function phuDeBuoc(st) {
    return st.nguoi ? st.nguoi + (st.gio ? " · " + dinhDangGio(st.gio) : "") : kyHieuTrangThai(st.mau) + " " + chuTrangThai(st.mau);
  }
  function mo(view, khoa) {
    currentView = view;
    if (khoa) detailBatchKhoa = khoa;
    renderApp();
    window.scrollTo(0, 0);
  }

  // ---------- Hàng đợi gửi ----------
  function kichHoatGuiHangDoi() {
    if (!dangNhap) return;
    xaHangDoi(dangNhap, function (evt) {
      if (evt.loai === "da") {
        taiAnhChup(dangNhap).then(function (res) {
          if (res && res.ok) anhChup = res;
          renderApp();
        });
        if (evt.kq && evt.kq.lech) {
          globalNotice = "Đã ghi — khác gợi ý, anh Thanh sẽ được báo";
          setTimeout(function () { globalNotice = null; renderApp(); }, 6000);
        }
      } else if (evt.loai === "tuChoi") {
        globalError = (evt.kq && (evt.kq.chu || evt.kq.loi)) || "Thao tác bị từ chối";
        setTimeout(function () { globalError = null; renderApp(); }, 6000);
        renderApp();
      } else if (evt.loai === "tam") {
        if (evt.kq && evt.kq.loi === "LOI_MAY_CHU") tamError = true;
        renderApp();
      } else if (evt.loai === "xong") {
        tamError = false;
        renderApp();
      }
    });
  }
  setInterval(function () { if (dangNhap) kichHoatGuiHangDoi(); }, 30000);
  window.addEventListener("online", function () { if (dangNhap) kichHoatGuiHangDoi(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && dangNhap) kichHoatGuiHangDoi(); });

  function thucHienThaoTac(op) {
    guiThaoTac(op);
    kichHoatGuiHangDoi();
    renderApp();
  }

  // ==========================================
  // KHUNG APP
  // ==========================================
  function renderApp() {
    var root = document.getElementById("app");
    if (!root) return;
    root.textContent = "";

    if (!dangNhap) { renderLogin(root); return; }
    if (!anhChup) {
      var cho = el("main", "max-w-md mx-auto w-full px-4 pt-36 flex flex-col gap-4");
      cho.appendChild(el("div", "p-4 rounded-xl bg-surface-container-low border border-surface-container-highest text-[12px] font-mono-num text-on-surface-variant text-center", "Đang nạp dữ liệu..."));
      root.appendChild(cho);
      return;
    }

    chonNgayMacDinh();
    renderHeader(root);
    var main = el("main", "max-w-md mx-auto w-full px-4 pt-36 flex flex-col gap-4");
    renderBanners(main);
    if (currentView === "today") renderToday(main);
    else if (currentView === "detail") renderDetail(main);
    else if (currentView === "samples") renderSamples(main);
    else if (currentView === "exceptions") renderExceptions(main);
    root.appendChild(main);
    renderBottomNav(root);
  }

  function dsNgayCo() {
    var m = {};
    (anhChup.lo || []).forEach(function (l) { if (l.ngay) m[l.ngay] = l.thu || thuCua(l.ngay); });
    return m;
  }
  function chonNgayMacDinh() {
    if (activeNgay) return;
    var m = dsNgayCo(), ds = Object.keys(m).sort();
    activeNgay = anhChup.homNay && m[anhChup.homNay] ? anhChup.homNay : (ds.length ? ds[ds.length - 1] : "");
  }

  // ---------- Đầu trang cố định ----------
  function renderHeader(root) {
    var header = el("header", "fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-surface-container-highest shadow-[0_4px_20px_rgba(0,0,0,0.5)]");
    var wrap = el("div", "max-w-md mx-auto px-4 py-2.5 flex flex-col gap-2");

    // Dải trên: trạng thái mạng + ngày hôm nay
    var matMang = !navigator.onLine || !!anhChup.cuDaLuu;
    var sub = el("div", "flex items-center justify-between bg-surface-container-low/90 px-3 py-1 rounded-lg border border-surface-container-highest/50");
    var trai = el("div", "flex items-center gap-2");
    var cham = el("span", "flex h-2 w-2 relative");
    cham.appendChild(el("span", matMang ? "absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" : "animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"));
    cham.appendChild(el("span", matMang ? "relative inline-flex rounded-full h-2 w-2 bg-amber-400" : "relative inline-flex rounded-full h-2 w-2 bg-secondary"));
    trai.appendChild(cham);
    trai.appendChild(el("span", matMang ? "font-mono-num text-[11px] uppercase text-amber-400 font-bold tracking-wider whitespace-nowrap" : "font-mono-num text-[11px] uppercase text-secondary font-bold tracking-wider whitespace-nowrap", matMang ? "MẤT MẠNG" : "TRỰC TUYẾN"));
    trai.appendChild(el("span", "text-on-surface-variant text-[11px]", "•"));
    trai.appendChild(el("span", "text-[12px] text-on-surface font-medium truncate max-w-[140px]", "Phòng Rang Intenso"));
    sub.appendChild(trai);
    var phai = el("div", "flex items-center gap-1.5 text-tertiary");
    phai.appendChild(ic("schedule", "text-[15px]"));
    phai.appendChild(el("span", "font-mono-num text-[11px] text-on-surface-variant font-medium whitespace-nowrap", thuCua(anhChup.homNay) + " " + dinhDangNgayThang(anhChup.homNay)));
    sub.appendChild(phai);
    wrap.appendChild(sub);

    // Tên app + người đang dùng
    var hang = el("div", "flex items-center justify-between gap-2");
    var brand = el("div", "flex items-center gap-2.5 min-w-0");
    var logo = el("div", "w-9 h-9 rounded-xl bg-gradient-to-br from-primary-container to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/30");
    logo.appendChild(ic("coffee", "text-white text-[20px]"));
    brand.appendChild(logo);
    var chu = el("div", "flex flex-col min-w-0");
    var dong1 = el("div", "flex items-center gap-1.5");
    dong1.appendChild(el("span", "text-[16px] text-on-surface font-bold truncate", "Checklist Mẻ Rang"));
    dong1.appendChild(el("span", "px-1.5 py-0.5 rounded text-[9px] font-mono-num bg-primary/20 text-primary font-bold", "INTENSO"));
    chu.appendChild(dong1);
    chu.appendChild(el("span", "text-[11px] text-on-surface-variant font-medium", "7 bước sau rang · Máy 30kg & 5kg"));
    brand.appendChild(chu);
    hang.appendChild(brand);

    var doiNguoi = el("button", "flex items-center gap-1 shrink-0 bg-surface-container-high px-2 py-1 rounded-xl border border-surface-container-highest active:scale-95 transition-transform");
    doiNguoi.type = "button";
    doiNguoi.title = "Đổi người";
    doiNguoi.appendChild(ic(anhChup.chiXem ? "lock" : "badge", "text-primary text-[18px]"));
    doiNguoi.appendChild(el("span", "text-[12px] font-mono-num text-on-surface font-semibold whitespace-nowrap", anhChup.ten || ""));
    doiNguoi.appendChild(ic("swap_horiz", "text-on-surface-variant text-[16px]"));
    doiNguoi.onclick = function () {
      xoaMay(KHOA_DANG_NHAP);
      dangNhap = null;
      anhChup = null;
      activeNgay = "";
      currentView = "login";
      renderApp();
    };
    hang.appendChild(doiNguoi);
    wrap.appendChild(hang);

    // Tiến độ ngày đang chọn: số bước xong / tổng bước
    var ds = loCuaNgay(anhChup.lo || [], activeNgay, activeMay);
    var tong = 0, xong = 0;
    ds.forEach(function (l) { var d = demBuoc(l); tong += d.tong; xong += d.xong; });
    var pct = tong ? Math.round(xong * 100 / tong) : 0;
    var tienDo = el("div", "flex flex-col gap-1");
    var td = el("div", "flex items-center justify-between text-[11px] text-on-surface-variant font-mono-num");
    var tdTrai = el("span", null, "Tiến độ " + (dsNgayCo()[activeNgay] || "") + " " + dinhDangNgayThang(activeNgay) + ": ");
    tdTrai.appendChild(el("strong", "text-on-surface", xong + "/" + tong + " bước"));
    td.appendChild(tdTrai);
    td.appendChild(el("span", "text-primary font-bold", pct + "%"));
    tienDo.appendChild(td);
    var thanh = el("div", "w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden");
    var lap = el("div", "h-full bg-gradient-to-r from-amber-500 to-secondary rounded-full transition-all duration-500");
    lap.style.width = pct + "%";
    thanh.appendChild(lap);
    tienDo.appendChild(thanh);
    wrap.appendChild(tienDo);

    header.appendChild(wrap);
    root.appendChild(header);
  }

  // ---------- Dải báo (kiểu dải "chỉ xem" của stitch) ----------
  function dai(kieu, icon, chu, dam) {
    var cls = kieu === "do"
      ? "bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl flex items-center gap-2 text-rose-300 text-[12px]"
      : kieu === "xam"
        ? "bg-surface-container-high border border-surface-container-highest p-2.5 rounded-xl flex items-center gap-2 text-on-surface-variant text-[12px]"
        : "bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl flex items-center gap-2 text-amber-300 text-[12px]";
    var d = el("div", cls);
    d.appendChild(ic(icon, "text-[18px] shrink-0"));
    var s = el("span");
    if (dam) s.appendChild(el("strong", null, dam + " "));
    s.appendChild(document.createTextNode(chu));
    d.appendChild(s);
    return d;
  }
  function renderBanners(main) {
    var n = soChoGui();
    if (n > 0) main.appendChild(dai("vang", "schedule", "thao tác chưa gửi — sẽ tự gửi khi có mạng", String(n)));
    if (tamError) main.appendChild(dai("do", "sync_problem", "thao tác vẫn giữ trên máy, sẽ tự gửi lại", "Máy chủ lỗi:"));
    if (anhChup.cuDaLuu) {
      var luc = anhChup.luc ? new Date(anhChup.luc).toTimeString().slice(0, 5) : "";
      main.appendChild(dai("xam", "cloud_off", "Dữ liệu lúc " + luc + " (đang mất mạng)"));
    }
    if (anhChup.chiXem) main.appendChild(dai("vang", "lock", "Xem tiến độ & túi mẫu, không sửa được các bước.", "Chế độ chỉ xem:"));
    if (globalError) main.appendChild(dai("do", "error", globalError));
    if (globalNotice) main.appendChild(dai("vang", "info", globalNotice));
  }

  // ==========================================
  // CHỌN TÊN (ĐĂNG NHẬP)
  // ==========================================
  var selectedUserMa = "thanh";
  var loginErrorText = "";

  function renderLogin(root) {
    var main = el("main", "max-w-md mx-auto w-full px-4 pt-16 pb-8 flex flex-col gap-4");

    var dau = el("div", "flex flex-col items-center gap-2 text-center");
    var logo = el("div", "w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-container to-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/30");
    logo.appendChild(ic("coffee", "text-white text-[30px]"));
    dau.appendChild(logo);
    var t = el("div", "flex items-center gap-1.5");
    t.appendChild(el("h1", "text-[20px] text-on-surface font-bold", "Checklist Mẻ Rang"));
    t.appendChild(el("span", "px-1.5 py-0.5 rounded text-[9px] font-mono-num bg-primary/20 text-primary font-bold", "INTENSO"));
    dau.appendChild(t);
    dau.appendChild(el("p", "text-[12px] text-on-surface-variant", "Phòng Rang Intenso — chọn tên để vào ca"));
    main.appendChild(dau);

    var the = el("section", "flex flex-col gap-3 p-4 rounded-2xl bg-surface-container-low border border-surface-container-highest shadow-2xl");
    the.appendChild(el("span", "text-[11px] font-mono-num uppercase tracking-wider text-slate-300 font-bold", "Bạn là ai?"));
    var luoi = el("div", "grid grid-cols-2 gap-2");
    DANH_SACH_NGUOI.forEach(function (u) {
      var chon = selectedUserMa === u.ma;
      var b = el("button", chon
        ? "flex items-center gap-1.5 h-[46px] px-3 rounded-xl bg-surface-container-highest text-primary border border-primary/50 text-[13px] font-semibold"
        : "flex items-center gap-1.5 h-[46px] px-3 rounded-xl bg-surface-container text-on-surface border border-surface-container-highest text-[13px] font-semibold");
      b.type = "button";
      b.appendChild(ic("person", chon ? "text-[16px] text-primary" : "text-[16px] text-on-surface-variant"));
      b.appendChild(el("span", null, u.ten));
      b.onclick = function () { selectedUserMa = u.ma; loginErrorText = ""; renderApp(); };
      luoi.appendChild(b);
    });
    the.appendChild(luoi);

    var o = el("div", C.o);
    o.appendChild(el("span", C.nhan, "Mã 6 số của " + ((DANH_SACH_NGUOI.find(function (x) { return x.ma === selectedUserMa; }) || {}).ten || "")));
    var input = el("input", C.nhapSo + " mt-1 tracking-[0.3em]");
    input.type = "password";
    input.inputMode = "numeric";
    input.maxLength = 6;
    input.autocomplete = "one-time-code";
    input.placeholder = "••••••";
    o.appendChild(input);
    the.appendChild(o);

    if (loginErrorText) the.appendChild(dai("do", "error", loginErrorText));

    var vao = nut(C.nutChinh + " w-full", "verified", "Vào");
    input.onkeydown = function (e) { if (e.key === "Enter") vao.click(); };
    vao.onclick = function () {
      var authPayload = { nguoi: selectedUserMa, ma: input.value.trim() };
      vao.disabled = true;
      vao.lastChild.textContent = "Đang kiểm tra...";
      taiAnhChup(authPayload).then(function (res) {
        if (res && res.ok) {
          dangNhap = authPayload;
          ghiMay(KHOA_DANG_NHAP, dangNhap);
          anhChup = res;
          currentView = "today";
        } else {
          var errKey = res ? res.loi : "NETWORK";
          if (errKey === "SAI_MA") loginErrorText = "Mã chưa đúng";
          else if (errKey === "KHOA") loginErrorText = "Sai quá nhiều lần — thử lại sau 15 phút";
          else if (errKey === "CHUA_CO_MA") loginErrorText = "Anh Thanh chưa cấp mã cho tên này";
          else if (errKey === "NETWORK") loginErrorText = "Không có mạng — thử lại";
          else loginErrorText = errKey || "Đăng nhập không thành công";
        }
        renderApp();
      });
    };
    the.appendChild(vao);
    main.appendChild(the);
    root.appendChild(main);
  }

  // ==========================================
  // HÔM NAY
  // ==========================================
  function renderToday(main) {
    var ngayMap = dsNgayCo();
    var dsNgay = Object.keys(ngayMap).sort();
    var ds = loCuaNgay(anhChup.lo || [], activeNgay, activeMay);

    // 1. Bốn ô số
    var quenBam = ds.filter(function (l) { return (l.buoc || []).some(function (b) { return b.mau === "vang"; }); }).length;
    var daXong = ds.filter(function (l) { return l.xong; }).length;
    var tuiChua = (anhChup.tui || []).filter(function (t) { return !t.daLay; }).length;
    var kpi = el("section", "grid grid-cols-4 gap-2 w-full");
    function oKpi(lop, lopNhan, icon, nhan, lopSo, so, lopChu, chu) {
      var c = el("div", lop);
      var top = el("div", lopNhan);
      top.appendChild(ic(icon, "text-[14px]"));
      top.appendChild(el("span", "text-[10px] uppercase font-mono-num font-bold whitespace-nowrap", nhan));
      c.appendChild(top);
      c.appendChild(el("span", lopSo, String(so)));
      c.appendChild(el("span", lopChu, chu));
      kpi.appendChild(c);
      return c;
    }
    oKpi("flex flex-col items-center justify-center p-2.5 rounded-xl bg-surface-container-high border border-surface-container-highest/60 shadow-md",
      "flex items-center gap-1 text-on-surface-variant mb-0.5", "inventory_2", "Tổng lô",
      "font-mono-num text-[20px] font-bold text-on-surface", ds.length, "text-[10px] text-on-surface-variant font-mono-num", "trong ngày");
    oKpi("flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-md",
      "flex items-center gap-1 text-amber-400 mb-0.5", "priority_high", "Cần xem",
      "font-mono-num text-[20px] font-bold text-amber-400", quenBam, "text-[10px] text-amber-300/80 font-mono-num", "quên bấm");
    oKpi("flex flex-col items-center justify-center p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 shadow-md",
      "flex items-center gap-1 text-secondary mb-0.5", "task_alt", "Đã xong",
      "font-mono-num text-[20px] font-bold text-secondary", daXong, "text-[10px] text-emerald-400/80 font-mono-num", "hoàn tất");
    var oTui = oKpi("flex flex-col items-center justify-center p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 shadow-md cursor-pointer",
      "flex items-center gap-1 text-purple-300 mb-0.5", "science", "Túi mẫu",
      "font-mono-num text-[20px] font-bold text-purple-300", tuiChua, "text-[10px] text-purple-200/80 font-mono-num", "chưa lấy");
    oTui.onclick = function () { mo("samples"); };
    main.appendChild(kpi);

    // 2. Chọn ngày + máy (cùng kiểu thanh lọc máy của stitch)
    if (dsNgay.length > 1) {
      var hangNgay = el("section", "flex items-center justify-between gap-1 bg-surface-container-low p-1.5 rounded-xl border border-surface-container-highest");
      dsNgay.forEach(function (ngay) {
        var b = el("button", activeNgay === ngay
          ? "flex-1 py-1.5 rounded-lg bg-surface-container-highest text-primary text-[11px] font-mono-num font-semibold transition-all"
          : "flex-1 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface text-[11px] font-mono-num transition-all",
          ngayMap[ngay] + " " + dinhDangNgayThang(ngay) + (ngay === anhChup.homNay ? " · nay" : ""));
        b.type = "button";
        b.onclick = function () { activeNgay = ngay; renderApp(); };
        hangNgay.appendChild(b);
      });
      main.appendChild(hangNgay);
    }
    var hangMay = el("section", "flex items-center justify-between gap-1 bg-surface-container-low p-1.5 rounded-xl border border-surface-container-highest");
    [{ val: "", label: "Tất cả" }, { val: "30K", label: "Máy 30KG" }, { val: "5K", label: "Máy 5KG" }].forEach(function (m) {
      var so = loCuaNgay(anhChup.lo || [], activeNgay, m.val).length;
      var b = el("button", activeMay === m.val
        ? "flex-1 py-1.5 rounded-lg bg-surface-container-highest text-primary text-[11px] font-mono-num font-semibold transition-all"
        : "flex-1 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface text-[11px] font-mono-num transition-all",
        m.label + " (" + so + ")");
      b.type = "button";
      b.onclick = function () { activeMay = m.val; renderApp(); };
      hangMay.appendChild(b);
    });
    main.appendChild(hangMay);

    if (ds.length === 0) {
      main.appendChild(el("div", "p-4 rounded-xl bg-surface-container-low border border-surface-container-highest text-[12px] font-mono-num text-on-surface-variant text-center", "Không có lô nào trong ngày và máy đã chọn."));
      return;
    }

    // 3. Thẻ lô đang làm: lô đã chọn, không thì lô dở đầu tiên
    var allDone = ds.every(function (l) { return l.xong; });
    var active = null;
    if (allDone) {
      var xongHet = el("div", "p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-secondary text-[13px] font-semibold");
      xongHet.appendChild(ic("task_alt", "text-[18px]"));
      xongHet.appendChild(el("span", null, "Xong hết lô ngày này"));
      main.appendChild(xongHet);
    } else {
      var k = selectedBatchKeys[activeNgay];
      active = k ? ds.find(function (l) { return l.khoa === k; }) : null;
      if (!active || active.xong) active = ds.find(function (l) { return !l.xong; });
      renderBigActiveCard(main, active);
    }

    // 4. Hàng chờ
    var con = ds.filter(function (l) { return !active || l.khoa !== active.khoa; });
    if (con.length === 0) return;
    var sec = el("section", "flex flex-col gap-2.5");
    sec.appendChild(el("span", "text-[11px] font-mono-num uppercase tracking-wider text-on-surface-variant font-bold px-1", (allDone ? "Các lô trong ngày" : "Hàng chờ") + " (" + con.length + " lô còn lại)"));
    con.forEach(function (b) { sec.appendChild(theHangCho(b)); });
    main.appendChild(sec);
  }

  function theHangCho(b) {
    var d = demBuoc(b);
    var coVang = (b.buoc || []).some(function (st) { return st.mau === "vang"; });
    var hh = haoHut(b.kgVao, b.kgRa);
    var card, dot, sub, phai;
    if (b.xong) {
      card = el("div", "p-3 rounded-xl bg-surface-container-low border border-surface-container-highest flex items-center justify-between cursor-pointer");
      dot = el("span", "w-2.5 h-2.5 rounded-full bg-secondary shrink-0");
      sub = el("span", "text-[11px] font-mono-num text-on-surface-variant", tenMay(b) + " · " + (b.kgRa !== null && b.kgRa !== undefined ? soVN(b.kgRa, 1) + " kg" : "—") + (hh !== null ? " · Hao hụt: " + soVN(hh, 1) + "%" : ""));
      phai = el("span", "px-2 py-0.5 rounded-full bg-emerald-500/10 text-secondary border border-emerald-500/30 font-mono-num text-[10px] font-bold shrink-0", "✓ ĐÃ XONG");
    } else if (coVang) {
      card = el("div", "p-3 rounded-xl bg-surface-container-low border border-amber-500/30 flex items-center justify-between relative overflow-hidden cursor-pointer");
      card.appendChild(el("div", "absolute left-0 top-0 bottom-0 w-1 bg-amber-500"));
      dot = el("span", "w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0");
      sub = el("span", "text-[11px] font-mono-num text-amber-300", tenMay(b) + " · " + d.xong + "/" + d.tong + " bước · ? Quên bấm");
      phai = el("span", "px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono-num font-bold shrink-0", "Xem ngay");
    } else {
      card = el("div", "p-3 rounded-xl bg-surface-container-low border border-surface-container-highest flex items-center justify-between opacity-70 cursor-pointer");
      dot = el("span", "w-2.5 h-2.5 rounded-full bg-surface-variant shrink-0");
      sub = el("span", "text-[11px] font-mono-num text-on-surface-variant", tenMay(b) + " · " + d.xong + "/" + d.tong + " bước" + (b.tiep ? " · " + b.tiep : ""));
      phai = el("span", "text-[11px] font-mono-num text-on-surface-variant shrink-0", "Hàng chờ");
    }
    var trai = el("div", coVang && !b.xong ? "flex items-center gap-2.5 min-w-0 pl-1" : "flex items-center gap-2.5 min-w-0");
    trai.appendChild(dot);
    var chu = el("div", "flex flex-col min-w-0");
    chu.appendChild(el("span", b.sp ? "text-[13px] text-on-surface font-semibold truncate" : "text-[13px] text-amber-300 font-semibold truncate", tenLo(b)));
    chu.appendChild(sub);
    trai.appendChild(chu);
    card.appendChild(trai);
    var phaiBox = el("div", "flex items-center gap-1.5 shrink-0");
    if (coChoGui(b.khoa)) phaiBox.appendChild(ic("schedule", "text-[16px] text-amber-400"));
    phaiBox.appendChild(phai);
    card.appendChild(phaiBox);
    card.onclick = function () {
      selectedBatchKeys[activeNgay] = b.khoa;
      renderApp();
      window.scrollTo(0, 0);
    };
    return card;
  }

  // ---------- Đầu thẻ lô + dải 3 số (dùng chung Hôm nay / Chi tiết) ----------
  function dauThe(the, batch, coPill) {
    var dem = demBuoc(batch);
    var head = el("div", "flex items-start justify-between");
    var trai = el("div", "flex flex-col min-w-0");
    var dong = el("div", "flex items-center gap-2 flex-wrap");
    dong.appendChild(el("span", batch.sp ? "text-[17px] text-on-surface font-bold tracking-tight" : "text-[17px] text-amber-300 font-bold tracking-tight", tenLo(batch)));
    if (coPill) {
      var pill = el("span", "px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono-num text-[10px] font-bold flex items-center gap-1 border border-primary/30");
      pill.appendChild(el("span", "w-1.5 h-1.5 rounded-full bg-primary animate-ping"));
      pill.appendChild(el("span", null, "BƯỚC " + dem.xong + "/" + dem.tong));
      dong.appendChild(pill);
    }
    if (coChoGui(batch.khoa)) dong.appendChild(ic("schedule", "text-[16px] text-amber-400"));
    trai.appendChild(dong);
    var p = el("p", "text-[12px] text-on-surface-variant flex items-center gap-1.5 mt-0.5");
    p.appendChild(el("span", "font-semibold text-slate-300", tenMay(batch)));
    p.appendChild(el("span", null, "•"));
    p.appendChild(el("span", "text-tertiary font-mono-num", "Mã mẻ: " + (batch.maMe || "—")));
    trai.appendChild(p);
    head.appendChild(trai);
    var phai = el("div", "flex flex-col items-end shrink-0");
    phai.appendChild(el("span", "text-[10px] font-mono-num text-on-surface-variant uppercase", "Ngày rang"));
    var ngay = el("span", "text-[12px] text-on-surface font-semibold flex items-center gap-1 mt-0.5");
    ngay.appendChild(ic("calendar_today", "text-[14px] text-secondary"));
    ngay.appendChild(document.createTextNode((batch.thu || thuCua(batch.ngay)) + " " + dinhDangNgayThang(batch.ngay)));
    phai.appendChild(ngay);
    head.appendChild(phai);
    the.appendChild(head);

    var strip = el("div", "grid grid-cols-3 gap-2 bg-surface-container p-2.5 rounded-xl border border-surface-container-highest/60");
    var c1 = el("div", "flex flex-col");
    c1.appendChild(el("span", "text-[10px] font-mono-num text-on-surface-variant uppercase", "Số mẻ"));
    c1.appendChild(el("span", "font-mono-num text-[14px] font-semibold text-on-surface mt-0.5", String(batch.soMe)));
    var c2 = el("div", "flex flex-col");
    c2.appendChild(el("span", "text-[10px] font-mono-num text-on-surface-variant uppercase", "Kg vào"));
    c2.appendChild(soKg("font-mono-num text-[14px] font-semibold text-primary mt-0.5", batch.kgVao));
    var c3 = el("div", "flex flex-col items-end");
    c3.appendChild(el("span", "text-[10px] font-mono-num text-on-surface-variant uppercase", "Kg ra"));
    c3.appendChild(soKg("font-mono-num text-[14px] font-bold text-secondary mt-0.5", batch.kgRa));
    strip.appendChild(c1); strip.appendChild(c2); strip.appendChild(c3);
    the.appendChild(strip);

    if (batch.tiLe) the.appendChild(el("p", "text-[11px] font-mono-num text-on-surface-variant -mt-1.5", batch.tiLe)); // chỉ xem
    if (batch.co) the.appendChild(dai("vang", "warning", "Thêm mẻ sau khi cân — Lưu lại kg ra"));
  }

  function vanThe() {
    var article = el("article", "flex flex-col w-full rounded-2xl bg-surface-container-low border border-surface-container-highest shadow-2xl overflow-hidden relative");
    article.appendChild(el("div", "w-full h-1 bg-gradient-to-r from-secondary via-primary to-amber-500"));
    var trong = el("div", "p-4 flex flex-col gap-3.5");
    article.appendChild(trong);
    return { article: article, trong: trong };
  }

  function dauQuyTrinh(trong, dem) {
    var h = el("div", "flex items-center justify-between pb-0.5");
    var t = el("span", "text-[11px] font-mono-num uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5");
    t.appendChild(ic("checklist", "text-primary text-[16px]"));
    t.appendChild(document.createTextNode("Quy trình " + dem.tong + " bước"));
    h.appendChild(t);
    h.appendChild(el("span", "text-[11px] font-mono-num text-secondary font-bold", dem.xong + " / " + dem.tong + " Hoàn tất"));
    trong.appendChild(h);
  }

  // ---------- Thẻ lô đang làm ----------
  function renderBigActiveCard(main, batch) {
    if (!batch) return;
    var v = vanThe();
    dauThe(v.trong, batch, true);

    var steps = el("div", "flex flex-col gap-2 mt-1");
    dauQuyTrinh(steps, demBuoc(batch));

    var moBuoc = expandedStepInActiveCard[batch.khoa];
    if (moBuoc === undefined || moBuoc === null) {
      var dau = (batch.buoc || []).find(function (b) { return b.mau !== "xanh" && b.mau !== "an"; });
      moBuoc = dau ? dau.so : 0;
      expandedStepInActiveCard[batch.khoa] = moBuoc;
    }
    (batch.buoc || []).forEach(function (st) {
      if (st.mau === "an") return;
      if (st.so === moBuoc) steps.appendChild(oBuocMo(st, batch, true));
      else steps.appendChild(hangBuoc(st, batch));
    });
    v.trong.appendChild(steps);

    var chan = el("div", "flex items-center gap-2 pt-2 border-t border-surface-container-highest");
    var xem = el("button", "flex-1 flex items-center justify-center gap-1.5 h-[46px] rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface border border-surface-container-highest text-[12px] font-mono-num font-semibold active:scale-95 transition-all");
    xem.type = "button";
    xem.appendChild(ic("checklist", "text-[16px] text-primary"));
    xem.appendChild(el("span", null, "Xem đủ lô"));
    xem.onclick = function () { mo("detail", batch.khoa); };
    chan.appendChild(xem);
    var sang = el("button", "w-[46px] h-[46px] rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface border border-surface-container-highest flex items-center justify-center shrink-0 active:scale-95 transition-all");
    sang.type = "button";
    sang.title = "Mở chi tiết lô";
    sang.appendChild(ic("chevron_right", "text-[20px]"));
    sang.onclick = xem.onclick;
    chan.appendChild(sang);
    v.trong.appendChild(chan);

    main.appendChild(v.article);
  }

  // Bước thu gọn 1 dòng (bấm để mở)
  function hangBuoc(st, batch) {
    var m = mauCua(st);
    var row = el("div", HANG[m]);
    var trai = el("div", "flex items-center gap-2.5 min-w-0");
    trai.appendChild(el("span", KY[m], st.ky));
    var chu = el("div", "flex flex-col min-w-0");
    var d1 = el("div", "flex items-center gap-1.5");
    d1.appendChild(el("span", m === "xam" ? "text-[13px] text-on-surface-variant font-semibold truncate" : "text-[13px] text-on-surface font-semibold truncate", st.ten));
    if (st.gio) d1.appendChild(el("span", "font-mono-num text-[10px] text-on-surface-variant", dinhDangGio(st.gio)));
    chu.appendChild(d1);
    chu.appendChild(el("span", "text-[11px] text-on-surface-variant truncate", st.nguoi ? st.nguoi : kyHieuTrangThai(st.mau) + " " + chuTrangThai(st.mau)));
    trai.appendChild(chu);
    row.appendChild(trai);
    var vuong = el("div", VUONG[m]);
    vuong.title = kyHieuTrangThai(st.mau) + " " + chuTrangThai(st.mau);
    vuong.appendChild(ic(ICON_TT[m], "text-[20px]"));
    row.appendChild(vuong);
    row.onclick = function () {
      expandedStepInActiveCard[batch.khoa] = st.so;
      renderApp();
    };
    return row;
  }

  // Bước mở (khung viền cam của stitch). noiBat = bước hiện tại trên thẻ Hôm nay
  function oBuocMo(st, batch, noiBat) {
    var m = mauCua(st);
    var box = el("div", noiBat
      ? "flex flex-col p-3 rounded-2xl bg-surface-container-high border-2 border-primary/50 shadow-xl gap-3 relative overflow-hidden"
      : "flex flex-col p-3 rounded-2xl bg-surface-container border border-surface-container-highest gap-3 relative overflow-hidden");
    if (noiBat) box.appendChild(el("div", "absolute left-0 top-0 bottom-0 w-1.5 bg-primary"));

    var head = el("div", "flex items-start justify-between pl-1");
    var trai = el("div", "flex items-center gap-2 min-w-0");
    trai.appendChild(el("span", noiBat ? "text-[16px] leading-none text-primary font-bold" : KY[m], st.ky));
    var t = el("div", "min-w-0");
    var d1 = el("div", "flex items-center gap-2 flex-wrap");
    d1.appendChild(el("h4", "text-[14px] text-on-surface font-bold", st.ten));
    d1.appendChild(el("span", VIEN[m], kyHieuTrangThai(st.mau) + " " + chuTrangThai(st.mau)));
    t.appendChild(d1);
    t.appendChild(el("p", "text-[11px] text-on-surface-variant", phuDeBuoc(st)));
    trai.appendChild(t);
    head.appendChild(trai);
    head.appendChild(ic(ICON_BUOC[st.so] || "checklist", noiBat ? "text-primary text-[22px]" : "text-on-surface-variant text-[22px]"));
    box.appendChild(head);

    var body = el("div", "flex flex-col gap-3 pl-1");
    thanBuoc(body, st, batch, !!anhChup.chiXem);
    if (body.childNodes.length) box.appendChild(body);
    return box;
  }

  // ==========================================
  // THÂN TỪNG BƯỚC
  // ==========================================
  function thanBuoc(body, step, batch, chiXem) {
    if (step.so === 0) buocNhanXanh(body, batch, chiXem);
    else if (step.so === 2 || step.so === 3) {
      if (step.daBam) body.appendChild(el("p", "text-[11px] text-on-surface-variant", step.daBam));
      if (!chiXem) {
        var b = nut(C.nutChinh + " w-full", "done_all", step.so === 2 ? "Đã tách đá" : "Đã sorting");
        b.onclick = function () { thucHienThaoTac({ loai: "buoc", khoa: batch.khoa, buoc: step.so }); };
        body.appendChild(b);
      }
    }
    else if (step.so === 4) buocCan(body, batch, chiXem);
    else if (step.so === 5) buocTron(body, batch, chiXem);
    else if (step.so === 6) {
      var lay = nut(C.nutTim + " w-full", "science", "Lấy ở tab Túi mẫu");
      lay.onclick = function () { mo("samples"); };
      body.appendChild(lay);
    }
  }

  function dongKg(loai, kgSo) {
    var r = el("div", "flex items-center justify-between gap-2 py-1");
    r.appendChild(el("span", "text-[12px] text-on-surface truncate", loai));
    r.appendChild(soKg("font-mono-num text-[13px] font-bold text-on-surface shrink-0", kgSo, 2));
    return r;
  }

  function buocNhanXanh(body, batch, chiXem) {
    if (!batch.sp) {
      var o = el("div", C.o);
      o.appendChild(el("span", C.nhan, "Lô chưa rõ sản phẩm — chọn"));
      var sel = el("select", C.nhapChu + " mt-1");
      var rong = el("option", "bg-surface-container-high text-on-surface", "— chọn sản phẩm —");
      rong.value = "";
      sel.appendChild(rong);
      (anhChup.sanPham || []).forEach(function (sp) {
        var opt = el("option", "bg-surface-container-high text-on-surface", sp);
        opt.value = sp;
        sel.appendChild(opt);
      });
      sel.disabled = chiXem;
      o.appendChild(sel);
      body.appendChild(o);
      if (!chiXem) {
        var luu = nut(C.nutChinh + " w-full", "done_all", "Lưu sản phẩm");
        luu.disabled = true;
        sel.onchange = function () { luu.disabled = !sel.value; };
        luu.onclick = function () { if (sel.value) thucHienThaoTac({ loai: "sanPham", khoa: batch.khoa, sp: sel.value }); };
        body.appendChild(luu);
      }
      return;
    }

    if (batch.thuc0 && batch.thuc0.length > 0) {
      var x = el("div", C.o);
      x.appendChild(el("span", C.nhan, "✓ Đã xác nhận nhân xanh"));
      batch.thuc0.forEach(function (g) { (g.dong || []).forEach(function (d) { x.appendChild(dongKg(d.loai, d.kg)); }); });
      body.appendChild(x);
      return;
    }

    var sua = !!editModeNhanXanh[batch.khoa];
    var oNhap = {}; // "vao|tp|loai" -> ô nhập (khoá giống thucNhanXanh)
    var coDong = false;
    (batch.goiY0 || []).forEach(function (g) {
      var o2 = el("div", C.o);
      o2.appendChild(el("span", C.nhan, "Gợi ý · " + g.soMe + " mẻ × " + soVN(g.vao, 1) + " kg" + (g.tp ? " · " + g.tp : "")));
      (g.dong || []).forEach(function (d) {
        coDong = true;
        if (sua) {
          var r = el("div", "flex items-center justify-between gap-2 py-1");
          r.appendChild(el("span", "text-[12px] text-on-surface truncate", d.loai));
          var nhap = el("div", "flex items-center gap-1 shrink-0");
          var inp = el("input", C.nhapSo + " !w-[90px] !text-[15px]");
          inp.inputMode = "decimal";
          inp.value = soVN(d.kg, 2);
          oNhap[g.vao + "|" + g.tp + "|" + d.loai] = inp;
          nhap.appendChild(inp);
          nhap.appendChild(el("span", "text-[12px] font-mono-num text-on-surface-variant", "kg"));
          r.appendChild(nhap);
          o2.appendChild(r);
        } else {
          o2.appendChild(dongKg(d.loai, d.kg));
        }
      });
      body.appendChild(o2);
    });
    if (chiXem) return;

    var nhom = el("div", "grid grid-cols-2 gap-2 pt-1");
    if (!coDong) {
      // Như R&B: chưa có dòng thành phần
      var xn = nut(C.nutChinh + " col-span-2", "done_all", "Xác nhận ⓪ Nhân xanh");
      xn.onclick = function () { thucHienThaoTac({ loai: "nhanXanh", khoa: batch.khoa, thuc: thucNhanXanh(batch.goiY0 || [], {}) }); };
      nhom.appendChild(xn);
    } else if (!sua) {
      var bSua = nut(C.nutPhu, "edit", "Sửa", "text-[18px] text-on-surface-variant");
      bSua.onclick = function () { editModeNhanXanh[batch.khoa] = true; renderApp(); };
      nhom.appendChild(bSua);
      var dung = nut(C.nutChinh, "done_all", "Đúng ⓪ Nhân xanh");
      dung.onclick = function () { thucHienThaoTac({ loai: "nhanXanh", khoa: batch.khoa, thuc: thucNhanXanh(batch.goiY0, {}) }); };
      nhom.appendChild(dung);
    } else {
      var huy = nut(C.nutPhu, "close", "Hủy", "text-[18px] text-on-surface-variant");
      huy.onclick = function () { editModeNhanXanh[batch.khoa] = false; renderApp(); };
      nhom.appendChild(huy);
      var gui = nut(C.nutChinh, "done_all", "Gửi sửa ⓪");
      gui.onclick = function () {
        var suaMap = {}, loi = false;
        Object.keys(oNhap).forEach(function (k) {
          var s = oNhap[k].value.trim();
          if (docSo(s) === null) { oNhap[k].classList.add("loi"); loi = true; }
          else { oNhap[k].classList.remove("loi"); suaMap[k] = s; }
        });
        if (loi) return;
        editModeNhanXanh[batch.khoa] = false;
        thucHienThaoTac({ loai: "nhanXanh", khoa: batch.khoa, thuc: thucNhanXanh(batch.goiY0, suaMap) });
      };
      nhom.appendChild(gui);
    }
    body.appendChild(nhom);
  }

  // ④ Cân + hao hụt: 2 ô + thước đo theo ngưỡng thật của lô (thang ngưỡng ±5 điểm, không ngưỡng thì 0–30 %)
  function buocCan(body, batch, chiXem) {
    var n = batch.nguong;
    var gLo = n ? Math.max(0, n[1] - 5) : 0;
    var gHi = n ? n[2] + 5 : 30;
    var viTri = function (x) { return (x - gLo) / (gHi - gLo) * 100; };

    var luoi = el("div", "grid grid-cols-2 gap-2");
    var oKg = el("div", C.o);
    oKg.appendChild(el("span", C.nhan, "Kg ra (cân)"));
    var dongNhap = el("div", "flex items-center gap-1 mt-1");
    var inp = el("input", C.nhapSo);
    inp.inputMode = "decimal";
    inp.value = batch.kgRa !== null && batch.kgRa !== undefined ? soVN(batch.kgRa) : "";
    inp.readOnly = chiXem;
    inp.placeholder = "0,0";
    dongNhap.appendChild(inp);
    dongNhap.appendChild(el("span", "text-[12px] font-mono-num text-on-surface-variant", "kg"));
    oKg.appendChild(dongNhap);
    var chenh = el("span", "text-[10px] font-mono-num text-on-surface-variant mt-1");
    oKg.appendChild(chenh);
    luoi.appendChild(oKg);

    var oHH = el("div", C.o);
    var hhDau = el("div", "flex items-center justify-between gap-1");
    hhDau.appendChild(el("span", C.nhan, "Hao hụt"));
    var the = el("span");
    hhDau.appendChild(the);
    oHH.appendChild(hhDau);
    var soDong = el("div", "flex items-baseline gap-1 mt-1");
    var so = el("span");
    var phanTram = el("span", "text-[14px] font-mono-num font-bold", "%");
    soDong.appendChild(so);
    soDong.appendChild(phanTram);
    oHH.appendChild(soDong);
    oHH.appendChild(el("span", "text-[10px] font-mono-num text-on-surface-variant mt-0.5",
      n ? "Ngưỡng: " + soVN(n[1], 1) + "% – " + soVN(n[2], 1) + "%" : "Chưa có ngưỡng"));
    luoi.appendChild(oHH);
    body.appendChild(luoi);

    // Thước đo
    var thuoc = el("div", "flex flex-col gap-1.5");
    var nhanTren = el("div", "flex items-center justify-between text-[10px] font-mono-num text-on-surface-variant");
    nhanTren.appendChild(el("span", null, soVN(gLo, 1) + "%"));
    nhanTren.appendChild(el("span", n ? "text-secondary font-bold" : "text-on-surface-variant font-bold", n ? "Vùng ngưỡng (" + soVN(n[1], 1) + "% – " + soVN(n[2], 1) + "%)" : "Chưa có ngưỡng"));
    nhanTren.appendChild(el("span", null, soVN(gHi, 1) + "%"));
    thuoc.appendChild(nhanTren);
    var ray = el("div", "relative w-full h-4 bg-surface-container-lowest rounded-full overflow-hidden flex items-center border border-surface-container-highest");
    if (n) {
      var v1 = el("div", "h-full bg-amber-500/30"); v1.style.width = viTri(n[1]) + "%";
      var v2 = el("div", "h-full bg-emerald-500/40 relative flex items-center justify-center border-x border-emerald-500/40"); v2.style.width = (viTri(n[2]) - viTri(n[1])) + "%";
      v2.appendChild(el("div", "w-full h-0.5 bg-emerald-400/60"));
      var v3 = el("div", "h-full bg-rose-500/30"); v3.style.width = (100 - viTri(n[2])) + "%";
      ray.appendChild(v1); ray.appendChild(v2); ray.appendChild(v3);
    } else {
      ray.appendChild(el("div", "h-full w-full bg-surface-container-highest/60"));
    }
    var kimBoc = el("div", "absolute top-0 bottom-0 flex flex-col items-center justify-center transition-all duration-300 pointer-events-none");
    kimBoc.style.transform = "translateX(-50%)";
    var kim = el("div");
    kimBoc.appendChild(kim);
    ray.appendChild(kimBoc);
    thuoc.appendChild(ray);
    var nhanDuoi = el("div", "flex items-center justify-between gap-2 text-[10px] font-mono-num text-on-surface-variant");
    var congThuc = el("span");
    var viTriChu = el("span");
    nhanDuoi.appendChild(congThuc);
    nhanDuoi.appendChild(viTriChu);
    thuoc.appendChild(nhanDuoi);
    body.appendChild(thuoc);

    var luu = nut(C.nutChinh + " w-full", "done_all", batch.kgRa !== null && batch.kgRa !== undefined ? "Lưu lại" : "Lưu");

    function capNhat() {
      var ra = docSo(inp.value);
      var hh = haoHut(batch.kgVao, ra);
      var mau = mauHaoHut(hh, n);
      var k = hh === null ? "xam" : mau === "xanh" ? "xanh" : mau === "do" ? (hh < n[1] ? "thap" : "cao") : "xam";
      var s = HH[k];
      the.className = s.the;
      the.textContent = hh === null ? "—" : (k === "xanh" ? "✓ " : k === "xam" ? "" : "! ") + s.nhan;
      so.className = s.so;
      so.textContent = hh === null ? "—" : soVN(hh, 1);
      phanTram.className = "text-[14px] font-mono-num font-bold " + (k === "xanh" ? "text-secondary" : k === "thap" ? "text-amber-400" : k === "cao" ? "text-rose-400" : "text-on-surface-variant");
      chenh.textContent = hh !== null ? "Hao hụt: −" + soVN(batch.kgVao - ra, 2) + " kg" : "Kg vào: " + soVN(batch.kgVao, 1) + " kg";
      congThuc.textContent = hh !== null ? "Công thức: (" + soVN(batch.kgVao, 2) + " − " + soVN(ra, 2) + ") / " + soVN(batch.kgVao, 2) : "Công thức: (vào − ra) / vào";
      viTriChu.className = s.chu;
      viTriChu.textContent = hh !== null ? "Vị trí: " + soVN(hh, 1) + "% [" + s.ten + "]" : "";
      kim.className = s.kim;
      if (hh !== null) {
        kimBoc.style.display = "flex";
        kimBoc.style.left = Math.min(98, Math.max(2, viTri(hh))) + "%";
      } else {
        kimBoc.style.display = "none";
      }
      luu.disabled = ra === null;
    }
    inp.oninput = capNhat;
    capNhat();

    if (!chiXem) {
      luu.onclick = function () {
        var s = inp.value.trim();
        if (docSo(s) === null) return;
        thucHienThaoTac({ loai: "can", khoa: batch.khoa, kgRa: s });
      };
      body.appendChild(luu);
    }
  }

  function buocTron(body, batch, chiXem) {
    var luoi = el("div", "grid grid-cols-2 gap-2");
    var goiY = el("div", C.o);
    goiY.appendChild(el("span", C.nhan, "Gợi ý trộn"));
    goiY.appendChild(soKg("font-mono-num text-[18px] font-bold text-primary mt-1", batch.goiYTron));
    goiY.appendChild(el("span", "text-[10px] font-mono-num text-on-surface-variant mt-0.5 truncate", batch.tenTron || "—"));
    luoi.appendChild(goiY);
    var o = el("div", C.o);
    o.appendChild(el("span", C.nhan, "Kg trộn thực"));
    var dong = el("div", "flex items-center gap-1 mt-1");
    var inp = el("input", C.nhapSo);
    inp.inputMode = "decimal";
    inp.value = batch.kgTron !== null && batch.kgTron !== undefined ? soVN(batch.kgTron) : "";
    inp.readOnly = chiXem;
    inp.placeholder = "0,0";
    dong.appendChild(inp);
    dong.appendChild(el("span", "text-[12px] font-mono-num text-on-surface-variant", "kg"));
    o.appendChild(dong);
    luoi.appendChild(o);
    body.appendChild(luoi);
    if (chiXem) return;

    var chuaCan = batch.kgRa === null || batch.kgRa === undefined;
    var luu = nut(C.nutChinh + " w-full", chuaCan ? "hourglass_empty" : "done_all", chuaCan ? "Cân trước" : "Lưu");
    luu.disabled = chuaCan || docSo(inp.value) === null;
    inp.oninput = function () { if (!chuaCan) luu.disabled = docSo(inp.value) === null; };
    luu.onclick = function () {
      var s = inp.value.trim();
      if (docSo(s) === null) return;
      thucHienThaoTac({ loai: "tron", khoa: batch.khoa, kg: s });
    };
    body.appendChild(luu);
  }

  // ==========================================
  // CHI TIẾT LÔ
  // ==========================================
  function renderDetail(main) {
    var batch = (anhChup.lo || []).find(function (l) { return l.khoa === detailBatchKhoa; });

    var lui = el("button", "self-start flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface border border-surface-container-highest text-[12px] font-mono-num font-semibold active:scale-95 transition-all");
    lui.type = "button";
    lui.appendChild(ic("arrow_back", "text-[16px]"));
    lui.appendChild(el("span", null, "Quay lại"));
    lui.onclick = function () { mo("today"); };
    main.appendChild(lui);

    if (!batch) {
      main.appendChild(el("div", "p-4 rounded-xl bg-surface-container-low border border-surface-container-highest text-[12px] font-mono-num text-on-surface-variant text-center", "Không tìm thấy thông tin lô."));
      return;
    }
    var v = vanThe();
    dauThe(v.trong, batch, true);
    var steps = el("div", "flex flex-col gap-2 mt-1");
    dauQuyTrinh(steps, demBuoc(batch));
    (batch.buoc || []).forEach(function (st) {
      if (st.mau !== "an") steps.appendChild(oBuocMo(st, batch, false));
    });
    v.trong.appendChild(steps);
    main.appendChild(v.article);
  }

  // ==========================================
  // TÚI MẪU
  // ==========================================
  function dauTab(tieuDe, phuDe, nhanPhai, lopNhan) {
    var h = el("div", "flex items-center justify-between gap-2 bg-surface-container-high p-3 rounded-xl border border-surface-container-highest");
    var t = el("div", "min-w-0");
    t.appendChild(el("h3", "text-[15px] font-bold text-on-surface", tieuDe));
    t.appendChild(el("p", "text-[11px] text-on-surface-variant", phuDe));
    h.appendChild(t);
    h.appendChild(el("span", lopNhan, nhanPhai));
    return h;
  }

  function renderSamples(main) {
    var view = el("div", "flex flex-col gap-3");
    var ds = anhChup.tui || [];
    var daLay = ds.filter(function (t) { return t.daLay; }).length;
    view.appendChild(dauTab("Túi mẫu tuần này", demNguoc(anhChup.homNay || "", anhChup.cupping || ""),
      daLay + " / " + ds.length + " Đã lấy", "px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-mono-num text-[11px] font-bold shrink-0"));

    if (ds.length === 0) {
      view.appendChild(el("div", "p-4 rounded-xl bg-surface-container-low border border-surface-container-highest text-[12px] font-mono-num text-on-surface-variant text-center", "Chưa có danh sách túi mẫu tuần này."));
      main.appendChild(view);
      return;
    }

    var list = el("div", "flex flex-col gap-2");
    ds.forEach(function (t) {
      if (t.daLay) {
        var c = el("div", "p-3 rounded-xl bg-surface-container-low border border-surface-container-highest flex items-center justify-between");
        var trai = el("div", "flex flex-col min-w-0");
        trai.appendChild(el("span", "text-[13px] text-on-surface font-semibold", t.sp || ""));
        trai.appendChild(el("span", "text-[11px] text-on-surface-variant font-mono-num", "✓ Đã lấy · " + (t.daLay.nguoi || "") + " " + dinhDangGio(t.daLay.gio)));
        c.appendChild(trai);
        c.appendChild(ic("check_circle", "text-secondary text-[22px]"));
        list.appendChild(c);
        return;
      }
      var card = el("div", "p-3 rounded-xl bg-surface-container-low border border-purple-500/30 flex flex-col gap-2");
      var dau = el("div", "flex items-center justify-between gap-2");
      var tt = el("div", "flex flex-col min-w-0");
      tt.appendChild(el("span", "text-[13px] text-on-surface font-semibold", t.sp || ""));
      tt.appendChild(el("span", "text-[11px] text-amber-300", "○ Chưa lấy mẫu — tích lô đã lấy"));
      dau.appendChild(tt);
      dau.appendChild(ic("science", "text-purple-300 text-[22px]"));
      card.appendChild(dau);

      var keys = t.loMoi && t.loMoi.length ? t.loMoi : (t.lo || []);
      var checks = [];
      keys.forEach(function (k) {
        var lo = (anhChup.lo || []).find(function (l) { return l.khoa === k; });
        var row = el("label", "flex items-center gap-2 p-2 rounded-lg bg-surface-container border border-surface-container-highest/60 text-[12px] font-mono-num text-on-surface");
        var chk = el("input", "w-4 h-4 accent-purple-400");
        chk.type = "checkbox";
        chk.checked = true;
        chk.disabled = !!anhChup.chiXem;
        chk.dataset.khoa = k;
        checks.push(chk);
        row.appendChild(chk);
        row.appendChild(el("span", null, lo ? (lo.thu || thuCua(lo.ngay)) + " " + dinhDangNgayThang(lo.ngay) + " · " + tenMay(lo) : k));
        card.appendChild(row);
      });

      if (!anhChup.chiXem) {
        var lay = nut(C.nutTim + " w-full !h-[44px]", "sell", "Đã lấy mẫu");
        var capNhat = function () { lay.disabled = !checks.some(function (c) { return c.checked; }); };
        checks.forEach(function (c) { c.onchange = capNhat; });
        capNhat();
        lay.onclick = function () {
          var chon = checks.filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.khoa; });
          if (!chon.length) return;
          thucHienThaoTac({ loai: "layMau", tuan: anhChup.tuan, sp: t.sp, khoaLo: chon });
        };
        card.appendChild(lay);
      }
      list.appendChild(card);
    });
    view.appendChild(list);
    main.appendChild(view);
  }

  // ==========================================
  // NGOẠI LỆ — đúng các dòng ngoaiLe máy chủ trả
  // ==========================================
  var NL = {
    do: { the: "p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 cursor-pointer", icon: "error", lop: "text-rose-400 text-[18px] shrink-0" },
    vang: { the: "p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 cursor-pointer", icon: "help", lop: "text-amber-400 text-[18px] shrink-0" },
    xanh: { the: "p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 cursor-pointer", icon: "info", lop: "text-secondary text-[18px] shrink-0" },
    xam: { the: "p-3 rounded-xl bg-surface-container-low border border-surface-container-highest flex items-start gap-2 cursor-pointer", icon: "timer", lop: "text-on-surface-variant text-[18px] shrink-0" }
  };
  function renderExceptions(main) {
    var view = el("div", "flex flex-col gap-3");
    var ds = anhChup.ngoaiLe || [];
    view.appendChild(dauTab("Ngoại lệ phòng rang", "Bấm một dòng để mở lô", ds.length + " Ngoại lệ",
      "px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono-num text-[11px] font-bold shrink-0"));
    if (ds.length === 0) {
      view.appendChild(el("div", "p-4 rounded-xl bg-surface-container-low border border-surface-container-highest text-[12px] font-mono-num text-on-surface-variant text-center", "Không có ngoại lệ nào."));
      main.appendChild(view);
      return;
    }
    var list = el("div", "flex flex-col gap-2");
    ds.forEach(function (nl) {
      var s = NL[nl.loai] || NL.xam;
      var c = el("div", s.the);
      c.appendChild(ic(s.icon, s.lop));
      c.appendChild(el("p", "text-[12px] text-on-surface", nl.chu || ""));
      c.onclick = function () { if (nl.khoa) mo("detail", nl.khoa); };
      list.appendChild(c);
    });
    view.appendChild(list);
    main.appendChild(view);
  }

  // ==========================================
  // THANH ĐÁY
  // ==========================================
  function renderBottomNav(root) {
    var nav = el("nav", "fixed bottom-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-t border-surface-container-highest shadow-[0_-4px_20px_rgba(0,0,0,0.5)]");
    var wrap = el("div", "max-w-md mx-auto flex items-center justify-around h-16 px-2");
    var soLo = loCuaNgay(anhChup.lo || [], activeNgay, activeMay).length;
    var soTui = (anhChup.tui || []).filter(function (t) { return !t.daLay; }).length;
    var soNL = (anhChup.ngoaiLe || []).length;
    [
      { view: "today", icon: "assignment", chu: "Hôm nay", so: soLo, lopSo: "absolute -top-1 -right-2 bg-primary-container text-white text-[9px] font-mono-num font-bold px-1 rounded-full", bat: "flex-1 flex flex-col items-center justify-center py-1 text-primary font-semibold transition-colors" },
      { view: "samples", icon: "science", chu: "Túi mẫu", so: soTui, lopSo: "absolute -top-1 -right-2 bg-purple-600 text-white text-[9px] font-mono-num font-bold px-1 rounded-full", bat: "flex-1 flex flex-col items-center justify-center py-1 text-purple-400 font-semibold transition-colors" },
      { view: "exceptions", icon: "warning", chu: "Ngoại lệ", so: soNL, lopSo: "absolute -top-1 -right-2 bg-amber-500 text-stone-950 text-[9px] font-mono-num font-bold px-1 rounded-full", bat: "flex-1 flex flex-col items-center justify-center py-1 text-amber-400 font-semibold transition-colors" }
    ].forEach(function (t) {
      var dang = currentView === t.view || (t.view === "today" && currentView === "detail");
      var b = el("button", dang ? t.bat : "flex-1 flex flex-col items-center justify-center py-1 text-on-surface-variant hover:text-on-surface transition-colors");
      b.type = "button";
      var r = el("div", "relative");
      r.appendChild(ic(t.icon, "text-[22px]"));
      if (t.so > 0) r.appendChild(el("span", t.lopSo, String(t.so)));
      b.appendChild(r);
      b.appendChild(el("span", dang ? "text-[11px] font-mono-num font-semibold mt-0.5" : "text-[11px] font-mono-num mt-0.5", t.chu));
      b.onclick = function () { mo(t.view); };
      wrap.appendChild(b);
    });
    nav.appendChild(wrap);
    root.appendChild(nav);
  }

  // ==========================================
  // KHỞI ĐỘNG
  // ==========================================
  if (!dangNhap) {
    currentView = "login";
    renderApp();
  } else {
    taiAnhChup(dangNhap).then(function (res) {
      if (res && res.ok) {
        anhChup = res;
        currentView = "today";
      } else {
        dangNhap = null;
        xoaMay(KHOA_DANG_NHAP);
        currentView = "login";
      }
      renderApp();
    });
  }
})();
