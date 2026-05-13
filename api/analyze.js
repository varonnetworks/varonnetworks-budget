module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: "Invalid JSON" }); }
  }

  const { image, mimeType, pdfText, mode } = body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  const prompt = mode === 'multi'
    ? `영수증/거래명세표에서 품목별로 분리해 JSON으로만 응답하세요. 마크다운 없이 순수 JSON만.

응답 형식:
{
  "date": "YYYY-MM-DD",
  "vendor": "상호명",
  "receipt_url": "",
  "items": [
    {"memo": "품목명", "amount": 금액, "qty": 수량},
    ...
  ]
}

주의:
- items의 amount는 VAT포함 단가 × 수량 = 행합계
- 할인이 있으면 마지막 items에 {"memo":"할인","amount":-할인금액,"qty":1} 추가
- 배송비 있으면 {"memo":"배송비","amount":배송비,"qty":1} 추가
- qty 없으면 1로
- 순수 JSON만, 다른 텍스트 절대 금지`
    : `영수증에서 정보 추출해 JSON으로만 응답. 마크다운 없이 순수 JSON만.
{"date":"YYYY-MM-DD","amount":최종결제금액숫자,"vendor":"상호명","memo":"품목요약"}`;

  try {
    let parts = [];
    if (pdfText && pdfText.trim().length > 10) {
      parts = [{ text: prompt + '\n\n영수증 내용:\n' + pdfText.slice(0, 4000) }];
    } else if (image && mimeType === 'application/pdf') {
      parts = [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: image } }];
    } else if (image) {
      parts = [{ text: prompt }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } }];
    } else {
      return res.status(400).json({ error: "분석할 데이터가 없습니다" });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(200).json({ error: `Gemini 오류: ${data?.error?.message}` });

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      const parsed = JSON.parse(text);
      res.status(200).json(parsed);
    } catch {
      res.status(200).json({ error: "파싱 실패", raw: text });
    }
  } catch(e) {
    res.status(200).json({ error: e.message });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '20mb' } }
};
