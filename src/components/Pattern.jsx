import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFireproof } from 'use-fireproof';
import { loadSound, clearScheduledEvents, getAudioContext, scheduleBeat, getMasterGainNode, calculateElapsedQuarterBeats} from '../utils';
import { useTimesync } from '../TimesyncContext';
import './Pattern.css';
import TrackForm from './TrackForm';

const Pattern = ({ 
  instrumentId,
  instrument,
  audioFile,
  mimeType,
  referenceType,
  _files,
  updateBeat, 
  bpmDoc, 
  isMuted, 
  isSolo, 
  onMuteToggle, 
  onSoloToggle, 
  anyTrackSoloed, 
  onNameChange, 
  onDeleteTrack,
  isDefaultInstrument,
  dbName,
  masterMuted,
  existingTrackNames,
  onVolumeChange,
  initialVolume,
  onTrackChange,
  headStart_ms,
}) => {
  const { database, useLiveQuery } = useFireproof(dbName, {public: true});
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [wasPlaying, setWasPlaying] = useState(false);
  const gainNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const ts = useTimesync();
  const patternLength = 16; // 16 quarter beats = 4 full beats
  const scheduledEventsRef = useRef(new Array(16).fill(null));
  const timesyncStartTime_ms = useRef(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [volume, setVolume] = useState(initialVolume || 100);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const beatButtonsRef = useRef([]);
  const animationFrameRef = useRef(null);

  // used for decorating buttons
  const currentQuarterBeat = (calculateElapsedQuarterBeats(bpmDoc, ts) + patternLength) % patternLength;

  const bpm = bpmDoc?.bpm || 120;
  const playing = bpmDoc?.playing || false;

  // Fetch beats for this specific pattern
  const beatResult = useLiveQuery('type', { 
    key: 'beat',
  });

  const beats = useMemo(() => {
    const beatMap = {};
    beatResult.rows.forEach(row => {
      if (row.doc) {
        beatMap[row.doc._id] = row.doc.isActive;
      }
    });
    return beatMap;
  }, [beatResult]);

  // Use useMemo to memoize the audio data
  const audioData = useMemo(() => {
    if (referenceType === 'url') {
      return audioFile;
    } else if (referenceType === 'database') {
      const fileName = Object.keys(_files)[0];
      return _files[fileName].file().then(file => URL.createObjectURL(file));
    }
    return null;
  }, [audioFile, referenceType]);

  // Use useEffect to load the sound buffer
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    const loadAudio = async () => {
      try {
        const data = await audioData;
        if (!isMounted) return;
        const buffer = await loadSound(data);
        if (!isMounted) return;
        setAudioBuffer(buffer);
        setIsLoading(false);
      } catch (error) {
        if (!isMounted) return;
        console.error('Error loading audio:', error);
        setLoadError(error);
        setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
    };
  }, [audioData]);

  useEffect(() => {
    if (!gainNodeRef.current) {
      const ctx = getAudioContext();
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.connect(getMasterGainNode());
    }
  }, []);

  useEffect(() => {
    if (gainNodeRef.current) {
      const gain = calculateGain();
      gainNodeRef.current.gain.setValueAtTime(gain, getAudioContext().currentTime);
    }
  }, [isMuted, isSolo, anyTrackSoloed, volume]);

  const calculateGain = () => {
    if (isMuted || (anyTrackSoloed && !isSolo)) {
      return 0;
    }
    return volume / 100;
  };

  const scheduleBeats = useCallback((scheduleStart_s, quarterBeatsToSchedule = 1, startBeatNumber = 0) => {
    if (!audioBuffer || !playing) return [];

    const ctx = getAudioContext();
    const events = [];

    let nextBeatNumber = (startBeatNumber) % patternLength;
    for (let i = 0; i < quarterBeatsToSchedule; i++) {
      if (beats[`beat-${instrumentId}-${nextBeatNumber}`]) {
        const beatTime_s = scheduleStart_s + (i * 15 / bpm);
        const currentTime = ctx.currentTime;

        // Check if the beat is already scheduled and still in the future
        if (!scheduledEventsRef.current[nextBeatNumber] || scheduledEventsRef.current[nextBeatNumber].deadline <= currentTime) {
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(gainNodeRef.current);

          const event = scheduleBeat(source, beatTime_s);
          if (event) {
            events.push(event);
            scheduledEventsRef.current[nextBeatNumber] = event;
          }
        }
      }
      nextBeatNumber = (nextBeatNumber + 1) % patternLength;
    }

    return events;
  }, [audioBuffer, beats, bpm, playing, instrumentId]);

  const scheduleNextQuarterBeat = useCallback(() => {
    if (!audioBuffer || !playing || !ts || timesyncStartTime_ms.current === null) return;

    const currentTimesyncTime_ms = ts.now();
    const elapsedTimesyncTime_ms = currentTimesyncTime_ms - timesyncStartTime_ms.current;
    const currentAudioTime_s = getAudioContext().currentTime;

    const quarterBeatDuration_s = 15 / bpm;
    const quarterBeatDuration_ms = quarterBeatDuration_s * 1000;

    // alculate the next quarter beat start time
    const nextQuarterBeatNumber = Math.ceil((elapsedTimesyncTime_ms + headStart_ms) / quarterBeatDuration_ms);
    const nextQuarterBeatStart_ms = (nextQuarterBeatNumber * quarterBeatDuration_ms) + headStart_ms;

    // relative time to schedule
    const relativeTimeToSchedule_ms = nextQuarterBeatStart_ms - elapsedTimesyncTime_ms;
    const audioTimeToSchedule_s = currentAudioTime_s + (relativeTimeToSchedule_ms / 1000);

    // if (instrument === "Kick") {
    //   console.log("beat number: ", nextQuarterBeatNumber, " start ms: ", nextQuarterBeatStart_ms);
    //   // console.log("syncDelta_ms: ", syncDelta_ms);
    //   console.log("audioTimeToSchedule_s: ", audioTimeToSchedule_s);
    //   console.log("relativeTimeToSchedule_ms: ", relativeTimeToSchedule_ms);
    // }

    // Only schedule if it's in the future
    if (audioTimeToSchedule_s > currentAudioTime_s) {
      const newEvents = scheduleBeats(
        audioTimeToSchedule_s,
        1,
        nextQuarterBeatNumber
      );
    } else {
      console.warn("too late to schedule by ", (audioTimeToSchedule_s - currentAudioTime_s), " seconds");
    }

  }, [instrument, audioBuffer, beats, bpm, playing, ts, isMuted, isSolo]);

  useEffect(() => {
    if (ts && playing && !wasPlaying) {
      console.log("play started");
      setWasPlaying(true);
      // Reset timing references when playback starts
      timesyncStartTime_ms.current = bpmDoc?.lastChanged_ms || ts.now();
      // time between when play started and when we rendered
      const delta_s = (ts.now() - (bpmDoc?.lastChanged_ms || 0)) / 1000;
      // console.log("timesyncStartTime secs: ", timesyncStartTime_ms.current / 1000);

      // // Play the first beat immediately
      // if (soundBuffer && beats[`beat-${instrumentId}-0`]) {
      //   playSoundBuffer(soundBuffer);
      // }

      // Schedule the next beat
      scheduleNextQuarterBeat();
    } else if (!playing && wasPlaying) {
      timesyncStartTime_ms.current = null;
      // Clear any scheduled events when stopping
      clearScheduledEvents(scheduledEventsRef.current.filter(Boolean));
      scheduledEventsRef.current = new Array(16).fill(null);
      setWasPlaying(false);
    }
  }, [playing, ts, audioBuffer, beats, instrument, isMuted, isSolo]);

  const playSound = () => {
    if (audioBuffer) {
      const source = getAudioContext().createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current);
      source.start();
    } else {
      console.warn(`Sound for ${instrument} not loaded yet`);
    }
  };

  const updateBeatButtonClasses = useCallback((currentBeat) => {
    beatButtonsRef.current.forEach((button, index) => {
      if (!button) return;

      const beatId = `beat-${instrumentId}-${index}`;
      const isActive = beats[beatId] === true;
      const isCurrent = index === currentBeat;
      const isSilent = isMuted || (anyTrackSoloed && !isSolo) || masterMuted;

      button.className = `beat-button${isActive ? ' active' : ''}${isCurrent ? ' current' : ''}${isSilent ? ' silent' : ''}`;
    });
  }, [beats, instrumentId, isMuted, isSolo, anyTrackSoloed, masterMuted]);

  useEffect(() => {
    let lastUpdateTime = 0;
    let prevBeat = -1;

    const updateAnimation = (timestamp) => {
      if (!playing) return;

      // Update every 16ms (roughly 60fps)
      if (timestamp - lastUpdateTime > 16) {
        const currentQuarterBeat = calculateElapsedQuarterBeats(bpmDoc, ts);
        if (currentQuarterBeat > prevBeat) {
          const currentBeat = Math.floor(currentQuarterBeat) % 16;
          updateBeatButtonClasses(currentBeat);
          scheduleNextQuarterBeat();
          prevBeat = currentQuarterBeat;
        }
        lastUpdateTime = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(updateAnimation);
    };

    if (playing) {
      animationFrameRef.current = requestAnimationFrame(updateAnimation);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Reset all beat buttons to their non-current state
      updateBeatButtonClasses(-1);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playing, bpmDoc, ts, updateBeatButtonClasses, scheduleNextQuarterBeat]);

  const renderBeatButtons = () => {
    const groups = [];
    for (let i = 0; i < 4; i++) {
      const groupButtons = [];
      for (let j = 0; j < 4; j++) {
        const index = i * 4 + j;
        const isActive = beats[`beat-${instrumentId}-${index}`] || false;
        
        groupButtons.push(
          <div
            key={`${instrumentId}-${index}`}
            ref={el => beatButtonsRef.current[index] = el}
            className={`beat-button${isActive ? ' active' : ''}`}
            onClick={() => updateBeat(instrumentId, index, !isActive)}
            data-id={`beat-${instrumentId}-${index}`}
          >
            <div className="beat-button-inner" />
          </div>
        );
      }
      groups.push(
        <div key={`group-${i}`} className="beat-group">
          {groupButtons}
        </div>
      );
    }
    return groups;
  };

  const isSilent = isMuted || (anyTrackSoloed && !isSolo) || masterMuted;

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    onVolumeChange(instrumentId, newVolume);
  };

  const handleDeleteOrRevert = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    onDeleteTrack(instrumentId);
    setShowDeleteConfirm(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className={`pattern ${isSilent ? 'silent' : ''}`}>
      <div className="pattern-controls">
        <button
          className={`info-button ${showInfo ? 'active' : ''}`} 
          onClick={() => setShowInfo(!showInfo)}
          role="button"
          tabIndex="0"
          aria-label="Information"
        >
          <span className="material-icons">info</span>
        </button>
        <button className="instrument-button" onClick={playSound} role="button" tabIndex="0">{instrument}</button>
        <button 
          className={`mute-button ${isMuted ? 'active' : ''}`} 
          onClick={onMuteToggle}
          role="button"
          tabIndex="0"
          aria-label="Mute"
        >
          <span className="material-icons">hearing_disabled</span>
        </button>
        <button 
          className={`solo-button ${isSolo ? 'active' : ''}`} 
          onClick={onSoloToggle}
          role="button"
          tabIndex="0"
          aria-label="Solo"
        >
          <span className="material-icons">hearing</span>
        </button>
      </div>
      {showInfo ? (
        <div className="info-panel">
          {!showChangeForm && (
            <div className="volume-control">
              <label htmlFor={`volume-${instrumentId}`}>Volume: {volume}%</label>
							<input
								type="range"
								id={`volume-${instrumentId}`}
								min="0"
								max="800"
								value={volume}
								onChange={handleVolumeChange}
							/>
            </div>
          )}
          {!showChangeForm && (
            <button className="track-change-button" onClick={() => setShowChangeForm(true)} role="button" tabIndex="0">Change Sample</button>
          )}
          {showChangeForm && (
            <TrackForm
              onSubmit={(newData) => {
                onTrackChange(instrumentId, newData);
                setShowChangeForm(false);
              }}
              onCancel={() => setShowChangeForm(false)}
              existingTrackNames={existingTrackNames}
              initialData={{ name: instrument, audioFile, mimeType, referenceType }}
            />
          )}
          {!showChangeForm && (
            <button 
              className="track-delete-button" 
              onClick={handleDeleteOrRevert} 
              role="button" 
              tabIndex="0"
          >
              {isDefaultInstrument ? 'Revert' : 'Delete'}
            </button>
          )}
        </div>
      ) : (
        <div className="beat-buttons">
          {renderBeatButtons()}
        </div>
      )}
      {showDeleteConfirm && (
        <div className="delete-confirm">
          <p>
            {isDefaultInstrument 
              ? 'Are you sure you want to revert this track?' 
              : 'Are you sure you want to delete this track?'}
          </p>
          <div className="delete-confirm-buttons">
            <button onClick={handleDeleteConfirm} className="confirm-button" aria-label="Confirm">
              <span className="material-icons">check</span>
            </button>
            <button onClick={handleDeleteCancel} className="cancel-button" aria-label="Cancel">
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>
      )}
      {isLoading && <div>Loading audio...</div>}
      {loadError && <div>Error loading audio: {loadError.message}</div>}
    </div>
  );
};

export default Pattern;
