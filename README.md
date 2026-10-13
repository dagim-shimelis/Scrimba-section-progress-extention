<p align="center">
  <img src="icons/icon-128.png" width="88" alt="Scrimba Section Progress icon">
</p>

<h1 align="center">Scrimba Section Progress</h1>

<p align="center">
  See how far you have come in a section without leaving the lesson.
  <br>
  <strong>Completion percentage · Progress bar · Estimated watched time</strong>
</p>

![Scrimba lesson with the extension's 17% section progress badge beside the timer](assets/section-progress-screenshot.png)

> **Unofficial project.** This extension is not made by or affiliated with Scrimba.

The badge sits beside the lesson timer. It uses Scrimba's completion percentage for the current lesson's immediate parent section and estimates watched time from the section duration. Plain JavaScript and CSS; no framework, analytics, account, or extension-initiated network requests.

### Where the number comes from

![Scrimba Agents section outline open beneath the extension's 24% progress badge](assets/section-outline-screenshot.png)

## Install

1. Clone or download this repository.
2. Open `arc://extensions` in Arc, or `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the folder containing `manifest.json`.
5. Open or refresh a Scrimba lesson.

When you change the extension files, click **Reload** on the browser's extensions page, then refresh the lesson.

## Build a ZIP

Run `sh build.sh` to package the extension into the ignored `build/` folder. The ZIP filename follows the version in `manifest.json`.

## What the numbers mean

```text
0:30 / 2:40    42%  ━━━━━───────  ≈53 min / 2.1 hrs
lesson timer   section complete     estimated time / section duration
```

- **42%** comes from Scrimba's progress value for the current lesson's immediate parent section.
- **2.1 hrs** is the section duration displayed by Scrimba.
- **≈53 min** is `42% × 2.1 hours`, rounded to minutes. It is an estimate because Scrimba rounds the displayed duration and the extension does not track your watch time.

The extension briefly opens Scrimba's lesson outline to read this data, closes it, and keeps the badge visible. On narrow screens it hides the time summary while retaining the percentage and bar.

## Scope and privacy

- Loads on `https://scrimba.com/*` and shows a badge only when lesson data is available.
- Reads the current page's lesson outline; it does not collect or send browsing data.
- Requests no additional extension API permissions.
- Shows no badge if Scrimba does not expose the section data. A change to Scrimba's page markup may require updating the selectors.

## Project files

```text
manifest.json       Manifest V3 configuration
progress.js         Reads section progress and injects the badge
progress.css        Badge styling
build.sh            Packages the extension into build/
icons/              Extension icon in browser-required sizes
assets/             README screenshots
```

The extension icon adapts a supplied mark labelled “Tones at Paradiso, 2025” over a gradient based on Scrimba's favicon. Permission to redistribute the mark has not been verified.
