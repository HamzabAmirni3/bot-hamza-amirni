/*
📄 تحويل ملف PDF إلى صور (محلي)
By: حمزة اعمرني (Hamza Amirni)
*/

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function handler(sock, chatId, msg, args) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isQuotedDoc = quoted?.documentMessage;
    const isDirectDoc = msg.message?.documentMessage;

    if (!isQuotedDoc && !isDirectDoc) {
        return await sock.sendMessage(chatId, {
            text: '*✨ ──────────────── ✨*\n📄 *تحويل PDF إلى صور* 📄\n\n📌 *يرجى الرد على ملف PDF بـ:*\n.pdf2img\n*✨ ──────────────── ✨*'
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

        const tempDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const inputName = `pdf_${Date.now()}.pdf`;
        const inputFile = path.join(tempDir, inputName);
        fs.writeFileSync(inputFile, buffer);

        const waitMsg = await sock.sendMessage(chatId, { text: "🔄 جاري تحويل الملف إلى صور محلياً... (قد يستغرق وقتاً)" }, { quoted: msg });

        // محاولة التحويل باستخدام LibreOffice (كما في الوورد)
        // ملاحظة: LibreOffice يحول الصفحة الأولى فقط في العادة بصيغة PNG
        const cmd = `libreoffice --headless --convert-to png --outdir "${tempDir}" "${inputFile}"`;

        await new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error('LibreOffice PDF to Img Error:', stderr);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        const outputName = inputName.replace('.pdf', '.png');
        const outputFile = path.join(tempDir, outputName);

        if (fs.existsSync(outputFile)) {
            await sock.sendMessage(chatId, {
                image: { url: outputFile },
                caption: `📄 *تحويل الصفحة الأولى بنجاح* ✨\n\n*HAMZA AMIRNI*`
            }, { quoted: msg });

            // تنظيف الملفات
            fs.unlinkSync(inputFile);
            fs.unlinkSync(outputFile);
        } else {
            // إذا فشل LibreOffice، جربنا API بديل (vreden.my.id)
            console.log('LibreOffice output not found, falling back to API...');
            const axios = require('axios');
            const fetch = require('node-fetch');
            const FormData = require('form-data');

            const uploadToCatbox = async (buf, name) => {
                const form = new FormData();
                form.append('fileToUpload', buf, name);
                form.append('reqtype', 'fileupload');
                const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
                return await res.text();
            };

            const pdfUrl = await uploadToCatbox(buffer, inputName);
            const apiUrl = `https://api.vreden.my.id/api/pdftoimg?url=${encodeURIComponent(pdfUrl)}`;
            const res = await axios.get(apiUrl);

            let images = res.data.result || res.data.data || [];
            if (Array.isArray(images) && images.length > 0) {
                for (let i = 0; i < Math.min(images.length, 5); i++) {
                    await sock.sendMessage(chatId, { image: { url: images[i] }, caption: `📄 الصفحة ${i + 1}` });
                }
            } else {
                throw new Error("لم يتم العثور على صور في الملف.");
            }
        }

        await sock.sendMessage(chatId, { delete: waitMsg.key });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error('PDF to Img Error:', err);
        await sock.sendMessage(chatId, { text: `❌ *فشل التحويل:* ${err.message}` }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

module.exports = handler;
