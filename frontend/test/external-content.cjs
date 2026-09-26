const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      await page.goto(process.env.AUDIT_BASE_URL || 'https://dev.fromlog.caadiq.co.kr');
      const result = await page.evaluate(async () => {
        const { default: React } = await import('/node_modules/.vite/deps/react.js');
        const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { default: KakaoMap } = await import('/src/components/common/KakaoMap.jsx');
        const overlays = [];
        window.kakao = { maps: {
          LatLng: class {}, Size: class {}, Point: class {}, MarkerImage: class {}, Marker: class {},
          Map: class { constructor(container) { this.container = container; } },
          CustomOverlay: class {
            constructor({ content }) { this.content = content; }
            setMap(map) { map.container.append(this.content); overlays.push(this.content); }
          },
        } };
        const host = document.createElement('div');
        document.body.append(host);
        const root = createRoot(host);
        const names = ['한양대학교 ERICA · 동심', '<img src=x onerror="window.overlayInjected=true"><script>alert(1)</script>'];
        for (const name of names) {
          root.render(React.createElement(KakaoMap, { lat: 37.3, lng: 126.8, name }));
          for (let i = 0; i < 50 && overlays.at(-1)?.textContent !== name; i++) await new Promise(resolve => setTimeout(resolve, 20));
        }
        const result = { texts: overlays.map(node => node.textContent), elements: overlays.map(node => node.children.length), injected: !!window.overlayInjected, backgrounds: overlays.map(node => node.style.background) };
        root.unmount(); host.remove();
        return result;
      });
      assert.deepEqual(result.texts, ['한양대학교 ERICA · 동심', '<img src=x onerror="window.overlayInjected=true"><script>alert(1)</script>']);
      assert.deepEqual(result.elements, [0, 0]);
      assert.equal(result.injected, false);
      assert.ok(result.backgrounds.every(color => color === 'rgb(255, 255, 255)'));
      console.log(`PASS ${viewport.width}: normal map label and malicious HTML remain styled text`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
