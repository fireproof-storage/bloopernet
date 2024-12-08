import React, { useState, useEffect, useRef } from 'react';
import { getAudioContext, getMasterGainNode } from '../utils';
import './LatencyMeasurer.css';

const LatencyMeasurer = ({ onClose, onLatencyMeasured, microphoneReady, stream }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const timeoutRef = useRef(null);

  const NUMBER_OF_MEASUREMENTS = 5;
  const PAUSE_BETWEEN_MEASUREMENTS = 500; // 500ms pause between measurements

  const startMeasurement = async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);
    setProgress(0);

    const measurements = [];

    try {
      const audioContext = getAudioContext();
      await audioContext.audioWorklet.addModule('processor.js');

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const masterGainNode = getMasterGainNode();

      for (let i = 0; i < NUMBER_OF_MEASUREMENTS; i++) {
        const processor = new AudioWorkletNode(audioContext, 'latency-processor');
        processorRef.current = processor;

        source.connect(processor).connect(masterGainNode);

        const measurementPromise = new Promise((resolve, reject) => {
          const measurementTimeout = setTimeout(() => {
            reject(new Error('Measurement timed out'));
          }, 5000); // 5 second timeout for each measurement

          processor.port.onmessage = (event) => {
            if (event.data.type === 'result') {
              clearTimeout(measurementTimeout);
              resolve(event.data.latency);
            }
          };

          processor.port.postMessage({ type: 'start' });
        });

        try {
          const latency = await measurementPromise;
          measurements.push(latency);
          setProgress((i + 1) / NUMBER_OF_MEASUREMENTS * 100);
        } catch (error) {
          console.error(`Measurement ${i + 1} failed:`, error);
        }

        // Disconnect the processor after each measurement
        processor.disconnect();

        // Pause between measurements
        if (i < NUMBER_OF_MEASUREMENTS - 1) {
          await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_MEASUREMENTS));
        }
      }

      if (measurements.length > 0) {
        const averageLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        setResult({
          average: averageLatency,
          measurements: measurements
        });
        onLatencyMeasured(averageLatency);
      } else {
        throw new Error('All measurements failed');
      }
    } catch (error) {
      console.error('Error during measurements:', error);
      setError('An error occurred while measuring latency. Please try again.');
    } finally {
      setIsRunning(false);
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="latency-measurer">
      <h2>Measure Audio Latency</h2>
      <p>This will perform {NUMBER_OF_MEASUREMENTS} measurements to calculate an average latency. Please ensure your speakers are on and your microphone is enabled.</p>
      {error && <p className="error-message">{error}</p>}
      <button onClick={startMeasurement} disabled={isRunning || !microphoneReady}>
        {isRunning ? `Measuring... ${progress.toFixed(0)}%` : 'Start Measurement'}
      </button>
      <button onClick={onClose}>Close</button>
      {result && (
        <div>
          <p>Average latency: {result.average.toFixed(2)} ms</p>
          <p>Individual measurements:</p>
          <ul>
            {result.measurements.map((measurement, index) => (
              <li key={index}>{measurement.toFixed(2)} ms</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LatencyMeasurer;
