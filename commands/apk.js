const axios = require('axios');
const { sendWithChannelButton } = require('../lib/channelButton');
const settings = require('../settings');
const { t } = require('../lib/language');

async function apkCommand(sock, chatId, message, args, commands, userLang) {
    const query = args.join(' ').trim();
    // userLang is now passed directly


    if (!query) {
        const helpMsg = userLang === 'ma'
            ? `📥 *تحميل تطبيقات APK (سريع)* 📥\n\n🔹 *الاستخدام:*\n${settings.prefix}apk [اسم التطبيق]\n\n📝 *أمثلة:*\n• ${settings.prefix}apk Instagram\n• ${settings.prefix}apk WhatsApp Lite\n\n⚔️ ${settings.botName}`
            : userLang === 'ar'
                ? `📥 *تحميل تطبيقات APK (سريع)* 📥\n\n🔹 *الاستخدام:*\n${settings.prefix}apk [اسم التطبيق]\n\n📝 *أمثلة:*\n• ${settings.prefix}apk Instagram\n\n⚔️ ${settings.botName}`
                : `📥 *APK Downloader (Fast)* 📥\n\n🔹 *Usage:*\n${settings.prefix}apk [App Name]\n\n📝 *Examples:*\n• ${settings.prefix}apk Instagram\n\n⚔️ ${settings.botName}`;

        return await sendWithChannelButton(sock, chatId, helpMsg, message);
    }

    try {
        // Step 1: React with download icon
        await sock.sendMessage(chatId, { react: { text: "⬇️", key: message.key } });

        const searchMsg = userLang === 'ma'
            ? `🔍 *كنقلب على "${query}"...*`
            : userLang === 'ar'
                ? `🔍 *جاري البحث عن "${query}"...*`
                : `🔍 *Searching for "${query}"...*`;
        await sendWithChannelButton(sock, chatId, searchMsg, message);

        // Aptoide API URL
        const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=1`;

        const response = await axios.get(apiUrl, { timeout: 15000 });
        const data = response.data;

        if (!data.datalist || !data.datalist.list || !data.datalist.list.length) {
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            const notFoundMsg = userLang === 'ma'
                ? `❌ *ما لقيناش "${query}".*`
                : userLang === 'ar'
                    ? `❌ *عذراً، لم يتم العثور على "${query}".*`
                    : `❌ *No results found for "${query}".*`;
            return await sendWithChannelButton(sock, chatId, notFoundMsg, message);
        }

        const app = data.datalist.list[0];
        const sizeMB = (app.size / (1024 * 1024)).toFixed(2);

        // Large file warning (WhatsApp has limits)
        if (parseFloat(sizeMB) > 300) {
            await sock.sendMessage(chatId, { react: { text: "⚠️", key: message.key } });
            const largeMsg = userLang === 'ma'
                ? `⚠️ *التطبيق كبير بزاف (${sizeMB} MB). ما نقدرش نصيفطو.*`
                : userLang === 'ar'
                    ? `⚠️ *حجم التطبيق كبير جداً (${sizeMB} MB). الحد الأقصى 300 ميجا.*`
                    : `⚠️ *App too large (${sizeMB} MB). Limit is 300MB.*`;
            return await sendWithChannelButton(sock, chatId, largeMsg, message);
        }

        const caption = userLang === 'ma'
            ? `🎮 *اسم التطبيق:* ${app.name}\n📦 *الحزمة:* ${app.package}\n📅 *ميزاجور:* ${app.updated}\n📁 *الحجم:* ${sizeMB} MB\n\n⏬ *هانا كنصيفطو ليك...*\n⚔️ ${settings.botName}`
            : `🎮 *App Name:* ${app.name}\n📦 *Package:* ${app.package}\n📅 *Updated:* ${app.updated}\n📁 *Size:* ${sizeMB} MB\n\n⏬ *Sending file...*\n⚔️ ${settings.botName}`;

        // Step 2: React with upload icon
        await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

        // Download link (using path_alt as in user request)
        const downloadUrl = app.file.path_alt || app.file.path;

        // Send the document
        await sock.sendMessage(chatId, {
            document: { url: downloadUrl },
            fileName: `${app.name}.apk`,
            mimetype: 'application/vnd.android.package-archive',
            caption: caption,
            contextInfo: {
                externalAdReply: {
                    title: app.name,
                    body: `${sizeMB} MB - APK Downloader`,
                    mediaType: 1,
                    sourceUrl: downloadUrl,
                    thumbnailUrl: app.icon,
                    renderLargerThumbnail: true,
                    showAdAttribution: false
                }
            }
        }, { quoted: message });

        // Final reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error('Error in apk command:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });

        let errorMsg = userLang === 'ma' ? "❌ *وقع مشكل ف التحميل.*" : "❌ *Error downloading APK.*";
        if (error.response && error.response.status === 404) {
            errorMsg = userLang === 'ma' ? "❌ *التطبيق ما بقاش متوفر.*" : "❌ *App not found.*";
        }

        await sendWithChannelButton(sock, chatId, errorMsg, message);
    }
}

module.exports = apkCommand;
