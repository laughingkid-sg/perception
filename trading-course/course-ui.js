(function initialiseCourseUI(global) {
  'use strict';

  const chartPageIds = [
    'lesson-03',
    'lesson-06',
    'lesson-07',
    'lesson-12',
    'lesson-13',
    'lesson-18',
    'lesson-21',
  ];

  const chartDefinitions = {
    'lesson-03': {
      title: 'One daily bar, two possible intraday paths',
      caption:
        'Both paths share the same open, high, low and close. Daily OHLC data cannot tell you which level was touched first.',
      svg: `<svg viewBox="0 0 760 310" role="img" aria-labelledby="chart-lesson-03-title chart-lesson-03-desc">
        <title id="chart-lesson-03-title">Two price paths with identical daily OHLC values</title>
        <desc id="chart-lesson-03-desc">The first path rises to the high before falling to the low. The second falls to the low before rising to the high. Both open at 100 and close at 104.</desc>
        <line class="chart-grid" x1="70" y1="65" x2="710" y2="65"/><line class="chart-grid" x1="70" y1="145" x2="710" y2="145"/><line class="chart-grid" x1="70" y1="225" x2="710" y2="225"/>
        <line class="chart-axis" x1="70" y1="35" x2="70" y2="255"/><line class="chart-axis" x1="70" y1="255" x2="710" y2="255"/>
        <text class="chart-label--small" x="26" y="70">High</text><text class="chart-label--small" x="20" y="150">Open</text><text class="chart-label--small" x="29" y="230">Low</text>
        <polyline class="chart-price" points="95,145 225,65 410,225 675,115"/><polyline class="chart-price chart-price--secondary" points="95,145 250,225 455,65 675,115"/>
        <circle class="chart-dot" cx="95" cy="145" r="6"/><circle class="chart-dot" cx="675" cy="115" r="6"/>
        <text class="chart-label--accent" x="170" y="48">Path A: high first</text><text class="chart-label" x="400" y="286">Path B: low first</text>
      </svg>`,
    },
    'lesson-06': {
      title: 'A pivot exists only after confirmation',
      caption:
        'The apparent swing high at bar 4 is not known on bar 4. Waiting for the two following bars prevents a hindsight-only label.',
      svg: `<svg viewBox="0 0 760 310" role="img" aria-labelledby="chart-lesson-06-title chart-lesson-06-desc">
        <title id="chart-lesson-06-title">A price series illustrating pivot confirmation</title><desc id="chart-lesson-06-desc">Prices rise to bar four, then two lower bars confirm bar four as a swing high.</desc>
        <line class="chart-axis" x1="65" y1="260" x2="710" y2="260"/><line class="chart-axis" x1="65" y1="35" x2="65" y2="260"/>
        <polyline class="chart-price" points="90,225 180,190 270,130 360,65 450,105 540,145 630,115 700,155"/>
        <line class="chart-guide" x1="360" y1="65" x2="360" y2="260"/><circle class="chart-dot" cx="360" cy="65" r="7"/>
        <path class="chart-guide" d="M365 48 C430 18, 515 25, 545 115"/><text class="chart-label--warn" x="398" y="48">not yet known</text>
        <rect class="chart-zone" x="438" y="180" width="115" height="42" rx="7"/><text class="chart-label--accent" x="451" y="206">confirmed</text>
        <text class="chart-label--small" x="341" y="284">bar 4</text><text class="chart-label--small" x="522" y="284">bar 6</text>
      </svg>`,
    },
    'lesson-07': {
      title: 'A zone needs an explicit invalidation level',
      caption:
        'Support is treated as an area, not a magic line. The stop belongs beyond the stated invalidation point, while prior resistance frames the potential reward.',
      svg: `<svg viewBox="0 0 760 310" role="img" aria-labelledby="chart-lesson-07-title chart-lesson-07-desc">
        <title id="chart-lesson-07-title">Support zone, entry, stop and resistance</title><desc id="chart-lesson-07-desc">A synthetic price path pulls back into a support zone and rebounds toward resistance. A dashed stop lies beneath the support zone.</desc>
        <rect class="chart-warn-zone" x="70" y="48" width="640" height="35"/><text class="chart-label--warn" x="82" y="71">prior resistance / target area</text>
        <rect class="chart-zone" x="70" y="185" width="640" height="44"/><text class="chart-label--accent" x="82" y="212">support zone</text>
        <line class="chart-stop" x1="70" y1="255" x2="710" y2="255"/><text class="chart-label--warn" x="585" y="248">invalidation / stop</text>
        <polyline class="chart-price" points="85,145 175,105 270,78 360,122 445,201 520,172 610,104 695,68"/><circle class="chart-dot" cx="445" cy="201" r="7"/>
        <text class="chart-label" x="420" y="176">candidate entry</text>
      </svg>`,
    },
    'lesson-12': {
      title: 'Trend-pullback setup: signal, risk and target',
      caption:
        'A rising trend alone is not an entry. This diagram separates the pullback, confirmation signal, fixed initial stop and predeclared target.',
      svg: `<svg viewBox="0 0 760 310" role="img" aria-labelledby="chart-lesson-12-title chart-lesson-12-desc">
        <title id="chart-lesson-12-title">Synthetic trend pullback trade plan</title><desc id="chart-lesson-12-desc">An uptrend pulls back to a rising guide, rebounds at the signal, and moves toward a target. The stop is below the pullback low.</desc>
        <line class="chart-guide" x1="85" y1="240" x2="690" y2="95"/><polyline class="chart-price" points="85,225 165,165 245,190 330,115 420,180 490,145 570,92 665,55"/>
        <circle class="chart-dot" cx="490" cy="145" r="7"/><line class="chart-stop" x1="410" y1="215" x2="700" y2="215"/><line class="chart-guide" x1="490" y1="70" x2="700" y2="70"/>
        <text class="chart-label--accent" x="500" y="137">confirmation / entry</text><text class="chart-label--warn" x="585" y="207">initial stop</text><text class="chart-label" x="610" y="62">target</text>
      </svg>`,
    },
    'lesson-13': {
      title: 'Breakout confirmation is more than a line cross',
      caption:
        'The example combines a close above resistance with volume expansion. A brief intraday poke that closes back below the level would not satisfy the rule.',
      svg: `<svg viewBox="0 0 760 330" role="img" aria-labelledby="chart-lesson-13-title chart-lesson-13-desc">
        <title id="chart-lesson-13-title">Breakout above resistance with expanding volume</title><desc id="chart-lesson-13-desc">Price consolidates beneath resistance, closes above it, and continues higher. Volume bars expand on the breakout.</desc>
        <line class="chart-guide" x1="70" y1="128" x2="710" y2="128"/><text class="chart-label" x="78" y="117">resistance</text>
        <polyline class="chart-price" points="80,205 145,160 210,188 280,145 350,177 420,150 485,117 550,86 625,62 700,75"/><circle class="chart-dot" cx="485" cy="117" r="7"/>
        <text class="chart-label--accent" x="497" y="108">confirmed close</text>
        <line class="chart-axis" x1="70" y1="285" x2="710" y2="285"/>
        <g fill="#9db8ad"><rect x="90" y="260" width="35" height="25"/><rect x="160" y="252" width="35" height="33"/><rect x="230" y="257" width="35" height="28"/><rect x="300" y="248" width="35" height="37"/><rect x="370" y="252" width="35" height="33"/></g>
        <g fill="#176956"><rect x="440" y="215" width="35" height="70"/><rect x="510" y="230" width="35" height="55"/><rect x="580" y="240" width="35" height="45"/></g><text class="chart-label--small" x="78" y="309">relative volume</text>
      </svg>`,
    },
    'lesson-18': {
      title: 'Expectancy can be positive while drawdowns still hurt',
      caption:
        'This six-trade sequence ends at +3R, yet it includes a 2R peak-to-trough drawdown. Path and loss clustering matter alongside the average.',
      svg: `<svg viewBox="0 0 760 310" role="img" aria-labelledby="chart-lesson-18-title chart-lesson-18-desc">
        <title id="chart-lesson-18-title">Cumulative R path and drawdown</title><desc id="chart-lesson-18-desc">The cumulative result moves from zero to two R, one R, three R, two R, one R and finally three R. The maximum drawdown is two R from the peak at three to the trough at one.</desc>
        <line class="chart-grid" x1="70" y1="65" x2="710" y2="65"/><line class="chart-grid" x1="70" y1="130" x2="710" y2="130"/><line class="chart-grid" x1="70" y1="195" x2="710" y2="195"/><line class="chart-axis" x1="70" y1="260" x2="710" y2="260"/>
        <text class="chart-label--small" x="35" y="70">3R</text><text class="chart-label--small" x="35" y="135">2R</text><text class="chart-label--small" x="35" y="200">1R</text><text class="chart-label--small" x="42" y="265">0</text>
        <polyline class="chart-price" points="80,260 175,130 270,195 365,65 460,130 555,195 680,65"/>
        <line class="chart-stop" x1="365" y1="65" x2="365" y2="195"/><line class="chart-stop" x1="365" y1="195" x2="555" y2="195"/><text class="chart-label--warn" x="385" y="185">2R drawdown</text>
      </svg>`,
    },
    'lesson-21': {
      title: 'A long trailing stop ratchets upward',
      caption:
        'The active stop is the maximum of the prior stop and the new candidate. It stays flat when the calculated candidate would move down.',
      svg: `<svg viewBox="0 0 760 310" role="img" aria-labelledby="chart-lesson-21-title chart-lesson-21-desc">
        <title id="chart-lesson-21-title">Weekly price and nondecreasing trailing stop</title><desc id="chart-lesson-21-desc">Price fluctuates upward while the step-shaped trailing stop rises or remains flat and never moves lower.</desc>
        <polyline class="chart-price" points="80,225 160,175 240,195 320,125 400,145 480,82 560,105 640,55 705,88"/>
        <polyline class="chart-stop" points="80,265 160,265 160,238 320,238 320,190 480,190 480,145 640,145 640,112 705,112"/>
        <text class="chart-label--accent" x="535" y="63">weekly close</text><text class="chart-label--warn" x="505" y="167">trailing stop</text>
        <path class="chart-guide" d="M205 225 l28 0 l0 -28"/><text class="chart-label--small" x="170" y="250">hold, never lower</text>
      </svg>`,
    },
  };

  function stripHtml(html) {
    return String(html)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function preparePages(pages) {
    const prepared = pages.map((page) => ({ ...page }));
    const byId = Object.fromEntries(prepared.map((page) => [page.id, page]));
    const home = byId.root;
    const sources = byId['resources-sources'];
    const pythonLesson = byId['lesson-27'];

    if (home) {
      home.html = home.html
        .replace('Version 1.0 · Prepared', 'Version 1.1 · Prepared')
        .replace(
          /<h2>Publication and workspace status<\/h2>[\s\S]*?(?=<h2>Source and evidence policy<\/h2>)/,
          '<h2>Repository and hosting status</h2><p>This course reader is part of the Perception front-end repository and can be hosted as an ordinary static site. The lesson content is embedded in the reader; the supporting Python utility, synthetic sample journal and automated checks live alongside it.</p><p>Your completed lessons and most recently opened lesson are saved only in this browser for this hosted domain. Clearing site data, using private browsing, changing the deployment domain or opening another device starts a separate local record. Use the “copy reference” control beside a section, paste it into your Codex conversation with your answer, and mark the lesson complete after review.</p>',
        )
        .replace(
          'The offline reader keeps optional completion ticks only in the current browser; it does not submit answers, award grades or synchronize with Lark.',
          'The reader keeps optional completion marks and your last-opened lesson only in the current browser. It does not submit answers, award grades or synchronize across devices.',
        );
    }

    if (sources) {
      sources.html = sources.html.replace(
        /<h2>S16 — Lark[\s\S]*?(?=<h2>Relationship to the commercial outline<\/h2>)/,
        '',
      );
    }

    if (pythonLesson) {
      pythonLesson.html = pythonLesson.html.replace(
        '<p>From the workspace root:</p>',
        '<p>From the <code>trading-course</code> directory:</p>',
      );
    }

    for (const page of prepared) {
      page.search = `${page.title} ${stripHtml(page.html)}`.toLowerCase();
    }
    return prepared;
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  }

  async function copyText(value) {
    if (global.navigator?.clipboard?.writeText) {
      try {
        await global.navigator.clipboard.writeText(value);
        return;
      } catch (error) {
        // Some embedded browsers expose the API but deny clipboard permission.
      }
    }
    const textarea = global.document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    global.document.body.appendChild(textarea);
    textarea.select();
    const copied = global.document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('The browser denied clipboard access.');
  }

  function referenceUrl(page, buildHref, section = '') {
    return new URL(buildHref(page.id, section), global.location.href).href;
  }

  function connectCopyButton(button, textFactory) {
    button.addEventListener('click', async () => {
      const original = button.textContent;
      try {
        await copyText(textFactory());
        button.textContent = 'Copied';
      } catch (error) {
        button.textContent = 'Copy failed';
      }
      global.setTimeout(() => {
        button.textContent = original;
      }, 1600);
    });
  }

  function bindCopyButton(button, page, buildHref) {
    connectCopyButton(
      button,
      () => `${page.title}\n${referenceUrl(page, buildHref)}`,
    );
  }

  function decorateArticle(article, page, buildHref) {
    const chart = chartDefinitions[page.id];
    if (chart) {
      const workedExample = [...article.querySelectorAll('h2')].find(
        (heading) => heading.textContent.trim() === 'Worked example',
      );
      if (workedExample) {
        const figure = global.document.createElement('figure');
        figure.className = 'teaching-chart';
        figure.innerHTML = `<div class="teaching-chart__meta"><strong>${chart.title}</strong><span>Synthetic teaching diagram · not market data</span></div>${chart.svg}<figcaption>${chart.caption}</figcaption>`;
        workedExample.insertAdjacentElement('afterend', figure);
      }
    }

    for (const table of [...article.querySelectorAll('table')]) {
      if (table.parentElement?.classList.contains('table-scroll')) continue;
      const wrapper = global.document.createElement('div');
      wrapper.className = 'table-scroll';
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', 'Scrollable table');
      table.replaceWith(wrapper);
      wrapper.appendChild(table);
    }

    const usedIds = new Set();
    for (const heading of article.querySelectorAll('h2, h3')) {
      const label = heading.textContent.trim();
      const base = slugify(label);
      let section = base;
      let suffix = 2;
      while (usedIds.has(section)) section = `${base}-${suffix++}`;
      usedIds.add(section);
      heading.id = section;
      heading.classList.add('section-heading');

      const button = global.document.createElement('button');
      button.type = 'button';
      button.className = 'section-copy';
      button.textContent = 'copy reference';
      button.setAttribute('aria-label', `Copy reference to ${label}`);
      connectCopyButton(button, () => {
        const url = referenceUrl(page, buildHref, section);
        global.history.replaceState(null, '', buildHref(page.id, section));
        return `${page.title} — ${label}\n${url}`;
      });
      heading.appendChild(button);
    }

    for (const link of article.querySelectorAll('a[href^="http"]')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  }

  const api = {
    bindCopyButton,
    chartPageIds,
    decorateArticle,
    preparePages,
    stripHtml,
  };

  global.CourseUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
