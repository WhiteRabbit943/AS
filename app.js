import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDD8tyRMJ_EDzahZz-DElvbdRek5P7o3h4",
  authDomain: "alfakhamastore-644d2.firebaseapp.com",
  projectId: "alfakhamastore-644d2",
  storageBucket: "alfakhamastore-644d2.firebasestorage.app",
  messagingSenderId: "1063707548206",
  appId: "1:1063707548206:web:632dfde28074340b551dbf"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const statusEl = document.getElementById("status");
const grid = document.getElementById("products");
const categoryBox = document.getElementById("categories");

document.getElementById("year").textContent = new Date().getFullYear();

let allProducts = [];
let allCategories = [];
let activeCategory = "all";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function renderCategories() {
  categoryBox.innerHTML = "";

  const entries = [{ id: "all", name: "كل المنتجات" }, ...allCategories];

  entries.forEach(category => {
    const button = document.createElement("button");
    button.className = "category-chip" +
      (String(activeCategory) === String(category.id) ? " active" : "");
    button.textContent = category.name;
    button.type = "button";

    button.addEventListener("click", () => {
      activeCategory = category.id;
      renderCategories();
      renderProducts();
    });

    categoryBox.appendChild(button);
  });
}

function renderProducts() {
  const products = activeCategory === "all"
    ? allProducts
    : allProducts.filter(product =>
        String(product.category_id) === String(activeCategory)
      );

  grid.innerHTML = "";

  if (!products.length) {
    grid.innerHTML = '<div class="empty">لا توجد منتجات في هذا التصنيف حالياً.</div>';
    return;
  }

  products.forEach(product => {
    const card = document.createElement("article");
    card.className = "product-card";

    const title = escapeHtml(product.name);
    const description = escapeHtml(
      product.description || "للاستفسار عن تفاصيل المنتج، تواصل معنا عبر واتساب."
    );
    const image = escapeHtml(product.image_url || "placeholder.svg");
    const price = Number(product.price) || 0;

    const message = encodeURIComponent(
      `السلام عليكم، أريد طلب: ${product.name}، السعر: ${price.toLocaleString("ar-LY")} د.ل`
    );

    card.innerHTML = `
      <img src="${image}" alt="${title}" loading="lazy"
        onerror="this.onerror=null;this.src='placeholder.svg'">
      <div class="product-info">
        ${product.featured ? '<span class="badge">منتج مميز</span>' : ""}
        <h3 class="product-title">${title}</h3>
        <p class="product-description">${description}</p>
        <div class="product-bottom">
          <span class="price">${price.toLocaleString("ar-LY")} د.ل</span>
          <a class="whatsapp"
        href="https://wa.me/218910665708?text=${message}"
            target="_blank" rel="noopener noreferrer">اطلب عبر واتساب</a>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

async function loadStore() {
  statusEl.textContent = "جارٍ تحميل المنتجات...";

  try {
    const [categorySnapshot, productSnapshot] = await Promise.all([
      getDocs(collection(db, "categories")),
      getDocs(collection(db, "products"))
    ]);

    allCategories = categorySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    allProducts = productSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    allProducts.sort((a, b) => {
      const dateA = a.created_at?.seconds || 0;
      const dateB = b.created_at?.seconds || 0;
      return dateB - dateA;
    });

    renderCategories();
    renderProducts();

    statusEl.textContent = allProducts.length
      ? ""
      : "المتجر جاهز، أضف المنتجات من لوحة الإدارة.";
  } catch (error) {
    console.error(error);
    statusEl.textContent =
      "تعذّر تحميل المنتجات. تحقق من إعدادات Firebase وقواعد Firestore.";
  }
}

loadStore();
