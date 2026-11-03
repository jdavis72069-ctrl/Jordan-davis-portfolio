/* Motion layer: reveals, hero letter split, squiggle draw-on, parallax, tilt,
   doodle stars, topnav state and the lightbox. Vanilla JS, no libraries.
   Works whenever content arrives (content:ready event OR html.content-ready class). */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var REDUCED = reduceMQ.matches;
  var FINE = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : false;
  var HAS_IO = 'IntersectionObserver' in window;

  // Hidden "pre-reveal" states in CSS only apply with this class (so no-JS = visible).
  if (!REDUCED && HAS_IO) root.classList.add('js-motion');

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- Lightbox (document-delegated, works with late-rendered content) ---------- */
  var lb = null, lbImg, lbCount, lbCap, lbPrev, lbNext, lbClose, lbFrame;
  var lbState = { images: [], i: 0, alt: '', trigger: null, open: false };
  var lbHideTimer = 0;

  function buildLightbox() {
    if (lb) return;
    lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Image viewer');
    lb.hidden = true;
    lb.innerHTML =
      '<div class="lb__backdrop"></div>' +
      '<button type="button" class="lb__btn lb__close" aria-label="Close image viewer">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"/></svg></button>' +
      '<button type="button" class="lb__btn lb__prev" aria-label="Previous image">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 L7 12 L15 20"/></svg></button>' +
      '<button type="button" class="lb__btn lb__next" aria-label="Next image">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 L17 12 L9 20"/></svg></button>' +
      '<figure class="lb__stage"><div class="lb__frame"><img class="lb__img" alt=""></div>' +
        '<figcaption class="lb__cap"></figcaption></figure>' +
      '<p class="lb__count" aria-live="polite"></p>';
    document.body.appendChild(lb);
    lbImg = $('.lb__img', lb);
    lbCount = $('.lb__count', lb);
    lbCap = $('.lb__cap', lb);
    lbPrev = $('.lb__prev', lb);
    lbNext = $('.lb__next', lb);
    lbClose = $('.lb__close', lb);
    lbFrame = $('.lb__frame', lb);

    lbClose.addEventListener('click', closeLightbox);
    lbPrev.addEventListener('click', function () { step(-1); });
    lbNext.addEventListener('click', function () { step(1); });
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb__backdrop') || e.target.classList.contains('lb__stage')) closeLightbox();
    });
    lbImg.addEventListener('load', function () { lbFrame.classList.add('is-loaded'); });
    lbImg.addEventListener('error', function () { lbFrame.classList.add('is-loaded'); });

    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx === null || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function showImage(animate) {
    var n = lbState.images.length;
    if (animate) lbFrame.classList.remove('is-loaded');
    lbImg.alt = lbState.alt;
    lbImg.src = encodeURI(decodeURI(lbState.images[lbState.i]));
    lbCap.textContent = lbState.alt;
    lbCap.hidden = !lbState.alt;
    lbCount.textContent = n > 1 ? (lbState.i + 1) + ' / ' + n : '';
    lbCount.hidden = n < 2;
    lbPrev.hidden = lbNext.hidden = n < 2;
    if (lbImg.complete && lbImg.naturalWidth) lbFrame.classList.add('is-loaded');
  }

  function step(dir) {
    var n = lbState.images.length;
    if (n < 2) return;
    lbState.i = (lbState.i + dir + n) % n;
    showImage(true);
  }

  function openLightbox(trigger) {
    var imgs = (trigger.getAttribute('data-images') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!imgs.length) {
      var inner = $('img', trigger);
      if (inner && inner.getAttribute('src')) imgs = [inner.getAttribute('src')];
    }
    if (!imgs.length) return;
    buildLightbox();
    clearTimeout(lbHideTimer);
    lbState.images = imgs;
    lbState.i = 0;
    lbState.alt = trigger.getAttribute('data-alt') || ($('img', trigger) || {}).alt || '';
    lbState.trigger = trigger;
    lbState.open = true;

    var sbw = window.innerWidth - root.clientWidth;
    root.style.setProperty('--sbw', sbw > 0 ? sbw + 'px' : '0px');
    root.classList.add('lb-open');
    lb.hidden = false;
    showImage(true);
    void lb.offsetWidth; // flush so the transition runs
    lb.classList.add('is-open');
    lbClose.focus({ preventScroll: true });
  }

  function closeLightbox() {
    if (!lbState.open) return;
    lbState.open = false;
    lb.classList.remove('is-open');
    root.classList.remove('lb-open');
    root.style.removeProperty('--sbw');
    var t = lbState.trigger;
    lbHideTimer = setTimeout(function () { lb.hidden = true; lbImg.removeAttribute('src'); }, REDUCED ? 0 : 380);
    if (t && document.contains(t)) t.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (!lbState.open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    else if (e.key === 'ArrowRight') { step(1); }
    else if (e.key === 'ArrowLeft') { step(-1); }
    else if (e.key === 'Tab') {
      var f = $$('.lb__btn', lb).filter(function (b) { return !b.hidden; });
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1], a = document.activeElement;
      if (f.indexOf(a) === -1) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && a === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && a === lastEl) { e.preventDefault(); first.focus(); }
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-lightbox]') : null;
    if (!t) return;
    e.preventDefault();
    openLightbox(t);
  });
  document.addEventListener('keydown', onKey);

  /* ---------- Hero name: split into letters ---------- */
  function splitText(el) {
    if (el.getAttribute('data-split-done')) return;
    var full = el.textContent.replace(/\s+/g, ' ').trim();
    if (!full) return;
    el.setAttribute('aria-label', full);
    el.setAttribute('data-split-done', '1');
    var idx = 0;

    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var word = document.createElement('span');
            word.className = 'word';
            word.setAttribute('aria-hidden', 'true');
            Array.prototype.forEach.call(part, function (ch) {
              var s = document.createElement('span');
              s.className = 'char';
              s.setAttribute('aria-hidden', 'true');
              s.style.setProperty('--ci', idx++);
              s.textContent = ch;
              word.appendChild(s);
            });
            frag.appendChild(word);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    }
    walk(el);
    if (!el.hasAttribute('role') && el.tagName !== 'H1') el.setAttribute('role', 'text');
  }

  /* ---------- Reveals ---------- */
  function setupReveals() {
    var els = $$('[data-reveal]:not(.is-in)');
    if (!els.length) return;
    if (REDUCED || !HAS_IO) { els.forEach(function (el) { el.classList.add('is-in', 'is-settled'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        el.classList.add('is-in');
        // after the entrance finishes, drop the stagger delay so hover feels instant
        var done = false;
        var settle = function () { if (done) return; done = true; el.classList.add('is-settled'); };
        el.addEventListener('transitionend', function (ev) { if (ev.target === el && ev.propertyName === 'opacity') settle(); });
        setTimeout(settle, 1800);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Squiggle draw-on ---------- */
  function setupDraw() {
    var heads = $$('[data-draw]');
    if (!heads.length || REDUCED || !HAS_IO) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        en.target.classList.add('is-drawn');
        $$('.squiggle path', en.target).forEach(function (p) { p.style.strokeDashoffset = '0'; });
      });
    }, { threshold: 0.6, rootMargin: '0px 0px -6% 0px' });
    heads.forEach(function (h) {
      $$('.squiggle path', h).forEach(function (p) {
        var len = 200;
        try { len = Math.ceil(p.getTotalLength()) + 2; } catch (err) { /* ignore */ }
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
      });
      io.observe(h);
    });
  }

  /* ---------- Doodle stars ---------- */
  function setupDoodles() {
    var stars = $$('.doodle-star');
    stars.forEach(function (s) {
      s.style.setProperty('--tw-dur', (3 + Math.random() * 4).toFixed(2) + 's');
      s.style.setProperty('--tw-delay', (-Math.random() * 6).toFixed(2) + 's');
      s.style.setProperty('--rot', (Math.random() * 40 - 20).toFixed(1) + 'deg');
    });
    if (REDUCED || !HAS_IO || !stars.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-paused', !en.isIntersecting); });
    }, { rootMargin: '60px' });
    stars.forEach(function (s) { io.observe(s); });
  }

  /* ---------- Hero off-screen pausing + topnav ---------- */
  function setupHeroAndNav() {
    var hero = $('.hero');
    var nav = $('.topnav');
    if (hero && HAS_IO) {
      new IntersectionObserver(function (entries) {
        var inView = entries[0].isIntersecting;
        hero.classList.toggle('is-offscreen', !inView);
        if (nav) nav.classList.toggle('topnav--scrolled', !inView);
      }, { threshold: 0 }).observe(hero);
    } else if (nav) {
      var onS = function () { nav.classList.toggle('topnav--scrolled', window.pageYOffset > window.innerHeight * 0.8); };
      window.addEventListener('scroll', onS, { passive: true });
      onS();
    }

    if (!nav || !HAS_IO) return;
    var links = $$('a[href^="#"]', nav);
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var visible = {};
    function setActive(id) {
      links.forEach(function (a) {
        var on = a === map[id];
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.intersectionRatio : 0; });
      var best = null, bestV = 0;
      Object.keys(visible).forEach(function (id) { if (visible[id] > bestV) { bestV = visible[id]; best = id; } });
      setActive(best);
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1], rootMargin: '-30% 0px -40% 0px' });
    $$('section[id]').forEach(function (sec) { if (map[sec.id]) io.observe(sec); });
  }

  /* ---------- Projects grid background parallax ---------- */
  function setupGridBg() {
    var bg = $('.projects__grid-bg');
    if (!bg || REDUCED) return;
    var section = bg.closest('section') || bg.parentElement;
    var vis = true, ticking = false;
    function update() {
      ticking = false;
      if (!vis) return;
      var r = section.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var p = (vh / 2 - (r.top + r.height / 2)) / (r.height + vh); // about -0.5 .. 0.5
      bg.style.translate = '0 ' + (p * 120).toFixed(1) + 'px';
    }
    function req() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    if (HAS_IO) {
      new IntersectionObserver(function (en) {
        vis = en[0].isIntersecting;
        bg.classList.toggle('is-paused', !vis);
        if (vis) req();
      }, { rootMargin: '100px' }).observe(section);
    }
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req, { passive: true });
    update();
  }

  /* ---------- Subtle card tilt ---------- */
  function setupTilt() {
    if (REDUCED || !FINE) return;
    $$('.project').forEach(function (card) {
      if (card.getAttribute('data-tilt-ready')) return;
      card.setAttribute('data-tilt-ready', '1');
      var raf = 0;
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          card.style.setProperty('--ry', (px * 4).toFixed(2) + 'deg');
          card.style.setProperty('--rx', (-py * 3).toFixed(2) + 'deg');
        });
      });
      card.addEventListener('pointerleave', function () {
        cancelAnimationFrame(raf);
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ---------- Boot ---------- */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    $$('[data-split]').forEach(function (el) { if (!REDUCED) splitText(el); });
    setupReveals();
    setupDraw();
    setupDoodles();
    setupHeroAndNav();
    setupGridBg();
    setupTilt();
    root.classList.add('motion-ready');
  }

  function onReady() {
    // let layout settle a frame so first-view reveals/measurements are accurate
    requestAnimationFrame(boot);
  }

  if (root.classList.contains('content-ready')) onReady();
  document.addEventListener('content:ready', onReady);
  // Safety net: if content never signals (error page), still wire what exists.
  window.addEventListener('load', function () {
    setTimeout(function () { if (!booted && !$('.loading, [data-loading]')) boot(); }, 4000);
  });
})();
