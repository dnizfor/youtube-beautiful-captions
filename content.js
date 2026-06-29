const BUTTON_ID = "my-subtitle-extra-button";
const PANEL_ID = "my-transcript-panel";
const HIDE_TRANSCRIPT_STYLE_ID = "hide-youtube-transcript-style";

let enabled = false;
let sentenceItems = [];
let sentenceTimer = null;
let loadingToken = 0;
let lastVideoKey = "";
let reloadTimer = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getCurrentVideoId() {
  const url = new URL(location.href);
  const player = document.querySelector("ytd-watch-flexy");
  const ytdPlayer = document.querySelector("ytd-player");
  const meta = document.querySelector('meta[itemprop="videoId"]');
  const shortsMatch = location.pathname.match(/^\/shorts\/([^/?#]+)/);

  return (
    url.searchParams.get("v") ||
    shortsMatch?.[1] ||
    player?.getAttribute("video-id") ||
    ytdPlayer?.getAttribute("video-id") ||
    meta?.getAttribute("content") ||
    ""
  );
}

function getVideoKey() {
  return getCurrentVideoId() || location.href;
}

function createIcon() {
  return enabled
    ? `<svg viewBox="0 0 24 24" width="24" height="24">
        <circle cx="12" cy="12" r="10" fill="#34A853"/>
        <path d="M7.5 12.5L10.5 15.5L16.5 9.5"
          stroke="white" stroke-width="2.4" fill="none"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    : `<svg viewBox="0 0 24 24" width="24" height="24">
        <circle cx="12" cy="12" r="10" fill="white"/>
        <text x="12" y="16" text-anchor="middle"
          font-size="11" font-family="Arial" font-weight="bold" fill="black">AI</text>
      </svg>`;
}

function updateButton() {
  const btn = document.getElementById(BUTTON_ID);
  if (!btn) return;

  btn.innerHTML = createIcon();
  btn.title = enabled ? "Subtitle AI: ON" : "Subtitle AI: OFF";
}

function setEnabled(nextEnabled) {
  enabled = nextEnabled;
  updateButton();
}

function createPanel() {
  let panel = document.getElementById(PANEL_ID);

  if (!panel) {
    panel = document.createElement("div");
    panel.id = PANEL_ID;

    Object.assign(panel.style, {
      position: "absolute",
      left: "0",
      right: "0",
      bottom: "0",
      width: "100%",
      minHeight: "64px",
      zIndex: "20",
      background: "rgba(0,0,0,0.78)",
      color: "white",
      padding: "10px 18px 18px",
      fontSize: "22px",
      lineHeight: "1.45",
      fontFamily: "Arial, sans-serif",
      textAlign: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      boxSizing: "border-box",
    });
  }

  const player = document.querySelector("#movie_player");
  if (player && panel.parentElement !== player) player.appendChild(panel);

  return panel;
}

function hidePanel() {
  document.getElementById(PANEL_ID)?.remove();
}

function stopSentenceSync() {
  if (sentenceTimer) {
    clearInterval(sentenceTimer);
    sentenceTimer = null;
  }
}

function resetSubtitles() {
  loadingToken++;
  clearTimeout(reloadTimer);
  stopSentenceSync();
  sentenceItems = [];
  hidePanel();
}

function parseTime(timeText) {
  const parts = timeText.trim().split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;

  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];

  return null;
}

function getTranscriptItems() {
  return [
    ...document.querySelectorAll(
      "transcript-segment-view-model, ytd-transcript-segment-renderer",
    ),
  ]
    .map((segment) => {
      const timeText =
        segment.querySelector(
          ".ytwTranscriptSegmentViewModelTimestamp, .segment-timestamp, #timestamp",
        )?.innerText || "";
      const clone = segment.cloneNode(true);

      clone
        .querySelectorAll(
          ".ytwTranscriptSegmentViewModelTimestamp, .ytwTranscriptSegmentViewModelTimestampA11yLabel, .segment-timestamp, #timestamp",
        )
        .forEach((el) => el.remove());

      const text = (clone.innerText || clone.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

      return {
        start: parseTime(timeText),
        text,
      };
    })
    .filter((item) => item.start !== null && item.text);
}

function hideYoutubeTranscriptPanel() {
  document.getElementById(HIDE_TRANSCRIPT_STYLE_ID)?.remove();
}

function showYoutubeTranscriptPanel() {
  document.getElementById(HIDE_TRANSCRIPT_STYLE_ID)?.remove();
}

function splitIntoSentences(text) {
  const matches = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [text];
  return matches.map((item) => item.trim()).filter(Boolean);
}

function buildSentenceItems(items) {
  const result = [];
  let current = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nextStart = items[i + 1]?.start ?? item.start + 3;

    if (!current) {
      current = { start: item.start, end: nextStart, text: item.text };
    } else {
      current.end = nextStart;
      current.text = `${current.text} ${item.text}`.replace(/\s+/g, " ");
    }

    const completeSentence = /[.!?…]$/.test(current.text.trim());
    const longEnough = current.text.length >= 110;
    const longPause = nextStart - item.start > 4;

    if (!completeSentence && !longEnough && !longPause) continue;

    const sentences = splitIntoSentences(current.text);
    const duration = Math.max(current.end - current.start, 0.5);
    let cursor = current.start;

    for (const sentence of sentences) {
      const ratio = sentence.length / current.text.length;
      const sentenceDuration = Math.max(duration * ratio, 0.5);

      result.push({
        start: cursor,
        end: cursor + sentenceDuration,
        text: sentence,
      });

      cursor += sentenceDuration;
    }

    current = null;
  }

  if (current) result.push(current);

  return result.sort((a, b) => a.start - b.start);
}

function splitCompleteSentenceParts(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const matches =
    normalized.match(/[^.!?\u2026]+[.!?\u2026]+(?:["')\]]+)?/g) || [];
  const sentences = matches.map((item) => item.trim()).filter(Boolean);
  const rest = normalized.slice(matches.join("").length).trim();

  return { sentences, rest };
}

function buildOneSentenceItems(items) {
  const result = [];
  let buffer = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nextStart = items[i + 1]?.start ?? item.start + 3;

    if (!buffer) {
      buffer = { start: item.start, end: nextStart, text: item.text };
    } else {
      buffer.end = nextStart;
      buffer.text = `${buffer.text} ${item.text}`.replace(/\s+/g, " ");
    }

    const { sentences, rest } = splitCompleteSentenceParts(buffer.text);
    if (!sentences.length) continue;

    const completeLength = sentences.join(" ").length || 1;
    const duration = Math.max(buffer.end - buffer.start, 0.5);
    let cursor = buffer.start;
    let lastEnd = cursor;

    for (const sentence of sentences) {
      const ratio = sentence.length / completeLength;
      const sentenceDuration = Math.max(duration * ratio, 0.5);
      lastEnd = cursor + sentenceDuration;

      result.push({
        start: cursor,
        end: lastEnd,
        text: sentence,
      });

      cursor = lastEnd;
    }

    buffer = rest ? { start: lastEnd, end: nextStart, text: rest } : null;
  }

  if (buffer?.text) {
    result.push({
      start: buffer.start,
      end: Math.max(buffer.end, buffer.start + 0.5),
      text: buffer.text.trim(),
    });
  }

  return result.sort((a, b) => a.start - b.start);
}

async function waitForTranscript(timeout = 6000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (getTranscriptItems().length) return true;
    await sleep(100);
  }

  return false;
}

function textMatchesTranscript(element) {
  const text = (element.innerText || "").toLowerCase();
  const aria = (element.getAttribute("aria-label") || "").toLowerCase();
  const title = (element.getAttribute("title") || "").toLowerCase();
  const haystack = `${text} ${aria} ${title}`;

  return haystack.includes("transcript") || haystack.includes("transcript");
}

function clickLikeUser(element) {
  if (!element) return false;

  const target = element.matches?.("button, tp-yt-paper-button")
    ? element
    : element.querySelector?.("button, tp-yt-paper-button") || element;
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: Number.isFinite(x) ? x : 0,
    clientY: Number.isFinite(y) ? y : 0,
    button: 0,
    buttons: 1,
  };
  const PointerEventCtor = window.PointerEvent || MouseEvent;

  target.dispatchEvent(new PointerEventCtor("pointerdown", eventOptions));
  target.dispatchEvent(new MouseEvent("mousedown", eventOptions));
  target.dispatchEvent(
    new PointerEventCtor("pointerup", { ...eventOptions, buttons: 0 }),
  );
  target.dispatchEvent(
    new MouseEvent("mouseup", { ...eventOptions, buttons: 0 }),
  );
  target.dispatchEvent(
    new MouseEvent("click", { ...eventOptions, buttons: 0 }),
  );
  target.click?.();

  return true;
}

function findTranscriptSectionButton() {
  const sections = [
    ...document.querySelectorAll(
      "ytd-video-description-transcript-section-renderer",
    ),
  ];
  const section = sections.find(textMatchesTranscript);

  return (
    section?.querySelector("yt-button-shape button") ||
    section?.querySelector("button") ||
    section?.querySelector("tp-yt-paper-button") ||
    null
  );
}

function clickFirstTranscriptButton() {
  const sectionButton = findTranscriptSectionButton();
  if (sectionButton) return clickLikeUser(sectionButton);

  const buttons = [
    ...document.querySelectorAll(
      "button, ytd-button-renderer, yt-button-shape button, tp-yt-paper-button",
    ),
  ];
  const button = buttons.find(textMatchesTranscript);

  if (!button) return false;

  return clickLikeUser(button);
}

async function expandDescription() {
  const expandButtons = [
    ...document.querySelectorAll(
      "#description-inline-expander button, ytd-text-inline-expander button, tp-yt-paper-button#expand, #expand",
    ),
  ];

  for (const button of expandButtons) {
    const text = (button.innerText || "").toLowerCase();
    const aria = (button.getAttribute("aria-label") || "").toLowerCase();

    if (
      text.includes("daha fazla") ||
      text.includes("more") ||
      aria.includes("daha fazla") ||
      aria.includes("more")
    ) {
      clickLikeUser(button);
      await sleep(300);
      return true;
    }
  }

  return false;
}

async function openTranscriptFromMoreMenu() {
  const menuButtons = [
    ...document.querySelectorAll(
      "ytd-menu-renderer yt-icon-button button, button[aria-label*='More'], button[aria-label*='Daha'], button[aria-label*='Diğer']",
    ),
  ];

  for (const button of menuButtons) {
    clickLikeUser(button);
    await sleep(300);

    const menuItems = [
      ...document.querySelectorAll(
        "ytd-menu-service-item-renderer, tp-yt-paper-item, ytd-menu-navigation-item-renderer",
      ),
    ];
    const transcriptItem = menuItems.find(textMatchesTranscript);

    if (transcriptItem) {
      clickLikeUser(transcriptItem);
      return waitForTranscript();
    }
  }

  return false;
}

async function openTranscriptPanel() {
  showYoutubeTranscriptPanel();

  if (getTranscriptItems().length) return true;

  if (clickFirstTranscriptButton()) {
    if (await waitForTranscript()) return true;
  }

  await expandDescription();

  for (let i = 0; i < 5; i++) {
    if (clickFirstTranscriptButton()) {
      if (await waitForTranscript()) return true;
    }

    await sleep(250);
  }

  if (await openTranscriptFromMoreMenu()) return true;

  return getTranscriptItems().length > 0;
}

function startSentenceSync() {
  stopSentenceSync();

  const panel = createPanel();

  sentenceTimer = setInterval(() => {
    const video = document.querySelector("video");
    if (!video) return;

    const time = video.currentTime;
    const active = sentenceItems.find(
      (item) => time >= item.start && time < item.end,
    );

    panel.textContent = active?.text || "";
  }, 100);
}

async function loadSubtitles() {
  const token = ++loadingToken;
  const videoKey = getVideoKey();
  const panel = createPanel();

  panel.textContent = "Transcript loading...";
  stopSentenceSync();
  sentenceItems = [];

  const opened = await openTranscriptPanel();
  if (!enabled || token !== loadingToken || getVideoKey() !== videoKey) {
    return false;
  }

  if (!opened) {
    panel.textContent = "Transcript not found.";
    return false;
  }

  const transcriptItems = getTranscriptItems();
  sentenceItems = buildOneSentenceItems(transcriptItems);

  if (!sentenceItems.length) {
    panel.textContent = "Captions not found.";
    return false;
  }

  lastVideoKey = videoKey;
  startSentenceSync();
  return true;
}

function scheduleSubtitleReload(delay = 400) {
  if (!enabled) return;

  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    resetSubtitles();
    await loadSubtitles();
  }, delay);
}

function checkVideoChange() {
  const currentKey = getVideoKey();
  if (!enabled || !currentKey) return;

  if (!lastVideoKey) {
    lastVideoKey = currentKey;
    return;
  }

  if (currentKey !== lastVideoKey) {
    lastVideoKey = currentKey;
    scheduleSubtitleReload(700);
  }
}

function addButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const ccButton = document.querySelector(".ytp-subtitles-button");
  if (!ccButton) return;

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.className = "ytp-button";

  Object.assign(btn.style, {
    width: "48px",
    height: "48px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
  });

  btn.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      setEnabled(!enabled);

      if (!enabled) {
        resetSubtitles();
        lastVideoKey = "";
        return;
      }

      lastVideoKey = getVideoKey();
      await loadSubtitles();
    },
    true,
  );

  ccButton.insertAdjacentElement("afterend", btn);
  updateButton();
}

document.addEventListener("yt-navigate-finish", () => {
  setTimeout(checkVideoChange, 500);
});

document.addEventListener("yt-page-data-updated", () => {
  setTimeout(checkVideoChange, 500);
});

setInterval(() => {
  addButton();
  checkVideoChange();
}, 500);

addButton();
