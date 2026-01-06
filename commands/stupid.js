const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

async function stupidCommand(sock, chatId, msg, args) {
    try {
        const sender = msg.key.participant || msg.key.remoteJid;
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.participant;

        let who = quotedMsg
            ? quotedMsg
            : mentionedJid && mentionedJid[0]
                ? mentionedJid[0]
                : sender;

        let avatarUrl;
        try {
            avatarUrl = await sock.profilePictureUrl(who, 'image');
        } catch (error) {
            avatarUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
        }

        const templatePath = path.resolve(__dirname, '../assets/stupid_ma.png');

        if (!fs.existsSync(templatePath)) {
            return await sock.sendMessage(chatId, { text: '❌ القالب (stupid_ma.png) غير موجود في مجلد assets!' }, { quoted: msg });
        }

        const waitMsg = await sock.sendMessage(chatId, { text: '🔄 جاري تصنيع الميم... يرجى الانتظار.' }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

        // Load images
        let template, avatar;
        try {
            template = await Jimp.read(templatePath);

            const avatarRes = await axios.get(avatarUrl, { responseType: 'arraybuffer' }).catch(() => null);
            if (avatarRes) {
                avatar = await Jimp.read(Buffer.from(avatarRes.data));
            } else {
                avatar = await Jimp.read('https://telegra.ph/file/24fa902ead26340f3df2c.png');
            }
        } catch (e) {
            console.error('Jimp Read Error:', e);
            throw new Error('Failed to read images: ' + e.message);
        }

        template.resize({ width: 1024, height: 1024 });
        avatar.resize({ width: 230, height: 230 });

        // Circular mask logic
        const radius = 115;
        avatar.scan(0, 0, avatar.bitmap.width, avatar.bitmap.height, function (x, y, idx) {
            const distance = Math.sqrt(Math.pow(x - radius, 2) + Math.pow(y - radius, 2));
            if (distance > radius) {
                this.bitmap.data[idx + 3] = 0;
            }
        });

        // Place on dog head (Top-Right Panel)
        template.composite(avatar, 665, 225);

        // Get buffer - Jimp v1 uses getBuffer(mime) returning a promise
        const imageBuffer = await template.getBuffer('image/png');

        try {
            await sock.sendMessage(chatId, { delete: waitMsg.key });
        } catch (e) { }

        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: `*@${who.split('@')[0]}* مكلخ 😂`,
            mentions: [who],
            contextInfo: {
                externalAdReply: {
                    title: "STUPID MEME MAKER",
                    body: "𝐇𝐀𝐌𝐙𝐀 𝐀𝐌𝐈𝐑𝐍𝐈",
                    thumbnail: imageBuffer,
                    sourceUrl: "https://whatsapp.com/channel/0029ValXRoHCnA7yKopcrn1p",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Error in stupid command:', error);
        await sock.sendMessage(chatId, {
            text: `❌ وقع خطأ: ${error.message}`
        }, { quoted: msg });
    }
}

module.exports = stupidCommand;
