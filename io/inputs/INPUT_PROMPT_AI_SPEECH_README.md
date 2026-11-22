# PromptAI Speech input

Factory ID `prompt-ai-speech` adds speech recognition to the browser-AI pattern generator. Recognised text fills the prompt; the user then clicks **Generate and play**, because model creation/download can require a fresh user gesture. The implementation uses built-in browser AI; it does not take an OpenAI API key or model name.

## Create and route

```ts
import { createInputById } from "audiobus/io/input-factory.ts"

const input = await createInputById("prompt-ai-speech", {
  language: "en-US",
  prompt: "A gentle descending melody",
  mode: "melody",
  bpm: 120,
  loop: true,
  quantise: "bar"
})
document.body.append(await input.createGui())
// Connect input to a host chain with an instrument output.
```

[Speech input](input-prompt-ai-speech.ts) adds `language` (default `en-US`). [PromptAI](input-prompt-ai.ts) defines inherited options: `prompt` (empty), `mode` (`melody`, `bass`, `drums` or `chord`; default `melody`), `bpm` (30–300, default 120), `loop` (true), `quantise` (`bar` or `beat`; default `bar`) and an optional validated `pattern`. [Pattern parsing/schema](../ai-fugue.ts) defines the generated note data.

Generated loops join the shared transport at a beat/bar boundary; while transport is stopped, Generate/Play can preview on a local clock. Drum mode uses MIDI channel 10; other modes use channel 1. The host can supply musical context and its current tempo.

Speech recognition requires `SpeechRecognition` or `webkitSpeechRecognition` and microphone permission; availability and processing location depend on the browser's recognition service. When recognition is unavailable, manual text entry remains available. Built-in AI is checked separately and may need a model download. [Browser AI adapter](../browser-ai.ts) defines availability and generation.

Mount the GUI before using its listening controls. Stop playback/listening and destroy owned input/UI resources on removal. API-key, `gpt-3.5-turbo`, temperature and token-limit examples from the older guide are not this input's configuration.
