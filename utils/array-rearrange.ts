/**
 * Convert an array such as
 * 0 1 2 3 4 5 6 7 8 9 10
 * and use a startIndex of 6 would become
 * 5 6 4 7 3 8 2 9 1 10 0
 * 
 * 0 1 2 3 4 5 6 7 8 9 10
 * and use a startIndex of 1 would become
 * 1 2 0 3 4 5 6 7 8 9 10
 * 
 * 0 1 2 3 4 5 6 7 8 9 10
 * and with a startIndex of 7 would become
 * 6 7 5 8 4 9 3 10 2 1 0
 * @param {Array} array 
 * @param {Number} startIndex - if none specified use half way point
 */
export const rearrangeArrayBySnake = (array:number[], startIndex:number) => {
	
	const output = []

	let extent = 0
	let flipper = 1

	if (!startIndex)
	{
		startIndex = Math.floor( array.length / 2 )
	}
	
	for (let i=0, l=array.length; i<l; ++i)
	{	
		const isEven = i%2 === 0
		const index = startIndex + (extent * flipper)
		flipper *= -1
		
		if (isEven)
		{
			extent++
		}

		if (array[index] !== undefined)
		{
			//console.log("add ", i, {index, extent, flipper}, array[index])
			output.push( array[index] )
		}else{
			//console.log("skip", i, {index, extent, flipper}, array[index])
			// add extra loops
			l++
		}
	}
	return output
}

/**
 * 
 * @param array 
 * @param startIndex 
 * @returns 
 */
export const rotateArray = <T>(array:T[], startIndex:number) => {
    startIndex = startIndex % array.length
    return array.slice(startIndex, array.length).concat(array.slice(0, startIndex))
}
