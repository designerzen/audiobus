export function saveScoreToLocalFileSystem(blob: Blob, fileName: string, extension: string): void {
	const url = URL.createObjectURL(blob),
		link = document.createElement("a")
	link.href = url
	link.download = fileName.toLowerCase().endsWith(`.${extension}`)
		? fileName
		: `${fileName}.${extension}`
	document.body.append(link)
	try {
		link.click()
	} finally {
		link.remove()
		URL.revokeObjectURL(url)
	}
}