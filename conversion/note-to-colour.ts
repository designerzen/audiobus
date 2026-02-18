/**
 * Pass in a MIDI noteNumber 0-127
 * and return a corresponding colour
 * that is one of 12 in different levels
 * of saturation
 */
const colourMap = new Map()
export const convertNoteNumberToColour = (noteNumber:number, quantityOfNotes:number=12, velocity:number=1) => {
	// return 'hsl(0deg 50% 50%)'
	
	if (colourMap.has(noteNumber)){ 
		return colourMap.get(noteNumber)
	}

	const saturation:number=80 * velocity
	const luminance:number=40 

	// const colour = "rgb("+360*((noteNumber % quantityOfNotes)% quantityOfNotes)/quantityOfNotes+","+saturation+","+luminance+")"
	// const colour = "oklch("+luminance/100+","+saturation/100+", "+(360*((noteNumber % quantityOfNotes)% quantityOfNotes)/quantityOfNotes)+")"
	const colour = "hsl("+360*((noteNumber % quantityOfNotes)% quantityOfNotes)/quantityOfNotes+"deg,"+saturation+"%,"+luminance+"%)"
	colourMap.set(noteNumber,colour)
	return colour
}
