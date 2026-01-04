const settings = require('../settings');
const { t } = require('../lib/language');
const { sendWithChannelButton } = require('../lib/channelButton');
const fs = require('fs');
const path = require('path');

module.exports = async (sock, chatId, msg, args, commands, userLang) => {
    try {
        const prefix = settings.prefix;
        const botName = settings.botName || 'حمزة اعمرني';

        // Stats
        const runtime = process.uptime();
        const days = Math.floor(runtime / 86400);
        const hours = Math.floor((runtime % 86400) / 3600);
        const minutes = Math.floor((runtime % 3600) / 60);

        let thumbBuffer = null;
        try {
            let thumbPath = settings.botThumbnail;
            if (thumbPath && !path.isAbsolute(thumbPath)) {
                thumbPath = path.join(__dirname, '..', thumbPath);
            }
            if (thumbPath && fs.existsSync(thumbPath)) {
                thumbBuffer = fs.readFileSync(thumbPath);
            }
        } catch (e) { console.error('Error reading thumbnail:', e); }

        const date = new Date();
        const dateString = date.toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeString = date.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });

        let menuText = `*─── ❰ 🛡️ قائمة ${botName.toUpperCase()} ❱ ───*\n\n`;

        menuText += `👤 *المطور:* حمزة اعمرني\n`;
        menuText += `📅 *التاريخ:* ${dateString}\n`;
        menuText += `⌚ *الوقت:* ${timeString}\n`;
        menuText += `⏳ *مدة العمل:* ${days}ي ${hours}س ${minutes}د\n`;
        menuText += `🤖 *الإصدار:* ${settings.version || '2026.1.1'}\n`;
        menuText += `\n*━━━━━━━━━━━━━━━━━━━━━━*\n\n`;

        menuText += `💡 *ملاحظة:* استعمل النقطة قبل أي أمر.\n`;
        menuText += `مثال: *.menu*\n\n`;

        // 🕌 1. الركن الديني
        menuText += `🕌 *──❰ .دين / .إسلاميات ❱──*\n`;
        menuText += `📖 .قرآن | 🕋 .صلاة | 🤲 .أدعية\n`;
        menuText += `📢 .أذان | 📚 .حديث | ✨ .أسماء\n`;
        menuText += `📿 .أذكار | 🧭 .قبلة | 📖 .تفسير\n`;
        menuText += `🏛️ .fadlsalat | 📌 .hukm | 🌙 .qiyam\n`;
        menuText += `🕊️ .sira | ⏳ .mawt | 🌴 .jannah\n\n`;

        // 📥 2. التحميلات
        menuText += `📥 *──❰ .تحميل / .تنزيل ❱──*\n`;
        menuText += `🎬 .يوتيوب | 📸 .انستغرام | 🔵 .فيسبوك\n`;
        menuText += `🎵 .تيكتوك | 📂 .ميديافاير | 🎧 .play\n`;
        menuText += `🎥 .فيديو | 🎶 .song | 🔍 .بحث\n\n`;

        // 🤖 3. الذكاء الاصطناعي
        menuText += `🤖 *──❰ .ذكاء / .ai ❱──*\n`;
        menuText += `🧠 .gpt | ♊ .gemini | 🧠 .deepseek\n`;
        menuText += `🖼 .imagine | 🎨 .aiart | 🎭 .ghibli\n`;
        menuText += `🍌 .نانو | 📸 .سكرين | 🔍 .جيميني-حلل\n`;
        menuText += `✨ .remini | 🪄 .ai-enhance | 🖌️ .colorize\n\n`;

        // 🛠️ 4. الأدوات والخدمات
        menuText += `🛠️ *──❰ .أدوات / .خدمات ❱──*\n`;
        menuText += `🖼️ .sticker | 🗣️ .ترجمة | 🔍 .ocr\n`;
        menuText += `🎵 .tomp3 | 🏁 .qrcode | 🌦️ .weather\n`;
        menuText += `📜 .lyrics | 🔢 .calc | 📤 .upload\n\n`;

        // 👥 5. المجموعات
        menuText += `👥 *──❰ .كروب / .أدمن ❱──*\n`;
        menuText += `🚫 .طرد | 🆙 .ترقية | ⬇️ .تخفيض\n`;
        menuText += `📢 .tagall | 🔇 .mute | 🔓 .open\n`;
        menuText += `🗑️ .مسح | 🛡️ .antilink | 👋 .welcome\n\n`;

        // 🎮 6. الألعاب والترفيه
        menuText += `🎮 *──❰ .ألعاب / .ضحك ❱──*\n`;
        menuText += `❌ .xo | ❓ .quiz | 🧩 .riddle\n`;
        menuText += `🎲 .guess | 🤣 .joke | 🐸 .meme\n`;
        menuText += `💡 .truth | 🔥 .dare | 💘 .ship\n\n`;

        // 💰 7. الحساب والاقتصاد
        menuText += `💰 *──❰ .بروفايل / .بنك ❱──*\n`;
        menuText += `👤 .بروفايل | 💰 .يومي | 🏆 .ترتيب\n`;
        menuText += `🛒 .متجر | 🎰 .slots | 🃏 .blackjack\n\n`;

        // ⚙️ 8. المطور والنظام
        menuText += `⚙️ *──❰ .نظام / .مالك ❱──*\n`;
        menuText += `🟢 .alive | ⚡ .ping | 👑 .owner\n`;
        menuText += `⚙️ .system | 🌐 .لغة | 🔒 .mode\n\n`;

        menuText += `*━━━━━━━━━━━━━━━━━━━━━━*\n`;
        menuText += `📢 *القناة:* ${settings.officialChannel}\n`;
        menuText += `✨ حمزة اعمرني نطور مستقبلك الرقمي! ✨`;

        if (thumbBuffer) {
            await sock.sendMessage(chatId, {
                image: thumbBuffer,
                caption: menuText,
                contextInfo: {
                    externalAdReply: {
                        title: `قائمة أوامر ${botName}`,
                        body: "حمزة اعمرني - Hamza Amirni",
                        thumbnail: thumbBuffer,
                        sourceUrl: settings.officialChannel,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: menuText }, { quoted: msg });
        }

    } catch (error) {
        console.error('Error in menuu command:', error);
        await sock.sendMessage(chatId, { text: '❌ حدث خطأ أثناء عرض القائمة.' });
    }
};
