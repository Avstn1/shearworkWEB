'use client';

import AppointmentSheets from '@/components/Dashboard/AppointmentManager/AppointmentSheets';
import { AppPage } from '@/components/ui/AppKit';

export default function AppointmentManagerPage() {
  // AppointmentSheets renders the page header itself so the date navigation can sit in it.
  return (
    <AppPage>
      <AppointmentSheets />
    </AppPage>
  );
}
