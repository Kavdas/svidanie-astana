let currentUser = null;
let currentUserRole = null;
let editingPackageId = null;

// Same derivation as script.js's getBookingReferenceCode — the short code
// the client was asked to write in their Kaspi transfer comment.
function getBookingReferenceCode(bookingId) {
  return (bookingId || "").slice(0, 8).toUpperCase();
}

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const galleryForm = document.getElementById("galleryForm");
const adminGalleryList = document.getElementById("adminGalleryList");

const settingsForm = document.getElementById("settingsForm");
const adminPackagesList = document.getElementById("adminPackagesList");
const packageForm = document.getElementById("packageForm");
const newPackageBtn = document.getElementById("newPackageBtn");
const cancelPackageBtn = document.getElementById("cancelPackageBtn");

const bookingsList = document.getElementById("bookingsList");
const refreshBookingsBtn = document.getElementById("refreshBookingsBtn");

const expenseForm = document.getElementById("expenseForm");
const expenseBookingSelect = document.getElementById("expenseBookingSelect");
const myExpensesList = document.getElementById("myExpensesList");
const allExpensesList = document.getElementById("allExpensesList");
const exportExpensesBtn = document.getElementById("exportExpensesBtn");

const salesReportContent = document.getElementById("salesReportContent");
const exportSalesBtn = document.getElementById("exportSalesBtn");

const staffForm = document.getElementById("staffForm");
const staffList = document.getElementById("staffList");

const managerBookingForm = document.getElementById("managerBookingForm");
const managerPackageSelect = document.getElementById("managerPackageSelect");
const managerBookingDate = document.getElementById("managerBookingDate");
const managerSlotStatus = document.getElementById("managerSlotStatus");
const managerSlotGrid = document.getElementById("managerSlotGrid");
const managerClientFields = document.getElementById("managerClientFields");

let managerPackages = [];
let managerSelectedSlot = null;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${window.API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
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

async function adminApiRequest(path, options = {}) {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Сессия администратора не найдена");
  }

  const response = await fetch(`${window.API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    },
    ...options
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = Array.isArray(responseData.message)
      ? responseData.message.join("\n")
      : responseData.message || "Ошибка запроса";
    throw new Error(message);
  }

  return responseData;
}

async function adminApiDownload(path, filename) {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Сессия администратора не найдена");
  }

  const response = await fetch(`${window.API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Не удалось скачать файл");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("Ошибка входа: " + error.message);
    return;
  }

  currentUser = data.user;
  showDashboard();
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    currentUser = data.session.user;
    showDashboard();
  }
}

async function showDashboard() {
  loginSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");

  currentUserRole = await loadCurrentUserRole();
  applyRoleRestrictions(currentUserRole);

  if (currentUserRole === "admin") {
    await loadAdminPackages();
    await loadGalleryAdmin();
    await loadSettingsAdmin();
    await loadStaff();
    await loadDashboard();
  }

  if (currentUserRole === "admin" || currentUserRole === "manager") {
    await loadManagerBookingPackages();
    await loadSalesReport();
  }

  if (currentUserRole === "admin" || currentUserRole === "organizer") {
    await loadExpenseBookingOptions();
    await loadMyExpenses();
  }

  if (currentUserRole === "admin") {
    await loadAllExpenses();
  }

  await loadBookings();
  await loadSchedule();
}

async function loadCurrentUserRole() {
  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("role")
    .eq("user_id", currentUser.id)
    .single();

  if (error || !data) {
    alert("У этого аккаунта нет доступа к админ-панели. Обратитесь к администратору.");
    await supabaseClient.auth.signOut();
    location.reload();
    return null;
  }

  return data.role;
}

function applyRoleRestrictions(role) {
  const isAdmin = role === "admin";
  const isOrganizer = role === "organizer";
  const canSell = isAdmin || role === "manager";

  document.querySelectorAll(".admin-only").forEach((element) => {
    element.classList.toggle("role-visible", isAdmin);
  });

  document.querySelectorAll(".seller-only").forEach((element) => {
    element.classList.toggle("role-visible", canSell);
  });

  document.querySelectorAll(".organizer-only").forEach((element) => {
    element.classList.toggle("role-visible", isAdmin || isOrganizer);
  });

  if (!isAdmin) {
    document.querySelectorAll(".admin-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    document.querySelectorAll(".admin-panel").forEach((panel) => {
      panel.classList.add("hidden");
    });

    const defaultPanel = isOrganizer ? "schedulePanel" : "bookingsPanel";
    document.querySelector(`[data-panel="${defaultPanel}"]`)?.classList.add("active");
    document.getElementById(defaultPanel)?.classList.remove("hidden");
  }
}

async function loadAdminPackages() {
  const { data, error } = await supabaseClient
    .from("packages")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    adminPackagesList.innerHTML = `<p>Ошибка загрузки пакетов: ${error.message}</p>`;
    return;
  }

  adminPackagesList.innerHTML = "";

  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "admin-package-card";

    card.innerHTML = `
      ${item.image_url ? `<img src="${item.image_url}" alt="${item.title}" />` : ""}
      <h3>${item.title}</h3>
      <p><strong>Цена:</strong> ${item.price}</p>
      <p><strong>Длительность:</strong> ${item.duration}</p>
      <p><strong>Категория:</strong> ${item.category_name}</p>
      <p><strong>Порядок:</strong> ${item.sort_order}</p>
      <p><strong>Статус:</strong> ${item.is_active ? "Активен" : "Скрыт"}</p>

      <div class="card-actions">
        <button onclick="editPackage('${item.id}')">Редактировать</button>
        <button onclick="togglePackageStatus('${item.id}', ${item.is_active})">
          ${item.is_active ? "Скрыть" : "Показать"}
        </button>
      </div>
    `;

    adminPackagesList.appendChild(card);
  });
}

