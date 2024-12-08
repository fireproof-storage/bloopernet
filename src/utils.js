import WAAClock from 'waaclock';

let audioContext = null;
let clock = null;
let masterGainNode = null;
let silenceBuffer = null;
let isMuted = true;
let latencyCompensation = 0;
let analyserNode = null;
let headStart_ms = 200; 

export const getAudioContext = () => {
  if (!audioContext) {
    console.log("getAudioContext");
    const options = {latencyHint: 'interactive'};
    audioContext = new (window.AudioContext || window.webkitAudioContext)(options);
    clock = new WAAClock(audioContext);
    clock.start();
    
    // Create master gain node
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.setValueAtTime(0, audioContext.currentTime); // Start muted

      // Create and configure the AnalyserNode
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 1024; // Adjust as needed
    analyserNode.smoothingTimeConstant = 0.8; // Adjust for desired smoothing

    // Insert the analyserNode after the master gain node
    masterGainNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);

  }
  return audioContext;
};

export const getDefaultLatency = () => {
  const ac = getAudioContext();
  var latency = 0;
  latency += (ac.baseLatency || 0);   // should be defined everywhere but you never know
  latency += (ac.outputLatency || 0); // undefined on safari
 // console.log("device latency: ", latency, "ms");
  return latency;
};

export const loadSilenceBuffer = async () => {
  if (!silenceBuffer) {
    try {
      silenceBuffer = await loadSound('/sounds/silence.wav');
    } catch (error) {
      console.error('Failed to load silence.wav:', error);
    }
  }
};

export const setMasterMute = async (mute) => {
  isMuted = mute;
  const ctx = getAudioContext();

  if (!isMuted) { // Unmuting
    // Ensure audio context is running
    await ctx.resume();

    // Play silent buffer to trigger audio
    if (!silenceBuffer) {
      await loadSilenceBuffer();
    }
    if (silenceBuffer) {
      playSoundBuffer(silenceBuffer, masterGainNode);
    }

    // Short delay to allow audio to initialize
    setTimeout(() => {
      masterGainNode.gain.setValueAtTime(1, ctx.currentTime);
    }, 200);
  } else { // Muting
    masterGainNode.gain.setValueAtTime(0, ctx.currentTime);
  }
};

export const isMasterMuted = () => isMuted;

export const loadSound = async (source) => {
  // const audioContext = getAudioContext();
  let response;
  if (typeof source === 'string') {
    // It's a URL
    response = await fetch(source);
  } else if (source instanceof Blob) {
    // It's a Blob (for database-stored files)
    response = new Response(source);
  } else {
    throw new Error('Invalid audio source');
  }
  const arrayBuffer = await response.arrayBuffer();
  return await getAudioContext().decodeAudioData(arrayBuffer);
};

export const playSoundBuffer = (buffer, outputNode) => {
  const source = getAudioContext().createBufferSource();
  source.buffer = buffer;
  source.connect(outputNode);
  source.start();
};

export const setLatencyCompensation = (latency) => {
  latencyCompensation = latency;
  localStorage.setItem('latencyCompensation', latency);
};

export const getLatencyCompensation = () => {
  return latencyCompensation;
};

export const initLatencyCompensation = () => {
  const storedLatency = localStorage.getItem('latencyCompensation');
  latencyCompensation = storedLatency ? parseFloat(storedLatency) : 0;
};

export const scheduleBeat = (sourceNode, audioTime_s) => {
  const ctx = getAudioContext();
  if (!ctx) {return;}
  if (ctx.state != 'running') {
 //  console.warn("audio context not running");
    return;
  }

  let ctxtime = ctx.currentTime;
  const adjustedTime = audioTime_s;
  
  if (adjustedTime > ctxtime) {
    const event = clock.callbackAtTime(() => {
      sourceNode.start();
    }, adjustedTime);
    //console.log("scheduled beat ", adjustedTime - ctxtime, " seconds from now");
    return event;
  } else {
    console.warn("too late to schedule beat");
  }
};

export const clearScheduledEvents = (events) => {
  events.forEach(event => event.clear());
};

export const getAnalyserNode = () => {
  return analyserNode;
}

export const getMasterGainNode = () => {
  return masterGainNode;
};

export function calculateElapsedQuarterBeats(bpmDoc, ts) {
  if (!ts || !bpmDoc || !bpmDoc.playing) {
    return 0;
  }

  const { bpm, lastChanged_ms, prevQuarterBeats } = bpmDoc;
  const currentTime_ms = ts.now();
  const elapsedTime_ms = currentTime_ms - lastChanged_ms;
  const elapsedQuarterBeats = Math.floor((elapsedTime_ms / 60000) * bpm * 4) + prevQuarterBeats;

  return elapsedQuarterBeats;
}

export function getDefaultInstrumentId(instrumentName) {
  return instrumentName.toLowerCase();
}
