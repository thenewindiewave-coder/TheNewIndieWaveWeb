/**
 * THE NEW INDIE WAVE - AMBIENT TWINKLE BACKGROUND
 * Genera un fondo atmosférico de puntos tenues que parpadean suavemente
 * 100% no invasivo, ultra ligero, acelerado por hardware y con soporte Retina.
 */
(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  function initTwinkleBg() {
    if (document.getElementById('tniwTwinkleCanvas')) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'tniwTwinkleCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100vw',
      'height: 100vh',
      'pointer-events: none',
      'z-index: 2',
      'opacity: 0.7',
      'mix-blend-mode: screen'
    ].join(';') + ';';

    document.body.appendChild(canvas);

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

      // Distribución en rejilla rítmica con dispersión orgánica (tipo terminal ASCII/Unicorn)
      var step = width < 768 ? 32 : 40;
      var cols = Math.ceil(width / step);
      var rows = Math.ceil(height / step);

      for (var r = 0; r <= rows; r++) {
        for (var c = 0; c <= cols; c++) {
          // Solo activar aproximadamente el 28% de los nodos para que sea tenue y no sobrecargue
          if (Math.random() < 0.28) {
            var jitterX = (Math.random() - 0.5) * (step * 0.7);
            var jitterY = (Math.random() - 0.5) * (step * 0.7);
            
            var x = c * step + jitterX;
            var y = r * step + jitterY;

            if (x >= 0 && x <= width && y >= 0 && y <= height) {
              var isLime = Math.random() < 0.12; // 12% con sutil toque verde lima TNIW
              var size = Math.random() < 0.2 ? 1.4 : (Math.random() < 0.6 ? 1.0 : 0.75);
              var baseAlpha = Math.random() * 0.22 + 0.08; // Muy tenue (0.08 a 0.30)
              var speed = Math.random() * 0.025 + 0.01; // Ritmo de parpadeo suave
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

      // Normalizar avance de fase independientemente de la tasa de refresco
      var stepFactor = Math.min(delta / 16.6, 2.5);

      ctx.clearRect(0, 0, width, height);

      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        dot.phase += dot.speed * stepFactor;

        // Oscilación suave senoidal
        var sine = Math.sin(dot.phase);
        var alpha = dot.baseAlpha + sine * (dot.baseAlpha * 0.75);
        if (alpha < 0.03) alpha = 0.03;
        if (alpha > 0.45) alpha = 0.45;

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
