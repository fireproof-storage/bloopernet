import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useFireproof } from 'use-fireproof';
import { useTimesync } from '../TimesyncContext';
import Pattern from './Pattern';
import TrackForm from './TrackForm';
import { v4 as uuidv4 } from 'uuid';
import { calculateElapsedQuarterBeats, getDefaultInstrumentId } from '../utils';
import './PatternSet.css';

const DEFAULT_INSTRUMENTS = ['Kick', 'Snare', 'Hi-hat', 'Tom', 'Clap'];

const PatternSet = ({ 
  dbName, 
  beats, 
  showNewTrackForm, 
  onCancelNewTrack, 
  headStart_ms, 
  masterMuted,
}) => {
  const ts = useTimesync();
  const { database, useLiveQuery } = useFireproof(dbName, {public: true});
  const [trackSettings, setTrackSettings] = useState({});

  // Fetch the BPM document from the database
  const bpmResult = useLiveQuery('type', { key: 'bpm' });
  const bpmDoc = bpmResult.rows[0]?.doc;
  
  // Extract BPM, lastChanged, and playing from the query result
  const bpm = bpmDoc?.bpm || 120;
  const playing = bpmDoc?.playing || false;

  // Query for all instrument documents
  const instrumentDocs = useLiveQuery('type', { key: 'instrument' });

  // Create a map of instrument records with defaults for missing data
  const instrumentRecords = useMemo(() => {
    const records = {};
    DEFAULT_INSTRUMENTS.forEach(instrument => {
      const id = getDefaultInstrumentId(instrument);
      records[id] = {
        _id: id,
        name: instrument,
        audioFile: `/sounds/${id}.wav`,
        mimeType: 'audio/wav',
        referenceType: 'url'
      };
    });

    instrumentDocs.rows.forEach(row => {
      const doc = row.doc;
      // This will overwrite default instruments if customized
      records[doc._id] = { ...records[doc._id], ...doc };
    });

    return records;
  }, [instrumentDocs]);

  // Create a list of existing track names
  const existingTrackNames = useMemo(() => {
    return Object.values(instrumentRecords).map(record => record.name.toLowerCase());
  }, [instrumentRecords]);

  // useEffect(() => {
  //   if (playing) {
  //     const intervalId = setInterval(() => {
  //       setElapsedQuarterBeats(calculateElapsedQuarterBeats(bpmDoc, ts));
  //     }, 1000 / (4 * (bpm / 60))); // Update 4x per quarter beat
  //     return () => clearInterval(intervalId);
  //   } else {
  //     setElapsedQuarterBeats(0);
  //   }
  // }, [playing, bpmDoc, ts, bpm]);

  const updateBeat = async (instrumentId, beatIndex, isActive) => {
    const beatId = `beat-${instrumentId}-${beatIndex}`;
    const doc = await database.get(beatId).catch(error => {
      if (error.message.includes('Not found')) {
        return {
          _id: beatId,
          type: 'beat',
          isActive: isActive,
          instrumentId: instrumentId,
          beatIndex: beatIndex
        };
      } else {
        throw error;
      }
    });
    await database.put({ ...doc, isActive });
  };


  //////////////////////////////////////////////////////////////////////////////
  // Manage track settings in local storage

  useEffect(() => {
    // Load track settings from local storage
    const storedSettings = JSON.parse(localStorage.getItem('trackSettings')) || {};
    setTrackSettings(storedSettings);
  }, []);

  const updateTrackSetting = useCallback((instrumentId, setting, value) => {
    setTrackSettings(prev => {
      const updated = {
        ...prev,
        [instrumentId]: {
          ...prev[instrumentId],
          [setting]: value
        }
      };
      localStorage.setItem('trackSettings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleVolumeChange = useCallback((instrumentId, volume) => {
    updateTrackSetting(instrumentId, 'volume', volume);
  }, [updateTrackSetting]);

  
  const handleSubmitNewTrack = useCallback(async (newTrack) => {
    const newId = `${newTrack.name.toLowerCase()}-${uuidv4()}`;
    const doc = {
      _id: newId,
      type: 'instrument',
      name: newTrack.name,
      mimeType: newTrack.mimeType,
      referenceType: newTrack.referenceType,
      createdAt: ts.now()
    };

    if (newTrack.referenceType === 'url') {
      doc.audioFile = newTrack.audioData;
    } else if (newTrack.referenceType === 'database') {
      doc._files = {
        [`${newId}.${newTrack.mimeType.split('/')[1]}`]: newTrack.audioData
      };
    }

    await database.put(doc);
    onCancelNewTrack(); // Close the form after submitting
  }, [database, onCancelNewTrack, ts]);

  const handleMuteToggle = useCallback((instrumentId) => {
    updateTrackSetting(instrumentId, 'muted', !trackSettings[instrumentId]?.muted);
  }, [trackSettings, updateTrackSetting]);

  const handleSoloToggle = useCallback((instrumentId) => {
    updateTrackSetting(instrumentId, 'soloed', !trackSettings[instrumentId]?.soloed);
  }, [trackSettings, updateTrackSetting]);

  const anyTrackSoloed = Object.values(trackSettings).some(track => track.soloed);

  const handleNameChange = useCallback(async (instrumentId, newName) => {
    const instrument = Object.values(instrumentRecords).find(i => i._id === instrumentId);
    if (instrument) {
      if (DEFAULT_INSTRUMENTS.includes(instrument.name)) {
        console.warn("Cannot rename default instruments");
        return;
      }
      const doc = await database.get(instrumentId);
      await database.put({
        ...doc,
        name: newName
      });
    }
  }, [database, instrumentRecords]);

  const handleDeleteTrack = useCallback(async (instrumentId) => {
    // Don't allow deletion of default instruments
    if (DEFAULT_INSTRUMENTS.some(name => getDefaultInstrumentId(name) === instrumentId)) {
      alert("Cannot delete default instruments");
      return;
    }

    try {
      // Delete the instrument document
      await database.del(instrumentId);

      // Delete associated beats
      const beatDocs = await database.query(
        doc => {
          if (doc.type === 'beat' && doc._id.startsWith(`beat-${instrumentId}-`)){
            return doc._id;
          }
        }
      )
      await Promise.all(beatDocs.rows.map(row => database.del(row.id)));

      // Remove from track settings
      setTrackSettings(prev => {
        const updated = { ...prev };
        delete updated[instrumentId];
        localStorage.setItem('trackSettings', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Error deleting track:", error);
      alert("An error occurred while deleting the track");
    }
  }, [database]);

  const handleCancelNewTrack = useCallback(() => {
    onCancelNewTrack();
  }, []);

  const handleAddTrack = useCallback(() => {
    setShowNewTrackForm(true);
  }, []);

  // Create a sorted list of instrument records
  const sortedInstrumentRecords = useMemo(() => {
    const records = Object.values(instrumentRecords);
    return records.sort((a, b) => {
      // Put default instruments at the bottom
      if (DEFAULT_INSTRUMENTS.includes(a.name) && !DEFAULT_INSTRUMENTS.includes(b.name)) return 1;
      if (!DEFAULT_INSTRUMENTS.includes(a.name) && DEFAULT_INSTRUMENTS.includes(b.name)) return -1;
      
      // For non-default instruments, sort by createdAt (most recent first)
      if (!DEFAULT_INSTRUMENTS.includes(a.name) && !DEFAULT_INSTRUMENTS.includes(b.name)) {
        return b.createdAt - a.createdAt;
      }
      
      // For default instruments, maintain their original order
      return DEFAULT_INSTRUMENTS.indexOf(a.name) - DEFAULT_INSTRUMENTS.indexOf(b.name);
    });
  }, [instrumentRecords]);

  const handleTrackChange = useCallback(async (instrumentId, newData) => {
    try {
      const doc = {
        _id: instrumentId,
        type: 'instrument',
        name: newData.name,
        mimeType: newData.mimeType,
        referenceType: newData.referenceType,
        // Include any other necessary fields
      };

      // Handle file upload
      if (newData.audioData instanceof File) {
        doc._files = {
          [newData.audioData.name]: newData.audioData
        };
        doc.audioFile = newData.audioData.name;
      } else {
        // If it's not a new file, keep the existing audioFile value
        doc.audioFile = newData.audioData;
      }

      const putResponse = await database.put(doc);

    } catch (error) {
      console.error('Error updating track:', error);
    }
  }, [database]);

  return (
    <div className="pattern-set">
      {showNewTrackForm && (
        <TrackForm
          onSubmit={handleSubmitNewTrack}
          onCancel={handleCancelNewTrack}
          existingTrackNames={existingTrackNames}
        />
      )}
      {sortedInstrumentRecords.map((instrumentRecord) => (
        <Pattern
          key={instrumentRecord._id}
          instrumentId={instrumentRecord._id}
          instrument={instrumentRecord.name}
          audioFile={instrumentRecord.audioFile}
          mimeType={instrumentRecord.mimeType}
          referenceType={instrumentRecord.referenceType}
          _files={instrumentRecord._files}
          updateBeat={updateBeat}
          bpmDoc={bpmDoc}
          isMuted={trackSettings[instrumentRecord._id]?.muted || false}
          isSolo={trackSettings[instrumentRecord._id]?.soloed || false}
          anyTrackSoloed={anyTrackSoloed}
          masterMuted={masterMuted}
          onMuteToggle={() => handleMuteToggle(instrumentRecord._id)}
          onSoloToggle={() => handleSoloToggle(instrumentRecord._id)}
          onDeleteTrack={handleDeleteTrack}
          onNameChange={handleNameChange}
          isDefaultInstrument={DEFAULT_INSTRUMENTS.includes(instrumentRecord.name)}
          dbName={dbName}
          existingTrackNames={existingTrackNames}
          onVolumeChange={handleVolumeChange}
          initialVolume={trackSettings[instrumentRecord._id]?.volume || 100}
          onTrackChange={handleTrackChange}
          headStart_ms={headStart_ms}
        />
      ))}
    </div>
  );
};

export default PatternSet;
