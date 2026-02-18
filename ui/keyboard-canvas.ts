import AbstractInteractive from "./abstract-interactive.ts"

interface KeyInfo {
  key: any
  x: number
  y: number
  width: number
  height: number
  isBlack: boolean
  path2D: Path2D
  noteNumber: number
}

/**
 * Canvas-based keyboard implementation using Path2D drawing API
 * Identical functionality to SVGKeyboard but rendered on canvas
 */
export default class CanvasKeyboard extends AbstractInteractive {
  static uniqueID = 0

  isTouching = false
  keyElements: KeyInfo[] = []

  htmlElement: HTMLDivElement
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  titleElement: HTMLHeadingElement

  firstNoteNumber = 0
  notes: any[] = []
  keyMap = new Map<number, KeyInfo>()

  // Dimensions
  canvasWidth = 0
  canvasHeight = 0

  // Style constants
  readonly curvedRadius = 6
  readonly blackKeyWidth = 13
  readonly whiteKeyWidth = 23
  readonly indicatorWidth = 8
  readonly blackKeyScale = 0.5
  readonly whiteKeyHeight = 140

  // Colors
  readonly whiteKeyColor = "#ffffff"
  readonly whiteKeyBorderColor = "#000000"
  readonly whiteKeyActiveColor = "#e0e0e0"
  readonly blackKeyColor = "#000000"
  readonly blackKeyBorderColor = "#1a1a1a"
  readonly blackKeyActiveColor = "#333333"
  readonly indicatorColor = "#cccccc"
  readonly indicatorActiveColor = "#ff6b6b"

  constructor(notes: any[], noteOn: Function, noteOff: Function) {
    super()

    const unique = `keyboard-${CanvasKeyboard.uniqueID++}`
    this.titleID = `${unique}-title`
    this.descriptionID = `${unique}-desc`

    // Create container div
    this.htmlElement = document.createElement("div")
    this.htmlElement.className = "piano"
    this.htmlElement.setAttribute("data-piano", "true")

    // Create title
    this.titleElement = document.createElement("h6")
    this.titleElement.id = this.titleID
    this.titleElement.textContent = "Piano Keyboard with " + notes.length + " keys"

    // Create canvas
    this.canvas = document.createElement("canvas")
    this.canvas.className = "piano-keys"
    this.canvas.setAttribute("role", "application")

    const ctx = this.canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get canvas context")
    this.ctx = ctx

    this.htmlElement.appendChild(this.titleElement)
    this.htmlElement.appendChild(this.canvas)

    // Create keyboard
    const { keyElements } = this.createKeyboard(notes)
    this.keyElements = keyElements

    this.firstNoteNumber = notes[0].noteNumber

    // Build key map
    keyElements.forEach((keyInfo) => {
      this.keyMap.set(keyInfo.noteNumber, keyInfo)
    })

    // Draw initial keyboard
    this.draw()

    // Add interactivity
    this.addCanvasInteractivity(keyElements, noteOn, noteOff)
  }

  get asElement(): HTMLElement {
    return this.htmlElement
  }

  set title(value: string) {
    this.titleElement.textContent = value
  }

  getNoteFromKey(button: KeyInfo): any {
    const noteNumber = button.noteNumber
    const note = this.notes[noteNumber - this.firstNoteNumber]
    return note
  }

