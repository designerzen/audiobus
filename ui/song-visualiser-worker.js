/**
 * Song Visualiser Worker
 * Handles canvas rendering for song timeline visualization
 */

let canvas = null;
let context = null;

let notesOn = new Map();
let noteBars = [];

let displayWidth = 0;
let displayHeight = 0;

const PADDING = 4;

let options = {
  pixelsPerSecond: 100,
  noteHeight: 8,
  barHeight: 1,
  startNote: 0,
  endNote: 127,
  showLabels: true,
  darkMode: false,
  layoutMode: "timeline",
};

let renderScheduled = false;

/**
 * Draw the complete visualization
 */
function render() {
  if (!context || !canvas) return;

  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  context.fillStyle = options.darkMode ? "#1e1e1e" : "#ffffff";
  context.fillRect(0, 0, width, height);

  // Draw note bars based on layout mode
  if (options.layoutMode === "timeline") {
    drawNoteBarsTimeline(width, height);
  } else {
    drawNoteBarsStacked(width, height);
  }

  // Draw legend
  drawLegend(width, height);

  renderScheduled = false;
}

/**
 * Stacked layout: bars stacked vertically, sorted by start time
 */
function drawNoteBarsStacked(width, height) {
  if (!context || noteBars.length === 0) return;

  // Find time range of actual data
  const minTime = Math.min(...noteBars.map((bar) => bar.startTime), 0);
  const maxEndTime = Math.max(...noteBars.map((bar) => bar.endTime), 1);
  const timeRange = maxEndTime - minTime || 1;

  const MARGIN_LEFT = 50;
  const MARGIN_BOTTOM = 40;

  // Draw background grid
  drawStackedGrid(width, height, minTime, timeRange, MARGIN_LEFT, MARGIN_BOTTOM);

  const barHeight = options.barHeight || 1;
  const outlineePath = new Path2D();

  for (let i = 0; i < noteBars.length; i++) {
    const bar = noteBars[i];
    const duration = bar.endTime - bar.startTime || 0.1;

    // Scale to canvas width based on actual data range
    const x = MARGIN_LEFT + ((bar.startTime - minTime) / timeRange) * (width - MARGIN_LEFT - 10);
    const barWidth = Math.max(2, (duration / timeRange) * (width - MARGIN_LEFT - 10));

    // Stack bars vertically
    const y = i * (barHeight + PADDING) + PADDING;

    // Get colour from note model or use provided colour
    context.fillStyle = bar.colour || getColourForNote(bar.noteNumber);

    // Visual distinction: live notes have different alpha
    if (bar.source === "live") {
      context.globalAlpha = 0.9 + bar.velocity * 0.1;
    } else {
      context.globalAlpha = 0.7 + bar.velocity * 0.3;
    }

    context.fillRect(x, y, barWidth, barHeight);

    // Add outline to path
    outlineePath.rect(x, y, barWidth, barHeight);
  }

  // Draw all outlines in one batch
  context.strokeStyle = options.darkMode ? "#fff" : "#000";
  context.lineWidth = 1;
  context.globalAlpha = 0.9;
  context.stroke(outlineePath);

  // Draw axes labels and tickers
  drawStackedAxes(width, height, minTime, timeRange, MARGIN_LEFT, MARGIN_BOTTOM);

  context.globalAlpha = 1;
}

/**
 * Timeline layout: notes arranged by pitch on y-axis, time on x-axis
 */
