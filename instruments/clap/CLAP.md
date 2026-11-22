# WebCLAP hosting requirements

The WebCLAP host uses browser-compatible WASM bundles and AudioWorklet nodes. Serve `<base>webclap/clap-audionode.mjs`, its runtime dependencies, and the selected plugin bundle from URLs the browser can fetch. Cross-origin plugin hosting needs suitable server access policies. Shared-memory plugins can additionally need cross-origin isolation.

The [runtime adapter](clap-host.ts) creates nodes with one input, one stereo output and a selected plugin factory. The [catalogue](clap-catalog.ts) identifies shipped variants. Additional metadata can come from `<base>clap-registry.json` or `clapRegistry.addRegistry(url)`. See [patch types](clap-types.ts); native CLAP files and arbitrary WASM binaries are not interchangeable with supported bundles.

The former claim that WebAssembly support alone is sufficient was incomplete. Enable audio from a user action and check the app's requirements/connection errors. Plugin UI resources are served through [clap-ui.ts](clap-ui.ts); effects also require a [registered mixer](clap-mixer.ts). See [instrument usage](README.md) for routing and cleanup.
