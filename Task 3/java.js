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
function clean(text) {
  return String(text || "").toLowerCase().trim();
}
function parseTerm(term) {
  const t = clean(term);
  if (!t) 
    return { field: "", value: "" };
  const parts = t.split(/\s+/);
  const field = parts[0];
  const allowed = ["name", "family", "genus", "order"];
  if (allowed.includes(field) && parts.length > 1) {
    return { field: field, value: parts.slice(1).join(" ") };
  }
  return { field: "", value: t };
}
function fruitMatchesTerm(fruit, field, value) {
  let v = clean(value);
  if (!v) 
    return true;
  let mode = "includes";
  if (v.startsWith("^")) {
    mode = "starts";
    v = v.slice(1).trim();
  } else if (v.endsWith("$")) {
    mode = "ends";
    v = v.slice(0, -1).trim();
  }
  function matchesText(text) {
    const s = clean(text);
    if (mode === "starts") 
      return s.startsWith(v);
    if (mode === "ends") 
      return s.endsWith(v);
    return s.includes(v);
  }
  if (field) {
    return matchesText(fruit[field]);
  }
  return (
    matchesText(fruit.name) ||
    matchesText(fruit.family) ||
    matchesText(fruit.genus) ||
    matchesText(fruit.order)
  );
}
function fruitMatchesTagExpression(fruit, expression) {
  const exp = clean(expression);
  if (!exp)
    return true;
  const orParts = exp.split(/\s*or\s*/);
  for (let i = 0; i < orParts.length; i++) {
    const andParts = orParts[i].split(/\s*and\s*/);
    let andOk = true;
    for (let j = 0; j < andParts.length; j++) {
      const term = andParts[j];
      const parsed = parseTerm(term);
      if (!fruitMatchesTerm(fruit, parsed.field, parsed.value)) {
        andOk = false;
        break;
      }
    }
    if (andOk) 
      return true;
  }
  return false;
}
function fruitPassesAllTags(fruit) {
  for (let i = 0; i < tags.length; i++) {
    if (!fruitMatchesTagExpression(fruit, tags[i]))
      return false;
  }
  return true;
}
function fruitMatchesLiveText(fruit, text) {
  const q = clean(text);
  if (q == "") 
    return true;
  return (
    clean(fruit.name).includes(q) ||
    clean(fruit.family).includes(q) ||
    clean(fruit.genus).includes(q) ||
    clean(fruit.order).includes(q)
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
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="name">${f.name}</div>
      <div class="meta">
        <span class="badge">Family: ${f.family}</span>
        <span class="badge">Genus: ${f.genus}</span>
        <span class="badge">Order: ${f.order}</span>
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
  const fields = ["name", "family", "genus", "order"];
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
    const candidates = [f.name, f.family, f.genus, f.order];
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
  if (!acBox) return;
  showAutocomplete(buildSuggestions(searchInput.value));
}
searchInput.addEventListener("keydown", function (e) {
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
async function loadFruits() {
  searchInput.disabled = true;
  for (let i = 0; i < URLS.length; i++) {
    try {
      const res = await fetch(URLS[i]);
      if (!res.ok) throw new Error();

      const data = await res.json();
      if (!Array.isArray(data)) throw new Error();

      fruits = data;
      searchInput.disabled = false;
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
