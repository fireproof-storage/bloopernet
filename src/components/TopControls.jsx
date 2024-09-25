import React from 'react';
import { useFireproof } from 'use-fireproof';
import Button from '@mui/material/Button';

const TopControls = () => {
  const { database } = useFireproof();

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

  const handleNuke = async () => {
    try {
      // Get all documents
      const allDocs = await database.allDocs({ include_docs: true });
      
      // Filter for beat documents by _id format
      const beatDocs = allDocs.rows.filter(row => row.value.beatIndex != undefined);
      
      // Delete all beat documents
      const deletePromises = beatDocs.map(row => database.del(row.key));
      
      await Promise.all(deletePromises);
      console.log(`All beats nuked (deleted). Total: ${beatDocs.length}`);
    } catch (error) {
      console.error('Error nuking beats:', error);
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <Button variant="contained" onClick={handleClear} style={{ marginRight: '10px' }}>Clear</Button>
      <Button variant="contained" color="error" onClick={handleNuke}>Nuke</Button>
    </div>
  );
};

export default TopControls;