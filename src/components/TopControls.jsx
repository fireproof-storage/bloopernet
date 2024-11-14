import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTimesync } from '../TimesyncContext';
import { useFireproof } from 'use-fireproof';
import { setMasterMute, isMasterMuted, loadSilenceBuffer, getHeadStart_ms} from '../audioUtils';
import './TopControls.css';

const TopControls = ({ dbName, isExpert, toggleTheme, theme, toggleVisuals, visualsEnabled, onAddTrack }) => {
  const ts = useTimesync();
  const [tempBpm, setTempBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(isMasterMuted()); // Start muted
  const timeoutRef = useRef(null);
  const { database, useLiveQuery } = useFireproof(dbName, {public: true});
  // Fetch the current BPM document from the database
  const bpmResult = useLiveQuery('type', { key: 'bpm' });
  const bpmDoc = bpmResult.rows[0]?.doc;


  useEffect(() => {
    if (bpmDoc) {
      setTempBpm(bpmDoc.bpm);
      setPlaying(bpmDoc.playing);
    }
  }, [bpmDoc]);

  useEffect(() => {
    // Set initial volume
    setMasterMute(muted);
  }, [muted]);

  useEffect(() => {
    // Load the silence buffer when the component mounts
    loadSilenceBuffer();
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
    if (!ts){console.warn("no timesync"); return;}
    if (! updates.lastChanged_ms) {
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
      //lastChanged_ms: newPlayingState ? ts.now() + getHeadStart_ms() : ts.now()
   //   lastChanged_ms: ts.now() + getHeadStart_ms()
      lastChanged_ms: ts.now()
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
    }, 5000);

    return () => clearTimeout(timer);
  }, [ts, beats]);


  const toggleMute = async () => {
    const newMutedState = !muted;
    setMasterMute(newMutedState);
    setMuted(newMutedState);
  };

  return (
    <div className="top-controls">
      <div className="button-group">
        <button className={`control-button mute-button ${muted ? 'muted' : ''}`} onClick={toggleMute}>
          {muted ? 'Unmute' : 'Mute'}
        </button>
        {!muted && (
          <button className="control-button add-track" onClick={onAddTrack}>Add Track</button>
        )}
        {isExpert && (
          <>
            <button className="control-button play-pause-button" onClick={togglePlay}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className="control-button clear-button" onClick={handleClear}>Clear</button>
            <div className="bpm-control">
              <label htmlFor="bpm-slider">BPM</label>
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
              <span className="bpm-value">{tempBpm}</span>
            </div>
            <button className="control-button theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="control-button visuals-toggle" onClick={toggleVisuals}>
              {visualsEnabled ? 'Disable Visuals' : 'Enable Visuals'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TopControls;
