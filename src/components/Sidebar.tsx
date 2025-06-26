import React, { useState } from 'react';
import { Calendar, User as UserIcon, Search, Database } from 'lucide-react';
import { User as UserType } from '../types/chat';
import { format } from 'date-fns';

interface SidebarProps {
  users: UserType[];
  selectedUser: string | null;
  onUserSelect: (userId: string | null) => void;
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  chatDates: { date: string; count: number }[];
  currentDatabase: string;
  onDatabaseChange: (db: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  users,
  selectedUser,
  onUserSelect,
  selectedDate,
  onDateSelect,
  chatDates,
  currentDatabase,
  onDatabaseChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const filteredUsers = users.filter(user => {
    const fullName = `${user.user_info.FIRST_NAME} ${user.user_info.LAST_NAME}`.toLowerCase();
    const email = user.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const getUserDisplayName = (user: UserType) => {
    const { FIRST_NAME, LAST_NAME } = user.user_info;
    return `${FIRST_NAME} ${LAST_NAME}`.trim() || user.email;
  };

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 h-screen flex flex-col">
      {/* Database Selector */}
      <div className="p-4 border-b border-gray-200">
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
          <Database className="w-4 h-4" />
          <span>Database:</span>
        </label>
        <select
          value={currentDatabase}
          onChange={(e) => onDatabaseChange(e.target.value)}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="somnusuat">UAT</option>
          <option value="somnus">Production</option>
        </select>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Date Filter */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-blue-600"
        >
          <Calendar className="w-4 h-4" />
          <span>
            {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'All Dates'}
          </span>
        </button>
        
        {showDatePicker && (
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            <button
              onClick={() => {
                onDateSelect(null);
                setShowDatePicker(false);
              }}
              className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
            >
              All Dates
            </button>
            {chatDates.map(({ date, count }) => (
              <button
                key={date}
                onClick={() => {
                  onDateSelect(new Date(date));
                  setShowDatePicker(false);
                }}
                className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
              >
                {format(new Date(date), 'MMM dd, yyyy')} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Users</h3>
            <span className="text-xs text-gray-500">{filteredUsers.length} users</span>
          </div>
          
          <div className="space-y-1">
            <button
              onClick={() => onUserSelect(null)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedUser === null
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              All Users
            </button>
            
            {filteredUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => onUserSelect(user.userID)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedUser === user.userID
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <UserIcon className="w-4 h-4" />
                  <div className="flex-1 truncate">
                    <div className="font-medium">{getUserDisplayName(user)}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};