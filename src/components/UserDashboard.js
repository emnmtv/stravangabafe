import React, { useState, useEffect } from 'react';
import { getUserStats, getWeightHistory, getUserProfile, recalculateDistance } from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const UserDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [user, setUser] = useState(null);
  // Single chart toggle
  const [chartsVisible, setChartsVisible] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateSuccess, setRecalculateSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('You must be logged in to view your dashboard');
          setLoading(false);
          return;
        }

        // Fetch user profile
        const profileResponse = await getUserProfile(token);
        if (profileResponse.success) {
          setUser(profileResponse.data);
          console.log("User profile:", profileResponse.data);
        }

        // Fetch user statistics
        const statsResponse = await getUserStats(token);
        if (statsResponse.success) {
          setUserStats(statsResponse.data);
          console.log("User stats:", statsResponse.data);
          
          // Process activity data for charts if available
          if (statsResponse.data.recentActivities && statsResponse.data.recentActivities.length > 0) {
            const activities = statsResponse.data.recentActivities
              .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
            
            // Prepare activity data for charts
            const chartData = activities.map(activity => ({
              date: new Date(activity.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
              distance: (activity.distance / 1000).toFixed(2), // Convert to km
              duration: Math.floor(activity.duration / 60), // Convert to minutes
              steps: activity.steps,
              calories: activity.calories,
              type: activity.type
            }));
            
            setActivityData(chartData);
          }
        }

        // Fetch weight history
        const weightResponse = await getWeightHistory(token, { limit: 10 });
        if (weightResponse.success) {
          // Convert to chart data format and sort by date (oldest first)
          const weightData = weightResponse.data
            .map(entry => ({
              date: new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
              fullDate: new Date(entry.date),
              weight: entry.weight,
              note: entry.note
            }))
            .sort((a, b) => a.fullDate - b.fullDate);
          
          setWeightHistory(weightData);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Toggle all charts visibility
  const toggleCharts = () => {
    setChartsVisible(prev => !prev);
  };

  // Handle recalculation of total distance
  const handleRecalculateDistance = async () => {
    try {
      setRecalculating(true);
      setRecalculateSuccess(false);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to recalculate distance');
        setRecalculating(false);
        return;
      }
      
      const response = await recalculateDistance(token);
      
      if (response.success) {
        console.log('Distance recalculated successfully:', response.data);
        setRecalculateSuccess(true);
        
        // Refresh data after recalculation
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError('Failed to recalculate distance: ' + response.message);
      }
    } catch (err) {
      console.error('Error during distance recalculation:', err);
      setError('An error occurred during distance recalculation');
    } finally {
      setRecalculating(false);
    }
  };

  // Get distance unit based on user preferences
  const getDistanceUnit = () => {
    return user?.activityPreferences?.distanceUnit || 'km';
  };

  // Function to get total distance from most accurate source
  const getTotalDistance = () => {
    // First check if aggregated stats have totalDistance and do proper unit conversion
    if (userStats?.totalDistance) {
      // If distance is already in km (small value), display as is
      if (userStats.totalDistance < 100) {
        return userStats.totalDistance.toFixed(2);
      }
      // Otherwise properly convert from meters to km
      return (userStats.totalDistance / 1000).toFixed(2);
    }
    // Then fall back to user profile totalDistance with proper unit conversion
    else if (user?.totalDistance) {
      // If distance is already in km (small value), display as is
      if (user.totalDistance < 100) {
        return user.totalDistance.toFixed(2);
      }
      // Otherwise properly convert from meters to km
      return (user.totalDistance / 1000).toFixed(2);
    }
    // Return 0 if no data is available
    return '0';
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Format large numbers
  const formatNumber = (num) => {
    return num ? num.toLocaleString() : '0';
  };

  // Chart configuration and data
  const getChartOptions = (title, yAxisLabel = '', displayLegend = false) => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: displayLegend,
          position: 'top',
          labels: {
            font: {
              size: window.innerWidth < 640 ? 8 : 10
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#333',
          bodyColor: '#666',
          borderColor: '#ddd',
          borderWidth: 1,
          padding: window.innerWidth < 640 ? 6 : 10,
          boxPadding: window.innerWidth < 640 ? 2 : 3,
          usePointStyle: true,
          titleFont: {
            size: window.innerWidth < 640 ? 10 : 12,
            weight: 'bold'
          },
          bodyFont: {
            size: window.innerWidth < 640 ? 9 : 11
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: !!yAxisLabel,
            text: yAxisLabel,
            font: {
              size: window.innerWidth < 640 ? 8 : 10
            }
          },
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 7 : 9
            },
            maxTicksLimit: window.innerWidth < 640 ? 5 : 8
          }
        },
        x: {
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 7 : 9
            },
            maxTicksLimit: window.innerWidth < 640 ? 5 : 8
          }
        }
      }
    };
  };

  // Chart datasets
  const getDistanceChartData = () => {
    if (!activityData.length) return { labels: [], datasets: [] };
    
    return {
      labels: activityData.map(d => d.date),
      datasets: [{
        label: 'Distance (km)',
        data: activityData.map(d => d.distance),
        fill: true,
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderColor: 'rgb(34, 197, 94)',
        tension: 0.3
      }]
    };
  };

  const getActivityDurationChartData = () => {
    if (!activityData.length) return { labels: [], datasets: [] };
    
    return {
      labels: activityData.map(d => d.date),
      datasets: [{
        label: 'Duration (min)',
        data: activityData.map(d => d.duration),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 4
      }]
    };
  };

  const getStepsChartData = () => {
    if (!activityData.length) return { labels: [], datasets: [] };
    
    return {
      labels: activityData.map(d => d.date),
      datasets: [{
        label: 'Steps',
        data: activityData.map(d => d.steps),
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderRadius: 4
      }]
    };
  };

  const getCaloriesChartData = () => {
    if (!activityData.length) return { labels: [], datasets: [] };
    
    return {
      labels: activityData.map(d => d.date),
      datasets: [{
        label: 'Calories',
        data: activityData.map(d => d.calories),
        fill: true,
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        borderColor: 'rgb(249, 115, 22)',
        tension: 0.3
      }]
    };
  };

  const getWeightChartData = () => {
    if (!weightHistory.length) return { labels: [], datasets: [] };
    
    return {
      labels: weightHistory.map(d => d.date),
      datasets: [{
        label: 'Weight (kg)',
        data: weightHistory.map(d => d.weight),
        fill: false,
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        tension: 0.2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };
  };

  const getActivityTrendsChartData = () => {
    if (!activityData.length) return { labels: [], datasets: [] };
    
    return {
      labels: activityData.map(d => d.date),
      datasets: [
        {
          label: 'Distance (km)',
          data: activityData.map(d => d.distance),
          fill: false,
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgb(34, 197, 94)',
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: 'Calories',
          data: activityData.map(d => d.calories),
          fill: false,
          backgroundColor: 'rgba(249, 115, 22, 0.5)',
          borderColor: 'rgb(249, 115, 22)',
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    };
  };

  const getActivityTrendsOptions = () => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 10
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#333',
          bodyColor: '#666',
          borderColor: '#ddd',
          borderWidth: 1,
          padding: 8
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Distance (km)',
            font: {
              size: 10
            }
          },
          ticks: {
            font: {
              size: 9
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: {
            drawOnChartArea: false,
          },
          title: {
            display: true,
            text: 'Calories',
            font: {
              size: 10
            }
          },
          ticks: {
            font: {
              size: 9
            }
          }
        },
        x: {
          ticks: {
            font: {
              size: 9
            }
          }
        }
      }
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600 mr-2"></div>
        <p className="text-green-600">Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-center">
          <p className="text-xl mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-0">Dashboard</h1>
          <div className="flex flex-wrap gap-2 sm:space-x-3">
            <button
              onClick={toggleCharts}
              className={`px-3 py-1 sm:px-4 sm:py-2 ${chartsVisible ? 'bg-blue-600' : 'bg-gray-500'} text-white text-xs sm:text-sm rounded-md hover:opacity-90 transition-colors`}
            >
              {chartsVisible ? 'Hide Charts' : 'Show Charts'}
            </button>
            <button
              onClick={() => navigate('/routes')}
              className="px-3 py-1 sm:px-4 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-md hover:bg-green-700"
            >
              Start Activity
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="px-3 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-md hover:bg-blue-700"
            >
              View Profile
            </button>
          </div>
        </div>

        {/* Success Message */}
        {recalculateSuccess && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-center">
            Distance recalculated successfully! Refreshing page...
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <div className="flex justify-between items-center">
              <p className="text-gray-500 text-xs sm:text-sm mb-1 sm:mb-2">Total Distance</p>
              <button
                onClick={handleRecalculateDistance}
                disabled={recalculating}
                className="text-xs px-1 py-0.5 sm:px-2 sm:py-1 rounded bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-gray-300"
              >
                {recalculating ? 'Updating...' : 'Recalculate'}
              </button>
            </div>
            <p className="text-xl sm:text-3xl font-bold text-gray-800">
              {getTotalDistance()} {getDistanceUnit()}
            </p>
            <p className="text-green-600 text-xs mt-1 mb-1 sm:mb-2">Lifetime distance covered</p>
            {chartsVisible && activityData.length > 0 && (
              <div className="h-20 sm:h-28 mt-2 sm:mt-4">
                <Line 
                  data={getDistanceChartData()} 
                  options={getChartOptions('Distance Trend', 'km')}
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <p className="text-gray-500 text-xs sm:text-sm mb-1 sm:mb-2">Activities</p>
            <p className="text-xl sm:text-3xl font-bold text-gray-800">{userStats?.totalActivities || 0}</p>
            <p className="text-green-600 text-xs mt-1 mb-1 sm:mb-2">Total recorded activities</p>
            {chartsVisible && activityData.length > 0 && (
              <div className="h-20 sm:h-28 mt-2 sm:mt-4">
                <Bar 
                  data={getActivityDurationChartData()} 
                  options={getChartOptions('Activity Duration', 'minutes')}
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <p className="text-gray-500 text-xs sm:text-sm mb-1 sm:mb-2">Total Steps</p>
            <p className="text-xl sm:text-3xl font-bold text-gray-800">{formatNumber(userStats?.totalSteps)}</p>
            <p className="text-green-600 text-xs mt-1 mb-1 sm:mb-2">Steps tracked across all activities</p>
            {chartsVisible && activityData.length > 0 && (
              <div className="h-20 sm:h-28 mt-2 sm:mt-4">
                <Bar 
                  data={getStepsChartData()} 
                  options={getChartOptions('Steps per Activity')}
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <p className="text-gray-500 text-xs sm:text-sm mb-1 sm:mb-2">Calories Burned</p>
            <p className="text-xl sm:text-3xl font-bold text-gray-800">{formatNumber(userStats?.totalCalories)}</p>
            <p className="text-green-600 text-xs mt-1 mb-1 sm:mb-2">Total calories expended</p>
            {chartsVisible && activityData.length > 0 && (
              <div className="h-20 sm:h-28 mt-2 sm:mt-4">
                <Line 
                  data={getCaloriesChartData()} 
                  options={getChartOptions('Calories Trend', 'kcal')}
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {/* Weight Tracking with Chart */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 sm:col-span-1">
            <h2 className="font-bold text-base sm:text-lg text-gray-800 mb-3 sm:mb-4">Weight Tracking</h2>
            
            {weightHistory.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-3 sm:p-6 text-center">
                <p className="text-gray-600 text-sm mb-3">No weight entries found</p>
                <button
                  onClick={() => navigate('/profile')}
                  className="px-3 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs sm:text-sm"
                >
                  Add Weight Entry
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-3 sm:mb-4">
                  <p className="text-gray-500 text-xs sm:text-sm">Current Weight</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-800">{user?.weight || '--'} kg</p>
                </div>
                
                {/* Weight history chart */}
                {chartsVisible && (
                  <div className="h-32 sm:h-40 mb-3 sm:mb-4">
                    <Line 
                      data={getWeightChartData()}
                      options={getChartOptions('Weight History', 'kg')}
                    />
                  </div>
                )}
              
                <h3 className="font-medium text-gray-700 text-xs sm:text-sm mb-2">Recent Entries</h3>
                <div className="space-y-1 sm:space-y-2 mb-3 sm:mb-4">
                  {weightHistory.slice(-3).reverse().map((entry, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 p-1.5 sm:p-2 rounded">
                      <div>
                        <p className="text-xs sm:text-sm font-medium">{entry.weight} kg</p>
                        <p className="text-xs text-gray-500">{entry.date}</p>
                      </div>
                      {entry.note && (
                        <p className="text-xs text-gray-500 italic truncate max-w-[80px] sm:max-w-[100px]">{entry.note}</p>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="text-center mt-2 sm:mt-4">
                  <button
                    onClick={() => navigate('/profile')}
                    className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm"
                  >
                    View All Weight History
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Recent Activities with Chart */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 sm:col-span-1 lg:col-span-2">
            <h2 className="font-bold text-base sm:text-lg text-gray-800 mb-3 sm:mb-4">Recent Activities</h2>
            
            {!userStats?.recentActivities || userStats.recentActivities.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-3 sm:p-6 text-center">
                <p className="text-gray-600 text-sm mb-3">No activities recorded yet</p>
                <button
                  onClick={() => navigate('/routes')}
                  className="px-3 py-1 sm:px-4 sm:py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs sm:text-sm"
                >
                  Start Your First Activity
                </button>
              </div>
            ) : (
              <>
                {/* Activity trends chart */}
                {chartsVisible && activityData.length > 1 && (
                  <div className="h-48 sm:h-64 mb-4 sm:mb-6">
                    <Line
                      data={getActivityTrendsChartData()} 
                      options={getActivityTrendsOptions()}
                    />
                  </div>
                )}
              
                <div className="space-y-2 sm:space-y-3">
                  {userStats.recentActivities.slice().reverse().slice(0, 3).map((activity, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-2 sm:p-3 flex justify-between items-center hover:bg-gray-100 transition-colors duration-200">
                      <div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="text-xs sm:text-sm font-medium capitalize">{activity.type}</span>
                          <span className="text-xs text-gray-500">
                            {formatDate(activity.startTime)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 mt-1">
                          <span className="text-xs text-gray-600">
                            {activity.distance < 100 
                              ? activity.distance.toFixed(2) // Already in km
                              : (activity.distance / 1000).toFixed(2) // Convert from meters
                            } km
                          </span>
                          <span className="text-xs text-gray-600">
                            {Math.floor(activity.duration / 60)} min
                          </span>
                          {activity.steps > 0 && (
                            <span className="text-xs text-gray-600 hidden sm:inline">
                              {formatNumber(activity.steps)} steps
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs sm:text-sm font-medium">{activity.calories} kcal</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-center mt-2 sm:mt-4">
                    <button
                      onClick={() => navigate('/activities')}
                      className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm"
                    >
                      View All Activities
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-8">
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs sm:text-sm mb-1">Average Pace</p>
                <p className="text-base sm:text-xl font-bold text-gray-800">{userStats?.averagePaceFormatted || '--'}</p>
              </div>
              <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs sm:text-sm mb-1">Total Duration</p>
                <p className="text-base sm:text-xl font-bold text-gray-800">{userStats?.durationFormatted || '--'}</p>
              </div>
              <div className="bg-green-100 p-2 sm:p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 col-span-2 md:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs sm:text-sm mb-1">Elevation Gain</p>
                <p className="text-base sm:text-xl font-bold text-gray-800">{formatNumber(userStats?.totalElevationGain)} m</p>
              </div>
              <div className="bg-purple-100 p-2 sm:p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
