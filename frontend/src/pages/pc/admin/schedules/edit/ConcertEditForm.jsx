import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

import AdminLayout from "@/components/pc/admin/layout/Layout";
import Toast from "@/components/common/Toast";
import { AdminPageHeader, F } from "@/components/pc/admin";
import { useToast, useDocumentTitle } from "@/hooks/common";
import { useAdminAuth } from "@/hooks/pc/admin";
import { EASE } from "@/components/editorial";
import { getMembers } from "@/api/public/members";
import { getAlbums } from "@/api/public/albums";
import { getConcertSchedule, updateConcertSchedule } from "@/api/admin/concert";

import ConcertInfoSection from "../form/concert/ConcertInfoSection";
import ScheduleSection from "../form/concert/ScheduleSection";
import SetlistSection from "../form/concert/SetlistSection";
import MerchandiseSection from "../form/concert/MerchandiseSection";

/**
 * 콘서트 일정 수정 폼
 */
function ConcertEditForm() {
  const { seriesId } = useParams();
  const navigate = useNavigate();
  const { toast, setToast } = useToast();
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  useDocumentTitle('일정 수정');

  // 멤버/앨범 데이터
  const { data: membersData = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getMembers,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const members = membersData.filter((m) => !m.is_former);

  const { data: albumsData = [] } = useQuery({
    queryKey: ["albums"],
    queryFn: getAlbums,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // 기존 데이터 로드
  const { data: concertData, isLoading: isLoadingConcert } = useQuery({
    queryKey: ["concert", seriesId],
    queryFn: () => getConcertSchedule(seriesId),
    enabled: isAuthenticated && !!seriesId,
  });

  // 폼 상태
  const [title, setTitle] = useState("");
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);
  const [rounds, setRoundsRaw] = useState([]);
  const [setlists, setSetlists] = useState({});
  const [merchandiseItems, setMerchandiseItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // 기존 데이터로 초기화
  useEffect(() => {
    if (concertData && !initialized) {
      setTitle(concertData.title || "");
      setPosterPreview(concertData.posterUrl || null);
      setRoundsRaw(concertData.rounds || []);
      setSetlists(concertData.setlists || {});
      setMerchandiseItems(
        (concertData.merchandise || []).map((m) => ({
          id: m.id,
          existingId: m.id,
          preview: m.thumbUrl || m.mediumUrl,
          file: null,
        }))
      );
      setInitialized(true);
    }
  }, [concertData, initialized]);

  // 회차 변경 시 세트리스트 동기화
  const setRounds = (updater) => {
    setRoundsRaw((prev) => {
      const newRounds = typeof updater === "function" ? updater(prev) : updater;

      setSetlists((prevSetlists) => {
        const updated = { ...prevSetlists };
        for (const round of newRounds) {
          if (!updated[round.id]) {
            const lastRound = prev[prev.length - 1];
            const source = prevSetlists[lastRound?.id] || [
              { id: 1, songName: "", albumName: "", memberIds: [] },
            ];
            let maxId = Object.values(updated)
              .flat()
              .reduce((max, s) => Math.max(max, s.id || 0), 0);
            updated[round.id] = source.map((s) => ({
              ...s,
              id: ++maxId,
              memberIds: [...s.memberIds],
            }));
          }
        }
        const roundIds = new Set(newRounds.map((r) => r.id));
        for (const key of Object.keys(updated)) {
          if (!roundIds.has(Number(key))) {
            delete updated[key];
          }
        }
        return updated;
      });

      return newRounds;
    });
  };

  // 포스터
  const handlePosterChange = (file) => {
    setPosterFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPosterPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handlePosterRemove = () => {
    setPosterFile(null);
    setPosterPreview(null);
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setToast({ type: "error", message: "공연명을 입력해주세요." });
      return;
    }

    const validRounds = rounds.filter((r) => r.date);
    if (validRounds.length === 0) {
      setToast({ type: "error", message: "최소 1개 이상의 공연 일정이 필요합니다." });
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());

      if (posterFile) {
        formData.append("poster", posterFile);
      }

      const roundsData = validRounds.map((r) => ({
        date: r.date,
        time: r.time || null,
        venueId: r.venue?.id || null,
        venueName: r.venue?.name || null,
        venueCountry: r.venue?.country || null,
        venueAddress: r.venue?.address || null,
        venueLat: r.venue?.lat || null,
        venueLng: r.venue?.lng || null,
      }));
      formData.append("rounds", JSON.stringify(roundsData));

      // 회차별 세트리스트
      const setlistsData = validRounds.map((r) => {
        const roundSetlist = setlists[r.id] || [];
        return roundSetlist
          .filter((s) => s.songName?.trim())
          .map((s) => ({
            songName: s.songName.trim(),
            albumName: s.albumName?.trim() || null,
            memberIds: s.memberIds || [],
          }));
      });
      formData.append("setlists", JSON.stringify(setlistsData));

      // 기존 유지할 굿즈 ID
      const keepIds = merchandiseItems
        .filter((item) => item.existingId && !item.file)
        .map((item) => item.existingId);
      formData.append("keepMerchandiseIds", JSON.stringify(keepIds));

      // 새 굿즈 파일
      merchandiseItems.forEach((item) => {
        if (item.file) {
          formData.append("merchandise", item.file);
        }
      });

      await updateConcertSchedule(seriesId, formData);

      // 콘서트 수정은 회차 schedules를 지우고 다시 만들어 id가 바뀐다.
      // 목록 캐시를 안 비우면 옛 id가 남아 그 행을 누를 때 상세가 404가 된다(실제로 겪음).
      // 목록 페이지는 scheduleToast가 있을 때만 캐시를 비우므로 다른 폼과 같은 방식으로 넘긴다.
      // 남겨두면 다음에 수정 화면을 열 때 저장 전 값이 채워진다
      queryClient.removeQueries({ queryKey: ["concert", seriesId] });
      sessionStorage.setItem(
        "scheduleToast",
        JSON.stringify({ type: "success", message: "콘서트 일정이 수정되었습니다." })
      );
      navigate("/admin/schedule");
    } catch (err) {
      console.error("콘서트 수정 실패:", err);
      setToast({ type: "error", message: err.message || "수정에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  };

  if (isLoadingConcert) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <span className="text-[14.5px] text-mute">로딩 중...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="mx-auto w-full max-w-[880px] px-10 pb-[90px] pt-[52px]">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="mb-10"
      >
        <AdminPageHeader crumb="ADMIN / SCHEDULE / EDIT" solid="EDIT " outline="CONCERT" />
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        onSubmit={handleSubmit}
        className="space-y-11"
      >
        <ConcertInfoSection
          title={title}
          setTitle={setTitle}
          posterPreview={posterPreview}
          onPosterChange={handlePosterChange}
          onPosterRemove={handlePosterRemove}
        />

        <ScheduleSection rounds={rounds} setRounds={setRounds} />

        <MerchandiseSection
          items={merchandiseItems}
          setItems={setMerchandiseItems}
        />

        <SetlistSection
          rounds={rounds}
          setlists={setlists}
          setSetlists={setSetlists}
          members={members}
          albums={albumsData}
        />

        <div className="!mt-10 flex items-center justify-end gap-2 border-t border-hairline pt-6">
          <button type="button" onClick={() => navigate("/admin/schedule")} className={F.btn}>
            취소
          </button>
          <button type="submit" disabled={saving} className={F.btnInk}>
            {saving ? "수정 중..." : "수정하기"}
          </button>
        </div>
      </motion.form>
      </div>
    </AdminLayout>
  );
}

export default ConcertEditForm;
