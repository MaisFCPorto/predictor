"use strict";

const book = document.querySelector(".pa-book");
const phone = document.querySelector(".pa-phone");
const albumPanel = document.querySelector("#caderneta");
const pages = Array.from(book.querySelectorAll(".pa-page"));
const prev = document.querySelector("[data-prev]");
const next = document.querySelector("[data-next]");
const counter = document.querySelector(".page-nav output");
const collectionCount = document.querySelector("#collection-count");
const packCards = document.querySelector("#pack-cards");
const announcement = document.querySelector("#announcement");
const desktop = matchMedia("(min-width: 650px)");
const twoColumns = matchMedia("(min-width: 980px)");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const catalog = new Map();
const owned = new Set();
for (const [index, page] of pages.entries()) {
  for (const slot of page.querySelectorAll("[data-slot]")) {
    const id = slot.dataset.slot;
    catalog.set(id, {
      id,
      index,
      number: slot.querySelector("strong").textContent,
      name: slot.querySelector("span").textContent,
      section: page.dataset.title
    });
    if (slot.hasAttribute("data-owned")) owned.add(id);
  }
}

// This fixed pack lets every tester try both new stickers and a duplicate.
const trialPack = ["092", "002", "025"].map(id => ({ ...catalog.get(id), duplicate: owned.has(id) }));
const pending = new Set();
const mobilePages = pages.map(page => {
  const copy = page.cloneNode(true);
  phone.append(copy);
  return copy;
});
const slots = Array.from(albumPanel.querySelectorAll("button[data-slot]"));

let pageIndex = 1;
let flipBook;
let pageTurn;
let selectedId;
let trayDrag;
let suppressTrayClick;
let busy = false;
let touchStart;

function visibleIndexes() {
  if (!desktop.matches || pageIndex === 0 || pageIndex === pages.length - 1) return [pageIndex];
  const first = pageIndex % 2 === 0 ? pageIndex - 1 : pageIndex;
  return [first, first + 1];
}

function updateNavigation() {
  const visible = visibleIndexes();
  mobilePages.forEach((page, index) => { page.hidden = index !== pageIndex; });
  if (!flipBook) pages.forEach((page, index) => { page.hidden = !visible.includes(index); });
  counter.value = visible.map(index => index + 1).join("–") + " / " + pages.length;
  prev.disabled = busy || visible[0] === 0;
  next.disabled = busy || visible.at(-1) === pages.length - 1;
}

function setupDesktop() {
  if (!desktop.matches || !window.St) return;
  if (flipBook) {
    flipBook.turnToPage(pageIndex);
    return;
  }

  for (const page of pages) page.hidden = false;
  flipBook = new window.St.PageFlip(book, {
    width: 330,
    height: 412,
    size: "stretch",
    minWidth: 255,
    maxWidth: 330,
    minHeight: 318,
    maxHeight: 412,
    startPage: pageIndex,
    showCover: true,
    usePortrait: false,
    drawShadow: true,
    maxShadowOpacity: .4,
    flippingTime: 640,
    useMouseEvents: !reduceMotion.matches,
    disableFlipByClick: true
  });
  flipBook.on("flip", event => {
    pageIndex = event.data;
    updateNavigation();
  });
  flipBook.on("changeState", event => {
    if (event.data === "read" && pageTurn && visibleIndexes().includes(pageTurn.target)) pageTurn.finish();
  });
  flipBook.loadFromHTML(pages);
}

function showPage(index, direction) {
  pageIndex = index;
  updateNavigation();
  if (desktop.matches || !direction || reduceMotion.matches) return;
  mobilePages[index].animate(
    [{ transform: "translateX(" + direction * 30 + "px)", opacity: .65 }, { transform: "translateX(0)", opacity: 1 }],
    { duration: 180, easing: "ease-out" }
  );
}

function turn(direction) {
  if (busy) return;
  const visible = visibleIndexes();
  const edge = direction > 0 ? visible.at(-1) : visible[0];
  const target = edge + direction;
  if (target < 0 || target >= pages.length) return;
  if (!desktop.matches || !flipBook) {
    showPage(target, direction);
  } else if (reduceMotion.matches) {
    flipBook.turnToPage(target);
  } else if (direction > 0) {
    flipBook.flipNext("bottom");
  } else {
    flipBook.flipPrev("bottom");
  }
}

