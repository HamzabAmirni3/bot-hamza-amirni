const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const settings = require('../settings');

const API_URL = "https://obito-mr-apis.vercel.app/api/ai/analyze";

async function geminiAnalyzeCommand(sock, chatId, msg, args, commands, userLang) {
    try {
        let q = msg.quoted ? msg.quoted : msg;
        let mime = (q.msg || q).mimetype || '';

        if (!/image/.test(mime)) {
            return await sock.sendMessage(chatId, {
                text: `*⎔ ⋅ ───━ •﹝🧠﹞• ━─── ⋅ ⎔*\n\n` +
                    `📝 *طريقة الاستخدام:* \nأرسل صورة مع سؤال أو رد على صورة مكتوباً:\n${settings.prefix}حلل من هذه الشخصية؟\n\n` +
                    `𝐇𝐀𝐌𝐙𝐀 𝐀𝐌𝐈𝐑𝐍𝐈 \n` +
                    `*⎔ ⋅ ───━ •﹝🧠﹞• ━─── ⋅ ⎔*`
            }, { quoted: msg });
        }

        const question = args.join(' ') || "ما الموجود في هذه الصورة؟ وذكر اسم الشخصية إن وجدت";

        await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });
        const waitingMsg = await sock.sendMessage(chatId, { text: '⏳ جاري تحليل الصورة...' }, { quoted: msg });

        try {
            // Use the .download() method provided by smsg
            const imgBuffer = await q.download();

            if (!imgBuffer) throw new Error('فشل في تحميل الصورة');

            const base64Image = `data:${mime};base64,${imgBuffer.toString('base64')}`;

            // Send to API
            const { data } = await axios.post(API_URL, {
                image: base64Image,
                prompt: question,
                lang: "ar"
            }, { timeout: 30000 });

            // Delete waiting message
            try { await sock.sendMessage(chatId, { delete: waitingMsg.key }); } catch (e) { }

            const aiResult = data.results?.description || "لم يتم العثور على وصف لهذه الصورة.";

            let responseText = `*⎔ ⋅ ───━ •﹝🤖 التحليل الذكي ﹞• ━─── ⋅ ⎔*\n\n`;
            responseText += `${aiResult}\n\n`;
            responseText += `����� 𝐀𝐌𝐈��� - 𝐎𝐁𝐈𝐓𝐎 ���\n`;
            responseText += `*⎔ ⋅ ───━ •﹝✅﹞• ━─── ⋅ ⎔*`;

            await sock.sendMessage(chatId, { text: responseText }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error('Gemini Analyze Error:', err);
            if (waitingMsg) try { await sock.sendMessage(chatId, { delete: waitingMsg.key }); } catch (e) { }

            const errorMsg = err.response?.data?.error || err.message;
            await sock.sendMessage(chatId, { text: `❌ حدث خطأ في الـ API.\nالسبب: ${errorMsg}` }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }

    } catch (error) {
        console.error('Global Gemini Analyze Error:', error);
    }
}

module.exports = geminiAnalyzeCommand;

