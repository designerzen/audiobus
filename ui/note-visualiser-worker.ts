// @ts-nocheck
const VISUALISER_OPTIONS = {
    backgroundColour:"#fff",
    lineColour:"#000",
    lineWidth:3
}

let notes
let firstNoteNumber

let loop = false
let verticalDirection = true
let notesOn = new Map()
let wave = 0

let clearBackground = true

let lastNoteColour

// Canvases
let canvas
let context
let mirror
let mirrorContext

// size of the inital note that is smeared
let noteSize
const noteDepth = 10

const overlap = 1

// size to overlap smear
const gap = noteDepth - overlap

// timer & frame lock
let counter = 0
let lastRenderTime = 0

/**
 * SCROLL / Smear horizontally
 * @param {Number} time 
 */
function renderVertical(time) {
    const lurch = wave === 0 ? 
        0 : 
        this.wave * (Math.sin(this.counter++ * 0.05))

    // copy the canvas to the mirror
    mirrorContext.drawImage( canvas, 0, 0, mirror.width, mirror.height, 0, 0, mirror.width, mirror.height ) 
    // clear the mirror completely except for the drawn notes
    // context.clearRect( 0, gap, canvas.width, canvas.height )
    // redraw the context from the mirror
    // context.drawImage( mirror, 0, 0, mirror.width, mirror.height, lurch, gap, mirror.width, mirror.height )
}

/**
 * SCROLL / Smear horizontally
 * @param {Number} time 
 */
// function renderHorizontal(time) {
//     const lurch = 0

//     // copy the canvas to the mirror
//     mirrorContext.drawImage( canvas, 0, 0, mirror.width, mirror.height, 0, 0, mirror.width, mirror.height ) 
//     context.drawImage( mirror, 0, 0, mirror.width, mirror.height, gap, lurch, mirror.width, mirror.height )
    
//     // clear the mirror completely beyond the drawn notes
//     // context.clearRect( gap, 0, canvas.width, canvas.height )
//     // redraw the context from the mirror

//     // context.drawImage( canvas, 0, gap, canvas.width, canvas.height-gap, lurch, 0, canvas.width, canvas.height-gap )
//     // console.info("renderHorizontal",0, 0, mirror.width, mirror.height, 0, 0, mirror.width, mirror.height )
//     // console.info("renderHorizontal", mirror.width, mirror.height, canvas.width, canvas.height )
// }

function renderHorizontal(time) {
    const lurch = 0

    if (!clearBackground)
    {
        // Clear the region on the mirror where new content will be drawn
        mirrorContext.clearRect(gap, lurch, mirror.width, mirror.height)

        // // Copy the canvas to the mirror
        mirrorContext.drawImage(canvas, 0, 0, mirror.width, mirror.height, 0, 0, mirror.width, mirror.height)

        // // Draw the mirror back onto the canvas
        context.drawImage(mirror, 0, 0, mirror.width, mirror.height, gap, lurch, mirror.width, mirror.height)
    
    }else{

        // FXME: the above is far more efficient but doesnt work with transparency
        // 1. Clear the main canvas to transparent
        context.clearRect(0, 0, canvas.width, canvas.height)

        // 2. Draw the mirror back onto the canvas with the offset (smear)
        context.drawImage(mirror, 0, 0, mirror.width, mirror.height, gap, lurch, mirror.width, mirror.height)

        // 3. Draw all currently active notes
        for (const [transposedNoteNumber, noteData] of notesOn.entries()) {
            context.fillStyle = noteData.colour
            context.fillRect(0, transposedNoteNumber * noteSize, noteDepth, noteSize)
        }

        // 4. Copy the updated canvas back to the mirror
        mirrorContext.clearRect(0, 0, mirror.width, mirror.height)
        mirrorContext.drawImage(canvas, 0, 0, mirror.width, mirror.height, 0, 0, mirror.width, mirror.height)
    }
}

// LOCK TO 60Hz
const throttle = 1000 / 60

function render(time) {
    
    const dt = time - lastRenderTime

    // Accumulate delta time
    // we want to throttle this to only x events every second
    if ( dt < throttle )
    {
        // console.log("throttled", {dt, throttle,time, previousTime} )
    }else{
        
        // Update the previous time
        lastRenderTime = time

        verticalDirection ? 
            renderVertical(dt) : 
            renderHorizontal(dt)

        // console.log("unthrottled", {dt, throttle,time, previousTime} )
    }

    // context.fillStyle = "#ff0000"
    // context.fillRect( 
    //     Math.random() * 400, 
    //     Math.random() * 400, 
    //     Math.random() * 400, 
    //     Math.random() * 400
    
    if (loop) {
        requestAnimationFrame(render)
    }
}

