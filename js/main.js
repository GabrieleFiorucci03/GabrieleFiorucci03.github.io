// Background spotlight follows the cursor with a soft lag.
// Skipped on touch / coarse-pointer devices and under reduced-motion (stays a static glow).
const glow = document.getElementById('bg-glow');
const finePointer = window.matchMedia('(pointer: fine)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (glow && finePointer && !reduceMotion) {
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight * 0.14;
  let curX = targetX;
  let curY = targetY;
  let rafId = null;

  const step = () => {
    curX += (targetX - curX) * 0.08;
    curY += (targetY - curY) * 0.08;
    glow.style.setProperty('--mx', curX.toFixed(1) + 'px');
    glow.style.setProperty('--my', curY.toFixed(1) + 'px');
    if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
      rafId = requestAnimationFrame(step);
    } else {
      rafId = null;
    }
  };

  window.addEventListener('pointermove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (rafId === null) rafId = requestAnimationFrame(step);
  }, { passive: true });
}

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
