/* Shared helpers for Tokyo Brotherhood Lab pages (plain script, no dependencies).
 *
 * Loaded before the page scripts (gallery.js, roadmap.js, releases.js) and
 * exposes one global namespace: window.TBL.
 *
 *   TBL.config           project constants (repository, issue links)
 *   TBL.element()        safe DOM builder (always textContent, never innerHTML)
 *   TBL.safeUrl()        http/https-only URL validation
 *   TBL.githubUrl()      only accepts https://github.com/... links
 *   TBL.renderMarkdown() small, safe Markdown renderer for release notes
 *   TBL.fetchJson()      fetch + JSON parse with status checking
 *   TBL.bugReportUrl() / TBL.feedbackUrl()   prefilled GitHub issue links
 *
 * Every <a data-bug-report> / <a data-feedback> on a page is upgraded
 * automatically; without JavaScript they still link to the plain GitHub
 * "new issue" page.
 */
(function (global) {
  "use strict";

  var TBL = (global.TBL = global.TBL || {});

  TBL.config = {
    repo: "tokyo720022-create/What-Next",
    issuesNewUrl: "https://github.com/tokyo720022-create/What-Next/issues/new",
    releasesUrl: "https://github.com/tokyo720022-create/What-Next/releases",
    // The What-Next repository has no .github/ISSUE_TEMPLATE folder yet, so the
    // links prefill the issue body themselves. If you add bug_report.md and
    // feedback.md under .github/ISSUE_TEMPLATE in the What-Next repository (the
    // optional templates delivered with this update), set this to true and the
    // links will open those templates instead.
    useIssueTemplates: false,
    bugTemplateFile: "bug_report.md",
    feedbackTemplateFile: "feedback.md"
  };

  /* ---------- DOM + URL helpers ---------- */

  TBL.element = function (tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  TBL.safeUrl = function (value, hostRule) {
    try {
      var parsed = new URL(value);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      if (hostRule && !hostRule(parsed)) return null;
      return parsed.href;
    } catch (error) {
      return null;
    }
  };

  // Only https://github.com/... is accepted; anything else falls back to the
  // official releases page so a bad value can never become a download link.
  TBL.githubUrl = function (value, fallback) {
    return TBL.safeUrl(value, function (u) {
      return u.protocol === "https:" && u.hostname === "github.com";
    }) || fallback || TBL.config.releasesUrl;
  };

  TBL.externalLink = function (url, label) {
    var link = TBL.element("a", "", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  };

  /* ---------- formatting ---------- */

  TBL.formatDate = function (value) {
    if (!value) return "Date not listed";
    var plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));          // date-only: don't shift across time zones
    var date = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(value);
    if (isNaN(date.getTime())) return "Date not listed";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  };

  TBL.formatSize = function (bytes) {
    if (bytes === null || bytes === undefined || bytes === "" || !Number.isFinite(Number(bytes)) || Number(bytes) < 0) {
      return "Size not listed";
    }
    var mb = Number(bytes) / (1024 * 1024);
    return mb < 0.01 ? String(bytes) + " bytes" : mb.toFixed(mb >= 100 ? 0 : 2) + " MB";
  };

  TBL.timeOf = function (value) {
    var t = Date.parse(value || "");
    return isNaN(t) ? 0 : t;
  };

  TBL.fetchJson = async function (url, options) {
    var response = await fetch(url, options || { cache: "no-cache" });
    if (!response.ok) throw new Error("Request failed (" + response.status + "): " + url);
    return response.json();
  };

  /* ---------- minimal, safe Markdown for release notes ---------- */

  var INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)'"\]])/g;

  function appendInline(parent, text) {
    var last = 0;
    var match;
    INLINE.lastIndex = 0;
    while ((match = INLINE.exec(text)) !== null) {
      if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      if (match[1] !== undefined) {
        parent.appendChild(TBL.element("code", "", match[1]));
      } else if (match[2] !== undefined) {
        parent.appendChild(TBL.element("strong", "", match[2]));
      } else {
        var label = match[3] !== undefined ? match[3] : match[5];
        var url = TBL.safeUrl(match[3] !== undefined ? match[4] : match[5]);
        parent.appendChild(url ? TBL.externalLink(url, label) : document.createTextNode(label));
      }
      last = INLINE.lastIndex;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  TBL.renderMarkdown = function (container, markdown) {
    var lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
    var paragraph = [];
    var list = null;
    var quote = null;
    var i = 0;

    function flushParagraph() {
      if (!paragraph.length) return;
      var p = TBL.element("p");
      appendInline(p, paragraph.join("\n"));
      container.appendChild(p);
      paragraph = [];
    }
    function flushAll() {
      flushParagraph();
      list = null;
      quote = null;
    }

    while (i < lines.length) {
      var line = lines[i];
      var m;

      if (/^\s*```/.test(line)) {                       // fenced code block
        flushAll();
        var code = [];
        i += 1;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i += 1; }
        var pre = TBL.element("pre");
        pre.appendChild(TBL.element("code", "", code.join("\n")));
        container.appendChild(pre);
        i += 1;
        continue;
      }
      if (!line.trim()) { flushAll(); i += 1; continue; }
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) { flushAll(); i += 1; continue; }   // horizontal rule

      if ((m = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/))) {                    // heading
        flushAll();
        var h = TBL.element("h3");
        appendInline(h, m[1]);
        container.appendChild(h);
        i += 1;
        continue;
      }
      if ((m = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/))) {                        // list item
        flushParagraph();
        quote = null;
        var ordered = /\d/.test(m[1]);
        if (!list || list.ordered !== ordered) {
          list = { ordered: ordered, node: TBL.element(ordered ? "ol" : "ul") };
          container.appendChild(list.node);
        }
        var li = TBL.element("li");
        appendInline(li, m[2]);
        list.node.appendChild(li);
        i += 1;
        continue;
      }
      if ((m = line.match(/^\s*>\s?(.*)$/))) {                                       // block quote
        flushParagraph();
        list = null;
        if (!quote) { quote = TBL.element("blockquote"); container.appendChild(quote); }
        var qp = TBL.element("p");
        appendInline(qp, m[1]);
        quote.appendChild(qp);
        i += 1;
        continue;
      }
      list = null;
      quote = null;
      paragraph.push(line.trim());
      i += 1;
    }
    flushAll();
  };

  /* ---------- bug report / feedback links ---------- */

  function query(params) {
    return Object.keys(params)
      .filter(function (key) { return params[key] !== undefined && params[key] !== ""; })
      .map(function (key) { return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]); })
      .join("&");
  }

  // ctx (all optional): { apk: "file name", tag: "v1.2.3", release: "Release title" }
  TBL.bugReportUrl = function (ctx) {
    ctx = ctx || {};
    var cfg = TBL.config;
    var build = "";
    if (ctx.apk) build += "APK: " + ctx.apk;
    if (ctx.release || ctx.tag) {
      build += (build ? "\nRelease: " : "Release: ") + [ctx.release, ctx.tag && "(" + ctx.tag + ")"].filter(Boolean).join(" ");
    }

    if (cfg.useIssueTemplates) {
      return cfg.issuesNewUrl + "?" + query({ template: cfg.bugTemplateFile, title: "Bug: " });
    }

    var body = [
      "## App version or APK filename",
      build || "<!-- e.g. What Next? 2.1.1, or the APK file name you installed -->",
      "",
      "## Device model",
      "<!-- e.g. Pixel 7, Galaxy S23 -->",
      "",
      "## Android version",
      "<!-- e.g. Android 14 (Settings > About phone) -->",
      "",
      "## Description of the problem",
      "<!-- What went wrong? -->",
      "",
      "## Steps to reproduce",
      "1. ",
      "2. ",
      "3. ",
      "",
      "## Expected result",
      "<!-- What did you expect to happen? -->",
      "",
      "## Actual result",
      "<!-- What happened instead? Add screenshots or error text if you can. -->",
      ""
    ].join("\n");

    return cfg.issuesNewUrl + "?" + query({ title: "Bug: ", labels: "bug", body: body });
  };

  TBL.feedbackUrl = function () {
    var cfg = TBL.config;
    if (cfg.useIssueTemplates) {
      return cfg.issuesNewUrl + "?" + query({ template: cfg.feedbackTemplateFile, title: "Feedback: " });
    }
    var body = [
      "## Your feedback or suggestion",
      "<!-- What would you like to see improved or added? -->",
      "",
      "## Why it would help",
      "<!-- Optional: how would you use it? -->",
      ""
    ].join("\n");
    return cfg.issuesNewUrl + "?" + query({ title: "Feedback: ", labels: "enhancement", body: body });
  };

  TBL.enhanceIssueLinks = function (root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll("a[data-bug-report]"), function (link) {
      link.href = TBL.bugReportUrl({ apk: link.dataset.apk, tag: link.dataset.tag, release: link.dataset.release });
    });
    Array.prototype.forEach.call(scope.querySelectorAll("a[data-feedback]"), function (link) {
      link.href = TBL.feedbackUrl();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { TBL.enhanceIssueLinks(); });
  } else {
    TBL.enhanceIssueLinks();
  }
}(window));
