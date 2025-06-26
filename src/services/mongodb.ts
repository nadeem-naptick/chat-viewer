import axios from 'axios';
import { User as UserType, ChatHistory } from '../types/chat';

// Use Railway backend for production, local for development
const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api/mongodb' : 'https://web-production-39528.up.railway.app/api/mongodb';

// Allow dynamic database selection
export const getDatabase = () => {
  return localStorage.getItem('selectedDatabase') || import.meta.env.VITE_MONGODB_DATABASE_NAME || 'somnusuat';
};

const mongoAPI = async (action: string, body: any) => {
  const database = getDatabase();
  
  const response = await axios.post(API_URL, {
    database,
    action,
    ...body,
  });
  
  return response.data;
};

// Fetch all users
export const fetchUsers = async (): Promise<UserType[]> => {
  try {
    const result = await mongoAPI('find', {
      collection: 'users',
      sort: { createdAt: -1 },
    });
    return result.documents || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

// Fetch chat histories with filters
export const fetchChatHistories = async (filters: {
  userID?: string;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  limit?: number;
  skip?: number;
}) => {
  const pipeline: any[] = [];
  
  // Match stage
  const matchStage: any = {};
  if (filters.userID) {
    matchStage.userID = filters.userID;
  }
  
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }
  
  // Unwind chat history for filtering
  pipeline.push({ $unwind: '$chatHistory' });
  
  // Date filter
  if (filters.startDate || filters.endDate) {
    const dateFilter: any = {};
    if (filters.startDate) {
      dateFilter.$gte = filters.startDate.toISOString();
    }
    if (filters.endDate) {
      dateFilter.$lte = filters.endDate.toISOString();
    }
    pipeline.push({
      $match: {
        'chatHistory.createdAt': dateFilter,
      },
    });
  }
  
  // Search filter
  if (filters.searchQuery) {
    pipeline.push({
      $match: {
        $or: [
          { 'chatHistory.userQuery': { $regex: filters.searchQuery, $options: 'i' } },
          { 'chatHistory.langChainResponse': { $regex: filters.searchQuery, $options: 'i' } },
        ],
      },
    });
  }
  
  // Group back by document
  pipeline.push({
    $group: {
      _id: '$_id',
      userID: { $first: '$userID' },
      sessionID: { $first: '$sessionID' },
      chatHistory: { $push: '$chatHistory' },
      createdAt: { $first: '$createdAt' },
      updatedAt: { $first: '$updatedAt' },
      isSummaryGenerated: { $first: '$isSummaryGenerated' },
      processedChat: { $first: '$processedChat' },
    },
  });
  
  // Sort by most recent
  pipeline.push({ $sort: { updatedAt: -1 } });
  
  // Pagination
  if (filters.skip) {
    pipeline.push({ $skip: filters.skip });
  }
  if (filters.limit) {
    pipeline.push({ $limit: filters.limit });
  }
  
  const result = await mongoAPI('aggregate', {
    collection: 'chathistories',
    pipeline,
  });
  
  return result.documents as ChatHistory[];
};

// Get unique dates with chat activity
export const fetchChatDates = async (userID?: string) => {
  const pipeline: any[] = [
    { $unwind: '$chatHistory' },
    {
      $project: {
        userID: 1,
        date: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: { $dateFromString: { dateString: '$chatHistory.createdAt' } },
          },
        },
      },
    },
  ];
  
  if (userID) {
    pipeline.unshift({ $match: { userID } });
  }
  
  pipeline.push(
    { $group: { _id: '$date', count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  );
  
  const result = await mongoAPI('aggregate', {
    collection: 'chathistories',
    pipeline,
  });
  
  return result.documents.map((doc: any) => ({
    date: doc._id,
    count: doc.count,
  }));
};

// Get chat statistics
export const fetchChatStats = async () => {
  const pipeline = [
    { $unwind: '$chatHistory' },
    {
      $group: {
        _id: '$userID',
        totalChats: { $sum: 1 },
        firstChat: { $min: '$chatHistory.createdAt' },
        lastChat: { $max: '$chatHistory.createdAt' },
      },
    },
  ];
  
  const result = await mongoAPI('aggregate', {
    collection: 'chathistories',
    pipeline,
  });
  
  return result.documents;
};