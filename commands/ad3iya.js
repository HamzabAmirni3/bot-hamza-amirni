const { sendWithChannelButton } = require('../lib/channelButton');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

// Duas data file
const duasDataPath = path.join(__dirname, '../data/duas-subscribers.json');

// Ensure data file exists (with EACCES handling)
function ensureDataFile() {
    try {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(duasDataPath)) {
            fs.writeFileSync(duasDataPath, JSON.stringify({ subscribers: [], enabled: false }));
        }
        // Force permissions if possible
        try { fs.chmodSync(duasDataPath, 0o666); } catch (e) { }
    } catch (e) {
        console.error('[Ad3iya] Error ensuring data file:', e.message);
    }
}

function loadData() {
    try {
        ensureDataFile();
        if (fs.existsSync(duasDataPath)) {
            const data = JSON.parse(fs.readFileSync(duasDataPath, 'utf8'));
            if (data.enabled === undefined) data.enabled = true;
            return data;
        }
    } catch (e) {
        console.error('[Ad3iya] Error loading data:', e.message);
    }
    return global.duasFallbackData || { subscribers: [], enabled: true };
}

function saveData(data) {
    global.duasFallbackData = data;
    try {
        ensureDataFile();
        fs.writeFileSync(duasDataPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[Ad3iya] Error saving data:', e.message);
    }
}

function autoSubscribe(chatId) {
    if (chatId.endsWith('@g.us')) return;
    const data = loadData();
    if (!data.subscribers.includes(chatId)) {
        data.subscribers.push(chatId);
        data.enabled = true;
        saveData(data);
    }
}

const islamicDuas = [
    // Regular Day Duas (Exclude Friday/Sleep by default)
    { title: "دعاء الصباح", dua: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ. اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذَا الْيَوْمِ فَتْحَهُ، وَنَصْرَهُ، وَنُورَهُ، وَبَرَكَتَهُ، وَهُدَاهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهِ وَشَرِّ مَا بَعْدَهُ.", category: "صباح" },
    { title: "دعاء المساء", dua: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ. أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوه عَلَى كُلِّ شَيْءٍ قَدِيرٌ.", category: "مساء" },
    { title: "دعاء الرزق", dua: "اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ. اللَّهُمَّ إِنِّي أَسْأَلُكَ رِزْقًا وَاسِعًا طَيِّبًا مِنْ رِزْقِكَ، وَيَسِّرْ لِي طَلَبَهُ، وَاجْعَلْهُ لِي مَصْدَرَ خَيْرٍ وَبَرَكَةٍ.", category: "رزق" },
    { title: "سيد الاستغفار", dua: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.", category: "استغفار" },
    { title: "دعاء الشفاء", dua: "اللَّهُمَّ رَبَّ النَّاسِ أَذْهِبِ الْبَاسَ، اشْفِهِ وَأَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا.", category: "شفاء" },
    { title: "دعاء جامع", dua: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ.", category: "جامع" },
    { title: "دعاء الهداية", dua: "اللهم إني أسألك الهدى والتقى والعفاف والغنى، اللهم آتِ نفسي تقواها وزكها أنت خير من زكاها أنت وليها ومولاها.", category: "هداية" },
    { title: "دعاء تيسير الأمور", dua: "اللهم لا سهل إلا ما جعلته سهلاً، وأنت تجعل الحزن إذا شئت سهلاً، اللهم يسّر لي أمري واشرح لي صدري.", category: "تيسير" },

    // Friday Only Duas
    { title: "دعاء يوم الجمعة", dua: "اللَّهُمَّ فِي يَوْمِ الْجُمُعَةِ، اجْعَلْنَا مِمَّنْ عَفَوْتَ عَنْهُمْ، وَرَضِيتَ عَنْهُمْ، وَغَفَرْتَ لَهُمْ، وَحَرَّمْتَهُمْ عَلَى النَّارِ، وَكَتَبْتَ لَهُمُ الْجَنَّةَ.", category: "جمعة" },
    { title: "ساعة الاستجابة يوم الجمعة", dua: "اللَّهُمَّ مَا قَسَمْتَ فِي هَذَا الْيَوْمِ مِنْ خَيْرٍ وَصِحَّةٍ وَسَعَةِ رِزْقٍ فَاجْعَلْ لَنَا مِنْهُ نَصِيبًا، وَما أَنْزَلْتَ فِيهِ مِنْ شَرٍّ وَبَلَاءٍ وَفِتْنَةٍ فَاصْرِفْهُ عَنَّا وَعَنْ جَمِيعِ الْمُسْلِمِينَ.", category: "جمعة" },
    { title: "نور الجمعة", dua: "اللَّهُمَّ نَوِّرْ قُلُوبَنَا بِالْإِيمَانِ، وَزَيِّنْ أَيَّامَنَا بِالسَّعَادَةِ، وَاجْعَلْ يَوْمَ الْجُمُعَةِ نُورًا لَنَا وَمَغْفِرَةً.", category: "جمعة" },
    { title: "استجابة الجمعة", dua: "يا رب في يوم الجمعة وعدت عبادك بقبول دعواتهم، اللهم ارحم موتانا، واشف مرضانا، واستجب لدعائنا، واغفر لنا ذنوبنا.", category: "جمعة" },

    // Bedtime Duas (Specifically for 22:00)
    { title: "دعاء النوم", dua: "بِاسمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.", category: "نوم" },
    { title: "أذكار النوم", dua: "اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ. (ثلاث مرات)", category: "نوم" },
    { title: "قبل النوم", dua: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.", category: "نوم" },
    { title: "دعاء السكينة", dua: "اللهم رب السماوات ورب الأرض ورب العرش العظيم، ربنا ورب كل شيء، فالق الحب والنوى، ومنزل التوراة والإنجيل والفرقان، أعوذ بك من شر كل شيء أنت آخذ بناصيته.", category: "نوم" }
];

function getRandomDua(category = null) {
    let filteredDuas = islamicDuas;
    if (category) {
        filteredDuas = islamicDuas.filter(d => d.category === category);
        if (filteredDuas.length === 0) filteredDuas = islamicDuas;
    } else {
        // By default, exclude Friday and Bedtime prayers for non-specific requests
        filteredDuas = islamicDuas.filter(d => d.category !== 'جمعة' && d.category !== 'نوم');
    }
    return filteredDuas[Math.floor(Math.random() * filteredDuas.length)];
}

function getCategories() {
    return [...new Set(islamicDuas.map(d => d.category))];
}

const { t } = require('../lib/language');

async function ad3iyaCommand(sock, chatId, msg, argsInput, commands, userLang) {
    const args = (Array.isArray(argsInput) ? argsInput.join(' ') : (argsInput || '')).trim().toLowerCase();

    if (args === 'on' || args === 'subscribe') {
        const data = loadData();
        if (!data.subscribers.includes(chatId)) {
            data.subscribers.push(chatId);
            data.enabled = true;
            saveData(data);
            await sendWithChannelButton(sock, chatId, t('ad3iya.subscribe_success', {}, userLang), msg);
        } else {
            await sendWithChannelButton(sock, chatId, t('ad3iya.already_subscribed', {}, userLang), msg);
        }
        return;
    }

    if (args === 'off' || args === 'unsubscribe') {
        const data = loadData();
        data.subscribers = data.subscribers.filter(id => id !== chatId);
        saveData(data);
        await sendWithChannelButton(sock, chatId, t('ad3iya.unsubscribe_success', {}, userLang), msg);
        return;
    }

    if (args === 'list') {
        const categories = getCategories();
        // Keep categories localized in ad3iya.js itself for now or map them?
        // Since categories are in data, we just list them.
        let resp = `${t('ad3iya.categories_title', {}, userLang)}\n${categories.join(', ')}`;
        await sendWithChannelButton(sock, chatId, resp, msg);
        return;
    }

    const dua = getRandomDua(args || null);
    const response = `🤲 *${dua.title}*\n\n📿 ${dua.dua}\n\n📂 *${t('ad3iya.category_label', {}, userLang)}:* ${dua.category}`;
    await sendWithChannelButton(sock, chatId, response, msg);
}

function startScheduler(sock) {
    if (global.duasInterval) clearInterval(global.duasInterval);
    global.duasInterval = setInterval(async () => {
        const currentSock = global.sock || sock;
        if (!currentSock) return;
        const data = loadData();
        if (!data.enabled || data.subscribers.length === 0) return;
        const now = moment().tz('Africa/Casablanca');
        const hours = [7, 9, 11, 12, 17, 19, 22];
        const isFriday = now.day() === 5;

        if (now.minutes() === 0 && hours.includes(now.hours())) {
            // Special: Friday Morning Surah Al-Kahf
            if (isFriday && now.hours() === 9) {
                const kahfMessage = `╭━━━〘 📖 *نور الجمعة* 📖 〙━━━╮\n` +
                    `┃ ✨ *تذكير بسورة الكهف*\n` +
                    `┃ 🕯️ *قال ﷺ:* «من قرأ سورة الكهف في يوم \n` +
                    `┃ الجمعة أضاء له من النور ما بين الجمعتين»\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                    `💎 *لا تنسوا سنن الجمعة:*\n` +
                    `   ◦ الغسل والطيب 🚿\n` +
                    `   ◦ سورة الكهف 📖\n` +
                    `   ◦ كثرة الصلاة على النبي ﷺ 📿\n\n` +
                    `🎧 *استمع لسورة الكهف بصوت مشاري العفاسي:*`;

                for (const id of data.subscribers) {
                    try {
                        await sendWithChannelButton(currentSock, id, kahfMessage);
                        await currentSock.sendMessage(id, {
                            audio: { url: 'https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/18.mp3' },
                            mimetype: 'audio/mpeg',
                            ptt: false
                        });
                    } catch (e) { }
                }
                return;
            }

            // Special: Friday Prayer Reminder (Early Attendance)
            if (isFriday && now.hours() === 11) {
                const jumaaReminder = `╭━━━〘 🕌 *نداء الجمعة* 🕌 〙━━━╮\n` +
                    `┃ ✨ *الاستعداد لصلاة الجمعة*\n` +
                    `┃ 🕰️ *موعد صعود المنبر يقترب*\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                    `💡 *آداب صلاة الجمعة (تبكيرك فخرك):*\n` +
                    ` 1️⃣ الاغتسال والتطيب ولبس أحسن الثياب.\n` +
                    ` 2️⃣ *التبكير:* (التبكير يضاعف الأجر كمن قرّب بدنة).\\n` +
                    ` 3️⃣ *الإنصات للخطبة:* (من قال لصاحبه أنصت فقد لغا).\n\n` +
                    `⚠️ *تنبيه هام:* \n` +
                    `الملائكة تغلق الصحف عند صعود الإمام للمنبر، فلا تُحرِم نفسك من أجر التبكير.\n\n` +
                    `⚔️ ${settings.botName}`;

                for (const id of data.subscribers) {
                    try { await sendWithChannelButton(currentSock, id, jumaaReminder); } catch (e) { }
                }
                return;
            }

            let dua;
            let title;

            if (now.hours() === 22) {
                dua = getRandomDua('نوم');
                title = 'دعاء النوم';
            } else if (isFriday) {
                dua = getRandomDua('جمعة');
                title = 'دعاء يوم الجمعة';
            } else {
                dua = getRandomDua(); // Excludes 'جمعة' and 'نوم' automatically
                title = 'دعاء اليوم';
            }

            const message = `🤲 *${title}*\n\n📿 ${dua.dua}`;
            for (const id of data.subscribers) {
                try { await sendWithChannelButton(currentSock, id, message); } catch (e) { }
            }
        }
    }, 60000);
}

module.exports = ad3iyaCommand;
module.exports.startScheduler = startScheduler;
module.exports.autoSubscribe = autoSubscribe;
module.exports.getRandomDua = getRandomDua;
