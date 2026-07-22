// Animated "ElectricMist" background (ported from the React Three Fiber
// component to vanilla WebGL — same fbm/fragment shader, no three.js/build
// step). Recolored from the original midnight-blue (#191970) into the site's
// green palette via uColor. Degrades to the flat dark bg if WebGL is missing;
// under reduced-motion it renders one static frame (no animation).
(function initElectricMist() {
  const canvas = document.getElementById('bg-fx');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return; // CSS background-color stays as the fallback

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Props (mirror the React component's API), tuned for the dark green theme.
  // The original used a vivid midnight blue; here uColor is a deep emerald
  // (~half-intensity of the site's --accent #2fbf71) so the electric striations
  // land in-palette. Speed kept calm so it reads as ambient texture.
  const color = [0.007, 0.185, 0.030]; // strongly green — vivid green wisps
  const speed = 0.2; // very slow, calm motion
  const detail = 1.5;
  const distortion = 3.0;
  const brightness = 3.9; // higher => deep near-black base, very faint effect

  // Full-screen triangle; vUv reconstructed from clip position in the vert.
  const vsrc = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }`;

  // Fragment shader ported from the ElectricMist component (uSpeed folded into
  // uTime on the JS side, so it is not sampled here).
  const fsrc = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uColor;
    uniform float uDetail;
    uniform float uDistortion;
    uniform float uBrightness;
    varying vec2 vUv;

    #define time uTime * 0.2

    mat2 makem2(in float theta){
        float c = cos(theta);
        float s = sin(theta);
        return mat2(c,-s,s,c);
    }

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise( in vec2 x, float detail ){
        x *= detail;
        vec2 p = floor(x);
        vec2 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(p + vec2(0.0, 0.0));
        float b = hash(p + vec2(1.0, 0.0));
        float c = hash(p + vec2(0.0, 1.0));
        float d = hash(p + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    mat2 m2 = mat2( 0.80,  0.60, -0.60,  0.80 );

    float fbm( in vec2 p, float detail, int octaves )
    {
        float z=2.;
        float rz = 0.;
        for (int i= 0; i < 7; i++ )
        {
            if(i >= octaves) break;
            rz += abs((noise(p, detail)-0.5)*4.)/z;
            z = z*2.;
            p = p*2.;
            p *= m2;
        }
        return rz;
    }

    void main() {
        vec2 p = vUv * 2.0 - 1.0;
        p.x *= uResolution.x/uResolution.y;
        vec2 bp = p;
        p += 5.;
        p *= 0.5;

        float rb = fbm(p*.5 + time*.17, uDetail, 3) * .1;
        p *= makem2(rb*.2 + atan(p.y,p.x) * uDistortion);

        float rz = fbm(p*.9 - time*.7, uDetail, 5);

        rz *= 12.0;

        rz *= abs(sin(bp.x*0.5 - time*4.0 - 2.0)) * 1.0;

        vec3 col = uColor / (uBrightness - rz);

        gl_FragColor = vec4(sqrt(abs(col)), 1.0);
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
    time: U('uTime'), res: U('uResolution'), color: U('uColor'),
    detail: U('uDetail'), distortion: U('uDistortion'), brightness: U('uBrightness'),
  };

  gl.uniform3fv(u.color, color);
  gl.uniform1f(u.detail, detail);
  gl.uniform1f(u.distortion, distortion);
  gl.uniform1f(u.brightness, brightness);

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
    gl.uniform2f(u.res, W, H);
  };
  resize();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  const start = performance.now();
  const render = now => {
    gl.uniform1f(u.time, reduceMotion ? 2.0 : (now - start) * 0.001 * speed);
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
