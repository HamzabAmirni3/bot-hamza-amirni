const axios = require("axios");
const FormData = require("form-data");
const { t } = require('../lib/language');
const settings = require('../settings');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

class RemoveBg {
  constructor() {
    this.API_URL = "https://backrem.pi7.org/remove_bg"
    this.HEADERS = {
      Connection: "keep-alive",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
      Accept: "*/*",
      Origin: "https://image.pi7.org",
      Referer: "https://image.pi7.org/"
    }
  }

  _randName() {
    return `id_${Date.now()}${(Math.random() + 1).toString(36).substring(7)}`
  }

  async run({ buffer, contentType }) {
    try {
      const fileSizeMB = buffer.length / (1024 * 1024)
      if (fileSizeMB > 5) throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds 5MB limit.`)

      const extension = contentType.split("/")[1] || "jpg"
      const form = new FormData()
      const fileName = `${this._randName()}.${extension}`

      form.append("myFile[]", buffer, {
        filename: fileName,
        contentType: contentType
      })

      const result = await axios.post(this.API_URL, form, {
        headers: {
          ...form.getHeaders(),
          ...this.HEADERS
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      })

      if (result.data?.images?.length > 0) {
        return `https://backrem.pi7.org/${result.data.images[0].filename}`
      } else {
        throw new Error("Invalid API response.")
      }
    } catch (error) {
      throw error
    }
  }
}

async function removebgCommand(sock, chatId, msg, args, commands, userLang) {
  let quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ? {
    message: msg.message.extendedTextMessage.contextInfo.quotedMessage,
    key: {
      remoteJid: chatId,
      id: msg.message.extendedTextMessage.contextInfo.stanzaId,
      participant: msg.message.extendedTextMessage.contextInfo.participant
    }
  } : msg;

  const isImage = !!(quoted.message?.imageMessage || (quoted.message?.documentMessage && quoted.message.documentMessage.mimetype?.includes('image')));

  if (!isImage) {
    return await sock.sendMessage(chatId, { text: t('removebg.help', { prefix: settings.prefix }, userLang) }, { quoted: msg });
  }

  try {
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

    let buffer = await downloadMediaMessage(quoted, 'buffer', {}, {
      logger: undefined,
      reuploadRequest: sock.updateMediaMessage
    });

    const mime = (quoted.message?.imageMessage || quoted.message?.documentMessage)?.mimetype || "image/jpeg";

    const remover = new RemoveBg()
    let result = await remover.run({ buffer, contentType: mime })

    await sock.sendMessage(chatId, {
      image: { url: result },
      caption: t('removebg.success', {}, userLang)
    }, { quoted: msg });

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

  } catch (e) {
    console.error('RemoveBG Error:', e);
    await sock.sendMessage(chatId, { text: t('removebg.error', {}, userLang) + `\n⚠️ ${e.message}` }, { quoted: msg });
  }
}

module.exports = removebgCommand;
