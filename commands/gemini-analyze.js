const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');
const settings = require('../settings');
const { t } = require('../lib/language');

async function geminiAnalyzeCommand(sock, chatId, msg, args, commands, userLang) {
    try {
        const question = args.join(' ').trim();

        let targetMessage = msg;
        let isImage = msg.message?.imageMessage;

        // Check if it's a reply to an image
        if (!isImage && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
            const quotedInfo = msg.message.extendedTextMessage.contextInfo;
            targetMessage = {
                key: { remoteJid: chatId, id: quotedInfo.stanzaId, participant: quotedInfo.participant },
                message: quotedInfo.quotedMessage
            };
            isImage = true;
        }

        if (!isImage) {
            return await sock.sendMessage(chatId, {
                text: '*⎔ ⋅ ───━ •﹝🔍 جيميني تحليل الصور ﹞• ━─── ⋅ ⎔*\n\n' +
                    '📝 *الاستخدام:*\n' +
                    '.جيميني-حلل السؤال\n' +
                    'ثم قم بالرد على الصورة\n\n' +
                    '*مثال:*\n' +
                    '.جيميني-حلل ما الذي في الصورة؟\n' +
                    'ثم رد على الصورة المراد تحليلها\n\n' +
                    `⚔️ ${settings.botName}`
            }, { quoted: msg });
        }

        if (!question) {
            return await sock.sendMessage(chatId, {
                text: '❌ يرجى كتابة السؤال\nمثال: .جيميني-حلل ما الذي في الصورة؟'
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });
        const waitingMsg = await sock.sendMessage(chatId, { text: '🔄 جاري تحميل وتحليل الصورة... يرجى الانتظار.' }, { quoted: msg });

        try {
            // 1. Download image
            const buffer = await downloadMediaMessage(targetMessage, 'buffer', {}, {
                logger: undefined,
                reuploadRequest: sock.updateMediaMessage
            });

            if (!buffer) throw new Error('فشل في تحميل الصورة');

            // 2. Upload image to get URL
            const imageUrl = await uploadImage(buffer);
            if (!imageUrl) throw new Error('فشل في رفع الصورة');

            // 3. Analyze with Obito API
            const apiUrl = `https://obito-mr-apis.vercel.app/api/ai/gemini_2.5_flash?txt=${encodeURIComponent(question)}&img=${encodeURIComponent(imageUrl)}`;
            const response = await axios.get(apiUrl);
            const result = response.data;

            if (!result.success || !result.result) {
                throw new Error('فشل في الحصول على تحليل من المحرك');
            }

            // Delete waiting message
            try { await sock.sendMessage(chatId, { delete: waitingMsg.key }); } catch (e) { }

            // 4. Send Result
            let responseText = '*⎔ ⋅ ───━ •﹝🤖 تحليل جيميني ﹞• ━─── ⋅ ⎔*\n\n';
            responseText += `❓ *السؤال:* ${question}\n\n`;
            responseText += `📝 *النتیجة:*\n${result.result}\n\n`;
            if (result.responseTime) responseText += `⏱️ *زمن الاستجابة:* ${result.responseTime}\n`;
            responseText += `🕐 *الوقت:* ${new Date().toLocaleString('ar-SA')}\n\n`;
            responseText += `⚔️ ${settings.botName}`;

            await sock.sendMessage(chatId, {
                text: responseText,
                contextInfo: {
                    externalAdReply: {
                        title: "GEMINI VISION AI",
                        body: "𝐇𝐀𝐌𝐙𝐀 𝐀𝐌𝐈𝐑𝐍𝐈",
                        thumbnailUrl: imageUrl,
                        sourceUrl: settings.officialChannel,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });

            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error('Gemini Analyze Error:', err);
            await sock.sendMessage(chatId, { text: `❌ حدث خطأ: ${err.message}` }, { quoted: msg });
        }

    } catch (error) {
        console.error('Global Gemini Analyze Error:', error);
    }
}

module.exports = geminiAnalyzeCommand;
