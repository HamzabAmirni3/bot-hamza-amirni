const axios = require("axios");
const { sendWithChannelButton } = require('../lib/channelButton');
const settings = require('../settings');
const { uploadImage } = require('../lib/uploadImage');
const { translateToEn } = require('../lib/translate');
const { t } = require('../lib/language');

/**
 * AI Image Modifier (img2img / reimage)
 * Uses Vreden or Ryzendesu API for actual editing
 */
async function img2img(url, prompt) {
    try {
        // Preference for Vreden as it often respects the image structure better
        const apiUrl = `https://api.vreden.my.id/api/reimage?url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`;

        const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 60000 });

        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
            const json = JSON.parse(response.data.toString());
            if (json.error) throw new Error(json.error);
        }

        return response.data;
    } catch (error) {
        console.error("Vreden Edit Error, trying Ryzendesu:", error.message);
        try {
            const apiUrl = `https://api.ryzendesu.vip/api/ai/img2img?url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`;
            const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 60000 });
            return response.data;
        } catch (err2) {
            console.error("All Edit APIs failed:", err2.message);
            throw new Error("فشلت معالجة التعديل (All APIs Failed).");
        }
    }
}

async function editCommand(sock, chatId, msg, args, commands, userLang) {
    let url = "";
    let prompt = "";

    // Check for quoted image or direct image
    let quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ? {
        message: msg.message.extendedTextMessage.contextInfo.quotedMessage,
        key: {
            remoteJid: chatId,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant
        }
    } : msg;

    const isImage = !!(quoted.message?.imageMessage || (quoted.message?.documentMessage && quoted.message.documentMessage.mimetype?.includes('image')));

    if (isImage) {
        prompt = args.join(" ").trim();
        if (!prompt) {
            return await sock.sendMessage(chatId, { text: t('ai.provide_prompt', {}, userLang) }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

        try {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const buffer = await downloadMediaMessage(quoted, 'buffer', {}, { logger: undefined, reuploadRequest: sock.updateMediaMessage });
            if (!buffer) throw new Error("تعذر تحميل الصورة");

            await sendWithChannelButton(sock, chatId, t('ai.wait', {}, userLang), msg, {}, userLang);
            url = await uploadImage(buffer);
        } catch (e) {
            return await sock.sendMessage(chatId, { text: `❌ فشل رفع الصورة: ${e.message}` }, { quoted: msg });
        }
    } else {
        const helpMsg = userLang === 'ma'
            ? `🎨 *محرر الصور الذكي (Edit AI)* 🎨\n\n🔹 *الاستخدام:*\nجاوب على شي تصويرة وكتب:\n${settings.prefix}edit [شنو بغيتي تبدل]\n\n⚔️ ${settings.botName}`
            : userLang === 'ar'
                ? `🎨 *محرر الصور الذكي (Edit AI)* 🎨\n\n🔹 *الاستخدام:*\nقم بالرد على صورة واكتب:\n${settings.prefix}edit [التعديل المطلوب]\n\n⚔️ ${settings.botName}`
                : `🎨 *AI Image Editor (Edit AI)* 🎨\n\n🔹 *Usage:*\nReply to an image with:\n${settings.prefix}edit [prompt]\n\n⚔️ ${settings.botName}`; // Keep concise
        return await sendWithChannelButton(sock, chatId, helpMsg, msg, {}, userLang);
    }

    try {
        if (!isImage) await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

        // Translate prompt to English
        const translatedPrompt = await translateToEn(prompt);

        const resultBuffer = await img2img(url, translatedPrompt);

        const caption = userLang === 'ma'
            ? `✅ *تم تعديل الصورة بنجاح!*\n📝 *التعديل:* ${prompt}\n\n⚔️ ${settings.botName}`
            : userLang === 'ar'
                ? `✅ *تم تعديل الصورة بنجاح!*\n📝 *التعديل:* ${prompt}\n\n⚔️ ${settings.botName}`
                : `✅ *Image Edited Successfully!*\n📝 *Prompt:* ${prompt}\n\n⚔️ ${settings.botName}`;

        await sock.sendMessage(chatId, {
            image: resultBuffer,
            caption: caption
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('edit command error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        await sock.sendMessage(chatId, { text: t('ai.error', {}, userLang) }, { quoted: msg });
    }
}


module.exports = editCommand;
