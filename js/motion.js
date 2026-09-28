/* TRONAUT motion layer.
   Ported from the client reference site so every reveal, hover, parallax and
   scroll sequence behaves exactly as approved. Function names match the
   reference. Changes from the reference:
     - Barba page transitions became a plain fade between static pages.
     - Favicon cycling, agency credits, booking form and the Webflow resets
       were removed because the elements they drove no longer exist.
     - Hover bindings accept a root, so rows rendered later by the app get the
       same hover motion (window.TronautMotion.bind).
     - If the animation libraries fail to load, the page is shown unanimated
       instead of staying hidden behind data-prevent-flicker. */
(function () {
  "use strict";

  var root = document.documentElement;
  var hasMotion = !!(window.gsap && window.ScrollTrigger && window.SplitText && window.CustomEase);

  if (!hasMotion) {
    root.classList.add("motion-off");
    window.TronautMotion = { bind: function () {}, refresh: function () {}, reveal: function () {}, ready: Promise.resolve() };
    var pre = document.querySelector("[preloader]");
    if (pre) pre.style.display = "none";
    return;
  }

  gsap.registerPlugin(ScrollTrigger, CustomEase, SplitText);
  CustomEase.create("InOut", "0.76,0,0.24,1");
  CustomEase.create("Out", "0.25,1,0.5,1");
  CustomEase.create("In", "0.5,0,0.75,0");
  CustomEase.create("ease", "0.25,0.1,0.25,1");
  CustomEase.create("Write", "0.333,0,0.667,1");

  var lenis = null;
  var breakPoint = 992;
  var resizeTimeout = null;
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });

  if (!location.hash) window.scrollTo(0, 0);
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () { ScrollTrigger.refresh(true); }, 100);
  });

  /* ---------- preloader (home only) ---------- */
  function initPreloader() {
    var preloader = document.querySelector("[preloader]");
    if (!preloader) return void initPageTransitions();
    window.scrollTo(0, 0);
    var visited = false;
    try { visited = sessionStorage.getItem("tronaut.visited"); } catch (e) {}
    var seconds = visited ? 1 : 3;
    try { sessionStorage.setItem("tronaut.visited", "true"); } catch (e) {}
    initPreloaderAnimation(seconds);
    initPreloaderWindow(seconds);
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-lenis-prevent", "");
    setTimeout(initGlobe, 900);
    setTimeout(function () {
      initPageTransitions();
      gsap.to(preloader, {
        autoAlpha: 0, duration: 0.6, delay: 0.4, ease: "Out",
        onComplete: function () {
          preloader.style.display = "none";
          document.body.style.overflow = "";
          document.body.removeAttribute("data-lenis-prevent");
        }
      });
    }, seconds * 1000);
  }

  function initPreloaderAnimation(seconds) {
    var preloader = document.querySelector("[preloader]");
    if (preloader) preloader.classList.remove("bg-grad");
    splitTextSetup("preloader");
    animateTextReveal("preloader", "in");
    setTimeout(function () { animateTextReveal("preloader", "out"); }, 1000 * seconds);
    var bg = document.querySelector("[preloader-bg]");
    if (bg) gsap.fromTo(bg, { "--mask-size": "100% 200%", "--mask-y": "0%" },
      { "--mask-size": "100% 200%", "--mask-y": "200%", duration: 1.2, delay: seconds - 0.4, ease: "Out" });
  }

  function initPreloaderWindow(seconds) {
    var win = document.querySelector("[preloader-window-c]");
    if (win) gsap.fromTo(win, { yPercent: 0, scaleY: 1 }, { yPercent: -92, scaleY: 0.5, duration: 1.2, delay: seconds, ease: "InOut" });
    var knob = document.querySelector("[preloader-knob-c]");
    if (knob) gsap.fromTo(knob, { yPercent: 0 }, { yPercent: -92, duration: 1.2, delay: seconds, ease: "InOut" });
    var knob2 = document.querySelector("[preloader-knob-2]");
    if (knob2) gsap.fromTo(knob2, { opacity: 0 }, { opacity: 1, duration: 1.2, delay: seconds, ease: "InOut" });
    var over = document.querySelector("[preloader-front-over]");
    if (over) gsap.fromTo(over, { opacity: 1 }, { opacity: 0, duration: 1.2, delay: seconds + 0.4, ease: "InOut" });
  }

  /* ---------- page transitions (replaces Barba) ---------- */
  function initPageTransitions() {
    var container = document.querySelector(".transition-container");
    if (container && !document.querySelector("[preloader]")) {
      gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "InOut" });
    }
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download") || link.hasAttribute("data-no-transition")) return;
      var url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page, hash only
      event.preventDefault();
      var went = false;
      var go = function () { if (went) return; went = true; location.href = url.href; };
      if (!container) return go();
      gsap.to(container, { opacity: 0, duration: 0.6, ease: "InOut", onComplete: go });
      setTimeout(go, 900);
    });
    window.addEventListener("pageshow", function (e) {
      if (e.persisted && container) gsap.set(container, { opacity: 1 });
    });
    initScripts();
  }

  function initScripts() {
    initLenis();
    initThemeChange();
    initOther();
    initAllParallax();
    initScrollElementsReveal();
    initBlockReveal();
    initHighlightText();
    initMagneticEffect();
    initGlobeMaskFollow();
    bindHovers(document);
    initPopups();
    initMenu();
    initLottieAutoplay();
    initBenefitsAccordion();
    initLoopingWords();
    initFlickerShow();
    if (location.hash) {
      var target = null;
      try { target = document.querySelector(location.hash); } catch (e) {}
      if (target && lenis) setTimeout(function () { lenis.scrollTo(target, { immediate: true, offset: -80 }); }, 60);
    }
    readyResolve();
  }

  function initLenis() {
    if (lenis) { lenis.destroy(); lenis = null; }
    lenis = new Lenis({
      wrapper: window, duration: 1.2, smoothWheel: true, smoothTouch: false, touchMultiplier: 2,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      useOverscroll: true, useControls: true, useAnchor: true, useRaf: true, infinite: false
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(1000 * time); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- text reveal helpers ---------- */
  function splitTextSetup(name) {
    document.querySelectorAll('[data-reveal-text="' + name + '"]').forEach(function (el) {
      if (el.__splitDone) return;
      el.innerHTML = el.innerHTML.replace(/(<br\s*\/?>\s*){2}/g, "$1&zwnj;$1");
      var type = el.getAttribute("data-split-text");
      type = ["lines", "words", "chars"].indexOf(type) >= 0 ? type : "lines";
      var split = new SplitText(el, { type: type, linesClass: "line", wordsClass: "word", charsClass: "char" });
      el.__splitType = type;
      el.__targets = type === "words" ? split.words : type === "chars" ? split.chars : split.lines;
      el.__revealTL = null;
      el.__splitDone = true;
      gsap.set(el, { visibility: "visible" });
    });
  }

  function killTextReveal(name) {
    document.querySelectorAll('[data-reveal-text="' + name + '"]').forEach(function (el) {
      if (el.__revealTL) { el.__revealTL.kill(); el.__revealTL = null; }
      var t = el.__targets || [];
      if (t.length) gsap.killTweensOf(t);
    });
  }

  function animateTextReveal(name, dir) {
    dir = dir || "in";
    document.querySelectorAll('[data-reveal-text="' + name + '"]').forEach(function (el) {
      var type = el.__splitType || el.getAttribute("data-split-text") || "lines";
      var targets = el.__targets || el.querySelectorAll(type === "words" ? ".word" : type === "chars" ? ".char" : ".line");
      if (!targets || !targets.length) return;
      if (el.__revealTL) el.__revealTL.kill();
      var tl = gsap.timeline({ defaults: { overwrite: "auto" } });
      el.__revealTL = tl;
      if (type === "lines") {
        if (dir === "in") tl.fromTo(targets, { filter: "blur(36px)", opacity: 0 }, { filter: "blur(0px)", opacity: 1, duration: 1, stagger: 0.08, ease: "Out" });
        else tl.to(targets, { filter: "blur(36px)", opacity: 0, duration: 0.6, stagger: 0.02, ease: "In" });
      } else if (type === "words") {
        if (dir === "in") tl.fromTo(targets, { opacity: 0, rotateX: 90 }, { opacity: 1, rotateX: 0, transformOrigin: "center bottom", duration: 1, delay: 0.2, stagger: 0.075, ease: "Out" });
        else tl.to(targets, { opacity: 0, rotateX: 90, transformOrigin: "center bottom", duration: 0.6, stagger: 0.05, ease: "Out" });
      } else {
        if (dir === "in") tl.fromTo(targets, { opacity: 0, rotateY: 90 }, { opacity: 1, rotateY: 0, transformOrigin: "center center", duration: 1, delay: 0.2, stagger: 0.025, ease: "Out" });
        else tl.to(targets, { opacity: 0, rotateY: 90, transformOrigin: "center center", duration: 0.6, stagger: 0.025, ease: "Out" });
      }
    });
  }

  function initScrollTriggerRefresh() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var saved = [];
    var seen = new Set();
    ScrollTrigger.getAll().forEach(function (st) {
      var anim = st.animation;
      if (anim && !seen.has(anim)) { seen.add(anim); saved.push({ anim: anim, paused: anim.paused(), p: anim.totalProgress() }); }
    });
    ScrollTrigger.refresh();
    saved.forEach(function (s) { s.anim.totalProgress(s.p, true); if (s.paused) s.anim.pause(); else s.anim.play(); });
    window.scrollTo(0, y);
    if (gsap.ticker && typeof gsap.ticker.flush === "function") gsap.ticker.flush();
  }

  /* ---------- header theme follows section colour ---------- */
  function initThemeChange() {
    var headers = document.querySelectorAll("[theme]");
    function watch(section, on, off) {
      headers.forEach(function (h) {
        var half = h.offsetHeight / 2;
        ScrollTrigger.create({
          trigger: section, start: function () { return "top top+=" + half; }, end: function () { return "top top+=" + (half + 1); },
          onEnter: function () { h.classList.add(on); h.classList.remove(off); },
          onLeaveBack: function () { h.classList.remove(on); h.classList.add(off); }
        });
        ScrollTrigger.create({
          trigger: section, start: function () { return "bottom top+=" + half; }, end: function () { return "bottom top+=" + (half + 1); },
          onEnter: function () { h.classList.remove(on); h.classList.add(off); },
          onLeaveBack: function () { h.classList.add(on); h.classList.remove(off); }
        });
      });
    }
    document.querySelectorAll('[bg="color"]').forEach(function (s) { watch(s, "theme_on-color", "theme_on-light"); });
    document.querySelectorAll('[bg="light"]').forEach(function (s) { watch(s, "theme_on-light", "theme_on-color"); });
  }

  /* ---------- scroll choreography (home) ---------- */
  function mq(query, fn) { var o = {}; o[query] = fn; ScrollTrigger.matchMedia(o); }
  var DESKTOP = "(min-width: " + breakPoint + "px)";
  var MOBILE = "(max-width: " + (breakPoint - 1) + "px)";

  function initAllParallax() {
    mq(DESKTOP, function () {
      gsap.utils.toArray('[parallax="img"]').forEach(function (img) {
        var w = img.closest('[parallax="w"]');
        if (w) gsap.fromTo(img, { yPercent: -30 }, { yPercent: 10, ease: "none", scrollTrigger: { trigger: w, start: "top bottom", end: "bottom top", scrub: 0.5 } });
      });
    });

    if (document.querySelector(".hero_scroll-area")) {
      var logos = document.querySelectorAll(".link-logo");
      if (logos.length) {
        gsap.set(logos, { y: "44vh", scale: 1.25, translateZ: 10 });
        gsap.to(logos, { y: "0vh", scale: 1, translateZ: 10, ease: "ease", scrollTrigger: { trigger: ".hero_scroll-area", start: "top top", end: "bottom bottom", scrub: true } });
      }
    }

    mq(DESKTOP, function () {
      if (!document.querySelector(".globe-bot-w")) return;
      var ctas = document.querySelectorAll(".btn-cta_c");
      if (!ctas.length) return;
      gsap.set(ctas, { y: "0", translateZ: 10 });
      gsap.to(ctas, { y: "-16.632em", scale: 1, translateZ: 10, ease: "none", scrollTrigger: { trigger: ".globe-bot-w", start: "top bottom", end: "bottom bottom", scrub: true } });
    });

    function heroTimeline(withSides) {
      gsap.utils.toArray(".hero-w_bg").forEach(function (bg) {
        var tl = gsap.timeline({ scrollTrigger: { trigger: ".hero_scroll-area", start: "top top", end: "bottom bottom", scrub: true } });
        tl.fromTo(bg, { scale: 1, xPercent: 0, translateZ: 100 }, { scale: 6.5, xPercent: -2, translateZ: 100, ease: "none", duration: 1 }, 0);
        tl.fromTo(".hero-s", { scale: 1 }, { scale: 8, ease: "none", duration: 1 }, 0);
        if (withSides) {
          tl.fromTo("[hero-s_left]", { x: "0vw" }, { x: "-50vw", ease: "none", duration: 1 }, 0);
          tl.fromTo("[hero-s_right]", { x: "0vw" }, { x: "50vw", ease: "none", duration: 1 }, 0);
        }
      });
    }
    mq(DESKTOP, function () { heroTimeline(true); });
    mq(MOBILE, function () { heroTimeline(false); });

    mq(DESKTOP, function () {
      gsap.utils.toArray(".sky-bg_hero").forEach(function (el) {
        gsap.fromTo(el, { y: "0vh", translateZ: 10 }, { y: "100vh", translateZ: 10, ease: "none", scrollTrigger: { trigger: ".hero_scroll-area", start: "top top", end: "bottom bottom", scrub: true } });
      });
      gsap.utils.toArray(".about-s").forEach(function (el) {
        gsap.fromTo(el, { y: "-50vh", translateZ: 10 }, { y: "-200vh", translateZ: 10, ease: "none", scrollTrigger: { trigger: ".about-w", start: "top bottom", end: "bottom top", scrub: true } });
      });
    });

    gsap.utils.toArray(".light-bg").forEach(function (el) {
      gsap.fromTo(el, { opacity: 0, translateZ: 10 }, { opacity: 1, translateZ: 10, ease: "none", scrollTrigger: { trigger: ".jet_scroll-area", start: "top top", end: "center center", scrub: true } });
    });

    mq(DESKTOP, function () {
      if (!document.querySelector(".jet_scroll-area")) return;
      gsap.utils.toArray(".jet_scroll-area .jet-w, .jet_scroll-area .spec-w").forEach(function (el) {
        gsap.fromTo(el, { yPercent: 0, translateZ: 10 }, { yPercent: 100, translateZ: 10, ease: "none", scrollTrigger: { trigger: ".jet_scroll-area", start: "50% center", end: "85% bottom", scrub: 1.2 } });
      });
      gsap.utils.toArray(".jet_scroll-area .jet").forEach(function (el) {
        gsap.fromTo(el, { scale: 1, yPercent: 0, translateZ: 10 }, { scale: 0.4, yPercent: -15, translateZ: 10, ease: "In", scrollTrigger: { trigger: ".jet_scroll-area", start: "25% center", end: "85% bottom", scrub: 1.2 } });
      });
      gsap.utils.toArray(".jet_scroll-area .img-jet").forEach(function (el) {
        gsap.fromTo(el, { "--mask-size": "100% 150%" }, { "--mask-size": "100% 0%", ease: "none", scrollTrigger: { trigger: ".jet_scroll-area", start: "85% bottom", end: "bottom bottom", scrub: true } });
      });
      gsap.utils.toArray(".jet_scroll-area .blueprint").forEach(function (el) {
        gsap.fromTo(el, { "--mask-size": "100% 0%", "--mask-y": "200%" }, { "--mask-size": "100% 150%", "--mask-y": "50%", ease: "none", scrollTrigger: { trigger: ".jet_scroll-area", start: "85% bottom", end: "bottom bottom", scrub: true } });
      });
    });

    mq(DESKTOP, function () {
      if (!document.querySelector(".city-mask-trigger")) return;
      gsap.utils.toArray(".globe-s_city_c").forEach(function (el) {
        gsap.fromTo(el, { yPercent: -40, translateZ: 10 }, { yPercent: 0, translateZ: 10, ease: "none", scrollTrigger: { trigger: ".city-mask-trigger", start: "top bottom", end: "top top", scrub: true } });
      });
    });
    if (document.querySelector(".city-mask-trigger")) {
      gsap.to(".globe-s_city", { "--mask-size": "100% 0%", ease: "none", scrollTrigger: { trigger: ".city-mask-trigger", start: "top top", end: "bottom top", scrub: true } });
    }

    mq(DESKTOP, function () {
      gsap.utils.toArray(".globe-s_title").forEach(function (el) {
        var tl = gsap.timeline({ scrollTrigger: { trigger: ".globe_scroll-area", start: "top top", end: "bottom bottom", scrub: true } });
        tl.fromTo(el, { y: "33.333em" }, { y: "0em", ease: "none" }, 0);
        tl.fromTo(".globe-s_bot_globe-w", { yPercent: 135, scale: 2, translateZ: 10 }, { yPercent: 0, scale: 1, translateZ: 10, ease: "none" }, 0);
      });
    });
  }

  /* ---------- reveals ---------- */
  function initScrollElementsReveal() {
    mq(DESKTOP, function () {
      document.querySelectorAll("[data-line-reveal='true']").forEach(function (el) {
        el.innerHTML = el.innerHTML.replace(/(<br\s*\/?>\s*){2}/g, "$1&zwnj;$1");
        var split = new SplitText(el, { type: "lines", linesClass: "line" });
        gsap.timeline({ scrollTrigger: { trigger: el, start: "top bottom", end: "top bottom", toggleActions: "play none none none" } })
          .from(split.lines, { filter: "blur(36px)", opacity: 0, duration: 1, delay: 0.3, stagger: 0.1, ease: "Out" });
        gsap.set(el, { visibility: "visible" });
      });
      document.querySelectorAll("[data-char-reveal='true']").forEach(function (el) {
        el.innerHTML = el.innerHTML.replace(/(<br\s*\/?>\s*){2}/g, "$1&zwnj;$1");
        var split = new SplitText(el, { type: "words,chars", linesClass: "line", wordsClass: "word", charsClass: "char" });
        gsap.set(split.words, { display: "inline-block", whiteSpace: "nowrap" });
        gsap.timeline({ scrollTrigger: { trigger: el, start: "top bottom", end: "top bottom", toggleActions: "play none none none" } })
          .from(split.chars, { filter: "blur(36px)", opacity: 0, duration: 1, delay: 0.3, stagger: 0.05, ease: "Out" });
        gsap.set(el, { visibility: "visible" });
      });
      document.querySelectorAll('[data-div-reveal="true"]').forEach(function (el) { revealChildren(el); });
    });
  }

  function revealChildren(el) {
    var kids = Array.from(el.children);
    if (!kids.length) return;
    gsap.timeline({ scrollTrigger: { trigger: el, start: "top bottom", end: "top bottom", toggleActions: "play none none none" } })
      .from(kids, { filter: "blur(36px)", opacity: 0, duration: 1, delay: 0.3, stagger: 0.1, ease: "Out" });
    gsap.set(kids, { visibility: "visible" });
  }

  function initBlockReveal() {
    mq(DESKTOP, function () {
      var header = document.querySelector(".header");
      var cta = document.querySelector(".cta");
      var tl = gsap.timeline();
      if (header) { gsap.set(header, { visibility: "visible" }); tl.fromTo(header, { yPercent: -100 }, { yPercent: 0, duration: 1.2, ease: "Out" }, 0); }
      if (cta) { gsap.set(cta, { visibility: "visible" }); tl.fromTo(cta, { yPercent: 100 }, { yPercent: 0, duration: 1.2, ease: "Out" }, 0); }
    });
  }

  function initHighlightText() {
    mq(DESKTOP, function () {
      document.querySelectorAll("[data-highlight-text]").forEach(function (el) {
        var split = new SplitText(el, { type: "words,chars", linesClass: "line", wordsClass: "word", charsClass: "char", tag: "span" });
        gsap.set(split.words, { display: "inline-block", whiteSpace: "nowrap" });
        if (!split.chars || !split.chars.length) return;
        var trigger = el.closest("[data-highlight-wrapper]") || el;
        gsap.timeline({ scrollTrigger: { trigger: trigger, start: "top 75%", end: "bottom 75%", scrub: true } })
          .from(split.chars, { opacity: 0.15, duration: 0.6, ease: "Out", stagger: { each: 0.04 } });
        gsap.set(el, { opacity: 1 });
      });
    });
  }

  function initMagneticEffect() {
    mq(DESKTOP, function () {
      if (window.innerWidth <= 991) return;
      var reset = function (el) { gsap.killTweensOf(el); gsap.set(el, { x: "0em", y: "0em", rotate: "0deg", clearProps: "all" }); };
      document.querySelectorAll("[data-magnetic-strength]").forEach(function (el) {
        el.addEventListener("mouseenter", function (e) { reset(e.currentTarget); });
        el.addEventListener("mousemove", function (e) {
          var t = e.currentTarget, r = t.getBoundingClientRect();
          var s = parseFloat(t.getAttribute("data-magnetic-strength")) || 25;
          var x = ((e.clientX - r.left) / t.offsetWidth - 0.5) * (s / 16);
          var y = ((e.clientY - r.top) / t.offsetHeight - 0.5) * (s / 16);
          gsap.to(t, { x: x + "em", y: y + "em", rotate: "0.001deg", ease: "power4.out", duration: 1.6 });
        });
        el.addEventListener("mouseleave", function (e) {
          gsap.to(e.currentTarget, { x: "0em", y: "0em", ease: "elastic.out(1, 0.3)", duration: 1.6, clearProps: "all" });
        });
      });
    });
  }

  function initGlobeMaskFollow() {
    mq(DESKTOP, function () {
      var globe = document.querySelector(".globe");
      if (!globe) return;
      window.addEventListener("mousemove", function (e) {
        var o = 75 * (0.5 - e.clientX / window.innerWidth);
        gsap.to(globe, { duration: 2.4, ease: "Out", "--mask-x": 50 + o + "%" });
      });
    });
  }

  /* ---------- hovers (bindable for rendered rows) ---------- */
  function once(el, key) { if (el["__" + key]) return false; el["__" + key] = true; return true; }

  function bindBtnCta(scope) {
    scope.querySelectorAll("[hover='btn-cta']").forEach(function (btn) {
      if (!once(btn, "btncta")) return;
      var texts = btn.querySelectorAll("[hover='text']"), icons = btn.querySelectorAll("[hover='icon']");
      if (texts.length < 2) return;
      var a = new SplitText(texts[0], { type: "chars" }).chars, b = new SplitText(texts[1], { type: "chars" }).chars;
      var busy = false;
      var tl = gsap.timeline({ paused: true, onStart: function () { busy = true; }, onComplete: function () { busy = false; } });
      tl.to(a, { yPercent: -100, opacity: 0, duration: 1, ease: "Out", stagger: 0.01 }, 0)
        .fromTo(b, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: "Out", stagger: 0.01 }, 0);
      if (icons.length > 1) {
        tl.to(icons[0], { xPercent: 150, yPercent: -75, duration: 1, ease: "InOut" }, 0)
          .fromTo(icons[1], { xPercent: -150, yPercent: 75 }, { xPercent: 0, yPercent: 0, duration: 1, ease: "InOut" }, 0);
      }
      (btn.closest('[hover-trigger="btn-cta"]') || btn).addEventListener("mouseenter", function () {
        if (busy) return;
        gsap.set(a, { yPercent: 0, opacity: 1 }); gsap.set(b, { yPercent: 100, opacity: 0 });
        if (icons.length > 1) { gsap.set(icons[0], { xPercent: 0, yPercent: 0 }); gsap.set(icons[1], { xPercent: -150, yPercent: 75 }); }
        tl.restart();
      });
    });
  }

  function bindBtn(scope) {
    scope.querySelectorAll("[hover='btn']").forEach(function (btn) {
      if (!once(btn, "btn")) return;
      var idle = btn.querySelectorAll("[hover='idle']"), hov = btn.querySelectorAll("[hover='hover']"), texts = btn.querySelectorAll("[hover='text']");
      if (texts.length < 2) return;
      var tl = gsap.timeline({ paused: true });
      tl.to(texts[0], { xPercent: -150, opacity: 0 }, 0).fromTo(texts[1], { xPercent: 150, opacity: 0 }, { xPercent: 0, opacity: 1 }, 0)
        .to(idle, { xPercent: 100 }, 0).to(hov, { xPercent: 100 }, 0);
      var tw = null, trig = btn.closest('[hover-trigger="btn"]') || btn;
      trig.addEventListener("mouseenter", function () { if (tw) tw.kill(); tw = gsap.to(tl, { progress: 1, duration: 1.2, ease: "Out", overwrite: true }); });
      trig.addEventListener("mouseleave", function () { if (tw) tw.kill(); tw = gsap.to(tl, { progress: 0, duration: 0.6, ease: "Out", overwrite: true }); });
    });
  }

  function bindNavItem(scope) {
    scope.querySelectorAll("[hover='nav-item']").forEach(function (item) {
      if (!once(item, "nav")) return;
      var bg = item.querySelectorAll("[hover='bg']"), texts = item.querySelectorAll("[hover='text']");
      if (texts.length < 2) return;
      var tl = gsap.timeline({ paused: true });
      tl.to(texts[0], { yPercent: -100, opacity: 0 }, 0).fromTo(texts[1], { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1 }, 0).to(bg, { yPercent: -100 }, 0);
      var tw = null, trig = item.closest('[hover-trigger="nav-item"]') || item;
      trig.addEventListener("mouseenter", function () { if (tw) tw.kill(); tw = gsap.to(tl, { progress: 1, duration: 1.2, ease: "Out", overwrite: true }); });
      trig.addEventListener("mouseleave", function () { if (tw) tw.kill(); tw = gsap.to(tl, { progress: 0, duration: 0.6, ease: "Out", overwrite: true }); });
    });
  }

  function bindLink(scope) {
    scope.querySelectorAll("[hover='link']").forEach(function (link) {
      if (!once(link, "link")) return;
      var texts = link.querySelectorAll("[hover='text']");
      if (texts.length < 2) return;
      var a = new SplitText(texts[0], { type: "chars" }).chars, b = new SplitText(texts[1], { type: "chars" }).chars;
      var busy = false;
      var tl = gsap.timeline({ paused: true, onStart: function () { busy = true; }, onComplete: function () { busy = false; } });
      tl.to(a, { yPercent: -100, opacity: 0, duration: 0.8, ease: "Out", stagger: 0.01 }, 0)
        .fromTo(b, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: "Out", stagger: 0.01 }, 0);
      (link.closest('[hover-trigger="link"]') || link).addEventListener("mouseenter", function () {
        if (busy) return;
        gsap.set(a, { yPercent: 0, opacity: 1 }); gsap.set(b, { yPercent: 100, opacity: 0 });
        tl.restart();
      });
    });
  }

  function bindHovers(scope) {
    scope = scope || document;
    bindBtnCta(scope);
    if (!window.matchMedia(DESKTOP).matches) return;
    bindBtn(scope);
    bindNavItem(scope);
    bindLink(scope);
  }

  /* ---------- pop ups (the app action sheet) ---------- */
  function popParts(name) {
    return {
      pop: document.querySelector('[pop-up="' + name + '"]'),
      main: document.querySelector('[pop-up-main="' + name + '"]'),
      success: document.querySelector('[pop-up-success="' + name + '"]'),
      over: document.querySelector('[pop-up-over="' + name + '"]')
    };
  }

  function openPopup(name) {
    var p = popParts(name);
    if (!p.pop) return;
    gsap.killTweensOf([p.pop, p.main, p.success, p.over].filter(Boolean));
    gsap.set(p.pop, { display: "block" });
    if (p.success) gsap.set(p.success, { y: "110vh", rotate: 0, display: "none" });
    gsap.fromTo(p.main, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: "Out" });
    if (p.over) gsap.fromTo(p.over, { opacity: 0 }, { opacity: 1, duration: 1, ease: "Out" });
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-lenis-prevent", "");
    if (lenis) lenis.stop();
  }

  function closePopup(name) {
    var p = popParts(name);
    if (!p.pop) return;
    gsap.killTweensOf([p.pop, p.main, p.success, p.over].filter(Boolean));
    gsap.to(p.main, { yPercent: 110, duration: 1, ease: "Out", onComplete: function () { p.pop.style.display = "none"; } });
    if (p.success) gsap.to(p.success, { y: "110vh", rotate: 25, duration: 1, ease: "In" });
    if (p.over) gsap.to(p.over, { opacity: 0, duration: 1, ease: "Out" });
    document.body.style.overflow = "";
    document.body.removeAttribute("data-lenis-prevent");
    if (lenis) lenis.start();
  }

  function showPopupSuccess(name) {
    var p = popParts(name);
    if (!p.success) return;
    gsap.set(p.success, { display: "block" });
    gsap.fromTo(p.success, { y: "110vh", rotate: 0 }, { y: "0", rotate: 0, duration: 1, ease: "Out" });
    gsap.to(p.main, { yPercent: 110, duration: 1, ease: "Out" });
  }

  function initPopups() {
    document.addEventListener("click", function (e) {
      var closer = e.target.closest && e.target.closest("[pop-up-close]");
      if (closer && closer.getAttribute("pop-up-close")) {
        var n = closer.getAttribute("pop-up-close");
        if (document.querySelector('[pop-up="' + n + '"]')) { e.preventDefault(); closePopup(n); }
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      document.querySelectorAll("[pop-up]").forEach(function (p) {
        if (p.style.display === "block") closePopup(p.getAttribute("pop-up"));
      });
    });
  }

  /* ---------- mobile menu ---------- */
  function initMenu() {
    mq(MOBILE, function () {
      var state = {};
      document.querySelectorAll("[menu-btn]").forEach(function (btn) {
        var n = btn.getAttribute("menu-btn");
        var menu = document.querySelector('[menu="' + n + '"]'), list = document.querySelector('[menu-list="' + n + '"]');
        var over = document.querySelector('[menu-over="' + n + '"]');
        var i1 = document.querySelector('[menu-ico-1="' + n + '"]'), i2 = document.querySelector('[menu-ico-2="' + n + '"]'), i3 = document.querySelector('[menu-ico-3="' + n + '"]');
        var bar = document.querySelector(".header_c");
        if (!(menu && over && bar && list)) return;
        var items = Array.from(list.children).filter(function (c) { return c.nodeType === 1; });
        if (!(n in state)) state[n] = false;
        var closing = null;
        function open() {
          if (closing) { closing.kill(); closing = null; }
          gsap.killTweensOf([menu, over, i1, i2, i3].concat(items).filter(Boolean));
          state[n] = true;
          document.body.style.overflow = "hidden";
          document.body.setAttribute("data-lenis-prevent", "");
          bar.classList.add("theme_on-color");
          btn.setAttribute("aria-expanded", "true");
          gsap.set(menu, { display: "block" });
          gsap.set(items, { xPercent: -50, opacity: 0 });
          gsap.set(over, { opacity: 0, display: "block" });
          gsap.to(over, { opacity: 1, duration: 0.6, ease: "Out" });
          if (i1) gsap.to(i1, { rotate: 45, xPercent: -20, yPercent: 20, duration: 0.6, ease: "InOut" });
          if (i3) gsap.to(i3, { rotate: -45, xPercent: -20, yPercent: -20, duration: 0.6, ease: "InOut" });
          if (i2) gsap.to(i2, { scaleX: 0, duration: 0.6, ease: "InOut" });
          gsap.to(items, { xPercent: 0, opacity: 1, duration: 0.6, ease: "Out", stagger: 0.1, overwrite: "auto" });
        }
        function close() {
          gsap.killTweensOf([menu, over, i1, i2, i3].concat(items).filter(Boolean));
          state[n] = false;
          btn.setAttribute("aria-expanded", "false");
          closing = gsap.to(items, {
            xPercent: 0, opacity: 0, duration: 0.6, ease: "Out", stagger: 0.1, overwrite: "auto",
            onComplete: function () {
              closing = null;
              if (!state[n]) {
                menu.style.display = "none";
                document.body.style.overflow = "";
                document.body.removeAttribute("data-lenis-prevent");
                bar.classList.remove("theme_on-color");
              }
            }
          });
          gsap.to(over, { opacity: 0, duration: 0.6, ease: "In", onComplete: function () { over.style.display = "none"; } });
          if (i1) gsap.to(i1, { rotate: 0, xPercent: 0, yPercent: 0, duration: 0.6, ease: "InOut" });
          if (i3) gsap.to(i3, { rotate: 0, xPercent: 0, yPercent: 0, duration: 0.6, ease: "InOut" });
          if (i2) gsap.to(i2, { scaleX: 1, duration: 0.6, ease: "InOut" });
        }
        btn.setAttribute("aria-expanded", "false");
        btn.addEventListener("click", function (e) { e.preventDefault(); if (state[n]) close(); else open(); });
        document.querySelectorAll('[menu-close="' + n + '"]').forEach(function (c) {
          c.addEventListener("click", function () { if (state[n]) close(); });
        });
        api.closeMenu = function () { if (state[n]) close(); };
      });
    });
  }

  /* ---------- globe (home) ---------- */
  var globeStarted = false;
  function initGlobe() {
    mq(DESKTOP, function () {
      var el = document.querySelector("[globe-container]");
      if (!el || typeof Globe !== "function" || globeStarted) return;
      globeStarted = true;
      var arcs = Array.from({ length: 10 }, function () {
        return { startLat: 180 * (Math.random() - 0.5), startLng: 360 * (Math.random() - 0.5), endLat: 180 * (Math.random() - 0.5), endLng: 360 * (Math.random() - 0.5), color: ["#7A716E", "#7A716E"] };
      });
      var points = arcs.flatMap(function (a) { return [{ lat: a.startLat, lng: a.startLng }, { lat: a.endLat, lng: a.endLng }]; });
      var g = Globe()(el).globeImageUrl("assets/img/globe-map.svg").showAtmosphere(false).backgroundColor("rgba(0,0,0,0)")
        .width(el.offsetWidth).height(el.offsetHeight)
        .arcsData(arcs).arcColor("color").arcStroke(0.5).arcDashLength(0.6).arcDashGap(0.2).arcDashAnimateTime(8000).arcsTransitionDuration(0)
        .pointsData(points).pointColor(function () { return "#7A716E"; }).pointAltitude(0).pointRadius(0.5).pointResolution(8).pointsTransitionDuration(0);
      var mat = g.globeMaterial && g.globeMaterial();
      if (mat) { mat.shininess = 0; if (window.THREE) mat.specular = new THREE.Color(0); mat.needsUpdate = true; }
      var controls = g.controls();
      controls.enableZoom = false; controls.enablePan = false;
      var polar = typeof controls.getPolarAngle === "function" ? controls.getPolarAngle() : Math.PI / 2;
      controls.minPolarAngle = polar; controls.maxPolarAngle = polar;
      controls.autoRotate = true; controls.autoRotateSpeed = 2;
      window.addEventListener("resize", function () { g.width(el.offsetWidth).height(el.offsetHeight); });
    });
  }

  function initLottieAutoplay() {
    if (!window.lottie) return;
    document.querySelectorAll('[data-json][play="true"]').forEach(function (el) {
      el.innerHTML = "";
      lottie.loadAnimation({ container: el, renderer: "svg", loop: true, autoplay: true, path: el.getAttribute("data-json") });
    });
  }

  /* ---------- records accordion (home) ---------- */
  function initBenefitsAccordion() {
    var buttons = Array.from(document.querySelectorAll("[benefits-btn]"));
    if (!buttons.length) return;
    var z = 1, current = null;
    function parts(k) {
      return {
        desc: document.querySelector('[benefits-desc="' + k + '"]'),
        media: document.querySelector('[benefits-media-item="' + k + '"]'),
        imgW: document.querySelector('[benefits-img-w="' + k + '"]'),
        img: document.querySelector('[benefits-img="' + k + '"]'),
        icon2: document.querySelector('[benefits-icon-2="' + k + '"]')
      };
    }
    function open(k) {
      var p = parts(k);
      gsap.killTweensOf([p.desc, p.media, p.imgW, p.img, p.icon2].filter(Boolean));
      killTextReveal(k);
      if (p.media) { z += 1; p.media.style.zIndex = String(z); }
      gsap.set(p.desc, { height: 0, overflow: "hidden" });
      if (p.imgW) gsap.set(p.imgW, { yPercent: 100 });
      if (p.img) gsap.set(p.img, { yPercent: -50, scale: 2 });
      if (p.icon2) gsap.set(p.icon2, { rotate: 0 });
      gsap.to(p.desc, { height: "auto", duration: 1, ease: "Out", onComplete: initScrollTriggerRefresh });
      if (p.imgW) gsap.to(p.imgW, { yPercent: 0, duration: 1, ease: "Out" });
      if (p.img) gsap.to(p.img, { yPercent: 0, scale: 1, duration: 1, ease: "Out" });
      if (p.icon2) gsap.to(p.icon2, { rotate: 90, duration: 0.6, ease: "InOut" });
      splitTextSetup(k); animateTextReveal(k, "in");
      current = k;
      buttons.forEach(function (b) { b.setAttribute("aria-expanded", String(b.getAttribute("benefits-btn") === k)); });
    }
    function close(k) {
      var p = parts(k);
      gsap.killTweensOf([p.desc, p.media, p.icon2].filter(Boolean));
      killTextReveal(k);
      gsap.to(p.desc, { height: 0, duration: 1, ease: "Out", onComplete: initScrollTriggerRefresh });
      if (p.icon2) gsap.to(p.icon2, { rotate: 180, duration: 0.6, ease: "InOut" });
      animateTextReveal(k, "out");
      if (current === k) current = null;
      buttons.forEach(function (b) { if (b.getAttribute("benefits-btn") === k) b.setAttribute("aria-expanded", "false"); });
    }
    buttons.forEach(function (btn) {
      var k = btn.getAttribute("benefits-btn");
      var p = parts(k);
      if (!p.desc || !p.media) return;
      btn.setAttribute("role", "button");
      btn.setAttribute("tabindex", "0");
      var toggle = function () { if (current === k) close(k); else { if (current !== null) close(current); open(k); } };
      btn.addEventListener("click", toggle);
      btn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    open(buttons[0].getAttribute("benefits-btn"));
  }

  /* ---------- looping words (home) ---------- */
  function initLoopingWords() {
    mq(DESKTOP, function () {
      var list = document.querySelector("[data-looping-words-list]");
      if (!list) return;
      var items = Array.from(list.children), n = items.length;
      if (n < 5) return;
      var step = 100 / n, i = 5;
      function mark(k) { items.forEach(function (x) { x.classList.remove("current"); }); var t = items[k % n]; if (t) t.classList.add("current"); }
      function next() {
        var k = i + 1;
        mark(k);
        gsap.to(list, {
          yPercent: -step * k, duration: 0.6, ease: "Out",
          onComplete: function () {
            i = k;
            if (i >= n - 6) { list.appendChild(list.children[0]); i--; gsap.set(list, { yPercent: -step * i }); items.push(items.shift()); }
          }
        });
      }
      gsap.set(list, { yPercent: -step * i });
      mark(i);
      gsap.timeline({ repeat: -1, delay: 0 }).call(next).to({}, { duration: 0.8 });
    });
    mq(MOBILE, function () {
      var list = document.querySelector("[data-looping-words-list]");
      if (!list) return;
      var items = Array.from(list.children), n = items.length;
      if (n < 5) return;
      var w = items[0] ? items[0].getBoundingClientRect().width : 0, i = 5;
      function place(k) { gsap.set(list, { x: -w * k }); }
      function mark(k) { items.forEach(function (x) { x.classList.remove("current"); }); var t = items[k % n]; if (t) t.classList.add("current"); }
      function next() {
        var k = i + 1;
        mark(k);
        gsap.to(list, {
          x: -w * k, duration: 1, ease: "Out",
          onComplete: function () { i = k; if (i >= n - 6) { list.appendChild(list.children[0]); i--; place(i); items.push(items.shift()); } }
        });
      }
      place(i); mark(i);
      gsap.timeline({ repeat: -1, delay: 0 }).call(next).to({}, { duration: 1.2 });
      window.addEventListener("resize", function () { var nw = items[0] ? items[0].getBoundingClientRect().width : 0; if (nw) { w = nw; place(i); } });
    });
  }

  function initOther() {
    var year = String(new Date().getFullYear());
    document.querySelectorAll(".year").forEach(function (el) { el.textContent = year; });
  }

  function initFlickerShow() {
    mq(MOBILE, function () {
      document.querySelectorAll("[data-prevent-flicker='true']").forEach(function (el) { gsap.set(el, { visibility: "visible" }); });
    });
  }

  var api = window.TronautMotion = {
    ready: ready,
    bind: function (scope) { bindHovers(scope || document); },
    reveal: function (el) { if (window.matchMedia(DESKTOP).matches) revealChildren(el); },
    refresh: function () { ScrollTrigger.refresh(); },
    openPopup: openPopup,
    closePopup: closePopup,
    showPopupSuccess: showPopupSuccess,
    closeMenu: function () {},
    scrollTo: function (target) {
      if (lenis) lenis.scrollTo(target, { offset: -80 });
      else if (target && target.scrollIntoView) target.scrollIntoView();
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPreloader);
  else initPreloader();
})();
