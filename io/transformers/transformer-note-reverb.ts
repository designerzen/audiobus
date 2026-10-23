import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { ITimerControl as Timer } from "netronome"
import { NOTE_ON, NOTE_OFF } from "../../commands"
import { Transformer } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"

export const ID_NOTE_REVERB = "Note-Reverb"

interface Config {
    enabled: boolean
    repeats: number
    delay: number
    decay: number
}

const DEFAULT_OPTIONS: Config = { enabled: true, repeats: 4, delay: 125, decay: 0.6 }

export class TransformerNoteReverb extends Transformer<Config> {
    protected type = ID_NOTE_REVERB
    category = TRANSFORMER_CATEGORY_TIMING

    get name(): string { return 'Note Reverb' }
    get description(): string { return 'Repeats notes at intervals with progressively lower velocities' }

    get fields() {
        return [
            { name: 'enabled', type: 'select', values: [{ name: 'On', value: 1 }, { name: 'Off', value: 0 }], default: 1 },
            { name: 'repeats', label: 'Echoes', type: 'select', values: [1, 2, 3, 4, 8, 16], default: DEFAULT_OPTIONS.repeats },
            { name: 'delay', label: 'Interval', type: 'select', values: [62.5, 125, 250, 500, 750, 1000].map(value => ({ name: `${value}ms`, value })), default: DEFAULT_OPTIONS.delay },
            { name: 'decay', label: 'Velocity retained per echo', type: 'select', values: [0.25, 0.4, 0.5, 0.6, 0.75, 0.9].map(value => ({ name: `${value * 100}%`, value })), default: DEFAULT_OPTIONS.decay }
        ]
    }

    constructor(config: Partial<Config> = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })
        for (const key of ['enabled', 'repeats', 'delay', 'decay'] as const) {
            this.setConfig(key, this.config[key])
        }
    }

    setConfig(key: string, value: unknown): void {
        if (key === 'enabled') {
            super.setConfig(key, Boolean(Number(value)))
        } else if (key === 'repeats' || key === 'delay' || key === 'decay') {
            const numeric = Number(value)
            if (!Number.isFinite(numeric)) return
            const parsed = key === 'repeats' ? Math.max(0, Math.min(16, Math.floor(numeric)))
                : key === 'delay' ? Math.max(1, numeric) : Math.max(0.01, Math.min(0.99, numeric))
            super.setConfig(key, parsed)
        } else {
            super.setConfig(key, value)
        }
    }

    transform(commands: IAudioCommand[], _timer: Timer): IAudioCommand[] {
        if (!this.config.enabled || commands.length === 0) return commands

        return commands.flatMap(command => {
            if (command.type !== NOTE_ON && command.type !== NOTE_OFF) return [command]

            const result = [command]
            for (let echo = 1; echo <= this.config.repeats; echo++) {
                const offset = echo * this.config.delay / 1000
                result.push({
                    ...command,
                    startAt: (command.startAt ?? command.time ?? 0) + offset,
                    endAt: command.endAt > 0 ? command.endAt + offset : command.endAt,
                    velocity: command.type === NOTE_ON && command.velocity > 0
                        ? Math.max(1, Math.floor(command.velocity * this.config.decay ** echo))
                        : command.velocity
                })
            }
            return result
        })
    }
}
