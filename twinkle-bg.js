/**
 * THE NEW INDIE WAVE - AMBIENT TWINKLE BACKGROUND
 * Genera un fondo cósmico / terminal ASCII de puntos densos que parpadean.
 * Ubicado estrictamente en el fondo absoluto (z-index -1) sin interferir
 * con el navbar, las tarjetas ni la ventana emergente de lectura (readerOverlay).
 */
(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  function initTwinkleBg() {
    if (document.getElementById('tniwTwinkleCanvas')) return;

    // Inyectar reglas CSS seguras: Canvas en z-index -1 al fondo absoluto
    var style = document.createElement('style');
    style.id = 'tniwTwinkleStyle';
    style.textContent = [
      'html {',
      '  background-color: #09090b !important;',
      '}',
      'body {',
      '  background-color: transparent !important;',
      '}',
      '#tniwTwinkleCanvas {',
      '  position: fixed !important;',
      '  top: 0 !important;',
      '  left: 0 !important;',
      '  width: 100vw !important;',
      '  height: 100vh !important;',
      '  pointer-events: none !important;',
      '  z-index: -1 !important;',
      '}',
      '.featured-hero, .article-card {',
      '  background-color: var(--bg-card, #121215);',
      '}'
    ].join('\n');
    document.head.appendChild(style);

    var canvas = document.createElement('canvas');
    canvas.id = 'tniwTwinkleCanvas';
    canvas.setAttribute('aria-hidden', 'true');

    // Insertar al inicio de body
    if (document.body.firstChild) {
      document.body.insertBefore(canvas, document.body.firstChild);
    } else {
      document.body.appendChild(canvas);
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var width = 0;
    var height = 0;
    var dots = [];
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function buildDots() {
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      dots = [];

      // Malla densa similar a la referencia (paso de ~20px a ~22px)
      var step = width < 768 ? 20 : 22;
      var cols = Math.ceil(width / step) + 1;
      var rows = Math.ceil(height / step) + 1;

      for (var r = 0; r <= rows; r++) {
        var rowOffset = (r % 2) * (step * 0.5); // Escalonado hexagonal/matriz
        for (var c = 0; c <= cols; c++) {
          // 65% de probabilidad de nodo activo para densidad rica y uniforme
          if (Math.random() < 0.65) {
            var jitterX = (Math.random() - 0.5) * (step * 0.45);
            var jitterY = (Math.random() - 0.5) * (step * 0.45);

            var x = c * step + rowOffset + jitterX;
            var y = r * step + jitterY;

            if (x >= -10 && x <= width + 10 && y >= -10 && y <= height + 10) {
              var isLime = Math.random() < 0.12; // 12% tinte verde lima TNIW
              // Tamaños finos y nítidos: 0.75px a 1.4px
              var size = Math.random() < 0.2 ? 1.35 : (Math.random() < 0.65 ? 0.95 : 0.75);
              // Atenuación suave y perfecta confirmada por el usuario (0.08 a 0.28)
              var baseAlpha = Math.random() * 0.20 + 0.08;
              // Parpadeo más rápido y activo (3x más dinámico)
              var speed = Math.random() * 0.055 + 0.035;
              var phase = Math.random() * Math.PI * 2;

              dots.push({
                x: x,
                y: y,
                size: size,
                baseAlpha: baseAlpha,
                speed: speed,
                phase: phase,
                isLime: isLime
              });
            }
          }
        }
      }
    }

    var resizeTimer = null;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(buildDots, 150);
    });

    buildDots();

    var animId = null;
    var lastTime = 0;

    function render(timestamp) {
      if (!lastTime) lastTime = timestamp;
      var delta = timestamp - lastTime;
      lastTime = timestamp;

      // Normalizar avance con delta time
      var stepFactor = Math.min(delta / 16.6, 2.5);

      ctx.clearRect(0, 0, width, height);

      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        dot.phase += dot.speed * stepFactor;

        // Parpadeo suave senoidal
        var sine = Math.sin(dot.phase);
        var alpha = dot.baseAlpha + sine * (dot.baseAlpha * 0.8);
        if (alpha < 0.02) alpha = 0.02;
        if (alpha > 0.42) alpha = 0.42;

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);

        if (dot.isLime) {
          ctx.fillStyle = 'rgba(187, 244, 81, ' + alpha.toFixed(3) + ')';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
        }
        ctx.fill();
      }

      if (!document.hidden) {
        animId = requestAnimationFrame(render);
      }
    }

    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        lastTime = performance.now();
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animId);
      }
    });

    animId = requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTwinkleBg);
  } else {
    initTwinkleBg();
  }
})();
