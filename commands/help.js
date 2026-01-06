const settings = require('../settings');
const { t } = require('../lib/language');
const { sendWithChannelButton } = require('../lib/channelButton');
const fs = require('fs');
const path = require('path');

module.exports = async (sock, chatId, msg, args, commands, userLang) => {
    try {
        const commandList = Array.from(commands.keys()).sort();
        const prefix = settings.prefix;

        const requested = args[0] ? args[0].toLowerCase() : null;
        const islamicAliases = ['islam', 'islamic', 'deen', 'دين', 'ديني', 'اسلاميات', 'اسلام', 'religion'];
        const gameAliases = ['games', 'game', 'العاب', 'لعب', 'منيو_لعب', 'menugame'];
        const funAliases = ['fun', 'dahik', 'ضحك', 'ترفيه', 'نكت'];
        const downloadAliases = ['download', 'tahmilat', 'tahmil', 'تحميل', 'تيليشارجي'];
        const toolsAliases = ['tools', 'adawat', 'أدوات', 'وسائل', 'خدمات'];
        const ownerAliases = ['owner', 'molchi', 'mol-chi', 'المالك', 'المطور'];
        const generalAliases = ['general', '3am', 'عام', 'نظام', 'سيستم'];
        const allAliases = ['all', 'allmenu', 'listall', 'كامل', 'كلشي'];
        const aiAliases = ['ai', 'ذكاء', 'ذكاء_اصطناعي', 'robot', 'bot'];

        // 2. Define Category Mappings
        const catMap = {
            'new': ['edit', 'genai', 'banana-ai', 'ghibli', 'tomp3', 'resetlink', 'apk', 'apk2', 'apk3', 'hidetag', 'imdb', 'simp'],
            'religion': ['quran', 'salat', 'prayertimes', 'adhan', 'hadith', 'asmaa', 'azkar', 'qibla', 'ad3iya', 'dua', 'athan', 'tafsir', 'surah', 'ayah', 'fadlsalat', 'hukm', 'qiyam', 'danb', 'nasiha', 'tadabbur', 'sahaba', 'faida', 'hasanat', 'jumaa', 'hajj', 'sira', 'mawt', 'shirk', 'hub', 'deen'],
            'download': ['facebook', 'instagram', 'tiktok', 'youtube', 'mediafire', 'github', 'play', 'song', 'video', 'ytplay', 'yts'],
            'ai': ['gpt', 'gemini', 'deepseek', 'imagine', 'aiart', 'miramuse', 'ghibli-art', 'faceswap', 'ai-enhance', 'colorize', 'remini', 'vocalremover', 'musicgen', 'hdvideo', 'winkvideo', 'unblur', 'removebg', 'brat-vd'],
            'group': ['kick', 'promote', 'demote', 'tagall', 'hidetag', 'mute', 'unmute', 'close', 'open', 'delete', 'staff', 'groupinfo', 'welcome', 'goodbye', 'warn', 'warnings', 'antibadword', 'antilink'],
            'tools': ['sticker', 'sticker-alt', 'attp', 'ttp', 'ocr', 'tts', 'say', 'toimage', 'tovideo', 'togif', 'qrcode', 'ss', 'lyrics', 'calc', 'img-blur', 'translate', 'readviewonce', 'upload'],
            'news': ['news', 'akhbar', 'football', 'kora', 'weather', 'taqes'],
            'fun': ['joke', 'fact', 'quote', 'meme', 'character', 'truth', 'dare', 'ship', 'ngl', '4kwallpaper'],
            'games': ['menugame', 'xo', 'rps', 'math', 'guess', 'scramble', 'riddle', 'quiz', 'love', 'hangman', 'trivia'],
            'economy': ['profile', 'daily', 'top', 'shop', 'gamble', 'slots'],
            'general': ['alive', 'ping', 'owner', 'script', 'setlang', 'system', 'help', 'allmenu'],
            'owner': ['mode', 'devmsg', 'autoreminder', 'pmblocker', 'backup', 'ban', 'unban', 'block', 'unblock', 'cleartmp', 'sudo', 'clear', 'clearsession', 'anticall']
        };

        const cmdIcons = {
            'genai': '🎨', 'edit': '🪄', 'banana-ai': '🍌', 'ghibli': '🎭', 'tomp3': '🎵', 'apk': '📱', 'apk2': '🚀', 'apk3': '🔥', 'simp': '💘',
            'quran': '📖', 'salat': '🕌', 'prayertimes': '🕋', 'adhan': '📢', 'hadith': '📚', 'asmaa': '✨', 'azkar': '📿', 'qibla': '🧭', 'ad3iya': '🤲', 'deen': '🕌',
            'jumaa': '📆', 'hajj': '🕋', 'sira': '🕊️', 'mawt': '⏳', 'shirk': '🛡️', 'hub': '💞', 'jannah': '🌴', 'nar': '🔥', 'qabr': '⚰️', 'qiyama': '🌋',
            'facebook': '🔵', 'instagram': '📸', 'tiktok': '🎵', 'youtube': '🎬', 'mediafire': '📂', 'play': '🎧', 'song': '🎶', 'video': '🎥',
            'gpt': '🤖', 'gemini': '♊', 'deepseek': '🧠', 'imagine': '🖼️', 'aiart': '🌟', 'ghibli-art': '🎨', 'remini': '✨',
            'kick': '🚫', 'promote': '🆙', 'demote': '⬇️', 'tagall': '📢', 'hidetag': '👻', 'mute': '🔇', 'unmute': '🔊', 'close': '🔒', 'open': '🔓',
            'sticker': '🖼️', 'translate': '🗣️', 'ocr': '🔍', 'qrcode': '🏁', 'weather': '🌦️', 'lyrics': '📜', 'calc': '🔢',
            'game': '🎮', 'quiz': '🧠', 'riddle': '🧩', 'joke': '🤣', 'meme': '🐸', 'truth': '💡', 'dare': '🔥',
            'profile': '👤', 'daily': '💰', 'top': '🏆', 'shop': '🛒',
            'alive': '🟢', 'ping': '⚡', 'owner': '👑', 'help': '❓'
        };

        // 3. Runtime Stats & Thumbnail
        const runtime = process.uptime();
        const days = Math.floor(runtime / 86400);
        const hours = Math.floor((runtime % 86400) / 3600);
        const minutes = Math.floor((runtime % 3600) / 60);

        let thumbBuffer = null;
        try {
            // Try to resolve the path relative to the root or absolute
            let thumbPath = settings.botThumbnail;
            if (!path.isAbsolute(thumbPath)) {
                thumbPath = path.join(__dirname, '..', thumbPath);
            }
            if (fs.existsSync(thumbPath)) {
                thumbBuffer = fs.readFileSync(thumbPath);
            }
        } catch (e) { console.error('Error reading thumbnail:', e); }

        // Pretty Date Time
        const date = new Date();
        const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateString = date.toLocaleDateString('en-GB');

        const header =
            `┏━━━ ❰ *${t('common.botName', {}, userLang).toUpperCase()}* ❱ ━━━┓\n` +
            `┃ 🤵‍♂️ *Owner:* ${t('common.botOwner', {}, userLang)}\n` +
            `┃ 📆 *Date:* ${dateString}\n` +
            `┃ ⌚ *Time:* ${timeString}\n` +
            `┃ ⏳ *Uptime:* ${days}d ${hours}h ${minutes}m\n` +
            `┃ 🤖 *Ver:* ${settings.version || '2.0.0'}\n` +
            `┗━━━━━━━━━━━━━━━━━━┛\n\n`;

        // Common Send Function with Image
        const sendMenu = async (text, title = "✨ Hamza Amirni Bot ✨") => {
            // Add channel link to the bottom of text
            const fullText = text + `\n\n📢 *القناة الرسمية:*\n${settings.officialChannel}`;

            if (thumbBuffer) {
                // Send as image with caption
                await sock.sendMessage(chatId, {
                    image: thumbBuffer,
                    caption: fullText
                }, { quoted: msg });
            } else {
                // Fallback to text only
                await sock.sendMessage(chatId, {
                    text: fullText
                }, { quoted: msg });
            }
        };

        // --- PRIORITY 1: Sub-Menu/Category Aliases ---
        if (requested) {
            // Global Redirect for .menu all
            if (allAliases.includes(requested)) {
                const allmenu = require('./allmenu');
                return await allmenu(sock, chatId, msg, args, commands, userLang);
            }

            // General Category fallback (if not caught by specific sub-menus)
            let selectedKey = null;
            if (catMap[requested]) selectedKey = requested;
            else if (funAliases.includes(requested)) selectedKey = 'fun';
            else if (downloadAliases.includes(requested)) selectedKey = 'download';
            else if (toolsAliases.includes(requested)) selectedKey = 'tools';
            else if (ownerAliases.includes(requested)) selectedKey = 'owner';
            else if (generalAliases.includes(requested)) selectedKey = 'general';

            if (selectedKey) {
                const catName = t(`menu.categories.${selectedKey}`, {}, userLang);
                let menuText = header + `┌─── ❰ *${catName.toUpperCase()}* ❱ ───┐\n\n`;

                // Special Note for Downloads
                if (selectedKey === 'download') {
                    menuText += `🚀 *ملاحظة:* البوت كيتيليشارجي تلقائياً من أي رابط (Insta, TikTok, FB, YouTube) غير صيفط الليان بوحدو!\n\n`;
                }

                catMap[selectedKey].forEach(c => {
                    const icon = cmdIcons[c] || '▫️';
                    const desc = t(`command_desc.${c}`, {}, userLang);
                    const descText = desc.startsWith('command_desc.') ? '' : ` : ${desc}`;
                    menuText += `│ ${icon} *${prefix}${c}*${descText}\n`;
                });
                menuText += `\n└──────────────────────┘\n`;
                menuText += `\n🔙 اكتب *.menu* للرجوع للقائمة الرئيسية.`;
                return await sendMenu(menuText, `${catName} Menu`);
            }

            // Islamic Sub-Menu
            if (islamicAliases.includes(requested)) {
                let islamicMenu = header + `┌─── ❰ *الموسوعة الإسلامية* ❱ ───┐\n\n` +
                    `📖 .quran : تلاوة القرآن\n` +
                    `💬 .tafsir : تفسير الآيات\n` +
                    `🕋 .prayertimes : أوقات الصلاة\n` +
                    `🕌 .fadlsalat : فضل صلاة\n` +
                    `📌 .hukm : حكم شرعي\n` +
                    `🌙 .qiyam : قيام الليل\n` +
                    `🔥 .danb : ذنب مهلك\n` +
                    `💡 .nasiha : نصيحة دينية\n` +
                    `✨ .sahaba : قصة صحابي\n` +
                    `📖 .qisas : قصص الأنبياء والعبر\n` +
                    `📚 .hadith_long : أحاديث نبوية وقصص\n` +
                    `✨ .sahaba_long : قصص الصحابة والتابعين\n\n` +
                    `└──────────────────────┘\n` +
                    `🔙 اكتب *.menu* للرجوع للقائمة.`;
                return await sendMenu(islamicMenu, "Islamic Menu");
            }
            // Games Sub-Menu
            if (gameAliases.includes(requested)) {
                let gameMenu = header + `┌─── ❰ *MEGA GAME MENU* ❱ ───┐\n\n` +
                    `🕹️ *ألعاب فردية:*\n` +
                    `🎲 .guess | 🤖 .rps | 🎰 .slots\n` +
                    `🧮 .math | 🧩 .riddle | 🤔 .truefalse\n\n` +
                    `🔥 *ألعاب جماعية:*\n` +
                    `❌ .xo | ❓ .quiz | ❤️ .love\n\n` +
                    `└──────────────────────┘\n` +
                    `🔙 اكتب *.menu* للرجوع للقائمة.`;
                return await sendMenu(gameMenu, "Game Menu");
            }

            // AI Sub-Menu
            if (aiAliases.includes(requested)) {
                let aiMenu = header + `┌─── ❰ *مركز الذكاء الاصطناعي* ❱ ───┐\n\n` +
                    `🎵 .musicgen : صايب موسيقى من والو\n` +
                    `🤖 .gpt : سول GPT\n` +
                    `♊ .gemini : سول Gemini\n` +
                    `🖼️ .imagine : تخيل معايا (رسم)\n` +
                    `🌟 .aiart : فن واعر بالذكاء\n` +
                    `📀 .hdvideo : وضح الفيديو 2K\n` +
                    `📹 .winkvideo : زيد ف الجودة د الفيديو\n` +
                    `🖼️ .removebg : حيد الخلفية\n` +
                    `✨ .unblur : صفّي التصويرة\n` +
                    `🎞️ .brat-vd : نص إلى فيديو (Brat)\n` +
                    `🎨 .ghibli-art : ستايل جيبلي\n` +
                    `◽ .faceswap : بدل الوجه ف التصويرة\n` +
                    `◽ .ai-enhance : زيين ونقي التصويرة\n` +
                    `◽ .colorize : لون التصاور القدام\n` +
                    `✨ .remini : وضح التصويرة الضبابية\n` +
                    `🎙️ .vocalremover : حيد الموسيقى وخلي الصوت\n\n` +
                    `└──────────────────────┘\n` +
                    `🔙 اكتب *.menu* للرجوع للقائمة.`;
                return await sendMenu(aiMenu, "AI Menu");
            }

            // Individual Command Help
            if (commands.has(requested)) {
                const desc = t(`command_desc.${requested}`, {}, userLang);
                if (!desc.startsWith('command_desc.')) {
                    return await sendMenu(
                        `💡 *الأمر:* ${prefix}${requested}\n` +
                        `📝 *الشرح:* ${desc}\n` +
                        `🤖 *المطور:* ${settings.botOwner}`,
                        `Help: ${requested}`
                    );
                }
            }
        }

        // --- PRIORITY 3: General Category Display (Main Menu) ---
        let menuText = header +
            `🏰 *مرحباً بك في إمبراطورية الأوامر* 🏰\n` +
            `بوت شامل، ذكي، وسريع.. كلشي بين يديك! اختر القسم المناسب:\n\n`;

        const sectionDividers = {
            'new': '🚀 *الأقسام الأساسية (Hot)*',
            'religion': '🕌 *الركن الديني*',
            'download': '📥 *التحميلات (Downloads)*',
            'fun': '🤣 *الترفيه (Fun)*',
            'general': '⚙️ *النظام (System)*'
        };

        for (const key of Object.keys(catMap)) {
            if (sectionDividers[key]) menuText += `\n${sectionDividers[key]}\n`;
            let icon = '📂';
            let cmdAlias = key;
            if (key === 'new') icon = '🔥';
            else if (key === 'religion') { icon = '🕌'; cmdAlias = 'deen'; }
            else if (key === 'download') { icon = '📥'; cmdAlias = 'tahmilat'; }
            else if (key === 'ai') icon = '🤖';
            else if (key === 'fun') { icon = '🤣'; cmdAlias = 'dahik'; }
            else if (key === 'games') { icon = '🎮'; cmdAlias = 'game'; }
            else if (key === 'tools') { icon = '🛠️'; cmdAlias = 'adawat'; }
            else if (key === 'owner') { icon = '👑'; cmdAlias = 'molchi'; }
            else if (key === 'general') { icon = '⚙️'; cmdAlias = '3am'; }

            menuText += `┃ ${icon} *${prefix}menu ${cmdAlias}*\n`;
        }

        menuText += `\n🌟 *${prefix}menu all* - عرض كل الأوامر دفعة واحدة\n`;
        menuText += `\n💡 *معلومة:* البوت كيتيليشارجي تلقائياً (Auto DL) من أي رابط!`;

        await sendMenu(menuText, "Main Menu");

    } catch (error) {
        console.error('Error in help command:', error);
        await sock.sendMessage(chatId, { text: t('common.error') }, { quoted: msg });
    }
};
