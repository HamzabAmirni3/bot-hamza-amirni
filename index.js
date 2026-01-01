const settings = require('./settings');
global.settings = settings;
const Baileys = require('@whiskeysockets/baileys');
let makeInMemoryStoreFunc = Baileys.makeInMemoryStore || (Baileys.default && Baileys.default.makeInMemoryStore);

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidDecode,
    delay,
    Browsers
} = Baileys;
const makeInMemoryStore = typeof makeInMemoryStoreFunc === 'function' ? makeInMemoryStoreFunc : () => ({
    bind: () => { },
    loadMessage: async () => { },
    writeToFile: () => { },
    readFromFile: () => { },
    assertMessageList: () => ({})
});



// Persistent fallback to prevent crash
// Persistent fallback to prevent crash
// Baileys Store Fix - Direct Path Import
// let makeInMemoryStore; // Already declared at the top
// Cleaning up index.js...





// All store reassignments removed to avoid const error.

// Cleaned up.


// Store check completed

const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { Boom } = require('@hapi/boom');
const chalk = require('chalk');
const readline = require('readline');
const PhoneNumber = require('awesome-phonenumber');
const NodeCache = require('node-cache');
const express = require('express');

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute

// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...')
        process.exit(1) // Panel will auto-restart
    }
}, 30_000) // check every 30 seconds


// Filter console logs to suppress specific Baileys decryption and session noise
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

const silencePatterns = [
    'Bad MAC',
    'Session error',
    'Failed to decrypt',
    'Closing session',
    'Closing open session',
    'Conflict',
    'Stream Errored'
];

function shouldSilence(args) {
    const msg = args[0];
    if (typeof msg === 'string') {
        return silencePatterns.some(pattern => msg.includes(pattern));
    }
    return false;
}

console.error = function (...args) {
    if (shouldSilence(args)) return;
    originalConsoleError.apply(console, args);
};

console.log = function (...args) {
    if (shouldSilence(args)) return;
    originalConsoleLog.apply(console, args);
};

console.warn = function (...args) {
    if (shouldSilence(args)) return;
    originalConsoleWarn.apply(console, args);
};

console.info = function (...args) {
    if (shouldSilence(args)) return;
    originalConsoleInfo.apply(console, args);
};

const app = express();
const port = process.env.PORT || 8000;

// Ensure data directory exists
const dataDirPath = path.join(__dirname, 'data');
if (!fs.existsSync(dataDirPath)) {
    try {
        fs.mkdirSync(dataDirPath, { recursive: true });
        console.log('✅ Created data directory');
    } catch (e) {
        console.error('❌ Failed to create data directory:', e.message);
    }
}
try {
    // Try to touch a file to check writability
    const testFile = path.join(dataDirPath, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    // If writable, try to fix permissions for existing files
    const files = fs.readdirSync(dataDirPath);
    files.forEach(file => {
        try {
            fs.chmodSync(path.join(dataDirPath, file), 0o666);
        } catch (e) { }
    });
} catch (e) {
    console.error('⚠️ Warning: Data directory is not writable. Some features may fail.', e.message);
}

const { smsg } = require('./lib/myfunc');
const { isOwner } = require('./lib/ownerCheck');

// Setup Store
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }).child({ level: 'silent', factory: 'WA.Store' }) });

const welcomedPath = path.join(__dirname, 'data/welcomed.json');
if (!global.welcomedUsers) {
    try {
        if (fs.existsSync(welcomedPath)) {
            global.welcomedUsers = new Set(JSON.parse(fs.readFileSync(welcomedPath)));
        } else {
            global.welcomedUsers = new Set();
        }
    } catch (e) { global.welcomedUsers = new Set(); }
}

