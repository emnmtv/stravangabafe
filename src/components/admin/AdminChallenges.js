import React, { useState, useEffect } from 'react';
import { createChallenge, getAllChallenges, updateChallenge,
   deleteChallenge, getChallengeLeaderboard, getImageUrl } from '../../services/apiService';
import { useNavigate } from 'react-router-dom';

const AdminChallenges = () => {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'upcoming', 'past'
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'distance',
    goal: '',
    startDate: '',
    endDate: ''
  });
  
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    const fetchChallenges = async () => {
      setLoading(true);
      setError(null);
      
      try {
        let isActive;
        if (filter === 'active') isActive = true;
        else if (filter === 'inactive') isActive = false;
        
        const response = await getAllChallenges(token, isActive);
        
        if (response.success) {
          // Further filter by upcoming/past if needed
          let filteredChallenges = response.data;
          const now = new Date();
          
          if (filter === 'upcoming') {
            filteredChallenges = filteredChallenges.filter(
              challenge => new Date(challenge.startDate) > now
            );
          } else if (filter === 'past') {
            filteredChallenges = filteredChallenges.filter(
              challenge => new Date(challenge.endDate) < now
            );
          }
          
          setChallenges(filteredChallenges);
        } else {
          setError(response.message || 'Failed to fetch challenges');
        }
      } catch (err) {
        console.error('Error fetching challenges:', err);
        setError('An error occurred while fetching challenges');
      } finally {
        setLoading(false);
      }
    };
    
    fetchChallenges();
  }, [navigate, filter]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for goal to ensure it's a number
    if (name === 'goal') {
      const numberValue = value === '' ? '' : Number(value);
      setFormData(prev => ({ ...prev, [name]: numberValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    try {
      let response;
      
      if (selectedChallenge) {
        // Update existing challenge
        response = await updateChallenge(token, selectedChallenge._id, formData);
      } else {
        // Create new challenge
        response = await createChallenge(token, formData);
      }
      
      if (response.success) {
        setSuccessMessage(selectedChallenge 
          ? 'Challenge updated successfully!' 
          : 'Challenge created successfully!');
          
        // Reset form and refresh challenges list
        handleResetForm();
        
        // Refresh challenges list after a short delay
        setTimeout(() => {
          const fetchUpdatedChallenges = async () => {
            const updatedResponse = await getAllChallenges(token);
            if (updatedResponse.success) {
              setChallenges(updatedResponse.data);
            }
          };
          
          fetchUpdatedChallenges();
        }, 500);
      } else {
        setError(response.message || 'Failed to save challenge');
      }
    } catch (err) {
      console.error('Error saving challenge:', err);
      setError('An error occurred while saving the challenge');
    }
  };
  
  const handleEditChallenge = (challenge) => {
    setSelectedChallenge(challenge);
    setFormData({
      title: challenge.title,
      description: challenge.description,
      type: challenge.type,
      goal: challenge.goal,
      startDate: formatDateForInput(challenge.startDate),
      endDate: formatDateForInput(challenge.endDate)
    });
    setFormVisible(true);
    setSuccessMessage(null);
    setError(null);
  };
  
  const handleDeleteChallenge = async (challengeId) => {
    if (!window.confirm('Are you sure you want to delete this challenge? This action cannot be undone.')) {
      return;
    }
    
    setError(null);
    setSuccessMessage(null);
    
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    try {
      const response = await deleteChallenge(token, challengeId);
      
      if (response.success) {
        setSuccessMessage('Challenge deleted successfully!');
        
        // Remove deleted challenge from state
        setChallenges(prev => prev.filter(challenge => challenge._id !== challengeId));
      } else {
        setError(response.message || 'Failed to delete challenge');
      }
    } catch (err) {
      console.error('Error deleting challenge:', err);
      setError('An error occurred while deleting the challenge');
    }
  };
  
  const handleViewLeaderboard = async (challengeId) => {
    setLeaderboardLoading(true);
    setError(null);
    
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    try {
      const response = await getChallengeLeaderboard(token, challengeId);
      
      if (response.success) {
        setLeaderboard(response.data);
        setLeaderboardVisible(true);
      } else {
        setError(response.message || 'Failed to fetch leaderboard');
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('An error occurred while fetching the leaderboard');
    } finally {
      setLeaderboardLoading(false);
    }
  };
  
  const handleResetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'distance',
      goal: '',
      startDate: '',
      endDate: ''
    });
    setSelectedChallenge(null);
    setFormVisible(false);
  };
  
  const formatDateForInput = (dateString) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  const getChallengeStatusLabel = (challenge) => {
    const now = new Date();
    const startDate = new Date(challenge.startDate);
    const endDate = new Date(challenge.endDate);
    
    if (now < startDate) {
      return <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">Upcoming</span>;
    } else if (now > endDate) {
      return <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded">Ended</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">Active</span>;
    }
  };
  
  const getChallengeTypeLabel = (type) => {
    switch (type) {
      case 'distance':
        return 'Total Distance';
      case 'time':
        return 'Total Time';
      case 'elevation':
        return 'Elevation Gain';
      case 'frequency':
        return 'Activity Frequency';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };
  
  const formatGoal = (type, goal) => {
    switch (type) {
      case 'distance':
        return `${goal} km`;
      case 'time':
        // Convert minutes to hours and minutes
        const hours = Math.floor(goal / 60);
        const minutes = goal % 60;
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      case 'elevation':
        return `${goal} m`;
      case 'frequency':
        return `${goal} activities`;
      default:
        return goal;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Challenge Management</h1>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setFormVisible(true);
                setSelectedChallenge(null);
                setFormData({
                  title: '',
                  description: '',
                  type: 'distance',
                  goal: '',
                  startDate: '',
                  endDate: ''
                });
                setError(null);
                setSuccessMessage(null);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Create New Challenge
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Admin Dashboard
            </button>
          </div>
        </div>
        
        {/* Filter controls */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Filter Challenges</h2>
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-3 py-2 rounded-md text-sm ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              onClick={() => setFilter('all')}
            >
              All Challenges
            </button>
            <button
              className={`px-3 py-2 rounded-md text-sm ${filter === 'active' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              onClick={() => setFilter('active')}
            >
              Active Challenges
            </button>
            <button
              className={`px-3 py-2 rounded-md text-sm ${filter === 'upcoming' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              onClick={() => setFilter('upcoming')}
            >
              Upcoming Challenges
            </button>
            <button
              className={`px-3 py-2 rounded-md text-sm ${filter === 'past' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              onClick={() => setFilter('past')}
            >
              Past Challenges
            </button>
          </div>
        </div>
        
        {/* Success message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
            {successMessage}
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {/* Challenge form */}
        {formVisible && (
          <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {selectedChallenge ? 'Edit Challenge' : 'Create New Challenge'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="title">
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="type">
                    Challenge Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="distance">Total Distance</option>
                    <option value="time">Total Time</option>
                    <option value="elevation">Elevation Gain</option>
                    <option value="frequency">Activity Frequency</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="goal">
                    Goal ({formData.type === 'distance' ? 'kilometers' : 
                          formData.type === 'time' ? 'minutes' : 
                          formData.type === 'elevation' ? 'meters' : 
                          'number of activities'})
                  </label>
                  <input
                    type="number"
                    id="goal"
                    name="goal"
                    value={formData.goal}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={1}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="startDate">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="endDate">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {selectedChallenge ? 'Update Challenge' : 'Create Challenge'}
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* Leaderboard modal */}
        {leaderboardVisible && leaderboard && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {leaderboard.challenge.title} - Leaderboard
                  </h2>
                  <p className="text-gray-600">
                    {getChallengeTypeLabel(leaderboard.challenge.type)} Goal: {formatGoal(leaderboard.challenge.type, leaderboard.challenge.goal)}
                  </p>
                </div>
                <button
                  onClick={() => setLeaderboardVisible(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              {leaderboard.leaderboard.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No participants yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="py-2 px-4 text-left text-gray-700">Rank</th>
                        <th className="py-2 px-4 text-left text-gray-700">User</th>
                        <th className="py-2 px-4 text-left text-gray-700">Progress</th>
                        <th className="py-2 px-4 text-left text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.leaderboard.map((entry) => (
                        <tr key={entry.rank} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">{entry.rank}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              {entry.user.profilePicture ? (
                                <img 
                                  src={getImageUrl(entry.user.profilePicture)} 
                                  alt={entry.user.username} 
                                  className="w-8 h-8 rounded-full mr-2"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-gray-200 rounded-full mr-2 flex items-center justify-center">
                                  <span className="text-gray-600 text-sm">
                                    {entry.user.firstName.charAt(0)}{entry.user.lastName.charAt(0)}
                                  </span>
                                </div>
                              )}
                              <span>{entry.user.firstName} {entry.user.lastName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {leaderboard.challenge.type === 'distance' ? 
                              `${entry.progress.toFixed(2)} km` : 
                            leaderboard.challenge.type === 'time' ? 
                              `${Math.floor(entry.progress / 60)}h ${entry.progress % 60}m` : 
                            leaderboard.challenge.type === 'elevation' ? 
                              `${entry.progress} m` : 
                              `${entry.progress} activities`}
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${Math.min(100, (entry.progress / leaderboard.challenge.goal) * 100)}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {entry.completed ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                Completed
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                In Progress
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              <div className="mt-6 text-center">
                <button
                  onClick={() => setLeaderboardVisible(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Challenges list */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <h2 className="text-xl font-bold text-gray-800 p-4 border-b">
            Challenges {filter !== 'all' && `(${filter.charAt(0).toUpperCase() + filter.slice(1)})`}
          </h2>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mr-2"></div>
              <p className="text-gray-600">Loading challenges...</p>
            </div>
          ) : challenges.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No challenges found. {filter !== 'all' && 'Try changing the filter or create a new challenge.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="py-3 px-4 text-left text-gray-700">Title</th>
                    <th className="py-3 px-4 text-left text-gray-700">Type</th>
                    <th className="py-3 px-4 text-left text-gray-700">Goal</th>
                    <th className="py-3 px-4 text-left text-gray-700">Dates</th>
                    <th className="py-3 px-4 text-left text-gray-700">Status</th>
                    <th className="py-3 px-4 text-left text-gray-700">Participants</th>
                    <th className="py-3 px-4 text-left text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((challenge) => (
                    <tr key={challenge._id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">
                        {challenge.title}
                      </td>
                      <td className="py-3 px-4">
                        {getChallengeTypeLabel(challenge.type)}
                      </td>
                      <td className="py-3 px-4">
                        {formatGoal(challenge.type, challenge.goal)}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex flex-col">
                          <span>Start: {formatDate(challenge.startDate)}</span>
                          <span>End: {formatDate(challenge.endDate)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getChallengeStatusLabel(challenge)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {challenge.participants?.length || 0}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditChallenge(challenge)}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            title="Edit Challenge"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleViewLeaderboard(challenge._id)}
                            className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            title="View Leaderboard"
                          >
                            Leaderboard
                          </button>
                          <button
                            onClick={() => handleDeleteChallenge(challenge._id)}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            title="Delete Challenge"
                            disabled={challenge.participants?.length > 0}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminChallenges; 