(function () {
  document.body.classList.add("cinematic-js");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = document.querySelectorAll(".reveal-section, .reveal-block");
  const sectionTargets = document.querySelectorAll(".page-section[id]");
  const navLinks = document.querySelectorAll(".chapter-link[href^='#']");

  const setActiveLink = (id) => {
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
    });
  };

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((target) => target.classList.add("is-visible"));
    const firstSection = sectionTargets[0];
    if (firstSection) setActiveLink(firstSection.id);
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  revealTargets.forEach((target) => revealObserver.observe(target));

  const activeObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActiveLink(visible.target.id);
    },
    {
      threshold: [0.2, 0.45, 0.7],
      rootMargin: "-18% 0px -48% 0px"
    }
  );

  sectionTargets.forEach((target) => activeObserver.observe(target));

  const heroLayer = document.querySelector(".hero-texture");
  if (!heroLayer) return;

  let ticking = false;
  const updateHeroShift = () => {
    const shift = Math.min(64, window.scrollY * 0.06);
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
