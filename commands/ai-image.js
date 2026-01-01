const axios = require('axios');
const settings = require('../settings');
const { t } = require('../lib/language');

/**
 * AI Labs - Image Generation Logic
 * Scrape by DAFFA
 */
const aiLabs = {
    api: {
        base: 'https://text2pet.zdex.top',
        endpoints: {
            images: '/images'
        }
    },
    headers: {
        'user-agent': 'NB Android/1.0.0',
        'accept-encoding': 'gzip',
        'content-type': 'application/json',
        authorization: ''
    },
    state: { token: null },
    setup: {
        cipher: 'hbMcgZLlzvghRlLbPcTbCpfcQKM0PcU0zhPcTlOFMxBZ1oLmruzlVp9remPgi0QWP0QW',
        shiftValue: 3,
        dec(text, shift) {
            return [...text].map(c =>
                /[a-z]/.test(c) ?
                    String.fromCharCode((c.charCodeAt(0) - 97 - shift + 26) % 26 + 97) :
                    /[A-Z]/.test(c) ?
                        String.fromCharCode((c.charCodeAt(0) - 65 - shift + 26) % 26 + 65) :
                        c
            ).join('');
        },
        decrypt: async () => {
            if (aiLabs.state.token) return aiLabs.state.token;
            const decrypted = aiLabs.setup.dec(aiLabs.setup.cipher, aiLabs.setup.shiftValue);
            aiLabs.state.token = decrypted;
            aiLabs.headers.authorization = decrypted;
            return decrypted;
        }
    },
    generateImage: async (prompt = '') => {
        // Basic validation
        if (!prompt?.trim()) {
            return { success: false, error: 'Empty prompt' };
        }

        await aiLabs.setup.decrypt();
        try {
            const payload = { prompt };
            const url = aiLabs.api.base + aiLabs.api.endpoints.images;
            const res = await axios.post(url, payload, { headers: aiLabs.headers });

            if (res.data.code !== 0 || !res.data.data) {
                return { success: false, error: 'Server failed to generate image.' };
            }
            return { success: true, url: res.data.data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
};

async function aiImageCommand(sock, chatId, msg, args, commands, userLang) {
    const text = args.join(' ').trim();

    if (!text) {
        return await sock.sendMessage(chatId, { text: t('ai_image.help', { prefix: settings.prefix, botName: settings.botName }, userLang) }, { quoted: msg });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

        await sock.sendMessage(chatId, { text: t('ai_image.wait', {}, userLang) }, { quoted: msg });

        // Translate to English for better API results
        let promptToUse = text;
        try {
            const trRes = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
            if (trRes.data?.[0]?.[0]?.[0]) {
                promptToUse = trRes.data[0][0][0];
            }
        } catch (e) {
            console.warn('Translation failed in ai-image:', e.message);
        }

        const response = await aiLabs.generateImage(promptToUse);

        if (response.success) {
            await sock.sendMessage(chatId, {
                image: { url: response.url },
                caption: t('ai_image.success', { text, botName: settings.botName }, userLang)
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "🎨", key: msg.key } });
        } else {
            throw new Error(response.error);
        }

    } catch (error) {
        console.error('ai-image error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        await sock.sendMessage(chatId, { text: t('ai.error', {}, userLang) + `\n⚠️ ${error.message}` }, { quoted: msg });
    }
}

module.exports = aiImageCommand;
