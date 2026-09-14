/* ------------------------------------------------------------------
   My Tasks -- a to-do list that lives entirely in this browser.

   Everything is stored in localStorage under STORAGE_KEY, so the list
   survives a reload with no server involved. The late-nineties browser
   styling is real UI: every button on every toolbar, menu and pop-up
   does something to the list.
   ------------------------------------------------------------------ */

(() => {
"use strict";

const STORAGE_KEY = "my-tasks.v1";
const MAX_UNDO = 60;
const MAX_HISTORY = 400;

/* ============================ content ============================ */

// Chore Genie's template packs. Deliberately over-specific: the point of a
// template is that you never have to word the task again.
const TEMPLATE_PACKS = {
  "Around the house": [
    "Descale the kettle with white vinegar",
    "Flip and rotate the mattress",
    "Replace the furnace filter",
    "Clean the lint trap and the dryer vent hose",
    "Defrost the freezer and bin anything unlabelled",
    "Vacuum the dust off the fridge coils",
    "Run an empty hot cycle in the washing machine",
    "Re-seal the silicone around the bath",
    "Oil the hinge on the door that squeaks",
    "Test the smoke alarms and change the batteries",
  ],
  "Paperwork": [
    "Send the meter reading before the estimate lands",
    "Cancel the free trial before it starts charging",
    "File the quarterly tax return",
    "Check the passport expiry date (6 months' rule)",
    "Update the address on the driving licence",
    "Chase the invoice that is now 30 days late",
    "Renew the domain before it expires",
  ],
  "Work": [
    "Write the weekly update and send it Friday morning",
    "Prep the agenda for Monday's stand-up",
    "Submit the expense report with receipts attached",
    "Reply to the recruiter, politely, either way",
    "Archive last quarter's files off the desktop",
  ],
  "Seasonal": [
    "Clear the gutters before the autumn rain",
    "Book the boiler service before winter",
    "Swap the tyres over",
    "Bleed the radiators",
    "Sharpen the lawnmower blade",
  ],
  "Digital": [
    "Back up the phone photos to the computer",
    "Empty the downloads folder",
    "Change any password older than a year",
    "Cancel the subscriptions nobody uses",
    "Check the backup actually restores",
  ],
};

// Installed later by Tools > Check for new templates.
const EXTRA_PACKS = {
  "Car": [
    "Check the tyre pressures, including the spare",
    "Top up the screenwash",
    "Book the MOT a month before it runs out",
    "Clear the boot of everything that lives there by accident",
  ],
  "Pets": [
    "Book the annual vaccination",
    "Worming tablet (mark the date on the calendar)",
    "Wash the pet bed cover",
    "Trim the claws",
  ],
};

const GENIE_TIPS = [
  "a task with a date on it gets done twice as often.",
  "if it takes two minutes, do it instead of typing it.",
  "three urgent things means nothing is urgent.",
  "write the next action, not the project.",
  "the oldest task on your list is probably not a task.",
  "a task you have rewritten twice wants splitting in half.",
  "put the boring one first. The rest gets easier.",
];

const TIPS_OF_THE_DAY = [
  "Press Ctrl+N to jump straight to the task box from anywhere on the page.",
  "The Back button undoes your last change to the list. Forward puts it back.",
  "Double-click a task to rename it without touching the mouse again.",
  "Type a different name into the Address bar to keep a second, separate list.",
  "Starred tasks show up under Favourites, so the ones that matter stay findable.",
  "Panic Mode hides everything except what is overdue or marked urgent.",
  "View > Stored data shows exactly what this browser is keeping for you.",
];

const MONEY_JOBS = [
  "Compare the car insurance quote before it auto-renews",
  "Switch the electricity tariff",
  "Cancel the gym membership you are not using",
  "Move the savings into the account with the better rate",
  "Claim the expenses from last month",
  "Return the parcel sitting by the door",
];

const OUTDOOR_JOBS = [
  "Wash the car",
  "Cut the grass",
  "Weed the front bed",
  "Take a proper walk, no headphones",
  "Clean the outside of the windows",
  "Sweep the leaves off the path",
];

const INDOOR_JOBS = [
  "Sort the drawer that everything gets thrown into",
  "Iron the shirts for next week",
  "Batch cook something for the freezer",
  "Clear out the bookshelf",
  "Sort the photos on the laptop into folders",
  "Descale the shower head",
];

const WEATHER_STATES = [
  { code: "RAIN", label: "Rain", temp: 11, wet: true },
  { code: "SUN", label: "Sunny", temp: 21, wet: false },
  { code: "CLOUD", label: "Overcast", temp: 15, wet: false },
  { code: "SHWRS", label: "Showers", temp: 13, wet: true },
  { code: "WIND", label: "Blustery", temp: 12, wet: false },
  { code: "FROST", label: "Frost", temp: 1, wet: false },
  { code: "FAIR", label: "Fair", temp: 18, wet: false },
];

const CATEGORIES = ["general", "shopping", "outdoor", "indoor", "admin", "work"];

// The toolbars that arrived with the list, rather than with the browser.
const ADDON_KEYS = ["taskfinder", "finditall", "choregenie", "deadlinebar", "prioritypal", "weathertask", "shopsmart"];

/* ============================ helpers ============================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "style") node.setAttribute("style", v);
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (k in node && k !== "list") node[k] = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

function icon(id, cls = "ic16") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", cls);
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#" + id);
  svg.append(use);
  return svg;
}

const pad2 = (n) => String(n).padStart(2, "0");
function isoDay(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function today() { return isoDay(new Date()); }
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return isoDay(dt);
}
function dayNumber(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
function nextWeekday(target) {
  const now = new Date();
  const delta = (target - now.getDay() + 7) % 7 || 7;
  return addDays(today(), delta);
}
function prettyDate(iso) {
  if (!iso) return "";
  const diff = dayNumber(iso) - dayNumber(today());
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const fmt = dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (diff < 0) return `${fmt} (${-diff} days late)`;
  if (diff < 7) return dt.toLocaleDateString(undefined, { weekday: "long" });
  return fmt;
}
function prettyTime(ts) {
  return new Date(ts).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}
function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

// A stable pick so the "forecast" does not change every render.
function seededIndex(seed, length) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % length;
}
function weatherFor(iso) { return WEATHER_STATES[seededIndex("wx" + iso, WEATHER_STATES.length)]; }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function slugifyList(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-tasks";
}
function titleizeList(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ============================ state ============================ */

const DEFAULT_SETTINGS = {
  toolbars: {
    standard: true, address: true, links: true,
    taskfinder: true, finditall: true, choregenie: true, deadlinebar: true,
    prioritypal: true, weathertask: true, shopsmart: true,
    status: true,
  },
  explorerBar: "assistant",
  docSize: 13,
  sortBy: "manual",
  groupBy: "none",
  showCompleted: true,
  popupsBlocked: false,
  highlight: false,
  workOffline: false,
  tipsAtStartup: true,
  narrow: false,
  extraTemplates: false,
  adsClosed: {},
};

let state = null;
let undoStack = [];
let redoStack = [];
let selected = new Set();
let view = { search: "", filter: { type: "all" }, panic: false };
let clipboard = null;
let blockedPopups = 0;
let findMatches = [];
let findCursor = 0;
let tipIndex = 0;
let statusTimer = null;

function blankState() {
  return {
    lists: { "my-tasks": [] },
    current: "my-tasks",
    nextId: 1,
    settings: structuredClone(DEFAULT_SETTINGS),
    deleted: [],
    history: [],
    createdAt: Date.now(),
  };
}

function starterTasks() {
  return [
    makeTask("Ring the dentist about the check-up", { pri: 2, due: addDays(today(), 1) }),
    makeTask("Take the recycling out", { due: today(), cat: "indoor" }),
    makeTask("Back up the phone photos to the computer", { cat: "digital" }),
  ];
}

function makeTask(text, extra = {}) {
  return Object.assign({
    id: state ? state.nextId++ : 1,
    text,
    done: false,
    fav: false,
    pri: 0,
    due: null,
    cat: "general",
    note: "",
    created: Date.now(),
    completedAt: null,
  }, extra);
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (err) { raw = null; }
  if (!raw) {
    state = blankState();
    state.lists["my-tasks"] = starterTasks();
    save();
    return;
  }
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (err) { parsed = null; }
  if (!parsed || typeof parsed !== "object" || !parsed.lists) {
    state = blankState();
    save();
    return;
  }
  state = Object.assign(blankState(), parsed);
  state.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), parsed.settings || {});
  state.settings.toolbars = Object.assign(structuredClone(DEFAULT_SETTINGS.toolbars), (parsed.settings || {}).toolbars || {});
  if (!state.lists[state.current]) state.current = Object.keys(state.lists)[0] || "my-tasks";
  if (!state.lists[state.current]) state.lists[state.current] = [];
}

let saveFailed = false;
function save() {
  if (state.settings.workOffline) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveFailed = false;
  } catch (err) {
    saveFailed = true;
    setStatus("This browser would not store the list. Nothing was saved.");
  }
}

const tasks = () => state.lists[state.current];

function logHistory(action, text) {
  state.history.unshift({ ts: Date.now(), action, text, list: state.current });
  if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
}

/* ---- undo / redo ---- */

function snapshot() {
  return JSON.stringify({ lists: state.lists, current: state.current, nextId: state.nextId, deleted: state.deleted });
}
function commit(label, fn) {
  const before = snapshot();
  fn();
  const after = snapshot();
  if (before === after) { render(); return; }
  undoStack.push({ label, data: before });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = [];
  save();
  render();
}
function undo() {
  if (!undoStack.length) { setStatus("There is nothing to undo."); return; }
  const entry = undoStack.pop();
  redoStack.push({ label: entry.label, data: snapshot() });
  applySnapshot(entry.data);
  setStatus(`Undone: ${entry.label}`);
}
function redo() {
  if (!redoStack.length) { setStatus("There is nothing to redo."); return; }
  const entry = redoStack.pop();
  undoStack.push({ label: entry.label, data: snapshot() });
  applySnapshot(entry.data);
  setStatus(`Redone: ${entry.label}`);
}
function applySnapshot(data) {
  const parsed = JSON.parse(data);
  state.lists = parsed.lists;
  state.current = parsed.current;
  state.nextId = parsed.nextId;
  state.deleted = parsed.deleted;
  selected.clear();
  save();
  render();
}

/* ============================ selection ============================ */

function selectedTasks() { return tasks().filter((t) => selected.has(t.id)); }

function requireSelection(verb) {
  const picked = selectedTasks();
  if (!picked.length) {
    setStatus(`Click a task first, then ${verb}.`);
    flashAssistant(`Pick a task in the list, then ${verb}.`);
    return null;
  }
  return picked;
}

/* ============================ status bar ============================ */

function setStatus(message) {
  $("#sb-message").textContent = message;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { $("#sb-message").textContent = "Done"; }, 6000);
}

function runProgress(label, done) {
  const bar = $("#sb-bar");
  const win = $("#browser-window");
  setStatus(label);
  win.classList.add("busy");           // spins the globe, as it always did
  let pct = 0;
  bar.style.width = "0%";
  const tick = setInterval(() => {
    pct += 14 + Math.random() * 18;
    bar.style.width = Math.min(100, pct) + "%";
    if (pct >= 100) {
      clearInterval(tick);
      setTimeout(() => {
        bar.style.width = "0%";
        win.classList.remove("busy");
        if (done) done();
      }, 220);
    }
  }, 90);
}

/* ============================ dialogs ============================ */

function makeDraggable(win, handle) {
  handle.addEventListener("mousedown", (ev) => {
    if (ev.target.closest("button")) return;
    const rect = win.getBoundingClientRect();
    const dx = ev.clientX - rect.left;
    const dy = ev.clientY - rect.top;
    const move = (e) => {
      win.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx)) + "px";
      win.style.top = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - dy)) + "px";
    };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    ev.preventDefault();
  });
}

function openDialog({ title, body, buttons = [{ label: "OK" }], width, onClose }) {
  const layer = $("#dialog-layer");
  const back = el("div", { class: "modal-back" });
  const win = el("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-label": title });
  if (width) win.style.width = width + "px";

  const close = (result) => {
    back.remove();
    win.remove();
    if (onClose) onClose(result);
  };

  const bar = el("div", { class: "dialog-title" },
    icon("ic-page"),
    el("span", { text: title }),
    el("button", { class: "tbtn", title: "Close", onclick: () => close(null) }, "✕"));

  const bodyNode = el("div", { class: "dialog-body" });
  const content = typeof body === "function" ? body(close) : body;
  if (content) bodyNode.append(content);

  const foot = el("div", { class: "dialog-foot" });
  for (const b of buttons) {
    foot.append(el("button", {
      class: "btn" + (b.default ? " btn-default" : ""),
      onclick: () => { const keep = b.onClick ? b.onClick(close) : undefined; if (keep !== true) close(b.value ?? b.label); },
    }, b.label));
  }

  win.append(bar, bodyNode, foot.children.length ? foot : "");
  layer.append(back, win);

  const rect = win.getBoundingClientRect();
  win.style.left = Math.max(8, (window.innerWidth - rect.width) / 2) + "px";
  win.style.top = Math.max(8, (window.innerHeight - rect.height) / 2.4) + "px";
  makeDraggable(win, bar);

  const first = win.querySelector("input, select, textarea, .btn-default, .btn");
  if (first) first.focus();
  back.addEventListener("mousedown", () => { win.animate([{ transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }], 110); });
  return { win, body: bodyNode, close };
}

