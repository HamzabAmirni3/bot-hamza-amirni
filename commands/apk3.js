const { fetchJson } = require('../lib/myfunc');
const { sendWithChannelButton } = require('../lib/channelButton');
const settings = require('../settings');

async function apk3Command(sock, chatId, msg, args, commands, userLang) {
    const query = args.join(' ').trim();
    const message = msg;

    if (!query) {
        const helpMsg = userLang === 'ma'
            ? `📥 *تحميل تطبيقات APK (V3)* 📥\n\n🔹 *الاستخدام:*\n${settings.prefix}apk3 [اسم التطبيق]\n\n📝 *أمثلة:*\n• ${settings.prefix}apk3 Instagram\n\n⚔️ ${settings.botName}`
            : userLang === 'ar'
                ? `📥 *تحميل تطبيقات APK (V3)* 📥\n\n🔹 *الاستخدام:*\n${settings.prefix}apk3 [اسم التطبيق]\n\n⚔️ ${settings.botName}`
                : `📥 *APK Downloader (V3)* 📥\n\n🔹 *Usage:*\n${settings.prefix}apk3 [App Name]\n\n⚔️ ${settings.botName}`;

        return await sendWithChannelButton(sock, chatId, helpMsg, message);
    }

    try {
        await sock.sendMessage(chatId, { react: { text: "⬇️", key: message.key } });

        const searchMsg = userLang === 'ma'
            ? `🔍 *جاري البحث عن "${query}" باستخدام أحدث API...*`
            : userLang === 'ar'
                ? `🔍 *جاري البحث عن "${query}" عبر API متطور...*`
                : `🔍 *Searching for "${query}" via advanced API...*`;
        await sendWithChannelButton(sock, chatId, searchMsg, message);

        // BK9 API for APK
        const apiUrl = `https://bk9.fun/download/apk?q=${encodeURIComponent(query)}`;
        const res = await fetchJson(apiUrl);

        if (!res.status || !res.BK9) {
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            const notFoundMsg = userLang === 'ma'
                ? `❌ *ما لقيناش "${query}" فهاد API.*`
                : `❌ *Could not find "${query}" in this API.*`;
            return await sendWithChannelButton(sock, chatId, notFoundMsg, message);
        }

        const app = res.BK9;
        const caption = userLang === 'ma'
            ? `🎮 *الاسم:* ${app.name}\n📦 *الحجم:* ${app.size}\n\n⏬ *هانا كنصيفطو ليك...*\n⚔️ ${settings.botName}`
            : `🎮 *Name:* ${app.name}\n📦 *Size:* ${app.size}\n\n⏬ *Sending file...*\n⚔️ ${settings.botName}`;

        await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

        await sock.sendMessage(chatId, {
            document: { url: app.dllink },
            fileName: `${app.name}.apk`,
            mimetype: 'application/vnd.android.package-archive',
            caption: caption,
            contextInfo: {
                externalAdReply: {
                    title: app.name,
                    body: `${app.size} - APK Downloader V3`,
                    mediaType: 1,
                    sourceUrl: app.dllink,
                    thumbnailUrl: app.icon,
                    renderLargerThumbnail: true,
                    showAdAttribution: false
                }
            }
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error('Error in apk3 command:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        const errorMsg = userLang === 'ma' ? "❌ *وقع مشكل ف API. جرب apk أو apk2.*" : "❌ *API Error. Try apk or apk2.*";
        await sendWithChannelButton(sock, chatId, errorMsg, message);
    }
}

module.exports = apk3Command;
