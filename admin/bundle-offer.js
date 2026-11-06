(() => {
  const form = document.getElementById("settingsForm");
  if (!form || document.getElementById("bundleOfferAdminCard")) return;

  const card = document.createElement("div");
  card.className = "card";
  card.id = "bundleOfferAdminCard";
  card.style.margin = "14px 0";
  card.innerHTML = '<h3 style="margin-top:0">عرض اشترِ 2 واحصل على 1 مجاناً</h3>' +
    '<p class="muted">فعّل العرض، حدّد تصاميم الوشم المشمولة، واضبط ثمن العرض. الهدية تبقى مفاجأة ويختارها فريقك عند تجهيز الطلب.</p>' +
    '<label style="display:flex;align-items:center;gap:9px"><input id="bundleOfferEnabled" type="checkbox" style="width:auto"> تفعيل العرض</label>' +
    '<label for="bundleOfferPrice">ثمن العرض (درهم)</label><input id="bundleOfferPrice" type="number" min="1" step="0.01" value="99">' +
    '<div style="margin-top:14px"><b>اختيار تصاميم الوشم</b><p class="hint">اختر المنتجات التي يظهر عليها العرض. يجب أن يكون ثمن قطعتين بالسعر العادي أكبر من ثمن العرض.</p><div id="bundleOfferProductChecks" class="collection-checks"></div></div>' +
    '<div class="actions" style="margin-top:14px"><button type="button" id="saveBundleOffer">حفظ العرض</button></div><p id="bundleOfferMessage" class="hint"></p>';
  form.parentNode.insertBefore(card, form);

  function selectedIds() {
    return [...card.querySelectorAll('input[data-bundle-product]:checked')].map(el => el.value);
  }
  function renderProductChecks(selected = []) {
    const host = document.getElementById("bundleOfferProductChecks");
    if (!host) return;
    const offerPrice = Math.max(0, Number(document.getElementById("bundleOfferPrice").value || 99));
    const rows = (products || []).filter(p => p.status === "active");
    host.innerHTML = rows.map(p => {
      const eligible = Number(p.price) * 2 > offerPrice;
      const checked = selected.includes(p.id);
      return '<label class="collection-check" style="align-items:flex-start;opacity:' + (eligible ? "1" : ".55") + '">' +
        '<input type="checkbox" data-bundle-product value="' + esc(p.id) + '" ' + (checked && eligible ? "checked" : "") + ' ' + (eligible ? "" : "disabled") + '>' +
        '<span><b>' + esc(p.name) + '</b><small style="display:block;color:#777">' + num(p.price) + ' DH · Stock: ' + num(p.stock) +
        (eligible ? "" : ' · ثمن العرض ليس أقل من ثمن قطعتين') + '</small></span></label>';
    }).join("") || '<p class="muted">لا توجد منتجات نشطة.</p>';
  }

  async function loadBundleOfferSettings() {
    const msg = document.getElementById("bundleOfferMessage");
    const { data, error } = await db.from("site_settings")
      .select("bundle_offer_enabled,bundle_offer_price,bundle_offer_product_ids")
      .eq("id", true).maybeSingle();
    if (error) { if (msg) msg.textContent = error.message; return; }
    const s = data || {};
    document.getElementById("bundleOfferEnabled").checked = !!s.bundle_offer_enabled;
    document.getElementById("bundleOfferPrice").value = s.bundle_offer_price ?? 99;
    renderProductChecks(Array.isArray(s.bundle_offer_product_ids) ? s.bundle_offer_product_ids : []);
    if (msg) msg.textContent = "";
  }

  document.getElementById("bundleOfferPrice").addEventListener("input", () => renderProductChecks(selectedIds()));
  document.getElementById("saveBundleOffer").addEventListener("click", async () => {
    const msg = document.getElementById("bundleOfferMessage");
    const button = document.getElementById("saveBundleOffer");
    const enabled = document.getElementById("bundleOfferEnabled").checked;
    const offerPrice = Number(document.getElementById("bundleOfferPrice").value);
    const ids = selectedIds();
    if (!Number.isFinite(offerPrice) || offerPrice <= 0) { msg.textContent = "أدخل ثمناً صحيحاً أكبر من صفر."; return; }
    if (enabled && !ids.length) { msg.textContent = "اختر تصميماً واحداً على الأقل قبل تفعيل العرض."; return; }
    const invalid = ids.find(id => { const p = products.find(x => x.id === id); return !p || Number(p.price) * 2 <= offerPrice; });
    if (invalid) { msg.textContent = "ثمن العرض يجب أن يكون أقل من ثمن قطعتين لكل تصميم مختار."; return; }
    button.disabled = true; button.textContent = "جارٍ الحفظ...";
    const { error } = await db.from("site_settings").update({
      bundle_offer_enabled: enabled,
      bundle_offer_price: offerPrice,
      bundle_offer_product_ids: ids,
      updated_at: new Date().toISOString()
    }).eq("id", true);
    button.disabled = false; button.textContent = "حفظ العرض";
    if (error) { msg.textContent = "تعذر حفظ العرض: " + error.message; return; }
    msg.textContent = "تم حفظ العرض بنجاح ✓";
    await loadBundleOfferSettings();
  });

  const originalLoadAll = loadAll;
  loadAll = async function() {
    await originalLoadAll();
    await loadBundleOfferSettings();
  };

  const originalRenderOrderDetail = renderOrderDetail;
  renderOrderDetail = function(id) {
    originalRenderOrderDetail(id);
    const order = (orders || []).find(o => o.id === id);
    const gifts = (orderItems || []).filter(i => i.order_id === id && i.is_gift);
    const host = document.getElementById("orderDetail");
    if (!host || !gifts.length) return;
    const panel = document.createElement("div");
    panel.className = "order-info";
    panel.style.marginTop = "12px";
    panel.innerHTML = '<h3 style="margin-top:0">🎁 الهدية المجانية</h3>' +
      gifts.map(item => {
        if (item.product_id) return '<p><b>تم اختيار الهدية:</b> ' + esc(item.product_name) + ' ✓</p>';
        const options = (products || []).filter(p => p.status === "active" && Number(p.stock) > 0)
          .map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + ' — مخزون ' + num(p.stock) + '</option>').join("");
        const locked = order && ["cancelled", "returned"].includes(order.status);
        return '<p>لم يتم اختيار تصميم الهدية بعد. اختر التصميم عند تجهيز الطلب:</p>' +
          '<div class="formgrid"><select id="giftDesign-' + esc(item.id) + '" ' + (locked ? "disabled" : "") + '><option value="">اختر تصميم الهدية</option>' + options + '</select>' +
          '<button type="button" onclick="assignTattoouiOrderGift(\'' + esc(item.id) + '\')" ' + (locked ? "disabled" : "") + '>تأكيد اختيار الهدية</button></div>';
      }).join("");
    host.appendChild(panel);
  };

  window.assignTattoouiOrderGift = async function(itemId) {
    const select = document.getElementById("giftDesign-" + itemId);
    const productId = select?.value;
    if (!productId) { alert("اختر تصميم الهدية أولاً."); return; }
    const button = select.parentElement.querySelector("button");
    button.disabled = true; button.textContent = "جارٍ الحفظ...";
    const { error } = await db.rpc("assign_order_gift", {
      p_order_item_id: itemId,
      p_gift_product_id: productId
    });
    if (error) {
      alert("تعذر تسجيل الهدية: " + error.message);
      button.disabled = false; button.textContent = "تأكيد اختيار الهدية";
      return;
    }
    await loadProducts();
    await loadOrders();
    renderOrderDetail((orderItems || []).find(i => i.id === itemId)?.order_id || window.selectedOrderId);
  };

  const originalStart = start;
  start = async function() {
    await originalStart();
    await loadBundleOfferSettings();
  };
})();