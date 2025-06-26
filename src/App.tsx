import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { SearchBar } from './components/SearchBar';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { 
  fetchUsers, 
  fetchChatHistories, 
  fetchChatDates, 
  getDatabase 
} from './services/mongodb';

const queryClient = new QueryClient();

function AppContent() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDatabase, setCurrentDatabase] = useState(getDatabase());

  console.log('App loading...', { currentDatabase });

  // Fetch users
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['users', currentDatabase],
    queryFn: fetchUsers,
    retry: 1,
  });

  console.log('Users query:', { users, usersLoading, usersError });

  // Fetch chat dates
  const { data: chatDates = [] } = useQuery({
    queryKey: ['chatDates', currentDatabase, selectedUser],
    queryFn: () => fetchChatDates(selectedUser || undefined),
  });

  // Fetch chat histories
  const { 
    data: chatHistories = [], 
    isLoading: chatsLoading,
    refetch: refetchChats 
  } = useQuery({
    queryKey: ['chatHistories', currentDatabase, selectedUser, selectedDate, searchQuery],
    queryFn: () => fetchChatHistories({
      userID: selectedUser || undefined,
      startDate: selectedDate ? new Date(selectedDate.setHours(0, 0, 0, 0)) : undefined,
      endDate: selectedDate ? new Date(selectedDate.setHours(23, 59, 59, 999)) : undefined,
      searchQuery: searchQuery || undefined,
      limit: 50,
    }),
  });

  // Handle database change
  const handleDatabaseChange = (db: string) => {
    localStorage.setItem('selectedDatabase', db);
    setCurrentDatabase(db);
    // Reset filters when switching databases
    setSelectedUser(null);
    setSelectedDate(null);
    setSearchQuery('');
    // Refetch data
    queryClient.invalidateQueries();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar
        users={users}
        selectedUser={selectedUser}
        onUserSelect={setSelectedUser}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        chatDates={chatDates}
        currentDatabase={currentDatabase}
        onDatabaseChange={handleDatabaseChange}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Chat History Viewer</h1>
              <span className="text-sm text-gray-500 ml-4">
                ({currentDatabase === 'somnusuat' ? 'UAT' : 'Production'})
              </span>
            </div>
            <button
              onClick={() => refetchChats()}
              className="flex items-center space-x-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="mt-4 max-w-2xl">
            <SearchBar 
              onSearch={setSearchQuery} 
              placeholder="Search in conversations..."
            />
          </div>
        </header>

        {/* Chat View */}
        <ChatView
          chatHistories={chatHistories}
          users={users}
          loading={usersLoading || chatsLoading}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;