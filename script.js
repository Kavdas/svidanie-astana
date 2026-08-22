let packages = [];
let siteSettings = null;
let selectedPackage = null;
let selectedSlot = null;

const localGallery = [
  {
    title: "Свидание с живой музыкой",
    image_url: "assets/gallery/saxophone-date-wide.png",
  },
  {
    title: "Живая музыка в куполе",
    image_url: "assets/gallery/saxophone-date-portrait.png",
  },
  {
    title: "Декор с экраном",
    image_url: "assets/gallery/cinema-decor-wide.png",
  },
  {
    title: "Романтический ужин в куполе",
    image_url: "assets/gallery/romantic-table-wide.png",
  },
  {
    title: "Сервировка со свечами",
    image_url: "assets/gallery/dinner-closeup.png",
  },
  {
    title: "Вид на город",
    image_url: "assets/gallery/astana-baiterek-view.png",
  },
  {
    title: "Вид на мечеть",
    image_url: "assets/gallery/astana-mosque-view.png",
  },
  {
    title: "Панорама Астаны",
    image_url: "assets/gallery/astana-panorama.png",
  },
  {
    title: "Дневная сервировка",
    image_url: "assets/gallery/daylight-table-view.png",
  },
  {
    title: "Вечерний купол",
    image_url: "assets/gallery/dome-evening-wide.png",
  },
  {
    title: "Astana Juregi",
    image_url: "assets/gallery/astana-juregi-night.png",
  },
];

const defaultLocationImage = "assets/gallery/romantic-table-wide.png";
const defaultLocationText = "Купол в центре Астаны, 13 этаж";

const packagesGrid = document.getElementById("packagesGrid");
const tabButtons = document.querySelectorAll(".tab-btn");
const packageModal = document.getElementById("packageModal");
const modalImage = document.getElementById("modalImage");
const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalPrice = document.getElementById("modalPrice");
const modalDuration = document.getElementById("modalDuration");
const modalDeposit = document.getElementById("modalDeposit");
const modalIncludes = document.getElementById("modalIncludes");
const modalNote = document.getElementById("modalNote");
const bookingForm = document.getElementById("bookingForm");
const clientDateInput = document.getElementById("clientDate");
const clientSlotSelect = document.getElementById("clientSlot");
const slotStatus = document.getElementById("slotStatus");
const slotGrid = document.getElementById("slotGrid");
const paymentSection = document.getElementById("paymentSection");
const paymentAmountText = document.getElementById("paymentAmountText");
const paymentKaspiLink = document.getElementById("paymentKaspiLink");
const paymentRequisitesText = document.getElementById("paymentRequisitesText");
const paymentClaimBtn = document.getElementById("paymentClaimBtn");
const paymentStatusText = document.getElementById("paymentStatusText");
let currentBookingId = null;

