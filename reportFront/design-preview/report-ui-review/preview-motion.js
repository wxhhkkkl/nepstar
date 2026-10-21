(() => {
  "use strict";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const exporting = document.documentElement.classList.contains("export-artboard");
  const active = new Set();
  const visited = new WeakSet();
  const durations = { section: 520, chart: 850, count: 900 };
  let replayCount = 0;

  function animate(element, frames, options) {
    if (!element || !element.animate || reduced.matches || exporting) return;
    const animation = element.animate(frames, {
      duration: durations.chart, easing: "cubic-bezier(.22,.75,.25,1)",
      fill: "none", ...options
    });
    active.add(animation);
    animation.finished.catch(() => {}).finally(() => active.delete(animation));
    return animation;
  }

  function count(element, target) {
    if (!element || !Number.isFinite(target) || reduced.matches || exporting) return;
    if (!element.dataset.finalText) element.dataset.finalText = String(target);
    if (element._countFrame) cancelAnimationFrame(element._countFrame);
    const start = performance.now();
    const render = now => {
      const progress = Math.min(1, (now - start) / durations.count);
      element.textContent = String(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) element._countFrame = requestAnimationFrame(render);
      else element._countFrame = null;
    };
    element._countFrame = requestAnimationFrame(render);
  }

  function reveal(section, replay = false) {
    if (!section || (visited.has(section) && !replay)) return;
    visited.add(section);
    animate(section, [{ opacity: .5, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: durations.section });
    const total = section.querySelector(".system-total b");
    if (total) count(total, Number(total.dataset.finalText || total.textContent));
    section.querySelectorAll(".hero-ring-value,.ring-value").forEach((element, index) => {
      const final = element.getAttribute("stroke-dasharray") || "82 100";
      animate(element, [{ strokeDasharray: "0 100" }, { strokeDasharray: final }], { delay: index * 100 });
    });
    section.querySelectorAll(".stem,.chart rect.fill").forEach((element, index) => {
      element.style.transformBox = "fill-box";
      element.style.transformOrigin = "center bottom";
      animate(element, [{ transform: "scaleY(.02)" }, { transform: "scaleY(1)" }], { delay: index * 90 });
    });
    section.querySelectorAll(".chart circle.fill").forEach((element, index) => {
      animate(element, [{ opacity: .1 }, { opacity: 1 }], { duration: 350, delay: Math.min(index * 4, 520) });
    });
    section.querySelectorAll(".rail-fill").forEach((element, index) => {
      element.style.transformOrigin = "left center";
      animate(element, [{ transform: "scaleX(.01)" }, { transform: "scaleX(1)" }], { delay: index * 90 });
    });
    section.querySelectorAll(".point").forEach((element, index) => {
      animate(element, [{ left: "0%" }, { left: element.style.left }], { delay: index * 110 });
    });
    section.querySelectorAll(".radar-shape").forEach(element => {
      element.style.transformBox = "fill-box";
      element.style.transformOrigin = "center";
      animate(element, [{ transform: "scale(.2)", opacity: .2 }, { transform: "scale(1)", opacity: 1 }]);
    });
    if (section.classList.contains("hero")) {
      const main = section.querySelector(".score-main");
      if (main) count(main, 82);
    }
  }

  const sections = [...document.querySelectorAll(".hero,.system,.plan")];
  if (!exporting && !reduced.matches && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    }, { threshold: .08 });
    sections.forEach(section => observer.observe(section));
  }

  function replay() {
    replayCount++;
    active.forEach(animation => animation.cancel());
    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) reveal(section, true);
    });
    document.documentElement.dataset.replayCount = String(replayCount);
  }
  window.addEventListener("message", event => {
    if (event.origin === location.origin && event.source === window.parent && event.data?.type === "report:replay") replay();
  });
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    active.forEach(animation => animation.cancel());
    document.querySelectorAll("[data-final-text]").forEach(element => {
      if (element._countFrame) cancelAnimationFrame(element._countFrame);
      element._countFrame = null;
      element.textContent = element.dataset.finalText;
    });
  });

  const floating = document.querySelector(".ai-float");
  let compactTimer;
  window.addEventListener("scroll", () => {
    if (!floating || exporting) return;
    floating.classList.add("is-compact");
    clearTimeout(compactTimer);
    compactTimer = setTimeout(() => floating.classList.remove("is-compact"), 1000);
  }, { passive: true });
  floating?.addEventListener("click", () => {
    clearTimeout(compactTimer);
    floating.classList.toggle("is-compact");
  });
  document.documentElement.dataset.motionReady = "true";
})();
