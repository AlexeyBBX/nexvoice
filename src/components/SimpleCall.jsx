import React, { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

const SimpleCall = ({ onClose }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const appID = Number(import.meta.env.VITE_ZEGO_APP_ID);
    const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET;
    const roomID = 'test_room_' + Date.now();
    const userID = 'user_' + Math.floor(Math.random() * 10000);
    const userName = 'TestUser';

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID, serverSecret, roomID, userID, userName
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);
    
    zp.joinRoom({
      container: containerRef.current,
      scenario: { mode: ZegoUIKitPrebuilt.GroupCall },
      showPreJoinView: true,
      turnOnMicrophoneWhenJoining: true,
      turnOnCameraWhenJoining: false,
      onLeave: () => {
        if (onClose) onClose();
      }
    });

    return () => {
      zp.destroy();
    };
  }, []);

  return (
    <div className="video-call-overlay">
      <div className="video-call-container">
        <button className="close-call-btn" onClick={onClose}>✕</button>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default SimpleCall;