// --- STARTUP CLEANUP ---
function cleanTempDirectories() {
    console.log(chalk.cyan('🧹 Starting cleanup...'));
    const dirs = ['./tmp', './temp']; // REMOVED ./session
    let deletedCount = 0;

    // 1. Clean Directories
    dirs.forEach(dir => {
        const fullPath = path.join(__dirname, dir);
        if (fs.existsSync(fullPath)) {
            try {
                // If it's session, don't delete creds.json or important keys
                if (dir === './session') {
                    // StartBot handles session clearing if needed, but we can clean garbage here if we want.
                    // Actually, let's NOT touch session here to avoid accidental logout.
                    return;
                }

                const files = fs.readdirSync(fullPath);
                files.forEach(file => {
                    const filePath = path.join(fullPath, file);
                    try {
                        const stats = fs.statSync(filePath);
                        if (stats.isFile()) {
                            fs.unlinkSync(filePath);
                            deletedCount++;
                        }
                    } catch (e) {
                        console.error(`Failed to delete ${file}:`, e.message);
                    }
                });
            } catch (err) {
                console.error(`Error cleaning ${dir}:`, err.message);
            }
        } else {
            if (dir !== './session') fs.mkdirSync(fullPath, { recursive: true });
        }
    });

    // 2. Delete .backup files in root
    try {
        const rootFiles = fs.readdirSync(__dirname);
        rootFiles.forEach(file => {
            if (file.endsWith('.backup') || file.endsWith('.tmp')) {
                try {
                    fs.unlinkSync(path.join(__dirname, file));
                    deletedCount++;
                    console.log(chalk.gray(`Deleted backup: ${file}`));
                } catch (e) { }
            }
        });
    } catch (e) { }

    console.log(chalk.green(`✅ Cleanup finished. Removed ${deletedCount} files.`));
}

// Run cleanup immediately
cleanTempDirectories();

// Command Handler (Legacy Support)
// lib/handler.js exports the function directly, so we just require it.
const commandHandler = require('./lib/handler');

// Global Settings
// Ensure pairingCode is true if a number is present in settings
global.phoneNumber = settings.pairingNumber || '';
const pairingCode = !!settings.pairingNumber || !!global.phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");
const sessionDir = './session';
const msgRetryCounterCache = new NodeCache();

// Setup Express for Keep-Alive
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(port, () => console.log(`Port ${port} is open`));

// Readline Interface for interactive input
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// --- SESSION SYNC LOGIC ---
async function syncSession() {
    const sessionID = process.env.SESSION_ID;
    if (!sessionID) return;

    try {
        console.log(chalk.cyan('🔄 SESSION_ID detected, syncing session...'));
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        // Format: Session~<base64_encoded_creds>
        const encodedData = sessionID.split('Session~')[1] || sessionID;
        const decodedData = Buffer.from(encodedData, 'base64').toString('utf-8');
        const creds = JSON.parse(decodedData);

        fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(creds, null, 2));
        console.log(chalk.green('✅ Session successfully restored from SESSION_ID'));
    } catch (e) {
        console.error('❌ Failed to restore session from SESSION_ID:', e.message);
    }
}

