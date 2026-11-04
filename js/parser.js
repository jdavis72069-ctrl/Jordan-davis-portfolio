/*
 * parser.js
 * ---------------------------------------------------------------
 * Everything the site needs to read its plain-text content files:
 * the .txt parser, inline formatting, loading helpers and the
 * project loader. Shared by the home page (js/content.js) and the
 * project pages (js/project.js). Exposes one global: window.SiteText.
 *
 * Sections of this file:
 *   1. Escaping, inline text and small helpers
 *   2. Widow prevention
 *   3. The .txt parser (header / body / entries)
 *   4. Loading files and projects
 */
(function () {
  'use strict';

  var CONTENT_ROOT = 'content/';

  /* =============================================================
   * 1. ESCAPING, INLINE TEXT, SMALL HELPERS
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

  /** Split "one | two | three" (used for image captions), keeping empty slots. */
  function splitPipe(str) {
    return String(str || '')
      .split('|')
      .map(function (s) {
        return s.trim();
      });
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
    return /^(no|false|hide|hidden)$/i.test((meta && meta.show) || '');
  }

  /* =============================================================
   * 2. WIDOW PREVENTION
   * ============================================================= */

  var NBSP = '&nbsp;';
  var MAX_LAST_WORD = 14;
  var MIN_WORDS = 4;

  /** Visible length of a piece of escaped text ("&amp;" counts as one character). */
  function visibleLength(s) {
    return s.replace(/&#?\w+;/g, 'x').length;
  }

  /**
   * Keep the last two words of a text together so a short word never sits
   * alone on the final line. Takes finished HTML (already escaped), and only
   * ever touches the text between tags, so tags, attributes and URLs stay intact.
   * Texts with fewer than four words, or a very long last word, are left alone.
   */
  function noWidow(html) {
    var source = String(html == null ? '' : html);
    // Even indexes are text, odd indexes are tags.
    var parts = source.split(/(<[^>]*>)/);

    var texts = []; // indexes of text parts that contain something visible
    var wordCount = 0;
    parts.forEach(function (part, i) {
      if (i % 2 === 1 || !/\S/.test(part)) return;
      texts.push(i);
      wordCount += part.trim().split(/\s+/).length;
    });
    if (wordCount < MIN_WORDS || !texts.length) return source;

    var last = texts[texts.length - 1];
    var tail = /^([\s\S]*?)(\s+)(\S+)(\s*)$/.exec(parts[last]);
    if (tail) {
      // The last two words live in the same text node.
      if (visibleLength(tail[3]) > MAX_LAST_WORD) return source;
      parts[last] = tail[1] + NBSP + tail[3] + tail[4];
      return parts.join('');
    }

    // The last word stands alone (e.g. it is bold): glue it to the text before it.
    var word = parts[last].trim();
    var prev = texts.length > 1 ? texts[texts.length - 2] : -1;
    if (prev < 0 || visibleLength(word) > MAX_LAST_WORD) return source;
    var gap = /\s+$/.exec(parts[prev]);
    var leading = /^\s+/.test(parts[last]);
    if (gap) {
      parts[prev] = parts[prev].slice(0, gap.index) + NBSP;
    } else if (leading) {
      parts[last] = NBSP + parts[last].replace(/^\s+/, '');
    }
    return parts.join('');
  }

  /** Escape plain text and apply widow prevention (titles, taglines, summaries). */
  function plain(str) {
    return noWidow(esc(str));
  }

  /** Inline formatting plus widow prevention (paragraph-like text). */
  function rich(str) {
    return noWidow(inline(str));
  }

  /* =============================================================
   * 3. PARSER
   * ============================================================= */

  var HEADER_RE = /^([A-Za-z][A-Za-z ]*):\s*(.*)$/;
  var HEADING_RE = /^##\s+(\S.*)$/;

  /**
   * Normalise newlines, drop BOM, remove "#" comment lines.
   * A line starting with "## " is kept: in a body it is a sub-heading.
   */
  function clean(text) {
    return String(text)
      .replace(/^﻿/, '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter(function (line) {
        return !/^\s*#/.test(line) || HEADING_RE.test(line.trim());
      })
      .join('\n');
  }

  /**
   * Parse one block of (already cleaned) text into { meta, body }.
   * meta keys are lower-cased; body is the text after the header.
   * While the header is being read, "## " lines count as comments.
   */
  function parseBlock(text) {
    var lines = text.split('\n');
    var i = 0;
    var meta = {};
    function skipComment() {
      return i < lines.length && HEADING_RE.test(lines[i].trim());
    }
    while (i < lines.length && (lines[i].trim() === '' || skipComment())) i++; // leading blanks
    while (i < lines.length) {
      if (skipComment()) {
        i++;
        continue;
      }
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
   * Body text -> blocks: {type:'p', text}, {type:'h', text} and {type:'ul', items}.
   * Blank line = new paragraph; consecutive "- " lines = one list; "## " = sub-heading.
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
        var heading = HEADING_RE.exec(line);
        if (heading) {
          flushPara();
          flushList();
          blocks.push({ type: 'h', text: heading[1].trim() });
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

  /** Body text -> HTML string of <p>, <ul> and <h3 class="body__heading">. */
  function bodyHtml(body) {
    return parseBody(body)
      .map(function (b) {
        if (b.type === 'h') return '<h3 class="body__heading">' + rich(b.text) + '</h3>';
        if (b.type === 'ul') {
          return (
            '<ul>' +
            b.items
              .map(function (t) {
                return '<li>' + rich(t) + '</li>';
              })
              .join('') +
            '</ul>'
          );
        }
        return '<p>' + rich(b.text) + '</p>';
      })
      .join('');
  }

  /** The first paragraph of a body as plain text (fallback summary). */
  function firstParagraph(body) {
    var blocks = parseBody(body);
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].type === 'p') return blocks[i].text;
    }
    return '';
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
   * 4. LOADING
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

  /** "yale/manta-ray-robot.txt" -> "yale/manta-ray-robot" (the id used in project.html?p=...). */
  function slugOf(path) {
    return path
      .trim()
      .replace(/^\.?\//, '')
      .replace(/\.txt$/i, '');
  }

  /**
   * Load projects.txt, every group file, and every project file (all in parallel).
   * Resolves to { doc, groups }; each group has `.projects`, and each project
   * has a `.slug` such as "yale/manta-ray-robot".
   */
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
                return loadDoc('projects/' + pf).then(function (project) {
                  if (project) project.slug = slugOf(pf);
                  return project;
                });
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

  window.SiteText = {
    esc: esc,
    inline: inline,
    plain: plain,
    rich: rich,
    noWidow: noWidow,
    bodyHtml: bodyHtml,
    firstParagraph: firstParagraph,
    parseDoc: parseDoc,
    parseEntries: parseEntries,
    splitList: splitList,
    splitPipe: splitPipe,
    imgUrl: imgUrl,
    isHidden: isHidden,
    fetchText: fetchText,
    loadDoc: loadDoc,
    loadEntries: loadEntries,
    loadProjects: loadProjects,
  };
})();
