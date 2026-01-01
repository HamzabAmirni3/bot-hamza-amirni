const axios = require("axios");
const { t } = require('../lib/language');
const settings = require('../settings');

async function deepseekCommand(sock, chatId, message, args, commands, userLang) {
    try {
        const query = (Array.isArray(args) ? args.join(' ') : args) || "";
        if (!query.trim()) {
            return await sock.sendMessage(chatId, { text: t('deepseek.help', {}, userLang) }, { quoted: message });
        }

        // React with 🤖 while processing
        await sock.sendMessage(chatId, {
            react: { text: "🤖", key: message.key }
        });

        const apiUrl = `https://all-in-1-ais.officialhectormanuel.workers.dev/?query=${encodeURIComponent(query)}&model=deepseek`;

        const response = await axios.get(apiUrl);

        if (response.data && response.data.success && response.data.message?.content) {
            const answer = response.data.message.content;
            await sock.sendMessage(chatId, { text: answer }, { quoted: message });
        } else {
            throw new Error("Invalid Deepseek response");
        }
    } catch (error) {
        console.error("Deepseek API Error:", error.message);
        await sock.sendMessage(chatId, { text: t('deepseek.error', {}, userLang) }, { quoted: message });
    }
}

module.exports = deepseekCommand;