function askText({ title, label, value = "", placeholder = "" }) {
  return new Promise((resolve) => {
    let input;
    let settled = false;
    const finish = (result) => { if (settled) return; settled = true; resolve(result); };
    const ctrl = openDialog({
      title,
      width: 420,
      body: () => {
        input = el("input", { class: "sunken", type: "text", value, placeholder });
        input.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const typed = input.value;
          ctrl.close();
          finish(typed);
        });
        return el("div", { class: "field-row" }, el("label", { text: label }), input);
      },
      buttons: [
        { label: "OK", default: true, onClick: () => finish(input.value) },
        { label: "Cancel", onClick: () => finish(null) },
      ],
      onClose: () => finish(null),
    });
    if (input) input.select();
  });
}

function confirmDialog({ title, message, okLabel = "OK", cancelLabel = "Cancel" }) {
  return new Promise((resolve) => {
    openDialog({
      title,
      width: 400,
      body: el("p", { text: message }),
      buttons: [
        { label: okLabel, default: true, onClick: () => resolve(true) },
        { label: cancelLabel, onClick: () => resolve(false) },
      ],
      onClose: (r) => { if (r === null) resolve(false); },
    });
  });
}

/* ============================ pop-ups ============================ */

function showPopup({ title, heading, lines, ctaLabel, onCta, dismissLabel = "No thanks" }) {
  if (state.settings.popupsBlocked) {
    blockedPopups += 1;
    $("#tf-blocked-n").textContent = String(blockedPopups);
    setStatus(`Pop-up blocked: ${title}`);
    return;
  }
  const layer = $("#popup-layer");
  const win = el("div", { class: "popup" });
  const bar = el("div", { class: "popup-title" },
    icon("ic-globe"),
    el("span", { text: title }),
    el("button", { class: "tbtn", title: "Close", onclick: () => win.remove() }, "✕"));
  const body = el("div", { class: "popup-body" },
    el("h4", { text: heading }),
    ...lines.map((l) => el("p", { text: l, style: "margin:0 0 6px" })));
  const foot = el("div", { class: "popup-foot" },
    el("button", { class: "btn btn-default", onclick: () => { win.remove(); onCta(); } }, ctaLabel),
    el("button", { class: "btn", onclick: () => win.remove() }, dismissLabel));
  win.append(bar, body, foot);
  layer.append(win);
  win.style.left = Math.max(10, Math.min(window.innerWidth - 340, 120 + Math.random() * 260)) + "px";
  win.style.top = Math.max(10, 110 + Math.random() * 180) + "px";
  makeDraggable(win, bar);
}

/* ============================ menus ============================ */

function closeMenus() {
  $("#menu-layer").replaceChildren();
  $$(".menu-top").forEach((b) => b.setAttribute("aria-expanded", "false"));
}

function openMenu(items, anchorRect, parentPop) {
  const layer = $("#menu-layer");
  if (!parentPop) layer.replaceChildren();
  const pop = el("div", { class: "menu-pop" });
  for (const item of items) {
    if (item === "-") { pop.append(el("div", { class: "menu-sep" })); continue; }
    const btn = el("button", { class: "menu-item", disabled: item.disabled || false });
    if (item.checked) btn.append(el("span", { class: "tick", text: "✓" }));
    if (item.radio) btn.append(el("span", { class: "tick", text: "●" }));
    btn.append(el("span", { text: item.label }));
    if (item.accel) btn.append(el("span", { class: "accel", text: item.accel }));
    if (item.items) {
      btn.append(el("span", { class: "arrow", text: "▶" }));
      let childPop = null;
      btn.addEventListener("mouseenter", () => {
        $$(".menu-pop", layer).forEach((p, i) => { if (i > depthOf(pop, layer)) p.remove(); });
        childPop = openMenu(item.items, btn.getBoundingClientRect(), pop);
      });
      btn.addEventListener("click", (e) => { e.stopPropagation(); });
    } else {
      btn.addEventListener("mouseenter", () => {
        $$(".menu-pop", layer).forEach((p, i) => { if (i > depthOf(pop, layer)) p.remove(); });
      });
      btn.addEventListener("click", () => { closeMenus(); if (item.action) item.action(); });
    }
    pop.append(btn);
  }
  layer.append(pop);
  const rect = pop.getBoundingClientRect();
  let left = parentPop ? anchorRect.right - 3 : anchorRect.left;
  let top = parentPop ? anchorRect.top - 3 : anchorRect.bottom;
  if (left + rect.width > window.innerWidth - 4) left = Math.max(4, (parentPop ? anchorRect.left - rect.width : window.innerWidth - rect.width - 4));
  if (top + rect.height > window.innerHeight - 4) top = Math.max(4, window.innerHeight - rect.height - 4);
  pop.style.left = left + "px";
  pop.style.top = top + "px";
  return pop;
}
function depthOf(pop, layer) { return Array.from(layer.children).indexOf(pop); }

function menuDefinitions() {
  const s = state.settings;
  const tb = s.toolbars;
  const toolbarToggle = (key, label) => ({ label, checked: tb[key], action: () => { tb[key] = !tb[key]; save(); render(); setStatus(`${label} ${tb[key] ? "shown" : "hidden"}.`); } });
  const radio = (label, on, action) => ({ label, radio: on, action });

  const templateMenu = () => {
    const packs = Object.assign({}, TEMPLATE_PACKS, s.extraTemplates ? EXTRA_PACKS : {});
    return Object.entries(packs).map(([pack, list]) => ({
      label: pack,
      items: list.map((text) => ({ label: text, action: () => addTask(text, {}, `template "${pack}"`) })),
    }));
  };

  return {
    File: [
      { label: "New task", accel: "Ctrl+N", action: () => $("#new-task").focus() },
      { label: "New task with details...", action: () => taskDetailDialog(null) },
      { label: "New list...", action: newList },
      { label: "Open list...", items: Object.keys(state.lists).map((name) => ({ label: titleizeList(name), radio: name === state.current, action: () => switchList(name) })) },
      "-",
      { label: "Save now", accel: "Ctrl+S", action: () => { save(); setStatus(saveFailed ? "Could not save." : "List saved in this browser."); } },
      { label: "Import tasks from a file...", action: importTasks },
      { label: "Export", items: [
        { label: "As a plain text list (.txt)", action: () => exportFile("txt") },
        { label: "As a data file (.json)", action: () => exportFile("json") },
        { label: "As a printable page (.html)", action: () => exportFile("html") },
      ] },
      { label: "Send list by e-mail", action: sendByEmail },
      "-",
      { label: "Print preview", action: () => { setStatus("Opening print preview..."); setTimeout(() => window.print(), 120); } },
      { label: "Print", accel: "Ctrl+P", action: () => window.print() },
      "-",
      { label: "Work offline", checked: s.workOffline, action: toggleOffline },
      { label: "Close down for today", action: closeForToday },
    ],
    Edit: [
      { label: "Undo", accel: "Ctrl+Z", disabled: !undoStack.length, action: undo },
      { label: "Redo", accel: "Ctrl+Y", disabled: !redoStack.length, action: redo },
      "-",
      { label: "Cut task", accel: "Ctrl+X", action: () => cutCopy(true) },
      { label: "Copy task", accel: "Ctrl+C", action: () => cutCopy(false) },
      { label: "Paste task", accel: "Ctrl+V", disabled: !clipboard, action: pasteTask },
      { label: "Delete", accel: "Del", action: deleteSelected },
      "-",
      { label: "Select all", accel: "Ctrl+A", action: () => { visibleTasks().forEach((t) => selected.add(t.id)); render(); setStatus(`${plural(selected.size, "task", "tasks")} selected.`); } },
      { label: "Invert selection", action: () => { const vis = visibleTasks(); const next = new Set(); vis.forEach((t) => { if (!selected.has(t.id)) next.add(t.id); }); selected = next; render(); } },
      { label: "Select none", action: () => { selected.clear(); render(); } },
      "-",
      { label: "Rename task", accel: "F2", action: renameSelected },
      { label: "Edit details...", action: () => { const p = requireSelection("edit it"); if (p) taskDetailDialog(p[0]); } },
      { label: "Find in this list...", accel: "Ctrl+F", action: openFind },
      { label: "Find and replace wording...", action: findReplace },
    ],
    View: [
      { label: "Toolbars", items: [
        toolbarToggle("standard", "Standard buttons"),
        toolbarToggle("address", "Address bar"),
        toolbarToggle("links", "Links"),
        "-",
        toolbarToggle("taskfinder", "TaskFinder"),
        toolbarToggle("finditall", "FindItAll Search Suite"),
        toolbarToggle("choregenie", "Chore Genie!"),
        toolbarToggle("deadlinebar", "DeadlineBar Pro"),
        toolbarToggle("prioritypal", "PriorityPal 2000"),
        toolbarToggle("weathertask", "WeatherTask 2000"),
        toolbarToggle("shopsmart", "ShopSmart$aver"),
        "-",
        toolbarToggle("status", "Status bar"),
        { label: "Hide every extension toolbar", action: () => { ADDON_KEYS.forEach((k) => { tb[k] = false; }); save(); render(); setStatus("Extension toolbars hidden. View > Toolbars brings them back."); } },
      ] },
      { label: "Side panel", items: [
        radio("Search", s.explorerBar === "search", () => setExplorer("search")),
        radio("Favourites", s.explorerBar === "favourites", () => setExplorer("favourites")),
        radio("History", s.explorerBar === "history", () => setExplorer("history")),
        radio("Task Assistant", s.explorerBar === "assistant", () => setExplorer("assistant")),
        radio("Deleted tasks", s.explorerBar === "deleted", () => setExplorer("deleted")),
        "-",
        radio("None", s.explorerBar === "none", () => setExplorer("none")),
      ] },
      { label: "Text size", items: [
        radio("Largest", s.docSize === 18, () => setDocSize(18)),
        radio("Larger", s.docSize === 15, () => setDocSize(15)),
        radio("Medium", s.docSize === 13, () => setDocSize(13)),
        radio("Smaller", s.docSize === 12, () => setDocSize(12)),
        radio("Smallest", s.docSize === 11, () => setDocSize(11)),
      ] },
      { label: "Sort by", items: [
        radio("The order I added them", s.sortBy === "manual", () => setSort("manual")),
        radio("A to Z", s.sortBy === "az", () => setSort("az")),
        radio("Z to A", s.sortBy === "za", () => setSort("za")),
        radio("Due date", s.sortBy === "due", () => setSort("due")),
        radio("Urgency", s.sortBy === "pri", () => setSort("pri")),
        radio("Newest first", s.sortBy === "new", () => setSort("new")),
        radio("Finished ones last", s.sortBy === "donelast", () => setSort("donelast")),
      ] },
      { label: "Group by", items: [
        radio("Nothing", s.groupBy === "none", () => setGroup("none")),
        radio("Urgency", s.groupBy === "pri", () => setGroup("pri")),
        radio("When it is due", s.groupBy === "due", () => setGroup("due")),
        radio("Kind of task", s.groupBy === "cat", () => setGroup("cat")),
      ] },
      "-",
      { label: "Show finished tasks", checked: s.showCompleted, action: () => { s.showCompleted = !s.showCompleted; save(); render(); } },
      { label: "Narrow reading column", checked: s.narrow, action: () => { s.narrow = !s.narrow; save(); render(); } },
      "-",
      { label: "Refresh", accel: "F5", action: refreshView },
      { label: "Full screen", accel: "F11", action: toggleFullscreen },
      { label: "Stored data", action: viewSource },
    ],
    Favourites: [
      { label: "Add to Favourites", action: () => { const p = requireSelection("star it"); if (!p) return; commit("star task", () => p.forEach((t) => { t.fav = true; logHistory("starred", t.text); })); setStatus(`${plural(p.length, "task", "tasks")} starred.`); } },
      { label: "Remove from Favourites", action: () => { const p = requireSelection("unstar it"); if (!p) return; commit("unstar task", () => p.forEach((t) => { t.fav = false; })); } },
      { label: "Organise Favourites...", action: organiseFavourites },
      "-",
      ...(() => {
        const favs = tasks().filter((t) => t.fav);
        if (!favs.length) return [{ label: "(no starred tasks yet)", disabled: true }];
        return favs.slice(0, 12).map((t) => ({ label: t.text.length > 46 ? t.text.slice(0, 44) + "..." : t.text, action: () => revealTask(t.id) }));
      })(),
    ],
    Tools: [
      { label: "Task templates", items: templateMenu() },
      { label: "Check for new template packs", action: checkForTemplates },
      "-",
      { label: "Synchronise this list", action: synchronise },
      { label: "Tidy up", items: [
        { label: "Archive finished tasks", action: archiveDone },
        { label: "Delete finished tasks", action: deleteDone },
        { label: "Find tasks nobody has touched in a fortnight", action: findStale },
        { label: "Remove duplicate tasks", action: removeDuplicates },
      ] },
      { label: "Deleted tasks", items: [
        { label: `Show deleted tasks (${state.deleted.length})`, action: () => setExplorer("deleted") },
        { label: "Restore everything", disabled: !state.deleted.length, action: restoreAllDeleted },
        { label: "Empty permanently", disabled: !state.deleted.length, action: emptyDeleted },
      ] },
      "-",
      { label: "Pop-up blocker", items: [
        { label: s.popupsBlocked ? "Turn off pop-up blocker" : "Turn on pop-up blocker", action: togglePopupBlocker },
        { label: `Pop-ups blocked so far: ${blockedPopups}`, disabled: true },
      ] },
      { label: "Manage add-ons...", action: manageAddons },
      { label: "Options...", action: () => optionsDialog("general") },
    ],
    Help: [
      { label: "Contents and index", action: helpContents },
      { label: "Tip of the day", action: tipOfTheDay },
      { label: "What is on this toolbar?", action: addonGuide },
      "-",
      { label: "Keyboard shortcuts", action: shortcutsHelp },
      { label: "About My Tasks", action: aboutBox },
    ],
  };
}

