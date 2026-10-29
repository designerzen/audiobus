import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision"
import { EVENT_MESSAGE } from "../../event-constants"

let detector: HandLandmarker | undefined
self.addEventListener(EVENT_MESSAGE, async (event: MessageEvent) => {
	const { type, bitmap, timestamp } = event.data
	try {
		if (type === "init") {
			const files = await FilesetResolver.forVisionTasks(
				"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm"
			)
			detector = await HandLandmarker.createFromOptions(files, {
				baseOptions: {
					modelAssetPath:
						"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
				},
				runningMode: "VIDEO",
				numHands: 1
			})
			self.postMessage({ type: "ready" })
		} else if (type === "frame" && detector) {
			const result = detector.detectForVideo(bitmap, timestamp)
			self.postMessage({ type: "landmarks", landmarks: result.landmarks[0] ?? [] })
		}
	} catch (error) {
		self.postMessage({
			type: "error",
			message: error instanceof Error ? error.message : String(error)
		})
	} finally {
		bitmap?.close()
	}
})