async function startBot() {
    await syncSession();
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: Browsers.ubuntu('Chrome'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        getMessage: async (key) => {
            const jid = Baileys.jidNormalizedUser(key.remoteJid);
            const msg = await store.loadMessage(jid, key.id);
            return msg?.message || { conversation: settings.botName || 'Hamza Amirni' };
        },

        msgRetryCounterCache,
        defaultQueryTimeoutMs: 90000, // Increased timeout
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        emitOwnEvents: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        retryRequestDelayMs: 5000,
    });





    global.sock = sock;
    store.bind(sock.ev);

    // Helper: Decode JID
    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server && decode.user + '@' + decode.server || jid;
        } else return jid;
    };

    // Pairing Code Logic
    if (pairingCode && !sock.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api');

        // Check settings or ask user
        let phoneNumber = global.phoneNumber || settings.pairingNumber;

        if (!phoneNumber) {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFormat: 2126... (without + or spaces) : `)));
        }

        // Clean number
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (phoneNumber) {
            await delay(3000);
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(chalk.black(chalk.bgGreen(`🚀 Requesting Pairing Code for: ${phoneNumber}...`)));
                console.log(chalk.black(chalk.bgWhite(`Your Pairing Code : `)), chalk.black(chalk.bgRed(` ${code} `)));
                console.log(chalk.green(`\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code shown above`));
            } catch (e) {
                console.error('Error requesting pairing code:', e.message);
            }
        }
    }

    // Connection Updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'connecting') {
            console.log(chalk.blue('⏳ Connecting to WhatsApp...'));
        }

        if (connection === 'open') {
            console.log(chalk.green(`\n🌿Connected to => ${JSON.stringify(sock.user, null, 2)}\n`));
            console.log(chalk.bgGreen.black('\n                  [ حمزة اعمرني ]                  \n'));
            console.log(chalk.cyan('< ================================================== >\n'));
            console.log(chalk.white(`• YouTube: ${settings.youtube}`));
            console.log(chalk.white(`• Instagram: ${settings.instagram}`));
            console.log(chalk.white(`• WhatsApp: https://wa.me/${settings.ownerNumber[0]}`));
            console.log(chalk.white(`• Developer: حمزة اعمرني`));
            console.log(chalk.green(`• 🤖 Bot Connected Successfully! ✅`));
            console.log(chalk.white(`Bot Version: ${settings.version || '2.0.0'}`));

            // Send Connected Message to Self (Bot Number)
            setTimeout(async () => {
                try {
                    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

                    // Prepare Thumbnail
                    let thumbBuffer = null;
                    try {
                        const thumbPath = path.resolve(__dirname, settings.botThumbnail || './media/hamza.jpg');
                        if (fs.existsSync(thumbPath)) {
                            thumbBuffer = fs.readFileSync(thumbPath);
                        }
                    } catch (e) { console.error('Error reading thumbnail for startup msg:', e); }

                    const msgText = `🤖 *Bot Connected Successfully!* ✅\n\n` +
                        `• *Version:* ${settings.version || '2.0.0'}\n` +
                        `• *Mode:* ${settings.commandMode || 'Public'}\n` +
                        `• *Prefix:* ${settings.prefix}\n\n` +
                        `🔗 *Socials:*\n` +
                        `• 📺 YouTube: ${settings.youtube}\n` +
                        `• 📸 Instagram: ${settings.instagram}\n` +
                        `• 📢 Channel: ${settings.officialChannel}\n\n` +
                        `🚀 *Ready to serve!*`;

                    if (thumbBuffer) {
                        // Send as image with caption
                        await sock.sendMessage(botJid, {
                            image: thumbBuffer,
                            caption: msgText
                        });
                    } else {
                        // Fallback to text only
                        await sock.sendMessage(botJid, {
                            text: msgText
                        });
                    }

                    // --- SEND SESSION ID TO OWNER (Only if not already set in ENV) ---
                    if (!process.env.SESSION_ID) {
                        setTimeout(async () => {
                            try {
                                const credsPath = path.join(sessionDir, 'creds.json');
                                if (fs.existsSync(credsPath)) {
                                    const creds = fs.readFileSync(credsPath, 'utf-8');
                                    const sessionID = 'Session~' + Buffer.from(creds).toString('base64');

                                    const sessionMsg = `🔐 *YOUR SESSION ID* 🔐\n\n` +
                                        `Keep this safe! This ID allows you to reconnect without a Pairing Code.\n\n` +
                                        `\`${sessionID}\`\n\n` +
                                        `Add this to your *SESSION_ID* environment variable on Koyeb to keep the bot alive forever! 🚀`;

                                    if (sock.user && !sock.isClosed) {
                                        await sock.sendMessage(botJid, { text: sessionMsg });
                                        console.log(chalk.green('✅ Session ID sent to bot number.'));
                                    }
                                }
                            } catch (e) { }
                        }, 15000);
                    } else {
                        console.log(chalk.cyan('ℹ️ SESSION_ID is already configured. Skipping auto-send to prevent loop.'));
                    }
                } catch (err) {
                    console.error('Failed to send self-connected message:', err);
                }
            }, 2000);

            // Background Services with stabilization delay
            setTimeout(() => {
                if (!sock.user) return;

                console.log(chalk.cyan('⏳ Starting background services...'));

                try { require('./commands/ad3iya').startScheduler(sock); } catch (e) { }
                try { require('./commands/salat').startPrayerScheduler(sock); } catch (e) { }
                try { require('./lib/groupScheduler').startScheduler(sock); } catch (e) { }
            }, 5000);
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error?.output?.statusCode) || (lastDisconnect?.error?.code);
            const reason = lastDisconnect?.error?.message || (new Boom(lastDisconnect?.error)?.output?.payload?.message) || 'not specified';
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(chalk.red(`❌ Connection closed. Status: ${statusCode} | Reason: ${reason} | Reconnecting: ${shouldReconnect}`));

            if (statusCode === 401) {
                console.log(chalk.red(`⚠️ Session invalid or logged out (401). Clearing session and restarting...`));
                try {
                    if (fs.existsSync(sessionDir)) {
                        fs.rmSync(sessionDir, { recursive: true, force: true });
                        console.log(chalk.yellow('✅ Session folder cleared to fix connection loop.'));
                    }
                } catch (error) { }
                setTimeout(() => startBot(), 5000);
                return;
            }

            if (shouldReconnect || statusCode === 515) {
                const retryDelay = 5000;
                console.log(chalk.yellow(`🔄 Reconnecting in ${retryDelay / 1000}s...`));
                setTimeout(() => startBot(), retryDelay);
            } else {
                console.log(chalk.red(`💀 Connection terminated. Manual restart may be required.`));
                process.exit(1);
            }
        }
    });


    sock.ev.on('creds.update', saveCreds);

    // 🚀 CACHE TO PREVENT DUPLICATE PROCESSING (History Replay)
    if (!global.processedMessages) global.processedMessages = new NodeCache({ stdTTL: 600, checkperiod: 60 });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (chatUpdate.type !== 'notify') return; // Skip history sync batches directly

            let msg = chatUpdate.messages[0];
            if (!msg.message) return;

            // 🕒 FILTER OLD MESSAGES (History Sync)
            const currentTime = Math.floor(Date.now() / 1000);
            if (msg.messageTimestamp < currentTime - 45) return;

            // 🛡️ PREVENT DUPLICATE PROCESSING
            const msgId = msg.key.id;
            if (global.processedMessages.has(msgId)) return;
            global.processedMessages.set(msgId, true);

            // Serialize message
            msg = smsg(sock, msg, store);



            if (msg.key.remoteJid === 'status@broadcast') {

                try {
                    const { handleStatusUpdate } = require('./commands/autostatus');
                    await handleStatusUpdate(sock, msg);
                } catch (e) { }
                return; // Don't process status updates as normal messages
            }

            // Antidelete Store Hook

            try {
                const { storeMessage } = require('./commands/antidelete');
                await storeMessage(sock, msg);
            } catch (e) { }

            // Allow commands from self to enable features on bot number
            if (msg.key.fromMe) {
                const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '');
                if (!text.startsWith(settings.prefix)) return;
            }


            // Autowelcome Logic
            if (msg.key.remoteJid && !msg.key.remoteJid.endsWith('@g.us') && !msg.key.fromMe) {
                const isUserOwner = isOwner(msg);
                const { readState: readPmState } = require('./commands/pmblocker');
                const pmState = readPmState();

                const { loadAutoWelcomeState } = require('./commands/autowelcome');
                const welcomeEnabled = loadAutoWelcomeState();

                if (welcomeEnabled && !pmState.enabled) {
                    if (!global.welcomedUsers) global.welcomedUsers = new Set();
                    if (!global.welcomedUsers.has(msg.key.remoteJid)) {
                        const settings = require('./settings');
                        const { sendWithChannelButton } = require('./lib/channelButton');

                        // 1. Send Main Welcome Message
                        // 1. Send Main Welcome Message
                        const welcomeText = `مرحباً بك يا @${msg.key.remoteJid.split('@')[0]} في عالم ${settings.botName} ⚔️
✨ *نحن نصنع التميز الرقمي* ✨

أنا هنا لخدمتك بكل احترافية. يمكنك الاطلاع على خدماتنا وأوامرنا من خلال القائمة.

📍 للبدء، أرسل: ${settings.prefix}menu
📋 معلومات المطور: ${settings.prefix}owner

⭐️ نتمنى لك تجربة ممتعة ومفيدة!`;

                        await sock.sendMessage(msg.key.remoteJid, {
                            text: welcomeText,
                            mentions: [msg.key.remoteJid]
                        });

                        // 2. Send Social Media Accounts Message
                        const socialMsg = `✨ *HAMZA AMIRNI - OFFICIAL CHANNELS* ✨

🚀 تخصصنا هو تحويل الأفكار إلى واقع رقمي!
🛠️ *الخدمات:* تصميم المواقع (Web Design) وتطوير البوتات.

🌐 *شوف المشاريع ديالي كاملة:*
${settings.portfolio}

🔗 *روابط التواصل:*
📸 *Instagram:*
   🔹 الحساب 1: ${settings.instagram}
   🔹 الحساب 2: ${settings.instagram2}
   🔹 القناة: ${settings.instagramChannel}
👤 *Facebook:*
   🔹 البروفايل: ${settings.facebook}
   🔹 الصفحة الرسمية: ${settings.facebookPage}
✈️ *Telegram:* ${settings.telegram}
🎥 *YouTube:* ${settings.youtube}
👥 *المجموعات:* ${settings.waGroups}
🔔 *القناة:* ${settings.officialChannel}

💡 نحن نطور مستقبلك الرقمي!`;

                        await sendWithChannelButton(sock, msg.key.remoteJid, socialMsg);

                        global.welcomedUsers.add(msg.key.remoteJid);
                        try {
                            fs.writeFileSync(welcomedPath, JSON.stringify([...global.welcomedUsers]));
                        } catch (e) { }

                        // Auto-subscribe to ad3iya
                        const { autoSubscribe } = require('./commands/ad3iya');
                        autoSubscribe(msg.key.remoteJid);

                        // Auto-subscribe to salat
                        const { autoSubscribe: autoSubscribeSalat } = require('./commands/salat');
                        autoSubscribeSalat(msg.key.remoteJid);
                    }
                }
            }

            // Integrate with existing Handler
            // FIX: Call the function directly as it is exported directly from lib/handler.js
            if (typeof commandHandler === 'function') {
                await commandHandler(sock, msg);
            } else if (commandHandler && typeof commandHandler.handleMessage === 'function') {
                // Fallback if structure changes
                await commandHandler.handleMessage(sock, msg);
            }
        } catch (err) {
            console.error('Error in message upsert:', err);
        }
    });



    // Antidelete Revocation Hook
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.protocolMessage?.type === 0 || update.update.protocolMessage?.type === 14) {
                try {
                    const { handleMessageRevocation } = require('./commands/antidelete');
                    await handleMessageRevocation(sock, update);
                } catch (e) {
                    console.error('Antidelete revocation error:', e);
                }
            }
        }
    });

    // Group Participants Update Hook (Welcome/Goodbye/Promote/Demote)
    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action, author } = anu;

        try {
            if (action === 'promote') {
                const { handlePromotionEvent } = require('./commands/promote');
                if (handlePromotionEvent) await handlePromotionEvent(sock, id, participants, author);
            } else if (action === 'demote') {
                const { handleDemotionEvent } = require('./commands/demote');
                if (handleDemotionEvent) await handleDemotionEvent(sock, id, participants, author);
            }
            // Add Welcome/Goodbye logic here if needed
        } catch (e) {
            console.error('Group Event Error:', e);
        }
    });

    // Anticall implementation
    sock.ev.on('call', async (call) => {
        const { readState } = require('./commands/anticall');
        const state = readState();
        if (state.enabled) {
            for (const c of call) {
                if (c.status === 'offer') {
                    try {
                        const settings = require('./settings');
                        // Send warning message before rejecting and blocking
                        const warningMsg = `📵 *تنبيه: المكالمات ممنوعة!*

عذراً، المكالمات غير مسموح بها. سيتم رفض المكالمة وحظرك تلقائياً! 🚫

💻 *شعارنا: نحن نطور مستقبلك الرقمي*
✨ خدماتنا: تصميم المواقع وبوتات واتساب المتطورة.

🚀 *شوف المشاريع ديالي كاملة:*
${settings.portfolio}

🔗 *تابعني لتبقى على اتصال:*
📸 *Instagram:* ${settings.instagram}
👤 *Facebook:* ${settings.facebookPage}
✈️ *Telegram:* ${settings.telegram}
🎥 *YouTube:* ${settings.youtube}
👥 *المجموعات:* ${settings.waGroups}
🔔 *القناة:* ${settings.officialChannel}

🛡️ *بواسطة:* ${settings.botName}`;

                        await sock.sendMessage(c.from, { text: warningMsg });


                        // Small delay before rejecting to ensure message is sent
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // Reject the call
                        await sock.rejectCall(c.id, c.from);

                        // Block the caller
                        await sock.updateBlockStatus(c.from, 'block');

                        console.log(`📞 Rejected call from ${c.from}, sent warning, and blocked user`);
                    } catch (error) {
                        console.error('Error handling call rejection:', error);
                        // Still try to reject even if message fails
                        try {
                            await sock.rejectCall(c.id, c.from);
                            await sock.updateBlockStatus(c.from, 'block');
                        } catch (e) {
                            console.error('Failed to reject/block call:', e);
                        }
                    }
                }
            }
        }
    });

    // Stability: Handle crashes gracefully and keep process alive
    process.on('uncaughtException', (err) => {
        console.error('Critical Uncaught Exception:', err);
        // Don't exit immediately, try to keep going
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    // Periodic check for schedulers/reminders
    setInterval(() => {
        try {
            const { checkAndSendReminder } = require('./commands/autoreminder');
            checkAndSendReminder(sock);
        } catch (e) { }
    }, 30000);
}



// Start with exponential backoff if it fails to start initially
startBot().catch(err => {
    console.error('Failed to start bot:', err);
    setTimeout(() => {
        console.log('🔄 Retrying start...');
        startBot();
    }, 10000);
});
