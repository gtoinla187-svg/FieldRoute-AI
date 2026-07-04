"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      // 1. Skip auth checks for login pages to prevent infinite redirect loops
      if (pathname === "/login" || pathname === "/admin/login") {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      // 2. Check admin area protection
      if (pathname.startsWith("/admin")) {
        const adminToken = sessionStorage.getItem("sfi_admin_token");
        if (!adminToken) {
          router.push("/admin/login");
          setAuthorized(false);
        } else {
          setAuthorized(true);
        }
        setLoading(false);
        return;
      }

      // 3. Check regular user area protection
      const userToken = localStorage.getItem("sfi_user_token");
      if (!userToken) {
        router.push("/login");
        setAuthorized(false);
      } else {
        setAuthorized(true);
      }
      setLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}
