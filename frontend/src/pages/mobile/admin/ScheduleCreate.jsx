import { useLocation, useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/common';
import MobileAdminLayout from './Layout';
import ScheduleEdit from './ScheduleEdit';

// The editor handles Back (including pending saves); this route owns the destination.
export default function MobileAdminScheduleCreate() {
  useDocumentTitle('일정 추가');
  const navigate = useNavigate();
  const { state } = useLocation();
  const initialDate = state?.initialDate;
  return <MobileAdminLayout>
    <ScheduleEdit creating initialDate={initialDate} onBusyChange={() => {}} onClose={() => navigate('/admin/schedule', { replace: true, state: { selectedDate: initialDate } })} onSuccess={({ date }) => {
      navigate('/admin/schedule', { replace: true, state: { createdDate: date, scheduleCreated: true } });
    }} />
  </MobileAdminLayout>;
}
