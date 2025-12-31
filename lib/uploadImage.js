const fetch = require('node-fetch');
const FormData = require('form-data');
const FileType = require('file-type');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Upload file to Tioxy (High Speed)
 * @param {Buffer} buffer 
 * @returns {Promise<string|null>}
 */
async function uploadToTioxy(buffer) {
    try {
        const fileType = await FileType.fromBuffer(buffer);
        const { ext, mime } = fileType || { ext: 'png', mime: 'image/png' };
        const form = new FormData();
        form.append('file', buffer, {
            filename: 'upload.' + ext,
            contentType: mime
        });

        const res = await fetch('https://cdn.tioxy.my.id/api/upload', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        const img = await res.json();
        return img.status && img.result?.url ? img.result.url : (img.url || null);
    } catch (e) {
        return null;
    }
}

/**
 * Upload file to Catbox (Reliable)
 * @param {Buffer} buffer 
 * @returns {Promise<string|null>}
 */
async function uploadToCatbox(buffer) {
    try {
        const { ext, mime } = (await FileType.fromBuffer(buffer)) || { ext: 'bin', mime: 'application/octet-stream' };
        const formData = new FormData();
        const randomBytes = crypto.randomBytes(5).toString("hex");

        formData.append("reqtype", "fileupload");
        formData.append("fileToUpload", buffer, {
            filename: randomBytes + "." + ext,
            contentType: mime
        });

        const response = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: formData,
            headers: {
                ...formData.getHeaders(),
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36",
            },
        });

        return await response.text();
    } catch (e) {
        return null;
    }
}

/**
 * Master Upload Function
 * Priority: Tioxy -> Catbox -> Qu.ax -> Telegra.ph
 */
async function uploadImage(buffer) {
    try {
        let url = null;

        // 1. Tioxy (Fastest)
        url = await uploadToTioxy(buffer);
        if (url && url.startsWith('http')) return url;

        // 2. Catbox (User Preferred / Reliable)
        url = await uploadToCatbox(buffer);
        if (url && url.startsWith('http')) return url;

        // 3. Qu.ax Fallback
        try {
            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const { ext } = await FileType.fromBuffer(buffer) || { ext: 'png' };
            const tempFile = path.join(tmpDir, `temp_${Date.now()}.${ext}`);
            fs.writeFileSync(tempFile, buffer);

            const formQuax = new FormData();
            formQuax.append('files[]', fs.createReadStream(tempFile));
            const response = await fetch('https://qu.ax/upload.php', {
                method: 'POST',
                body: formQuax,
                headers: formQuax.getHeaders()
            });
            fs.unlinkSync(tempFile);
            const result = await response.json();
            if (result?.success) return result.files[0].url;
        } catch (e) { }

        // 4. Telegra.ph Last Resort
        try {
            const { ext, mime } = await FileType.fromBuffer(buffer) || { ext: 'png', mime: 'image/png' };
            const teleForm = new FormData();
            teleForm.append('file', buffer, { filename: `u.${ext}`, contentType: mime });
            const teleRes = await fetch('https://telegra.ph/upload', { method: 'POST', body: teleForm });
            const teleImg = await teleRes.json();
            if (teleImg[0]?.src) return 'https://telegra.ph' + teleImg[0].src;
        } catch (e) { }

        throw new Error('All uploaders failed');
    } catch (error) {
        console.error('Upload Error:', error);
        throw error;
    }
}

module.exports = { uploadImage };