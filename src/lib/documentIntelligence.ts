import "server-only";

const API_VERSION = "2024-11-30";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function credentials() {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  if (!endpoint || !key) throw new Error("Document Intelligence가 설정되지 않았어요.");
  return { base: endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint, key };
}

// analyze 요청이 돌려준 Operation-Location을 완료될 때까지 짧게 폴링한다(공용 로직).
async function pollResult(operationLocation: string, key: string): Promise<string> {
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

// 독서노트 사진 한 장을 OCR로 읽어 인식된 전체 텍스트를 돌려준다(Supabase Storage의 서명된
// URL을 넘겨받는 방식). prebuilt-read 모델은 비동기(analyze -> Operation-Location 폴링)라
// 완료될 때까지 짧게 폴링한다.
export async function analyzeImage(imageUrl: string): Promise<string> {
  const { base, key } = credentials();
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

  return pollResult(operationLocation, key);
}

// 표지 촬영 자동 인식(Phase 2 C)용 변형. 이 사진은 저장할 필요가 없는 일회성 검색 보조
// 용도라 Supabase Storage에 올리지 않고, 업로드받은 바이트를 그대로 Document Intelligence에
// 전달한다(urlSource 대신 binary body — Azure가 둘 다 지원함).
export async function analyzeImageBytes(bytes: Buffer, contentType: string): Promise<string> {
  const { base, key } = credentials();
  const analyzeResponse = await fetch(
    `${base}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=${API_VERSION}`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": contentType || "application/octet-stream",
      },
      body: new Uint8Array(bytes),
    }
  );

  if (analyzeResponse.status !== 202) {
    throw new Error(`OCR 요청에 실패했어요. (${analyzeResponse.status})`);
  }
  const operationLocation = analyzeResponse.headers.get("operation-location");
  if (!operationLocation) throw new Error("OCR 진행 상태를 확인할 수 없어요.");

  return pollResult(operationLocation, key);
}
