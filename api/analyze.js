// Vercel serverless function — proxy gọi Claude API, GIẤU key phía server.
// Nhận số liệu SEO + cấp độ tone, trả về SWOT + executive summary bằng tiếng Việt.
// Model mặc định claude-opus-4-8 (đổi qua biến môi trường CLAUDE_MODEL nếu muốn rẻ hơn: claude-haiku-4-5 / claude-sonnet-4-6).

const TONE_LABEL = {
  '-2': 'CHÊ MẠNH — chỉ ra yếu kém thẳng thắn, giọng cảnh báo, nhấn rủi ro tụt hạng',
  '-1': 'CHÊ — nêu nhiều điểm cần cải thiện, giọng nghiêm túc nhưng xây dựng',
  '0':  'BÌNH THƯỜNG — trung lập, cân bằng, bám sát số liệu',
  '1':  'KHEN — nhấn điểm mạnh và cơ hội, giọng tích cực',
  '2':  'KHEN MẠNH — khẳng định vị thế nổi bật, giọng tự tin, truyền cảm hứng',
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    S: { type: 'array', items: { type: 'string' } },
    W: { type: 'array', items: { type: 'string' } },
    O: { type: 'array', items: { type: 'string' } },
    T: { type: 'array', items: { type: 'string' } },
    lead: { type: 'string' },
    pillars: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          n: { type: 'string' },
          h: { type: 'string' },
          p: { type: 'string' },
        },
        required: ['n', 'h', 'p'],
      },
    },
    verdict: { type: 'string' },
  },
  required: ['S', 'W', 'O', 'T', 'lead', 'pillars', 'verdict'],
};

function buildPrompt(self, competitors, tone) {
  const toneKey = String(parseInt(tone) || 0);
  const fmtDomain = (o) =>
    `- ${o.domain}: DR ${o.dr ?? '—'}, UR ${o.ur ?? '—'}, Organic Keywords ${o.okw ?? '—'} (Top3: ${o.kTop3 ?? '—'}), ` +
    `Organic Traffic ${o.traffic ?? '—'}/tháng, Traffic Value $${o.value ?? '—'}, ` +
    `Referring Domains ${o.refAll ?? '—'} (followed ${o.refFol ?? '—'}), Backlinks ${o.blAll ?? '—'}, ` +
    `Paid Traffic ${o.ptraffic ?? '—'}, Top country ${o.countries ?? '—'}`;

  return `Bạn là chuyên gia tư vấn SEO cao cấp tại một agency. Viết phần nhận định cho báo cáo phân tích cạnh tranh SEO bằng TIẾNG VIỆT.

WEBSITE NỘI TẠI (của khách hàng):
${fmtDomain(self)}

ĐỐI THỦ:
${competitors.map(fmtDomain).join('\n')}

ĐỊNH HƯỚNG GIỌNG ĐÁNH GIÁ: ${TONE_LABEL[toneKey]}

YÊU CẦU:
1. Mọi nhận định phải DỰA ĐÚNG trên số liệu ở trên — không bịa số, không mâu thuẫn với dữ liệu.
2. Giọng văn phải nhất quán với định hướng đánh giá đã cho, và đọc liền mạch, chỉn chu như báo cáo gửi khách thật.
3. Trả về JSON đúng cấu trúc:
   - S, W, O, T: mỗi mảng 3–5 câu (Strengths/Weaknesses/Opportunities/Threats), mỗi câu ngắn gọn, có dẫn số liệu cụ thể.
   - lead: 1 đoạn mở đầu executive summary (3–5 câu), nêu vị thế tổng quan & share of voice tương đối.
   - pillars: đúng 3 trụ cột chiến lược, mỗi trụ cột có n (vd "TRỤ CỘT 01"), h (tiêu đề ngắn), p (1–2 câu mô tả hành động).
   - verdict: 1 câu kết luận mạnh mẽ, bắt đầu bằng "Kết luận:".
4. Dùng HTML inline đơn giản trong text nếu cần nhấn mạnh: chỉ <b></b>. Không markdown, không xuống dòng thừa.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Chỉ hỗ trợ POST' });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Thiếu ANTHROPIC_API_KEY trên server' });
    return;
  }
  try {
    const { self, competitors, tone, model: reqModel } = req.body || {};
    if (!self || !Array.isArray(competitors) || !competitors.length) {
      res.status(400).json({ error: 'Thiếu dữ liệu self/competitors' });
      return;
    }
    // model do người dùng chọn (validate cơ bản), fallback env rồi default
    const model = (typeof reqModel === 'string' && /^claude-[a-z0-9.\-]+$/i.test(reqModel))
      ? reqModel
      : (process.env.CLAUDE_MODEL || 'claude-opus-4-8');
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        output_config: {
          format: { type: 'json_schema', schema: SCHEMA },
        },
        messages: [{ role: 'user', content: buildPrompt(self, competitors, tone) }],
      }),
    });
    const data = await apiRes.json();
    if (!apiRes.ok) {
      res.status(502).json({ error: 'Lỗi gọi Claude', detail: data });
      return;
    }
    const block = (data.content || []).find((b) => b.type === 'text');
    if (!block) {
      res.status(502).json({ error: 'Claude không trả về nội dung' });
      return;
    }
    const parsed = JSON.parse(block.text);
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
