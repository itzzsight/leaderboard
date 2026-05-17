require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API_URL = 'https://api.roulobets.com/v1/external/affiliates';

let leaderboardMessage = null;

let started = false;
let lastUpdate = 0;
const COOLDOWN = 15 * 60 * 1000;

// =====================
// DATE
// =====================
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// =====================
// API
// =====================
async function fetchLeaderboard() {
  const today = getToday();

  const res = await axios.get(API_URL, {
    params: {
      start_at: today,
      end_at: today,
      key: process.env.ROULOBETS_API_KEY,
    },
  });

  return res.data?.data || [];
}

// =====================
// EMBED
// =====================
function buildEmbed(list) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 Wager Leaderboard')
    .setColor(0xFFD700)
    .setFooter({ text: 'Updates every 15 minutes' })
    .setTimestamp();

  if (!list.length) {
    embed.setDescription("No data available.");
    return embed;
  }

  const sorted = list
    .sort((a, b) => (b.wagered || 0) - (a.wagered || 0))
    .slice(0, 10);

  let desc = "";

  sorted.forEach((u, i) => {
    const name = u.username || "Unknown";
    const wager = Number(u.wagered || 0).toLocaleString();

    const medal =
      i === 0 ? "🥇" :
      i === 1 ? "🥈" :
      i === 2 ? "🥉" : `**${i + 1}.**`;

    desc += `${medal} **${name}** → 💰 $${wager}\n`;
  });

  embed.setDescription(desc);

  return embed;
}

// =====================
// MESSAGE ID HELPERS (CHANNEL TOPIC STORAGE)
// =====================
function getMessageIdFromTopic(topic) {
  const match = topic?.match(/leaderboardMessageId=(\d+)/);
  return match ? match[1] : null;
}

function setMessageIdInTopic(topic, id) {
  const base = (topic || '').replace(/leaderboardMessageId=\d+/, '').trim();
  return `${base} leaderboardMessageId=${id}`.trim();
}

// =====================
// UPDATE
// =====================
async function updateLeaderboard() {
  try {
    const now = Date.now();

    if (now - lastUpdate < COOLDOWN) {
      console.log("Skipped update (cooldown)");
      return;
    }

    lastUpdate = now;

    const data = await fetchLeaderboard();
    const embed = buildEmbed(data);

    if (leaderboardMessage) {
      await leaderboardMessage.edit({ embeds: [embed] });
    }

    console.log("Leaderboard updated ✔");

  } catch (err) {
    console.error("Update error:", err.message);
  }
}

// =====================
// READY
// =====================
client.once('ready', async () => {
  if (started) return;
  started = true;

  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.LEADERBOARD_CHANNEL_ID);

  // 🔥 TRY RECOVER MESSAGE FROM CHANNEL TOPIC
  const savedId = getMessageIdFromTopic(channel.topic);

  if (savedId) {
    try {
      leaderboardMessage = await channel.messages.fetch(savedId);
      console.log("Recovered old leaderboard message");
    } catch {
      leaderboardMessage = null;
    }
  }

  // 🔥 IF NO MESSAGE FOUND, CREATE ONE
  if (!leaderboardMessage) {
    leaderboardMessage = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 Wager Leaderboard")
          .setDescription("Initializing leaderboard...")
          .setColor(0xFFD700)
      ]
    });

    // SAVE MESSAGE ID INTO CHANNEL TOPIC
    await channel.setTopic(
      setMessageIdInTopic(channel.topic, leaderboardMessage.id)
    );

    console.log("Created and saved leaderboard message");
  }

  console.log("Bot ready — starting updates in 60s");

  setTimeout(() => {
    updateLeaderboard();
    setInterval(updateLeaderboard, COOLDOWN);
  }, 60000);
});

// =====================
// LOGIN
// =====================
client.login(process.env.DISCORD_TOKEN);
