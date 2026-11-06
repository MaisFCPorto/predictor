"use strict";

function createStickerFace(sticker) {
  const face = document.createElement("span");
  face.className = "card-face card-front";
  const number = document.createElement("strong");
  number.textContent = sticker.number;
  const name = document.createElement("span");
  name.textContent = sticker.name;
  face.append(number, name);
  return face;
}

function setupPackOpener(stickers, onKeep, revealSection) {
  const dialog = document.querySelector("#pack-dialog");
  const trigger = document.querySelector("#open-pack");
  const title = document.querySelector("#pack-dialog-title");
  const flap = document.querySelector("#pack-flap");
  const tearButton = document.querySelector("#tear-pack");
  const revealAll = document.querySelector("#reveal-all");
  const keep = document.querySelector("#keep-pack");
  const fan = document.querySelector("#reveal-cards");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const revealed = new Set();
  let tearTimer;
  let pull;
  let suppressFlapClick = false;

  const cards = stickers.map((sticker, index) => {
    const card = document.createElement("button");
    card.className = "reveal-card";
    card.type = "button";
    card.dataset.id = sticker.id;
    card.toggleAttribute("data-duplicate", sticker.duplicate);
    card.innerHTML = '<span class="card-turner" aria-hidden="true"><span class="card-face card-back"><span>+</span></span></span>';
    card.firstElementChild.append(createStickerFace(sticker));
    const tag = document.createElement("span");
    tag.className = "reveal-tag";
    tag.setAttribute("aria-hidden", "true");
    tag.textContent = sticker.duplicate ? "Repetido" : "Novo";
    card.append(tag);
    card.addEventListener("click", () => {
      if (dialog.dataset.stage !== "fan") return;
      reveal(index);
      updateActions();
    });
    fan.append(card);
    return card;
  });

  function reveal(index) {
    const sticker = stickers[index];
    const card = cards[index];
    revealed.add(index);
    card.setAttribute("data-revealed", "");
    card.setAttribute("aria-label", sticker.name + (sticker.duplicate ? ", repetido" : ", novo"));
  }

  function updateActions() {
    if (revealed.size !== cards.length) return;
    const newCount = stickers.filter(sticker => !sticker.duplicate).length;
    title.textContent = newCount === 1 ? "1 cromo novo!" : newCount + " cromos novos!";
    revealAll.hidden = true;
    keep.hidden = false;
    keep.focus({ preventScroll: true });
    revealSection(dialog);
  }

  function enableReveal() {
    if (!dialog.open) return;
    title.textContent = "Toca nos cromos para os virar";
    fan.removeAttribute("aria-hidden");
    for (const card of cards) card.disabled = false;
    revealAll.hidden = false;
    cards[0].focus({ preventScroll: true });
    revealSection(dialog);
  }

  function showFan() {
    if (!dialog.open) return;
    dialog.dataset.stage = "fan";
    if (reduceMotion.matches) enableReveal();
    else tearTimer = setTimeout(enableReveal, 640);
  }

  function tearPack() {
    if (dialog.dataset.stage !== "sealed") return;
    pull = undefined;
    flap.style.setProperty("--tear-progress", "1");
    flap.disabled = true;
    tearButton.hidden = true;
    dialog.dataset.stage = "torn";
    title.textContent = "A abrir a carteira…";
    if (reduceMotion.matches) showFan();
    else tearTimer = setTimeout(showFan, 460);
  }

  trigger.addEventListener("click", () => {
    if (dialog.open || trigger.disabled) return;
    revealed.clear();
    suppressFlapClick = false;
    dialog.dataset.stage = "sealed";
    title.textContent = "Puxa a tira para rasgar";
    flap.style.setProperty("--tear-progress", "0");
    flap.disabled = false;
    tearButton.hidden = false;
    revealAll.hidden = true;
    keep.hidden = true;
    fan.setAttribute("aria-hidden", "true");
    cards.forEach((card, index) => {
      card.disabled = true;
      card.removeAttribute("data-revealed");
      card.setAttribute("aria-label", "Virar cromo " + (index + 1));
    });
    dialog.showModal();
    flap.focus({ preventScroll: true });
    revealSection(dialog);
  });

  flap.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressFlapClick = false;
    const distance = flap.getBoundingClientRect().width * .72;
    pull = { pointerId: event.pointerId, startX: event.clientX, distance, progress: 0, moved: false };
    flap.setPointerCapture(event.pointerId);
  });
  flap.addEventListener("pointermove", event => {
    if (pull?.pointerId !== event.pointerId) return;
    const dx = event.clientX - pull.startX;
    pull.moved ||= Math.abs(dx) > 5;
    pull.progress = Math.max(pull.progress, Math.min(1, dx / pull.distance));
    flap.style.setProperty("--tear-progress", pull.progress);
    if (pull.progress === 1) tearPack();
  });
  flap.addEventListener("pointerup", event => {
    if (pull?.pointerId !== event.pointerId) return;
    const { moved, progress } = pull;
    pull = undefined;
    if (!moved) return;
    suppressFlapClick = true;
    if (progress >= .55) tearPack();
    else flap.style.setProperty("--tear-progress", "0");
  });
  flap.addEventListener("pointercancel", () => {
    pull = undefined;
    flap.style.setProperty("--tear-progress", "0");
  });
  flap.addEventListener("click", event => {
    if (!suppressFlapClick || event.detail === 0) tearPack();
  });
  tearButton.addEventListener("click", tearPack);
  revealAll.addEventListener("click", () => {
    cards.forEach((_, index) => reveal(index));
    updateActions();
  });
  keep.addEventListener("click", () => {
    if (revealed.size !== cards.length) return;
    dialog.close();
    onKeep(stickers);
  });
  document.querySelector("#close-pack").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    clearTimeout(tearTimer);
    pull = undefined;
    if (!trigger.disabled) {
      trigger.focus({ preventScroll: true });
      revealSection(trigger);
    }
  });
}
