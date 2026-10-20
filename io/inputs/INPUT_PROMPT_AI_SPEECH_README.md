# PromptAI Speech Input

A voice-controlled input component that extends the existing `InputPromptAI` component with Web Speech API speech recognition capabilities.

## Overview

The `InputPromptAISpeech` component allows users to:
- Speak descriptions of musical sequences (e.g., "C major scale")
- Automatically convert speech to text using the Web Speech API
- Pass the recognized text to the AI prompt generator
- Automatically generate MIDI note sequences from the voice input

## Features

- **Speech Recognition**: Uses built-in Web Speech API (supports both `SpeechRecognition` and `webkitSpeechRecognition`)
- **Real-time Feedback**: Shows interim and final transcripts as the user speaks
- **Visual Indicators**: Animated listening state with pulse indicator
- **Automatic Generation**: Automatically triggers sequence generation when speech recognition completes
- **Language Support**: Configurable language (defaults to `en-US`)
- **Fallback Support**: Works with all modern browsers that support the Web Speech API

## Usage

### Basic Setup

```typescript
import InputPromptAISpeech from "./inputs/input-prompt-ai-speech.ts"

// Create an instance with options
const speechInput = new InputPromptAISpeech({
	apiKey: "your-openai-api-key",
	model: "gpt-3.5-turbo",
	temperature: 0.7,
	maxTokens: 500,
	language: "en-US"
})

// Create the GUI
await speechInput.createGui()
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | `""` | OpenAI API key for prompt generation |
| `model` | string | `"gpt-3.5-turbo"` | LLM model to use for generation |
| `temperature` | number | `0.7` | Model temperature for creativity |
| `maxTokens` | number | `500` | Maximum tokens in response |
| `language` | string | `"en-US"` | Language for speech recognition |

## Component Structure

### UI Elements

The component creates the following interface:

```
┌─────────────────────────────────────────┐
│ PromptAI Generator                       │
├─────────────────────────────────────────┤
│ [Textarea for manual input]             │
├─────────────────────────────────────────┤
│ [Generate Sequence] [Stop]              │
├─────────────────────────────────────────┤
│ [🎤 Start Listening] [⏹ Stop Listening] │
│ ✓ Listening... (with pulse)             │
│ Recognized: "C major scale"             │
├─────────────────────────────────────────┤
│ Status messages                          │
├─────────────────────────────────────────┤
│ Generated Notes: C4 D4 E4 F4 ...        │
└─────────────────────────────────────────┘
```

### Key Methods

- `startListening()`: Starts listening for speech input
- `stopListening()`: Stops listening for speech input
- `updateListeningState(isListening)`: Updates button states and visual indicators
- `updateTranscript(transcript, isFinal)`: Updates transcript preview
- `populatePromptAndGenerate(transcript)`: Fills the textarea and auto-generates sequence

## Browser Compatibility

The Web Speech API is supported in:
- Chrome/Chromium (v25+)
- Edge (v79+)
- Safari (v14.1+ on macOS/iOS)
- Firefox (v49+ with experimental flag)

The component gracefully handles browsers without Web Speech API support by:
1. Logging a warning
2. Still providing the manual text input functionality
3. Disabling the speech recognition buttons

## Styling

Speech-specific styles are defined in `/app/harmoneasy/source/assets/style/prompt-ai.scss`:

- `.speech-controls`: Container for speech input controls
- `.speech-btn`: Speech control buttons
- `.listening-indicator`: Visual feedback when listening (with pulse animation)
- `.transcript-preview`: Shows interim and final recognized text

## Integration

The component is registered in:
- `input-types.ts`: Defines `PROMPT_AI_SPEECH` type constant
- `input-factory.ts`: Creates instances and checks availability
- `input-definitions.ts`: Provides metadata for UI display

## Error Handling

The component handles:
- Missing Web Speech API support
- API errors from OpenAI
- Speech recognition errors
- Network failures

All errors are displayed in the status message area with appropriate styling.

## Future Enhancements

Potential improvements:
- Support for multiple languages with language switching UI
- Confidence score display for recognized words
- Audio level visualization during listening
- Custom wake words or commands
- Voice command shortcuts
