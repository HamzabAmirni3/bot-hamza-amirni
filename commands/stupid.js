const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

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

        // Safer path relative to this file
        const templatePath = path.resolve(__dirname, '../assets/stupid_ma.png');

        if (!fs.existsSync(templatePath)) {
            console.error('Template not found at:', templatePath);
            return await sock.sendMessage(chatId, { text: '❌ القالب غير موجود (stupid_ma.png)' }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

        const template = await Jimp.read(templatePath);
        const avatar = await Jimp.read(avatarUrl);

        template.resize(1024, 1024);
        avatar.resize(240, 240);

        const radius = 120;
        avatar.scan(0, 0, avatar.bitmap.width, avatar.bitmap.height, function (x, y, idx) {
            const distance = Math.sqrt(Math.pow(x - radius, 2) + Math.pow(y - radius, 2));
            if (distance > radius) {
                this.bitmap.data[idx + 3] = 0;
            }
        });

        // Adjusted x,y for the Moroccan "انا مكلخ" template
        template.composite(avatar, 655, 215);

        const imageBuffer = await template.getBufferAsync(Jimp.MIME_PNG);

        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: `*@${who.split('@')[0]}* مكلخ 😂`,
            mentions: [who]
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Error in stupid command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ وقع شي غلط فالتصويرة. جرب مرة أخرى.'
        }, { quoted: msg });
    }
}

module.exports = stupidCommand;
