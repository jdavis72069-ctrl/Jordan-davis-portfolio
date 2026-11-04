/*
 * project.js
 * ---------------------------------------------------------------
 * Builds a project page (project.html?p=<group>/<file>) from the
 * plain-text files in /content. Parsing and loading come from
 * js/parser.js (window.SiteText), which must be loaded first.
 *
 * Sections of this file:
 *   1. Helpers
 *   2. Page pieces (head, at-a-glance, gallery, write-up, pager)
 *   3. Not-found state
 *   4. Main flow + "content ready" signal
 */
(function () {
  'use strict';

  var T = window.SiteText;
  var esc = T.esc;

  /* =============================================================
   * 1. HELPERS
   * ============================================================= */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  /** Same hand-drawn underline paths the home page uses (viewBox 0 0 200 12). */
  var SQUIGGLES = [
    'M2 7 C 22 2, 38 11, 60 6 S 98 2, 120 7 S 164 11, 198 4',
    'M2 5 C 30 11, 50 1, 80 6 S 126 11, 150 5 S 184 3, 198 8',
    'M3 8 C 20 3, 44 10, 66 5 C 90 1, 108 10, 134 6 S 176 4, 197 7',
  ];

  /** A section heading with the hand-drawn underline motion.js draws on. */
  function sectionTitle(id, text, index) {
    return (
      '<h2 class="section__title" id="' +
      id +
      '" data-draw>' +
      esc(text) +
      '<svg class="squiggle" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="' +
      SQUIGGLES[index % SQUIGGLES.length] +
      '"/></svg></h2>'
    );
  }

  /** The "?p=" value, e.g. "yale/manta-ray-robot", or '' when missing/odd. */
  function requestedSlug() {
    var raw = new URLSearchParams(window.location.search).get('p') || '';
    return /^[\w-]+\/[\w-]+$/.test(raw.trim()) ? raw.trim() : '';
  }

  function pageUrl(slug) {
    return 'project.html?p=' + encodeURI(slug);
  }

  /** Every visible project in display order, each remembering its group. */
  function flattenProjects(data) {
    var all = [];
    data.groups.forEach(function (group) {
      if (T.isHidden(group.meta)) return;
      group.projects.forEach(function (project) {
        if (T.isHidden(project.meta)) return;
        all.push({ project: project, group: group });
      });
    });
    return all;
  }

  function setMetaDescription(text) {
    var tag = $('meta[name="description"]');
    if (tag && text) tag.setAttribute('content', text);
  }

  /** Short plain-text version of a summary for the meta description. */
  function plainSummary(summary) {
    return String(summary || '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  }

  /* =============================================================
   * 2. PAGE PIECES
   * ============================================================= */

  /** Organisation badge: logo (on a light sticker when the art is dark) or lettered name. */
  function badgeHtml(group) {
    var m = group.meta;
    var name = m.name || '';
    if (m.logo) {
      var light = (m['logo backdrop'] || '').toLowerCase() === 'light';
      return (
        '<div class="badge ' +
        (light ? 'badge--light' : 'badge--plain') +
        '"><img src="' +
        esc(T.imgUrl(m.logo)) +
        '" alt="' +
        esc(name) +
        '" decoding="async"></div>'
      );
    }
    return '<div class="badge badge--text"><span>' + esc(name) + '</span></div>';
  }

  /** Back link, group badge, title and subtitle. */
  function headHtml(entry) {
    var m = entry.project.meta;
    var group = entry.group.meta;
    var html = '<header class="project-head wrap">';
    html +=
      '<a class="back-link" href="index.html#projects" data-reveal="up">' +
      '<span aria-hidden="true">&larr;</span> All projects</a>';
    html += '<div class="project-head__group" data-reveal="up">' + badgeHtml(entry.group);
    if (group.name) html += '<span class="project-head__org">' + esc(group.name) + '</span>';
    html += '</div>';
    html +=
      '<h1 class="project-page__title" data-reveal="up">' +
      T.plain(m.title || 'Untitled project') +
      '</h1>';
    if (m.subtitle) {
      html += '<p class="project-page__subtitle" data-reveal="up">' + T.plain(m.subtitle) + '</p>';
    }
    html += '</header>';
    return html;
  }

  /** The "at a glance" box: role, team, when, where and skills. Empty rows are left out. */
  function glanceHtml(entry) {
    var m = entry.project.meta;
    var group = entry.group.meta;
    var rows = [
      ['Role', m.role],
      ['Team', m.team],
      ['When', m.when || group.dates],
      ['Where', group.location],
    ].filter(function (row) {
      return row[1];
    });
    var skills = T.splitList(m.skills);
    if (!rows.length && !skills.length) return '';

    var html =
      '<section class="project-glance wrap" aria-label="At a glance"><div class="glance" data-reveal="up">';
    html += '<p class="glance__label">At a glance</p><dl class="glance__list">';
    rows.forEach(function (row) {
      html += '<div class="glance__item"><dt>' + row[0] + '</dt><dd>' + esc(row[1]) + '</dd></div>';
    });
    html += '</dl>';
    if (skills.length) {
      html +=
        '<ul class="tags glance__tags" aria-label="Skills used">' +
        skills
          .map(function (s) {
            return '<li>' + esc(s) + '</li>';
          })
          .join('') +
        '</ul>';
    }
    return html + '</div></section>';
  }

  /**
   * Gallery of every image. Each button lists ALL the images, starting with its own,
   * so the lightbox can page through the whole set from wherever you click.
   */
  function galleryHtml(meta) {
    var images = T.splitList(meta.images);
    if (!images.length) return '';
    var captions = T.splitPipe(meta.captions);
    var baseAlt = meta['image alt'] || meta.title || 'Project image';
    var urls = images.map(T.imgUrl);

    var figures = urls
      .map(function (url, i) {
        var caption = captions[i] || '';
        var alt = caption || baseAlt;
        var ordered = urls.slice(i).concat(urls.slice(0, i));
        return (
          '<figure class="gallery__item" data-reveal="up" style="--i:' +
          Math.min(i, 5) +
          '">' +
          '<button type="button" class="media" data-lightbox data-images="' +
          esc(ordered.join('|')) +
          '" data-alt="' +
          esc(alt) +
          '" aria-haspopup="dialog">' +
          '<img class="media__img" src="' +
          esc(url) +
          '" alt="' +
          esc(alt) +
          '" ' +
          (i === 0 ? '' : 'loading="lazy" ') +
          'decoding="async"></button>' +
          (caption
            ? '<figcaption class="gallery__caption">' + T.plain(caption) + '</figcaption>'
            : '') +
          '</figure>'
        );
      })
      .join('');

    return (
      '<section class="section project-gallery" aria-labelledby="gallery-title"><div class="wrap">' +
      sectionTitle('gallery-title', images.length > 1 ? 'Gallery' : 'Picture', 0) +
      '<div class="gallery gallery--' +
      (images.length > 1 ? 'many' : 'single') +
      '">' +
      figures +
      '</div></div></section>'
    );
  }

  /** The full write-up in a comfortable reading column, plus the optional external link. */
  function storyHtml(meta, body) {
    var link = /^https?:\/\//i.test(meta.link || '') ? meta.link : '';
    if (!body && !link) return '';
    var html =
      '<section class="section project-story" aria-labelledby="story-title"><div class="wrap">' +
      sectionTitle('story-title', 'The full story', 1) +
      '<div class="story prose" data-reveal="up">' +
      T.bodyHtml(body) +
      '</div>';
    if (link) {
      html +=
        '<p class="story__link" data-reveal="up"><a class="button-link" href="' +
        esc(link) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(meta['link label'] || 'Visit project') +
        ' <span aria-hidden="true">&rarr;</span></a></p>';
    }
    return html + '</div></section>';
  }

  /** One previous/next card. */
  function pagerCard(entry, kind) {
    var isPrev = kind === 'prev';
    return (
      '<a class="pager__card pager__card--' +
      kind +
      '" href="' +
      esc(pageUrl(entry.project.slug)) +
      '" data-reveal="up" rel="' +
      kind +
      '">' +
      '<span class="pager__label">' +
      (isPrev
        ? '<span aria-hidden="true">&larr;</span> Previous project'
        : 'Next project <span aria-hidden="true">&rarr;</span>') +
      '</span>' +
      '<span class="pager__title">' +
      T.plain(entry.project.meta.title || 'Untitled project') +
      '</span>' +
      (entry.group.meta.name
        ? '<span class="pager__group">' + esc(entry.group.meta.name) + '</span>'
        : '') +
      '</a>'
    );
  }

  /** Previous / next cards; the list wraps around so there is always somewhere to go. */
  function pagerHtml(all, index) {
    if (all.length < 2) return '';
    var prev = all[(index - 1 + all.length) % all.length];
    var next = all[(index + 1) % all.length];
    var cards = pagerCard(prev, 'prev');
    if (next !== prev) cards += pagerCard(next, 'next');
    return (
      '<nav class="section project-pager" aria-label="More projects"><div class="wrap">' +
      '<div class="pager' +
      (next === prev ? ' pager--single' : '') +
      '">' +
      cards +
      '</div></div></nav>'
    );
  }

  /* =============================================================
   * 3. NOT FOUND
   * ============================================================= */

  function renderNotFound(root) {
    root.innerHTML =
      '<section class="section project-missing"><div class="wrap">' +
      '<svg class="doodle-star" style="--s: 40px; top: 18%; right: 12%" viewBox="0 0 48 48" aria-hidden="true"><use href="#star-doodle" /></svg>' +
      '<h1 class="project-page__title" data-reveal="up">Project not found</h1>' +
      '<p class="project-missing__text" data-reveal="up">I could not find that project. It may have moved, or the link might have a typo.</p>' +
      '<p data-reveal="up"><a class="button-link" href="index.html#projects"><span aria-hidden="true">&larr;</span> Back to all projects</a></p>' +
      '</div></section>';
  }

  /* =============================================================
   * 4. MAIN FLOW
   * ============================================================= */

  function renderProject(root, all, index) {
    var entry = all[index];
    var meta = entry.project.meta;
    var title = meta.title || 'Untitled project';
    var summary = meta.summary || T.firstParagraph(entry.project.body);

    setMetaDescription(plainSummary(summary));
    var ogTitle = $('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title + ' · Jordan Davis');
    var ogDesc = $('meta[property="og:description"]');
    if (ogDesc && summary) ogDesc.setAttribute('content', plainSummary(summary));

    root.innerHTML =
      '<article class="project-article">' +
      headHtml(entry) +
      glanceHtml(entry) +
      galleryHtml(meta) +
      storyHtml(meta, entry.project.body) +
      '</article>' +
      pagerHtml(all, index);
  }

  function renderFooter(site) {
    var el = $('.footer__text');
    if (el && site && site.meta.footer) el.innerHTML = T.rich(site.meta.footer);
  }

  function initNav() {
    var nav = $('#topnav');
    var btn = nav && $('.topnav__toggle', nav);
    if (!btn) return;
    function set(open) {
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      set(!nav.classList.contains('is-open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.topnav__links a')) set(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        set(false);
        btn.focus();
      }
    });
  }

  /** If an image fails to load, drop its figure instead of showing a broken icon. */
  function watchBrokenImages() {
    document.addEventListener(
      'error',
      function (ev) {
        var img = ev.target;
        if (!img || img.tagName !== 'IMG' || !img.classList.contains('media__img')) return;
        var figure = img.closest('.gallery__item');
        if (figure) figure.remove();
      },
      true,
    );
  }

  function ready() {
    var loader = $('#loader');
    if (loader) loader.remove();
    document.documentElement.classList.add('content-ready');
    document.dispatchEvent(new CustomEvent('content:ready'));
  }

  function main() {
    var root = $('#project-root');
    var slug = requestedSlug();
    return Promise.all([T.loadDoc('site.txt'), slug ? T.loadProjects() : null]).then(function (r) {
      renderFooter(r[0]);
      var all = r[1] ? flattenProjects(r[1]) : [];
      var index = all.findIndex(function (entry) {
        return entry.project.slug === slug;
      });
      if (index < 0) renderNotFound(root);
      else renderProject(root, all, index);
    });
  }

  initNav();
  watchBrokenImages();
  main()
    .catch(function (err) {
      console.error('[project] failed', err);
      renderNotFound($('#project-root'));
    })
    .then(ready);
})();