newPackageBtn.addEventListener("click", () => {
  editingPackageId = null;
  packageForm.reset();

  document.getElementById("packageId").value = "";
  document.getElementById("formTitle").textContent = "Новый пакет";
  document.getElementById("packageIsActive").checked = true;

  packageForm.classList.remove("hidden");
});

cancelPackageBtn.addEventListener("click", () => {
  packageForm.classList.add("hidden");
  packageForm.reset();
  editingPackageId = null;
});

async function editPackage(id) {
  const { data, error } = await supabaseClient
    .from("packages")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    alert("Ошибка загрузки пакета: " + error.message);
    return;
  }

  editingPackageId = id;

  document.getElementById("formTitle").textContent = "Редактировать пакет";
  document.getElementById("packageId").value = data.id;
  document.getElementById("packageTitle").value = data.title || "";
  document.getElementById("packageCategory").value = data.category || "date";
  document.getElementById("packageCategoryName").value = data.category_name || "";
  document.getElementById("packagePrice").value = data.price || "";
  document.getElementById("packagePriceAmount").value = data.price_amount || "";
  document.getElementById("packageDurationMinutes").value = data.duration_minutes || 60;
  document.getElementById("packagePrepMinutes").value = data.prep_minutes || 30;
  document.getElementById("packageIncludes").value = (data.includes || []).join("\n");
  document.getElementById("packageNote").value = data.note || "";
  document.getElementById("packageSortOrder").value = data.sort_order || 0;
  document.getElementById("packageIsActive").checked = data.is_active;

  packageForm.classList.remove("hidden");
  window.scrollTo({ top: packageForm.offsetTop - 40, behavior: "smooth" });
}

packageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const imageFile = document.getElementById("packageImage").files[0];

  let imageUrl = null;

  if (imageFile) {
    imageUrl = await uploadImage(imageFile);
  }

  const packageData = {
    title: document.getElementById("packageTitle").value.trim(),
    category: document.getElementById("packageCategory").value,
    category_name: document.getElementById("packageCategoryName").value.trim(),
    price: document.getElementById("packagePrice").value.trim(),
    price_amount: Number(document.getElementById("packagePriceAmount").value || 0) || null,
    duration_minutes: Number(document.getElementById("packageDurationMinutes").value || 60),
    prep_minutes: Number(document.getElementById("packagePrepMinutes").value || 30),
    includes: document
      .getElementById("packageIncludes")
      .value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    note: document.getElementById("packageNote").value.trim(),
    sort_order: Number(document.getElementById("packageSortOrder").value || 0),
    is_active: document.getElementById("packageIsActive").checked,
    updated_at: new Date().toISOString()
  };

  if (imageUrl) {
    packageData.image_url = imageUrl;
  }

  let result;

  if (editingPackageId) {
    result = await supabaseClient
      .from("packages")
      .update(packageData)
      .eq("id", editingPackageId);
  } else {
    result = await supabaseClient
      .from("packages")
      .insert(packageData);
  }

  if (result.error) {
    alert("Ошибка сохранения: " + result.error.message);
    return;
  }

  alert("Сохранено");

  packageForm.classList.add("hidden");
  packageForm.reset();
  editingPackageId = null;

  await loadAdminPackages();
});

async function uploadImage(file) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `packages/${fileName}`;

  const { error } = await supabaseClient.storage
    .from("site-images")
    .upload(filePath, file);

  if (error) {
    alert("Ошибка загрузки фото: " + error.message);
    return null;
  }

  const { data } = supabaseClient.storage
    .from("site-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function togglePackageStatus(id, currentStatus) {
  const { error } = await supabaseClient
    .from("packages")
    .update({
      is_active: !currentStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    alert("Ошибка изменения статуса: " + error.message);
    return;
  }

  await loadAdminPackages();
}

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((item) => {
      item.classList.remove("active");
    });

    tab.classList.add("active");

    document.querySelectorAll(".admin-panel").forEach((panel) => {
      panel.classList.add("hidden");
    });

    document.getElementById(tab.dataset.panel).classList.remove("hidden");
  });
});

