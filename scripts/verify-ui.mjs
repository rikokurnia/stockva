import fs from "node:fs";

async function cdp() {
  const listRes = await fetch("http://127.0.0.1:9222/json/list");
  const targets = await listRes.json();
  const pageTarget = targets.find((t) => t.type === "page" && !t.url.startsWith("chrome://"));
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((res) => ws.onopen = res);

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log("Navigating to http://localhost:3000...");
  await new Promise((r) => setTimeout(r, 2500));

  async function evaluate(expression) {
    const res = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async function screenshot(filename) {
    const res = await send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    fs.writeFileSync(filename, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  }

  // 1. Initial city map
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/01_initial_city.png");

  // 2. Open City Hall
  console.log("Opening City Hall...");
  await evaluate(`
    (() => {
      // Find City Hall button in bottom dock or building
      const buttons = Array.from(document.querySelectorAll('button'));
      const hallBtn = buttons.find(b => b.textContent && (b.textContent.includes('City Hall') || b.getAttribute('aria-label')?.includes('City Hall')));
      if (hallBtn) { hallBtn.click(); return 'clicked button'; }
      // Alternatively look for hall building or click bottom menu
      const navButtons = Array.from(document.querySelectorAll('.dock-bar button, .island-actions button, button'));
      const found = navButtons.find(b => b.title?.includes('City Hall') || b.textContent?.includes('Finances') || b.textContent?.includes('City Hall'));
      if (found) { found.click(); return 'clicked found'; }
      return 'not found';
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/02_city_hall_dark.png");

  // 3. Test "Manage portfolio" or Manage button
  console.log("Testing Manage portfolio interaction...");
  const manageResult = await evaluate(`
    (() => {
      const manageButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent && (b.textContent.includes('Manage portfolio') || b.textContent.includes('Manage')));
      if (manageButtons.length > 0) {
        manageButtons[0].click();
        return 'clicked ' + manageButtons[0].textContent.trim();
      }
      return 'no manage button found';
    })()
  `);
  console.log("Manage action result:", manageResult);
  await new Promise((r) => setTimeout(r, 1200));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/03_inspector_card_beside_building.png");

  // Check if start-note is hidden or overlapping
  const overlapInfo = await evaluate(`
    (() => {
      const inspector = document.querySelector('.inspection-panel');
      const startNote = document.querySelector('.start-note');
      return {
        inspectorFound: Boolean(inspector),
        inspectorBox: inspector ? inspector.getBoundingClientRect() : null,
        startNoteFound: Boolean(startNote),
        startNoteBox: startNote ? startNote.getBoundingClientRect() : null,
        viewportHeight: window.innerHeight,
      };
    })()
  `);
  console.log("Inspection Panel & Start Note layout:", JSON.stringify(overlapInfo, null, 2));

  // 4. Open Stock Exchange & Test Chart
  console.log("Opening Stock Exchange...");
  await evaluate(`
    (() => {
      const tradeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Trade position'));
      if (tradeBtn) { tradeBtn.click(); return; }
      const exchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Stock Exchange') || b.title?.includes('Exchange')));
      if (exchBtn) exchBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1500));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/04_stock_exchange_chart_dark.png");

  // Click 1W then ALL in chart controls
  console.log("Testing chart controls...");
  await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const allBtn = buttons.find(b => b.textContent?.trim() === 'ALL');
      if (allBtn) allBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/05_stock_exchange_all_chart.png");

  // 5. Open Data Center (RWA passport)
  console.log("Opening Data Center...");
  await evaluate(`
    (() => {
      const rwaTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Data Center') || b.title?.includes('Data Center')));
      if (rwaTab) { rwaTab.click(); return; }
      const closeBtn = document.querySelector('button[aria-label*="Close"]');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`
    (() => {
      const dataBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Data Center') || b.title?.includes('Data Center')));
      if (dataBtn) dataBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/06_datacenter_dark.png");

  // 6. Open Agent Hall
  console.log("Opening Agent Hall...");
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label*="Close"]');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 500));
  await evaluate(`
    (() => {
      const agentBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Agent Hall') || b.title?.includes('Agent Hall') || b.textContent.includes('Agent')));
      if (agentBtn) agentBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/07_agent_hall_dark.png");

  ws.close();
  console.log("Done verifying!");
}

cdp().catch(console.error);
