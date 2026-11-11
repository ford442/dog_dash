const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  await page.goto('http://localhost:5173/');
  await page.click('body');
  await page.waitForTimeout(3000);

  const fps = await page.evaluate(() => {
     let lastFrameTime = performance.now();
     let frames = 0;
     let currentFps = 0;
     return new Promise(resolve => {
        const loop = (time) => {
           frames++;
           const now = performance.now();
           if (now - lastFrameTime >= 1000) {
              currentFps = frames;
              frames = 0;
              lastFrameTime = now;
              resolve(currentFps);
              return;
           }
           requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
     });
  });

  console.log(`FPS: ${fps}`);

  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
