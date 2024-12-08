import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTimesync } from '../TimesyncContext';
import { useFireproof } from 'use-fireproof';
import { v4 as uuidv4 } from 'uuid';
import { loadSilenceBuffer, getDefaultLatency, setLatencyCompensation, getLatencyCompensation } from '../utils';
import './TopControls.css';
import LatencyMeasurer from './LatencyMeasurer';

const TopControls = ({ dbName, isExpert, toggleTheme, theme, toggleVisuals, visualsEnabled, onAddTrack, headStart_ms, updateLocalLatency, masterMuted, onMuteToggle }) => {
  const ts = useTimesync();
  const [tempBpm, setTempBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const timeoutRef = useRef(null);
  const { database, useLiveQuery } = useFireproof(dbName, {public: true});
  const [latency, setLatency] = useState(0);
  const [deviceId, setDeviceId] = useState(null);
  const latencyTimeoutRef = useRef(null);
  const [isEditingLatency, setIsEditingLatency] = useState(false);
  const latencyInputRef = useRef(null);
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const bpmInputRef = useRef(null);
  const [editingBpm, setEditingBpm] = useState(null);
  const [editingLatency, setEditingLatency] = useState(null);
  const [showLatencyMeasurer, setShowLatencyMeasurer] = useState(false);
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const streamRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showLatencyControl, setShowLatencyControl] = useState(false);

  // Fetch the BPM document
  const bpmResult = useLiveQuery('type', { key: 'bpm' });
  const bpmDoc = bpmResult.rows[0]?.doc;

  useEffect(() => {
    // Load or generate device ID
    let storedDeviceId = localStorage.getItem('deviceId');
    if (!storedDeviceId) {
      storedDeviceId = uuidv4();
      localStorage.setItem('deviceId', storedDeviceId);
    }
    setDeviceId(storedDeviceId);

    // Load stored latency
    const storedLatency = localStorage.getItem('latency');
    if (storedLatency !== null) {
      const parsedLatency = parseInt(storedLatency, 10);
      setLatency(parsedLatency);
      setLatencyCompensation(parsedLatency);
      updateLocalLatency(parsedLatency); // Add this line
    } else {
      const initialLatency = getLatencyCompensation();
      setLatency(initialLatency);
      localStorage.setItem('latency', initialLatency.toString());
      updateLocalLatency(initialLatency); // Add this line
    }
  }, [updateLocalLatency]); // Add updateLocalLatency to the dependency array

  useEffect(() => {
    if (bpmDoc) {
      setTempBpm(bpmDoc.bpm);
      setPlaying(bpmDoc.playing);
    }
  }, [bpmDoc]);

  useEffect(() => {
    // Load the silence buffer when the component mounts
    loadSilenceBuffer();
  }, []);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768); // Adjust this breakpoint as needed
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const handleClear = async () => {
    try {
      // Query for documents where type equals "beat"
      const result = await database.query('type', { key: 'beat', include_docs: true });
      
      // Reset all beat documents
      const updatePromises = result.rows.map(row => {
        const updatedDoc = { ...row.doc, isActive: false };
        return database.put(updatedDoc);
      });
      
      await Promise.all(updatePromises);
      console.log('All beats cleared');
    } catch (error) {
      console.error('Error clearing beats:', error);
    }
  };

  const updateBPMDoc = async (updates) => {
    if (!ts) {
      console.warn("no timesync");
      return;
    }
    if (!updates.lastChanged_ms) {
      updates.lastChanged_ms = ts.now();
    }
    const newBpmDoc = {
      ...bpmDoc,
      ...updates,
    };

    try {
      if (bpmDoc) {
        await database.put({ ...bpmDoc, ...newBpmDoc });
      } else {
        await database.put({ _id: 'bpm', type: 'bpm', ...newBpmDoc });
      }
    } catch (error) {
      console.error('Error updating BPM document:', error);
    }
  };

  const setBPM = (bpm) => {
    // calculate prevQuarterBeats based on bpm and current time
    const currentTime_ms = ts.now();
    const elapsedTime_ms = currentTime_ms - bpmDoc.lastChanged_ms;
    const elapsedQuarterBeats = Math.floor((elapsedTime_ms / 60000) * bpm * 4) + bpmDoc?.prevQuarterBeats || 0;
    updateBPMDoc({ bpm: bpm, prevQuarterBeats: elapsedQuarterBeats });
  };


  // update the BPM after the user has stopped moving the slider for 500ms, even if they don't release it yet.
  const handleBpmChange = (e) => {
    const newBpm = Math.max(30, Math.min(240, parseInt(e.target.value, 10)));
    setTempBpm(newBpm);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setBPM(newBpm);
    }, 500);
  };

  // update the BPM immediately if the user releases the slider
  const handleBpmChangeComplete = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setBPM(tempBpm);
  };

  const togglePlay = useCallback(() => {
    if (!ts){console.warn("no timesync"); return;}
    if (!ts) return;
    const newPlayingState = !playing;
    setPlaying(newPlayingState);
    let update = { 
      playing: newPlayingState, 
      bpm: bpmDoc ? bpmDoc.bpm : tempBpm,
      lastChanged_ms: newPlayingState ? ts.now() + headStart_ms : ts.now()
      //   lastChanged_ms: ts.now() + getHeadStart_ms()
      //   lastChanged_ms: ts.now()
    };
    if (newPlayingState){
      update.prevQuarterBeats = 0;
    }
    updateBPMDoc(update);
  }, [playing, bpmDoc, tempBpm, ts]);

  const beats = useLiveQuery('type', { key: 'beat' });

  console.log("beats", beats);

  // autoplay if paused at startup:
  useEffect(() => {
    if (!ts){console.warn("no timesync"); return;}
    if (!ts) return;
    const timer = setTimeout(() => {
      if (!playing && beats.rows.length > 0) {
        togglePlay();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [ts, beats]);


  const toggleMute = async () => {
    const newMutedState = !masterMuted;
    onMuteToggle(newMutedState);
  };

  const updateDeviceDoc = async (newLatency) => {
    if (!ts) {
      console.warn("no timesync");
      return;
    }
    const deviceDoc = {
      _id: deviceId,
      type: 'device',
      latency: newLatency,
      timestamp: ts.now()
    };

    try {
      await database.put(deviceDoc);
      // Update localStorage after successful database update
      localStorage.setItem('latency', newLatency.toString());
    } catch (error) {
      console.error('Error updating device document:', error);
    }
  };

  const handleLatencyChange = (e) => {
    const newLatency = parseInt(e.target.value, 10);
    setLatency(newLatency);
    setLatencyCompensation(newLatency);
    updateLocalLatency(newLatency); // Add this line

    if (latencyTimeoutRef.current) {
      clearTimeout(latencyTimeoutRef.current);
    }

    latencyTimeoutRef.current = setTimeout(() => {
      updateDeviceDoc(newLatency);
    }, 500);
  };

  const handleLatencyChangeComplete = () => {
    if (latencyTimeoutRef.current) {
      clearTimeout(latencyTimeoutRef.current);
    }
    updateDeviceDoc(latency);
    updateLocalLatency(latency); // Add this line
  };

  const handleMeasureLatency = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicrophoneReady(true);
      setShowLatencyMeasurer(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Microphone access denied. Please grant permission and try again.');
    }
  };

  const handleLatencyClick = () => {
    setEditingLatency(latency);
    setIsEditingLatency(true);
  };

  const handleLatencyInputChange = (e) => {
    const newLatency = parseInt(e.target.value, 10);
    if (!isNaN(newLatency) && newLatency >= 0 && newLatency <= 3000) {
      setEditingLatency(newLatency);
    }
  };

  const handleLatencyInputBlur = () => {
    setIsEditingLatency(false);
    if (editingLatency !== null) {
      setLatency(editingLatency);
      updateDeviceDoc(editingLatency);
    }
    setEditingLatency(null);
  };

  const handleLatencyInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      setIsEditingLatency(false);
      setLatency(editingLatency);
      updateDeviceDoc(editingLatency);
      setEditingLatency(null);
    } else if (e.key === 'Escape') {
      setIsEditingLatency(false);
      setEditingLatency(null);
    }
  };

  useEffect(() => {
    if (isEditingLatency && latencyInputRef.current) {
      latencyInputRef.current.focus();
      latencyInputRef.current.select();
    }
  }, [isEditingLatency]);

  const handleBpmClick = () => {
    setEditingBpm(tempBpm);
    setIsEditingBpm(true);
  };

  const handleBpmInputChange = (e) => {
    const newBpm = parseInt(e.target.value, 10);
    if (!isNaN(newBpm) && newBpm >= 30 && newBpm <= 240) {
      setEditingBpm(newBpm);
    }
  };

  const handleBpmInputBlur = () => {
    setIsEditingBpm(false);
    if (editingBpm !== null) {
      setTempBpm(editingBpm);
      setBPM(editingBpm);
    }
    setEditingBpm(null);
  };

  const handleBpmInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      setIsEditingBpm(false);
      setTempBpm(editingBpm);
      setBPM(editingBpm);
      setEditingBpm(null);
    } else if (e.key === 'Escape') {
      setIsEditingBpm(false);
      setEditingBpm(null);
    }
  };

  useEffect(() => {
    if (isEditingBpm && bpmInputRef.current) {
      bpmInputRef.current.focus();
      bpmInputRef.current.select();
    }
  }, [isEditingBpm]);

  const handleLatencyMeasured = (measuredLatency) => {
    const roundedLatency = Math.round(measuredLatency);
    setLatency(roundedLatency);
    updateDeviceDoc(roundedLatency);
    updateLocalLatency(roundedLatency); // Add this line
    setShowLatencyMeasurer(false);
    setMicrophoneReady(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleCloseMeasurer = () => {
    setShowLatencyMeasurer(false);
    setMicrophoneReady(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleLatencySelectChange = (e) => {
    const newLatency = parseInt(e.target.value, 10);
    updateLatency(newLatency);
  };

  const updateLatency = (newLatency) => {
    setLatency(newLatency);
    handleLatencyChange({ target: { value: newLatency } });
    handleLatencyChangeComplete();
  };

  const incrementLatency = () => {
    const newLatency = Math.min(latency + 5, 1000);
    updateLatency(newLatency);
  };

  const decrementLatency = () => {
    const newLatency = Math.max(latency - 5, 0);
    updateLatency(newLatency);
  };

  const generateLatencyOptions = () => {
    const options = [];
    for (let i = 0; i <= 1000; i += 5) {
      options.push(
        <option key={i} value={i}>
          {i} ms
        </option>
      );
    }
    return options;
  };

  const toggleLatencyControl = () => {
    setShowLatencyControl(!showLatencyControl);
  };

  return (
    <div className="top-controls">
      <div className="button-group">
        {(!masterMuted || isExpert) && (
          <button className="control-button add-track" onClick={onAddTrack}>Add Track</button>
        )}
        <button className={`control-button mute-button ${masterMuted ? 'muted' : ''}`} onClick={toggleMute}>
          {masterMuted ? 'Unmute' : 'Mute'}
        </button>
        {(!masterMuted || isExpert) && (
          <button className={`control-button show-delay ${showLatencyControl ? 'active' : ''}`} onClick={toggleLatencyControl}>
            Delay
          </button>
        )}
      </div>
      {isExpert && (
        <>
          <div className="button-group-break"></div>

          <div className="button-group">
            <button className="control-button play-pause-button" onClick={togglePlay}>
              {playing ? 'Pause' : 'Play'}
            </button>
            {/* <button className="control-button clear-button" onClick={handleClear}>Clear</button> */}
          </div>


          <div className="button-group">
            <div className="bpm-control">
              <label htmlFor="bpm-slider">BPM</label>
              {isEditingBpm ? (
                <input
                  ref={bpmInputRef}
                  type="number"
                  value={editingBpm !== null ? editingBpm : tempBpm}
                  onChange={handleBpmInputChange}
                  onBlur={handleBpmInputBlur}
                  onKeyDown={handleBpmInputKeyDown}
                  min="30"
                  max="240"
                  className="bpm-input"
                />
              ) : (
                <span className="bpm-value" onClick={handleBpmClick}>
                  {tempBpm}
                </span>
              )}
              <input
                id="bpm-slider"
                type="range"
                className="bpm-slider"
                value={tempBpm}
                onChange={handleBpmChange}
                onMouseUp={handleBpmChangeComplete}
                onTouchEnd={handleBpmChangeComplete}
                min="30"
                max="240"
              />
            </div>
          </div>

          <div className="button-group-break"></div>

          <div className="button-group">
            <button className="control-button visuals-toggle" onClick={toggleVisuals}>
              {visualsEnabled ? 'Disable Visuals' : 'Enable Visuals'}
            </button>
            <button className="control-button theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </>
      )}

      {showLatencyControl && (
        <>
          <div className="button-group-break"></div>

          <div className="button-group">
            <div className="latency-control">
              <label htmlFor="latency-control">Delay:</label>
              <select
                id="latency-select"
                value={latency}
                onChange={handleLatencySelectChange}
                className="latency-select"
            >
                {generateLatencyOptions()}
              </select>
              <button onClick={decrementLatency} className="latency-button">-</button>
              <button onClick={incrementLatency} className="latency-button">+</button>
            </div>
          </div>
        </>
      )}
      {showLatencyMeasurer && (
        <LatencyMeasurer
          onClose={handleCloseMeasurer}
          onLatencyMeasured={handleLatencyMeasured}
          microphoneReady={microphoneReady}
          stream={streamRef.current}
        />
      )}
    </div>
  );
};

export default TopControls;
