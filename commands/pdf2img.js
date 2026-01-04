/*
📄 تحويل ملف PDF إلى صور (الكل)
By: حمزة اعمرني (Hamza Amirni)
*/

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const axios = require('axios');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// رفع الملف إلى Catbox للحصول على رابط
const uploadToCatbox = async (buffer, filename) => {
    const form = new FormData();
    form.append('fileToUpload', buffer, filename);
    form.append('reqtype', 'fileupload');
    try {
        const response = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
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
            text: '*✨ ──────────────── ✨*\n📄 *تحويل PDF إلى صور (جميع الصفحات)* 📄\n\n📌 *يرجى الرد على ملف PDF بـ:*\n.pdf-صور\n*✨ ──────────────── ✨*'
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

        const waitMsg = await sock.sendMessage(chatId, { text: "🔄 جاري تحويل جميع صفحات الملف إلى صور... يرجى الانتظار." }, { quoted: msg });

        const pdfUrl = await uploadToCatbox(buffer, fileName);

        // محاولة التحويل عبر الـ APIs أولاً لجلب كل الصفحات
        const apis = [
            `https://api.vreden.my.id/api/pdftoimg?url=${encodeURIComponent(pdfUrl)}`,
            `https://api.shizuhub.me/tools/pdftoimg?url=${encodeURIComponent(pdfUrl)}`
        ];

        let images = [];
        let success = false;

        for (let apiUrl of apis) {
            try {
                console.log('Trying API for all pages:', apiUrl);
                const res = await axios.get(apiUrl, { timeout: 60000 });
                const data = res.data;

                images = data.result || data.data || (Array.isArray(data) ? data : []);
                if (images.length > 0) {
                    success = true;
                    break;
                }
            } catch (e) {
                console.error(`API ${apiUrl} failed, trying next...`);
            }
        }

        await sock.sendMessage(chatId, { delete: waitMsg.key });

        if (success && images.length > 0) {
            // إرسال جميع الصفحات (بحد أقصى 20 لتجنب الحظر)
            const limit = Math.min(images.length, 20);
            for (let i = 0; i < limit; i++) {
                const imgUrl = typeof images[i] === 'string' ? images[i] : images[i].url;
                await sock.sendMessage(chatId, {
                    image: { url: imgUrl },
                    caption: `📄 *الصفحة ${i + 1} من أصل ${images.length}*\n\n*HAMZA AMIRNI*`
                });
            }
            if (images.length > 20) {
                await sock.sendMessage(chatId, { text: "⚠️ تم إرسال أول 20 صفحة فقط للحفاظ على استقرار الشات." });
            }
        } else {
            // Fallback: Local conversion for at least the first page if APIs fail
            console.log('API failed, falling back to local conversion for page 1...');
            const tempDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const inputFile = path.join(tempDir, fileName);
            fs.writeFileSync(inputFile, buffer);

            const cmd = `libreoffice --headless --convert-to png --outdir "${tempDir}" "${inputFile}"`;
            await new Promise((resolve) => {
                exec(cmd, () => resolve());
            });

            const outputName = fileName.replace('.pdf', '.png');
            const outputFile = path.join(tempDir, outputName);

            if (fs.existsSync(outputFile)) {
                await sock.sendMessage(chatId, {
                    image: { url: outputFile },
                    caption: `📄 *تم تحويل الصفحة الأولى محلياً (فشل التحويل الكامل)*\n\n*HAMZA AMIRNI*`
                }, { quoted: msg });
                fs.unlinkSync(inputFile);
                fs.unlinkSync(outputFile);
            } else {
                throw new Error("فشل تحويل الملف بالكامل.");
            }
        }

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error('PDF to Img Full Error:', err);
        await sock.sendMessage(chatId, { text: `❌ *خطأ:* ${err.message}` }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

module.exports = handler;