function buildMenuBar() {
  const bar = $("#menubar");
  bar.replaceChildren();
  const defs = menuDefinitions();
  for (const name of Object.keys(defs)) {
    const btn = el("button", { class: "menu-top", "aria-expanded": "false", "aria-haspopup": "true" });
    btn.append(el("u", { text: name[0] }), document.createTextNode(name.slice(1)));
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const wasOpen = btn.getAttribute("aria-expanded") === "true";
      closeMenus();
      if (wasOpen) return;
      btn.setAttribute("aria-expanded", "true");
      openMenu(menuDefinitions()[name], btn.getBoundingClientRect(), null);
    });
    btn.addEventListener("mouseenter", () => {
      if ($$(".menu-pop").length && btn.getAttribute("aria-expanded") !== "true") btn.click();
    });
    bar.append(btn);
  }
}

document.addEventListener("click", (ev) => { if (!ev.target.closest(".menu-pop, .menu-top")) closeMenus(); });
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeMenus(); });

/* ============================ toolbars ============================ */

const STANDARD_BUTTONS = [
  { id: "back", icon: "ic-back", label: "Back", title: "Undo the last change to the list", action: undo, enabled: () => undoStack.length > 0 },
  { id: "forward", icon: "ic-forward", label: "Forward", title: "Put back the change you just undid", action: redo, enabled: () => redoStack.length > 0 },
  { id: "stop", icon: "ic-stop", label: "Stop", title: "Clear the box and drop the current selection", action: stopEverything },
  { id: "refresh", icon: "ic-refresh", label: "Refresh", title: "Re-sort and redraw the list", action: refreshView },
  { id: "home", icon: "ic-home", label: "Home", title: "Back to the whole list, no filters", action: goHome },
  { sep: true },
  { id: "search", icon: "ic-search", label: "Search", title: "Search panel", action: () => setExplorer(state.settings.explorerBar === "search" ? "none" : "search"), pressed: () => state.settings.explorerBar === "search" },
  { id: "favourites", icon: "ic-fav", label: "Favourites", title: "Starred tasks", action: () => setExplorer(state.settings.explorerBar === "favourites" ? "none" : "favourites"), pressed: () => state.settings.explorerBar === "favourites" },
  { id: "history", icon: "ic-history", label: "History", title: "Everything that has happened to this list", action: () => setExplorer(state.settings.explorerBar === "history" ? "none" : "history"), pressed: () => state.settings.explorerBar === "history" },
  { sep: true },
  { id: "mail", icon: "ic-mail", label: "Mail", title: "E-mail this list to somebody", action: sendByEmail },
  { id: "print", icon: "ic-print", label: "Print", title: "Print the list", action: () => window.print() },
  { id: "edit", icon: "ic-edit", label: "Edit", title: "Rename the selected task", action: renameSelected },
  { id: "note", icon: "ic-note", label: "Note", title: "Attach a note to the selected task", action: addNote },
  { id: "research", icon: "ic-research", label: "Research", title: "Look the selected task up on the web", action: research },
];

function buildStandardToolbar() {
  const host = $("#tb-standard");
  host.replaceChildren();
  for (const b of STANDARD_BUTTONS) {
    if (b.sep) { host.append(el("span", { class: "tb-sep" })); continue; }
    const btn = el("button", { class: "tb-btn big", title: b.title, disabled: b.enabled ? !b.enabled() : false });
    if (b.pressed) btn.setAttribute("aria-pressed", String(b.pressed()));
    btn.append(icon(b.icon, "ic"), el("span", { class: "lbl", text: b.label }));
    btn.addEventListener("click", b.action);
    host.append(btn);
  }
}

const LINK_FILTERS = [
  { label: "Today", title: "Due today", filter: { type: "today" } },
  { label: "Overdue", title: "Should already be done", filter: { type: "overdue" } },
  { label: "This week", title: "Due in the next seven days", filter: { type: "week" } },
  { label: "Starred", title: "Your favourites", filter: { type: "starred" } },
  { label: "Urgent", title: "Marked !!!", filter: { type: "pri", value: 3 } },
  { label: "No date yet", title: "Tasks with no date on them", filter: { type: "nodate" } },
  { label: "Shopping", title: "Anything on the shopping list", filter: { type: "cat", value: "shopping" } },
  { label: "Finished", title: "Everything you have ticked off", filter: { type: "done" } },
];

function buildLinksBar() {
  const host = $("#tb-links");
  host.replaceChildren();
  for (const link of LINK_FILTERS) {
    const on = JSON.stringify(view.filter) === JSON.stringify(link.filter);
    const btn = el("button", { class: "link-btn", title: link.title, "aria-pressed": String(on) },
      icon("ic-folder"), link.label);
    btn.addEventListener("click", () => { setFilter(on ? { type: "all" } : link.filter); });
    host.append(btn);
  }
  const customise = el("button", { class: "link-btn", title: "Choose which shortcuts appear here" }, icon("ic-page"), "Customise");
  customise.addEventListener("click", customiseLinks);
  host.append(customise);
}

/* ============================ filtering ============================ */

function matchesFilter(t) {
  const f = view.filter;
  const td = today();
  switch (f.type) {
    case "all": return true;
    case "today": return t.due === td;
    case "overdue": return t.due && t.due < td && !t.done;
    case "week": return t.due && t.due >= td && t.due <= addDays(td, 7);
    case "weekend": return t.due === nextWeekday(6) || t.due === nextWeekday(0);
    case "starred": return t.fav;
    case "pri": return t.pri === f.value;
    case "nodate": return !t.due;
    case "cat": return t.cat === f.value;
    case "done": return t.done;
    case "stale": return !t.done && (Date.now() - t.created) > 14 * 86400000;
    case "ids": return f.value.includes(t.id);
    default: return true;
  }
}

function visibleTasks() {
  const q = view.search.trim().toLowerCase();
  let out = tasks().filter((t) => {
    if (!state.settings.showCompleted && t.done && view.filter.type !== "done") return false;
    if (view.panic && !(t.pri === 3 || (t.due && t.due < today())) ) return false;
    if (view.panic && t.done) return false;
    if (!matchesFilter(t)) return false;
    if (q && !(t.text.toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q))) return false;
    return true;
  });

  const s = state.settings.sortBy;
  const byDue = (a, b) => (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99");
  if (s === "az") out = out.slice().sort((a, b) => a.text.localeCompare(b.text));
  else if (s === "za") out = out.slice().sort((a, b) => b.text.localeCompare(a.text));
  else if (s === "due") out = out.slice().sort(byDue);
  else if (s === "pri") out = out.slice().sort((a, b) => b.pri - a.pri || byDue(a, b));
  else if (s === "new") out = out.slice().sort((a, b) => b.created - a.created);
  else if (s === "donelast") out = out.slice().sort((a, b) => Number(a.done) - Number(b.done));
  return out;
}

function groupsOf(list) {
  const g = state.settings.groupBy;
  if (g === "none") return [["", list]];
  const buckets = new Map();
  const put = (key, t) => { if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(t); };
  for (const t of list) {
    if (g === "pri") put(["No marker", "! Low", "!! Normal", "!!! Urgent"][t.pri], t);
    else if (g === "cat") put(t.cat[0].toUpperCase() + t.cat.slice(1), t);
    else {
      if (!t.due) put("No date", t);
      else if (t.due < today()) put("Overdue", t);
      else if (t.due === today()) put("Today", t);
      else if (t.due <= addDays(today(), 7)) put("This week", t);
      else put("Later", t);
    }
  }
  const order = g === "due" ? ["Overdue", "Today", "This week", "Later", "No date"]
    : g === "pri" ? ["!!! Urgent", "!! Normal", "! Low", "No marker"] : null;
  const keys = Array.from(buckets.keys());
  if (order) keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  else keys.sort();
  return keys.map((k) => [k, buckets.get(k)]);
}

function filterLabel() {
  const f = view.filter;
  const names = {
    today: "due today", overdue: "overdue", week: "due this week", starred: "starred",
    nodate: "with no date", done: "already finished", stale: "untouched for a fortnight",
    ids: "from your last search",
  };
  if (f.type === "pri") return `marked ${["no marker", "! low", "!! normal", "!!! urgent"][f.value]}`;
  if (f.type === "cat") return `in ${f.value}`;
  return names[f.type] || "";
}

/* ============================ rendering ============================ */

function highlightInto(node, text) {
  const q = (view.search || $("#tf-query").value || "").trim();
  if (!state.settings.highlight || !q) { node.textContent = text; return; }
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  node.replaceChildren();
  while (i < text.length) {
    const at = lower.indexOf(needle, i);
    if (at === -1) { node.append(text.slice(i)); break; }
    if (at > i) node.append(text.slice(i, at));
    node.append(el("mark", { text: text.slice(at, at + needle.length) }));
    i = at + needle.length;
  }
}

function taskRow(t) {
  const li = el("li", { class: "task" + (t.done ? " done" : "") + (selected.has(t.id) ? " selected" : ""), "data-id": String(t.id), tabindex: "0" });

  const check = el("input", { class: "task-check", type: "checkbox", checked: t.done, "aria-label": `Mark "${t.text}" as done` });
  check.addEventListener("change", () => toggleDone(t.id));

  const main = el("div", { class: "task-main" });
  const textNode = el("div", { class: "task-text" });
  highlightInto(textNode, t.text);
  main.append(textNode);

  const sub = el("div", { class: "task-sub" });
  if (t.pri) sub.append(el("span", { class: `badge badge-pri${t.pri}`, text: ["", "! Low", "!! Normal", "!!! Urgent"][t.pri] }));
  if (t.due) {
    const overdue = !t.done && t.due < today();
    sub.append(el("span", { class: "badge badge-due" + (overdue ? " overdue" : ""), text: (overdue ? "Late: " : "Due ") + prettyDate(t.due) }));
  }
  if (t.cat && t.cat !== "general") sub.append(el("span", { class: "badge badge-cat", text: t.cat }));
  if (t.done && t.completedAt) sub.append(el("span", { text: "finished " + prettyTime(t.completedAt) }));
  if (sub.children.length) main.append(sub);
  if (t.note) main.append(el("div", { class: "task-note", text: t.note }));

  const star = el("button", { class: "task-star", "aria-pressed": String(!!t.fav), title: t.fav ? "Remove from Favourites" : "Add to Favourites" }, icon("ic-fav"));
  star.addEventListener("click", (e) => { e.stopPropagation(); commit("star task", () => { t.fav = !t.fav; }); });

  const del = el("button", { class: "task-del", title: "Delete this task" }, "Delete");
  del.addEventListener("click", (e) => { e.stopPropagation(); deleteTasks([t]); });

  li.append(check, main, star, del);
  li.addEventListener("click", (e) => {
    if (e.target.closest("input, button")) return;
    if (e.ctrlKey || e.metaKey) { selected.has(t.id) ? selected.delete(t.id) : selected.add(t.id); }
    else { selected.clear(); selected.add(t.id); }
    render();
  });
  li.addEventListener("dblclick", (e) => { if (e.target.closest("input, button")) return; selected.clear(); selected.add(t.id); renameSelected(); });
  return li;
}

