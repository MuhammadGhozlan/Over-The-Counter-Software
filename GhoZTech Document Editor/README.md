# GhoZTech Document Editor

GhoZTech Document Editor is a local-first document editor with a Microsoft Word-style writing surface, rich formatting tools, templates, document library, printing, and export options.

## Start the editor

- Double-click `launch.bat` for the desktop-style version.
- When opened through `launch.bat`, documents are saved automatically to `documents-data.json` in this folder.
- If Node.js is not installed, the launcher opens `index.html` directly and the app uses browser local storage.

## Features

- Rich text formatting: headings, fonts, font sizes, bold, italic, underline, colors, alignment, lists, indenting, links, images, and tables.
- Built-in templates: blank document, business letter, meeting notes, and project proposal.
- Document library with search, duplicate, delete, and automatic timestamps.
- Page controls for Letter, A4, Legal, margin presets, and zoom.
- Find and replace.
- Print support.
- Export as HTML, Word-compatible DOC, or plain TXT.
- Local file-backed storage through `documents-data.json`.

## Privacy

The app does not connect to GitHub, cloud storage, or an external database. When launched through `launch.bat`, the included local server reads and writes only `documents-data.json` inside this folder.

## Files

- `index.html` is the app shell.
- `app.js` contains editor behavior and document logic.
- `styles.css` contains the interface and page styling.
- `server.js` runs the local save server.
- `launch.bat` starts the editor on Windows.
- `documents-data.json` stores saved documents.
