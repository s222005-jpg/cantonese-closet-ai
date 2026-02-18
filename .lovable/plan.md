
# 聲著 (VoiceWear) — Full-Stack PWA Implementation Plan

## What We're Building

A fully automated, voice-driven clothing assistant PWA for Cantonese-speaking blind users in Hong Kong. No buttons required — the app runs entirely on spoken Cantonese commands and automatic camera capture.

---

## App Pages & Screens

### 1. Main Camera Screen (`/`)
The only screen users ever need. On load:
- Displays a deep blue (#0A1F44) full-screen interface with large white text showing app status in Traditional Chinese
- Auto-requests camera permission and activates rear camera
- Speaks: 「你嘅相片只會用作穿搭分析，系統唔會儲存或分享。」(first launch only)
- Speaks: 「相機已啟動，五秒後拍照。」
- Visible countdown shown in massive white numbers (for low-vision users)
- Vibrates on key events: camera active, photo taken, analysis started, speech begins

### 2. Analysis Result Screen (overlay, same page)
- After AI returns, displays the full analysis in large high-contrast text
- Text-to-speech auto-reads the Cantonese summary aloud
- Shows listening indicator for follow-up voice commands

### 3. PWA Install Page (`/install`)
- Guides user to install the app to home screen
- Read aloud automatically: instructions for iOS and Android

---

## Core User Flow

```
App Opens
  → Privacy notice spoken (first time only)
  → Camera activates + vibrate
  → "五秒後拍照" spoken
  → 5, 4, 3, 2, 1 counted down in Cantonese
  → Photo taken + vibrate
  → Image sent to backend AI
  → "分析緊..." spoken while waiting
  → AI returns JSON analysis
  → Cantonese speech summary auto-plays + vibrate
  → App listens for follow-up voice commands
```

---

## Voice Command System

Continuous listening (Web Speech API, `zh-HK`) after analysis:

| Command | Action |
|---|---|
| 「分析我嘅穿搭」 | Restart full capture flow |
| 「再試一次」 | Retake photo & re-analyse |
| 「重複」 | Re-read last AI result |
| 「講慢啲」 | Replay at 0.7× speed |
| 「停止」 | Stop speech immediately |
| 「適唔適合見工？」 | Send follow-up to AI |
| 「適唔適合婚禮？」 | Send follow-up to AI |
| 「應該配咩鞋？」 | Send follow-up to AI |

---

## Backend: Lovable Cloud Edge Functions

### Edge Function 1: `analyze-outfit`
- Accepts: base64 image
- Sends to Lovable AI (Gemini 2.5 Flash) with vision capability
- System prompt instructs it to analyse clothing and return structured JSON in Traditional Chinese
- Returns: `{ 上身, 下身, 顏色, 風格, 正式程度, 配搭評分, 建議 }`
- Image is never stored — processed in memory only

### Edge Function 2: `followup-question`
- Accepts: previous analysis JSON + user's Cantonese voice question
- Sends to Lovable AI for conversational response
- Returns: Cantonese text answer for TTS

---

## Text-to-Speech Strategy

- **Primary**: Web Speech API (`SpeechSynthesis`, `zh-HK`) — free, no API key, works offline
- Converts AI JSON into natural flowing Cantonese sentence
- Example: 「你而家著緊一件藍色T恤，同黑色長褲。整體感覺休閒自然。顏色配搭協調度高。如果想正式少少，可以加件外套。」
- Speed adjustable via 「講慢啲」 voice command

---

## PWA Configuration

- `vite-plugin-pwa` with full manifest
- App name: 聲著 VoiceWear
- Theme colour: `#0A1F44`
- Service worker with offline fallback
- `/~oauth` excluded from service worker cache
- Mobile-optimised viewport meta tags
- iOS & Android install guidance at `/install`

---

## Accessibility & Haptics

- All text in Traditional Chinese (zh-HK)
- Minimum font size: 32px for status text
- `navigator.vibrate()` at 4 key moments
- ARIA live regions announce all state changes
- No colour-only information
- Contrast ratio >7:1 throughout

---

## Error Handling (All Spoken)

| Situation | Cantonese Response |
|---|---|
| Camera blocked | 「無法開啟相機，請檢查權限。」 |
| AI analysis fails | 「分析失敗，請再試一次。」 |
| Voice not detected | 「聽唔到指令，請再講一次。」 |
| Network error | 「網絡出現問題，請稍後再試。」 |

---

## What We'll Build First

1. **PWA setup** — manifest, service worker, install page
2. **Main screen** — camera auto-activation, countdown, photo capture
3. **Backend** — two Lovable Cloud edge functions (analyze-outfit, followup-question)
4. **AI analysis** — Gemini vision model with Cantonese clothing analysis prompt
5. **Voice output** — Web Speech API TTS with JSON-to-Cantonese conversion
6. **Voice input** — Continuous `zh-HK` speech recognition + command matching
7. **Haptics + ARIA** — vibration, live regions, high-contrast UI
8. **Error handling** — all error states spoken in Cantonese
9. **Privacy notice** — first-launch spoken disclaimer
