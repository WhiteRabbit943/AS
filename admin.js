import { initializeApp } from
  "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDD8tyRMJ_EDzahZz-DElvbdRek5P7o3h4",
  authDomain: "alfakhamastore-644d2.firebaseapp.com",
  projectId: "alfakhamastore-644d2",
  storageBucket: "alfakhamastore-644d2.firebasestorage.app",
  messagingSenderId: "1063707548206",
  appId: "1:1063707548206:web:632dfde28074340b551dbf"
};

const ADMIN_EMAIL = "alihussienwr943@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const el = id => document.getElementById(id);

const loginBox = el("loginBox");
const dashboard = el("dashboard");
const loginForm = el("loginForm");
const loginMessage = el("loginMessage");
const adminMessage = el("adminMessage");
const productForm = el("productForm");
const categoryForm = el("categoryForm");
const productList = el("productAdminList");
const categoryList = el("categoryAdminList");
const categorySelect = el("productCategory");
const imageInput = el("productImage");

let currentUser = null;
let categories = [];
let products = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function say(message, error = false) {
  adminMessage.textContent = message;
  adminMessage.style.color = error ? "#ffaaa1" : "";
}

function showDashboard(show) {
  loginBox.hidden = show;
  dashboard.hidden = !show;
}

function isAdmin(user) {
  return Boolean(
    user &&
    user.email === ADMIN_EMAIL &&
    user.emailVerified
  );
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginMessage.textContent = "جارٍ تسجيل الدخول باستخدام Google...";

  try {
    const result = await signInWithPopup(auth, provider);

    if (!isAdmin(result.user)) {
      await signOut(auth);
      loginMessage.textContent =
        "هذا الحساب غير مصرح له بإدارة المتجر. استخدم حساب المسؤول المحدد.";
      return;
    }

    loginMessage.textContent = "";
  } catch (error) {
    console.error(error);
    loginMessage.textContent =
      "تعذّر تسجيل الدخول. تحقق من إعدادات Google والنطاقات المصرح بها، ثم حاول مجددًا.";
  }
});

el("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    showDashboard(false);
    loginMessage.textContent = "تم تسجيل الخروج.";
  } catch (error) {
    console.error(error);
    say("تعذّر تسجيل الخروج.", true);
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;
    showDashboard(false);
    return;
  }

  if (!isAdmin(user)) {
    await signOut(auth);
    showDashboard(false);
    loginMessage.textContent =
      "هذا الحساب غير مصرح له بإدارة المتجر.";
    return;
  }

  currentUser = user;
  showDashboard(true);
  await refreshAll();
});

async function refreshAll() {
  if (!currentUser || !isAdmin(currentUser)) return;

  say("جارٍ تحميل البيانات...");

  try {
    const [categorySnapshot, productSnapshot] = await Promise.all([
      getDocs(collection(db, "categories")),
      getDocs(collection(db, "products"))
    ]);

    categories = categorySnapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    products = productSnapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    categories.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );

    products.sort((a, b) =>
      Number(b.created_at || 0) - Number(a.created_at || 0)
    );

    renderCategories();
    renderProducts();
    say("");
  } catch (error) {
    console.error(error);
    say(
      "تعذّر تحميل البيانات. تحقق من قواعد Firestore واتصال الإنترنت.",
      true
    );
  }
}

function renderCategories() {
  categorySelect.innerHTML =
    '<option value="">اختر تصنيفًا</option>' +
    categories.map(category =>
      `<option value="${escapeHtml(category.id)}">${
        escapeHtml(category.name)
      }</option>`
    ).join("");

  categoryList.innerHTML = "";

  if (!categories.length) {
    categoryList.innerHTML =
      '<p class="muted">لا توجد تصنيفات. أضف تصنيفًا أولًا.</p>';
  }

  categories.forEach(category => {
    const row = document.createElement("div");
    row.className = "manage-row";

    row.innerHTML = `
      <div class="row-info">
        <strong>${escapeHtml(category.name)}</strong>
      </div>
      <div class="row-actions">
        <button class="small-button danger"
          data-delete-category="${escapeHtml(category.id)}">
          حذف
        </button>
      </div>
    `;

    categoryList.appendChild(row);
  });

  categoryList.querySelectorAll("[data-delete-category]")
    .forEach(button => {
      button.addEventListener("click", () =>
        deleteCategory(button.dataset.deleteCategory)
      );
    });
}

