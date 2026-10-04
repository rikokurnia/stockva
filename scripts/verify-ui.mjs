import fs from "node:fs";

async function run() {
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

  await new Promise((res) => (ws.onopen = res));

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

  console.log("Seeding city with City Hall, Exchange, Data Center, Agent Hall, Tesla, Apple, and roads...");
  await evaluate(`
    (() => {
      const demoCity = {
        version: 2,
        cash: 50000,
        buildings: [
          { id: "b_hall", kind: "hall", r: 0, c: 0, cost: 250, entry: 250, quantity: 1 },
          { id: "b_exch", kind: "exchange", r: 2, c: 2, cost: 400, entry: 400, quantity: 1 },
          { id: "b_data", kind: "oracle", r: -2, c: -2, cost: 300, entry: 300, quantity: 1 },
          { id: "b_agent", kind: "agent_hall", r: 2, c: -2, cost: 350, entry: 350, quantity: 1 },
          { id: "b_tsla", kind: "tesla", r: -2, c: 2, cost: 700, entry: 350, quantity: 2, vaultId: "0x1810e415" }
        ],
        roads: [
          { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: -1, c: 0 },
          { r: 1, c: 1 }, { r: -1, c: 1 }, { r: 1, c: -1 }, { r: -1, c: -1 },
          { r: 0, c: 2 }, { r: 2, c: 0 }, { r: 0, c: -2 }, { r: -2, c: 0 }
        ],
        paper: []
      };
      localStorage.setItem("stockva.sandbox.v2", JSON.stringify(demoCity));
    })()
  `);

  console.log("Navigating to city page with seeded data...");
  await send("Page.navigate", { url: "http://localhost:3000/city" });
  for (let i = 0; i < 30; i++) {
    const ready = await evaluate(`Boolean(document.querySelector('.portfolio-resource'))`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  await new Promise((r) => setTimeout(r, 800));

  // 1. Initial city map screenshot
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/01_island_with_services.png");

  // 2. Open City Hall
  console.log("Opening City Hall...");
  await evaluate(`
    (() => {
      const portfolioBtn = document.querySelector('.portfolio-resource') || document.querySelector('.cash-resource');
      if (portfolioBtn) portfolioBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/02_city_hall_dark.png");

  // 3. Test clicking "Manage portfolio" / "Manage" on holding row
  console.log("Testing Manage portfolio interaction in City Hall...");
  const manageClicked = await evaluate(`
    (() => {
      const manageButtons = Array.from(document.querySelectorAll('button')).filter(b => 
        b.textContent && (b.textContent.includes('Manage portfolio') || b.textContent.includes('Manage'))
      );
      if (manageButtons.length > 0) {
        const text = manageButtons[0].textContent.trim();
        manageButtons[0].click();
        return 'clicked ' + text;
      }
      return 'none';
    })()
  `);
  console.log("Manage button clicked:", manageClicked);
  await new Promise((r) => setTimeout(r, 1500));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/03_inspector_card_beside_building.png");

  // Verify positioning and overlap
  const layoutCheck = await evaluate(`
    (() => {
      const inspector = document.querySelector('.inspection-panel');
      const startNote = document.querySelector('.start-note');
      const rect = inspector ? inspector.getBoundingClientRect() : null;
      return {
        inspectorFound: Boolean(inspector),
        inspectorBox: rect ? {
          top: rect.top,
          right: window.innerWidth - rect.right,
          bottom: rect.bottom,
          height: rect.height,
          width: rect.width,
          viewportHeight: window.innerHeight,
          fitsWithinScreen: rect.bottom <= window.innerHeight,
        } : null,
        startNoteVisible: Boolean(startNote && window.getComputedStyle(startNote).display !== 'none'),
      };
    })()
  `);
  console.log("Layout inspection report:", JSON.stringify(layoutCheck, null, 2));

  // Close inspector before opening exchange
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('.inspection-panel button[aria-label*="Close"]') || document.querySelector('.inspection-panel .close-btn') || Array.from(document.querySelectorAll('button')).find(b => b.ariaLabel?.includes('Close'));
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 500));

  // 4. Open Stock Exchange & Test Real-time Chart
  console.log("Opening Stock Exchange...");
  await evaluate(`
    (() => {
      const marketBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Market'));
      if (marketBtn) marketBtn.click();
    })()
  `);
  for (let i = 0; i < 25; i++) {
    const hasCanvas = await evaluate(`Boolean(document.querySelector('canvas'))`);
    if (hasCanvas) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  await new Promise((r) => setTimeout(r, 1200));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/04_stock_exchange_chart_dark.png");

  // Test Range Selector "ALL"
  console.log("Clicking ALL in chart controls...");
  await evaluate(`
    (() => {
      const allBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'ALL');
      if (allBtn) allBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1500));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/05_stock_exchange_all_chart.png");

  // Close Stock Exchange
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label*="Close"]') || Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('Close'));
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));

  // 5. Open Data Center
  console.log("Opening Data Center...");
  await evaluate(`
    (() => {
      const dataBld = Array.from(document.querySelectorAll('.city-building')).find(b => b.getAttribute('aria-label')?.includes('Data') || b.getAttribute('aria-label')?.includes('Oracle'));
      if (dataBld) dataBld.click();
      else {
        const anyBtn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label')?.includes('Oracle'));
        if (anyBtn) anyBtn.click();
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 1500));
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
  // Inspect agent hall building or open agent
  await evaluate(`
    (() => {
      // Find building b_agent or open agent panel
      const agentBtn = document.querySelector('button[title*="Agent Hall"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Agent Hall'));
      if (agentBtn) agentBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1500));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/07_agent_hall_dark.png");

  ws.close();
  console.log("UI verification complete!");
}

run().catch(console.error);
