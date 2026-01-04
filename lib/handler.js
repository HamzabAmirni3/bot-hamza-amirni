const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const { t, getUserLanguage } = require('./language');
const { isOwner } = require('./ownerCheck');
const { getBotMode } = require('../commands/mode');
const { Antilink } = require('./antilink');
const { handleBadwordDetection } = require('./antibadword');
const { sendWithChannelButton } = require('./channelButton');



// Load all command files
const commands = new Map();
const commandsPath = path.join(__dirname, '../commands');

// Simple Anti-Spam Map
const spamMap = new Map();
const SPAM_THRESHOLD = 4000; // 4 seconds between commands (Anti-Ban)

// Load commands from directory
fs.readdirSync(commandsPath).forEach(file => {
    if (file.endsWith('.js')) {
        const commandName = file.replace('.js', '');
        const commandPath = path.join(commandsPath, file);
        try {
            commands.set(commandName, require(commandPath));
        } catch (error) {
            console.error(`Error loading command ${commandName}:`, error);
        }
    }
});

console.log(`✅ Loaded ${commands.size} commands`);

const { addUser } = require('./userLogger');

// Main message handler
async function handleMessage(sock, msg) {
    try {
        // Debug: Log that we received a message
        console.log('[Handler] 📨 Message received from:', msg.key.remoteJid);

        const senderId = msg.key.participant || msg.key.remoteJid;

        // Register user automatically
        try {
            // Updated to use the senderId directly for logging
            addUser({ id: senderId, name: msg.pushName || '' });
        } catch (e) {
            console.error('[Handler] Error in addUser:', e);
        }
        const messageType = Object.keys(msg.message || {})[0];
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');

        // Get message text using the serialized smsg fields for better reliability
        let messageText = (msg.text || msg.body || '').trim();

        // Check if message starts with prefix FIRST (before antilink)
        const isCommand = messageText.startsWith(settings.prefix);

        // --- LEVELING SYSTEM ---
        // --- LEVELING SYSTEM (DISABLED BY USER REQUEST) ---
        // try {
        //     const { addXp } = require('./leveling');
        //     // Give 10 XP per message (activity reward)
        //     const xpResult = addXp(senderId, 10);
        //
        //     if (xpResult.leveledUp) {
        //         const levelUpMsg = `🎉 *مبروك!* \n\n🆙 طلعتي لـ *Level ${xpResult.level}*\n💰 ربحتي مكافأة ديال الفلوس!`;
        //         await sock.sendMessage(chatId, { text: levelUpMsg }, { quoted: msg });
        //     }
        // } catch (e) {
        //     console.error('[Leveling] Error adding XP:', e);
        // }

        // Run Antilink and Antibadword checks for groups ONLY if it's NOT a command
        if (isGroup && !isCommand) {
            try {
                await Antilink(msg, sock);
                await handleBadwordDetection(sock, chatId, msg, messageText, senderId);
            } catch (e) {
                console.error('[Handler] Error in Group Protection hooks:', e);
            }
        }

        // --- GLOBAL FEATURES (Run on ALL messages) ---
        const isUserOwner = isOwner(msg);

        // 1. PM Blocker Logic (STRICT: Blocks everything in PM except owner)
        if (!isGroup && !msg.key.fromMe && !isUserOwner) {
            try {
                const { readState } = require('../commands/pmblocker');
                const pmState = readState();
                if (pmState.enabled) {
                    console.log(`[PM Blocker] Intercepted message from ${senderId}`);
                    const { sendWithChannelButton } = require('./channelButton');

                    // Send warning message
                    await sendWithChannelButton(sock, chatId, pmState.message, msg);

                    // Block user immediately
                    await sock.updateBlockStatus(chatId, 'block');
                    console.log(`[PM Blocker] ✅ Blocked user: ${senderId}`);
                    return; // Stop ALL further processing
                }
            } catch (e) {
                console.error('[PM Blocker] Error:', e);
            }
        }

        // 2. Auto-Read Logic
        try {
            const configPath = path.join(__dirname, '../data/config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath));
                if (config.AUTOREAD === "true") {
                    await sock.readMessages([msg.key]);
                }
            }
        } catch (e) { }

        // Check if message starts with prefix
        // 🚀 AUTO-DOWNLOAD LOGIC (No Prefix) 🚀
        if (!messageText.startsWith(settings.prefix)) {
            const cleanText = messageText.trim();
            let autoCommand = null;

            // Strict URL detection: Must start with http/https or be a known domain pattern if it's just the link
            if (cleanText.startsWith('http') || cleanText.match(/^(www\.)?(facebook|fb|youtube|youtu|tiktok|instagram|mediafire)\./i)) {

                if (/(facebook\.com|fb\.watch|fb\.com)/i.test(cleanText)) {
                    autoCommand = 'facebook';
                } else if (/(youtube\.com|youtu\.be)/i.test(cleanText)) {
                    autoCommand = 'video';
                } else if (/(tiktok\.com)/i.test(cleanText)) {
                    autoCommand = 'tiktok';
                } else if (/(instagram\.com)/i.test(cleanText)) {
                    autoCommand = 'instagram';
                } else if (/(mediafire\.com)/i.test(cleanText)) {
                    autoCommand = 'mediafire';
                }

                if (autoCommand) {
                    console.log(`[Auto-Downloader] Detected ${autoCommand} link from ${senderId}`);

                    // Rewrite message to look like a command
                    const newText = `${settings.prefix}${autoCommand} ${cleanText}`;
                    messageText = newText;

                    // Update the actual message object so commands that read it directly (like video.js) work
                    if (msg.message.conversation) msg.message.conversation = newText;
                    else if (msg.message.extendedTextMessage) msg.message.extendedTextMessage.text = newText;
                    // Note: image/video captions not updated here, assuming links are text messages usually
                }
            }
        }

        // 3. TicTacToe & Hangman Move Logic (No Prefix Required)
        try {
            const ttt = require('../commands/tictactoe');
            if (ttt && typeof ttt.handleMove === 'function') {
                const handled = await ttt.handleMove(sock, chatId, senderId, messageText.trim().toLowerCase());
                if (handled) return; // Stop if move was handled
            }

            const hangman = require('../commands/hangman');
            if (hangman && typeof hangman.handleMove === 'function') {
                const handled = await hangman.handleMove(sock, chatId, senderId, messageText.trim().toLowerCase());
                if (handled) return; // Stop if move was handled
            }
        } catch (e) {
            console.error('[Game Handler Error]:', e);
        }

        if (!messageText.startsWith(settings.prefix)) {
            // Check for PDF Session (Collecting Images)
            try {
                const pdfCommand = require('../commands/pdf');
                if (pdfCommand && typeof pdfCommand.handleSession === 'function') {
                    await pdfCommand.handleSession(sock, msg, senderId);
                    // We don't return here because we might want to process other things or it might be a command too?
                    // Actually, if it's an image, we just collected it.
                }
            } catch (e) { }

            return;
        }


        // Parse command and arguments
        const args = messageText.slice(settings.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Anti-Spam Check (Bypass for owner already defined by isUserOwner)
        const now = Date.now();
        if (!isUserOwner && spamMap.has(senderId)) {
            const lastTime = spamMap.get(senderId);
            if (now - lastTime < SPAM_THRESHOLD) {
                console.log(`[Anti-Spam] Blocking ${senderId} from frequent command: ${commandName}`);
                return; // Ignore if too fast for non-owners
            }
        }
        spamMap.set(senderId, now);

        // Mode Check (Public/Self)
        // Ensure we handle case where getBotMode might return undefined or unexpected value
        let currentMode = 'public';
        try {
            currentMode = getBotMode() || 'public';
        } catch (e) {
            console.error('[Handler] Error getting bot mode:', e);
        }

        // Mode Check (Public/Self) already handled isUserOwner above

        // Log basic command info
        console.log(`[Handler] User: ${senderId} | Command: ${commandName} | Mode: ${currentMode} | IsOwner: ${isUserOwner}`);

        if (currentMode === 'self' && !isUserOwner) {
            console.log(`[Handler] Ignoring command from non-owner in SELF mode: ${senderId}`);
            return; // Ignore all commands from non-owners in Self mode
        }

        // Get user language
        let userLang = 'ar';
        try {
            userLang = await getUserLanguage(senderId);
        } catch (e) { }

        // 🆕 UNIVERSAL NUMERIC LANGUAGE SELECTION (Works for everyone, not just new users)
        // Check if user is responding with JUST a number (1, 2, or 3) without prefix
        const cleanMsg = messageText.trim();
        if ((cleanMsg === '1' || cleanMsg === '2' || cleanMsg === '3') && !messageText.startsWith(settings.prefix)) {
            const langMap = { '1': 'en', '2': 'ar', '3': 'ma' };
            const selectedLang = langMap[cleanMsg];

            const { setUserLanguage } = require('./userLogger');
            setUserLanguage(senderId, selectedLang);

            const confirmMsg = selectedLang === 'en'
                ? `✅ Language set to English!\n\nType *.menu* to see all commands.`
                : selectedLang === 'ar'
                    ? `✅ تم تعيين اللغة إلى العربية!\n\nاكتب *.menu* لعرض جميع الأوامر.`
                    : `✅ تم تعيين اللغة إلى الدارجة!\n\nكتب *.menu* باش تشوف جميع الأوامر.`;

            await sock.sendMessage(chatId, { text: confirmMsg }, { quoted: msg });
            return;
        }

        // 🆕 CHECK: If user has no language set (and it's a private chat or explicit command), prompt them
        // We check if the user exists in logger with a language property.
        // Since getUserLanguage returns global default if not set, we need to check existence explicitly via getUser
        const { getUser } = require('./userLogger');
        const userProfile = getUser(senderId);

        // If user is new (no language set) AND messagetype is text
        if ((!userProfile || !userProfile.language) && !isGroup && !msg.key.fromMe) {
            // Allow .setlang command to pass through by checking commandName instead of full messageText
            if (commandName !== 'setlang' && commandName !== 'لغة') {
                const welcomeMsg = `👋 *Welcome to ${settings.botName}*\n\n🌍 Please choose your language to continue:\n🌍 المرجو اختيار لغتك للمتابعة:\n\n1️⃣ *.setlang en* or just *1* (English)\n2️⃣ *.setlang ar* or just *2* (العربية)\n3️⃣ *.setlang ma* or just *3* (الدارجة)`;
                await sock.sendMessage(chatId, { text: welcomeMsg }, { quoted: msg });
                return; // Stop processing until they set language
            }
        }

        // Check if command exists
        if (!commands.has(commandName)) {
            // Check for aliases
            const aliasMap = {
                // Modes & Core
                'public': 'mode', 'self': 'mode', 'private': 'mode', 'mode': 'mode',
                'عام': 'mode', 'خاص': 'mode',
                'مساعدة': 'help', 'menu': 'help', 'قائمة': 'help', 'help': 'help',
                'المالك': 'owner', 'owner': 'owner',
                'بينغ': 'ping', 'ping': 'ping',
                'بوت': 'alive', 'alive': 'alive',
                'status': 'system', 'system': 'system', 'restart': 'system', 'reboot': 'system',
                'clearsession': 'clearsession', 'cs': 'clearsession',

                // Admin & Group
                'طرد': 'kick', 'kick': 'kick', 'remove': 'kick',
                'ترقية': 'promote', 'promote': 'promote', 'admin': 'promote',
                'تخفيض': 'demote', 'demote': 'demote', 'unadmin': 'demote',
                'حظر': 'ban', 'ban': 'ban',
                'الغاء_الحظر': 'unban', 'unban': 'unban',
                'بلوك': 'block', 'block': 'block',
                'الغاء_حظر': 'unblock', 'فك_حظر': 'unblock', 'unblock': 'unblock',
                'منشن': 'tagall', 'tagall': 'tagall',
                'اخفاء': 'hidetag', 'hidetag': 'hidetag',
                'مجموعة': 'group', 'group': 'group',
                'منع_روابط': 'antilink', 'antilink': 'antilink',
                'warn': 'warn', 'تحذير': 'warn',
                'pmblocker': 'pmblocker', 'pmbloker': 'pmblocker',
                'autoread': 'autoread', 'ar': 'autoread',
                'hmm': 'ghosttag', 'ghosttag': 'ghosttag',

                // AI Tools
                'ai': 'gpt', 'ia': 'gpt', 'gpt': 'gpt', 'gemini': 'gemini',
                'aiart': 'aiart', 'ذكاء_اصطناعي': 'aiart',
                'genai': 'genai', 'generate': 'genai', 'توليد': 'genai', 'رسم': 'genai', 'صورة': 'genai',
                'imagine': 'imagine', 'تخيل': 'imagine',
                'banana': 'banana-ai', 'banana-ai': 'banana-ai',
                'edit': 'edit', 'edite': 'edit', 'تعديل': 'nanobananapro', 'nanobananapro': 'nanobananapro',
                'ai-enhance': 'ai-enhance', 'enhance': 'ai-enhance', 'تحسين': 'ai-enhance',
                'colorize': 'colorize', 'talwin': 'colorize',
                'remini': 'remini',
                'faceswap': 'faceswap',
                'ghibli': 'ghibli', 'ghibli-art': 'ghibli',
                'aicheck': 'aicheck', 'aidetect': 'aicheck',
                'waterbot': 'waterbot', 'waterai': 'waterbot',
                'ask': 'gpt',

                // Media & Editing
                'sticker': 'sticker', 'ستيكر': 'sticker', 's': 'sticker', 'gif': 'sticker', 'togif': 'sticker',
                'toimage': 'simage', 'toimg': 'simage', 'convert': 'simage',
                'tomp3': 'tomp3', 'mp3': 'tomp3', 'صوت': 'tomp3',
                'tovideo': 'video', 'video': 'video', 'فيديو': 'video',
                'attp': 'attp', 'ttp': 'ttp',
                'vocalremover': 'vocalremover', 'hazf-sawt': 'vocalremover', '3azlsawt': 'vocalremover', 'عزل_صوت': 'vocalremover',
                'carbon': 'carbon',

                // Downloaders
                'facebook': 'facebook', 'fb': 'facebook', 'فيسبوك': 'facebook',
                'instagram': 'instagram', 'ig': 'instagram', 'انستا': 'instagram',
                'tiktok': 'tiktok', 'tt': 'tiktok', 'تيكتوك': 'tiktok',
                'youtube': 'video', 'yt': 'video', 'يوتيوب': 'video',
                'song': 'song', 'play': 'play',
                'yts': 'yts', 'بحث': 'yts', 'ytsearch': 'yts',
                'mediafire': 'mediafire', 'mf': 'mediafire',
                'apk': 'apk', 'apk1': 'apk', 'apk2': 'apk2', 'tahmil-app': 'apk2',
                'fdroid': 'f-droid', 'f-droid': 'f-droid',
                'pinterest': 'pinterest', 'pin': 'pinterest',

                // Religion
                'quran': 'quran', 'قران': 'quran', 'قرآن': 'quran', 'sura': 'quran', 'surah': 'quran', 'سورة': 'quran',
                'salat': 'salat', 'صلاة': 'salat', 'prayer': 'salat',
                'adhan': 'adhan', 'adan': 'adhan', 'azan': 'adhan', 'أذان': 'adhan',
                'hadith': 'hadith', 'حديث': 'hadith',
                'azkar': 'azkar', 'adkar': 'azkar', 'اذكار': 'azkar', 'أذكار': 'azkar',
                'dua': 'dua', 'دعاء': 'dua',
                'tafsir': 'tafsir', 'تفسير': 'tafsir',
                'ayah': 'ayah', 'آية': 'ayah',
                'asmaa': 'asmaa', 'asma': 'asmaa', 'اسماء_الله': 'asmaa', 'أسماء': 'asmaa',
                'qibla': 'qibla', 'قبلة': 'qibla',
                'prayertimes': 'prayertimes', 'mwaqit': 'prayertimes', 'مواقيت': 'prayertimes',
                'fadlsalat': 'deen', 'فضل_صلاة': 'deen',
                'hukm': 'deen', 'hukmsharai': 'deen', 'حكم_شرعي': 'deen',
                'qiyam': 'deen', 'qiyamlayl': 'deen', 'قيام_الليل': 'deen',
                'danb': 'deen', 'ذنب': 'deen',
                'nasiha': 'deen', 'نصيحة': 'deen',
                'tadabbur': 'deen', 'تدبر': 'deen',
                'sahaba': 'deen', 'qissatsahabi': 'deen', 'صحابة': 'deen',
                'faida': 'deen', 'فائدة': 'deen',
                'hasanat': 'deen', 'حسنات': 'deen',
                'jumaa': 'deen', 'جمعة': 'deen',
                'hajj': 'deen', 'حج': 'deen',
                'sira': 'deen', 'سيرة': 'deen',
                'mawt': 'deen', 'موت': 'deen',
                'shirk': 'deen', 'شرك': 'deen',
                'hub': 'deen', 'حب_الله': 'deen',
                'qisas': 'deen', 'anbiya': 'deen', 'قصص_الأنبياء': 'deen',
                'hadith_long': 'deen', 'ahadith': 'deen', 'حديث_طويل': 'deen',
                'sahaba_long': 'deen', 'قصص_الصحابة': 'deen',
                'jannah': 'deen', 'جنة': 'deen',
                'nar': 'deen', 'نار': 'deen', 'جهنم': 'deen',
                'qabr': 'deen', 'قبر': 'deen',
                'qiyama': 'deen', 'قيامة': 'deen',
                'mo3jiza': 'deen', 'معجزة': 'deen',
                'tabiin': 'deen', 'تابعين': 'deen',
                'omahat': 'deen', 'أمهات_المؤمنين': 'deen', 'زوجات_الرسول': 'deen',
                'malaika': 'deen', 'ملائكة': 'deen',
                'deenquiz': 'deenquiz', 'quizdeen': 'deenquiz', 'مسابقة_دينية': 'deenquiz',
                'kml': 'continue', 'kammel': 'continue', 'كمل': 'continue',

                // Fun & Games
                'menugame': 'menugame', 'gamemenu': 'menugame', 'العاب': 'menugame',
                'joke': 'joke', 'نكتة': 'joke',
                'meme': 'meme', 'ميم': 'meme',
                'cat': 'cat', 'قط': 'cat',
                'dog': 'dog', 'كلب': 'dog',
                'fact': 'fact', 'حقيقة': 'fact',
                'quote': 'quote', 'اقتباس': 'quote',
                'stupid': 'stupid', 'mklakh': 'stupid', 'مكلخ': 'stupid',
                'flirt': 'flirt', 'غزل': 'flirt',
                'eightball': 'eightball', 'حظ': 'eightball', 'توقع': 'eightball',
                'compliment': 'compliment', 'مدح': 'compliment',
                'insult': 'insult', 'سب': 'insult', 'معيرة': 'insult',
                'hangman': 'hangman', 'مشنقة': 'hangman',
                'tictactoe': 'tictactoe', 'xo': 'tictactoe', 'ttt': 'tictactoe',
                'ship': 'ship',
                'character': 'character',
                'goodnight': 'goodnight', 'نعاس': 'goodnight',
                'truth': 'truth', 'dare': 'dare',
                '4kwallpaper': '4kwallpaper', 'wallpaper4k': '4kwallpaper', 'خلفيات': '4kwallpaper',

                // Education & Tools
                'translate': 'translate', 'tr': 'translate', 'ترجمة': 'translate',
                'setlang': 'setlang', 'لغة': 'setlang',
                'weather': 'weather', 'طقس': 'weather',
                'google': 'google', 'g': 'google',
                'wiki': 'wiki', 'wikipedia': 'wiki',
                'calc': 'calc', 'حساب': 'calc', 'calculator': 'calc',
                'alloschool': 'alloschool', 'alloschoolget': 'alloschool',
                'tahlil-soura': 'checkimage', 'checkimage': 'checkimage',
                'tts': 'tts', 'say': 'tts', 'نطق': 'tts', 'قول': 'tts',
                'pdf': 'pdf', 'book': 'book', 'kitab': 'book',
                'lyrics': 'lyrics', 'kalimat': 'lyrics',
                'recipe': 'recipe', 'wasfa': 'recipe',
                'car': 'car', 'sayara': 'car',
                'currency': 'currency', 'sarf': 'currency',
                'qr': 'qrcode', 'qrcode': 'qrcode',
                'ocr': 'ocr',
                'نانو': 'nanobanana', 'editimg': 'nanobanana', 'nanobanana': 'nanobanana',
                'سكرين': 'screenshot', 'screenshot': 'screenshot', 'ss': 'screenshot',
                'جيميني-حلل': 'gemini-analyze', 'gemini-analyze': 'gemini-analyze', 'gemini-pro': 'gemini-analyze',
                'menuu': 'menuu', 'menuar': 'menuu', 'menu-ar': 'menuu', 'اوامر': 'menuu', 'قائمة_اوامر': 'menuu',

                // Owner
                'devmsg': 'devmsg', 'broadcast': 'devmsg', 'bouth': 'devmsg', 'بث': 'devmsg',
                'veo3-prompt': 'veo3-prompt', 'veo-prompt': 'veo3-prompt',
                'newmenu': 'newmenu',
                'allmenu': 'allmenu', 'listall': 'allmenu', 'menuall': 'allmenu', 'all': 'allmenu',

                // Leveling & Economy
                'بروفايل': 'profile', 'حسابي': 'profile', 'ملفي': 'profile', 'profile': 'profile', 'p': 'profile', 'my': 'profile',
                'يومي': 'daily', 'يومية': 'daily', 'daily': 'daily', 'bonus': 'daily',
                'ترتيب': 'top', 'اوائل': 'top', 'top': 'top', 'leaderboard': 'top', 'rank': 'top',
                'متجر': 'shop', 'محل': 'shop', 'shop': 'shop', 'store': 'shop', 'market': 'shop',
                'قمار': 'gamble', 'رهان': 'gamble', 'gamble': 'gamble', 'bet': 'gamble',
                'slots': 'slots', 'slot': 'slots', 'ماكينة': 'slots',
                'blackjack': 'blackjack', 'bj': 'blackjack', '21': 'blackjack',
                'guesswho': 'guesswho', 'whoami': 'guesswho', 'شكون_انا': 'guesswho', 'شكون': 'guesswho',
                'level': 'profile', 'xp': 'profile', 'wallet': 'profile'
            };

            const actualCommandName = aliasMap[commandName];
            if (actualCommandName && commands.has(actualCommandName)) {
                console.log(`📌 Alias found: ${commandName} -> ${actualCommandName}`);
                const command = commands.get(actualCommandName);
                const match = args.join(' ');

                if (typeof command === 'function' || (command && typeof command.execute === 'function')) {
                    // 🛡️ ANTI-BAN: Simulate Typing
                    try {
                        await sock.sendPresenceUpdate('composing', chatId);
                        const randomDelay = Math.floor(Math.random() * 1500) + 1000; // 1-2.5 seconds delay
                        await new Promise(resolve => setTimeout(resolve, randomDelay));
                        await sock.sendPresenceUpdate('paused', chatId);
                    } catch (e) { }

                    if (typeof command === 'function') {
                        await command(sock, chatId, msg, args, commands, userLang, match);
                    } else {
                        await command.execute(sock, chatId, msg, args, commands, userLang, match);
                    }
                }
                return;
            }


            console.log(`❌ Command not found: ${commandName}`);

            // Command not found - send helpful message to owner only
            if (isUserOwner) {
                await sendWithChannelButton(sock, chatId, `❌ *الأمر \`${settings.prefix}${commandName}\` غير موجود!*

📋 لعرض الأوامر المتاحة: *${settings.prefix}help*
⚔️ ${settings.botName}`, msg);
            }

            return;
        }

        // Execute command
        const command = commands.get(commandName);
        if (command) {
            // FIX: Ensure 'match' is passed as a string (args.join) to prevent .trim() errors
            const match = args.join(' ');

            // 🛡️ ANTI-BAN: Simulate Typing
            try {
                await sock.sendPresenceUpdate('composing', chatId);
                const randomDelay = Math.floor(Math.random() * 1500) + 1000; // 1-2.5 seconds delay
                await new Promise(resolve => setTimeout(resolve, randomDelay));
                await sock.sendPresenceUpdate('paused', chatId);
            } catch (e) { }

            if (typeof command === 'function') {
                await command(sock, chatId, msg, args, commands, userLang, match);
            } else if (typeof command.execute === 'function') {
                await command.execute(sock, chatId, msg, args, commands, userLang, match);
            }
        } else {
            console.error(`Command ${commandName} is not a function or object with execute():`, typeof command);
        }

    } catch (error) {
        console.error('Error handling message:', error);
        try {
            await sock.sendMessage(msg.key.remoteJid, {
                text: t('common.error', await getUserLanguage(msg.key.participant || msg.key.remoteJid))
            }, { quoted: msg });
        } catch (e) {
            console.error('Error sending error message:', e);
        }
    }
}

// Export the handler
module.exports = handleMessage;
