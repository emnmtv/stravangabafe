import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

function Navigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check authentication status whenever location changes
    const token = localStorage.getItem('token');
    const userString = localStorage.getItem('user');
    
    setIsLoggedIn(!!token);
    setUser(userString ? JSON.parse(userString) : null);
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUser(null);
    navigate('/');
  };

  const isAdmin = user && user.role === 'ADMIN';

  // Navigation items configuration for reuse
  const navItems = [
    { name: 'Home', path: '/home', icon: 'home', authRequired: true },
    { name: 'My Routes', path: '/routes', icon: 'route', authRequired: true },
    { name: 'Activities', path: '/activities', icon: 'activity', authRequired: true },
    ...(isAdmin ? [{ name: 'Admin', path: '/admin', icon: 'admin', authRequired: true }] : []),
    { name: 'Profile', path: '/profile', icon: 'user', authRequired: true }
  ];

  // Public navigation items
  const publicItems = [
    { name: 'Home', path: '/', icon: 'home' },
    { name: 'Login', path: '/login', icon: 'login' },
    { name: 'Register', path: '/register', icon: 'register' }
  ];

  return (
    <>
      {/* Desktop Navigation - Fixed top */}
      <nav className="bg-green-600 shadow-lg fixed top-0 left-0 right-0 z-50 hidden md:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
              <Link to={isLoggedIn ? '/home' : '/'} className="flex-shrink-0 flex items-center">
              <span className="text-white font-bold text-xl">RunTracker</span>
            </Link>
          </div>
          
            <div className="ml-6 flex items-center space-x-4">
              {navItems
                .filter(item => !item.authRequired || isLoggedIn)
                .map(item => (
            <Link 
                    key={item.path}
                    to={item.path} 
              className={`px-3 py-2 rounded-md text-sm font-medium text-white ${
                      location.pathname === item.path ? 'bg-green-700' : 'hover:bg-green-500'
              }`}
            >
                    {item.name}
            </Link>
                ))
              }
            
            {!isLoggedIn ? (
              <>
                <Link 
                  to="/login" 
                  className={`px-3 py-2 rounded-md text-sm font-medium text-white ${
                    location.pathname === '/login' ? 'bg-green-700' : 'hover:bg-green-500'
                  }`}
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className={`px-3 py-2 rounded-md text-sm font-medium text-white ${
                    location.pathname === '/register' ? 'bg-green-700' : 'hover:bg-green-500'
                  }`}
                >
                  Register
                </Link>
              </>
            ) : (
                <button 
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-md text-sm font-medium text-white hover:bg-green-500"
                >
                  Logout
                </button>
            )}
          </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - No top navigation at all on mobile */}
      {isLoggedIn ? (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-lg z-[1001] bottom-nav">
          <div className="flex justify-around items-center h-16">
            {navItems
              .filter(item => !item.authRequired || isLoggedIn)
              .map(item => (
                <Link
                  key={item.path}
                  to={item.path} 
                  className={`flex flex-col items-center justify-center w-full h-full ${
                    location.pathname === item.path ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {item.icon === 'home' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  )}
                  {item.icon === 'route' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  )}
                  {item.icon === 'activity' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  {item.icon === 'admin' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  {item.icon === 'user' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                  <span className="text-xs mt-1">{item.name}</span>
                </Link>
              ))
            }
          </div>
        </nav>
      ) : (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-lg z-[1001] bottom-nav">
          <div className="flex justify-around items-center h-16">
            {publicItems.map(item => (
                <Link
                key={item.path}
                to={item.path} 
                className={`flex flex-col items-center justify-center w-1/3 h-full ${
                  location.pathname === item.path ? 'text-green-600' : 'text-gray-500'
                  }`}
              >
                {item.icon === 'home' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                )}
                {item.icon === 'login' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                )}
                {item.icon === 'register' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                )}
                <span className="text-xs mt-1">{item.name}</span>
                </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}

export default Navigation;
