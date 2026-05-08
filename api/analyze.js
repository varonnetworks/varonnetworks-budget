module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: "Invalid JSON body" }); }
  }
  if (!body) return res.status(400).json({ error: "Empty body" });

  const { image, mimeType, prompt } = body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  try {
    const parts = [];
    if (image) parts.push({ inlineData: { mimeType, data: image } });
    parts.push({ text: prompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ error: `Gemini error: ${data?.error?.message || response.status}` });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) return res.status(200).json({ error: "빈 응답" });

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    res.status(200).json({ text: cleaned });
  } catch (e) {
    res.status(200).json({ error: e.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};
