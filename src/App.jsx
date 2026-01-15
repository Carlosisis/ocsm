import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Users, Target, TrendingUp, Award, Play, Pause, RotateCcw, Plus, X, Check, Moon, Sun, Flame, ChevronLeft, ChevronRight, BarChart3, LogIn, LogOut } from 'lucide-react';

const TASK_COLORS = [
  { name: 'Business Work', color: '#FF6B6B', light: '#FFE5E5' },
  { name: 'Learning', color: '#4ECDC4', light: '#E0F7F5' },
  { name: 'Social Media', color: '#95E1D3', light: '#E8F8F5' },
  { name: 'Entertainment', color: '#FFE66D', light: '#FFF9E0' },
  { name: 'Exercise', color: '#A8E6CF', light: '#E8F7F1' },
  { name: 'Sleep', color: '#B4A7D6', light: '#EBE7F3' },
  { name: 'Meals', color: '#FFB6B9', light: '#FFF0F1' },
  { name: 'Other', color: '#BDBDBD', light: '#F5F5F5' }
];

// Firebase configuration
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDDpQykFSDjZfswKilYNJ47bIoB0iWWI4s",
  authDomain: "ocsm-focus-tracker.firebaseapp.com",
  databaseURL: "https://ocsm-focus-tracker-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ocsm-focus-tracker",
  storageBucket: "ocsm-focus-tracker.firebasestorage.app",
  messagingSenderId: "824538131999",
  appId: "1:824538131999:web:cd16fd9a1032c0eec82f2a",
  measurementId: "G-ZLCYCFHT3D"
};

