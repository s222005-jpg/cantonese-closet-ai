import { useEffect } from "react";
import { useTTS } from "@/hooks/useTTS";

export default function Install() {
  const { speak } = useTTS();

  useEffect(() => {
    const t = setTimeout(() => {
      speak(
        "要安裝聲著應用程式，請按照以下步驟操作。" +
          "如果你使用 iPhone，請喺 Safari 瀏覽器開啟此頁面，" +
          "然後按底部嘅分享按鈕，再選擇「加入主畫面」。" +
          "如果你使用 Android，請喺 Chrome 瀏覽器開啟，" +
          "按右上角三點選單，然後選擇「新增至主畫面」。" +
          "安裝後，應用程式會出現喺你嘅主畫面，可以直接開啟使用。"
      );
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "hsl(var(--deep-blue-dark))" }}
    >
      <h1 className="text-4xl font-bold text-white text-center mb-8 text-shadow-lg">
        安裝聲著 VoiceWear
      </h1>

      <div className="w-full max-w-md space-y-6">
        <InstallCard
          title="iPhone / iPad (iOS Safari)"
          steps={[
            "用 Safari 瀏覽器開啟此頁面",
            "按底部中間嘅「分享」按鈕（方形加箭頭）",
            "向下捲動，選擇「加入主畫面」",
            "按「新增」確認",
          ]}
          icon="🍎"
        />

        <InstallCard
          title="Android (Chrome)"
          steps={[
            "用 Chrome 瀏覽器開啟此頁面",
            "按右上角三點選單（⋮）",
            "選擇「新增至主畫面」或「安裝應用程式」",
            "按「新增」確認",
          ]}
          icon="🤖"
        />
      </div>

      <p className="text-muted-foreground text-center mt-8 text-lg leading-relaxed max-w-sm">
        安裝後，應用程式會喺主畫面顯示，
        <br />
        全螢幕運行，無需瀏覽器界面。
      </p>
    </div>
  );
}

function InstallCard({
  title,
  steps,
  icon,
}: {
  title: string;
  steps: string[];
  icon: string;
}) {
  return (
    <div className="rounded-2xl bg-card/60 border border-border/50 p-6 backdrop-blur">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">{icon}</span>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
              {i + 1}
            </span>
            <span className="text-foreground text-base leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
