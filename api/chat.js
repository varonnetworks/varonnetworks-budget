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

  const { messages } = body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "messages 필요" });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  const systemPrompt = `당신은 더존 스마트A10 기준 계정과목 전문 회계 도우미입니다. 어학원(영어학원, 보습학원) 운영비 관련 질문에 짧고 명확하게 한국어로 답변하세요.

[계정과목 목록]
801임원급여 802직원급여 803상여금 804제수당 805잡급 806퇴직급여
811복리후생비 812여비교통비 813접대비 814통신비 815수도광열비 816전력비
817세금과공과금 818감가상각비 819지급임차료 820수선비 821보험료 822차량유지비
825교육훈련비 826도서인쇄비 827회의비 830소모품비 831지급수수료
833광고선전비 834판매촉진비 841행사비 842기타잡비

[어학원 실무 계정 분류 기준 - 반드시 이 기준을 최우선으로 적용]
- 803 상여금: 특정 선생님 성과 포상
- 811 복리후생비: 전 직원 명절선물, 회식, 간식
- 813 접대비: 일부 수강생에게만 제공하는 간식, 즉흥적 특정반 포상 음식
- 827 회의비: 원장단 회의 음료·다과
- 830 소모품비: 필기류, 복사용지, 포장·정리류, 위생·비품류, 수업용품, 소형기기(10만원 미만), 설명회 생수·간식·볼펜 등 소모성 물품 전반
- 833 광고선전비: 우수학생 선물·시상, 현수막·홍보물 제작 등 외부 홍보
- 834 판매촉진비: 사전 공지된 우수반 포상 음식(피자 등), 전체 수강생 대상 정기 간식
- 841 행사비: 마켓데이·푸드데이 등 학원 행사
- 842 기타잡비: 시상학생 사진 인화, 위 항목에 해당하지 않는 소액 기타 지출

[중요 판단 기준]
- 소모품비(830): 소모성 물품 전반. 설명회 생수·볼펜도 소모품비 (접대비 아님)
- 복리후생비(811): 전 직원 대상일 때만 해당. 특정인 포상은 상여금(803)
- 광고선전비(833): 불특정 다수 외부 홍보 목적에만 해당. 원내 행사는 행사비(841)
- 접대비(813): 한도 초과분은 비용 불인정되므로 꼭 필요한 경우에만 사용
- 모르거나 애매한 경우 "세무사와 확인이 필요합니다"라고 안내`;

  const contents = messages.map((m, i) => {
    if (i === 0 && m.role === 'user') {
      return { role: 'user', parts: [{ text: systemPrompt + '\n\n사용자 질문: ' + m.content }] };
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    };
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
        })
      }
    );
    const data = await response.json();
    if (!response.ok) return res.status(200).json({ error: `Gemini 오류: ${data?.error?.message || response.status}` });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });
  } catch(e) {
    res.status(200).json({ error: e.message });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};
