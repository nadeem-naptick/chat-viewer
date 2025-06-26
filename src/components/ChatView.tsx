import React from 'react';
import { ChatHistory, User as UserType } from '../types/chat';
import { format } from 'date-fns';
import { MessageCircle, User as UserIcon, Clock, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

interface ChatViewProps {
  chatHistories: ChatHistory[];
  users: UserType[];
  loading: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({ chatHistories, users, loading }) => {
  const getUserName = (userId: string) => {
    const user = users.find(u => u.userID === userId);
    if (!user) return 'Unknown User';
    const { FIRST_NAME, LAST_NAME } = user.user_info;
    return `${FIRST_NAME} ${LAST_NAME}`.trim() || user.email;
  };

  const getFeedbackIcon = (feedback: string) => {
    switch (feedback.toLowerCase()) {
      case 'satisfactory':
      case 'good':
        return <ThumbsUp className="w-4 h-4 text-green-600" />;
      case 'unsatisfactory':
      case 'bad':
        return <ThumbsDown className="w-4 h-4 text-red-600" />;
      case 'na':
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderHtmlContent = (html: string) => {
    // Remove HTML tags for preview
    const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return (
      <div className="prose prose-sm max-w-none">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    );
  }

  if (chatHistories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No conversations found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-5xl mx-auto p-6">
        {chatHistories.map((history) => (
          <div key={history._id} className="mb-8 bg-gray-50 rounded-lg p-6">
            {/* Session Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <UserIcon className="w-5 h-5 text-gray-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {getUserName(history.userID)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Session: {history.sessionID.substring(0, 8)}...
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {format(new Date(history.createdAt), 'MMM dd, yyyy HH:mm')}
              </div>
            </div>

            {/* Chat Summary if available */}
            {history.processedChat && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Summary</h4>
                <p className="text-sm text-blue-800">{history.processedChat.summary}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Intent: {history.processedChat.last_user_intent}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Sentiment: {history.processedChat.sentiment}
                  </span>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="space-y-4">
              {history.chatHistory.map((message, index) => (
                <div key={message.conversationId} className="bg-white rounded-lg p-4 shadow-sm">
                  {/* User Query */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">User</span>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {format(new Date(message.createdAt), 'HH:mm:ss')}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">{message.userQuery}</p>
                  </div>

                  {/* AI Response */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Assistant</span>
                      <div className="flex items-center space-x-2">
                        {getFeedbackIcon(message.feedback)}
                        <span className="text-xs text-gray-500">{message.feedback}</span>
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                      {renderHtmlContent(message.langChainResponse)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};