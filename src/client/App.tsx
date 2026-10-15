import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from "react-router";
import { LeadPage } from "@/pages/LeadPage";
import { NewLeadPage } from "@/pages/NewLeadPage";
import { TodayPage } from "@/pages/TodayPage";

/** New pages open at the top; Back keeps the browser's scroll position. */
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== "POP") window.scrollTo(0, 0);
  }, [pathname, navigationType]);
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="bg-amber-100 px-4 py-0.5 text-center text-xs text-amber-900">Demo — please don't enter real customer data</div>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/lead/:id" element={<LeadPage />} />
        <Route path="/new" element={<NewLeadPage />} />
        <Route path="*" element={<TodayPage />} />
      </Routes>
    </BrowserRouter>
  );
}
