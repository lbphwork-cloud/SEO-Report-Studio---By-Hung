// Lấy danh sách model trực tiếp từ Anthropic Models API → dropdown tự cập nhật khi Claude ra model mới.
export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: 'Thiếu ANTHROPIC_API_KEY' }); return; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'Lỗi Models API', detail: data }); return; }
    const models = (data.data || []).map(m => ({ id: m.id, name: m.display_name || m.id }));
    res.setHeader('Cache-Control', 's-maxage=3600'); // cache 1h ở CDN
    res.status(200).json({ models, default: process.env.CLAUDE_MODEL || 'claude-opus-4-8' });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
