(() => {
  const style = document.createElement("style");
  style.textContent = ".bundle-offers{display:grid;gap:12px;margin:20px 0}.bundle-choice{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;padding:17px 16px;border:1px solid var(--line);border-radius:14px;background:#fff;color:#111}.bundle-choice-copy{display:grid;gap:6px;min-width:0}.bundle-choice-copy b{font-size:14px;line-height:1.35}.bundle-choice-copy small{font-size:12px;color:#777;line-height:1.45}.bundle-choice>strong,.bundle-choice-row>strong{font-size:23px;white-space:nowrap}.bundle-choice-featured{display:block;border:2px solid #18834b;background:#f7fbf7;box-shadow:0 8px 24px rgba(24,131,75,.08)}.bundle-badges{display:flex;justify-content:space-between;gap:8px;margin-bottom:13px}.bundle-badges em{font-style:normal;font-size:10px;font-weight:800;letter-spacing:.04em;padding:6px 9px;border-radius:999px;background:#e3f3e8;color:#17683d}.bundle-badges em+em{background:#fff1d6;color:#815500}.bundle-choice-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.bundle-unit-price{font-size:12px;font-weight:700;color:#16834b;margin:12px 0}.bundle-cta{background:#176b3e;border-color:#176b3e}.bundle-cta:hover{background:#105632;border-color:#105632}[dir=rtl] .bundle-choice{text-align:right}[dir=rtl] .bundle-badges{flex-direction:row-reverse}@media(max-width:560px){.bundle-choice{padding:14px}.bundle-choice-copy b{font-size:13px}.bundle-choice>strong,.bundle-choice-row>strong{font-size:21px}}";
  document.head.appendChild(style);

  function offerPrice() { return Math.max(0, Number(siteSettings.bundle_offer_price || 99)); }
  function eligible(p) {
    return !!(p && p.dbId && siteSettings.bundle_offer_enabled &&
      Array.isArray(siteSettings.bundle_offer_product_ids) &&
      siteSettings.bundle_offer_product_ids.includes(p.dbId) &&
      Number(p.stock) >= 2 && offerPrice() > 0 && offerPrice() < Number(p.price) * 2);
  }
  function refreshConfig() {
    return supabaseRest("storefront_bundle_offer?select=bundle_offer_enabled,bundle_offer_price,bundle_offer_product_ids&limit=1")
      .then(rows => {
        if (Array.isArray(rows) && rows[0]) siteSettings = { ...siteSettings, ...rows[0] };
        if (typeof render === "function") render();
      })
      .catch(err => console.warn("Could not load bundle offer settings", err));
  }
  function offerMarkup(p) {
    const ar = currentLanguage === "ar", fr = currentLanguage === "fr";
    const single = ar ? "شراء وشم واحد" : fr ? "Acheter 1 tatouage" : "BUY 1 TATTOO";
    const singleDesc = ar ? "وشم واحد من اختيارك" : fr ? "1 tatouage de votre choix" : "1 tattoo of your choice";
    const bundle = ar ? "اشتري 2 واحصل على 1 مجاناً" : fr ? "Achetez 2, recevez-en 1 gratuit" : "BUY 2, GET 1 FREE";
    const bundleDesc = ar ? "2 من نفس التصميم + وشم هدية مفاجأة" : fr ? "2 fois le même design + 1 cadeau surprise" : "2 of the same design + 1 surprise gift";
    const best = ar ? "أفضل عرض" : fr ? "MEILLEURE OFFRE" : "BEST VALUE";
    const gift = ar ? "هدية مفاجأة" : fr ? "CADEAU SURPRISE" : "SURPRISE GIFT";
    const cta = ar ? "اطلب العرض" : fr ? "Profiter de l’offre" : "GET THIS OFFER";
    const notice = ar ? "الدفع عند الاستلام · التوصيل لجميع أنحاء المغرب" : fr ? "Paiement à la livraison · Livraison partout au Maroc" : "Cash on delivery · Delivery across Morocco";
    return '<div class="purchase-area"><div class="bundle-offers">' +
      '<button type="button" class="bundle-choice" onclick="buyNow(' + p.id + ')"><span class="bundle-choice-copy"><b>' + single + '</b><small>' + singleDesc + '</small></span><strong>' + money(p.price) + '</strong></button>' +
      '<div class="bundle-choice bundle-choice-featured"><span class="bundle-badges"><em>' + best + '</em><em>' + gift + '</em></span><div class="bundle-choice-row"><span class="bundle-choice-copy"><b>' + bundle + '</b><small>' + bundleDesc + '</small></span><strong>' + money(offerPrice()) + '</strong></div>' +
      '<div class="bundle-unit-price">' + (ar ? "أي " : fr ? "Soit " : "Only ") + money(offerPrice() / 3) + (ar ? " للوشم الواحد" : fr ? " par tatouage" : " per tattoo") + '</div><button type="button" class="btn wide bundle-cta" onclick="buyBundleNow(' + p.id + ')">' + cta + '</button></div></div><div class="notice">' + notice + '</div></div>';
  }

  const originalProductView = productView;
  productView = function(p) {
    let html = originalProductView(p);
    if (!eligible(p)) return html;
    const start = html.indexOf('<div class="purchase-area">');
    const end = html.indexOf('<div class="specs">', start);
    if (start >= 0 && end > start) html = html.slice(0, start) + offerMarkup(p) + html.slice(end);
    return html.replace('<div class="mobile-sticky-buy">', '<div class="mobile-sticky-buy" style="display:none">');
  };

  window.buyBundleNow = function(id) {
    const p = products.find(x => x.id === id);
    if (!eligible(p)) { toast(currentLanguage === "ar" ? "هذا العرض غير متوفر حالياً" : "This offer is no longer available"); return false; }
    const row = cart.find(x => x.id === id);
    if (row) { row.qty = 2; row.bundleOffer = true; row.bundlePrice = offerPrice(); }
    else cart.push({ id, qty: 2, bundleOffer: true, bundlePrice: offerPrice() });
    localStorage.setItem("tattooui-cart", JSON.stringify(cart));
    updateBadge(); closeCart(); closeMobileMenu(); history.replaceState(null, "", "#/checkout"); resetTurnstile();
    render(); window.scrollTo(0, 0); setTimeout(renderTurnstile, 120); return true;
  };

  const oldAdd = addToCart;
  addToCart = function(id, qty, sourceEl) { const row = cart.find(x => x.id === id); if (row) { row.bundleOffer = false; delete row.bundlePrice; } return oldAdd(id, qty, sourceEl); };
  const oldBuy = buyNow;
  buyNow = function(id) { const row = cart.find(x => x.id === id); if (row) { row.bundleOffer = false; delete row.bundlePrice; } return oldBuy(id); };

  cartCount = function() { return cart.reduce((sum, row) => sum + Number(row.qty || 0) + (row.bundleOffer ? 1 : 0), 0); };
  cartSubtotal = function() {
    return cart.reduce((sum, row) => {
      const p = products.find(x => x.id === row.id); if (!p) return sum;
      if (row.bundleOffer && !eligible(p)) { row.bundleOffer = false; delete row.bundlePrice; row.qty = 2; }
      return sum + (row.bundleOffer ? Number(row.bundlePrice || offerPrice()) : Number(p.price) * Number(row.qty || 0));
    }, 0);
  };
  const oldUpdateQty = updateCartQty;
  updateCartQty = function(id, delta) { if (cart.find(x => x.id === id)?.bundleOffer) return; return oldUpdateQty(id, delta); };

  renderCart = function() {
    const box = document.getElementById("cartItems"); if (!box) return;
    const savedScroll = box.scrollTop;
    const valid = cart.filter(row => products.some(p => p.id === row.id && p.status !== "inactive"));
    if (valid.length !== cart.length) { cart = valid; localStorage.setItem("tattooui-cart", JSON.stringify(cart)); updateBadge(); }
    if (!cart.length) {
      box.innerHTML = '<div class="empty">Your bag is empty.<br><br><button class="btn" onclick="closeCart();home()">Explore tattoos</button></div>';
      document.getElementById("cartSubtotal").textContent = "0 DH";
      const se = document.getElementById("cart-shipping"); if (se) se.outerHTML = deliveryMarkup(0, "cart-shipping");
      const dl = document.getElementById("cartDeliveryLabel"); if (dl) dl.textContent = deliveryLabels().delivery;
      return;
    }
    let subtotal = 0;
    box.innerHTML = cart.map(row => {
      const p = products.find(x => x.id === row.id); if (!p) return "";
      if (row.bundleOffer && !eligible(p)) { row.bundleOffer = false; delete row.bundlePrice; row.qty = 2; }
      const bundled = !!row.bundleOffer, line = bundled ? Number(row.bundlePrice || offerPrice()) : Number(p.price) * Number(row.qty);
      subtotal += line;
      const desc = bundled ? (currentLanguage === "ar" ? "قطعتان من نفس التصميم + هدية مفاجأة" : currentLanguage === "fr" ? "2 fois le même design + cadeau surprise" : "2 of the same design + surprise gift") : money(p.price) + " each";
      const controls = bundled
        ? '<div class="mini-qty"><span class="mini-qty-count">' + (currentLanguage === "ar" ? "2 + 1 هدية" : "2 + 1 🎁") + '</span><button type="button" class="remove" onclick="event.stopPropagation();removeFromCart(' + p.id + ')">×</button></div>'
        : '<div class="mini-qty"><button type="button" class="mini-qty-btn" onclick="event.stopPropagation();updateCartQty(' + p.id + ',-1)">−</button><span class="mini-qty-count">' + row.qty + ' pcs</span><button type="button" class="mini-qty-btn" onclick="event.stopPropagation();updateCartQty(' + p.id + ',1)">+</button><button type="button" class="remove" onclick="event.stopPropagation();removeFromCart(' + p.id + ')">×</button></div>';
      return '<div class="cart-item"><img src="' + fastProductImage(p.images[0]?.src) + '" alt="' + esc(p.name) + '"><div><h4>' + esc(p.name) + '</h4><p>' + desc + '</p>' + controls + '</div><b>' + money(line) + '</b></div>';
    }).join("");
    document.getElementById("cartSubtotal").textContent = money(subtotal);
    const se = document.getElementById("cart-shipping"); if (se) se.outerHTML = deliveryMarkup(subtotal, "cart-shipping");
    const dl = document.getElementById("cartDeliveryLabel"); if (dl) dl.textContent = deliveryLabels().delivery;
    box.scrollTop = savedScroll;
  };

  function checkoutItem(row, p) {
    const bundled = !!row.bundleOffer;
    const meta = bundled ? (currentLanguage === "ar" ? "2 من نفس التصميم + هدية مفاجأة" : currentLanguage === "fr" ? "2 fois le même design + 1 cadeau surprise" : "2 of the same design + 1 surprise gift") : money(p.price) + " each";
    const qty = bundled ? '<div class="checkout-item-meta" style="color:#16834b;font-weight:700">' + (currentLanguage === "ar" ? "3 أوشام · هدية مجانية" : currentLanguage === "fr" ? "3 tatouages · 1 cadeau gratuit" : "3 tattoos · 1 free gift") + '</div>' :
      '<div class="checkout-qty"><button type="button" onclick="changeCheckoutQty(' + p.id + ',-1)">−</button><span class="checkout-qty-value" id="checkout-qty-' + p.id + '">' + row.qty + ' pcs</span><button type="button" onclick="changeCheckoutQty(' + p.id + ',1)">+</button></div>';
    const line = bundled ? Number(row.bundlePrice || offerPrice()) : Number(p.price) * Number(row.qty);
    return '<div class="checkout-item" id="checkout-item-' + p.id + '"><img class="checkout-item-image" src="' + fastProductImage(p.images[0]?.src) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async"><div class="checkout-item-info"><div class="checkout-item-name">' + esc(p.name) + '</div><div class="checkout-item-meta">' + meta + '</div>' + qty + '</div><div class="checkout-item-price"><b id="checkout-line-' + p.id + '">' + money(line) + '</b><button type="button" class="checkout-remove" onclick="removeFromCheckout(' + p.id + ')">×</button></div></div>';
  }
  const oldCheckoutView = checkoutView;
  checkoutView = function() {
    let html = oldCheckoutView();
    const start = html.indexOf('<div class="checkout-items">');
    const end = html.indexOf('</div><div class="order-line"><span>Subtotal</span>', start);
    if (start >= 0 && end > start) {
      const items = cart.map(row => { const p = products.find(x => x.id === row.id); return p ? checkoutItem(row, p) : ""; }).join("");
      html = html.slice(0, start) + '<div class="checkout-items">' + items + html.slice(end + 6);
    }
    return html;
  };
  const oldCheckoutQty = changeCheckoutQty;
  changeCheckoutQty = function(id, delta) { if (cart.find(x => x.id === id)?.bundleOffer) return; return oldCheckoutQty(id, delta); };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.includes("/functions/v1/place-cod-order") && init?.body) {
      try {
        const body = JSON.parse(init.body);
        if (body.order && Array.isArray(body.order.p_items)) {
          body.order.p_items = body.order.p_items.map(item => {
            const row = cart.find(x => x.bundleOffer && products.find(p => p.id === x.id)?.dbId === item.product_id);
            return row ? { ...item, bundle_offer: true } : item;
          });
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (err) { console.warn("Could not attach bundle promotion metadata", err); }
    }
    return nativeFetch(input, init);
  };

  const nativeStorageSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (key === "tattooui-last-order") {
      try {
        const info = JSON.parse(value);
        const bundleRows = cart.filter(row => row.bundleOffer);
        for (const row of bundleRows) {
          const p = products.find(x => x.id === row.id);
          if (!p) continue;
          const line = (info.items || []).find(item => item.name === p.name);
          if (line) { line.name = p.name; line.qty = 2; line.total = Number(row.bundlePrice || offerPrice()); }
          info.items = info.items || [];
          info.items.push({ name: "هدية مجانية (مفاجأة)", qty: 1, total: 0 });
          info.discount_amount = Number(info.discount_amount || 0) + Math.max(0, Number(p.price) * 2 - Number(row.bundlePrice || offerPrice()));
        }
        value = JSON.stringify(info);
      } catch (err) { console.warn("Could not update bundle confirmation details", err); }
    }
    return nativeStorageSet.call(this, key, value);
  };

  const originalConfirmationView = confirmationView;
  confirmationView = function(orderNumber) {
    let html = originalConfirmationView(orderNumber);
    try {
      const info = JSON.parse(localStorage.getItem("tattooui-last-order") || "{}");
      if (Number(info.discount_amount) > 0) {
        const subtotalLine = '<div class="order-line"><span>Subtotal</span><span>' + money(info.subtotal) + '</span></div>';
        const discountLine = '<div class="order-line" style="color:#16834b"><span>خصم العرض</span><span>− ' + money(info.discount_amount) + '</span></div>';
        html = html.replace(subtotalLine, subtotalLine + discountLine);
      }
    } catch (err) { console.warn("Could not render bundle discount in confirmation", err); }
    return html;
  };

  document.addEventListener("DOMContentLoaded", refreshConfig, { once: true });
  if (document.readyState !== "loading") refreshConfig();
})();