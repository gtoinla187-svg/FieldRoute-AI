import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Clipboard,
  useColorScheme,
  RefreshControl,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  calculateTimeline,
  optimizeStopSequence,
  getMockLatLng,
  calculateDistance,
  RouteStopInput,
  TimelineEvent,
  RouteSummary
} from './src/lib/routing';

// Central Sales Quotes list
const SALES_QUOTES = [
  { text: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  {
    text: "Our greatest weakness lies in giving up. The most certain way to succeed is always to try just one more time.",
    author: "Thomas A. Edison",
  },
  { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
  { text: "Sales are contingent upon the attitude of the salesman - not the attitude of the prospect.", author: "W. Clement Stone" },
  { text: "Every sale has five basic obstacles: no need, no money, no hurry, no desire, no trust.", author: "Zig Ziglar" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { text: "High expectations are the key to everything.", author: "Sam Walton" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
];

// Initial mock trip dataset to show active state on load
const INITIAL_MOCK_TRIPS = [
  {
    id: "mock-trip-1",
    title: "Silicon Valley Outbound Route",
    startAddress: "straight forwarding inc, Fremont, CA",
    endAddress: "straight forwarding inc, Fremont, CA",
    startDate: "2026-06-26",
    startTime: "08:30",
    status: "draft",
    firstStopStrategy: "closest",
    prepBufferMinutes: 3,
    selectedLunchOption: "salad",
    prospects: [
      { id: "stop-1", name: "Apple HQ", address: "1 Infinite Loop, Cupertino, CA 95014", duration_minutes: 45, notes: "Qualifying meeting with procurement" },
      { id: "stop-2", name: "Googleplex", address: "1600 Amphitheatre Pkwy, Mountain View, CA 94043", duration_minutes: 30, notes: "Deliver ocean freight proposal" },
      { id: "stop-3", name: "Tesla Factory", address: "45500 Fremont Blvd, Fremont, CA 94538", duration_minutes: 45, notes: "Urgent air freight consolidation review" }
    ]
  }
];

const sanitizeTrips = (trips: any[]) => {
  return (trips || []).map((t: any) => {
    let localDate = t.startDate || new Date().toISOString().split('T')[0];
    let localTime = t.startTime || "09:00";
    
    if (t.startTimeIso) {
      const d = new Date(t.startTimeIso);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        localDate = `${year}-${month}-${date}`;
        
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        localTime = `${hours}:${minutes}`;
      }
    }
    
    return {
      ...t,
      startAddress: typeof t.startAddress === "string" ? decodeURIComponent(t.startAddress) : (t.startAddress || ""),
      endAddress: typeof t.endAddress === "string" ? decodeURIComponent(t.endAddress) : (t.endAddress || ""),
      startDate: localDate,
      startTime: localTime,
      status: t.status || "draft",
      firstStopStrategy: t.firstStopStrategy || "closest",
      prepBufferMinutes: t.prepBufferMinutes || 3,
      selectedLunchOption: t.selectedLunchOption || "salad",
      prospects: (t.prospects || []).map((p: any) => ({
        ...p,
        name: p.name || "",
        address: typeof p.address === "string" ? decodeURIComponent(p.address) : (p.address || ""),
        duration_minutes: p.duration_minutes || p.duration || 30,
        notes: p.notes || ""
      }))
    };
  });
};

const getStreetName = (address: string): string => {
  if (!address) return "Main St";
  const parts = address.split(",");
  if (parts.length > 0) {
    const streetPart = parts[0].trim();
    const words = streetPart.split(" ");
    if (words.length > 1 && /^\d+/.test(words[0])) {
      return words.slice(1).join(" ");
    }
    return streetPart;
  }
  return "Main St";
};

const getLunchOptions = (prevAddress: string, nextAddress: string) => {
  const decoded = decodeURIComponent(nextAddress || "450 Main St, Fremont, CA");
  
  // Parse parts of the next address
  const parts = decoded.split(",");
  const streetPart = parts[0] || "450 Main St";
  const cityPart = parts[1] ? parts[1].trim() : "Fremont";
  const stateZipPart = parts[2] ? parts[2].trim() : "CA 94539";
  
  // Clean unit numbers (e.g. Suite, Apt, #, Ste, Unit, Rd. 200, etc.) from streetPart
  const cleanStreet = streetPart.replace(/\b(ste|suite|apt|unit|room|rm|#|\.\s*\d+)\b.*$/i, "").trim();
  
  // Extract street number and street name
  const streetNumMatch = cleanStreet.match(/^(\d+)\s+(.+)$/);
  let streetName = cleanStreet;
  let originalNumber = "123";
  if (streetNumMatch) {
    originalNumber = streetNumMatch[1];
    streetName = streetNumMatch[2].trim();
  }
  
  // Helper to construct address with a modified number
  const makeAddress = (num: string) => {
    return `${num} ${streetName}, ${cityPart}, ${stateZipPart}`;
  };

  // Generate 3 alternative numbers that are on the same street
  const baseNumVal = parseInt(originalNumber, 10) || 100;
  const num1 = String(baseNumVal + 15);
  const num2 = String(Math.max(10, baseNumVal - 20));
  const num3 = String(baseNumVal + 40);

  return [
    {
      id: "cafe",
      name: "Panera Bread (Quick)",
      address: makeAddress(num1),
    },
    {
      id: "salad",
      name: "Chipotle Mexican Grill (Healthy)",
      address: makeAddress(num2),
    },
    {
      id: "deli",
      name: "Subway (Light)",
      address: makeAddress(num3),
    },
  ];
};

export default function App() {
  const systemScheme = useColorScheme();
  
  // Navigation states
  const [screen, setScreen] = useState<'home' | 'bd-consultant' | 'trip'>('home');
  
  // App Config / Settings states
  const [userName, setUserName] = useState("John");
  const [prepBuffer, setPrepBuffer] = useState("3");
  const [unitSystem, setUnitSystem] = useState<'imperial' | 'metric'>('imperial');
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [apiServerUrl, setApiServerUrl] = useState("http://192.168.68.116:3000");
  const [isVoiceRecordingEnabled, setIsVoiceRecordingEnabled] = useState(true);
  const [reportEmail, setReportEmail] = useState("");
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isNewTripVisible, setIsNewTripVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Greeting & Quotes states
  const [greeting, setGreeting] = useState("");
  const [quote, setQuote] = useState({ text: "", author: "" });
  
  // Weather states
  const [weatherIcon, setWeatherIcon] = useState("🌤️");
  const [rawTemp, setRawTemp] = useState<number | null>(null);
  
  // SFI BD Consultant states
  const [companyInput, setCompanyInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [activeReport, setActiveReport] = useState<any>(null);
  const [activeReportTab, setActiveReportTab] = useState(1);
  const [reportSavedState, setReportSavedState] = useState(false);

  // Trips / Route Workspace states
  const [savedTrips, setSavedTrips] = useState<any[]>([]);
  const [activeTrip, setActiveTrip] = useState<any>(null);

  // User Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUserName, setAuthUserName] = useState("");
  const [tempServerUrl, setTempServerUrl] = useState("https://fieldroute-web-406619139361.us-central1.run.app");
  const [tempUsername, setTempUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const authenticatedFetch = async (url: string, options: any = {}) => {
    const token = authToken || await AsyncStorage.getItem('fieldroute_user_token');
    const headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    return fetch(url, { ...options, headers });
  };

  // Biometric Authentication states
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);

  const [checkInStates, setCheckInStates] = useState<Record<string, {
    status: 'idle' | 'checked_in' | 'checked_out';
    checkInTime?: string;
    checkOutTime?: string;
    checkInMethod?: 'manual' | 'auto';
    checkOutMethod?: 'manual' | 'auto';
  }>>({});

  const [isAutoCheckEnabled, setIsAutoCheckEnabled] = useState(true);
  const [simulatedDistances, setSimulatedDistances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (activeTrip) {
      const initialDistances: Record<string, number> = {};
      const initialRecs: Record<string, any> = {};
      const initialTrans: Record<string, string> = {};

      (activeTrip.prospects || []).forEach((p: any) => {
        initialDistances[p.id] = 120; // Default: 120 yards away
        
        if (p.notes) {
          const parsed = parseVoiceNoteAndTranscript(p.notes);
          if (parsed && parsed.audioName) {
            initialRecs[p.id] = {
              isRecording: false,
              seconds: parsed.duration,
              audioUri: parsed.audioName,
              isPlaying: false,
              playSeconds: 0
            };
            if (parsed.transcriptText) {
              initialTrans[p.id] = parsed.transcriptText;
            }
          }
        }
      });

      setSimulatedDistances(initialDistances);
      setRecordingStates(initialRecs);
      setTranscripts(initialTrans);
      setCheckInStates({}); // Reset check-ins when changing trip
    }
  }, [activeTrip?.id]);

  const syncTripUpdateToBackend = async (updatedTrip: any) => {
    try {
      const res = await authenticatedFetch(`${apiServerUrl}/api/trips`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: updatedTrip.id,
          title: updatedTrip.title,
          startAddress: updatedTrip.startAddress,
          endAddress: updatedTrip.endAddress,
          startDate: updatedTrip.startDate,
          startTime: updatedTrip.startTime,
          startTimeIso: updatedTrip.startTimeIso,
          status: updatedTrip.status,
          selectedLunchOption: updatedTrip.selectedLunchOption || "salad",
          notes: updatedTrip.notes || "",
          prospects: updatedTrip.prospects.map((p: any) => ({
            name: p.name,
            address: p.address,
            duration_minutes: p.duration_minutes,
            notes: p.notes
          }))
        })
      });
      if (res.ok) {
        console.log("Trip successfully synced to backend database.");
      } else {
        console.error("Failed to sync trip to backend:", await res.text());
      }
    } catch (err) {
      console.error("Network error syncing trip to backend:", err);
    }
  };

  const handleCheckOutNotesSync = (stopId: string) => {
    if (!activeTrip) return;

    const recState = recordingStates[stopId] || { seconds: 0 };
    const transcriptText = transcripts[stopId] || "No transcript generated.";
    const duration = recState.seconds || 5;
    
    const stopObj = (activeTrip.prospects || []).find((p: any) => p.id === stopId);
    const stopName = stopObj ? stopObj.name : "Client Stop";
    const dateStr = new Date().toISOString().split('T')[0];
    const voiceFileName = `voice-${stopName}-${dateStr}.mp3`;
    const transcriptFileName = `transcript-${stopName}-${dateStr}.txt`;

    const voiceNoteLog = `🎙️ Voice File: ${voiceFileName} (${duration}s)\n` +
                         `📝 Transcript File: ${transcriptFileName}\n` +
                         `📝 AI Transcript:\n${transcriptText}`;

    const updatedProspects = (activeTrip.prospects || []).map((p: any) => {
      if (p.id === stopId) {
        const baseNotes = p.notes ? p.notes.split("🎙️")[0].trim() : "";
        const cleanNotes = baseNotes ? `${baseNotes}\n\n${voiceNoteLog}` : voiceNoteLog;
        return { ...p, notes: cleanNotes };
      }
      return p;
    });

    const updatedTrip = { ...activeTrip, prospects: updatedProspects };
    setActiveTrip(updatedTrip);
    syncTripUpdateToBackend(updatedTrip);
  };

  const handleDistanceChange = (stopId: string, newDistance: number) => {
    setSimulatedDistances(prev => ({ ...prev, [stopId]: newDistance }));

    if (!isAutoCheckEnabled) return;

    const currentStatus = checkInStates[stopId] || { status: 'idle' };

    // Auto Check-in: < 50 yards
    if (newDistance < 50 && currentStatus.status === 'idle') {
      setRecordingStates(prev => {
        const copy = { ...prev };
        delete copy[stopId];
        return copy;
      });
      setTranscripts(prev => {
        const copy = { ...prev };
        delete copy[stopId];
        return copy;
      });

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCheckInStates(prev => {
        const copy = { ...prev };
        Object.keys(copy).forEach(id => {
          if (copy[id]?.status === 'checked_in' && id !== stopId) {
            copy[id] = {
              ...copy[id],
              status: 'checked_out',
              checkOutTime: nowStr,
              checkOutMethod: 'auto'
            };
            setTimeout(() => handleCheckOutNotesSync(id), 0);
          }
        });
        copy[stopId] = {
          status: 'checked_in',
          checkInTime: nowStr,
          checkInMethod: 'auto'
        };
        return copy;
      });
      Alert.alert(
        "Auto Check-in",
        `System auto-detected you are at ${newDistance} yards (< 50 yards) to the stop. Successfully checked in!`
      );
    }

    // Auto Check-out: >= 50 yards (after being checked in)
    if (newDistance >= 50 && currentStatus.status === 'checked_in') {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCheckInStates(prev => ({
        ...prev,
        [stopId]: {
          ...prev[stopId],
          status: 'checked_out',
          checkOutTime: nowStr,
          checkOutMethod: 'auto'
        }
      }));
      handleCheckOutNotesSync(stopId);
      Alert.alert(
        "Auto Check-out",
        `System auto-detected you left the stop (distance: ${newDistance} yards >= 50 yards). Successfully checked out!`
      );
    }
  };

  const handleManualCheckIn = (stopId: string) => {
    setRecordingStates(prev => {
      const copy = { ...prev };
      delete copy[stopId];
      return copy;
    });
    setTranscripts(prev => {
      const copy = { ...prev };
      delete copy[stopId];
      return copy;
    });

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCheckInStates(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(id => {
        if (copy[id]?.status === 'checked_in' && id !== stopId) {
          copy[id] = {
            ...copy[id],
            status: 'checked_out',
            checkOutTime: nowStr,
            checkOutMethod: 'auto'
          };
          setTimeout(() => handleCheckOutNotesSync(id), 0);
        }
      });
      copy[stopId] = {
        status: 'checked_in',
        checkInTime: nowStr,
        checkInMethod: 'manual'
      };
      return copy;
    });
  };

  const handleManualCheckOut = (stopId: string) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCheckInStates(prev => ({
      ...prev,
      [stopId]: {
        ...prev[stopId],
        status: 'checked_out',
        checkOutTime: nowStr,
        checkOutMethod: 'manual'
      }
    }));
    handleCheckOutNotesSync(stopId);
  };

  const handleMobileLogin = async () => {
    if (!tempUsername || !tempPassword) {
      Alert.alert("Input Error", "Please enter both username and password.");
      return;
    }

    let targetServerUrl = tempServerUrl.trim();
    if (!targetServerUrl.startsWith("http://") && !targetServerUrl.startsWith("https://")) {
      Alert.alert("Input Error", "Server URL must start with http:// or https://");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      console.log(`[Mobile Auth] Authenticating at: ${targetServerUrl}/api/admin/auth`);
      const res = await fetch(`${targetServerUrl}/api/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: tempUsername, password: tempPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      await AsyncStorage.setItem('fieldroute_user_token', data.token);
      await AsyncStorage.setItem('fieldroute_server_url', targetServerUrl);
      await AsyncStorage.setItem('fieldroute_user_name', data.username);

      setApiServerUrl(targetServerUrl);
      setAuthToken(data.token);
      setAuthUserName(data.username);
      setUserName(data.username);
      setIsAuthenticated(true);
      
      // Update local storage settings as well
      const storedSettings = await AsyncStorage.getItem('fieldroute_user_settings');
      let currentSettings = { name: data.username, apiServerUrl: targetServerUrl };
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);
          currentSettings = { ...parsed, ...currentSettings };
        } catch {}
      }
      await AsyncStorage.setItem('fieldroute_user_settings', JSON.stringify(currentSettings));

      Alert.alert("Success", `Logged in successfully as "${data.username}".`);
    } catch (err: any) {
      console.error(err);
      setLoginError(err?.message || "Connection failed.");
      Alert.alert("Authentication Failed", err?.message || "Verify your credentials and Server URL.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleMobileSignOut = async () => {
    Alert.alert(
      "Confirm Sign Out",
      "Are you sure you want to log out of the routing assistant?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem('fieldroute_user_token');
            await AsyncStorage.removeItem('fieldroute_user_name');
            setAuthToken(null);
            setAuthUserName("");
            setIsAuthenticated(false);
          }
        }
      ]
    );
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate with FaceID / Biometrics',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const storedToken = await AsyncStorage.getItem('fieldroute_user_token');
        const storedServerUrl = await AsyncStorage.getItem('fieldroute_server_url');
        const storedUserName = await AsyncStorage.getItem('fieldroute_user_name');

        if (storedToken && storedServerUrl) {
          setApiServerUrl(storedServerUrl);
          setAuthToken(storedToken);
          setAuthUserName(storedUserName || "User");
          setUserName(storedUserName || "User");
          setIsAuthenticated(true);
          Alert.alert("Success", "Authenticated via biometrics!");
        } else {
          Alert.alert("Error", "No saved credentials found. Please sign in manually once first.");
        }
      }
    } catch (err: any) {
      console.error("Biometrics error:", err);
      Alert.alert("Biometrics Error", err?.message || "Failed to authenticate.");
    }
  };

  const handleEndOfTrip = async () => {
    if (!activeTrip) return;

    if (activeTrip.status === 'completed') {
      if (activeTrip.notes && activeTrip.notes.includes("Daily Outbound Sales Field Report")) {
        setSalesReportMarkdown(activeTrip.notes);
        return;
      }

      setIsGeneratingReport(true);
      try {
        const reportRes = await authenticatedFetch(`${apiServerUrl}/api/sales-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId: activeTrip.id, email: reportEmail })
        });
        if (!reportRes.ok) throw new Error("Failed to generate report.");
        const reportData = await reportRes.json();
        setSalesReportMarkdown(reportData.markdown);
        const updatedTrip = { ...activeTrip, notes: reportData.markdown };
        setActiveTrip(updatedTrip);
        
        // Save to AsyncStorage
        const updatedList = savedTrips.map(t => t.id === activeTrip.id ? updatedTrip : t);
        setSavedTrips(updatedList);
        await AsyncStorage.setItem('fieldroute_saved_trips', JSON.stringify(updatedList));
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Failed to load sales report.");
      } finally {
        setIsGeneratingReport(false);
      }
      return;
    }

    const updatedTrip = { ...activeTrip, status: 'completed' };
    setActiveTrip(updatedTrip);
    
    // Save updated status to local list immediately
    const intermediateList = savedTrips.map(t => t.id === activeTrip.id ? updatedTrip : t);
    setSavedTrips(intermediateList);
    await AsyncStorage.setItem('fieldroute_saved_trips', JSON.stringify(intermediateList));
    
    await syncTripUpdateToBackend(updatedTrip);
    
    setIsGeneratingReport(true);
    try {
      const reportRes = await authenticatedFetch(`${apiServerUrl}/api/sales-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: activeTrip.id, email: reportEmail })
      });
      if (!reportRes.ok) throw new Error("Failed to generate report.");
      const reportData = await reportRes.json();
      setSalesReportMarkdown(reportData.markdown);
      const finalTrip = { ...activeTrip, notes: reportData.markdown, status: 'completed' };
      setActiveTrip(finalTrip);
      
      // Save final notes/report to AsyncStorage
      const finalList = savedTrips.map(t => t.id === activeTrip.id ? finalTrip : t);
      setSavedTrips(finalList);
      await AsyncStorage.setItem('fieldroute_saved_trips', JSON.stringify(finalList));
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to generate sales report.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleEmailReportMobile = async () => {
    if (!salesReportMarkdown) return;
    
    let targetEmail = reportEmail;
    if (!targetEmail) {
      Alert.alert(
        "Email Config",
        "Please enter an email address to send this report to:",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "OK",
            onPress: () => {
              Alert.alert("Configure Settings", "Please set your report email in settings⚙️ first!");
            }
          }
        ]
      );
      return;
    }
    
    setIsGeneratingReport(true);
    try {
      const res = await authenticatedFetch(`${apiServerUrl}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, report: salesReportMarkdown })
      });
      if (res.ok) {
        Alert.alert("Email Sent", `Report successfully emailed to ${targetEmail}!`);
      } else {
        throw new Error("Failed to send.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to send email. Please try again.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleResetCheckIn = (stopId: string) => {
    setCheckInStates(prev => {
      const copy = { ...prev };
      delete copy[stopId];
      return copy;
    });
    setRecordingStates(prev => {
      const copy = { ...prev };
      delete copy[stopId];
      return copy;
    });
    setTranscripts(prev => {
      const copy = { ...prev };
      delete copy[stopId];
      return copy;
    });
    setSimulatedDistances(prev => ({ ...prev, [stopId]: 120 }));
  };

  // Transcripts state mapping stopId to the AI generated transcript
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const [selectedTranscript, setSelectedTranscript] = useState<{ stopName: string; text: string } | null>(null);
  const [salesReportMarkdown, setSalesReportMarkdown] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const generateMockTranscript = (stopName: string) => {
    return `[AI MEETING TRANSCRIPT]\n` +
           `Location Stop: ${stopName}\n` +
           `Date: 2026-06-27\n\n` +
           `REP (SFI Sales): "Thanks for meeting with me today. I wanted to review your outbound logistics lanes."\n` +
           `CLIENT (Representative): "Yes, we dispatch about 10 truckloads a week to the East Coast. Lead times have been inconsistent lately."\n` +
           `REP: "SFI offers dedicated dispatcher scheduling with integrated GPS tracking to eliminate shipping delays."\n` +
           `CLIENT: "That sounds solid. Let's schedule a pilot shipment next Tuesday. Send over the rates and service contract."`;
  };

  const parseVoiceNoteAndTranscript = (notesText: string | null) => {
    if (!notesText) return null;
    
    const micMatch = notesText.match(/🎙️ (?:Voice File|Voice Note):\s*(.*?)\s*\((\d+)s\)/i);
    const transcriptIdx = notesText.indexOf("📝 AI Transcript:");
    
    if (!micMatch && transcriptIdx === -1) return null;
    
    const audioName = micMatch ? micMatch[1] : null;
    const duration = micMatch ? parseInt(micMatch[2], 10) : 5;
    
    let transcriptText = "";
    if (transcriptIdx !== -1) {
      transcriptText = notesText.substring(transcriptIdx + "📝 AI Transcript:".length).trim();
    }
    
    const baseNotesIdx = notesText.indexOf("🎙️");
    const baseNotes = baseNotesIdx !== -1 ? notesText.substring(0, baseNotesIdx).trim() : notesText.trim();
    
    return {
      audioName,
      duration,
      transcriptText,
      baseNotes
    };
  };

  // Voice recording states for checked-in stops
  const [recordingStates, setRecordingStates] = useState<Record<string, {
    isRecording: boolean;
    seconds: number;
    audioUri?: string;
    isPlaying?: boolean;
    playSeconds?: number;
  }>>({});

  // Active recording timer effect
  useEffect(() => {
    const activeRecordings = Object.keys(recordingStates).filter(id => recordingStates[id]?.isRecording);
    if (activeRecordings.length === 0) return;

    const interval = setInterval(() => {
      setRecordingStates(prev => {
        const copy = { ...prev };
        activeRecordings.forEach(id => {
          if (copy[id]) {
            copy[id] = {
              ...copy[id],
              seconds: (copy[id].seconds || 0) + 1
            };
          }
        });
        return copy;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [recordingStates]);

  // Playback timer effect
  useEffect(() => {
    const activePlaybacks = Object.keys(recordingStates).filter(id => recordingStates[id]?.isPlaying);
    if (activePlaybacks.length === 0) return;

    const interval = setInterval(() => {
      setRecordingStates(prev => {
        const copy = { ...prev };
        activePlaybacks.forEach(id => {
          if (copy[id]) {
            const nextPlaySec = (copy[id].playSeconds || 0) + 1;
            if (nextPlaySec >= (copy[id].seconds || 1)) {
              copy[id] = {
                ...copy[id],
                isPlaying: false,
                playSeconds: 0
              };
            } else {
              copy[id] = {
                ...copy[id],
                playSeconds: nextPlaySec
              };
            }
          }
        });
        return copy;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [recordingStates]);

  const handleToggleRecording = (stopId: string) => {
    setRecordingStates(prev => {
      const current = prev[stopId] || { isRecording: false, seconds: 0 };
      if (!current.isRecording) {
        return {
          ...prev,
          [stopId]: {
            ...current,
            isRecording: true,
            seconds: 0,
            isPlaying: false
          }
        };
      } else {
        const duration = current.seconds > 0 ? current.seconds : 5;

        // Auto-generate mock AI transcription for this stop
        const stopObj = (activeTrip?.prospects || []).find((p: any) => p.id === stopId);
        const stopName = stopObj ? stopObj.name : "Client Stop";
        const newTranscript = generateMockTranscript(stopName);
        setTranscripts(prevTrans => ({ ...prevTrans, [stopId]: newTranscript }));

        const dateStr = new Date().toISOString().split('T')[0];
        const voiceFileName = `voice-${stopName}-${dateStr}.mp3`;

        return {
          ...prev,
          [stopId]: {
            ...current,
            isRecording: false,
            audioUri: voiceFileName,
            seconds: duration
          }
        };
      }
    });
  };

  const handleTogglePlayback = (stopId: string) => {
    setRecordingStates(prev => {
      const current = prev[stopId];
      if (!current || !current.audioUri) return prev;
      return {
        ...prev,
        [stopId]: {
          ...current,
          isPlaying: !current.isPlaying,
          playSeconds: 0
        }
      };
    });
  };

  const handleLoadClosestTrip = () => {
    if (savedTrips.length === 0) {
      Alert.alert("No Saved Trips", "You do not have any saved trips to load.");
      return;
    }

    const today = new Date();
    let closestTrip = savedTrips[0];
    let minDiff = Infinity;

    savedTrips.forEach(trip => {
      const tripDate = new Date(trip.startDate);
      if (!isNaN(tripDate.getTime())) {
        const diff = Math.abs(tripDate.getTime() - today.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestTrip = trip;
        }
      }
    });

    if (closestTrip) {
      setActiveTrip(closestTrip);
      setScreen('trip');
    }
  };
  
  // Form states for creating a new trip
  const [newTripStart, setNewTripStart] = useState("");
  const [newTripEnd, setNewTripEnd] = useState("");
  const [newTripStops, setNewTripStops] = useState<any[]>([{ id: "1", name: "", address: "", duration: "30", notes: "" }]);

  // Resolve Dark Mode
  const isDark = activeTheme === 'system' ? systemScheme === 'dark' : activeTheme === 'dark';
  
  // Dynamic color definitions matching tailwind HSL tailored variables
  const colors = {
    bg: isDark ? '#020617' : '#f8fafc',
    card: isDark ? '#0f172a' : '#ffffff',
    text: isDark ? '#f8fafc' : '#0f172a',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    primary: '#4f46e5',
    primaryLight: 'rgba(79, 70, 229, 0.1)',
    border: isDark ? '#1e293b' : '#e2e8f0',
    emerald: '#10b981',
    emeraldLight: 'rgba(16, 185, 129, 0.1)',
    red: '#ef4444',
    redLight: 'rgba(239, 68, 68, 0.1)',
    amber: '#d97706',
    amberLight: 'rgba(217, 119, 6, 0.1)',
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch latest weather
      try {
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=37.5485&longitude=-121.9886&current_weather=true");
        if (res.ok) {
          const data = await res.json();
          const curr = data?.current_weather;
          if (curr) {
            setRawTemp(curr.temperature);
            let emoji = "🌤️";
            const code = curr.weathercode;
            if (code === 0) emoji = "☀️";
            else if (code >= 1 && code <= 3) emoji = "🌤️";
            else if (code === 45 || code === 48) emoji = "🌫️";
            else if (code >= 51 && code <= 67) emoji = "🌧️";
            else if (code >= 71 && code <= 77) emoji = "❄️";
            else if (code >= 80 && code <= 82) emoji = "🌦️";
            else if (code >= 95) emoji = "⛈️";
            setWeatherIcon(emoji);
          }
        }
      } catch (weatherErr) {
        console.warn("Could not sync weather:", weatherErr);
      }

      // 2. Fetch trips from Supabase
      try {
        const res = await authenticatedFetch(`${apiServerUrl}/api/trips`);
        if (res.ok) {
          const data = await res.json();
          if (data?.trips) {
            const sanitized = sanitizeTrips(data.trips);
            await AsyncStorage.setItem('fieldroute_saved_trips', JSON.stringify(sanitized));
            setSavedTrips(sanitized);
            Alert.alert("Synced", "Saved trips successfully synced with browser database.");
          } else {
            throw new Error("No trips data in response");
          }
        } else {
          throw new Error(`Server returned status ${res.status}`);
        }
      } catch (fetchErr) {
        console.warn("Could not sync trips from backend, keeping current data:", fetchErr);
        Alert.alert("Sync Offline", "Could not connect to database server. Loaded cached local copy instead.");
      }

      // 3. Fetch consultant reports from Supabase
      try {
        const res = await authenticatedFetch(`${apiServerUrl}/api/bd-consultant/reports`);
        if (res.ok) {
          const data = await res.json();
          if (data?.reports) {
            await AsyncStorage.setItem('fieldroute_saved_reports', JSON.stringify(data.reports));
            setSavedReports(data.reports);
          }
        }
      } catch (reportsErr) {
        console.warn("Could not sync consultant reports from backend on refresh:", reportsErr);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Load configurations and mock data on mount
  useEffect(() => {
async function loadData() {
      let serverUrl = apiServerUrl;
      try {
        const storedToken = await AsyncStorage.getItem('fieldroute_user_token');
        const storedServerUrl = await AsyncStorage.getItem('fieldroute_server_url');
        const storedUserName = await AsyncStorage.getItem('fieldroute_user_name');

        // Check biometrics compatibility
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setHasBiometricHardware(hasHardware);
        setIsBiometricEnrolled(isEnrolled);
        setHasSavedCredentials(!!storedToken);

        if (storedServerUrl) {
          setApiServerUrl(storedServerUrl);
          setTempServerUrl(storedServerUrl);
          serverUrl = storedServerUrl;
        }

        if (storedToken) {
          setAuthToken(storedToken);
          setIsAuthenticated(true);
          if (storedUserName) {
            setAuthUserName(storedUserName);
            setUserName(storedUserName);
          }
        }

        const storedSettings = await AsyncStorage.getItem('fieldroute_user_settings');
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          if (parsed.name) setUserName(parsed.name);
          if (parsed.prepBuffer) setPrepBuffer(parsed.prepBuffer.toString());
          if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
          if (parsed.theme) setActiveTheme(parsed.theme);
          if (parsed.isVoiceRecordingEnabled !== undefined) {
            setIsVoiceRecordingEnabled(parsed.isVoiceRecordingEnabled);
          }
          if (parsed.reportEmail !== undefined) {
            setReportEmail(parsed.reportEmail);
          }
          if (parsed.apiServerUrl) {
            // Auto-correct localhost in cached settings to the active MacBook IP
            if (parsed.apiServerUrl.includes('localhost')) {
              const correctedUrl = "http://192.168.68.116:3000";
              setApiServerUrl(correctedUrl);
              serverUrl = correctedUrl;
              const updatedSettings = { ...parsed, apiServerUrl: correctedUrl };
              await AsyncStorage.setItem('fieldroute_user_settings', JSON.stringify(updatedSettings));
            } else {
              setApiServerUrl(parsed.apiServerUrl);
              serverUrl = parsed.apiServerUrl;
            }
          }
        }
        
        // Try syncing consultant reports from backend first
        let reportsLoaded = false;
        try {
          const res = await authenticatedFetch(`${serverUrl}/api/bd-consultant/reports`);
          if (res.ok) {
            const data = await res.json();
            if (data?.reports) {
              await AsyncStorage.setItem('fieldroute_saved_reports', JSON.stringify(data.reports));
              setSavedReports(data.reports);
              reportsLoaded = true;
            }
          }
        } catch (fetchErr) {
          console.warn("Could not sync reports from backend, loading local cache:", fetchErr);
        }

        if (!reportsLoaded) {
          const storedReports = await AsyncStorage.getItem('fieldroute_saved_reports');
          if (storedReports) {
            setSavedReports(JSON.parse(storedReports));
          }
        }

        // Try syncing trips from backend Supabase first
        try {
          const res = await authenticatedFetch(`${serverUrl}/api/trips`);
          if (res.ok) {
            const data = await res.json();
            if (data?.trips) {
              const sanitized = sanitizeTrips(data.trips);
              await AsyncStorage.setItem('fieldroute_saved_trips', JSON.stringify(sanitized));
              setSavedTrips(sanitized);
              return;
            }
          }
        } catch (fetchErr) {
          console.warn("Could not sync trips from backend, loading local cache:", fetchErr);
        }

        // Fallback to local storage if API is unreachable or fails
        const storedTrips = await AsyncStorage.getItem('fieldroute_saved_trips');
        if (storedTrips) {
          const parsed = sanitizeTrips(JSON.parse(storedTrips));
          setSavedTrips(parsed);
        } else {
          // Initialize mock trip if nothing is saved
          const cleanMock = sanitizeTrips(INITIAL_MOCK_TRIPS);
          await AsyncStorage.setItem('fieldroute_saved_trips', JSON.stringify(cleanMock));
          setSavedTrips(cleanMock);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setAuthLoading(false);
      }
    }
    async function fetchWeather() {
      try {
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=37.5485&longitude=-121.9886&current_weather=true");
        if (res.ok) {
          const data = await res.json();
          const curr = data?.current_weather;
          if (curr) {
            const tempCelsius = curr.temperature;
            const code = curr.weathercode;
            
            let emoji = "🌤️";
            if (code === 0) emoji = "☀️";
            else if (code >= 1 && code <= 3) emoji = "🌤️";
            else if (code === 45 || code === 48) emoji = "🌫️";
            else if (code >= 51 && code <= 67) emoji = "🌧️";
            else if (code >= 71 && code <= 77) emoji = "❄️";
            else if (code >= 80 && code <= 82) emoji = "🌦️";
            else if (code >= 85 && code <= 99) emoji = "⛈️";
            
            setWeatherIcon(emoji);
            setRawTemp(tempCelsius);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch weather data:", err);
      }
    }
    loadData().then(async () => {
      const savedToken = await AsyncStorage.getItem('fieldroute_user_token');
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (savedToken && hasHardware && isEnrolled) {
        setTimeout(() => {
          handleBiometricAuth();
        }, 600);
      }
    });
    selectRandomQuote();
    fetchWeather();
  }, []);

  // Update dynamic time-of-day greeting when user name changes
  useEffect(() => {
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 18) {
      timeGreeting = "Good afternoon";
    } else if (hour >= 18) {
      timeGreeting = "Good evening";
    }
    const firstName = userName.split(" ")[0] || userName;
    setGreeting(`${timeGreeting}, ${firstName}!`);
  }, [userName]);

  const selectRandomQuote = () => {
    const idx = Math.floor(Math.random() * SALES_QUOTES.length);
    setQuote(SALES_QUOTES[idx] || SALES_QUOTES[0]);
  };

  const syncTripToBackend = async (trip: any) => {
    try {
      await authenticatedFetch(`${apiServerUrl}/api/trips`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: trip.id,
          title: trip.title,
          startAddress: trip.startAddress,
          endAddress: trip.endAddress,
          startDate: trip.startDate,
          startTime: trip.startTime,
          startTimeIso: trip.startTimeIso,
          status: trip.status,
          selectedLunchOption: trip.selectedLunchOption || "salad",
          notes: trip.notes || "",
          prospects: trip.prospects.map((p: any) => ({
            name: p.name,
            address: p.address,
            duration_minutes: p.duration_minutes,
            notes: p.notes
          }))
        })
      });
    } catch (e) {
      console.warn("Could not sync trip update to backend:", e);
    }
  };

  // Save Settings wrapper
  const handleSaveSettings = async () => {
    try {
      const payload = {
        name: userName,
        prepBuffer: parseInt(prepBuffer, 10) || 3,
        unitSystem,
        theme: activeTheme,
        apiServerUrl,
        isVoiceRecordingEnabled,
        reportEmail
      };
      await AsyncStorage.setItem('fieldroute_user_settings', JSON.stringify(payload));
      setIsSettingsVisible(false);
      Alert.alert("Success", "Settings saved successfully.");
    } catch (e) {
      Alert.alert("Error", "Failed to save settings.");
    }
  };

  // SFI BD Consultant report generation
  const handleGenerateReport = async () => {
    if (!companyInput.trim()) return;
    setIsGenerating(true);
    setErrorMessage("");

    const trimmedInput = companyInput.trim();
    let parsedName = "";
    let parsedWebsite = "";

    const isUrl = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i.test(trimmedInput) || trimmedInput.includes(".");
    if (isUrl) {
      parsedWebsite = trimmedInput;
      const domain = trimmedInput.replace(/^(https?:\/\/)?(www\.)?/i, "").split("/")[0].split(".")[0];
      parsedName = domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : trimmedInput;
    } else {
      parsedName = trimmedInput;
    }

    try {
      const res = await authenticatedFetch(`${apiServerUrl}/api/bd-consultant/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: parsedName,
          companyWebsite: parsedWebsite,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || "Failed to generate report.");
      }

      const data = await res.json();
      const reportText = data?.markdown || "";
      const newReport = {
        id: Date.now().toString(),
        companyName: parsedName,
        companyWebsite: parsedWebsite,
        markdown: reportText,
        name: `${parsedName} Report`
      };

      setActiveReport(newReport);
      setActiveReportTab(1);
      setReportSavedState(false);
      setScreen('bd-consultant');
      setCompanyInput("");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || "An unexpected error occurred during generation.");
      Alert.alert("Generation Failed", err?.message || "Please check your server API URL configuration in Settings.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadSavedConsultantReport = () => {
    if (savedReports.length === 0) {
      Alert.alert("No Saved Reports", "You don't have any saved consultant reports yet.");
      return;
    }
    
    const options: any[] = savedReports.map(report => ({
      text: report.name || "Unnamed Report",
      onPress: () => {
        setActiveReport(report);
        setActiveReportTab(1);
        setReportSavedState(true);
        setScreen('bd-consultant');
      }
    }));
    
    options.push({
      text: "Cancel",
      style: "cancel" as any,
      onPress: () => {}
    });
    
    Alert.alert(
      "Load Saved Report",
      "Select a saved consultant report to load:",
      options.slice(0, 12)
    );
  };

  // Save Consultant Report to backend database (and locally as fallback)
  const handleSaveReport = async () => {
    if (!activeReport) return;
    try {
      const res = await authenticatedFetch(`${apiServerUrl}/api/bd-consultant/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeReport.id && isNaN(Number(activeReport.id)) ? activeReport.id : undefined, // only pass real UUIDs, not mock Date timestamps
          name: activeReport.name,
          companyName: activeReport.companyName,
          companyWebsite: activeReport.companyWebsite,
          markdown: activeReport.markdown
        })
      });
      if (!res.ok) {
        throw new Error("Failed to save report on server");
      }
      
      const data = await res.json();
      const savedReportId = data.id || activeReport.id;
      const savedReport = { ...activeReport, id: savedReportId };

      const updated = savedReports.filter(r => r.id !== activeReport.id && r.id !== savedReportId);
      const toSave = [...updated, savedReport];
      await AsyncStorage.setItem('fieldroute_saved_reports', JSON.stringify(toSave));
      setSavedReports(toSave);
      setActiveReport(savedReport);
      setReportSavedState(true);
      Alert.alert("Report Saved", `Saved "${activeReport.name}" successfully!`);
    } catch (e) {
      console.warn("Failed to sync report to server, saving locally:", e);
      const updated = savedReports.filter(r => r.id !== activeReport.id);
      const toSave = [...updated, activeReport];
      await AsyncStorage.setItem('fieldroute_saved_reports', JSON.stringify(toSave));
      setSavedReports(toSave);
      setReportSavedState(true);
      Alert.alert("Report Saved Locally", `Saved "${activeReport.name}" locally (unable to sync to database).`);
    }
  };

  // Delete saved report with confirmation check
  const handleDeleteReport = (id: string, name: string) => {
    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to delete the saved report "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete from server first (if possible)
              try {
                await authenticatedFetch(`${apiServerUrl}/api/bd-consultant/reports?id=${id}`, {
                  method: 'DELETE'
                });
              } catch (serverErr) {
                console.warn("Failed to delete report from server, deleting locally:", serverErr);
              }

              const updated = savedReports.filter(r => r.id !== id);
              await AsyncStorage.setItem('fieldroute_saved_reports', JSON.stringify(updated));
              setSavedReports(updated);
            } catch (e) {
              Alert.alert("Error", "Failed to delete report.");
            }
          }
        }
      ]
    );
  };

  // Delete saved trip with confirmation check
  const handleDeleteTrip = (id: string, title: string) => {
    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to delete the trip "${title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete from backend API
              try {
                await authenticatedFetch(`${apiServerUrl}/api/trips?id=${id}`, {
                  method: "DELETE"
                });
              } catch (deleteErr) {
                console.warn("Could not delete trip from backend:", deleteErr);
              }

              const updated = savedTrips.filter(t => t.id !== id);
              await AsyncStorage.setItem('fieldroute_saved_trips', JSON.stringify(updated));
              setSavedTrips(updated);
            } catch (e) {
              Alert.alert("Error", "Failed to delete trip.");
            }
          }
        }
      ]
    );
  };

  // Create a new trip
  const handleAddStopField = () => {
    setNewTripStops([...newTripStops, { id: Date.now().toString(), name: "", address: "", duration: "30", notes: "" }]);
  };

  const handleRemoveStopField = (id: string) => {
    if (newTripStops.length > 1) {
      setNewTripStops(newTripStops.filter(s => s.id !== id));
    }
  };

  const handleUpdateStopField = (id: string, key: string, value: string) => {
    const updated = newTripStops.map(s => {
      if (s.id === id) {
        return { ...s, [key]: value };
      }
      return s;
    });
    setNewTripStops(updated);
  };

  const handleSaveNewTrip = async () => {
    if (!newTripStart.trim() || !newTripEnd.trim()) {
      Alert.alert("Validation Error", "Start and End locations are required.");
      return;
    }

    const invalidStops = newTripStops.some(s => !s.address.trim());
    if (invalidStops) {
      Alert.alert("Validation Error", "Please provide a valid address for all stops (minimum 5 characters).");
      return;
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const title = `Trip on ${currentDate}`;
    
    // Clean and decode any percent-encoded symbols in user inputs on submit
    const startClean = decodeURIComponent(newTripStart.trim());
    const endClean = decodeURIComponent(newTripEnd.trim());
    
    const formattedStops = newTripStops.map((s, idx) => ({
      id: s.id,
      name: s.name.trim() || `Stop ${idx + 1}`,
      address: decodeURIComponent(s.address.trim()),
      duration_minutes: parseInt(s.duration, 10) || 30,
      notes: s.notes.trim() || null,
      position: idx
    }));

    const inputStops = formattedStops.map(p => ({
      id: p.id,
      name: p.name,
      address: p.address,
      duration_minutes: p.duration_minutes,
      notes: p.notes,
      position: p.position
    }));

    let optimizedStops = [];
    try {
      optimizedStops = optimizeStopSequence(startClean, endClean, inputStops, "closest");
    } catch (e) {
      console.warn("Failed to optimize sequence on mobile:", e);
      optimizedStops = [...formattedStops];
    }

    const optimizedProspects = optimizedStops.map((stop, idx) => {
      const original = formattedStops.find(p => p.id === stop.id);
      return {
        ...original,
        position: idx
      };
    });

    const newTripDateStr = new Date().toISOString().split('T')[0];
    const newTripTimeStr = "09:00";
    const isoDateTime = new Date(`${newTripDateStr}T${newTripTimeStr}:00`);
    const startTimeIso = !isNaN(isoDateTime.getTime()) ? isoDateTime.toISOString() : new Date().toISOString();

    const newTrip = {
      id: Date.now().toString(),
      title,
      startAddress: startClean,
      endAddress: endClean,
      startDate: newTripDateStr,
      startTime: newTripTimeStr,
      startTimeIso: startTimeIso,
      status: "optimized:skip",
      firstStopStrategy: "closest",
      prepBufferMinutes: parseInt(prepBuffer, 10) || 3,
      selectedLunchOption: "skip",
      prospects: optimizedProspects
    };

    try {
      // POST to backend API to write to Supabase
      try {
        const res = await authenticatedFetch(`${apiServerUrl}/api/trips`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: newTrip.title,
            startAddress: newTrip.startAddress,
            endAddress: newTrip.endAddress,
            startDate: newTrip.startDate,
            startTime: newTrip.startTime,
            startTimeIso: newTrip.startTimeIso,
            status: newTrip.status,
            selectedLunchOption: newTrip.selectedLunchOption,
            notes: "",
            prospects: newTrip.prospects.map(p => ({
              name: p.name,
              address: p.address,
              duration_minutes: p.duration_minutes,
              notes: p.notes
            }))
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.id) {
            newTrip.id = data.id;
          }
        }
      } catch (postErr) {
        console.warn("Could not save new trip to backend, saving locally:", postErr);
      }

      const updated = [newTrip, ...savedTrips];
      await AsyncStorage.setItem('fieldroute_saved_trips', JSON.stringify(updated));
      setSavedTrips(updated);
      setIsNewTripVisible(false);
      
      // Reset form
      setNewTripStart("");
      setNewTripEnd("");
      setNewTripStops([{ id: "1", name: "", address: "", duration: "30", notes: "" }]);

      Alert.alert("Success", "New Outbound Trip created successfully.");
    } catch (e) {
      Alert.alert("Error", "Failed to create trip.");
    }
  };

  const optimizeAndSyncRoute = async (tripToOptimize: any, strategy: "closest" | "furthest") => {
    if (!tripToOptimize) return;
    
    const prospectsList = tripToOptimize.prospects || [];
    const inputStops = prospectsList.map((p: any) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      duration_minutes: p.duration_minutes || p.duration || 30,
      notes: p.notes,
      position: p.position
    }));

    const optimizedStops = optimizeStopSequence(tripToOptimize.startAddress, tripToOptimize.endAddress, inputStops, strategy);

    const updatedProspects = optimizedStops.map((stop, idx) => {
      const original = prospectsList.find((p: any) => p.id === stop.id);
      return {
        ...original,
        position: idx
      };
    });

    const updatedTrip = {
      ...tripToOptimize,
      status: "optimized",
      firstStopStrategy: strategy,
      prospects: updatedProspects
    };

    setActiveTrip(updatedTrip);
    
    const updatedList = savedTrips.map(t => t.id === tripToOptimize.id ? updatedTrip : t);
    setSavedTrips(updatedList);
    await AsyncStorage.setItem('fieldroute_saved_trips', JSON.stringify(updatedList));

    await syncTripToBackend(updatedTrip);
  };

  // Launch directions via native Maps
  const handleLaunchMaps = (start: string, end: string, stops: any[]) => {
    const startEncoded = encodeURIComponent(start);
    
    // Filter stops to exclude start and end addresses
    const filteredStops = (stops || [])
      .filter(s => s.address && s.address !== start && s.address !== end)
      .map(s => s.address);
      
    // Join intermediate stops and destination with +to:
    const daddrPart = [...filteredStops, end].map(encodeURIComponent).join("+to:");
    
    // Construct the legacy maps URL which supports multi-stop waypoints on mobile browsers and apps
    const url = `https://maps.google.com/maps?saddr=${startEncoded}&daddr=${daddrPart}&dirflg=d`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert("Failed", "Unable to open navigation map app.");
    });
  };

  // Split markdown sections into interactive tags
  const parseMarkdownToTabs = (text: string) => {
    if (!text) return [];
    const DEFAULT_LABELS = [
      "Summary", "Requirements", "Services", "Pain Points",
      "Solutions", "Email", "Script", "Questions", "Strategy"
    ];

    const section10Regex = /(?:^|\n)(?:\s*|#+\s*|\*+\s*)\b10\.\s+/i;
    const section10Match = text.match(section10Regex);
    let cleanText = text;
    if (section10Match && typeof section10Match.index === "number") {
      cleanText = text.substring(0, section10Match.index).trim();
    }

    const regex = /(?:^|\n)(?:\s*|#+\s*|\*+\s*)\b([1-9])\.\s*(.*?)(?:\n|$)/gi;
    const matches = [];
    let match;

    regex.lastIndex = 0;
    while ((match = regex.exec(cleanText)) !== null) {
      const headingCleaned = match[2].replace(/[\*#_]/g, "").trim();
      matches.push({
        index: match.index,
        text: match[0],
        sectionNum: parseInt(match[1], 10),
        heading: headingCleaned
      });
    }

    if (matches.length === 0) {
      return [{ label: "Full Report", sectionNumber: 1, content: cleanText }];
    }

    matches.sort((a, b) => a.index - b.index);
    const groupedSections: Record<number, { heading: string; contents: string[] }> = {};

    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
      const contentStart = currentMatch.index + currentMatch.text.length;
      const contentEnd = nextMatch ? nextMatch.index : cleanText.length;

      let content = cleanText.substring(contentStart, contentEnd).trim();
      content = content.replace(/^[\r\n]+/, "").trim();
      const num = currentMatch.sectionNum;
      if (!groupedSections[num]) {
        groupedSections[num] = { heading: currentMatch.heading, contents: [] };
      }
      groupedSections[num].contents.push(content);
    }

    const parsedTabs = [];
    for (const numStr in groupedSections) {
      const num = parseInt(numStr, 10);
      const group = groupedSections[num];
      const mergedContent = group.contents.join("\n\n---\n\n");
      const label = group.heading || (DEFAULT_LABELS[num - 1] || "Section");

      parsedTabs.push({
        label: `${num}. ${label}`,
        sectionNumber: num,
        content: mergedContent
      });
    }

    parsedTabs.sort((a, b) => a.sectionNumber - b.sectionNumber);
    return parsedTabs;
  };

  // Helper to copy outreach email
  const handleCopyEmail = (emailContent: string) => {
    Clipboard.setString(emailContent);
    Alert.alert("Copied", "Outreach email draft copied to clipboard!");
  };

  // Pure React Native Markdown Parser Component
  const RenderMarkdownText = ({ text }: { text: string }) => {
    if (!text) return null;
    const blocks = text.split("\n\n");

    return (
      <View style={styles.markdownWrapper}>
        {blocks.map((block, idx) => {
          const trimmed = block.trim();
          if (!trimmed) return null;

          // Horizontal divider lines
          if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
            return <View key={idx} style={[styles.hr, { borderColor: colors.border }]} />;
          }

          // Headers
          if (trimmed.startsWith("#") || trimmed.startsWith("###") || (trimmed.startsWith("**") && trimmed.endsWith("**") && !trimmed.includes("\n"))) {
            const cleanHeading = trimmed.replace(/[#\*]/g, "").trim();
            return (
              <Text key={idx} style={[styles.mdHeading, { color: colors.text }]}>
                {cleanHeading}
              </Text>
            );
          }

          // Bullet lists
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const items = trimmed.split(/\n[-*]\s+/);
            return (
              <View key={idx} style={styles.mdList}>
                {items.map((item, itemIdx) => {
                  const cleanItem = itemIdx === 0 ? item.replace(/^[-*]\s+/, "") : item;
                  return (
                    <View key={itemIdx} style={styles.mdListItem}>
                      <Text style={[styles.mdBullet, { color: colors.text }]}>• </Text>
                      <Text style={[styles.mdListText, { color: colors.text }]}>{cleanItem}</Text>
                    </View>
                  );
                })}
              </View>
            );
          }

          // Tables
          if (trimmed.startsWith("|") && (trimmed.includes("\n|") || trimmed.includes("\r\n|"))) {
            const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length >= 2) {
              const headerLine = lines[0];
              const dataLines = lines.slice(2);

              const getCells = (line: string) => {
                return line
                  .split("|")
                  .slice(1, -1)
                  .map(c => c.trim().replace(/\*\*/g, ""));
              };

              const headers = getCells(headerLine);

              return (
                <ScrollView key={idx} horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
                  <View style={[styles.tableContainer, { borderColor: colors.border }]}>
                    {/* Header Row */}
                    <View style={[styles.tableRow, styles.tableHeaderRow, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                      {headers.map((h, hIdx) => (
                        <View key={hIdx} style={[styles.tableCellBox, { borderColor: colors.border }]}>
                          <Text style={[styles.tableHeaderText, { color: colors.text }]}>{h}</Text>
                        </View>
                      ))}
                    </View>
                    {/* Data Rows */}
                    {dataLines.map((rowLine, rIdx) => {
                      const cells = getCells(rowLine);
                      return (
                        <View key={rIdx} style={[styles.tableRow, { borderColor: colors.border }]}>
                          {cells.map((cell, cIdx) => (
                            <View key={cIdx} style={[styles.tableCellBox, { borderColor: colors.border }]}>
                              <Text style={[styles.tableCellText, { color: colors.text }]}>{cell}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              );
            }
          }

          // Default text paragraph
          return (
            <Text key={idx} style={[styles.mdParagraph, { color: colors.text }]}>
              {trimmed}
            </Text>
          );
        })}
      </View>
    );
  };

  // Recalculates route timeline and summaries reactively
  const getActiveTripItinerary = () => {
    if (!activeTrip) return null;
    const buffer = parseInt(prepBuffer, 10) || 3;
    
    // Sort prospectsList based on position to preserve database sequence
    const prospectsList = [...(activeTrip.prospects || [])];
    prospectsList.sort((a: any, b: any) => {
      const posA = typeof a.position === 'number' ? a.position : 0;
      const posB = typeof b.position === 'number' ? b.position : 0;
      return posA - posB;
    });

    const inputStops: RouteStopInput[] = prospectsList.map((p: any) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      duration_minutes: p.duration_minutes,
      notes: p.notes,
      position: p.position
    }));

    let dateStr = activeTrip.startDate || new Date().toISOString().split('T')[0];
    let timeStr = activeTrip.startTime || "09:00";
    if (timeStr.length === 5) {
      timeStr = `${timeStr}:00`;
    }

    const skipLunch = activeTrip.selectedLunchOption === "skip";

    const result = calculateTimeline(
      activeTrip.startAddress,
      activeTrip.endAddress,
      `${dateStr}T${timeStr}`,
      inputStops,
      buffer,
      skipLunch,
      activeTrip.selectedLunchOption || "salad"
    );

    return result;
  };

  const itinerary = getActiveTripItinerary();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {authLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: 13 }}>Initializing Session...</Text>
        </View>
      ) : !isAuthenticated ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0f172a' }}>
          <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', backgroundColor: '#1e293b', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}>
            
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#ffffff', letterSpacing: -0.5 }}>SFI Route Agent</Text>
              <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>Enter your server connection and credentials to authenticate</Text>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>API Server URL</Text>
              <TextInput
                style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 }}
                value={tempServerUrl}
                placeholder="https://..."
                placeholderTextColor="#64748b"
                onChangeText={setTempServerUrl}
                autoCapitalize="none"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Username</Text>
              <TextInput
                style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 }}
                value={tempUsername}
                placeholder="e.g. admin"
                placeholderTextColor="#64748b"
                onChangeText={setTempUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Password</Text>
              <TextInput
                style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 }}
                value={tempPassword}
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                onChangeText={setTempPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              onPress={handleMobileLogin}
              disabled={isLoggingIn}
              style={{ backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: isLoggingIn ? 0.6 : 1 }}
            >
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>
                {isLoggingIn ? "Authenticating..." : "Sign In"}
              </Text>
            </TouchableOpacity>

            {hasBiometricHardware && isBiometricEnrolled && hasSavedCredentials ? (
              <TouchableOpacity
                onPress={handleBiometricAuth}
                style={{
                  marginTop: 12,
                  backgroundColor: 'transparent',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#4f46e5'
                }}
              >
                <Text style={{ color: '#818cf8', fontWeight: 'bold', fontSize: 13 }}>
                  👤 Sign in with Face ID
                </Text>
              </TouchableOpacity>
            ) : null}

          </View>
        </ScrollView>
      ) : (
        <>
          {/* TOP HEADER COMPONENT */}
          <View style={[styles.header, { borderColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.logoBox}>
            <View style={styles.weatherBadge}>
              <Text style={styles.weatherEmoji}>{weatherIcon}</Text>
              {rawTemp !== null ? (
                <Text style={[styles.weatherTempText, { color: colors.textMuted }]}>
                  {unitSystem === 'imperial'
                    ? `${Math.round((rawTemp * 9/5) + 32)}°F`
                    : `${Math.round(rawTemp)}°C`}
                </Text>
              ) : null}
              {screen !== 'home' ? (
                <TouchableOpacity
                  onPress={() => setScreen('home')}
                  style={styles.headerBackBtn}
                >
                  <Text style={styles.headerBackBtnText}>← Back</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View>
              <Text style={[styles.headerGreeting, { color: colors.text }]}>{greeting}</Text>
              <Text style={styles.logoText}>AI Sales Assistant</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setIsSettingsVisible(true)} style={styles.settingsButton}>
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>


      </View>

      {/* MAIN SCREEN ROUTER */}
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {screen === 'home' && (
          <View style={styles.sectionContainer}>
            {/* SALES ROUTING WORKSPACE CARD */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderIcon}>🗺️</Text>
                <View>
                  <Text style={styles.cardSubtitle}>SALES ROUTING WORKSPACE</Text>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Plan smarter field routes with a clean workflow</Text>
                </View>
              </View>
              <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                Organize client outbound stops and calculate optimized driving timelines.
              </Text>
              
              <View style={[styles.buttonRow, { flexDirection: 'column', gap: 10 }]}>
                <TouchableOpacity
                  onPress={() => setIsNewTripVisible(true)}
                  style={[styles.actionBtn, { flex: 1, width: '100%' }]}
                >
                  <Text style={styles.actionBtnText}>Create New Trip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLoadClosestTrip}
                  style={[styles.actionBtn, { flex: 1, width: '100%', backgroundColor: colors.emerald, shadowColor: colors.emerald }]}
                >
                  <Text style={styles.actionBtnText}>📂 Load Saved Trip</Text>
                </TouchableOpacity>
              </View>
            </View>



            {/* AI SALES AGENT CARD */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 24 }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderIcon}>💼</Text>
                <View>
                  <Text style={styles.cardSubtitle}>AI SALES AGENT</Text>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>SFI Business Development Consultant</Text>
                </View>
              </View>
              <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
                Input a prospect&apos;s details to generate logistics analyses, cold calling drafts, and qualifying questions.
              </Text>
              
              <View style={styles.inputContainer}>
                <TextInput
                  placeholder="Company Name or Website URL (e.g. Tesla)"
                  placeholderTextColor={colors.textMuted}
                  value={companyInput}
                  onChangeText={setCompanyInput}
                  editable={!isGenerating}
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
                />
              </View>

              {isGenerating ? (
                <View style={styles.generatingIndicatorBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.generatingText, { color: colors.primary }]}>
                    Generating B2B logistics report about 15~30 seconds. Please wait...
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={handleGenerateReport}
                    disabled={!companyInput.trim()}
                    style={[styles.actionBtn, { backgroundColor: companyInput.trim() ? colors.primary : '#a5b4fc' }]}
                  >
                    <Text style={styles.actionBtnText}>Generate Consultant Report</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleLoadSavedConsultantReport}
                    style={[styles.actionBtn, { backgroundColor: colors.emerald, shadowColor: colors.emerald }]}
                  >
                    <Text style={styles.actionBtnText}>📂 Load Saved Consultant Report</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>


          </View>
        )}

        {/* SCREEN 2: BD CONSULTANT REPORT */}
        {screen === 'bd-consultant' && activeReport && (
          <View style={styles.sectionContainer}>
            <View style={styles.reportHeaderRow}>
              <Text style={[styles.reportMainTitle, { color: colors.text }]}>
                Account Analysis: {activeReport.companyName}
              </Text>
              {activeReport.companyWebsite ? (
                <Text style={[styles.reportMainSubtitle, { color: colors.textMuted }]}>
                  {activeReport.companyWebsite}
                </Text>
              ) : null}
            </View>

            {/* Compact tag selection row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScrollRow}>
              {parseMarkdownToTabs(activeReport.markdown).map(tab => {
                const isActive = activeReportTab === tab.sectionNumber;
                return (
                  <TouchableOpacity
                    key={tab.sectionNumber}
                    onPress={() => setActiveReportTab(tab.sectionNumber)}
                    style={[
                      styles.tagTabButton,
                      {
                        backgroundColor: isActive ? colors.primary : colors.card,
                        borderColor: colors.border,
                        transform: [{ scale: isActive ? 1.05 : 1 }]
                      }
                    ]}
                  >
                    <Text style={[styles.tagTabText, { color: isActive ? '#ffffff' : colors.text }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Render selected tab content */}
            <View style={[styles.reportContainerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Floating Copy Email Button (active only for Outreach Email section) */}
              {activeReportTab === 6 && (
                <TouchableOpacity
                  onPress={() => {
                    const tabs = parseMarkdownToTabs(activeReport.markdown);
                    const emailContent = tabs.find(t => t.sectionNumber === 6)?.content || "";
                    handleCopyEmail(emailContent);
                  }}
                  style={styles.floatingCopyEmailBtn}
                >
                  <Text style={styles.floatingCopyEmailBtnText}>📋 Copy Draft</Text>
                </TouchableOpacity>
              )}

              <RenderMarkdownText
                text={
                  parseMarkdownToTabs(activeReport.markdown).find(t => t.sectionNumber === activeReportTab)?.content ||
                  "No content generated for this section."
                }
              />
            </View>

            {/* Action buttons row */}
            <View style={styles.actionsFooterRow}>
              <TouchableOpacity
                onPress={handleSaveReport}
                style={[
                  styles.saveReportFooterBtn,
                  {
                    backgroundColor: reportSavedState ? 'transparent' : colors.primary,
                    borderColor: reportSavedState ? colors.emerald : 'transparent',
                    borderWidth: reportSavedState ? 1 : 0
                  }
                ]}
              >
                <Text style={{ color: reportSavedState ? colors.emerald : '#ffffff', fontWeight: 'bold' }}>
                  {reportSavedState ? "✓ Saved" : "📂 Save Report"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setScreen('home')}
                style={[styles.backHomeFooterBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SCREEN 3: TRIP DETAILS PAGE */}
        {screen === 'trip' && activeTrip && itinerary && (
          <View style={styles.sectionContainer}>
            <View style={styles.tripHeaderBox}>
              <Text style={[styles.tripTitle, { color: colors.text }]}>{activeTrip.title}</Text>
              <Text style={[styles.tripSubInfo, { color: colors.textMuted }]}>
                📅 {activeTrip.startDate} @ {activeTrip.startTime} • Status: {activeTrip.status}
              </Text>
            </View>

            {/* Embedded Google Map directions */}
            {(() => {
              const startEncoded = encodeURIComponent(activeTrip.startAddress);
              const allStops: string[] = [];
              if (itinerary.timeline && itinerary.timeline.length > 0) {
                itinerary.timeline.forEach(event => {
                  if (event.address && event.address !== activeTrip.startAddress && event.address !== activeTrip.endAddress) {
                    allStops.push(event.address);
                  }
                });
              }
              const daddrPart = [...allStops, activeTrip.endAddress].map(encodeURIComponent).join("+to:");
              const mapUrl = `https://maps.google.com/maps?saddr=${startEncoded}&daddr=${daddrPart}&t=m&ie=UTF8&iwloc=&output=embed`;
              
              const htmlContent = `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <style>
                      html, body {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                        overflow: hidden;
                        background-color: ${colors.bg};
                      }
                      iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                      }
                    </style>
                  </head>
                  <body>
                    <iframe src="${mapUrl}"></iframe>
                  </body>
                </html>
              `;
              
              const injectedJs = `
                (function() {
                  // Disable body scrolling via CSS to allow click events on Android
                  document.body.style.overflow = 'hidden';
                })();
                true;
              `;
              
              return (
                <View style={[styles.mapContainerCard, { borderColor: colors.border }]}>
                  <WebView
                    source={{ html: htmlContent, baseUrl: 'https://maps.google.com' }}
                    style={[styles.mapWebView, { backgroundColor: colors.bg }]}
                    domStorageEnabled={true}
                    javaScriptEnabled={true}
                    scrollEnabled={Platform.OS === 'ios' ? false : true}
                    nestedScrollEnabled={Platform.OS === 'ios' ? false : true}
                    originWhitelist={['*']}
                    injectedJavaScript={injectedJs}
                    javaScriptCanOpenWindowsAutomatically={true}
                    setSupportMultipleWindows={true}
                    onOpenWindow={(syntheticEvent) => {
                      const { nativeEvent } = syntheticEvent;
                      const { targetUrl } = nativeEvent;
                      if (targetUrl) {
                        Linking.openURL(targetUrl).catch(() => {
                          Alert.alert("Failed", "Unable to open Google Maps.");
                        });
                      }
                    }}
                    onShouldStartLoadWithRequest={(request) => {
                      const url = request.url;
                      // Intercept google maps directions/options links
                      if (
                        url.includes('google.com/maps') ||
                        url.includes('maps.google.com') ||
                        url.includes('maps.apple.com')
                      ) {
                        // Allow initial embed, subframe loads, previews, and consent redirects
                        if (
                          url.includes('output=embed') ||
                          url.includes('/maps/embed') ||
                          url.includes('/maps/preview') ||
                          url.includes('/cb') ||
                          request.navigationType !== 'click'
                        ) {
                          return true; // Load inside the WebView
                        }
                        
                        // Otherwise, it's an external link click (like "More options") - open in native app
                        Linking.openURL(url).catch(() => {
                          Alert.alert("Failed", "Unable to open Google Maps.");
                        });
                        return false; // Do not load inside the WebView
                      }
                      return true; // Load inside the WebView
                    }}
                    onError={(syntheticEvent) => {
                      const { nativeEvent } = syntheticEvent;
                      console.warn('WebView error: ', nativeEvent);
                    }}
                    onHttpError={(syntheticEvent) => {
                      const { nativeEvent } = syntheticEvent;
                      console.warn('WebView HTTP error: ', nativeEvent);
                    }}
                  />
                </View>
              );
            })()}





            {/* Actions panel */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
              <Text style={[styles.cardInnerTitle, { color: colors.text }]}>Actions Panel</Text>
              
              <View style={styles.strategySelectorBlock}>
                <Text style={[styles.labelTitle, { color: colors.textMuted }]}>First Stop Strategy:</Text>
                <View style={styles.btnRadioGroup}>
                  <TouchableOpacity
                    onPress={() => {
                      optimizeAndSyncRoute(activeTrip, "closest");
                    }}
                    style={[
                      styles.radioBtnOption,
                      {
                        backgroundColor: activeTrip.firstStopStrategy === "closest" ? colors.primaryLight : 'transparent',
                        borderColor: activeTrip.firstStopStrategy === "closest" ? colors.primary : colors.border
                      }
                    ]}
                  >
                    <Text style={{ color: activeTrip.firstStopStrategy === "closest" ? colors.primary : colors.text, fontSize: 12 }}>
                      Closest Stop First
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      optimizeAndSyncRoute(activeTrip, "furthest");
                    }}
                    style={[
                      styles.radioBtnOption,
                      {
                        backgroundColor: activeTrip.firstStopStrategy === "furthest" ? colors.primaryLight : 'transparent',
                        borderColor: activeTrip.firstStopStrategy === "furthest" ? colors.primary : colors.border
                      }
                    ]}
                  >
                    <Text style={{ color: activeTrip.firstStopStrategy === "furthest" ? colors.primary : colors.text, fontSize: 12 }}>
                      Furthest Stop First
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={async () => {
                  await optimizeAndSyncRoute(activeTrip, activeTrip.firstStopStrategy || "closest");
                }}
                style={styles.optimizeTripBtn}
              >
                <Text style={styles.optimizeTripBtnText}>Optimize Route Sequence</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const url = `${apiServerUrl}/trip/${activeTrip.id}?source=app`;
                  Linking.openURL(url).catch(() => {
                    Alert.alert("Failed", "Unable to open trip in web browser.");
                  });
                }}
                style={[styles.optimizeTripBtn, { backgroundColor: '#10b981', marginTop: 12 }]}
              >
                <Text style={styles.optimizeTripBtnText}>🌐 View in Web Browser</Text>
              </TouchableOpacity>
            </View>





            {/* Itinerary Timeline */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0 }]}>📍 Optimized Route Timeline</Text>
              <TouchableOpacity
                onPress={() => setIsAutoCheckEnabled(!isAutoCheckEnabled)}
                style={[
                  styles.autoCheckToggle,
                  {
                    backgroundColor: isAutoCheckEnabled ? (isDark ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7') : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                    borderColor: isAutoCheckEnabled ? '#16a34a' : (isDark ? '#475569' : '#cbd5e1')
                  }
                ]}
              >
                <Text style={{ color: isAutoCheckEnabled ? '#16a34a' : (isDark ? '#94a3b8' : '#64748b'), fontSize: 11, fontWeight: 'bold' }}>
                  {isAutoCheckEnabled ? '🟢 Auto Check Active' : '⚪ Auto Check Disabled'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.timelineList}>
              {/* Start node */}
              <View style={[styles.timelineNode, { borderColor: colors.border }]}>
                <Text style={[styles.nodeIcon, { backgroundColor: colors.primaryLight, color: colors.primary }]}>🏁</Text>
                <View style={styles.nodeBody}>
                  <Text style={[styles.nodeTime, { color: colors.text }]}>Depart @ {activeTrip.startTime}</Text>
                  <Text style={[styles.nodeName, { color: colors.text }]}>START: Straight Forwarding Inc.</Text>
                  <Text style={[styles.nodeAddress, { color: colors.textMuted }]}>{activeTrip.startAddress}</Text>
                </View>
              </View>

              {(() => {
                let clientStopIndex = 0;
                return itinerary.timeline.map((event, idx) => {
                  const isLunch = event.stopId === "lunch-break";
                  if (!isLunch) {
                    clientStopIndex++;
                  }
                  return (
                    <View key={event.stopId + idx} style={[styles.timelineNode, { borderColor: colors.border }]}>
                      <Text
                        style={[
                          styles.nodeIcon,
                          {
                            backgroundColor: isLunch ? colors.amberLight : colors.primaryLight,
                            color: isLunch ? colors.amber : colors.primary
                          }
                        ]}
                      >
                        {isLunch ? "🍔" : `${clientStopIndex}`}
                      </Text>
                      <View style={[styles.nodeBody, isLunch && [styles.lunchNodeBody, { backgroundColor: colors.amberLight, borderColor: colors.amber }] ]}>
                        <Text style={[styles.nodeTime, { color: isLunch ? colors.amber : colors.text }]}>
                          {new Date(event.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={[styles.nodeName, { color: isLunch ? colors.amber : colors.text }]}>{event.name}</Text>
                        <Text style={[styles.nodeAddress, { color: colors.textMuted }]}>{event.address}</Text>
                        
                        {!isLunch && (
                          <View style={styles.bufferTagsRow}>
                            <Text style={[styles.bufferTag, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: colors.text }]}>
                              ⏳ Prep Buffer: {prepBuffer}m
                            </Text>
                            <Text style={[styles.bufferTag, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: colors.text }]}>
                              ⏱️ Visit: {event.visitStart ? Math.round((new Date(event.visitEnd).getTime() - new Date(event.visitStart).getTime()) / 60000) : 30}m
                            </Text>
                          </View>
                        )}

                        {!isLunch && (() => {
                          const stopState = checkInStates[event.stopId] || { status: 'idle' };
                          const currentDist = simulatedDistances[event.stopId] !== undefined ? simulatedDistances[event.stopId] : 120;
                          
                          return (
                            <View style={[styles.checkInPanel, { borderColor: colors.border }]}>
                              <View style={styles.checkInRow}>
                                <Text style={[styles.checkInLabel, { color: colors.text }]}>📍 Check-In Feature</Text>
                                <Text style={[styles.statusBadge, 
                                  stopState.status === 'idle' && { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: colors.textMuted },
                                  stopState.status === 'checked_in' && { backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7', color: '#16a34a' },
                                  stopState.status === 'checked_out' && { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2', color: '#dc2626' }
                                ]}>
                                  {stopState.status === 'idle' && 'Not Checked In'}
                                  {stopState.status === 'checked_in' && `Checked In (${stopState.checkInMethod})`}
                                  {stopState.status === 'checked_out' && `Checked Out (${stopState.checkOutMethod})`}
                                </Text>
                              </View>

                              {/* Times display */}
                              {(stopState.checkInTime || stopState.checkOutTime) && (
                                <View style={styles.timesRow}>
                                  {stopState.checkInTime && (
                                    <Text style={[styles.timeLabelText, { color: colors.text }]}>
                                      📥 In: <Text style={{ fontWeight: 'bold' }}>{stopState.checkInTime}</Text>
                                    </Text>
                                  )}
                                  {stopState.checkOutTime && (
                                    <Text style={[styles.timeLabelText, { color: colors.text }]}>
                                      📤 Out: <Text style={{ fontWeight: 'bold' }}>{stopState.checkOutTime}</Text>
                                    </Text>
                                  )}
                                </View>
                              )}

                              {/* Manual Buttons */}
                              <View style={styles.actionButtonsRow}>
                                {stopState.status === 'idle' && (
                                  <TouchableOpacity
                                    onPress={() => handleManualCheckIn(event.stopId)}
                                    style={[styles.checkInBtn, { backgroundColor: colors.primary }]}
                                  >
                                    <Text style={styles.checkInBtnText}>Check In</Text>
                                  </TouchableOpacity>
                                )}
                                {stopState.status === 'checked_in' && (
                                  <TouchableOpacity
                                    onPress={() => handleManualCheckOut(event.stopId)}
                                    style={[styles.checkInBtn, { backgroundColor: '#dc2626' }]}
                                  >
                                    <Text style={styles.checkInBtnText}>Check Out</Text>
                                  </TouchableOpacity>
                                )}
                              </View>

                              {/* Voice Recorder section */}
                              {(() => {
                                const recState = recordingStates[event.stopId];
                                const hasSavedNote = recState && recState.audioUri;
                                
                                if (!hasSavedNote && stopState.status !== 'checked_in') return null;
                                
                                return (
                                  <View style={[styles.voiceSection, { borderColor: colors.border }]}>
                                    <View style={styles.voiceHeaderRow}>
                                      <Text style={[styles.voiceTitle, { color: colors.text }]}>🎙️ Voice Recorder Note</Text>
                                      {recState?.isRecording && (
                                        <View style={styles.blinkingDotContainer}>
                                          <View style={styles.blinkingDot} />
                                          <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>REC</Text>
                                        </View>
                                      )}
                                    </View>
                                    
                                    <View style={styles.voiceControlsRow}>
                                      <View style={{ flex: 1, justifyContent: 'center' }}>
                                        {recState?.isRecording ? (
                                          <Text style={{ fontSize: 12, color: colors.text, fontWeight: 'bold' }}>
                                            Recording: {Math.floor(recState.seconds / 60)}:{String(recState.seconds % 60).padStart(2, '0')}
                                          </Text>
                                        ) : hasSavedNote ? (
                                          <View>
                                            <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                              Saved Note ({recState.seconds}s)
                                            </Text>
                                            <View style={{ flexDirection: 'row', marginTop: 4 }}>
                                              <TouchableOpacity
                                                onPress={() => handleTogglePlayback(event.stopId)}
                                                style={[styles.playBtn, { backgroundColor: colors.primaryLight, marginTop: 0 }]}
                                              >
                                                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold' }}>
                                                  {recState.isPlaying ? `⏸️ Pause (${recState.playSeconds}s)` : '▶️ Play Note'}
                                                </Text>
                                              </TouchableOpacity>
                                              <TouchableOpacity
                                                onPress={() => {
                                                  const transText = transcripts[event.stopId] || "";
                                                  setSelectedTranscript({
                                                    stopName: event.name,
                                                    text: transText
                                                  });
                                                }}
                                                style={[styles.playBtn, { backgroundColor: colors.primaryLight, marginLeft: 8, marginTop: 0 }]}
                                              >
                                                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold' }}>
                                                  📝 Read Transcript
                                                </Text>
                                              </TouchableOpacity>
                                            </View>
                                          </View>
                                        ) : (
                                          <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                            Press the floating Start button on the right to record a meeting note.
                                          </Text>
                                        )}
                                      </View>
                                    </View>
                                  </View>
                                );
                              })()}

                              {/* Distance Simulator */}
                              <View style={styles.simulatorRow}>
                                <Text style={[styles.simulatorLabel, { color: colors.textMuted }]}>
                                  Simulated Distance: <Text style={{ fontWeight: 'bold', color: colors.text }}>{currentDist} yards</Text>
                                </Text>
                                <View style={styles.simulatorControls}>
                                  <TouchableOpacity
                                    onPress={() => handleDistanceChange(event.stopId, Math.max(0, currentDist - 25))}
                                    style={[styles.controlBtn, { backgroundColor: colors.primaryLight }]}
                                  >
                                    <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 10 }}>-25yd</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => handleDistanceChange(event.stopId, currentDist + 25)}
                                    style={[styles.controlBtn, { backgroundColor: colors.primaryLight, marginLeft: 8 }]}
                                  >
                                    <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 10 }}>+25yd</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => handleDistanceChange(event.stopId, 30)}
                                    style={[styles.controlBtn, { backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7', marginLeft: 8 }]}
                                  >
                                    <Text style={{ color: '#16a34a', fontWeight: 'bold', fontSize: 10 }}>Arrive</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          );
                        })()}
                      </View>
                    </View>
                  );
                });
              })()}

              {/* End node */}
              <View style={[styles.timelineNode, { borderLeftWidth: 0 }]}>
                <Text style={[styles.nodeIcon, { backgroundColor: colors.primaryLight, color: colors.primary }]}>🏁</Text>
                <View style={styles.nodeBody}>
                  <Text style={[styles.nodeTime, { color: colors.text }]}>
                    Arrive @ {new Date(itinerary.summary.endArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={[styles.nodeName, { color: colors.text }]}>DESTINATION: Return Base</Text>
                  <Text style={[styles.nodeAddress, { color: colors.textMuted }]}>{activeTrip.endAddress}</Text>
                </View>
              </View>

              {/* End of Trip Button */}
              {activeTrip && (
                <TouchableOpacity
                  onPress={handleEndOfTrip}
                  style={{
                    backgroundColor: '#22c55e',
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 16,
                    marginBottom: 8,
                    shadowColor: '#22c55e',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    elevation: 4,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 16 }}>
                    {activeTrip.status === 'completed' ? '📊 View Report' : '🏁 End of Trip'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Travel Summary Stats */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 24, marginBottom: 8 }]}>
              <Text style={[styles.cardInnerTitle, { color: colors.text }]}>Itinerary Summary</Text>
              <View style={styles.summaryStatsList}>
                <View style={[styles.summaryRow, { borderBottomWidth: 1, borderColor: colors.border }]}>
                  <Text style={[styles.statTitle, { color: colors.textMuted }]}>Total Distance</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {unitSystem === 'imperial'
                      ? `${(itinerary.summary.totalDistanceKm * 0.621371).toFixed(2)} mi`
                      : `${itinerary.summary.totalDistanceKm} km`}
                  </Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 1, borderColor: colors.border }]}>
                  <Text style={[styles.statTitle, { color: colors.textMuted }]}>Visit Face-Time</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {itinerary.summary.totalVisitTimeMinutes} mins
                  </Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 1, borderColor: colors.border }]}>
                  <Text style={[styles.statTitle, { color: colors.textMuted }]}>Travel Duration</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {itinerary.summary.totalTravelTimeMinutes} mins
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.statTitle, { color: colors.textMuted }]}>Total Duration</Text>
                  <Text style={[styles.statValue, { color: colors.primary, fontWeight: 'bold', fontSize: 16 }]}>
                    {itinerary.summary.totalDurationMinutes} mins
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setScreen('home')}
              style={[styles.backHomeFullBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>

        {/* Recording Blocking Overlay */}
        {(() => {
          if (!isVoiceRecordingEnabled) return null;
          const checkedInStops = Object.keys(checkInStates).filter(id => checkInStates[id]?.status === 'checked_in');
          const isAnyStopRecording = checkedInStops.some(id => recordingStates[id]?.isRecording);
          if (!isAnyStopRecording) return null;
          return (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 9998,
              }}
              pointerEvents="auto"
            />
          );
        })()}

        {/* Floating Microphone Record Button */}
        {screen === 'trip' && activeTrip && (() => {
          if (!isVoiceRecordingEnabled) return null;
          const checkedInStops = Object.keys(checkInStates).filter(id => checkInStates[id]?.status === 'checked_in');
          let activeCheckedInStopId = checkedInStops.find(id => {
            const rec = recordingStates[id];
            return !(rec && rec.audioUri);
          });
          if (!activeCheckedInStopId && checkedInStops.length > 0) {
            activeCheckedInStopId = checkedInStops[0];
          }
          if (!activeCheckedInStopId) return null;

          const recState = recordingStates[activeCheckedInStopId];
          const hasSavedNote = recState && recState.audioUri;
          const isRecording = recState?.isRecording || false;

          // Hide button if the note is already saved and recording has finished
          if (hasSavedNote && !isRecording) return null;

          return (
            <TouchableOpacity
              onPress={() => handleToggleRecording(activeCheckedInStopId)}
              style={[
                styles.floatingMicBtn,
                {
                  backgroundColor: isRecording ? '#dc2626' : '#ef4444',
                  shadowColor: '#ef4444',
                }
              ]}
            >
              <Text style={{ fontSize: 54, marginBottom: 4 }}>🎙️</Text>
              <Text style={styles.floatingMicBtnText}>
                {isRecording ? 'Finish' : 'Start'}
              </Text>
            </TouchableOpacity>
          );
        })()}
      </View>

      {/* OVERLAY 0: AI TRANSCRIPT MODAL */}
      <Modal visible={selectedTranscript !== null} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0, flex: 1, marginRight: 10 }]}>
                📝 AI Transcript: {selectedTranscript?.stopName}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedTranscript(null)}
                style={{ padding: 6, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 300, marginBottom: 4 }}>
              <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                {selectedTranscript?.text}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* OVERLAY 0.5: SALES REPORT LOADING OVERLAY */}
      <Modal visible={isGeneratingReport} animationType="fade" transparent>
        <View style={[styles.modalBg, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, alignItems: 'center', padding: 24, maxWidth: 280 }]}>
            <ActivityIndicator size="large" color="#22c55e" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
              Generating Sales Report...
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 15 }}>
              Please wait while our backend sales agent compiles stop transcripts and insights.
            </Text>
          </View>
        </View>
      </Modal>

      {/* OVERLAY 0.6: SALES REPORT MODAL */}
      <Modal visible={salesReportMarkdown !== null} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0, flex: 1, marginRight: 10 }]}>
                📊 Daily Outbound Sales Field Report
              </Text>
              <TouchableOpacity
                onPress={() => setSalesReportMarkdown(null)}
                style={{ padding: 6, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 400, marginBottom: 12 }}>
              <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                {salesReportMarkdown ? (
                  salesReportMarkdown
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/&nbsp;/g, " ")
                    .replace(/\| :--- \| :--- \|/g, "")
                    .replace(/\| Section \| Details \|/g, "")
                    .replace(/\|/g, " ")
                    .replace(/•\s*/g, "  • ")
                    .replace(/###/g, "\n\n###")
                    .trim()
                ) : ""}
              </Text>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                onPress={handleEmailReportMobile}
                style={{
                  flex: 1,
                  backgroundColor: '#4f46e5',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>✉️ E-Mail Report</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSalesReportMarkdown(null)}
                style={{
                  flex: 1,
                  backgroundColor: '#22c55e',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Close Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* OVERLAY 1: SETTINGS MODAL */}
      <Modal visible={isSettingsVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>⚙️ User Settings</Text>

            <View style={styles.settingsGroup}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>User First Name:</Text>
              <TextInput
                value={userName}
                onChangeText={setUserName}
                style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
              />
            </View>

            <View style={styles.settingsGroup}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Stop Prep Buffer (minutes):</Text>
              <TextInput
                value={prepBuffer}
                onChangeText={setPrepBuffer}
                keyboardType="numeric"
                style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
              />
            </View>

            <View style={styles.settingsGroup}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Distance Unit System:</Text>
              <View style={styles.btnRadioGroup}>
                <TouchableOpacity
                  onPress={() => setUnitSystem('imperial')}
                  style={[styles.radioBtnOption, { flex: 1, marginRight: 8, borderColor: unitSystem === 'imperial' ? colors.primary : colors.border }]}
                >
                  <Text style={{ color: colors.text, textAlign: 'center' }}>Imperial (mi)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setUnitSystem('metric')}
                  style={[styles.radioBtnOption, { flex: 1, borderColor: unitSystem === 'metric' ? colors.primary : colors.border }]}
                >
                  <Text style={{ color: colors.text, textAlign: 'center' }}>Metric (km)</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsGroup}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Theme Preference:</Text>
              <View style={styles.btnRadioGroup}>
                {['light', 'dark', 'system'].map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setActiveTheme(t as any)}
                    style={[styles.radioBtnOption, { flex: 1, marginRight: 4, borderColor: activeTheme === t ? colors.primary : colors.border }]}
                  >
                    <Text style={{ color: colors.text, textAlign: 'center', fontSize: 12 }}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingsGroup}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Voice Recording Option:</Text>
              <View style={styles.btnRadioGroup}>
                <TouchableOpacity
                  onPress={() => setIsVoiceRecordingEnabled(true)}
                  style={[styles.radioBtnOption, { flex: 1, marginRight: 8, borderColor: isVoiceRecordingEnabled ? colors.primary : colors.border }]}
                >
                  <Text style={{ color: colors.text, textAlign: 'center' }}>Enabled</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsVoiceRecordingEnabled(false)}
                  style={[styles.radioBtnOption, { flex: 1, borderColor: !isVoiceRecordingEnabled ? colors.primary : colors.border }]}
                >
                  <Text style={{ color: colors.text, textAlign: 'center' }}>Disabled</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsGroup}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Email to Receive Report:</Text>
              <TextInput
                value={reportEmail}
                onChangeText={setReportEmail}
                placeholder="e.g. sales-ops@company.com"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
              />
            </View>

            <View style={[styles.settingsGroup, { marginTop: 12 }]}>
              <TouchableOpacity
                onPress={() => {
                  setIsSettingsVisible(false);
                  setTimeout(() => {
                    handleMobileSignOut();
                  }, 300);
                }}
                style={{
                  backgroundColor: '#ef4444',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#dc2626'
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>👋 Sign Out</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity onPress={handleSaveSettings} style={[styles.actionBtn, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.actionBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsSettingsVisible(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* OVERLAY 2: CREATE NEW TRIP MODAL */}
      <Modal visible={isNewTripVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <SafeAreaView style={{ flex: 1, justifyContent: 'center' }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.modalContentScroll, { backgroundColor: colors.card }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setIsNewTripVisible(false)} style={{ paddingVertical: 4, paddingRight: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 22, fontWeight: 'bold' }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0, textAlign: 'left', flex: 1 }]}>
                  Create New Outbound Trip
                </Text>
              </View>

              <TextInput
                placeholder="Starting Location Address"
                placeholderTextColor={colors.textMuted}
                value={decodeURIComponent(newTripStart)}
                onChangeText={(v) => setNewTripStart(decodeURIComponent(v))}
                style={[styles.textInput, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
              />

              <TextInput
                placeholder="Return Destination Address"
                placeholderTextColor={colors.textMuted}
                value={decodeURIComponent(newTripEnd)}
                onChangeText={(v) => setNewTripEnd(decodeURIComponent(v))}
                style={[styles.textInput, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
              />

              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Add Client Visiting Stops</Text>

              {newTripStops.map((stop, index) => (
                <View key={stop.id} style={[styles.stopFieldBox, { borderColor: colors.border }]}>
                  <View style={styles.stopFieldHeader}>
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>Stop #{index + 1}</Text>
                    {newTripStops.length > 1 && (
                      <TouchableOpacity onPress={() => handleRemoveStopField(stop.id)}>
                        <Text style={{ color: colors.red, fontWeight: 'bold' }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    placeholder="Prospect Company Name"
                    placeholderTextColor={colors.textMuted}
                    value={stop.name}
                    onChangeText={(v) => handleUpdateStopField(stop.id, 'name', v)}
                    style={[styles.textInput, { color: colors.text, borderColor: colors.border, marginBottom: 8 }]}
                  />
                  <TextInput
                    placeholder="Stops Physical Address"
                    placeholderTextColor={colors.textMuted}
                    value={decodeURIComponent(stop.address)}
                    onChangeText={(v) => handleUpdateStopField(stop.id, 'address', decodeURIComponent(v))}
                    style={[styles.textInput, { color: colors.text, borderColor: colors.border, marginBottom: 8 }]}
                  />
                  <View style={styles.btnRadioGroup}>
                    <TextInput
                      placeholder="Duration (minutes)"
                      placeholderTextColor={colors.textMuted}
                      value={stop.duration}
                      onChangeText={(v) => handleUpdateStopField(stop.id, 'duration', v)}
                      keyboardType="numeric"
                      style={[styles.textInput, { flex: 1, color: colors.text, borderColor: colors.border, marginRight: 8 }]}
                    />
                    <TextInput
                      placeholder="Visit Notes"
                      placeholderTextColor={colors.textMuted}
                      value={stop.notes}
                      onChangeText={(v) => handleUpdateStopField(stop.id, 'notes', v)}
                      style={[styles.textInput, { flex: 1.5, color: colors.text, borderColor: colors.border }]}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity onPress={handleAddStopField} style={[styles.cancelBtn, { borderColor: colors.border, marginBottom: 20 }]}>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>➕ Add Stop</Text>
              </TouchableOpacity>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity onPress={handleSaveNewTrip} style={[styles.actionBtn, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.actionBtnText}>Save Trip</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsNewTripVisible(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    minWidth: 42,
  },
  weatherEmoji: {
    fontSize: 26,
  },
  weatherTempText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  headerBackBtn: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#4f46e5',
    borderRadius: 6,
  },
  headerBackBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  headerGreeting: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginTop: 1,
  },
  settingsButton: {
    padding: 8,
  },
  settingsButtonText: {
    fontSize: 22,
  },
  quoteContainer: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  quoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: 'bold',
    lineHeight: 16,
    textAlign: 'center',
  },
  quoteAuthor: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 6,
    fontWeight: '600',
  },
  scrollBody: {
    padding: 16,
    paddingBottom: 120,
    flexGrow: 1,
  },
  sectionContainer: {
    width: '100%',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  cardSubtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#94a3b8',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 14,
  },
  textInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  actionBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  generatingIndicatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  generatingText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  savedSection: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  savedCard: {
    width: '47%',
    margin: '1.5%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedCardLeft: {
    flex: 1,
    paddingRight: 6,
  },
  savedCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  savedCardSubtitle: {
    fontSize: 9,
    marginTop: 2,
  },
  deleteIconBtn: {
    padding: 4,
  },
  deleteIconText: {
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  savedTripItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  savedTripLeft: {
    flex: 1,
  },
  savedTripTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  savedTripDate: {
    fontSize: 10,
    marginTop: 4,
  },
  reportHeaderRow: {
    marginBottom: 16,
  },
  reportMainTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  reportMainSubtitle: {
    fontSize: 11,
    marginTop: 4,
  },
  tabScrollRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 4,
  },
  tagTabButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagTabText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  reportContainerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    minHeight: 300,
    position: 'relative',
  },
  floatingCopyEmailBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 10,
  },
  floatingCopyEmailBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionsFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  saveReportFooterBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  backHomeFooterBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripHeaderBox: {
    marginBottom: 14,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tripSubInfo: {
    fontSize: 11,
    marginTop: 4,
  },
  mapContainerCard: {
    width: '100%',
    height: 240,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 12,
  },
  mapWebView: {
    flex: 1,
    opacity: 0.99,
  },
  mapLauncherBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLauncherBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cardInnerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  strategySelectorBlock: {
    marginBottom: 14,
  },
  labelTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  btnRadioGroup: {
    flexDirection: 'row',
  },
  radioBtnOption: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optimizeTripBtn: {
    height: 42,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optimizeTripBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  summaryStatsList: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  lunchOptionsGroup: {
    marginTop: 8,
  },
  lunchOptionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 8,
  },
  timelineList: {
    marginTop: 12,
  },
  timelineNode: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    paddingLeft: 16,
    paddingBottom: 24,
    position: 'relative',
  },
  nodeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 12,
    fontWeight: 'bold',
    position: 'absolute',
    left: -15,
    top: 0,
    overflow: 'hidden',
  },
  nodeBody: {
    flex: 1,
    marginTop: -2,
  },
  nodeTime: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  nodeName: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 2,
  },
  nodeAddress: {
    fontSize: 10,
    marginTop: 2,
  },
  lunchNodeBody: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginTop: 4,
  },
  bufferTagsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  bufferTag: {
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
    overflow: 'hidden',
  },
  backHomeFullBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  settingsGroup: {
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  cancelBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  modalContentScroll: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  stopFieldBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  stopFieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  markdownWrapper: {
    paddingVertical: 4,
  },
  hr: {
    borderTopWidth: 1,
    marginVertical: 14,
  },
  mdHeading: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 6,
  },
  mdParagraph: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  mdList: {
    marginVertical: 6,
  },
  mdListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  mdBullet: {
    fontSize: 13,
    marginRight: 6,
  },
  mdListText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  tableScroll: {
    marginVertical: 10,
  },
  tableContainer: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableHeaderRow: {
    borderBottomWidth: 2,
  },
  tableCellBox: {
    width: 140,
    padding: 10,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  tableCellText: {
    fontSize: 11,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inlineSyncBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  inlineSyncBtnText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Check-In Styles
  checkInPanel: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  checkInLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  timesRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  timeLabelText: {
    fontSize: 11,
    marginRight: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  checkInBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  simulatorRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 8,
  },
  simulatorLabel: {
    fontSize: 10,
    marginBottom: 6,
  },
  simulatorControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoCheckToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  loadTripBtn: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadTripBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Voice Recording Styles
  voiceSection: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.03)',
  },
  voiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  voiceTitle: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  blinkingDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  voiceControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  micCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  micCircleBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  playBtn: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  floatingMicBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -125,
    marginLeft: -125,
    width: 250,
    height: 250,
    borderRadius: 125,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 9999,
  },
  floatingMicBtnText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }
});