async function loadBookings() {
  if (!bookingsList) return;

  bookingsList.innerHTML = "<p>Загружаем заявки...</p>";

  let data;

  try {
    data = await adminApiRequest("/admin/bookings");
  } catch (error) {
    bookingsList.innerHTML = `<p>Ошибка загрузки заявок: ${error.message}</p>`;
    return;
  }

  bookingsList.innerHTML = "";

  if (!data.bookings.length) {
    bookingsList.innerHTML = "<p>Заявок пока нет.</p>";
    return;
  }

  const isOrganizer = currentUserRole === "organizer";

  data.bookings.forEach((item) => {
    const card = document.createElement("div");
    card.className = "booking-card";

    const salesBlock = isOrganizer
      ? ""
      : `
      <p><strong>Цена:</strong> ${item.packagePrice || "Не указана"}</p>
      <p><strong>Предоплата:</strong> ${item.depositAmount ? `${item.depositAmount} тг — ${formatPaymentStatus(item.paymentStatus)}` : "не рассчитана"}</p>
      ${item.depositAmount ? `<p><strong>Код в комментарии к переводу:</strong> ${getBookingReferenceCode(item.bookingId)}</p>` : ""}
      ${item.createdByEmail ? `<p><strong>Оформил(а):</strong> ${item.createdByEmail}</p>` : ""}
      <label>Статус</label>
      <select class="booking-status-select" data-booking-id="${item.bookingId}">
        ${renderStatusOptions(item.status)}
      </select>
      ${
        item.depositAmount
          ? `<div class="card-actions">
              <button type="button" class="payment-confirm-btn" data-booking-id="${item.bookingId}" ${item.paymentStatus === "paid" ? "disabled" : ""}>
                Подтвердить оплату
              </button>
              <button type="button" class="payment-reset-btn" data-booking-id="${item.bookingId}" ${item.paymentStatus ? "" : "disabled"}>
                Сбросить оплату
              </button>
            </div>`
          : ""
      }
      <div class="card-actions">
        <button type="button" class="reschedule-toggle-btn" data-booking-id="${item.bookingId}">
          Перенести
        </button>
      </div>
      <div class="reschedule-panel hidden" id="reschedule-${item.bookingId}" data-booking-id="${item.bookingId}" data-package-id="${item.packageId}">
        <input type="date" class="reschedule-date-input" />
        <p class="slot-status reschedule-status">Выберите дату</p>
        <div class="slot-grid reschedule-slot-grid"></div>
      </div>
    `;

    card.innerHTML = `
      <h3>${item.clientName}</h3>
      <p><strong>Телефон:</strong> ${item.clientPhone}</p>
      <p><strong>Пакет:</strong> ${item.packageTitle || "Не указан"}</p>
      <p><strong>Дата и время:</strong> ${formatDateTime(item.startAt)}</p>
      <p><strong>Окончание:</strong> ${formatDateTime(item.endAt)}</p>
      <p><strong>Комментарий:</strong> ${item.comment || "Нет"}</p>
      ${salesBlock}
    `;

    bookingsList.appendChild(card);
  });

  document.querySelectorAll(".booking-status-select").forEach((select) => {
    select.addEventListener("change", async () => {
      await updateBookingStatus(select.dataset.bookingId, select.value);
    });
  });

  document.querySelectorAll(".payment-confirm-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      await updatePaymentStatus(button.dataset.bookingId, "paid");
    });
  });

  document.querySelectorAll(".payment-reset-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      await updatePaymentStatus(button.dataset.bookingId, null);
    });
  });

  document.querySelectorAll(".reschedule-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = document.getElementById(`reschedule-${button.dataset.bookingId}`);
      panel?.classList.toggle("hidden");
    });
  });

  document.querySelectorAll(".reschedule-panel .reschedule-date-input").forEach((input) => {
    input.addEventListener("change", async () => {
      const panel = input.closest(".reschedule-panel");
      await loadRescheduleSlots(panel);
    });
  });
}

async function loadRescheduleSlots(panel) {
  const statusEl = panel.querySelector(".reschedule-status");
  const gridEl = panel.querySelector(".reschedule-slot-grid");
  const dateInput = panel.querySelector(".reschedule-date-input");
  const packageId = panel.dataset.packageId;
  const bookingId = panel.dataset.bookingId;

  if (!dateInput.value) {
    statusEl.textContent = "Выберите дату";
    gridEl.innerHTML = "";
    return;
  }

  statusEl.textContent = "Загружаем свободное время...";
  gridEl.innerHTML = "";

  try {
    const data = await apiRequest("/bookings/available-slots", {
      method: "POST",
      body: JSON.stringify({ packageId, date: dateInput.value })
    });

    if (!data.slots.length) {
      statusEl.textContent = "На эту дату свободного времени нет";
      return;
    }

    statusEl.textContent = "Выберите новое время";

    data.slots.forEach((slot) => {
      const slotBtn = document.createElement("button");
      slotBtn.type = "button";
      slotBtn.className = "slot-btn";
      slotBtn.textContent = slot.displayLabel;
      slotBtn.addEventListener("click", async () => {
        try {
          await adminApiRequest(`/admin/bookings/${bookingId}/reschedule`, {
            method: "PATCH",
            body: JSON.stringify({ startAt: slot.startAt })
          });
          alert("Бронь перенесена");
          await loadBookings();
          await loadSchedule();
        } catch (error) {
          alert("Не удалось перенести бронь: " + error.message);
        }
      });
      gridEl.appendChild(slotBtn);
    });
  } catch (error) {
    statusEl.textContent = "Ошибка загрузки свободного времени: " + error.message;
  }
}

function formatPaymentStatus(paymentStatus) {
  if (paymentStatus === "paid") return "оплачено ✅";
  if (paymentStatus === "on_review") return "клиент отметил оплату, ждёт подтверждения";
  return "не оплачено";
}

function renderStatusOptions(currentStatus) {
  const statuses = [
    "Новая",
    "Связались",
    "Ожидает оплату",
    "Оплачено",
    "Отменено"
  ];

  return statuses
    .map((status) => {
      const selected = status === currentStatus ? "selected" : "";
      return `<option value="${status}" ${selected}>${status}</option>`;
    })
    .join("");
}