function render() {
  const s = state.settings;

  document.documentElement.style.setProperty("--doc-size", s.docSize + "px");
  $("#browser-window").classList.toggle("narrow", s.narrow);

  for (const [key, on] of Object.entries(s.toolbars)) {
    if (key === "status") { $("#statusbar").hidden = !on; continue; }
    const node = document.querySelector(`.tb[data-tb="${key}"]`);
    if (node) node.hidden = !on;
  }

  buildMenuBar();
  buildStandardToolbar();
  buildLinksBar();

  $("#address").value = `todo://${state.current}/`;
  $("#window-title").textContent = `${titleizeList(state.current)} - Web Browser`;
  document.title = $("#window-title").textContent;
  $("#list-heading").textContent = titleizeList(state.current);

  const all = tasks();
  const left = all.filter((t) => !t.done).length;
  const overdue = all.filter((t) => !t.done && t.due && t.due < today()).length;
  const dueToday = all.filter((t) => !t.done && t.due === today()).length;

  $("#tally").textContent = all.length === 0
    ? "Nothing on this list yet."
    : `${plural(left, "task", "tasks")} left, ${all.length - left} finished` +
      (dueToday ? ` - ${dueToday} due today` : "") +
      (overdue ? ` - ${overdue} overdue` : "");

  const vis = visibleTasks();
  const list = $("#list");
  list.replaceChildren();
  for (const [heading, group] of groupsOf(vis)) {
    if (heading) list.append(el("li", { class: "group-head", text: `${heading} (${group.length})` }));
    for (const t of group) list.append(taskRow(t));
  }

  const empty = $("#empty");
  empty.hidden = vis.length > 0;
  if (!vis.length) {
    empty.replaceChildren(
      el("p", { style: "margin:0 0 6px;font-weight:bold", text: all.length ? "Nothing matches what you are looking at." : "This list is empty." }),
      el("p", { style: "margin:0", text: all.length ? "Use Home on the toolbar to see everything again." : "Type a task in the box above, or borrow one from Chore Genie's templates." }));
  }

  const filtering = view.filter.type !== "all" || view.search || view.panic;
  $("#filter-strip").hidden = !filtering;
  if (filtering) {
    const bits = [];
    if (view.panic) bits.push("PANIC MODE: only urgent and overdue");
    if (view.filter.type !== "all") bits.push("Showing tasks " + filterLabel());
    if (view.search) bits.push(`matching "${view.search}"`);
    $("#filter-label").textContent = `${bits.join(", ")} - ${plural(vis.length, "match", "matches")}.`;
  }

  $("#sb-count").textContent = `${plural(vis.length, "item", "items")}${vis.length !== all.length ? ` of ${all.length}` : ""}`;
  $("#sb-conn-text").textContent = s.workOffline ? "Working offline" : "Connected at 56.6 Kbps";
  $("#dl-overdue-n").textContent = String(overdue);
  $("#tf-blocked-n").textContent = String(blockedPopups);
  $("#tf-highlight").setAttribute("aria-pressed", String(s.highlight));
  $("#pp-panic").setAttribute("aria-pressed", String(view.panic));
  $("#cg-streak-n").textContent = String(currentStreak());
  $("#saved-note").textContent = s.workOffline
    ? "Working offline - changes are not being saved."
    : saveFailed ? "This browser is refusing to store the list." : "Saved in this browser.";

  const wx = weatherFor(today());
  $("#wx-readout").textContent = `${wx.label} ${wx.temp}C`;

  renderExplorerBar();
  renderSkyscraper();
  renderBanner();
  renderTray();
}

function currentStreak() {
  const days = new Set(tasks().filter((t) => t.completedAt).map((t) => isoDay(new Date(t.completedAt))));
  let streak = 0;
  let cursor = today();
  if (!days.has(cursor)) cursor = addDays(cursor, -1);
  while (days.has(cursor)) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}

/* ---- side panel ---- */

function setExplorer(which) { state.settings.explorerBar = which; save(); render(); }

function assistantBlock(message) {
  return el("div", { class: "assistant" },
    icon("ic-clip", "assistant-clip"),
    el("div", { class: "speech", id: "assistant-speech", text: message }));
}

function flashAssistant(message) {
  const bubble = $("#assistant-speech");
  if (bubble) {
    bubble.textContent = message;
    bubble.animate([{ background: "#ffec8b" }, { background: "#ffffe1" }], 700);
  }
}

function renderExplorerBar() {
  const which = state.settings.explorerBar;
  const bar = $("#explorer-bar");
  bar.hidden = which === "none";
  if (which === "none") return;
  const body = $("#xbar-body");
  body.replaceChildren();
  const titles = { search: "Search", favourites: "Favourites", history: "History", assistant: "Task Assistant", deleted: "Deleted tasks" };
  $("#xbar-title").textContent = titles[which] || "Panel";

  if (which === "assistant") {
    const all = tasks();
    const overdue = all.filter((t) => !t.done && t.due && t.due < today());
    const next = all.find((t) => !t.done && t.due === today()) || all.find((t) => !t.done && t.pri === 3) || all.find((t) => !t.done);
    let line;
    if (!all.length) line = "Your list is empty. Type something in the box, or pick a template from the Chore Genie toolbar.";
    else if (overdue.length) line = `${plural(overdue.length, "task is", "tasks are")} past their date. Shall we deal with the oldest one first?`;
    else if (!next) line = "Everything on this list is finished. That is the whole list done.";
    else line = `It looks like you are trying to get things done. Next up: "${next.text}".`;
    body.append(assistantBlock(line));

    const actions = el("div", { class: "xbar-section" });
    if (next) actions.append(el("button", { class: "xlink", onclick: () => { selected.clear(); selected.add(next.id); commit("finish task", () => { next.done = true; next.completedAt = Date.now(); logHistory("finished", next.text); }); setStatus("One down."); } }, icon("ic-fav"), "Tick that one off"));
    actions.append(el("button", { class: "xlink", onclick: focusMode }, icon("ic-bolt"), "Show me one task at a time"));
    actions.append(el("button", { class: "xlink", onclick: () => setFilter({ type: "overdue" }) }, icon("ic-history"), "What is overdue?"));
    actions.append(el("button", { class: "xlink", onclick: tipOfTheDay }, icon("ic-note"), "Tip of the day"));
    body.append(actions);
  }

  if (which === "search") {
    const input = el("input", { class: "sunken", type: "text", value: view.search, placeholder: "Words in a task", style: "width:100%;height:20px" });
    const run = () => { view.search = input.value; $("#tf-query").value = input.value; render(); input.focus(); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    body.append(el("div", { class: "xbar-section" },
      el("h4", { text: "Search this list" }), input,
      el("div", { style: "margin-top:6px;display:flex;gap:4px" },
        el("button", { class: "btn btn-small", onclick: run }, "Search"),
        el("button", { class: "btn btn-small", onclick: () => { input.value = ""; view.search = ""; $("#tf-query").value = ""; render(); } }, "Clear"))));

    const quick = el("div", { class: "xbar-section" }, el("h4", { text: "Or search by" }));
    for (const link of LINK_FILTERS) quick.append(el("button", { class: "xlink", onclick: () => setFilter(link.filter) }, icon("ic-folder"), link.label));
    quick.append(el("button", { class: "xlink", onclick: () => setFilter({ type: "stale" }) }, icon("ic-history"), "Sitting there a fortnight"));
    body.append(quick);
  }

  if (which === "favourites") {
    const favs = tasks().filter((t) => t.fav);
    const sec = el("div", { class: "xbar-section" });
    if (!favs.length) sec.append(el("p", { class: "dim", text: "No starred tasks yet. Click the star beside a task to keep it here." }));
    for (const t of favs) sec.append(el("button", { class: "xlink", onclick: () => revealTask(t.id) }, icon("ic-fav"), t.text));
    body.append(sec);
    body.append(el("button", { class: "btn btn-small", onclick: organiseFavourites }, "Organise..."));
  }

  if (which === "history") {
    const groups = new Map();
    for (const h of state.history.slice(0, 120)) {
      const key = isoDay(new Date(h.ts)) === today() ? "Today" : isoDay(new Date(h.ts)) === addDays(today(), -1) ? "Yesterday" : new Date(h.ts).toLocaleDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(h);
    }
    if (!groups.size) body.append(el("p", { class: "dim", text: "Nothing has happened yet." }));
    for (const [day, entries] of groups) {
      const sec = el("div", { class: "xbar-section" }, el("h4", { text: day }));
      for (const h of entries) sec.append(el("div", { style: "padding:1px 0" }, el("b", { text: h.action }), " ", h.text));
      body.append(sec);
    }
    body.append(el("button", { class: "btn btn-small", onclick: () => { commit("clear history", () => { state.history = []; }); } }, "Clear history"));
  }

  if (which === "deleted") {
    const sec = el("div", { class: "xbar-section" });
    if (!state.deleted.length) sec.append(el("p", { class: "dim", text: "Nothing has been deleted." }));
    for (const t of state.deleted.slice(0, 50)) {
      sec.append(el("button", { class: "xlink", title: "Put this back on the list", onclick: () => restoreDeleted(t.id) }, icon("ic-trash"), t.text));
    }
    body.append(sec);
    if (state.deleted.length) {
      body.append(el("div", { style: "display:flex;gap:4px" },
        el("button", { class: "btn btn-small", onclick: restoreAllDeleted }, "Restore all"),
        el("button", { class: "btn btn-small", onclick: emptyDeleted }, "Empty")));
    }
  }
}

/* ---- advertising ---- */

function renderBanner() {
  const slot = $("#banner-ad");
  if (state.settings.adsClosed.banner) { slot.hidden = true; return; }
  slot.hidden = false;
  const all = tasks();
  const left = all.filter((t) => !t.done).length;
  const done = all.filter((t) => t.done).length;
  const overdue = all.filter((t) => !t.done && t.due && t.due < today()).length;

  let copy, cta, action;
  if (overdue) {
    copy = `WARNING! ${plural(overdue, "task is", "tasks are")} past the date you set!`;
    cta = "Show me";
    action = () => setFilter({ type: "overdue" });
  } else if (done >= 3) {
    copy = `You have finished ${done} tasks! Clear them out and enjoy an empty list!`;
    cta = "Archive them";
    action = archiveDone;
  } else if (left === 0 && all.length) {
    copy = "CONGRATULATIONS! Your list is completely clear!";
    cta = "Add another";
    action = () => $("#new-task").focus();
  } else {
    copy = `You have ${plural(left, "thing", "things")} to do. One click sorts the urgent ones to the top!`;
    cta = "Sort them";
    action = () => setSort("pri");
  }
  $("#banner-copy").textContent = copy;
  const btn = $("#banner-cta");
  btn.textContent = cta;
  btn.onclick = action;
}

function renderSkyscraper() {
  const slot = $("#skyscraper");
  if (state.settings.adsClosed.skyscraper) { slot.hidden = true; return; }
  slot.hidden = false;
  const host = $("#sky-inner");
  host.replaceChildren();
  const all = tasks();
  const wx = weatherFor(today());

  host.append(adCard("Your list is SLOWING DOWN!",
    `${plural(all.filter((t) => t.done).length, "finished task", "finished tasks")} still sitting in the list.`,
    "Clean it up", archiveDone));

  host.append(adCard("Get a FREE deadline!",
    "Tasks with a date are the ones that actually get done.",
    "Add a date", () => { const p = requireSelection("give it a date"); if (p) taskDetailDialog(p[0]); }));

  host.append(adCard(`${wx.label} today!`,
    wx.wet ? "Perfect weather for an indoor job." : "Perfect weather for getting outside.",
    wx.wet ? "Indoor job" : "Outdoor job", () => addTask(pickRandom(wx.wet ? INDOOR_JOBS : OUTDOOR_JOBS), { cat: wx.wet ? "indoor" : "outdoor" }, "WeatherTask")));

  // Two copies of the text, so the ticker is never a blank black box.
  const ticker = `*** ${plural(all.length, "task", "tasks")} on this list *** streak: ${plural(currentStreak(), "day", "days")} *** you are visitor number ${100000 + (all.length * 7)} `;
  host.append(el("div", { class: "sky-ad marquee-ad" }, el("span", { class: "track", text: ticker + ticker })));

  host.append(adCard("One task at a time",
    "Hide everything else until the next thing is done.",
    "Turn it on", focusMode));
}

function adCard(title, body, cta, action) {
  return el("div", { class: "sky-ad" },
    el("h5", { text: title }),
    el("p", { text: body }),
    el("button", { class: "btn btn-small", onclick: action }, cta));
}

function renderTray() {
  const tray = $("#sb-tray");
  tray.replaceChildren();
  const items = [
    { ic: "ic-search", name: "TaskFinder", key: "taskfinder" },
    { ic: "ic-research", name: "FindItAll Search Suite", key: "finditall" },
    { ic: "ic-bolt", name: "Chore Genie!", key: "choregenie" },
    { ic: "ic-history", name: "DeadlineBar Pro", key: "deadlinebar" },
    { ic: "ic-stop", name: "PriorityPal 2000", key: "prioritypal" },
    { ic: "ic-globe", name: "WeatherTask 2000", key: "weathertask" },
    { ic: "ic-cart", name: "ShopSmart$aver", key: "shopsmart" },
  ];
  for (const it of items) {
    const b = el("button", { class: "tray-ic", title: `${it.name} - click to ${state.settings.toolbars[it.key] ? "hide" : "show"} its toolbar` }, icon(it.ic));
    b.style.opacity = state.settings.toolbars[it.key] ? "1" : "0.35";
    b.addEventListener("click", () => { state.settings.toolbars[it.key] = !state.settings.toolbars[it.key]; save(); render(); setStatus(`${it.name} toolbar ${state.settings.toolbars[it.key] ? "shown" : "hidden"}.`); });
    tray.append(b);
  }
}

/* ============================ task operations ============================ */

function addTask(text, extra = {}, source = "typed") {
  const clean = String(text || "").trim();
  if (!clean) { setStatus("Type something first."); return null; }
  let created = null;
  commit("add task", () => {
    created = makeTask(clean, extra);
    tasks().unshift(created);
    logHistory("added", clean);
  });
  setStatus(`Added from ${source}: ${clean}`);
  return created;
}

function toggleDone(id) {
  const t = tasks().find((x) => x.id === id);
  if (!t) return;
  commit(t.done ? "un-tick task" : "tick task", () => {
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
    logHistory(t.done ? "finished" : "reopened", t.text);
  });
  if (t.done) {
    const left = tasks().filter((x) => !x.done).length;
    setStatus(left ? `Done. ${plural(left, "task", "tasks")} to go.` : "That was the last one.");
  }
}

function deleteTasks(list) {
  if (!list.length) return;
  commit("delete task", () => {
    for (const t of list) {
      const idx = tasks().findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        const [removed] = tasks().splice(idx, 1);
        state.deleted.unshift(removed);
        logHistory("deleted", removed.text);
      }
      selected.delete(t.id);
    }
    if (state.deleted.length > 100) state.deleted.length = 100;
  });
  setStatus(`${plural(list.length, "task", "tasks")} deleted. Back on the toolbar undoes it.`);
}

