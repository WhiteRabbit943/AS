(() => {
  const cfg = window.STORE_CONFIG || {};
  const statusEl = document.getElementById('status');
  const grid = document.getElementById('products');
  const categoryBox = document.getElementById('categories');
  document.getElementById('year').textContent = new Date().getFullYear();

  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-PROJECT-ID') ||
      !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')) {
    statusEl.textContent = 'يلزم إعداد اتصال قاعدة البيانات في ملف config.js أولاً.';
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let allProducts = [];
  let allCategories = [];
  let activeCategory = 'all';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function renderCategories() {
    categoryBox.innerHTML = '';
    const entries = [{id:'all', name:'كل المنتجات'}, ...allCategories];
    entries.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-chip' + (String(activeCategory) === String(cat.id) ? ' active' : '');
      btn.textContent = cat.name;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        activeCategory = cat.id;
        renderCategories();
        renderProducts();
      });
      categoryBox.appendChild(btn);
    });
  }

  function renderProducts() {
    const products = activeCategory === 'all'
      ? allProducts
      : allProducts.filter(p => String(p.category_id) === String(activeCategory));
    grid.innerHTML = '';
    if (!products.length) {
      grid.innerHTML = '<div class="empty">لا توجد منتجات في هذا التصنيف حالياً.</div>';
      return;
    }
    products.forEach(p => {
      const card = document.createElement('article');
      card.className = 'product-card';
      const title = escapeHtml(p.name);
      const desc = escapeHtml(p.description || 'للاستفسار عن تفاصيل المنتج، تواصل معنا عبر واتساب.');
      const image = escapeHtml(p.image_url || '');
      const message = encodeURIComponent(`السلام عليكم، أريد طلب: ${p.name}، السعر: ${Number(p.price).toLocaleString('ar-LY')} د.ل`);
      const number = String(cfg.WHATSAPP_NUMBER || '218925686579').replace(/\D/g, '');
      card.innerHTML = `
        <img src="${image || 'placeholder.svg'}" alt="${title}" loading="lazy" onerror="this.onerror=null;this.src='placeholder.svg'">
        <div class="product-info">
          ${p.featured ? '<span class="badge">منتج مميز</span>' : ''}
          <h3 class="product-title">${title}</h3>
          <p class="product-description">${desc}</p>
          <div class="product-bottom">
            <span class="price">${Number(p.price).toLocaleString('ar-LY')} د.ل</span>
            <a class="whatsapp" href="https://wa.me/${number}?text=${message}" target="_blank" rel="noopener noreferrer">اطلب عبر واتساب</a>
          </div>
        </div>`;
      grid.appendChild(card);
    });
  }

  async function loadStore() {
    statusEl.textContent = 'جارٍ تحميل المنتجات...';
    const [cats, prods] = await Promise.all([
      db.from('categories').select('id,name').order('name'),
      db.from('products').select('id,name,description,price,image_url,category_id,featured,created_at').order('created_at', {ascending:false})
    ]);
    if (cats.error || prods.error) {
      statusEl.textContent = 'تعذّر تحميل المتجر. تأكد من إعداد الجداول وسياسات الوصول في Supabase.';
      console.error(cats.error || prods.error);
      return;
    }
    allCategories = cats.data || [];
    allProducts = prods.data || [];
    renderCategories();
    renderProducts();
    statusEl.textContent = allProducts.length ? '' : 'المتجر جاهز، أضف المنتجات من لوحة الإدارة.';
  }
  loadStore();
})();
