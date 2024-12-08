import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter as Router, Route, Routes, Navigate, useParams, useNavigate } from 'react-router-dom';
import AudioMotionVisualizer from './components/AudioMotionVisualizer';
import { getAnalyserNode, getDefaultLatency, isMasterMuted, setMasterMute } from './utils';
import { useFireproof } from 'use-fireproof';
import { connect } from '@fireproof/cloud';
import PatternSet from './components/PatternSet';
import TopControls from './components/TopControls';
import JamControls from './components/JamControls';
import { TimesyncProvider } from './TimesyncContext';
import './App.css';
import InviteButton from './components/InviteButton';
import { useWakeLock } from 'react-screen-wake-lock';

function App() {
  const instruments = ['Kick', 'Snare', 'Hi-hat', 'Tom', 'Clap'];
  const { jamId } = useParams();
  const navigate = useNavigate();
  
  const [connectionUrl, setConnectionUrl] = useState('');

  //////////////////////////////////////////////////////////////////////////////
  // URL path & Jam ID handling:
  //////////////////////////////////////////////////////////////////////////////

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

  useEffect(() => {
    // If there's a path that's not / or /jam/*, redirect to /
    if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/jam/')) {
      navigate('/', { replace: true });
    }
  }, [navigate]);


  //////////////////////////////////////////////////////////////////////////////
  // Database setup:
  //////////////////////////////////////////////////////////////////////////////
  // Construct the database name based on the jamId
  const firstPathSegment = document.location.pathname.split('/')[1];
  const baseDbName = (import.meta.env.VITE_DBNAME || 'blx') + (firstPathSegment ? '-' + firstPathSegment : '');
  const dbName = isValidJamId ? `${baseDbName}-${sanitizedJamId}` : baseDbName;

  console.log("dbName", dbName);

  // connect to the database
  const { database, useLiveQuery } = useFireproof(dbName, {public: true});
  
  useEffect(() => {
    const connectToDatabase = async () => {
      const connection = await connect(database, `blx.${dbName}`);
      setConnectionUrl(connection.dashboardUrl.toString());
    };
    connectToDatabase();
  }, [database, dbName]);

  // // connect to the partykit server
  // const partyKitHost = import.meta.env.VITE_REACT_APP_PARTYKIT_HOST;
  // if (partyKitHost) {
  //   const connection = partykitS3(database, partyKitHost);
  //   console.log("Connection", connection);
  // } else {
  //   console.warn("No connection");
  // }

  //////////////////////////////////////////////////////////////////////////////
  // Head start calculation for latency compensation:
  //////////////////////////////////////////////////////////////////////////////
  let minimumHeadStart_ms = 200; 
  const [headStart_ms, setHeadStart_ms] = useState(0);
  const [localLatency, setLocalLatency] = useState(getDefaultLatency());
  // Fetch all device records to calculate head start based on the max latency
  // const devices = useLiveQuery('type', { key: 'device' });

  useEffect(() => {
    // if (devices) {
    //   const maxLatency = Math.max(...devices.docs.map(device => device.latency || 0));

      // This is the sophisticated way where the faster devices slow down to the speed of the slowest device
      // const newHeadStart = Math.floor(Math.max(maxLatency - localLatency))+minimumHeadStart_ms ;
      // unfortunately the other clients can stutter a lot when that happen, so one user can screw everyone else.

      // This is the simpler way where the slow devices slow down even more, to sync with the previous step
      const newHeadStart = localLatency+minimumHeadStart_ms ;

      setHeadStart_ms(newHeadStart);
      // console.log("newHeadStart: ", newHeadStart);
    // }
  //}, [devices, localLatency]);
  }, [localLatency]);

  const updateLocalLatency = useCallback((newLatency) => {
    setLocalLatency(newLatency);
  }, []);


  //////////////////////////////////////////////////////////////////////////////
  // UI state:
  //////////////////////////////////////////////////////////////////////////////

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
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleVisuals = () => {
    setVisualsEnabled(prev => {
      const newState = !prev;
      localStorage.setItem('visualsEnabled', JSON.stringify(newState));
      return newState;
    });
  };

  //////////////////////////////////////////////////////////////////////////////
  // Beat state:
  //////////////////////////////////////////////////////////////////////////////

  //////////////////////////////////////////////////////////////////////////////
  // Analyser node:
  //////////////////////////////////////////////////////////////////////////////  
  // TODO: audiovisualizer should fetch this itself
  useEffect(() => {
    // Get the analyserNode from audioUtils
    const analyser = getAnalyserNode();
    setAnalyserNode(analyser);
  }, []);


  //////////////////////////////////////////////////////////////////////////////
  // New track form (pass click from TopControls to ui in PatternSet):
  //////////////////////////////////////////////////////////////////////////////  
  const [showNewTrackForm, setShowNewTrackForm] = useState(false);

  const handleAddTrack = () => {
    setShowNewTrackForm(true);
  };

  const handleCancelNewTrack = () => {
    setShowNewTrackForm(false);
  };

  //////////////////////////////////////////////////////////////////////////////
  // Wake lock:
  //////////////////////////////////////////////////////////////////////////////
  const { isSupported, request, release } = useWakeLock();
  const [wakeLock, setWakeLock] = useState(null);

  const [masterMuted, setMasterMuted] = useState(isMasterMuted());

  const handleMuteToggle = useCallback((newMutedState) => {
    setMasterMuted(newMutedState);
    setMasterMute(newMutedState);
  }, []);

  const bpmResult = useLiveQuery('type', { key: 'bpm' });
  const bpmDoc = bpmResult.rows[0]?.doc;
  const playing = bpmDoc?.playing;

  useEffect(() => {
    const handleWakeLock = async () => {
      if (isSupported && playing && !masterMuted) {
        try {
          await request('screen');
          setWakeLock(true);
        } catch (err) {
          console.error('Failed to request wake lock:', err);
        }
      } else if (wakeLock) {
        release();
        setWakeLock(null);
      }
    };

    handleWakeLock();
  }, [isSupported, request, release, playing, masterMuted]);

  useEffect(() => {
    return () => {
      if (wakeLock) {
        release();
      }
    };
  }, [wakeLock, release]);

  console.log("App rerender");
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
            headStart_ms={headStart_ms}
            updateLocalLatency={updateLocalLatency}
            masterMuted={masterMuted}
            onMuteToggle={handleMuteToggle}
          />
          <PatternSet 
            dbName={dbName} 
            instruments={instruments} 
            showNewTrackForm={showNewTrackForm}
            onCancelNewTrack={handleCancelNewTrack}
            headStart_ms={headStart_ms}
            masterMuted={masterMuted}
          />
          <AppInfo connectionUrl={connectionUrl} />
          <InviteButton />
          {isSupported && wakeLock && (
            <div className="wake-lock-indicator">
              <span className="material-icons">visibility</span>
            </div>
          )}
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
    <p>
      <a href="https://github.com/fireproof-storage/bloopernet">Fork us on GitHub</a>, try <a href="https://fireproof.storage">Fireproof</a>, and learn more about the <a href="https://bikeportland.org/2024/06/14/bloops-and-bleeps-ride-gives-cycling-new-sounds-387546">Bloopernet Project</a>.
    </p>
    {connectionUrl && (
      <p>
        <a href={connectionUrl}>Inspect database</a>
      </p>
    )}
  </footer>
);

AppInfo.propTypes = {
  connectionUrl: PropTypes.string.isRequired
};
