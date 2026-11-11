import type IOChain from "./IO-chain"
import { TransformerEnsemble } from "./transformers/transformer-ensemble"
import InputChannelTrigger from "./inputs/input-channel-trigger"
import { CHANNEL_TRIGGER } from "./inputs/input-types"
import { defineDevice, deviceId } from "./device-definition"
import {
	EVENT_ABORT,
	EVENT_TRANSFORMERS_UPDATED,
	EVENT_CONFIGURATION_CHANGED
} from "../event-constants"
import { configurationUpdate } from "./configuration-events"
import type { SurfaceState } from "control-surface/types"

export const ENSEMBLE_KEYS = "asdfghjklqwertyui".split("")

/** Installed after endpoints are restored, so saved generated inputs are reused. */
export function installEnsembleControls(chain: IOChain, signal: AbortSignal): void {
	const subscriptions = new Map<TransformerEnsemble, () => void>()
	let syncing = false
	const remove = (ensembleId: string) => {
		for (const input of chain.inputs) {
			if (input instanceof InputChannelTrigger && input.options.ensembleId === ensembleId) {
				chain.removeInput(input)
			}
		}
		const id = `ensemble-${ensembleId}`
		const surfaces = chain.options.controlSurfaces ?? []
		if (surfaces.some((surface) => surface.id === id)) {
			chain.setGraphOptions({
				controlSurfaces: surfaces.filter((surface) => surface.id !== id),
				...(chain.options.mainSurfaceId === id ? { mainSurfaceId: undefined } : {})
			})
		}
	}
	const sync = (ensemble: TransformerEnsemble) => {
		if (syncing || signal.aborted || chain.isDestroyed) {
			return
		}
		syncing = true
		try {
			const mode = ensemble.options.autoInputs
			if (mode === "off") {
				remove(ensemble.midiControlId)
				return
			}
			const parts = ensemble.automaticParts
			if (!parts) {
				return
			} // Keep playable controls while a replacement loads or fails.
			const existing = chain.inputs.filter(
				(input): input is InputChannelTrigger =>
					input instanceof InputChannelTrigger &&
					input.options.ensembleId === ensemble.midiControlId
			)
			for (const input of existing) {
				if (!parts.some((part) => part.channel === input.options.songChannel)) {
					chain.removeInput(input)
				}
			}
			const inputs = parts.map((part, index) => {
				const options = {
					ensembleId: ensemble.midiControlId,
					songChannel: part.channel,
					label: part.label,
					key: mode === "keyboard" ? ENSEMBLE_KEYS[index] : "",
					gamepadIndex: mode === "gamepads" ? index : -1
				}
				let input = existing.find((input) => input.options.songChannel === part.channel)
				if (input) {
					if (
						Object.entries(options).some(
							([key, value]) => input!.options[key] !== value
						)
					) {
						input.configure(options)
					}
				} else {
					input = defineDevice(
						new InputChannelTrigger({ ...options, now: () => chain.timer.now }),
						{ factory: "input", type: CHANNEL_TRIGGER, options }
					)
					chain.addInput(input)
				}
				return input
			})
			const players = inputs.map((input) => ({
				source: `input:${deviceId(input)}`,
				channels: [input.options.songChannel as number]
			}))
			if (JSON.stringify(players) !== JSON.stringify(ensemble.options.players)) {
				ensemble.setConfig("players", players)
			}
			const id = `ensemble-${ensemble.midiControlId}`
			const surfaces = chain.options.controlSurfaces ?? []
			const current = surfaces.find((surface) => surface.id === id)
			const previous = new Map(current?.widgets.map((widget) => [widget.key, widget]))
			const songControls = ["uploadSong", "midiFileUrl", "autoInputs", "assist", "mode"]
			const songComponentId = `transformer:${ensemble.midiControlId}`
			const surface: SurfaceState = {
				...current,
				id,
				name: current?.name ?? "Play song channels",
				theme: current?.theme ?? "neon",
				connections: [
					...inputs.map((input) => ({
						componentId: deviceId(input),
						controlIds: ["trigger"]
					})),
					{ componentId: songComponentId, controlIds: songControls }
				],
				widgets: [
					...inputs.map((input) => {
						const key = JSON.stringify([deviceId(input), "trigger"])
						return {
							...previous.get(key),
							key,
							widget: "pad" as const,
							trigger:
								mode === "keyboard"
									? { key: input.options.key as string }
									: undefined
						}
					}),
					...songControls.map((control) => ({
						key: JSON.stringify([songComponentId, control])
					}))
				]
			}
			if (JSON.stringify(surface) !== JSON.stringify(current)) {
				chain.setGraphOptions({
					controlSurfaces: [...surfaces.filter((item) => item.id !== id), surface],
					mainSurfaceId: chain.options.mainSurfaceId ?? id
				})
			}
		} finally {
			syncing = false
		}
	}
	const refresh = () => {
		const ensembles = chain.transformers.filter(
			(transformer): transformer is TransformerEnsemble =>
				transformer instanceof TransformerEnsemble
		)
		for (const [ensemble, unsubscribe] of subscriptions) {
			if (!ensembles.includes(ensemble)) {
				unsubscribe()
				subscriptions.delete(ensemble)
				remove(ensemble.midiControlId)
			}
		}
		for (const ensemble of ensembles) {
			if (!subscriptions.has(ensemble)) {
				subscriptions.set(
					ensemble,
					ensemble.subscribeControls(() => {
						sync(ensemble)
						chain.dispatchEvent(configurationUpdate(EVENT_CONFIGURATION_CHANGED))
					})
				)
			}
			sync(ensemble)
		}
	}
	chain.addEventListener(EVENT_TRANSFORMERS_UPDATED, refresh, { signal })
	signal.addEventListener(
		EVENT_ABORT,
		() => {
			for (const unsubscribe of subscriptions.values()) {
				unsubscribe()
			}
			subscriptions.clear()
		},
		{ once: true }
	)
	refresh()
}