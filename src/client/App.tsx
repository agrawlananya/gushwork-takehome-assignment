import { BrowserRouter, Route, Routes } from "react-router";
import { TodayPage } from "@/pages/TodayPage";

export function App() {
  return (
    <BrowserRouter>
      <div className="bg-amber-100 px-4 py-1 text-center text-sm text-amber-900">
        Demo — please don't enter real customer data
      </div>
      <Routes>
        <Route path="/" element={<TodayPage />} />
      </Routes>
    </BrowserRouter>
  );
}
