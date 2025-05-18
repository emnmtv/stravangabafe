import React, { useState, useEffect } from 'react';
import { getArchivedActivities, restoreActivity } from '../services/apiService';

// Helper function to format distance
const formatDistance = (distance) => {
  if (!distance) return '0 km';
  // Convert from meters to kilometers
  const km = distance / 1000;
  return `${km.toFixed(2)} km`;
};

// Helper function to format duration
const formatDuration = (seconds) => {
  if (!seconds) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

// Helper function to format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Helper function to format speed
const formatSpeed = (speed) => {
  if (!speed) return '0 km/h';
  // Convert from m/s to km/h
  const kmh = speed * 3.6;
  return `${kmh.toFixed(1)} km/h`;
};

// Activity type icons
const typeIcons = {
  run: '🏃',
  jog: '🏃‍♂️',
  walk: '🚶',
  cycling: '🚴',
  hiking: '🥾',
  other: '⚡'
};

const ArchivedActivities = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    limit: 10
  });

  // Fetch archived activities
  const fetchArchivedActivities = async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('You must be logged in to view archived activities');
        setLoading(false);
        return;
      }

      const skip = (page - 1) * pagination.limit;
      const response = await getArchivedActivities(token, {
        skip,
        limit: pagination.limit,
        sort: '-archivedAt'
      });
      
      if (response.success) {
        setActivities(response.data);
        setPagination({
          ...pagination,
          currentPage: page,
          totalPages: Math.ceil(response.total / pagination.limit)
        });
      } else {
        setError(response.message || 'Failed to fetch archived activities');
      }
    } catch (err) {
      setError('An error occurred while fetching archived activities');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle restoring an activity
  const handleRestore = async (id) => {
    try {
      setRestoringId(id);
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('You must be logged in to restore activities');
        setRestoringId(null);
        return;
      }

      const response = await restoreActivity(token, id);
      
      if (response.success) {
        // Remove restored activity from list
        setActivities(activities.filter(activity => activity._id !== id));
        alert('Activity restored successfully');
      } else {
        alert('Failed to restore activity: ' + (response.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error restoring activity:', err);
      alert('An error occurred while restoring the activity');
    } finally {
      setRestoringId(null);
    }
  };

  // Load activities on component mount
  useEffect(() => {
    fetchArchivedActivities();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Archived Activities</h1>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-700"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center">
          <p className="text-gray-500">No archived activities found.</p>
          <button 
            className="mt-4 py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            onClick={() => window.location.href = '/activities'}
          >
            View Active Activities
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {activities.map((activity) => (
              <div 
                key={activity._id}
                className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl" title={activity.type}>
                        {typeIcons[activity.type] || typeIcons.other}
                      </span>
                      <h2 className="text-xl font-semibold">{activity.title}</h2>
                    </div>
                    <p className="text-sm text-gray-500">{activity.description || 'No description'}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Archived on: {formatDate(activity.archivedAt)}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <button
                      className={`py-1.5 px-3 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 ${
                        restoringId === activity._id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      onClick={() => handleRestore(activity._id)}
                      disabled={restoringId === activity._id}
                    >
                      {restoringId === activity._id ? (
                        <span className="flex items-center">
                          <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Restoring...
                        </span>
                      ) : (
                        'Restore'
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-500">Date</div>
                    <div className="font-medium">{formatDate(activity.startTime)}</div>
                  </div>
                  
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-500">Distance</div>
                    <div className="font-medium">{formatDistance(activity.distance)}</div>
                  </div>
                  
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-500">Duration</div>
                    <div className="font-medium">{formatDuration(activity.duration)}</div>
                  </div>
                  
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-500">Avg Speed</div>
                    <div className="font-medium">{formatSpeed(activity.averageSpeed)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <nav className="inline-flex rounded-md shadow">
                <button
                  onClick={() => fetchArchivedActivities(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                  className={`px-3 py-1 rounded-l-md border border-gray-300 ${
                    pagination.currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Previous
                </button>
                <div className="px-3 py-1 border-t border-b border-gray-300 bg-gray-50">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </div>
                <button
                  onClick={() => fetchArchivedActivities(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className={`px-3 py-1 rounded-r-md border border-gray-300 ${
                    pagination.currentPage === pagination.totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </>
      )}
      
      <div className="mt-8 flex justify-center">
        <button 
          className="py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          onClick={() => window.location.href = '/activities'}
        >
          Back to Activities
        </button>
      </div>
    </div>
  );
};

export default ArchivedActivities; 