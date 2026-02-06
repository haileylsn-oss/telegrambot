import fetch from "node-fetch"; // Node 20+ supports native fetch, but keep this if older
import TelegramBot from "node-telegram-bot-api";
import express from "express";

const app = express();
app.use(express.json());

// ---------------- JSONBin Config ----------------
const JSONBIN_ID = "6985e32643b1c97be96a17a2";
const JSONBIN_API_KEY = "$2a$10$yti1izYQ7PKY9IhwxrQiuuIk8TZDdxM6nzYFnduMOvJtKIdyRhBB.";
const JSONBIN_HEADERS = {
  "X-Master-Key": JSONBIN_API_KEY,
  "Content-Type": "application/json"
};

let config = null;
let botsInstances = [];
let isRunning = false;

// ---------------- Fetch Config ----------------
async function fetchConfig() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`, {
      headers: JSONBIN_HEADERS
    });
    const data = await res.json();
    config = data.record;
    console.log("✅ Config loaded from JSONBin");
  } catch (err) {
    console.error("❌ Failed to fetch config:", err);
  }
}

// ---------------- Initialize Bots ----------------
function initBots() {
  if (!config || !config.bots) return;

  // Only enabled bots
  botsInstances = config.bots
    .filter(bot => bot.enabled)
    .map(bot => ({
      name: bot.name,
      bot: new TelegramBot(bot.token, { polling: false }),
      messages: bot.messages
    }));
}

// ---------------- Send All Messages Once ----------------
async function sendAllMessages() {
  if (isRunning) return;
  isRunning = true;

  if (!config || !botsInstances.length) {
    console.log("❌ No bots configured or enabled.");
    isRunning = false;
    return;
  }

  const chatId = config.chatId;
  const maxMessages = Math.max(...botsInstances.map(b => b.messages.length));

  console.log("▶️ Starting bot conversation...");

  for (let i = 0; i < maxMessages; i++) {
    for (let bot of botsInstances) {
      if (i < bot.messages.length) {
        try {
          await bot.bot.sendMessage(chatId, bot.messages[i]);
          console.log(`✅ ${bot.name}: ${bot.messages[i]}`);
        } catch (err) {
          console.error(`❌ ${bot.name} error:`, err.message);
        }

        // Delay 0.5–1.5 seconds between messages
        await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
      }
    }
  }

  console.log("✅ All messages sent. Bot stopped.");
  isRunning = false;
}

// ---------------- Express API for Admin Panel ----------------
app.post("/run-bot", async (req, res) => {
  try {
    await fetchConfig(); // always get latest config
    initBots();
    sendAllMessages(); // run once
    res.json({ success: true, message: "Bot started sending messages" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to run bot" });
  }
});

// Optional: endpoint to test config
app.get("/config", (req, res) => res.json(config || {}));

// ---------------- Start Server ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot server running on port ${PORT}`));
