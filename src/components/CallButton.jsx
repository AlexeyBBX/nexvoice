import React, { useState } from 'react';
import VideoCall from './VideoCall';

const CallButton = ({ targetUserId, targetUserName, isGroup = false, groupId, groupName }) => {
  const [isCallActive, setIsCallActive] = useState(false);

  const startCall = () => {
    setIsCallActive(true);
  };

  const endCall = () => {
    setIsCallActive(false);
  };

  const roomID = isGroup ? groupId : `${Math.min(targetUserId, parseInt(localStorage.getItem('userId') || '0'))}_${Math.max(targetUserId, parseInt(localStorage.getItem('userId') || '0'))}`;
  const userID = localStorage.getItem('userId') || 'user';
  const userName = localStorage.getItem('username') || 'User';

  return (
    <>
      <button className="call-btn" onClick={startCall}>
        <i className="fas fa-phone-alt"></i> {isGroup ? 'Начать звонок' : 'Позвонить'}
      </button>
      
      {isCallActive && (
        <VideoCall
          roomID={roomID}
          userID={userID}
          userName={userName}
          onClose={endCall}
          isGroupCall={isGroup}
        />
      )}
    </>
  );
};

export default CallButton;
