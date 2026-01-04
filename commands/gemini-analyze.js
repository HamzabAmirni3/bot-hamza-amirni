/*
🤖 تحليل الصور بالذكاء الاصطناعي - جيميني
By: حمزة اعمرني (Hamza Amirni)
channel: https://whatsapp.com/channel/0029ValXRoHCnA7yKopcrn1p
*/

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const axios = require('axios');
const fetch = require('node-fetch');
const FormData = require('form-data');

// رفع إلى Gofile
const uploadToGofile = async (buffer, ext) => {
    const form = new FormData();
    form.append('file', buffer, `file.${ext}`);

    try {
        const response = await fetch('https://store2.gofile.io/uploadFile', {
            method: 'POST',
            body: form,
        });
        const result = await response.json();

        if (result.status !== 'ok' || !result.data || !result.data.downloadPage) {
            throw new Error('فشل في رفع الملف إلى Gofile.io');
        }
        return result.data.downloadPage;
    } catch (error) {
        console.error('خطأ أثناء رفع الملف إلى Gofile:', error.message);
        throw new Error(`فشل في رفع الملف: ${error.message}`);
    }
};

// رفع إلى Catbox
const uploadToCatbox = async (buffer, ext) => {
    const form = new FormData();
    form.append('fileToUpload', buffer, `file.${ext}`);
    form.append('reqtype', 'fileupload');

    try {
        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: form,
        });

        const text = await response.text();
        console.log('Catbox Response:', text);

        if (text.startsWith('https://')) {
            return text;
        } else {
            throw new Error('فشل في رفع الملف إلى Catbox: ' + text);
        }
    } catch (error) {
        throw new Error(`فشل في رفع الملف: ${error.message}`);
    }
};

// تحليل الصورة باستخدام جيميني
const analyzeImageWithGemini = async (imageUrl, question) => {
    try {
        const encodedQuestion = encodeURIComponent(question);
        // جربنا الـ API الأول، دابا غادي نزيدو طريقة أكثر مرونة لقراءة الجواب
        const apiUrl = `https://obito-mr-apis.vercel.app/api/ai/gemini_2.5_flash?txt=${encodedQuestion}&img=${encodeURIComponent(imageUrl)}`;

        console.log('Calling Gemini API:', apiUrl);
        const response = await axios.get(apiUrl);
        console.log('Gemini API Raw Response:', response.data);

        return response.data;
    } catch (error) {
        console.error('Gemini API Error:', error.message);
        throw new Error(`فشل في تحليل الصورة: ${error.message}`);
    }
};

async function handler(sock, chatId, msg, args) {
    const question = args.join(' ').trim();

    // Determine target message (handle quoted)
    let targetMsg = msg;
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quotedInfo = msg.message.extendedTextMessage.contextInfo;
        targetMsg = {
            key: {
                remoteJid: chatId,
                id: quotedInfo.stanzaId,
                participant: quotedInfo.participant
            },
            message: quotedInfo.quotedMessage
        };
    }

    const mime = targetMsg.message?.imageMessage?.mimetype || '';

    if (!mime.startsWith('image/')) {
        return await sock.sendMessage(chatId, {
            text: '*⎔ ⋅ ───━ •﹝🔍 جيميني تحليل الصور ﹞• ━─── ⋅ ⎔*\n\n' +
                '📝 *الاستخدام:*\n' +
                '.جيميني-حلل السؤال\n' +
                'ثم قم بالرد على الصورة\n\n' +
                '*مثال:*\n' +
                '.جيميني-حلل ما الذي في الصورة؟\n' +
                'ثم رد على الصورة المراد تحليلها\n\n' +
                '𝐇𝐀𝐌𝐙𝐀 𝐀𝐌𝐈𝐑𝐍𝐈\n' +
                '*⎔ ⋅ ───━ •﹝🔍﹞• ━─── ⋅ ⎔*'
        }, { quoted: msg });
    }

    if (!question) {
        return await sock.sendMessage(chatId, {
            text: '❌ يرجى كتابة السؤال\nمثال: .جيميني-حلل ما الذي في الصورة؟'
        }, { quoted: msg });
    }

    try {
        const waitingMsg = await sock.sendMessage(chatId, {
            react: { text: "🔍", key: msg.key }
        });

        const img = await downloadMediaMessage(targetMsg, 'buffer', {}, {
            logger: undefined,
            reuploadRequest: sock.updateMediaMessage
        });

        if (!img) throw new Error("فشل تحميل الصورة");

        const ext = mime.split('/')[1] || 'jpg';

        let imageUrl;

        try {
            imageUrl = await uploadToCatbox(img, ext);
        } catch (catboxError) {
            try {
                imageUrl = await uploadToGofile(img, ext);
            } catch (gofileError) {
                throw new Error('فشل رفع الصورة لجميع السيرفرات');
            }
        }

        if (!imageUrl) throw new Error('فشل الحصول على رابط الصورة');

        const result = await analyzeImageWithGemini(imageUrl, question);

        // محددات النتيجة (حيت الـ API كيقدر يرجع النص نيشان أو كائن)
        let finalResult = "";
        if (typeof result === 'string') {
            finalResult = result;
        } else if (result.result) {
            finalResult = result.result;
        } else if (result.data) {
            finalResult = result.data;
        } else {
            // إذا كان الجواب غير معروف، نحولو لنص
            finalResult = JSON.stringify(result);
        }

        if (!finalResult || finalResult === "{}") {
            throw new Error('لم يتم استلام أي تحليل من الذكاء الاصطناعي');
        }

        let responseText = '*⎔ ⋅ ───━ •﹝🤖 تحليل جيميني ﹞• ━─── ⋅ ⎔*\n\n';
        responseText += `📝 *النتيجة:*\n${finalResult}\n\n`;
        responseText += `🕐 *الوقت:* ${new Date().toLocaleString('ar-SA')}\n\n`;
        responseText += '𝐇𝐀𝐌𝐙𝐀 𝐀𝐌𝐈𝐑𝐍𝐈\n';
        responseText += '*⎔ ⋅ ───━ •﹝🔍﹞• ━─── ⋅ ⎔*';

        await sock.sendMessage(chatId, {
            text: responseText,
            contextInfo: {
                externalAdReply: {
                    title: "تحليل الصور بجيميني",
                    body: "𝐇𝐀𝐌𝐙𝐀 𝐀𝐌𝐈𝐑𝐍𝐈",
                    thumbnailUrl: imageUrl,
                    sourceUrl: "https://whatsapp.com/channel/0029ValXRoHCnA7yKopcrn1p",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });

        await sock.sendMessage(chatId, {
            react: { text: "✅", key: msg.key }
        });

    } catch (err) {
        console.error('Error in Gemini Handler:', err);
        await sock.sendMessage(chatId, {
            text: `❌ *حدث خطأ*\n\n📌 *السبب:* ${err.message}`
        }, { quoted: msg });

        await sock.sendMessage(chatId, {
            react: { text: "❌", key: msg.key }
        });
    }
}

module.exports = handler;
