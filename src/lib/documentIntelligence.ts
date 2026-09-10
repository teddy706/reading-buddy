import "server-only";

const API_VERSION = "2024-11-30";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 독서노트 사진 한 장을 OCR로 읽어 인식된 전체 텍스트를 돌려준다. prebuilt-read 모델은
// 비동기(analyze -> Operation-Location 폴링) 방식이라 완료될 때까지 짧게 폴링한다.
export async function analyzeImage(imageUrl: string): Promise<string> {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  if (!endpoint || !key) throw new Error("Document Intelligence가 설정되지 않았어요.");

  const base = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  const analyzeResponse = await fetch(
    `${base}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=${API_VERSION}`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urlSource: imageUrl }),
    }
  );

  if (analyzeResponse.status !== 202) {
    throw new Error(`OCR 요청에 실패했어요. (${analyzeResponse.status})`);
  }
  const operationLocation = analyzeResponse.headers.get("operation-location");
  if (!operationLocation) throw new Error("OCR 진행 상태를 확인할 수 없어요.");

  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(1000);
    const pollResponse = await fetch(operationLocation, {
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
    if (!pollResponse.ok) throw new Error("OCR 결과를 가져오지 못했어요.");

    const data = (await pollResponse.json()) as {
      status: string;
      analyzeResult?: { content?: string };
    };

    if (data.status === "succeeded") {
      return data.analyzeResult?.content?.trim() ?? "";
    }
    if (data.status === "failed") {
      throw new Error("사진에서 글자를 읽지 못했어요.");
    }
  }

  throw new Error("OCR 처리 시간이 너무 오래 걸려요.");
}
