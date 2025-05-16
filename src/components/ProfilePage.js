import React, { useState, useEffect, useRef } from 'react';
import { getUserProfile, updateUserProfile, uploadProfilePicture } from '../services/apiService';

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
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

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
    
    // If the profile picture path starts with http, it's already a full URL
    if (user.profilePicture.startsWith('http')) {
      return user.profilePicture;
    }
    
    // Otherwise, it's a relative path from the backend
    // Get the base URL from environment or build up from API URL
    const serverUrl = "http://192.168.0.106:5000"; // Same domain as API_BASE_URL
    return `${serverUrl}${user.profilePicture}`;
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
                  <button 
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Edit Profile
                  </button>
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
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
