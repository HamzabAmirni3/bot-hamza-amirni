const { sendWithChannelButton } = require('../lib/channelButton');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { t } = require('../lib/language');
const { uploadImage } = require('../lib/uploader');

async function pdfCommand(sock, chatId, message, args, commands, userLang) {
    const text = args.join(' ').trim();
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isQuotedImage = quoted?.imageMessage;
    const isDirectImage = message.message?.imageMessage;

    // 1. Handle Photo to PDF
    if (isDirectImage || isQuotedImage) {
        try {
            await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });
            await sock.sendMessage(chatId, { text: t('pdf.converting_image', {}, userLang) }, { quoted: message });

            const targetMsg = isQuotedImage ? { message: quoted } : message;
            // Fake context for downloadMediaMessage if quoted
            if (isQuotedImage) {
                targetMsg.key = {
                    remoteJid: chatId,
                    id: message.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: message.message.extendedTextMessage.contextInfo.participant
                };
            }

            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: undefined, reuploadRequest: sock.updateMediaMessage });
            const imageUrl = await uploadImage(buffer);

            // Try multiple APIs for Image to PDF
            let response;
            try {
                // API 1: Ryzendesu (Stable)
                response = await axios.get(`https://api.ryzendesu.vip/api/tools/img2pdf?url=${encodeURIComponent(imageUrl)}`, { responseType: 'arraybuffer', timeout: 45000 });
            } catch (e1) {
                try {
                    // API 2: Caliph Fallback
                    response = await axios.get(`https://api.caliph.biz.id/api/imagetopdf?url=${encodeURIComponent(imageUrl)}&apikey=caliphkey`, { responseType: 'arraybuffer', timeout: 30000 });
                } catch (e2) {
                    // API 3: Tiklydown
                    response = await axios.get(`https://api.tiklydown.eu.org/api/tools/img2pdf?url=${encodeURIComponent(imageUrl)}`, { responseType: 'arraybuffer', timeout: 30000 });
                }
            }

            if (!response || !response.data) throw new Error("All APIs failed");

            const tempDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const tempFile = path.join(tempDir, `image_${Date.now()}.pdf`);
            fs.writeFileSync(tempFile, response.data);

            await sock.sendMessage(chatId, {
                document: { url: tempFile },
                fileName: "image_converted.pdf",
                mimetype: "application/pdf",
                caption: t('pdf.success_image', { botName: settings.botName }, userLang)
            }, { quoted: message });

            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });
            return;

        } catch (e) {
            console.error('Photo to PDF Error:', e);
            await sock.sendMessage(chatId, { text: t('pdf.error_image', {}, userLang) }, { quoted: message });
            return;
        }
    }

    // 2. Handle Text to PDF
    const content = text || quoted?.conversation || quoted?.extendedTextMessage?.text;

    if (content) {
        try {
            await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });
            await sock.sendMessage(chatId, { text: t('pdf.converting_text', {}, userLang) }, { quoted: message });

            // Try reliable Text to PDF APIs
            let response;
            try {
                // Using a more reliable way: Ryzendesu Tool for Text to PDF if exists or similar
                // Fallback to a working public converter
                response = await axios.get(`https://api.vreden.my.id/api/txt2pdf?text=${encodeURIComponent(content)}`, { responseType: 'arraybuffer', timeout: 30000 });
            } catch (e1) {
                try {
                    const htmlContent = `<html><body><pre style="font-family: Arial; white-space: pre-wrap;">${content.replace(/</g, '&lt;')}</pre></body></html>`;
                    response = await axios.get(`https://api.html2pdf.app/v1/generate?html=${encodeURIComponent(htmlContent)}&apiKey=fb5d282d8299763784131df66270929280d9659b81b8969877717887550ca2fc`, { responseType: 'arraybuffer' });
                } catch (e2) {
                    throw new Error("Text to PDF failed");
                }
            }

            const tempDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const tempFile = path.join(tempDir, `text_${Date.now()}.pdf`);
            fs.writeFileSync(tempFile, response.data);

            await sock.sendMessage(chatId, {
                document: { url: tempFile },
                fileName: "text_converted.pdf",
                mimetype: "application/pdf",
                caption: t('pdf.success_text', { botName: settings.botName }, userLang)
            }, { quoted: message });

            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });
            return;

        } catch (e) {
            console.error('Text to PDF Error:', e);
            await sock.sendMessage(chatId, { text: t('pdf.error_text', {}, userLang) }, { quoted: message });
            return;
        }
    }

    // 3. Show Usage Help (Strictly Text/Image only)
    const helpMsg = t('pdf.usage', { prefix: settings.prefix, botName: t('common.botName', {}, userLang) }, userLang);
    return await sendWithChannelButton(sock, chatId, helpMsg, message, {}, userLang);
}

module.exports = pdfCommand;
