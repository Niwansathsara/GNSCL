# GNS Class Library

A responsive, light-modern class-video catalogue built with plain HTML, CSS and JavaScript. The logo is an editable vector SVG. No framework or build step is required.

## Open it on your computer

1. Extract the ZIP file.
2. Open `index.html` in a browser.
3. Select **Add a video**, enter a title, subject and a valid YouTube video link.
4. Use search, subject filters, saved videos and the video player to organise/revisit links.

When opened directly from your computer, the browser may block loading `videos.json` for security reasons. You can still add lessons; they are saved in that browser's local storage.

## Make a public website so everyone can view the same library

This download is a static front end. To make the same catalogue available to everyone, you need to publish the folder using a static web host (for example, GitHub Pages or Netlify) and keep the public catalogue in `videos.json`.

1. Add the links in the browser with **Add a video**.
2. Select **Export library**. It downloads a file named `videos.json` containing the videos in the current library.
3. Replace the existing `videos.json` in the website folder with the exported file, then upload/redeploy the folder.
4. Visitors to the deployed website will load the catalogue from `videos.json`. Repeat the export/redeploy steps whenever you update it.

New links entered in the browser form are explicitly labelled as **local drafts** until you export and publish them. They are not automatically sent to a server, and they do not appear on other people's devices by themselves. Automatic multi-user submissions, accounts, and cloud syncing would require a backend/database, which is not included in this static package.

## Import or edit the catalogue

- Use **Import JSON** to import a previously exported `videos.json` into the browser.
- `videos.json` must be a JSON array. A video object looks like this:

```json
[
  {
    "id": "physics-mechanics-01",
    "title": "Mechanics — Introduction",
    "subject": "Physics",
    "teacher": "Class teacher",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "description": "A short introduction to mechanics.",
    "createdAt": 1792641600000
  }
]
```

The `url` must be an individual YouTube video link (`youtube.com/watch?v=...`, `youtu.be/...`, `/shorts/...`, `/embed/...`, or `/live/...`). The supplied player uses YouTube's privacy-enhanced embed host.

## Important sharing note

Only publish videos or class recordings you have permission to distribute. An unlisted YouTube link is not private from people who receive it; anyone with the link may be able to view and reshare it. Private/restricted recordings may not play for all visitors.

## Files

- `index.html` — page structure and content
- `styles.css` — responsive styles and visual design
- `app.js` — filtering, search, local drafts, playback, import/export
- `assets/gns-logo.svg` — GNS vector logo
- `videos.json` — public catalogue source for a hosted website (starts empty)
