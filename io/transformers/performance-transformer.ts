import { Transformer } from './abstract-transformer.ts'
import type { FieldConfig } from './interface-transformer.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import type { ITimerControl as Timer } from 'netronome'
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE } from '../../commands'
import { cloneAudioCommand } from '../../audio-command-factory.ts'

export type Settings = Record<string, string | number | boolean>
export interface Control {
    name: string
    label: string
    values?: FieldConfig['values']
    help?: string
    min?: number
    max?: number
}
export interface Voice {
    input: IAudioCommand
    targets: IAudioCommand[]
    released: boolean
}
interface Task { at: number; run: () => IAudioCommand[]; voice?: Voice; input?: boolean; route?: string }

export const numbers = (min: number, max: number, step = 1) =>
    Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step)
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export const noteKey = (command: IAudioCommand) => `${command.from ?? ''}:${command.channel ?? 1}:${command.number}`
export const routeKey = (command: IAudioCommand) => `${command.from ?? ''}:${command.channel ?? 1}`
export const isNoteOn = (command: IAudioCommand) => command.type === NOTE_ON && command.velocity > 0
export const isNoteOff = (command: IAudioCommand) => command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity === 0)
type MusicalClock = Timer & { now?: number; bpm?: number; BPM?: number }
export function beatSeconds(timer?: Timer): number {
    const clock = timer as MusicalClock | undefined
    const bpm = Number(clock?.bpm ?? clock?.BPM)
    return 60 / (bpm > 0 ? bpm : 120)
}
export function copyCommand(command: IAudioCommand, changes: Partial<IAudioCommand> = {}): IAudioCommand {
    const copy = Object.assign(cloneAudioCommand(command), changes)
    // Generated messages must not retain a different message's native encoding.
    copy.raw = new Uint8Array()
    delete copy.ump
    delete copy.umpOriginal
    return copy
}

/** Clock-driven effects keep future work here, so releases and transport resets can cancel it. */
export abstract class PerformanceTransformer extends Transformer<Settings> {
    readonly handlesMidiControls = true
    private tasks: Task[] = []
    private inputs = new Map<string, Voice[]>()
    private sounding = new Map<string, IAudioCommand>()
    private cleanup: IAudioCommand[] = []
    protected voices = new Set<Voice>()
    protected now = 0
    protected timer?: Timer
    private destroyed = false

    constructor(private defaults: Settings, private controls: Control[], config: Settings = {}) {
        super({ enabled: true, ...defaults, ...config })
        this.setConfig('enabled', this.config.enabled)
        for (const key of Object.keys(defaults)) this.setConfig(key, this.config[key])
    }

    get fields(): FieldConfig[] {
        return [{ name: 'enabled', label: 'Enabled', values: [{ name: 'On', value: 1 }, { name: 'Off', value: 0 }] },
            ...(this.controls ?? [])].map(control => {
            const value = this.config?.[control.name] ?? this.defaults?.[control.name] ?? 1
            return { name: control.name, label: control.label, group: 'Performance', help: control.help,
                type: control.values ? 'select' : 'text', enabled: true, values: control.values ?? [],
                default: typeof value === 'boolean' ? Number(value) : value }
        })
    }

    override setConfig(key: string, value: unknown): void {
        if (key === 'enabled' || typeof this.defaults?.[key] === 'number') {
            const number = Number(value)
            const control = this.controls?.find(control => control.name === key)
            value = clamp(Number.isFinite(number) ? number : Number(this.defaults?.[key] ?? 1),
                control?.min ?? (key === 'enabled' ? 0 : -Infinity), control?.max ?? (key === 'enabled' ? 1 : Infinity))
            if (key === 'enabled') value = Boolean(value)
        } else if (this.defaults && key in this.defaults) {
            value = String(value)
            const choices = this.controls?.find(control => control.name === key)?.values
            if (choices && !choices.some(choice => String(typeof choice === 'object' ? choice.value : choice) === value)) value = this.defaults[key]
        }
        if (key === 'enabled' && this.config?.enabled && !value && this.sounding) {
            this.cleanup.push(...this.releaseAll(this.now))
            this.tasks = this.tasks.filter(task => task.input)
            this.clearState()
        }
        super.setConfig(key, value)
    }

    transform(commands: IAudioCommand[], timer?: Timer): IAudioCommand[] {
        if (this.destroyed) return commands
        this.timer = timer
        const clockNow = (timer as MusicalClock | undefined)?.now
        const now = Number.isFinite(clockNow) ? clockNow! : Math.max(this.now, ...commands.map(command => command.startAt ?? command.time ?? 0))
        for (const command of commands) {
            const at = Number.isFinite(command.startAt) ? command.startAt : now
            this.tasks.push({ at, input: true, run: () => this.receive(command) })
        }
        return this.tick(now, timer)
    }

