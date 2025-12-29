'use client';

import Navbar from '@/components/Navbar';
import AppointmentSheets from '@/components/Dashboard/AppointmentManager/AppointmentSheets';

export default function AppointmentManagerPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen p-4 pt-[100px] bg-[#101312]">
        <h1 className="text-2xl font-bold text-white mb-4">Appointment Manager</h1>
        <AppointmentSheets />
      </div>
    </>
  );
}