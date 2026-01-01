const axios = require('axios');
const { t } = require('../lib/language');
const settings = require('../settings');

async function aiCheckCommand(sock, chatId, msg, args, commands, userLang) {
    const text = args.join(' ').trim();

    if (!text) {
        return await sock.sendMessage(chatId, { text: t('aicheck.help', { prefix: settings.prefix, botName: settings.botName }, userLang) }, { quoted: msg });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: "🧠", key: msg.key } });

        await sock.sendMessage(chatId, { text: t('aicheck.wait', {}, userLang) }, { quoted: msg });

        const res = await axios.post(
            'https://reilaa.com/api/turnitin-match',
            { text: text },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const data = res.data;

        if (!data || !data.reilaaResult?.value) {
            throw new Error('No results found.');
        }

        const result = data.reilaaResult.value;

        const output = `${t('aicheck.result_title', {}, userLang)}

${t('aicheck.classification', {}, userLang)} ${result.classification === 'AI' ? t('aicheck.ai', {}, userLang) : t('aicheck.human', {}, userLang)}
${t('aicheck.score', {}, userLang)} ${result.aiScore}%
${t('aicheck.risk', {}, userLang)} ${result.details.analysis.risk}
${t('aicheck.suggestion', {}, userLang)} ${result.details.analysis.suggestion}

📄 *Text Snippet:*
"${result.inputText.length > 500 ? result.inputText.substring(0, 500) + '...' : result.inputText}"

⚔️ ${settings.botName}`.trim();

        await sock.sendMessage(chatId, { text: output }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error('Error in AI Check:', err);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        await sock.sendMessage(chatId, { text: t('aicheck.error', {}, userLang) + `\n⚠️ ${err.response?.data?.message || err.message}` }, { quoted: msg });
    }
}

module.exports = aiCheckCommand;
