(function () {
  document.body.classList.add("cinematic-js");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = document.querySelectorAll(".reveal-section, .reveal-block");

  if (!revealTargets.length) return;

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  revealTargets.forEach((target) => observer.observe(target));

  const heroLayer = document.querySelector(".hero-geology");
  if (!heroLayer) return;

  let ticking = false;
  const updateHeroShift = () => {
    const shift = Math.min(80, window.scrollY * 0.08);
    heroLayer.style.setProperty("--hero-shift", `${shift}px`);
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateHeroShift);
    },
    { passive: true }
  );
})();
