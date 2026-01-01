const axios = require("axios");
const yts = require("yt-search");

async function ytplayCommand(sock, chatId, msg, args) {
    const query = args.join(' ');
    if (!query) {
        return await sock.sendMessage(chatId, {
            text: "⚠️ يرجى إدخال رابط يوتيوب أو اسم الأغنية.\n\nمثال:\n```.ytplay another love```"
        }, { quoted: msg });
    }

    try {
        let videoUrl = query;

        // Step 1: React while searching and send status
        await sock.sendMessage(chatId, { text: '⏳ *جاري البحث والتحميل، يرجى الانتظار...*' }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

        if (!query.includes("youtube.com") && !query.includes("youtu.be")) {
            const search = await yts(query);
            if (!search.videos || search.videos.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ لم يتم العثور على نتائج لـ: ${query}` }, { quoted: msg });
            }
            videoUrl = search.videos[0].url;
        }

        // Step 2: React while fetching link
        await sock.sendMessage(chatId, { react: { text: "📥", key: msg.key } });

        // Multi-API Download System
        let audioUrl = null;
        let finalTitle = "yt-audio";

        try {
            const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`;
            const response = await axios.get(apiUrl, { timeout: 45000 });
            if (response.data && response.data.status) {
                audioUrl = response.data.audio;
                finalTitle = response.data.title || finalTitle;
            }
        } catch (e) {
            console.log('[ytplay.js] Primary API failed, trying Vreden fallback:', e.message);
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
                console.log('[ytplay.js] Vreden fallback also failed:', ve.message);
            }
        }

        if (!audioUrl) {
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return await sock.sendMessage(chatId, { text: "❌ فشل جلب الصوت. حاول مرة أخرى." }, { quoted: msg });
        }

        // Step 3: React while sending audio
        await sock.sendMessage(chatId, { react: { text: "🎶", key: msg.key } });

        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            ptt: false,
            fileName: `${finalTitle}.mp3`
        }, { quoted: msg });

        // Final ✅ reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error("YTPlay Error:", error.message);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        await sock.sendMessage(chatId, { text: "❌ حدث خطأ أثناء معالجة طلبك." }, { quoted: msg });
    }
}

module.exports = ytplayCommand;