async function goToSticker(index) {
  if (desktop.matches && flipBook) flipBook.getRender().finishAnimation();
  if (visibleIndexes().includes(index)) return;
  if (!desktop.matches || !flipBook) {
    showPage(index, Math.sign(index - pageIndex));
    return;
  }
  if (reduceMotion.matches) {
    flipBook.turnToPage(index);
    return;
  }

  await new Promise(resolve => {
    function finish() {
      clearTimeout(fallback);
      pageTurn = undefined;
      resolve();
    }

    const fallback = setTimeout(() => {
      flipBook.getRender().finishAnimation();
      if (!visibleIndexes().includes(index)) flipBook.turnToPage(index);
      finish();
    }, 850);
    pageTurn = { target: index, finish };
    flipBook.flip(index, "bottom");
  });
}

function updateSelection() {
  for (const slot of slots) {
    const targeted = slot.dataset.slot === selectedId;
    slot.toggleAttribute("data-target", targeted);
    slot.disabled = !targeted || busy;
  }
  for (const button of packCards.querySelectorAll("[data-id]")) {
    button.setAttribute("aria-pressed", String(button.dataset.id === selectedId));
  }
  book.classList.toggle("is-placing", busy);
  updateNavigation();
}

function updateTrayCount() {
  document.querySelector("#tray-count").textContent = pending.size;
  document.querySelector("#tray-hint").hidden = pending.size === 0;
  document.querySelector("#tray-empty").hidden = pending.size > 0;
}

function keepPack(stickers) {
  document.querySelector("#open-pack").disabled = true;
  document.querySelector("#sealed-pack").hidden = true;
  const duplicateList = document.querySelector("#duplicate-list");
  const duplicateCounts = new Map();
  for (const sticker of stickers) {
    if (sticker.duplicate) {
      duplicateCounts.set(sticker.id, (duplicateCounts.get(sticker.id) ?? 0) + 1);
      continue;
    }
    pending.add(sticker.id);
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tray-sticker";
    button.dataset.id = sticker.id;
    button.setAttribute("aria-label", "Encontrar espaço de " + sticker.name);
    button.append(createStickerFace(sticker));
    item.append(button);
    packCards.append(item);
  }
  for (const [id, count] of duplicateCounts) {
    const row = document.createElement("p");
    const name = document.createElement("span");
    const quantity = document.createElement("strong");
    name.textContent = catalog.get(id).name;
    quantity.textContent = "×" + count;
    row.append(name, quantity);
    duplicateList.append(row);
  }
  document.querySelector("#pack-tray").hidden = false;
  document.querySelector("#duplicates").hidden = duplicateCounts.size === 0;
  document.querySelector(".back-to-pack").hidden = false;
  announcement.textContent = "Carteira guardada. Cromos por colar: " + pending.size + ".";
  updateTrayCount();
  updateSelection();
  packCards.querySelector("button")?.focus({ preventScroll: true });
  revealPredictorSection(document.querySelector("#pack-tray"));
}

function visibleSlot(sticker) {
  const page = (desktop.matches ? pages : mobilePages)[sticker.index];
  return page.querySelector('[data-slot="' + sticker.id + '"]');
}

async function findSticker(id, focusSlot) {
  if (busy || !pending.has(id)) return;
  const sticker = catalog.get(id);
  selectedId = id;
  busy = true;
  updateSelection();
  if (focusSlot && !twoColumns.matches) scrollToPredictorSection(albumPanel);

  await goToSticker(sticker.index);
  busy = false;
  updateSelection();
  if (focusSlot) visibleSlot(sticker).focus({ preventScroll: true });
  announcement.textContent = "Espaço de " + sticker.name + " encontrado em " + sticker.section + ".";
}

async function pasteSticker(id) {
  if (busy || selectedId !== id || !pending.has(id)) return;
  const sticker = catalog.get(id);
  if (!visibleIndexes().includes(sticker.index)) return;
  const slot = visibleSlot(sticker);
  const moveFocus = document.activeElement === slot;
  busy = true;
  selectedId = undefined;
  pending.delete(id);
  owned.add(id);
  for (const match of slots.filter(slot => slot.dataset.slot === id)) {
    match.setAttribute("data-owned", "");
    match.setAttribute("aria-label", sticker.name + " colado");
  }
  updateSelection();
  if (!reduceMotion.matches) {
    await slot.animate([
      { transform: "translateY(-20px) rotate(-6deg) scale(1.08)", opacity: .55 },
      { transform: "translateY(2px) rotate(1deg) scale(1.02)", opacity: 1, offset: .7 },
      { transform: "translateY(0) rotate(0) scale(1)", opacity: 1 }
    ], { duration: 410, easing: "ease-out" }).finished;
  }

  for (const link of albumPanel.querySelectorAll('[data-video="' + id + '"]')) link.hidden = false;
  collectionCount.textContent = owned.size + " / " + catalog.size + " colados";
  packCards.querySelector('[data-id="' + id + '"]').closest("li").remove();
  announcement.textContent = "Cromo colado. " + sticker.name + ".";
  busy = false;
  updateTrayCount();
  updateSelection();
  if (moveFocus) {
    const link = slot.parentElement.querySelector('[data-video="' + id + '"]');
    (link ?? next).focus({ preventScroll: true });
  }
}

