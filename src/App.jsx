import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import VideoCall from './components/VideoCall';
import VoiceChannel from './components/VoiceChannel';
import './App.css';

const API_URL = '/api';
const SOCKET_URL = '';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPins, setShowPins] = useState(false);
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [serverInvites, setServerInvites] = useState([]);
  const [activeTab, setActiveTab] = useState('online');
  const [showProfile, setShowProfile] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateVoiceChannel, setShowCreateVoiceChannel] = useState(false);
  const [showEditChannel, setShowEditChannel] = useState(false);
  const [editChannelData, setEditChannelData] = useState(null);
  const [newServerName, setNewServerName] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newVoiceChannelName, setNewVoiceChannelName] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);
  const [voiceChannelParticipants, setVoiceChannelParticipants] = useState({});
  const [view, setView] = useState('servers');
  const [editingMessage, setEditingMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, message: null });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesContainerRef = useRef(null);
  const activeCallRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentChannelRef = useRef(null);

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + 
             date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (messagesContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 50 && currentChat) {
          markMessagesAsRead(currentChat.id);
        }
        if (scrollTop === 0 && !isLoadingMore && hasMoreMessages) {
          loadMoreMessages();
        }
      }
    };
    
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [currentChat, isLoadingMore, hasMoreMessages]);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ visible: false, x: 0, y: 0, message: null });
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (e, message) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      message: message
    });
  };

  const markMessagesAsRead = async (userId) => {
    try {
      await axios.post(`${API_URL}/messages/read`, { fromUserId: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCounts(prev => ({ ...prev, [userId]: 0 }));
      loadChats();
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    setIsLoadingMore(true);
    try {
      const offset = messages.length;
      const res = await axios.get(`${API_URL}/servers/${currentServer.id}/channels/${currentChannel}/messages?offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.length < 50) setHasMoreMessages(false);
      setMessages(prev => [...res.data, ...prev]);
    } catch (err) {
      console.error('Error loading more messages:', err);
    }
    setIsLoadingMore(false);
  };

  useEffect(() => {
    if (token) {
      loadUser();
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);
      newSocket.on('connect', () => newSocket.emit('authenticate', token));
      newSocket.on('server_invite', () => loadServerInvites());
      newSocket.on('friend_request', (data) => {
        loadFriendRequests();
        addNotification('Новая заявка', `${data.fromUsername} хочет добавить вас в друзья`);
      });
      newSocket.on('friend_accepted', () => {
        loadFriends();
        loadChats();
      });
      
      newSocket.on('private_message', (msg) => {
        if (currentChat && (msg.from_user === currentChat.id || msg.to_user === currentChat.id)) {
          setPrivateMessages(prev => [...prev, msg]);
        }
        loadChats();
        addNotification('Новое сообщение', `${msg.from_username}: ${msg.content.substring(0,50)}`);
        if (currentChat?.id !== msg.from_user) {
          setUnreadCounts(prev => ({ ...prev, [msg.from_user]: (prev[msg.from_user] || 0) + 1 }));
        }
      });
      
      newSocket.on('server_message', (msg) => {
        if (currentChannel && msg.channel_id === currentChannel) {
          setMessages(prev => [...prev, msg]);
        }
      });
      
      newSocket.on('message_edited', (data) => {
        setMessages(prev => prev.map(m => m.id === data.id ? { ...m, content: data.content, edited: true } : m));
        setPrivateMessages(prev => prev.map(m => m.id === data.id ? { ...m, content: data.content, edited: true } : m));
      });
      
      newSocket.on('message_deleted', (data) => {
        setMessages(prev => prev.filter(m => m.id !== data.id));
        setPrivateMessages(prev => prev.filter(m => m.id !== data.id));
      });
      
      newSocket.on('private_message_edited', (data) => {
        setPrivateMessages(prev => prev.map(m => m.id === data.id ? { ...m, content: data.content, edited: true } : m));
      });
      
      newSocket.on('private_message_deleted', (data) => {
        setPrivateMessages(prev => prev.filter(m => m.id !== data.id));
      });
      
      newSocket.on('user_typing', (data) => {
        setTypingUsers(prev => ({ ...prev, [data.fromUser]: data.isTyping }));
        setTimeout(() => {
          setTypingUsers(prev => ({ ...prev, [data.fromUser]: false }));
        }, 2000);
      });
      newSocket.on('incoming_call', (data) => {
        setIncomingCall(data);
        addNotification('Входящий звонок', `${data.fromUsername} звонит вам!`);
      });
      newSocket.on('call_ended', () => {
        activeCallRef.current = null;
        setActiveCall(null);
        setIncomingCall(null);
      });
      newSocket.on('voice_channel_update', (data) => {
        setVoiceChannelParticipants(prev => ({
          ...prev,
          [data.channelId]: data.participants || []
        }));
      });
      return () => newSocket.close();
    }
  }, [token, currentChat]);

  useEffect(() => {
    if (socket && currentChannel) {
      if (currentChannelRef.current) {
        socket.emit('leave_channel', currentChannelRef.current);
      }
      currentChannelRef.current = currentChannel;
      socket.emit('join_channel', currentChannel);
      loadMessages(currentChannel);
      loadPinnedMessages(currentChannel);
      setHasMoreMessages(true);
      setMessages([]);
    }
  }, [currentChannel, socket]);

  useEffect(() => {
    if (currentServer && currentChannel) {
      loadMessages(currentChannel);
      loadPinnedMessages(currentChannel);
    }
  }, [currentChannel, currentServer]);

  useEffect(() => {
    if (currentChat) {
      loadPrivateMessages(currentChat.id);
    }
  }, [currentChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, privateMessages]);

  const addNotification = (title, message) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, title, message }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const loadUser = async () => {
    const res = await axios.get(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUser(res.data);
    loadServers();
    loadFriends();
    loadFriendRequests();
    loadServerInvites();
    loadChats();
  };

  const loadServers = async () => {
    const res = await axios.get(`${API_URL}/servers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setServers(res.data);
    if (res.data.length > 0 && view === 'servers' && !currentServer) {
      setCurrentServer(res.data[0]);
      setChannels(res.data[0].channels || []);
      if (res.data[0].channels?.length) setCurrentChannel(res.data[0].channels[0].id);
      loadMembers(res.data[0].id);
    }
  };

  const loadMessages = async (channelId) => {
    if (!currentServer) return;
    const res = await axios.get(`${API_URL}/servers/${currentServer.id}/channels/${channelId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setMessages(res.data);
  };

  const loadPinnedMessages = async (channelId) => {
    if (!currentServer) return;
    try {
      const res = await axios.get(`${API_URL}/servers/${currentServer.id}/channels/${channelId}/pins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPinnedMessages(res.data);
    } catch (err) {
      console.error('Error loading pins:', err);
    }
  };

  const loadChats = async () => {
    const res = await axios.get(`${API_URL}/chats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setChats(res.data);
  };

  const loadPrivateMessages = async (userId) => {
    const res = await axios.get(`${API_URL}/messages/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setPrivateMessages(res.data);
  };

  const loadMembers = async (serverId) => {
    const res = await axios.get(`${API_URL}/servers/${serverId}/members`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setMembers(res.data);
  };

  const loadFriends = async () => {
    const res = await axios.get(`${API_URL}/friends`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setFriends(res.data);
  };

  const loadFriendRequests = async () => {
    const res = await axios.get(`${API_URL}/friends/requests`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setFriendRequests(res.data);
  };

  const loadServerInvites = async () => {
    const res = await axios.get(`${API_URL}/servers/invites`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setServerInvites(res.data);
  };

  const searchMessages = async (query) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      if (currentServer && currentChannel) {
        const res = await axios.get(`${API_URL}/servers/${currentServer.id}/channels/${currentChannel}/search?q=${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSearchResults(res.data);
      } else {
        const res = await axios.get(`${API_URL}/messages/search?q=${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSearchResults(res.data);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim()) return;
    
    const content = messageInput;
    setMessageInput('');
    
    if (currentServer && currentChannel) {
      await axios.post(`${API_URL}/servers/${currentServer.id}/channels/${currentChannel}/messages`,
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } else if (currentChat) {
      await axios.post(`${API_URL}/messages`,
        { toUserId: currentChat.id, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadChats();
    }
  };

  const editMessage = async (messageId, newContent) => {
    if (!newContent.trim()) return;
    if (currentServer && currentChannel) {
      await axios.put(`${API_URL}/servers/${currentServer.id}/channels/${currentChannel}/messages/${messageId}`,
        { content: newContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } else if (currentChat) {
      await axios.put(`${API_URL}/messages/${messageId}`,
        { content: newContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }
    setEditingMessage(null);
    setContextMenu({ visible: false, x: 0, y: 0, message: null });
  };

  const deleteMessage = async (messageId) => {
    if (confirm('Удалить сообщение?')) {
      if (currentServer && currentChannel) {
        await axios.delete(`${API_URL}/servers/${currentServer.id}/channels/${currentChannel}/messages/${messageId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (currentChat) {
        await axios.delete(`${API_URL}/messages/${messageId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setContextMenu({ visible: false, x: 0, y: 0, message: null });
    }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_URL}/upload-file`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    } catch (err) {
      console.error('Error uploading file:', err);
      addNotification('Ошибка', 'Не удалось загрузить файл');
      return null;
    }
  };

  const sendFile = async (file) => {
    addNotification('Загрузка', `Загрузка файла ${file.name}...`);
    const fileData = await uploadFile(file);
    if (!fileData) return;
    
    if (currentServer && currentChannel) {
      await axios.post(`${API_URL}/servers/${currentServer.id}/channels/${currentChannel}/files`,
        { fileUrl: fileData.url, fileType: fileData.fileType, fileName: fileData.fileName, content: `📎 ${fileData.fileName}` },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addNotification('Успех', `Файл ${file.name} отправлен!`);
    } else if (currentChat) {
      addNotification('Ошибка', 'Отправка файлов в личные сообщения пока не поддерживается');
    }
  };

  const sendTyping = (isTyping) => {
    if (currentChat && socket) {
      socket.emit('typing', { toUserId: currentChat.id, isTyping });
    }
  };

  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 1000);
  };

  const pinMessage = async (messageId) => {
    try {
      await axios.post(`${API_URL}/servers/${currentServer.id}/channels/${currentChannel}/messages/${messageId}/pin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadPinnedMessages(currentChannel);
      addNotification('Сообщение закреплено', '');
      setContextMenu({ visible: false, x: 0, y: 0, message: null });
    } catch (err) {
      console.error('Pin error:', err);
    }
  };

  const unpinMessage = async (messageId) => {
    try {
      await axios.delete(`${API_URL}/servers/${currentServer.id}/channels/${currentChannel}/messages/${messageId}/pin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadPinnedMessages(currentChannel);
    } catch (err) {
      console.error('Unpin error:', err);
    }
  };

  const searchUsers = async (query) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    const res = await axios.get(`${API_URL}/users/search?q=${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setSearchResults(res.data);
  };

  const sendFriendRequest = async () => {
    if (!friendUsername.trim()) {
      addNotification('Ошибка', 'Введите имя пользователя');
      return;
    }
    const usersRes = await axios.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const friend = usersRes.data.find(u => u.username === friendUsername);
    if (!friend) {
      addNotification('Ошибка', 'Пользователь не найден');
      return;
    }
    await axios.post(`${API_URL}/friends/request`, { friendId: friend.id }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    addNotification('Заявка отправлена', `Заявка отправлена пользователю ${friendUsername}`);
    setShowAddFriend(false);
    setFriendUsername('');
  };

  const acceptFriendRequest = async (fromUserId) => {
    await axios.post(`${API_URL}/friends/accept`, { fromUserId }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    loadFriends();
    loadFriendRequests();
    loadChats();
  };

  const rejectFriendRequest = async (fromUserId) => {
    await axios.post(`${API_URL}/friends/reject`, { fromUserId }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    loadFriendRequests();
  };

  const createServer = async () => {
    if (!newServerName.trim()) {
      addNotification('Ошибка', 'Введите название сервера');
      return;
    }
    await axios.post(`${API_URL}/servers`, { name: newServerName }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    loadServers();
    setShowCreateServer(false);
    setNewServerName('');
    addNotification('Сервер создан', `Сервер "${newServerName}" создан`);
  };

  const inviteToServer = async () => {
    if (!inviteUserId.trim()) {
      addNotification('Ошибка', 'Введите ID пользователя');
      return;
    }
    await axios.post(`${API_URL}/servers/${currentServer.id}/invite`,
      { userId: parseInt(inviteUserId) },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    addNotification('Приглашение отправлено', `Приглашение отправлено пользователю ${inviteUserId}`);
    setShowInviteUser(false);
    setInviteUserId('');
  };

  const acceptInvite = async (inviteId) => {
    await axios.post(`${API_URL}/servers/invites/${inviteId}/accept`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    loadServers();
    loadServerInvites();
  };

  const rejectInvite = async (inviteId) => {
    await axios.post(`${API_URL}/servers/invites/${inviteId}/reject`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    loadServerInvites();
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) {
      addNotification('Ошибка', 'Введите название канала');
      return;
    }
    await axios.post(`${API_URL}/servers/${currentServer.id}/channels`,
      { name: newChannelName, type: 'text' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    loadServers();
    setShowCreateChannel(false);
    setNewChannelName('');
    addNotification('Канал создан', `Канал "${newChannelName}" создан`);
  };

  const createVoiceChannel = async () => {
    if (!newVoiceChannelName.trim()) {
      addNotification('Ошибка', 'Введите название голосового канала');
      return;
    }
    await axios.post(`${API_URL}/servers/${currentServer.id}/voice-channels`,
      { name: newVoiceChannelName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    loadServers();
    setShowCreateVoiceChannel(false);
    setNewVoiceChannelName('');
    addNotification('Голосовой канал создан', `Голосовой канал "${newVoiceChannelName}" создан`);
  };

  const deleteChannel = async (channelId, channelName) => {
    if (confirm(`Удалить канал "${channelName}"?`)) {
      await axios.delete(`${API_URL}/servers/${currentServer.id}/channels/${channelId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadServers();
    }
  };

  const editChannel = async () => {
    if (!editChannelData || !editChannelData.newName.trim()) return;
    await axios.put(`${API_URL}/servers/${currentServer.id}/channels/${editChannelData.id}`,
      { name: editChannelData.newName, type: 'text' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    loadServers();
    setShowEditChannel(false);
    setEditChannelData(null);
  };

  const changeMemberRole = async (userId, role) => {
    await axios.put(`${API_URL}/servers/${currentServer.id}/members/${userId}/role`,
      { role },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    loadMembers(currentServer.id);
  };

  const kickMember = async (userId, username) => {
    if (confirm(`Выгнать ${username} с сервера?`)) {
      await axios.delete(`${API_URL}/servers/${currentServer.id}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadMembers(currentServer.id);
    }
  };

  const deleteServer = async () => {
    if (!currentServer) return;
    if (user?.id !== currentServer.owner_id) {
      addNotification('Ошибка', 'Только владелец может удалить сервер');
      return;
    }
    if (confirm(`Удалить сервер "${currentServer.name}"? Все каналы и сообщения будут удалены без возможности восстановления.`)) {
      try {
        await axios.delete(`${API_URL}/servers/${currentServer.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        addNotification('Сервер удалён', `Сервер "${currentServer.name}" удалён`);
        loadServers();
        setCurrentServer(null);
        setCurrentChannel(null);
        setShowServerSettings(false);
      } catch (err) {
        console.error('Error deleting server:', err);
        addNotification('Ошибка', 'Не удалось удалить сервер');
      }
    }
  };

  const updateAvatar = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await axios.post(`${API_URL}/upload-avatar`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setUser({ ...user, avatar: res.data.avatar });
        addNotification('Успех', 'Аватар обновлён!');
        loadServers();
        loadFriends();
        loadChats();
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
      addNotification('Ошибка', 'Не удалось загрузить аватар');
    }
  };

  const startCall = (targetUser) => {
    if (activeCallRef.current) return;
    if (socket && user) {
      const roomID = `${Math.min(user.id, targetUser.id)}_${Math.max(user.id, targetUser.id)}`;
      socket.emit('call_user', {
        targetUserId: targetUser.id,
        signal: { roomID, userID: user.id, userName: user.username }
      });
      activeCallRef.current = { targetUser, roomID };
      setActiveCall({ targetUser, roomID });
    }
  };

  const acceptCall = () => {
    if (activeCallRef.current) return;
    if (incomingCall && user) {
      const roomID = `${Math.min(user.id, incomingCall.from)}_${Math.max(user.id, incomingCall.from)}`;
      activeCallRef.current = { 
        targetUser: { id: incomingCall.from, username: incomingCall.fromUsername }, 
        roomID 
      };
      setActiveCall({ 
        targetUser: { id: incomingCall.from, username: incomingCall.fromUsername }, 
        roomID 
      });
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (incomingCall && socket) {
      socket.emit('call_rejected', { targetUserId: incomingCall.from });
      setIncomingCall(null);
    }
  };

  const endCall = () => {
    if (activeCall && socket) {
      socket.emit('end_call', { targetUserId: activeCall.targetUser.id });
    }
    activeCallRef.current = null;
    setActiveCall(null);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  const isOwner = currentServer && user && currentServer.owner_id === user.id;
  const isAdmin = isOwner || (members.find(m => m.id === user?.id)?.role === 'admin');

  const getAvatarUrl = (avatar, username) => {
    if (avatar && avatar !== '/default-avatar.png') return avatar;
    return `https://ui-avatars.com/api/?name=${username || 'U'}&background=6366f1&color=fff&size=128&rounded=true&bold=true`;
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1><i className="fas fa-headset"></i> NexVoice</h1>
          <input id="login-username" placeholder="Логин" />
          <input id="login-password" type="password" placeholder="Пароль" />
          <button onClick={async () => {
            const res = await axios.post(`${API_URL}/login`, {
              username: document.getElementById('login-username').value,
              password: document.getElementById('login-password').value
            });
            if (res.data.token) {
              localStorage.setItem('token', res.data.token);
              setToken(res.data.token);
            }
          }}><i className="fas fa-sign-in-alt"></i> Войти</button>
          <button onClick={async () => {
            const username = prompt('Имя:');
            const password = prompt('Пароль:');
            if (username && password) {
              const res = await axios.post(`${API_URL}/register`, { username, password });
              if (res.data.token) {
                localStorage.setItem('token', res.data.token);
                setToken(res.data.token);
              }
            }
          }}><i className="fas fa-user-plus"></i> Регистрация</button>
        </div>
      </div>
    );
  }

  const currentMessages = currentServer ? messages : privateMessages;
  const currentTitle = currentServer 
    ? `${currentServer.name} / ${channels.find(c => c.id === currentChannel)?.name || 'канал'}`
    : currentChat?.username || 'Личные сообщения';

  return (
    <div className={`app ${theme}`}>
      <div className="notifications">
        {notifications.map(n => (
          <div key={n.id} className="notification"><i className="fas fa-info-circle"></i> {n.title}: {n.message}</div>
        ))}
      </div>

      {incomingCall && (
        <div className="incoming-call-overlay">
          <div className="incoming-call-card">
            <h3><i className="fas fa-phone-alt"></i> Входящий звонок</h3>
            <p>{incomingCall.fromUsername} звонит вам</p>
            <div className="incoming-call-buttons">
              <button className="accept-call" onClick={acceptCall}><i className="fas fa-check"></i> Принять</button>
              <button className="reject-call" onClick={rejectCall}><i className="fas fa-times"></i> Отклонить</button>
            </div>
          </div>
        </div>
      )}

      {activeCall && activeCall.roomID && (
        <VideoCall
          key="video-call"
          roomID={activeCall.roomID}
          userID={String(user.id)}
          userName={user.username}
          onClose={endCall}
          isGroupCall={false}
        />
      )}

      {activeVoiceChannel && (
        <VoiceChannel
          key={activeVoiceChannel.channelId}
          channelId={activeVoiceChannel.channelId}
          serverId={activeVoiceChannel.serverId}
          serverName={activeVoiceChannel.serverName}
          channelName={activeVoiceChannel.channelName}
          userID={String(user.id)}
          userName={user.username}
          socket={socket}
          onClose={() => setActiveVoiceChannel(null)}
        />
      )}

      <div className="servers-bar">
        <div className={`server-icon dm-icon ${view === 'chats' ? 'active' : ''}`} onClick={() => {
          setView('chats');
          setCurrentServer(null);
          setCurrentChat(null);
          setCurrentChannel(null);
          loadChats();
        }}>
          <i className="fas fa-comment-dots"></i>
        </div>
        {servers.map(s => (
          <div key={s.id} className={`server-icon ${view === 'servers' && currentServer?.id === s.id ? 'active' : ''}`}
               onClick={() => {
                 setView('servers');
                 setCurrentServer(s);
                 setCurrentChat(null);
                 setChannels(s.channels || []);
                 if (s.channels?.length) setCurrentChannel(s.channels[0].id);
                 loadMembers(s.id);
               }}>
            <img src={getAvatarUrl(s.icon, s.name)} alt={s.name} />
          </div>
        ))}
        <div className="server-icon add-server" onClick={() => setShowCreateServer(true)}>
          <i className="fas fa-plus"></i>
        </div>
      </div>
      
      {view === 'servers' && currentServer ? (
        <div className="channels-panel">
          <div className="channels-header">
            <span>{currentServer.name}</span>
            <div className="channel-actions">
              <button className="settings-btn" onClick={() => setShowSearch(true)}><i className="fas fa-search"></i></button>
              <button className="settings-btn" onClick={() => setShowPins(!showPins)}><i className="fas fa-thumbtack"></i></button>
              <button className="settings-btn" onClick={() => setShowMembers(true)}><i className="fas fa-users"></i></button>
              <button className="settings-btn" onClick={() => setShowServerSettings(true)}><i className="fas fa-cog"></i></button>
            </div>
          </div>
          <div className="channels-list">
            {channels.map(c => (
              c.type === 'voice' ? (
                <div key={c.id} className={`channel voice-channel ${activeVoiceChannel?.channelId === c.id ? 'active' : ''}`}
                     onClick={() => {
                       if (activeVoiceChannel) {
                         setActiveVoiceChannel(null);
                       }
                       setActiveVoiceChannel({
                         channelId: c.id,
                         serverId: currentServer.id,
                         serverName: currentServer.name,
                         channelName: c.name
                       });
                     }}>
                  <span><i className="fas fa-volume-up"></i> {c.name}</span>
                  {(voiceChannelParticipants[c.id]?.length > 0) && (
                    <span className="voice-activity-badge">
                      <i className="fas fa-circle"></i> {voiceChannelParticipants[c.id].length}
                    </span>
                  )}
                  {activeVoiceChannel?.channelId === c.id && (
                    <span className="voice-active-badge"><i className="fas fa-microphone"></i> LIVE</span>
                  )}
                </div>
              ) : (
                <div key={c.id} className={`channel ${currentChannel === c.id ? 'active' : ''}`}
                     onClick={() => setCurrentChannel(c.id)}>
                  <span><i className="fas fa-hashtag"></i> {c.name}</span>
                  {isAdmin && (
                    <div className="channel-actions">
                      <button onClick={(e) => { e.stopPropagation(); setEditChannelData({ id: c.id, name: c.name, newName: c.name }); setShowEditChannel(true); }}><i className="fas fa-edit"></i></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteChannel(c.id, c.name); }}><i className="fas fa-trash"></i></button>
                    </div>
                  )}
                </div>
              )
            ))}
            {isAdmin && (
              <>
                <button className="add-channel" onClick={() => setShowCreateChannel(true)}><i className="fas fa-plus"></i> Текстовый канал</button>
                <button className="add-channel" onClick={() => setShowCreateVoiceChannel(true)}><i className="fas fa-microphone"></i> Голосовой канал</button>
              </>
            )}
          </div>
        </div>
      ) : view === 'chats' ? (
        <div className="channels-panel">
          <div className="channels-header">
            <span><i className="fas fa-comments"></i> Личные сообщения</span>
            <button className="settings-btn" onClick={() => setShowSearch(true)}><i className="fas fa-search"></i></button>
          </div>
          <div className="chats-list">
            {chats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.5)' }}>
                <i className="fas fa-comments" style={{ fontSize: 32, marginBottom: 10, display: 'block' }}></i>
                Нет диалогов<br />
                Начните общение с другом
              </div>
            ) : (
              chats.map(chat => (
                <div key={chat.user_id} className={`chat-item ${currentChat?.id === chat.user_id ? 'active' : ''}`}
                     onClick={() => {
                       setCurrentChat(chat);
                       setCurrentServer(null);
                       setCurrentChannel(null);
                       loadPrivateMessages(chat.id);
                     }}>
                  <img src={getAvatarUrl(chat.avatar, chat.username)} alt="" />
                  <div className="chat-info">
                    <span>{chat.username}</span>
                    <span className={`status-dot ${chat.status === 'online' ? 'online' : 'offline'}`}></span>
                    {chat.last_message && <div className="last-message">{chat.last_message.substring(0, 30)}</div>}
                  </div>
                  {chat.unread > 0 && <span className="unread-badge">{chat.unread}</span>}
                  <button className="call-chat-btn" onClick={(e) => {
                    e.stopPropagation();
                    startCall(chat);
                  }}><i className="fas fa-phone-alt"></i></button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
      
      <div className="chat-area">
        <div className="chat-header">
          <div><i className="fas fa-comment"></i> {currentTitle}</div>
          <div className="typing-status">
            {currentChat && typingUsers[currentChat.id] && <span><i className="fas fa-pencil-alt"></i> печатает...</span>}
          </div>
          <div className="chat-actions">
            <button className="settings-btn" onClick={toggleTheme}><i className="fas fa-palette"></i></button>
            {currentChat && (
              <button className="call-btn" onClick={() => startCall(currentChat)}>
                <i className="fas fa-phone-alt"></i> Позвонить
              </button>
            )}
            <button className="profile-btn" onClick={() => setShowProfile(true)}>
              <i className="fas fa-user-circle"></i>
            </button>
          </div>
        </div>
        
        {showPins && pinnedMessages.length > 0 && (
          <div className="pinned-messages">
            <div className="pins-header"><i className="fas fa-thumbtack"></i> Закреплённые сообщения</div>
            {pinnedMessages.map(msg => (
              <div key={msg.id} className="pinned-message">
                <span><strong>{msg.username}:</strong> {msg.content}</span>
                {isAdmin && <button onClick={() => unpinMessage(msg.id)}><i className="fas fa-times"></i></button>}
              </div>
            ))}
          </div>
        )}
        
        <div className="chat-messages" ref={messagesContainerRef}>
          {currentMessages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>
              <i className="fas fa-comment-dots" style={{ fontSize: 48, marginBottom: 16, display: 'block' }}></i>
              Напишите первое сообщение!
            </div>
          )}
          {currentMessages.map((msg, i) => (
            <div 
              key={i} 
              className={`message ${(msg.from_user === user?.id) ? 'own' : ''}`}
              onContextMenu={(e) => handleContextMenu(e, msg)}
            >
              {(msg.from_user !== user?.id) && (
                <img src={getAvatarUrl(msg.avatar, msg.from_username || msg.username)} alt="" />
              )}
              <div className="message-content">
                <div className="message-author"><i className="fas fa-user"></i> {msg.from_username || msg.username}</div>
                {editingMessage === msg.id ? (
                  <input 
                    type="text" 
                    defaultValue={msg.content} 
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        editMessage(msg.id, e.target.value);
                      }
                    }}
                    onBlur={(e) => editMessage(msg.id, e.target.value)}
                    autoFocus
                  />
                ) : (
                  <>
                    <div className="message-text">
                      {msg.file && (
                        <div className="file-attachment">
                          <i className="fas fa-paperclip"></i> 
                          <a href={msg.file} target="_blank" rel="noopener noreferrer">{msg.file_name || 'Файл'}</a>
                        </div>
                      )}
                      {msg.content}
                      {msg.edited && <span className="edited-badge"> (ред.)</span>}
                    </div>
                    <div className="message-time"><i className="far fa-clock"></i> {formatTime(msg.timestamp)}</div>
                  </>
                )}
              </div>
              {currentServer && isAdmin && msg.from_user !== user?.id && !editingMessage && (
                <button className="pin-btn" onClick={() => pinMessage(msg.id)}><i className="fas fa-thumbtack"></i></button>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="message-input">
          <label className="file-upload-btn">
            <i className="fas fa-paperclip"></i>
            <input type="file" onChange={async (e) => {
              if (e.target.files[0]) {
                await sendFile(e.target.files[0]);
                e.target.value = '';
              }
            }} style={{ display: 'none' }} />
          </label>
          <input 
            type="text" 
            placeholder="Введите сообщение..." 
            value={messageInput}
            onChange={handleTyping}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage}><i className="fas fa-paper-plane"></i></button>
        </div>
      </div>
      
      <div className="friends-panel">
        <div className="friends-header">
          <span><i className="fas fa-user-friends"></i> Друзья</span>
          <div className="search-box">
            <input type="text" placeholder="Поиск..." onChange={(e) => searchUsers(e.target.value)} />
          </div>
          <button className="add-friend-btn" onClick={() => setShowAddFriend(true)}><i className="fas fa-user-plus"></i></button>
        </div>
        <div className="friends-tabs">
          <div className={`tab ${activeTab === 'online' ? 'active' : ''}`} onClick={() => setActiveTab('online')}>
            <i className="fas fa-circle"></i> В сети
          </div>
          <div className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            <i className="fas fa-users"></i> Все
          </div>
          <div className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            <i className="fas fa-clock"></i> Заявки
            {friendRequests.length > 0 && <span className="badge">{friendRequests.length}</span>}
          </div>
          <div className={`tab ${activeTab === 'invites' ? 'active' : ''}`} onClick={() => setActiveTab('invites')}>
            <i className="fas fa-envelope"></i> Приглашения
            {serverInvites.length > 0 && <span className="badge">{serverInvites.length}</span>}
          </div>
        </div>
        <div className="friends-list">
          {activeTab === 'pending' && friendRequests.map(req => (
            <div key={req.from_user} className="friend-request">
              <img src={getAvatarUrl(req.avatar, req.username)} alt="" />
              <span>{req.username}</span>
              <button onClick={() => acceptFriendRequest(req.from_user)}><i className="fas fa-check"></i></button>
              <button onClick={() => rejectFriendRequest(req.from_user)}><i className="fas fa-times"></i></button>
            </div>
          ))}
          {activeTab === 'invites' && serverInvites.map(inv => (
            <div key={inv.id} className="server-invite">
              <div className="invite-info">
                <strong><i className="fas fa-server"></i> {inv.server_name}</strong>
                <small><i className="fas fa-user"></i> от {inv.from_username}</small>
              </div>
              <button onClick={() => acceptInvite(inv.id)}><i className="fas fa-check"></i></button>
              <button onClick={() => rejectInvite(inv.id)}><i className="fas fa-times"></i></button>
            </div>
          ))}
          {(activeTab === 'online' || activeTab === 'all') && (
            <>
              {searchResults.map(u => (
                <div key={u.id} className="friend-item">
                  <img src={getAvatarUrl(u.avatar, u.username)} alt="" />
                  <span>{u.username}</span>
                  <button onClick={() => sendFriendRequest(u.id)}><i className="fas fa-user-plus"></i></button>
                </div>
              ))}
              {!searchResults.length && friends.filter(f => activeTab === 'online' ? f.status === 'online' : true).map(f => (
                <div key={f.id} className="friend-item" onClick={() => {
                  setView('chats');
                  setCurrentChat(f);
                  setCurrentServer(null);
                  setCurrentChannel(null);
                  loadPrivateMessages(f.id);
                  loadChats();
                }}>
                  <img src={getAvatarUrl(f.avatar, f.username)} alt="" />
                  <div className="friend-info">
                    <div className="friend-name">{f.username}</div>
                    <div className="friend-status">{f.status === 'online' ? 'В сети' : 'Не в сети'}</div>
                  </div>
                  <span className={`status ${f.status}`}></span>
                  <button className="call-friend-btn" onClick={(e) => {
                    e.stopPropagation();
                    startCall(f);
                  }}><i className="fas fa-phone-alt"></i></button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      
      {/* Модальные окна */}
      {showSearch && (
        <div className="modal-overlay" onClick={() => setShowSearch(false)}>
          <div className="modal-content search-modal" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-search"></i> Поиск сообщений</h2>
            <input 
              type="text" 
              placeholder="Введите текст..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchMessages(e.target.value);
              }}
              autoFocus
            />
            <div className="search-results">
              {searchResults.map(msg => (
                <div key={msg.id} className="search-result">
                  <strong><i className="fas fa-user"></i> {msg.from_username || msg.username}</strong>
                  <p>{msg.content}</p>
                  <small><i className="far fa-clock"></i> {formatTime(msg.timestamp)}</small>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && <div>Ничего не найдено</div>}
            </div>
            <button onClick={() => setShowSearch(false)}><i className="fas fa-times"></i> Закрыть</button>
          </div>
        </div>
      )}
      
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-user-circle"></i> Профиль</h2>
            <div className="avatar-upload">
              <img src={getAvatarUrl(user?.avatar, user?.username)} alt="" />
              <label className="upload-btn">
                <i className="fas fa-camera"></i>
                <input type="file" accept="image/*" onChange={(e) => {
                  if (e.target.files[0]) updateAvatar(e.target.files[0]);
                }} />
              </label>
            </div>
            <p><strong><i className="fas fa-user"></i> Имя:</strong> {user?.username}</p>
            <p><strong><i className="fas fa-id-card"></i> ID:</strong> {user?.id}</p>
            <button onClick={logout}><i className="fas fa-sign-out-alt"></i> Выйти</button>
            <button onClick={() => setShowProfile(false)}><i className="fas fa-times"></i> Закрыть</button>
          </div>
        </div>
      )}
      
      {showServerSettings && (
        <div className="modal-overlay" onClick={() => setShowServerSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-cog"></i> Управление сервером</h2>
            <button onClick={() => setShowInviteUser(true)}><i className="fas fa-user-plus"></i> Пригласить друга</button>
            <button onClick={() => setShowCreateChannel(true)}><i className="fas fa-hashtag"></i> Создать текстовый канал</button>
            <button onClick={() => setShowCreateVoiceChannel(true)}><i className="fas fa-microphone"></i> Создать голосовой канал</button>
            {isOwner && (
              <button className="delete-server-btn" onClick={deleteServer}><i className="fas fa-trash"></i> Удалить сервер</button>
            )}
            <button onClick={() => {
              setShowMembers(true);
              setShowServerSettings(false);
            }}><i className="fas fa-users"></i> Участники</button>
            <button onClick={() => setShowServerSettings(false)}><i className="fas fa-times"></i> Закрыть</button>
          </div>
        </div>
      )}
      
      {showMembers && (
        <div className="modal-overlay" onClick={() => setShowMembers(false)}>
          <div className="modal-content members-list" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-users"></i> Участники сервера</h2>
            {members.map(m => (
              <div key={m.id} className="member-item">
                <img src={getAvatarUrl(m.avatar, m.username)} alt="" />
                <span><i className="fas fa-user"></i> {m.username}</span>
                <span className={`role ${m.role}`}>{m.role === 'owner' ? 'Владелец' : (m.role === 'admin' ? 'Админ' : 'Участник')}</span>
                {isOwner && m.id !== user?.id && (
                  <div className="member-actions">
                    <select onChange={(e) => changeMemberRole(m.id, e.target.value)} value={m.role}>
                      <option value="member">Участник</option>
                      <option value="admin">Админ</option>
                    </select>
                    <button onClick={() => kickMember(m.id, m.username)}><i className="fas fa-ban"></i></button>
                  </div>
                )}
                <button className="call-member-btn" onClick={() => startCall(m)}><i className="fas fa-phone-alt"></i></button>
              </div>
            ))}
            <button onClick={() => setShowMembers(false)}><i className="fas fa-times"></i> Закрыть</button>
          </div>
        </div>
      )}

      {/* Диалоговые окна */}
      {showCreateServer && (
        <div className="modal-overlay" onClick={() => setShowCreateServer(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-plus-circle"></i> Создать сервер</h2>
            <input 
              type="text" 
              placeholder="Название сервера" 
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createServer()}
              autoFocus
            />
            <button onClick={createServer}>Создать</button>
            <button onClick={() => setShowCreateServer(false)}>Отмена</button>
          </div>
        </div>
      )}

      {showAddFriend && (
        <div className="modal-overlay" onClick={() => setShowAddFriend(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-user-plus"></i> Добавить друга</h2>
            <input 
              type="text" 
              placeholder="Имя пользователя" 
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendFriendRequest()}
              autoFocus
            />
            <button onClick={sendFriendRequest}>Отправить заявку</button>
            <button onClick={() => setShowAddFriend(false)}>Отмена</button>
          </div>
        </div>
      )}

      {showInviteUser && (
        <div className="modal-overlay" onClick={() => setShowInviteUser(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-envelope"></i> Пригласить на сервер</h2>
            <input 
              type="number" 
              placeholder="ID пользователя" 
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && inviteToServer()}
              autoFocus
            />
            <button onClick={inviteToServer}>Пригласить</button>
            <button onClick={() => setShowInviteUser(false)}>Отмена</button>
          </div>
        </div>
      )}

      {showCreateChannel && (
        <div className="modal-overlay" onClick={() => setShowCreateChannel(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-hashtag"></i> Создать текстовый канал</h2>
            <input 
              type="text" 
              placeholder="Название канала" 
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createChannel()}
              autoFocus
            />
            <button onClick={createChannel}>Создать</button>
            <button onClick={() => setShowCreateChannel(false)}>Отмена</button>
          </div>
        </div>
      )}

      {showCreateVoiceChannel && (
        <div className="modal-overlay" onClick={() => setShowCreateVoiceChannel(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-microphone"></i> Создать голосовой канал</h2>
            <input 
              type="text" 
              placeholder="Название канала" 
              value={newVoiceChannelName}
              onChange={(e) => setNewVoiceChannelName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createVoiceChannel()}
              autoFocus
            />
            <button onClick={createVoiceChannel}>Создать</button>
            <button onClick={() => setShowCreateVoiceChannel(false)}>Отмена</button>
          </div>
        </div>
      )}

      {showEditChannel && editChannelData && (
        <div className="modal-overlay" onClick={() => setShowEditChannel(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2><i className="fas fa-edit"></i> Редактировать канал</h2>
            <input 
              type="text" 
              placeholder="Название канала" 
              value={editChannelData.newName}
              onChange={(e) => setEditChannelData({ ...editChannelData, newName: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && editChannel()}
              autoFocus
            />
            <button onClick={editChannel}>Сохранить</button>
            <button onClick={() => setShowEditChannel(false)}>Отмена</button>
          </div>
        </div>
      )}

      {/* Контекстное меню */}
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
        >
          {contextMenu.message?.from_user === user?.id && (
            <>
              <div className="context-menu-item" onClick={() => {
                setEditingMessage(contextMenu.message.id);
                setContextMenu({ visible: false, x: 0, y: 0, message: null });
              }}>
                <i className="fas fa-edit"></i> Редактировать
              </div>
              <div className="context-menu-item" onClick={() => deleteMessage(contextMenu.message.id)}>
                <i className="fas fa-trash"></i> Удалить
              </div>
            </>
          )}
          {currentServer && isAdmin && contextMenu.message?.from_user !== user?.id && (
            <div className="context-menu-item" onClick={() => pinMessage(contextMenu.message.id)}>
              <i className="fas fa-thumbtack"></i> Закрепить
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
