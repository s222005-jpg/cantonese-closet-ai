import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Missing imageBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `你係一位專業時裝分析師，專門分析香港人嘅日常穿搭。
用戶會畀你一張相片，相片入面有一個人或者一套衣服。
請仔細睇清楚相片入面嘅衣著，然後以以下 JSON 格式返回結果：
{
  "上身": "上身衣物種類同顏色描述",
  "下身": "下身衣物種類同顏色描述",
  "顏色": "主要顏色同配色描述",
  "風格": "整體穿搭風格",
  "正式程度": "休閒 / 商務 / 正式",
  "配搭評分": "X/10",
  "建議": "正面鼓勵嘅穿搭改善建議"
}
請確保：
1. 所有文字用繁體中文，廣東話口語
2. 建議語氣要正面鼓勵
3. 只返回 JSON，唔需要其他說明
4. 你一定要根據相片入面實際見到嘅衣物嚟分析，唔好估或者亂作
5. 如果真係完全睇唔到任何衣物，先至用 "N/A"`;

    // Clean the base64 - remove any whitespace or data URI prefix
    let cleanedBase64 = imageBase64.trim();
    if (cleanedBase64.startsWith("data:")) {
      cleanedBase64 = cleanedBase64.split(",")[1] || cleanedBase64;
    }
    cleanedBase64 = cleanedBase64.replace(/\s/g, "");

    console.log("Image base64 length:", cleanedBase64.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${cleanedBase64}`,
                },
              },
              {
                type: "text",
                text: "請分析呢張相入面嘅穿搭。",
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "請求次數超出限制，請稍後再試。" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI 服務需要充值，請聯絡管理員。" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      analysis = {
        上身: "未能識別",
        下身: "未能識別",
        顏色: "未能識別",
        風格: "未能識別",
        正式程度: "未能識別",
        配搭評分: "N/A",
        建議: content || "分析失敗，請再試一次。",
      };
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-outfit error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "分析失敗" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
