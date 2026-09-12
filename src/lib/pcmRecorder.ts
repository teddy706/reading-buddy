"use client";

// Azure Speech 단문 인식 REST API(azureSpeech.ts)는 오디오 형식으로 WAV(PCM)와 OGG/OPUS만
// 받는다. 그런데 브라우저 MediaRecorder는 크롬/사파리 계열에서 기본적으로 WebM/Opus를 만들고
// 이 형식은 그 엔드포인트가 거부한다 — 마이크 버튼이 항상 실패했던 원인. Web Audio API로
// 마이크의 raw PCM 샘플을 직접 받아 16kHz mono WAV로 인코딩해 이 문제를 브라우저 종류와
// 무관하게 피해간다.
const TARGET_SAMPLE_RATE = 16000;

export interface PcmRecorder {
  stop(): Blob;
}

export function startPcmRecording(stream: MediaStream): PcmRecorder {
  const AudioContextCtor: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioContextCtor();
  const source = context.createMediaStreamSource(stream);
  // ScriptProcessorNode는 지원 중단(deprecated) 표시가 있지만 모든 주요 브라우저에서 여전히
  // 동작한다. AudioWorklet은 별도 모듈 파일을 정적으로 서빙/등록해야 해서, 수 초짜리 짧은
  // 녹음 하나 처리하는 데는 과한 복잡도라 판단해 쓰지 않았다.
  const processor = context.createScriptProcessor(4096, 1, 1);
  // 마이크 입력을 destination에 연결해야 onaudioprocess가 안정적으로 발화하는 브라우저가 있다.
  // 그대로 연결하면 아이 목소리가 스피커로 바로 되먹임(에코)되므로 gain 0으로 무음 처리한다.
  const silentGain = context.createGain();
  silentGain.gain.value = 0;

  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(context.destination);

  return {
    stop() {
      processor.disconnect();
      source.disconnect();
      silentGain.disconnect();
      const sampleRate = context.sampleRate;
      void context.close();
      const merged = mergeChunks(chunks);
      const resampled = resampleTo16k(merged, sampleRate);
      return encodeWav(resampled, TARGET_SAMPLE_RATE);
    },
  };
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function resampleTo16k(samples: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === TARGET_SAMPLE_RATE) return samples;
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const newLength = Math.max(1, Math.round(samples.length / ratio));
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, samples.length - 1);
    const weight = srcIndex - low;
    result[i] = (samples[low] ?? 0) * (1 - weight) + (samples[high] ?? 0) * weight;
  }
  return result;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
