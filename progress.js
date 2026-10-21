(() => {
  "use strict";

  const WIDGET_CLASS = "cookie-section-progress";
  const TIMER_SELECTOR = ".breadcrumbs scrim-clip-time-labels";
  const sectionCache = new Map();
  const attempts = new Map();
  let updateQueued = false;
  let outlineAttempt = null;

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

  function outlineIsOpen(toc) {
    const expanded = toc.getAttribute("aria-expanded");
    if (expanded === "true") return true;
    if (expanded === "false") return false;
    if ([...document.querySelectorAll("toc-group")].some((group) => group.getClientRects().length)) return true;
    // shortcut: unknown markup requires opening the outline manually, add a verified selector when Scrimba exposes one.
    return null;
  }

  function finishOutlineAttempt(close) {
    const attempt = outlineAttempt;
    if (!attempt) return;
    outlineAttempt = null;
    clearTimeout(attempt.timeout);
    if (close && lessonRoute() === attempt.route && attempt.toc.isConnected &&
        document.querySelector(".breadcrumbs .toc") === attempt.toc && outlineIsOpen(attempt.toc) === true) {
      toggleOutline(attempt.toc);
    }
  }

  function update() {
    updateQueued = false;
    const timer = document.querySelector(TIMER_SELECTOR);
    const route = lessonRoute();
    if (outlineAttempt && (outlineAttempt.route !== route || !timer)) finishOutlineAttempt(false);
    const liveSection = timer && currentSection();
    if (route && liveSection) sectionCache.set(route, liveSection);
    if (liveSection) finishOutlineAttempt(true);

    const section = liveSection || sectionCache.get(route);
    const previous = attempts.get(route);
    if (timer && route && !section && !outlineAttempt &&
        (!previous || (previous.count < 2 && Date.now() >= previous.retryAt))) {
      const toc = document.querySelector(".breadcrumbs .toc");
      if (toc && outlineIsOpen(toc) === false) {
        attempts.set(route, { count: (previous?.count || 0) + 1, retryAt: Date.now() + 6500 });
        const attempt = { route, toc, timeout: null };
        outlineAttempt = attempt;
        toggleOutline(toc);
        attempt.timeout = setTimeout(() => {
          if (outlineAttempt !== attempt) return;
          finishOutlineAttempt(true);
          setTimeout(queueUpdate, 5000);
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

  function relinquishOutline(event) {
    const route = lessonRoute();
    if (!event.isTrusted || !attempts.has(route)) return;
    attempts.set(route, { count: 2, retryAt: Infinity });
    finishOutlineAttempt(false);
  }
  document.addEventListener("pointerdown", relinquishOutline, true);
  document.addEventListener("keydown", relinquishOutline, true);
  window.addEventListener("popstate", queueUpdate);

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
