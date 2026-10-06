const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const active = new Set<Animation>();
const scenes = [...document.querySelectorAll<HTMLElement>('[data-memory-scene]')];
let observer: IntersectionObserver | undefined;

function syncMotion() {
  document.documentElement.dataset.motion = preference.matches ? 'reduced' : 'enabled';
  observer?.disconnect();
  if (preference.matches) {
    active.forEach((animation) => animation.cancel());
    scenes.forEach((scene) => {
      scene.style.removeProperty('--scene-x');
      scene.style.removeProperty('--scene-y');
    });
    return;
  }
  if (!('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer?.unobserve(element);
        if (element.dataset.revealed || preference.matches) continue;
        element.dataset.revealed = 'true';
        const animation = element.animate(
          [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
        active.add(animation);
        animation.finished.then(
          () => active.delete(animation),
          () => active.delete(animation),
        );
      }
    },
    { threshold: 0.08 },
  );
  document
    .querySelectorAll('[data-reveal], .main-content > .page-header, .post-header')
    .forEach((element) => observer?.observe(element));
}

for (const scene of scenes) {
  let frame = 0;
  let position = { x: 0, y: 0 };
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    scene.style.removeProperty('--scene-x');
    scene.style.removeProperty('--scene-y');
  };
  scene.addEventListener('pointermove', (event) => {
    if (preference.matches || !pointer.matches || event.pointerType !== 'mouse') return;
    position = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (preference.matches || !pointer.matches) return;
      const bounds = scene.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = Math.max(-1, Math.min(1, ((position.y - bounds.top) / bounds.height) * 2 - 1));
      const y = Math.max(-1, Math.min(1, ((position.x - bounds.left) / bounds.width) * 2 - 1));
      scene.style.setProperty('--scene-x', `${(-x * 3).toFixed(2)}deg`);
      scene.style.setProperty('--scene-y', `${(y * 3).toFixed(2)}deg`);
    });
  });
  scene.addEventListener('pointerleave', reset);
  pointer.addEventListener('change', reset);
  preference.addEventListener('change', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset();
  });
}

preference.addEventListener('change', syncMotion);
syncMotion();
