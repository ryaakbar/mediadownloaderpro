// api/index.js
import axios from 'axios';

class DownrScraper {
  constructor() {
    this.baseURL = 'https://downr.org';
    this.headers = {
      'accept': '*/*',
      'content-type': 'application/json',
      'origin': 'https://downr.org',
      'referer': 'https://downr.org/',
      'user-agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36'
    };
  }

  async getSessionCookie() {
    const baseCookie = '_ga=GA1.1.536005378.1770437315; _clck=17lj13q%5E2%5Eg3d';
    try {
      const res = await axios.get(`${this.baseURL}/.netlify/functions/analytics`, {
        headers: { ...this.headers, cookie: baseCookie },
        timeout: 8000
      });
      const sess = res.headers['set-cookie']?.[0]?.split(';')[0];
      return sess ? `${baseCookie}; ${sess}` : baseCookie;
    } catch (e) {
      return baseCookie;
    }
  }

  async fetch(url) {
    const cookie = await this.getSessionCookie();
    const res = await axios.post(
      `${this.baseURL}/.netlify/functions/nyt`,
      { url },
      {
        headers: { ...this.headers, cookie },
        timeout: 15000
      }
    );

    // Pastikan response adalah JSON valid
    if (typeof res.data === 'string') {
      throw new Error('Upstream server returned invalid response. Coba lagi dalam beberapa saat.');
    }

    return res.data;
  }
}

// Vercel Handler
export default async function handler(req, res) {
  // Setup CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Hanya terima POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { url } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'URL parameter wajib diisi.' });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL tidak valid. Pastikan format URL benar.' });
  }

  try {
    const scraper = new DownrScraper();
    const data = await scraper.fetch(url);

    if (!data || !data.medias || data.medias.length === 0) {
      return res.status(404).json({ error: 'Media tidak ditemukan. Pastikan link valid dan konten bukan privat.' });
    }

    return res.status(200).json({
      success: true,
      data: data.medias,
      original_url: url
    });

  } catch (error) {
    console.error('[API Error]', error?.message || error);

    // Pesan error yang lebih user-friendly
    let message = 'Terjadi kesalahan pada server. Coba lagi dalam beberapa saat.';

    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      message = 'Request timeout. Server terlalu lama merespons, coba lagi.';
    } else if (error?.response?.status === 429) {
      message = 'Terlalu banyak request. Tunggu sebentar lalu coba lagi.';
    } else if (error?.message?.includes('invalid response')) {
      message = error.message;
    }

    return res.status(500).json({ error: message });
  }
}
