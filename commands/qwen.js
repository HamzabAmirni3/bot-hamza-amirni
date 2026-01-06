const axios = require('axios');
const { translateToEn } = require('../lib/translate');
const settings = require('../settings');
const { t } = require('../lib/language');

async function qwenCommand(sock, chatId, msg, args, commands, userLang) {
    try {
        const text = args.join(' ');
        const hfToken = process.env.HF_TOKEN || settings.hfToken;

        if (!hfToken) {
            return sock.sendMessage(chatId, {
                text: "❌ *API Token Missing*\n\nPlease set your `HF_TOKEN` in the environment variables to use the Qwen-Image model."
            }, { quoted: msg });
        }

        if (!text) {
            return sock.sendMessage(chatId, { text: t('ai.provide_prompt', {}, userLang) }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: t('ai.wait', {}, userLang) }, { quoted: msg });

        const enPrompt = await translateToEn(text);

        // HuggingFace Inference API with fal-ai provider
        const apiUrl = `https://api-inference.huggingface.co/models/Qwen/Qwen-Image-2512`;

        console.log(`[Qwen] Generating image for: ${enPrompt}`);

        const response = await axios.post(apiUrl,
            {
                inputs: enPrompt,
                parameters: {
                    provider: "fal-ai"
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${hfToken}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer',
                timeout: 90000 // 90 seconds
            }
        );

        if (response.status !== 200) {
            throw new Error(`HF API returned status ${response.status}`);
        }

        const buffer = Buffer.from(response.data, 'binary');

        await sock.sendMessage(chatId, {
            image: buffer,
            caption: `⚔️ *${settings.botName} Qwen-AI* ✨\n\n🤖 *Model:* Qwen-Image-2512\n🖌️ *Provider:* fal-ai\n📝 *الطلب:* ${text}\n👤 *بواسطة:* Hamza Amirni`
        }, { quoted: msg });

    } catch (err) {
        console.error('Qwen AI Error:', err.response ? err.response.data.toString() : err.message);
        let errorMsg = t('ai.error', {}, userLang);
        if (err.response && err.response.data) {
            try {
                const errorData = JSON.parse(err.response.data.toString());
                if (errorData.error) errorMsg += `\n⚠️ *HF Error:* ${errorData.error}`;
            } catch (e) { }
        }
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
    }
}

module.exports = qwenCommand;
