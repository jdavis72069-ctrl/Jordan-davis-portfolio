/*
 * content.js
 * ---------------------------------------------------------------
 * Fills the home page skeleton in index.html from the plain-text
 * files in /content. Parsing and loading live in js/parser.js
 * (window.SiteText), which must be loaded first.
 *
 * Sections of this file:
 *   1. Tiny helpers
 *   2. Rendering (hero, about, projects, art, skills, reading, contact)
 *   3. Mobile nav toggle
 *   4. Main flow + "content ready" signal
 */
(function () {
  'use strict';

  var T = window.SiteText;
  var esc = T.esc;
  var inline = T.inline;
  var plain = T.plain;
  var splitList = T.splitList;
  var imgUrl = T.imgUrl;
  var isHidden = T.isHidden;
  var bodyHtml = T.bodyHtml;
  var loadDoc = T.loadDoc;
  var loadEntries = T.loadEntries;
  var loadProjects = T.loadProjects;

  /* =============================================================
   * 1. HELPERS
   * ============================================================= */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  /** Set the --i stagger index attribute for reveal animations. */
  function stagger(i) {
    return ' style="--i:' + i + '"';
  }

  /* =============================================================
   * 2. RENDERING
   * ============================================================= */

  /* A few slightly different hand-drawn underline paths (viewBox 0 0 200 12). */
  var SQUIGGLES = [
    'M2 7 C 22 2, 38 11, 60 6 S 98 2, 120 7 S 164 11, 198 4',
    'M2 5 C 30 11, 50 1, 80 6 S 126 11, 150 5 S 184 3, 198 8',
    'M3 8 C 20 3, 44 10, 66 5 C 90 1, 108 10, 134 6 S 176 4, 197 7',
    'M2 6 C 18 10, 36 2, 62 7 S 106 10, 128 4 S 170 9, 198 5',
  ];
  var squiggleCount = 0;

  /** Set a section title's text and append the hand-drawn underline. */
  function setTitle(el, text) {
    if (!el) return;
    if (text) el.textContent = text;
    var old = $('.squiggle', el);
    if (old) old.remove();
    var path = SQUIGGLES[squiggleCount++ % SQUIGGLES.length];
    el.insertAdjacentHTML(
      'beforeend',
      '<svg class="squiggle" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="' +
        path +
        '"/></svg>',
    );
  }

  /** Fill an intro paragraph, or hide it when empty. */
  function setIntro(el, text) {
    if (!el) return;
    if (text) {
      el.innerHTML = T.rich(text);
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  /** Hide a whole section (and its nav link) when its content is missing/disabled. */
  function hideSection(id) {
    var sec = document.getElementById(id);
    if (sec) sec.hidden = true;
    var link = $('.topnav a[href="#' + id + '"]');
    if (link && link.parentNode) link.parentNode.hidden = true;
  }

  /** Small decorative doodle used where there is no image yet. */
  function placeholderHtml(label, extraClass) {
    return (
      '<div class="media media--placeholder ' +
      (extraClass || '') +
      '" role="img" aria-label="' +
      esc(label) +
      '">' +
      '<svg class="placeholder__doodle" viewBox="0 0 200 150" aria-hidden="true" focusable="false">' +
      '<ellipse cx="100" cy="78" rx="78" ry="30" transform="rotate(-18 100 78)"/>' +
      '<ellipse cx="100" cy="78" rx="52" ry="18" transform="rotate(-18 100 78)" stroke-dasharray="4 6"/>' +
      '<circle cx="168" cy="58" r="4" class="dot"/>' +
      '<g class="placeholder__star"><use href="#star-doodle" x="76" y="52" width="48" height="48"/></g>' +
      '<path d="M28 28 l0 10 M23 33 l10 0" /><path d="M170 120 l0 8 M166 124 l8 0"/>' +
      '</svg>' +
      '<span class="placeholder__label">coming soon</span>' +
      '</div>'
    );
  }

  /**
   * Image button (opens the lightbox) or a placeholder when there are no images.
   * images: array of repo-relative paths.
   * staticFrame: render a plain, non-interactive frame (no lightbox button) so a click
   * on it falls through to the stretched card link underneath.
   */
  function mediaHtml(images, alt, placeholderLabel, staticFrame) {
    if (!images.length) return placeholderHtml(placeholderLabel || 'Image coming soon');
    var urls = images.map(imgUrl);
    var more = urls.length - 1;
    var badge =
      more > 0
        ? '<span class="media__count" aria-hidden="true">+' +
          more +
          ' photo' +
          (more > 1 ? 's' : '') +
          '</span>'
        : '';
    var img =
      '<img class="media__img" src="' +
      esc(urls[0]) +
      '" alt="' +
      esc(alt) +
      '" loading="lazy" decoding="async">';
    if (staticFrame) return '<div class="media">' + img + badge + '</div>';
    return (
      '<button type="button" class="media" data-lightbox data-images="' +
      esc(urls.join('|')) +
      '" data-alt="' +
      esc(alt) +
      '" aria-haspopup="dialog">' +
      img +
      badge +
      '</button>'
    );
  }

  /* ---------- Site (hero, title, footer) ---------- */
  function renderSite(doc) {
    if (!doc) return;
    var m = doc.meta;
    if (m.name) {
      var words = m.name.trim().split(/\s+/);
      $('.hero__name').innerHTML = words
        .map(function (w) {
          return '<span class="hero__line">' + esc(w.toUpperCase()) + '</span>';
        })
        .join('');
      // The browser tab shows just the name, next to the star icon.
      document.title = m.name;
    }
    var tag = $('.hero__tagline');
    var sub = $('.hero__subtitle');
    tag.innerHTML = plain(m.tagline);
    tag.hidden = !m.tagline;
    sub.innerHTML = plain(m.subtitle);
    sub.hidden = !m.subtitle;
    if (m.footer) $('.footer__text').innerHTML = inline(m.footer);
    // Location is shown in the contact section (see renderContact).
    renderSite.location = m.location || '';
  }

  /* ---------- About ---------- */
  function renderAbout(doc) {
    if (!doc || isHidden(doc.meta)) return hideSection('about');
    var m = doc.meta;
    setTitle($('#about-title'), m.heading || 'About');
    $('#about .prose').innerHTML = bodyHtml(doc.body);
    var fig = $('#about .about__photo');
    if (m.photo) {
      fig.innerHTML =
        '<img class="media__img" src="' +
        esc(imgUrl(m.photo)) +
        '" alt="' +
        esc(m['photo alt'] || 'Portrait of Jordan Davis') +
        '" decoding="async">';
    } else {
      fig.innerHTML = placeholderHtml('Photo coming soon');
    }
  }

  /* ---------- Projects ---------- */
  function projectHtml(doc, layout, index) {
    var m = doc.meta;
    var images = splitList(m.images);
    var skills = splitList(m.skills);
    var title = m.title || 'Untitled project';
    var alt = m['image alt'] || title;
    var pageUrl = 'project.html?p=' + encodeURI(doc.slug);
    var html =
      '<article class="project project--' +
      (layout === 'rows' ? 'row' : 'card') +
      '" data-reveal="up"' +
      stagger(index) +
      '>';
    html +=
      '<div class="project__media">' +
      mediaHtml(images, alt, 'Project image coming soon', true) +
      '</div>';
    html += '<div class="project__body">';
    html +=
      '<h3 class="project__title"><a class="project__link" href="' +
      esc(pageUrl) +
      '">' +
      plain(title) +
      '</a></h3>';
    if (m.subtitle) html += '<p class="project__subtitle">' + plain(m.subtitle) + '</p>';
    // The card only teases the project; the full write-up lives on its own page.
    var summary = m.summary || T.firstParagraph(doc.body);
    if (summary) html += '<p class="project__summary">' + T.rich(summary) + '</p>';
    if (skills.length) {
      html +=
        '<ul class="tags" aria-label="Skills used">' +
        skills
          .map(function (s) {
            return '<li>' + esc(s) + '</li>';
          })
          .join('') +
        '</ul>';
    }
    // Visual cue only: the title link above is stretched over the whole card, so this
    // is not a second link (hidden from assistive tech, not a tab stop).
    html += '<span class="project__more" aria-hidden="true">Read the full story</span>';
    html += '</div></article>';
    return html;
  }

  function groupHtml(group) {
    var m = group.meta;
    var name = m.name || '';
    var layout = (m.layout || 'cards').toLowerCase() === 'rows' ? 'rows' : 'cards';

    // Badge: logo (on a light sticker when the artwork is dark) or hand-lettered name.
    var badge;
    if (m.logo) {
      var light = (m['logo backdrop'] || '').toLowerCase() === 'light';
      badge =
        '<div class="badge ' +
        (light ? 'badge--light' : 'badge--plain') +
        '">' +
        '<img src="' +
        esc(imgUrl(m.logo)) +
        '" alt="' +
        esc(name) +
        '" decoding="async"></div>';
    } else {
      badge = '<div class="badge badge--text"><span>' + esc(name) + '</span></div>';
    }

    var meta = [];
    if (m.role) meta.push('<span class="group__role">' + esc(m.role) + '</span>');
    if (m.dates) meta.push('<span>' + esc(m.dates) + '</span>');
    if (m.location) meta.push('<span>' + esc(m.location) + '</span>');

    var items = group.projects.filter(function (p) {
      return !isHidden(p.meta);
    });

    return (
      '<div class="group group--' +
      layout +
      '">' +
      '<header class="group__head" data-reveal="up">' +
      badge +
      (meta.length ? '<p class="group__meta">' + meta.join('') + '</p>' : '') +
      '</header>' +
      '<div class="group__items group__items--' +
      layout +
      '">' +
      items
        .map(function (p, i) {
          return projectHtml(p, layout, i);
        })
        .join('') +
      '</div></div>'
    );
  }

  function renderProjects(data) {
    if (!data || isHidden(data.doc.meta)) return hideSection('projects');
    setTitle($('#projects-title'), data.doc.meta.heading || 'Projects');
    setIntro($('#projects .section__intro'), data.doc.meta.intro);
    $('#projects .groups').innerHTML = data.groups
      .filter(function (g) {
        return !isHidden(g.meta);
      })
      .map(groupHtml)
      .join('');
  }

  /* ---------- Art ---------- */
  var ART_ROTATIONS = ['-2.6deg', '1.8deg', '-1.2deg', '2.4deg'];

  function renderArt(entries) {
    if (!entries) return hideSection('art');
    var head = entries.filter(function (e) {
      return e.meta.heading || e.meta.intro;
    })[0] || { meta: {} };
    if (isHidden(head.meta)) return hideSection('art');
    setTitle($('#art-title'), head.meta.heading || 'Art');
    setIntro($('#art .section__intro'), head.meta.intro);

    // An entry is an artwork when it has an Image or Title key.
    var pieces = entries.filter(function (e) {
      return ('image' in e.meta || 'title' in e.meta) && !isHidden(e.meta);
    });
    $('#art .art-grid').innerHTML = pieces
      .map(function (e, i) {
        var m = e.meta;
        var title = m.title || '';
        var alt = m['image alt'] || title || 'Artwork by Jordan Davis';
        var sub = [m.medium, m.year].filter(Boolean).join(' · ');
        return (
          '<figure class="art">' +
          '<div class="art__frame" data-reveal="tilt" style="--i:' +
          i +
          ';--art-rot:' +
          ART_ROTATIONS[i % ART_ROTATIONS.length] +
          '">' +
          '<span class="art__pin" aria-hidden="true"></span>' +
          mediaHtml(m.image ? [m.image] : [], alt, 'Artwork coming soon') +
          '</div>' +
          '<figcaption class="art__caption">' +
          (title ? '<span class="art__title">' + esc(title) + '</span>' : '') +
          (sub ? '<span class="art__sub">' + esc(sub) + '</span>' : '') +
          (e.body
            ? '<span class="art__text">' + inline(e.body.replace(/\n+/g, ' ')) + '</span>'
            : '') +
          '</figcaption></figure>'
        );
      })
      .join('');
  }

  /* ---------- Skills ---------- */
  function renderSkills(entries) {
    if (!entries) return hideSection('skills');
    var head = entries.filter(function (e) {
      return e.meta.heading || e.meta.intro;
    })[0] || { meta: {} };
    if (isHidden(head.meta)) return hideSection('skills');
    setTitle($('#skills-title'), head.meta.heading || 'Skills');
    setIntro($('#skills .section__intro'), head.meta.intro);

    var cats = entries.filter(function (e) {
      return e.meta.category && !isHidden(e.meta);
    });
    $('#skills .skills-grid').innerHTML = cats
      .map(function (e, i) {
        return (
          '<div class="skill-col" data-reveal="up"' +
          stagger(i) +
          '>' +
          '<h3 class="skill-col__title">' +
          esc(e.meta.category) +
          '</h3>' +
          '<div class="skill-col__list">' +
          bodyHtml(e.body) +
          '</div></div>'
        );
      })
      .join('');
  }

  /* ---------- Currently reading ---------- */
  function bookHtml(m) {
    var title = m.title || '';
    var author = m.author || '';
    if (m.cover) {
      return (
        '<div class="book book--image"><img class="media__img" src="' +
        esc(imgUrl(m.cover)) +
        '" alt="' +
        esc(title ? 'Cover of ' + title : 'Book cover') +
        '" decoding="async"></div>'
      );
    }
    return (
      '<div class="book" role="img" aria-label="' +
      esc(title + (author ? ' by ' + author : '')) +
      '">' +
      '<div class="book__cover" aria-hidden="true">' +
      '<svg class="book__star" viewBox="0 0 48 48"><use href="#star-doodle"/></svg>' +
      (title
        ? '<span class="book__title">' + esc(title) + '</span>'
        : '<span class="book__soon">next read<br>coming soon</span>') +
      (author ? '<span class="book__author">' + esc(author) + '</span>' : '') +
      '</div></div>'
    );
  }

  function renderReading(doc) {
    if (!doc || isHidden(doc.meta)) return hideSection('reading');
    var m = doc.meta;
    setTitle($('#reading-title'), m.heading || 'Currently reading');
    $('#reading .reading__book').innerHTML = bookHtml(m);
    var meta = $('#reading .reading__meta');
    if (m.title) {
      meta.innerHTML =
        '<span class="reading__title">' +
        esc(m.title) +
        '</span>' +
        (m.author ? ' <span class="reading__author">by ' + esc(m.author) + '</span>' : '');
      meta.hidden = false;
    } else {
      meta.hidden = true;
    }
    $('#reading .prose').innerHTML =
      doc.body || m.title
        ? bodyHtml(doc.body)
        : '<p class="reading__soon">Picking the next one. Check back soon.</p>';
  }

  /* ---------- Contact ---------- */
  function renderContact(doc) {
    if (!doc || isHidden(doc.meta)) return hideSection('contact');
    var m = doc.meta;
    setTitle($('#contact-title'), m.heading || 'Contact');

    var invite = $('#contact .contact__invite');
    invite.innerHTML = bodyHtml(doc.body);
    invite.hidden = !doc.body;

    var email = $('#contact .contact__email');
    if (m.email) {
      email.textContent = m.email;
      email.href = 'mailto:' + m.email;
      email.hidden = false;
    } else {
      email.hidden = true;
    }

    var links = [];
    if (/^https?:\/\//i.test(m.linkedin || '')) {
      links.push(
        '<li><a href="' +
          esc(m.linkedin) +
          '" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>',
      );
    }
    if (m.resume) {
      links.push(
        '<li><a href="' +
          esc(imgUrl(m.resume)) +
          '" target="_blank" rel="noopener noreferrer">Résumé (PDF)</a></li>',
      );
    }
    var ul = $('#contact .contact__links');
    ul.innerHTML = links.join('');
    ul.hidden = !links.length;

    var loc = $('#contact .contact__location');
    loc.textContent = renderSite.location || '';
    loc.hidden = !renderSite.location;
  }

  /* ---------- Errors / images ---------- */
  function showLoadError() {
    var note = document.createElement('div');
    note.className = 'load-error';
    note.setAttribute('role', 'alert');
    note.innerHTML =
      '<strong>The page text could not be loaded.</strong> ' +
      'This site reads its text from files, so it has to be opened from its website (GitHub Pages) ' +
      'or a local server rather than by double-clicking <code>index.html</code>. ' +
      'To preview it on your computer, run <code>python3 -m http.server</code> in this folder ' +
      'and open <code>http://localhost:8000</code>.';
    $('#main').insertBefore(note, $('#main').firstChild);
  }

  /** If a project/art/cover image fails to load, swap in the doodle placeholder. */
  function watchBrokenImages() {
    document.addEventListener(
      'error',
      function (ev) {
        var img = ev.target;
        if (!img || img.tagName !== 'IMG' || !img.classList.contains('media__img')) return;
        var holder = img.closest('.media') || img;
        holder.outerHTML = placeholderHtml('Image unavailable');
      },
      true,
    );
  }

  /* =============================================================
   * 3. NAV (mobile toggle)
   * ============================================================= */
  function initNav() {
    var nav = $('#topnav');
    var btn = $('.topnav__toggle', nav);
    if (!nav || !btn) return;
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

  /* =============================================================
   * 4. MAIN FLOW
   * ============================================================= */

  /** Run one render step; a failure in one section never breaks the others. */
  function safe(fn, arg) {
    try {
      fn(arg);
    } catch (err) {
      console.error('[content] render error in ' + fn.name, err);
    }
  }

  function ready() {
    var loader = $('#loader');
    if (loader) loader.remove();
    document.documentElement.classList.add('content-ready');
    document.dispatchEvent(new CustomEvent('content:ready'));
  }

  function main() {
    return Promise.all([
      loadDoc('site.txt'),
      loadDoc('about.txt'),
      loadProjects(),
      loadEntries('art.txt'),
      loadEntries('skills.txt'),
      loadDoc('reading.txt'),
      loadDoc('contact.txt'),
    ]).then(function (r) {
      // Nothing loaded at all: most likely opened via file://
      if (
        r.every(function (x) {
          return !x;
        })
      ) {
        showLoadError();
        return;
      }
      // Render in page order. Site first (contact uses its Location value).
      safe(renderSite, r[0]);
      safe(renderAbout, r[1]);
      safe(renderProjects, r[2]);
      safe(renderArt, r[3]);
      safe(renderSkills, r[4]);
      safe(renderReading, r[5]);
      safe(renderContact, r[6]);
    });
  }

  initNav();
  watchBrokenImages();
  main()
    .catch(function (err) {
      console.error('[content] failed', err);
      showLoadError();
    })
    .then(ready);
})();
