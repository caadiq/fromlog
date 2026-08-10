/**
 * 관리자 앨범 사진 관리 페이지
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import { Upload, Image, FolderOpen, Disc3 } from 'lucide-react';
import { Toast } from '@/components/common';
import {
  AdminLayout,
  ConfirmDialog,
  PendingFileItem,
  RegisteredPhotoItem,
  BulkEditPanel,
  PhotoGrid,
  PhotoPreviewModal,
  parseRange,
} from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { adminAlbumApi, adminMemberApi } from '@/api/admin';
import useAuthStore from '@/stores/useAuthStore';

function AdminAlbumPhotos() {
  const { albumId } = useParams();
  const fileInputRef = useRef(null);
  const photoListRef = useRef(null);

  const { user, isAuthenticated } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('사진 관리');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState({ show: false, photos: [] });
  const [deleting, setDeleting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // 업로드 대기 중인 파일들
  const [pendingFiles, setPendingFiles] = useState([]);
  const [photoType, setPhotoType] = useState('concept');
  const [startNumber, setStartNumber] = useState(1);
  const [saving, setSaving] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [uploadConfirmDialog, setUploadConfirmDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [manageSubTab, setManageSubTab] = useState('concept');

  // 일괄 편집 도구 상태
  const [bulkEdit, setBulkEdit] = useState({
    range: '',
    groupType: '',
    members: [],
    conceptName: '',
  });

  // 일괄 편집 적용
  const applyBulkEdit = () => {
    const indices = parseRange(bulkEdit.range, startNumber);
    if (indices.length === 0) {
      setToast({ message: '적용할 번호 범위를 입력하세요.', type: 'warning' });
      return;
    }

    const validIndices = indices.filter((i) => i < pendingFiles.length);
    if (validIndices.length === 0) {
      setToast({ message: '유효한 번호가 없습니다.', type: 'error' });
      return;
    }

    setPendingFiles((prev) =>
      prev.map((file, idx) => {
        if (!validIndices.includes(idx)) return file;

        const updates = {};
        if (bulkEdit.groupType) {
          updates.groupType = bulkEdit.groupType;
          if (bulkEdit.groupType === 'group') {
            updates.members = [];
          } else if (bulkEdit.members.length > 0) {
            updates.members =
              bulkEdit.groupType === 'solo' ? [bulkEdit.members[0]] : [...bulkEdit.members];
          }
        } else if (bulkEdit.members.length > 0) {
          updates.members = [...bulkEdit.members];
        }

        if (bulkEdit.conceptName) {
          updates.conceptName = bulkEdit.conceptName;
        }

        return { ...file, ...updates };
      })
    );

    setToast({ message: `${validIndices.length}개 사진에 일괄 적용되었습니다.`, type: 'success' });
    setBulkEdit({ range: '', groupType: '', members: [], conceptName: '' });
  };

  // 앨범 정보 로드
  const {
    data: album,
    isLoading: albumLoading,
    error: albumError,
    refetch: refetchAlbum,
  } = useQuery({
    queryKey: ['admin', 'album', albumId],
    queryFn: () => adminAlbumApi.getAlbum(albumId),
    enabled: isAuthenticated && !!albumId,
    staleTime: 0,
  });

  // 멤버 목록 로드
  const { data: members = [] } = useQuery({
    queryKey: ['admin', 'members'],
    queryFn: adminMemberApi.getMembers,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // 컨셉 포토 목록 로드
  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['admin', 'album', albumId, 'photos'],
    queryFn: () => adminAlbumApi.getAlbumPhotos(albumId),
    enabled: isAuthenticated && !!albumId,
    staleTime: 0,
  });

  // 티저 이미지 목록 로드
  const { data: teasers = [], refetch: refetchTeasers } = useQuery({
    queryKey: ['admin', 'album', albumId, 'teasers'],
    queryFn: () => adminAlbumApi.getAlbumTeasers(albumId),
    enabled: isAuthenticated && !!albumId,
    staleTime: 0,
  });

  const loading = albumLoading;

  // 에러 처리
  useEffect(() => {
    if (albumError) {
      console.error('앨범 로드 오류:', albumError);
      setToast({ message: albumError.message || '앨범 로드 중 오류가 발생했습니다.', type: 'error' });
    }
  }, [albumError, setToast]);

  // 데이터 새로고침 함수
  const fetchAlbumData = async () => {
    await Promise.all([refetchAlbum(), refetchPhotos(), refetchTeasers()]);
  };

  // 타입 변경 시 시작 번호 자동 업데이트
  useEffect(() => {
    if (photoType === 'concept') {
      const maxOrder = photos.length > 0 ? Math.max(...photos.map((p) => p.sort_order || 0)) : 0;
      setStartNumber(maxOrder + 1);
    } else if (photoType === 'teaser') {
      const maxOrder = teasers.length > 0 ? Math.max(...teasers.map((t) => t.sort_order || 0)) : 0;
      setStartNumber(maxOrder + 1);
    }
  }, [photoType, photos, teasers]);

  // dnd-kit 정렬 (자동 스크롤·스크롤 보정 내장)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDndEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setPendingFiles((prev) => {
      const oldIdx = prev.findIndex((f) => f.id === active.id);
      const newIdx = prev.findIndex((f) => f.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  // ── 관리 탭: 등록된 컨셉 포토 편집 (순서/타입/컨셉명/멤버) ──
  const [editPhotos, setEditPhotos] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // 서버 데이터로 편집 상태를 동기화하되, 내용이 실제로 바뀌었을 때만 리셋한다.
  // photos 쿼리는 staleTime:0이라 창 포커스만으로도 재조회되는데, 동일 데이터가
  // 새 배열로 돌아올 때마다 리셋하면 저장 안 한 편집이 소리 없이 사라진다.
  const syncedSigRef = useRef(null);
  useEffect(() => {
    const sig = JSON.stringify(
      photos.map((p) => [p.id, p.photo_type, p.concept_name || '', [...(p.members || [])].sort()])
    );
    if (sig === syncedSigRef.current) return; // 내용 동일 → 편집 유지
    syncedSigRef.current = sig;
    setEditPhotos(photos.map((p) => ({ ...p, members: [...(p.members || [])] })));
  }, [photos]);

  const editDirty = useMemo(() => {
    if (editPhotos.length !== photos.length) return false;
    return editPhotos.some((p, i) => {
      const orig = photos[i];
      return (
        p.id !== orig.id ||
        p.photo_type !== orig.photo_type ||
        (p.concept_name || '') !== (orig.concept_name || '') ||
        JSON.stringify([...p.members].sort()) !== JSON.stringify([...(orig.members || [])].sort())
      );
    });
  }, [editPhotos, photos]);

  const updateEditPhoto = (id, patch) => {
    setEditPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const toggleEditMember = (id, memberId) => {
    setEditPhotos((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              members: p.members.includes(memberId)
                ? p.members.filter((m) => m !== memberId)
                : [...p.members, memberId],
            }
          : p
      )
    );
  };

  const moveEditToPosition = (id, position) => {
    setEditPhotos((prev) => {
      const currentIndex = prev.findIndex((p) => p.id === id);
      const targetIndex = Math.max(0, Math.min(position - 1, prev.length - 1));
      if (currentIndex === -1 || currentIndex === targetIndex) return prev;
      return arrayMove(prev, currentIndex, targetIndex);
    });
  };

  const handleManageDndEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setEditPhotos((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const saveEditPhotos = async () => {
    setSavingEdit(true);
    try {
      const data = await adminAlbumApi.bulkUpdateAlbumPhotos(
        albumId,
        editPhotos.map((p, i) => ({
          id: p.id,
          sort_order: i + 1,
          photo_type: p.photo_type,
          concept_name: p.concept_name || null,
          members: p.photo_type === 'group' ? [] : p.members,
        }))
      );
      setToast({ message: data.message, type: 'success' });
      await refetchPhotos();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  // 일정(X 게시물)에서 이미지 가져오기
  const [importScheduleId, setImportScheduleId] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImportFromSchedule = async () => {
    // "1-5,7,8" 같은 범위 입력 → 일정 번호 배열 (parseRange(str, 0) = 리터럴 숫자)
    const scheduleIds = parseRange(importScheduleId, 0);
    if (scheduleIds.length === 0) {
      setToast({ message: '일정 번호를 입력해주세요. (예: 1-5,7,8)', type: 'error' });
      return;
    }
    setImporting(true);
    try {
      const token = useAuthStore.getState().token;
      const allFiles = [];
      const failed = [];

      for (const scheduleId of scheduleIds) {
        try {
          // 일정 상세에서 이미지 개수 파악
          const detail = await fetch(`/api/schedules/${scheduleId}`).then((r) => r.json());
          const count = detail?.imageUrls?.length || 0;
          if (!count) {
            failed.push(`#${scheduleId}(이미지 없음)`);
            continue;
          }
          // 각 이미지를 백엔드 프록시로 원본 화질 다운로드 (일정 단위로 모아 전부 성공 시에만 추가)
          const schedFiles = [];
          for (let i = 0; i < count; i++) {
            const res = await fetch(
              `/api/albums/photos/x-image?scheduleId=${scheduleId}&index=${i}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error('download');
            const blob = await res.blob();
            schedFiles.push(
              new File([blob], `schedule_${scheduleId}_${i + 1}.jpg`, { type: blob.type || 'image/jpeg' })
            );
          }
          allFiles.push(...schedFiles);
        } catch {
          failed.push(`#${scheduleId}`);
        }
      }

      if (allFiles.length > 0) addFilesToPending(allFiles);

      if (allFiles.length > 0 && failed.length === 0) {
        setToast({
          message: `${scheduleIds.length}개 일정에서 ${allFiles.length}장을 목록에 추가했습니다.`,
          type: 'success',
        });
        setImportScheduleId('');
      } else if (allFiles.length > 0) {
        setToast({
          message: `${allFiles.length}장 추가. 실패: ${failed.join(', ')} (트위터 불안정 시 재시도)`,
          type: 'error',
        });
      } else {
        setToast({ message: `가져오기 실패: ${failed.join(', ')}`, type: 'error' });
      }
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  // 파일 선택
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    addFilesToPending(files);
    e.target.value = '';
  };

  // 드래그 앤 드롭
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setDragOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      addFilesToPending(files);
    }
  };

  // 대기 목록에 파일 추가
  const addFilesToPending = (files) => {
    const existingKeys = new Set(pendingFiles.map((f) => `${f.filename}_${f.file.size}`));

    const uniqueFiles = files.filter((file) => {
      const key = `${file.name}_${file.size}`;
      if (existingKeys.has(key)) {
        return false;
      }
      existingKeys.add(key);
      return true;
    });

    if (uniqueFiles.length < files.length) {
      const duplicateCount = files.length - uniqueFiles.length;
      setToast({
        message: `${duplicateCount}개의 중복 파일이 제외되었습니다.`,
        type: 'warning',
      });
    }

    if (uniqueFiles.length === 0) return;

    const newFiles = uniqueFiles.map((file, index) => ({
      id: Date.now() + index,
      file,
      preview: URL.createObjectURL(file),
      filename: file.name,
      isVideo: file.type === 'video/mp4',
      groupType: 'group',
      members: [],
      conceptName: '',
    }));
    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  // 직접 순서 변경
  const moveToPosition = (fileId, newPosition) => {
    const pos = parseInt(newPosition, 10);
    if (isNaN(pos) || pos < startNumber) return;

    setPendingFiles((prev) => {
      const targetIndex = Math.min(pos - startNumber, prev.length - 1);
      const currentIndex = prev.findIndex((f) => f.id === fileId);
      if (currentIndex === -1 || currentIndex === targetIndex) return prev;

      const newFiles = [...prev];
      const [removed] = newFiles.splice(currentIndex, 1);
      newFiles.splice(targetIndex, 0, removed);
      return newFiles;
    });
  };

  // 대기 파일 삭제
  const confirmDeletePendingFile = () => {
    if (!pendingDeleteId) return;
    setPendingFiles((prev) => {
      const file = prev.find((f) => f.id === pendingDeleteId);
      if (file) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== pendingDeleteId);
    });
    setPendingDeleteId(null);
  };

  // 대기 파일 메타 정보 수정
  const updatePendingFile = (id, field, value) => {
    setPendingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  // 멤버 토글
  const toggleMember = (fileId, member) => {
    setPendingFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;

        if (f.groupType === 'solo') {
          return { ...f, members: f.members.includes(member) ? [] : [member] };
        }

        const members = f.members.includes(member)
          ? f.members.filter((m) => m !== member)
          : [...f.members, member];
        return { ...f, members };
      })
    );
  };

  // 타입 변경
  const changeGroupType = (fileId, newType) => {
    setPendingFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        if (newType === 'group') {
          return { ...f, groupType: newType, members: [] };
        }
        if (newType === 'solo' && f.members.length > 1) {
          return { ...f, groupType: newType, members: [f.members[0]] };
        }
        return { ...f, groupType: newType };
      })
    );
  };

  // 업로드 처리
  const handleUpload = async () => {
    if (pendingFiles.length === 0) {
      setToast({ message: '업로드할 사진을 선택해주세요.', type: 'warning' });
      return;
    }

    if (photoType === 'concept') {
      const missingMembers = pendingFiles.some(
        (f) => (f.groupType === 'solo' || f.groupType === 'unit') && f.members.length === 0
      );
      if (missingMembers) {
        setToast({ message: '개인/유닛 사진에는 멤버를 선택해주세요.', type: 'warning' });
        return;
      }
    }

    setSaving(true);
    setUploadProgress(0);
    setProcessingProgress({ current: 0, total: pendingFiles.length });
    setProcessingStatus('');

    try {
      const token = useAuthStore.getState().token;

      const formData = new FormData();
      const metadata = pendingFiles.map((pf) => ({
        groupType: pf.groupType,
        members: pf.members,
        conceptName: pf.conceptName,
      }));

      pendingFiles.forEach((pf) => {
        formData.append('photos', pf.file);
      });
      formData.append('metadata', JSON.stringify(metadata));
      formData.append('startNumber', startNumber);
      formData.append('photoType', photoType);

      const response = await fetch(`/api/albums/${albumId}/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      setUploadProgress(100);

      // SSE 응답 읽기
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                result = data;
              } else if (data.error) {
                throw new Error(data.error);
              } else if (data.current) {
                setProcessingProgress({ current: data.current, total: data.total });
                setProcessingStatus(data.message);
              }
            } catch (e) {
              // JSON 파싱 실패 무시
            }
          }
        }
      }

      if (result) {
        setToast({ message: result.message, type: 'success' });
      }

      pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
      setPendingFiles([]);

      fetchAlbumData();
    } catch (error) {
      console.error('업로드 오류:', error);
      setToast({ message: error.message || '업로드 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setSaving(false);
      setUploadProgress(0);
      setProcessingProgress({ current: 0, total: 0 });
      setProcessingStatus('');
    }
  };

  // 삭제 처리
  const handleDelete = async () => {
    setDeleting(true);

    try {
      const photoIds = deleteDialog.photos.filter(
        (id) => typeof id === 'number' || !String(id).startsWith('teaser-')
      );
      const teaserIds = deleteDialog.photos
        .filter((id) => String(id).startsWith('teaser-'))
        .map((id) => parseInt(String(id).replace('teaser-', '')));

      for (const photoId of photoIds) {
        await adminAlbumApi.deleteAlbumPhoto(albumId, photoId);
      }

      for (const teaserId of teaserIds) {
        await adminAlbumApi.deleteAlbumTeaser(albumId, teaserId);
      }

      if (photoIds.length > 0) await refetchPhotos();
      if (teaserIds.length > 0) await refetchTeasers();
      setSelectedPhotos([]);

      const totalDeleted = photoIds.length + teaserIds.length;
      setToast({ message: `${totalDeleted}개 항목이 삭제되었습니다.`, type: 'success' });
    } catch (error) {
      console.error('삭제 오류:', error);
      setToast({ message: '삭제 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setDeleteDialog({ show: false, photos: [] });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout user={user}>
        <div
          className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-center"
          style={{ minHeight: 'calc(100dvh - 80px)' }}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteDialog.show}
        onClose={() => setDeleteDialog({ show: false, photos: [] })}
        onConfirm={handleDelete}
        title="사진 삭제"
        message={
          <>
            <span className="font-extrabold text-ink">{deleteDialog.photos.length}개</span>의 사진을
            삭제하시겠습니까?
            <br />
            <span className="text-[15px] text-[#C0392B]">이 작업은 되돌릴 수 없습니다.</span>
          </>
        }
        loading={deleting}
      />

      {/* 이미지 미리보기 */}
      <PhotoPreviewModal photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />

      <div className="mx-auto w-full max-w-[1180px] px-10 pb-[90px] pt-[52px]">
        {/* 크럼 + 타이틀 + 액션 버튼 */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-end justify-between"
        >
          <div>
            <div className="text-[12.5px] font-extrabold tracking-k25 text-mute">
              ADMIN / ALBUMS / PHOTOS
            </div>
            <div className="mt-3.5 flex items-center gap-[18px]">
              {album?.cover_thumb_url || album?.cover_original_url ? (
                <img
                  src={album?.cover_thumb_url || album?.cover_original_url}
                  alt={album?.title}
                  className="h-14 w-14 border border-hairline object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center border border-hairline bg-canvas text-faint">
                  <Disc3 size={24} />
                </div>
              )}
              <div>
                <h1 className="text-[34px] font-black leading-none tracking-[-1.5px] text-ink">
                  {album?.title}
                </h1>
                <div className="mt-1.5 text-[12px] font-extrabold tracking-k2 text-mute">
                  PHOTO MANAGER
                </div>
              </div>
            </div>
          </div>
          {pendingFiles.length > 0 && (
            <div className="flex items-end gap-2 pb-1">
              <button
                onClick={() => {
                  pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
                  setPendingFiles([]);
                }}
                className="border border-hairline bg-white px-[18px] py-[11px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
              >
                전체 취소
              </button>
              <button
                onClick={() => setUploadConfirmDialog(true)}
                disabled={pendingFiles.length === 0 || saving}
                className="bg-ink px-5 py-[11px] text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody disabled:opacity-50"
              >
                {saving ? '업로드 중...' : `${pendingFiles.length}장 업로드`}
              </button>
            </div>
          )}
        </motion.div>

        {/* 탭 UI */}
        <div className="mb-6 mt-[30px] flex gap-[26px] border-b-2 border-ink">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-0.5 pb-3 text-[13.5px] font-extrabold tracking-k25 transition-colors ${
              activeTab === 'upload'
                ? 'text-ink shadow-[inset_0_-3px_0_#141613]'
                : 'text-mute hover:text-ink'
            }`}
          >
            <Upload size={13} />
            UPLOAD
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-1.5 px-0.5 pb-3 text-[13.5px] font-extrabold tracking-k25 transition-colors ${
              activeTab === 'manage'
                ? 'text-ink shadow-[inset_0_-3px_0_#141613]'
                : 'text-mute hover:text-ink'
            }`}
          >
            <FolderOpen size={13} />
            MANAGE
            {photos.length > 0 && <span className="text-[13px] text-primary">{photos.length}</span>}
          </button>
        </div>

        {/* 업로드 탭 */}
        {activeTab === 'upload' && (
          <>
            {/* 업로드 설정 */}
            <div className="mb-6 flex items-end gap-9">
              {/* 타입 선택 */}
              <div>
                <label className="block text-[12px] font-extrabold tracking-k2 text-mute">사진 타입 *</label>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => setPhotoType('concept')}
                    disabled={pendingFiles.length > 0}
                    className={`border px-4 py-[9px] text-[13px] font-extrabold tracking-[0.5px] transition-colors ${
                      photoType === 'concept'
                        ? 'border-ink bg-ink text-white'
                        : 'border-hairline bg-white text-esub hover:border-ink'
                    } ${pendingFiles.length > 0 ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    컨셉 포토
                  </button>
                  <button
                    onClick={() => setPhotoType('teaser')}
                    disabled={pendingFiles.length > 0}
                    className={`border px-4 py-[9px] text-[13px] font-extrabold tracking-[0.5px] transition-colors ${
                      photoType === 'teaser'
                        ? 'border-ink bg-ink text-white'
                        : 'border-hairline bg-white text-esub hover:border-ink'
                    } ${pendingFiles.length > 0 ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    티저 이미지
                  </button>
                </div>
              </div>

              {/* 시작 번호 설정 */}
              <div>
                <label className="block text-[12px] font-extrabold tracking-k2 text-mute">시작 번호</label>
                <input
                  type="number"
                  min="1"
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1.5 w-[90px] border-b-2 border-ink bg-transparent px-0.5 pb-1.5 pt-1 text-center text-[16px] font-bold text-ink outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                />
              </div>

              <p className="pb-1.5 text-[13px] leading-relaxed text-mute">
                파일명은{' '}
                <b className="font-extrabold text-ink">
                  {String(startNumber).padStart(2, '0')}.webp ~{' '}
                  {String(startNumber + Math.max(0, pendingFiles.length - 1)).padStart(2, '0')}.webp
                </b>{' '}
                로 저장됩니다
                <br />
                {pendingFiles.length > 0
                  ? '파일이 추가된 상태에서는 타입을 변경할 수 없습니다.'
                  : photoType === 'teaser'
                    ? '티저 이미지는 순서만 지정하면 됩니다.'
                    : '추가 업로드 시 기존 사진 다음 번호로 설정하세요.'}
              </p>
            </div>

            {/* 업로드 진행률 */}
            {saving && (
              <div className="mb-6 border border-ink bg-white px-5 py-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-esub">
                    {uploadProgress < 100
                      ? '파일 업로드 중...'
                      : processingProgress.current > 0
                        ? processingStatus ||
                          `${processingProgress.current}/${processingProgress.total} 처리 중...`
                        : '서버 연결 중...'}
                  </span>
                  <span
                    className="text-[13.5px] font-extrabold text-primary"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {uploadProgress < 100
                      ? `${uploadProgress}%`
                      : processingProgress.total > 0
                        ? `${Math.round((processingProgress.current / processingProgress.total) * 100)}%`
                        : '0%'}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden bg-canvas">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width:
                        uploadProgress < 100
                          ? `${uploadProgress}%`
                          : processingProgress.total > 0
                            ? `${(processingProgress.current / processingProgress.total) * 100}%`
                            : '0%',
                    }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-ink"
                  />
                </div>
              </div>
            )}

            {/* 2-column 레이아웃 */}
            <div ref={photoListRef} className="flex gap-6">
              {/* 드래그 앤 드롭 영역 + 파일 목록 */}
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex-1 border border-dashed transition-colors ${
                  dragOver ? 'border-ink bg-canvas' : 'border-faint bg-white'
                }`}
              >
                {/* 드래그 오버레이 */}
                {dragOver && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/80">
                    <div className="text-center">
                      <Upload size={40} className="mx-auto mb-2 text-ink" />
                      <p className="text-[14.5px] font-extrabold text-ink">여기에 사진을 놓으세요</p>
                    </div>
                  </div>
                )}

                {pendingFiles.length === 0 ? (
                  <div className="py-20 text-center">
                    <Image size={40} className="mx-auto mb-4 text-faint" />
                    <p className="mb-1.5 text-[14.5px] font-semibold text-esub">사진을 드래그하여 업로드하세요</p>
                    <p className="mb-5 text-[13px] text-mute">
                      {photoType === 'teaser' ? 'JPG · PNG · WebP · MP4 지원' : 'JPG · PNG · WebP 지원'}
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center bg-ink px-5 py-3 text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody"
                    >
                      + 파일 선택
                    </button>
                    {photoType === 'concept' && (
                      <div className="mx-auto mt-7 max-w-sm border-t border-hairline pt-6">
                        <p className="mb-3 text-[13px] text-mute">
                          또는 X 게시물 일정의 이미지를 바로 가져오기 (여러 개: 1-5,7,8)
                        </p>
                        <div className="flex items-center justify-center gap-2.5">
                          <input
                            type="text"
                            value={importScheduleId}
                            onChange={(e) => setImportScheduleId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !importing && handleImportFromSchedule()}
                            placeholder="예: 1-5,7,8"
                            className="w-44 border-b-2 border-ink bg-transparent px-1 pb-1.5 pt-1 text-center text-[14.5px] font-bold text-ink placeholder-faint outline-none"
                          />
                          <button
                            onClick={handleImportFromSchedule}
                            disabled={importing}
                            className="border border-ink px-4 py-2 text-[13px] font-extrabold tracking-k1 text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-50"
                          >
                            {importing ? '가져오는 중...' : '가져오기'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-[13px] text-mute">
                        드래그하여 순서를 변경할 수 있습니다. 순서대로{' '}
                        <b className="font-extrabold text-ink">01.webp, 02.webp...</b> 로 저장됩니다.
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[13px] font-extrabold text-primary transition-colors hover:text-green-deep"
                      >
                        + 더 추가
                      </button>
                    </div>

                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                      onDragEnd={handleDndEnd}
                    >
                      <SortableContext
                        items={pendingFiles.map((f) => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2.5">
                          {pendingFiles.map((file, index) => (
                            <PendingFileItem
                              key={file.id}
                              file={file}
                              index={index}
                              startNumber={startNumber}
                              photoType={photoType}
                              members={members}
                              pendingFiles={pendingFiles}
                              onPreview={setPreviewPhoto}
                              onDelete={setPendingDeleteId}
                              onUpdateFile={updatePendingFile}
                              onToggleMember={toggleMember}
                              onChangeGroupType={changeGroupType}
                              onMoveToPosition={moveToPosition}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </div>

              {/* 일괄 편집 도구 */}
              {pendingFiles.length > 0 && photoType === 'concept' && (
                <div className="w-80 flex-shrink-0">
                  <div className="sticky top-24 space-y-4">
                  <BulkEditPanel
                    bulkEdit={bulkEdit}
                    setBulkEdit={setBulkEdit}
                    startNumber={startNumber}
                    pendingFilesCount={pendingFiles.length}
                    members={members}
                    onApply={applyBulkEdit}
                  />

                  {/* 이미지 추가 */}
                  <div className="border border-hairline bg-white px-6 pb-6 pt-[22px]">
                    <h3 className="text-[13px] font-extrabold tracking-k25 text-ink">ADD IMAGES</h3>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 flex w-full items-center justify-center border border-dashed border-faint bg-white py-2.5 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink"
                    >
                      + 파일 선택
                    </button>
                    <p className="mb-2 mt-4 text-[12.5px] text-mute">또는 X 게시물 일정에서 가져오기 (여러 개: 1-5,7,8)</p>
                    <div className="flex items-end gap-2.5">
                      <input
                        type="text"
                        value={importScheduleId}
                        onChange={(e) => setImportScheduleId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !importing && handleImportFromSchedule()}
                        placeholder="예: 1-5,7,8"
                        className="min-w-0 flex-1 border-b-2 border-ink bg-transparent px-1 pb-1.5 pt-1 text-[14.5px] font-bold text-ink placeholder-faint outline-none"
                      />
                      <button
                        onClick={handleImportFromSchedule}
                        disabled={importing}
                        className="shrink-0 whitespace-nowrap border border-ink px-3.5 py-2 text-[12.5px] font-extrabold tracking-k1 text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-50"
                      >
                        {importing ? '가져오는 중' : '가져오기'}
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* 관리 탭 */}
        {activeTab === 'manage' && (
          <div>
            {/* 서브탭 + 액션 */}
            <div className="mb-5 flex items-end justify-between border-b border-hairline">
              <div className="flex gap-6">
                <button
                  onClick={() => {
                    setManageSubTab('concept');
                    setSelectedPhotos([]);
                  }}
                  className={`flex items-baseline gap-1.5 px-0.5 pb-3 text-[13.5px] font-extrabold tracking-[0.5px] transition-colors ${
                    manageSubTab === 'concept'
                      ? 'text-ink shadow-[inset_0_-2px_0_#141613]'
                      : 'text-mute hover:text-ink'
                  }`}
                >
                  컨셉 포토
                  <span className="text-[13px] text-primary">{photos.length}</span>
                </button>
                <button
                  onClick={() => {
                    setManageSubTab('teaser');
                    setSelectedPhotos([]);
                  }}
                  className={`flex items-baseline gap-1.5 px-0.5 pb-3 text-[13.5px] font-extrabold tracking-[0.5px] transition-colors ${
                    manageSubTab === 'teaser'
                      ? 'text-ink shadow-[inset_0_-2px_0_#141613]'
                      : 'text-mute hover:text-ink'
                  }`}
                >
                  티저 이미지
                  <span className="text-[13px] text-primary">{teasers.length}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 pb-2">
                {manageSubTab === 'teaser' && (
                  <button
                    onClick={() => {
                      const allSelected =
                        teasers.length > 0 &&
                        teasers.every((t) => selectedPhotos.includes(`teaser-${t.id}`));
                      setSelectedPhotos(allSelected ? [] : teasers.map((t) => `teaser-${t.id}`));
                    }}
                    className="text-[13px] font-bold text-mute transition-colors hover:text-ink"
                  >
                    {teasers.length > 0 &&
                    teasers.every((t) => selectedPhotos.includes(`teaser-${t.id}`))
                      ? '선택 해제'
                      : '전체 선택'}
                  </button>
                )}
                {manageSubTab === 'concept' && editDirty && (
                  <>
                    <button
                      onClick={() =>
                        setEditPhotos(photos.map((p) => ({ ...p, members: [...(p.members || [])] })))
                      }
                      className="border border-hairline bg-white px-3.5 py-2 text-[12.5px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink"
                    >
                      되돌리기
                    </button>
                    <button
                      onClick={saveEditPhotos}
                      disabled={savingEdit}
                      className="bg-ink px-4 py-2 text-[12.5px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody disabled:opacity-50"
                    >
                      {savingEdit ? '저장 중...' : '변경사항 저장'}
                    </button>
                  </>
                )}
                {selectedPhotos.length > 0 && (
                  <button
                    onClick={() => setDeleteDialog({ show: true, photos: selectedPhotos })}
                    className="border border-[#E5B8B3] bg-[#F9E9E7] px-4 py-2 text-[12.5px] font-extrabold tracking-k1 text-[#C0392B] transition-colors hover:bg-[#F4DCD8]"
                  >
                    {selectedPhotos.length}개 삭제
                  </button>
                )}
              </div>
            </div>

            {/* 컨셉 포토 — 편집 리스트 (드래그 정렬/번호 이동/메타 편집) */}
            {manageSubTab === 'concept' &&
              (editPhotos.length === 0 ? (
                <p className="py-16 text-center text-[14.5px] text-mute">등록된 컨셉 포토가 없습니다</p>
              ) : (
                <DndContext
                  sensors={dndSensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={handleManageDndEnd}
                >
                  <SortableContext
                    items={editPhotos.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2.5">
                      {editPhotos.map((photo, index) => (
                        <RegisteredPhotoItem
                          key={photo.id}
                          photo={photo}
                          index={index}
                          totalCount={editPhotos.length}
                          members={members}
                          onPreview={(p) => setPreviewPhoto({ preview: p.medium_url || p.original_url })}
                          onUpdate={updateEditPhoto}
                          onToggleMember={toggleEditMember}
                          onMoveToPosition={moveEditToPosition}
                          onDelete={(id) => setDeleteDialog({ show: true, photos: [id] })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ))}

            {/* 티저 이미지 그리드 */}
            {manageSubTab === 'teaser' && (
              <PhotoGrid
                items={teasers}
                selectedItems={selectedPhotos}
                onToggleSelect={(id) => {
                  setSelectedPhotos((prev) =>
                    prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                  );
                }}
                type="teaser"
              />
            )}
          </div>
        )}

        {/* 삭제 확인 다이얼로그 */}
        <AnimatePresence>
          {pendingDeleteId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setPendingDeleteId(null)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="mx-4 w-full max-w-sm border border-ink bg-white p-7"
              >
                <h3 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">사진을 삭제할까요?</h3>
                <p className="mt-2 text-[14px] text-mute">이 사진을 목록에서 제거합니다.</p>
                <div className="mt-7 flex justify-end gap-2">
                  <button
                    onClick={() => setPendingDeleteId(null)}
                    className="border border-hairline bg-white px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink"
                  >
                    취소
                  </button>
                  <button
                    onClick={confirmDeletePendingFile}
                    className="bg-[#C0392B] px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-[#A93226]"
                  >
                    삭제
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 업로드 확인 다이얼로그 */}
        <AnimatePresence>
          {uploadConfirmDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setUploadConfirmDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="mx-4 w-full max-w-md border border-ink bg-white p-7"
              >
                <h3 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">사진을 업로드할까요?</h3>
                <div className="mt-5 border-t-2 border-ink text-[14px]">
                  <div className="flex items-baseline justify-between border-b border-hairline px-0.5 py-3">
                    <span className="text-[12px] font-extrabold tracking-k2 text-mute">사진 타입</span>
                    <span className="font-bold text-ink">
                      {photoType === 'concept' ? '컨셉 포토' : '티저 이미지'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-hairline px-0.5 py-3">
                    <span className="text-[12px] font-extrabold tracking-k2 text-mute">파일 개수</span>
                    <span className="font-bold text-ink">{pendingFiles.length}개</span>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-hairline px-0.5 py-3">
                    <span className="text-[12px] font-extrabold tracking-k2 text-mute">파일명 범위</span>
                    <span className="font-bold text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {String(startNumber).padStart(2, '0')}.webp ~{' '}
                      {String(startNumber + pendingFiles.length - 1).padStart(2, '0')}.webp
                    </span>
                  </div>
                </div>
                <div className="mt-7 flex justify-end gap-2">
                  <button
                    onClick={() => setUploadConfirmDialog(false)}
                    className="border border-hairline bg-white px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => {
                      setUploadConfirmDialog(false);
                      handleUpload();
                    }}
                    className="bg-ink px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody"
                  >
                    업로드
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={photoType === 'teaser' ? 'image/*,video/mp4' : 'image/*'}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </AdminLayout>
  );
}

export default AdminAlbumPhotos;
