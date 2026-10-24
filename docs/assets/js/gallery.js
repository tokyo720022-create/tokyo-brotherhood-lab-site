/* Screenshot gallery + lightbox for the What's Next project page.
 *
 * Reads ../data/screenshots.json (genuine app screenshots only). While that
 * list is empty the static "screenshots coming soon" notice in the page stays.
 *
 * The lightbox uses a native <dialog> opened with showModal(), which gives a
 * focus trap, an inert background and Esc-to-close for free. On top of that:
 * close button, previous/next buttons, arrow/Home/End keys, swipe, a click on
 * the backdrop, and focus returning to the thumbnail that opened it.
 *
 * Requires site-utils.js (window.TBL).
 */
(function () {
  "use strict";

  var TBL = window.TBL;
  var root = document.getElementById("screenshotGallery");
  if (!TBL || !root) return;
  var el = TBL.element;

  var MANIFEST_URL = root.getAttribute("data-manifest") || "../data/screenshots.json";
  var IMAGE_DIR = root.getAttribute("data-image-dir") || "../assets/images/whats-next/screenshots/";
  var FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|avif|png|jpe?g)$/i;
  var SWIPE_PX = 50;

  var items = [];
  var dialog = null;
  var parts = {};
  var current = 0;
  var opener = null;

  /* ---------- manifest ---------- */

  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function dimension(value) { var n = Number(value); return Number.isInteger(n) && n > 0 && n < 20000 ? n : 0; }

  // Only well-formed entries with real alt text are shown; paths can't leave the image folder.
  function cleanEntries(list) {
    var clean = [];
    (Array.isArray(list) ? list : []).forEach(function (raw) {
      if (!raw || !FILE_RE.test(text(raw.file)) || !text(raw.alt)) return;
      var thumb = FILE_RE.test(text(raw.thumb)) ? text(raw.thumb) : text(raw.file);
      clean.push({
        full: IMAGE_DIR + text(raw.file),
        thumb: IMAGE_DIR + thumb,
        width: dimension(raw.width),
        height: dimension(raw.height),
        title: text(raw.title) || "Screenshot",
        alt: text(raw.alt),
        caption: text(raw.caption)
      });
    });
    return clean;
  }

  /* ---------- lightbox ---------- */

  function buildDialog() {
    dialog = el("dialog", "lightbox");
    dialog.setAttribute("aria-labelledby", "lightboxTitle");
    dialog.setAttribute("aria-describedby", "lightboxCaption");

    var bar = el("div", "lightbox-bar");
    parts.count = el("span", "", "");
    parts.count.setAttribute("aria-live", "polite");
    parts.close = el("button", "lightbox-button", "×");
    parts.close.type = "button";
    parts.close.setAttribute("aria-label", "Close screenshot viewer");
    bar.appendChild(parts.count);
    bar.appendChild(parts.close);

    var body = el("div", "lightbox-body");
    parts.prev = el("button", "lightbox-button lightbox-prev", "‹");
    parts.prev.type = "button";
    parts.prev.setAttribute("aria-label", "Previous screenshot");
    parts.next = el("button", "lightbox-button lightbox-next", "›");
    parts.next.type = "button";
    parts.next.setAttribute("aria-label", "Next screenshot");

    var figure = el("figure", "lightbox-figure");
    parts.image = el("img");
    parts.title = el("strong");
    parts.title.id = "lightboxTitle";
    parts.caption = el("span");
    parts.caption.id = "lightboxCaption";
    var caption = el("figcaption", "lightbox-caption");
    caption.appendChild(parts.title);
    caption.appendChild(parts.caption);
    figure.appendChild(parts.image);
    figure.appendChild(caption);

    body.appendChild(parts.prev);
    body.appendChild(figure);
    body.appendChild(parts.next);
    dialog.appendChild(bar);
    dialog.appendChild(body);
    document.body.appendChild(dialog);

    parts.close.addEventListener("click", function () { dialog.close(); });
    parts.prev.addEventListener("click", function () { show(current - 1); });
    parts.next.addEventListener("click", function () { show(current + 1); });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();                // click on the backdrop
    });
    dialog.addEventListener("keydown", function (event) {
      if (items.length < 2) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); show(current - 1); }
      else if (event.key === "ArrowRight") { event.preventDefault(); show(current + 1); }
      else if (event.key === "Home") { event.preventDefault(); show(0); }
      else if (event.key === "End") { event.preventDefault(); show(items.length - 1); }
    });
    dialog.addEventListener("close", function () {
      document.documentElement.classList.remove("lightbox-open");
      if (opener && document.contains(opener)) opener.focus();
      opener = null;
    });

    var startX = null;
    parts.image.addEventListener("touchstart", function (event) {
      startX = event.changedTouches[0].clientX;
    }, { passive: true });
    parts.image.addEventListener("touchend", function (event) {
      if (startX === null || items.length < 2) return;
      var delta = event.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(delta) >= SWIPE_PX) show(delta < 0 ? current + 1 : current - 1);
    }, { passive: true });
  }

  function show(index) {
    current = (index + items.length) % items.length;
    var item = items[current];
    parts.image.src = item.full;
    parts.image.alt = item.alt;
    if (item.width && item.height) {
      parts.image.width = item.width;
      parts.image.height = item.height;
    } else {
      parts.image.removeAttribute("width");
      parts.image.removeAttribute("height");
    }
    parts.title.textContent = item.title;
    parts.caption.textContent = item.caption;
    parts.count.textContent = (current + 1) + " of " + items.length;
    var single = items.length < 2;
    parts.prev.hidden = single;
    parts.next.hidden = single;

    // Warm the cache for the neighbours so next/previous feels instant.
    if (!single) {
      [current - 1, current + 1].forEach(function (i) {
        var neighbour = items[(i + items.length) % items.length];
        new Image().src = neighbour.full;
      });
    }
  }

  function open(index, trigger) {
    if (typeof HTMLDialogElement === "undefined") {              // very old browsers: open the image itself
      window.open(items[index].full, "_blank", "noopener");
      return;
    }
    if (!dialog) buildDialog();
    opener = trigger;
    show(index);
    document.documentElement.classList.add("lightbox-open");
    dialog.showModal();
  }

  /* ---------- grid ---------- */

  function renderGrid() {
    root.replaceChildren();
    items.forEach(function (item, index) {
      var card = el("figure", "shot-card");
      var button = el("button", "shot-button");
      button.type = "button";
      button.setAttribute("aria-haspopup", "dialog");

      var img = el("img");
      img.src = item.thumb;
      img.alt = item.alt;
      img.loading = "lazy";
      img.decoding = "async";
      if (item.width && item.height) {
        img.width = item.width;
        img.height = item.height;
      }
      button.appendChild(img);
      button.appendChild(el("span", "visually-hidden", ", opens a larger view"));
      button.addEventListener("click", function () { open(index, button); });
      card.appendChild(button);

      var caption = el("figcaption");
      caption.appendChild(el("strong", "", item.title));
      if (item.caption) caption.appendChild(document.createTextNode(item.caption));
      card.appendChild(caption);
      root.appendChild(card);
    });
  }

  /* ---------- start ---------- */

  TBL.fetchJson(MANIFEST_URL, { cache: "no-cache" })
    .then(function (data) {
      items = cleanEntries(data && data.screenshots);
      if (items.length) renderGrid();                             // otherwise the static notice stays
    })
    .catch(function () { /* keep the static notice */ });
}());
