const API = "https://www.fruityvice.com/api/fruit/all";
const URLS = [
  API,
  "https://corsproxy.io/?" + encodeURIComponent(API),
  "https://api.allorigins.win/raw?url=" + encodeURIComponent(API),
];
const tagBar = document.getElementById("tagBar");
const searchInput = document.getElementById("searchInput");
const statusDiv = document.getElementById("status");
const resultsDiv = document.getElementById("results");
const acBox = document.getElementById("acBox");
let fruits = [];
let tags = [];
let acItems = [];
let acIndex = -1;
let uiStep = 0;
let uiField = "";
function clean(text) {
  return String(text || "").toLowerCase().trim();
}
function getFieldValue(fruit, field) {
  if (field == "calories") 
    return fruit?.nutritions?.calories;
  if (field == "protein") 
    return fruit?.nutritions?.protein;
  return fruit?.[field];
}
function parseTerm(term) {
  const raw = String(term ?? "").trim();
  const t = clean(raw);
  if (!t) 
    return { field: "", value: "", mode: "includes", op: "" };

  const numOp = raw.match(
    /^\s*(calories|protein)\s*(>=|<=|!=|=|>|<)\s*([+-]?\d+(?:\.\d+)?)\s*$/i
  );
  if (numOp) {
    return {
      field: clean(numOp[1]),
      value: numOp[3],
      mode: "number",
      op: numOp[2],
    };
  }
  const sw = raw.match(/^\s*(name|family|genus|order)?\s*starts with\s+(.+)\s*$/i);
  if (sw) {
    return { field: clean(sw[1] || ""), value: sw[2], mode: "starts", op: "" };
  }

  const ew = raw.match(/^\s*(name|family|genus|order)?\s*ends with\s+(.+)\s*$/i);
  if (ew) {
    return { field: clean(ew[1] || ""), value: ew[2], mode: "ends", op: "" };
  }
  const inc = raw.match(/^\s*(name|family|genus|order)?\s*includes\s+(.+)\s*$/i);
  if (inc) {
    return { field: clean(inc[1] || ""), value: inc[2], mode: "includes", op: "" };
  }
  const parts = t.split(/\s+/);
  const field = parts[0];
  const allowed = ["name", "family", "genus", "order", "calories", "protein"];
  if (allowed.includes(field) && parts.length > 1) {
    return { field: field, value: parts.slice(1).join(" "), mode: "includes", op: "" };
  }
  return { field: "", value: raw, mode: "includes", op: "" };
}
function fruitMatchesTerm(fruit, field, value, mode, op) {
  const vRaw = String(value ?? "").trim();
  const v = clean(vRaw);
  if (!v) 
    return true;
  if ((field == "calories" || field == "protein") && mode == "number") {
    const left = Number(getFieldValue(fruit, field));
    const right = Number(vRaw);
    if (!Number.isFinite(left) || !Number.isFinite(right)) 
      return false;
    if (op == ">") 
      return left > right;
    if (op == ">=") 
      return left >= right;
    if (op == "<") 
      return left < right;
    if (op == "<=") 
      return left <= right;
    if (op == "=") 
      return left == right;
    if (op == "!=") 
      return left !== right;
    return false;
  }
  function matchesText(text) {
    const s = clean(text);
    if (mode == "starts") 
      return s.startsWith(v);
    if (mode == "ends") 
      return s.endsWith(v);
    return s.includes(v);
  }
  if (field) 
    return matchesText(getFieldValue(fruit, field));
  return (
    matchesText(fruit.name) ||
    matchesText(fruit.family) ||
    matchesText(fruit.genus) ||
    matchesText(fruit.order) ||
    matchesText(fruit?.nutritions?.calories) ||
    matchesText(fruit?.nutritions?.protein)
  );
}
function fruitMatchesTagExpression(fruit, expression) {
  const exp = clean(expression);
  if (!exp) 
    return true;
  const orParts = exp.split(/\s+or\s+/);
  for (let i = 0; i < orParts.length; i++) {
    const andParts = orParts[i].split(/\s+and\s+/);
    let andOk = true;
    for (let j = 0; j < andParts.length; j++) {
      const term = andParts[j];
      const parsed = parseTerm(term);
      if (!fruitMatchesTerm(fruit, parsed.field, parsed.value, parsed.mode, parsed.op)) {
        andOk = false;
        break;
      }
    }
    if (andOk) return true;
  }
  return false;
}
function fruitPassesAllTags(fruit) {
  if (tags.length == 0) 
    return true;
  for (let i = 0; i < tags.length; i++) {
    if (fruitMatchesTagExpression(fruit, tags[i])) 
      return true;
  }
  return false;
}
function fruitMatchesLiveText(fruit, text) {
  const q = String(text ?? "").trim();
  if (clean(q) == "") 
    return true;
  const parsed = parseTerm(q);
  if (parsed.field) {
    return fruitMatchesTerm(fruit, parsed.field, parsed.value, parsed.mode, parsed.op);
  }
  const v = clean(q);
  return (
    clean(fruit.name).includes(v) ||
    clean(fruit.family).includes(v) ||
    clean(fruit.genus).includes(v) ||
    clean(fruit.order).includes(v) ||
    clean(fruit?.nutritions?.calories).includes(v) ||
    clean(fruit?.nutritions?.protein).includes(v)
  );
}
function getFilteredFruits() {
  const live = searchInput.value;
  const out = [];
  for (let i = 0; i < fruits.length; i++) {
    const f = fruits[i];
    if (!fruitPassesAllTags(f))
       continue;
    if (!fruitMatchesLiveText(f, live)) 
      continue;
    out.push(f);
  }
  return out;
}
function renderResults(list) {
  resultsDiv.innerHTML = "";
  if (list.length == 0) {
    resultsDiv.innerHTML = `<div class="empty">No matches.</div>`;
    return;
  }
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const calories = f?.nutritions?.calories ?? "—";
    const protein = f?.nutritions?.protein ?? "—";
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="name">${f.name}</div>
      <div class="meta">
        <span class="badge">Family: ${f.family}</span>
        <span class="badge">Genus: ${f.genus}</span>
        <span class="badge">Order: ${f.order}</span>
        <span class="badge">Calories: ${calories}</span>
        <span class="badge">Protein: ${protein} g</span>
      </div>
    `;
    resultsDiv.appendChild(el);
  }
}
function makeTagEl(text, index) {
  const t = document.createElement("span");
  t.className = "tag";
  const label = document.createElement("span");
  label.className = "tagText";
  label.textContent = text;
  const x = document.createElement("button");
  x.type = "button";
  x.className = "tagX";
  x.textContent = "×";
  label.addEventListener("click", function () {
    const removed = tags.splice(index, 1)[0];
    renderTags();
    searchInput.value = removed;
    searchInput.focus();
    refresh();
    updateAutocomplete();
  });
  x.addEventListener("click", function () {
    tags.splice(index, 1);
    renderTags();
    refresh();
    updateAutocomplete();
  });
  t.appendChild(label);
  t.appendChild(x);
  return t;
}
function renderTags() {
  tagBar.innerHTML = "";
  for (let i = 0; i < tags.length; i++) {
    tagBar.appendChild(makeTagEl(tags[i], i));
  }
}
function addTagFromInput() {
  const text = searchInput.value.trim();
  if (text == "") 
    return;
  tags.push(text);
  searchInput.value = "";
  renderTags();
  refresh();
  hideAutocomplete();
}
function refresh() {
  renderResults(getFilteredFruits());
}
function getLastToken(text) {
  const s = String(text || "");
  const lower = s.toLowerCase();
  const i1 = lower.lastIndexOf(" and ");
  const i2 = lower.lastIndexOf(" or ");
  const cut = Math.max(i1, i2);
  if (cut == -1) 
    return s.trim();
  return s.slice(cut + 4).trim();
}
function buildSuggestions(inputText) {
  const token = clean(getLastToken(inputText));
  if (!token)
    return [];
  const fields = ["name", "family", "genus", "order", "calories", "protein"];
  const fieldSug = [];
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].startsWith(token)) fieldSug.push(fields[i] + " ");
  }
  if (fieldSug.length) 
    return fieldSug.slice(0, 8);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < fruits.length; i++) {
    const f = fruits[i];
    const candidates = [
      f.name,
      f.family,
      f.genus,
      f.order,
      String(f?.nutritions?.calories ?? ""),
      String(f?.nutritions?.protein ?? ""),
    ];
    for (let k = 0; k < candidates.length; k++) {
      const s = String(candidates[k] || "");
      const c = clean(s);
      if (c.startsWith(token) && !seen.has(c)) {
        seen.add(c);
        out.push(s);
        if (out.length >= 5) 
          return out;
      }
    }
  }
  return out;
}
function showAutocomplete(list) {
  if (!acBox) 
    return;
  acItems = list;
  acIndex = -1;
  if (!list.length) {
    hideAutocomplete();
    return;
  }
  acBox.hidden = false;
  acBox.innerHTML = `<div class="acPanel"></div>`;
  const panel = acBox.querySelector(".acPanel");
  for (let i = 0; i < list.length; i++) {
    const div = document.createElement("div");
    div.className = "acItem";
    div.textContent = list[i];
    div.addEventListener("mousedown", function (e) {
      e.preventDefault();
      applySuggestion(list[i]);
    });
    panel.appendChild(div);
  }
}
function hideAutocomplete() {
  if (!acBox) 
    return;
  acBox.hidden = true;
  acBox.innerHTML = "";
  acItems = [];
  acIndex = -1;
}
function setActive(idx) {
  if (!acBox) 
    return;
  const items = acBox.querySelectorAll(".acItem");
  for (let i = 0; i < items.length; i++) items[i].classList.remove("active");
  if (idx >= 0 && idx < items.length) items[idx].classList.add("active");
}
function applySuggestion(suggestion) {
  const current = searchInput.value;
  const lower = current.toLowerCase();
  const i1 = lower.lastIndexOf(" and ");
  const i2 = lower.lastIndexOf(" or ");
  const cut = Math.max(i1, i2);
  if (cut == -1) {
    searchInput.value = suggestion;
  } else {
    const prefix = current.slice(0, cut + 4);
    searchInput.value = prefix + suggestion;
  }
  searchInput.focus();
  hideAutocomplete();
  refresh();
}
function updateAutocomplete() {
  if (!acBox) 
    return;
  if (uiStep == 1 || uiStep == 2)
    return;
  showAutocomplete(buildSuggestions(searchInput.value));
}
function showChoiceList(list, onPick) {
  if (!acBox) 
    return;
  acItems = list;
  acIndex = -1;
  acBox.hidden = false;
  acBox.innerHTML = `<div class="acPanel"></div>`;
  const panel = acBox.querySelector(".acPanel");
  for (let i = 0; i < list.length; i++) {
    const div = document.createElement("div");
    div.className = "acItem";
    div.textContent = list[i];
    div.addEventListener("mousedown", function (e) {
      e.preventDefault();
      onPick(list[i]);
    });
    panel.appendChild(div);
  }
}
function startFieldDropdown() {
  uiStep = 1;
  uiField = "";
  showChoiceList(["name", "family", "genus", "order", "calories", "protein"], function (picked) {
    uiField = picked;
    uiStep = 2;
    searchInput.value = uiField + " ";
    searchInput.focus();
    if (uiField == "calories" || uiField == "protein") {
      showChoiceList([">", ">=", "<", "<=", "=", "!="], function (op) {
        searchInput.value = uiField + " " + op + " ";
        uiStep = 0;
        hideAutocomplete();
        searchInput.focus();
        searchInput.dispatchEvent(new Event("input"));
      });
    } else {
      showChoiceList(["includes", "starts with", "ends with"], function (mode) {
        searchInput.value = uiField + " " + mode + " ";
        uiStep = 0;
        hideAutocomplete();
        searchInput.focus();
        searchInput.dispatchEvent(new Event("input"));
      });
    }
  });
}

searchInput.addEventListener("keydown", function (e) {
  if ((uiStep == 1 || uiStep == 2) && e.key == "Escape") {
    uiStep = 0;
    hideAutocomplete();
    return;
  }
  if (acBox && !acBox.hidden && acItems.length) {
    if (e.key == "ArrowDown") {
      e.preventDefault();
      acIndex = Math.min(acIndex + 1, acItems.length - 1);
      setActive(acIndex);
      return;
    }
    if (e.key == "ArrowUp") {
      e.preventDefault();
      acIndex = Math.max(acIndex - 1, 0);
      setActive(acIndex);
      return;
    }
    if (e.key == "Enter" && acIndex >= 0) {
      e.preventDefault();
      applySuggestion(acItems[acIndex]);
      return;
    }
    if (e.key == "Escape") {
      hideAutocomplete();
      return;
    }
  }
  if (e.key == "Enter") {
    e.preventDefault();
    addTagFromInput();
    return;
  }
  if (e.key == "Backspace" && searchInput.value == "" && tags.length > 0) {
    const last = tags.pop();
    renderTags();
    searchInput.value = last;
    searchInput.focus();
    refresh();
    updateAutocomplete();
  }
});
searchInput.addEventListener("input", function () {
  refresh();
  updateAutocomplete();
});
searchInput.addEventListener("focus", function () {
  if (clean(searchInput.value) == "") startFieldDropdown();
});
searchInput.addEventListener("click", function () {
  if (clean(searchInput.value) == "") startFieldDropdown();
});
async function loadFruits() {
  searchInput.disabled = true;
  statusDiv.textContent = "Loading fruits...";
  for (let i = 0; i < URLS.length; i++) {
    try {
      const res = await fetch(URLS[i]);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error();
      fruits = data;
      searchInput.disabled = false;
      statusDiv.textContent = "";
      refresh();
      updateAutocomplete();
      return;
    } catch (err) {}
  }
  statusDiv.textContent = "Failed to load fruits.";
  searchInput.disabled = true;
  hideAutocomplete();
}
loadFruits();
