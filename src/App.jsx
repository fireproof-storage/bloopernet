import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter as Router, Route, Routes, Navigate, useParams, useNavigate } from 'react-router-dom';
import AudioMotionVisualizer from './components/AudioMotionVisualizer';
import { getAnalyserNode } from './audioUtils';
import { useFireproof } from 'use-fireproof';
import { connect } from '@fireproof/cloud';
import PatternSet from './components/PatternSet';
import TopControls from './components/TopControls';
import JamControls from './components/JamControls';
//import LatencySlider from './components/LatencySlider';
import { TimesyncProvider } from './TimesyncContext';
import { initLatencyCompensation } from './audioUtils';
import './App.css';
import InviteButton from './components/InviteButton';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';

function App() {
  const instruments = ['Kick', 'Snare', 'Hi-hat', 'Tom', 'Clap'];
  const { jamId } = useParams();
  const navigate = useNavigate();
  const [connectionUrl, setConnectionUrl] = useState('');

  // Truncate, sanitize, and validate jamId
  const truncatedJamId = jamId ? jamId.slice(0, 40) : '';
  const sanitizedJamId = truncatedJamId.replace(/[^a-zA-Z0-9-]/g, '');
  const isValidJamId = /^[a-zA-Z0-9-]+$/.test(sanitizedJamId);

  useEffect(() => {
    // Redirect to root if jamId is invalid or if the path is neither root nor a valid /jam/* path
    if ((jamId && !isValidJamId) || (jamId != sanitizedJamId) || (sanitizedJamId && window.location.pathname !== '/' && !window.location.pathname.startsWith('/jam/'))) {
      navigate('/', { replace: true });
    }
  }, [jamId, isValidJamId, navigate]);

  // Construct the database name based on the jamId
  const firstPathSegment = document.location.pathname.split('/')[1];
  const baseDbName = 'bbxx' + (firstPathSegment ? '-' + firstPathSegment : '');
  const dbName = isValidJamId ? `${baseDbName}-${sanitizedJamId}` : baseDbName;

  console.log("db-Name", dbName);

  const { database, useLiveQuery } = useFireproof(dbName, {public: true});
  
  useEffect(() => {
    const connectToDatabase = async () => {
      const connection = await connect(database, `xxbb.${dbName}`);
      setConnectionUrl(connection.dashboardUrl.toString());
    };
    connectToDatabase();
  }, [database, dbName]);

  const [isExpert, setIsExpert] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [visualsEnabled, setVisualsEnabled] = useState(() => {
    const saved = localStorage.getItem('visualsEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [analyserNode, setAnalyserNode] = useState(null);

  const toggleExpert = () => {
    setIsExpert(!isExpert);
  };

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const handleLongPress = (callback, duration = 500) => {
    let timer;
    const start = () => {
      timer = setTimeout(callback, duration);
    };
    const clear = () => {
      clearTimeout(timer);
    };

    return {
      onTouchStart: start,
      onTouchEnd: clear,
      onTouchMove: clear,
      onMouseDown: start,
      onMouseUp: clear,
      onMouseLeave: clear
    };
  };

  const longPressHandlers = handleLongPress(toggleExpert);

  const partyKitHost = import.meta.env.VITE_REACT_APP_PARTYKIT_HOST;

  useEffect(() => {
    initLatencyCompensation();
  }, []);

  useEffect(() => {
    // If there's a path that's not / or /jam/*, redirect to /
    if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/jam/')) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  let beats = {};
  const result = useLiveQuery('type', { key: 'beat' });
  result.rows.forEach(row => {
    beats[row.doc._id] = row.doc.isActive;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Fix for mobile viewport height
    const appHeight = () => {
      const doc = document.documentElement;
      doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    window.addEventListener('resize', appHeight);
    appHeight();
    return () => window.removeEventListener('resize', appHeight);
  }, []);

  useEffect(() => {
    // Get the analyserNode from audioUtils
    const analyser = getAnalyserNode();
    setAnalyserNode(analyser);
  }, []);

  const toggleVisuals = () => {
    setVisualsEnabled(prev => {
      const newState = !prev;
      localStorage.setItem('visualsEnabled', JSON.stringify(newState));
      return newState;
    });
  };

  const [newInstrumentId, setNewInstrumentId] = useState(null);

  const [tempTrack, setTempTrack] = useState(null);

  const addTemporaryTrack = useCallback(() => {
    const newId = `temp-${uuidv4()}`;
    setTempTrack({
      id: newId,
      name: '',
      audioFile: ''
    });
  }, []);

  // const handleAddTrack = useCallback(async () => {
  //   const newName = 'New Instrument';
  //   const newId = `${newName.toLowerCase()}-${uuidv4()}`;
  //   const newInstrument = {
  //     _id: newId,
  //     type: 'instrument',
  //     name: newName,
  //     createdAt: new Date().toISOString(),
  //     audioFile: '/sounds/default.wav' // You might want to change this to a default sound
  //   };

  //   await database.put(newInstrument);
  //   setNewInstrumentId(newId);
  // }, [database]);

  const [showNewTrackForm, setShowNewTrackForm] = useState(false);

  const handleAddTrack = () => {
    setShowNewTrackForm(true);
  };

  const handleCancelNewTrack = () => {
    setShowNewTrackForm(false);
  };

  return (
    <TimesyncProvider partyKitHost={partyKitHost}>
      <div className={`app ${theme}`}>
        <AudioMotionVisualizer
          analyserNode={analyserNode}
          visualsEnabled={visualsEnabled}
        />
        <div className="app-content" style={{ height: 'var(--app-height)' }}>
          <h1 className="app-title" {...longPressHandlers}>Bloopernet FP-808</h1>
          <JamControls />
          <TopControls
            dbName={dbName}
            isExpert={isExpert}
            toggleTheme={toggleTheme}
            theme={theme}
            toggleVisuals={toggleVisuals}
            visualsEnabled={visualsEnabled}
            onAddTrack={handleAddTrack}
          />
          <PatternSet
            dbName={dbName}
            instruments={instruments}
            beats={beats}
            newInstrumentId={newInstrumentId}
            setNewInstrumentId={setNewInstrumentId}
            tempTrack={tempTrack}
            setTempTrack={setTempTrack}
            showNewTrackForm={showNewTrackForm}
            onCancelNewTrack={handleCancelNewTrack}
          />
          <AppInfo connectionUrl={connectionUrl} />
          <InviteButton />
        </div>
      </div>
    </TimesyncProvider>
  );
}

function RoutedApp() {
  return (
    <Router>
      <Routes>
        <Route path="/jam/:jamId" element={<App />} />
        <Route path="/" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default RoutedApp;

const AppInfo = ({ connectionUrl }) => (
  <footer>
    <QRCodeSVG value={document.location.href} />
    <p>
      <a href="https://github.com/fireproof-storage/bloopernet">Fork us on GitHub</a>, try <a target="_blank" href={connectionUrl || "https://fireproof.storage"}>Fireproof</a>, and learn more about the <a href="https://bikeportland.org/2024/06/14/bloops-and-bleeps-ride-gives-cycling-new-sounds-387546">Bloopernet Project</a>.
    </p>    
  </footer>
);

AppInfo.propTypes = {
  connectionUrl: PropTypes.string.isRequired
};