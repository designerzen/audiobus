import { CommandRegistry } from "audiobus-protocol"

export {
	CommandRegistry,
	EMPTY_SCHEMA,
	ProtocolError,
	Peer,
	windowTransport,
	TOPIC_COMMANDS_CHANGED,
	TOPIC_PROPERTIES_CHANGED,
	TOPIC_PROPERTIES_LIST_CHANGED,
	TOPIC_BUNDLES_CHANGED,
	TOPIC_TRANSPORT_CHANGED
} from "audiobus-protocol"
export type {
	CommandDescriptor,
	Json,
	Params,
	Parameter,
	PropertyDescriptor,
	CapabilityBundle
} from "audiobus-protocol"

let registry = new CommandRegistry()

/** Applications register services here; inputs and the palette share the same handlers. */
export function getProtocolRegistry(): CommandRegistry {
	return registry
}

/** Set before creating inputs or palettes; existing peers retain their registry. */
export function setProtocolRegistry(commands: CommandRegistry): void {
	registry = commands
}