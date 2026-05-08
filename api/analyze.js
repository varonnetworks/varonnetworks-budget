module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { image, mimeType, prompt } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  try {
    const parts = [];
    if (image) parts.push({ inlineData: { mimeType, data: image } });
    parts.push({ text: prompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ error: `Gemini error: ${data?.error?.message || response.status}` });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return res.status(200).json({ error: "Gemini returned empty response" });
    }

    // JSON 추출 - 마크다운 코드블록 제거
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // JSON 유효성 검사
    try {
      JSON.parse(cleaned);
    } catch(e) {
      // JSON이 아니면 텍스트 그대로 반환해서 클라이언트가 처리하게
      return res.status(200).json({ text: cleaned, raw: true });
    }

    res.status(200).json({ text: cleaned });
  } catch (e) {
    res.status(200).json({ error: e.message });
  }
};
