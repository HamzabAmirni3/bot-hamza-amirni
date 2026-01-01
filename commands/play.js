const yts = require('yt-search');
const axios = require('axios');
const { t } = require('../lib/language');

module.exports = async (sock, chatId, msg, args, commands, userLang) => {
    try {
        // 1. Get Query
        const searchQuery = args.join(' ');
        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: t('play.no_query', {}, userLang)
            }, { quoted: msg });
        }

        // 2. Initial React & Search Message
        await sock.sendMessage(chatId, { react: { text: "🎧", key: msg.key } });

        // Search YouTube
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, {
                text: t('play.no_results', {}, userLang)
            }, { quoted: msg });
        }

        const video = videos[0];
        const videoUrl = video.url;

        // 3. Send "Downloading..." Message with Thumbnail (Aesthetic)
        // Using "wait" message from translation which includes the user's requested vibe
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🎵 *${video.title}*\n\n${t('play.wait', {}, userLang)}\n\n⏱️ _${video.timestamp}_ | 👀 _${video.views.toLocaleString()}_`
        }, { quoted: msg });

        // 4. Download Audio
        // Using robust multi-API system
        let audioUrl = null;
        let finalTitle = video.title;

        try {
            const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`;
            const response = await axios.get(apiUrl, { timeout: 45000 });
            if (response.data && response.data.status) {
                audioUrl = response.data.audio;
                finalTitle = response.data.title || finalTitle;
            }
        } catch (e) {
            console.log('[play.js] Primary API failed, trying Vreden fallback:', e.message);
        }

        // Fallback to Vreden
        if (!audioUrl) {
            try {
                const vredenUrl = `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`;
                const vResponse = await axios.get(vredenUrl, { timeout: 30000 });
                if (vResponse.data && vResponse.data.status) {
                    audioUrl = vResponse.data.result.download;
                    finalTitle = vResponse.data.result.title || finalTitle;
                }
            } catch (ve) {
                console.log('[play.js] Vreden fallback also failed:', ve.message);
            }
        }

        if (!audioUrl) {
            return await sock.sendMessage(chatId, {
                text: t('play.error_api', {}, userLang)
            }, { quoted: msg });
        }

        // 5. Send Audio with External Ad Reply (Premium Feel)
        await sock.sendMessage(chatId, { react: { text: "⬆️", key: msg.key } });

        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${finalTitle}.mp3`,
            contextInfo: {
                externalAdReply: {
                    title: finalTitle,
                    body: video.author?.name || "Queen Riam Music",
                    thumbnailUrl: video.thumbnail,
                    sourceUrl: videoUrl,
                    mediaType: 2, // 2 for Video (shows thumbnail well), 1 for Image
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Error in play command:', error);
        await sock.sendMessage(chatId, {
            text: t('play.error_generic', {}, userLang)
        }, { quoted: msg });
    }
};
