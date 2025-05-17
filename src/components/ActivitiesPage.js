import React, { useState, useEffect, useCallback } from 'react';
import { getUserActivities, getActivityById, getActiveSession, resetSession } from '../services/apiService';
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

  // Format distance - THE DISTANCE IS ALREADY IN KM, not meters
  const formatDistance = (distanceInKm) => {
    if (!distanceInKm && distanceInKm !== 0) return '--';
    return distanceInKm.toFixed(2) + ' km';
  };

  // Format speed in km/h (activity data has speed in km/h already)
  const formatSpeed = (kmPerHour) => {
    if (!kmPerHour && kmPerHour !== 0) return '--';
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

const ActivityDetailModal = ({ activity, onClose }) => {
  const [fullScreenMap, setFullScreenMap] = useState(false);
  const [mapCoordinates, setMapCoordinates] = useState(null);
  
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

  // Calculate pace (min/km)
  const calculatePace = (durationSeconds, distanceKm) => {
    if (!durationSeconds || !distanceKm || distanceKm === 0) return '--';
    
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
                  <p>{activity.distance?.toFixed(2)} km</p>
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
              <p className="font-semibold">{activity.averageSpeed?.toFixed(1)} km/h</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Max Speed</p>
              <p className="font-semibold">{activity.maxSpeed?.toFixed(1)} km/h</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Calories</p>
              <p className="font-semibold">{activity.calories || 0} kcal</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Elevation Gain</p>
              <p className="font-semibold">{activity.elevationGain || 0} m</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Avg Pace</p>
              <p className="font-semibold">{activity.averagePace ? (activity.averagePace / 60).toFixed(2) + ' min/km' : '--'}</p>
            </div>
          </div>
          
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

  return (
    <div className="flex border-b border-gray-200 mb-4">
      <button
        className={`px-4 py-2 font-medium text-sm border-b-2 border-green-500 text-green-600`}
        onClick={() => onTabChange('activities')}
      >
        Activities
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
  
  // Add active tab state - always default to 'activities' since we're hiding the other tab
  const [activeTab, setActiveTab] = useState('activities');
  
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
  
  // Fetch active session when tab changes - disabled for now
  // This is kept for future use when we re-enable the active session tab
  /*
  useEffect(() => {
    if (activeTab === 'active-session') {
      fetchActiveSession();
    }
  }, [activeTab]);
  */
  
  // Function to fetch active session
  const fetchActiveSession = async () => {
    setSessionLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to view your active session');
        setSessionLoading(false);
        return;
      }
      
      const response = await getActiveSession(token);
      console.log('Active session response:', response);
      
      if (response.success) {
        setActiveSession(response.data);
      } else {
        setActiveSession(null);
        if (response.message !== 'No active session found') {
          setError(response.message || 'Failed to fetch active session');
        }
      }
    } catch (err) {
      console.error('Error fetching active session:', err);
      setError('An error occurred while fetching your active session');
    } finally {
      setSessionLoading(false);
    }
  };
  
  // Function to reset active session
  const handleResetSession = async () => {
    if (!window.confirm('Are you sure you want to reset your active session? This cannot be undone.')) {
      return;
    }
    
    setSessionLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to reset your active session');
        return;
      }
      
      const response = await resetSession(token);
      
      if (response.success) {
        setActiveSession(null);
        alert('Session reset successfully');
      } else {
        setError(response.message || 'Failed to reset session');
      }
    } catch (err) {
      console.error('Error resetting session:', err);
      setError('An error occurred while resetting your session');
    } finally {
      setSessionLoading(false);
    }
  };

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
            onClick={handleResetSession}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reset Session
          </button>
        </div>
      </div>
    );
  };

  // Prevent tab changes to anything other than 'activities'
  const handleTabChange = (tab) => {
    // Only allow changing to 'activities' tab for now
    if (tab === 'activities') {
      setActiveTab(tab);
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
      </div>

      {selectedActivity && (
        <ActivityDetailModal 
          activity={selectedActivity} 
          onClose={() => setSelectedActivity(null)} 
        />
      )}
    </div>
  );
};

export default ActivitiesPage;
