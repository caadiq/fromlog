import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/common';
import MobileAdminLayout from './Layout';
import ScheduleEdit from './ScheduleEdit';

// The route owns page navigation; nested pickers/dialogs own their own Back entries.
export default function MobileAdminScheduleCreate() {
  useDocumentTitle('일정 추가');
  const navigate = useNavigate();
  return <MobileAdminLayout>
    <ScheduleEdit creating onBusyChange={() => {}} onClose={() => navigate('/admin/schedule', { replace: true })} onSuccess={({ date }) => {
      navigate('/admin/schedule', { replace: true, state: { createdDate: date, scheduleCreated: true } });
    }} />
  </MobileAdminLayout>;
}