function renderProducts() {
  productList.innerHTML = "";

  if (!products.length) {
    productList.innerHTML =
      '<p class="muted">لا توجد منتجات حتى الآن.</p>';
    return;
  }

  products.forEach(product => {
    const row = document.createElement("div");
    row.className = "manage-row";

    row.innerHTML = `
      <img src="${escapeHtml(product.image_url || "placeholder.svg")}"
           alt=""
           onerror="this.onerror=null;this.src='placeholder.svg'">

      <div class="row-info">
        <strong>${escapeHtml(product.name)}</strong>
        <small>${Number(product.price || 0).toLocaleString("ar-LY")} د.ل</small>
      </div>

      <div class="row-actions">
        <button class="small-button"
          data-edit-product="${escapeHtml(product.id)}">تعديل</button>
        <button class="small-button danger"
          data-delete-product="${escapeHtml(product.id)}">حذف</button>
      </div>
    `;

    productList.appendChild(row);
  });

  productList.querySelectorAll("[data-edit-product]")
    .forEach(button => {
      button.addEventListener("click", () =>
        editProduct(button.dataset.editProduct)
      );
    });

  productList.querySelectorAll("[data-delete-product]")
    .forEach(button => {
      button.addEventListener("click", () =>
        deleteProduct(button.dataset.deleteProduct)
      );
    });
}

categoryForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdmin(currentUser)) return;

  const name = el("categoryName").value.trim();
  if (!name) return;

  try {
    await addDoc(collection(db, "categories"), {
      name,
      created_at: Date.now()
    });

    el("categoryName").value = "";
    say("تمت إضافة التصنيف بنجاح.");
    await refreshAll();
  } catch (error) {
    console.error(error);
    say("تعذّرت إضافة التصنيف. تحقق من صلاحيات قاعدة البيانات.", true);
  }
});

async function deleteCategory(id) {
  if (!isAdmin(currentUser)) return;

  const hasProducts = products.some(
    product => String(product.category_id) === String(id)
  );

  if (hasProducts) {
    say("لا يمكن حذف تصنيف يحتوي على منتجات. انقل منتجاته أو احذفها أولًا.", true);
    return;
  }

  if (!confirm("هل تريد حذف هذا التصنيف؟")) return;

  try {
    await deleteDoc(doc(db, "categories", id));
    say("تم حذف التصنيف.");
    await refreshAll();
  } catch (error) {
    console.error(error);
    say("تعذّر حذف التصنيف.", true);
  }
}

productForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdmin(currentUser)) return;

  if (!categories.length) {
    say("أضف تصنيفًا أولًا قبل إضافة المنتجات.", true);
    return;
  }

  const id = el("productId").value;
  const name = el("productName").value.trim();
  const price = Number(el("productPrice").value);
  const category_id = categorySelect.value;
  const description = el("productDescription").value.trim();
  const featured = el("productFeatured").checked;
  const image_url = imageInput.value.trim();

  if (
    !name ||
    !category_id ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    say("تحقق من اسم المنتج والسعر والتصنيف.", true);
    return;
  }

  if (image_url) {
    try {
      const parsedUrl = new URL(image_url);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid image URL");
      }
    } catch {
      say("رابط الصورة غير صالح. أدخل رابطًا يبدأ بـ https://", true);
      return;
    }
  }

  const existing = products.find(product => product.id === id);

  const payload = {
    name,
    price,
    category_id,
    description,
    featured,
    image_url: image_url || "",
    created_at: existing?.created_at || Date.now()
  };

  say("جارٍ حفظ المنتج...");

  try {
    if (id) {
      await updateDoc(doc(db, "products", id), payload);
    } else {
      await addDoc(collection(db, "products"), payload);
    }

    resetForm();
    say("تم حفظ المنتج بنجاح.");
    await refreshAll();
  } catch (error) {
    console.error(error);
    say("تعذّر حفظ المنتج. تحقق من قواعد Firestore.", true);
  }
});

function editProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  el("productId").value = product.id;
  el("productName").value = product.name || "";
  el("productPrice").value = product.price ?? "";
  categorySelect.value = product.category_id || "";
  el("productDescription").value = product.description || "";
  el("productFeatured").checked = Boolean(product.featured);
  imageInput.value = product.image_url || "";

  el("productFormTitle").textContent = "تعديل المنتج";
  el("cancelEdit").hidden = false;

  productForm.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function deleteProduct(id) {
  if (!isAdmin(currentUser)) return;

  if (!confirm("هل تريد حذف هذا المنتج نهائيًا؟")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    say("تم حذف المنتج.");
    await refreshAll();
  } catch (error) {
    console.error(error);
    say("تعذّر حذف المنتج.", true);
  }
}

function resetForm() {
  productForm.reset();
  el("productId").value = "";
  el("productFormTitle").textContent = "إضافة منتج";
  el("cancelEdit").hidden = true;
}

el("cancelEdit").addEventListener("click", resetForm);
