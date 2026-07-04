"use client";

import { useEffect, useState } from "react";
import UserAccountSettings from "./UserAccountSettings";

type UserSettings = {
  name: string;
  email: string;
  unitSystem: "metric" | "imperial";
  mapProvider: "openstreetmap" | "google" | "mapbox";
  prepBufferMinutes?: number;
  theme?: "light" | "dark" | "system";
};

const DEFAULT_NAME = "John Doe";

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

export default function Header() {
  const [greeting, setGreeting] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [quoteAuthor, setQuoteAuthor] = useState("");

  const loadNameAndSetGreeting = () => {
    // 1. Get user name
    let name = DEFAULT_NAME;
    const stored = localStorage.getItem("fieldroute_user_settings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UserSettings;
        if (parsed && parsed.name) {
          name = parsed.name;
        }
      } catch {}
    }
    // Get first name
    const firstName = name.split(" ")[0] || name;

    // 2. Determine time of day greeting
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 18) {
      timeGreeting = "Good afternoon";
    } else if (hour >= 18) {
      timeGreeting = "Good evening";
    }

    setGreeting(`${timeGreeting}, ${firstName}!`);
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Load initial name & greeting
    loadNameAndSetGreeting();

    // Select a random quote on every load/login
    const quoteIndex = Math.floor(Math.random() * SALES_QUOTES.length);
    const selectedQuote = SALES_QUOTES[quoteIndex] || SALES_QUOTES[0];
    setQuoteText(`“${selectedQuote.text}”`);
    setQuoteAuthor(`~ ${selectedQuote.author}`);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Listen for setting changes
    const handleStorageChange = () => {
      loadNameAndSetGreeting();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <header className="mt-4 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6 text-slate-800 dark:text-slate-100">
          <img src="/logo.png" alt="Logo" className="h-9 w-auto object-contain flex-shrink-0" />
          <span className="text-lg font-bold">AI Sales Assistant</span>
        </div>

        <nav className="flex items-center gap-5">
          <div className="hidden sm:flex flex-col text-right justify-center">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {greeting}
            </span>
            <span 
              className="text-sm font-bold text-slate-800 dark:text-slate-100 italic max-w-xs md:max-w-md lg:max-w-xl mt-0.5 leading-tight"
              title={quoteText}
            >
              {quoteText}
            </span>
            <span className="text-[10px] font-medium text-slate-800 dark:text-slate-100 mt-0.5 leading-none">
              {quoteAuthor}
            </span>
          </div>
          <UserAccountSettings />
        </nav>
      </div>
    </header>
  );
}
