const DailyAPI = require('../lib/dailyApi');
const settings = require('../settings');
const { t } = require('../lib/language');

async function faceswapCommand(sock, chatId, msg, args, commands, userLang) {
    let quoted = msg.quoted ? msg.quoted : msg;
    const isImage = quoted.mtype === 'imageMessage' || (quoted.msg && quoted.msg.mimetype && quoted.msg.mimetype.includes('image'));

    if (!isImage) {
        return await sock.sendMessage(chatId, { text: t('faceswap.help', { prefix: settings.prefix, botName: settings.botName }, userLang) }, { quoted: msg });
    }

    // Target is quoted image, Source is current message image.
    const sourceImage = msg.mtype === 'imageMessage' ? msg : null;
    const targetImage = msg.quoted && msg.quoted.mtype === 'imageMessage' ? msg.quoted : null;

    if (!sourceImage || !targetImage) {
        return await sock.sendMessage(chatId, { text: t('faceswap.error_dual', {}, userLang) }, { quoted: msg });
    }

    try {
        await sock.sendMessage(chatId, { text: t('faceswap.wait', {}, userLang) }, { quoted: msg });

        const sourceBuffer = await sock.downloadMediaMessage(sourceImage);
        const targetBuffer = await sock.downloadMediaMessage(targetImage);

        const api = new DailyAPI();
        const result = await api.generate({
            mode: 'swap',
            source: sourceBuffer,
            target: targetBuffer
        });

        if (result.error) {
            throw new Error(result.msg);
        }

        if (result.success && result.buffer) {
            await sock.sendMessage(chatId, {
                image: result.buffer,
                caption: t('faceswap.success', { botName: settings.botName }, userLang)
            }, { quoted: msg });
        } else {
            throw new Error("No image received from server.");
        }

    } catch (error) {
        console.error('Error in Face Swap:', error);
        await sock.sendMessage(chatId, { text: t('faceswap.error', { error: error.message || 'Unknown' }, userLang) }, { quoted: msg });
    }
}

module.exports = faceswapCommand;
