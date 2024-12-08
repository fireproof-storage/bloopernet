import React, { useState, useRef, useEffect } from 'react';
import '../TrackForm.css';

const UploadAudio = ({ onDataChange, onCancel, existingTrackNames, initialData }) => {
  const [name, setName] = useState(initialData ? initialData.name : '');
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const generateInstrumentName = (fileName) => {
    // Remove file extension
    let baseName = fileName.split('.').slice(0, -1).join('.');
    
    // Remove leading illegal characters and truncate at first illegal character after legal ones
    baseName = baseName.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9].*$/, '');
    
    // Limit to 9 characters
    baseName = baseName.slice(0, 9);
    
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
    if (file && !name) {
      const generatedName = generateInstrumentName(file.name);
      setName(generatedName);
    }
  }, [file, name, existingTrackNames]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (file && name) {
      onDataChange(file, file.type, 'database', name);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="upload-audio">
      <input 
				className="name-field"
        type="text" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        placeholder="Instrument Name"
        required
      />
      <input 
        type="file" 
        onChange={handleFileChange} 
        ref={fileInputRef}
        accept="audio/*"
        required
      />
      {file && <span>{file.name}</span>}
      <button type="submit" disabled={!file || !name} className="audio-option-button" aria-label="Add Track">
        <span className="material-icons">check</span>
      </button>
      <button onClick={onCancel} className="cancel-button" role="button" tabIndex="0" aria-label="Cancel">
        <span className="material-icons">close</span>
      </button>
    </form>
  );
};

export default UploadAudio;
