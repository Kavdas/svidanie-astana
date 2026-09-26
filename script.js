let packages = [];
let siteSettings = null;
let selectedPackage = null;
let selectedSlot = null;
// When the booking form was last shown — sent with the submission as a
// basic anti-spam signal (see backend/src/bookings/bookings.service.ts).
let formRenderedAt = null;

// Short, human-friendly code the client is asked to write in the Kaspi
// transfer comment, so a manager can find the matching payment by
// searching Kaspi history instead of guessing from amount/time alone.
function getBookingReferenceCode(bookingId) {
  return (bookingId || "").slice(0, 8).toUpperCase();
}

// Photos bundled with the site. The originals live in assets/gallery/source/
// and are never deployed; what ships are the WebP renditions (plus one JPEG
// per photo for browsers without WebP) built by scripts/optimize-images.py.
// The numbers below are the widths that actually exist on disk.
const LOCAL_PHOTO_WIDTHS = {
  "saxophone-date-wide": [480, 800, 1280, 1600],
  "saxophone-date-portrait": [480, 800, 1086],
  "cinema-decor-wide": [480, 800, 1280, 1600],
  "romantic-table-wide": [480, 800, 1280, 1600],
  "dinner-closeup": [480, 800, 1280, 1600],
  "astana-baiterek-view": [480, 800, 1086],
  "astana-mosque-view": [480, 800, 1086],
  "astana-panorama": [480, 800, 1086],
  "daylight-table-view": [480, 800, 1086],
  "dome-evening-wide": [480, 800, 1280, 1600],
  "astana-juregi-night": [480, 800, 1280, 1422],
};

// Widths the gallery grid actually renders at: one column under 680px,
// two up to 980px, three above. Keeps phones on the 480w file.
const GALLERY_SIZES =
  "(max-width: 680px) calc(100vw - 40px), (max-width: 980px) 46vw, 31vw";

function localPhoto(name) {
  const widths = LOCAL_PHOTO_WIDTHS[name];

  if (!widths) return null;

  const fallbackWidth = Math.min(1280, widths[widths.length - 1]);

  return {
    src: `assets/gallery/${name}-${fallbackWidth}.jpg`,
    srcset: widths
      .map((width) => `assets/gallery/${name}-${width}.webp ${width}w`)
      .join(", "),
  };
}

const localGallery = [
  { title: "Свидание с живой музыкой", photo: "saxophone-date-wide" },
  { title: "Живая музыка в куполе", photo: "saxophone-date-portrait" },
  { title: "Декор с экраном", photo: "cinema-decor-wide" },
  { title: "Романтический ужин в куполе", photo: "romantic-table-wide" },
  { title: "Сервировка со свечами", photo: "dinner-closeup" },
  { title: "Вид на город", photo: "astana-baiterek-view" },
  { title: "Вид на мечеть", photo: "astana-mosque-view" },
  { title: "Панорама Астаны", photo: "astana-panorama" },
  { title: "Дневная сервировка", photo: "daylight-table-view" },
  { title: "Вечерний купол", photo: "dome-evening-wide" },
  { title: "Astana Juregi", photo: "astana-juregi-night" },
];

const HERO_PHOTO = "saxophone-date-wide";
const DEFAULT_LOCATION_PHOTO = "romantic-table-wide";
// Cards and the modal render well under 800px wide, so the bundled fallback
// is served at that width rather than at full size.
const defaultLocationImage = `assets/gallery/${DEFAULT_LOCATION_PHOTO}-800.webp`;
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
const paymentReferenceCode = document.getElementById("paymentReferenceCode");
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

    // The hero photo is an <img> so it can be preloaded at a phone-sized
    // width; an admin-set image replaces it and drops the bundled srcset,
    // since we have no renditions of an uploaded file.
    const heroPhoto = document.getElementById("heroPhoto");

    if (heroPhoto && siteSettings.hero_image_url) {
      heroPhoto.removeAttribute("srcset");
      heroPhoto.removeAttribute("sizes");
      heroPhoto.src = siteSettings.hero_image_url;
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
    renderCatalogUnavailable();
  }
}

