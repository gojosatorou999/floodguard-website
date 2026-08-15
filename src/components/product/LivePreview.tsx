/**
 * Preview slot for the Live ProductCard: phone mockup with a radar view
 * and an alert chip.
 *
 * The alert chip is the ONLY place --color-alert appears on this page.
 * It signals a live flood state; it is not an accent.
 *
 * TODO: phone frame, radar sweep (respect prefers-reduced-motion), chip.
 */
export default function LivePreview() {
  return (
    <div data-preview="live" aria-hidden="true">
      {/* TODO: phone frame */}
      {/* TODO: radar */}
      <span data-alert-chip>{/* TODO: alert label */}</span>
    </div>
  );
}
