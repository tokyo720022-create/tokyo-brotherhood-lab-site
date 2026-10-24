/* Roadmap for the What's Next project page.
 *
 * Renders ../data/roadmap.json (statuses + areas + items). To update the
 * roadmap, edit that file only; no HTML changes are needed.
 *
 * Requires site-utils.js (window.TBL).
 */
(function () {
  "use strict";

  var TBL = window.TBL;
  var root = document.getElementById("roadmapContent");
  if (!TBL || !root) return;
  var el = TBL.element;

  var DATA_URL = root.getAttribute("data-source") || "../data/roadmap.json";
  var ID_RE = /^[a-z][a-z0-9-]*$/;
  var RELEASED = "released";

  function text(value) { return typeof value === "string" ? value.trim() : ""; }

  function readStatuses(list) {
    var statuses = [];
    (Array.isArray(list) ? list : []).forEach(function (s) {
      if (s && ID_RE.test(text(s.id)) && text(s.label)) {
        statuses.push({ id: text(s.id), label: text(s.label), description: text(s.description) });
      }
    });
    return statuses;
  }

  function badge(status) {
    var node = el("span", "status-badge status-" + status.id, status.label);
    if (status.description) node.title = status.description;
    return node;
  }

  function renderLegend(statuses, counts) {
    var legend = el("ul", "roadmap-legend");
    legend.setAttribute("aria-label", "Roadmap status key");
    statuses.forEach(function (status) {
      var item = el("li");
      item.appendChild(badge(status));
      var count = counts[status.id] || 0;
      item.appendChild(el("strong", "", count + (count === 1 ? " item" : " items")));
      legend.appendChild(item);
    });
    return legend;
  }

  function renderGroup(area, title, items, statusById) {
    if (!items.length) return;
    var heading = el("h4", "roadmap-group-title", title);
    area.appendChild(heading);
    var list = el("ul", "roadmap-items");
    items.forEach(function (item) {
      var li = el("li", "roadmap-item");
      var copy = el("div", "roadmap-item-text");
      copy.appendChild(el("strong", "", item.title));
      if (item.description) copy.appendChild(el("span", "", item.description));
      li.appendChild(copy);
      li.appendChild(badge(statusById[item.status]));
      list.appendChild(li);
    });
    area.appendChild(list);
  }

  function render(data) {
    var statuses = readStatuses(data.statuses);
    if (!statuses.length || !Array.isArray(data.areas)) throw new Error("Invalid roadmap data");
    var statusById = {};
    var order = {};
    statuses.forEach(function (s, i) { statusById[s.id] = s; order[s.id] = i; });

    var counts = {};
    var areas = [];
    data.areas.forEach(function (rawArea) {
      if (!rawArea || !text(rawArea.title)) return;
      var items = [];
      (Array.isArray(rawArea.items) ? rawArea.items : []).forEach(function (rawItem) {
        var status = text(rawItem && rawItem.status);
        if (!rawItem || !text(rawItem.title) || !statusById[status]) return;     // unknown status: not shown
        items.push({ title: text(rawItem.title), description: text(rawItem.description), status: status });
        counts[status] = (counts[status] || 0) + 1;
      });
      if (items.length) areas.push({ title: text(rawArea.title), description: text(rawArea.description), items: items });
    });

    root.replaceChildren();
    root.appendChild(renderLegend(statuses, counts));

    var grid = el("div", "roadmap-grid");
    areas.forEach(function (area) {
      var card = el("article", "roadmap-area");
      card.appendChild(el("h3", "", area.title));
      if (area.description) card.appendChild(el("p", "roadmap-area-desc", area.description));

      var released = area.items.filter(function (i) { return i.status === RELEASED; });
      var upcoming = area.items
        .filter(function (i) { return i.status !== RELEASED; })
        .sort(function (a, b) { return order[a.status] - order[b.status]; });
      renderGroup(card, "Available now", released, statusById);
      renderGroup(card, "Coming up", upcoming, statusById);
      grid.appendChild(card);
    });
    root.appendChild(grid);

    var note = text(data.note);
    var reviewed = text(data.reviewed);
    var line = note;
    if (reviewed) {
      line += (line ? " " : "") + "Last reviewed " + TBL.formatDate(reviewed) +
        (text(data.appVersion) ? " against What's Next v" + text(data.appVersion) + "." : ".");
    }
    if (line) root.appendChild(el("p", "roadmap-note", line));
  }

  TBL.fetchJson(DATA_URL, { cache: "no-cache" })
    .then(render)
    .catch(function () {
      root.replaceChildren(el("p", "roadmap-note", "The roadmap couldn't be loaded right now. Please refresh the page, or see the project README on GitHub for the current feature list."));
    });
}());