async function apiRequest(path, options = {}) {
  if (!window.API_BASE_URL) {
    throw new Error("API URL не настроен");
  }

  const response = await fetch(`${window.API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join("\n")
      : data.message || "Ошибка запроса";
    throw new Error(message);
  }

  return data;
}

async function loadSiteSettings() {
  try {
    const data = await apiRequest("/catalog/site-settings");
    siteSettings = data.settings;

    if (!siteSettings) return;

    const heroTitle = document.getElementById("heroTitle");
    const heroSubtitle = document.getElementById("heroSubtitle");
    const heroSection = document.getElementById("heroSection");

    if (heroTitle && siteSettings.hero_title) {
      heroTitle.textContent = siteSettings.hero_title;
    }

    if (heroSubtitle && siteSettings.hero_subtitle) {
      heroSubtitle.textContent = siteSettings.hero_subtitle;
    }

    if (heroSection) {
      const heroImage =
        siteSettings.hero_image_url || "assets/gallery/saxophone-date-wide.png";
      heroSection.style.backgroundImage = `
        linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.92)),
        url("${heroImage}")
      `;
    }

    document.querySelectorAll("[data-instagram-link]").forEach((link) => {
      if (siteSettings.instagram_url) {
        link.href = siteSettings.instagram_url;
      }
    });
  } catch (error) {
    console.error("Ошибка загрузки настроек:", error);
  }
}

async function loadPackages() {
  packagesGrid.innerHTML = "<p>Загружаем пакеты...</p>";

  try {
    const data = await apiRequest("/catalog/packages");
    packages = (data.packages || []).filter((item) => !isCinemaPackage(item));
    renderPackages(getActiveCategory());
  } catch (error) {
    console.error("Ошибка загрузки пакетов:", error);
    packagesGrid.innerHTML =
      "<p>Не удалось загрузить пакеты. Попробуйте позже.</p>";
  }
}

function renderPackages(category = "all") {
  packagesGrid.innerHTML = "";

  const filteredPackages =
    category === "all"
      ? packages
      : packages.filter((item) => packageMatchesCategory(item, category));

  if (filteredPackages.length === 0) {
    packagesGrid.innerHTML =
      "<p>В этой категории пока нет активных пакетов.</p>";
    return;
  }

  filteredPackages.forEach((item) => {
    const card = document.createElement("article");
    card.className = "package-card reveal";

    const packageImage = getPackageImage(item);

    card.style.backgroundImage = `
      linear-gradient(rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.92)),
      url("${packageImage}")
    `;

    const shortIncludes = (item.includes || []).slice(0, 3);

    card.innerHTML = `
      <div>
        <span class="package-badge">${escapeHtml(item.category_name || "Пакет")}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="package-price">${escapeHtml(item.price || "Цена уточняется")}</p>
        <p class="package-duration">Продолжительность: ${escapeHtml(item.duration || `${item.duration_minutes || 60} минут`)}</p>

        <ul>
          ${shortIncludes.map((include) => `<li>${escapeHtml(include)}</li>`).join("")}
        </ul>
      </div>

      <div class="package-actions">
        <button class="details-btn" type="button" onclick="openPackageModal('${item.id}')">
          Подробнее
        </button>

        <button class="whatsapp-btn" type="button" onclick="sendPackageDirectly('${item.id}')">
          <span class="whatsapp-icon"></span>
          Написать в WhatsApp
        </button>
      </div>
    `;

    const metaBlock = card.querySelector(".package-duration");

    if (metaBlock) {
      const location = document.createElement("p");
      location.className = "package-location";
      location.textContent = getPackageLocation(item);
      metaBlock.insertAdjacentElement("afterend", location);
    }

    packagesGrid.appendChild(card);
  });

  initScrollReveal(packagesGrid);
}

function openPackageModal(packageId) {
  selectedPackage = packages.find((item) => item.id === packageId);

  if (!selectedPackage) return;

  selectedSlot = null;

  const packageImage = getPackageImage(selectedPackage);

  if (modalImage && packageImage) {
    modalImage.style.backgroundImage = `url("${packageImage}")`;
    modalImage.style.display = "block";
  } else if (modalImage) {
    modalImage.style.display = "none";
  }

  modalCategory.textContent = selectedPackage.category_name || "Пакет";
  modalTitle.textContent = selectedPackage.title;
  modalPrice.textContent = `Стоимость: ${selectedPackage.price || "уточняется"}`;
  modalDuration.textContent = `Продолжительность: ${
    selectedPackage.duration || `${selectedPackage.duration_minutes || 60} минут`
  }`;

  if (modalDeposit) {
    const depositAmount = getDepositAmount(selectedPackage);
    modalDeposit.textContent = depositAmount
      ? `Предоплата онлайн: ${formatMoney(depositAmount)} тг (50%)`
      : "";
  }

  modalIncludes.innerHTML = (selectedPackage.includes || [])
    .map((include) => `<li>${escapeHtml(include)}</li>`)
    .join("");

  modalNote.textContent =
    selectedPackage.note ||
    "Дополнительную информацию уточняйте у менеджера.";

  if (bookingForm) {
    bookingForm.reset();
    bookingForm.classList.remove("hidden");
  }

  currentBookingId = null;
  paymentSection?.classList.add("hidden");

  resetSlots("Сначала выберите дату");
  packageModal.classList.add("active");
  document.body.classList.add("modal-open");
}

function getDepositAmount(item) {
  const priceAmount = Number(item?.price_amount);

  if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
    return null;
  }

  return Math.round(priceAmount * 0.5);
}

function formatMoney(amount) {
  return new Intl.NumberFormat("ru-RU").format(amount);
}

function closePackageModal() {
  packageModal.classList.remove("active");
  document.body.classList.remove("modal-open");
  currentBookingId = null;
  paymentSection?.classList.add("hidden");
  bookingForm?.classList.remove("hidden");
}

function showPaymentStep(booking) {
  if (!paymentSection) {
    alert("Заявка создана. Менеджер свяжется с вами.");
    return;
  }

  const depositAmount = Number(booking.depositAmount);
  const kaspiRequisites = siteSettings?.kaspi_requisites?.trim();
  const kaspiPayLink = siteSettings?.kaspi_pay_link?.trim();
  const hasDeposit = Number.isFinite(depositAmount) && depositAmount > 0;

  paymentClaimBtn.disabled = false;

  if (hasDeposit && (kaspiPayLink || kaspiRequisites)) {
    paymentAmountText.textContent = `Чтобы подтвердить бронь, переведите предоплату 50% — ${formatMoney(depositAmount)} тг. Если сумма не подставится в Kaspi автоматически — введите её вручную.`;

    if (kaspiPayLink) {
      paymentKaspiLink.href = kaspiPayLink;
      paymentKaspiLink.classList.remove("hidden");
    } else {
      paymentKaspiLink.classList.add("hidden");
    }

    paymentRequisitesText.textContent = kaspiRequisites || "";
    paymentClaimBtn.classList.remove("hidden");
    paymentStatusText.textContent = "";
  } else {
    paymentAmountText.textContent =
      "Заявка создана. Менеджер свяжется с вами, чтобы уточнить детали и оплату.";
    paymentKaspiLink.classList.add("hidden");
    paymentRequisitesText.textContent = "";
    paymentClaimBtn.classList.add("hidden");
    paymentStatusText.textContent = "";
  }

  paymentSection.classList.remove("hidden");
}

paymentClaimBtn?.addEventListener("click", async () => {
  if (!currentBookingId) return;

  paymentClaimBtn.disabled = true;

  try {
    await apiRequest(`/bookings/${currentBookingId}/payment-claim`, {
      method: "POST",
    });

    paymentStatusText.textContent =
      "Спасибо! Менеджер проверит поступление и подтвердит оплату.";
    paymentClaimBtn.classList.add("hidden");
  } catch (error) {
    alert(error.message || "Не удалось отметить оплату");
    paymentClaimBtn.disabled = false;
  }
});

function createWhatsAppUrl(message) {
  const phone = siteSettings?.whatsapp_phone || "77052518757";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function openManagerWhatsApp() {
  const message = `