// The catalogue lives in the database, so there is nothing sensible to show
// from the bundle when the API is unreachable. Rather than leaving a bare
// error line, hand the visitor the channel that still works.
function renderCatalogUnavailable() {
  packagesGrid.innerHTML = `
    <div class="catalog-fallback">
      <h3>Каталог временно недоступен</h3>
      <p>
        Мы уже разбираемся. Напишите менеджеру — он расскажет про пакеты,
        цены и свободные даты и оформит бронь за пару минут.
      </p>
      <button class="main-btn" type="button" onclick="openManagerWhatsApp()">
        <span class="whatsapp-icon"></span>
        Написать менеджеру
      </button>
    </div>
  `;
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

    // Dark enough at the bottom for the text to stay readable, light enough
    // at the top that the photo is actually visible — the old flat 58%–92%
    // wash hid what the card is selling.
    card.style.backgroundImage = `
      linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.18) 0%,
        rgba(0, 0, 0, 0.55) 45%,
        rgba(0, 0, 0, 0.93) 100%
      ),
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
    formRenderedAt = Date.now();
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

    if (paymentReferenceCode) {
      const code = getBookingReferenceCode(booking.bookingId);
      paymentReferenceCode.innerHTML = `Укажите в комментарии к переводу код: <strong>${code}</strong> — так менеджер быстрее найдёт ваш платёж.`;
      paymentReferenceCode.classList.toggle("hidden", !code);
    }

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
    paymentReferenceCode?.classList.add("hidden");
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

  trackGoal("whatsapp_click");
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

  trackGoal("whatsapp_package_click");
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
    resetSlots(
      "Не удалось загрузить свободное время — уточните его у менеджера в WhatsApp"
    );
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
  const clientWebsite = document.getElementById("clientWebsite")?.value.trim();
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
        website: clientWebsite || undefined,
        formRenderedAt: formRenderedAt ? String(formRenderedAt) : undefined,
      }),
    });

    currentBookingId = booking.bookingId;
    trackGoal("booking_submitted");
    showPaymentStep(booking);

    bookingForm.reset();
    bookingForm.classList.add("hidden");
    resetSlots("Сначала выберите дату");
    await loadAvailableSlots();
  } catch (error) {
    console.error("Ошибка бронирования:", error);
    showBookingFallback(error, {
      clientName,
      clientPhone,
      clientComment,
      startAt: selectedStartAt,
    });
  }
}

// A booking that fails on the server is a lost client unless we hand the
// filled-in details somewhere they still get read. Rather than an alert() that
// drops everything, offer the same request as a pre-written WhatsApp message.
function showBookingFallback(error, details) {
  const existing = document.getElementById("bookingFallback");

  if (existing) existing.remove();

  const message = [
    "Здравствуйте! Хочу забронировать, но на сайте не удалось отправить заявку.",
    "",
    `Пакет: ${selectedPackage?.title || "не выбран"}`,
    `Дата и время: ${formatSlotLabel(details.startAt)}`,
    `Имя: ${details.clientName}`,
    `Телефон: ${details.clientPhone}`,
    details.clientComment ? `Комментарий: ${details.clientComment}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const box = document.createElement("div");
  box.className = "booking-fallback";
  box.id = "bookingFallback";
  box.innerHTML = `
    <p class="booking-fallback-title">Не удалось отправить заявку</p>
    <p>${escapeHtml(error.message || "Сервис бронирования сейчас недоступен.")}</p>
    <p>Отправьте её менеджеру в WhatsApp — данные уже подставлены.</p>
    <button class="whatsapp-submit-btn" type="button">
      <span class="whatsapp-icon"></span>
      Отправить в WhatsApp
    </button>
  `;

  box.querySelector("button").addEventListener("click", () => {
    trackGoal("booking_fallback_whatsapp");
    window.open(createWhatsAppUrl(message), "_blank");
  });

  bookingForm.appendChild(box);
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function formatSlotLabel(startAt) {
  if (!startAt) return "не выбрано";

  const date = new Date(startAt);

  if (Number.isNaN(date.getTime())) return String(startAt);

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The items currently rendered in the grid, in display order — the lightbox
// pages through this rather than re-reading the DOM.
let galleryItems = [];

async function loadGallery() {
  const galleryGrid = document.getElementById("galleryGrid");

  if (!galleryGrid) return;

  // The bundled photos are the fallback for both an empty catalogue *and* an
  // unreachable API — previously only the first case was handled, so a backend
  // outage replaced eleven ready photos with an error line.
  let gallery = localGallery;

  try {
    const data = await apiRequest("/catalog/gallery");

    if (data.gallery?.length) {
      gallery = data.gallery;
    }
  } catch (error) {
    console.error("Ошибка галереи, показываем локальные фото:", error);
  }

  try {
    galleryGrid.innerHTML = "";
    galleryItems = gallery;

    gallery.forEach((item, index) => {
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
      const bundled = item.photo ? localPhoto(item.photo) : null;

      // loading/decoding must be set BEFORE src: once a src lands on an image
      // that is not already marked lazy, the fetch starts immediately and a
      // later loading="lazy" does not call it back.
      img.loading = "lazy";
      img.decoding = "async";

      if (bundled) {
        img.sizes = GALLERY_SIZES;
        img.srcset = bundled.srcset;
        img.src = bundled.src;
      } else {
        img.src = item.image_url;
      }

      img.alt = item.title || "Фото свидания";
      img.className = "gallery-photo reveal";
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.addEventListener("click", () => openLightbox(item));
      img.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLightbox(item);
        }
      });
      galleryGrid.appendChild(img);
    });

    initScrollReveal(galleryGrid);
  } catch (error) {
    galleryGrid.innerHTML = "<p>Не удалось показать галерею.</p>";
    console.error("Ошибка отрисовки галереи:", error);
  }
}

