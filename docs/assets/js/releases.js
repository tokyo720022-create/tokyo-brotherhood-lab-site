/* APK releases page for What's Next.
 *
 * Data source order (unchanged):
 *   1. ../../data/releases.json  - snapshot written by the "Update release data"
 *      GitHub Action (tools/fetch_releases.py), so visitors never hit the API limit.
 *   2. GitHub's public Releases API - used when the snapshot is missing or is
 *      still the empty placeholder.
 *
 * Pipeline: load releases -> one record per APK asset -> search + type filter
 * -> sort -> render. Everything is built with DOM nodes (never innerHTML), so
 * release notes and release data cannot inject markup.
 *
 * Requires site-utils.js (window.TBL).
 */
(function () {
  "use strict";

  var TBL = window.TBL;
  if (!TBL) return;
  var el = TBL.element;

  var SNAPSHOT_URL = "../../data/releases.json";
  var LIVE_API = "https://api.github.com/repos/" + TBL.config.repo + "/releases?per_page=100&page=";
  var OFFICIAL_RELEASES_URL = TBL.config.releasesUrl;
  var OFFICIAL_PATH = "/" + TBL.config.repo + "/";
  var INSTALL_GUIDE_URL = "installation.html";
  var MAX_PAGES = 20;
  var LONG_NOTES_CHARS = 500;
  var LONG_NOTES_LINES = 8;
  var SEARCH_DELAY_MS = 150;

  var TYPE_LABELS = { stable: "Stable release", prerelease: "Pre-release", debug: "Debug / testing build" };
  var DEFAULTS = { query: "", type: "all", sort: "newest" };

  var dom = {
    list: document.getElementById("releaseList"),
    status: document.getElementById("releaseStatus"),
    notice: document.getElementById("releaseNotice"),
    controls: document.getElementById("releaseControls"),
    search: document.getElementById("releaseSearch"),
    sort: document.getElementById("releaseSort"),
    reset: document.getElementById("releaseReset"),
    results: document.getElementById("releaseResults")
  };
  if (!dom.list || !dom.status) return;

  var allEntries = [];
  var markers = { latestStable: null, newestTest: null };
  var state = { query: DEFAULTS.query, type: DEFAULTS.type, sort: DEFAULTS.sort };

  /* ---------- trusted official URLs only ---------- */

  function officialUrl(value, mustStartWith) {
    var url = TBL.safeUrl(value, function (u) {
      return u.protocol === "https:" && u.hostname === "github.com" && u.pathname.indexOf(OFFICIAL_PATH + mustStartWith) === 0;
    });
    return url;
  }

  /* ---------- records ---------- */

  // "debug"/"test"/"testing" as a whole word in the file name, tag or release title.
  // Deliberately broad: wrongly calling a stable build "debug" is harmless, the
  // opposite (a debug APK shown as stable) is not.
  var TEST_WORD = /(?:^|[^a-z])(debug|testing|test)(?:[^a-z]|$)/i;

  function toEntry(release, asset) {
    var name = String(asset.name);
    var isDebug = [name, release.tag_name, release.name].some(function (value) {
      return TEST_WORD.test(String(value || ""));
    });
    var isPre = Boolean(release.prerelease);
    var size = asset.size === null || asset.size === undefined || asset.size === "" ? NaN : Number(asset.size);
    var entry = {
      release: release,
      asset: asset,
      downloadUrl: officialUrl(asset.browser_download_url, "releases/download/"),
      releaseUrl: officialUrl(release.html_url, "releases") || OFFICIAL_RELEASES_URL,
      releaseName: release.name || release.tag_name || "APK release",
      tag: release.tag_name || "",
      file: name,
      published: release.published_at || release.created_at || "",
      uploaded: asset.created_at || asset.updated_at || "",
      size: Number.isFinite(size) && size >= 0 ? size : null,
      downloads: Number(asset.download_count) || 0,
      isDebug: isDebug,
      isPre: isPre,
      type: isDebug ? "debug" : isPre ? "prerelease" : "stable"
    };
    // "How recent is this build": this project's CI re-uses one release and
    // replaces its APK, so the asset upload date can be newer than the release.
    entry.when = Math.max(TBL.timeOf(entry.published), TBL.timeOf(entry.uploaded));
    entry.haystack = [entry.releaseName, entry.tag, entry.file].join("\n").toLowerCase();
    return entry;
  }

  function buildEntries(releases) {
    var entries = [];
    releases.forEach(function (release) {
      if (!release || release.draft) return;
      (release.assets || []).forEach(function (asset) {
        if (!asset || !asset.name || !/\.apk$/i.test(asset.name)) return;
        var entry = toEntry(release, asset);
        if (entry.downloadUrl) entries.push(entry);          // untrusted download links are dropped
      });
    });
    return entries;
  }

  /* ---------- sorting / filtering ---------- */

  function byNewest(a, b) {
    return (b.when - a.when) ||
      (TBL.timeOf(b.published) - TBL.timeOf(a.published)) ||
      a.file.localeCompare(b.file);
  }

  // Compare sizes (dir 1 = ascending, -1 = descending); unknown sizes always go last.
  function bySize(a, b, dir) {
    if (a.size === null && b.size === null) return 0;
    if (a.size === null) return 1;
    if (b.size === null) return -1;
    return dir * (a.size - b.size);
  }

  var SORTERS = {
    newest: byNewest,
    oldest: function (a, b) { return byNewest(b, a); },
    largest: function (a, b) { return bySize(a, b, -1) || byNewest(a, b); },
    smallest: function (a, b) { return bySize(a, b, 1) || byNewest(a, b); },
    downloads: function (a, b) { return (b.downloads - a.downloads) || byNewest(a, b); }
  };

  function matchesQuery(entry, query) {
    var words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return words.every(function (word) { return entry.haystack.indexOf(word) !== -1; });
  }

  function visibleEntries() {
    var sorter = SORTERS[state.sort] || SORTERS.newest;
    return allEntries
      .filter(function (e) { return matchesQuery(e, state.query) && (state.type === "all" || e.type === state.type); })
      .sort(sorter);
  }

  function pickMarkers(entries) {
    var sorted = entries.slice().sort(byNewest);
    markers.latestStable = null;
    markers.newestTest = null;
    for (var i = 0; i < sorted.length; i += 1) {
      if (!markers.latestStable && sorted[i].type === "stable") markers.latestStable = sorted[i];
      if (!markers.newestTest && sorted[i].type === "debug") markers.newestTest = sorted[i];
    }
  }

  /* ---------- rendering ---------- */

  function plural(count, word) { return count + " " + word + (count === 1 ? "" : "s"); }

  function badge(text, className) { return el("span", "release-badge " + className, text); }

  function renderNotes(entry) {
    var notes = el("div", "release-notes");
    var body = entry.release.body && String(entry.release.body).trim();
    if (!body) {
      notes.appendChild(el("p", "", "No release notes were provided for this release."));
      return notes;
    }
    var lineCount = body.split(/\r\n|\r|\n/).length;
    if (body.length > LONG_NOTES_CHARS || lineCount > LONG_NOTES_LINES) {
      var details = el("details");
      details.appendChild(el("summary", "", "Release notes (tap to expand)"));
      TBL.renderMarkdown(details, body);
      notes.appendChild(details);
    } else {
      TBL.renderMarkdown(notes, body);
    }
    return notes;
  }

  function renderEntry(entry, index) {
    var card = el("article", "release-card");
    var titleId = "apk-title-" + index;
    card.setAttribute("aria-labelledby", titleId);
    card.dataset.type = entry.type;

    var head = el("div", "release-card-head");
    var titleWrap = el("div");
    titleWrap.appendChild(el("div", "release-tag", entry.tag || "GitHub release"));
    var title = el("h2", "", entry.releaseName);
    title.id = titleId;
    titleWrap.appendChild(title);
    head.appendChild(titleWrap);

    var badges = el("div", "release-badges");
    if (entry === markers.latestStable) badges.appendChild(badge("Latest stable", "latest-stable"));
    badges.appendChild(badge(TYPE_LABELS[entry.type], entry.type));
    if (entry.isPre && entry.type !== "prerelease") badges.appendChild(badge("Pre-release", "prerelease"));
    if (entry === markers.newestTest) badges.appendChild(badge("Newest test build", "newest-test"));
    head.appendChild(badges);
    card.appendChild(head);

    var meta = el("div", "release-meta");
    meta.appendChild(el("span", "", "Published: " + TBL.formatDate(entry.published)));
    meta.appendChild(el("span", "", "APK uploaded: " + TBL.formatDate(entry.uploaded || entry.published)));
    meta.appendChild(el("span", "", "File size: " + TBL.formatSize(entry.size)));
    meta.appendChild(el("span", "", "Downloads: " + entry.downloads.toLocaleString()));
    card.appendChild(meta);

    card.appendChild(renderNotes(entry));

    var assetBox = el("div", "asset-box");
    var assetInfo = el("div", "asset-info");
    assetInfo.appendChild(el("div", "asset-name", entry.file));
    assetInfo.appendChild(el("div", "asset-description", "Android application package · " + TBL.formatSize(entry.size)));
    assetBox.appendChild(assetInfo);

    var download = el("a", "download-button", "Download APK ↓");
    download.href = entry.downloadUrl;
    download.rel = "noopener noreferrer";
    download.setAttribute("aria-label", "Download " + entry.file);
    assetBox.appendChild(download);
    card.appendChild(assetBox);

    var actions = el("div", "release-actions");
    var releaseLink = TBL.externalLink(entry.releaseUrl, "Release page on GitHub ↗");
    releaseLink.className = "text-link";
    actions.appendChild(releaseLink);

    var guide = el("a", "text-link", "Installation guide →");
    guide.href = INSTALL_GUIDE_URL;
    actions.appendChild(guide);

    var report = TBL.externalLink(TBL.bugReportUrl({ apk: entry.file, tag: entry.tag, release: entry.releaseName }), "Report a problem with this build ↗");
    report.className = "text-link report-link";
    actions.appendChild(report);
    card.appendChild(actions);

    var digest = entry.asset.digest;
    if (digest && /^sha256:/i.test(digest)) {
      var checksum = el("details", "checksum");
      checksum.appendChild(el("summary", "", "Show SHA-256 checksum"));
      checksum.appendChild(el("code", "", String(digest).replace(/^sha256:/i, "")));
      card.appendChild(checksum);
    }
    return card;
  }

  function emptyBox(title, message, buttonLabel, onClick) {
    var box = el("div", "empty-state");
    box.appendChild(el("strong", "", title));
    box.appendChild(el("p", "", message));
    if (buttonLabel) {
      var button = el("button", "button", buttonLabel);
      button.type = "button";
      button.addEventListener("click", onClick);
      box.appendChild(button);
    } else {
      var link = TBL.externalLink(OFFICIAL_RELEASES_URL, "View official GitHub releases ↗");
      link.className = "text-link";
      box.appendChild(link);
    }
    return box;
  }

  function updateCounts() {
    var counts = { all: 0, stable: 0, prerelease: 0, debug: 0 };
    allEntries.forEach(function (entry) {
      if (!matchesQuery(entry, state.query)) return;
      counts.all += 1;
      counts[entry.type] += 1;
    });
    Object.keys(counts).forEach(function (type) {
      var node = document.querySelector('[data-count="' + type + '"]');
      if (node) node.textContent = counts[type];
    });
  }

  function render() {
    var entries = visibleEntries();
    updateCounts();
    dom.list.replaceChildren();

    if (!entries.length) {
      dom.list.appendChild(emptyBox(
        "No APK files match",
        "Nothing matches your search and filters. Try fewer words, a different build type, or clear everything to see all " + plural(allEntries.length, "APK file") + ".",
        "Clear all filters",
        resetFilters
      ));
    } else {
      entries.forEach(function (entry, index) { dom.list.appendChild(renderEntry(entry, index)); });
    }

    if (dom.results) {
      var filtering = state.query.trim() !== "" || state.type !== "all";
      if (!filtering) {
        dom.results.textContent = "Showing all " + plural(allEntries.length, "APK file") + ".";
      } else if (!entries.length) {
        dom.results.textContent = "No APK files match your search and filters.";
      } else {
        dom.results.textContent = entries.length + " of " + plural(allEntries.length, "APK file") + " match your search and filters.";
      }
    }
  }

  function renderNotice() {
    if (!dom.notice) return;
    dom.notice.replaceChildren();
    dom.notice.hidden = true;
    if (!allEntries.length || markers.latestStable) return;

    var hasPre = allEntries.some(function (e) { return e.type === "prerelease"; });
    var intro = hasPre
      ? "Every APK listed here is a pre-release or a debug/testing build."
      : "Every APK listed here is a debug/testing build.";
    dom.notice.appendChild(el("strong", "", "No stable release has been published yet. "));
    dom.notice.appendChild(document.createTextNode(
      intro + " Debug builds are meant for testing and use a debug signing key, so Android may refuse to install one over another. Read the "
    ));
    var guide = el("a", "text-link", "installation guide");
    guide.href = INSTALL_GUIDE_URL;
    dom.notice.appendChild(guide);
    dom.notice.appendChild(document.createTextNode(" before installing."));
    dom.notice.hidden = false;
  }

  /* ---------- controls ---------- */

  function syncControls() {
    if (dom.search) dom.search.value = state.query;
    if (dom.sort) dom.sort.value = state.sort;
    Array.prototype.forEach.call(document.querySelectorAll('input[name="releaseType"]'), function (radio) {
      radio.checked = radio.value === state.type;
    });
  }

  function resetFilters() {
    state.query = DEFAULTS.query;
    state.type = DEFAULTS.type;
    state.sort = DEFAULTS.sort;
    syncControls();
    render();
    if (dom.search) dom.search.focus();
  }

  function bindControls() {
    if (!dom.controls) return;
    var timer = null;

    dom.controls.addEventListener("submit", function (event) { event.preventDefault(); });

    if (dom.search) {
      dom.search.addEventListener("input", function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () { state.query = dom.search.value; render(); }, SEARCH_DELAY_MS);
      });
      dom.search.addEventListener("search", function () {           // the browser's own clear (x) button
        window.clearTimeout(timer);
        state.query = dom.search.value;
        render();
      });
      dom.search.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && dom.search.value) {
          event.preventDefault();
          window.clearTimeout(timer);
          dom.search.value = "";
          state.query = "";
          render();
        }
      });
    }
    if (dom.sort) {
      dom.sort.addEventListener("change", function () { state.sort = dom.sort.value; render(); });
    }
    Array.prototype.forEach.call(document.querySelectorAll('input[name="releaseType"]'), function (radio) {
      radio.addEventListener("change", function () { if (radio.checked) { state.type = radio.value; render(); } });
    });
    if (dom.reset) dom.reset.addEventListener("click", resetFilters);
  }

  /* ---------- data loading ---------- */

  function showReleases(releases, syncedAt) {
    allEntries = buildEntries(releases);
    pickMarkers(allEntries);

    if (!allEntries.length) {
      dom.status.textContent = "No APK files found in the published release list.";
      if (dom.controls) dom.controls.hidden = true;
      if (dom.results) dom.results.textContent = "";
      renderNotice();
      dom.list.replaceChildren(emptyBox(
        "No APKs published yet",
        "When an Android APK is attached to a published What's Next release, it will appear here automatically."
      ));
      return;
    }

    var text = plural(allEntries.length, "APK file") + " found across the published GitHub releases.";
    if (syncedAt) text += " Release data last updated: " + TBL.formatDate(syncedAt) + ".";
    dom.status.textContent = text;

    if (dom.controls) dom.controls.hidden = false;
    renderNotice();
    syncControls();
    render();
  }

  async function loadSnapshot() {
    try {
      var data = await TBL.fetchJson(SNAPSHOT_URL, { cache: "no-cache" });
      if (!data || typeof data.updated_at !== "string" || !Array.isArray(data.releases)) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  async function loadLive() {
    var all = [];
    var page = 1;
    var batch;
    do {
      batch = await TBL.fetchJson(LIVE_API + page, { headers: { "Accept": "application/vnd.github+json" } });
      if (!Array.isArray(batch)) throw new Error("Unexpected release response");
      all = all.concat(batch);
      page += 1;
    } while (batch.length === 100 && page <= MAX_PAGES);
    return all;
  }

  async function loadReleases() {
    try {
      var snapshot = await loadSnapshot();
      if (snapshot) showReleases(snapshot.releases, snapshot.updated_at);
      else showReleases(await loadLive(), null);
    } catch (error) {
      dom.status.textContent = "The automatic release list could not be loaded right now.";
      if (dom.controls) dom.controls.hidden = true;
      if (dom.results) dom.results.textContent = "";
      dom.list.replaceChildren(emptyBox(
        "Couldn't load releases",
        "You can still browse the published builds directly on GitHub. The release list here will retry when the page is refreshed."
      ));
    }
  }

  bindControls();
  loadReleases();
}());