Здравствуйте! Хочу узнать подробнее про бронирование свидания.

Подскажите, пожалуйста, свободные даты, пакеты и условия оплаты.
  `;

  window.open(createWhatsAppUrl(message), "_blank");
}

function sendPackageDirectly(packageId) {
  const item = packages.find((packageItem) => packageItem.id === packageId);

  if (!item) return;

  const message = `
Здравствуйте! Хочу узнать подробнее про пакет.

Пакет: ${item.title}
Стоимость: ${item.price || "уточняется"}
Продолжительность: ${item.duration || `${item.duration_minutes || 60} минут`}

Подскажите, пожалуйста, свободные даты и условия оплаты.
  `;

  window.open(createWhatsAppUrl(message), "_blank");
}

async function loadAvailableSlots() {
  const clientDate = clientDateInput?.value;

  if (!clientSlotSelect || !slotGrid || !slotStatus) return;

  selectedSlot = null;
  resetSlots("Загружаем свободное время...");

  if (!clientDate || !selectedPackage) {
    resetSlots("Сначала выберите дату");
    return;
  }

  try {
    const data = await apiRequest("/bookings/available-slots", {
      method: "POST",
      body: JSON.stringify({
        packageId: selectedPackage.id,
        date: clientDate,
      }),
    });

    renderSlots(data.slots || []);
  } catch (error) {
    console.error("Ошибка загрузки слотов:", error);
    resetSlots("Не удалось загрузить свободное время");
  }
}

function renderSlots(slots) {
  slotGrid.innerHTML = "";
  clientSlotSelect.innerHTML = `<option value="">Выберите время</option>`;

  if (!slots.length) {
    slotStatus.textContent = "На эту дату свободного времени нет";
    return;
  }

  slotStatus.textContent = "Выберите удобное время";

  slots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot.startAt;
    option.textContent = slot.displayLabel;
    clientSlotSelect.appendChild(option);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot-btn";
    button.textContent = slot.displayLabel;
    button.addEventListener("click", () => selectSlot(slot, button));
    slotGrid.appendChild(button);
  });
}

function selectSlot(slot, button) {
  selectedSlot = slot;
  clientSlotSelect.value = slot.startAt;
  slotStatus.textContent = `Выбрано: ${slot.displayLabel}`;

  document.querySelectorAll(".slot-btn").forEach((slotButton) => {
    slotButton.classList.remove("active");
  });

  button.classList.add("active");
}

function resetSlots(message) {
  selectedSlot = null;

  if (clientSlotSelect) {
    clientSlotSelect.innerHTML = `<option value="">${message}</option>`;
    clientSlotSelect.value = "";
  }

  if (slotStatus) {
    slotStatus.textContent = message;
  }

  if (slotGrid) {
    slotGrid.innerHTML = "";
  }
}

async function submitBooking(event) {
  event.preventDefault();

  if (!selectedPackage) return;

  const clientName = document.getElementById("clientName").value.trim();
  const clientPhone = document.getElementById("clientPhone").value.trim();
  const clientComment = document.getElementById("clientComment").value.trim();
  const selectedStartAt = selectedSlot?.startAt || clientSlotSelect.value;

  if (!selectedStartAt) {
    alert("Выберите свободное время");
    return;
  }

  try {
    const booking = await apiRequest("/bookings", {
      method: "POST",
      body: JSON.stringify({
        packageId: selectedPackage.id,
        clientName,
        clientPhone,
        startAt: selectedStartAt,
        comment: clientComment,
      }),
    });

    currentBookingId = booking.bookingId;
    showPaymentStep(booking);

    bookingForm.reset();
    bookingForm.classList.add("hidden");
    resetSlots("Сначала выберите дату");
    await loadAvailableSlots();
  } catch (error) {
    alert(error.message || "Не удалось создать бронь");
    console.error("Ошибка бронирования:", error);
  }
}

async function loadGallery() {
  const galleryGrid = document.getElementById("galleryGrid");

  if (!galleryGrid) return;

  try {
    const data = await apiRequest("/catalog/gallery");
    const gallery = data.gallery?.length ? data.gallery : localGallery;

    if (!gallery.length) {
      galleryGrid.innerHTML = "<p>Фото скоро появятся.</p>";
      return;
    }

    galleryGrid.innerHTML = "";

    gallery.forEach((item) => {
      const isVideo =
        item.media_type === "video" ||
        /\.(mp4|webm|mov)(\?.*)?$/i.test(item.image_url);

      if (isVideo) {
        const video = document.createElement("video");
        video.src = item.image_url;
        video.className = "gallery-photo gallery-video reveal";
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        galleryGrid.appendChild(video);
        return;
      }

      const img = document.createElement("img");
      img.src = item.image_url;
      img.alt = item.title || "Фото свидания";
      img.className = "gallery-photo reveal";
      galleryGrid.appendChild(img);
    });

    initScrollReveal(galleryGrid);
  } catch (error) {
    galleryGrid.innerHTML = "<p>Не удалось загрузить галерею.</p>";
    console.error("Ошибка галереи:", error);
  }
}

function getActiveCategory() {
  return (
    document.querySelector(".tab-btn.active")?.getAttribute("data-category") ||
    "all"
  );
}

function packageMatchesCategory(item, category) {
  if (item.category === category) {
    return true;
  }

  const title = String(item.title || "").toLowerCase();

  if (category === "proposal") {
    return title.includes("предложение");
  }

  if (category === "birthday") {
    return title.includes("день рождения");
  }

  return false;
}

function isCinemaPackage(item) {
  const title = String(item.title || "").toLowerCase();
  const categoryName = String(item.category_name || "").toLowerCase();

  return title.includes("киновечер") || categoryName.includes("киновечер");
}

function getPackageImage(item) {
  return item.image_url || defaultLocationImage;
}

function getPackageLocation(item) {
  const includes = Array.isArray(item.includes) ? item.includes : [];
  const locationLine = includes.find((include) => {
    const text = String(include).toLowerCase();

    return (
      text.includes("этаж") ||
      text.includes("центр") ||
      text.includes("левый берег") ||
      text.includes("панорам")
    );
  });

  return locationLine || siteSettings?.address || defaultLocationText;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    renderPackages(button.getAttribute("data-category"));
  });
});

const burgerBtn = document.getElementById("burgerBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (burgerBtn && mobileMenu) {
  burgerBtn.addEventListener("click", () => {
    mobileMenu.classList.toggle("active");
  });
}

document.querySelectorAll(".mobile-menu a").forEach((link) => {
  link.addEventListener("click", () => {
    if (mobileMenu) {
      mobileMenu.classList.remove("active");
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePackageModal();
  }
});

if (clientDateInput) {
  clientDateInput.addEventListener("change", loadAvailableSlots);
}

if (bookingForm) {
  bookingForm.addEventListener("submit", submitBooking);
}

function initScrollReveal(root = document) {
  const items = root.querySelectorAll(".reveal:not(.is-visible)");

  if (!items.length) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );

  items.forEach((el, index) => {
    el.style.transitionDelay = `${Math.min(index % 4, 3) * 90}ms`;
    observer.observe(el);
  });
}

const siteHeader = document.querySelector(".header");

if (siteHeader) {
  const updateHeaderScrolled = () => {
    siteHeader.classList.toggle("scrolled", window.scrollY > 40);
  };

  window.addEventListener("scroll", updateHeaderScrolled, { passive: true });
  updateHeaderScrolled();
}

const THEME_STORAGE_KEY = "svidanie-theme";

function getStoredTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const isLight = theme === "light";
  const icon = isLight ? "☀️" : "🌙";
  const label = isLight ? "Светлая тема" : "Тёмная тема";
  const nextLabel = isLight ? "Включить тёмную тему" : "Включить светлую тему";

  const iconEl = document.getElementById("themeToggleIcon");
  const iconElMobile = document.getElementById("themeToggleIconMobile");
  const labelElMobile = document.getElementById("themeToggleLabelMobile");
  const btn = document.getElementById("themeToggle");
  const btnMobile = document.getElementById("themeToggleMobile");

  if (iconEl) iconEl.textContent = icon;
  if (iconElMobile) iconElMobile.textContent = icon;
  if (labelElMobile) labelElMobile.textContent = label;
  if (btn) btn.setAttribute("aria-label", nextLabel);
  if (btnMobile) btnMobile.setAttribute("aria-label", nextLabel);
}

function toggleTheme() {
  const next = getStoredTheme() === "light" ? "dark" : "light";
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
}

applyTheme(getStoredTheme());
document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
document.getElementById("themeToggleMobile")?.addEventListener("click", toggleTheme);

async function initSite() {
  initScrollReveal();
  await Promise.allSettled([loadSiteSettings(), loadPackages(), loadGallery()]);
}

initSite();
