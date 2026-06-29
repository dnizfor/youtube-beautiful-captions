<img width="1312" height="745" alt="Image" src="https://github.com/user-attachments/assets/2628d206-4a5d-40bc-957b-5f61765ae4f4" />

# 🎬 YouTube Beutiful Captions

A lightweight JavaScript userscript that adds an **Captions** button to the YouTube player and displays transcript sentences directly on the video.

Instead of showing YouTube's default captions, this script automatically opens the transcript panel, extracts transcript segments, merges them into complete sentences, and synchronizes them with video playback.

---

## ✨ Features

* ✅ Extracts transcript data from the page
* ✅ Combines transcript segments into complete sentences
* ✅ Displays one sentence at a time as subtitles
* ✅ Automatically reloads when navigating to another video
* ✅ Works without using the YouTube API
* ✅ Supports both regular videos and Shorts
* ✅ Lightweight and dependency-free

---

## 📷 Preview

```
+------------------------------------------------------+
|                                                      |
|                  YouTube Video                       |
|                                                      |
|------------------------------------------------------|
|  This is the current sentence extracted from the     |
|  transcript and synchronized with the video.         |
+------------------------------------------------------+
```

---

## 🚀 How It Works

1. Adds an **Captions** button beside the CC button.
2. When enabled:

   * Opens the transcript panel.
   * Reads transcript segments from the DOM.
   * Converts timestamped transcript pieces into complete sentences.
   * Synchronizes sentences with the current playback time.
3. Displays the active sentence inside a custom overlay.

---

## 🧠 Sentence Processing

Instead of displaying every transcript segment, the script:

* Merges consecutive transcript blocks
* Detects completed sentences
* Preserves punctuation
* Estimates sentence duration proportionally
* Displays only one sentence at a time

This creates a much smoother reading experience than YouTube's default transcript segmentation.

---

## ⚙️ Main Components

| Function                  | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `addButton()`             | Inserts the AI button into the YouTube player        |
| `loadSubtitles()`         | Loads transcript and builds subtitle data            |
| `openTranscriptPanel()`   | Opens YouTube's transcript panel automatically       |
| `getTranscriptItems()`    | Reads transcript elements from the DOM               |
| `buildOneSentenceItems()` | Converts transcript segments into complete sentences |
| `startSentenceSync()`     | Synchronizes subtitles with playback                 |
| `checkVideoChange()`      | Detects SPA navigation and reloads subtitles         |

---

## 🔄 Video Navigation

YouTube is a Single Page Application (SPA), meaning page navigation does not reload the browser.

The script automatically detects:

* new videos
* playlist navigation
* recommended video clicks
* Shorts navigation

and reloads subtitles automatically.

---

## 🎨 Overlay

The subtitle overlay is dynamically created and attached to:

```
#movie_player
```

with styles similar to:

* centered text
* semi-transparent black background
* white font
* non-interactive (`pointer-events: none`)

---

## 📂 Project Structure

```
script.js
│
├── Button Management
├── Transcript Extraction
├── Sentence Builder
├── Overlay Rendering
├── Synchronization
└── Video Change Detection
```


---

## ⚠️ Notes

* Requires a transcript to be available for the video.
* Automatically handles most YouTube layout updates, but major DOM changes may require adjustments.
* Does not rely on the YouTube Data API.
* No external libraries are used.

---

## 📄 License

MIT License

---

## ❤️ Contributing

Pull requests, suggestions, and issue reports are always welcome.

If you find this project useful, consider giving it a ⭐ on GitHub.
