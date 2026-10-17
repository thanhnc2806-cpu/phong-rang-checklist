// Checklist mẻ — ứng dụng PWA phòng rang (JS thuần, không framework, không CDN)
(function () {
  "use strict";

  // Đăng ký Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {
      // bỏ qua lỗi đăng ký sw
    });
  }

  var SVG_NS = "http://www.w3.org/2000/svg";

  // Trạng thái ứng dụng
  var currentView = "today"; // "login" | "today" | "detail" | "samples" | "exceptions"
  var dangNhap = docMay(KHOA_DANG_NHAP, null);
  var anhChup = null;
  var activeNgay = "";
  var activeMay = "";
  var selectedBatchKeys = {}; // ngay -> khoa lô đang chọn làm thẻ to
  var expandedStepInActiveCard = {}; // khoa -> số bước đang mở rộng
  var editModeNhanXanh = {}; // khoa -> boolean đang bật ô sửa bước ⓪
  var detailBatchKhoa = "";
  var tamError = false;
  var globalError = null;
  var globalNotice = null;

  // Danh sách người đăng nhập
  var DANH_SACH_NGUOI = [
    { ma: "thanh", ten: "anh Thanh" },
    { ma: "minh", ten: "Minh" },
    { ma: "ban", ten: "B.An" },
    { ma: "vinh", ten: "Vinh" },
    { ma: "doan", ten: "Đoan" }
  ];

  // Trợ thủ tạo DOM an toàn
  function el(tag, className, textContent) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (textContent !== undefined && textContent !== null) e.textContent = textContent;
    return e;
  }

  function makeSvgIcon(type, size, color) {
    var s = document.createElementNS(SVG_NS, "svg");
    var sz = size || 16;
    s.setAttribute("width", String(sz));
    s.setAttribute("height", String(sz));
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", color || "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");

    if (type === "clock") {
      var c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", "12");
      c.setAttribute("cy", "12");
      c.setAttribute("r", "10");
      var p = document.createElementNS(SVG_NS, "polyline");
      p.setAttribute("points", "12 6 12 12 16 14");
      s.appendChild(c);
      s.appendChild(p);
    } else if (type === "check") {
      var pCheck = document.createElementNS(SVG_NS, "polyline");
      pCheck.setAttribute("points", "20 6 9 17 4 12");
      s.appendChild(pCheck);
    } else if (type === "alert") {
      var pAlert = document.createElementNS(SVG_NS, "polygon");
      pAlert.setAttribute("points", "12 2 2 22 22 22 12 2");
      var l1 = document.createElementNS(SVG_NS, "line");
      l1.setAttribute("x1", "12");
      l1.setAttribute("y1", "9");
      l1.setAttribute("x2", "12");
      l1.setAttribute("y2", "13");
      var l2 = document.createElementNS(SVG_NS, "line");
      l2.setAttribute("x1", "12");
      l2.setAttribute("y1", "17");
      l2.setAttribute("x2", "12.01");
      l2.setAttribute("y2", "17");
      s.appendChild(pAlert);
      s.appendChild(l1);
      s.appendChild(l2);
    } else if (type === "back") {
      var pBack = document.createElementNS(SVG_NS, "polyline");
      pBack.setAttribute("points", "15 18 9 12 15 6");
      s.appendChild(pBack);
    } else if (type === "list") {
      var lList1 = document.createElementNS(SVG_NS, "line");
      lList1.setAttribute("x1", "8");
      lList1.setAttribute("y1", "6");
      lList1.setAttribute("x2", "21");
      lList1.setAttribute("y2", "6");
      var lList2 = document.createElementNS(SVG_NS, "line");
      lList2.setAttribute("x1", "8");
      lList2.setAttribute("y1", "12");
      lList2.setAttribute("x2", "21");
      lList2.setAttribute("y2", "12");
      var lList3 = document.createElementNS(SVG_NS, "line");
      lList3.setAttribute("x1", "8");
      lList3.setAttribute("y1", "18");
      lList3.setAttribute("x2", "21");
      lList3.setAttribute("y2", "18");
      s.appendChild(lList1);
      s.appendChild(lList2);
      s.appendChild(lList3);
    } else if (type === "sample") {
      var pFlask = document.createElementNS(SVG_NS, "path");
      pFlask.setAttribute("d", "M10 2v7.31L4.5 19.5A2 2 0 0 0 6.23 22h11.54a2 2 0 0 0 1.73-2.5L14 9.31V2");
      s.appendChild(pFlask);
    } else if (type === "bean") {
      var pB1 = document.createElementNS(SVG_NS, "path");
      pB1.setAttribute("d", "M12 2c-4 0-7 4.5-7 10s3 10 7 10 7-4.5 7-10S16 2 12 2z");
      var pB2 = document.createElementNS(SVG_NS, "path");
      pB2.setAttribute("d", "M12 2c-2.5 3-2.5 6.5 0 10s2.5 7 0 10");
      s.appendChild(pB1);
      s.appendChild(pB2);
    } else {
      var cDef = document.createElementNS(SVG_NS, "circle");
      cDef.setAttribute("cx", "12");
      cDef.setAttribute("cy", "12");
      cDef.setAttribute("r", "9");
      s.appendChild(cDef);
    }
    return s;
  }

  function kyHieuTrangThai(mau) {
    if (mau === "xanh") return "✓";
    if (mau === "vang") return "?";
    if (mau === "do") return "!";
    return "○";
  }

  // Đếm bước hiện (bỏ "an") và bước xong của 1 lô
  function demBuoc(batch) {
    var hien = (batch.buoc || []).filter(function (b) { return b.mau !== "an"; });
    return { tong: hien.length, xong: hien.filter(function (b) { return b.mau === "xanh"; }).length };
  }

  function chuTrangThai(mau) {
    if (mau === "xanh") return "Đã xong";
    if (mau === "vang") return "Quên bấm?";
    if (mau === "do") return "Lệch";
    return "Chưa làm";
  }

  // 3 ô số của lô: Số mẻ · Kg vào · Kg ra
  function oSoLo(batch) {
    var coRa = batch.kgRa !== null && batch.kgRa !== undefined;
    var grid = el("div", "batch-stats");
    [
      ["Số mẻ", String(batch.soMe), ""],
      ["Kg vào", soVN(batch.kgVao, 1), "kg"],
      ["Kg ra", coRa ? soVN(batch.kgRa, 1) : "—", coRa ? "kg" : ""]
    ].forEach(function (x) {
      var c = el("div", "batch-stat");
      c.appendChild(el("span", "stat-label", x[0]));
      var v = el("span", "stat-value", x[1]);
      if (x[2]) v.appendChild(el("small", null, " " + x[2]));
      c.appendChild(v);
      grid.appendChild(c);
    });
    return grid;
  }

  function dinhDangGio(isoString) {
    if (!isoString) return "";
    if (isoString.length >= 16) return isoString.slice(11, 16);
    return isoString;
  }

  function dinhDangNgayThang(ngayStr) {
    if (!ngayStr || ngayStr.length < 10) return ngayStr;
    return ngayStr.slice(8, 10) + "/" + ngayStr.slice(5, 7);
  }

  // Khởi động đồng bộ hàng đợi
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
          setTimeout(function () {
            globalNotice = null;
            renderApp();
          }, 6000);
        }
      } else if (evt.loai === "tuChoi") {
        globalError = (evt.kq && (evt.kq.chu || evt.kq.loi)) || "Thao tác bị từ chối";
        setTimeout(function () {
          globalError = null;
          renderApp();
        }, 6000);
        renderApp();
      } else if (evt.loai === "tam") {
        if (evt.kq && evt.kq.loi === "LOI_MAY_CHU") {
          tamError = true;
        }
        renderApp();
      } else if (evt.loai === "xong") {
        tamError = false;
        renderApp();
      }
    });
  }

  // Định kỳ và sự kiện kết nối
  setInterval(function () {
    if (dangNhap) kichHoatGuiHangDoi();
  }, 30000);

  window.addEventListener("online", function () {
    if (dangNhap) kichHoatGuiHangDoi();
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && dangNhap) kichHoatGuiHangDoi();
  });

  // Gửi thao tác và kích hoạt xả
  function thucHienThaoTac(op) {
    guiThaoTac(op);
    kichHoatGuiHangDoi();
    renderApp();
  }

  // ==========================================
  // RENDER APP CHÍNH
  // ==========================================
  function renderApp() {
    var root = document.getElementById("app");
    if (!root) return;
    root.textContent = "";

    if (!dangNhap) {
      renderLogin(root);
      return;
    }

    if (!anhChup) {
      var loadingBox = el("div", "app-container");
      loadingBox.appendChild(el("div", "empty-state", "Đang nạp dữ liệu..."));
      root.appendChild(loadingBox);
      return;
    }

    var container = el("div", "app-container");

    // 1. Dải trên mọi màn
    renderTopBanners(container);

    // 2. Màn hình tương ứng
    if (currentView === "today") {
      renderToday(container);
    } else if (currentView === "detail") {
      renderDetail(container);
    } else if (currentView === "samples") {
      renderSamples(container);
    } else if (currentView === "exceptions") {
      renderExceptions(container);
    }

    // 3. Thanh điều hướng đáy (Bottom Navigation)
    renderBottomNav(container);

    root.appendChild(container);
  }

  // ==========================================
  // 1. DẢI TRÊN MỌI MÀN (TOP BANNERS)
  // ==========================================
  function renderTopBanners(container) {
    var stack = el("div", "banner-stack");
    var hasBanner = false;

    // Số thao tác chưa gửi
    var choGui = soChoGui();
    if (choGui > 0) {
      hasBanner = true;
      var b = el("div", "banner banner-yellow");
      b.appendChild(makeSvgIcon("clock", 14, "#b45309"));
      b.appendChild(el("span", "mono-num", choGui + " thao tác chưa gửi"));
      stack.appendChild(b);
    }

    // Máy chủ lỗi
    if (tamError) {
      hasBanner = true;
      var bTam = el("div", "banner banner-red");
      bTam.appendChild(makeSvgIcon("alert", 14, "#b91c1c"));
      bTam.appendChild(el("span", null, "Máy chủ lỗi — thao tác vẫn giữ trên máy, sẽ tự gửi lại"));
      stack.appendChild(bTam);
    }

    // Đang dùng dữ liệu cũ khi mất mạng
    if (anhChup && anhChup.cuDaLuu) {
      hasBanner = true;
      var bCu = el("div", "banner banner-gray");
      var lucStr = anhChup.luc ? new Date(anhChup.luc).toTimeString().slice(0, 5) : "";
      bCu.appendChild(el("span", null, "Dữ liệu lúc " + lucStr + " (đang mất mạng)"));
      stack.appendChild(bCu);
    }

    // Chế độ chỉ xem
    if (anhChup && anhChup.chiXem) {
      hasBanner = true;
      var bChiXem = el("div", "banner banner-gray");
      bChiXem.appendChild(el("span", null, "Chỉ xem"));
      stack.appendChild(bChiXem);
    }

    // Thông báo lỗi từ chối
    if (globalError) {
      hasBanner = true;
      var bLoi = el("div", "banner banner-red", globalError);
      stack.appendChild(bLoi);
    }

    // Thông báo ghi chú
    if (globalNotice) {
      hasBanner = true;
      var bNotice = el("div", "banner banner-yellow", globalNotice);
      stack.appendChild(bNotice);
    }

    if (hasBanner) {
      container.appendChild(stack);
    }
  }

  // ==========================================
  // 2. MÀN HÌNH CHỌN TÊN (ĐĂNG NHẬP)
  // ==========================================
  var selectedUserMa = "thanh";
  var loginErrorText = "";

  function renderLogin(root) {
    var container = el("div", "app-container login-view");

    var titleBox = el("div", "login-title-box");
    var loginLogo = el("div", "brand-logo login-logo");
    loginLogo.appendChild(makeSvgIcon("bean", 30, "#ffffff"));
    titleBox.appendChild(loginLogo);
    titleBox.appendChild(el("h1", "login-title", "Checklist mẻ"));
    titleBox.appendChild(el("p", "login-sub", "Phòng rang Intenso — Chọn tên để vào ca"));
    container.appendChild(titleBox);

    var grid = el("div", "users-grid");
    DANH_SACH_NGUOI.forEach(function (u) {
      var btn = el("button", "user-btn" + (selectedUserMa === u.ma ? " active" : ""), u.ten);
      btn.type = "button";
      btn.onclick = function () {
        selectedUserMa = u.ma;
        loginErrorText = "";
        renderApp();
      };
      grid.appendChild(btn);
    });
    container.appendChild(grid);

    var form = el("div", "login-form");
    var lbl = el("label", null, "Mã 6 số của " + (DANH_SACH_NGUOI.find(function (x) { return x.ma === selectedUserMa; }) || {}).ten);
    form.appendChild(lbl);

    var input = el("input", "form-input mono-num");
    input.type = "password";
    input.inputMode = "numeric";
    input.maxLength = 6;
    input.autocomplete = "one-time-code";
    input.placeholder = "Nhập mã 6 số";
    form.appendChild(input);

    if (loginErrorText) {
      var errDiv = el("div", "banner banner-red", loginErrorText);
      form.appendChild(errDiv);
    }

    var btnSubmit = el("button", "btn btn-primary", "Vào");
    input.onkeydown = function (e) { if (e.key === "Enter") btnSubmit.click(); };
    btnSubmit.type = "button";
    btnSubmit.onclick = function () {
      var maVal = input.value.trim();
      var authPayload = { nguoi: selectedUserMa, ma: maVal };
      btnSubmit.disabled = true;
      btnSubmit.textContent = "Đang kiểm tra...";

      taiAnhChup(authPayload).then(function (res) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Vào";
        if (res && res.ok) {
          dangNhap = authPayload;
          ghiMay(KHOA_DANG_NHAP, dangNhap);
          anhChup = res;
          currentView = "today";
          renderApp();
        } else {
          var errKey = res ? res.loi : "NETWORK";
          if (errKey === "SAI_MA") loginErrorText = "Mã chưa đúng";
          else if (errKey === "KHOA") loginErrorText = "Sai quá nhiều lần — thử lại sau 15 phút";
          else if (errKey === "CHUA_CO_MA") loginErrorText = "Anh Thanh chưa cấp mã cho tên này";
          else if (errKey === "NETWORK") loginErrorText = "Không có mạng — thử lại";
          else loginErrorText = errKey || "Đăng nhập không thành công";
          renderApp();
        }
      });
    };
    form.appendChild(btnSubmit);

    container.appendChild(form);
    root.appendChild(container);
  }

  // ==========================================
  // 3. MÀN HÌNH HÔM NAY (BỐ CỤC GỘP)
  // ==========================================
  function renderToday(container) {
    // Header
    var header = el("div", "top-header");
    var brand = el("div", "header-brand");
    var logo = el("div", "brand-logo");
    logo.appendChild(makeSvgIcon("bean", 22, "#ffffff"));
    brand.appendChild(logo);
    var brandText = el("div", "brand-text");
    brandText.appendChild(el("span", "brand-title", "Checklist mẻ"));
    brandText.appendChild(el("span", "brand-sub", "7 bước sau rang · máy 30kg & 5kg"));
    brand.appendChild(brandText);
    header.appendChild(brand);

    var btnDoiNguoi = el("button", "user-chip");
    btnDoiNguoi.appendChild(el("span", "user-avatar", (anhChup.ten || "?").replace(/^anh /, "").charAt(0)));
    var userText = el("span", "user-text");
    userText.appendChild(el("span", "user-name", anhChup.ten || ""));
    userText.appendChild(el("span", "user-switch", "Đổi người"));
    btnDoiNguoi.appendChild(userText);
    btnDoiNguoi.type = "button";
    btnDoiNguoi.onclick = function () {
      xoaMay(KHOA_DANG_NHAP);
      dangNhap = null;
      anhChup = null;
      currentView = "login";
      renderApp();
    };
    header.appendChild(btnDoiNguoi);
    container.appendChild(header);
    var tienDo = el("div", "day-progress"); // điền sau khi có ds
    container.appendChild(tienDo);

    // Tính toán danh sách ngày
    var ngayMap = {};
    (anhChup.lo || []).forEach(function (l) {
      if (l.ngay) ngayMap[l.ngay] = l.thu || "";
    });
    var dsNgay = Object.keys(ngayMap).sort();

    // Mặc định chọn ngày
    if (!activeNgay) {
      if (anhChup.homNay && ngayMap[anhChup.homNay]) {
        activeNgay = anhChup.homNay;
      } else if (dsNgay.length > 0) {
        activeNgay = dsNgay[dsNgay.length - 1];
      }
    }

    // Chip Ngày
    var chipsNgayRow = el("div", "chips-row");
    dsNgay.forEach(function (ngay) {
      var thu = ngayMap[ngay];
      var label = (thu ? thu + " " : "") + dinhDangNgayThang(ngay);
      var chip = el("button", "chip" + (activeNgay === ngay ? " active" : ""), label);
      chip.type = "button";
      chip.onclick = function () {
        activeNgay = ngay;
        renderApp();
      };
      chipsNgayRow.appendChild(chip);
    });
    container.appendChild(chipsNgayRow);

    // Chip Máy
    var chipsMayRow = el("div", "segmented");
    var dsMay = [
      { val: "", label: "Tất cả" },
      { val: "30K", label: "Máy 30kg" },
      { val: "5K", label: "Máy 5kg" }
    ];
    dsMay.forEach(function (m) {
      var soLo = loCuaNgay(anhChup.lo || [], activeNgay, m.val).length;
      var chip = el("button", "seg" + (activeMay === m.val ? " active" : ""), m.label + " (" + soLo + ")");
      chip.type = "button";
      chip.onclick = function () {
        activeMay = m.val;
        renderApp();
      };
      chipsMayRow.appendChild(chip);
    });
    container.appendChild(chipsMayRow);

    // Lọc danh sách lô theo ngày và máy
    var ds = loCuaNgay(anhChup.lo || [], activeNgay, activeMay);

    var tdTong = 0, tdXong = 0;
    ds.forEach(function (l) { var d = demBuoc(l); tdTong += d.tong; tdXong += d.xong; });
    var tdPct = tdTong ? Math.round(tdXong * 100 / tdTong) : 0;
    var tdTop = el("div", "progress-top");
    tdTop.appendChild(el("span", null, "Tiến độ " + (ngayMap[activeNgay] || "") + " " + dinhDangNgayThang(activeNgay) + ": " + tdXong + "/" + tdTong + " bước"));
    tdTop.appendChild(el("span", "progress-pct", tdPct + "%"));
    tienDo.appendChild(tdTop);
    var tdBar = el("div", "progress-bar");
    var tdFill = el("div", "progress-fill");
    tdFill.style.width = tdPct + "%";
    tdBar.appendChild(tdFill);
    tienDo.appendChild(tdBar);

    // 4 ô số KPI
    var quenBamCount = ds.filter(function (l) {
      return (l.buoc || []).some(function (b) { return b.mau === "vang"; });
    }).length;

    var daXongCount = ds.filter(function (l) { return l.xong; }).length;

    var tuiChuaLayCount = (anhChup.tui || []).filter(function (t) { return !t.daLay; }).length;

    var kpiGrid = el("div", "kpi-grid");

    function oKpi(lop, icon, nhan, so, chuThich) {
      var c = el("div", "kpi-card " + lop);
      var top = el("span", "kpi-label");
      top.appendChild(makeSvgIcon(icon, 12));
      top.appendChild(el("span", null, nhan));
      c.appendChild(top);
      c.appendChild(el("span", "kpi-value", String(so)));
      c.appendChild(el("span", "kpi-cap", chuThich));
      kpiGrid.appendChild(c);
      return c;
    }
    oKpi("kpi-tong", "list", "Tổng lô", ds.length, "trong ngày");
    oKpi(quenBamCount > 0 ? "kpi-alert" : "kpi-zero", "alert", "Quên bấm", quenBamCount, "lô cần xem");
    oKpi(daXongCount > 0 ? "kpi-done" : "kpi-zero", "check", "Đã xong", daXongCount, "lô hoàn tất");
    var cTui = oKpi("kpi-tui", "sample", "Túi mẫu", tuiChuaLayCount, "chưa lấy");
    cTui.onclick = function () {
      currentView = "samples";
      renderApp();
    };
    container.appendChild(kpiGrid);

    // Kiểm tra lô đang làm
    var allDone = ds.length > 0 && ds.every(function (l) { return l.xong; });

    if (ds.length === 0) {
      container.appendChild(el("div", "empty-state", "Không có lô nào trong ngày và máy đã chọn."));
      return;
    }

    if (allDone) {
      container.appendChild(el("div", "empty-state", "Xong hết lô ngày này"));
    } else {
      // Xác định lô cho thẻ to
      var activeBatch = null;
      var curKey = selectedBatchKeys[activeNgay];
      if (curKey) {
        activeBatch = ds.find(function (l) { return l.khoa === curKey; });
      }
      if (!activeBatch || activeBatch.xong) {
        activeBatch = ds.find(function (l) { return !l.xong; }) || ds[0];
      }

      // THẺ LÔ ĐANG LÀM (TO)
      renderBigActiveCard(container, activeBatch);
    }

    // HÀNG CHỜ CÁC LÔ CÒN LẠI
    var otherBatches = ds.filter(function (l) {
      return allDone ? true : (activeBatch && l.khoa !== activeBatch.khoa);
    });

    if (otherBatches.length > 0) {
      var queueSection = el("div", "queue-section");
      queueSection.appendChild(el("span", "section-label", "Hàng chờ (" + otherBatches.length + " lô)"));

      otherBatches.forEach(function (b) {
        var coVang = (b.buoc || []).some(function (st) { return st.mau === "vang"; });
        var card = el("div", "queue-card" + (b.xong ? " done" : coVang ? " st-vang" : ""));

        var topRow = el("div", "queue-top");
        var nameSpan = el("span", "queue-name", b.sp || ("Chưa rõ: " + b.tenGoc));
        topRow.appendChild(nameSpan);

        var rightMeta = el("div", "queue-meta");
        // Có thao tác chờ gửi?
        if (choGuiCuaLo(docMay(KHOA_HANG_DOI, []), b.khoa).length > 0) {
          rightMeta.appendChild(makeSvgIcon("clock", 12, "#b45309"));
        }
        var dB = demBuoc(b);
        rightMeta.appendChild(el("span", "may-pill", b.mayTen || ""));
        rightMeta.appendChild(el("span", "queue-sub", dB.xong + "/" + dB.tong + " bước"));
        topRow.appendChild(rightMeta);
        card.appendChild(topRow);

        // 7 chấm bước
        var dotsRow = el("div", "queue-dots");
        (b.buoc || []).forEach(function (st) {
          if (st.mau === "an") return;
          var dot = el("span", "step-dot " + (st.mau || "xam"), st.ky || "");
          dotsRow.appendChild(dot);
        });
        card.appendChild(dotsRow);

        // Dòng tiếp
        if (b.tiep) {
          card.appendChild(el("span", "queue-tiep", b.tiep));
        }

        card.onclick = function () {
          selectedBatchKeys[activeNgay] = b.khoa;
          renderApp();
        };

        queueSection.appendChild(card);
      });

      container.appendChild(queueSection);
    }
  }

  // ==========================================
  // THẺ LÔ TO (BIG ACTIVE BATCH CARD)
  // ==========================================
  function renderBigActiveCard(container, batch) {
    if (!batch) return;

    var card = el("div", "batch-card-active");

    // Header thẻ
    var header = el("div", "batch-header");
    var titleGroup = el("div", "batch-title-group");

    var dem = demBuoc(batch);
    titleGroup.appendChild(el("span", "card-eyebrow", "Lô đang làm"));
    var titleRow = el("div", "batch-title-row");
    var titleEl = el("span", "batch-title" + (!batch.sp ? " unclear" : ""));
    titleEl.textContent = batch.sp ? batch.sp : "Chưa rõ: " + batch.tenGoc;
    titleRow.appendChild(titleEl);
    titleRow.appendChild(el("span", "step-count-pill", "Bước " + dem.xong + "/" + dem.tong));
    titleGroup.appendChild(titleRow);

    var subText = (batch.mayTen || "") + " · " + (batch.thu || "") + " " + dinhDangNgayThang(batch.ngay);
    titleGroup.appendChild(el("span", "batch-sub", subText));
    header.appendChild(titleGroup);

    var rightGroup = el("div", null);
    if (choGuiCuaLo(docMay(KHOA_HANG_DOI, []), batch.khoa).length > 0) {
      rightGroup.appendChild(makeSvgIcon("clock", 14, "#b45309"));
    }
    var btnXemDu = el("button", "btn-view-detail", "Xem đủ lô");
    btnXemDu.type = "button";
    btnXemDu.onclick = function () {
      detailBatchKhoa = batch.khoa;
      currentView = "detail";
      renderApp();
    };
    rightGroup.appendChild(btnXemDu);
    header.appendChild(rightGroup);

    card.appendChild(header);
    card.appendChild(oSoLo(batch));
    if (batch.tiLe) {
      card.appendChild(el("span", "batch-tile", batch.tiLe));
    }

    var stepsHead = el("div", "steps-head");
    stepsHead.appendChild(el("span", null, "Quy trình " + dem.tong + " bước"));
    stepsHead.appendChild(el("span", "steps-done", dem.xong + "/" + dem.tong + " xong"));
    card.appendChild(stepsHead);

    // 7 bước trong thẻ
    var stepsWrapper = el("div", "steps-wrapper");

    // Xác định bước mở rộng mặc định
    var expStepNum = expandedStepInActiveCard[batch.khoa];
    if (expStepNum === undefined || expStepNum === null) {
      var firstNonDone = (batch.buoc || []).find(function (b) {
        return b.mau !== "xanh" && b.mau !== "an";
      });
      expStepNum = firstNonDone ? firstNonDone.so : 0;
      expandedStepInActiveCard[batch.khoa] = expStepNum;
    }

    (batch.buoc || []).forEach(function (st) {
      if (st.mau === "an") return;

      if (st.so === expStepNum) {
        // Mở rộng bước này
        var expBox = el("div", "step-box-expanded is-current");
        renderStepContent(expBox, st, batch, anhChup.chiXem);
        stepsWrapper.appendChild(expBox);
      } else {
        // Thu gọn bước này thành 1 dòng
        var row = el("div", "step-row-collapsed " + (st.mau || "xam"));

        var left = el("div", "step-left");
        left.appendChild(el("span", "step-ky", st.ky));
        var nameBox = el("div", "step-name-box");
        nameBox.appendChild(el("span", "step-name", st.ten));
        var timeStr = st.gio ? dinhDangGio(st.gio) : "";
        nameBox.appendChild(el("span", "step-meta", st.nguoi ? st.nguoi + (timeStr ? " · " + timeStr : "") : chuTrangThai(st.mau)));
        left.appendChild(nameBox);
        row.appendChild(left);

        var right = el("div", "step-right");
        var badge = el("span", "step-badge round " + (st.mau || "xam"));
        badge.textContent = kyHieuTrangThai(st.mau);
        right.appendChild(badge);
        row.appendChild(right);

        row.onclick = function () {
          expandedStepInActiveCard[batch.khoa] = st.so;
          renderApp();
        };

        stepsWrapper.appendChild(row);
      }
    });

    card.appendChild(stepsWrapper);
    container.appendChild(card);
  }

  // ==========================================
  // 4. MÀN HÌNH CHI TIẾT LÔ (DETAIL VIEW)
  // ==========================================
  function renderDetail(container) {
    var batch = (anhChup.lo || []).find(function (l) { return l.khoa === detailBatchKhoa; });

    var viewWrapper = el("div", "detail-view");

    // Nút quay lại
    var navRow = el("div", "detail-nav");
    var btnBack = el("button", "btn btn-outline btn-sm");
    btnBack.type = "button";
    btnBack.appendChild(makeSvgIcon("back", 14, "#0f172a"));
    btnBack.appendChild(el("span", null, "Quay lại"));
    btnBack.onclick = function () {
      currentView = "today";
      renderApp();
    };
    navRow.appendChild(btnBack);
    viewWrapper.appendChild(navRow);

    if (!batch) {
      viewWrapper.appendChild(el("div", "empty-state", "Không tìm thấy thông tin lô."));
      container.appendChild(viewWrapper);
      return;
    }

    // Thẻ tiêu đề lô
    var headerCard = el("div", "detail-header-card");
    var titleEl = el("h2", "detail-title" + (!batch.sp ? " unclear" : ""));
    titleEl.textContent = batch.sp ? batch.sp : "Chưa rõ: " + batch.tenGoc;
    headerCard.appendChild(titleEl);

    var subLine1 = (batch.mayTen || "") + " · " + (batch.thu || "") + " " + dinhDangNgayThang(batch.ngay) + " · Mã mẻ: " + (batch.maMe || "");
    headerCard.appendChild(el("p", "detail-sub mono-num", subLine1));

    headerCard.appendChild(oSoLo(batch));

    if (batch.co) {
      var boxCo = el("div", "banner banner-yellow", "Thêm mẻ sau khi cân — Lưu lại kg ra");
      headerCard.appendChild(boxCo);
    }

    if (batch.tiLe) {
      headerCard.appendChild(el("p", "batch-tile", batch.tiLe));
    }

    viewWrapper.appendChild(headerCard);

    // 7 bước xếp dọc
    var stepsWrapper = el("div", "steps-wrapper");
    (batch.buoc || []).forEach(function (st) {
      if (st.mau === "an") return;
      var box = el("div", "step-box-expanded");
      renderStepContent(box, st, batch, anhChup.chiXem);
      stepsWrapper.appendChild(box);
    });

    viewWrapper.appendChild(stepsWrapper);
    container.appendChild(viewWrapper);
  }

  // ==========================================
  // HÀM VẼ NỘI DUNG TỪNG BƯỚC (DÙNG CHUNG)
  // ==========================================
  function renderStepContent(box, step, batch, chiXem) {
    // Header bước
    var header = el("div", "step-expanded-header");
    var left = el("div", "step-left");
    left.appendChild(el("span", "step-ky", step.ky));
    left.appendChild(el("span", "step-expanded-title", step.ten));
    header.appendChild(left);

    var right = el("div", "step-right");
    if (step.nguoi) {
      var timeStr = step.gio ? dinhDangGio(step.gio) : "";
      right.appendChild(el("span", "mono-num text-muted", step.nguoi + (timeStr ? " " + timeStr : "")));
    }
    var badge = el("span", "status-pill " + (step.mau || "xam"));
    badge.textContent = kyHieuTrangThai(step.mau) + " " + chuTrangThai(step.mau);
    right.appendChild(badge);
    header.appendChild(right);
    box.appendChild(header);

    // Thân bước
    var body = el("div", "step-body");

    // ------------------------------------------
    // BƯỚC ⓪: NHÂN XANH
    // ------------------------------------------
    if (step.so === 0) {
      if (!batch.sp) {
        // Chưa có sản phẩm -> Chọn sản phẩm
        var selectBox = el("div", null);
        selectBox.appendChild(el("p", null, "Lô chưa rõ sản phẩm. Vui lòng chọn:"));
        var sel = el("select", "form-input");
        sel.appendChild(el("option", null, "— chọn sản phẩm —"));
        sel.firstChild.value = "";
        sel.disabled = chiXem;
        (anhChup.sanPham || []).forEach(function (spItem) {
          var opt = el("option", null, spItem);
          opt.value = spItem;
          sel.appendChild(opt);
        });
        selectBox.appendChild(sel);

        if (!chiXem) {
          var btnChonSP = el("button", "btn btn-primary btn-sm", "Lưu sản phẩm");
          btnChonSP.style.marginTop = "6px";
          btnChonSP.type = "button";
          btnChonSP.disabled = true;
          sel.onchange = function () { btnChonSP.disabled = !sel.value; };
          btnChonSP.onclick = function () {
            thucHienThaoTac({ loai: "sanPham", khoa: batch.khoa, sp: sel.value });
          };
          selectBox.appendChild(btnChonSP);
        }
        body.appendChild(selectBox);
      } else if (batch.thuc0 && batch.thuc0.length > 0) {
        // Đã xác nhận công thức
        var thucBox = el("div", null);
        thucBox.appendChild(el("span", "mono-num", "Đã xác nhận thành phần nhân xanh:"));
        batch.thuc0.forEach(function (grp) {
          (grp.dong || []).forEach(function (d) {
            var tr = el("div", "kv-row");
            tr.appendChild(el("span", null, d.loai));
            tr.appendChild(el("b", null, soVN(d.kg, 2) + " kg"));
            thucBox.appendChild(tr);
          });
        });
        body.appendChild(thucBox);
      } else {
        // Hiển thị gợi ý nhóm goiY0
        var isEditing = !!editModeNhanXanh[batch.khoa];
        var goiYWrapper = el("div", null);
        var inputsMap = {}; // "vao|tp|loai" -> input element

        var hasRows = false;
        (batch.goiY0 || []).forEach(function (grp) {
          var gTitle = grp.soMe + " mẻ × " + soVN(grp.vao, 1) + " kg" + (grp.tp ? " · " + grp.tp : "");
          goiYWrapper.appendChild(el("div", "section-label", gTitle));

          (grp.dong || []).forEach(function (d) {
            hasRows = true;
            var rowKey = grp.vao + "|" + (grp.tp || "") + "|" + d.loai;

            if (isEditing) {
              var editRow = el("div", null);
              editRow.style.display = "flex";
              editRow.style.alignItems = "center";
              editRow.style.gap = "6px";
              editRow.style.marginTop = "4px";

              editRow.appendChild(el("span", null, d.loai + ":"));
              var inp = el("input", "form-input mono-num");
              inp.inputMode = "decimal";
              inp.value = soVN(d.kg, 2);
              inp.style.maxWidth = "90px";
              inputsMap[rowKey] = inp;
              editRow.appendChild(inp);
              editRow.appendChild(el("span", null, "kg"));
              goiYWrapper.appendChild(editRow);
            } else {
              var gr = el("div", "kv-row");
              gr.appendChild(el("span", null, d.loai));
              gr.appendChild(el("b", null, soVN(d.kg, 2) + " kg"));
              goiYWrapper.appendChild(gr);
            }
          });
        });
        body.appendChild(goiYWrapper);

        // Nút thao tác
        if (!chiXem) {
          var btnGroup = el("div", null);
          btnGroup.style.display = "flex";
          btnGroup.style.gap = "8px";
          btnGroup.style.marginTop = "8px";

          if (!hasRows) {
            // Trường hợp như R&B: không có dòng thành phần
            var btnXacNhan = el("button", "btn btn-primary btn-sm", "Xác nhận ⓪ Nhân xanh");
            btnXacNhan.type = "button";
            btnXacNhan.onclick = function () {
              thucHienThaoTac({ loai: "nhanXanh", khoa: batch.khoa, thuc: thucNhanXanh(batch.goiY0, {}) });
            };
            btnGroup.appendChild(btnXacNhan);
          } else if (!isEditing) {
            var btnDung = el("button", "btn btn-green btn-sm", "Đúng ⓪ Nhân xanh");
            btnDung.type = "button";
            btnDung.onclick = function () {
              thucHienThaoTac({ loai: "nhanXanh", khoa: batch.khoa, thuc: thucNhanXanh(batch.goiY0, {}) });
            };
            btnGroup.appendChild(btnDung);

            var btnSua = el("button", "btn btn-outline btn-sm", "Sửa");
            btnSua.type = "button";
            btnSua.onclick = function () {
              editModeNhanXanh[batch.khoa] = true;
              renderApp();
            };
            btnGroup.appendChild(btnSua);
          } else {
            var btnGuiSua = el("button", "btn btn-primary btn-sm", "Gửi sửa ⓪");
            btnGuiSua.type = "button";
            btnGuiSua.onclick = function () {
              var suaMap = {};
              var coLoi = false;
              Object.keys(inputsMap).forEach(function (k) {
                var valStr = inputsMap[k].value.trim();
                var num = docSo(valStr);
                if (num === null) {
                  inputsMap[k].classList.add("error");
                  coLoi = true;
                } else {
                  inputsMap[k].classList.remove("error");
                  suaMap[k] = valStr;
                }
              });
              if (coLoi) return;
              editModeNhanXanh[batch.khoa] = false;
              thucHienThaoTac({
                loai: "nhanXanh",
                khoa: batch.khoa,
                thuc: thucNhanXanh(batch.goiY0, suaMap)
              });
            };
            btnGroup.appendChild(btnGuiSua);

            var btnHuy = el("button", "btn btn-outline btn-sm", "Hủy");
            btnHuy.type = "button";
            btnHuy.onclick = function () {
              editModeNhanXanh[batch.khoa] = false;
              renderApp();
            };
            btnGroup.appendChild(btnHuy);
          }
          body.appendChild(btnGroup);
        }
      }
    }

    // ------------------------------------------
    // BƯỚC ①: RANG XONG
    // ------------------------------------------
    else if (step.so === 1) {
    }

    // ------------------------------------------
    // BƯỚC ②: TÁCH ĐÁ
    // ------------------------------------------
    else if (step.so === 2) {
      if (step.daBam) {
        body.appendChild(el("p", "text-muted", step.daBam));
      }
      if (!chiXem) {
        var btnTachDa = el("button", "btn btn-outline btn-sm", "Đã tách đá");
        btnTachDa.type = "button";
        btnTachDa.onclick = function () {
          thucHienThaoTac({ loai: "buoc", khoa: batch.khoa, buoc: 2 });
        };
        body.appendChild(btnTachDa);
      }
    }

    // ------------------------------------------
    // BƯỚC ③: SORTING
    // ------------------------------------------
    else if (step.so === 3) {
      if (step.daBam) {
        body.appendChild(el("p", "text-muted", step.daBam));
      }
      if (!chiXem) {
        var btnSorting = el("button", "btn btn-outline btn-sm", "Đã sorting");
        btnSorting.type = "button";
        btnSorting.onclick = function () {
          thucHienThaoTac({ loai: "buoc", khoa: batch.khoa, buoc: 3 });
        };
        body.appendChild(btnSorting);
      }
    }

    // ------------------------------------------
    // BƯỚC ④: CÂN VÀ HAO HỤT
    // ------------------------------------------
    else if (step.so === 4) {
      var canBox = el("div", null);

      var canGrid = el("div", "can-grid");
      var oKg = el("div", "can-tile");
      oKg.appendChild(el("span", "stat-label", "Kg ra"));
      var inputRow = el("div", "can-input-row");
      var inpKgRa = el("input", "form-input can-input");
      inpKgRa.inputMode = "decimal";
      inpKgRa.value = batch.kgRa !== null && batch.kgRa !== undefined ? soVN(batch.kgRa) : "";
      inpKgRa.readOnly = chiXem;
      inputRow.appendChild(inpKgRa);
      inputRow.appendChild(el("span", null, "kg"));
      oKg.appendChild(inputRow);
      canGrid.appendChild(oKg);

      // Ô hao hụt: số to + nhãn ngưỡng
      var oHH = el("div", "can-tile");
      var hhHead = el("div", "can-tile-head");
      hhHead.appendChild(el("span", "stat-label", "Hao hụt"));
      var hhPill = el("span", "status-pill xam");
      oHH.appendChild(hhHead);
      var hhLabel = el("div", "hh-label");
      oHH.appendChild(hhLabel);
      var pillRow = el("div", null);
      pillRow.appendChild(hhPill);
      oHH.appendChild(pillRow);
      canGrid.appendChild(oHH);
      canBox.appendChild(canGrid);
      var nguongLine = el("div", "nguong-line");
      canBox.appendChild(nguongLine);

      // Thanh đo hao hụt trực quan
      var gaugeWrapper = el("div", "gauge-wrapper");
      var gaugeTrack = el("div", "gauge-track");

      var zoneTarget = el("div", "gauge-zone-target");
      gaugeTrack.appendChild(zoneTarget);

      var pin = el("div", "gauge-pin");
      gaugeTrack.appendChild(pin);
      gaugeWrapper.appendChild(gaugeTrack);

      var gaugeLabels = el("div", "gauge-labels mono-num");
      // Thang lấy theo ngưỡng của lô (±5 điểm), không ngưỡng thì 0–30 %
      var gLo = batch.nguong ? Math.max(0, batch.nguong[1] - 5) : 0;
      var gHi = batch.nguong ? batch.nguong[2] + 5 : 30;
      var lblMin = el("span", null, soVN(gLo, 1) + "%");
      var lblMid = el("span", null, "");
      var lblMax = el("span", null, soVN(gHi, 1) + "%");
      gaugeLabels.appendChild(lblMin);
      gaugeLabels.appendChild(lblMid);
      gaugeLabels.appendChild(lblMax);
      gaugeWrapper.appendChild(gaugeLabels);
      canBox.appendChild(gaugeWrapper);

      // Nút Lưu
      var btnLuuCan = el("button", "btn btn-primary btn-block btn-luu-can");
      btnLuuCan.type = "button";
      btnLuuCan.textContent = (batch.kgRa !== null && batch.kgRa !== undefined) ? "Lưu lại" : "Lưu";
      btnLuuCan.style.marginTop = "6px";

      // Hàm tính toán và cập nhật giao diện cân
      function capNhatHaoHut() {
        var num = docSo(inpKgRa.value);
        var hh = haoHut(batch.kgVao, num);
        var mau = mauHaoHut(hh, batch.nguong);

        nguongLine.textContent = batch.nguong
          ? "Ngưỡng " + soVN(batch.nguong[1], 1) + "–" + soVN(batch.nguong[2], 1) + " %"
          : "Chưa có ngưỡng";
        hhLabel.textContent = hh !== null ? soVN(hh, 1) + " %" : "— %";
        hhLabel.className = "hh-label " + (hh !== null ? mau : "xam");
        hhPill.className = "status-pill " + (hh !== null ? mau : "xam");
        hhPill.textContent = hh === null ? "Chưa gõ" : mau === "xanh" ? "✓ Trong ngưỡng" : mau === "do" ? "! Ngoài ngưỡng" : "Chưa có ngưỡng";

        // Định vị vùng chuẩn trên thanh gauge (thang gLo–gHi)
        if (batch.nguong) {
          var tMin = batch.nguong[1];
          var tMax = batch.nguong[2];
          var leftPct = ((tMin - gLo) / (gHi - gLo)) * 100;
          var widthPct = ((tMax - tMin) / (gHi - gLo)) * 100;
          if (leftPct < 0) leftPct = 0;
          if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
          zoneTarget.style.left = leftPct + "%";
          zoneTarget.style.width = widthPct + "%";
        } else {
          zoneTarget.style.width = "0%";
        }

        // Định vị kim
        if (hh !== null) {
          var pinPos = ((hh - gLo) / (gHi - gLo)) * 100;
          if (pinPos < 0) pinPos = 0;
          if (pinPos > 100) pinPos = 100;
          pin.style.left = pinPos + "%";
          pin.style.display = "block";
        } else {
          pin.style.display = "none";
        }

        // Bật / tắt nút Lưu
        btnLuuCan.disabled = (num === null);
      }

      inpKgRa.oninput = capNhatHaoHut;
      capNhatHaoHut();

      if (!chiXem) {
        btnLuuCan.onclick = function () {
          var textVal = inpKgRa.value.trim();
          if (docSo(textVal) === null) return;
          thucHienThaoTac({ loai: "can", khoa: batch.khoa, kgRa: textVal });
        };
        canBox.appendChild(btnLuuCan);
      }

      body.appendChild(canBox);
    }

    // ------------------------------------------
    // BƯỚC ⑤: TRỘN POST-BLEND
    // ------------------------------------------
    else if (step.so === 5) {
      var tronBox = el("div", null);
      var goiYText = "Gợi ý: " + (batch.goiYTron !== null ? soVN(batch.goiYTron, 1) : "—") + " kg " + (batch.tenTron || "");
      tronBox.appendChild(el("p", "mono-num", goiYText));

      var tronRow = el("div", null);
      tronRow.style.display = "flex";
      tronRow.style.alignItems = "center";
      tronRow.style.gap = "8px";
      tronRow.style.marginTop = "4px";

      tronRow.appendChild(el("span", null, "Kg trộn:"));
      var inpKgTron = el("input", "form-input mono-num");
      inpKgTron.inputMode = "decimal";
      inpKgTron.value = batch.kgTron !== null && batch.kgTron !== undefined ? soVN(batch.kgTron) : "";
      inpKgTron.style.maxWidth = "110px";
      inpKgTron.readOnly = chiXem;
      tronRow.appendChild(inpKgTron);
      tronRow.appendChild(el("span", null, "kg"));
      tronBox.appendChild(tronRow);

      if (!chiXem) {
        var btnLuuTron = el("button", "btn btn-primary btn-sm");
        btnLuuTron.type = "button";
        btnLuuTron.style.marginTop = "6px";

        if (batch.kgRa === null || batch.kgRa === undefined) {
          btnLuuTron.disabled = true;
          btnLuuTron.textContent = "Cân trước";
        } else {
          btnLuuTron.textContent = "Lưu";
          btnLuuTron.disabled = (docSo(inpKgTron.value) === null);
        }

        inpKgTron.oninput = function () {
          if (batch.kgRa !== null && batch.kgRa !== undefined) {
            btnLuuTron.disabled = (docSo(inpKgTron.value) === null);
          }
        };

        btnLuuTron.onclick = function () {
          var valStr = inpKgTron.value.trim();
          if (docSo(valStr) === null) return;
          thucHienThaoTac({ loai: "tron", khoa: batch.khoa, kg: valStr });
        };

        tronBox.appendChild(btnLuuTron);
      }

      body.appendChild(tronBox);
    }

    // ------------------------------------------
    // BƯỚC ⑥: LẤY MẪU
    // ------------------------------------------
    else if (step.so === 6) {
      var linkMau = el("button", "btn btn-outline btn-sm", "Lấy ở tab Túi mẫu");
      linkMau.type = "button";
      linkMau.onclick = function () {
        currentView = "samples";
        renderApp();
      };
      body.appendChild(linkMau);
    }

    box.appendChild(body);
  }

  // ==========================================
  // 5. MÀN HÌNH TÚI MẪU (SAMPLES VIEW)
  // ==========================================
  function renderSamples(container) {
    var viewWrapper = el("div", "samples-view");

    // Đếm ngược cupping
    var countdownText = demNguoc(anhChup.homNay || "", anhChup.cupping || "");
    viewWrapper.appendChild(el("div", "sample-countdown mono-num", countdownText));

    var listTui = anhChup.tui || [];
    if (listTui.length === 0) {
      viewWrapper.appendChild(el("div", "empty-state", "Chưa có danh sách túi mẫu tuần này."));
      container.appendChild(viewWrapper);
      return;
    }

    listTui.forEach(function (t) {
      var card = el("div", "sample-card" + (t.daLay ? " done" : ""));

      var hdr = el("div", "sample-header");
      hdr.appendChild(el("span", "sample-title", t.sp || ""));
      card.appendChild(hdr);

      if (t.daLay) {
        var timeStr = t.daLay.gio ? dinhDangGio(t.daLay.gio) : "";
        var daLayLine = el("div", "mono-num", "Đã lấy · " + (t.daLay.nguoi || "") + " " + timeStr);
        daLayLine.style.color = "var(--status-xanh)";
        card.appendChild(daLayLine);
      } else {
        // Danh sách mẻ mới cần lấy
        var keys = (t.loMoi && t.loMoi.length > 0) ? t.loMoi : (t.lo || []);
        var checks = [];

        keys.forEach(function (k) {
          var loObj = (anhChup.lo || []).find(function (l) { return l.khoa === k; });
          var labelText = loObj ? (loObj.thu + " · " + (loObj.mayTen || "")) : k;

          var itemRow = el("label", "sample-lo-item");
          var chk = el("input", null);
          chk.type = "checkbox";
          chk.checked = true;
          chk.disabled = !!anhChup.chiXem;
          chk.dataset.khoa = k;
          checks.push(chk);

          itemRow.appendChild(chk);
          itemRow.appendChild(el("span", "mono-num", labelText));
          card.appendChild(itemRow);
        });

        if (!anhChup.chiXem) {
          var btnLay = el("button", "btn btn-tim btn-sm", "Đã lấy mẫu");
          btnLay.type = "button";
          btnLay.style.marginTop = "6px";

          function updateBtnState() {
            var checkedCount = checks.filter(function (c) { return c.checked; }).length;
            btnLay.disabled = (checkedCount === 0);
          }

          checks.forEach(function (c) {
            c.onchange = updateBtnState;
          });
          updateBtnState();

          btnLay.onclick = function () {
            var selectedKhoa = checks.filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.khoa; });
            if (!selectedKhoa.length) return;
            thucHienThaoTac({
              loai: "layMau",
              tuan: anhChup.tuan,
              sp: t.sp,
              khoaLo: selectedKhoa
            });
          };

          card.appendChild(btnLay);
        }
      }

      viewWrapper.appendChild(card);
    });

    container.appendChild(viewWrapper);
  }

  // ==========================================
  // 6. MÀN HÌNH NGOẠI LỆ (EXCEPTIONS VIEW)
  // ==========================================
  function renderExceptions(container) {
    var viewWrapper = el("div", "exceptions-view");

    var listNL = anhChup.ngoaiLe || [];
    if (listNL.length === 0) {
      viewWrapper.appendChild(el("div", "empty-state", "Không có cảnh báo ngoại lệ nào."));
      container.appendChild(viewWrapper);
      return;
    }

    listNL.forEach(function (nl) {
      var card = el("div", "exception-card " + (nl.loai || "xam"));
      card.textContent = nl.chu || "";
      card.onclick = function () {
        if (nl.khoa) {
          detailBatchKhoa = nl.khoa;
          currentView = "detail";
          renderApp();
        }
      };
      viewWrapper.appendChild(card);
    });

    container.appendChild(viewWrapper);
  }

  // ==========================================
  // 7. THANH ĐIỀU HƯỚNG ĐÁY (BOTTOM NAV)
  // ==========================================
  function renderBottomNav(container) {
    var nav = el("nav", "bottom-nav");

    // Tab Hôm nay
    var tabHomNay = el("button", "nav-tab" + (currentView === "today" ? " active" : ""));
    tabHomNay.type = "button";
    tabHomNay.appendChild(makeSvgIcon("list", 18));
    tabHomNay.appendChild(el("span", null, "Hôm nay"));
    tabHomNay.onclick = function () {
      currentView = "today";
      renderApp();
    };
    nav.appendChild(tabHomNay);

    // Tab Túi mẫu
    var tabTuiMau = el("button", "nav-tab" + (currentView === "samples" ? " active" : ""));
    tabTuiMau.type = "button";
    tabTuiMau.appendChild(makeSvgIcon("sample", 18));
    tabTuiMau.appendChild(el("span", null, "Túi mẫu"));
    tabTuiMau.onclick = function () {
      currentView = "samples";
      renderApp();
    };
    nav.appendChild(tabTuiMau);

    // Tab Ngoại lệ
    var tabNgoaiLe = el("button", "nav-tab" + (currentView === "exceptions" ? " active" : ""));
    tabNgoaiLe.type = "button";
    tabNgoaiLe.appendChild(makeSvgIcon("alert", 18));
    tabNgoaiLe.appendChild(el("span", null, "Ngoại lệ"));

    var dsNL = (anhChup && anhChup.ngoaiLe) || [];
    var countNL = dsNL.length;
    var hasRed = dsNL.some(function (x) { return x.loai === "do"; });

    var badge = el("span", "nav-badge" + (hasRed ? " red" : ""), String(countNL));
    tabNgoaiLe.appendChild(badge);

    tabNgoaiLe.onclick = function () {
      currentView = "exceptions";
      renderApp();
    };
    nav.appendChild(tabNgoaiLe);

    container.appendChild(nav);
  }

  // ==========================================
  // KHỞI ĐỘNG ỨNG DỤNG
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
        // Lỗi xác thực -> về màn chọn tên
        dangNhap = null;
        xoaMay(KHOA_DANG_NHAP);
        currentView = "login";
      }
      renderApp();
    });
  }
})();
