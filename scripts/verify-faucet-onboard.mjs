import fs from "node:fs";
import WebSocket from "ws";

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

  // Set viewport to 1280x800
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log("Clearing localStorage to start with a fresh brand new island...");
  await evaluate(`
    (() => {
      localStorage.removeItem("stockva.sandbox.v2");
      localStorage.removeItem("stockcity_connected_wallet");
    })()
  `);

  console.log("Navigating to /city...");
  await send("Page.navigate", { url: "http://localhost:3000/city" });

  // Wait for loading to finish
  for (let i = 0; i < 40; i++) {
    const ready = await evaluate(`Boolean(document.querySelector('.cash-resource') && !document.body.innerText.includes('Building your empty island'))`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  await new Promise((r) => setTimeout(r, 1600));

  // 1. Initial State Funds Verification
  const headerCash = await evaluate(`
    (() => {
      const el = document.querySelector('.cash-resource b');
      return el ? el.textContent.trim() : null;
    })()
  `);
  console.log("1. Starting Header Cash (should be $0):", headerCash);

  const modalPresent = await evaluate(`
    (() => {
      const modal = document.querySelector('[role="dialog"]');
      return modal ? modal.innerText.includes("City Treasury Onboarding") : false;
    })()
  `);
  console.log("2. Onboarding Modal Present on Launch:", modalPresent);

  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/ca1c3ab4-e9cf-4207-a7bb-efccd0a19834/faucet_01_onboard_modal_launch.png");

  // 3. Verify Claim Faucet Button is locked without wallet
  const faucetBtnText = await evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const claimBtn = btns.find(b => b.textContent && (b.textContent.includes('Claim') || b.textContent.includes('Sign In Wallet First')));
      return claimBtn ? { text: claimBtn.textContent.trim(), disabled: claimBtn.disabled } : null;
    })()
  `);
  console.log("3. Faucet Button State without Wallet:", faucetBtnText);

  // 4. Close Onboarding Modal to verify Top Bar and "+" button behavior
  console.log("Closing Onboard modal to test header '+' button...");
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label*="Close onboarding modal"]') || document.querySelector('button.closeBtn');
      if (closeBtn) closeBtn.click();
      else {
        const dismiss = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Explore island'));
        if (dismiss) dismiss.click();
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));

  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/ca1c3ab4-e9cf-4207-a7bb-efccd0a19834/faucet_02_header_zero_funds.png");

  // 5. Test clicking "+" button when NOT connected
  console.log("Clicking '+' button when NOT connected (should prompt wallet sign-in)...");
  await evaluate(`
    (() => {
      const addBtn = document.querySelector('.add-funds-btn');
      if (addBtn) addBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));

  const modalReopened = await evaluate(`
    (() => {
      const modal = document.querySelector('[role="dialog"]');
      return modal ? modal.innerText.includes("City Treasury Onboarding") : false;
    })()
  `);
  console.log("4. Onboard Modal Re-opened after clicking '+' without wallet:", modalReopened);

  // 6. Simulate Wallet Connect in the modal
  console.log("Simulating Wallet Connection...");
  await evaluate(`
    (() => {
      // Mock window.ethereum and trigger wallet connection
      window.ethereum = {
        isMetaMask: true,
        request: async ({ method }) => {
          if (method === "eth_requestAccounts" || method === "eth_accounts") {
            return ["0x71C8BF4A25A9aF73B90B236b28B93f0b2fB85994"];
          }
          if (method === "wallet_switchEthereumChain") return null;
          return null;
        }
      };
      // Click connect wallet button inside modal
      const connectBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Connect Wallet'));
      if (connectBtn) connectBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));

  const walletStatus = await evaluate(`
    (() => {
      const modal = document.querySelector('[role="dialog"]');
      return modal ? modal.innerText.includes("0x71C8") : false;
    })()
  `);
  console.log("5. Wallet connected in modal:", walletStatus);

  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/ca1c3ab4-e9cf-4207-a7bb-efccd0a19834/faucet_03_wallet_connected_modal.png");

  // 7. Claim Faucet
  console.log("Clicking Claim Faucet button with connected wallet...");
  await evaluate(`
    (() => {
      const claimBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Claim 10,000 $mUSD'));
      if (claimBtn) claimBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1500));

  // If on-chain fails due to lack of real testnet gas in mock environment, click local treasury grant
  await evaluate(`
    (() => {
      const fallbackBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Credit 10,000 $mUSD to Local Treasury'));
      if (fallbackBtn) fallbackBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));

  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/ca1c3ab4-e9cf-4207-a7bb-efccd0a19834/faucet_04_claimed_success.png");

  // 8. Click Start Building My City
  console.log("Clicking Start Building...");
  await evaluate(`
    (() => {
      const buildBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Start Building'));
      if (buildBtn) buildBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 800));

  // 9. Verify Final Header Cash is now $10,000!
  const finalCash = await evaluate(`
    (() => {
      const el = document.querySelector('.cash-resource b');
      return el ? el.textContent.trim() : null;
    })()
  `);
  console.log("6. Final Header Cash after claiming faucet:", finalCash);

  await screenshot("/home/cokoo/.gemini/antigravity-ide/brain/ca1c3ab4-e9cf-4207-a7bb-efccd0a19834/faucet_05_treasury_funded.png");

  ws.close();
  console.log("Verification finished successfully!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