function drawNoteBarsTimeline(width, height) {
  if (!context || noteBars.length === 0) return;

  // Find time range of actual data
  const minTime = Math.min(...noteBars.map((bar) => bar.startTime), 0);
  const maxEndTime = Math.max(...noteBars.map((bar) => bar.endTime), 1);
  const timeRange = maxEndTime - minTime || 1;

  const noteRange = options.endNote - options.startNote || 1;
  const barHeight = options.barHeight || 1;

  const MARGIN_LEFT = 80;
  const MARGIN_BOTTOM = 40;

  // Draw background grid and axes
  drawTimelineGrid(width, height, noteRange, minTime, timeRange, MARGIN_LEFT, MARGIN_BOTTOM);

  const outlineePath = new Path2D();

  for (const bar of noteBars) {
    const duration = bar.endTime - bar.startTime || 0.1;

    // X: time-based position (left to right)
    const x = MARGIN_LEFT + ((bar.startTime - minTime) / timeRange) * (width - MARGIN_LEFT - 10);
    const barWidth = Math.max(1, (duration / timeRange) * (width - MARGIN_LEFT - 10));

    // Y: note-based position (pitch on vertical axis)
    const noteIndex = bar.noteNumber - options.startNote;
    const y = (noteIndex / noteRange) * height;

    // Get colour from note model or use provided colour
    context.fillStyle = bar.colour || getColourForNote(bar.noteNumber);

    // Visual distinction: live notes have different alpha and possibly edge styling
    if (bar.source === "live") {
      context.globalAlpha = 0.9 + bar.velocity * 0.1;
    } else {
      context.globalAlpha = 0.7 + bar.velocity * 0.3;
    }

    context.fillRect(x, y, barWidth, barHeight);

    // Add outline to path
    outlineePath.rect(x, y, barWidth, barHeight);
  }

  // Draw all outlines in one batch
  context.strokeStyle = options.darkMode ? "#fff" : "#000";
  context.lineWidth = 1;
  context.globalAlpha = 0.9;
  context.stroke(outlineePath);

  context.globalAlpha = 1;
}

/**
 * Draw background grid and axes for timeline layout
 */
function drawTimelineGrid(width, height, noteRange, minTime, timeRange, marginLeft, marginBottom) {
  if (!context) return;

  const plotWidth = width - marginLeft - 10;
  const plotHeight = height - marginBottom;

  // Draw background grid
  context.strokeStyle = options.darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  context.lineWidth = 0.5;

  // Horizontal grid lines (notes)
  for (let i = 0; i <= noteRange; i += Math.max(1, Math.floor(noteRange / 12))) {
    const y = (i / noteRange) * plotHeight;
    context.beginPath();
    context.moveTo(marginLeft, y);
    context.lineTo(marginLeft + plotWidth, y);
    context.stroke();
  }

  // Vertical grid lines (time)
  const timeStep = getTimeStep(timeRange);
  for (let time = minTime; time <= minTime + timeRange; time += timeStep) {
    const x = marginLeft + ((time - minTime) / timeRange) * plotWidth;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, plotHeight);
    context.stroke();
  }

  // Draw axes
  context.strokeStyle = options.darkMode ? "#666" : "#999";
  context.lineWidth = 1.5;

  // Left axis (Y)
  context.beginPath();
  context.moveTo(marginLeft, 0);
  context.lineTo(marginLeft, plotHeight);
  context.stroke();

  // Bottom axis (X)
  context.beginPath();
  context.moveTo(marginLeft, plotHeight);
  context.lineTo(marginLeft + plotWidth, plotHeight);
  context.stroke();

  // Draw axis labels
  context.fillStyle = options.darkMode ? "#ccc" : "#333";
  context.font = "12px sans-serif";
  context.textAlign = "center";

  // Y-axis label (Notes)
  context.save();
  context.translate(15, plotHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText("Note (Pitch)", 0, 0);
  context.restore();

  // X-axis label (Time)
  context.textAlign = "center";
  context.fillText("Time (ms)", marginLeft + plotWidth / 2, height - 5);

  // Draw tick marks and labels
  drawTimelineAxisTicks(
    marginLeft,
    plotHeight,
    plotWidth,
    noteRange,
    minTime,
    timeRange,
    marginBottom,
  );
}

/**
 * Draw background grid for stacked layout
 */
function drawStackedGrid(width, height, minTime, timeRange, marginLeft, marginBottom) {
  if (!context) return;

  const plotWidth = width - marginLeft - 10;

  // Draw background grid
  context.strokeStyle = options.darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  context.lineWidth = 0.5;

  // Vertical grid lines (time)
  const timeStep = getTimeStep(timeRange);
  for (let time = minTime; time <= minTime + timeRange; time += timeStep) {
    const x = marginLeft + ((time - minTime) / timeRange) * plotWidth;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height - marginBottom);
    context.stroke();
  }

  // Draw axes
  context.strokeStyle = options.darkMode ? "#666" : "#999";
  context.lineWidth = 1.5;

  // Left axis (Y)
  context.beginPath();
  context.moveTo(marginLeft, 0);
  context.lineTo(marginLeft, height - marginBottom);
  context.stroke();

  // Bottom axis (X)
  context.beginPath();
  context.moveTo(marginLeft, height - marginBottom);
  context.lineTo(marginLeft + plotWidth, height - marginBottom);
  context.stroke();

  // Draw axis labels
  context.fillStyle = options.darkMode ? "#ccc" : "#333";
  context.font = "12px sans-serif";
  context.textAlign = "center";

  // Y-axis label (Events)
  context.save();
  context.translate(15, (height - marginBottom) / 2);
  context.rotate(-Math.PI / 2);
  context.fillText("Note Events", 0, 0);
  context.restore();

  // X-axis label (Time)
  context.textAlign = "center";
  context.fillText("Time (ms)", marginLeft + plotWidth / 2, height - 5);

  // Draw tick marks and labels
  drawStackedAxisTicks(marginLeft, height - marginBottom, plotWidth, minTime, timeRange);
}