setupPackOpener(trialPack, keepPack, revealPredictorSection);
packCards.addEventListener("click", event => {
  const button = event.target.closest(".tray-sticker");
  if (!button) return;
  if (suppressTrayClick === button.dataset.id && event.detail !== 0) {
    suppressTrayClick = undefined;
    return;
  }
  findSticker(button.dataset.id, true);
});
packCards.addEventListener("pointerdown", event => {
  const button = event.target.closest(".tray-sticker");
  suppressTrayClick = undefined;
  if (!button || busy || !twoColumns.matches || event.pointerType !== "mouse" || event.button !== 0) return;
  trayDrag = {
    button, id: button.dataset.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY
  };
  button.setPointerCapture(event.pointerId);
});
packCards.addEventListener("pointermove", event => {
  if (trayDrag?.pointerId !== event.pointerId) return;
  if (!trayDrag.ghost) {
    if (Math.hypot(event.clientX - trayDrag.x, event.clientY - trayDrag.y) < 7) return;
    trayDrag.ghost = document.createElement("div");
    trayDrag.ghost.className = "tray-drag-ghost";
    trayDrag.ghost.dataset.id = trayDrag.id;
    trayDrag.ghost.setAttribute("aria-hidden", "true");
    trayDrag.ghost.append(createStickerFace(catalog.get(trayDrag.id)));
    document.body.append(trayDrag.ghost);
    trayDrag.button.classList.add("is-dragging");
    trayDrag.arrival = findSticker(trayDrag.id, false);
  }
  trayDrag.ghost.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -55%) rotate(-6deg)`;
});
function finishDrag() {
  const finished = trayDrag;
  trayDrag = undefined;
  finished?.ghost?.remove();
  finished?.button.classList.remove("is-dragging");
  return finished;
}

packCards.addEventListener("pointerup", async event => {
  if (trayDrag?.pointerId !== event.pointerId) return;
  const finished = finishDrag();
  if (!finished.ghost) return;
  suppressTrayClick = finished.id;
  await finished.arrival;
  const slot = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-slot]");
  if (slot?.dataset.slot === finished.id) pasteSticker(finished.id);
  else if (slot) announcement.textContent = "Este cromo tem outro espaço na caderneta.";
});
packCards.addEventListener("pointercancel", finishDrag);
packCards.addEventListener("dragstart", event => event.preventDefault());
albumPanel.addEventListener("click", event => {
  const slot = event.target.closest("button[data-target]");
  if (slot) pasteSticker(slot.dataset.slot);
});
function notifyPredictor(kind, value, height) {
  window.parent.postMessage({ source: "predictor-caderneta", kind, value, height }, "*");
}

function scrollToPredictorSection(section) {
  notifyPredictor("scroll", section.getBoundingClientRect().top + window.scrollY);
}

function revealPredictorSection(section) {
  const rect = section.getBoundingClientRect();
  notifyPredictor("reveal", rect.top + window.scrollY, rect.height);
}

document.querySelector("#reset-test").addEventListener("click", () => notifyPredictor("reset"));
document.querySelector(".back-to-pack").addEventListener("click", () => {
  scrollToPredictorSection(document.querySelector("#carteira"));
});

new ResizeObserver(() => {
  notifyPredictor("resize", Math.ceil(document.body.getBoundingClientRect().height));
}).observe(document.body);
prev.addEventListener("click", () => turn(-1));
next.addEventListener("click", () => turn(1));
phone.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.target.closest("a, button:enabled")) return;
  touchStart = { x: event.clientX, y: event.clientY };
  phone.setPointerCapture(event.pointerId);
});
phone.addEventListener("pointerup", event => {
  if (!touchStart || !event.isPrimary) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = undefined;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) turn(dx < 0 ? 1 : -1);
});
phone.addEventListener("pointercancel", () => { touchStart = undefined; });
desktop.addEventListener("change", () => {
  setupDesktop();
  updateNavigation();
});

setupDesktop();
updateNavigation();