async function updateBookingStatus(bookingId, status) {
  try {
    await adminApiRequest(`/admin/bookings/${bookingId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await loadBookings();
  } catch (error) {
    alert("Ошибка изменения статуса: " + error.message);
  }
}

async function updatePaymentStatus(bookingId, paymentStatus) {
  try {
    await adminApiRequest(`/admin/bookings/${bookingId}/payment-status`, {
      method: "PATCH",
      body: JSON.stringify({ paymentStatus })
    });
    await loadBookings();
  } catch (error) {
    alert("Ошибка изменения статуса оплаты: " + error.message);
  }
}

function formatDateTime(value) {
  if (!value) return "Не указано";

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

refreshBookingsBtn?.addEventListener("click", loadBookings);

async function loadGalleryAdmin() {
  if (!adminGalleryList) return;

  const { data, error } = await supabaseClient
    .from("gallery")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    adminGalleryList.innerHTML = `<p>Ошибка загрузки галереи: ${error.message}</p>`;
    return;
  }

  adminGalleryList.innerHTML = "";

  if (!data.length) {
    adminGalleryList.innerHTML = "<p>Фото пока не добавлены.</p>";
    return;
  }

  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "gallery-admin-card";

    card.innerHTML = `
      <img src="${item.image_url}" alt="${item.title || "Фото"}" />
      <h3>${item.title || "Без названия"}</h3>
      <p><strong>Порядок:</strong> ${item.sort_order}</p>
      <p><strong>Статус:</strong> ${item.is_active ? "Активно" : "Скрыто"}</p>

      <div class="card-actions">
        <button onclick="toggleGalleryStatus('${item.id}', ${item.is_active})">
          ${item.is_active ? "Скрыть" : "Показать"}
        </button>

        <button class="danger-btn" onclick="deleteGalleryItem('${item.id}')">
          Удалить
        </button>
      </div>
    `;

    adminGalleryList.appendChild(card);
  });
}

galleryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const imageFile = document.getElementById("galleryImage").files[0];

  if (!imageFile) {
    alert("Выберите фото");
    return;
  }

  const imageUrl = await uploadImageToFolder(imageFile, "gallery");

  if (!imageUrl) return;

  const galleryData = {
    title: document.getElementById("galleryTitle").value.trim(),
    image_url: imageUrl,
    sort_order: Number(document.getElementById("gallerySortOrder").value || 0),
    is_active: true
  };

  const { error } = await supabaseClient
    .from("gallery")
    .insert(galleryData);

  if (error) {
    alert("Ошибка добавления фото: " + error.message);
    return;
  }

  alert("Фото добавлено");

  galleryForm.reset();
  await loadGalleryAdmin();
});

async function toggleGalleryStatus(id, currentStatus) {
  const { error } = await supabaseClient
    .from("gallery")
    .update({
      is_active: !currentStatus
    })
    .eq("id", id);

  if (error) {
    alert("Ошибка изменения статуса: " + error.message);
    return;
  }

  await loadGalleryAdmin();
}

async function deleteGalleryItem(id) {
  const confirmed = confirm("Точно удалить это фото из галереи?");

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("gallery")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Ошибка удаления: " + error.message);
    return;
  }

  await loadGalleryAdmin();
}

async function loadSettingsAdmin() {
  if (!settingsForm) return;

  const { data, error } = await supabaseClient
    .from("site_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    alert("Ошибка загрузки настроек: " + error.message);
    return;
  }

  document.getElementById("settingsWhatsapp").value = data.whatsapp_phone || "";
  document.getElementById("settingsInstagram").value = data.instagram_url || "";
  document.getElementById("settingsHeroTitle").value = data.hero_title || "";
  document.getElementById("settingsHeroSubtitle").value = data.hero_subtitle || "";
  document.getElementById("settingsAddress").value = data.address || "";
  document.getElementById("settingsWorkingHours").value = data.working_hours || "";
  document.getElementById("settingsManagerChatIds").value = data.manager_chat_ids || "";
  document.getElementById("settingsKaspiRequisites").value = data.kaspi_requisites || "";
  document.getElementById("settingsKaspiPayLink").value = data.kaspi_pay_link || "";
}

settingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const heroImageFile = document.getElementById("settingsHeroImage").files[0];

  let heroImageUrl = null;

  if (heroImageFile) {
    heroImageUrl = await uploadImageToFolder(heroImageFile, "hero");
  }

  const settingsData = {
    whatsapp_phone: document.getElementById("settingsWhatsapp").value.trim(),
    instagram_url: document.getElementById("settingsInstagram").value.trim(),
    hero_title: document.getElementById("settingsHeroTitle").value.trim(),
    hero_subtitle: document.getElementById("settingsHeroSubtitle").value.trim(),
    address: document.getElementById("settingsAddress").value.trim(),
    working_hours: document.getElementById("settingsWorkingHours").value.trim(),
    manager_chat_ids: document.getElementById("settingsManagerChatIds").value.trim() || null,
    kaspi_requisites: document.getElementById("settingsKaspiRequisites").value.trim() || null,
    kaspi_pay_link: document.getElementById("settingsKaspiPayLink").value.trim() || null,
    updated_at: new Date().toISOString()
  };

  if (heroImageUrl) {
    settingsData.hero_image_url = heroImageUrl;
  }

  const { data: existingSettings, error: loadError } = await supabaseClient
    .from("site_settings")
    .select("id")
    .limit(1)
    .single();

  if (loadError) {
    alert("Ошибка поиска настроек: " + loadError.message);
    return;
  }

  const { error } = await supabaseClient
    .from("site_settings")
    .update(settingsData)
    .eq("id", existingSettings.id);

  if (error) {
    alert("Ошибка сохранения настроек: " + error.message);
    return;
  }

  alert("Настройки сохранены");
});

async function uploadImageToFolder(file, folderName) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${folderName}/${fileName}`;

  const { error } = await supabaseClient.storage
    .from("site-images")
    .upload(filePath, file);

  if (error) {
    alert("Ошибка загрузки фото: " + error.message);
    return null;
  }

  const { data } = supabaseClient.storage
    .from("site-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function loadStaff() {
  if (!staffList) return;

  staffList.innerHTML = "<p>Загружаем сотрудников...</p>";

  let data;

  try {
    data = await adminApiRequest("/admin/staff");
  } catch (error) {
    staffList.innerHTML = `<p>Ошибка загрузки сотрудников: ${error.message}</p>`;
    return;
  }

  staffList.innerHTML = "";

  if (!data.staff.length) {
    staffList.innerHTML = "<p>Сотрудников пока нет.</p>";
    return;
  }

  data.staff.forEach((item) => {
    const card = document.createElement("div");
    card.className = "admin-package-card";

    const roleLabels = { admin: "Администратор", manager: "Менеджер", organizer: "Организатор" };
    const roleLabel = roleLabels[item.role] || item.role;
    const isSelf = item.email?.toLowerCase() === currentUser.email?.toLowerCase();

    card.innerHTML = `
      <h3>${item.email}</h3>
      <p><strong>Роль:</strong> ${roleLabel}</p>
      <div class="card-actions">
        <button type="button" class="staff-password-btn" data-staff-id="${item.id}">
          Сменить пароль
        </button>
        <button type="button" class="danger-btn staff-remove-btn" data-staff-id="${item.id}" ${isSelf ? "disabled" : ""}>
          Удалить доступ
        </button>
      </div>
    `;

    staffList.appendChild(card);
  });

  document.querySelectorAll(".staff-password-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const newPassword = prompt("Новый пароль для сотрудника (минимум 8 символов):");
      if (newPassword === null) return;

      if (newPassword.length < 8) {
        alert("Пароль должен быть не короче 8 символов.");
        return;
      }

      try {
        await adminApiRequest(`/admin/staff/${button.dataset.staffId}/password`, {
          method: "PATCH",
          body: JSON.stringify({ password: newPassword })
        });
        alert("Пароль обновлён. Сообщите его сотруднику.");
      } catch (error) {
        alert("Ошибка смены пароля: " + error.message);
      }
    });
  });

  document.querySelectorAll(".staff-remove-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const confirmed = confirm("Убрать доступ этого сотрудника в админ-панель?");

      if (!confirmed) return;

      try {
        await adminApiRequest(`/admin/staff/${button.dataset.staffId}`, {
          method: "DELETE"
        });
        await loadStaff();
      } catch (error) {
        alert("Ошибка удаления доступа: " + error.message);
      }
    });
  });
}

staffForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("staffEmail").value.trim();
  const password = document.getElementById("staffPassword").value;
  const role = document.getElementById("staffRole").value;

  try {
    await adminApiRequest("/admin/staff", {
      method: "POST",
      body: JSON.stringify({ email, password, role })
    });

    alert("Сотрудник добавлен. Сообщите ему email и временный пароль для входа.");
    staffForm.reset();
    await loadStaff();
  } catch (error) {
    alert("Ошибка добавления сотрудника: " + error.message);
  }
});

async function loadManagerBookingPackages() {
  if (!managerPackageSelect) return;

  try {
    const data = await apiRequest("/catalog/packages");
    managerPackages = data.packages || [];

    if (!managerPackages.length) {
      managerPackageSelect.innerHTML = `<option value="">Нет активных пакетов</option>`;
      return;
    }

    managerPackageSelect.innerHTML =
      `<option value="">Выберите пакет</option>` +
      managerPackages
        .map((item) => `<option value="${item.id}">${item.title} — ${item.price || "цена уточняется"}</option>`)
        .join("");
  } catch (error) {
    managerPackageSelect.innerHTML = `<option value="">Ошибка загрузки пакетов</option>`;
  }
}

function resetManagerSlots(message) {
  managerSelectedSlot = null;

  if (managerSlotStatus) {
    managerSlotStatus.textContent = message;
  }

  if (managerSlotGrid) {
    managerSlotGrid.innerHTML = "";
  }

  managerClientFields?.classList.add("hidden");
}

async function loadManagerSlots() {
  const packageId = managerPackageSelect?.value;
  const date = managerBookingDate?.value;

  if (!packageId || !date) {
    resetManagerSlots("Сначала выберите пакет и дату");
    return;
  }

  resetManagerSlots("Загружаем свободное время...");

  try {
    const data = await apiRequest("/bookings/available-slots", {
      method: "POST",
      body: JSON.stringify({ packageId, date })
    });

    renderManagerSlots(data.slots || []);
  } catch (error) {
    managerSlotStatus.textContent = "Не удалось загрузить свободное время";
  }
}

function renderManagerSlots(slots) {
  managerSlotGrid.innerHTML = "";

  if (!slots.length) {
    managerSlotStatus.textContent = "На эту дату свободного времени нет";
    return;
  }

  managerSlotStatus.textContent = "Выберите удобное время";

  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot-btn";
    button.textContent = slot.displayLabel;
    button.addEventListener("click", () => selectManagerSlot(slot, button));
    managerSlotGrid.appendChild(button);
  });
}

function selectManagerSlot(slot, button) {
  managerSelectedSlot = slot;
  managerSlotStatus.textContent = `Выбрано: ${slot.displayLabel}`;

  document.querySelectorAll("#managerSlotGrid .slot-btn").forEach((slotButton) => {
    slotButton.classList.remove("active");
  });

  button.classList.add("active");
  managerClientFields?.classList.remove("hidden");
}

