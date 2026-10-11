(() => {
  const cfg = window.STORE_CONFIG || {};
  const loginBox = document.getElementById('loginBox');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  const adminMessage = document.getElementById('adminMessage');
  const productForm = document.getElementById('productForm');
  const categoryForm = document.getElementById('categoryForm');
  const productList = document.getElementById('productAdminList');
  const categoryList = document.getElementById('categoryAdminList');
  const categorySelect = document.getElementById('productCategory');
  const imageInput = document.getElementById('productImage');
  let db, currentUser, categories = [], products = [];

  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-PROJECT-ID') ||
      !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')) {
    loginMessage.textContent = 'أدخل بيانات مشروع Supabase في config.js قبل تسجيل الدخول.';
    loginForm.querySelector('button').disabled = true;
    return;
  }
  db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const el = id => document.getElementById(id);
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }
  function say(message, error=false) {
    adminMessage.textContent = message;
    adminMessage.style.color = error ? '#ffaaa1' : '';
  }
  function showDashboard(show) {
    loginBox.hidden = show;
    dashboard.hidden = !show;
  }
  async function verifySession() {
    const {data:{session}} = await db.auth.getSession();
    if (!session) { showDashboard(false); return; }
    const {data:{user}, error} = await db.auth.getUser();
    if (error || !user) { showDashboard(false); return; }
    currentUser = user;
    // الواجهة وحدها ليست حماية؛ صلاحيات قاعدة البيانات تُفرض أيضاً بسياسات RLS.
    showDashboard(true);
    await refreshAll();
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginMessage.textContent = 'جارٍ تسجيل الدخول...';
    const {error} = await db.auth.signInWithPassword({
      email: el('email').value.trim(),
      password: el('password').value
    });
    if (error) { loginMessage.textContent = 'تعذّر تسجيل الدخول: ' + error.message; return; }
    loginMessage.textContent = '';
    await verifySession();
  });

  el('logoutBtn').addEventListener('click', async () => {
    await db.auth.signOut();
    showDashboard(false);
    loginMessage.textContent = 'تم تسجيل الخروج.';
  });

  async function refreshAll() {
    say('جارٍ تحديث البيانات...');
    const [c,p] = await Promise.all([
      db.from('categories').select('*').order('name'),
      db.from('products').select('*').order('created_at',{ascending:false})
    ]);
    if (c.error || p.error) {
      say('فشل تحميل البيانات. تحقق من SQL وسياسات RLS. ' + (c.error?.message || p.error?.message), true);
      return;
    }
    categories = c.data || [];
    products = p.data || [];
    renderCategories();
    renderProducts();
    say('');
  }

  function renderCategories() {
    categorySelect.innerHTML = '<option value="">اختر تصنيفاً</option>' +
      categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    categoryList.innerHTML = '';
    if (!categories.length) categoryList.innerHTML = '<p class="muted">لا توجد تصنيفات. أضف تصنيفاً أولاً.</p>';
    categories.forEach(c => {
      const row = document.createElement('div');
      row.className = 'manage-row';
      row.innerHTML = `<div class="row-info"><strong>${escapeHtml(c.name)}</strong></div>
        <div class="row-actions"><button class="small-button danger" data-delete-category="${c.id}">حذف</button></div>`;
      categoryList.appendChild(row);
    });
    categoryList.querySelectorAll('[data-delete-category]').forEach(btn => {
      btn.addEventListener('click', () => deleteCategory(btn.dataset.deleteCategory));
    });
  }

  function renderProducts() {
    productList.innerHTML = '';
    if (!products.length) { productList.innerHTML = '<p class="muted">لا توجد منتجات حتى الآن.</p>'; return; }
    products.forEach(p => {
      const row = document.createElement('div');
      row.className = 'manage-row';
      row.innerHTML = `<img src="${escapeHtml(p.image_url || 'placeholder.svg')}" alt="">
        <div class="row-info"><strong>${escapeHtml(p.name)}</strong><small>${Number(p.price).toLocaleString('ar-LY')} د.ل</small></div>
        <div class="row-actions">
          <button class="small-button" data-edit-product="${p.id}">تعديل</button>
          <button class="small-button danger" data-delete-product="${p.id}">حذف</button>
        </div>`;
      productList.appendChild(row);
    });
    productList.querySelectorAll('[data-edit-product]').forEach(btn =>
      btn.addEventListener('click', () => editProduct(btn.dataset.editProduct)));
    productList.querySelectorAll('[data-delete-product]').forEach(btn =>
      btn.addEventListener('click', () => deleteProduct(btn.dataset.deleteProduct)));
  }

  categoryForm.addEventListener('submit', async event => {
    event.preventDefault();
    const name = el('categoryName').value.trim();
    if (!name) return;
    const {error} = await db.from('categories').insert({name});
    if (error) { say('لم تتم إضافة التصنيف: ' + error.message, true); return; }
    el('categoryName').value = '';
    say('تمت إضافة التصنيف.');
    await refreshAll();
  });

  async function deleteCategory(id) {
    if (!confirm('هل تريد حذف هذا التصنيف؟ يجب حذف المنتجات المرتبطة به أو نقلها أولاً.')) return;
    const {error} = await db.from('categories').delete().eq('id', id);
    if (error) { say('تعذّر حذف التصنيف. ربما توجد منتجات مرتبطة به. ' + error.message, true); return; }
    say('تم حذف التصنيف.');
    await refreshAll();
  }

  productForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!categories.length) { say('أضف تصنيفاً أولاً قبل إضافة المنتجات.', true); return; }
    const id = el('productId').value;
    const name = el('productName').value.trim();
    const price = Number(el('productPrice').value);
    const category_id = el('productCategory').value;
    const description = el('productDescription').value.trim();
    const featured = el('productFeatured').checked;
    if (!name || !category_id || !Number.isFinite(price) || price < 0) {
      say('تحقق من الاسم والسعر والتصنيف.', true); return;
    }
    say('جارٍ حفظ المنتج...');
    let image_url = id ? (products.find(p => String(p.id) === String(id))?.image_url || null) : null;
    const file = imageInput.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) { say('اختر ملف صورة صالحاً.', true); return; }
      if (file.size > 5 * 1024 * 1024) { say('حجم الصورة يجب ألا يتجاوز 5 ميغابايت.', true); return; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
      const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
      const upload = await db.storage.from('product-images').upload(path, file, {upsert:false, contentType:file.type});
      if (upload.error) { say('تعذّر رفع الصورة: ' + upload.error.message, true); return; }
      image_url = db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }
    const payload = {name, price, category_id, description, featured, image_url};
    const result = id
      ? await db.from('products').update(payload).eq('id', id)
      : await db.from('products').insert(payload);
    if (result.error) { say('تعذّر حفظ المنتج: ' + result.error.message, true); return; }
    resetForm();
    say('تم حفظ المنتج بنجاح.');
    await refreshAll();
  });

  function editProduct(id) {
    const p = products.find(item => String(item.id) === String(id));
    if (!p) return;
    el('productId').value = p.id;
    el('productName').value = p.name;
    el('productPrice').value = p.price;
    el('productCategory').value = p.category_id || '';
    el('productDescription').value = p.description || '';
    el('productFeatured').checked = Boolean(p.featured);
    imageInput.value = '';
    el('productFormTitle').textContent = 'تعديل المنتج';
    el('cancelEdit').hidden = false;
    productForm.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function deleteProduct(id) {
    if (!confirm('هل تريد حذف هذا المنتج نهائياً؟')) return;
    const {error} = await db.from('products').delete().eq('id', id);
    if (error) { say('تعذّر حذف المنتج: ' + error.message, true); return; }
    say('تم حذف المنتج.');
    await refreshAll();
  }

  function resetForm() {
    productForm.reset();
    el('productId').value = '';
    el('productFormTitle').textContent = 'إضافة منتج';
    el('cancelEdit').hidden = true;
  }
  el('cancelEdit').addEventListener('click', resetForm);

  db.auth.onAuthStateChange((_event, _session) => {
    // لا تنفذ عمليات قاعدة بيانات داخل callback مباشرة.
    setTimeout(verifySession, 0);
  });
  verifySession();
})();