/* =========================================================
   GALLERY LIGHTBOX
   The grid renders photos at card size; this is where a visitor actually
   looks at them. Videos are skipped — they already play in place.
   ========================================================= */

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxCaption = document.getElementById("lightboxCaption");
const lightboxCounter = document.getElementById("lightboxCounter");
let lightboxIndex = 0;
let lightboxReturnFocus = null;

function lightboxPhotos() {
  return galleryItems.filter(
    (item) =>
      item.media_type !== "video" &&
      !/\.(mp4|webm|mov)(\?.*)?$/i.test(item.image_url || "")
  );
}

// The grid is capped at ~400px wide, so it loads the 800w rendition. Full
// screen deserves the largest one we built.
function fullSizeSource(item) {
  const bundled = item.photo ? localPhoto(item.photo) : null;

  if (!bundled) return { src: item.image_url, srcset: "" };

  return {
    src: bundled.src,
    srcset: bundled.srcset,
    // The figure is capped at 1100px and otherwise fills the screen, so a
    // phone still gets a phone-sized file here rather than the 1600w one.
    sizes: "(max-width: 1100px) 100vw, 1100px",
  };
}

function openLightbox(item) {
  if (!lightbox) return;

  const photos = lightboxPhotos();
  const index = photos.indexOf(item);

  if (!photos.length || index === -1) return;

  lightboxReturnFocus = document.activeElement;
  lightboxIndex = index;

  renderLightbox();
  lightbox.classList.add("active");
  document.body.classList.add("modal-open");
  document.getElementById("lightboxClose")?.focus();
}

function renderLightbox() {
  const photos = lightboxPhotos();
  const item = photos[lightboxIndex];

  if (!item) return;

  const source = fullSizeSource(item);

  lightboxImage.removeAttribute("srcset");
  lightboxImage.removeAttribute("sizes");
  lightboxImage.src = source.src;

  if (source.srcset) {
    lightboxImage.srcset = source.srcset;
    lightboxImage.sizes = source.sizes;
  }

  lightboxImage.alt = item.title || "Фото свидания";
  lightboxCaption.textContent = item.title || "";
  lightboxCounter.textContent = `${lightboxIndex + 1} / ${photos.length}`;

  const single = photos.length < 2;
  document.getElementById("lightboxPrev").hidden = single;
  document.getElementById("lightboxNext").hidden = single;
}

function stepLightbox(delta) {
  const photos = lightboxPhotos();

  if (photos.length < 2) return;

  lightboxIndex = (lightboxIndex + delta + photos.length) % photos.length;
  renderLightbox();
}

function closeLightbox() {
  if (!lightbox) return;

  lightbox.classList.remove("active");

  // The booking sheet may still be open behind it, so only release the scroll
  // lock when nothing else needs it.
  if (!packageModal?.classList.contains("active")) {
    document.body.classList.remove("modal-open");
  }

  lightboxReturnFocus?.focus?.();
  lightboxReturnFocus = null;
}

if (lightbox) {
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightboxBackdrop").addEventListener("click", closeLightbox);
  document
    .getElementById("lightboxPrev")
    .addEventListener("click", () => stepLightbox(-1));
  document
    .getElementById("lightboxNext")
    .addEventListener("click", () => stepLightbox(1));

  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("active")) return;

    if (event.key === "Escape") {
      event.stopImmediatePropagation();
      closeLightbox();
    }
    if (event.key === "ArrowLeft") stepLightbox(-1);
    if (event.key === "ArrowRight") stepLightbox(1);
  });

  // Swipe, because on a phone that is how people page through photos.
  let touchStartX = null;

  lightbox.addEventListener(
    "touchstart",
    (event) => {
      touchStartX = event.changedTouches[0].clientX;
    },
    { passive: true }
  );

  lightbox.addEventListener(
    "touchend",
    (event) => {
      if (touchStartX === null) return;

      const delta = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;

      if (Math.abs(delta) < 45) return;

      stepLightbox(delta < 0 ? 1 : -1);
    },
    { passive: true }
  );
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

