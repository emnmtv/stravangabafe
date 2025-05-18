import React, { useState, useEffect, useRef } from 'react';
import { getUserProfile, updateUserProfile, uploadProfilePicture, updatePrivacySettings, addWeightEntry, getWeightHistory, getUserStats, getImageUrl } from '../services/apiService';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [weightHistoryMode, setWeightHistoryMode] = useState(false);
  const [weightHistory, setWeightHistory] = useState([]);
  const [weightLoading, setWeightLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    weight: '',
    height: '',
    age: ''
  });
  const [privacyData, setPrivacyData] = useState({
    privacyDefault: 'public',
    distanceUnit: 'km',
    paceUnit: 'min/km'
  });
  const [weightEntryData, setWeightEntryData] = useState({
    weight: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUserProfile();
    fetchUserStats();
  }, []);

  const fetchUserProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to view your profile');
        setLoading(false);
        return;
      }
      
      const response = await getUserProfile(token);
      console.log('Profile response:', response);
      
      if (response.success) {
        setUser(response.data);
        // Map database fields to form fields correctly
        setFormData({
          name: response.data.firstName ? `${response.data.firstName} ${response.data.lastName || ''}`.trim() : '',
          email: response.data.email || '',
          bio: response.data.bio || '',
          weight: response.data.weight || '',
          height: response.data.height || '',
          age: response.data.age || ''
        });
        
        // Set privacy preferences
        if (response.data.activityPreferences) {
          setPrivacyData({
            privacyDefault: response.data.activityPreferences.privacyDefault || 'public',
            distanceUnit: response.data.activityPreferences.distanceUnit || 'km',
            paceUnit: response.data.activityPreferences.paceUnit || 'min/km'
          });
        }
      } else {
        setError(response.message || 'Failed to fetch profile');
      }
    } catch (err) {
      setError('An error occurred while fetching your profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await getUserStats(token);
      
      if (response.success) {
        setUserStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching user stats:', err);
    }
  };

  const fetchWeightHistory = async () => {
    setWeightLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await getWeightHistory(token, { limit: 30 });
      
      if (response.success) {
        setWeightHistory(response.data);
      }
    } catch (err) {
      console.error('Error fetching weight history:', err);
    } finally {
      setWeightLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePrivacyChange = (e) => {
    const { name, value } = e.target;
    setPrivacyData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleWeightEntryChange = (e) => {
    const { name, value } = e.target;
    setWeightEntryData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewImage = document.getElementById('profilePreview');
        if (previewImage) {
          previewImage.src = e.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedImage) return;
    
    setUploading(true);
    setUploadError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUploadError('Authentication required');
        return;
      }
      
      const response = await uploadProfilePicture(token, selectedImage);
      
      if (response.success) {
        // Update user with new profile picture
        setUser(prev => ({
          ...prev,
          profilePicture: response.data.profilePicture
        }));
        setSelectedImage(null);
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      } else {
        setUploadError(response.message || 'Failed to upload profile picture');
      }
    } catch (err) {
      setUploadError('An error occurred while uploading profile picture');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdateSuccess(false);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Split name into firstName and lastName for the API
      let firstName = formData.name;
      let lastName = '';
      
      if (formData.name.includes(' ')) {
        const nameParts = formData.name.split(' ');
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      }

      // Map frontend fields to database fields
      const profileData = {
        firstName,
        lastName,
        bio: formData.bio,
        weight: formData.weight ? Number(formData.weight) : undefined,
        height: formData.height ? Number(formData.height) : undefined,
        age: formData.age ? Number(formData.age) : undefined
      };

      console.log('Updating profile with data:', profileData);
      const response = await updateUserProfile(token, profileData);
      
      if (response.success) {
        // Update local user state to reflect changes
        setUser({
          ...user,
          firstName,
          lastName,
          bio: formData.bio,
          weight: profileData.weight,
          height: profileData.height,
          age: profileData.age
        });
        setUpdateSuccess(true);
        setEditMode(false);

        // Also upload the image if one is selected
        if (selectedImage) {
          await handleImageUpload();
        }
      } else {
        setError(response.message || 'Failed to update profile');
      }
    } catch (err) {
      setError('An error occurred while updating your profile');
      console.error(err);
    }
  };

  const handlePrivacySubmit = async (e) => {
    e.preventDefault();
    setUpdateSuccess(false);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await updatePrivacySettings(token, privacyData);
      
      if (response.success) {
        // Update user with new privacy settings
        setUser(prev => ({
          ...prev,
          activityPreferences: response.data.activityPreferences
        }));
        setUpdateSuccess(true);
        setPrivacyMode(false);
      } else {
        setError(response.message || 'Failed to update privacy settings');
      }
    } catch (err) {
      setError('An error occurred while updating privacy settings');
      console.error(err);
    }
  };

  const handleWeightEntrySubmit = async (e) => {
    e.preventDefault();
    setUpdateSuccess(false);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Validate weight
      if (!weightEntryData.weight || isNaN(weightEntryData.weight) || Number(weightEntryData.weight) <= 0) {
        setError('Please enter a valid weight');
        return;
      }

      const response = await addWeightEntry(token, {
        weight: Number(weightEntryData.weight),
        date: weightEntryData.date ? new Date(weightEntryData.date).toISOString() : undefined,
        note: weightEntryData.note
      });
      
      if (response.success) {
        // Update user with new weight
        setUser(prev => ({
          ...prev,
          weight: Number(weightEntryData.weight)
        }));
        
        // Reset form
        setWeightEntryData({
          weight: '',
          date: new Date().toISOString().split('T')[0],
          note: ''
        });
        
        setUpdateSuccess(true);
        
        // Fetch updated weight history
        fetchWeightHistory();
      } else {
        setError(response.message || 'Failed to add weight entry');
      }
    } catch (err) {
      setError('An error occurred while adding weight entry');
      console.error(err);
    }
  };

  // Helper function to format distance unit based on user preferences
  const getDistanceUnit = () => {
    return user?.activityPreferences?.distanceUnit || 'km';
  };

  // Helper function to get full name
  const getFullName = () => {
    if (!user) return 'User';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
  };
  
  // Helper function to get profile picture URL
  const getProfilePictureUrl = () => {
    if (!user || !user.profilePicture) {
      return `https://ui-avatars.com/api/?name=${getFullName()}&background=0D8ABC&color=fff`;
    }
    
    // Use the helper function from apiService to get the correct URL
    return getImageUrl(user.profilePicture);
  };

  // Format pace to min:sec
  const formatPace = (seconds) => {
    if (!seconds) return '--';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')} min/km`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const toggleWeightHistory = () => {
    if (!weightHistoryMode) {
      fetchWeightHistory();
    }
    setWeightHistoryMode(!weightHistoryMode);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-green-600 text-xl">Loading profile...</div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-16">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Your Profile</h1>
        
        {updateSuccess && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
            Profile updated successfully!
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {!editMode && !privacyMode && !weightHistoryMode ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center mb-6">
                {/* Profile picture */}
                <div className="mb-4 md:mb-0 md:mr-6">
                  <div className="w-24 h-24 rounded-full overflow-hidden">
                    <img 
                      src={getProfilePictureUrl()}
                      alt={getFullName()}
                      className="w-full h-full object-cover" 
                    />
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col md:flex-row md:justify-between md:items-center">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2 md:mb-0">{getFullName()}</h2>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button 
                      onClick={() => setEditMode(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Edit Profile
                    </button>
                    <button 
                      onClick={() => setPrivacyMode(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Privacy Settings
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-gray-800">{user?.email || 'Not provided'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Username</p>
                  <p className="text-gray-800">{user?.username || 'Not set'}</p>
                </div>
                
                <div className="flex flex-col">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500">Weight</p>
                    <button 
                      onClick={toggleWeightHistory}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Weight History
                    </button>
                  </div>
                  <p className="text-gray-800">{user?.weight ? `${user.weight} kg` : 'Not set'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Height</p>
                  <p className="text-gray-800">{user?.height ? `${user.height} cm` : 'Not set'}</p>
                </div>
                
                {user?.age && (
                  <div>
                    <p className="text-sm text-gray-500">Age</p>
                    <p className="text-gray-800">{user.age} years</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-gray-500">Preferred Units</p>
                  <p className="text-gray-800">{getDistanceUnit()}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Default Privacy</p>
                  <p className="text-gray-800 capitalize">{user?.activityPreferences?.privacyDefault || 'Public'}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Pace Display</p>
                  <p className="text-gray-800">{user?.activityPreferences?.paceUnit || 'min/km'}</p>
                </div>
              </div>
              
              {user?.bio && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500">Bio</p>
                  <p className="text-gray-800">{user.bio}</p>
                </div>
              )}
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4">
              <h3 className="text-lg font-medium text-gray-800 mb-2">Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Routes</p>
                  <p className="text-xl font-semibold text-gray-800">{user?.routesCount || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Distance</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {user?.totalDistance ? (user.totalDistance / 1000).toFixed(1) : '0'} {getDistanceUnit()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Activities</p>
                  <p className="text-xl font-semibold text-gray-800">{userStats?.totalActivities || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg. Pace</p>
                  <p className="text-xl font-semibold text-gray-800">{user?.averagePace ? formatPace(user.averagePace) : '--'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Steps</p>
                  <p className="text-xl font-semibold text-gray-800">{userStats?.totalSteps?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Calories Burned</p>
                  <p className="text-xl font-semibold text-gray-800">{userStats?.totalCalories?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Elevation Gain</p>
                  <p className="text-xl font-semibold text-gray-800">{userStats?.totalElevationGain?.toLocaleString() || 0} m</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Time</p>
                  <p className="text-xl font-semibold text-gray-800">{userStats?.durationFormatted || '--'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : editMode ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              {/* Profile Picture Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Picture
                </label>
                <div className="flex items-center">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 mr-4">
                    <img 
                      id="profilePreview"
                      src={getProfilePictureUrl()}
                      alt={getFullName()}
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max 5MB.</p>
                    
                    {uploadError && (
                      <p className="text-xs text-red-500 mt-1">{uploadError}</p>
                    )}
                    
                    {selectedImage && (
                      <button
                        type="button"
                        onClick={handleImageUpload}
                        disabled={uploading}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-blue-300"
                      >
                        {uploading ? 'Uploading...' : 'Upload Now'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    name="height"
                    value={formData.height}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : privacyMode ? (
          <form onSubmit={handlePrivacySubmit} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Privacy Settings</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Privacy Level
                </label>
                <select
                  name="privacyDefault"
                  value={privacyData.privacyDefault}
                  onChange={handlePrivacyChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                >
                  <option value="public">Public - Visible to everyone</option>
                  <option value="followers">Followers - Only visible to your followers</option>
                  <option value="private">Private - Only visible to you</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">This setting will be applied to new activities by default</p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Distance Unit
                </label>
                <select
                  name="distanceUnit"
                  value={privacyData.distanceUnit}
                  onChange={handlePrivacyChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                >
                  <option value="km">Kilometers (km)</option>
                  <option value="miles">Miles (mi)</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pace Display
                </label>
                <select
                  name="paceUnit"
                  value={privacyData.paceUnit}
                  onChange={handlePrivacyChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                >
                  <option value="min/km">Minutes per kilometer (min/km)</option>
                  <option value="min/mile">Minutes per mile (min/mile)</option>
                </select>
              </div>
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setPrivacyMode(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Save Privacy Settings
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Weight History</h2>
                <button
                  onClick={() => setWeightHistoryMode(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  &times;
                </button>
              </div>
              
              <form onSubmit={handleWeightEntrySubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-700 mb-3">Add Weight Entry</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="weight"
                      value={weightEntryData.weight}
                      onChange={handleWeightEntryChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      name="date"
                      value={weightEntryData.date}
                      onChange={handleWeightEntryChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      name="note"
                      value={weightEntryData.note}
                      onChange={handleWeightEntryChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                      placeholder="e.g. After workout"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                  >
                    Save Weight Entry
                  </button>
                </div>
              </form>
              
              {weightLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600 mb-2"></div>
                  <p className="text-gray-500">Loading weight history...</p>
                </div>
              ) : weightHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No weight entries found. Add your first entry above.
                </div>
              ) : (
                <div>
                  <h3 className="font-medium text-gray-700 mb-3">Weight History</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight (kg)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {weightHistory.map((entry, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(entry.date)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.weight}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => setWeightHistoryMode(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Back to Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