function deleteSelected() {
  const picked = requireSelection("press Delete");
  if (picked) deleteTasks(picked);
}

function restoreDeleted(id) {
  commit("restore task", () => {
    const idx = state.deleted.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [t] = state.deleted.splice(idx, 1);
    tasks().unshift(t);
    logHistory("restored", t.text);
  });
  setStatus("Put back on the list.");
}

function restoreAllDeleted() {
  const n = state.deleted.length;
  commit("restore all", () => {
    while (state.deleted.length) tasks().unshift(state.deleted.pop());
  });
  setStatus(`${plural(n, "task", "tasks")} restored.`);
}

async function emptyDeleted() {
  const n = state.deleted.length;
  if (!n) { setStatus("There is nothing to empty."); return; }
  const ok = await confirmDialog({
    title: "Delete permanently",
    message: `Permanently remove ${plural(n, "deleted task", "deleted tasks")}? After this they cannot be brought back.`,
    okLabel: "Delete permanently",
  });
  if (!ok) return;
  commit("empty deleted", () => { state.deleted = []; });
  setStatus(`${plural(n, "task", "tasks")} permanently removed.`);
}

function renameSelected() {
  const picked = requireSelection("rename it");
  if (!picked) return;
  const t = picked[0];
  askText({ title: "Rename task", label: "Task", value: t.text }).then((v) => {
    if (v === null) return;
    const clean = v.trim();
    if (!clean) return;
    commit("rename task", () => { logHistory("renamed", `${t.text} -> ${clean}`); t.text = clean; });
    setStatus("Renamed.");
  });
}

function addNote() {
  const picked = requireSelection("add a note");
  if (!picked) return;
  const t = picked[0];
  askText({ title: "Note", label: "Note", value: t.note || "", placeholder: "Anything you need to remember about this one" }).then((v) => {
    if (v === null) return;
    commit("edit note", () => { t.note = v.trim(); });
    setStatus(t.note ? "Note attached." : "Note removed.");
  });
}

function research() {
  const picked = requireSelection("look it up");
  if (!picked) return;
  const q = encodeURIComponent(picked[0].text);
  window.open(`https://duckduckgo.com/?q=${q}`, "_blank", "noopener");
  setStatus("Opened a web search in a new tab.");
}

function cutCopy(cut) {
  const picked = requireSelection(cut ? "cut it" : "copy it");
  if (!picked) return;
  clipboard = picked.map((t) => structuredClone(t));
  if (cut) deleteTasks(picked);
  else setStatus(`${plural(picked.length, "task", "tasks")} copied. Edit > Paste makes another copy.`);
  render();
}

function pasteTask() {
  if (!clipboard) { setStatus("Nothing has been copied yet."); return; }
  commit("paste task", () => {
    for (const t of clipboard) {
      const copy = makeTask(t.text, { pri: t.pri, due: t.due, cat: t.cat, note: t.note });
      tasks().unshift(copy);
      logHistory("pasted", copy.text);
    }
  });
  setStatus(`${plural(clipboard.length, "task", "tasks")} pasted.`);
}

function setPriority(level) {
  const picked = requireSelection("set its urgency");
  if (!picked) return;
  commit("set urgency", () => picked.forEach((t) => { t.pri = level; }));
  setStatus(level ? `Marked ${["", "! Low", "!! Normal", "!!! Urgent"][level]}.` : "Urgency marker removed.");
}

function setDue(iso, describe) {
  const picked = requireSelection("give it a date");
  if (!picked) return;
  commit("set date", () => picked.forEach((t) => { t.due = iso; logHistory("dated", `${t.text} (${iso || "no date"})`); }));
  setStatus(iso ? `Due ${describe || prettyDate(iso)}.` : "Date removed.");
}

function revealTask(id) {
  view.filter = { type: "all" };
  view.search = "";
  view.panic = false;
  selected.clear();
  selected.add(id);
  render();
  const row = document.querySelector(`.task[data-id="${id}"]`);
  if (row) { row.scrollIntoView({ block: "center" }); row.focus(); }
}

/* ============================ toolbar actions ============================ */

function setFilter(filter) {
  view.filter = filter;
  view.panic = false;
  render();
  setStatus(filter.type === "all" ? "Showing everything." : `Showing tasks ${filterLabel()}.`);
}
function setSort(kind) { state.settings.sortBy = kind; save(); render(); setStatus("List re-sorted."); }
function setGroup(kind) { state.settings.groupBy = kind; save(); render(); }
function setDocSize(px) { state.settings.docSize = px; save(); render(); }

function goHome() {
  view = { search: "", filter: { type: "all" }, panic: false };
  $("#tf-query").value = "";
  $("#find-input").value = "";
  $("#findbar").hidden = true;
  render();
  setStatus("Back to the whole list.");
}

function stopEverything() {
  $("#new-task").value = "";
  selected.clear();
  closeMenus();
  $("#popup-layer").replaceChildren();
  $("#sb-bar").style.width = "0%";
  render();
  setStatus("Stopped.");
}

function refreshView() {
  runProgress("Refreshing...", () => { render(); setStatus("Refreshed."); });
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => setStatus("This browser would not go full screen."));
}

function toggleOffline() {
  state.settings.workOffline = !state.settings.workOffline;
  if (!state.settings.workOffline) { save(); setStatus("Back online. Everything since has been saved."); }
  else setStatus("Working offline. Changes will not be saved until you turn this off.");
  render();
}

function togglePopupBlocker() {
  state.settings.popupsBlocked = !state.settings.popupsBlocked;
  save();
  setStatus(state.settings.popupsBlocked ? "Pop-up blocker on. Nothing will interrupt you." : "Pop-up blocker off.");
  render();
}

/* ============================ file / sharing ============================ */

function listAsText() {
  const lines = [`${titleizeList(state.current)} - ${new Date().toLocaleDateString()}`, ""];
  for (const t of tasks()) {
    const bits = [t.done ? "[x]" : "[ ]", t.text];
    if (t.pri) bits.push(`(${["", "!", "!!", "!!!"][t.pri]})`);
    if (t.due) bits.push(`(due ${t.due})`);
    lines.push(bits.join(" "));
    if (t.note) lines.push(`      note: ${t.note}`);
  }
  return lines.join("\n");
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportFile(kind) {
  const base = state.current;
  if (kind === "txt") download(`${base}.txt`, listAsText(), "text/plain");
  else if (kind === "json") download(`${base}.json`, JSON.stringify({ list: base, tasks: tasks() }, null, 2), "application/json");
  else {
    const rows = tasks().map((t) => `<li>${t.done ? "<s>" : ""}${escapeHtml(t.text)}${t.done ? "</s>" : ""}${t.due ? ` &mdash; due ${t.due}` : ""}</li>`).join("\n");
    download(`${base}.html`, `<!doctype html><meta charset="utf-8"><title>${escapeHtml(titleizeList(base))}</title><h1>${escapeHtml(titleizeList(base))}</h1><ul>\n${rows}\n</ul>`, "text/html");
  }
  setStatus(`Saved ${base}.${kind} to your downloads.`);
}

function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function sendByEmail() {
  const body = encodeURIComponent(listAsText());
  const subject = encodeURIComponent(`${titleizeList(state.current)} (${plural(tasks().filter((t) => !t.done).length, "task", "tasks")} left)`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  setStatus("Handed the list to your e-mail program.");
}

function importTasks() {
  const input = el("input", { type: "file", accept: ".txt,.json,.md,text/plain,application/json" });
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      let incoming = [];
      if (file.name.endsWith(".json")) {
        try {
          const data = JSON.parse(text);
          const arr = Array.isArray(data) ? data : data.tasks || [];
          incoming = arr.map((t) => ({ text: String(t.text || t), done: !!t.done, pri: Number(t.pri) || 0, due: t.due || null, note: t.note || "" }));
        } catch (err) { setStatus("That file is not readable as a task list."); return; }
      } else {
        incoming = text.split(/\r?\n/)
          .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
          .filter(Boolean)
          .map((line) => {
            const done = /^\[x\]/i.test(line);
            return { text: line.replace(/^\[[ x]\]\s*/i, "").trim(), done, pri: 0, due: null, note: "" };
          });
      }
      if (!incoming.length) { setStatus("That file had no tasks in it."); return; }
      commit("import tasks", () => {
        for (const t of incoming) { tasks().push(makeTask(t.text, { done: t.done, pri: t.pri, due: t.due, note: t.note, completedAt: t.done ? Date.now() : null })); }
        logHistory("imported", `${incoming.length} from ${file.name}`);
      });
      setStatus(`${plural(incoming.length, "task", "tasks")} brought in from ${file.name}.`);
    };
    reader.readAsText(file);
  });
  input.click();
}

function viewSource() {
  openDialog({
    title: `Stored data - ${state.current}`,
    width: 620,
    body: () => el("div", null,
      el("p", { text: "This is exactly what this browser is keeping for you. Nothing leaves this machine." }),
      el("div", { class: "source-view", text: JSON.stringify(state, null, 2) })),
    buttons: [
      { label: "Save a copy", onClick: () => { download(`${state.current}-backup.json`, JSON.stringify(state, null, 2), "application/json"); return true; } },
      { label: "Close", default: true },
    ],
  });
}

/* ============================ lists ============================ */

function switchList(name) {
  if (!state.lists[name]) return;
  state.current = name;
  selected.clear();
  goHome();
  save();
  render();
  setStatus(`Now showing ${titleizeList(name)}.`);
}

function newList() {
  askText({ title: "New list", label: "Name", placeholder: "Shopping, Work, Weekend..." }).then((v) => {
    if (!v) return;
    const slug = slugifyList(v);
    if (state.lists[slug]) { switchList(slug); return; }
    commit("new list", () => { state.lists[slug] = []; state.current = slug; logHistory("created list", titleizeList(slug)); });
    goHome();
    setStatus(`Started a new list: ${titleizeList(slug)}.`);
  });
}

