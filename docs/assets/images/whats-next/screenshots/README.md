# What's Next screenshots

Real screenshots of the What's Next app, shown in the gallery on
`docs/projects/whats-next.html`. **Only add genuine screenshots of the running app.**
Do not use promotional artwork, mock-ups or edited images.

## Expected file names

Each screen has a full-size image and a small thumbnail (used in the grid):

| Screen              | Full size            | Thumbnail                 |
|---------------------|----------------------|---------------------------|
| Home / Pick screen  | `home.webp`          | `home-thumb.webp`         |
| Discover            | `discover.webp`      | `discover-thumb.webp`     |
| Anime list          | `anime-list.webp`    | `anime-list-thumb.webp`   |
| Manga list          | `manga-list.webp`    | `manga-list-thumb.webp`   |
| Media page          | `media-page.webp`    | `media-page-thumb.webp`   |
| Airing schedule     | `schedule.webp`      | `schedule-thumb.webp`     |
| Statistics          | `statistics.webp`    | `statistics-thumb.webp`   |
| Settings            | `settings.webp`      | `settings-thumb.webp`     |

You don't need all of them; add the ones you have. File names may only contain
letters, digits, `.`, `_` and `-`.

## How to add them

1. Take screenshots on a phone (portrait). Hide anything private first (use the app's
   **Blur covers** option if the titles shouldn't be shown, and don't show chat messages
   or account details).
2. Put the original PNG/JPG files in a folder named `screenshots-source/` in the repository root
   (or any folder), named like the table above, e.g. `home.png`.
3. Optimise them for mobile (needs `pip install pillow`):

   ```bash
   python3 tools/optimize_screenshots.py screenshots-source
   ```

   This writes `<name>.webp` (max 1080 px wide) and `<name>-thumb.webp` (440 px wide) into this
   folder and prints a ready-to-paste JSON entry for each image.
4. Paste the entries into `docs/data/screenshots.json` and write a real `title`, `alt`
   (what the screenshot shows, for screen readers) and `caption` for each one:

   ```json
   {
     "screenshots": [
       {
         "file": "home.webp",
         "thumb": "home-thumb.webp",
         "width": 1080,
         "height": 2340,
         "title": "Pick screen",
         "alt": "What's Next Pick screen showing time options and a suggested title",
         "caption": "Choose how much time you have and get a suggestion from your lists."
       }
     ]
   }
   ```

5. Commit the images and the JSON. The gallery appears automatically; while the list is empty
   the page shows a "screenshots coming soon" notice.
