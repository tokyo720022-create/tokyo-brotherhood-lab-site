# Tokyo Brotherhood Lab

Official static project hub for Tokyo Brotherhood Lab. Plain HTML, CSS and JavaScript — no build step.

## Site structure

```
docs/                              published by GitHub Pages
├── index.html                     homepage (projects, contact, about)
├── 404.html                       self-contained "page not found" page
├── sitemap.xml, robots.txt
├── assets/
│   ├── css/style.css              all shared styles
│   ├── js/main.js                 footer year + "copy Discord username"
│   ├── js/site-utils.js           shared helpers (DOM, safe Markdown, bug-report links)
│   ├── js/releases.js             APK list: search, filter, sort (reads data/releases.json)
│   ├── js/gallery.js              screenshot gallery + lightbox (reads data/screenshots.json)
│   ├── js/roadmap.js              roadmap renderer (reads data/roadmap.json)
│   └── images/
│       ├── *.webp, icon-*.png, og-*.jpg
│       └── whats-next/screenshots/   real app screenshots (see README there)
├── data/
│   ├── releases.json              generated release snapshot (do not edit by hand)
│   ├── screenshots.json           gallery manifest (edit)
│   ├── roadmap.json               What's Next roadmap (edit)
│   └── manga-lab-roadmap.json     Tokyo Manga Lab progress/roadmap (edit)
└── projects/
    ├── whats-next.html            overview, screenshots, roadmap, report-a-bug
    ├── whats-next/releases.html   APK list
    ├── whats-next/installation.html   Android install / update guide
    └── tokyo-manga-lab.html       overview, Android install notes, progress, report-a-bug
tools/fetch_releases.py            builds data/releases.json from the What-Next releases
tools/optimize_screenshots.py      resizes screenshots to WebP + writes manifest entries
.github/workflows/update-releases.yml
```

## GitHub Pages setup

Repository **Settings → Pages**: **Deploy from a branch**, branch `main`, folder `/docs`.

## APK release list

`docs/projects/whats-next/releases.html` shows every `.apk` attached to the public
[What-Next releases](https://github.com/tokyo720022-create/What-Next/releases).

- The **Update release data** workflow runs every 3 hours (and on demand from the Actions tab),
  runs `tools/fetch_releases.py`, and commits `docs/data/releases.json` only when something changed.
- The page reads that snapshot, so visitors never hit GitHub's API rate limit.
- If the snapshot is missing or still the empty placeholder, the page falls back to the live GitHub API.
- No APK files are stored in this repository; download buttons point at the original GitHub release assets.

Run the snapshot locally: `python3 tools/fetch_releases.py` (set `GITHUB_TOKEN` for a higher rate limit).

## Updating content (no HTML editing needed)

| To change…            | Edit…                                        |
|-----------------------|----------------------------------------------|
| What's Next roadmap   | `docs/data/roadmap.json`                     |
| Tokyo Manga Lab progress | `docs/data/manga-lab-roadmap.json`        |
| App screenshots       | `docs/data/screenshots.json` + images (see `docs/assets/images/whats-next/screenshots/README.md`) |
| APK list              | nothing: generated from GitHub releases      |

### Roadmap

Each item has a `status` of `planned`, `in-progress`, `testing` or `released`. Only mark an item
`released` when it is in the app people can use today. Released items show under "Available now";
everything else shows separately under "Coming up".

### Release types on the APK page

- **Debug / testing build:** the file name, tag or release title contains `debug`, `test` or `testing`.
- **Pre-release:** marked as a pre-release on GitHub.
- **Stable release:** everything else. Only a stable APK is ever labelled "Latest stable".

The What-Next build script currently produces debug APKs (`assembleDebug`), so until a stable,
release-signed APK is published the page shows a "no stable release yet" notice.

### Bug reports

"Report a bug" links open a prefilled new-issue form on the project's repository (What-Next by default; add `data-repo="owner/name"` to a link for another project, as the Tokyo Manga Lab page does). The prefill is built in
`docs/assets/js/site-utils.js`. If you later add `bug_report.md` / `feedback.md` issue templates to the
What-Next repository, set `useIssueTemplates: true` in that file.

## Adding a project page

1. Copy `docs/projects/tokyo-manga-lab.html` and edit the content. Shared styles (`.project-hero`,
   `.tag`, `.notice`, `.card-icon`, ...) already live in `style.css`; keep only page-specific CSS inline.
2. Add a logo as `.webp` (about 640 px), a 64 px `icon-<name>.png`, and a 1200x630 `og-<name>.jpg`.
3. Add a card to `docs/index.html` and the page URL to `docs/sitemap.xml`.
4. The header and footer are copied into each page, so update them in every page if you change them.

## Site URL

Canonical, Open Graph and sitemap URLs assume the site is served at
`https://tokyo720022-create.github.io/tokyo-brotherhood-lab-site/`.
If you add a custom domain, search and replace that URL in `docs/` and `docs/sitemap.xml` / `docs/robots.txt`.
