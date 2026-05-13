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

  const { image, mimeType, pdfText } = body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  const systemPrompt = `당신은 영수증/세금계산서 분석 전문가입니다.
주어진 영수증 내용에서 다음 정보를 추출해 JSON으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

추출 항목:
- date: 날짜 (YYYY-MM-DD 형식, 없으면 "")
- amount: 총 결제금액 숫자만 (쉼표 없이, 없으면 0)
- vendor: 상호명/거래처명 (없으면 "")
- memo: 구매 품목 요약 (없으면 "")

응답 예시:
{"date":"2026-04-15","amount":27800,"vendor":"쿠팡","memo":"A4용지 2박스, 정수기컵"}

주의사항:
- 부가세 포함 최종 결제금액을 amount로 추출
- 품목이 여러 개면 memo에 콤마로 구분해서 나열
- 확실하지 않은 정보는 빈값으로 두기
- JSON 외 다른 텍스트 절대 금지`;

  try {
    let parts = [];

    if (pdfText) {
      // PDF 텍스트 직접 파싱
      parts = [{ text: systemPrompt + '\n\n영수증 텍스트:\n' + pdfText.slice(0, 3000) }];
    } else if (image) {
      // 이미지 Vision 분석
      parts = [
        { text: systemPrompt },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } }
      ];
    } else {
      return res.status(400).json({ error: "image 또는 pdfText 필요" });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
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
      res.status(200).json({ error: "분석 결과 파싱 실패", raw: text });
    }
  } catch(e) {
    res.status(200).json({ error: e.message });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '20mb' } }
};
