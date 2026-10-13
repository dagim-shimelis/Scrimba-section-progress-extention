(() => {
  "use strict";

  const WIDGET_CLASS = "cookie-section-progress";
  const TIMER_SELECTOR = ".breadcrumbs scrim-clip-time-labels";
  const sectionCache = new Map();
  const attemptedRoutes = new Set();
  let updateQueued = false;
  let autoOpenedRoute = null;

  function lessonRoute() {
    const parts = location.pathname.split("/").filter(Boolean);
    const lessonIndex = parts.findIndex((part) => part.startsWith("~"));
    return lessonIndex < 0 ? null : parts.slice(0, lessonIndex + 1).join("/");
  }

  function parseDuration(value) {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(hrs?|hours?|mins?|minutes?)\b/i);
    if (!match) return null;
    const amount = Number(match[1]);
    return /^(h|hour)/i.test(match[2]) ? amount * 60 : amount;
  }

  function currentSection() {
    const lessonId = lessonRoute()?.split("/").at(-1);
    if (!lessonId) return null;

    const lesson = [...document.querySelectorAll("toc-item-head.current[data-id]")]
      .find((head) => head.dataset.id?.split("/").at(-1) === lessonId);
    const group = lesson?.closest("toc-group");
    const header = group?.querySelector("toc-item-head");
    if (!header) return null;

    const percentText = [...header.querySelectorAll('[class~="%stat"]')]
      .map((element) => element.textContent.trim())
      .find((text) => /^\d+(?:\.\d+)?%$/.test(text));
    const percent = Number(percentText?.slice(0, -1));
    if (!Number.isFinite(percent)) return null;

    const totalText = header.querySelector(".duration")?.textContent.trim() || "";
    const totalMinutes = parseDuration(totalText);
    const name = header.querySelector('[class~="%name"]')?.textContent.trim() || "Section";
    return { name, percent: Math.min(100, Math.max(0, percent)), totalText, totalMinutes };
  }

  function makeWidget() {
    const widget = document.createElement("span");
    widget.className = WIDGET_CLASS;
    widget.setAttribute("role", "group");
    widget.innerHTML =
      '<span class="cookie-section-progress__percent"></span>' +
      '<span class="cookie-section-progress__track" aria-hidden="true">' +
      '<span class="cookie-section-progress__fill"></span></span>' +
      '<span class="cookie-section-progress__time"></span>';
    return widget;
  }

  function toggleOutline(toc) {
    toc.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "mouse"
    }));
  }

  function update() {
    updateQueued = false;
    const timer = document.querySelector(TIMER_SELECTOR);
    const route = lessonRoute();
    const liveSection = timer && currentSection();
    if (route && liveSection) sectionCache.set(route, liveSection);

    if (route && autoOpenedRoute === route && liveSection) {
      autoOpenedRoute = null;
      const toc = document.querySelector(".breadcrumbs .toc");
      if (toc) toggleOutline(toc);
    }

    const section = liveSection || sectionCache.get(route);
    if (timer && route && !section && !attemptedRoutes.has(route)) {
      const toc = document.querySelector(".breadcrumbs .toc");
      if (toc) {
        attemptedRoutes.add(route);
        autoOpenedRoute = route;
        toggleOutline(toc);
        setTimeout(() => {
          if (autoOpenedRoute !== route) return;
          autoOpenedRoute = null;
          toggleOutline(toc);
        }, 1500);
      }
    }

    const existing = document.querySelector(`.${WIDGET_CLASS}`);

    if (!timer || !section) {
      existing?.remove();
      return;
    }

    const widget = existing || makeWidget();
    if (widget.previousElementSibling !== timer) timer.after(widget);

    const roundedPercent = Math.round(section.percent);
    const estimatedMinutes = section.totalMinutes == null
      ? null
      : Math.round(section.totalMinutes * section.percent / 100);
    const timeLabel = estimatedMinutes == null
      ? ""
      : `≈${estimatedMinutes} min / ${section.totalText}`;

    widget.querySelector(".cookie-section-progress__percent").textContent = `${roundedPercent}%`;
    widget.querySelector(".cookie-section-progress__fill").style.width = `${section.percent}%`;
    widget.querySelector(".cookie-section-progress__time").textContent = timeLabel;
    widget.setAttribute("aria-label", `${section.name}: ${roundedPercent}% complete${timeLabel ? `, ${timeLabel}` : ""}`);
    widget.title = timeLabel
      ? `${section.name}: ${roundedPercent}% complete. Watched time is estimated from Scrimba's rounded section duration.`
      : `${section.name}: ${roundedPercent}% complete.`;
  }

  function queueUpdate() {
    if (updateQueued) return;
    updateQueued = true;
    requestAnimationFrame(update);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => mutation.target.closest?.(`.${WIDGET_CLASS}`))) return;
    queueUpdate();
  });
  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    attributes: true,
    subtree: true
  });
  queueUpdate();
})();
