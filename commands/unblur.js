const axios = require('axios');
const https = require('https');
const FormData = require('form-data');
const { t } = require('../lib/language');
const settings = require('../settings');

class UnblurAI {
  constructor() {
    this.apiBase = "https://api.unblurimage.ai/api"
    this.endpoints = {
      UNBLUR: "/imgupscaler/v2/ai-image-unblur/create-job",
      UPSCALE: "/imgupscaler/v2/ai-image-upscale/create-job",
      MILD: "/imgupscaler/v2/ai-image-mild-unblur/create-job",
      STATUS: "/imgupscaler/v2/ai-image-unblur/get-job"
    }
    this.headers = {
      "product-code": "067003",
      "product-serial": `device-${Date.now()}-${Math.random().toString(36).slice(7)}`,
      accept: "*/*",
      "user-agent": "Postify/1.0.0"
    }
  }

  async fetchImageBuffer(imageURL) {
    const { data } = await axios.get(imageURL, {
      responseType: "arraybuffer",
      headers: { accept: "image/*", "user-agent": "Postify/1.0.0" },
      httpsAgent: new https.Agent({ rejectUnauthorized: false, keepAlive: true }),
      timeout: 15000
    })
    return Buffer.from(data);
  }

  async processImage({ url, buffer, mode = "UNBLUR", scaleFactor = "2" }) {
    let imageBuffer = buffer;
    if (!imageBuffer && url) {
      imageBuffer = await this.fetchImageBuffer(url);
    }
    if (!imageBuffer) throw new Error("No image data provided");

    const formData = new FormData()
    formData.append("original_image_file", imageBuffer, { filename: "image.png", contentType: "image/png" })

    if (mode === "UPSCALE") {
      formData.append("scale_factor", scaleFactor)
      formData.append("upscale_type", "image-upscale")
    }

    const reqUrl = `${this.apiBase}${this.endpoints[mode]}`

    const response = await axios.post(reqUrl, formData, {
      headers: { ...this.headers, ...formData.getHeaders() },
      httpsAgent: new https.Agent({ rejectUnauthorized: false, keepAlive: true }),
      timeout: 20000
    })

    const jobId = response?.data?.result?.job_id
    return jobId ? await this.checkJobStatus(jobId) : { status: false }
  }

  async checkJobStatus(jobId) {
    const url = `${this.apiBase}${this.endpoints.STATUS}/${jobId}`
    const start = Date.now()
    while (Date.now() - start < 60000) {
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 5000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false, keepAlive: true })
      })
      const data = response.data
      if (data?.code === 100000 && data.result?.output_url?.[0]) {
        return { status: true, url: data.result.output_url[0] }
      }
      if (data?.code !== 300006) break
      await new Promise(r => setTimeout(r, 3000))
    }
    return { status: false }
  }
}

async function unblurCommand(sock, chatId, msg, args, commands, userLang) {
  let imageBuffer;

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
    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
    imageBuffer = await downloadMediaMessage(quoted, 'buffer', {}, { logger: undefined, reuploadRequest: sock.updateMediaMessage });
  } else if (args && args[0] && args[0].startsWith('http')) {
    // Handled by URL
  } else {
    return await sock.sendMessage(chatId, { text: t('unblur.help', {}, userLang) }, { quoted: msg });
  }

  await sock.sendMessage(chatId, { text: t('unblur.wait', {}, userLang) }, { quoted: msg });

  const unblurAI = new UnblurAI()
  try {
    const result = await unblurAI.processImage({ url: args[0], buffer: imageBuffer, mode: "UNBLUR" })
    if (!result.status) throw new Error('Processing failed');

    await sock.sendMessage(chatId, {
      image: { url: result.url },
      caption: t('unblur.success', {}, userLang)
    }, { quoted: msg });

  } catch (e) {
    console.error(e)
    await sock.sendMessage(chatId, { text: t('unblur.error', {}, userLang) }, { quoted: msg });
  }
}

module.exports = unblurCommand;
