# Mobile public video and schedule browser checks

Run against the Vite development site. These scripts use Playwright Chromium and reuse the PC public read-only fixture. Test API responses are synthetic; `live-smoke.cjs` uses actual read-only development responses.

```bash
export PLAYWRIGHT_MODULE=/path/to/playwright
export CHROMIUM_PATH=/path/to/chrome-headless-shell
export AUDIT_BASE_URL=https://dev.fromlog.caadiq.co.kr
export AUDIT_OUTPUT=/tmp/fromlog-mobile-public-media
node frontend/test/mobile-public-media/verify.cjs
node frontend/test/mobile-public-media/extended.cjs
node frontend/test/mobile-public-media/scroll.cjs
node frontend/test/mobile-public-media/admin-calendar.cjs
node frontend/test/mobile-public-media/live-smoke.cjs
node frontend/test/pc-public-media/verify.cjs
docker exec fromlog-frontend npm run build
```

- `verify`: mobile/tablet/landscape layout, calendar transitions and month-end, navigation, filters, errors/retries, reduced motion.
- `extended`: real touch events for poster swipe, detail categories, unknown dates, short viewport channel menu, calendar request failure, 1100px boundary.
- `scroll`: date/search lists retain the same scroll position after detail Back; new query resets.
- `admin-calendar`: focused regression for the shared mobile calendar in authenticated admin UI with mocked auth/API.
- `live-smoke`: live development thumbnails, lists, search/detail/Back and landscape calendar; non-GET requests blocked.

The shared fixture shifts the wall-clock date but leaves native animation clocks advancing. Wait for visible transitions to settle before inspecting screenshots. Screenshots are written to `AUDIT_OUTPUT` and intentionally not committed.

These are Chromium browser checks, not physical Android/iOS keyboard, native app handoff, Safari or performance certification. See `docs/validation/09-mobile-public-media.md` for coverage and limitations.
