import React, { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

const VoiceChannel = ({ channelId, serverId, serverName, channelName, userID, userName, onClose, socket }) => {
  const containerRef = useRef(null);
  const zpRef = useRef(null);
  const isActiveRef = useRef(false);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (isActiveRef.current) return;
    if (!containerRef.current) return;
    
    isActiveRef.current = true;

    console.log('🎵 Starting voice channel:', { channelId, serverName, channelName, userID, userName });

    const appID = Number(import.meta.env.VITE_ZEGO_APP_ID);
    const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET;

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      channelId,
      String(userID),
      userName
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zpRef.current = zp;

    // Сообщаем серверу о присоединении
    if (socket) {
      socket.emit('join_voice_channel', { channelId, serverId, userId: userID, userName });
      
      socket.on('voice_channel_update', (data) => {
        if (data.channelId === channelId) {
          setParticipants(data.participants || []);
        }
      });
    }

    zp.joinRoom({
      container: containerRef.current,
      scenario: {
        mode: ZegoUIKitPrebuilt.GroupCall,
      },
      showPreJoinView: false,
      showScreenSharingButton: true,
      showAudioVideoSettingsButton: true,
      turnOnMicrophoneWhenJoining: true,
      turnOnCameraWhenJoining: false,
      onLeave: () => {
        console.log('Left voice channel:', channelId);
        if (socket) {
          socket.emit('leave_voice_channel', { channelId, userId: userID, serverId });
        }
        if (onClose) onClose();
      },
      onError: (err) => {
        console.error('ZegoCloud error:', err);
      }
    });

    return () => {
      console.log('Cleaning up voice channel:', channelId);
      if (socket) {
        socket.emit('leave_voice_channel', { channelId, userId: userID, serverId });
        socket.off('voice_channel_update');
      }
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
        <div className="voice-channel-header">
          <div className="voice-channel-info">
            <span className="voice-channel-icon">🎤</span>
            <span className="voice-channel-name">{serverName} / {channelName}</span>
          </div>
          <div className="voice-channel-participants">
            <i className="fas fa-users"></i> {participants.length} участников
          </div>
          <button className="close-call-btn" onClick={() => {
            if (zpRef.current) {
              zpRef.current.destroy();
            }
            if (onClose) onClose();
          }}>✕</button>
        </div>
        <div ref={containerRef} style={{ width: '100%', height: 'calc(100% - 60px)' }} />
      </div>
    </div>
  );
};

export default VoiceChannel;
