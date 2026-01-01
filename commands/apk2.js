const { sendWithChannelButton } = require('../lib/channelButton');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);
const { t } = require('../lib/language');
const settings = require('../settings');

// APK storage per user
const apkSessions = {};

// Helper function to download with streaming (memory efficient)
async function downloadWithProgress(url, maxSize = 300 * 1024 * 1024) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const tempFilePath = path.join(tempDir, `apk_${Date.now()}.apk`);

    try {
        // First, get file size
        const headResponse = await axios.head(url, { timeout: 15000 }).catch(() => null);
        const fileSize = headResponse ? parseInt(headResponse.headers['content-length'] || 0) : 0;

        if (fileSize > maxSize) {
            throw new Error(`File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
        }

        // Download file using streaming to avoid memory issues
        const writer = fs.createWriteStream(tempFilePath);

        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 900000, // 15 minutes
        });

        // We don't read into buffer, we just pipe to file
        await pipeline(response.data, writer);

        return tempFilePath; // Return path instead of buffer

    } catch (error) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        throw error;
    }
}

const aptoide = {
    search: async function (query) {
        try {
            const res = await axios.get(`https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(query)}&limit=1000`);

            if (!res.data || !res.data.datalist || !res.data.datalist.list || res.data.datalist.list.length === 0) {
                return [];
            }

            return res.data.datalist.list.map((v) => {
                return {
                    name: v.name,
                    size: v.size,
                    version: v.file?.vername || 'N/A',
                    id: v.package,
                    download: v.stats?.downloads || 0,
                };
            });
        } catch (error) {
            console.error('Error searching APK:', error);
            return [];
        }
    },

    download: async function (id) {
        try {
            const res = await axios.get(`https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(id)}&limit=1`);

            if (!res.data || !res.data.datalist || !res.data.datalist.list || res.data.datalist.list.length === 0) {
                throw new Error('Application not found.');
            }

            const app = res.data.datalist.list[0];

            return {
                img: app.icon,
                developer: app.store?.name || 'Unknown',
                appname: app.name,
                link: app.file?.path,
            };
        } catch (error) {
            console.error('Error downloading APK:', error);
            throw error;
        }
    },
};

async function apk2Command(sock, chatId, msg, args, commands, userLang) { // Renamed from apkCommand
    const senderId = msg.key.participant || msg.key.remoteJid;
    const message = msg; // For compatibility

    const text = args.join(' ').trim();

    if (!text) {
        await sendWithChannelButton(sock, chatId, "Usage: .apk2 [query]", message);
        return;
    }

    // Check if user is selecting from previous search (Logic updated for apk2 context)
    if (text.split('').length <= 2 && !isNaN(text) && apkSessions[senderId]) {
        const session = apkSessions[senderId];

        if (session.downloading) {
            await sendWithChannelButton(sock, chatId, t('download.apk_downloading', {}, userLang), message);
            return;
        }

        const selectedIndex = parseInt(text) - 1;
        if (selectedIndex < 0 || selectedIndex >= session.data.length) {
            await sendWithChannelButton(sock, chatId, t('download.apk_select_invalid', {}, userLang), message);
            return;
        }

        try {
            session.downloading = true;
            const selectedApp = session.data[selectedIndex];

            // Parse size to check if it's large
            const sizeStr = String(selectedApp.size).toLowerCase();
            const isLarge = sizeStr.includes('mb') && parseFloat(sizeStr) > 50;

            await sendWithChannelButton(sock, chatId, isLarge
                ? t('download.apk_downloading_large', {}, userLang)
                : t('download.apk_downloading', {}, userLang)
                , message);

            const data = await aptoide.download(selectedApp.id);

            // Send app info with image
            const caption = t('download.apk_uploading', {}, userLang) + "\n\n" + t('common.wait', {}, userLang);

            await sock.sendMessage(chatId, {
                image: { url: data.img },
                caption: caption
            }, { quoted: message });

            // Download with progress tracking
            let tempPath;
            try {
                // Limit 300MB
                tempPath = await downloadWithProgress(data.link, 300 * 1024 * 1024);
            } catch (downloadError) {
                if (downloadError.message.includes('File too large')) {
                    throw new Error(t('download.apk_error_large', {}, userLang));
                }
                throw downloadError;
            }

            // Send file using the path with retry mechanism
            let uploadSuccess = false;
            let retryCount = 0;
            const maxRetries = 2;

            while (!uploadSuccess && retryCount <= maxRetries) {
                try {
                    // Send file using stream for memory efficiency
                    const fileStream = fs.createReadStream(tempPath);


                    await sock.sendMessage(chatId, {
                        document: { url: tempPath },
                        fileName: `${data.appname}.apk`,
                        mimetype: 'application/vnd.android.package-archive',
                        caption: t('download.apk_success_caption', {
                            name: data.appname,
                            size: selectedApp.size,
                            botName: settings.botName
                        }, userLang)
                    }, { quoted: message });
                    uploadSuccess = true;
                } catch (uploadError) {
                    retryCount++;
                    console.error(`[APK] Upload attempt ${retryCount} failed:`, uploadError.message);
                    if (retryCount <= maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3s before retry
                    } else {
                        throw uploadError; // Final failure
                    }
                }
            }

            // Clean up temp file after sending
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }

            session.downloading = false;

        } catch (error) {
            console.error('Error downloading APK:', error);

            // Ensure cleanup even on error
            if (tempPath && fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                } catch (cleanupErr) {
                    console.error('Failed to clean up temp file:', cleanupErr);
                }
            }

            let errorMsg = t('common.error', {}, userLang);
            if (error.message.includes('large') || error.message.includes('150MB')) {
                errorMsg = t('download.apk_error_large', {}, userLang);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMsg = t('download.apk_error_timeout', {}, userLang);
            }

            await sendWithChannelButton(sock, chatId, errorMsg, message);
            session.downloading = false;
        }

    } else {
        if (text.length < 2) {
            await sock.sendMessage(chatId, { text: '❌ ' + t('common.error', {}, userLang) }, { quoted: message });
            return;
        }

        await sendWithChannelButton(sock, chatId, t('download.apk_search_wait', {}, userLang), message);

        try {
            const searchResults = await aptoide.search(text);

            if (!searchResults || searchResults.length === 0) {
                await sock.sendMessage(chatId, {
                    text: t('download.apk_search_no_result', { query: text }, userLang)
                }, { quoted: message });
                return;
            }

            // Limit to 10 results
            const limitedResults = searchResults.slice(0, 10);

            let resultText = t('download.apk_search_result_header', { query: text }, userLang);

            limitedResults.forEach((app, index) => {
                const item = t('download.apk_search_result_item', {
                    index: index + 1,
                    name: app.name,
                    size: app.size,
                    version: app.version
                }, userLang);
                resultText += item;
                resultText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            });

            resultText += t('download.apk_search_footer', {}, userLang);
            resultText += `\n\n⚔️ ${settings.botName}`;

            await sendWithChannelButton(sock, chatId, resultText, message);

            // Store session
            apkSessions[senderId] = {
                downloading: false,
                data: limitedResults,
                timestamp: Date.now()
            };

            // Auto cleanup after 1 hour
            setTimeout(() => {
                if (apkSessions[senderId]) delete apkSessions[senderId];
            }, 3600000);

        } catch (error) {
            console.error('Error searching APK:', error);
            await sendWithChannelButton(sock, chatId, t('common.error', {}, userLang), message);
        }
    }
}

module.exports = apk2Command;