/**
 * Draw tick marks and labels for timeline layout Y-axis
 */
function drawTimelineAxisTicks(
  marginLeft,
  plotHeight,
  plotWidth,
  noteRange,
  minTime,
  timeRange,
  marginBottom,
) {
  if (!context) return;

  context.fillStyle = options.darkMode ? "#999" : "#666";
  context.font = "11px monospace";
  context.textAlign = "right";

  // Y-axis ticks (notes)
  for (let i = 0; i <= noteRange; i += Math.max(1, Math.floor(noteRange / 12))) {
    const y = (i / noteRange) * plotHeight;
    const noteNum = options.startNote + i;

    // Tick mark
    context.beginPath();
    context.moveTo(marginLeft - 5, y);
    context.lineTo(marginLeft, y);
    context.strokeStyle = options.darkMode ? "#666" : "#999";
    context.lineWidth = 0.5;
    context.stroke();

    // Note label
    context.fillText(`${noteNum}`, marginLeft - 10, y + 4);
  }

  // X-axis ticks (time)
  const timeStep = getTimeStep(timeRange);
  const maxTime = minTime + timeRange;

  context.textAlign = "center";
  for (let time = minTime; time <= maxTime; time += timeStep) {
    const x = marginLeft + ((time - minTime) / timeRange) * plotWidth;

    // Tick mark
    context.beginPath();
    context.moveTo(x, plotHeight);
    context.lineTo(x, plotHeight + 5);
    context.strokeStyle = options.darkMode ? "#666" : "#999";
    context.lineWidth = 0.5;
    context.stroke();

    // Time label (in seconds)
    const timeInSeconds = time / 1000;
    context.fillText(`${timeInSeconds.toFixed(1)}s`, x, plotHeight + marginBottom - 5);
  }
}

/**
 * Draw tick marks and labels for stacked layout X-axis
 */
function drawStackedAxisTicks(marginLeft, plotHeight, plotWidth, minTime, timeRange) {
  if (!context) return;

  context.fillStyle = options.darkMode ? "#999" : "#666";
  context.font = "11px monospace";
  context.textAlign = "center";

  // X-axis ticks (time)
  const timeStep = getTimeStep(timeRange);
  const maxTime = minTime + timeRange;

  for (let time = minTime; time <= maxTime; time += timeStep) {
    const x = marginLeft + ((time - minTime) / timeRange) * plotWidth;

    // Tick mark
    context.beginPath();
    context.moveTo(x, plotHeight);
    context.lineTo(x, plotHeight + 5);
    context.strokeStyle = options.darkMode ? "#666" : "#999";
    context.lineWidth = 0.5;
    context.stroke();

    // Time label (in seconds)
    const timeInSeconds = time / 1000;
    context.fillText(`${timeInSeconds.toFixed(1)}s`, x, plotHeight + 20);
  }
}

/**
 * Calculate appropriate time step for grid and ticks
 */
function getTimeStep(timeRange) {
  // Aim for roughly 5-10 ticks
  const targetSteps = 7;
  const roughStep = timeRange / targetSteps;

  // Round to nearest nice number
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;

  let step;
  if (normalized < 1.5) step = 1;
  else if (normalized < 3) step = 2;
  else if (normalized < 7) step = 5;
  else step = 10;

  return step * magnitude;
}

