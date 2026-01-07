const axios = require("axios");
const { t } = require('../lib/language');
const settings = require('../settings');

async function gptCommand(sock, chatId, message, args, commands, userLang, match) {
    // Determine which model to use based on the command name called (via aliases or direct call)
    // We can check message.body to see what was actually typed if needed, 
    // but better to pass the model as a parameter or detect it from args.

    let model = 'gpt-4o'; // Default
    let commandCalled = '';

    // Attempt to detect command from message text
    const text = message.body || '';
    const prefix = settings.prefix;
    if (text.startsWith(prefix)) {
        commandCalled = text.slice(prefix.length).split(' ')[0].toLowerCase();
    }

    // Map command called to specific models
    const modelMap = {
        'gpt3': 'gpt-3.5-turbo',
        'gpt4': 'gpt-4',
        'gpt4t': 'gpt-4-turbo',
        'gpt4o': 'gpt-4o',
        'gpt4om': 'gpt-4o-mini',
        'o1': 'o1-preview',
        'o1m': 'o1-mini'
    };

    if (modelMap[commandCalled]) {
        model = modelMap[commandCalled];
    } else if (commandCalled === 'gpt' && args[0] && modelMap[args[0].toLowerCase()]) {
        // Support .gpt gpt4o [query]
        model = modelMap[args[0].toLowerCase()];
        args.shift();
    }

    try {
        const query = Array.isArray(args) ? args.join(' ') : args;

        if (!query || query.trim().length === 0) {
            const helpMsg = userLang === 'ma'
                ? `🤖 *GPT-Bot: ${model}*\n\n📝 *الاستخدام:*\n${settings.prefix}${commandCalled || 'gpt'} [سؤالك]\n\n💡 *الموديلات المتاحة:*\n.gpt4, .gpt4o, .gpt4om, .gpt3, .o1\n\n⚔️ ${settings.botName}`
                : userLang === 'ar'
                    ? `🤖 *GPT-Bot: ${model}*\n\n📝 *الاستخدام:*\n${settings.prefix}${commandCalled || 'gpt'} [سؤالك]\n\n💡 *الموديلات المتاحة:*\n.gpt4, .gpt4o, .gpt4om, .gpt3, .o1\n\n⚔️ ${settings.botName}`
                    : `🤖 *GPT-Bot: ${model}*\n\n📝 *Usage:*\n${settings.prefix}${commandCalled || 'gpt'} [question]\n\n💡 *Available Models:*\n.gpt4, .gpt4o, .gpt4om, .gpt3, .o1\n\n⚔️ ${settings.botName}`;

            return await sock.sendMessage(chatId, {
                text: helpMsg
            }, { quoted: message });
        }

        // React with 🤖 while processing
        await sock.sendMessage(chatId, {
            react: { text: "🤖", key: message.key }
        });

        const apiUrl = `https://all-in-1-ais.officialhectormanuel.workers.dev/?query=${encodeURIComponent(query)}&model=${model}`;

        const response = await axios.get(apiUrl);

        if (response.data && response.data.success && response.data.message?.content) {
            const answer = response.data.message.content;
            const caption = `🤖 *GPT (${model}):*\n\n${answer}`;
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });

            // Success reaction
            await sock.sendMessage(chatId, {
                react: { text: "✅", key: message.key }
            });
        } else {
            throw new Error("Invalid GPT response");
        }
    } catch (error) {
        console.error("GPT API Error:", error.message);
        const errMsg = userLang === 'ma' ? "❌ *فشل GPT. عاود جرب.*" : "❌ *GPT Error. Try again.*";
        await sock.sendMessage(chatId, { text: errMsg }, { quoted: message });
        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
    }
}

module.exports = gptCommand;