  /**
   * Create a rounded rectangle path
   */
  createRoundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): Path2D {
    const path = new Path2D()
    path.moveTo(x + radius, y)
    path.lineTo(x + width - radius, y)
    path.quadraticCurveTo(x + width, y, x + width, y + radius)
    path.lineTo(x + width, y + height - radius)
    path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    path.lineTo(x + radius, y + height)
    path.quadraticCurveTo(x, y + height, x, y + height - radius)
    path.lineTo(x, y + radius)
    path.quadraticCurveTo(x, y, x + radius, y)
    path.closePath()
    return path
  }

  /**
   * Create keyboard layout and key information
   */
  createKeyboard(
    keys: any[],
    blackKeyWidth = 13,
    whiteKeyWidth = 23,
    indicatorWidth = 8,
    blackKeyScale = 0.5,
    whiteKeyHeight = 140,
    startX = 0,
    startY = 20
  ): { keyElements: KeyInfo[] } {
    const halfBlackKeyWidth = blackKeyWidth / 2
    const blackKeyHeight = whiteKeyHeight * blackKeyScale

    let x = startX
    let y = startY
    let totalWidth = 0

    const keyElements: KeyInfo[] = []

    keys.forEach((key) => {
      const isBlack = key.accidental ?? false

      // Move back for black keys
      x -= isBlack ? halfBlackKeyWidth : 0

      // Determine dimensions
      const width = isBlack ? blackKeyWidth : whiteKeyWidth
      const height = isBlack ? blackKeyHeight : whiteKeyHeight

      // Create Path2D for this key
      const path2D = this.createRoundedRect(x, y, width, height, this.curvedRadius)

      const keyInfo: KeyInfo = {
        key,
        x,
        y,
        width,
        height,
        isBlack,
        path2D,
        noteNumber: key.noteNumber,
      }

      keyElements.push(keyInfo)

      this.notes.push(key)

      x += isBlack ? halfBlackKeyWidth : whiteKeyWidth
      totalWidth += isBlack ? 0 : whiteKeyWidth
    })

    this.canvasWidth = totalWidth
    this.canvasHeight = whiteKeyHeight + startY

    // Set canvas size
    this.canvas.width = this.canvasWidth
    this.canvas.height = this.canvasHeight

    return { keyElements }
  }

  /**
   * Draw the entire keyboard
   */
  draw(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

    // Draw white keys first (background)
    this.keyElements.forEach((keyInfo) => {
      if (!keyInfo.isBlack) {
        this.drawKey(keyInfo)
      }
    })

    // Draw black keys on top
    this.keyElements.forEach((keyInfo) => {
      if (keyInfo.isBlack) {
        this.drawKey(keyInfo)
      }
    })

    // Draw indicators
    this.drawIndicators()
  }

  /**
   * Draw a single key
   */
  drawKey(keyInfo: KeyInfo): void {
    const isActive = this.keyMap.get(keyInfo.noteNumber)?.isActive ?? false

    if (keyInfo.isBlack) {
      this.ctx.fillStyle = isActive ? this.blackKeyActiveColor : this.blackKeyColor
      this.ctx.strokeStyle = this.blackKeyBorderColor
    } else {
      this.ctx.fillStyle = isActive ? this.whiteKeyActiveColor : this.whiteKeyColor
      this.ctx.strokeStyle = this.whiteKeyBorderColor
    }

    this.ctx.lineWidth = 1
    this.ctx.fill(keyInfo.path2D)
    this.ctx.stroke(keyInfo.path2D)

    // Draw key label
    if (!keyInfo.isBlack) {
      this.ctx.fillStyle = "#000000"
      this.ctx.font = "12px Arial"
      this.ctx.textAlign = "center"
      this.ctx.textBaseline = "bottom"
      this.ctx.fillText(
        keyInfo.key.noteName,
        keyInfo.x + keyInfo.width / 2,
        keyInfo.y + keyInfo.height - 5
      )
    }
  }

  /**
   * Draw indicator circles
   */
  drawIndicators(): void {
    const indicatorRadius = this.indicatorWidth / 2
    const spaceBetweenIndicators = this.whiteKeyWidth - this.indicatorWidth

    let x = spaceBetweenIndicators / 2
    const y = 10

    this.keyElements.forEach((keyInfo) => {
      const isActive = this.keyMap.get(keyInfo.noteNumber)?.isActive ?? false

      this.ctx.fillStyle = isActive
        ? this.indicatorActiveColor
        : this.indicatorColor

      this.ctx.beginPath()
      this.ctx.arc(x, y, indicatorRadius, 0, Math.PI * 2)
      this.ctx.fill()

      x += spaceBetweenIndicators
    })
  }

  /**
   * Get key at canvas coordinates
   */
  getKeyAtPoint(x: number, y: number): KeyInfo | null {
    for (const keyInfo of this.keyElements) {
      if (this.ctx.isPointInPath(keyInfo.path2D, x, y)) {
        return keyInfo
      }
    }
    return null
  }

  /**
   * Add canvas-based interactivity
   */
  addCanvasInteractivity(
    keyElements: KeyInfo[],
    noteOn: Function,
    noteOff: Function
  ): void {
    const activeKeys = new Map<number, KeyInfo>()
    const activeNotes = new Map<number, any>()
    let mouseDown = false

    const getCanvasCoords = (event: MouseEvent | TouchEvent) => {
      const rect = this.canvas.getBoundingClientRect()
      if (event instanceof MouseEvent) {
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
      } else {
        const touch = event.touches[0]
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
      }
    }

    const handleKeyDown = (keyInfo: KeyInfo, pointerId: number) => {
      const note = this.getNoteFromKey(keyInfo)
      const pressure = 1

      noteOn(note, pressure, pointerId)
      activeNotes.set(pointerId, note)
      activeKeys.set(pointerId, keyInfo)

      // Mark as active
      keyInfo.isActive = true
      this.draw()
    }

    const handleKeyUp = (pointerId: number) => {
      const note = activeNotes.get(pointerId)
      const keyInfo = activeKeys.get(pointerId)

      if (note) {
        noteOff(note, 1, pointerId)
      }

      if (keyInfo) {
        keyInfo.isActive = false
      }

      activeNotes.delete(pointerId)
      activeKeys.delete(pointerId)

      this.draw()
    }

    this.canvas.addEventListener("pointerdown", (event: PointerEvent) => {
      const { x, y } = getCanvasCoords(event)
      const keyInfo = this.getKeyAtPoint(x, y)

      if (keyInfo && !activeKeys.has(event.pointerId)) {
        mouseDown = true
        handleKeyDown(keyInfo, event.pointerId)
      }
    })

    this.canvas.addEventListener("pointermove", (event: PointerEvent) => {
      if (mouseDown && event.pointerType === "mouse") {
        const { x, y } = getCanvasCoords(event)
        const keyInfo = this.getKeyAtPoint(x, y)

        if (keyInfo) {
          const currentKeyInfo = activeKeys.get(event.pointerId)

          // If moving to different key
          if (currentKeyInfo && currentKeyInfo !== keyInfo) {
            handleKeyUp(event.pointerId)
            handleKeyDown(keyInfo, event.pointerId)
          } else if (!currentKeyInfo) {
            handleKeyDown(keyInfo, event.pointerId)
          }
        }
      }
    })

    this.canvas.addEventListener("pointerup", (event: PointerEvent) => {
      mouseDown = false
      handleKeyUp(event.pointerId)
    })

    this.canvas.addEventListener("pointerleave", (event: PointerEvent) => {
      handleKeyUp(event.pointerId)
    })

    // Support keyboard interaction
    this.canvas.setAttribute("role", "button")
    this.canvas.setAttribute("tabindex", "0")
  }

  /**
   * Set a key as active (playing)
   */
  setKeyAsActive(noteNumber:number): void {
    const keyInfo = this.keyMap.get(noteNumber)

    if (keyInfo) {
      keyInfo.isActive = true
      this.draw()
    }
  }

  /**
   * Set a key as inactive (not playing)
   */
  setKeyAsInactive(noteNumber:number): void {
    const keyInfo = this.keyMap.get(noteNumber)

    if (keyInfo) {
      keyInfo.isActive = false
      this.draw()
    }
  }

  // Helper properties for compatibility
  private titleID: string
  private descriptionID: string
}
