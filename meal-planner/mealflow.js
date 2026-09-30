/* MealFlow — shared planner engine used by all three visual options.
   Plain JS, no dependencies. Data is kept in localStorage on this device. */
(function () {
  'use strict';

  /* ---------- constants ---------- */
  const START = '2026-09-28', END = '2027-06-30', WIN = 2;
  const SLOT_ORDER = ['B', 'L', 'D'];
  const SLOT = { B: 'Breakfast', L: 'Lunch', D: 'Dinner' };
  const SECTION = { B: 'Breakfast', LD: 'Lunch / Dinner', D: 'Light dinner' };
  const DIET = { veg: 'Veg', egg: 'Egg', chicken: 'Chicken' };
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WINTER_MONTHS = [10, 11, 0, 1]; // Nov–Feb: peas, cauliflower, greens, radish

  /* ---------- date helpers (local time, ISO keys) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
  const diff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
  const inRange = k => k >= START && k <= END;
  const clamp = k => (k < START ? START : k > END ? END : k);
  const TODAY = key(new Date());
  const longDate = k => { const d = parse(k); return `${DOW_LONG[d.getDay()]}, ${d.getDate()} ${MON_LONG[d.getMonth()]} ${d.getFullYear()}`; };
  const shortDate = k => { const d = parse(k); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- seed meal library ---------- */
  function seedMeals() {
    const out = [];
    const add = (slot, group, names, diet, winter) =>
      names.forEach(name => out.push({ id: 'm' + out.length, slot, group, name, diet: diet || 'veg', winter: !!winter }));

    /* Breakfast */
    add('B', 'Indian breakfast', ['Poha with peanuts', 'Vegetable upma', 'Idli with sambar and chutney', 'Masala dosa with sambar', 'Besan chilla with mint chutney', 'Moong dal chilla with paneer filling', 'Vegetable uttapam', 'Dhokla with green chutney', 'Stuffed vegetable sandwich', 'Sprouts chaat']);
    add('B', 'Paratha options', ['Aloo paratha with curd', 'Paneer paratha with curd', 'Gobhi paratha with pickle', 'Mooli paratha with curd', 'Methi paratha with raita', 'Palak paratha with chutney', 'Mixed-vegetable paratha with curd', 'Sattu paratha with pickle', 'Onion paratha with raita']);
    add('B', 'Quick alternatives', ['Oats with milk, fruit and nuts', 'Peanut butter and banana toast', 'Paneer or vegetable wrap', 'Vegetable pasta', 'Leftover roti roll with paneer or sabzi']);
    add('B', 'Egg & chicken breakfast', ['Masala omelette with toast', 'Boiled eggs with toast', 'Egg bhurji with toast', 'Scrambled eggs with multigrain toast'], 'egg');
    add('B', 'Egg & chicken breakfast', ['Chicken sandwich'], 'chicken');

    /* Lunch / Dinner */
    add('LD', 'Potato & mixed vegetable', ['Aloo shimla mirch', 'Aloo methi', 'Aloo gobhi', 'Aloo matar', 'Aloo beans', 'Jeera aloo', 'Dum aloo', 'Aloo tamatar', 'French beans with carrots', 'Patta gobhi matar', 'Patta gobhi aloo', 'Shimla mirch onion masala', 'Bharwa shimla mirch']);
    add('LD', 'Beans, gourds & other vegetables', ['Gawar phali aloo', 'Bhindi masala', 'Bhindi do pyaza', 'Karela pyaz', 'Bharwa karela', 'Arbi masala', 'Arbi ajwain', 'Baingan bharta', 'Bharwa baingan']);
    add('LD', 'Winter sabzis', ['Methi matar', 'Methi malai matar', 'Palak corn', 'Palak chana', 'Aloo palak', 'Sarson ka saag with makki roti', 'Bathua saag', 'Mixed palak–bathua saag', 'Gobhi matar', 'Gobhi aloo', 'Gobhi masala', 'Gajar matar', 'Gajar beans', 'Gajar gobhi matar', 'Mooli ki sabzi', 'Mooli patta sabzi', 'Shalgam matar', 'Shalgam aloo', 'Hara chana masala', 'Matar mushroom', 'Mushroom matar', 'Methi paneer', 'Paneer bhurji with fresh peas'], 'veg', true);
    add('LD', 'Dal & legumes', ['Dal tadka', 'Dal fry', 'Yellow moong dal', 'Moong–masoor mixed dal', 'Masoor dal', 'Toor / arhar dal', 'Chana dal', 'Chana dal with palak', 'Panchmel dal', 'Dal makhani', 'Rajma', 'Chole or kala chana', 'Lobia curry', 'Mixed sprouts curry']);
    add('LD', 'Paneer & rice meals', ['Matar paneer with roti', 'Kadai paneer with roti', 'Paneer bhurji with roti', 'Palak paneer with roti', 'Shahi paneer with roti', 'Vegetable pulao with raita', 'Peas pulao with raita', 'Jeera rice with dal tadka', 'Rajma chawal', 'Chole chawal', 'Kadhi chawal', 'Vegetable biryani with raita', 'Sambar rice', 'Vegetable khichdi with curd']);
    add('LD', 'Pasta', ['Vegetable red-sauce penne', 'White-sauce vegetable pasta', 'Pink-sauce vegetable pasta', 'Garlic-and-olive-oil vegetable spaghetti', 'Pesto pasta with vegetables', 'Paneer tikka pasta', 'Baked vegetable pasta', 'Spinach and corn pasta']);
    add('LD', 'Indo-Chinese', ['Veg fried rice with chilli paneer', 'Hakka noodles with veg Manchurian', 'Schezwan fried rice with stir-fried vegetables', 'Chilli garlic noodles with tofu', 'Veg Manchurian gravy with steamed rice', 'Chilli mushroom with fried rice', 'Honey chilli potato with veg noodles', 'Paneer fried rice with stir-fried beans']);
    add('LD', 'Egg dishes', ['Egg curry with rice', 'Egg bhurji with roti', 'Egg fried rice', 'Anda masala with roti'], 'egg');
    add('LD', 'Chicken dishes', ['Chicken curry with rice', 'Butter chicken with roti', 'Chicken tikka with salad', 'Chicken biryani with raita', 'Chicken stir-fry with roti', 'Chicken keema with roti'], 'chicken');

    /* Lighter dinner */
    add('D', 'Lighter dinner', ['Moong dal khichdi with curd', 'Vegetable daliya with curd', 'Thin dal with one or two phulkas and salad', 'Palak dal with roti', 'Tinda masala with dal and roti', 'Paneer and vegetable stir-fry with roti', 'Vegetable uttapam with sambar']);
    add('D', 'Lighter dinner', ['Boiled egg salad bowl'], 'egg');
    add('D', 'Lighter dinner', ['Grilled chicken with sautéed vegetables'], 'chicken');
    return out;
  }

  /* ---------- state ---------- */
  const LS = 'mealflow.v1';
  function load() { try { const s = JSON.parse(localStorage.getItem(LS)); if (s && Array.isArray(s.meals)) return s; } catch (e) { /* ignore */ } return null; }
  const saved = load();
  const S = saved || { meals: seedMeals(), plan: {}, eaten: {}, diet: 'egg' };
  S.plan = S.plan || {}; S.eaten = S.eaten || {}; S.diet = S.diet || 'egg';
  const persisted = () => ({ meals: S.meals, plan: S.plan, eaten: S.eaten, diet: S.diet });
  function save() { try { localStorage.setItem(LS, JSON.stringify(persisted())); } catch (e) { /* storage blocked */ } }

  const ui = { focus: clamp(TODAY), q: '', slot: '', diet: '', collapsed: new Set() };

  /* ---------- plan helpers ---------- */
  const dayPlan = k => S.plan[k] || {};
  const byId = id => S.meals.find(m => m.id === id);
  const allowed = m => (m.slot === 'B' ? ['B'] : m.slot === 'LD' ? ['L', 'D'] : ['D']);
  const mealsForSlot = s => S.meals.filter(m => allowed(m).includes(s));
  const dietOk = m => m.diet === 'veg' || (m.diet === 'egg' && S.diet !== 'veg') || (m.diet === 'chicken' && S.diet === 'chicken');
  const inSeason = (m, k) => !m.winter || WINTER_MONTHS.includes(parse(k).getMonth());

  function setSlot(k, slot, id) {
    if (!inRange(k)) return;
    (S.plan[k] = S.plan[k] || {})[slot] = id;
    delete S.eaten[k + '|' + slot];
    save();
  }
  function clearSlot(k, slot) {
    if (S.plan[k]) { delete S.plan[k][slot]; if (!Object.keys(S.plan[k]).length) delete S.plan[k]; }
    delete S.eaten[k + '|' + slot];
    save();
  }
  const toggleSlot = (k, slot, id) => (dayPlan(k)[slot] === id ? clearSlot(k, slot) : setSlot(k, slot, id));

  /* ---------- rotation engine ---------- */
  function ctx() {
    const map = Object.fromEntries(S.meals.map(m => [m.id, m]));
    const idx = {}, gidx = {}, nv = [];
    for (const [k, p] of Object.entries(S.plan)) {
      for (const s in p) {
        const m = map[p[s]]; if (!m) continue;
        (idx[m.id] = idx[m.id] || []).push(k);
        (gidx[m.group] = gidx[m.group] || []).push(k);
        if (m.diet !== 'veg') nv.push(k);
      }
    }
    return { map, idx, gidx, nv };
  }
  const minDist = (arr, k) => (arr && arr.length ? Math.min(...arr.map(d => Math.abs(diff(d, k)))) : Infinity);

  /* Higher score = better pick: long gap since the meal was last/next planned,
     different dish family from the neighbouring days, non-veg spaced out. */
  function score(m, k, c, jitter) {
    const gap = minDist(c.idx[m.id], k);
    const gd = minDist(c.gidx[m.group], k);
    let sc = Math.min(gap, 30) * 3;
    if (gd <= 3) sc -= (4 - gd) * 8;
    if (m.diet !== 'veg' && minDist(c.nv, k) <= 2) sc -= 25;
    if (jitter) sc += Math.random() * 6;
    return { sc, gap };
  }
  function suggest(k, slot) {
    const c = ctx(), cur = dayPlan(k)[slot];
    let best = null;
    mealsForSlot(slot).forEach(m => {
      if (m.id === cur || !dietOk(m) || !inSeason(m, k)) return;
      const { sc } = score(m, k, c, true);
      if (!best || sc > best.sc) best = { m, sc };
    });
    return best && best.m;
  }
  function autoPlan(from, days) {
    let n = 0;
    for (let i = 0; i < days; i++) {
      const k = addDays(from, i);
      if (!inRange(k)) break;
      SLOT_ORDER.forEach(s => {
        if (dayPlan(k)[s]) return;
        const m = suggest(k, s);
        if (m) { setSlot(k, s, m.id); n++; }
      });
    }
    return n;
  }

  /* ---------- DOM helpers ---------- */
  const $ = id => document.getElementById(id);
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  const badges = m =>
    (m.diet !== 'veg' ? `<span class="badge ${m.diet}">${DIET[m.diet]}</span>` : '') +
    (m.winter ? '<span class="badge winter">Winter</span>' : '') +
    (m.custom ? '<span class="badge custom">Mine</span>' : '');

  /* ---------- rendering ---------- */
  function renderTop() {
    const f = parse(ui.focus);
    set('rangeLabel', `${shortDate(START)} 2026 – ${shortDate(END)} 2027`);
    set('focusMonth', `${MON_LONG[f.getMonth()]} ${f.getFullYear()}`);
    let h = '';
    for (let i = -WIN; i <= WIN; i++) {
      const k = addDays(ui.focus, i), d = parse(k), p = dayPlan(k), ok = inRange(k);
      h += `<button class="date-card${i === 0 ? ' is-focus' : ''}${k === TODAY ? ' is-today' : ''}${ok ? '' : ' is-out'}" data-act="focus" data-date="${k}" aria-label="${longDate(k)}">
        <span class="dow">${DOW[d.getDay()]}</span><span class="num">${pad(d.getDate())}</span>
        <span class="mon">${MON[d.getMonth()]}</span>${k === TODAY ? '<span class="pill">Today</span>' : ''}
        <span class="dots">${SLOT_ORDER.map(s => `<i class="${s}${p[s] ? ' on' : ''}" title="${SLOT[s]}"></i>`).join('')}</span></button>`;
    }
    set('focusStrip', h);
    const dp = $('datePick'); if (dp) { dp.min = START; dp.max = END; dp.value = ui.focus; }
  }

  function renderPlan() {
    const k = ui.focus, p = dayPlan(k), c = ctx();
    let h = `<div class="plan-head"><h2>${k === TODAY ? 'Today’s meal plan' : 'Meal plan'}</h2><small>${longDate(k)}</small></div><div class="plan-rows">`;
    SLOT_ORDER.forEach(s => {
      const m = c.map[p[s]];
      if (m) {
        const eaten = !!S.eaten[k + '|' + s];
        h += `<div class="plan-row s-${s}${eaten ? ' eaten' : ''}"><span class="tag ${s}">${SLOT[s]}</span>
          <div class="plan-item"><b>${esc(m.name)}</b><small>${esc(m.group)} · ${DIET[m.diet]}${eaten ? ' · eaten ✓' : ''}</small></div>
          <div class="plan-actions">
            <button class="ico" data-act="eat" data-date="${k}" data-slot="${s}" aria-pressed="${eaten}" title="Mark as eaten"${k > TODAY ? ' disabled' : ''}>✓</button>
            <button class="ico" data-act="suggest" data-date="${k}" data-slot="${s}" title="Suggest another">↻</button>
            <button class="ico" data-act="pick" data-date="${k}" data-slot="${s}" title="Choose a meal">✎</button>
            <button class="ico" data-act="clear" data-date="${k}" data-slot="${s}" title="Clear">✕</button></div></div>`;
      } else {
        h += `<div class="plan-row s-${s}"><span class="tag ${s}">${SLOT[s]}</span>
          <div class="plan-item empty"><b>Nothing planned yet</b><small>Let MealFlow suggest one, or pick your own</small></div>
          <div class="plan-actions"><button class="btn small" data-act="suggest" data-date="${k}" data-slot="${s}">Suggest</button>
          <button class="btn small ghost" data-act="pick" data-date="${k}" data-slot="${s}">Choose</button></div></div>`;
      }
    });
    set('plan', h + '</div>');
  }

  function renderAgenda() {
    const c = ctx(), days = [], count = {};
    for (let i = 0; i < 7; i++) {
      const k = addDays(ui.focus, i); if (!inRange(k)) break;
      days.push(k); SLOT_ORDER.forEach(s => { const id = dayPlan(k)[s]; if (id) count[id] = (count[id] || 0) + 1; });
    }
    let h = `<table class="agenda"><thead><tr><th>Day</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th></tr></thead><tbody>`;
    days.forEach((k, i) => {
      h += `<tr class="${i === 0 ? 'is-focus' : ''}" data-act="focus" data-date="${k}"><td><b>${shortDate(k)}</b>${k === TODAY ? ' <span class="pill">Today</span>' : ''}</td>`;
      SLOT_ORDER.forEach(s => {
        const id = dayPlan(k)[s], m = c.map[id];
        h += m ? `<td class="${count[id] > 1 ? 'rep' : ''}${S.eaten[k + '|' + s] ? ' done' : ''}" title="${count[id] > 1 ? 'Repeats this week' : ''}">${esc(m.name)}</td>` : '<td class="none">—</td>';
      });
      h += '</tr>';
    });
    set('agenda', h + '</tbody></table>');
  }

  function renderStats() {
    const c = ctx(); let planned = 0, total = 0, ids = new Set(), rep = 0;
    for (let i = 0; i < 7; i++) {
      const k = addDays(ui.focus, i); if (!inRange(k)) break;
      SLOT_ORDER.forEach(s => { total++; const id = dayPlan(k)[s]; if (id && c.map[id]) { planned++; if (ids.has(id)) rep++; ids.add(id); } });
    }
    const p = dayPlan(ui.focus), fp = SLOT_ORDER.filter(s => p[s]).length, fe = SLOT_ORDER.filter(s => S.eaten[ui.focus + '|' + s]).length;
    const tile = (lbl, val, sub, pct) => `<div class="card stat"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="bar"><i style="width:${pct}%"></i></div><div class="sub">${sub}</div></div>`;
    set('stats',
      tile('Planned · next 7 days', `${planned}<small>/${total}</small>`, planned === total ? 'Every meal is booked' : `${total - planned} meals still open`, total ? planned / total * 100 : 0) +
      tile(ui.focus === TODAY ? 'Eaten today' : 'Eaten that day', `${fe}<small>/${fp}</small>`, fp ? 'Tick meals off as you eat them' : 'Nothing planned for this day', fp ? fe / fp * 100 : 0) +
      tile('Variety · 7 days', `${ids.size}<small> dishes</small>`, rep ? `${rep} repeat${rep > 1 ? 's' : ''} — use ↻ to rotate` : 'No repeats — well rotated', planned ? ids.size / planned * 100 : 0));
  }

  const slotVisible = m => !ui.slot || allowed(m).includes(ui.slot);
  function renderBoard() {
    const cols = [];
    for (let i = -WIN; i <= WIN; i++) cols.push(addDays(ui.focus, i));
    set('boardHead', `<th class="meal-col">Meal option</th>` + cols.map((k, i) => {
      const d = parse(k);
      return `<th class="date-h${i === WIN ? ' is-focus' : ''}${k === TODAY ? ' is-today' : ''}${inRange(k) ? '' : ' is-out'}">${DOW[d.getDay()]}<b>${d.getDate()} ${MON[d.getMonth()]}</b>${k === TODAY ? '<span class="pill">Today</span>' : ''}</th>`;
    }).join(''));

    const q = ui.q.trim().toLowerCase();
    const list = S.meals.filter(m => slotVisible(m) && (!ui.diet || m.diet === ui.diet) && (!q || (m.name + ' ' + m.group).toLowerCase().includes(q)));
    set('mealCount', `${list.length} meal option${list.length === 1 ? '' : 's'}`);
    const secs = new Map();
    list.forEach(m => {
      if (!secs.has(m.slot)) secs.set(m.slot, new Map());
      const g = secs.get(m.slot); if (!g.has(m.group)) g.set(m.group, []); g.get(m.group).push(m);
    });
    let h = '';
    ['B', 'LD', 'D'].forEach(sl => {
      if (!secs.has(sl)) return;
      h += `<tr class="sec"><td colspan="6">${SECTION[sl]}</td></tr>`;
      secs.get(sl).forEach((ms, group) => {
        const gk = sl + '|' + group, closed = !q && ui.collapsed.has(gk);
        h += `<tr class="grp"><td colspan="6" data-act="grp" data-key="${esc(gk)}"><span class="caret">${closed ? '▸' : '▾'}</span> ${esc(group)} <span class="n">${ms.length}</span></td></tr>`;
        if (closed) return;
        ms.forEach(m => {
          h += `<tr class="meal-row"><th class="meal-cell" scope="row"><div class="meal-flex"><div><div class="meal-name">${esc(m.name)}${badges(m)}</div></div>
            <button class="rm" data-act="rm" data-id="${m.id}" title="Remove this meal option" aria-label="Remove ${esc(m.name)}">✕</button></div></th>`;
          cols.forEach((k, i) => {
            const p = dayPlan(k), ok = inRange(k);
            const chips = SLOT_ORDER.filter(s => p[s] === m.id).map(s => `<span class="chip ${s}${S.eaten[k + '|' + s] ? ' eaten' : ''}">${SLOT[s]}</span>`).join('');
            h += `<td class="cell-td${i === WIN ? ' is-focus' : ''}${k === TODAY ? ' is-today' : ''}"><button class="cell${ok ? '' : ' off'}${chips ? ' has' : ''}" data-act="cell" data-date="${k}" data-id="${m.id}" aria-label="Plan ${esc(m.name)} on ${longDate(k)}">${chips || '<span class="plus">＋</span>'}</button></td>`;
          });
          h += '</tr>';
        });
      });
    });
    if (!h) h = '<tr><td colspan="6" class="empty-board">No meals match. Try a different search or filter — or add your own with “Add meal”.</td></tr>';
    set('boardBody', h);
    const cb = $('btnCollapse'); if (cb) cb.textContent = ui.collapsed.size ? 'Expand all' : 'Collapse all';
  }

  function render() { renderTop(); renderPlan(); renderAgenda(); renderStats(); renderBoard(); }

  /* ---------- toast, undo ---------- */
  let toastTimer;
  function toast(msg, undo) {
    let t = $('mfToast');
    if (!t) { t = document.createElement('div'); t.id = 'mfToast'; t.className = 'mf-toast'; document.body.appendChild(t); }
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-act="undo">Undo</button>' : ''}`;
    t._undo = undo; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 7000);
  }
  function commit(fn) {
    const snap = JSON.stringify(persisted());
    const msg = fn(); save(); render();
    if (msg) toast(msg, () => { Object.assign(S, JSON.parse(snap)); save(); render(); });
  }

  /* ---------- popover menu (cell click on Lunch/Dinner meals) ---------- */
  function closeMenu() { const m = document.querySelector('.mf-menu'); if (m) m.remove(); }
  function openMenu(btn, k, m) {
    closeMenu();
    const p = dayPlan(k), menu = document.createElement('div'); menu.className = 'mf-menu';
    menu.innerHTML = `<div class="mf-menu-title">${esc(m.name)}<small>${shortDate(k)}</small></div>` + allowed(m).map(s => {
      const cur = p[s], mine = cur === m.id, other = cur && !mine ? byId(cur) : null;
      return `<button class="${mine ? 'on' : ''}" data-act="menuset" data-date="${k}" data-slot="${s}" data-id="${m.id}"><span>${mine ? '✓ ' : ''}${mine ? 'Booked for ' : 'Book for '}${SLOT[s].toLowerCase()}${other ? `<small>replaces ${esc(other.name)}</small>` : ''}${mine ? '<small>click to remove</small>' : ''}</span></button>`;
    }).join('');
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect(), w = menu.offsetWidth, hgt = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
    menu.style.top = (r.bottom + hgt + 12 > innerHeight ? Math.max(8, r.top - hgt - 6) : r.bottom + 6) + 'px';
  }

  /* ---------- modal (add meal / choose meal) ---------- */
  function modalEl() {
    let m = $('mfModal');
    if (!m) {
      m = document.createElement('div'); m.id = 'mfModal'; m.className = 'mf-modal';
      m.innerHTML = '<div class="mf-dialog" role="dialog" aria-modal="true"></div>';
      m.addEventListener('mousedown', e => { if (e.target === m) closeModal(); });
      document.body.appendChild(m);
    }
    return m;
  }
  const closeModal = () => { const m = $('mfModal'); if (m) m.classList.remove('show'); };
  function showModal(html) { const m = modalEl(); m.querySelector('.mf-dialog').innerHTML = html; m.classList.add('show'); }

  function openAdd() {
    const groups = [...new Set(S.meals.map(m => m.group))];
    showModal(`<h3>Add a meal option</h3><p>Any vegetarian, egg or chicken dish — it joins the rotation straight away.</p>
      <label for="addName">Meal name</label><input class="field" id="addName" placeholder="e.g. Chicken curry with rice" autocomplete="off">
      <label for="addSlot">Serve as</label><select class="field" id="addSlot"><option value="B">Breakfast</option><option value="LD" selected>Lunch / Dinner</option><option value="D">Light dinner</option></select>
      <label for="addGroup">Category</label><input class="field" id="addGroup" list="grpList" placeholder="e.g. Paneer & rice meals" autocomplete="off"><datalist id="grpList">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>
      <label for="addDiet">Type</label><select class="field" id="addDiet"><option value="veg">Vegetarian</option><option value="egg">Egg</option><option value="chicken">Chicken</option></select>
      <label class="check"><input type="checkbox" id="addWinter"> Winter-only (only suggested Nov–Feb)</label>
      <div class="mf-actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="saveMeal">Save meal</button></div>`);
    setTimeout(() => { const n = $('addName'); if (n) n.focus(); }, 30);
  }
  function saveMeal() {
    const name = $('addName').value.trim(); if (!name) { $('addName').focus(); return; }
    const slot = $('addSlot').value, group = $('addGroup').value.trim() || 'My meals';
    if (S.meals.some(m => m.slot === slot && m.name.toLowerCase() === name.toLowerCase())) { toast('That meal is already in the list.'); return; }
    S.meals.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), slot, group, name, diet: $('addDiet').value, winter: $('addWinter').checked, custom: true });
    save(); closeModal(); ui.q = ''; if ($('search')) $('search').value = ''; ui.collapsed.delete(slot + '|' + group); render();
    toast(`Added “${name}” to ${group}.`);
  }
  function removeMeal(id) {
    const m = byId(id); if (!m) return;
    commit(() => {
      S.meals = S.meals.filter(x => x.id !== id);
      for (const k of Object.keys(S.plan)) for (const s of Object.keys(S.plan[k])) if (S.plan[k][s] === id) clearSlot(k, s);
      return `Removed “${m.name}” and its bookings.`;
    });
  }

  function openPicker(k, slot) {
    showModal(`<h3>Choose ${SLOT[slot].toLowerCase()}</h3><p>${longDate(k)} · meals you haven’t had for the longest come first.</p>
      <input class="field" id="pickQ" placeholder="Search meals…" autocomplete="off"><div class="pick-list" id="pickList"></div>
      <div class="mf-actions"><button class="btn" data-act="close">Close</button></div>`);
    const c = ctx(), items = mealsForSlot(slot).map(m => Object.assign({ m, ok: inSeason(m, k) }, score(m, k, c, false))).sort((a, b) => (b.ok - a.ok) || (b.sc - a.sc));
    const draw = () => {
      const q = $('pickQ').value.trim().toLowerCase();
      $('pickList').innerHTML = items.filter(i => !q || (i.m.name + ' ' + i.m.group).toLowerCase().includes(q)).map(i => {
        const g = i.gap === Infinity ? 'Not planned nearby' : i.gap === 0 ? 'Already planned this day' : `${i.gap} day${i.gap > 1 ? 's' : ''} from nearest`;
        const cls = i.gap === Infinity || i.gap >= 7 ? 'good' : i.gap < 4 ? 'warn' : '';
        return `<button class="pick-item" data-act="pickset" data-date="${k}" data-slot="${slot}" data-id="${i.m.id}"><span><b>${esc(i.m.name)}</b>${badges(i.m)}<small>${esc(i.m.group)}${i.ok ? '' : ' · off-season'}</small></span><span class="gap ${cls}">${g}</span></button>`;
      }).join('') || '<div class="empty-board">No matches.</div>';
    };
    draw(); $('pickQ').addEventListener('input', draw);
    setTimeout(() => $('pickQ').focus(), 30);
  }

  /* ---------- navigation ---------- */
  function setFocus(k) { ui.focus = clamp(k); render(); }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    if (!e.target.closest('.mf-menu') && !e.target.closest('[data-act="cell"]')) closeMenu();
    const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
    const d = t.dataset;
    switch (d.act) {
      case 'focus': setFocus(d.date); break;
      case 'cell': {
        const m = byId(d.id), sl = allowed(m);
        if (sl.length === 1) { toggleSlot(d.date, sl[0], d.id); render(); } else openMenu(t, d.date, m);
        break;
      }
      case 'menuset': closeMenu(); toggleSlot(d.date, d.slot, d.id); render(); break;
      case 'grp': ui.collapsed.has(d.key) ? ui.collapsed.delete(d.key) : ui.collapsed.add(d.key); renderBoard(); break;
      case 'rm': removeMeal(d.id); break;
      case 'eat': S.eaten[d.date + '|' + d.slot] ? delete S.eaten[d.date + '|' + d.slot] : (S.eaten[d.date + '|' + d.slot] = 1); save(); render(); break;
      case 'suggest': {
        const m = suggest(d.date, d.slot);
        if (m) { setSlot(d.date, d.slot, m.id); render(); } else toast('No other suitable meal found for this slot.');
        break;
      }
      case 'clear': clearSlot(d.date, d.slot); render(); break;
      case 'pick': openPicker(d.date, d.slot); break;
      case 'pickset': setSlot(d.date, d.slot, d.id); closeModal(); render(); break;
      case 'saveMeal': saveMeal(); break;
      case 'close': closeModal(); break;
      case 'undo': { const tt = $('mfToast'); if (tt && tt._undo) { tt._undo(); tt.classList.remove('show'); } break; }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeMenu(); closeModal(); return; }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || $('mfModal') && $('mfModal').classList.contains('show')) return;
    if (e.key === 'ArrowLeft') setFocus(addDays(ui.focus, -1));
    if (e.key === 'ArrowRight') setFocus(addDays(ui.focus, 1));
  });
  window.addEventListener('wheel', e => { if (!e.target.closest || !e.target.closest('.mf-menu')) closeMenu(); }, { passive: true });
  window.addEventListener('touchmove', closeMenu, { passive: true });

  on('btnPrev', 'click', () => setFocus(addDays(ui.focus, -1)));
  on('btnNext', 'click', () => setFocus(addDays(ui.focus, 1)));
  on('btnToday', 'click', () => setFocus(TODAY));
  on('datePick', 'change', e => e.target.value && setFocus(e.target.value));
  on('btnAdd', 'click', openAdd);
  on('search', 'input', e => { ui.q = e.target.value; renderBoard(); });
  on('fSlot', 'change', e => { ui.slot = e.target.value; renderBoard(); });
  on('fDiet', 'change', e => { ui.diet = e.target.value; renderBoard(); });
  on('dietPref', 'change', e => { S.diet = e.target.value; save(); });
  on('btnAuto', 'click', () => commit(() => {
    const n = autoPlan(ui.focus, 7);
    return n ? `Filled ${n} open meal${n > 1 ? 's' : ''} over the next 7 days.` : 'All meals for the next 7 days are already planned.';
  }));
  on('btnClear', 'click', () => commit(() => {
    let n = 0;
    for (let i = 0; i < 7; i++) { const k = addDays(ui.focus, i); SLOT_ORDER.forEach(s => { if (dayPlan(k)[s]) { clearSlot(k, s); n++; } }); }
    return n ? `Cleared ${n} planned meal${n > 1 ? 's' : ''}.` : 'Nothing to clear in the next 7 days.';
  }));
  on('btnCollapse', 'click', () => {
    if (ui.collapsed.size) ui.collapsed.clear(); else S.meals.forEach(m => ui.collapsed.add(m.slot + '|' + m.group));
    renderBoard();
  });
  on('btnReset', 'click', () => commit(() => { S.meals = seedMeals(); S.plan = {}; S.eaten = {}; ui.collapsed.clear(); return 'Reset to the starter meal list and an empty plan.'; }));

  /* ---------- boot ---------- */
  const dp = $('dietPref'); if (dp) dp.value = S.diet;
  if (!saved) { autoPlan(clamp(TODAY), 7); save(); } // first run: sample week so the screens aren't empty
  render();
  window.MealFlow = { S, ui, suggest, autoPlan, render };
})();
