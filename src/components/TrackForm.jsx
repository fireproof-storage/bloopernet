import React, { useState } from 'react';
import './TrackForm.css';
import LinkAudio from './AudioOptions/LinkAudio';
import UploadAudio from './AudioOptions/UploadAudio';
import RecordAudio from './AudioOptions/RecordAudio';

const TrackForm = ({ onSubmit, onCancel, existingTrackNames, initialData = null }) => {
  const [audioOption, setAudioOption] = useState(null);

  const handleAudioDataChange = (data, type, reference, name) => {
    onSubmit({ name, audioData: data, mimeType: type, referenceType: reference });
  };

  const renderAudioOption = () => {
    const commonProps = {
      onDataChange: handleAudioDataChange,
      onCancel: () => setAudioOption(null),
      existingTrackNames,
      initialData
    };

    switch (audioOption) {
      case 'link':
        return <LinkAudio {...commonProps} />;
      case 'upload':
        return <UploadAudio {...commonProps} />;
      case 'record':
        return <RecordAudio {...commonProps} />;
      default:
        return (
          <div className="audio-options">
            <button onClick={() => setAudioOption('link')} className="audio-option-button" role="button" tabIndex="0" aria-label="Link Audio">
              <span className="material-icons">link</span>
            </button>
            <button onClick={() => setAudioOption('upload')} className="audio-option-button" role="button" tabIndex="0" aria-label="Upload Audio">
              <span className="material-icons">upload_file</span>
            </button>
            <button onClick={() => setAudioOption('record')} className="audio-option-button" role="button" tabIndex="0" aria-label="Record Audio">
              <span className="material-icons">mic</span>
            </button>
						<button onClick={onCancel} className="cancel-button" role="button" tabIndex="0" aria-label="Cancel">
							<span className="material-icons">close</span>
						</button>
          </div>
        );
    }
  };

  return (
    <div className="track-form">
      {renderAudioOption()}
    </div>
  );
};

export default TrackForm;
