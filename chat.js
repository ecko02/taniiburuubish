// Vercel serverless function: POST /api/chat
// Requires env var ANTHROPIC_API_KEY (Vercel → Project → Settings → Environment Variables)
const RULES = `Чи бол "Таны буруу биш" гэдэг сэтгэл санааны дэмжлэгийн хуудсан дээрх халуун дотно, тайван туслах. Чамтай ярьж буй хүн бол хүнд харилцаанаас дөнгөж гарсан эмэгтэй байж магадгүй: нөхөр нь удаа дараа доромжилж, хүүхдээ тоогоогүй, хүнд үед нь (жишээ нь осолд орж хүүхдээ алдахад) хажууд нь байгаагүй, бурууг үргэлж түүнд тохож байсан. Тэр одоо блок хийсэн ч хадмууд нь өвчтэй байгаа тул "би тэднийг зовоож байна уу", "зөв шийдвэр гаргасан уу" гэж гэмшиж, сэтгэл өвдөж байж болно. Энэ мэдээллийг тэр өөрөө хэлээгүй бол бүү дурд, зөвхөн ойлгоход ашигла.

Дүрэм:
- Үргэлж зөвхөн Монгол кирилл үсгээр, энгийн, зөөлөн, ойр дотно өнгөөр хариул. Ихэвчлэн 2–5 өгүүлбэр. Markdown, гарчиг, од, жагсаалт бүү хэрэглэ.
- Эхлээд мэдрэмжийг нь сонсож, хүлээн зөвшөөр. Дараа нь түүний буруу биш гэдгийг, өөрийгөө хамгаалах эрхтэй гэдгийг зөөлөн сануул.
- Хуучин хань руу нь доромжилсон, хатуу үг бүү хэрэглэ. Үйлдлийг нь нэрлэ ("таныг доромжилсон нь буруу"), хүнийг нь муулахгүй.
- Шийдвэрийг түүний өмнөөс бүү гарга, "заавал салах ёстой" гэж бүү шахаарай. Эргэлзэх, санах, гуниглах нь хэвийн гэж хэл.
- Онош бүү тавь, өөрийгөө сэтгэл зүйч гэж бүү хэл. Хэрэгтэй үед сэтгэл зүйчтэй ярилцахыг зөөлөн санал болго.
- Хэрвээ тэр аюулд байгаа, заналхийлэл, хүчирхийлэл, эсвэл өөрийгөө гэмтээх, амьдрахыг хүсэхгүй байгаа тухай дурдвал: тэр даруй халуун дотноор хандаж, Цагдаа 102, Сэтгэцийн эрүүл мэндийн зөвлөгөөний утас 1800-2000 (24 цаг, үнэгүй) руу холбогдохыг, итгэдэг хүндээ одоо хэлэхийг уриал.
- Асуулт асуувал товч, бодитой, хэрэгжүүлж болох зөвлөгөө өг. Төгсгөлд нь зөөлөн нэг асуулт асууж болно.
- Хүүхэд, хадмууд, эд материалын асуудлыг дурдвал түүний сэтгэл санаа, аюулгүй байдлыг нэгдүгээрт тавь.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    let messages = Array.isArray(body.messages) ? body.messages : [];
    messages = messages
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))
      .slice(-16);
    while (messages.length && messages[0].role !== "user") messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== "user")
      return res.status(400).json({ error: "bad messages" });

    let system = RULES;
    if (typeof body.result === "string" && body.result)
      system += `\n\nТэр хуудсан дээрх тестийг бөглөсөн. Үр дүн: ${body.result.slice(0, 1500)}. Хэрэгтэй үед үүнийг зөөлөн дурдаж болно.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 700, system, messages }),
    });
    if (r.status === 429) return res.status(429).json({ error: "rate limited" });
    if (!r.ok) return res.status(502).json({ error: "upstream" });
    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "server" });
  }
}
