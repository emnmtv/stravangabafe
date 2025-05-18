import React, { useState, useEffect, useCallback } from 'react';
import { 
  getUserActivities, 
  getActivityById, 
  getActiveSession, 
  resetSession,
  getAllChallenges,
  getUserChallenges,
  getChallengeById,
  joinChallenge,
  leaveChallenge,
  archiveActivity
} from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom markers for start and end points
const startIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #4CAF50; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.4);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const endIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #F44336; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.4);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const ActivityTypeFilter = ({ selectedType, onChange }) => {
  const types = [
    { value: '', label: 'All' },
    { value: 'run', label: 'Run' },
    { value: 'jog', label: 'Jog' },
    { value: 'walk', label: 'Walk' },
    { value: 'cycling', label: 'Cycling' },
    { value: 'hiking', label: 'Hiking' }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {types.map(type => (
        <button
          key={type.value}
          onClick={() => onChange(type.value)}
          className={`px-3 py-1.5 rounded-full text-sm ${
            selectedType === type.value
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
};

// Add a new SimulationFilter component
const SimulationFilter = ({ selectedFilter, onChange }) => {
  const filters = [
    { value: 'all', label: 'All Activities' },
    { value: 'real', label: 'Real Activities' },
    { value: 'simulated', label: 'Simulated' }
  ];

    return (    <div className="flex flex-wrap items-center gap-2 mt-3">      <div className="text-sm text-gray-600 mr-2">Activity Source:</div>
      {filters.map(filter => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={`px-3 py-1.5 rounded-full text-sm ${
            selectedFilter === filter.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
};

const ActivityCard = ({ activity, onClick }) => {
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Format time (in seconds) to readable format
  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  // Format distance - Converting from meters to kilometers
  const formatDistance = (distanceInMeters) => {
    if (!distanceInMeters && distanceInMeters !== 0) return '--';
    // Convert from meters to kilometers
    const distanceInKm = distanceInMeters / 1000;
    return distanceInKm.toFixed(2) + ' km';
  };

  // Format speed in km/h
  const formatSpeed = (metersPerSecond) => {
    if (!metersPerSecond && metersPerSecond !== 0) return '--';
    // Convert m/s to km/h
    const kmPerHour = metersPerSecond * 3.6;
    return kmPerHour.toFixed(1) + ' km/h';
  };

  // Get appropriate icon and color based on activity type
  const getActivityMeta = (type) => {
    switch (type) {
      case 'run':
        return { 
          icon: '🏃‍♂️', 
          color: 'bg-blue-100 text-blue-800',
          title: 'Run' 
        };
      case 'jog':
        return { 
          icon: '🏃', 
          color: 'bg-green-100 text-green-800',
          title: 'Jog' 
        };
      case 'walk':
        return { 
          icon: '🚶', 
          color: 'bg-teal-100 text-teal-800',
          title: 'Walk' 
        };
      case 'cycling':
        return { 
          icon: '🚴', 
          color: 'bg-red-100 text-red-800',
          title: 'Cycling' 
        };
      case 'hiking':
        return { 
          icon: '🥾', 
          color: 'bg-orange-100 text-orange-800',
          title: 'Hiking' 
        };
      default:
        return { 
          icon: '🏋️', 
          color: 'bg-purple-100 text-purple-800',
          title: 'Other' 
        };
    }
  };

  const activityMeta = getActivityMeta(activity.type);

  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onClick(activity)}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg mb-1">{activity.title || 'Untitled Activity'}</h3>
            <p className="text-gray-500 text-sm">{formatDate(activity.startTime)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-block px-2 py-1 rounded-full text-xs ${activityMeta.color}`}>
              {activityMeta.icon} {activityMeta.title}
            </span>
            {activity.simulated && (
              <span className="inline-block px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800">
                ⚡ Simulated
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-500">Distance</p>
            <p className="font-semibold">{formatDistance(activity.distance)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Duration</p>
            <p className="font-semibold">{formatDuration(activity.duration)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Avg Speed</p>
            <p className="font-semibold">{formatSpeed(activity.averageSpeed)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Elevation Gain</p>
            <p className="font-semibold">{activity.elevationGain || 0} m</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Route Map Preview Component
const RouteMapPreview = ({ route, onFullScreen }) => {
  if (!route || !route.coordinates || route.coordinates.length < 2) {
    return (
      <div className="h-48 bg-gray-200 rounded flex items-center justify-center">
        <p className="text-gray-500">No route data available</p>
      </div>
    );
  }

  // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
  const pathCoordinates = route.coordinates.map(coord => 
    Array.isArray(coord) && coord.length >= 2 ? [coord[1], coord[0]] : null
  ).filter(Boolean);

  if (pathCoordinates.length < 2) {
    return (
      <div className="h-48 bg-gray-200 rounded flex items-center justify-center">
        <p className="text-gray-500">Invalid route data</p>
      </div>
    );
  }

  const startPoint = pathCoordinates[0];
  const endPoint = pathCoordinates[pathCoordinates.length - 1];
  
  return (
    <div className="h-48 rounded overflow-hidden activity-map relative">
      <MapContainer
        style={{ height: '100%', width: '100%' }}
        bounds={L.latLngBounds(pathCoordinates)}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Polyline 
          positions={pathCoordinates}
          color="#4CAF50"
          weight={5}
          opacity={0.8}
        />
        <Marker position={startPoint} icon={startIcon} />
        {JSON.stringify(endPoint) !== JSON.stringify(startPoint) && (
          <Marker position={endPoint} icon={endIcon} />
        )}
      </MapContainer>
      {onFullScreen && (
        <div className="absolute bottom-2 right-2">
          <button 
            onClick={() => onFullScreen(pathCoordinates)}
            className="bg-white p-1 rounded shadow-md"
            title="View full screen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

const ActivityDetailModal = ({ activity, onClose, onArchive }) => {
  const [fullScreenMap, setFullScreenMap] = useState(false);
  const [mapCoordinates, setMapCoordinates] = useState(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  
  if (!activity) return null;

  // Format date and time
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format time (in seconds) to readable format
  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };
  
  // Format distance - Converting from meters to kilometers
  const formatDistance = (distanceInMeters) => {
    if (!distanceInMeters && distanceInMeters !== 0) return '--';
    // Convert from meters to kilometers
    const distanceInKm = distanceInMeters / 1000;
    return distanceInKm.toFixed(2) + ' km';
  };

  // Format speed in km/h
  const formatSpeed = (metersPerSecond) => {
    if (!metersPerSecond && metersPerSecond !== 0) return '--';
    // Convert m/s to km/h
    const kmPerHour = metersPerSecond * 3.6;
    return kmPerHour.toFixed(1) + ' km/h';
  };

  // Calculate pace (min/km)
  const calculatePace = (durationSeconds, distanceMeters) => {
    if (!durationSeconds || !distanceMeters || distanceMeters === 0) return '--';
    
    // Convert distance from meters to kilometers
    const distanceKm = distanceMeters / 1000;
    
    const paceInSecondsPerKm = (durationSeconds / distanceKm);
    const minutes = Math.floor(paceInSecondsPerKm / 60);
    const seconds = Math.floor(paceInSecondsPerKm % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
  };
  
  // Handle showing the full screen map
  const handleFullScreenMap = (coordinates) => {
    setMapCoordinates(coordinates);
    setFullScreenMap(true);
  };
  
  // Close the full screen map
  const closeFullScreenMap = () => {
    setFullScreenMap(false);
  };
  
  // If in full screen map mode, display only the map
  if (fullScreenMap && mapCoordinates) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute top-4 right-4 z-10">
          <button 
            onClick={closeFullScreenMap}
            className="bg-white p-2 rounded-full shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="h-full w-full activity-map">
          <MapContainer
            style={{ height: '100%', width: '100%' }}
            bounds={L.latLngBounds(mapCoordinates)}
            zoom={14}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <Polyline 
              positions={mapCoordinates}
              color="#4CAF50"
              weight={5}
              opacity={0.8}
            />
            <Marker position={mapCoordinates[0]} icon={startIcon} />
            {JSON.stringify(mapCoordinates[mapCoordinates.length-1]) !== JSON.stringify(mapCoordinates[0]) && (
              <Marker position={mapCoordinates[mapCoordinates.length-1]} icon={endIcon} />
            )}
          </MapContainer>
        </div>
      </div>
    );
  }

  const handleArchiveClick = () => {
    setArchiveConfirmOpen(true);
  };

  const confirmArchive = () => {
    if (onArchive) {
      onArchive(activity._id);
    }
    setArchiveConfirmOpen(false);
    onClose();
  };

  const cancelArchive = () => {
    setArchiveConfirmOpen(false);
  };

  return (
    <div className="activity-modal">
      <div className="activity-modal-content">
        {/* Header with Close Button */}
        <div className="modal-header">
          <h2 className="text-xl font-bold">{activity.title || 'Untitled Activity'}</h2>
            <button 
              onClick={onClose}
            className="close-btn"
            aria-label="Close"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
        <div className="p-4">
          {/* Activity Type Badge */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                {activity.type?.charAt(0).toUpperCase() + activity.type?.slice(1) || 'Activity'} 
              </span>
              {activity.simulated && (
                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
                  ⚡ Simulated Activity
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-2 text-sm">{activity.description || 'No description'}</p>
            
            {/* Archive Button */}
            <div className="mt-2">
              <button 
                onClick={handleArchiveClick}
                className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive Activity
              </button>
            </div>
          </div>
          
          {/* Main Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Date & Time */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-600 mb-2 text-sm">Date & Time</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Start</p>
                  <p>{formatDateTime(activity.startTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">End</p>
                  <p>{formatDateTime(activity.endTime)}</p>
                </div>
              </div>
            </div>
            
            {/* Basic Stats */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-600 mb-2 text-sm">Basic Stats</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Distance</p>
                  <p>{formatDistance(activity.distance)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p>{formatDuration(activity.duration)}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Extended Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Pace</p>
              <p className="font-semibold">{calculatePace(activity.duration, activity.distance)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Avg Speed</p>
              <p className="font-semibold">{formatSpeed(activity.averageSpeed)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Max Speed</p>
              <p className="font-semibold">{formatSpeed(activity.maxSpeed)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Calories</p>
              <p className="font-semibold">{activity.calories?.toLocaleString() || 0} kcal</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Elevation Gain</p>
              <p className="font-semibold">{activity.elevationGain || 0} m</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Avg Pace</p>
              <p className="font-semibold">{activity.averagePace ? (activity.averagePace / 60).toFixed(2) + ' min/km' : '--'}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Steps</p>
              <p className="font-semibold">{activity.steps?.toLocaleString() || 'N/A'}</p>
            </div>
          </div>

          {/* Heart Rate and Steps Summary (if available) */}
          {activity.steps > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <h3 className="font-semibold text-gray-600 mb-2 text-sm">Activity Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Steps Taken</p>
                  <p className="text-lg font-semibold">{activity.steps?.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Average stride: {activity.distance && activity.steps ? 
                      ((activity.distance) / activity.steps).toFixed(2) + ' m/step' : 
                      'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Energy</p>
                  <p className="text-lg font-semibold">{activity.calories?.toLocaleString() || 0} kcal</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.calories && activity.duration ? 
                      'Burn rate: ' + ((activity.calories / (activity.duration / 60))).toFixed(1) + ' kcal/min' : 
                      ''}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Route Map */}
          {activity.route && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-600 text-sm">Route Map</h3>
                <button 
                  className="text-xs text-blue-600 hover:text-blue-800"
                  onClick={() => {
                    const pathCoordinates = activity.route.coordinates?.map(coord => 
                      Array.isArray(coord) && coord.length >= 2 ? [coord[1], coord[0]] : null
                    ).filter(Boolean);
                    
                    if (pathCoordinates && pathCoordinates.length >= 2) {
                      handleFullScreenMap(pathCoordinates);
                    }
                  }}
                >
                  View Full Screen
                </button>
              </div>
              <RouteMapPreview 
                route={activity.route} 
                onFullScreen={handleFullScreenMap}
              />
            </div>
          )}
          
          {/* Archive Confirmation Dialog */}
          {archiveConfirmOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <h3 className="text-lg font-semibold mb-2">Archive Activity</h3>
                <p className="mb-4 text-gray-600">
                  Are you sure you want to archive this activity? Archived activities won't appear in your normal activities list or count towards your statistics, but you can access them anytime from the archived activities section.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelArchive}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmArchive}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Archive
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer with Close Button */}
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Tab selector component
const TabSelector = ({ activeTab, onTabChange }) => {
  // For now, we're only showing the Activities tab
  // Keeping the code structure intact for easy re-enabling of the tab later
  const showActiveSessionTab = false; // Set to true to show the Active Session tab again
  const navigate = useNavigate();

  return (
    <div className="flex border-b border-gray-200 mb-4">
      <button
        className={`px-4 py-2 font-medium text-sm ${
          activeTab === 'activities'
            ? 'border-b-2 border-green-500 text-green-600'
            : 'text-gray-500 hover:text-gray-700'
        }`}
        onClick={() => onTabChange('activities')}
      >
        Activities
      </button>
      
      <button
        className={`px-4 py-2 font-medium text-sm ${
          activeTab === 'challenges'
            ? 'border-b-2 border-green-500 text-green-600'
            : 'text-gray-500 hover:text-gray-700'
        }`}
        onClick={() => onTabChange('challenges')}
      >
        Challenges
      </button>

      <button
        className="px-4 py-2 font-medium text-sm text-gray-500 hover:text-gray-700"
        onClick={() => navigate('/archived-activities')}
      >
        Archived Activities
      </button>
      
      {showActiveSessionTab && (
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'active-session'
              ? 'border-b-2 border-green-500 text-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => onTabChange('active-session')}
        >
          Active Session
        </button>
      )}
    </div>
  );
};

// Challenge Card Component
const ChallengeCard = ({ challenge, onJoin, onLeave, onViewDetails, isParticipating }) => {
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Calculate challenge status
  const getChallengeStatus = () => {
    const now = new Date();
    const startDate = new Date(challenge.startDate);
    const endDate = new Date(challenge.endDate);
    
    if (now < startDate) {
      return { label: 'Upcoming', color: 'bg-blue-100 text-blue-800' };
    } else if (now > endDate) {
      return { label: 'Completed', color: 'bg-gray-100 text-gray-800' };
    } else {
      return { label: 'Active', color: 'bg-green-100 text-green-800' };
    }
  };

  // Get icon and color based on challenge type
  const getChallengeMeta = (type) => {
    switch (type) {
      case 'distance':
        return { 
          icon: '🏃‍♂️', 
          color: 'bg-blue-100 text-blue-800',
          title: 'Distance Challenge' 
        };
      case 'time':
        return { 
          icon: '⏱️', 
          color: 'bg-purple-100 text-purple-800',
          title: 'Time Challenge' 
        };
      case 'elevation':
        return { 
          icon: '⛰️', 
          color: 'bg-orange-100 text-orange-800',
          title: 'Elevation Challenge' 
        };
      case 'frequency':
        return { 
          icon: '🔄', 
          color: 'bg-teal-100 text-teal-800',
          title: 'Frequency Challenge' 
        };
      default:
        return { 
          icon: '🏆', 
          color: 'bg-green-100 text-green-800',
          title: 'Challenge' 
        };
    }
  };

  const status = getChallengeStatus();
  const challengeMeta = getChallengeMeta(challenge.type);
  
  // Format goal based on challenge type
  const formatGoal = () => {
    switch (challenge.type) {
      case 'distance':
        return `${challenge.goal} km`;
      case 'time':
        const hours = Math.floor(challenge.goal / 3600);
        const minutes = Math.floor((challenge.goal % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
      case 'elevation':
        return `${challenge.goal} m`;
      case 'frequency':
        return `${challenge.goal} activities`;
      default:
        return challenge.goal;
    }
  };
  
  // Calculate your progress if participating
  const getProgress = () => {
    if (!isParticipating) return null;
    const participant = challenge.participants.find(p => {
      const userId = localStorage.getItem('userId');
      if (typeof p.user === 'object' && p.user !== null) {
        return p.user._id === userId;
      }
      return p.user === userId;
    });
    
    if (!participant) return null;
    
    const progress = participant.progress;
    const percentage = Math.min(Math.round((progress / challenge.goal) * 100), 100);
    
    return {
      current: progress,
      percentage,
      completed: participant.completed
    };
  };
  
  const progress = getProgress();
  const isActive = status.label === 'Active';
  
  return (
    <div 
      className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${
        isParticipating ? 'border-2 border-blue-400' : ''
      }`}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg mb-1 cursor-pointer" onClick={() => onViewDetails(challenge)}>
              {challenge.title}
            </h3>
            <p className="text-gray-500 text-sm">
              {formatDate(challenge.startDate)} - {formatDate(challenge.endDate)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-block px-2 py-1 rounded-full text-xs ${status.color}`}>
              {status.label}
            </span>
            <span className={`inline-block px-2 py-1 rounded-full text-xs ${challengeMeta.color}`}>
              {challengeMeta.icon} {challengeMeta.title}
            </span>
            {isParticipating && (
              <span className="inline-block px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 border border-blue-200">
                👤 You're Participating
              </span>
            )}
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-3">{challenge.description}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <p className="text-xs text-gray-500">Goal</p>
            <p className="font-semibold">{formatGoal()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Participants</p>
            <p className="font-semibold">{challenge.participants ? challenge.participants.length : 0}</p>
          </div>
        </div>
        
        {progress && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span>Your Progress</span>
              <span className="font-medium">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${progress.completed ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {progress.current} / {challenge.goal} {challenge.type === 'distance' ? 'km' : 
                challenge.type === 'elevation' ? 'm' : 
                challenge.type === 'time' ? 'min' : 'activities'}
            </div>
          </div>
        )}
        
        <div className="flex justify-end gap-2">
          {isActive && (
            <>
              {!isParticipating ? (
                <button
                  onClick={() => onJoin(challenge._id)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                >
                  Join Challenge
                </button>
              ) : (
                <button
                  onClick={() => onLeave(challenge._id)}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                >
                  Leave Challenge
                </button>
              )}
            </>
          )}
          <button
            onClick={() => onViewDetails(challenge)}
            className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-md text-sm hover:bg-gray-300"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

// Challenge Detail Modal Component
const ChallengeDetailModal = ({ challenge, onClose, isParticipating, onJoin, onLeave }) => {
  if (!challenge) return null;

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Calculate challenge status
  const getChallengeStatus = () => {
    const now = new Date();
    const startDate = new Date(challenge.startDate);
    const endDate = new Date(challenge.endDate);
    
    if (now < startDate) {
      return { label: 'Upcoming', color: 'bg-blue-100 text-blue-800' };
    } else if (now > endDate) {
      return { label: 'Completed', color: 'bg-gray-100 text-gray-800' };
    } else {
      return { label: 'Active', color: 'bg-green-100 text-green-800' };
    }
  };
  
  // Format goal based on challenge type
  const formatGoal = () => {
    switch (challenge.type) {
      case 'distance':
        return `${challenge.goal} kilometers`;
      case 'time':
        const hours = Math.floor(challenge.goal / 3600);
        const minutes = Math.floor((challenge.goal % 3600) / 60);
        return hours > 0 ? `${hours} hours ${minutes} minutes` : `${minutes} minutes`;
      case 'elevation':
        return `${challenge.goal} meters`;
      case 'frequency':
        return `${challenge.goal} activities`;
      default:
        return challenge.goal;
    }
  };
  
  // Get description of what counts for this challenge
  const getChallengeDescription = () => {
    switch (challenge.type) {
      case 'distance':
        return 'Total distance covered in all activities during the challenge period.';
      case 'time':
        return 'Total time spent in activities during the challenge period.';
      case 'elevation':
        return 'Total elevation gain achieved during the challenge period.';
      case 'frequency':
        return 'Total number of activities completed during the challenge period.';
      default:
        return '';
    }
  };
  
  // Get your progress if participating
  const getProgress = () => {
    if (!isParticipating) return null;
    
    let participant;
    if (challenge.participants) {
      participant = challenge.participants.find(p => {
        if (typeof p.user === 'object' && p.user._id) {
          return p.user._id === localStorage.getItem('userId');
        }
        return p.user === localStorage.getItem('userId');
      });
    }
    
    if (!participant) return null;
    
    const progress = participant.progress;
    const percentage = Math.min(Math.round((progress / challenge.goal) * 100), 100);
    
    return {
      current: progress,
      percentage,
      completed: participant.completed,
      completedDate: participant.completedDate
    };
  };
  
  const status = getChallengeStatus();
  const progress = getProgress();
  const isActive = status.label === 'Active';
  
  // Get top participants
  const getTopParticipants = () => {
    if (!challenge.participants || challenge.participants.length === 0) {
      return [];
    }
    
    // Sort by progress
    return [...challenge.participants]
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5) // Top 5
      .map((participant, index) => {
        let userName = `User ${index + 1}`;
        
        // Handle different user object formats
        if (typeof participant.user === 'object') {
          if (participant.user.firstName && participant.user.lastName) {
            userName = `${participant.user.firstName} ${participant.user.lastName}`;
          } else if (participant.user.username) {
            userName = participant.user.username;
          } else if (participant.user.email) {
            userName = participant.user.email.split('@')[0]; // Just the username part of email
          }
        }
        
        return {
          name: userName,
          progress: participant.progress,
          completed: participant.completed,
          percentage: Math.min(Math.round((participant.progress / challenge.goal) * 100), 100)
        };
      });
  };
  
  const topParticipants = getTopParticipants();
  
  return (
    <div className="activity-modal">
      <div className="activity-modal-content">
        {/* Header with Close Button */}
        <div className="modal-header">
          <h2 className="text-xl font-bold">{challenge.title}</h2>
          <button 
            onClick={onClose}
            className="close-btn"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4">
          {/* Challenge Type Badge */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              <span className={`inline-block px-3 py-1 ${status.color} rounded-full text-sm`}>
                {status.label}
              </span>
              <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                {challenge.type.charAt(0).toUpperCase() + challenge.type.slice(1)} Challenge
              </span>
            </div>
            <p className="text-gray-600 mt-2 text-sm">{challenge.description}</p>
          </div>
          
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Date Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-600 mb-2 text-sm">Challenge Period</h3>
              <div className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Start:</span>
                  <span>{formatDate(challenge.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">End:</span>
                  <span>{formatDate(challenge.endDate)}</span>
                </div>
              </div>
            </div>
            
            {/* Goal Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-600 mb-2 text-sm">Challenge Goal</h3>
              <p className="text-xl font-semibold mb-1">{formatGoal()}</p>
              <p className="text-xs text-gray-500">{getChallengeDescription()}</p>
            </div>
          </div>
          
          {/* Your Progress Section */}
          {progress && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <h3 className="font-semibold text-gray-600 mb-2 text-sm">Your Progress</h3>
              
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>{progress.current} / {challenge.goal} {challenge.type === 'distance' ? 'km' : 
                    challenge.type === 'elevation' ? 'm' : 
                    challenge.type === 'time' ? 'min' : 'activities'}</span>
                  <span className="font-medium">{progress.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full ${progress.completed ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress.percentage}%` }}
                  ></div>
                </div>
              </div>
              
              {progress.completed && (
                <div className="mt-2 text-sm text-green-600">
                  <span className="font-medium">Challenge completed!</span>
                  {progress.completedDate && (
                    <span> on {new Date(progress.completedDate).toLocaleDateString()}</span>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Participants Section */}
          <div className="bg-gray-50 p-3 rounded-lg mb-4">
            <h3 className="font-semibold text-gray-600 mb-2 text-sm">Leaderboard</h3>
            
            {topParticipants.length > 0 ? (
              <div className="space-y-2">
                {topParticipants.map((participant, index) => {
                  // Check if this is the current user
                  const userId = localStorage.getItem('userId');
                  const isCurrentUser = challenge.participants.some(p => 
                    (typeof p.user === 'object' && p.user._id === userId) ||
                    p.user === userId
                  ) && index === challenge.participants.findIndex(p => 
                    (typeof p.user === 'object' && p.user._id === userId) ||
                    p.user === userId
                  );
                  
                  return (
                    <div key={index} className={`p-2 ${isCurrentUser ? 'bg-blue-50 border-blue-200' : 'bg-white'} rounded border border-gray-100 transition-all duration-200`}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className={`font-medium text-sm mr-2 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-500' : index === 2 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {index + 1}.
                          </span>
                          <span className="text-sm flex items-center">
                            {participant.name}
                            {isCurrentUser && <span className="ml-1 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">You</span>}
                          </span>
                        </div>
                        <span className="text-xs font-medium">
                          {participant.completed ? 
                            <span className="text-green-600">✅ Completed</span> : 
                            <span>{participant.percentage}%</span>
                          }
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${participant.completed ? 'bg-green-500' : isCurrentUser ? 'bg-blue-500' : 'bg-purple-500'}`}
                          style={{ width: `${participant.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No participants yet.</p>
            )}
          </div>
        </div>
        
        {/* Footer with Action Buttons */}
        <div className="modal-footer">
          {isActive && (
            <>
              {!isParticipating ? (
                <button
                  onClick={() => {
                    onJoin(challenge._id);
                    onClose();
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm mr-2"
                >
                  Join Challenge
                </button>
              ) : (
                <button
                  onClick={() => {
                    onLeave(challenge._id);
                    onClose();
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm mr-2"
                >
                  Leave Challenge
                </button>
              )}
            </>
          )}
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const ActivitiesPage = () => {
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [simulationFilter, setSimulationFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalActivities, setTotalActivities] = useState(0);
  const activitiesPerPage = 8;
  const navigate = useNavigate();
  
  // Add active tab state - set to 'activities' by default
  const [activeTab, setActiveTab] = useState('activities');
  
  // Challenge states
  const [challenges, setChallenges] = useState([]);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeFilter, setChallengeFilter] = useState('active'); // 'active', 'upcoming', 'completed'
  
  // These states are kept for future use when we re-enable the active session tab
  const [activeSession, setActiveSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Add CSS for Leaflet map
  useEffect(() => {
    // Add Leaflet CSS
    const style = document.createElement('style');
    style.innerHTML = `
      .leaflet-container {
        height: 100% !important;
        width: 100% !important;
        z-index: 10;
      }
      .activity-map .leaflet-control-container {
        z-index: 20;
      }
      .activity-map .leaflet-map-pane,
      .activity-map .leaflet-tile,
      .activity-map .leaflet-marker-icon,
      .activity-map .leaflet-marker-shadow,
      .activity-map .leaflet-tile-pane,
      .activity-map .leaflet-overlay-pane,
      .activity-map .leaflet-shadow-pane,
      .activity-map .leaflet-marker-pane,
      .activity-map .leaflet-popup-pane,
      .activity-map .leaflet-overlay-pane svg {
        position: absolute;
        overflow: visible !important;
      }
      .activity-modal {
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 50;
        background-color: rgba(0, 0, 0, 0.5);
        overflow: hidden;
      }
      .activity-modal-content {
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 32rem;
        max-height: calc(100vh - 2rem);
        overflow-y: auto;
        margin: 1rem;
        display: flex;
        flex-direction: column;
      }
      .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
      }
      .modal-header {
        position: sticky;
        top: 0;
        background-color: white;
        z-index: 10;
        padding: 1rem;
        border-bottom: 1px solid #edf2f7;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .modal-footer {
        position: sticky;
        bottom: 0;
        background-color: white;
        z-index: 10;
        padding: 0.75rem 1rem;
        border-top: 1px solid #edf2f7;
        display: flex;
        justify-content: flex-end;
      }
      .close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 9999px;
        padding: 0.5rem;
        background-color: #f3f4f6;
        transition: all 0.2s;
      }
      .close-btn:hover {
        background-color: #e5e7eb;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Wrap fetchActivities in useCallback to prevent infinite loops
  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to view your activities');
        setLoading(false);
        return;
      }

      const options = {
        limit: activitiesPerPage,
        skip: (currentPage - 1) * activitiesPerPage,
        sort: '-startTime' // Most recent first
      };

      if (filter) {
        options.type = filter;
      }

      const response = await getUserActivities(token, options);

      if (response.success) {
        let filteredActivities = [...response.data];
        
        // Apply simulation filter
        if (simulationFilter === 'real') {
          filteredActivities = filteredActivities.filter(activity => activity.simulated === false);
        } else if (simulationFilter === 'simulated') {
          filteredActivities = filteredActivities.filter(activity => activity.simulated === true);
        }

        setActivities(filteredActivities);
        // Adjust total count based on simulation filter
        const filteredTotal = simulationFilter === 'all' 
          ? response.total 
          : filteredActivities.length;
        setTotalActivities(filteredTotal);
      } else {
        setError(response.message || 'Failed to fetch activities');
      }
    } catch (err) {
      setError('An error occurred while fetching your activities');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, currentPage, activitiesPerPage, simulationFilter]);

  // Fetch activities on component mount and when filters change
  useEffect(() => {
    if (activeTab === 'activities') {
      fetchActivities();
    }
  }, [filter, currentPage, simulationFilter, activeTab, fetchActivities]);
  
  // Fetch challenges
  const fetchChallenges = useCallback(async () => {
    setChallengeLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to view challenges');
        setChallengeLoading(false);
        return;
      }

      let response;
      if (challengeFilter === 'my') {
        // Fetch challenges the user is participating in
        response = await getUserChallenges(token);
      } else {
        // Fetch all challenges with active filter
        const isActive = challengeFilter === 'active' ? true : 
                        challengeFilter === 'upcoming' ? 'false' : 
                        undefined;
        response = await getAllChallenges(token, isActive);
      }

      if (response.success) {
        // Process challenges
        let filteredChallenges = [...response.data];
        
        // If we're in 'completed' filter, manually filter to past challenges
        if (challengeFilter === 'completed' && !response.filtered) {
          const now = new Date();
          filteredChallenges = filteredChallenges.filter(challenge => 
            new Date(challenge.endDate) < now
          );
        }
        
        // If we're in 'upcoming' filter, manually filter to future challenges
        if (challengeFilter === 'upcoming' && !response.filtered) {
          const now = new Date();
          filteredChallenges = filteredChallenges.filter(challenge => 
            new Date(challenge.startDate) > now
          );
        }
        
        setChallenges(filteredChallenges);
      } else {
        setError(response.message || 'Failed to fetch challenges');
      }
    } catch (err) {
      setError('An error occurred while fetching challenges');
      console.error(err);
    } finally {
      setChallengeLoading(false);
    }
  }, [challengeFilter]);

  // Fetch challenges when tab or filter changes
  useEffect(() => {
    if (activeTab === 'challenges') {
      fetchChallenges();
    }
  }, [activeTab, challengeFilter, fetchChallenges]);
  
  // Check if user is participating in a challenge
  const isParticipatingInChallenge = (challenge) => {
    if (!challenge || !challenge.participants) return false;
    
    const userId = localStorage.getItem('userId');
    if (!userId) return false;
    
    return challenge.participants.some(p => {
      // Check different formats of user property
      if (typeof p.user === 'object' && p.user !== null) {
        return p.user._id === userId;
      }
      return p.user === userId;
    });
  };
  
  // Handle joining a challenge
  const handleJoinChallenge = async (challengeId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to join a challenge');
        return;
      }
      
      setChallengeLoading(true);
      const response = await joinChallenge(token, challengeId);
      
      if (response.success) {
        // Update the local challenges data to reflect the change
        const updatedChallenges = challenges.map(challenge => {
          if (challenge._id === challengeId) {
            // Add the current user to the participants
            const userId = localStorage.getItem('userId');
            const userName = localStorage.getItem('userName') || 'You';
            
            // Create a participant object for the current user
            const newParticipant = {
              user: {
                _id: userId,
                firstName: userName,
                username: userName
              },
              progress: 0,
              completed: false
            };
            
            // Return updated challenge with new participant
            return {
              ...challenge,
              participants: [...(challenge.participants || []), newParticipant]
            };
          }
          return challenge;
        });
        
        setChallenges(updatedChallenges);
        
        // Also update selected challenge if open
        if (selectedChallenge && selectedChallenge._id === challengeId) {
          const userId = localStorage.getItem('userId');
          const userName = localStorage.getItem('userName') || 'You';
          
          const newParticipant = {
            user: {
              _id: userId,
              firstName: userName,
              username: userName
            },
            progress: 0,
            completed: false
          };
          
          setSelectedChallenge({
            ...selectedChallenge,
            participants: [...(selectedChallenge.participants || []), newParticipant]
          });
        }
        
        alert('Successfully joined the challenge!');
      } else {
        setError(response.message || 'Failed to join challenge');
      }
    } catch (err) {
      console.error('Error joining challenge:', err);
      setError('An error occurred while joining the challenge');
    } finally {
      setChallengeLoading(false);
    }
  };
  
  // Handle leaving a challenge
  const handleLeaveChallenge = async (challengeId) => {
    if (!window.confirm('Are you sure you want to leave this challenge? Your progress will be lost.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to leave a challenge');
        return;
      }
      
      setChallengeLoading(true);
      const response = await leaveChallenge(token, challengeId);
      
      if (response.success) {
        // Update the local challenges data to reflect the change
        const userId = localStorage.getItem('userId');
        
        const updatedChallenges = challenges.map(challenge => {
          if (challenge._id === challengeId) {
            // Remove the current user from the participants
            return {
              ...challenge,
              participants: (challenge.participants || []).filter(p => {
                if (typeof p.user === 'object' && p.user !== null) {
                  return p.user._id !== userId;
                }
                return p.user !== userId;
              })
            };
          }
          return challenge;
        });
        
        setChallenges(updatedChallenges);
        
        // Close the detail modal if open
        if (selectedChallenge && selectedChallenge._id === challengeId) {
          setSelectedChallenge(null);
        }
        
        alert('Successfully left the challenge');
      } else {
        setError(response.message || 'Failed to leave challenge');
      }
    } catch (err) {
      console.error('Error leaving challenge:', err);
      setError('An error occurred while leaving the challenge');
    } finally {
      setChallengeLoading(false);
    }
  };
  
  // Handle viewing challenge details
  const handleViewChallengeDetails = async (challenge) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // If we already have full details with populated participant data, just show the modal
      if (challenge.participants && 
          Array.isArray(challenge.participants) && 
          challenge.participants.length > 0 && 
          typeof challenge.participants[0].user === 'object' &&
          (challenge.participants[0].user.firstName || challenge.participants[0].user.username)) {
        setSelectedChallenge(challenge);
        return;
      }
      
      // Fetch full challenge details
      setChallengeLoading(true);
      const response = await getChallengeById(token, challenge._id);
      
      if (response.success) {
        // Process the response to ensure we have proper user information
        const fullChallenge = response.data;
        
        // If participants don't have proper user info, try to enhance it
        if (fullChallenge.participants && Array.isArray(fullChallenge.participants)) {
          fullChallenge.participants = fullChallenge.participants.map(participant => {
            // If user is just an ID, create a basic user object
            if (typeof participant.user !== 'object') {
              return {
                ...participant,
                user: {
                  _id: participant.user,
                  username: `User ${fullChallenge.participants.indexOf(participant) + 1}`
                }
              };
    }
            return participant;
          });
        }
        
        setSelectedChallenge(fullChallenge);
      } else {
        // If fetch fails, just use the summary data we have
        console.error('Failed to fetch challenge details:', response.message);
        setSelectedChallenge(challenge);
      }
    } catch (err) {
      console.error('Error fetching challenge details:', err);
      // Still show the challenge with what we have
      setSelectedChallenge(challenge);
    } finally {
      setChallengeLoading(false);
    }
  };

  // Handle activity click
  const handleActivityClick = async (activity) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // If we already have full details, just show the modal
      if (activity.locationHistory) {
        setSelectedActivity(activity);
        return;
      }

      // Otherwise fetch the full details
      setLoading(true);
      const response = await getActivityById(token, activity._id);
      if (response.success) {
        // Process the route data properly
        const fullActivity = response.data;
        
        // Ensure the route data is in the proper format
        if (fullActivity.route && typeof fullActivity.route === 'string') {
          try {
            fullActivity.route = JSON.parse(fullActivity.route);
          } catch (e) {
            console.error('Error parsing route JSON:', e);
          }
        }
        
        // If route is still missing coordinates, try to construct from locationHistory
        if ((!fullActivity.route || !fullActivity.route.coordinates) && fullActivity.locationHistory && fullActivity.locationHistory.length > 0) {
          fullActivity.route = {
            type: 'LineString',
            coordinates: fullActivity.locationHistory.map(point => 
              point.location && point.location.coordinates ? point.location.coordinates : null
            ).filter(Boolean)
          };
        }
        
        // Make sure we include everything from the original activity if it's not in the full one
        const mergedActivity = {
          ...activity,  // Include fields from the list view
          ...fullActivity, // Override with detailed view fields
        };
        
        console.log('Processed activity for display:', mergedActivity);
        setSelectedActivity(mergedActivity);
      } else {
        // If fetch fails, just use the summary data we have
        console.error('Failed to fetch activity details:', response.message);
        setSelectedActivity(activity);
      }
    } catch (err) {
      console.error('Error fetching activity details:', err);
      // Still show the activity with what we have
      setSelectedActivity(activity);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (type) => {
    setFilter(type);
    setCurrentPage(1); // Reset to page 1 when filter changes
  };

  const handleSimulationFilterChange = (type) => {
    setSimulationFilter(type);
    setCurrentPage(1); // Reset to page 1 when filter changes
  };

  const totalPages = Math.ceil(totalActivities / activitiesPerPage);
  
  // Active Session Display Component
  const ActiveSessionDisplay = ({ session }) => {
    if (!session) {
      return (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">No active session found.</p>
          <p className="text-sm text-gray-500 mb-4">
            Start a new activity to create an active session.
          </p>
          <button
            onClick={() => navigate('/routes')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Start New Activity
          </button>
        </div>
      );
    }
    
    // Format duration in seconds to readable format
    const formatDuration = (seconds) => {
      if (!seconds && seconds !== 0) return '--';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      } else {
        return `${remainingSeconds}s`;
      }
    };
    
    // Format datetime
    const formatDateTime = (dateString) => {
      if (!dateString) return '--';
      const date = new Date(dateString);
      return date.toLocaleString();
    };
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg">Active Session</h3>
            <p className="text-sm text-gray-500">Started: {formatDateTime(session.startTime)}</p>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs">
            {session.isActive ? 'Active' : 'Paused'}
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">Distance</p>
            <p className="font-semibold">{(session.currentDistance || 0).toFixed(2)} km</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">Duration</p>
            <p className="font-semibold">{formatDuration(session.currentDuration)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">Current Speed</p>
            <p className="font-semibold">{(session.currentSpeed || 0).toFixed(1)} km/h</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">Last Updated</p>
            <p className="font-semibold">{formatDateTime(session.lastUpdated)}</p>
          </div>
        </div>
        
        {session.currentLocation?.coordinates && (
          <div className="bg-gray-50 p-3 rounded-lg mb-4">
            <h3 className="font-semibold text-gray-600 mb-2 text-sm">Current Location</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500">Latitude</p>
                <p className="font-mono text-xs">{session.currentLocation.coordinates[1]}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Longitude</p>
                <p className="font-mono text-xs">{session.currentLocation.coordinates[0]}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            onClick={() => {
              // Implement reset session logic
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reset Session
          </button>
        </div>
      </div>
    );
  };

  // Allow changing to both activities and challenges tabs
  const handleTabChange = (tab) => {
    if (tab === 'activities' || tab === 'challenges') {
      setActiveTab(tab);
    }
  };

  // Challenge filter component
  const ChallengeFilter = ({ selectedFilter, onChange }) => {
    const filters = [
      { value: 'active', label: 'Active' },
      { value: 'upcoming', label: 'Upcoming' },
      { value: 'completed', label: 'Completed' },
      { value: 'my', label: 'My Challenges' }
    ];
  
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(filter => (
            <button
              key={filter.value}
              onClick={() => onChange(filter.value)}
              className={`px-3 py-1.5 rounded-full text-sm ${
                selectedFilter === filter.value
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Handle archiving an activity
  const handleArchiveActivity = async (activityId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      setLoading(true);
      const response = await archiveActivity(token, activityId);
      
      if (response.success) {
        // Remove the archived activity from the activities list
        setActivities(activities.filter(activity => activity._id !== activityId));
        setTotalActivities(prev => prev - 1);
        alert('Activity archived successfully. View it in the Archived Activities section.');
      } else {
        setError(response.message || 'Failed to archive activity');
      }
    } catch (err) {
      console.error('Error archiving activity:', err);
      setError('An error occurred while archiving the activity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Your Activities</h1>
          <button
            onClick={() => navigate('/routes')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Start New Activity
          </button>
        </div>
        
        {/* Tab Selector */}
        <TabSelector 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
        />

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Active Session Tab */}
        {activeTab === 'active-session' && (
          <div>
            {sessionLoading ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600 mb-4"></div>
                <p className="text-gray-600">Loading active session...</p>
              </div>
            ) : (
              <ActiveSessionDisplay session={activeSession} />
            )}
          </div>
        )}

        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <ActivityTypeFilter selectedType={filter} onChange={handleFilterChange} />
              <SimulationFilter selectedFilter={simulationFilter} onChange={handleSimulationFilterChange} />
            </div>

        {loading && activities.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600 mb-4"></div>
            <p className="text-gray-600">Loading your activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 mb-4">You don't have any activities yet.</p>
            <button
              onClick={() => navigate('/routes')}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Start Your First Activity
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {activities.map(activity => (
              <ActivityCard 
                key={activity._id} 
                activity={activity} 
                onClick={handleActivityClick}
              />
            ))}
          </div>
        )}

            {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
                <nav className="inline-flex">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-l border ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-800 hover:bg-gray-50'
                    }`}
              >
                    Prev
              </button>
                  
                  <span className="px-3 py-1 border-t border-b bg-green-500 text-white">
                    {currentPage}
                  </span>
                  
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-r border ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-800 hover:bg-gray-50'
                    }`}
              >
                Next
              </button>
            </nav>
          </div>
            )}
          </>
        )}
        
        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <>
            <ChallengeFilter 
              selectedFilter={challengeFilter} 
              onChange={setChallengeFilter} 
            />
            
            {challengeLoading && challenges.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600 mb-4"></div>
                <p className="text-gray-600">Loading challenges...</p>
              </div>
            ) : challenges.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600 mb-4">No challenges found.</p>
                <p className="text-sm text-gray-500">
                  {challengeFilter === 'my' 
                    ? "You haven't joined any challenges yet." 
                    : challengeFilter === 'active'
                    ? "There are no active challenges at the moment."
                    : challengeFilter === 'upcoming'
                    ? "There are no upcoming challenges at the moment."
                    : "There are no completed challenges."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                {challenges.map(challenge => (
                  <ChallengeCard 
                    key={challenge._id} 
                    challenge={challenge}
                    isParticipating={isParticipatingInChallenge(challenge)} 
                    onJoin={handleJoinChallenge}
                    onLeave={handleLeaveChallenge}
                    onViewDetails={handleViewChallengeDetails}
                  />
                ))}
          </div>
            )}
          </>
        )}
      </div>

      {selectedActivity && (
        <ActivityDetailModal 
          activity={selectedActivity} 
          onClose={() => setSelectedActivity(null)} 
          onArchive={handleArchiveActivity}
        />
      )}
      
      {selectedChallenge && (
        <ChallengeDetailModal 
          challenge={selectedChallenge}
          isParticipating={isParticipatingInChallenge(selectedChallenge)}
          onJoin={handleJoinChallenge}
          onLeave={handleLeaveChallenge}
          onClose={() => setSelectedChallenge(null)}
        />
      )}
    </div>
  );
};

export default ActivitiesPage;