    tick(now: number, timer?: Timer): IAudioCommand[] {
        if (this.destroyed) return []
        this.timer = timer
        const result = this.cleanup.splice(0).map(command => ({ ...command, startAt: now }))
        // A stalled tab must not expand an unbounded backlog of generated events.
        let budget = 2048
        this.tasks.sort((a, b) => a.at - b.at)
        while (this.tasks.length && this.tasks[0].at <= now && budget-- > 0) {
            const task = this.tasks.shift()!
            this.now = task.at
            const commands = task.run()
            result.push(...commands)
            this.observe(commands)
            this.tasks.sort((a, b) => a.at - b.at)
        }
        this.now = now
        return result
    }

    private observe(commands: IAudioCommand[]): void {
        for (const command of commands) {
            if (isNoteOn(command)) this.sounding.set(noteKey(command), command)
            else if (isNoteOff(command)) this.sounding.delete(noteKey(command))
        }
    }

    private receive(command: IAudioCommand): IAudioCommand[] {
        if (command.type === CONTROL_CHANGE && [120, 123].includes(command.number)) {
            const route = routeKey(command)
            const result = [...this.voices].filter(voice => routeKey(voice.input) === route).flatMap(voice => this.release(voice))
            this.tasks = this.tasks.filter(task => task.input || task.route !== route)
            result.push(...this.clearRoute(route))
            return [...result, command]
        }
        if (isNoteOff(command)) {
            const key = noteKey(command)
            const queue = this.inputs.get(key)
            const voice = queue?.shift()
            if (!queue?.length) this.inputs.delete(key)
            if (voice) {
                voice.released = true
                return this.noteOff(voice, command)
            }
            return [command]
        }
        if (!this.config.enabled) return [command]
        if (!isNoteOn(command)) return this.other(command)
        const voice: Voice = { input: command, targets: [], released: false }
        const key = noteKey(command)
        const queue = this.inputs.get(key) ?? []
        queue.push(voice)
        this.inputs.set(key, queue)
        this.voices.add(voice)
        return this.noteOn(voice)
    }

    protected abstract noteOn(voice: Voice): IAudioCommand[]
    protected other(command: IAudioCommand): IAudioCommand[] { return [command] }
    protected noteOff(voice: Voice, command: IAudioCommand): IAudioCommand[] { return this.release(voice, command.startAt) }
    protected clearState(): void {}
    protected clearRoute(_route: string): IAudioCommand[] { return [] }
    protected stopControllers(): IAudioCommand[] { return [] }

    protected schedule(at: number, run: Task['run'], voice?: Voice, route?: string): void {
        this.tasks.push({ at, run, voice, route })
    }
    protected start(voice: Voice, pitch = voice.input.number, at = this.now, velocity = voice.input.velocity): IAudioCommand {
        const command = copyCommand(voice.input, { type: NOTE_ON, subtype: NOTE_ON, number: clamp(Math.round(pitch), 0, 127),
            velocity: clamp(Math.round(velocity), 1, 127), startAt: at })
        voice.targets.push(command)
        return command
    }
    protected end(voice: Voice, target: IAudioCommand, at = this.now): IAudioCommand {
        voice.targets = voice.targets.filter(command => command !== target)
        return copyCommand(target, { type: NOTE_OFF, subtype: NOTE_OFF, velocity: 0, startAt: at })
    }
    protected release(voice: Voice, at = this.now): IAudioCommand[] {
        voice.released = true
        this.tasks = this.tasks.filter(task => task.voice !== voice)
        this.voices.delete(voice)
        return [...voice.targets].map(target => {
            if (target.type !== CONTROL_CHANGE) return this.end(voice, target, at)
            voice.targets = voice.targets.filter(command => command !== target)
            return copyCommand(target, { value: 0, startAt: at })
        })
    }
    protected releaseAll(at: number): IAudioCommand[] {
        const result = [...this.sounding.values()].map(command => copyCommand(command, { type: NOTE_OFF, subtype: NOTE_OFF, velocity: 0, startAt: at }))
        result.push(...this.stopControllers())
        for (const voice of this.voices) {
            result.push(...voice.targets.filter(command => command.type === CONTROL_CHANGE).map(command => copyCommand(command, { value: 0, startAt: at })))
            voice.targets = []
        }
        this.voices.clear()
        this.sounding.clear()
        return result
    }
    override reset(): void {
        this.tasks = []
        this.inputs.clear()
        this.voices.clear()
        this.sounding.clear()
        this.cleanup = []
        this.now = 0
        this.clearState()
    }
    override destroy(): void { this.reset(); this.destroyed = true }
}
