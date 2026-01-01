const settings = require('../settings');
const { t } = require('../lib/language');

async function reminiCommand(sock, chatId, msg, args, commands, userLang) {
    try {
        const quoted = msg.quoted ? msg.quoted : msg;
        const mime = (quoted.msg || quoted).mimetype || '';

        if (!/image/.test(mime)) {
            return await sock.sendMessage(chatId, { text: t('ai_enhance.help', { prefix: settings.prefix }, userLang) }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: t('remini.wait', {}, userLang) }, { quoted: msg });

        // Remini typically requires a paid API. For now, we inform the user via localized error.
        await sock.sendMessage(chatId, { text: t('remini.error_no_api', {}, userLang) }, { quoted: msg });

    } catch (error) {
        console.error('Remini Error:', error);
        await sock.sendMessage(chatId, { text: t('remini.error', {}, userLang) }, { quoted: msg });
    }
}

module.exports = reminiCommand;