function setMobileMenu(open) {
  if (!mobileMenu || !burgerBtn) return;

  mobileMenu.classList.toggle("active", open);
  burgerBtn.classList.toggle("is-open", open);
  burgerBtn.setAttribute("aria-expanded", String(open));
  burgerBtn.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  // Without this the page keeps scrolling behind the open menu, which on a
  // phone looks like the menu itself is broken.
  document.body.classList.toggle("menu-open", open);
}

if (burgerBtn && mobileMenu) {
  burgerBtn.setAttribute("aria-controls", "mobileMenu");
  setMobileMenu(false);

  burgerBtn.addEventListener("click", () => {
    setMobileMenu(!mobileMenu.classList.contains("active"));
  });
}

document.querySelectorAll(".mobile-menu a").forEach((link) => {
  link.addEventListener("click", () => setMobileMenu(false));
});

// Tapping the page behind the menu should dismiss it, as any native sheet does.
document.addEventListener("click", (event) => {
  if (!mobileMenu?.classList.contains("active")) return;
  if (mobileMenu.contains(event.target) || burgerBtn?.contains(event.target)) {
    return;
  }

  setMobileMenu(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (mobileMenu?.classList.contains("active")) {
    setMobileMenu(false);
    return;
  }

  closePackageModal();
});

if (clientDateInput) {
  clientDateInput.addEventListener("change", loadAvailableSlots);

  // Nothing can be booked in the past, and a date picker that allows it just
  // sends the visitor to an empty slot list.
  clientDateInput.min = new Date().toLocaleDateString("sv-SE");
}

// Kazakhstan numbers as +7 (7XX) XXX-XX-XX. Managers get these by WhatsApp and
// by Telegram, and a consistent shape is what makes them dialable.
const clientPhoneInput = document.getElementById("clientPhone");

function formatKzPhone(raw) {
  let digits = String(raw).replace(/\D/g, "");

  // Strip the country/trunk prefix so what is left is the 10-digit national
  // number. Length matters: a local 771-XXX-XX-XX starts with the same two
  // digits as the +7 7... country-code form, and only the total length tells
  // them apart.
  if (digits.startsWith("8")) {
    digits = digits.slice(1);
  } else if (digits.length === 11 && digits.startsWith("7")) {
    digits = digits.slice(1);
  }

  const national = digits.slice(0, 10);

  if (!national) return "";

  const code = national.slice(0, 3);
  const first = national.slice(3, 6);
  const second = national.slice(6, 8);
  const third = national.slice(8, 10);

  let out = `+7 (${code}`;

  if (code.length === 3) out += ")";
  if (first) out += ` ${first}`;
  if (second) out += `-${second}`;
  if (third) out += `-${third}`;

  return out;
}


if (clientPhoneInput) {
  clientPhoneInput.addEventListener("input", (event) => {
    const input = event.target;
    // Only reposition the caret when it was already at the end, so editing
    // mid-number does not yank it away.
    const atEnd = input.selectionStart === input.value.length;
    const formatted = formatKzPhone(input.value);

    if (formatted === input.value) return;

    input.value = formatted;

    if (atEnd) {
      input.setSelectionRange(formatted.length, formatted.length);
    }
  });
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
    // A block taller than the phone viewport never reaches 15% visibility, so
    // it would stay at opacity 0 forever. Trigger as soon as any of it shows.
    { threshold: 0.01, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el, index) => {
    el.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    observer.observe(el);
  });

  // Last resort: content hidden by an animation is worse than content with no
  // animation, so nothing stays invisible for more than a few seconds however
  // the observer behaves.
  setTimeout(() => {
    items.forEach((el) => el.classList.add("is-visible"));
  }, 4000);
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

/* =========================================================
   ANALYTICS
   Loads nothing unless a counter id is set in config.js, and every call goes
   through trackGoal() so the rest of the code never touches the vendor API.
   ========================================================= */

function initMetrika() {
  const id = window.SVIDANIE_METRIKA_ID;

  if (!id) return;

  window.ym =
    window.ym ||
    function () {
      (window.ym.a = window.ym.a || []).push(arguments);
    };
  window.ym.l = Number(new Date());

  const script = document.createElement("script");
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  script.async = true;
  document.head.appendChild(script);

  window.ym(id, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  });
}

// Named conversion points. Without these the analytics only shows pageviews,
// which says nothing about where a booking falls apart.
function trackGoal(goal) {
  const id = window.SVIDANIE_METRIKA_ID;

  if (!id || typeof window.ym !== "function") return;

  window.ym(id, "reachGoal", goal);
}

async function initSite() {
  initMetrika();
  initScrollReveal();
  await Promise.allSettled([loadSiteSettings(), loadPackages(), loadGallery()]);
}

initSite();
