import React, { useState, useRef, useEffect } from 'react';
import '../TrackForm.css';

const ONOMATOPOEIC_WORDS = [
  // ... (insert the list of words here)
  "Beep", "Boing", "Buzz", "Chirp", "Clang", "Click", "Clink", "Ding", "Drip", "Fizz",
  "Honk", "Hum", "Ping", "Pop", "Quack", "Rattle", "Roar", "Sizzle", "Splash", "Squeak",
  "Thud", "Tick", "Vroom", "Whir", "Whoosh", "Zap", "Zoom", "Bam", "Bang", "Bark",
  "Boom", "Clap", "Crackle", "Crash", "Crunch", "Gurgle", "Hiccup", "Hiss", "Howl", "Knock",
  "Meow", "Moo", "Mumble", "Munch", "Murmur", "Pitter", "Patter", "Purr", "Rustle", "Screech",
  "Slurp", "Snap", "Sniff", "Snore", "Squish", "Swish", "Thump", "Tinkle", "Twang", "Whizz",
  "Wobble", "Yawn", "Zing", "Bonk", "Burp", "Chime", "Clatter", "Clip", "Clop", "Flick",
  "Flutter", "Giggle", "Jingle", "Plop", "Plunk", "Poof", "Pow", "Puff", "Rumble", "Scrape",
  "Smack", "Swoosh", "Taps", "Whack", "Whoop", "Yelp", "Boing"
];

function getSupportedMimeType() {
  const types = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4'];
  for (let type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null; // No supported type found
}

const RecordAudio = ({ onDataChange, onCancel, existingTrackNames, initialData }) => {
  const [name, setName] = useState(initialData ? initialData.name : '');
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mimeType = useRef(getSupportedMimeType());

  const generateInstrumentName = () => {
    // Pick a random word from the list
    let baseName = ONOMATOPOEIC_WORDS[Math.floor(Math.random() * ONOMATOPOEIC_WORDS.length)];
    
    // Check for duplicates and add incrementing integer if necessary
    let uniqueName = baseName;
    let counter = 2;
    while (existingTrackNames.includes(uniqueName.toLowerCase())) {
      const suffix = `-${counter}`;
      uniqueName = baseName.slice(0, 9 - suffix.length) + suffix;
      counter++;
    }
    
    return uniqueName;
  };

  useEffect(() => {
    if (isRecording && !name) {
      const generatedName = generateInstrumentName();
      setName(generatedName);
    }
  }, [isRecording, name, existingTrackNames]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    audioChunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: mimeType.current });
    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };
    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType.current });
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioURL(audioUrl);
    };
    mediaRecorderRef.current.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
    };
    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (audioURL && name) {
      fetch(audioURL)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `${name}.${mimeType.current.split('/')[1]}`, { type: mimeType.current });
          onDataChange(file, mimeType.current, 'database', name);
        });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="record-audio">
      <input 
        className="name-field"
        type="text" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        placeholder="Instrument Name"
        required
      />
      {!isRecording ? (
        <button type="button" onClick={startRecording} className="audio-option-button" aria-label="Start Recording">
          <span className="material-icons">mic</span>
        </button>
      ) : (
        <button type="button" onClick={stopRecording} className="audio-option-button" aria-label="Stop Recording">
          <span className="material-icons">stop</span>
        </button>
      )}
      {audioURL && (
        <audio 
          src={audioURL} 
          controls 
          onError={(e) => console.error('Audio playback error:', e)} 
        />
      )}
      <button type="submit" disabled={!audioURL || !name} className="audio-option-button" aria-label="Add Track">
        <span className="material-icons">check</span>
      </button>
      <button onClick={onCancel} className="cancel-button" role="button" tabIndex="0" aria-label="Cancel">
        <span className="material-icons">close</span>
      </button>
    </form>
  );
};

export default RecordAudio;
