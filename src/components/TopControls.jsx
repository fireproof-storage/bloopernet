import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFireproof } from 'use-fireproof';
import './TopControls.css';

const TopControls = ({ dbName, isExpert, toggleTheme, theme }) => {
  const [tempBpm, setTempBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // Start muted
  const timeoutRef = useRef(null);
  const { database, useLiveQuery } = useFireproof(dbName);
  // Fetch the current BPM document from the database
  const bpmResult = useLiveQuery('type', { key: 'bpm' });
  const bpmDoc = bpmResult.rows[0]?.doc;

  

  useEffect(() => {
    if (bpmDoc) {
      setTempBpm(bpmDoc.bpm);
      setPlaying(bpmDoc.playing);
    }
  }, [bpmDoc]);




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

  // Remove the handleNuke function

  const updateBPMDoc = async (updates) => {
    const newBpmDoc = {
      ...bpmDoc,
      ...updates    };

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


  const handleBpmChange = (e) => {
    const newBpm = Math.max(30, Math.min(240, parseInt(e.target.value, 10)));
    setTempBpm(newBpm);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      updateBPMDoc({ bpm: newBpm });
    }, 500);
  };

  const handleBpmChangeComplete = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    updateBPMDoc({ bpm: tempBpm });
  };

  const togglePlay = useCallback(() => {
    // if (!ts) return;
    // const newPlayingState = !playing;
    // setPlaying(newPlayingState);
    // updateBPMDoc({ 
    //   playing: newPlayingState, 
    //   bpm: bpmDoc ? bpmDoc.bpm : tempBpm,
    //   lastChanged_ms: ts.now() // Reset the start time when playing is toggled to true // todo: change to lastChanged_ms
    // });
  }, [playing, bpmDoc, tempBpm]);

  useEffect(() => {
    // if (!ts) return;
    const timer = setTimeout(() => {
      if (!playing) {
        togglePlay();
      }
    }, Math.floor(Math.random() * 4000) + 1000);

    return () => clearTimeout(timer);
  }, [togglePlay]);


  const toggleMute = async () => {
    const newMutedState = !muted;
    setMuted(newMutedState);
  };

  return (
    <div className="top-controls">
      <div className="button-group">
        <button className={`control-button mute-button ${muted ? 'muted' : ''}`} onClick={toggleMute}>
          {muted ? 'Unmute' : 'Mute'}
        </button>
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
          </>
        )}
      </div>
    </div>
  );
};

export default TopControls;
