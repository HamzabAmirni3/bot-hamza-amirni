/*
📄 تحويل ملف PDF إلى صور
By: حمزة اعمرني (Hamza Amirni)
*/

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const axios = require('axios');
const fetch = require('node-fetch');
const FormData = require('form-data');

// رفع الملف إلى Catbox للحصول على رابط
const uploadToCatbox = async (buffer, filename) => {
    const form = new FormData();
    form.append('fileToUpload', buffer, filename);
    form.append('reqtype', 'fileupload');

    try {
        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: form,
        });
        const text = await response.text();
        if (text.startsWith('https://')) return text;
        throw new Error('Catbox Upload Failed: ' + text);
    } catch (error) {
        throw new Error(`Upload Error: ${error.message}`);
    }
};

async function handler(sock, chatId, msg, args) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isQuotedDoc = quoted?.documentMessage;
    const isDirectDoc = msg.message?.documentMessage;

    if (!isQuotedDoc && !isDirectDoc) {
        return await sock.sendMessage(chatId, {
            text: '📄 *تحويل PDF إلى صور* 📄\n\n📌 *يرجى الرد على ملف PDF بـ:*\n.pdf2img\n\n- سيقوم البوت بتحويل صفحات الملف إلى صور.'
        }, { quoted: msg });
    }

    const docMsg = isDirectDoc ? msg.message.documentMessage : quoted.documentMessage;
    if (docMsg.mimetype !== 'application/pdf') {
        return await sock.sendMessage(chatId, { text: '❌ يرجى اختيار ملف بصيغة PDF فقط.' }, { quoted: msg });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

        const targetMsg = isQuotedDoc ? {
            key: {
                remoteJid: chatId,
                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                participant: msg.message.extendedTextMessage.contextInfo.participant
            },
            message: quoted
        } : msg;

        const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: undefined, reuploadRequest: sock.updateMediaMessage });
        if (!buffer) throw new Error("فشل تحميل الملف.");

        const fileName = docMsg.fileName || `file_${Date.now()}.pdf`;

        const waitMsg = await sock.sendMessage(chatId, { text: "🔄 جاري تحويل الملف... قد يستغرق هذا وقتاً حسب حجم الملف." }, { quoted: msg });

        const pdfUrl = await uploadToCatbox(buffer, fileName);

        // قائمة بـ APIs محتملة للتحويل (Fallbacks)
        const apis = [
            `https://api.vreden.my.id/api/pdftoimg?url=${encodeURIComponent(pdfUrl)}`,
            `https://api.shizuhub.me/tools/pdftoimg?url=${encodeURIComponent(pdfUrl)}`,
            `https://obito-mr-apis.vercel.app/api/tools/pdf-to-img?url=${encodeURIComponent(pdfUrl)}` // فرضية
        ];

        let images = [];
        let success = false;

        for (let apiUrl of apis) {
            try {
                console.log('Trying PDF to Img API:', apiUrl);
                const res = await axios.get(apiUrl, { timeout: 60000 });
                const data = res.data;

                if (data.status === true || data.result || Array.isArray(data)) {
                    if (Array.isArray(data.result)) {
                        images = data.result;
                    } else if (data.result && Array.isArray(data.result.images)) {
                        images = data.result.images;
                    } else if (Array.isArray(data)) {
                        images = data;
                    } else if (data.data && Array.isArray(data.data)) {
                        images = data.data;
                    }

                    if (images.length > 0) {
                        success = true;
                        break;
                    }
                }
            } catch (e) {
                console.error(`API ${apiUrl} failed:`, e.message);
            }
        }

        await sock.sendMessage(chatId, { delete: waitMsg.key });

        if (!success || images.length === 0) {
            throw new Error("لم نتمكن من تحويل الملف حالياً. جرب لاحقاً أو استعمل ملفاً أصغر.");
        }

        // إرسال أول 10 صفحات لتجنب السبام
        const limit = Math.min(images.length, 10);

        for (let i = 0; i < limit; i++) {
            await sock.sendMessage(chatId, {
                image: { url: images[i] },
                caption: `📄 الصفحة ${i + 1} من أصل ${images.length}\n*⎔ ⋅ ───━ •﹝🦅﹞• ━─── ⋅ ⎔*`
            });
        }

        if (images.length > limit) {
            await sock.sendMessage(chatId, { text: `⚠️ تم إرسال أول ${limit} صفحات فقط لتجنب الإزعاج.` }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error('PDF to Img Error:', err);
        await sock.sendMessage(chatId, { text: `❌ *خطأ:* ${err.message}` }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

module.exports = handler;
