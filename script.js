/* script.js
   Client-only site logic:
   - 2 product packs (15 & 11 diamonds)
   - Validation: Game ID 9-12 digits, Server ID 4-7 digits
   - Order creation stored in localStorage
   - Checkout: Opens UPI intent, user marks "I have paid"
   - Simple admin page (client-side password)
*/

/* ---------- CONFIG ---------- */
const MERCHANT_UPI = 'd2919139@oksbi';
const MERCHANT_NAME = 'THE FLIX DIAMOND STORE';
const ADMIN_PASSWORD = 'admin123'; // change locally if needed

const PRODUCTS = [
  { id:'pack_15', name:'15 Diamonds', diamonds:15, price:15 },
  { id:'pack_11', name:'11 Diamonds', diamonds:11, price:25 }
];

const ORDERS_KEY = 'tfd_orders_v1';
const CURRENT_ORDER_KEY = 'tfd_current_order';

/* ---------- UTIL ---------- */
function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,10); }
function formatINR(x){ return '₹' + Number(x).toFixed(0); }
function loadOrders(){ try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch(e){ return []; } }
function saveOrders(a){ localStorage.setItem(ORDERS_KEY, JSON.stringify(a)); }

/* ---------- DIAMONDS PAGE ---------- */
(function initDiamondsPage(){
  const grid = document.getElementById('productsGrid');
  if(!grid) return;

  // render products
  PRODUCTS.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'product';
    el.innerHTML = `
      <div>
        <h4>${p.name}</h4>
        <div class="muted">${p.diamonds} diamonds</div>
      </div>
      <div>
        <div class="price">${formatINR(p.price)}</div>
        <div class="cta">
          <div class="muted">Instant delivery</div>
          <button class="btn-primary selectPack" data-id="${p.id}">Select</button>
        </div>
      </div>
    `;
    grid.appendChild(el);
  });

  const buySection = document.getElementById('buySection');
  const packName = document.getElementById('packName');
  const packPrice = document.getElementById('packPrice');
  const gameId = document.getElementById('gameId');
  const serverId = document.getElementById('serverId');
  const buyForm = document.getElementById('buyForm');
  const gameHint = document.getElementById('gameHint');
  const serverHint = document.getElementById('serverHint');
  let selectedPack = null;

  document.querySelectorAll('.selectPack').forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = btn.getAttribute('data-id');
      selectedPack = PRODUCTS.find(x=>x.id===id);
      packName.value = `${selectedPack.name} (${selectedPack.diamonds} diamonds)`;
      packPrice.value = selectedPack.price;
      gameId.value = '';
      serverId.value = '';
      gameHint.textContent = '';
      serverHint.textContent = '';
      buySection.classList.remove('hidden');
      window.scrollTo({top: buySection.offsetTop - 60, behavior:'smooth'});
    });
  });

  document.getElementById('cancelBtn').addEventListener('click', ()=>{
    buySection.classList.add('hidden');
    selectedPack = null;
  });

  function validGameId(v){
    return /^\d{9,12}$/.test(v);
  }
  function validServerId(v){
    return /^\d{4,7}$/.test(v);
  }

  gameId.addEventListener('input', ()=>{
    const v = gameId.value.trim();
    if(v === '') { gameHint.textContent = ''; return; }
    gameHint.textContent = validGameId(v) ? 'Valid Game ID' : 'Game ID must be 9–12 digits';
  });
  serverId.addEventListener('input', ()=>{
    const v = serverId.value.trim();
    if(v === '') { serverHint.textContent = ''; return; }
    serverHint.textContent = validServerId(v) ? 'Valid Server ID' : 'Server ID must be 4–7 digits';
  });

  buyForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(!selectedPack) { alert('Select a pack first'); return; }
    const gid = gameId.value.trim();
    const sid = serverId.value.trim();
    if(!validGameId(gid)){ alert('Game ID must be 9 to 12 digits'); return; }
    if(!validServerId(sid)){ alert('Server ID must be 4 to 7 digits'); return; }

    const order = {
      orderId: uid('ord'),
      packId: selectedPack.id,
      packName: selectedPack.name,
      diamonds: selectedPack.diamonds,
      price: selectedPack.price,
      gameId: gid,
      serverId: sid,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    const orders = loadOrders();
    orders.push(order);
    saveOrders(orders);
    sessionStorage.setItem(CURRENT_ORDER_KEY, order.orderId);
    // redirect to checkout
    window.location.href = 'checkout.html';
  });
})();

/* ---------- CHECKOUT PAGE ---------- */
(function initCheckout(){
  const summary = document.getElementById('orderSummary');
  if(!summary) return;

  const orderId = sessionStorage.getItem(CURRENT_ORDER_KEY);
  if(!orderId){
    summary.innerHTML = `<p class="muted">No active order. Please go to <a href="diamonds.html">Buy Diamonds</a>.</p>`;
    document.getElementById('payActions').classList.add('hidden');
    return;
  }

  const orders = loadOrders();
  const ord = orders.find(o=>o.orderId === orderId);
  if(!ord){
    summary.innerHTML = `<p class="muted">Order not found. Please try again.</p>`;
    document.getElementById('payActions').classList.add('hidden');
    return;
  }

  summary.innerHTML = `
    <h3>Order: ${escapeHtml(ord.orderId)}</h3>
    <p><strong>${escapeHtml(ord.packName)}</strong> — ${ord.diamonds} diamonds</p>
    <p>Price: <strong>${formatINR(ord.price)}</strong></p>
    <p>Game ID: <strong>${escapeHtml(ord.gameId)}</strong></p>
    <p>Server ID: <strong>${escapeHtml(ord.serverId)}</strong></p>
    <p>Status: <strong id="checkoutStatus">${escapeHtml(ord.status)}</strong></p>
  `;

  document.getElementById('openUpiBtn').addEventListener('click', ()=>{
    const amount = ord.price;
    const pa = encodeURIComponent(MERCHANT_UPI);
    const pn = encodeURIComponent(MERCHANT_NAME);
    const tn = encodeURIComponent('Order:' + ord.orderId);
    const upiURI = `upi://pay?pa=${pa}&pn=${pn}&tn=${tn}&am=${encodeURIComponent(amount)}&cu=INR`;
    // Try to open UPI app
    window.location.href = upiURI;
  });

  document.getElementById('paidBtn').addEventListener('click', ()=>{
    // Mark order paid (demo)
    const orders = loadOrders();
    const o = orders.find(x=>x.orderId === orderId);
    if(!o){ alert('Order not found'); return; }
    o.status = 'Paid';
    o.paidAt = new Date().toISOString();
    o.txnId = uid('txn');
    saveOrders(orders);
    // clear current order
    sessionStorage.removeItem(CURRENT_ORDER_KEY);
    // go to success page
    sessionStorage.setItem('last_order_id', o.orderId);
    window.location.href = 'success.html';
  });
})();