function goToAddress() {
  const raw = $("#address").value.trim();
  const slug = slugifyList(raw.replace(/^todo:\/\//i, "").replace(/\/+$/, ""));
  if (state.lists[slug]) { switchList(slug); return; }
  confirmDialog({
    title: "That list does not exist",
    message: `There is no list called "${titleizeList(slug)}". Start it now?`,
    okLabel: "Start it",
  }).then((ok) => {
    if (!ok) { render(); return; }
    commit("new list", () => { state.lists[slug] = []; state.current = slug; });
    goHome();
    setStatus(`Started a new list: ${titleizeList(slug)}.`);
  });
}

/* ============================ tidy-up tools ============================ */

function archiveDone() {
  const done = tasks().filter((t) => t.done);
  if (!done.length) { setStatus("Nothing is finished yet."); return; }
  const archive = `${state.current}-archive`;
  commit("archive finished", () => {
    if (!state.lists[archive]) state.lists[archive] = [];
    for (const t of done) {
      state.lists[archive].unshift(t);
      const idx = tasks().findIndex((x) => x.id === t.id);
      if (idx >= 0) tasks().splice(idx, 1);
    }
    logHistory("archived", `${done.length} finished tasks`);
  });
  setStatus(`${plural(done.length, "task", "tasks")} moved to ${titleizeList(archive)}. The Address bar gets you there.`);
}

async function deleteDone() {
  const done = tasks().filter((t) => t.done);
  if (!done.length) { setStatus("Nothing is finished yet."); return; }
  const ok = await confirmDialog({ title: "Delete finished tasks", message: `Delete ${plural(done.length, "finished task", "finished tasks")}? They go to Deleted tasks, so you can still get them back.`, okLabel: "Delete" });
  if (ok) deleteTasks(done);
}

function findStale() {
  const stale = tasks().filter((t) => !t.done && Date.now() - t.created > 14 * 86400000);
  setFilter({ type: "stale" });
  // setFilter redraws the side panel, so the assistant speaks after it.
  flashAssistant(stale.length ? `${plural(stale.length, "task has", "tasks have")} been sitting there over a fortnight. Worth deleting or rewording?` : "Nothing has been sitting there longer than a fortnight.");
}

function removeDuplicates() {
  const seen = new Map();
  const dupes = [];
  for (const t of tasks()) {
    const key = t.text.trim().toLowerCase();
    if (seen.has(key)) dupes.push(t); else seen.set(key, t);
  }
  if (!dupes.length) { setStatus("No duplicates found."); return; }
  deleteTasks(dupes);
  setStatus(`${plural(dupes.length, "duplicate", "duplicates")} removed.`);
}

function synchronise() {
  runProgress("Synchronising...", () => {
    save();
    const all = tasks();
    openDialog({
      title: "Synchronisation complete",
      width: 400,
      body: el("div", null,
        el("p", { text: `${titleizeList(state.current)} is up to date in this browser.` }),
        el("ul", { style: "margin:0 0 4px 18px;padding:0" },
          el("li", { text: `${plural(all.length, "task", "tasks")} stored` }),
          el("li", { text: `${plural(all.filter((t) => !t.done).length, "task", "tasks")} still to do` }),
          el("li", { text: `${plural(Object.keys(state.lists).length, "list", "lists")} in total` }),
          el("li", { text: `${plural(state.deleted.length, "task", "tasks")} in the deleted pile` }))),
      buttons: [{ label: "OK", default: true }],
    });
  });
}

function checkForTemplates() {
  runProgress("Checking for new template packs...", () => {
    if (state.settings.extraTemplates) {
      setStatus("You already have every template pack.");
      return;
    }
    state.settings.extraTemplates = true;
    save();
    render();
    openDialog({
      title: "Template packs installed",
      width: 380,
      body: el("div", null,
        el("p", { text: "Two more template packs are now in Tools > Task templates:" }),
        el("ul", { style: "margin:0 0 0 18px;padding:0" }, el("li", { text: "Car" }), el("li", { text: "Pets" }))),
      buttons: [{ label: "OK", default: true }],
    });
  });
}

/* ============================ find / replace ============================ */

function openFind() {
  $("#findbar").hidden = false;
  $("#find-input").focus();
  $("#find-input").select();
}

function doFind(step) {
  const q = $("#find-input").value.trim().toLowerCase();
  if (!q) { $("#find-count").textContent = ""; return; }
  findMatches = tasks().filter((t) => t.text.toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q));
  if (!findMatches.length) { $("#find-count").textContent = "No matches."; setStatus(`"${q}" is not on this list.`); return; }
  if (step) findCursor = (findCursor + 1) % findMatches.length;
  else findCursor = 0;
  $("#find-count").textContent = `${findCursor + 1} of ${findMatches.length}`;
  revealTask(findMatches[findCursor].id);
  $("#find-input").focus();
}

function findReplace() {
  let fromInput, toInput;
  openDialog({
    title: "Find and replace wording",
    width: 420,
    body: () => {
      fromInput = el("input", { class: "sunken", type: "text", placeholder: "e.g. ring" });
      toInput = el("input", { class: "sunken", type: "text", placeholder: "e.g. call" });
      return el("div", null,
        el("div", { class: "field-row" }, el("label", { text: "Find" }), fromInput),
        el("div", { class: "field-row" }, el("label", { text: "Replace with" }), toInput),
        el("p", { class: "dim", style: "margin:0", text: "Changes the wording of every task that contains it." }));
    },
    buttons: [
      { label: "Replace all", default: true, onClick: () => {
        const from = fromInput.value;
        if (!from) return;
        const to = toInput.value;
        let n = 0;
        commit("replace wording", () => {
          for (const t of tasks()) {
            if (t.text.toLowerCase().includes(from.toLowerCase())) {
              t.text = t.text.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), to);
              n += 1;
            }
          }
        });
        setStatus(n ? `${plural(n, "task", "tasks")} reworded.` : `Nothing contained "${from}".`);
      } },
      { label: "Cancel" },
    ],
  });
}

/* ============================ dialogs: options etc. ============================ */

function taskDetailDialog(existing) {
  let textIn, dueIn, priIn, catIn, noteIn;
  openDialog({
    title: existing ? "Task details" : "New task",
    width: 460,
    body: () => {
      textIn = el("input", { class: "sunken", type: "text", value: existing ? existing.text : $("#new-task").value });
      dueIn = el("input", { class: "sunken", type: "date", value: existing && existing.due ? existing.due : "" });
      priIn = el("select", { class: "sunken" },
        ...["No marker", "! Low", "!! Normal", "!!! Urgent"].map((label, i) => el("option", { value: String(i), selected: existing ? existing.pri === i : i === 0, text: label })));
      catIn = el("select", { class: "sunken" },
        ...CATEGORIES.map((c) => el("option", { value: c, selected: existing ? existing.cat === c : c === "general", text: c[0].toUpperCase() + c.slice(1) })));
      noteIn = el("textarea", { class: "sunken", text: existing ? existing.note || "" : "" });
      return el("div", null,
        el("div", { class: "field-row" }, el("label", { text: "Task" }), textIn),
        el("div", { class: "field-row" }, el("label", { text: "Due" }), dueIn,
          el("button", { class: "btn btn-small", onclick: () => { dueIn.value = today(); } }, "Today"),
          el("button", { class: "btn btn-small", onclick: () => { dueIn.value = addDays(today(), 1); } }, "Tomorrow")),
        el("div", { class: "field-row" }, el("label", { text: "Urgency" }), priIn),
        el("div", { class: "field-row" }, el("label", { text: "Kind" }), catIn),
        el("div", { class: "field-row" }, el("label", { text: "Note" }), noteIn));
    },
    buttons: [
      { label: existing ? "Save" : "Add task", default: true, onClick: () => {
        const text = textIn.value.trim();
        if (!text) return;
        const patch = { due: dueIn.value || null, pri: Number(priIn.value), cat: catIn.value, note: noteIn.value.trim() };
        if (existing) {
          commit("edit task", () => { Object.assign(existing, patch, { text }); logHistory("edited", text); });
          setStatus("Task updated.");
        } else {
          addTask(text, patch, "the details box");
          $("#new-task").value = "";
        }
      } },
      { label: "Cancel" },
    ],
  });
}

function optionsDialog(startTab) {
  const s = state.settings;
  const tabs = ["General", "Appearance", "Toolbars", "Privacy"];
  let current = startTab === "taskfinder" ? "Toolbars" : "General";
  openDialog({
    title: "Options",
    width: 480,
    body: () => {
      const host = el("div");
      const tabRow = el("div", { class: "tabs" });
      const pane = el("div", { class: "tabpane" });
      const draw = () => {
        Array.from(tabRow.children).forEach((b) => b.setAttribute("aria-selected", String(b.textContent === current)));
        pane.replaceChildren();
        if (current === "General") {
          pane.append(
            el("fieldset", null, el("legend", { text: "Starting up" }),
              checkRow("Show a tip when the page opens", s.tipsAtStartup, (v) => { s.tipsAtStartup = v; save(); }),
              checkRow("Show finished tasks in the list", s.showCompleted, (v) => { s.showCompleted = v; save(); render(); })),
            el("fieldset", null, el("legend", { text: "Sorting" }),
              selectRow("Sort the list by", [["manual", "The order I added them"], ["az", "A to Z"], ["due", "Due date"], ["pri", "Urgency"], ["new", "Newest first"], ["donelast", "Finished ones last"]], s.sortBy, (v) => setSort(v)),
              selectRow("Group the list by", [["none", "Nothing"], ["pri", "Urgency"], ["due", "When it is due"], ["cat", "Kind of task"]], s.groupBy, (v) => setGroup(v))));
        } else if (current === "Appearance") {
          pane.append(
            el("fieldset", null, el("legend", { text: "Reading" }),
              selectRow("Text size", [[11, "Smallest"], [12, "Smaller"], [13, "Medium"], [15, "Larger"], [18, "Largest"]], s.docSize, (v) => setDocSize(Number(v))),
              checkRow("Narrow reading column", s.narrow, (v) => { s.narrow = v; save(); render(); }),
              checkRow("Highlight search matches in yellow", s.highlight, (v) => { s.highlight = v; save(); render(); })),
            el("fieldset", null, el("legend", { text: "Advertising" }),
              checkRow("Show the banner across the top", !s.adsClosed.banner, (v) => { s.adsClosed.banner = !v; save(); render(); }),
              checkRow("Show the panel down the side", !s.adsClosed.skyscraper, (v) => { s.adsClosed.skyscraper = !v; save(); render(); })));
        } else if (current === "Toolbars") {
          const fs = el("fieldset", null, el("legend", { text: "Show these toolbars" }));
          const labels = { standard: "Standard buttons", address: "Address bar", links: "Links", taskfinder: "TaskFinder", finditall: "FindItAll Search Suite", choregenie: "Chore Genie!", deadlinebar: "DeadlineBar Pro", prioritypal: "PriorityPal 2000", weathertask: "WeatherTask 2000", shopsmart: "ShopSmart$aver", status: "Status bar" };
          for (const [key, label] of Object.entries(labels)) fs.append(checkRow(label, s.toolbars[key], (v) => { s.toolbars[key] = v; save(); render(); }));
          pane.append(fs);
        } else {
          pane.append(
            el("fieldset", null, el("legend", { text: "Pop-ups" }),
              checkRow("Block pop-ups", s.popupsBlocked, (v) => { s.popupsBlocked = v; save(); render(); }),
              el("p", { class: "dim", style: "margin:4px 0 0", text: `${plural(blockedPopups, "pop-up", "pop-ups")} blocked since this page opened.` })),
            el("fieldset", null, el("legend", { text: "Your data" }),
              el("p", { style: "margin:0 0 8px", text: "Your tasks are stored in this browser only. Nothing is sent anywhere." }),
              el("div", { style: "display:flex;gap:6px" },
                el("button", { class: "btn btn-small", onclick: viewSource }, "See what is stored"),
                el("button", { class: "btn btn-small", onclick: () => exportFile("json") }, "Save a backup"),
                el("button", { class: "btn btn-small", onclick: eraseEverything }, "Erase everything"))));
        }
      };
      for (const name of tabs) {
        tabRow.append(el("button", { class: "tab", "aria-selected": "false", text: name, onclick: () => { current = name; draw(); } }));
      }
      host.append(tabRow, pane);
      draw();
      return host;
    },
    buttons: [{ label: "Close", default: true }],
  });
}

function checkRow(label, value, onChange) {
  const input = el("input", { type: "checkbox", checked: value });
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "row" }, input, label);
}
function selectRow(label, options, value, onChange) {
  const sel = el("select", { class: "sunken" }, ...options.map(([v, l]) => el("option", { value: String(v), selected: String(v) === String(value), text: l })));
  sel.addEventListener("change", () => onChange(sel.value));
  return el("div", { class: "field-row", style: "margin-top:6px" }, el("label", { text: label, style: "min-width:120px" }), sel);
}

async function eraseEverything() {
  const ok = await confirmDialog({
    title: "Erase everything",
    message: "This removes every list, every task and every setting from this browser. It cannot be undone. Save a backup first if you want one.",
    okLabel: "Erase everything",
  });
  if (!ok) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* nothing stored anyway */ }
  state = blankState();
  undoStack = [];
  redoStack = [];
  selected.clear();
  save();
  goHome();
  setStatus("Everything erased. Starting fresh.");
}

function manageAddons() {
  const s = state.settings;
  const rows = [
    ["taskfinder", "TaskFinder", "Searches your tasks and paints the matches yellow."],
    ["finditall", "FindItAll Search Suite", "Searches across every list at once, including notes and deleted tasks."],
    ["choregenie", "Chore Genie!", "Ready-worded tasks and a nudge when you need one."],
    ["deadlinebar", "DeadlineBar Pro", "Puts dates on tasks in one click."],
    ["prioritypal", "PriorityPal 2000", "Urgency markers and Panic Mode."],
    ["weathertask", "WeatherTask 2000", "Suggests indoor or outdoor jobs to suit the day."],
    ["shopsmart", "ShopSmart$aver", "A shopping list that lives inside your task list."],
  ];
  openDialog({
    title: "Manage add-ons",
    width: 520,
    body: () => {
      const host = el("div");
      host.append(el("p", { text: "These toolbars came with your task list. Turn off the ones you do not use." }));
      for (const [key, name, blurb] of rows) {
        host.append(el("div", { style: "display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid #b8b4ac" },
          checkRow("", s.toolbars[key], (v) => { s.toolbars[key] = v; save(); render(); }),
          el("div", null, el("b", { text: name }), el("div", { class: "dim", text: blurb }))));
      }
      return host;
    },
    buttons: [
      { label: "Turn all on", onClick: () => { rows.forEach(([k]) => { s.toolbars[k] = true; }); save(); render(); } },
      { label: "Turn all off", onClick: () => { rows.forEach(([k]) => { s.toolbars[k] = false; }); save(); render(); } },
      { label: "Close", default: true },
    ],
  });
}