managerPackageSelect?.addEventListener("change", loadManagerSlots);
managerBookingDate?.addEventListener("change", loadManagerSlots);

managerBookingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!managerSelectedSlot) {
    alert("Выберите свободное время");
    return;
  }

  const clientName = document.getElementById("managerClientName").value.trim();
  const clientPhone = document.getElementById("managerClientPhone").value.trim();
  const managerComment = document.getElementById("managerClientComment").value.trim();

  if (!clientName || !clientPhone) {
    alert("Укажите имя и телефон клиента");
    return;
  }

  const comment = managerComment
    ? `Бронь оформлена менеджером по телефону. ${managerComment}`
    : "Бронь оформлена менеджером по телефону.";

  try {
    await adminApiRequest("/admin/bookings", {
      method: "POST",
      body: JSON.stringify({
        packageId: managerPackageSelect.value,
        clientName,
        clientPhone,
        startAt: managerSelectedSlot.startAt,
        comment
      })
    });

    alert("Бронь создана");
    managerBookingForm.reset();
    resetManagerSlots("Сначала выберите пакет и дату");
    await loadManagerSlots();
    await loadBookings();
    await loadSchedule();
  } catch (error) {
    alert(error.message || "Не удалось создать бронь");
  }
});

const scheduleList = document.getElementById("scheduleList");
const refreshScheduleBtn = document.getElementById("refreshScheduleBtn");
let currentScheduleRange = "today";

async function loadSchedule() {
  if (!scheduleList) return;

  scheduleList.innerHTML = "<p>Загружаем расписание...</p>";

  let data;

  try {
    data = await adminApiRequest(`/admin/bookings/schedule?range=${currentScheduleRange}`);
  } catch (error) {
    scheduleList.innerHTML = `<p>Ошибка загрузки расписания: ${error.message}</p>`;
    return;
  }

  scheduleList.innerHTML = "";

  if (!data.schedule.length) {
    scheduleList.innerHTML = "<p>На этот период броней нет.</p>";
    return;
  }

  data.schedule.forEach((item) => {
    const card = document.createElement("div");
    card.className = "booking-card";

    const checklist = item.includes.length
      ? `<ul class="schedule-checklist">${item.includes.map((line) => `<li>${line}</li>`).join("")}</ul>`
      : "";

    card.innerHTML = `
      <h3>${formatDateTime(item.startAt)} — ${item.packageTitle || "Пакет не указан"}</h3>
      <p><strong>Клиент:</strong> ${item.clientName} · ${item.clientPhone}</p>
      <p><strong>Комментарий:</strong> ${item.comment || "Нет"}</p>
      ${checklist}
      <p style="margin-top: 10px;">
        <span class="event-status-badge">${item.eventStatus}</span>
      </p>
      <div class="card-actions">
        <button type="button" class="event-status-btn" data-booking-id="${item.bookingId}" data-status="подготовлено" ${item.eventStatus !== "ожидается" ? "disabled" : ""}>
          Подготовлено
        </button>
        <button type="button" class="event-status-btn" data-booking-id="${item.bookingId}" data-status="проведено" ${item.eventStatus === "проведено" ? "disabled" : ""}>
          Проведено
        </button>
      </div>
    `;

    scheduleList.appendChild(card);
  });

  document.querySelectorAll(".event-status-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await adminApiRequest(`/admin/bookings/${button.dataset.bookingId}/event-status`, {
          method: "PATCH",
          body: JSON.stringify({ eventStatus: button.dataset.status })
        });
        await loadSchedule();
      } catch (error) {
        alert("Ошибка изменения статуса: " + error.message);
      }
    });
  });
}

document.querySelectorAll(".schedule-range-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll(".schedule-range-btn").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    currentScheduleRange = button.dataset.range;
    await loadSchedule();
  });
});

refreshScheduleBtn?.addEventListener("click", loadSchedule);

async function loadExpenseBookingOptions() {
  if (!expenseBookingSelect) return;

  let data;

  try {
    data = await adminApiRequest("/admin/bookings/schedule?range=week");
  } catch (error) {
    return;
  }

  expenseBookingSelect.innerHTML = '<option value="">Без привязки к брони</option>';

  data.schedule.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.bookingId;
    option.textContent = `${formatDateTime(item.startAt)} — ${item.packageTitle || "Пакет"} (${item.clientName})`;
    expenseBookingSelect.appendChild(option);
  });
}

function renderExpenseCard(item, { showStaff }) {
  const card = document.createElement("div");
  card.className = "booking-card";

  card.innerHTML = `
    <h3>${formatMoney(item.amount)} ₸ — ${item.category}</h3>
    <p><strong>Дата:</strong> ${item.spentAt}</p>
    ${showStaff ? `<p><strong>Организатор:</strong> ${item.staffEmail || "—"}</p>` : ""}
    <p><strong>Бронь:</strong> ${item.packageTitle ? `${item.packageTitle}${item.clientName ? " — " + item.clientName : ""}` : "Без привязки"}</p>
    <p><strong>Комментарий:</strong> ${item.comment || "Не указано"}</p>
    <div class="card-actions">
      <button type="button" class="danger-btn expense-remove-btn" data-expense-id="${item.id}">Удалить</button>
    </div>
  `;

  return card;
}

