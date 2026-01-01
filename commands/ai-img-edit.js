const axios = require("axios");
const settings = require('../settings');
const { uploadImage } = require('../lib/uploadImage');
const { t } = require('../lib/language');

/**
 * AI Image Modifier (img2img / reimage)
 * Uses Vreden or Ryzendesu API
 */
async function img2img(url, prompt) {
    try {
        // Higher quality reimage API that usually respects the base image better
        const apiUrl = `https://api.vreden.my.id/api/reimage?url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`;

        const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 60000 });

        // Check if response is valid image
        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
            const json = JSON.parse(response.data.toString());
            if (json.error) throw new Error(json.error);
        }

        return response.data;
    } catch (error) {
        console.error("Vreden Reimage Error, trying Ryzendesu:", error.message);
        try {
            const apiUrl = `https://api.ryzendesu.vip/api/ai/img2img?url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`;
            const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 60000 });
            return response.data;
        } catch (err2) {
            throw new Error("All image editing APIs failed.");
        }
    }
}

async function aiImgEditCommand(sock, chatId, msg, args, commands, userLang) {
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
            if (!buffer) throw new Error("Could not download image");

            await sock.sendMessage(chatId, { text: t('ai_img_edit.wait', {}, userLang) }, { quoted: msg });
            url = await uploadImage(buffer);
        } catch (e) {
            return await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: msg });
        }
    } else {
        // Handling via URL | Prompt or URL Prompt
        const fullText = args.join(" ");
        if (fullText.includes("|")) {
            [url, prompt] = fullText.split("|").map(str => str.trim());
        } else if (args.length >= 2) {
            url = args[0];
            prompt = args.slice(1).join(" ");
        }
    }

    if (!url || !prompt) {
        return await sock.sendMessage(chatId, { text: t('ai_img_edit.help', { prefix: settings.prefix, botName: settings.botName }, userLang) }, { quoted: msg });
    }

    // Validate URL if not already done via upload
    if (!url.startsWith("http")) {
        return await sock.sendMessage(chatId, { text: t('ai_img_edit.error_link', {}, userLang) }, { quoted: msg });
    }

    try {
        if (!isImage) await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

        // Translate prompt to English
        let translatedPrompt = prompt;
        try {
            const trRes = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(prompt)}`);
            if (trRes.data?.[0]?.[0]?.[0]) translatedPrompt = trRes.data[0][0][0];
        } catch (e) { }

        const resultBuffer = await img2img(url, translatedPrompt);

        await sock.sendMessage(chatId, {
            image: resultBuffer,
            caption: t('ai_img_edit.success', { prompt, botName: settings.botName }, userLang)
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('ai-img-edit error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        await sock.sendMessage(chatId, { text: t('ai.error', {}, userLang) }, { quoted: msg });
    }
}

module.exports = aiImgEditCommand;
