(function () {
  "use strict";

  var STORAGE_KEY = "honkit_right_toc_open";
  var tocRoot = null;
  var toggleButton = null;
  var backdrop = null;
  var linksById = {};
  var headings = [];
  var hasBoundEvents = false;
  var ticking = false;
  var openState = null;

  function slugify(text) {
    return (text || "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function ensureId(heading) {
    if (heading.id) return heading.id;

    var base = slugify(heading.textContent || "") || "section";
    var candidate = base;
    var index = 2;

    while (document.getElementById(candidate)) {
      candidate = base + "-" + index;
      index += 1;
    }

    heading.id = candidate;
    return candidate;
  }

  function clearToc() {
    var body = document.querySelector(".book-body");
    if (body) {
      body.classList.remove("right-toc-enabled");
      body.classList.remove("right-toc-open");
      body.classList.remove("right-toc-mobile");
    }

    if (tocRoot && tocRoot.parentNode) {
      tocRoot.parentNode.removeChild(tocRoot);
    }
    if (toggleButton && toggleButton.parentNode) {
      toggleButton.parentNode.removeChild(toggleButton);
    }
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }

    tocRoot = null;
    toggleButton = null;
    backdrop = null;
    linksById = {};
    headings = [];
  }

  function findCurrentHeadingId() {
    if (!headings.length) return "";

    var hash = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";
    if (hash && linksById[hash]) {
      return hash;
    }

    var current = headings[0];
    var threshold = 120;

    for (var i = 0; i < headings.length; i += 1) {
      if (headings[i].getBoundingClientRect().top - threshold <= 0) {
        current = headings[i];
      } else {
        break;
      }
    }

    return current ? current.id : "";
  }

  function updateActive() {
    var currentId = findCurrentHeadingId();
    var ids = Object.keys(linksById);

    for (var i = 0; i < ids.length; i += 1) {
      var id = ids[i];
      if (id === currentId) {
        linksById[id].classList.add("is-active");
      } else {
        linksById[id].classList.remove("is-active");
      }
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateActive();
      ticking = false;
    });
  }

  function bindGlobalEvents() {
    if (hasBoundEvents) return;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", updateActive);
    window.addEventListener("resize", syncViewportMode, { passive: true });
    hasBoundEvents = true;
  }

  function isMobileViewport() {
    return window.matchMedia("(max-width: 1180px)").matches;
  }

  function readStoredOpenState() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      if (value === "1") return true;
      if (value === "0") return false;
      return null;
    } catch (e) {
      return null;
    }
  }

  function writeStoredOpenState(nextOpen) {
    try {
      window.localStorage.setItem(STORAGE_KEY, nextOpen ? "1" : "0");
    } catch (e) {
      // ignore
    }
  }

  function ensureOpenState() {
    if (openState !== null) return;
    var stored = readStoredOpenState();
    if (stored !== null) {
      openState = stored;
    } else {
      openState = !isMobileViewport();
    }
  }

  function syncViewportMode() {
    var body = document.querySelector(".book-body");
    if (!body || !body.classList.contains("right-toc-enabled")) return;
    body.classList.toggle("right-toc-mobile", isMobileViewport());
  }

  function setToggleLabel(nextOpen) {
    if (!toggleButton) return;
    var text = toggleButton.querySelector(".right-toc-toggle__text");
    if (text) {
      text.textContent = nextOpen ? "Hide TOC" : "Show TOC";
    }
    toggleButton.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  }

  function applyOpenState(nextOpen, persist) {
    var body = document.querySelector(".book-body");
    if (!body) return;
    openState = !!nextOpen;
    body.classList.toggle("right-toc-open", openState);
    setToggleLabel(openState);
    if (persist) {
      writeStoredOpenState(openState);
    }
  }

  function toggleOpenState() {
    applyOpenState(!openState, true);
  }

  function createToggleButton() {
    var button = document.createElement("button");
    button.className = "right-toc-toggle";
    button.type = "button";
    button.setAttribute("aria-label", "Toggle right table of contents");
    button.innerHTML =
      '<span class="right-toc-toggle__text"></span><span class="right-toc-toggle__icon">›</span>';
    button.addEventListener("click", toggleOpenState);
    return button;
  }

  function createBackdrop() {
    var element = document.createElement("div");
    element.className = "right-toc-backdrop";
    element.addEventListener("click", function () {
      applyOpenState(false, true);
    });
    return element;
  }

  function buildToc() {
    clearToc();

    var body = document.querySelector(".book-body");
    var section = document.querySelector(".page-inner .markdown-section");
    if (!body || !section) return;

    var headingNodes = Array.prototype.slice.call(
      section.querySelectorAll("h1, h2, h3")
    );
    headings = headingNodes.filter(function (heading) {
      return (heading.textContent || "").trim().length > 0;
    });

    for (var i = 0; i < headings.length; i += 1) {
      ensureId(headings[i]);
    }

    if (headings.length < 2) return;

    ensureOpenState();

    tocRoot = document.createElement("aside");
    tocRoot.className = "right-toc";
    tocRoot.innerHTML = '<div class="right-toc__title">On This Page</div>';

    var list = document.createElement("ul");
    list.className = "right-toc__list";

    for (var j = 0; j < headings.length; j += 1) {
      var heading = headings[j];
      var level = parseInt(heading.tagName.slice(1), 10);

      var item = document.createElement("li");
      item.className = "right-toc__item level-" + level;

      var link = document.createElement("a");
      link.className = "right-toc__link";
      link.href = "#" + encodeURIComponent(heading.id);
      link.textContent = (heading.textContent || "").trim();

      item.appendChild(link);
      list.appendChild(item);
      linksById[heading.id] = link;
    }

    toggleButton = createToggleButton();
    backdrop = createBackdrop();
    tocRoot.appendChild(list);
    body.appendChild(backdrop);
    body.appendChild(toggleButton);
    body.appendChild(tocRoot);
    body.classList.add("right-toc-enabled");
    syncViewportMode();
    applyOpenState(openState, false);
    updateActive();
  }

  function init() {
    bindGlobalEvents();
    buildToc();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  if (window.gitbook && window.gitbook.events && window.gitbook.events.bind) {
    window.gitbook.events.bind("page.change", buildToc);
  }
})();
