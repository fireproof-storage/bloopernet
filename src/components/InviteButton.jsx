import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const InviteButton = () => {
  // const [showQR, setShowQR] = useState(false);

  const toggleQR = () => {
    // setShowQR(!showQR);
  };

  const currentUrl = window.location.href;

  return (
    <div className="invite-container">
      {/* {showQR ? ( */}
        <div className="qr-code" onClick={toggleQR}>
          <QRCodeSVG value={currentUrl} size={200} />
        </div>
      {/* ) : ( */}
      {/*   <button className="control-button invite-button" onClick={toggleQR}> */}
      {/*     Join */}
      {/*   </button> */}
      {/* )} */}
    </div>
  );
};

export default InviteButton;
