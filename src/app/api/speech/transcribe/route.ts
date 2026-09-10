import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/azureSpeech";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "audio/webm";
  const arrayBuffer = await request.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: "녹음된 내용이 없어요." }, { status: 400 });
  }

  try {
    const text = await transcribeAudio(Buffer.from(arrayBuffer), contentType);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "음성 인식에 실패했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
