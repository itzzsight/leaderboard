require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API_URL = 'https://api.roulobets.com/v1/external/affiliates';
const API_KEY = process.env.ROULOBETS_API_KEY;

const CHANNEL_ID = process.env.LEADERBOARD_CHANNEL_ID;

let leaderboardMessage = null;

// Get today's date (YYYY-MM-DD)
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// Fetch API data
async function fetchLeaderboard() {
  const today = getToday();

  const res = await axios.get(API_URL, {
    params: {
      start_at: today,
      end_at: today,
      key: API_KEY,
    },
  });

  return res.data;
}

// Build embed
function buildEmbed(data) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 Wager Leaderboard')
    .setColor(0x00ff99)
    .setTimestamp();

  const list = data?.data || [];

  if (!list.length) {
    embed.setDescription("No data available.");
    return embed;
  }

  const sorted = list.sort((a, b) => (b.wagered || 0) - (a.wagered || 0));

  let desc = '';

  sorted.slice(0, 10).forEach((u, i) => {
    desc += `**#${i + 1}** ${u.username || 'Unknown'} — $${Number(u.wagered || 0).toLocaleString()}\n`;
  });

  embed.setDescription(desc);

  return embed;
}

// Update leaderboard
async function updateLeaderboard() {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    const data = await fetchLeaderboard();
    const embed = buildEmbed(data);

    if (!leaderboardMessage) {
      leaderboardMessage = await channel.send({ embeds: [embed] });
    } else {
      await leaderboardMessage.edit({ embeds: [embed] });
    }

    console.log('Leaderboard updated');
  } catch (err) {
    console.error('Error updating leaderboard:', err.message);
  }
}

// Bot ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await updateLeaderboard();

  setInterval(updateLeaderboard, 15 * 60 * 1000);
});

// Login
client.login(process.env.DISCORD_TOKEN);