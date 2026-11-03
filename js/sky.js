/* Night-sky starfield: fixed full-viewport canvas#sky.
   3 depth layers, scroll + cursor parallax, twinkle, rare shooting stars.
   Pauses when the tab is hidden; static single frame under prefers-reduced-motion. */
(function () {
  'use strict';

  var canvas = document.getElementById('sky');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduceMQ = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };
  var fineMQ = window.matchMedia ? window.matchMedia('(pointer: fine)') : { matches: false };

  var COLORS = ['#DDEFFA', '#CED9F5'];
  // per depth layer: scroll speed, cursor travel (px), radius range, alpha range
  var LAYERS = [
    { scroll: 0.05, cursor: 4, r: [0.4, 0.8], a: [0.35, 0.65] },
    { scroll: 0.12, cursor: 9, r: [0.7, 1.2], a: [0.5, 0.85] },
    { scroll: 0.2, cursor: 16, r: [1.1, 1.8], a: [0.65, 1.0] },
  ];

  var W = 0,
    H = 0,
    dpr = 1;
  var stars = [];
  var shooters = [];
  var nextShoot = 0;
  var mx = 0,
    my = 0,
    tx = 0,
    ty = 0; // smoothed / target cursor offsets (-1..1)
  var running = false,
    rafId = 0,
    last = 0,
    clock = 0;
  var resizeTimer = 0;
  var lastW = 0;

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function buildStars() {
    var count = Math.round(Math.min(220, Math.max(120, (W * H) / 9000)));
    stars = [];
    for (var i = 0; i < count; i++) {
      var d = i % 10 < 5 ? 0 : i % 10 < 8 ? 1 : 2; // more far stars than near
      var L = LAYERS[d];
      stars.push({
        nx: Math.random(),
        ny: Math.random(),
        d: d,
        r: rand(L.r[0], L.r[1]),
        a: rand(L.a[0], L.a[1]),
        c: COLORS[Math.random() < 0.55 ? 0 : 1],
        ph: rand(0, Math.PI * 2),
        sp: rand(0.4, 1.3),
        tw: Math.random() < 0.75 ? rand(0.25, 0.6) : 0.1, // some stars barely twinkle
      });
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!stars.length || Math.abs(W - lastW) > 40) buildStars();
    lastW = W;
    if (!running) draw(clock); // keep static frame correct
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 160);
  }

  function wrap(v, m) {
    return ((v % m) + m) % m;
  }

  function drawStars(t, animated) {
    var sy = window.pageYOffset || 0;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i],
        L = LAYERS[s.d];
      var x = s.nx * W + (animated ? mx * L.cursor : 0);
      var y = wrap(s.ny * H - sy * L.scroll + (animated ? my * L.cursor : 0), H);
      var al = s.a * (animated ? 1 - s.tw + s.tw * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)) : 1);
      ctx.globalAlpha = al;
      ctx.fillStyle = s.c;
      if (s.r < 1) {
        ctx.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, 6.2832);
        ctx.fill();
        if (s.d === 2) {
          // soft halo on the nearest stars
          ctx.globalAlpha = al * 0.14;
          ctx.beginPath();
          ctx.arc(x, y, s.r * 3.2, 0, 6.2832);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function spawnShooter() {
    var ang = rand(0.35, 0.6); // radians below horizontal, heading right
    var dir = Math.random() < 0.7 ? 1 : -1;
    shooters.push({
      x: dir === 1 ? rand(-0.05, 0.55) * W : rand(0.45, 1.05) * W,
      y: rand(0.02, 0.4) * H,
      vx: Math.cos(ang) * dir * rand(520, 780),
      vy: Math.sin(ang) * rand(520, 780),
      life: 0,
      max: rand(1.0, 1.5),
      len: rand(90, 160),
    });
  }

  function drawShooters(dt) {
    for (var i = shooters.length - 1; i >= 0; i--) {
      var s = shooters[i];
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      var p = s.life / s.max;
      if (p >= 1) {
        shooters.splice(i, 1);
        continue;
      }
      var fade = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      var sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      var tx2 = s.x - (s.vx / sp) * s.len;
      var ty2 = s.y - (s.vy / sp) * s.len;
      var g = ctx.createLinearGradient(s.x, s.y, tx2, ty2);
      g.addColorStop(0, 'rgba(221,239,250,' + (0.9 * fade).toFixed(3) + ')');
      g.addColorStop(0.35, 'rgba(206,217,245,' + (0.35 * fade).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(206,217,245,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx2, ty2);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#DDEFFA';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.4, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
    drawStars(t, running);
    if (running && shooters.length) drawShooters(dt || 0);
  }

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    var dtMs = now - last;
    if (dtMs < 30) return; // ~30fps cap keeps CPU low
    last = now;
    var dt = Math.min(dtMs / 1000, 0.1);
    clock += dt;
    mx += (tx - mx) * 0.06;
    my += (ty - my) * 0.06;
    if (clock >= nextShoot) {
      if (!shooters.length) spawnShooter();
      nextShoot = clock + rand(6, 14);
    }
    draw(clock, dt);
  }

  function start() {
    if (running || reduceMQ.matches || document.hidden) return;
    running = true;
    last = performance.now();
    if (!nextShoot) nextShoot = clock + rand(3, 7);
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  function applyMotionPref() {
    if (reduceMQ.matches) {
      stop();
      shooters = [];
      draw(0);
    } else {
      start();
    }
  }

  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', applyMotionPref);
  else if (reduceMQ.addListener) reduceMQ.addListener(applyMotionPref);

  window.addEventListener(
    'pointermove',
    function (e) {
      if (!fineMQ.matches || e.pointerType === 'touch') return;
      tx = (e.clientX / W - 0.5) * 2;
      ty = (e.clientY / H - 0.5) * 2;
    },
    { passive: true },
  );

  resize();
  applyMotionPref();
})();
