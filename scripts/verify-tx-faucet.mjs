import http from "node:http";
import fs from "node:fs";

async function cdpSend(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1000000);
  return new Promise((resolve, reject) => {
    const handleMsg = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.off("message", handleMsg);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on("message", handleMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  const WebSocket = (await import("ws")).default;
  const listRes = await fetch("http://127.0.0.1:9222/json/list");
  const listData = await listRes.json();
  const page = listData.find((t) => t.type === "page") || listData[0];
  if (!page) throw new Error("No page found on port 9222");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.on("open", resolve));

  async function send(method, params) {
    return cdpSend(ws, method, params);
  }

  async function evaluate(expression) {
    const res = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      console.error("Eval error:", res.exceptionDetails);
    }
    return res.result?.value;
  }

  async function screenshot(filename) {
    const res = await send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    fs.writeFileSync(filename, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  }

  console.log("Seeding fresh sandbox city with $50,000 cash...");
  await evaluate(`
    (() => {
      const demoCity = {
        version: 2,
        cash: 50000,
        buildings: [
          { id: "b_hall", kind: "hall", r: 0, c: 0, cost: 250, entry: 250, quantity: 1 },
          { id: "b_exch", kind: "exchange", r: 2, c: 2, cost: 400, entry: 400, quantity: 1 },
          { id: "b_tsla", kind: "tesla", r: -2, c: 2, cost: 700, entry: 350, quantity: 2 }
        ],
        roads: [
          { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: -1, c: 0 },
          { r: 1, c: 1 }, { r: -1, c: 1 }, { r: 1, c: -1 }, { r: -1, c: -1 }
        ],
        paper: []
      };
      localStorage.setItem("stockva.sandbox.v2", JSON.stringify(demoCity));
    })()
  `);

  console.log("Navigating to /city...");
  await send("Page.navigate", { url: "http://localhost:3000/city" });
  for (let i = 0; i < 30; i++) {
    const ready = await evaluate(`Boolean(document.querySelector('.cash-resource') && !document.body.innerText.includes('Building your empty island'))`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  await new Promise((r) => setTimeout(r, 1500));

  // 1. Initial cash verification
  const initialCash = await evaluate(`
    (() => {
      const el = document.querySelector('.cash-resource b');
      return el ? el.textContent : null;
    })()
  `);
  console.log("Initial Header Cash:", initialCash);

  // 2. Open City Hall
  console.log("Opening City Hall...");
  await evaluate(`
    (() => {
      const cashBtn = document.querySelector('.cash-resource') || document.querySelector('.portfolio-resource');
      if (cashBtn) cashBtn.click();
    })()
  `);
  for (let i = 0; i < 20; i++) {
    const modalReady = await evaluate(`Boolean(document.querySelector('button[aria-label*="Close"]'))`);
    if (modalReady) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  await new Promise((r) => setTimeout(r, 600));

  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/faucet_01_city_hall_demo.png");

  // 3. Test Claim Demo Cash via City Hall "+ $10k Demo" button
  console.log("Clicking +$10k Demo button inside City Hall...");
  const clickedDemoCityHall = await evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Demo') || b.textContent.includes('10k')));
      if (btn) {
        btn.click();
        return btn.textContent.trim();
      }
      return false;
    })()
  `);
  console.log("Clicked City Hall demo button:", clickedDemoCityHall);
  await new Promise((r) => setTimeout(r, 800));

  const cashAfterCityHallClaim = await evaluate(`
    (() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const metric = allDivs.find(d => d.textContent && d.textContent.includes('Available city cash'));
      return metric ? metric.querySelector('strong')?.textContent : null;
    })()
  `);
  console.log("Cash in City Hall after +$10k Demo:", cashAfterCityHallClaim);

  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/faucet_02_after_demo_claim.png");

  // Scroll down to show treasury buttons (+ $10k Demo Cash and Connect wallet)
  await evaluate(`
    (() => {
      const b = document.querySelector('div[class*="body"]');
      if (b) b.scrollTop = 280;
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));
  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/faucet_02b_treasury_buttons.png");

  // Close City Hall
  console.log("Closing City Hall...");
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label*="Close"]');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 800));

  // 4. Test Top Bar "+" button to add demo funds
  console.log("Clicking Header '+' button to add funds...");
  await evaluate(`
    (() => {
      const addBtn = document.querySelector('.add-funds-btn');
      if (addBtn) addBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 800));

  const cashAfterHeaderPlus = await evaluate(`
    (() => {
      const el = document.querySelector('.cash-resource b');
      return el ? el.textContent : null;
    })()
  `);
  console.log("Cash in Header after '+' click:", cashAfterHeaderPlus);

  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/faucet_03_header_cash_updated.png");

  // 5. Test Selecting Tesla and Selling it
  console.log("Clicking Tesla building on island...");
  await evaluate(`
    (() => {
      const tsla = Array.from(document.querySelectorAll('.city-building')).find(b => b.getAttribute('aria-label')?.includes('Tesla'));
      if (tsla) tsla.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));

  console.log("Clicking Sell & remove in inspection panel...");
  const sellResult = await evaluate(`
    (() => {
      const panel = document.querySelector('.inspection-panel');
      if (!panel) return 'no inspection panel';
      const btn = Array.from(panel.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Sell & remove'));
      if (btn) {
        btn.click();
        return 'clicked sell';
      }
      return 'no sell button';
    })()
  `);
  console.log("Sell action result:", sellResult);
  await new Promise((r) => setTimeout(r, 1500));

  const cashAfterSell = await evaluate(`
    (() => {
      const el = document.querySelector('.cash-resource b');
      return el ? el.textContent : null;
    })()
  `);
  console.log("Cash after selling TSLA:", cashAfterSell);

  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/0a1d5099-7ee1-42b6-899e-93c5b6c0e045/faucet_04_cash_after_sale.png");

  ws.close();
  console.log("All tests completed successfully!");
}

run().catch(console.error);
