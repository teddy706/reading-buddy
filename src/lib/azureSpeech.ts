import "server-only";

// 짧은 음성 답변(수 초~수십 초) 하나를 텍스트로 바꾼다. 아이가 녹음한 오디오는 변환 직후
// 어디에도 저장하지 않고 텍스트만 반환한다(개인정보 최소화 — twin_choice의 음성 처리 원칙과 동일).
export async function transcribeAudio(audio: Buffer, contentType: string): Promise<string> {
  const region = process.env.AZURE_SPEECH_REGION;
  const key = process.env.AZURE_SPEECH_KEY;
  if (!region || !key) throw new Error("Azure AI Speech가 설정되지 않았어요.");

  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ko-KR&format=simple`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": contentType,
      Accept: "application/json",
    },
    body: new Uint8Array(audio),
  });

  if (!response.ok) {
    throw new Error(`음성 인식에 실패했어요. (${response.status})`);
  }

  const data = (await response.json()) as { RecognitionStatus?: string; DisplayText?: string };
  if (data.RecognitionStatus !== "Success" || !data.DisplayText) {
    throw new Error("무슨 말인지 알아듣지 못했어요.");
  }
  return data.DisplayText;
}
