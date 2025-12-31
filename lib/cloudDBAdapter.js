const axios = require('axios');

/**
 * CloudDBAdapter
 * A database adapter for cloud-based JSON storage (e.g., jsonbin.io, raw.githubusercontent.com for read, etc.)
 */
const stringify = obj => JSON.stringify(obj, null, 2);
const parse = str => JSON.parse(str, (_, v) => {
    if (
        v !== null &&
        typeof v === 'object' &&
        'type' in v &&
        v.type === 'Buffer' &&
        'data' in v &&
        Array.isArray(v.data)) {
        return Buffer.from(v.data);
    }
    return v;
});

class CloudDBAdapter {
    constructor(url, {
        serialize = stringify,
        deserialize = parse,
        fetchOptions = {}
    } = {}) {
        this.url = url;
        this.serialize = serialize;
        this.deserialize = deserialize;
        this.fetchOptions = fetchOptions;
    }

    async read() {
        try {
            const res = await axios.get(this.url, {
                headers: {
                    'Accept': 'application/json;q=0.9,text/plain'
                },
                ...this.fetchOptions,
                responseType: 'text' // We handle deserialization manually
            });

            if (res.status !== 200) throw new Error(res.statusText);

            // Handle both string and object responses
            const data = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            return this.deserialize(data);
        } catch (e) {
            console.error('CloudDBAdapter Read Error:', e.message);
            return null;
        }
    }

    async write(obj) {
        try {
            const res = await axios.post(this.url, this.serialize(obj), {
                headers: {
                    'Content-Type': 'application/json'
                },
                ...this.fetchOptions
            });

            if (res.status !== 200 && res.status !== 201) throw new Error(res.statusText);
            return res.data;
        } catch (e) {
            console.error('CloudDBAdapter Write Error:', e.message);
            throw e;
        }
    }
}

module.exports = CloudDBAdapter;
