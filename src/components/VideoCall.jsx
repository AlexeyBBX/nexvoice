import React, { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

const VideoCall = ({ roomID, userID, userName, onClose, isGroupCall = false }) => {
  const containerRef = useRef(null);
  const zpRef = useRef(null);
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (isActiveRef.current) {
      console.log('Call already active, skipping init');
      return;
    }
    
    if (!containerRef.current) return;
    
    isActiveRef.current = true;

    console.log('🎵 Starting call:', { roomID, userID, userName });

    const appID = Number(import.meta.env.VITE_ZEGO_APP_ID);
    const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET;

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      roomID,
      userID,
      userName
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zpRef.current = zp;

    zp.joinRoom({
      container: containerRef.current,
      scenario: {
        mode: isGroupCall ? ZegoUIKitPrebuilt.GroupCall : ZegoUIKitPrebuilt.OneONoneCall,
      },
      showPreJoinView: false,
      showScreenSharingButton: true,   // Включаем демонстрацию экрана
      showAudioVideoSettingsButton: true,
      turnOnMicrophoneWhenJoining: true,
      turnOnCameraWhenJoining: false,
      onLeave: () => {
        console.log('Left call:', roomID);
        if (onClose) onClose();
      },
      onError: (err) => {
        console.error('ZegoCloud error:', err);
      }
    });

    return () => {
      console.log('Component unmounting, cleaning up');
      if (zpRef.current) {
        try {
          zpRef.current.destroy();
        } catch (e) {
          console.error('Destroy error:', e);
        }
        zpRef.current = null;
      }
      isActiveRef.current = false;
    };
  }, []);

  return (
    <div className="video-call-overlay">
      <div className="video-call-container">
        <button 
          className="close-call-btn" 
          onClick={() => {
            if (zpRef.current) {
              zpRef.current.destroy();
            }
            if (onClose) onClose();
          }}
        >
          ✕
        </button>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default VideoCall;
