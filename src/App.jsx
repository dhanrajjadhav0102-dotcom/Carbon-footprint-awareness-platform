import React, { useState, useEffect, useRef, useMemo } from 'react';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, deleteDoc } from 'firebase/firestore';
import { auth, db, config } from './firebase';
import { Icons } from './components/Icons';
import { EMISSION_FACTORS, DEFAULT_CALC_DATA, CHANNELS, PRESET_ARTICLES } from './constants/data';


export default function App() {
  // --- STATE & ROUTING ---
  const [currentTab, setCurrentTab] = useState('landing');
  const [toastMessage, setToastMessage] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Custom Settings & Configuration State
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || "");
  const [cloudSync, setCloudSync] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: "Eco Explorer" });
  // --- NEW AUTHENTICATION & SESSION PERSISTENCE STATES ---
  const [authSession, setAuthSession] = useState(() => {
    const savedSession = localStorage.getItem("ecosphere_user_session");
    return savedSession ? JSON.parse(savedSession) : null;
  });
  
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [isRegistering, setIsRegistering] = useState(true); // Toggle between SignUp and Login views
  const [authError, setAuthError] = useState("");

  // --- PERSIST ACTIVITIES ACCROSS RELOADS ---
  // We modify the initial state of activities to check localStorage first
 // --- USER-SPECIFIC PERSISTENT ACTIVITY LOG ---
  const [activities, setActivities] = useState(() => {
    // 1. Check if there is an active logged-in session first
    const savedSession = localStorage.getItem("ecosphere_user_session");
    const activeUser = savedSession ? JSON.parse(savedSession) : null;

    if (activeUser && activeUser.email) {
      // 2. Load data tied strictly to this unique email
      const userSpecificActs = localStorage.getItem(`ecosphere_activities_${activeUser.email}`);
      return userSpecificActs ? JSON.parse(userSpecificActs) : [];
    }
    
    // 3. If no user is logged in, return an absolute clean slate (show nothing)
    return [];
  });

  // Automatically save activities under the active user's email key whenever changes happen
  useEffect(() => {
    if (authSession && authSession.email) {
      localStorage.setItem(`ecosphere_activities_${authSession.email}`, JSON.stringify(activities));
    }
  }, [activities, authSession]);
  // Save activities automatically to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("ecosphere_activities", JSON.stringify(activities));
  }, [activities]);
  // --- AUTH RUNTIME HANDLERS WITH ACCOUNT FILTERING ---
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError("");

    if (isRegistering) {
      if (!authForm.name || !authForm.email || !authForm.password) {
        setAuthError("Please fill out all fields to register.");
        return;
      }
      
      localStorage.setItem(`user_cred_${authForm.email}`, JSON.stringify(authForm));
      
      const sessionData = { name: authForm.name, email: authForm.email };
      localStorage.setItem("ecosphere_user_session", JSON.stringify(sessionData));
      
      setAuthSession(sessionData);
      setUserProfile({ name: authForm.name });
      
      // Load clean logs for the brand-new account profile
      setActivities([]);
      
      triggerToast("🎉 Registration Successful! Welcome aboard.");
      setCurrentTab('dashboard');
    } else {
      const storedUserRaw = localStorage.getItem(`user_cred_${authForm.email}`);
      if (!storedUserRaw) {
        setAuthError("Email address not found. Please register first.");
        return;
      }

      const storedUser = JSON.parse(storedUserRaw);
      
      if (storedUser.password !== authForm.password) {
        setAuthError("❌ Incorrect password. Access denied.");
        return;
      }

      const sessionData = { name: storedUser.name, email: storedUser.email };
      localStorage.setItem("ecosphere_user_session", JSON.stringify(sessionData));
      
      setAuthSession(sessionData);
      setUserProfile({ name: storedUser.name });
      
      // FETCH CURRENT ACCOUNT USER LOGS SPECIFICALLY
      const userSpecificActs = localStorage.getItem(`ecosphere_activities_${storedUser.email}`);
      setActivities(userSpecificActs ? JSON.parse(userSpecificActs) : []);
      
      triggerToast(`👋 Welcome back, ${storedUser.name}!`);
      setCurrentTab('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("ecosphere_user_session");
    
    // Clear out session memory variables instantly
    setAuthSession(null);
    setAuthForm({ name: "", email: "", password: "" });
    setUserProfile({ name: "Eco Explorer" });
    
    // WIPES CARDS IMMEDIATELY ON LOGOUT SO NO PROFILE DATA IS LEAKED
    setActivities([]);
    
    triggerToast("Logged out successfully. Data locked.");
    setCurrentTab('landing');
  };
  

  // Platform Metrics & Engine Database
  
  
  const [goals, setGoals] = useState([
    { id: 'g1', title: 'Limit monthly driving to 200km', target: 200, current: 85, deadline: '2026-07-01', category: 'Transportation', completed: false },
    { id: 'g2', title: 'Cook 15 Vegan dinners', target: 15, current: 6, deadline: '2026-06-30', category: 'Food', completed: false }
  ]);

  const [activeChallenges, setActiveChallenges] = useState(['plastic']);
  const [unlockedBadges, setUnlockedBadges] = useState(['eco_beginner']);
  const [calcData, setCalcData] = useState(DEFAULT_CALC_DATA);

  // Eco Future Simulator Values
  const [simSliders, setSimSliders] = useState({
    drivingReduction: 30, 
    cyclingIncrease: 40,   
    flightReduction: 50,  
    meatReduction: 60,    
    electricityCut: 20    
  });
// State tracking for the active reading view in the Eco Hub
  const [activeArticle, setActiveArticle] = useState(null);
  // Track completed small sub-challenges by their unique IDs
  const [completedSubChallenges, setCompletedSubChallenges] = useState([]);

  // Toggle sub-challenge completion and reward impact points
  const toggleSubChallenge = (subId, points) => {
    if (completedSubChallenges.includes(subId)) {
      setCompletedSubChallenges(prev => prev.filter(id => id !== subId));
      triggerToast(`Task undone. Points removed.`);
    } else {
      setCompletedSubChallenges(prev => [...prev, subId]);
      triggerToast(` Small Challenge complete! +${points} XP earned.`);
    }
  };
  // AI Chat Assistant State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Greetings! I am your AI Eco-Coach. Ask me about your habits, carbon equations, or how to reach sustainable equilibrium.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Sustainability Hub bookmarks
  const [bookmarkedArticles, setBookmarkedArticles] = useState([]);
  const [articleSearch, setArticleSearch] = useState('');

  // Firebase integration indicators
  const [fbUser, setFbUser] = useState(null);
  const [dbStatus, setDbStatus] = useState('Idle');

  // Activity Tracker Modals & Forms
  const [trackerModal, setTrackerModal] = useState(false);
  const [editActivityId, setEditActivityId] = useState(null);
  const [trackerForm, setTrackerForm] = useState({
    category: 'Transportation',
    name: '',
    value: '',
    date: new Date().toISOString().substring(0,10),
    notes: ''
  });

  // --- FIREBASE AND AUTHENTICATION ---
  useEffect(() => {
    let authUnsubscribe = () => {};
    let dbUnsubscribe = () => {};

    const initializePlatformSync = async () => {
      if (!config || !auth || !db) {
        setDbStatus('In-Memory / Local Mode active');
        return;
      }

      try {
        setDbStatus('Initializing Cloud Connection...');
        const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'ecosphere-ai';

        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }

        authUnsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setFbUser(user);
            setCloudSync(true);
            setDbStatus('Connected securely to Cloud');
            triggerToast("Successfully synchronized with Cloud Storage!");

            const activitiesPath = collection(db, 'artifacts', appId, 'users', user.uid, 'activities');
            
            dbUnsubscribe = onSnapshot(activitiesPath, (snapshot) => {
              const cloudActs = [];
              snapshot.forEach((doc) => {
                cloudActs.push({ id: doc.id, ...doc.data() });
              });
              if (cloudActs.length > 0) {
                setActivities(cloudActs);
              }
            }, (err) => {
              console.error("Firestore sync error: ", err);
            });
          } else {
            setFbUser(null);
            setDbStatus('Disconnected');
          }
        });

      } catch (err) {
        console.error("Firebase platform initialization aborted: ", err);
        setDbStatus('Cloud sync disabled (Offline Mode)');
      }
    };

    initializePlatformSync();

    return () => {
      authUnsubscribe();
      dbUnsubscribe();
    };
  }, []);

  const syncActivityToCloud = async (action, actObj) => {
    if (!cloudSync || !auth || !db) return;
    try {
      const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'ecosphere-ai';
      const userId = auth.currentUser?.uid;

      if (!userId) return;

      const docRef = doc(db, 'artifacts', appId, 'users', userId, 'activities', actObj.id);

      if (action === 'set' || action === 'add') {
        await setDoc(docRef, actObj);
      } else if (action === 'delete') {
        await deleteDoc(docRef);
      }
    } catch (e) {
      console.warn("Could not reach cloud node. Updating state locally.", e);
    }
  };

  // --- STATS CALCULATION ENGINE ---
  const calculatedFootprint = useMemo(() => {
    const travelCo2 = (calcData.carDistance * EMISSION_FACTORS.car) +
                     (calcData.bikeDistance * EMISSION_FACTORS.bike) +
                     (calcData.busDistance * EMISSION_FACTORS.bus) +
                     (calcData.trainDistance * EMISSION_FACTORS.train) +
                     ((calcData.flightDistance / 365) * EMISSION_FACTORS.flight);

    const energyCo2 = (calcData.electricityUse * EMISSION_FACTORS.electricity) +
                     (calcData.gasUse * EMISSION_FACTORS.gas);

    const dietFactor = calcData.dietType === 'vegan' ? EMISSION_FACTORS.vegan :
                       calcData.dietType === 'vegetarian' ? EMISSION_FACTORS.vegetarian : EMISSION_FACTORS.meat;
    const foodCo2 = dietFactor * 3; 

    const wasteCo2 = calcData.wasteWeight * EMISSION_FACTORS.waste;
    const waterCo2 = calcData.waterVolume * EMISSION_FACTORS.water;
    const shoppingCo2 = calcData.shoppingItems * EMISSION_FACTORS.shopping;

    const totalCalculated = travelCo2 + energyCo2 + foodCo2 + wasteCo2 + waterCo2 + shoppingCo2;

    return {
      travel: parseFloat(travelCo2.toFixed(1)),
      energy: parseFloat(energyCo2.toFixed(1)),
      food: parseFloat(foodCo2.toFixed(1)),
      waste: parseFloat(wasteCo2.toFixed(1)),
      shopping: parseFloat(shoppingCo2.toFixed(1)),
      water: parseFloat(waterCo2.toFixed(1)),
      total: parseFloat(totalCalculated.toFixed(1))
    };
  }, [calcData]);

  const trackedEmissions = useMemo(() => {
    const totalTracked = activities.reduce((sum, act) => sum + act.co2, 0);
    const categoryTotals = activities.reduce((acc, act) => {
      acc[act.category] = (acc[act.category] || 0) + act.co2;
      return acc;
    }, {});

    return {
      total: parseFloat(totalTracked.toFixed(1)),
      byCategory: categoryTotals
    };
  }, [activities]);

  const sustainabilityScore = useMemo(() => {
    const dailyCo2 = calculatedFootprint.total;
    let baseScore = 100 - ((dailyCo2 - 10) * 2.2);
    baseScore = Math.max(10, Math.min(100, baseScore)); 

    let status = 'Needs Improvement';
    let colorClass = 'text-red-500 border-red-500/30';
    let badgeClass = 'bg-red-500/10 text-red-400';
    
    if (baseScore >= 90) {
      status = 'Eco Hero';
      colorClass = 'text-emerald-500 border-emerald-500/30';
      badgeClass = 'bg-emerald-500/10 text-emerald-400';
    } else if (baseScore >= 75) {
      status = 'Green Champion';
      colorClass = 'text-blue-500 border-blue-500/30';
      badgeClass = 'bg-blue-500/10 text-blue-400';
    } else if (baseScore >= 60) {
      status = 'Sustainable Starter';
      colorClass = 'text-amber-500 border-amber-500/30';
      badgeClass = 'bg-amber-500/10 text-amber-400';
    }

    return {
      score: Math.round(baseScore),
      status,
      colorClass,
      badgeClass
    };
  }, [calculatedFootprint]);

  useEffect(() => {
    const currentScore = sustainabilityScore.score;
    const newBadges = [...unlockedBadges];
    let updated = false;

    if (currentScore >= 75 && !newBadges.includes('green_warrior')) {
      newBadges.push('green_warrior');
      updated = true;
      triggerToast("Achievement Unlocked: Green Warrior! Your score crossed 75.");
    }
    if (currentScore >= 90 && !newBadges.includes('climate_champion')) {
      newBadges.push('climate_champion');
      updated = true;
      triggerToast("Achievement Unlocked: Climate Champion! Outstanding sustainability score.");
    }
    if (activities.length >= 5 && !newBadges.includes('planet_guardian')) {
      newBadges.push('planet_guardian');
      updated = true;
      triggerToast("Achievement Unlocked: Planet Guardian! Logged over 5 activities.");
    }

    if (updated) {
      setUnlockedBadges(newBadges);
    }
  }, [sustainabilityScore, activities]);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const simulatedSavings = useMemo(() => {
    const originalCar = calcData.carDistance * EMISSION_FACTORS.car;
    const originalFli = (calcData.flightDistance / 365) * EMISSION_FACTORS.flight;
    const originalMeat = (calcData.dietType === 'meat' ? EMISSION_FACTORS.meat : 0) * 3;
    const originalEle = calcData.electricityUse * EMISSION_FACTORS.electricity;

    const carSavings = originalCar * (simSliders.drivingReduction / 100);
    const flightSavings = originalFli * (simSliders.flightReduction / 100);
    const dietSavings = originalMeat * (simSliders.meatReduction / 100);
    const electricitySavings = originalEle * (simSliders.electricityCut / 100);

    const totalDailySavings = carSavings + flightSavings + dietSavings + electricitySavings;
    const totalAnnualSavings = totalDailySavings * 365;

    return {
      daily: parseFloat(totalDailySavings.toFixed(2)),
      annual: Math.round(totalAnnualSavings),
      currentFootprint: calculatedFootprint.total,
      futureFootprint: parseFloat(Math.max(2.0, calculatedFootprint.total - totalDailySavings).toFixed(2))
    };
  }, [simSliders, calculatedFootprint, calcData]);

  // --- GEMINI CO-COACH API ADAPTER ---
  const invokeEcoCoach = async () => {
    if (!chatInput.trim()) return;
    const userPrompt = chatInput;
    setChatInput('');
    setChatLoading(true);

    // 1. Optimistically append the user's message to the UI
    const newMessages = [
      ...chatMessages, 
      { 
        role: 'user', 
        text: userPrompt, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }
    ];
    setChatMessages(newMessages);

    // 2. Format historical messages to match the expected Gemini API structure
    // (Maps your app's roles to Gemini's required 'user' and 'model' roles)
    const conversationHistory = chatMessages.slice(1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));
    conversationHistory.push({
      role: 'user',
      parts: [{ text: userPrompt }]
    });

    try {
      // 3. Build the System Prompt to give the AI context about the user's current metrics
      const systemPrompt = `You are the ultimate Carbon AI Coach. You are speaking to ${userProfile.name}.
      Their dynamic sustainability score is ${sustainabilityScore.score}/100 (${sustainabilityScore.status}).
      Their daily carbon footprint is computed as ${calculatedFootprint.total} kg CO2.
      Breakdown: Travel: ${calculatedFootprint.travel}kg, Energy: ${calculatedFootprint.energy}kg, Diet/Food: ${calculatedFootprint.food}kg, Waste: ${calculatedFootprint.waste}kg.
      They have logged ${activities.length} activities. Keep recommendations precise, actionable, scientific, and motivating. Provide clean bulleted responses and wrap statistics clearly.`;

      // 4. DEMO MODE FALLBACK (If the user hasn't provided an API key yet)
      if (!apiKey) {
        setTimeout(() => {
          const mockAnswers = [
            `Based on your daily travel footprint (${calculatedFootprint.travel} kg), implementing your simulator target of reducing driving by ${simSliders.drivingReduction}% will strip away approx ${simulatedSavings.annual} kg of atmospheric Carbon Dioxide annually!`,
            `Your diet selection registers ${calculatedFootprint.food} kg CO2 daily. Moving completely towards a sustainable vegetarian or vegan alternative for lunch alone would optimize your overall ecological score by up to 15 points.`,
            `To achieve sustainable equilibrium, I recommend establishing custom alerts for energy spikes. Composting protocols could decrease landfill greenhouse dynamics by up to 40%.`
          ];
          const chosenMock = mockAnswers[Math.floor(Math.random() * mockAnswers.length)];
          setChatMessages(prev => [
            ...prev, 
            { 
              role: 'assistant', 
              text: `[DEMO MODE] ${chosenMock}\n\n*(Connect your custom Gemini API key in the Platform Settings to unlock live consultations!)*`, 
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            }
          ]);
          setChatLoading(false);
        }, 1200);
        return;
      }

      // 5. LIVE MODE: Target the official Google Gemini API Endpoint
      const baseApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const payload = {
        contents: conversationHistory,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      };

      const response = await fetch(baseApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API error status: ${response.status}`);
      }

      const data = await response.json();
      const aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      // 6. Append the live AI response to the chat window
      setChatMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          text: aiResponseText || "I couldn't process that response. Please try again.", 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }
      ]);

    } catch (err) {
      console.error("API Call Failed:", err);
      setChatMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          text: `Connection failed: ${err.message}. Please double-check that your Gemini API key is valid inside your Settings panel.`, 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };
  // --- HANDLERS SYSTEM ---
  const handleAddActivity = (e) => {
    e.preventDefault();
    if (!trackerForm.name || !trackerForm.value) return;

    const valueNum = parseFloat(trackerForm.value);
    let multiplier = 0.5;
    if (trackerForm.category === 'Transportation') multiplier = EMISSION_FACTORS.car;
    else if (trackerForm.category === 'Food') multiplier = EMISSION_FACTORS.meat;
    else if (trackerForm.category === 'Energy') multiplier = EMISSION_FACTORS.electricity;
    else if (trackerForm.category === 'Waste') multiplier = EMISSION_FACTORS.waste;
    else if (trackerForm.category === 'Shopping') multiplier = EMISSION_FACTORS.shopping;
    else if (trackerForm.category === 'Water') multiplier = EMISSION_FACTORS.water;

    const computedCo2 = parseFloat((valueNum * multiplier).toFixed(2));

    const newActivity = {
      id: editActivityId || Math.random().toString(36).substring(2, 9),
      category: trackerForm.category,
      name: trackerForm.name,
      value: valueNum,
      co2: computedCo2,
      date: trackerForm.date,
      notes: trackerForm.notes
    };

    if (editActivityId) {
      setActivities(prev => prev.map(act => act.id === editActivityId ? newActivity : act));
      syncActivityToCloud('set', newActivity);
      triggerToast("Activity updated and emission profiles recalculated!");
    } else {
      setActivities(prev => [newActivity, ...prev]);
      syncActivityToCloud('add', newActivity);
      triggerToast("Sustainability event logged successfully.");
    }

    setTrackerModal(false);
    setEditActivityId(null);
    setTrackerForm({ category: 'Transportation', name: '', value: '', date: new Date().toISOString().substring(0,10), notes: '' });
  };

  const deleteActivity = (id) => {
    setActivities(prev => prev.filter(act => act.id !== id));
    syncActivityToCloud('delete', { id });
    triggerToast("Activity deleted from carbon log.");
  };

  const triggerEnrollChallenge = (cid) => {
    if (activeChallenges.includes(cid)) {
      setActiveChallenges(prev => prev.filter(id => id !== cid));
      triggerToast("Disenrolled from challenge.");
    } else {
      setActiveChallenges(prev => [...prev, cid]);
      triggerToast("Challenge enrolled! Go green and watch your score soar!");
    }
  };

  const toggleBookmark = (id) => {
    if (bookmarkedArticles.includes(id)) {
      setBookmarkedArticles(prev => prev.filter(item => item !== id));
    } else {
      setBookmarkedArticles(prev => [...prev, id]);
      triggerToast("Article bookmarked in Sustainability Hub.");
    }
  };

  const addCustomGoal = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newG = {
      id: Math.random().toString(),
      title: fd.get('title'),
      target: parseFloat(fd.get('target')),
      current: 0,
      deadline: fd.get('deadline'),
      category: fd.get('category'),
      completed: false
    };
    setGoals(prev => [...prev, newG]);
    triggerToast("Goal created! Consistency is the path to Net-Zero.");
    e.target.reset();
  };

  const filteredArticles = PRESET_ARTICLES.filter(art => 
    art.title.toLowerCase().includes(articleSearch.toLowerCase()) || 
    art.excerpt.toLowerCase().includes(articleSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] font-sans relative overflow-hidden flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* GLOWING AMBIENT BACKGROUND */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] rounded-full bg-blue-500/10 blur-[150px]" />
      </div>

      {/* TOAST CONTAINER */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E293B]/95 border-l-4 border-emerald-500 text-slate-100 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3">
          <Icons.Leaf className="w-5 h-5 text-emerald-500" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* MASTER TOP APPLICATION BAR */}
      {/* 💎 GLASSMORPHIC NAVIGATION BAR & RESPONSIVE MULTI-LEVEL TREE SIDEBAR */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0F172A]/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo Branding Section */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setCurrentTab('landing'); setMobileMenuOpen(false); }}>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-400 via-teal-400 to-blue-500 flex items-center justify-center shadow-xl shadow-emerald-500/10">
              <Icons.Globe className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
                EcoSphere AI
              </span>
              <span className="block text-[9px] text-emerald-400/80 font-mono tracking-widest font-bold">DYNAMIC ECO-OS</span>
            </div>
          </div>

          {/* 1. DESKTOP NAVIGATION: Visible ONLY above 1024px (lg:flex) */}
          <nav className="hidden lg:flex items-center gap-1 bg-white/[0.02] border border-white/[0.04] p-1.5 rounded-full">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'calculator', label: 'Calculator' },
              { id: 'tracker', label: 'Impact Log' },
              { id: 'simulator', label: 'Simulator' },
              { id: 'coach', label: 'AI Coach' },
              { id: 'goals', label: 'Campaigns' },
              { id: 'hub', label: 'Eco Hub' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)} 
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
                  currentTab === tab.id 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}>
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right Utilities Dock */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setCurrentTab('settings'); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-xl border transition-all ${currentTab === 'settings' ? 'bg-white/10 border-white/20 text-white' : 'border-white/[0.06] text-slate-400 hover:text-white'}`}>
              <Icons.Settings className="w-5 h-5" />
            </button>

            {/* 2. THE RE-ENGINEERED MENU TRIGGER: Visible ONLY below 1024px */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-slate-300 hover:text-white transition-all flex items-center gap-2 text-xs font-mono font-bold"
            >
              <span>{mobileMenuOpen ? 'CLOSE' : 'MENU'}</span>
              <div className="flex flex-col gap-1 w-4">
                <span className={`h-0.5 w-full bg-current rounded transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-1' : ''}`} />
                <span className={`h-0.5 w-full bg-current rounded transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`h-0.5 w-full bg-current rounded transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-1' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* 3. THREE-BAR TREE SLIDING DRAWER SYSTEM (Responsive Mobile Layout) */}
      <div className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Semi-transparent blur backdrop */}
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => setMobileMenuOpen(false)} />

        {/* Primary Vertical Drawer */}
        <aside className={`absolute top-0 left-0 bottom-0 w-72 bg-[#090D1A]/95 border-r border-white/[0.06] backdrop-blur-2xl p-6 shadow-2xl transition-transform duration-300 ease-out transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center gap-3 pb-6 border-b border-white/[0.06] mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center">
              <Icons.Globe className="w-5 h-5 text-slate-950" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white font-mono">ECO-OS SYSTEMS</span>
          </div>
          
          {/* THE THREE TREE SECTIONS GRID */}
          <div className="space-y-6">
            
            {/* BAR BRANCH 1: CORE ANALYTICS */}
            <div className="space-y-2">
              <div className="text-[10px] text-emerald-400 font-mono font-bold tracking-wider uppercase px-2">
                 Core Analytics
              </div>
              <div className="flex flex-col gap-1 pl-2 border-l border-white/[0.06]">
                {[
                  { id: 'dashboard', label: 'Dashboard Overview' },
                  { id: 'calculator', label: 'Carbon Calculator' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentTab(item.id); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all ${currentTab === item.id ? 'bg-emerald-500/10 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'}`}
                  >
                    &bull; {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* BAR BRANCH 2: ACTION REGISTRY */}
            <div className="space-y-2">
              <div className="text-[10px] text-teal-400 font-mono font-bold tracking-wider uppercase px-2">
                 Action Registry
              </div>
              <div className="flex flex-col gap-1 pl-2 border-l border-white/[0.06]">
                {[
                  { id: 'tracker', label: 'Impact Log Entries' },
                  { id: 'simulator', label: 'Predictive Simulator' },
                  { id: 'goals', label: 'Campaign Channels' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentTab(item.id); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all ${currentTab === item.id ? 'bg-teal-500/10 text-teal-300 font-bold' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'}`}
                  >
                    &bull; {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* BAR BRANCH 3: INTELLIGENCE CENTER */}
            <div className="space-y-2">
              <div className="text-[10px] text-blue-400 font-mono font-bold tracking-wider uppercase px-2">
                 Intelligence Center
              </div>
              <div className="flex flex-col gap-1 pl-2 border-l border-white/[0.06]">
                {[
                  { id: 'coach', label: 'AI Eco Coach Live' },
                  { id: 'hub', label: 'Research Library Hub' },
                  { id: 'settings', label: 'Platform Settings' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentTab(item.id); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all ${currentTab === item.id ? 'bg-blue-500/10 text-blue-300 font-bold' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'}`}
                  >
                    &bull; {item.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </aside>
      </div>

      {/* HERO SECTION / LANDING TAB */}
      {currentTab === 'landing' && (
        <main className="flex-1 relative z-10">
            
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-8">
              <Icons.Cpu className="w-4 h-4" /> Next-Gen Sustainability Simulation
            </div>

            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight max-w-5xl mx-auto leading-tight mb-8">
              Navigate Towards Carbon Neutrality Powered By{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
                Artificial Intelligence
              </span>
            </h1>

            <p className="text-slate-400 text-lg sm:text-xl max-w-3xl mx-auto mb-10">
              Calculate footprint trends, obtain customized carbon mitigation regimes, execute predictive eco-scenarios, and coordinate verified environmental habits.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
              <button 
                onClick={() => setCurrentTab('dashboard')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-emerald-500 to-blue-500 text-slate-950 shadow-xl shadow-emerald-500/20 transform hover:-translate-y-1 transition-all">
                Begin Carbon Audit
              </button>
              <button 
                onClick={() => setCurrentTab('simulator')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 transition-all text-white flex items-center justify-center gap-2">
                Simulate Net-Zero Scenario
              </button>
              <button 
                onClick={() => setCurrentTab('coach')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-emerald-500 to-blue-500 text-slate-950 shadow-xl shadow-emerald-500/20 transform hover:-translate-y-1 transition-all">
                AI sustanability coach
              </button>
            </div>
            

            <div className="relative max-w-4xl mx-auto aspect-[16/9] rounded-3xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-6 overflow-hidden flex flex-col justify-between">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08),transparent_70%)] pointer-events-none" />
              <div className="flex justify-between items-center relative z-10">
                <span className="text-xs text-slate-500 font-mono tracking-widest uppercase">Global Atmospheric Index</span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-mono"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Real-time Simulation Engine</span>
              </div>

              <div className="flex-1 flex items-center justify-center py-6 relative z-10">
                <svg viewBox="0 0 400 200" className="w-full max-w-md h-full">
                  <line x1="0" y1="100" x2="400" y2="100" stroke="#1E293B" strokeDasharray="5,5" />
                  <circle cx="200" cy="100" r="80" fill="none" stroke="#334155" strokeWidth="1" />
                  <circle cx="200" cy="100" r="60" fill="none" stroke="#1E293B" strokeWidth="2" strokeDasharray="4,4" />
                  <circle cx="200" cy="100" r="90" fill="none" stroke="url(#emeraldGrad)" strokeWidth="1.5" />
                  
                  <g style={{ transformOrigin: '200px 100px' }}>
                    <circle cx="120" cy="100" r="4" fill="#10B981" />
                    <line x1="120" y1="100" x2="200" y2="100" stroke="#10B981" strokeWidth="0.5" strokeDasharray="2,2" />
                    <circle cx="280" cy="100" r="4" fill="#3B82F6" />
                    <line x1="280" y1="100" x2="200" y2="100" stroke="#3B82F6" strokeWidth="0.5" strokeDasharray="2,2" />
                  </g>

                  <defs>
                    <radialGradient id="sphereGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                  <circle cx="200" cy="100" r="75" fill="url(#sphereGrad)" />
                  <text x="200" y="95" textAnchor="middle" fill="#FFFFFF" className="text-xl font-bold font-mono">{sustainabilityScore.score}/100</text>
                  <text x="200" y="115" textAnchor="middle" fill="#10B981" className="text-xs font-semibold tracking-wider uppercase">{sustainabilityScore.status}</text>
                </svg>
              </div>

              <div className="flex justify-between text-xs text-slate-400 font-mono relative z-10">
                <span>Calculated Baseline: {calculatedFootprint.total} kg CO2/day</span>
                <span>Active Core: 128-bit AI Node</span>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* DASHBOARD TAB */}
      {currentTab === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-slate-800 gap-4">
            <div>
              <span className="text-sm text-slate-400 font-mono">PLATFORM MONITOR</span>
              <h1 className="text-3xl font-extrabold text-white">Welcome back, {userProfile.name}</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs bg-slate-800 px-3 py-1.5 rounded text-slate-400 font-mono flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${cloudSync ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {dbStatus}
              </span>
              <button 
                onClick={() => setTrackerModal(true)}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition flex items-center gap-2">
                <Icons.Plus className="w-4 h-4" /> Add Daily Metric
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="p-6 rounded-2xl bg-[#111827]/40 border border-slate-800/60 backdrop-blur-md">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Daily Calculated</span>
                <span className="text-emerald-500 p-1.5 rounded-lg bg-emerald-500/10"><Icons.Flame className="w-5 h-5" /></span>
              </div>
              <div className="text-3xl font-black text-white">{calculatedFootprint.total} <span className="text-sm font-normal text-slate-400">kg CO2</span></div>
            </div>

            <div className="p-6 rounded-2xl bg-[#111827]/40 border border-slate-800/60 backdrop-blur-md">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Weekly Projected</span>
                <span className="text-blue-500 p-1.5 rounded-lg bg-blue-500/10"><Icons.Calendar className="w-5 h-5" /></span>
              </div>
              <div className="text-3xl font-black text-white">{(calculatedFootprint.total * 7).toFixed(1)} <span className="text-sm font-normal text-slate-400">kg CO2</span></div>
            </div>

            <div className="p-6 rounded-2xl bg-[#111827]/40 border border-slate-800/60 backdrop-blur-md">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Logged This Month</span>
                <span className="text-amber-500 p-1.5 rounded-lg bg-amber-500/10"><Icons.Award className="w-5 h-5" /></span>
              </div>
              <div className="text-3xl font-black text-white">{trackedEmissions.total} <span className="text-sm font-normal text-slate-400">kg CO2</span></div>
            </div>

            <div className="p-6 rounded-2xl bg-[#111827]/40 border border-slate-800/60 backdrop-blur-md flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono tracking-wider uppercase block mb-1">Eco Score</span>
                <span className="text-3xl font-black text-white">{sustainabilityScore.score}</span>
                <span className={`block text-xs mt-2 px-2 py-1 rounded font-semibold ${sustainabilityScore.badgeClass}`}>{sustainabilityScore.status}</span>
              </div>
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <circle className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <circle className="text-emerald-500" strokeDasharray={`${sustainabilityScore.score}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            <div className="lg:col-span-2 p-6 rounded-2xl bg-[#111827]/40 border border-slate-800/60 backdrop-blur-md">
              <h2 className="text-lg font-bold text-white mb-2">Interactive Carbon Index Trend</h2>
              <div className="h-64 w-full mt-4">
                <svg viewBox="0 0 500 200" className="w-full h-full">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M 50 140 Q 136 90 222 130 T 308 80 T 394 110 T 480 50 L 480 180 L 50 180 Z" fill="url(#areaGrad)" />
                  <path d="M 50 140 Q 136 90 222 130 T 308 80 T 394 110 T 480 50" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="480" cy="50" r="4" fill="#3B82F6" />
                </svg>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#111827]/40 border border-slate-800/60 backdrop-blur-md">
              <h2 className="text-lg font-bold text-white mb-2">Source Allocation</h2>
              <div className="relative aspect-square max-w-[150px] mx-auto my-6">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#1E293B" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#EF4444" strokeWidth="4" strokeDasharray="30 100" strokeDashoffset="100" />
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#10B981" strokeWidth="4" strokeDasharray="25 100" strokeDashoffset="70" />
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#3B82F6" strokeWidth="4" strokeDasharray="45 100" strokeDashoffset="45" />
                </svg>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span>Travel</span><span className="text-slate-400">{calculatedFootprint.travel} kg</span></div>
                <div className="flex justify-between"><span>Energy</span><span className="text-slate-400">{calculatedFootprint.energy} kg</span></div>
                <div className="flex justify-between"><span>Diet</span><span className="text-slate-400">{calculatedFootprint.food} kg</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CARBON CALCULATOR TAB */}
      {currentTab === 'calculator' && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 relative z-10">
          <div className="mb-8">
            <span className="text-xs text-emerald-400 font-mono uppercase">ECOLOGICAL EQUATIONS MODULATOR</span>
            <h1 className="text-3xl font-extrabold text-white">Full-Spectrum Carbon Calculator</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-md">
              <div className="space-y-4">
                <span className="text-xs font-semibold text-slate-300 block">Transportation & Commute (Weekly Km)</span>
                <input type="range" min="0" max="300" value={calcData.carDistance} onChange={(e) => setCalcData({...calcData, carDistance: parseInt(e.target.value)})} className="w-full accent-emerald-500" />
                <div className="flex justify-between text-xs text-slate-400"><span>Private Fuel Vehicle</span><span>{calcData.carDistance} km</span></div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-300 block">Electricity Draw (Daily kWh)</span>
                <input type="range" min="2" max="60" value={calcData.electricityUse} onChange={(e) => setCalcData({...calcData, electricityUse: parseInt(e.target.value)})} className="w-full accent-emerald-500" />
                <div className="flex justify-between text-xs text-slate-400"><span>Grid Consumption</span><span>{calcData.electricityUse} kWh</span></div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-300 block">Diet Profile Selection</span>
                <div className="grid grid-cols-3 gap-3">
                  {['meat', 'vegetarian', 'vegan'].map((t) => (
                    <button key={t} onClick={() => setCalcData({...calcData, dietType: t})} className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border ${calcData.dietType === t ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/20 text-center h-fit">
              <span className="text-xs text-emerald-400 font-mono block mb-2">YOUR ATMOSPHERIC LOAD</span>
              <div className="text-5xl font-black text-white">{calculatedFootprint.total}</div>
              <span className="text-xs text-slate-400 block mt-2">kg CO₂ equivalent per day</span>
            </div>
          </div>
        </div>
      )}

      {/* IMPACT LOG TAB */}
      {currentTab === 'tracker' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 relative z-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl font-extrabold text-white">Ecological Habit Registry</h1>
            <button onClick={() => setTrackerModal(true)} className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm flex items-center gap-2"><Icons.Plus className="w-4 h-4" /> Log Custom Habit</button>
          </div>

          <div className="bg-[#111827]/40 rounded-2xl border border-slate-800/80 backdrop-blur-md overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-mono text-xs uppercase">
                  <th className="p-4">Activity</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Volume</th>
                  <th className="p-4">Impact</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {activities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-800/20">
                    <td className="p-4 font-semibold text-slate-200">{act.name}</td>
                    <td className="p-4"><span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">{act.category}</span></td>
                    <td className="p-4 font-mono">{act.value} Units</td>
                    <td className="p-4 font-mono text-red-400">+{act.co2} kg CO₂</td>
                    <td className="p-4 text-right">
                      <button onClick={() => deleteActivity(act.id)} className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"><Icons.Trash className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SIMULATOR TAB */}
      {currentTab === 'simulator' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 relative z-10">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black text-white">Interactive Carbon Prediction Suite</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6 bg-[#111827]/40 p-6 rounded-2xl border border-slate-800/80">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2"><span>Commuting Shift (Reduce driving)</span><span className="text-emerald-400">-{simSliders.drivingReduction}%</span></div>
                <input type="range" min="0" max="100" value={simSliders.drivingReduction} onChange={(e) => setSimSliders({...simSliders, drivingReduction: parseInt(e.target.value)})} className="w-full accent-emerald-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2"><span>Smart-Grid Optimization</span><span className="text-pink-400">-{simSliders.electricityCut}%</span></div>
                <input type="range" min="0" max="100" value={simSliders.electricityCut} onChange={(e) => setSimSliders({...simSliders, electricityCut: parseInt(e.target.value)})} className="w-full accent-pink-500" />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-tr from-slate-900 to-emerald-950 border border-emerald-500/20">
              <span className="text-xs text-emerald-400 font-mono block mb-4">SIMULATION PROFILE</span>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span>Baseline:</span><span className="font-mono">{simulatedSavings.currentFootprint} kg</span></div>
                <div className="flex justify-between font-bold text-emerald-400"><span>Future Target:</span><span className="font-mono">{simulatedSavings.futureFootprint} kg</span></div>
                <div className="flex justify-between font-bold text-blue-400"><span>Annual Offset:</span><span className="font-mono">-{simulatedSavings.annual} kg</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI COACH TAB */}
      {currentTab === 'coach' && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 relative z-10 flex flex-col h-[550px]">
          <div className="mb-4">
            <h1 className="text-2xl font-black text-white">AI Carbon Coach</h1>
            <p className="text-slate-400 text-xs"></p>
          </div>

          <div className="flex-1 bg-[#111827]/60 rounded-2xl border border-slate-800/80 flex flex-col overflow-hidden">
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl p-3 text-xs ${msg.role === 'user' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'bg-slate-900 border border-slate-800 text-slate-200'}`}>
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                </div>
              ))}
              {chatLoading && <div className="text-xs text-emerald-500 animate-pulse font-mono">AI Coach is thinking...</div>}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Ask advice about your eco equations..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && invokeEcoCoach()}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none text-white" />
              <button onClick={invokeEcoCoach} className="p-2.5 rounded-lg bg-emerald-500 text-slate-950 font-bold"><Icons.Send className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {/* 🎯 CAMPAIGNS & GOALS SYSTEM TAB (WITH AUTOMATED MINI-CHALLENGES DRAWER) */}
      {currentTab === 'goals' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 relative z-10">
          <div className="mb-10">
            <span className="text-xs text-emerald-400 font-mono tracking-widest uppercase">ACTIVE COLLECTIVE DIRECTIVES</span>
            <h1 className="text-3xl font-extrabold text-white">Campaigns & Verified Challenges</h1>
            <p className="text-slate-400 text-sm mt-1">Create custom environmental targets or enroll in live collective green campaigns to open daily small challenges.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Predefined Public Campaigns List */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-bold text-white">Collective Climate Directives</h2>
              
              <div className="grid grid-cols-1 gap-6">
                {CHANNELS.map(ch => {
                  const isEnrolled = activeChallenges.includes(ch.id);
                  
                  return (
                    <div key={ch.id} className={`p-6 rounded-2xl bg-slate-900/40 border transition-all duration-500 backdrop-blur-md flex flex-col justify-between ${isEnrolled ? 'border-emerald-500/30 shadow-lg bg-emerald-500/[0.01]' : 'border-white/[0.06]'}`}>
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <span className="px-2 py-1 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 uppercase">{ch.category}</span>
                          <span className="text-xs text-slate-500 font-mono font-semibold">{ch.days} Days Timeline</span>
                        </div>
                        <h3 className="text-base font-bold text-white mb-2">{ch.title}</h3>
                        <p className="text-slate-400 text-xs leading-relaxed mb-6">{ch.description}</p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                        <span className="text-xs text-amber-400 font-semibold font-mono">🎯 Max Reward: +{ch.reward} Points</span>
                        <button 
                          onClick={() => triggerEnrollChallenge(ch.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all duration-300 ${isEnrolled ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                          {isEnrolled ? '⚡ Active / Enrolled' : 'Enroll Campaign'}
                        </button>
                      </div>

                      {/* 📋 NESTED SMALL CHALLENGES TRACKER (Appears smoothly when Enrolled) */}
                      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isEnrolled ? 'max-h-[350px] mt-6 pt-4 border-t border-dashed border-white/[0.08]' : 'max-h-0'}`}>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-wider block mb-3 uppercase">⚡ Daily Small Challenges Checklist:</span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {ch.subChallenges?.map((sub) => {
                            const isSubDone = completedSubChallenges.includes(sub.id);
                            
                            return (
                              <div 
                                key={sub.id} 
                                onClick={() => toggleSubChallenge(sub.id, sub.points)}
                                className={`p-3 rounded-xl border cursor-pointer select-none flex items-center justify-between gap-3 transition-all duration-300 ${isSubDone ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-slate-950/40 border-white/[0.04] hover:bg-white/[0.02] text-slate-400'}`}
                              >
                                <div className="flex items-center gap-2.5">
                                  {/* Custom internal Checkbox item graphic node */}
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isSubDone ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700'}`}>
                                    {isSubDone && (
                                      <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-mono leading-tight">{sub.task}</span>
                                </div>
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${isSubDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>+{sub.points}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side-panel Custom Goal Creator Container */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/[0.06] backdrop-blur-md h-fit">
              <h2 className="text-sm font-bold text-white pb-3 border-b border-white/[0.06] mb-4">Establish Micro Goal</h2>
              <form onSubmit={addCustomGoal} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Target Description</label>
                  <input name="title" required placeholder="e.g. Limit daily electricity use" className="w-full bg-slate-950 border border-white/[0.06] rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Target Goal Metric (Value)</label>
                  <input name="target" type="number" required placeholder="e.g. 15" className="w-full bg-slate-950 border border-white/[0.06] rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Impact Category</label>
                  <select name="category" className="w-full bg-slate-950 border border-white/[0.06] rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500">
                    <option>Transportation</option>
                    <option>Food</option>
                    <option>Energy</option>
                    <option>Waste</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Target Date</label>
                  <input name="deadline" type="date" required className="w-full bg-slate-950 border border-white/[0.06] rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500" />
                </div>
                <button type="submit" className="w-full py-2.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-all">
                  Compile Target Action
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* HUB TAB */}
     {/* 📚 SUSTAINABILITY EDUCATION HUB TAB (WITH COMPREHENSIVE TEXT EXPANSION SYSTEM) */}
      {currentTab === 'hub' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 relative z-10">
          
          <div className="mb-10 text-center max-w-2xl mx-auto">
            <span className="text-xs text-emerald-400 font-mono tracking-widest uppercase">ECOLOGICAL LIBRARY RESOURCE</span>
            <h1 className="text-3xl font-extrabold text-white">Sustainability Research Hub</h1>
            <p className="text-slate-400 text-sm mt-1">Explore curated educational content, technical articles, and direct-action guides vetted by carbon science standards.</p>
            
            {/* Input Search Grid */}
            <div className="mt-6 flex max-w-md mx-auto bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden p-1.5 backdrop-blur-md">
              <input 
                type="text" 
                placeholder="Search research topics..."
                value={articleSearch}
                onChange={(e) => setArticleSearch(e.target.value)}
                className="flex-1 bg-transparent px-3 text-xs focus:outline-none text-white placeholder-slate-500" />
              <button className="px-4 py-2 rounded-lg bg-white/[0.05] text-xs font-bold text-white hover:bg-white/[0.1] transition-all">Search</button>
            </div>
          </div>

          {/* Research Articles Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {filteredArticles.map(art => (
              <div key={art.id} className="bg-slate-900/40 rounded-2xl border border-white/[0.06] backdrop-blur-md overflow-hidden flex flex-col justify-between p-6 hover:border-emerald-500/20 transition-all duration-300">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded font-mono font-semibold uppercase">{art.category}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{art.readingTime}</span>
                  </div>
                  <h3 
                    onClick={() => setActiveArticle(art)} 
                    className="text-base font-bold text-white mb-2 hover:text-emerald-400 transition cursor-pointer"
                  >
                    {art.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">{art.excerpt}</p>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-white/[0.06]">
                  {/* Click event bound handler triggers full info modal view */}
                  <button 
                    onClick={() => setActiveArticle(art)} 
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline transition-all"
                  >
                    Read Complete Whitepaper &rarr;
                  </button>
                  
                  <button 
                    onClick={() => toggleBookmark(art.id)}
                    className="p-1.5 rounded-lg border border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.05] transition"
                  >
                    <svg className={`w-4 h-4 ${bookmarkedArticles.includes(art.id) ? 'fill-emerald-400 text-emerald-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 💎 TRANSLUCENT OVERLAY MODAL FOR EXPANDED WHITE-PAPERS VIEW */}
          {activeArticle && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300">
              
              {/* Overlay dismissal target */}
              <div className="absolute inset-0" onClick={() => setActiveArticle(null)} />
              
              {/* Document pop-up tray container box */}
              <div className="relative w-full max-w-2xl bg-[#0F172A]/90 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
                
                {/* Dismiss Button */}
                <button 
                  onClick={() => setActiveArticle(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.08] w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-all"
                >
                  &times;
                </button>

                {/* Document Header Metadata info */}
                <div className="flex items-center gap-4 text-[11px] font-mono mb-4 text-slate-400 uppercase tracking-wider">
                  <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded font-bold">{activeArticle.category}</span>
                  <span>&bull;</span>
                  <span>Estimated Reading Time: {activeArticle.readingTime}</span>
                </div>

                {/* Article Full Typography Title */}
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-white mb-4 leading-snug">
                  {activeArticle.title}
                </h2>

                <div className="w-12 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full mb-6" />

                {/* Comprehensive Expanded Document Content Body Text */}
                <div className="overflow-y-auto max-h-[50vh] pr-2 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  <p className="font-medium text-slate-200 border-l-2 border-slate-700 pl-3 italic mb-4">
                    "{activeArticle.excerpt}"
                  </p>
                  <p className="whitespace-pre-wrap">
                    {activeArticle.content}
                  </p>
                  <p className="text-slate-400 pt-4 border-t border-white/[0.04]">
                    The core data points presented above are simulated modeling profiles tracking localized carbon indices offsets. For advanced integration or deployment metrics across individual households, consult your live **AI Carbon Coach** portal.
                  </p>
                </div>

                {/* Footer Section bar */}
                <div className="mt-8 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>ECOSPHERE RESEARCH MATRIX</span>
                  <button 
                    onClick={() => {
                      toggleBookmark(activeArticle.id);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 hover:underline transition font-bold"
                  >
                    {bookmarkedArticles.includes(activeArticle.id) ? '🔖 Unbookmark Document' : '🔖 Bookmark This Guide'}
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}
      {/* SETTINGS TAB */}
      {/* ⚙️ OVERHAULED REGISTER & LOGIN PERSISTENCE MANAGER */}
      {currentTab === 'settings' && (
        <div className="max-w-md mx-auto px-4 py-12 flex-1 relative z-10">
          <div className="mb-6 text-center">
            <span className="text-xs text-emerald-400 font-mono tracking-widest uppercase">Identity Verification Node</span>
            <h1 className="text-2xl font-black text-white mt-1">
              {authSession ? "Account Control Center" : isRegistering ? "Create Profile" : "Access Platform"}
            </h1>
          </div>

          <div className="bg-[#111827]/40 rounded-2xl border border-white/[0.06] backdrop-blur-xl p-6 shadow-2xl">
            {authSession ? (
              /* --- LOGGED IN USER STATE VIEW --- */
              <div className="space-y-6 text-center text-xs">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Icons.User className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-slate-400 block font-mono">ACTIVE ID PROFILED</span>
                  <div className="text-base font-bold text-white mt-1">{authSession.name}</div>
                  <div className="text-slate-400 font-mono text-[11px] mt-0.5">{authSession.email}</div>
                </div>

                <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 leading-relaxed text-slate-300">
                  🔒 Your dynamic activity log history, campaigns, and carbon equations are synchronized safely to your local machine storage node.
                </div>

                <button 
                  onClick={handleLogout}
                  className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all font-bold tracking-wide"
                >
                  Disconnect Profile (Logout)
                </button>
              </div>
            ) : (
              /* --- REGISTER / LOGIN FORM ENTRY LAYER --- */
              <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
                
                {authError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-medium font-mono text-center">
                    {authError}
                  </div>
                )}

                {isRegistering && (
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Enter Your Name</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g., Dhanraj"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                      className="w-full bg-slate-950 border border-white/[0.06] focus:border-emerald-500 rounded-xl p-3 text-white focus:outline-none transition-all" 
                    />
                  </div>
                )}

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Gmail / Email Address</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="name@gmail.com"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    className="w-full bg-slate-950 border border-white/[0.06] focus:border-emerald-500 rounded-xl p-3 text-white focus:outline-none transition-all font-mono" 
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Account Password</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                    className="w-full bg-slate-950 border border-white/[0.06] focus:border-emerald-500 rounded-xl p-3 text-white focus:outline-none transition-all font-mono" 
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-600 transition-all shadow-md mt-2 text-sm"
                >
                  {isRegistering ? "Verify & Register Account" : "Secure Login & Open Node"}
                </button>

                <div className="text-center pt-2 text-slate-400 font-mono text-[11px]">
                  {isRegistering ? "Already registered?" : "New user to the workspace?"}{" "}
                  <button 
                    type="button" 
                    onClick={() => { setIsRegistering(!isRegistering); setAuthError(""); }}
                    className="text-emerald-400 hover:underline font-bold"
                  >
                    {isRegistering ? "Login Here" : "Register Profile"}
                  </button>
                </div>

              </form>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-slate-900 bg-[#0A0F1D] py-8 text-center text-xs text-slate-500 mt-auto">
        <p>© 2026 EcoSphere AI.</p>
        <p>LinkedIn Profile :-<a href="https://www.linkedin.com/in/dhanraj-jadhav-9399b53b1" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">Dhanraj Jadhav</a></p>
      </footer>

      {/* TRACKER POPUP MODAL */}
      {trackerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-5 relative">
            <h2 className="font-bold text-sm mb-4">Log Daily Environment Habit</h2>
            <form onSubmit={handleAddActivity} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 text-slate-400">Category Selection</label>
                <select value={trackerForm.category} onChange={(e) => setTrackerForm({...trackerForm, category: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white">
                  {['Transportation', 'Food', 'Energy', 'Waste', 'Shopping', 'Water'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-slate-400">Activity Profile Descriptor</label>
                <input type="text" required placeholder="e.g. Rapid public transit ride" value={trackerForm.name} onChange={(e) => setTrackerForm({...trackerForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
              </div>
              <div>
                <label className="block mb-1 text-slate-400">Metric Amount Volume</label>
                <input type="number" required placeholder="10" value={trackerForm.value} onChange={(e) => setTrackerForm({...trackerForm, value: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setTrackerModal(false)} className="w-1/2 py-2 rounded bg-slate-800 text-white font-medium">Cancel</button>
                <button type="submit" className="w-1/2 py-2 rounded bg-emerald-500 text-slate-950 font-bold">Commit Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
