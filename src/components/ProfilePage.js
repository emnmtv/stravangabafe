import React, { useState, useEffect } from 'react';
import { getUserProfile, updateUserProfile } from '../services/apiService';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    weight: '',
    height: '',
    age: ''
  });
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    fetchUserProfile();
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
      } else {
        setError(response.message || 'Failed to update profile');
      }
    } catch (err) {
      setError('An error occurred while updating your profile');
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
        
        {!editMode ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">{getFullName()}</h2>
                <button 
                  onClick={() => setEditMode(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Edit Profile
                </button>
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
                
                <div>
                  <p className="text-sm text-gray-500">Weight</p>
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
                  <p className="text-xl font-semibold text-gray-800">{user?.stats?.totalRoutes || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Distance</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {user?.stats?.totalDistance ? user.stats.totalDistance.toFixed(1) : '0'} {getDistanceUnit()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Activities</p>
                  <p className="text-xl font-semibold text-gray-800">{user?.stats?.totalActivities || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg. Pace</p>
                  <p className="text-xl font-semibold text-gray-800">{user?.stats?.avgPace || '--'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
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
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
