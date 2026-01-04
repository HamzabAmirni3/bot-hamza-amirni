const settings = require('../settings');
const fs = require('fs');
const path = require('path');

module.exports = async (sock, chatId, msg, args, commands, userLang) => {
    try {
        const prefix = settings.prefix;
        const botName = settings.botName || 'حمزة اعمرني';

        // Runtime
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
        const dateStr = date.toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });

        let menuText = `*┏━━❰ ⚔️ ${botName.toUpperCase()} ⚔️ ❱━━┓*\n┃\n`;

        menuText += `┃ 🤵‍♂️ *المطور:* حمزة اعمرني\n`;
        menuText += `┃ 📅 *التاريخ:* ${dateStr}\n`;
        menuText += `┃ ⌚ *الوقت:* ${timeStr}\n`;
        menuText += `┃ ⏳ *النشاط:* ${days}d ${hours}h ${minutes}m\n`;
        menuText += `┃ 🤖 *الإصدار:* 2026.1.1\n`;
        menuText += `┃\n`;
        menuText += `*┗━━━━━━━━━━━━━━━━━━━┛*\n\n`;

        // 🕌 الإسلاميات
        menuText += `*╭━━❰ 🕌 الركن الديني ❱━━╮*\n`;
        menuText += `┃ 📖 .قرآن (quran)\n`;
        menuText += `┃ 🕌 .صلاة (salat)\n`;
        menuText += `┃ 🕌 .مواقيت (prayertimes)\n`;
        menuText += `┃ 📢 .أذان (adhan)\n`;
        menuText += `┃ 📚 .حديث (hadith)\n`;
        menuText += `┃ 🤲 .أدعية (ad3iya)\n`;
        menuText += `┃ ✨ .أسماء (asmaa)\n`;
        menuText += `┃ 📿 .أذكار (azkar)\n`;
        menuText += `┃ 🧭 .قبلة (qibla)\n`;
        menuText += `┃ 📖 .تفسير (tafsir)\n`;
        menuText += `┃ 🕊️ .سيرة (sira)\n`;
        menuText += `┃ 📜 .قصص (qisas)\n`;
        menuText += `*╰━━━━━━━━━━━━━━━━━━━╯*\n\n`;

        // 🤖 الذكاء الاصطناعي
        menuText += `*╭━━❰ 🤖 الذكاء الاصطناعي ❱━━╮*\n`;
        menuText += `┃ 🧠 .ذكاء (gpt)\n`;
        menuText += `┃ ♊ .جيميني (gemini)\n`;
        menuText += `┃ 🖼️ .تخيل (imagine)\n`;
        menuText += `┃ 🎨 .فن (aiart)\n`;
        menuText += `┃ 🎭 .جيبلي (ghibli)\n`;
        menuText += `┃ 🍌 .نانو (nanobanana)\n`;
        menuText += `┃ 📸 .سكرين (screenshot)\n`;
        menuText += `┃ 🔍 .جيميني-حلل (analyze)\n`;
        menuText += `┃ ✨ .توضيح (remini)\n`;
        menuText += `┃ 🪄 .تحسين (enhance)\n`;
        menuText += `┃ 🖌️ .تلوين (colorize)\n`;
        menuText += `┃ 🧪 .حذف_خلفية (removebg)\n`;
        menuText += `*╰━━━━━━━━━━━━━━━━━━━╯*\n\n`;

        // 📥 التحميلات
        menuText += `*╭━━❰ 📥 قسم التحميلات ❱━━╮*\n`;
        menuText += `┃ 🎬 .يوتيوب (youtube)\n`;
        menuText += `┃ 📸 .انستغرام (instagram)\n`;
        menuText += `┃ 🔵 .فيسبوك (facebook)\n`;
        menuText += `┃ 🎵 .تيكتوك (tiktok)\n`;
        menuText += `┃ 📂 .ميديافاير (mediafire)\n`;
        menuText += `┃ 🎧 .شغل (play)\n`;
        menuText += `┃ 🎥 .فيديو (video)\n`;
        menuText += `┃ 🎶 .أغنية (song)\n`;
        menuText += `┃ 🔍 .بحث (yts)\n`;
        menuText += `*╰━━━━━━━━━━━━━━━━━━━╯*\n\n`;

        // 🛠️ الأدوات
        menuText += `*╭━━❰ 🛠️ قسم الأدوات ❱━━╮*\n`;
        menuText += `┃ 🖼️ .ملصق (sticker)\n`;
        menuText += `┃ 🗣️ .ترجمة (translate)\n`;
        menuText += `┃ 🔍 .استخراج (ocr)\n`;
        menuText += `┃ 📄 .pdf-صور (pdf2img)\n`;
        menuText += `┃ 🎵 .صوت (tomp3)\n`;
        menuText += `┃ 🏁 .باركود (qrcode)\n`;
        menuText += `┃ 🌦️ .طقس (weather)\n`;
        menuText += `┃ 📜 .كلمات (lyrics)\n`;
        menuText += `┃ 🔢 .حساب (calc)\n`;
        menuText += `┃ 📤 .رفع (upload)\n`;
        menuText += `*╰━━━━━━━━━━━━━━━━━━━╯*\n\n`;

        // 👥 المجموعات
        menuText += `*╭━━❰ 👥 المجموعات ❱━━╮*\n`;
        menuText += `┃ 🚫 .طرد (kick)\n`;
        menuText += `┃ 🆙 .ترقية (promote)\n`;
        menuText += `┃ ⬇️ .تخفيض (demote)\n`;
        menuText += `┃ 📢 .منشن (tagall)\n`;
        menuText += `┃ 🔇 .قفل (mute)\n`;
        menuText += `┃ 🔓 .فتح (unmute)\n`;
        menuText += `┃ 🗑️ .حذف (delete)\n`;
        menuText += `┃ 🛡️ .حماية (antilink)\n`;
        menuText += `┃ 👋 .ترحيب (welcome)\n`;
        menuText += `*╰━━━━━━━━━━━━━━━━━━━╯*\n\n`;

        // 💰 الاقتصاد
        menuText += `*╭━━❰ 💰 قسم الاقتصاد ❱━━╮*\n`;
        menuText += `┃ 👤 .بروفايل (profile)\n`;
        menuText += `┃ 👤 .حسابي (my)\n`;
        menuText += `┃ 💰 .يومي (daily)\n`;
        menuText += `┃ 🏆 .ترتيب (top)\n`;
        menuText += `┃ 🛒 .متجر (shop)\n`;
        menuText += `┃ 🎰 .سلوتس (slots)\n`;
        menuText += `┃ 🃏 .بلاك_جاك (blackjack)\n`;
        menuText += `*╰━━━━━━━━━━━━━━━━━━━╯*\n\n`;

        // 🎮 الألعاب
        menuText += `*╭━━❰ 🎮 قسم الألعاب ❱━━╮*\n`;
        menuText += `┃ ❌ .إكس_أو (xo)\n`;
        menuText += `┃ ❓ .مسابقة (quiz)\n`;
        menuText += `┃ 🧩 .لغز (riddle)\n`;
        menuText += `┃ 🎲 .تخمين (guess)\n`;
        menuText += `┃ 🤣 .نكتة (joke)\n`;
        menuText += `┃ 🐸 .ميمز (meme)\n`;
        menuText += `┃ 💡 .صراحة (truth)\n`;
        menuText += `┃ 🔥 .تحدي (dare)\n`;
        menuText += `┃ 💘 .حب (ship)\n`;
        menuText += `*╰━━━━━━━━━━━━━━━━━━━╯*\n\n`;

        // ⚙️ النظام
        menuText += `*╭━━❰ ⚙️ قسم النظام ❱━━╮*\n`;
        menuText += `┃ 🟢 .شغال (alive)\n`;
        menuText += `┃ ⚡ .سرعة (ping)\n`;
        menuText += `┃ 👑 .مطور (owner)\n`;
        menuText += `┃ 🌐 .لغة (setlang)\n`;
        menuText += `┃ 🔒 .وضع (mode)\n`;
        menuText += `*╰━━━━━━━━━━━━━━━━━━━╯*\n\n`;

        menuText += `*┃ 📢 القناة:* ${settings.officialChannel}\n`;
        menuText += `*┃ ✨ حمزة اعمرني نطور مستقبلك الرقمي! ✨*`;

        if (thumbBuffer) {
            await sock.sendMessage(chatId, {
                image: thumbBuffer,
                caption: menuText,
                contextInfo: {
                    externalAdReply: {
                        renderLargerThumbnail: true,
                        title: `🛡️ قائمة أوامر ${botName}`,
                        body: "𝐇𝐀𝐌𝐙𝐀 𝐀𝐌𝐈𝐑𝐍𝐈",
                        mediaType: 1,
                        thumbnail: thumbBuffer,
                        sourceUrl: settings.officialChannel
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
