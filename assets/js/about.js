/* ── /about ──────────────────────────────────────────────────────
   Everything on the page is visible on arrival; the only thing built
   here is the wave that hands the brand surface over to the page below,
   drawn with the same tileable generator the home page uses. */
import "/assets/js/page.js";

function waveFill(width, height, amp, wavelength, baseY) {
  const half = wavelength / 2;
  let d = "M0 " + baseY;
  for (let x = 0; x < width; x += wavelength) d += ` q ${half / 2} ${-amp} ${half} 0 t ${half} 0`;
  return d + ` V ${height} H 0 Z`;
}

const host = document.querySelector(".dropWave");
if (host) {
  host.innerHTML =
    `<svg viewBox="0 0 2400 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<path d="${waveFill(2400, 120, 16, 600, 52)}" fill="var(--bg)"/></svg>`;
}
