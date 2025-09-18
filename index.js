require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

// ===== CONFIG =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID);

// ===== DB SETUP =====
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  telegramId: { type: String },
  uniqueId: { type: String, required: true, unique: true },
});

const Client = mongoose.model('Client', clientSchema);

// ===== UNIQUE ID FUNCTION =====
function makeShortId() {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return time.slice(-2) + rand;
}

// ===== BOT =====
const bot = new Telegraf(BOT_TOKEN);

// Middleware: allow only OWNER_ID
bot.use(async (ctx, next) => {
  if (ctx.from.id !== OWNER_ID) {
    return ctx.reply('🚫 You are not authorized to use this bot.');
  }
  return next();
});

// Start command
bot.start((ctx) => {
  ctx.reply(
    'Welcome! Choose an action:',
    Markup.keyboard([['➕ Add Client'], ['🔍 Search Client']])
      .resize()
      .oneTime()
  );
});

// ===== ADD CLIENT =====
let addStep = {};

bot.hears('➕ Add Client', (ctx) => {
  addStep[ctx.from.id] = { step: 'name' };
  ctx.reply('Please enter the client name (required):');
});

bot.on('text', async (ctx) => {
  const step = addStep[ctx.from.id];

  // Step 1: Get name
  if (step && step.step === 'name') {
    step.name = ctx.message.text.trim();
    step.step = 'telegramId';
    ctx.reply('Now enter the Telegram ID (optional, or type "-" to skip):');
    return;
  }

  // Step 2: Get Telegram ID
  if (step && step.step === 'telegramId') {
    const telegramId = ctx.message.text.trim() === '-' ? null : ctx.message.text.trim();

    const newClient = new Client({
      name: step.name,
      telegramId,
      uniqueId: makeShortId(),
    });

    try {
      await newClient.save();
      ctx.reply(
        `✅ Client Added:\n\n` +
        `👤 Name: ${newClient.name}\n` +
        `💬 Telegram ID: ${newClient.telegramId || 'N/A'}\n`+
        `\n🆔 Unique ID:\t\`${newClient.uniqueId}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      ctx.reply('❌ Error saving client (maybe duplicate ID). Try again.');
      console.error(err);
    }

    delete addStep[ctx.from.id];
    return;
  }
});

// ===== SEARCH CLIENT =====
let searchStep = {};

bot.hears('🔍 Search Client', (ctx) => {
  searchStep[ctx.from.id] = true;
  ctx.reply('Enter Name, Telegram ID, or Unique ID to search:');
});

bot.on('text', async (ctx) => {
  if (searchStep[ctx.from.id]) {
    const query = ctx.message.text.trim();

    const client = await Client.findOne({
      $or: [
        { name: query },
        { telegramId: query },
        { uniqueId: query },
      ],
    });

    if (client) {
      ctx.reply(
        `📌 Client Found:\n\n` +
        `👤 Name: ${client.name}\n` +
        `💬 Telegram ID: ${client.telegramId || 'N/A'}\n` +
        `🆔 Unique ID: ${client.uniqueId}`
      );
    } else {
      ctx.reply('❌ No client found.');
    }

    delete searchStep[ctx.from.id];
  }
});

// ===== START BOT =====
bot.launch();
console.log('🤖 Bot is running...');