function organiseFavourites() {
  openDialog({
    title: "Organise Favourites",
    width: 440,
    body: () => {
      const box = el("div", { class: "listbox" });
      const draw = () => {
        box.replaceChildren();
        const favs = tasks().filter((t) => t.fav);
        if (!favs.length) box.append(el("div", { class: "dim", style: "padding:6px", text: "Nothing is starred yet." }));
        for (const t of favs) {
          box.append(el("button", { onclick: () => { commit("unstar task", () => { t.fav = false; }); draw(); } }, `${t.text}   (click to unstar)`));
        }
      };
      draw();
      return el("div", null, el("p", { text: "Starred tasks stay in the Favourites panel so you can find them fast." }), box);
    },
    buttons: [{ label: "Close", default: true }],
  });
}

function showSearchResults(query, hits) {
  openDialog({
    title: `Results for "${query}"`,
    width: 540,
    body: (close) => {
      const host = el("div");
      if (!hits.length) {
        host.append(el("p", { text: `Nothing anywhere matches "${query}".` }));
        return host;
      }
      host.append(el("p", { text: `${plural(hits.length, "match", "matches")} found.` }));
      const box = el("div", { class: "listbox", style: "height:240px" });
      for (const hit of hits) {
        const where = hit.deleted ? "Deleted tasks" : titleizeList(hit.list);
        box.append(el("button", {
          onclick: () => {
            close();
            if (hit.deleted) { restoreDeleted(hit.task.id); return; }
            if (hit.list !== state.current) switchList(hit.list);
            revealTask(hit.task.id);
          },
        }, `${hit.task.text}   -   ${where}${hit.deleted ? " (click to restore)" : ""}`));
      }
      host.append(box);
      return host;
    },
    buttons: [{ label: "Close", default: true }],
  });
}

function customiseLinks() {
  openDialog({
    title: "Customise Links",
    width: 420,
    body: el("div", null,
      el("p", { text: "The Links bar holds one shortcut per way of slicing the list:" }),
      el("ul", { style: "margin:0 0 8px 18px;padding:0" }, ...LINK_FILTERS.map((l) => el("li", null, el("b", { text: l.label }), " - " + l.title))),
      el("p", { class: "dim", style: "margin:0", text: "Click any of them to filter. Click it again, or press Home, to see everything." })),
    buttons: [{ label: "Close", default: true }],
  });
}

function helpContents() {
  openDialog({
    title: "My Tasks Help",
    width: 560,
    body: el("div", null,
      el("p", null, el("b", { text: "Adding a task." }), " Type it in the box and press Add. Add with details lets you set a date, an urgency marker and a note at the same time."),
      el("p", null, el("b", { text: "Finishing a task." }), " Tick the box beside it. Ticked tasks stay on the list until you archive or delete them."),
      el("p", null, el("b", { text: "Deleting a task." }), " Press Delete beside it. Deleted tasks go to the Deleted tasks panel and can be put back."),
      el("p", null, el("b", { text: "Where it is kept." }), " Everything lives in this browser, on this machine. Close the tab and come back later and it is all still here. View > Stored data shows the lot."),
      el("p", null, el("b", { text: "More than one list." }), " Type a name into the Address bar - todo://shopping/ - and you get a separate list under that name."),
      el("p", null, el("b", { text: "The extra toolbars." }), " Each one is a shortcut for something the menus can also do. Tools > Manage add-ons turns off any you do not want.")),
    buttons: [{ label: "Close", default: true }],
  });
}

function addonGuide() {
  openDialog({
    title: "What is on this toolbar?",
    width: 560,
    body: el("div", null,
      guideRow("TaskFinder", "Search box, a Highlight button that paints matches yellow, AutoFill which reuses a phrase you have written before, and a count of pop-ups blocked."),
      guideRow("FindItAll Search Suite", "The search that reaches further: every list at once, notes only, or the deleted pile. Also jumps to the task that has been waiting longest."),
      guideRow("Chore Genie!", "Template packs of ready-worded jobs, a Surprise me button that picks one at random, and your finishing streak."),
      guideRow("DeadlineBar Pro", "Puts a date on whatever you have selected: today, tomorrow, the weekend, next week, or one you pick."),
      guideRow("PriorityPal 2000", "Three urgency markers, a sort button, and Panic Mode which hides everything except overdue and urgent."),
      guideRow("WeatherTask 2000", "Today's weather and a job to match it, plus a five-day plan that spreads jobs across the week."),
      guideRow("ShopSmart$aver", "Adds shopping items as tasks, filters the list down to them, and suggests jobs that save money.")),
    buttons: [{ label: "Close", default: true }],
  });
}
function guideRow(name, text) {
  return el("p", null, el("b", { text: name + ". " }), text);
}

function shortcutsHelp() {
  const rows = [
    ["Ctrl+N", "Jump to the task box"], ["Ctrl+S", "Save now"], ["Ctrl+P", "Print"],
    ["Ctrl+Z / Ctrl+Y", "Undo / redo (same as Back and Forward)"],
    ["Ctrl+F", "Find in this list"], ["Ctrl+A", "Select every task shown"],
    ["F2", "Rename the selected task"], ["F5", "Refresh"], ["F11", "Full screen"],
    ["Delete", "Delete the selected task"], ["Double-click", "Rename a task"],
    ["Ctrl+click", "Select more than one task"], ["Esc", "Close menus and pop-ups"],
  ];
  openDialog({
    title: "Keyboard shortcuts",
    width: 420,
    body: el("table", { style: "border-collapse:collapse;width:100%" },
      ...rows.map(([k, v]) => el("tr", null,
        el("td", { style: "padding:2px 10px 2px 0;white-space:nowrap" }, el("b", { text: k })),
        el("td", { style: "padding:2px 0", text: v })))),
    buttons: [{ label: "Close", default: true }],
  });
}

function tipOfTheDay() {
  let textNode;
  const ctrl = openDialog({
    title: "Tip of the Day",
    width: 440,
    body: () => {
      textNode = el("p", { text: TIPS_OF_THE_DAY[tipIndex % TIPS_OF_THE_DAY.length], style: "min-height:42px" });
      return el("div", null,
        el("div", { style: "display:flex;gap:10px;align-items:flex-start" },
          icon("ic-clip", "assistant-clip"),
          el("div", null, el("h4", { style: "margin:0 0 6px", text: "Did you know..." }), textNode)),
        checkRow("Show a tip when the page opens", state.settings.tipsAtStartup, (v) => { state.settings.tipsAtStartup = v; save(); }));
    },
    buttons: [
      { label: "Next tip", onClick: () => { tipIndex += 1; textNode.textContent = TIPS_OF_THE_DAY[tipIndex % TIPS_OF_THE_DAY.length]; return true; } },
      { label: "Close", default: true },
    ],
  });
  return ctrl;
}

function aboutBox() {
  const all = Object.values(state.lists).flat();
  openDialog({
    title: "About My Tasks",
    width: 420,
    body: el("div", null,
      el("h4", { style: "margin:0 0 2px;font-size:15px", text: "My Tasks" }),
      el("p", { class: "dim", style: "margin:0 0 10px", text: "Version 5.0 - built for a browser that no longer exists, apparently" }),
      el("p", { style: "margin:0 0 4px", text: `Lists: ${Object.keys(state.lists).length}` }),
      el("p", { style: "margin:0 0 4px", text: `Tasks across every list: ${all.length}` }),
      el("p", { style: "margin:0 0 4px", text: `Finished: ${all.filter((t) => t.done).length}` }),
      el("p", { style: "margin:0 0 4px", text: `Current streak: ${plural(currentStreak(), "day", "days")}` }),
      el("p", { style: "margin:8px 0 0", text: `First used ${new Date(state.createdAt).toLocaleDateString()}.` })),
    buttons: [{ label: "OK", default: true }],
  });
}

async function closeForToday() {
  const left = tasks().filter((t) => !t.done).length;
  const ok = await confirmDialog({
    title: "Finish for today",
    message: left
      ? `${plural(left, "task is", "tasks are")} still unfinished. Close the list down for today? Everything is saved either way.`
      : "Your list is clear. Close it down for today?",
    okLabel: "Finish for today",
  });
  if (!ok) return;
  save();
  const done = tasks().filter((t) => t.completedAt && isoDay(new Date(t.completedAt)) === today()).length;
  openDialog({
    title: "That is today done",
    width: 400,
    body: el("div", null,
      el("p", { text: done ? `You finished ${plural(done, "task", "tasks")} today.` : "Nothing finished today. Tomorrow then." }),
      el("p", { text: `${plural(left, "task is", "tasks are")} waiting when you come back.` }),
      el("p", { class: "dim", style: "margin:0", text: "Everything is saved in this browser." })),
    buttons: [{ label: "See you tomorrow", default: true }],
  });
}

/* ============================ focus mode ============================ */

function focusMode() {
  const next = tasks().find((t) => !t.done && t.pri === 3) || tasks().find((t) => !t.done && t.due && t.due <= today()) || tasks().find((t) => !t.done);
  if (!next) { setStatus("Nothing left to focus on."); return; }
  const card = $("#focus-card");
  card.replaceChildren(
    el("div", { style: "font-size:12px;opacity:.7;margin-bottom:12px", text: "JUST THIS ONE" }),
    el("div", { text: next.text }),
    next.due ? el("div", { style: "font-size:13px;opacity:.7;margin-top:12px", text: "due " + prettyDate(next.due) }) : null,
    el("button", { class: "btn", style: "margin-top:20px", onclick: () => { toggleDone(next.id); $("#focus-mode").hidden = true; } }, "Done - next one"));
  $("#focus-mode").hidden = false;
}

/* ============================ wiring ============================ */

