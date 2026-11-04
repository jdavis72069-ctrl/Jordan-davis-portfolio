/* Motion layer: reveals, hero letter split, squiggle draw-on, parallax, tilt,
   the flight-path trail, doodle stars, topnav state and the lightbox. Vanilla JS, no libraries.
   Works whenever content arrives (content:ready event OR html.content-ready class). */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMQ = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };
  var REDUCED = reduceMQ.matches;
  var FINE = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : false;
  var HAS_IO = 'IntersectionObserver' in window;

  // Hidden "pre-reveal" states in CSS only apply with this class (so no-JS = visible).
  if (!REDUCED && HAS_IO) root.classList.add('js-motion');

  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ---------- Lightbox (document-delegated, works with late-rendered content) ---------- */
  var lb = null,
    lbImg,
    lbCount,
    lbCap,
    lbPrev,
    lbNext,
    lbClose,
    lbFrame;
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
    lbPrev.addEventListener('click', function () {
      step(-1);
    });
    lbNext.addEventListener('click', function () {
      step(1);
    });
    lb.addEventListener('click', function (e) {
      if (
        e.target === lb ||
        e.target.classList.contains('lb__backdrop') ||
        e.target.classList.contains('lb__stage')
      )
        closeLightbox();
    });
    lbImg.addEventListener('load', function () {
      lbFrame.classList.add('is-loaded');
    });
    lbImg.addEventListener('error', function () {
      lbFrame.classList.add('is-loaded');
    });

    var sx = null;
    lb.addEventListener(
      'touchstart',
      function (e) {
        sx = e.touches.length === 1 ? e.touches[0].clientX : null;
      },
      { passive: true },
    );
    lb.addEventListener(
      'touchend',
      function (e) {
        if (sx === null || !e.changedTouches.length) return;
        var dx = e.changedTouches[0].clientX - sx;
        sx = null;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      },
      { passive: true },
    );
  }

  function showImage(animate) {
    var n = lbState.images.length;
    if (animate) lbFrame.classList.remove('is-loaded');
    lbImg.alt = lbState.alt;
    lbImg.src = encodeURI(decodeURI(lbState.images[lbState.i]));
    lbCap.textContent = lbState.alt;
    lbCap.hidden = !lbState.alt;
    lbCount.textContent = n > 1 ? lbState.i + 1 + ' / ' + n : '';
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
    var imgs = (trigger.getAttribute('data-images') || '')
      .split('|')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
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
    lbHideTimer = setTimeout(
      function () {
        lb.hidden = true;
        lbImg.removeAttribute('src');
      },
      REDUCED ? 0 : 380,
    );
    if (t && document.contains(t)) t.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (!lbState.open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
    } else if (e.key === 'ArrowRight') {
      step(1);
    } else if (e.key === 'ArrowLeft') {
      step(-1);
    } else if (e.key === 'Tab') {
      var f = $$('.lb__btn', lb).filter(function (b) {
        return !b.hidden;
      });
      if (!f.length) return;
      var first = f[0],
        lastEl = f[f.length - 1],
        a = document.activeElement;
      if (f.indexOf(a) === -1) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && a === first) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && a === lastEl) {
        e.preventDefault();
        first.focus();
      }
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
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
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
    if (REDUCED || !HAS_IO) {
      els.forEach(function (el) {
        el.classList.add('is-in', 'is-settled');
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          io.unobserve(el);
          el.classList.add('is-in');
          // after the entrance finishes, drop the stagger delay so hover feels instant
          var done = false;
          var settle = function () {
            if (done) return;
            done = true;
            el.classList.add('is-settled');
          };
          el.addEventListener('transitionend', function (ev) {
            if (ev.target === el && ev.propertyName === 'opacity') settle();
          });
          setTimeout(settle, 1800);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------- Squiggle draw-on ---------- */
  function setupDraw() {
    var heads = $$('[data-draw]');
    if (!heads.length || REDUCED || !HAS_IO) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          en.target.classList.add('is-drawn');
          $$('.squiggle path', en.target).forEach(function (p) {
            p.style.strokeDashoffset = '0';
          });
        });
      },
      { threshold: 0.6, rootMargin: '0px 0px -6% 0px' },
    );
    heads.forEach(function (h) {
      $$('.squiggle path', h).forEach(function (p) {
        var len = 200;
        try {
          len = Math.ceil(p.getTotalLength()) + 2;
        } catch (err) {
          /* ignore */
        }
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
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          en.target.classList.toggle('is-paused', !en.isIntersecting);
        });
      },
      { rootMargin: '60px' },
    );
    stars.forEach(function (s) {
      io.observe(s);
    });
  }

  /* ---------- Hero off-screen pausing + topnav ---------- */
  function setupHeroAndNav() {
    var hero = $('.hero');
    var nav = $('.topnav');
    if (hero && HAS_IO) {
      new IntersectionObserver(
        function (entries) {
          var inView = entries[0].isIntersecting;
          hero.classList.toggle('is-offscreen', !inView);
          if (nav) nav.classList.toggle('topnav--scrolled', !inView);
        },
        { threshold: 0 },
      ).observe(hero);
    } else if (nav) {
      var onS = function () {
        nav.classList.toggle('topnav--scrolled', window.pageYOffset > window.innerHeight * 0.8);
      };
      window.addEventListener('scroll', onS, { passive: true });
      onS();
    }

    if (!nav || !HAS_IO) return;
    var links = $$('a[href^="#"]', nav);
    var map = {};
    links.forEach(function (a) {
      map[a.getAttribute('href').slice(1)] = a;
    });
    var visible = {};
    function setActive(id) {
      links.forEach(function (a) {
        var on = a === map[id];
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          visible[en.target.id] = en.isIntersecting ? en.intersectionRatio : 0;
        });
        var best = null,
          bestV = 0;
        Object.keys(visible).forEach(function (id) {
          if (visible[id] > bestV) {
            bestV = visible[id];
            best = id;
          }
        });
        setActive(best);
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1], rootMargin: '-30% 0px -40% 0px' },
    );
    $$('section[id]').forEach(function (sec) {
      if (map[sec.id]) io.observe(sec);
    });
  }

  /* ---------- Projects grid background parallax ----------
     A gentle drift of the wormhole grid as the Projects section passes. It only moves
     while the section is near the screen, runs at most once per frame, and never reads
     layout while scrolling: the section's position is measured on entry and on resize. */
  function setupGridBg() {
    var bg = $('.projects__grid-bg');
    if (!bg || REDUCED) return;
    var section = bg.closest('section') || bg.parentElement;
    var visible = !HAS_IO;
    var ticking = false;
    var sectionTop = 0; // distance from the top of the document
    var sectionHeight = 1;

    function measure() {
      var rect = section.getBoundingClientRect();
      sectionTop = rect.top + window.pageYOffset;
      sectionHeight = Math.max(rect.height, 1);
    }

    function update() {
      ticking = false;
      if (!visible) return;
      var vh = window.innerHeight || 800;
      var centreOnScreen = sectionTop + sectionHeight / 2 - window.pageYOffset;
      var progress = (vh / 2 - centreOnScreen) / (sectionHeight + vh); // about -0.5 .. 0.5
      bg.style.translate = '0 ' + (progress * 120).toFixed(1) + 'px';
    }

    function requestUpdate() {
      if (ticking || !visible) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    function onResize() {
      measure();
      requestUpdate();
    }

    if (HAS_IO) {
      new IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
          bg.classList.toggle('is-paused', !visible);
          if (visible) onResize();
        },
        { rootMargin: '100px' },
      ).observe(section);
    }
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    measure();
    update();
  }

  /* ---------- Flight-path trail ----------
     A dotted line that starts on one of the hero's orbit rings and winds down the page,
     passing a small star or planet at every section heading. It sits behind the content.

     It is built as many small SVGs, one per hop between two neighbouring points, each
     sized to its own bounding box. Nothing here runs while the visitor scrolls: a hop is
     revealed once, by a CSS transition, the first time it comes into view, and its end
     mark lights up when that transition finishes. The wipe only moves two pre-drawn layers,
     so it needs no repainting. (A single page-tall SVG, redrawn on every scroll frame,
     was what made the page stutter.) The trail is rebuilt only when
     the page's size really changes (images loading, fonts arriving, window resizes).
     With reduced motion every hop is shown at once and every mark is lit. */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var TRAIL_PAD = 28; // room around a hop for the line's stroke and the mark at its end
  var TRAIL_REVEAL_MS = 1400; // keep in step with the clip-path transition in motion.css

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  /** Position of an element inside `ancestor`, ignoring transforms (so reveal offsets don't matter). */
  function offsetWithin(el, ancestor) {
    var x = 0;
    var y = 0;
    var node = el;
    while (node && node !== ancestor) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return { x: x, y: y };
  }

  /** The two control points of the S-curve that joins `a` to `b` (a hop always travels downwards). */
  function hopControls(a, b) {
    var rise = (b.y - a.y) * 0.55;
    var lean = (b.x - a.x) * 0.12;
    return [
      { x: a.x + lean, y: a.y + rise },
      { x: b.x - lean, y: b.y - rise },
    ];
  }

  /** Path data for one hop, with every point shifted by (-originX, -originY). */
  function hopPathData(a, b, originX, originY) {
    var c = hopControls(a, b);
    var pts = [a, c[0], c[1], b].map(function (p) {
      return (p.x - originX).toFixed(1) + ' ' + (p.y - originY).toFixed(1);
    });
    return 'M' + pts[0] + ' C' + pts[1] + ' ' + pts[2] + ' ' + pts[3];
  }

  /** A small star or ringed planet centred on `point` (in the hop's own coordinates). */
  function trailMark(kind, point) {
    var g = svgEl('g', { class: 'trail__mark' });
    if (kind === 'planet') {
      g.appendChild(
        svgEl('circle', { cx: point.x, cy: point.y, r: 5, class: 'trail__planet-core' }),
      );
      g.appendChild(
        svgEl('ellipse', {
          cx: point.x,
          cy: point.y,
          rx: 13,
          ry: 4.5,
          transform: 'rotate(-24 ' + point.x + ' ' + point.y + ')',
        }),
      );
    } else {
      var size = 26;
      g.appendChild(
        svgEl('use', {
          href: '#star-doodle',
          x: point.x - size / 2,
          y: point.y - size / 2,
          width: size,
          height: size,
        }),
      );
    }
    return g;
  }

  /** One hop as an absolutely positioned wrapper holding a small SVG. `kind` is the mark at `b`, if any. */
  function buildHop(a, b, kind) {
    var c = hopControls(a, b);
    var xs = [a.x, b.x, c[0].x, c[1].x];
    var left = Math.floor(Math.min.apply(null, xs)) - TRAIL_PAD;
    var right = Math.ceil(Math.max.apply(null, xs)) + TRAIL_PAD;
    var top = Math.floor(a.y) - TRAIL_PAD;
    var bottom = Math.ceil(b.y) + TRAIL_PAD;
    var width = right - left;
    var height = bottom - top;

    var wrap = document.createElement('div');
    wrap.className = 'trail__hop';
    wrap.style.left = left + 'px';
    wrap.style.top = top + 'px';
    wrap.style.width = width + 'px';
    wrap.style.height = height + 'px';

    var svg = svgEl('svg', {
      class: 'trail__draw',
      width: width,
      height: height,
      viewBox: '0 0 ' + width + ' ' + height,
      'aria-hidden': 'true',
      focusable: 'false',
    });
    svg.appendChild(svgEl('path', { class: 'trail__dots', d: hopPathData(a, b, left, top) }));
    if (kind) svg.appendChild(trailMark(kind, { x: b.x - left, y: b.y - top }));
    // The slide and the SVG are moved in opposite directions to wipe the line in (see motion.css)
    var slide = document.createElement('div');
    slide.className = 'trail__slide';
    slide.appendChild(svg);
    wrap.appendChild(slide);
    return wrap;
  }

  function setupTrail() {
    var page = $('.page');
    if (!page || !$('.section__title', page)) return;

    var layer = document.createElement('div');
    layer.className = 'trail';
    layer.setAttribute('aria-hidden', 'true');
    page.insertBefore(layer, page.firstChild);

    var animate = !REDUCED && HAS_IO;
    var revealedCount = 0; // hops already shown, so a rebuild doesn't hide or replay them
    var observer = null;
    var built = { width: 0, height: 0 };

    /** Where the trail begins: on the hero's fourth ring, or just above the first heading. */
    function startPoint(titles, laneRight) {
      var orbits = $('.hero__orbits', page);
      if (orbits) {
        var box = offsetWithin(orbits, page);
        var size = orbits.offsetWidth;
        var angle = (105 * Math.PI) / 180;
        var radius = (230 / 600) * size;
        return {
          x: box.x + size / 2 + radius * Math.cos(angle),
          y: box.y + size / 2 + radius * Math.sin(angle),
        };
      }
      return { x: laneRight, y: Math.max(90, titles[0].y - 220) };
    }

    function headingPoints() {
      return $$('.section__title', page)
        .filter(function (el) {
          return el.offsetParent !== null;
        })
        .map(function (el) {
          var pos = offsetWithin(el, page);
          return { x: pos.x, y: pos.y + el.offsetHeight * 0.45 };
        });
    }

    /** Build the list of points the trail passes through, top to bottom. */
    function buildPoints(pageW, pageH) {
      var titles = headingPoints();
      if (!titles.length) return null;
      var leftmost = Math.min.apply(
        null,
        titles.map(function (t) {
          return t.x;
        }),
      );
      var laneLeft = Math.max(14, leftmost - 38);
      var laneRight = pageW - laneLeft;
      var points = [startPoint(titles, laneRight)];
      var kinds = [null];

      var hero = $('.hero', page);
      if (hero) {
        points.push({ x: pageW * 0.7, y: offsetWithin(hero, page).y + hero.offsetHeight - 30 });
        kinds.push(null);
      }

      titles.forEach(function (title, i) {
        var previous = points[points.length - 1];
        var gap = title.y - previous.y;
        // Long stretches swing out to the side margins and back, in an odd number of
        // sweeps so the trail arrives at each heading on the left.
        if (i > 0) {
          var sweeps = Math.max(1, 2 * Math.round((gap / 900 - 1) / 2) + 1);
          for (var s = 1; s <= sweeps; s++) {
            points.push({
              x: s % 2 ? laneRight : laneLeft,
              y: previous.y + (gap * s) / (sweeps + 1),
            });
            kinds.push(null);
          }
        }
        points.push({ x: Math.max(14, title.x - 38), y: title.y });
        kinds.push(i % 2 ? 'planet' : 'star');
      });

      // A last star near the foot of the page
      var footer = $('.footer', page);
      var endY = footer ? offsetWithin(footer, page).y - 40 : pageH - 80;
      var lastTitle = points[points.length - 1];
      if (endY - lastTitle.y > 160) {
        points.push({ x: laneRight, y: endY });
        kinds.push('star');
      }

      // Keep only points that move down, so every hop is a clean S-curve
      var keptPoints = [];
      var keptKinds = [];
      points.forEach(function (pt, i) {
        var last = keptPoints[keptPoints.length - 1];
        if (!last || pt.y > last.y + 24) {
          keptPoints.push(pt);
          keptKinds.push(kinds[i]);
        }
      });
      return { points: keptPoints, kinds: keptKinds };
    }

    /** Show a hop. `instant` skips the transition (hops already passed, reduced motion). */
    function revealHop(hop, instant) {
      if (hop.classList.contains('is-in')) return;
      var slide = hop.firstChild;
      var lit = false;
      function light() {
        if (lit) return;
        lit = true;
        hop.classList.add('is-lit');
      }
      if (instant) {
        hop.classList.add('is-in', 'is-lit', 'is-instant');
        return;
      }
      slide.addEventListener('transitionend', function (ev) {
        if (ev.target === slide) light();
      });
      setTimeout(light, TRAIL_REVEAL_MS + 200); // in case the event never arrives
      hop.classList.add('is-in');
    }

    function watchHops(hops) {
      if (observer) observer.disconnect();
      observer = null;
      if (!animate) {
        hops.forEach(function (hop) {
          revealHop(hop, true);
        });
        return;
      }
      hops.forEach(function (hop, i) {
        if (i < revealedCount) revealHop(hop, true);
      });
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            var above = !en.isIntersecting && en.boundingClientRect.top < 0;
            if (!en.isIntersecting && !above) return;
            observer.unobserve(en.target);
            // Hops scrolled past before they were ever seen (jumps, anchors) just appear
            revealHop(en.target, above);
            revealedCount = Math.max(revealedCount, hops.indexOf(en.target) + 1);
          });
        },
        { rootMargin: '0px 0px -22% 0px' },
      );
      hops.forEach(function (hop, i) {
        if (i >= revealedCount) observer.observe(hop);
      });
    }

    function layout() {
      var pageW = page.clientWidth;
      var pageH = page.offsetHeight;
      built.width = pageW;
      built.height = pageH;
      var plan = buildPoints(pageW, pageH);

      layer.textContent = '';
      if (!plan || plan.points.length < 2) return;

      var hops = [];
      var frag = document.createDocumentFragment();
      for (var i = 1; i < plan.points.length; i++) {
        var hop = buildHop(plan.points[i - 1], plan.points[i], plan.kinds[i]);
        hops.push(hop);
        frag.appendChild(hop);
      }
      layer.appendChild(frag);
      watchHops(hops);
    }

    /** Rebuild only when the page really changed size, and not more than a few times a second. */
    var rebuildTimer = 0;
    function scheduleRebuild() {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(function () {
        var widthChanged = page.clientWidth !== built.width;
        var heightChanged = Math.abs(page.offsetHeight - built.height) > 4;
        if (widthChanged || heightChanged) layout();
      }, 250);
    }

    layout();
    if ('ResizeObserver' in window) new ResizeObserver(scheduleRebuild).observe(page);
    else window.addEventListener('resize', scheduleRebuild, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRebuild);
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
    $$('[data-split]').forEach(function (el) {
      if (!REDUCED) splitText(el);
    });
    setupReveals();
    setupDraw();
    setupDoodles();
    setupHeroAndNav();
    setupGridBg();
    setupTilt();
    setupTrail();
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
    setTimeout(function () {
      if (!booted && !$('.loading, [data-loading]')) boot();
    }, 4000);
  });
})();
