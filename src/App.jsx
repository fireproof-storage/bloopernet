import React, { useState, useEffect } from 'react';
import { useFireproof } from 'use-fireproof';
import { ConnectS3 } from '@fireproof/aws'
import { ConnectPartyKit } from '@fireproof/partykit'
import FlightBooking from './components/flightbooking/application';


// import TopControls from './components/TopControls';

import './App.css';

const partyCxs = new Map();
function partykitS3({ name, blockstore }, partyHost, refresh) {
  if (!name) throw new Error('database name is required')
  if (!refresh && partyCxs.has(name)) {
    return partyCxs.get(name)
  }
  const s3conf = { // example values, replace with your own by deploying https://github.com/fireproof-storage/valid-cid-s3-bucket
    upload: import.meta.env.VITE_S3PARTYUP,
    download: import.meta.env.VITE_S3PARTYDOWN
  }
  const s3conn = new ConnectS3(s3conf.upload, s3conf.download, '')
  s3conn.connectStorage(blockstore)

  if (!partyHost) {
    console.warn('partyHost not provided, using localhost:1999')
    partyHost = 'http://localhost:1999'
  }
  const connection = new ConnectPartyKit({ name, host: partyHost })
  connection.connectMeta(blockstore)
  partyCxs.set(name, connection)
  return connection
}


// const attendant = '🧑‍✈️'


function App() {

  const firstPathSegment = document.location.pathname.split('/')[1];  
  const dbName = (import.meta.env.VITE_DBNAME || 'flt-sv') + (firstPathSegment ? '-' + firstPathSegment : '');
  
  const { database, useLiveQuery } = useFireproof(dbName);

  const [isExpert, setIsExpert] = useState(false);
  const [theme, setTheme] = useState('dark');

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


  if (partyKitHost) {
    // const connection = 
    partykitS3(database, partyKitHost);
    // console.log("Connection", connection);
  } else {
    console.warn("No connection");
  }

  
  const result = useLiveQuery('type', { key: 'seat' });

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

  return (
      <div className={`app ${theme}`}>
        {/* <h1 className="app-title" {...longPressHandlers}>On Time Arrival</h1> */}
        {/* <TopControls dbName={dbName} isExpert={isExpert} toggleTheme={toggleTheme} theme={theme} /> */}
        <FlightBooking />
        {/* <AppInfo /> */}
      </div>
    
  );
}

export default App;

const AppInfo = () => (
  <footer>
    <p>
      <a href="https://github.com/fireproof-storage/bloopernet">Fork us on GitHub</a>, or try <a href="https://fireproof.storage">Fireproof</a>.
    </p>
  </footer>
);
