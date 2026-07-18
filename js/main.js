// Animated "LiquidChrome" background (ported from the React Bits component to
// vanilla WebGL — same fragment shader, no ogl/build step). Tinted with the
// site's green palette via baseColor. Degrades to the flat dark bg if WebGL is
// missing; under reduced-motion it renders one static frame (no animation).
(function initLiquidChrome() {
  const canvas = document.getElementById('bg-fx');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) return; // CSS background-color stays as the fallback

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // Props (mirrors the React component's API), tuned for a dark green theme.
  // Kept deliberately subdued so the effect reads as ambient texture, not a
  // foreground element: dim base color, calm amplitude, slow speed.
  const baseColor = [0.016, 0.055, 0.032]; // very dark green -> soft, low highlights
  const speed = 0.35;
  const amplitude = 0.32;
  const frequencyX = 2.5;
  const frequencyY = 1.5;
  const interactive = true;

  const vsrc = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

  // Fragment shader copied from the React Bits LiquidChrome component; vUv is
  // derived from gl_FragCoord here instead of a vertex varying.
  const fsrc = `
    precision highp float;
    uniform float uTime;
    uniform vec3 uResolution;
    uniform vec3 uBaseColor;
    uniform float uAmplitude;
    uniform float uFrequencyX;
    uniform float uFrequencyY;
    uniform vec2 uMouse;

    vec4 renderImage(vec2 uvCoord) {
        vec2 fragCoord = uvCoord * uResolution.xy;
        vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);

        for (float i = 1.0; i < 10.0; i++){
            uv.x += uAmplitude / i * cos(i * uFrequencyX * uv.y + uTime + uMouse.x * 3.14159);
            uv.y += uAmplitude / i * cos(i * uFrequencyY * uv.x + uTime + uMouse.y * 3.14159);
        }

        vec2 diff = (uvCoord - uMouse);
        float dist = length(diff);
        float falloff = exp(-dist * 20.0);
        float ripple = sin(10.0 * dist - uTime * 2.0) * 0.03;
        uv += (diff / (dist + 0.0001)) * ripple * falloff;

        vec3 color = uBaseColor / abs(sin(uTime - uv.y - uv.x));
        return vec4(color, 1.0);
    }

    void main() {
        vec2 vUv = gl_FragCoord.xy / uResolution.xy;
        vec4 col = vec4(0.0);
        int samples = 0;
        for (int i = -1; i <= 1; i++){
            for (int j = -1; j <= 1; j++){
                vec2 offset = vec2(float(i), float(j)) * (1.0 / min(uResolution.x, uResolution.y));
                col += renderImage(vUv + offset);
                samples++;
            }
        }
        gl_FragColor = col / float(samples);
    }`;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsrc));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = name => gl.getUniformLocation(prog, name);
  const u = {
    time: U('uTime'), res: U('uResolution'), base: U('uBaseColor'),
    amp: U('uAmplitude'), freqX: U('uFrequencyX'), freqY: U('uFrequencyY'),
    mouse: U('uMouse'),
  };

  gl.uniform3fv(u.base, baseColor);
  gl.uniform1f(u.amp, amplitude);
  gl.uniform1f(u.freqX, frequencyX);
  gl.uniform1f(u.freqY, frequencyY);
  gl.uniform2f(u.mouse, 0, 0);

  let W = 0, H = 0;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Measure from the fixed canvas' CSS box rather than window.innerHeight.
    // On mobile the browser's URL bar shows/hides on scroll, which changes
    // innerHeight and would otherwise reallocate the GL buffer + shift the
    // shader's aspect ratio, causing a visible glitch. The fixed element's
    // client size is resolved against the (stable) large viewport instead.
    const cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
    const nextW = Math.round(cssW * dpr);
    const nextH = Math.round(cssH * dpr);
    // Skip redundant work when the real pixel size hasn't changed (e.g. a
    // resize event fired only because the mobile toolbar toggled).
    if (nextW === W && nextH === H) return;
    W = nextW; H = nextH;
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    gl.uniform3f(u.res, W, H, W / H);
  };
  resize();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // mouse/touch interaction — normalized 0..1, y flipped (matches the original)
  if (interactive && (finePointer || 'ontouchstart' in window)) {
    const setMouse = (clientX, clientY) => {
      gl.uniform2f(u.mouse, clientX / window.innerWidth, 1 - clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', e => setMouse(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', e => {
      if (e.touches.length) setMouse(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
  }

  const start = performance.now();
  const render = now => {
    gl.uniform1f(u.time, reduceMotion ? 0.35 : (now - start) * 0.001 * speed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduceMotion) requestAnimationFrame(render);
  };
  if (reduceMotion) render(start);
  else requestAnimationFrame(render);
})();

// Year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile nav
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

// Reveal-on-scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in-view');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.section, .hero-inner, .cta-card, .proj-hero-inner').forEach(el => {
  el.classList.add('reveal');
  observer.observe(el);
});
