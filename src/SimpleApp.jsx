import React, { useState, useEffect } from 'react';
import axios from 'axios';

function SimpleApp() {
  const [users, setUsers] = useState([]);
  const [chatHistories, setChatHistories] = useState([]);
  const [allUserChats, setAllUserChats] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [usersForSelectedDate, setUsersForSelectedDate] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDatabase, setCurrentDatabase] = useState('somnusuat');
  const [viewMode, setViewMode] = useState('date-first'); // 'user-first' or 'date-first'
  const [datesLoading, setDatesLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authToken, setAuthToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // API URLs that work in both development and production
  const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const isVercel = window.location.hostname.includes('vercel.app');
  const isRailway = window.location.hostname.includes('railway.app');
  
  let API_BASE;
  if (!isProduction) {
    API_BASE = 'http://localhost:3001'; // Development
  } else if (isRailway) {
    API_BASE = ''; // Railway (same domain)
  } else {
    // Vercel frontend should call Railway backend
    API_BASE = 'https://web-production-39528.up.railway.app'; 
  }
    
  const API_URL = `${API_BASE}/api/mongodb`;
  const AUTH_URL = `${API_BASE}/api/auth/login`;
  
  console.log('Environment:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
  console.log('API_URL:', API_URL);
  console.log('AUTH_URL:', AUTH_URL);

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = authToken || localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Check for existing session on component mount
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      setAuthToken(savedToken);
      setIsAuthenticated(true);
    } else {
      // If no token, ensure loading is false so login screen appears
      setLoading(false);
    }
  }, []);

  // Handle secure authentication
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const response = await axios.post(AUTH_URL, {
        password: authPassword
      });

      if (response.data.success) {
        setAuthToken(response.data.token);
        setIsAuthenticated(true);
        setAuthError('');
        setAuthPassword(''); // Clear password after successful login
        
        // Store token in localStorage for session persistence
        localStorage.setItem('authToken', response.data.token);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        setAuthError(error.response.data.error || 'Authentication failed');
      } else {
        setAuthError('Network error. Please try again.');
      }
      setAuthPassword('');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthPassword('');
    setAuthError('');
    setAuthToken(null);
    
    // Remove token from localStorage
    localStorage.removeItem('authToken');
    
    // Clear all data on logout for security
    setUsers([]);
    setChatHistories([]);
    setAllUserChats([]);
    setSelectedUser(null);
    setSelectedDate(null);
    setAvailableDates([]);
    setUsersForSelectedDate([]);
    setUserSearchTerm('');
  };

  // Get excluded user's userID
  const getExcludedUserID = async () => {
    try {
      const response = await axios.post(API_URL, {
        database: currentDatabase,
        action: 'find',
        collection: 'users',
        filter: { email: 'nadeem@naptick.com' },
        limit: 1,
      }, {
        headers: getAuthHeaders()
      });
      const excludedUser = response.data.documents?.[0];
      return excludedUser ? excludedUser.userID : null;
    } catch (error) {
      console.error('Error fetching excluded user:', error);
      return null;
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      const response = await axios.post(API_URL, {
        database: currentDatabase,
        action: 'find',
        collection: 'users',
        sort: { createdAt: -1 },
      }, {
        headers: getAuthHeaders()
      });
      // Filter out the specific user
      const allUsers = response.data.documents || [];
      const filteredUsers = allUsers.filter(user => 
        user.email !== 'nadeem@naptick.com'
      );
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  // Fetch chat histories
  const fetchChatHistories = async (userID = null) => {
    try {
      setLoading(true);
      const filter = userID ? { userID } : {};
      
      const response = await axios.post(API_URL, {
        database: currentDatabase,
        action: 'find',
        collection: 'chathistories',
        filter,
        sort: { updatedAt: -1 },
        limit: userID ? 200 : 20, // Get more chats for selected user
      }, {
        headers: getAuthHeaders()
      });
      
      const allChats = response.data.documents || [];
      
      // Filter out chats from the excluded user (get userID from users array)
      const excludedUser = await getExcludedUserID();
      const chats = allChats.filter(chat => chat.userID !== excludedUser);
      
      if (userID) {
        // Store all user chats and extract dates
        setAllUserChats(chats);
        extractAvailableDates(chats);
        setChatHistories(chats); // Show all initially
      } else {
        setChatHistories(chats);
        setAllUserChats([]);
        setAvailableDates([]);
      }
    } catch (error) {
      console.error('Error fetching chat histories:', error);
      setChatHistories([]);
      setAllUserChats([]);
      setAvailableDates([]);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique dates from chat histories
  const extractAvailableDates = (chats) => {
    const dateMap = {};
    
    chats.forEach(chat => {
      if (chat.chatHistory && Array.isArray(chat.chatHistory)) {
        chat.chatHistory.forEach(message => {
          const messageDate = new Date(message.createdAt);
          const dateStr = messageDate.toISOString().split('T')[0]; // YYYY-MM-DD
          const displayDate = messageDate.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
          
          if (!dateMap[dateStr]) {
            dateMap[dateStr] = {
              dateStr,
              displayDate,
              count: 0,
              timestamp: messageDate.getTime()
            };
          }
          dateMap[dateStr].count++;
        });
      }
    });
    
    // Sort dates in descending order
    const sortedDates = Object.values(dateMap).sort((a, b) => b.timestamp - a.timestamp);
    setAvailableDates(sortedDates);
  };

  // Filter chats by selected date
  const filterChatsByDate = (dateStr) => {
    if (!dateStr) {
      setChatHistories(allUserChats);
      return;
    }
    
    const filteredChats = allUserChats.filter(chat => {
      if (!chat.chatHistory) return false;
      return chat.chatHistory.some(message => {
        const messageDate = new Date(message.createdAt).toISOString().split('T')[0];
        return messageDate === dateStr;
      });
    });
    
    setChatHistories(filteredChats);
  };

  // Fetch all available dates - get from actual chat messages
  const fetchAllDates = async () => {
    try {
      console.log('Fetching all dates...');
      setDatesLoading(true);
      
      // Get chat histories with chat messages
      const response = await axios.post(API_URL, {
        database: currentDatabase,
        action: 'find',
        collection: 'chathistories',
        filter: {},
        sort: { updatedAt: -1 },
        limit: 500, // Get enough to cover recent dates
        projection: { chatHistory: 1 } // Only get chatHistory field
      }, {
        headers: getAuthHeaders()
      });

      const chats = response.data.documents || [];
      console.log('Found chats for dates:', chats.length);
      
      // Extract unique dates from chat message createdAt
      const dateMap = {};
      
      chats.forEach(chat => {
        if (chat.chatHistory && Array.isArray(chat.chatHistory)) {
          chat.chatHistory.forEach(message => {
            if (message.createdAt) {
              const dateStr = message.createdAt.substring(0, 10); // YYYY-MM-DD
              if (!dateMap[dateStr]) {
                dateMap[dateStr] = 0;
              }
              dateMap[dateStr]++;
            }
          });
        }
      });
      
      // Convert to array and sort
      const formattedDates = Object.entries(dateMap)
        .map(([dateStr, count]) => {
          const dateObj = new Date(dateStr);
          return {
            dateStr,
            displayDate: dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }),
            count,
            timestamp: dateObj.getTime()
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
      
      console.log('Formatted dates:', formattedDates.length);
      setAvailableDates(formattedDates);
    } catch (error) {
      console.error('Error fetching all dates:', error);
      setAvailableDates([]);
    } finally {
      setDatesLoading(false);
    }
  };

  // Fetch users who chatted on a specific date - SIMPLE and FAST
  const fetchUsersForDate = async (dateStr) => {
    try {
      console.log('Fetching users for date:', dateStr);
      setUsersLoading(true);
      
      // Get all recent chats and filter on frontend
      const response = await axios.post(API_URL, {
        database: currentDatabase,
        action: 'find',
        collection: 'chathistories',
        filter: {},
        sort: { updatedAt: -1 },
        limit: 300,
        projection: { userID: 1, chatHistory: 1, updatedAt: 1 }
      }, {
        headers: getAuthHeaders()
      });

      const chats = response.data.documents || [];
      console.log('Chats for date filtering:', chats.length);
      
      // Find users who had messages on this specific date
      const userMap = {};
      
      chats.forEach(chat => {
        if (chat.chatHistory && Array.isArray(chat.chatHistory)) {
          const messagesOnDate = chat.chatHistory.filter(message => {
            if (message.createdAt) {
              const messageDate = message.createdAt.substring(0, 10);
              return messageDate === dateStr;
            }
            return false;
          });
          
          if (messagesOnDate.length > 0) {
            if (!userMap[chat.userID]) {
              userMap[chat.userID] = {
                userID: chat.userID,
                messageCount: 0,
                lastMessageTime: null
              };
            }
            
            userMap[chat.userID].messageCount += messagesOnDate.length;
            
            // Find latest message time for this user on this date
            messagesOnDate.forEach(msg => {
              if (!userMap[chat.userID].lastMessageTime || msg.createdAt > userMap[chat.userID].lastMessageTime) {
                userMap[chat.userID].lastMessageTime = msg.createdAt;
              }
            });
          }
        }
      });
      
      // Get user details
      const userDetails = [];
      Object.values(userMap).forEach(userInfo => {
        const user = users.find(u => u.userID === userInfo.userID);
        if (user && user.email !== 'nadeem@naptick.com') {
          userDetails.push({
            ...user,
            messageCount: userInfo.messageCount,
            lastMessageTime: userInfo.lastMessageTime
          });
        }
      });
      
      // Sort by last message time
      userDetails.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
      
      console.log('User details for date:', userDetails.length);
      setUsersForSelectedDate(userDetails);
      
    } catch (error) {
      console.error('Error fetching users for date:', error);
      setUsersForSelectedDate([]);
    } finally {
      setUsersLoading(false);
    }
  };


  useEffect(() => {
    // Only fetch data if user is authenticated
    if (isAuthenticated) {
      fetchUsers();
      if (viewMode === 'date-first') {
        fetchAllDates();
        setLoading(false); // Don't show loading when just showing dates
      } else {
        fetchChatHistories();
      }
    }
  }, [currentDatabase, viewMode, isAuthenticated]);

  const getUserName = (userId) => {
    const user = users.find(u => u.userID === userId);
    if (!user) return 'Unknown User';
    const { FIRST_NAME, LAST_NAME } = user.user_info || {};
    return `${FIRST_NAME || ''} ${LAST_NAME || ''}`.trim() || user.email || 'Unknown User';
  };

  // Filter users based on search term
  const getFilteredUsers = () => {
    if (!userSearchTerm) return users;
    
    return users.filter(user => {
      const searchLower = userSearchTerm.toLowerCase();
      
      // Get name parts safely
      const userInfo = user.user_info || {};
      const firstName = (userInfo.FIRST_NAME || '').toLowerCase();
      const lastName = (userInfo.LAST_NAME || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const email = (user.email || '').toLowerCase();
      
      // Search in first name, last name, full name, or email
      return firstName.includes(searchLower) || 
             lastName.includes(searchLower) || 
             fullName.includes(searchLower) || 
             email.includes(searchLower);
    });
  };

  const handleUserSelect = (userId) => {
    setSelectedUser(userId);
    if (viewMode === 'user-first') {
      setSelectedDate(null); // Reset date selection
      fetchChatHistories(userId);
    } else {
      // In date-first mode, fetch conversations for specific date and user
      fetchChatHistoriesForDateAndUser(selectedDate, userId);
    }
  };

  const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr);
    if (viewMode === 'date-first') {
      setSelectedUser(null); // Reset user selection
      fetchUsersForDate(dateStr);
      setChatHistories([]); // Clear chat histories until user is selected
    } else {
      // In user-first mode, filter chats by date
      filterChatsByDate(dateStr);
    }
  };

  const handleViewModeToggle = () => {
    const newMode = viewMode === 'user-first' ? 'date-first' : 'user-first';
    console.log('Switching to mode:', newMode);
    setViewMode(newMode);
    setSelectedUser(null);
    setSelectedDate(null);
    setChatHistories([]);
    setUsersForSelectedDate([]);
    setAvailableDates([]);
    setUserSearchTerm(''); // Clear search when switching modes
    
    // Fetch dates immediately when switching to date-first mode
    if (newMode === 'date-first') {
      fetchAllDates();
    }
  };

  const handleDatabaseChange = (db) => {
    setCurrentDatabase(db);
    setSelectedUser(null);
    setSelectedDate(null);
    setChatHistories([]);
    setUsersForSelectedDate([]);
    setAvailableDates([]);
    setUserSearchTerm(''); // Clear search when switching databases
  };

  // Fetch chat histories for specific date and user - SIMPLE and FAST
  const fetchChatHistoriesForDateAndUser = async (dateStr, userId) => {
    try {
      setLoading(true);
      
      // Get user's chats and filter for the specific date
      const response = await axios.post(API_URL, {
        database: currentDatabase,
        action: 'find',
        collection: 'chathistories',
        filter: { userID: userId },
        sort: { updatedAt: -1 },
        limit: 100,
      }, {
        headers: getAuthHeaders()
      });

      const allChats = response.data.documents || [];
      
      // Filter chats that have messages on the specific date
      const filteredChats = allChats.filter(chat => {
        if (!chat.chatHistory || !Array.isArray(chat.chatHistory)) return false;
        
        return chat.chatHistory.some(message => {
          if (message.createdAt) {
            const messageDate = message.createdAt.substring(0, 10);
            return messageDate === dateStr;
          }
          return false;
        });
      });
      
      console.log('Chats for user on date:', filteredChats.length);
      setChatHistories(filteredChats);
      
    } catch (error) {
      console.error('Error fetching chat histories for date and user:', error);
      setChatHistories([]);
    } finally {
      setLoading(false);
    }
  };

  // If not authenticated, show login screen
  if (!isAuthenticated) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        backgroundColor: '#f5f5f5',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          width: '400px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '30px' }}>
            <h1 style={{ color: '#333', marginBottom: '10px' }}>🔒 Chat History Viewer</h1>
            <p style={{ color: '#666', margin: '0' }}>Secure Access Required</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="password"
                placeholder="Enter admin password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                onBlur={(e) => e.target.style.borderColor = '#ddd'}
                autoFocus
              />
            </div>
            
            {authError && (
              <div style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '10px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                {authError}
              </div>
            )}
            
            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: authLoading ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: authLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseOver={(e) => {
                if (!authLoading) e.target.style.backgroundColor = '#0056b3';
              }}
              onMouseOut={(e) => {
                if (!authLoading) e.target.style.backgroundColor = '#007bff';
              }}
            >
              {authLoading ? (
                <>
                  <div style={{ 
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px'
                  }}></div>
                  Authenticating...
                </>
              ) : (
                'Access Chat Viewer'
              )}
            </button>
          </form>
          
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>
            This application contains sensitive production data
          </div>
          <div style={{ marginTop: '10px', fontSize: '10px', color: '#ccc' }}>
            v1.0.1 - Production Ready
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {/* Left Sidebar */}
      <div style={{ width: '280px', backgroundColor: '#f8f9fa', borderRight: '1px solid #ddd', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: '0', color: '#333' }}>Chat History Viewer</h2>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
            title="Logout"
          >
            🔓 Logout
          </button>
        </div>
        
        {/* Database Selector */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>Database:</label>
          <select 
            value={currentDatabase} 
            onChange={(e) => handleDatabaseChange(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              marginTop: '5px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          >
            <option value="somnusuat">UAT</option>
            <option value="somnus">Production</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', marginBottom: '10px', display: 'block' }}>
            View Mode:
          </label>
          <button
            onClick={handleViewModeToggle}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#fff',
              border: '2px solid #007bff',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#007bff',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#007bff';
              e.target.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#fff';
              e.target.style.color = '#007bff';
            }}
          >
            {viewMode === 'user-first' ? '👤 User First → 📅 Date First' : '📅 Date First → 👤 User First'}
          </button>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px', textAlign: 'center' }}>
            {viewMode === 'user-first' ? 'Select user, then date' : 'Select date, then user'}
          </div>
        </div>

        {/* Dynamic Content based on View Mode */}
        {viewMode === 'user-first' ? (
          /* Users List */
          <div>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>👤 Users ({getFilteredUsers().length})</h3>
            
            {/* Search Bar */}
            <div style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button 
              onClick={() => handleUserSelect(null)}
              style={{ 
                width: '100%', 
                padding: '12px', 
                marginBottom: '8px',
                backgroundColor: selectedUser === null ? '#e3f2fd' : '#fff',
                color: selectedUser === null ? '#1565c0' : '#333',
                border: selectedUser === null ? '2px solid #1976d2' : '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: selectedUser === null ? 'bold' : 'normal',
                transition: 'all 0.2s ease',
                boxShadow: selectedUser === null ? '0 2px 4px rgba(25,118,210,0.3)' : 'none'
              }}
              onMouseOver={(e) => {
                if (selectedUser !== null) {
                  e.target.style.backgroundColor = '#e8f4f8';
                }
              }}
              onMouseOut={(e) => {
                if (selectedUser !== null) {
                  e.target.style.backgroundColor = '#fff';
                }
              }}
            >
              All Users
            </button>
            
            <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
              {getFilteredUsers().map((user) => (
                <button
                  key={user._id}
                  onClick={() => handleUserSelect(user.userID)}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    marginBottom: '8px',
                    backgroundColor: selectedUser === user.userID ? '#e3f2fd' : '#fff',
                    color: selectedUser === user.userID ? '#1565c0' : '#333',
                    border: selectedUser === user.userID ? '2px solid #1976d2' : '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedUser === user.userID ? '0 2px 4px rgba(25,118,210,0.3)' : 'none'
                  }}
                  onMouseOver={(e) => {
                    if (selectedUser !== user.userID) {
                      e.target.style.backgroundColor = '#e8f4f8';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedUser !== user.userID) {
                      e.target.style.backgroundColor = '#fff';
                    }
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{getUserName(user.userID)}</div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: selectedUser === user.userID ? '#1976d2' : '#666',
                    marginTop: '2px'
                  }}>
                    {user.email}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Dates List */
          <div>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>📅 Dates ({availableDates.length})</h3>
            
            {datesLoading ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '20px',
                fontSize: '14px',
                color: '#666'
              }}>
                <div style={{ 
                  display: 'inline-block',
                  width: '20px',
                  height: '20px',
                  border: '2px solid #e3e3e3',
                  borderTop: '2px solid #007bff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '10px'
                }}></div>
                <div>Loading dates...</div>
              </div>
            ) : (
              <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
              {availableDates.map((dateInfo) => (
                <button
                  key={dateInfo.dateStr}
                  onClick={() => handleDateSelect(dateInfo.dateStr)}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    marginBottom: '8px',
                    backgroundColor: selectedDate === dateInfo.dateStr ? '#e8f5e8' : '#fff',
                    color: selectedDate === dateInfo.dateStr ? '#2e7d32' : '#333',
                    border: selectedDate === dateInfo.dateStr ? '2px solid #4caf50' : '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedDate === dateInfo.dateStr ? '0 2px 4px rgba(76,175,80,0.3)' : 'none'
                  }}
                  onMouseOver={(e) => {
                    if (selectedDate !== dateInfo.dateStr) {
                      e.target.style.backgroundColor = '#f0f8f0';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedDate !== dateInfo.dateStr) {
                      e.target.style.backgroundColor = '#fff';
                    }
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{dateInfo.displayDate}</div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: selectedDate === dateInfo.dateStr ? '#4caf50' : '#666',
                    marginTop: '2px'
                  }}>
                    {dateInfo.count} messages
                  </div>
                </button>
              ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Middle Sidebar - Dynamic based on mode and selection */}
      {(viewMode === 'user-first' && selectedUser) ? (
        /* Dates for selected user */
        <div style={{ 
          width: '250px', 
          backgroundColor: '#f0f8ff', 
          borderRight: '1px solid #ddd', 
          padding: '20px' 
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
            📅 Chat Dates for {getUserName(selectedUser)}
          </h3>
          
          <button 
            onClick={() => handleDateSelect(null)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              marginBottom: '8px',
              backgroundColor: selectedDate === null ? '#e8f5e8' : '#fff',
              color: selectedDate === null ? '#2e7d32' : '#333',
              border: selectedDate === null ? '2px solid #4caf50' : '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: selectedDate === null ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              boxShadow: selectedDate === null ? '0 2px 4px rgba(76,175,80,0.3)' : 'none'
            }}
            onMouseOver={(e) => {
              if (selectedDate !== null) {
                e.target.style.backgroundColor = '#f0f8f0';
              }
            }}
            onMouseOut={(e) => {
              if (selectedDate !== null) {
                e.target.style.backgroundColor = '#fff';
              }
            }}
          >
            All Dates ({allUserChats.length} conversations)
          </button>
          
          <div style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
            {availableDates.map((dateInfo) => (
              <button
                key={dateInfo.dateStr}
                onClick={() => handleDateSelect(dateInfo.dateStr)}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  marginBottom: '6px',
                  backgroundColor: selectedDate === dateInfo.dateStr ? '#e8f5e8' : '#fff',
                  color: selectedDate === dateInfo.dateStr ? '#2e7d32' : '#333',
                  border: selectedDate === dateInfo.dateStr ? '2px solid #4caf50' : '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedDate === dateInfo.dateStr ? '0 2px 4px rgba(76,175,80,0.3)' : 'none'
                }}
                onMouseOver={(e) => {
                  if (selectedDate !== dateInfo.dateStr) {
                    e.target.style.backgroundColor = '#f0f8f0';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedDate !== dateInfo.dateStr) {
                    e.target.style.backgroundColor = '#fff';
                  }
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{dateInfo.displayDate}</div>
                <div style={{ 
                  fontSize: '11px', 
                  color: selectedDate === dateInfo.dateStr ? '#4caf50' : '#666',
                  marginTop: '2px'
                }}>
                  {dateInfo.count} messages
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (viewMode === 'date-first' && selectedDate) ? (
        /* Users for selected date */
        <div style={{ 
          width: '250px', 
          backgroundColor: '#f0f8ff', 
          borderRight: '1px solid #ddd', 
          padding: '20px' 
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
            👤 Users on {availableDates.find(d => d.dateStr === selectedDate)?.displayDate}
          </h3>
          
          {usersLoading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px',
              fontSize: '14px',
              color: '#666'
            }}>
              <div style={{ 
                display: 'inline-block',
                width: '20px',
                height: '20px',
                border: '2px solid #e3e3e3',
                borderTop: '2px solid #1976d2',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '10px'
              }}></div>
              <div>Loading users...</div>
            </div>
          ) : (
            <div style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            {usersForSelectedDate.map((user) => (
              <button
                key={user._id}
                onClick={() => handleUserSelect(user.userID)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  marginBottom: '8px',
                  backgroundColor: selectedUser === user.userID ? '#e3f2fd' : '#fff',
                  color: selectedUser === user.userID ? '#1565c0' : '#333',
                  border: selectedUser === user.userID ? '2px solid #1976d2' : '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedUser === user.userID ? '0 2px 4px rgba(25,118,210,0.3)' : 'none'
                }}
                onMouseOver={(e) => {
                  if (selectedUser !== user.userID) {
                    e.target.style.backgroundColor = '#e8f4f8';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedUser !== user.userID) {
                    e.target.style.backgroundColor = '#fff';
                  }
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{getUserName(user.userID)}</div>
                <div style={{ 
                  fontSize: '11px', 
                  color: selectedUser === user.userID ? '#1976d2' : '#666',
                  marginTop: '2px'
                }}>
                  {user.messageCount} messages | {user.email}
                </div>
              </button>
            ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Main Content */}
      <div style={{ flex: 1, padding: '25px', overflow: 'auto', backgroundColor: '#fff' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '28px' }}>
            {selectedUser ? `Chat Conversations for ${getUserName(selectedUser)}` : 'All Chat Conversations'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '14px', color: '#666' }}>
            <span>Database: <strong>{currentDatabase === 'somnusuat' ? 'UAT' : 'Production'}</strong></span>
            {selectedDate && (
              <span>Date: <strong>{availableDates.find(d => d.dateStr === selectedDate)?.displayDate}</strong></span>
            )}
            <span>Conversations: <strong>{chatHistories.length}</strong></span>
          </div>
        </div>
        
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '50px', 
            fontSize: '16px', 
            color: '#666' 
          }}>
            <div style={{ 
              display: 'inline-block',
              width: '30px',
              height: '30px',
              border: '3px solid #e3e3e3',
              borderTop: '3px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '15px'
            }}></div>
            <div>Loading conversations...</div>
          </div>
        ) : chatHistories.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '50px', 
            fontSize: '16px', 
            color: '#999' 
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>💬</div>
            <p>No conversations found</p>
            <p style={{ fontSize: '14px' }}>Try selecting a different user or date</p>
          </div>
        ) : (
          <div>
            {chatHistories.map((history) => (
              <div key={history._id} style={{ 
                backgroundColor: '#f8f9fa', 
                margin: '0 0 25px 0', 
                padding: '25px', 
                borderRadius: '10px',
                border: '1px solid #e9ecef',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ 
                  borderBottom: '2px solid #dee2e6', 
                  paddingBottom: '15px', 
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', color: '#495057', fontSize: '20px' }}>
                      {getUserName(history.userID)}
                    </h3>
                    <p style={{ margin: '0', color: '#6c757d', fontSize: '14px' }}>
                      Session: {history.sessionID?.substring(0, 8)}... | 
                      Created: {new Date(history.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {history.chatHistory && (
                    <div style={{ 
                      backgroundColor: '#007bff', 
                      color: 'white', 
                      padding: '5px 12px', 
                      borderRadius: '15px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {history.chatHistory.length} messages
                    </div>
                  )}
                </div>

                {/* Chat Summary */}
                {history.processedChat && (
                  <div style={{ 
                    backgroundColor: '#d1ecf1', 
                    padding: '15px', 
                    borderRadius: '8px', 
                    marginBottom: '20px',
                    borderLeft: '4px solid #bee5eb'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#0c5460' }}>
                      💡 Summary
                    </div>
                    <div style={{ color: '#0c5460' }}>{history.processedChat.summary}</div>
                    {history.processedChat.sentiment && (
                      <div style={{ 
                        marginTop: '10px', 
                        fontSize: '12px', 
                        color: '#0c5460' 
                      }}>
                        Sentiment: <strong>{history.processedChat.sentiment}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat Messages */}
                {history.chatHistory && history.chatHistory.map((message, index) => (
                  <div key={message.conversationId || index} style={{ marginBottom: '20px' }}>
                    {/* User Message */}
                    <div style={{ 
                      backgroundColor: '#e9ecef', 
                      padding: '15px', 
                      borderRadius: '10px', 
                      marginBottom: '8px',
                      borderLeft: '4px solid #007bff'
                    }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6c757d', 
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span><strong>👤 User</strong></span>
                        <span>{new Date(message.createdAt).toLocaleString()}</span>
                      </div>
                      <div style={{ color: '#495057', lineHeight: '1.5' }}>
                        {message.userQuery}
                      </div>
                    </div>
                    
                    {/* Assistant Response */}
                    <div style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: '15px', 
                      borderRadius: '10px',
                      border: '1px solid #dee2e6',
                      borderLeft: '4px solid #28a745'
                    }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6c757d', 
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span><strong>🤖 Assistant</strong></span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {message.feedback && message.feedback !== 'NA' && (
                            <span style={{ 
                              backgroundColor: message.feedback === 'satisfactory' ? '#d4edda' : '#f8d7da',
                              color: message.feedback === 'satisfactory' ? '#155724' : '#721c24',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px'
                            }}>
                              {message.feedback === 'satisfactory' ? '👍' : '👎'} {message.feedback}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ 
                        color: '#495057', 
                        lineHeight: '1.6',
                        fontSize: '14px'
                      }}>
                        <div dangerouslySetInnerHTML={{ __html: message.langChainResponse }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SimpleApp;