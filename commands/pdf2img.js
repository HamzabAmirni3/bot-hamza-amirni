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
const AdmZip = require('adm-zip');

// رفع الملف إلى Catbox للحصول على رابط
const uploadToCatbox = async (buffer, filename) => {
    const form = new FormData();
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.]/g, '_');
    form.append('fileToUpload', buffer, cleanFilename);
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
        const waitMsg = await sock.sendMessage(chatId, { text: "🔄 جاري تحويل جميع صفحات الملف إلى صور... العمليات الطويلة قد تستغرق دقيقة." }, { quoted: msg });

        const pdfUrl = await uploadToCatbox(buffer, fileName);

        // قائمة APIs فعالة
        const apis = [
            `https://api.vreden.my.id/api/pdftoimg?url=${encodeURIComponent(pdfUrl)}`,
            `https://api.shizuhub.me/tools/pdftoimg?url=${encodeURIComponent(pdfUrl)}`,
            `https://api.lolhuman.xyz/api/pdf2img?apikey=FREE&url=${encodeURIComponent(pdfUrl)}`
        ];

        let images = [];
        let success = false;

        for (let apiUrl of apis) {
            try {
                console.log('Trying API:', apiUrl);
                const res = await axios.get(apiUrl, { timeout: 60000 });
                const data = res.data;

                images = data.result || data.data || (Array.isArray(data) ? data : []);
                if (images && images.length > 0) {
                    success = true;
                    break;
                }
            } catch (e) {
                console.error(`API failed: ${apiUrl}`);
            }
        }

        try { await sock.sendMessage(chatId, { delete: waitMsg.key }); } catch (e) { }

        if (success && images.length > 0) {
            const total = images.length;
            await sock.sendMessage(chatId, { text: `✅ تم معالجة ${total} صفحة من الـ API. جاري الإرسال...` }, { quoted: msg });

            if (total > 30) {
                const zip = new AdmZip();
                for (let i = 0; i < total; i++) {
                    const imgUrl = typeof images[i] === 'string' ? images[i] : (images[i].url || images[i].result);
                    try {
                        const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                        zip.addFile(`page_${i + 1}.png`, Buffer.from(imgRes.data));
                    } catch (e) { }
                }
                const zipBuffer = zip.toBuffer();
                await sock.sendMessage(chatId, {
                    document: zipBuffer,
                    mimetype: 'application/zip',
                    fileName: `${fileName.replace('.pdf', '')}_images.zip`,
                    caption: `📄 تم تحويل ${total} صفحة.\nتم ضغطها في ملف ZIP.`
                }, { quoted: msg });
            } else {
                for (let i = 0; i < total; i++) {
                    const imgUrl = typeof images[i] === 'string' ? images[i] : (images[i].url || images[i].result);
                    await sock.sendMessage(chatId, {
                        image: { url: imgUrl },
                        caption: `📄 *الصفحة ${i + 1} من أصل ${total}*`
                    });
                }
            }
        } else {
            // Local Fallback: Use LibreOffice HTML export trick to get ALL pages
            console.log('API failed, trying local conversion for all pages...');
            const tempDir = path.join(process.cwd(), 'tmp', `local_pdf_${Date.now()}`);
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const inputFile = path.join(tempDir, 'input.pdf');
            fs.writeFileSync(inputFile, buffer);

            const cmd = `libreoffice --headless --convert-to html --outdir "${tempDir}" "${inputFile}"`;

            await new Promise((resolve) => {
                exec(cmd, (error, stdout, stderr) => {
                    console.log('LibreOffice Output:', stdout);
                    resolve();
                });
            });

            // Find all .png or .jpg files in the temp directory (images generated by LibreOffice)
            const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));

            if (files.length > 0) {
                // Sort files numerically to keep order (LibreOffice usually names them img0, img1...)
                files.sort((a, b) => {
                    const numA = parseInt(a.match(/\d+/) || 0);
                    const numB = parseInt(b.match(/\d+/) || 0);
                    return numA - numB;
                });

                await sock.sendMessage(chatId, { text: `✅ تم التحويل محلياً: وُجدت ${files.length} صفحة.` }, { quoted: msg });

                if (files.length > 20) {
                    const zip = new AdmZip();
                    files.forEach(f => zip.addLocalFile(path.join(tempDir, f)));
                    const zipBuffer = zip.toBuffer();
                    await sock.sendMessage(chatId, {
                        document: zipBuffer,
                        mimetype: 'application/zip',
                        fileName: `${fileName.replace('.pdf', '')}_local.zip`,
                        caption: `📄 تم تحويل ${files.length} صفحة محلياً.`
                    }, { quoted: msg });
                } else {
                    for (let i = 0; i < files.length; i++) {
                        await sock.sendMessage(chatId, {
                            image: { url: path.join(tempDir, files[i]) },
                            caption: `📄 *الصفحة ${i + 1} (تحويل محلي)*`
                        });
                    }
                }
            } else {
                throw new Error("تعذر التحويل محلياً أيضاً. تأكد من سلامة الملف.");
            }

            // Cleanup
            setTimeout(() => {
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                } catch (e) { }
            }, 5000);
        }

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error('PDF to Img Error:', err);
        await sock.sendMessage(chatId, { text: `❌ *خطأ:* ${err.message}` }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

module.exports = handler;