function renderExpenseCategoryTotals(expenses) {
  const totals = new Map();

  expenses.forEach((item) => {
    totals.set(item.category, (totals.get(item.category) || 0) + Number(item.amount));
  });

  const rows = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const grandTotal = rows.reduce((sum, [, amount]) => sum + amount, 0);

  const cells = rows
    .map(([category, amount]) => `<tr><td>${category}</td><td>${formatMoney(amount)} ₸</td></tr>`)
    .join("");

  const table = document.createElement("table");
  table.className = "sales-report-table";
  table.innerHTML = `
    <thead><tr><th>Категория</th><th>Сумма</th></tr></thead>
    <tbody>${cells}</tbody>
    <tfoot><tr><td>Итого</td><td>${formatMoney(grandTotal)} ₸</td></tr></tfoot>
  `;

  return table;
}

function bindExpenseRemoveButtons(container) {
  container.querySelectorAll(".expense-remove-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Удалить этот расход?")) return;

      try {
        await adminApiRequest(`/admin/expenses/${button.dataset.expenseId}`, {
          method: "DELETE"
        });
        await loadMyExpenses();
        if (currentUserRole === "admin") await loadAllExpenses();
      } catch (error) {
        alert("Ошибка удаления: " + error.message);
      }
    });
  });
}

async function loadMyExpenses() {
  if (!myExpensesList) return;

  myExpensesList.innerHTML = "<p>Загружаем расходы...</p>";

  let data;

  try {
    data = await adminApiRequest("/admin/expenses/mine");
  } catch (error) {
    myExpensesList.innerHTML = `<p>Ошибка загрузки: ${error.message}</p>`;
    return;
  }

  myExpensesList.innerHTML = "";

  if (!data.expenses.length) {
    myExpensesList.innerHTML = "<p>Расходов пока нет.</p>";
    return;
  }

  myExpensesList.appendChild(renderExpenseCategoryTotals(data.expenses));

  data.expenses.forEach((item) => {
    myExpensesList.appendChild(renderExpenseCard(item, { showStaff: false }));
  });

  bindExpenseRemoveButtons(myExpensesList);
}

async function loadAllExpenses() {
  if (!allExpensesList) return;

  allExpensesList.innerHTML = "<p>Загружаем расходы...</p>";

  let data;

  try {
    data = await adminApiRequest("/admin/expenses");
  } catch (error) {
    allExpensesList.innerHTML = `<p>Ошибка загрузки: ${error.message}</p>`;
    return;
  }

  allExpensesList.innerHTML = "";

  if (!data.expenses.length) {
    allExpensesList.innerHTML = "<p>Расходов пока нет.</p>";
    return;
  }

  allExpensesList.appendChild(renderExpenseCategoryTotals(data.expenses));

  data.expenses.forEach((item) => {
    allExpensesList.appendChild(renderExpenseCard(item, { showStaff: true }));
  });

  bindExpenseRemoveButtons(allExpensesList);
}

expenseForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amount = document.getElementById("expenseAmount").value;
  const category = document.getElementById("expenseCategory").value;
  const spentAt = document.getElementById("expenseDate").value || undefined;
  const bookingId = expenseBookingSelect?.value || undefined;
  const comment = document.getElementById("expenseComment").value.trim();

  try {
    await adminApiRequest("/admin/expenses", {
      method: "POST",
      body: JSON.stringify({ amount, category, spentAt, bookingId, comment })
    });
    expenseForm.reset();
    await loadMyExpenses();
    if (currentUserRole === "admin") await loadAllExpenses();
  } catch (error) {
    alert("Ошибка добавления расхода: " + error.message);
  }
});

exportExpensesBtn?.addEventListener("click", async () => {
  try {
    await adminApiDownload("/admin/expenses/export.xlsx", "raskhody.xlsx");
  } catch (error) {
    alert("Ошибка экспорта: " + error.message);
  }
});

let currentSalesRange = "today";

async function loadSalesReport() {
  if (!salesReportContent) return;

  salesReportContent.innerHTML = "<p>Загружаем продажи...</p>";

  let data;

  try {
    data = await adminApiRequest(`/admin/sales-report?range=${currentSalesRange}`);
  } catch (error) {
    salesReportContent.innerHTML = `<p>Ошибка загрузки: ${error.message}</p>`;
    return;
  }

  if (!data.packages.length) {
    salesReportContent.innerHTML = "<p>За этот период продаж нет.</p>";
    return;
  }

  const rows = data.packages
    .map(
      (pkg) => `
        <tr>
          <td>${pkg.packageTitle}</td>
          <td>${pkg.count}</td>
          <td>${formatMoney(pkg.totalAmount)} ₸</td>
        </tr>
      `
    )
    .join("");

  salesReportContent.innerHTML = `
    <table class="sales-report-table">
      <thead>
        <tr><th>Пакет</th><th>Количество</th><th>Сумма</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td>Итого</td><td>${data.totalCount}</td><td>${formatMoney(data.totalAmount)} ₸</td></tr>
      </tfoot>
    </table>
  `;
}

document.querySelectorAll(".sales-range-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll(".sales-range-btn").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    currentSalesRange = button.dataset.range;
    await loadSalesReport();
  });
});

exportSalesBtn?.addEventListener("click", async () => {
  try {
    await adminApiDownload(
      `/admin/sales-report/export.xlsx?range=${currentSalesRange}`,
      `prodazhi-${currentSalesRange}.xlsx`
    );
  } catch (error) {
    alert("Ошибка экспорта: " + error.message);
  }
});