export default function FocusTracker() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState({});
  const [riceScoreData, setRiceScoreData] = useState({});
  const [userProfile, setUserProfile] = useState({
    name: 'Student',
    displayName: 'Student',
    isAnonymous: false,
    xp: 0,
    level: 1,
    streak: 0,
    uid: null
  });
  const [pomodoroState, setPomodoroState] = useState({
    isActive: false,
    timeLeft: 25 * 60,
    sessionType: 'work',
    currentTask: null,
    selectedDuration: 25
  });
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', category: 0, duration: 30, date: null });
  const [darkMode, setDarkMode] = useState(false);
  const [showRiceModal, setShowRiceModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [riceWeekData, setRiceWeekData] = useState({});
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const timerRef = useRef(null);
  const presenceRef = useRef(null);
  const lobbyListenerRef = useRef(null);

  // Initialize Firebase
  useEffect(() => {
    const initFirebase = async () => {
      try {
        // Check if Firebase is already initialized
        if (window.firebase && window.firebase.apps.length > 0) {
          setFirebaseReady(true);
          setupAuthListener();
          return;
        }

        // Load Firebase SDK from CDN
        const script1 = document.createElement('script');
        script1.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js';
        document.head.appendChild(script2);

        const script3 = document.createElement('script');
        script3.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js';
        document.head.appendChild(script3);

        // Wait for scripts to load
        await new Promise((resolve) => {
          script3.onload = resolve;
        });

        // Initialize Firebase
        if (!window.firebase.apps.length) {
          window.firebase.initializeApp(FIREBASE_CONFIG);
        }

        setFirebaseReady(true);
        setupAuthListener();
      } catch (error) {
        console.error('Firebase initialization error:', error);
        alert('Firebase setup required. Please check the setup instructions.');
      }
    };

    initFirebase();
  }, []);

  // Auth listener
  const setupAuthListener = () => {
    window.firebase.auth().onAuthStateChanged((user) => {
      setAuthUser(user);
      if (user) {
        setShowLoginModal(false);
        loadUserData(user.uid);
        setupPresence(user.uid);
        setupLobbyListener();
      } else {
        setShowLoginModal(true);
        cleanupPresence();
      }
    });
  };

  // Load user data from Firebase
  const loadUserData = async (uid) => {
    try {
      const db = window.firebase.database();
      const snapshot = await db.ref(`users/${uid}`).once('value');
      const data = snapshot.val();
      
      if (data) {
        setUserProfile(prev => ({ ...prev, ...data.profile, uid }));
        setTasks(data.tasks || {});
        setRiceScoreData(data.riceScore || {});
        setRiceWeekData(data.riceWeekData || {});
      } else {
        // First time user
        setUserProfile(prev => ({ ...prev, uid }));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Save user data to Firebase
  const saveUserData = async () => {
    if (!authUser) return;

    try {
      const db = window.firebase.database();
      await db.ref(`users/${authUser.uid}`).set({
        profile: {
          displayName: userProfile.displayName,
          isAnonymous: userProfile.isAnonymous,
          xp: userProfile.xp,
          level: userProfile.level,
          streak: userProfile.streak
        },
        tasks,
        riceScore: riceScoreData,
        riceWeekData,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // Auto-save when data changes
  useEffect(() => {
    if (authUser) {
      saveUserData();
    }
  }, [tasks, riceScoreData, riceWeekData, userProfile.xp, userProfile.level, userProfile.streak]);

  // Setup presence system for lobby
  const setupPresence = (uid) => {
    const db = window.firebase.database();
    const presenceRef = db.ref(`presence/${uid}`);
    const connectedRef = db.ref('.info/connected');

    connectedRef.on('value', (snapshot) => {
      if (snapshot.val() === true) {
        presenceRef.onDisconnect().remove();
        
        const updatePresence = () => {
          presenceRef.set({
            displayName: userProfile.isAnonymous ? 'Anonymous' : userProfile.displayName,
            status: pomodoroState.isActive && pomodoroState.currentTask 
              ? `Focusing: ${pomodoroState.currentTask}`
              : 'Available',
            isActive: pomodoroState.isActive,
            lastSeen: window.firebase.database.ServerValue.TIMESTAMP
          });
        };

        updatePresence();
        // Update presence every 30 seconds
        const interval = setInterval(updatePresence, 30000);
        presenceRef.current = interval;
      }
    });
  };

  // Update presence when pomodoro state changes
  useEffect(() => {
    if (authUser) {
      const db = window.firebase.database();
      db.ref(`presence/${authUser.uid}`).update({
        displayName: userProfile.isAnonymous ? 'Anonymous' : userProfile.displayName,
        status: pomodoroState.isActive && pomodoroState.currentTask 
          ? `Focusing: ${pomodoroState.currentTask}`
          : 'Available',
        isActive: pomodoroState.isActive
      });
    }
  }, [pomodoroState.isActive, pomodoroState.currentTask, userProfile.displayName, userProfile.isAnonymous, authUser]);

  // Listen to lobby updates
  const setupLobbyListener = () => {
    const db = window.firebase.database();
    const presenceRef = db.ref('presence');
    
    lobbyListenerRef.current = presenceRef.on('value', (snapshot) => {
      const presenceData = snapshot.val();
      if (presenceData) {
        const users = Object.entries(presenceData)
          .filter(([uid]) => uid !== authUser?.uid)
          .map(([uid, data]) => ({
            id: uid,
            name: data.displayName || 'Anonymous',
            status: data.status || 'Available',
            active: data.isActive || false
          }));
        setOnlineUsers(users);
      }
    });
  };

  // Cleanup presence
  const cleanupPresence = () => {
    if (presenceRef.current) {
      clearInterval(presenceRef.current);
    }
    if (lobbyListenerRef.current && authUser) {
      const db = window.firebase.database();
      db.ref('presence').off('value', lobbyListenerRef.current);
      db.ref(`presence/${authUser.uid}`).remove();
    }
  };

  useEffect(() => {
    return () => {
      cleanupPresence();
    };
  }, []);

  // Authentication functions
  const handleLogin = async () => {
    if (!firebaseReady) {
      alert('Firebase is still loading. Please wait a moment.');
      return;
    }

    try {
      const auth = window.firebase.auth();
      if (isSignUp) {
        await auth.createUserWithEmailAndPassword(loginEmail, loginPassword);
        alert('Account created successfully!');
      } else {
        await auth.signInWithEmailAndPassword(loginEmail, loginPassword);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      cleanupPresence();
      await window.firebase.auth().signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Pomodoro timer
  useEffect(() => {
    if (pomodoroState.isActive) {
      timerRef.current = setInterval(() => {
        setPomodoroState(prev => {
          if (prev.timeLeft <= 1) {
            const xpGained = 50;
            setUserProfile(profile => ({
              ...profile,
              xp: profile.xp + xpGained,
              level: Math.floor((profile.xp + xpGained) / 500) + 1
            }));
            
            return { ...prev, isActive: false };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pomodoroState.isActive]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDateKey = (date) => {
    return date.toISOString().split('T')[0];
  };

  const addTask = () => {
    const dateKey = getDateKey(newTask.date || selectedDate);
    const taskId = Date.now();
    
    setTasks(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), { ...newTask, id: taskId }]
    }));
    
    setShowTaskModal(false);
    setNewTask({ title: '', category: 0, duration: 30, date: null });
    setUserProfile(prev => ({ ...prev, xp: prev.xp + 10 }));
  };

  const deleteTask = (dateKey, taskId) => {
    setTasks(prev => ({
      ...prev,
      [dateKey]: prev[dateKey].filter(t => t.id !== taskId)
    }));
  };

  const startFocusWithTask = (task) => {
    setPomodoroState({
      isActive: false,
      timeLeft: task.duration * 60,
      sessionType: 'work',
      currentTask: task.title,
      selectedDuration: task.duration
    });
    setCurrentView('focus');
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    return { firstDay, daysInMonth };
  };

  const calculateRiceScore = () => {
    if (Object.keys(riceWeekData).length === 0) return null;
    
    const totals = {};
    TASK_COLORS.forEach((_, idx) => {
      totals[idx] = parseFloat(riceWeekData[idx] || 0) * 7;
    });
    
    const totalHours = Object.values(totals).reduce((a, b) => a + b, 0);
    const avgPerDay = totalHours / 7;
    
    return { totals, totalHours, avgPerDay };
  };

  // Login Modal
  if (showLoginModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4">
        <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-blue-900/50 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
              OF
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Organic Course Selling Mastery
            </h1>
            <p className="text-sm opacity-60 mt-2">Focus Tracker 2026</p>
          </div>

          {!firebaseReady ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="opacity-70">Loading Firebase...</p>
            </div>
          ) : FIREBASE_CONFIG.apiKey === "YOUR_API_KEY" ? (
            <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 text-center">
              <p className="text-red-400 font-semibold mb-2">⚠️ Firebase Not Configured</p>
              <p className="text-sm opacity-70">Please set up your Firebase project and update the configuration.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block mb-2 font-semibold text-sm text-gray-300">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 rounded-xl border-2 border-blue-900/30 bg-slate-800/50 focus:border-blue-500 outline-none text-white"
                  />
                </div>
                
                <div>
                  <label className="block mb-2 font-semibold text-sm text-gray-300">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border-2 border-blue-900/30 bg-slate-800/50 focus:border-blue-500 outline-none text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all mb-4"
              >
                {isSignUp ? 'Sign Up' : 'Log In'}
              </button>

              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const DashboardView = () => {
    const riceScore = calculateRiceScore();
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
            <div className="flex items-center justify-between mb-2">
              <Award className="text-amber-500" size={24} />
              <span className="text-2xl font-bold">{userProfile.level}</span>
            </div>
            <div className="text-sm opacity-70">Level</div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${(userProfile.xp % 500) / 5}%` }}
              />
            </div>
            <div className="text-xs mt-1 opacity-60">{userProfile.xp % 500}/500 XP</div>
          </div>
          
          <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
            <div className="flex items-center justify-between mb-2">
              <Flame className="text-orange-500" size={24} />
              <span className="text-2xl font-bold">{userProfile.streak}</span>
            </div>
            <div className="text-sm opacity-70">Day Streak</div>
          </div>
          
          <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
            <div className="flex items-center justify-between mb-2">
              <Target className="text-blue-500" size={24} />
              <span className="text-2xl font-bold">{Object.keys(tasks).length}</span>
            </div>
            <div className="text-sm opacity-70">Days Planned</div>
          </div>
          
          <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="text-green-500" size={24} />
              <span className="text-2xl font-bold">
                {riceScore ? Math.round(riceScore.avgPerDay) : 0}h
              </span>
            </div>
            <div className="text-sm opacity-70">Avg Daily Activity</div>
          </div>
        </div>

        <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
          <h2 className="text-xl font-bold mb-4">2026 Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }, (_, i) => {
              const monthDate = new Date(2026, i, 1);
              const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
              const { firstDay, daysInMonth } = getDaysInMonth(monthDate);
              
              return (
                <div key={i} className="bg-slate-900/50 dark:bg-slate-950/50 p-3 rounded-xl border border-blue-900/20">
                  <div className="font-bold text-center mb-2">{monthName}</div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="aspect-square" />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, day) => {
                      const date = new Date(2026, i, day + 1);
                      const dateKey = getDateKey(date);
                      const dayTasks = tasks[dateKey] || [];
                      const hasTask = dayTasks.length > 0;
                      
                      return (
                        <div
                          key={day}
                          className="aspect-square flex items-center justify-center text-xs rounded cursor-pointer hover:scale-110 transition-transform"
                          style={{
                            backgroundColor: hasTask ? TASK_COLORS[dayTasks[0]?.category]?.light : undefined,
                            fontWeight: hasTask ? 'bold' : 'normal'
                          }}
                          onClick={() => {
                            setSelectedDate(date);
                            setCurrentView('calendar');
                          }}
                        >
                          {day + 1}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
          <h3 className="font-bold mb-3">Task Categories</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TASK_COLORS.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-sm">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const CalendarView = () => {
    const { firstDay, daysInMonth } = getDaysInMonth(selectedDate);
    const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold">{monthName}</h2>
          <button 
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>
        
        <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-4 md:p-6 shadow-lg border border-blue-900/30">
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-sm py-2 opacity-70">{day}</div>
            ))}
            
            {Array.from({ length: firstDay }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}
            
            {Array.from({ length: daysInMonth }, (_, day) => {
              const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day + 1);
              const dateKey = getDateKey(date);
              const dayTasks = tasks[dateKey] || [];
              const isToday = dateKey === getDateKey(new Date());
              
              return (
                <div
                  key={day}
                  className={`bg-slate-900/60 dark:bg-slate-950/60 border border-blue-900/20 rounded-xl p-2 md:p-3 min-h-24 md:min-h-32 relative hover:-translate-y-1 transition-transform ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="font-semibold mb-1 text-sm md:text-base">{day + 1}</div>
                  <div className="space-y-1">
                    {dayTasks.map(task => (
                      <div
                        key={task.id}
                        className="text-xs rounded group"
                        style={{ backgroundColor: TASK_COLORS[task.category]?.color }}
                      >
                        <div className="px-2 py-1 flex items-center justify-between gap-1">
                          <span className="truncate flex-1 text-white">{task.title}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startFocusWithTask(task)}
                              className="bg-white/30 rounded p-0.5 hover:bg-white/50"
                              title="Start Focus Session"
                            >
                              <Clock size={12} className="text-white" />
                            </button>
                            <button
                              onClick={() => deleteTask(dateKey, task.id)}
                              className="bg-white/30 rounded p-0.5 hover:bg-white/50"
                            >
                              <X size={12} className="text-white" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setNewTask({ ...newTask, date });
                      setShowTaskModal(true);
                    }}
                    className="absolute bottom-2 right-2 w-6 h-6 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 flex items-center justify-center transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const RiceScoreView = () => {
    const riceScore = calculateRiceScore();
    
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
          <h2 className="text-xl font-bold mb-4">Rice Score Time Tracker</h2>
          <p className="mb-4 opacity-70">
            Track your time for 7 days to understand where your hours go. This helps you identify time to redirect toward your business goals.
          </p>
          
          <button 
            onClick={() => setShowRiceModal(true)} 
            className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all"
          >
            {Object.keys(riceWeekData).length === 0 ? 'Start Tracking' : 'Update Week Data'}
          </button>
        </div>
        
        {riceScore && (
          <>
            <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
              <h3 className="font-bold mb-4">Weekly Summary</h3>
              <div className="space-y-3">
                {TASK_COLORS.map((cat, idx) => {
                  const hours = riceScore.totals[idx] || 0;
                  const percentage = riceScore.totalHours > 0 ? (hours / riceScore.totalHours) * 100 : 0;
                  
                  return (
                    <div key={idx}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">{cat.name}</span>
                        <span className="text-sm font-bold">{hours.toFixed(1)}h ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: cat.color
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
              <h3 className="font-bold mb-4">Insights</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 bg-green-900/20 dark:bg-green-900/20 rounded-xl border border-green-700/30">
                  <TrendingUp className="text-green-500 flex-shrink-0" size={24} />
                  <div>
                    <div className="font-semibold">Average Daily Activity</div>
                    <div className="text-sm opacity-70">{riceScore.avgPerDay.toFixed(1)} hours per day</div>
                  </div>
                </div>
                
                {riceScore.totals[0] > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-blue-900/20 dark:bg-blue-900/20 rounded-xl border border-blue-700/30">
                    <Target className="text-blue-500 flex-shrink-0" size={24} />
                    <div>
                      <div className="font-semibold">Business Focus Time</div>
                      <div className="text-sm opacity-70">
                        {riceScore.totals[0].toFixed(1)}h/week = {(riceScore.totals[0] / 7).toFixed(1)}h/day
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const FocusModeView = () => {
    const maxTime = pomodoroState.selectedDuration * 60;
    const percentage = ((maxTime - pomodoroState.timeLeft) / maxTime) * 100;
    
    const durations = [10, 25, 45, 60];
    
    const setDuration = (minutes) => {
      setPomodoroState(prev => ({
        ...prev,
        selectedDuration: minutes,
        timeLeft: minutes * 60,
        isActive: false
      }));
    };
    
    return (
      <div className="flex flex-col items-center justify-center min-h-96 space-y-8">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Focus Session
          </h2>
          {pomodoroState.currentTask && (
            <div className="mt-3 px-6 py-2 bg-blue-900/30 rounded-xl border border-blue-700/30 inline-block">
              <p className="text-lg opacity-90">{pomodoroState.currentTask}</p>
            </div>
          )}
        </div>
        
        {!pomodoroState.isActive && (
          <div className="flex gap-2 flex-wrap justify-center">
            {durations.map(duration => (
              <button
                key={duration}
                onClick={() => setDuration(duration)}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  pomodoroState.selectedDuration === duration
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg'
                    : 'bg-slate-800/50 hover:bg-slate-700/50 border border-blue-900/30'
                }`}
              >
                {duration} min
              </button>
            ))}
          </div>
        )}
        
        <div className="relative">
          <svg width="250" height="250" viewBox="0 0 300 300" className="md:w-[300px] md:h-[300px]">
            <circle
              cx="150"
              cy="150"
              r="140"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              opacity="0.1"
            />
            <circle
              cx="150"
              cy="150"
              r="140"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 140}`}
              strokeDashoffset={`${2 * Math.PI * 140 * (1 - percentage / 100)}`}
              transform="rotate(-90 150 150)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-4xl md:text-6xl font-bold">
              {formatTime(pomodoroState.timeLeft)}
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => setPomodoroState(prev => ({ ...prev, isActive: !prev.isActive }))}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-semibold flex items-center gap-2 md:gap-3 hover:shadow-lg hover:shadow-blue-500/30 transition-all"
          >
            {pomodoroState.isActive ? <Pause size={20} /> : <Play size={20} />}
            <span>{pomodoroState.isActive ? 'Pause' : 'Start'}</span>
          </button>
          
          <button
            onClick={() => setPomodoroState(prev => ({
              ...prev,
              isActive: false,
              timeLeft: prev.selectedDuration * 60
            }))}
            className="bg-blue-500/20 hover:bg-blue-500/40 px-6 md:px-8 py-3 md:py-4 rounded-xl font-semibold flex items-center justify-center transition-all"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
    );
  };

  const VirtualLobbyView = () => {
    const currentUserStatus = pomodoroState.isActive && pomodoroState.currentTask 
      ? `Focusing: ${pomodoroState.currentTask}`
      : 'Available';
    
    const displayName = userProfile.isAnonymous ? 'Anonymous' : userProfile.displayName;
    
    return (
      <div className="space-y-4">
        <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-900/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Virtual Lobby</h2>
            <button
              onClick={() => setShowProfileModal(true)}
              className="px-3 py-1.5 bg-blue-900/30 hover:bg-blue-800/50 rounded-lg text-sm font-medium transition-all"
            >
              Edit Profile
            </button>
          </div>
          <p className="mb-4 opacity-70">See who else is working on their goals right now</p>
          
          {/* Current User */}
          <div className="mb-4 pb-4 border-b border-blue-900/30">
            <div className="flex items-center gap-3 p-4 bg-blue-900/30 rounded-xl border border-blue-700/50">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${pomodoroState.isActive ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  {displayName} 
                  <span className="text-xs px-2 py-0.5 bg-blue-600 rounded-full">You</span>
                </div>
                <div className="text-sm opacity-70 truncate">{currentUserStatus}</div>
              </div>
              {pomodoroState.isActive && (
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            {onlineUsers.map(user => (
              <div key={user.id} className="flex items-center gap-3 p-4 bg-blue-900/20 dark:bg-blue-900/20 rounded-xl hover:bg-blue-800/30 dark:hover:bg-blue-800/30 transition-all border border-blue-800/30">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${user.active ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-sm opacity-70 truncate">{user.status}</div>
                </div>
                {user.active && (
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-slate-800/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg text-center border border-blue-900/30">
          <Users className="mx-auto mb-2 text-blue-500" size={32} />
          <div className="text-2xl font-bold mb-1">
            {onlineUsers.filter(u => u.active).length + (pomodoroState.isActive ? 1 : 0)}
          </div>
          <div className="text-sm opacity-70">Students working now</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white' : 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-gray-100'} p-4 md:p-8 transition-all`}>
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-3xl p-4 md:p-6 mb-6 shadow-2xl border border-blue-900/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                OF
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Organic Course Selling Mastery
                </h1>
                <p className="text-xs md:text-sm opacity-60">Focus Tracker 2026</p>
              </div>
            </div>
            
            <nav className="flex flex-wrap gap-2 justify-center">
              {[
                { id: 'dashboard', icon: Calendar, label: 'Dashboard' },
                { id: 'calendar', icon: Calendar, label: 'Calendar' },
                { id: 'rice', icon: BarChart3, label: 'Rice' },
                { id: 'focus', icon: Clock, label: 'Focus' },
                { id: 'lobby', icon: Users, label: 'Lobby' }
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setCurrentView(id)}
                  className={`px-3 md:px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
                    currentView === id
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                      : 'hover:bg-blue-900/30 dark:hover:bg-slate-800 text-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="w-10 h-10 rounded-xl bg-blue-900/30 hover:bg-blue-800/50 flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={handleLogout}
                className="w-10 h-10 rounded-xl bg-red-900/30 hover:bg-red-800/50 flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
        
        <div>
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'calendar' && <CalendarView />}
          {currentView === 'rice' && <RiceScoreView />}
          {currentView === 'focus' && <FocusModeView />}
          {currentView === 'lobby' && <VirtualLobbyView />}
        </div>
      </div>
      
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTaskModal(false)}>
          <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-3xl p-6 md:p-8 max-w-md w-full border border-blue-900/50" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold">Add Task</h3>
              <button onClick={() => setShowTaskModal(false)} className="w-8 h-8 rounded-lg hover:bg-blue-900/30 dark:hover:bg-slate-800 flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold text-sm">Task Title</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Enter task name..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-blue-900/30 dark:border-blue-800/30 bg-slate-800/50 dark:bg-slate-950/50 focus:border-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block mb-2 font-semibold text-sm">Category</label>
                <select
                  value={newTask.category}
                  onChange={(e) => setNewTask({ ...newTask, category: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-blue-900/30 dark:border-blue-800/30 bg-slate-800/50 dark:bg-slate-950/50 focus:border-blue-500 outline-none"
                >
                  {TASK_COLORS.map((cat, idx) => (
                    <option key={idx} value={idx}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block mb-2 font-semibold text-sm">Duration (minutes)</label>
                <input
                  type="number"
                  value={newTask.duration}
                  onChange={(e) => setNewTask({ ...newTask, duration: parseInt(e.target.value) || 0 })}
                  min="5"
                  step="5"
                  className="w-full px-4 py-3 rounded-xl border-2 border-blue-900/30 dark:border-blue-800/30 bg-slate-800/50 dark:bg-slate-950/50 focus:border-blue-500 outline-none"
                />
              </div>
              
              <button 
                onClick={addTask}
                disabled={!newTask.title}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={18} />
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showRiceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowRiceModal(false)}>
          <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-3xl p-6 md:p-8 max-w-md w-full max-h-[80vh] overflow-y-auto border border-blue-900/50" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold">Track Your Week</h3>
              <button onClick={() => setShowRiceModal(false)} className="w-8 h-8 rounded-lg hover:bg-blue-900/30 dark:hover:bg-slate-800 flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            
            <p className="mb-6 opacity-70">Enter average hours per day for each activity:</p>
            
            <div className="space-y-4">
              {TASK_COLORS.map((cat, idx) => (
                <div key={idx}>
                  <label className="block mb-2 font-semibold text-sm">{cat.name}</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    placeholder="Hours per day"
                    value={riceWeekData[idx] || ''}
                    onChange={(e) => setRiceWeekData({ ...riceWeekData, [idx]: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-blue-900/30 dark:border-blue-800/30 bg-slate-800/50 dark:bg-slate-950/50 focus:border-blue-500 outline-none"
                  />
                </div>
              ))}
              
              <button 
                onClick={() => {
                  setRiceScoreData(riceWeekData);
                  setShowRiceModal(false);
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/30 transition-all mt-6"
              >
                <Check size={18} />
                Save Week Data
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowProfileModal(false)}>
          <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-3xl p-6 md:p-8 max-w-md w-full border border-blue-900/50" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold">Edit Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="w-8 h-8 rounded-lg hover:bg-blue-900/30 dark:hover:bg-slate-800 flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold text-sm">Display Name</label>
                <input
                  type="text"
                  value={userProfile.displayName}
                  onChange={(e) => setUserProfile({ ...userProfile, displayName: e.target.value })}
                  placeholder="Enter your name..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-blue-900/30 dark:border-blue-800/30 bg-slate-800/50 dark:bg-slate-950/50 focus:border-blue-500 outline-none"
                />
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-blue-900/20 rounded-xl border border-blue-800/30">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={userProfile.isAnonymous}
                  onChange={(e) => setUserProfile({ ...userProfile, isAnonymous: e.target.checked })}
                  className="w-5 h-5 rounded accent-blue-500"
                />
                <label htmlFor="anonymous" className="flex-1 cursor-pointer">
                  <div className="font-semibold">Show as Anonymous</div>
                  <div className="text-sm opacity-70">Hide your name in the lobby</div>
                </label>
              </div>
              
              <button 
                onClick={() => setShowProfileModal(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/30 transition-all"
              >
                <Check size={18} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}