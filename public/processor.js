class LatencyProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRunning = false;
    this.startTime = 0;
    this.detectionThreshold = 0.1;
    this.beepFrequency = 440; // 440 Hz tone
    this.beepDuration = 0.6; // 300 ms beep
    this.maxMeasurementTime = 3; // 3 seconds (3000 ms)
    this.phase = 0;
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    if (event.data.type === 'start') {
      this.isRunning = true;
      this.startTime = currentTime;
      this.phase = 0;
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const input = inputs[0];

    if (this.isRunning) {
      const currentSampleTime = currentTime - this.startTime;

      // Generate a beep
      if (currentSampleTime < this.beepDuration) {
        const increment = 2 * Math.PI * this.beepFrequency / sampleRate;
        for (let channel = 0; channel < output.length; channel++) {
          for (let i = 0; i < output[channel].length; i++) {
            output[channel][i] = 0.2 * Math.sin(this.phase);
            this.phase += increment;
            if (this.phase >= 2 * Math.PI) {
              this.phase -= 2 * Math.PI;
            }
          }
        }
      } else {
        // Stop outputting sound after beep duration
        for (let channel = 0; channel < output.length; channel++) {
          output[channel].fill(0);
        }
      }

      // Check for the beep in the input
      for (let channel = 0; channel < input.length; channel++) {
        for (let i = 0; i < input[channel].length; i++) {
          if (Math.abs(input[channel][i]) > this.detectionThreshold) {
            const latency = (currentTime - this.startTime) * 1000;
            if (latency < this.beepDuration * 1000) {
              this.port.postMessage({ type: 'result', latency });
              this.isRunning = false;
              return false; // Stop processing
            }
          }
        }
      }

      // Stop if we've exceeded the maximum measurement time
      if (currentSampleTime > this.maxMeasurementTime) {
        this.port.postMessage({ type: 'timeout' });
        this.isRunning = false;
        return false; // Stop processing
      }
    }

    return true;
  }
}

registerProcessor('latency-processor', LatencyProcessor);