function bind() {
  // window buttons
  $("#btn-minimize").addEventListener("click", () => {
    const win = $("#browser-window");
    win.classList.toggle("collapsed");
    if (win.classList.contains("collapsed")) {
      let strip = $("#collapsed-strip");
      if (!strip) {
        strip = el("div", { id: "collapsed-strip" });
        $("#statusbar").before(strip);
      }
      const left = tasks().filter((t) => !t.done).length;
      strip.replaceChildren(
        el("b", { text: `${plural(left, "task", "tasks")} left on ${titleizeList(state.current)}` }),
        el("button", { class: "btn btn-small", onclick: () => $("#btn-minimize").click() }, "Show the list"));
    }
    setStatus(win.classList.contains("collapsed") ? "Collapsed to a summary." : "List shown again.");
  });
  $("#btn-maximize").addEventListener("click", () => { state.settings.narrow = !state.settings.narrow; save(); render(); setStatus(state.settings.narrow ? "Narrow column." : "Wide column."); });
  $("#btn-close").addEventListener("click", closeForToday);

  // add form
  $("#add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#new-task");
    if (addTask(input.value)) input.value = "";
    input.focus();
  });
  $("#btn-add-detail").addEventListener("click", () => taskDetailDialog(null));

  // address bar
  $("#btn-go").addEventListener("click", goToAddress);
  $("#address").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); goToAddress(); } });
  $("#address-drop").addEventListener("click", (e) => {
    e.stopPropagation();   // otherwise the document handler closes it again
    const items = Object.keys(state.lists).map((name) => ({ label: `todo://${name}/`, radio: name === state.current, action: () => switchList(name) }));
    items.push("-", { label: "New list...", action: newList });
    openMenu(items, e.currentTarget.getBoundingClientRect(), null);
  });
  $("#btn-newlist").addEventListener("click", newList);

  // find bar
  $("#find-next").addEventListener("click", () => doFind(true));
  $("#find-close").addEventListener("click", () => { $("#findbar").hidden = true; $("#find-count").textContent = ""; });
  $("#find-input").addEventListener("keydown", (e) => { if (e.key === "Enter") doFind(e.shiftKey ? false : findMatches.length > 0); });

  // TaskFinder
  const runTaskFinderSearch = () => { view.search = $("#tf-query").value; view.filter = { type: "all" }; render(); setStatus(view.search ? `Showing tasks matching "${view.search}".` : "Showing everything."); };
  $("#tf-search").addEventListener("click", runTaskFinderSearch);
  $("#tf-query").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); runTaskFinderSearch(); } });
  $("#tf-highlight").addEventListener("click", () => { state.settings.highlight = !state.settings.highlight; save(); render(); setStatus(state.settings.highlight ? "Matches will be highlighted." : "Highlighting off."); });
  $("#tf-autofill").addEventListener("click", () => {
    const words = new Map();
    for (const t of Object.values(state.lists).flat()) {
      const first = t.text.split(/\s+/)[0];
      if (first && first.length > 2) words.set(first.toLowerCase(), (words.get(first.toLowerCase()) || 0) + 1);
    }
    const best = Array.from(words.entries()).sort((a, b) => b[1] - a[1])[0];
    const input = $("#new-task");
    if (!best) { input.value = "Ring "; setStatus("Nothing to learn from yet, so here is a start."); }
    else { input.value = best[0][0].toUpperCase() + best[0].slice(1) + " "; setStatus(`You start tasks with "${best[0]}" more than anything else.`); }
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
  $("#tf-blocked").addEventListener("click", () => {
    openDialog({
      title: "Pop-up blocker",
      width: 380,
      body: el("div", null,
        el("p", { text: `${plural(blockedPopups, "pop-up has", "pop-ups have")} been blocked since this page opened.` }),
        checkRow("Block pop-ups", state.settings.popupsBlocked, (v) => { state.settings.popupsBlocked = v; save(); render(); })),
      buttons: [{ label: "Close", default: true }],
    });
  });
  $("#tf-settings").addEventListener("click", () => optionsDialog("taskfinder"));

  // FindItAll -- the one search box that reaches outside the current list
  const findItAll = () => {
    const q = $("#fa-query").value.trim().toLowerCase();
    const scope = $("#fa-scope").value;
    if (!q) { setStatus("Type what you are looking for first."); return; }

    if (scope === "current") {
      view.search = $("#fa-query").value;
      view.filter = { type: "all" };
      render();
      setStatus(`${plural(visibleTasks().length, "match", "matches")} in ${titleizeList(state.current)}.`);
      return;
    }
    if (scope === "notes") {
      const hits = tasks().filter((t) => (t.note || "").toLowerCase().includes(q));
      view.search = "";
      setFilter({ type: "ids", value: hits.map((t) => t.id) });
      setStatus(`${plural(hits.length, "note", "notes")} mention "${q}".`);
      return;
    }
    if (scope === "deleted") {
      const hits = state.deleted.filter((t) => t.text.toLowerCase().includes(q));
      showSearchResults(q, hits.map((t) => ({ list: "Deleted tasks", task: t, deleted: true })));
      return;
    }
    const hits = [];
    for (const [name, list] of Object.entries(state.lists)) {
      for (const t of list) {
        if (t.text.toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q)) hits.push({ list: name, task: t });
      }
    }
    showSearchResults(q, hits);
  };
  $("#fa-go").addEventListener("click", findItAll);
  $("#fa-query").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); findItAll(); } });
  $("#fa-lucky").addEventListener("click", () => {
    const open = tasks().filter((t) => !t.done);
    if (!open.length) { setStatus("Nothing is outstanding on this list."); return; }
    const oldest = open.reduce((a, b) => (a.created <= b.created ? a : b));
    revealTask(oldest.id);
    flashAssistant(`This one has been waiting since ${new Date(oldest.created).toLocaleDateString()}. Still worth doing?`);
    setStatus("Jumped to the oldest unfinished task.");
  });
  $("#fa-web").addEventListener("click", () => {
    const q = $("#fa-query").value.trim() || (selectedTasks()[0] || {}).text;
    if (!q) { setStatus("Type something, or pick a task, then search the web."); return; }
    window.open(`https://duckduckgo.com/?q=${encodeURIComponent(q)}`, "_blank", "noopener");
    setStatus("Opened a web search in a new tab.");
  });

  // Chore Genie
  $("#cg-templates").addEventListener("click", (e) => {
    e.stopPropagation();   // otherwise the document handler closes it again
    const packs = Object.assign({}, TEMPLATE_PACKS, state.settings.extraTemplates ? EXTRA_PACKS : {});
    const items = Object.entries(packs).map(([pack, list]) => ({
      label: pack,
      items: list.map((text) => ({ label: text, action: () => addTask(text, {}, `template "${pack}"`) })),
    }));
    items.push("-", { label: "Check for new template packs", action: checkForTemplates });
    openMenu(items, e.currentTarget.getBoundingClientRect(), null);
  });
  $("#cg-random").addEventListener("click", () => {
    const packs = Object.assign({}, TEMPLATE_PACKS, state.settings.extraTemplates ? EXTRA_PACKS : {});
    const existing = new Set(tasks().map((t) => t.text.toLowerCase()));
    const pool = Object.values(packs).flat().filter((t) => !existing.has(t.toLowerCase()));
    if (!pool.length) { setStatus("Every template is already on your list."); return; }
    addTask(pickRandom(pool), {}, "Surprise me");
  });
  $("#cg-streak").addEventListener("click", () => {
    const streak = currentStreak();
    setExplorer("assistant");   // redraws the panel, so speak after it, not before
    flashAssistant(streak ? `${plural(streak, "day", "days")} running with something finished. Keep it going.` : "Finish one thing today and the streak starts.");
    setStatus(streak ? `Current streak: ${plural(streak, "day", "days")}.` : "No streak yet. Finish one thing today to start it.");
  });

  // DeadlineBar
  $$('.tb-deadline [data-due]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.due;
      const map = {
        today: [today(), "today"],
        tomorrow: [addDays(today(), 1), "tomorrow"],
        weekend: [nextWeekday(6), "this weekend"],
        nextweek: [addDays(today(), 7), "next week"],
      };
      setDue(map[kind][0], map[kind][1]);
    });
  });
  $("#dl-set").addEventListener("click", () => {
    const v = $("#dl-date").value;
    if (!v) { setStatus("Pick a date in the box first."); return; }
    setDue(v);
  });
  $("#dl-clear").addEventListener("click", () => setDue(null));
  $("#dl-overdue").addEventListener("click", () => setFilter({ type: "overdue" }));

  // PriorityPal
  $$('.tb-priority [data-pri]').forEach((btn) => btn.addEventListener("click", () => setPriority(Number(btn.dataset.pri))));
  $("#pp-sort").addEventListener("click", () => setSort("pri"));
  $("#pp-panic").addEventListener("click", () => {
    view.panic = !view.panic;
    if (view.panic) { view.filter = { type: "all" }; view.search = ""; }
    render();
    const n = visibleTasks().length;
    setStatus(view.panic ? (n ? `PANIC MODE: ${plural(n, "thing", "things")} actually matter right now.` : "PANIC MODE: nothing is overdue or urgent. Relax.") : "Back to the whole list.");
  });

  // WeatherTask
  $("#wx-outdoor").addEventListener("click", () => addTask(pickRandom(OUTDOOR_JOBS), { cat: "outdoor" }, "WeatherTask"));
  $("#wx-indoor").addEventListener("click", () => addTask(pickRandom(INDOOR_JOBS), { cat: "indoor" }, "WeatherTask"));
  $("#wx-umbrella").addEventListener("click", () => {
    const wx = weatherFor(today());
    if (wx.wet) addTask("Take an umbrella", { due: today(), pri: 1 }, "WeatherTask");
    else setStatus(`${wx.label} today. Leave the umbrella at home.`);
  });
  $("#wx-forecast").addEventListener("click", () => {
    openDialog({
      title: "5-day plan",
      width: 460,
      body: () => {
        const host = el("div", null, el("p", { text: "Pick a day to add a job that suits the weather." }));
        for (let i = 0; i < 5; i++) {
          const iso = addDays(today(), i);
          const wx = weatherFor(iso);
          const job = wx.wet ? pickRandom(INDOOR_JOBS) : pickRandom(OUTDOOR_JOBS);
          host.append(el("div", { style: "display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #b8b4ac" },
            el("b", { style: "min-width:86px", text: i === 0 ? "Today" : prettyDate(iso) }),
            el("span", { style: "min-width:96px", text: `${wx.label} ${wx.temp}C` }),
            el("span", { style: "flex:1", text: job }),
            el("button", { class: "btn btn-small", onclick: () => addTask(job, { due: iso, cat: wx.wet ? "indoor" : "outdoor" }, "the 5-day plan") }, "Add")));
        }
        return host;
      },
      buttons: [{ label: "Close", default: true }],
    });
  });

  // ShopSmart
  const addShopping = () => {
    const input = $("#ss-item");
    if (addTask(input.value, { cat: "shopping" }, "ShopSmart$aver")) input.value = "";
    input.focus();
  };
  $("#ss-add").addEventListener("click", addShopping);
  $("#ss-item").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addShopping(); } });
  $("#ss-show").addEventListener("click", () => setFilter({ type: "cat", value: "shopping" }));
  $("#ss-coupons").addEventListener("click", () => {
    openDialog({
      title: "Money-saving jobs",
      width: 440,
      body: () => {
        const host = el("div", null, el("p", { text: "Jobs that pay for themselves. Add any of them to your list." }));
        for (const job of MONEY_JOBS) {
          host.append(el("div", { style: "display:flex;gap:8px;align-items:center;padding:3px 0" },
            el("span", { style: "flex:1", text: job }),
            el("button", { class: "btn btn-small", onclick: () => addTask(job, { cat: "admin" }, "ShopSmart$aver") }, "Add")));
        }
        return host;
      },
      buttons: [{ label: "Close", default: true }],
    });
  });

  // ads
  $$("[data-close-ad]").forEach((btn) => btn.addEventListener("click", () => {
    state.settings.adsClosed[btn.dataset.closeAd === "banner-ad" ? "banner" : "skyscraper"] = true;
    save();
    render();
    setStatus("Hidden. View > Options > Appearance brings it back.");
  }));

  $("#throbber").addEventListener("click", goHome);
  $("#xbar-close").addEventListener("click", () => setExplorer("none"));
  $("#btn-view-source").addEventListener("click", viewSource);
  $("#filter-clear").addEventListener("click", goHome);
  $("#focus-exit").addEventListener("click", () => { $("#focus-mode").hidden = true; });

  // keyboard
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "n") { e.preventDefault(); $("#new-task").focus(); return; }
    if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); save(); setStatus("List saved in this browser."); return; }
    if (ctrl && e.key.toLowerCase() === "p") { e.preventDefault(); window.print(); return; }
    if (ctrl && e.key.toLowerCase() === "f") { e.preventDefault(); openFind(); return; }
    if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if (ctrl && e.key.toLowerCase() === "a" && !typing) { e.preventDefault(); visibleTasks().forEach((t) => selected.add(t.id)); render(); return; }
    if (ctrl && e.key.toLowerCase() === "c" && !typing) { cutCopy(false); return; }
    if (ctrl && e.key.toLowerCase() === "x" && !typing) { cutCopy(true); return; }
    if (ctrl && e.key.toLowerCase() === "v" && !typing) { pasteTask(); return; }
    if (e.key === "F2") { e.preventDefault(); renameSelected(); return; }
    if (e.key === "F5") { e.preventDefault(); refreshView(); return; }
    if (e.key === "F11") { e.preventDefault(); toggleFullscreen(); return; }
    if (e.key === "Delete" && !typing) { e.preventDefault(); deleteSelected(); return; }
    if (e.key === "Escape") { closeMenus(); $("#popup-layer").replaceChildren(); $("#focus-mode").hidden = true; }
  });
}

/* ---- the pop-ups that arrive on their own ---- */

function scheduleNagPopups() {
  setTimeout(() => {
    const n = tasks().length;
    showPopup({
      title: "Congratulations!!",
      heading: `You are task number ${100000 + n * 7}!`,
      lines: ["You have been selected to receive a fifteen minute break.", "Claim it now and we will put it on your list."],
      ctaLabel: "Claim my break",
      onCta: () => addTask("Take a fifteen minute break", { due: today(), pri: 1 }, "a pop-up"),
    });
  }, 9000);

  setTimeout(() => {
    const stale = tasks().filter((t) => !t.done && Date.now() - t.created > 14 * 86400000).length;
    const nodate = tasks().filter((t) => !t.done && !t.due).length;
    showPopup({
      title: "System scan",
      heading: "Your task list may need attention",
      lines: [
        `${plural(nodate, "task has", "tasks have")} no date on them.`,
        stale ? `${plural(stale, "task has", "tasks have")} been sitting there over a fortnight.` : "Nothing has gone stale yet.",
        "Run a scan to see them.",
      ],
      ctaLabel: "Scan now",
      onCta: () => { runProgress("Scanning your list...", () => setFilter(stale ? { type: "stale" } : { type: "nodate" })); },
    });
  }, 26000);
}

/* ============================ start ============================ */

function start() {
  load();
  bind();
  render();
  tipIndex = seededIndex("tip" + today(), TIPS_OF_THE_DAY.length);
  $("#cg-tip").textContent = GENIE_TIPS[seededIndex("genie" + today(), GENIE_TIPS.length)];
  $("#dl-date").value = today();

  if (state.settings.tipsAtStartup) setTimeout(tipOfTheDay, 700);
  scheduleNagPopups();

  // The workspace shell reopens this tab where it left off.
  if (window.parent !== window) {
    window.parent.postMessage({ type: "shell:location", path: location.pathname + location.search }, "*");
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();

})();