const determineNoteSize = (isVertical) => {
    return isVertical ? 
        Math.floor(canvas.width / notes.length) : 
        Math.floor(canvas.height / notes.length)
}

const determineMirrorSize = (isVertical) => {
    return isVertical ?
        { width:canvas.width, height:canvas.height - gap} :
        { width:canvas.width - gap, height:canvas.height} 
}

const setBlendMode = (blendMode)=> {
    context.globalCompositeOperation = blendMode
}

onmessage = (evt) => {

    // console.error("NOTEVIZ worker message", evt)

    if (evt.data.canvas)
    {
        canvas = evt.data.canvas
        context = canvas.getContext('2d')
    
        notes = evt.data?.notes ?? []
        firstNoteNumber = notes[0].number
        // console.info("firstNoteNumber", firstNoteNumber, notes[0], {notes})

        const mirrorDimensions = determineMirrorSize(verticalDirection)
      
        // clone the canvas..
        mirror = new OffscreenCanvas( mirrorDimensions.width, mirrorDimensions.height )

        mirrorContext = mirror.getContext('2d')

        // setBlendMode()
        // canvas.addEventListener("click", setBlendMode )
        // mirror.addEventListener("click", setBlendMode )
        // setInterval( setBlendMode, 30000 )
    
        noteSize = determineNoteSize(verticalDirection)

        loop = true

        requestAnimationFrame( time => {
            lastRenderTime = time
            render(time) 
        })
      
        // 
        //console.info("mirror created",  context.globalCompositeOperation, CANVAS_BLEND_MODE_DESCRIPTIONS[b] )
        // console.info("mirror created", canvas.width, canvas.height , notes.length, {firstNoteNumber, mirror, canvas, context, mirrorContext, noteSize, notes })
        
        return
    }

    verticalDirection = evt.data.vertical
 
    const transposedNoteNumber = Math.max( firstNoteNumber, evt.data.note - firstNoteNumber )
    // console.info("fillrect", transposedNoteNumber, firstNoteNumber, evt.data.note, firstNoteNumber ) 
    // console.info("note-vis",evt.data.type, evt )
        
    switch (evt.data.type)
    {
        case "noteOn":
            if (!clearBackground)
            {
                context.fillStyle = evt.data.colour
                lastNoteColour = evt.data.colour

                if (verticalDirection)
                {
                    context.fillRect( transposedNoteNumber * noteSize, canvas.height - noteDepth, noteSize, noteDepth )
                }else{
                    context.fillRect( 0, transposedNoteNumber * noteSize, noteDepth, noteSize ) 
                }
            }
            notesOn.set( transposedNoteNumber, evt.data )
            // console.info("VIZ:noteOn", evt.data.note, {firstNoteNumber, transposedNoteNumber}, notes[0], {notes} ) 
            break

        case "noteOff":
            lastNoteColour = VISUALISER_OPTIONS.backgroundColour
          
            if (!clearBackground)
            {
                context.fillStyle = VISUALISER_OPTIONS.backgroundColour //  'rgba(255,255,255,0.2)' //
           
                if (verticalDirection)
                {
                    // context.clearRect( transposedNoteNumber * noteSize, canvas.height - gap, noteSize, gap )
                    context.fillRect( transposedNoteNumber * noteSize, canvas.height - gap, noteSize, gap )
                    // mirrorContext.clearRect( transposedNoteNumber * noteSize, mirror.height - gap, noteSize, gap )
                }else{
                    // context.clearRect( 0, transposedNoteNumber * noteSize, gap, noteSize ) 
                    context.fillRect( 0, transposedNoteNumber * noteSize, gap, noteSize ) 
                    // mirrorContext.clearRect( 0, transposedNoteNumber * noteSize, gap, noteSize )
                }
            }
            
            notesOn.delete( transposedNoteNumber )
            // console.info("VIZ:noteOff", evt.data, transposedNoteNumber )
            break

        case "blendMode":
            setBlendMode(evt.data.blendMode)
            break
    
        case "resize":

            // FIXME: If we are on a 4k screen this may be a huge width
            // so we should have a divison factor to scale the canvas for
            // higher than 2048 then divide the size by 2 and use CSS to scale it
            canvas.widpindeth = evt.data.displayWidth
            canvas.height = evt.data.displayHeight
            
            const mirrorDimensions = determineMirrorSize(verticalDirection)
		mirror.width = mirrorDimensions.width
            mirror.height = mirrorDimensions.height
            
            noteSize = determineNoteSize(verticalDirection)
            
			console.error("CANVAS RESIZE:",{ canvas, noteSize}, evt.data.displayWidth, evt.data.displayHeight, canvas.width, canvas.height )
            break
    }
}
