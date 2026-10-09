const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const animations = new Set<Animation>();
let observer: IntersectionObserver | undefined;

function syncMotion() {
  observer?.disconnect();
  if (preference.matches) {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    return;
  }
  if (!('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer?.unobserve(entry.target);
        const element = entry.target as HTMLElement;
        if (element.dataset.revealed) continue;
        element.dataset.revealed = 'true';
        const animation = element.animate(
          [
            { opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
        animations.add(animation);
        animation.finished.then(
          () => animations.delete(animation),
          () => animations.delete(animation),
        );
      }
    },
    { threshold: 0.08 },
  );
  document.querySelectorAll('[data-reveal]').forEach((element) => observer?.observe(element));
}

preference.addEventListener('change', syncMotion);
syncMotion();
