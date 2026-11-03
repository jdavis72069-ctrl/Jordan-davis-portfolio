/*
 * content.js
 * ---------------------------------------------------------------
 * Loads the plain-text files in /content, parses them, and fills
 * the page skeleton in index.html. No libraries, no build step.
 *
 * Sections of this file:
 *   1. Tiny helpers (escaping, inline text, image URLs)
 *   2. The .txt parser (header / body / entries)
 *   3. Loading files
 *   4. Rendering (hero, about, projects, art, skills, reading, contact)
 *   5. Mobile nav toggle
 *   6. Main flow + "content ready" signal
 */
(function () {
  'use strict';

  var CONTENT_ROOT = 'content/';

  /* =============================================================
   * 1. HELPERS
   * ============================================================= */

  /** Escape text so it is safe to put into HTML (text or attribute). */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Inline text: escape HTML first, then allow only
   *   **bold**  and  [link text](https://url)
   * Links may only point to http(s) or mailto, so nothing sneaky can run.
   */
  function inline(str) {
    var out = esc(str);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, function (m, text, url) {
      var external = /^https?:/i.test(url);
      return (
        '<a href="' +
        url +
        '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        '>' +
        text +
        '</a>'
      );
    });
    return out;
  }

  /** Split "a, b, c" into ['a','b','c'], dropping empties. */
  function splitList(str) {
    return String(str || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  /** Turn a repo-relative image path into a safe URL (spaces etc. are encoded). */
  function imgUrl(path) {
    return encodeURI(
      String(path)
        .trim()
        .replace(/^\.?\//, ''),
    );
  }

  /** "Show: no" (also false / hide / hidden) hides an item. */
  function isHidden(meta) {
    return /^(no|false|hide|hidden)$/i.test(meta.show || '');
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  /** Set the --i stagger index attribute for reveal animations. */
  function stagger(i) {
    return ' style="--i:' + i + '"';
  }

  /* =============================================================
   * 2. PARSER
   * ============================================================= */

  var HEADER_RE = /^([A-Za-z][A-Za-z ]*):\s*(.*)$/;

  /** Normalise newlines, drop BOM, remove "#" comment lines. */
  function clean(text) {
    return String(text)
      .replace(/^﻿/, '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter(function (line) {
        return !/^\s*#/.test(line);
      })
      .join('\n');
  }

  /**
   * Parse one block of (already cleaned) text into { meta, body }.
   * meta keys are lower-cased; body is the text after the header.
   */
  function parseBlock(text) {
    var lines = text.split('\n');
    var i = 0;
    var meta = {};
    while (i < lines.length && lines[i].trim() === '') i++; // skip leading blanks
    while (i < lines.length) {
      // header lines
      var m = HEADER_RE.exec(lines[i]);
      if (!m) break;
      meta[m[1].trim().toLowerCase()] = m[2].trim();
      i++;
    }
    return { meta: meta, body: lines.slice(i).join('\n').trim() };
  }

  /** Parse a whole file with a single entry. */
  function parseDoc(text) {
    return parseBlock(clean(text));
  }

  /** Parse a file whose entries are separated by a line that is exactly "---". */
  function parseEntries(text) {
    return clean(text)
      .split(/^[ \t]*---[ \t]*$/m)
      .map(parseBlock);
  }

  /**
   * Body text -> blocks: [{type:'p', text}] and [{type:'ul', items:[]}].
   * Blank line = new paragraph; consecutive "- " lines = one list.
   */
  function parseBody(body) {
    var blocks = [];
    var para = [];
    var list = null;
    function flushPara() {
      if (para.length) {
        blocks.push({ type: 'p', text: para.join(' ') });
        para = [];
      }
    }
    function flushList() {
      if (list) {
        blocks.push({ type: 'ul', items: list });
        list = null;
      }
    }
    String(body || '')
      .split('\n')
      .forEach(function (raw) {
        var line = raw.trim();
        if (line === '') {
          flushPara();
          flushList();
          return;
        }
        var bullet = /^-\s+(.*)$/.exec(line);
        if (bullet) {
          flushPara();
          (list = list || []).push(bullet[1]);
        } else {
          flushList();
          para.push(line);
        }
      });
    flushPara();
    flushList();
    return blocks;
  }

  /** Body text -> HTML string of <p> and <ul>. */
  function bodyHtml(body) {
    return parseBody(body)
      .map(function (b) {
        if (b.type === 'ul') {
          return (
            '<ul>' +
            b.items
              .map(function (t) {
                return '<li>' + inline(t) + '</li>';
              })
              .join('') +
            '</ul>'
          );
        }
        return '<p>' + inline(b.text) + '</p>';
      })
      .join('');
  }

  /** Body text where each non-empty line is a file path (project lists). */
  function bodyLines(body) {
    return String(body || '')
      .split('\n')
      .map(function (l) {
        return l.trim().replace(/^-\s+/, '');
      })
      .filter(Boolean);
  }

  /* =============================================================
   * 3. LOADING
   * ============================================================= */

  /** Fetch a file under content/. Resolves to text, or null (with a warning). */
  function fetchText(rel) {
    return fetch(CONTENT_ROOT + encodeURI(rel), { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .catch(function (err) {
        console.warn('[content] Could not load "' + rel + '": ' + err.message);
        return null;
      });
  }

  function loadDoc(rel) {
    return fetchText(rel).then(function (t) {
      return t == null ? null : parseDoc(t);
    });
  }

  function loadEntries(rel) {
    return fetchText(rel).then(function (t) {
      return t == null ? null : parseEntries(t);
    });
  }

  /** Load projects.txt, every group file, and every project file (all in parallel). */
  function loadProjects() {
    return loadDoc('projects.txt').then(function (doc) {
      if (!doc) return null;
      var groupFiles = bodyLines(doc.body);
      return Promise.all(
        groupFiles.map(function (gf) {
          return loadDoc('projects/' + gf).then(function (group) {
            if (!group) return null;
            return Promise.all(
              bodyLines(group.body).map(function (pf) {
                return loadDoc('projects/' + pf);
              }),
            ).then(function (projects) {
              group.projects = projects.filter(Boolean);
              return group;
            });
          });
        }),
      ).then(function (groups) {
        return { doc: doc, groups: groups.filter(Boolean) };
      });
    });
  }

  /* =============================================================
   * 4. RENDERING
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
      el.innerHTML = inline(text);
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
   */
  function mediaHtml(images, alt, placeholderLabel) {
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
    return (
      '<button type="button" class="media" data-lightbox data-images="' +
      esc(urls.join('|')) +
      '" data-alt="' +
      esc(alt) +
      '" aria-haspopup="dialog">' +
      '<img class="media__img" src="' +
      esc(urls[0]) +
      '" alt="' +
      esc(alt) +
      '" loading="lazy" decoding="async">' +
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
      document.title = m.name + (m.tagline ? ' | ' + m.tagline : ' | Portfolio');
    }
    var tag = $('.hero__tagline');
    var sub = $('.hero__subtitle');
    tag.textContent = m.tagline || '';
    tag.hidden = !m.tagline;
    sub.textContent = m.subtitle || '';
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
    var html =
      '<article class="project project--' +
      (layout === 'rows' ? 'row' : 'card') +
      '" data-reveal="up"' +
      stagger(index) +
      '>';
    html +=
      '<div class="project__media">' +
      mediaHtml(images, alt, 'Project image coming soon') +
      '</div>';
    html += '<div class="project__body">';
    html += '<h3 class="project__title">' + esc(title) + '</h3>';
    if (m.subtitle) html += '<p class="project__subtitle">' + esc(m.subtitle) + '</p>';
    if (doc.body) html += '<div class="prose">' + bodyHtml(doc.body) + '</div>';
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
    if (/^https?:\/\//i.test(m.link || '')) {
      html +=
        '<a class="project__link" href="' +
        esc(m.link) +
        '" target="_blank" rel="noopener noreferrer">View project <span aria-hidden="true">&rarr;</span></a>';
    }
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
   * 5. NAV (mobile toggle)
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
   * 6. MAIN FLOW
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
