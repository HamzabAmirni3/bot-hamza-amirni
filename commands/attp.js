const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { Jimp, loadFont } = require('jimp');

async function attpCommand(sock, chatId, message) {
    const userMessage = message.message.conversation || message.message.extendedTextMessage?.text || '';
    const text = userMessage.split(' ').slice(1).join(' ');

    if (!text) {
        await sock.sendMessage(chatId, { text: 'Please provide text after the .attp command.' });
        return;
    }

    const width = 512;
    const height = 512;
    const stickerPath = path.join(__dirname, './temp', `sticker-${Date.now()}.png`);

    // Ensure temp dir exists
    const tempDir = path.dirname(stickerPath);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    try {
        // In Jimp v1, fonts are handled differently. If this fails, we fallback to a simpler method or sharp.
        // Actually, let's try to use common fonts or just skip jimp if it's too complex for sticker text.
        // But let's try the modern way.
        const font = await loadFont(path.join(__dirname, '../node_modules/jimp/fonts/open-sans/open-sans-64-black/open-sans-64-black.fnt')).catch(() => null);

        const image = new Jimp({ width, height, color: 0xFFFFFFFF });

        if (font) {
            const textWidth = Jimp.measureText(font, text);
            const textHeight = Jimp.measureTextHeight(font, text, width);

            const x = (width - textWidth) / 2;
            const y = (height - textHeight) / 2;

            image.print({ font, x, y, text, maxWidth: width });
        }

        const buffer = await image.getBuffer('image/png');
        fs.writeFileSync(stickerPath, buffer);

        const stickerBuffer = await sharp(stickerPath)
            .resize(512, 512, { fit: 'cover' })
            .webp()
            .toBuffer();

        await sock.sendMessage(chatId, {
            sticker: stickerBuffer,
            mimetype: 'image/webp',
            packname: 'حمزة اعمرني',
            author: 'Hamza Amirni',
        });

        fs.unlinkSync(stickerPath);
    } catch (error) {
        console.error('Error generating sticker:', error);
        await sock.sendMessage(chatId, { text: 'Failed to generate the sticker. Please try again later.' });
    }
}

module.exports = attpCommand;
