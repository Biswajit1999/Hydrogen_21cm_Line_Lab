(() => {
  window.addEventListener("hi21:import-change", () => {
    // dashboard.js redraws its provenance state on resize; reuse that single draw path.
    window.dispatchEvent(new Event("resize"));
  });
})();
