// plugin by noureddine ouafy
// scrape by https://share.petrolabs.me/tools/videoenhance

const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const axios = require("axios"); // Used to download media from the message
const FormData = require('form-data');
const { t } = require('../lib/language');
const settings = require('../settings');

// Get the current directory to store temporary files
const tempDir = path.join(__dirname, '../temp');

// Ensure the temp directory exists (Sync is fine here as it's once per load or we can check in handler)
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

async function jsonFetch(url, options = {}) {
    // Uses built-in fetch if available (Node 18+) or we can use axios/node-fetch if needed.
    // Assuming Node 18+ for specific fetch support
    const res = await fetch(url, options);
    const text = await res.text();
    let json;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        return { __httpError: true, status: res.status, raw: text };
    }
    if (!res.ok) {
        return { __httpError: true, status: res.status, raw: json };
    }
    return json;
}

const baseApi = "https://api.unblurimage.ai";

/**
 * @param {import('@adiwajshing/baileys').WASocket} sock
 * @param {string} chatId
 * @param {import('@adiwajshing/baileys').WAMessage} msg
 * @param {string[]} args
 */
let handler = async (sock, chatId, msg, args, commands, userLang) => {
    const productSerial = crypto.randomUUID().replace(/-/g, "");
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let videoPath = null;
    let tempFilePath = null;

    try {
        // --- 1. Get Video from Message ---

        // Check if the message contains a video or is a reply to a video
        let q = msg.quoted ? msg.quoted : msg;
        let mime = (q.msg || q).mimetype || '';
        if (!/video/.test(mime)) {
            return sock.sendMessage(chatId, { text: t('video_ai.usage', { prefix: settings.prefix }, userLang) }, { quoted: msg });
        }

        // Download the video and save it temporarily
        let media = await q.download?.();
        if (!media) {
            return sock.sendMessage(chatId, { text: t('common.error', {}, userLang) }, { quoted: msg });
        }

        // Determine the temporary path
        let sender = msg.key.participant || msg.key.remoteJid;
        tempFilePath = path.join(tempDir, `input-video-${sender.split('@')[0]}-${Date.now()}.mp4`);
        await fsPromises.writeFile(tempFilePath, media);
        videoPath = tempFilePath;

        const absPath = path.resolve(videoPath);

        await sock.sendMessage(chatId, { text: t('video_ai.wait', {}, userLang) }, { quoted: msg });

        // --- 2. Video Upload (Step 1: Request Upload URL) ---

        const uploadForm = new FormData();
        uploadForm.append("video_file_name", `cli-${Date.now()}.mp4`);

        const uploadResp = await axios.post(
            `${baseApi}/api/upscaler/v1/ai-video-enhancer/upload-video`,
            uploadForm,
            { headers: uploadForm.getHeaders() }
        ).catch(e => ({ data: { __httpError: true, status: e.response?.status, raw: e.message } }));

        if (uploadResp.data?.__httpError || uploadResp.data?.code !== 100000) {
            return sock.sendMessage(chatId, { text: `❌ Failed to request upload URL. Code: ${uploadResp.data?.code || uploadResp.status}` }, { quoted: msg });
        }

        const { url: uploadUrl, object_name } = uploadResp.data.result || {};
        if (!uploadUrl || !object_name) {
            return sock.sendMessage(chatId, { text: "❌ Failed to get upload URL or object name." }, { quoted: msg });
        }

        // --- 3. Video Upload (Step 2: PUT File to URL) ---

        const fileBuffer = await fsPromises.readFile(absPath);

        const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "content-type": "video/mp4" },
            body: fileBuffer,
        });

        if (!putRes.ok) {
            return sock.sendMessage(chatId, { text: `❌ Failed to upload file. Status: ${putRes.status}` }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: t('video_ai.uploading', {}, userLang) }, { quoted: msg });

        // --- 4. Create Enhancer Job ---

        const cdnUrl = `https://cdn.unblurimage.ai/${object_name}`;

        const jobForm = new FormData();
        jobForm.append("original_video_file", cdnUrl);
        jobForm.append("resolution", "2k"); // Can be changed if needed
        jobForm.append("is_preview", "false");

        const createJobResp = await axios.post(
            `${baseApi}/api/upscaler/v2/ai-video-enhancer/create-job`,
            jobForm,
            {
                headers: {
                    ...jobForm.getHeaders(),
                    "product-serial": productSerial,
                    authorization: "",
                }
            }
        ).catch(e => ({ data: { __httpError: true, status: e.response?.status } }));


        if (createJobResp.data?.__httpError || createJobResp.data?.code !== 100000) {
            return sock.sendMessage(chatId, { text: `❌ Failed to create job. Code: ${createJobResp.data?.code || createJobResp.status}` }, { quoted: msg });
        }

        const { job_id } = createJobResp.data.result || {};
        if (!job_id) {
            return sock.sendMessage(chatId, { text: "❌ Job ID not found." }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: t('video_ai.job_created', { job_id }, userLang) }, { quoted: msg });

        // --- 5. Poll Job Status ---

        const maxTotalWaitMs = 5 * 60 * 1000;
        const startTime = Date.now();
        let attempt = 0;
        let result;

        while (true) {
            attempt++;

            const jobResp = await axios.get(
                `${baseApi}/api/upscaler/v2/ai-video-enhancer/get-job/${job_id}`,
                {
                    headers: {
                        "product-serial": productSerial,
                        authorization: "",
                    }
                }
            ).catch(e => ({ data: { __httpError: true } })); // Simplify error handling

            if (jobResp.data?.__httpError) {
                // ignore and retry
            } else if (jobResp.data?.code === 100000) {
                result = jobResp.data.result || {};
                if (result.output_url) break; // Job finished
            } else if (jobResp.data?.code !== 300010) {
                return sock.sendMessage(chatId, { text: `❌ Job failed or unknown status. Code: ${jobResp.data?.code}` }, { quoted: msg });
            }

            const elapsed = Date.now() - startTime;
            if (elapsed > maxTotalWaitMs) {
                return sock.sendMessage(chatId, { text: `⏰ Timeout reached after ${Math.round(elapsed / 1000)} seconds.` }, { quoted: msg });
            }

            await sleep(attempt === 1 ? 30 * 1000 : 10 * 1000);
        }

        // --- 6. Send Result ---

        const { output_url } = result;

        if (output_url) {
            await sock.sendMessage(chatId, { text: t('video_ai.success', {}, userLang) }, { quoted: msg });

            const { data } = await axios.get(output_url, { responseType: 'arraybuffer' });

            await sock.sendMessage(chatId, {
                video: Buffer.from(data),
                caption: t('video_ai.caption', { botName: settings.botName, url: output_url }, userLang),
                fileName: `upscaled-${job_id}.mp4`
            }, { quoted: msg });

        } else {
            sock.sendMessage(chatId, { text: "❌ Job finished, but the output URL was not found." }, { quoted: msg });
        }

    } catch (err) {
        console.error("Error running hdvideo handler:", err);
        sock.sendMessage(chatId, { text: t('video_ai.error', {}, userLang) + `\n⚠️ ${err.message}` }, { quoted: msg });
    } finally {
        // --- 7. Cleanup ---
        if (tempFilePath) {
            try {
                if (fs.existsSync(tempFilePath)) await fsPromises.unlink(tempFilePath);
            } catch (e) {
                console.error(`Failed to delete temporary file ${tempFilePath}:`, e);
            }
        }
    }
}

handler.help = ['hdvideo'];
handler.command = ['hdvideo'];
handler.tags = ['tools'];
handler.limit = true;

module.exports = handler;
