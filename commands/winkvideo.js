// @noureddine_ouafy
// Plugin: Video Resolution Enhancer (HD Upgrader)

const axios = require("axios")
const FormData = require("form-data")
const fs = require("fs")
const path = require("path")
const { writeFileSync } = require('fs')
const { t } = require('../lib/language');
const settings = require('../settings');

const resolutions = {
    "480": "480",
    "720": "720",
    "1080": "1080",
    "2k": "1440",
    "4k": "2160",
    "8k": "4320"
}

let handler = async (sock, chatId, msg, args, commands, userLang) => {
    sock.videohd = sock.videohd || {}
    const sender = msg.key.participant || msg.key.remoteJid;

    if (sender in sock.videohd) {
        return sock.sendMessage(chatId, { text: t('video_ai.wait_processing', {}, userLang) }, { quoted: msg });
    }

    const text = args.join(" ");
    if (!text) {
        return sock.sendMessage(chatId, { text: t('video_ai.usage_wink', {}, userLang) }, { quoted: msg });
    }

    let [res, fpsText] = text?.trim().toLowerCase().split(" ")
    let fps = 60

    if (fpsText && fpsText.endsWith("fps")) {
        fps = parseInt(fpsText.replace("fps", ""))
        if (isNaN(fps) || fps < 30 || fps > 240) {
            return sock.sendMessage(chatId, { text: t('video_ai.error_fps', {}, userLang) }, { quoted: msg });
        }
    }

    const q = msg.quoted ? msg.quoted : msg
    const mime = (q.msg || q).mimetype || q.mediaType || ''

    if (!/^video/.test(mime)) return sock.sendMessage(chatId, { text: t('video_ai.usage', {}, userLang) }, { quoted: msg });

    if (!resolutions[res]) {
        return sock.sendMessage(chatId, { text: t('video_ai.usage_wink', {}, userLang) }, { quoted: msg });
    }

    try {
        await sock.sendMessage(chatId, { text: t('video_ai.converting', { res: res.toUpperCase(), fps }, userLang) }, { quoted: msg });
        const targetHeight = resolutions[res]
        const id = sender.split("@")[0]

        // Ensure tmp exists
        if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });

        // ✅ Load video buffer and save manually
        const buffer = await q.download()

        // Dynamic import for file-type
        const { fileTypeFromBuffer } = await import('file-type');

        const type = await fileTypeFromBuffer(buffer)
        const inputExt = type?.ext || "mp4"
        const inputFilePath = `./tmp/input_${id}.${inputExt}`
        const outputPath = `./tmp/hdvideo_${id}.mp4`

        writeFileSync(inputFilePath, buffer)

        sock.videohd[sender] = true

        const form = new FormData()
        form.append("video", fs.createReadStream(inputFilePath))
        form.append("resolution", targetHeight)
        form.append("fps", fps)

        const response = await axios.post("http://193.149.164.168:4167/hdvideo", form, {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            responseType: "stream"
        })

        const writer = fs.createWriteStream(outputPath)
        response.data.pipe(writer)

        writer.on("finish", async () => {
            const finalBuffer = fs.readFileSync(outputPath)
            await sock.sendMessage(chatId, {
                video: finalBuffer,
                mimetype: 'video/mp4',
                fileName: path.basename(outputPath),
                caption: t('video_ai.caption', { res: res.toUpperCase(), botName: settings.botName }, userLang)
            }, { quoted: msg })

            delete sock.videohd[sender]
            try { fs.unlinkSync(inputFilePath) } catch (e) { }
            try { fs.unlinkSync(outputPath) } catch (e) { }
        })

    } catch (e) {
        if (sock.videohd && sender in sock.videohd) delete sock.videohd[sender]
        return sock.sendMessage(chatId, { text: t('video_ai.error', {}, userLang) + `: ` + e.message }, { quoted: msg });
    }
}

handler.help = ["winkvideo"]
handler.command = ["winkvideo"]
handler.tags = ["tools"]
handler.premium = false

module.exports = handler;
