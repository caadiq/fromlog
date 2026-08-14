import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Save } from "lucide-react";

import Toast from "@/components/common/Toast";
import { useToast } from "@/hooks/common";
import { useAdminAuth } from "@/hooks/pc/admin";
import { getMembers } from "@/api/public/members";
import { getAlbums } from "@/api/public/albums";
import { createConcertSchedule } from "@/api/admin/concert";

import ConcertInfoSection from "./ConcertInfoSection";
import ScheduleSection from "./ScheduleSection";
import SetlistSection from "./SetlistSection";
import MerchandiseSection from "./MerchandiseSection";

/**
 * 콘서트 일정 추가 폼
 */
function ConcertForm() {
  const navigate = useNavigate();
  const { toast, setToast } = useToast();
  const { isAuthenticated } = useAdminAuth();

  // 멤버 목록 조회
  const { data: membersData = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getMembers,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const members = membersData.filter((m) => !m.is_former);

  // 앨범 목록 조회 (곡 검색용)
  const { data: albumsData = [] } = useQuery({
    queryKey: ["albums"],
    queryFn: getAlbums,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // 콘서트 정보
  const [title, setTitle] = useState("");
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);

  // 공연 일정 (다회차)
  const [rounds, setRoundsRaw] = useState([
    { id: 1, date: "", time: "", venue: null },
  ]);

  // 회차 변경 시 세트리스트 동기화
  const setRounds = (updater) => {
    setRoundsRaw((prev) => {
      const newRounds = typeof updater === 'function' ? updater(prev) : updater;

      setSetlists((prevSetlists) => {
        const updated = { ...prevSetlists };
        // 새로 추가된 회차에 세트리스트 복사
        for (const round of newRounds) {
          if (!updated[round.id]) {
            // 마지막 회차의 세트리스트를 복사 (deep copy)
            const lastRound = prev[prev.length - 1];
            const source = prevSetlists[lastRound?.id] || [{ id: 1, songName: "", albumName: "", memberIds: [] }];
            let maxId = Object.values(updated).flat().reduce((max, s) => Math.max(max, s.id || 0), 0);
            updated[round.id] = source.map((s) => ({
              ...s,
              id: ++maxId,
              memberIds: [...s.memberIds],
            }));
          }
        }
        // 삭제된 회차의 세트리스트 제거
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

  // 회차별 세트리스트 (key: round id)
  const [setlists, setSetlists] = useState({
    1: [{ id: 1, songName: "", albumName: "", memberIds: [] }],
  });

  // 굿즈 이미지
  const [merchandiseItems, setMerchandiseItems] = useState([]);

  // 로딩 상태
  const [saving, setSaving] = useState(false);

  // 포스터 변경
  const handlePosterChange = (file) => {
    setPosterFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPosterPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 포스터 제거
  const handlePosterRemove = () => {
    setPosterFile(null);
    setPosterPreview(null);
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 유효성 검사
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

      // 기본 정보
      formData.append("title", title.trim());

      // 포스터
      if (posterFile) {
        formData.append("poster", posterFile);
      }

      // 회차 정보
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

      // 회차별 세트리스트 (rounds 순서에 맞춰 배열로 전송)
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

      // 굿즈 이미지
      merchandiseItems.forEach((item) => {
        if (item.file) {
          formData.append("merchandise", item.file);
        }
      });

      await createConcertSchedule(formData);

      // 목록 페이지는 scheduleToast가 있을 때만 캐시를 비운다 — 다른 폼과 같은 방식으로 넘긴다
      sessionStorage.setItem(
        "scheduleToast",
        JSON.stringify({ type: "success", message: "콘서트 일정이 저장되었습니다." })
      );
      navigate("/admin/schedule");
    } catch (err) {
      console.error("콘서트 저장 실패:", err);
      setToast({ type: "error", message: err.message || "저장에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={handleSubmit}
        className="space-y-11"
      >
        {/* 콘서트 정보 */}
        <ConcertInfoSection
          title={title}
          setTitle={setTitle}
          posterPreview={posterPreview}
          onPosterChange={handlePosterChange}
          onPosterRemove={handlePosterRemove}
        />

        {/* 공연 일정 */}
        <ScheduleSection rounds={rounds} setRounds={setRounds} />

        {/* 굿즈 */}
        <MerchandiseSection
          items={merchandiseItems}
          setItems={setMerchandiseItems}
        />

        {/* 세트리스트 */}
        <SetlistSection
          rounds={rounds}
          setlists={setlists}
          setSetlists={setSetlists}
          members={members}
          albums={albumsData}
        />

        {/* 버튼 */}
        <div className="!mt-10 flex items-center justify-end gap-2 border-t border-hairline pt-6">
          <button
            type="button"
            onClick={() => navigate("/admin/schedule")}
            className="border border-hairline bg-white px-[26px] py-[13px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-ink px-[26px] py-[13px] text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody disabled:opacity-50"
          >
            {saving ? "저장 중..." : "일정 추가"}
          </button>
        </div>
      </motion.form>
    </>
  );
}

export default ConcertForm;