const dashboardStats = document.getElementById("dashboardStats");
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const calendarDayBookings = document.getElementById("calendarDayBookings");
const topPackagesList = document.getElementById("topPackagesList");
const staffBreakdownList = document.getElementById("staffBreakdownList");
const refreshDashboardBtn = document.getElementById("refreshDashboardBtn");

let dashboardBookings = [];
let calendarCurrentMonth = new Date();
let calendarSelectedDateKey = null;

async function loadDashboard() {
  if (!dashboardStats) return;

  dashboardStats.innerHTML = "<p>Загружаем дашборд...</p>";

  let stats;
  let bookingsData;

  try {
    [stats, bookingsData] = await Promise.all([
      adminApiRequest("/admin/dashboard"),
      adminApiRequest("/admin/bookings")
    ]);
  } catch (error) {
    dashboardStats.innerHTML = `<p>Ошибка загрузки дашборда: ${error.message}</p>`;
    return;
  }

  dashboardBookings = bookingsData.bookings || [];
  renderDashboardStats(stats);
  renderTopPackages(stats.topPackages);
  renderStaffBreakdown(stats.staffBreakdown);
  calendarCurrentMonth = new Date();
  calendarSelectedDateKey = null;
  calendarDayBookings.innerHTML = "";
  renderCalendar();
}

function renderDashboardStats(stats) {
  dashboardStats.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${stats.totalBookings}</div>
      <div class="stat-label">Всего активных броней</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.last7Days}</div>
      <div class="stat-label">Новых за 7 дней</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.last30Days}</div>
      <div class="stat-label">Новых за 30 дней</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatMoney(Number(stats.collectedDeposits || 0))} тг</div>
      <div class="stat-label">Собрано предоплат</div>
    </div>
  `;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("ru-RU").format(amount);
}

function renderTopPackages(topPackages) {
  if (!topPackages.length) {
    topPackagesList.innerHTML = "<p>Пока нет данных.</p>";
    return;
  }

  topPackagesList.innerHTML = topPackages
    .map(
      (item) => `
    <div class="top-package-row">
      <span>${item.title}</span>
      <span>${item.bookingsCount}</span>
    </div>
  `
    )
    .join("");
}

function renderStaffBreakdown(staffBreakdown) {
  if (!staffBreakdown.length) {
    staffBreakdownList.innerHTML = "<p>Пока никто не оформлял брони через кабинет менеджера.</p>";
    return;
  }

  const roleLabels = { admin: "Админ", manager: "Менеджер", organizer: "Организатор" };

  staffBreakdownList.innerHTML = staffBreakdown
    .map(
      (item) => `
    <div class="staff-row">
      <span>${item.email || "Неизвестно"} (${roleLabels[item.role] || item.role})</span>
      <span>${item.bookingsCount}</span>
    </div>
  `
    )
    .join("");
}

function renderCalendar() {
  if (!calendarGrid) return;

  const year = calendarCurrentMonth.getFullYear();
  const month = calendarCurrentMonth.getMonth();

  calendarMonthLabel.textContent = calendarCurrentMonth.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric"
  });

  const bookingsByDay = {};

  dashboardBookings.forEach((item) => {
    if (!item.startAt) return;

    const dateKey = new Date(item.startAt).toLocaleDateString("en-CA", {
      timeZone: "Asia/Almaty"
    });

    if (!bookingsByDay[dateKey]) bookingsByDay[dateKey] = [];
    bookingsByDay[dateKey].push(item);
  });

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  calendarGrid.innerHTML = "";

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayBookings = bookingsByDay[dateKey] || [];

    const cell = document.createElement("div");
    cell.className =
      "calendar-day" +
      (dayBookings.length ? " has-bookings" : "") +
      (dateKey === calendarSelectedDateKey ? " selected" : "");

    cell.innerHTML = `
      <span>${day}</span>
      ${dayBookings.length ? `<span class="calendar-day-count">${dayBookings.length}</span>` : ""}
    `;

    cell.addEventListener("click", () => {
      calendarSelectedDateKey = dateKey;
      renderCalendar();
      renderCalendarDayBookings(dayBookings, dateKey);
    });

    calendarGrid.appendChild(cell);
  }
}

function renderCalendarDayBookings(dayBookings, dateKey) {
  if (!calendarDayBookings) return;

  if (!dayBookings.length) {
    calendarDayBookings.innerHTML = `<p>На ${dateKey} броней нет.</p>`;
    return;
  }

  calendarDayBookings.innerHTML =
    `<h4>${dateKey}</h4>` +
    dayBookings
      .map(
        (item) => `
    <div class="top-package-row">
      <span>${formatDateTime(item.startAt)} — ${item.clientName}</span>
      <span>${item.packageTitle || ""}</span>
    </div>
  `
      )
      .join("");
}

document.getElementById("calendarPrevBtn")?.addEventListener("click", () => {
  calendarCurrentMonth = new Date(
    calendarCurrentMonth.getFullYear(),
    calendarCurrentMonth.getMonth() - 1,
    1
  );
  calendarSelectedDateKey = null;
  calendarDayBookings.innerHTML = "";
  renderCalendar();
});

document.getElementById("calendarNextBtn")?.addEventListener("click", () => {
  calendarCurrentMonth = new Date(
    calendarCurrentMonth.getFullYear(),
    calendarCurrentMonth.getMonth() + 1,
    1
  );
  calendarSelectedDateKey = null;
  calendarDayBookings.innerHTML = "";
  renderCalendar();
});

refreshDashboardBtn?.addEventListener("click", loadDashboard);

checkSession();