function getColourForNote(noteNum) {
  const hue = ((noteNum % 12) / 12) * 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Draw a legend showing live vs recorded data sources
 */
function drawLegend(width, height) {
  if (!context) return;

  const LEGEND_X = 10;
  const LEGEND_Y = 10;
  const ITEM_HEIGHT = 20;
  const BOX_SIZE = 10;
  const TEXT_OFFSET = 20;

  const hasLiveData = noteBars.some((bar) => bar.source === "live");
  const hasRecordedData = noteBars.some((bar) => bar.source === "recorded");

  if (!hasLiveData && !hasRecordedData) return;

  // Background for legend
  const legendHeight = (hasLiveData && hasRecordedData ? 2 : 1) * ITEM_HEIGHT + 8;
  context.fillStyle = options.darkMode ? "rgba(30, 30, 30, 0.9)" : "rgba(255, 255, 255, 0.9)";
  context.fillRect(LEGEND_X - 4, LEGEND_Y - 4, 180, legendHeight);

  // Legend border
  context.strokeStyle = options.darkMode ? "#666" : "#999";
  context.lineWidth = 1;
  context.strokeRect(LEGEND_X - 4, LEGEND_Y - 4, 180, legendHeight);

  context.fillStyle = options.darkMode ? "#ccc" : "#333";
  context.font = "12px sans-serif";

  let offsetY = LEGEND_Y;

  if (hasLiveData) {
    // Live data box
    context.fillStyle = "rgba(100, 200, 100, 0.9)";
    context.fillRect(LEGEND_X, offsetY, BOX_SIZE, BOX_SIZE);
    context.strokeStyle = options.darkMode ? "#fff" : "#000";
    context.lineWidth = 1;
    context.strokeRect(LEGEND_X, offsetY, BOX_SIZE, BOX_SIZE);

    // Live data label
    context.fillStyle = options.darkMode ? "#ccc" : "#333";
    context.textAlign = "left";
    context.fillText("Live Data", LEGEND_X + TEXT_OFFSET, offsetY + BOX_SIZE - 2);
    offsetY += ITEM_HEIGHT;
  }

  if (hasRecordedData) {
    // Recorded data box
    context.fillStyle = "rgba(100, 150, 200, 0.9)";
    context.fillRect(LEGEND_X, offsetY, BOX_SIZE, BOX_SIZE);
    context.strokeStyle = options.darkMode ? "#fff" : "#000";
    context.lineWidth = 1;
    context.strokeRect(LEGEND_X, offsetY, BOX_SIZE, BOX_SIZE);

    // Recorded data label
    context.fillStyle = options.darkMode ? "#ccc" : "#333";
    context.textAlign = "left";
    context.fillText("Recorded Data", LEGEND_X + TEXT_OFFSET, offsetY + BOX_SIZE - 2);
  }
}

function scheduleRender() {
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(() => render());
  }
}

/**
 * Process note on/off pairs into note bars
 */
function processCommands() {
  const processedNotes = new Map();

  // Build map of noteOn/noteOff pairs
  for (const bar of noteBars) {
    if (!processedNotes.has(bar.noteNumber)) {
      processedNotes.set(bar.noteNumber, {
        noteOn: {
          time: bar.startTime,
          velocity: bar.velocity,
          colour: bar.colour,
        },
        noteOff: bar.endTime,
      });
    }
  }

  scheduleRender();
}

self.onmessage = (event) => {
  const { type, data } = event.data;

  switch (type) {
    case "init":
      // Initialize with offscreen canvas
      canvas = data.canvas;
      context = canvas?.getContext("2d");
      displayWidth = canvas?.width || 0;
      displayHeight = canvas?.height || 0;
      scheduleRender();
      break;

    case "noteOn": {
      const { note, velocity, colour } = data;
      notesOn.set(note, { time: Date.now(), velocity, colour });
      break;
    }

    case "noteOff": {
      const { note } = data;
      const noteOnData = notesOn.get(note);
      if (noteOnData) {
        noteBars.push({
          startTime: noteOnData.time,
          endTime: Date.now(),
          noteNumber: note,
          velocity: noteOnData.velocity,
          colour: noteOnData.colour,
        });
        notesOn.delete(note);
        scheduleRender();
      }
      break;
    }

    case "loadCommands": {
      const { commands } = data;
      noteBars = commands;
      notesOn.clear();
      scheduleRender();
      break;
    }

    case "setOptions": {
      options = { ...options, ...data.options };
      scheduleRender();
      break;
    }

    case "resize": {
      const { displayWidth: w, displayHeight: h } = data;
      displayWidth = w;
      displayHeight = h;
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
      }
      scheduleRender();
      break;
    }

    case "clear": {
      noteBars = [];
      notesOn.clear();
      if (context && canvas) {
        context.fillStyle = options.darkMode ? "#1e1e1e" : "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      break;
    }

    case "getNoteBars": {
      self.postMessage({ type: "noteBarsData", data: noteBars });
      break;
    }
  }
};