/* ---------- SUCCESS PAGE ---------- */
(function initSuccess(){
  const statusCard = document.getElementById('statusCard');
  if(!statusCard) return;
  const id = sessionStorage.getItem('last_order_id') || null;
  if(!id){
    statusCard.innerHTML = `<p class="muted">No recent order found. <a href="diamonds.html">Buy Diamonds</a></p>`;
    return;
  }
  const orders = loadOrders();
  const o = orders.find(x=>x.orderId === id);
  if(!o){
    statusCard.innerHTML = `<p class="muted">Order not found. <a href="diamonds.html">Buy Diamonds</a></p>`;
    return;
  }

  statusCard.innerHTML = `
    <h2>Payment ${o.status === 'Paid' ? 'Successful' : 'Pending'}</h2>
    <p>Order: <strong>${escapeHtml(o.orderId)}</strong></p>
    <p>Pack: <strong>${escapeHtml(o.packName)}</strong></p>
    <p>Game ID: <strong>${escapeHtml(o.gameId)}</strong></p>
    <p>Server ID: <strong>${escapeHtml(o.serverId)}</strong></p>
    <p>Status: <strong>${escapeHtml(o.status)}</strong></p>
    ${o.txnId ? `<p>Txn ID: <strong>${escapeHtml(o.txnId)}</strong></p>` : ''}
  `;
  // optionally keep last_order_id for reference
})();

/* ---------- ADMIN PAGE ---------- */
(function initAdmin(){
  const loginBtn = document.getElementById('adminLoginBtn');
  if(!loginBtn) return;

  const loginBox = document.getElementById('loginBox');
  const ordersPanel = document.getElementById('ordersPanel');
  const ordersList = document.getElementById('ordersList');
  const logoutBtn = document.getElementById('logoutBtn');

  function renderOrders(){
    const orders = loadOrders().slice().reverse();
    if(orders.length === 0){
      ordersList.innerHTML = '<p class="muted">No orders yet.</p>';
      return;
    }
    ordersList.innerHTML = '';
    orders.forEach(o=>{
      const div = document.createElement('div');
      div.className = 'card';
      div.style.marginBottom = '12px';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between; gap:12px;">
          <div>
            <div style="font-weight:700">${escapeHtml(o.orderId)}</div>
            <div class="muted">Created: ${new Date(o.createdAt).toLocaleString()}</div>
            <div style="margin-top:8px">Pack: ${escapeHtml(o.packName)} — ${o.diamonds} diamonds</div>
            <div class="muted" style="margin-top:6px">Game ID: ${escapeHtml(o.gameId)} | Server: ${escapeHtml(o.serverId)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700">${formatINR(o.price)}</div>
            <div style="margin-top:8px">Status: <strong id="st_${o.orderId}">${escapeHtml(o.status)}</strong></div>
            <div style="margin-top:8px">
              <button class="btn-primary markPaid" data-id="${o.orderId}">Mark Paid</button>
              <button class="btn-secondary deleteOrder" data-id="${o.orderId}">Delete</button>
            </div>
          </div>
        </div>
      `;
      ordersList.appendChild(div);
    });

    // handlers
    document.querySelectorAll('.markPaid').forEach(b=>{
      b.addEventListener('click', ()=>{
        const id = b.getAttribute('data-id');
        const orders = loadOrders();
        const o = orders.find(x=>x.orderId === id);
        if(!o) return alert('Order not found');
        o.status = 'Paid';
        o.paidAt = new Date().toISOString();
        o.txnId = o.txnId || uid('txn');
        saveOrders(orders);
        renderOrders();
      });
    });
    document.querySelectorAll('.deleteOrder').forEach(b=>{
      b.addEventListener('click', ()=>{
        const id = b.getAttribute('data-id');
        if(!confirm('Delete order ' + id + '?')) return;
        let orders = loadOrders();
        orders = orders.filter(x=>x.orderId !== id);
        saveOrders(orders);
        renderOrders();
      });
    });
  }

  loginBtn.addEventListener('click', ()=>{
    const pass = document.getElementById('adminPass').value;
    if(pass === ADMIN_PASSWORD){
      loginBox.classList.add('hidden');
      ordersPanel.classList.remove('hidden');
      renderOrders();
    } else {
      alert('Incorrect password');
    }
  });

  logoutBtn.addEventListener('click', ()=>{
    ordersPanel.classList.add('hidden');
    loginBox.classList.remove('hidden');
  });
})();

/* ---------- small utils ---------- */
function escapeHtml(str=''){
  return String(str).replace(/[&<>"']/g, function(m){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
      }
