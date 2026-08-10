/**
 * 관리자 테마 컬러 설정
 * - 자동: 커버가 있는 최신 앨범에서 대표색 추출
 * - 수동: 관리자가 직접 색 지정 (가독성 보정 적용)
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, Palette as PaletteIcon } from 'lucide-react';
import { AdminLayout, AdminPageHeader } from '@/components/pc/admin';
import { Toast } from '@/components/common';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { adminThemeApi } from '@/api/admin';
import { applyAndCachePalette } from '@/theme';

/** 색 스와치 (라벨 + hex) */
function Swatch({ label, color }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-9 w-9 shrink-0 border border-hairline"
        style={{ backgroundColor: color }}
      />
      <div className="leading-tight">
        <div className="text-[11px] font-extrabold tracking-k1 text-mute">{label}</div>
        <div className="font-mono text-[12.5px] font-bold text-ink">{color}</div>
      </div>
    </div>
  );
}

/** 팔레트 미리보기 (스와치 3개 + 샘플 버튼/칩) */
function PalettePreview({ palette }) {
  if (!palette) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
      <Swatch label="PRIMARY" color={palette.primary} />
      <Swatch label="SOFT" color={palette.soft} />
      <Swatch label="DEEP" color={palette.deep} />
      <div className="flex items-center gap-2">
        <span
          className="px-3.5 py-2 text-[13px] font-extrabold tracking-k1 text-white"
          style={{ backgroundColor: palette.primary }}
        >
          버튼
        </span>
        <span
          className="px-2.5 py-1.5 text-[13px] font-bold"
          style={{ backgroundColor: palette.soft, color: palette.deep }}
        >
          멤버칩
        </span>
        <span
          className="text-[13px] font-bold"
          style={{ color: palette.primary }}
        >
          링크 →
        </span>
      </div>
    </div>
  );
}

function Theme() {
  const { user } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('테마 컬러');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'theme'],
    queryFn: adminThemeApi.getAdminTheme,
  });

  const [mode, setMode] = useState('auto');
  const [manualColor, setManualColor] = useState('#548360');
  const [saving, setSaving] = useState(false);
  const [reextracting, setReextracting] = useState(false);

  // 서버 값으로 초기화
  useEffect(() => {
    if (!data) return;
    setMode(data.mode || 'auto');
    setManualColor(data.manualColor || data.resolved?.primary || '#548360');
  }, [data]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const resolved = await adminThemeApi.updateTheme({ mode, manualColor });
      applyAndCachePalette(resolved); // 전체 사이트 즉시 반영
      await refetch();
      setToast({ type: 'success', message: '테마가 저장되었습니다.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || '저장 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReextract = async () => {
    if (reextracting) return;
    setReextracting(true);
    try {
      const res = await adminThemeApi.reextractColors(true);
      await refetch();
      setToast({ type: 'success', message: `${res.updated}개 앨범 색을 다시 추출했습니다.` });
    } catch (err) {
      setToast({ type: 'error', message: err.message || '재추출 중 오류가 발생했습니다.' });
    } finally {
      setReextracting(false);
    }
  };

  const autoAlbum = data?.autoAlbum;
  const autoPalette = data?.autoPalette;
  const previewPalette =
    mode === 'manual'
      ? data?.manualColor === manualColor
        ? data?.manualPalette
        : null // 수동색을 바꿨으면 저장 전까지 보정 결과 미확정
      : autoPalette;

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="mx-auto max-w-[900px] px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader
            crumb="ADMIN / THEME"
          solid="THEME "
          outline="COLOR"
          right={
            <button
              type="button"
              onClick={handleReextract}
              disabled={reextracting}
              className="flex items-center gap-1.5 border border-ink px-3.5 py-2 text-[12.5px] font-extrabold tracking-k1 text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={13} className={reextracting ? 'animate-spin' : ''} />
              앨범 색 재추출
            </button>
          }
          />
        </motion.div>

        {isLoading ? (
          <div className="py-24 text-center text-[14.5px] text-mute">로딩 중...</div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
            className="mt-10 space-y-6"
          >
            {/* 현재 적용 중 */}
            <section className="border border-hairline bg-white p-6">
              <div className="mb-4 flex items-center gap-2 text-[12.5px] font-extrabold tracking-k2 text-mute">
                <Sparkles size={14} className="text-primary" />
                현재 적용 중
              </div>
              <PalettePreview palette={data?.resolved} />
              <div className="mt-4 text-[13px] text-esub">
                {data?.resolved?.source === 'manual'
                  ? '관리자가 지정한 수동 색상이 적용되어 있습니다.'
                  : data?.resolved?.source === 'auto'
                    ? '커버가 있는 최신 앨범에서 자동 추출된 색상입니다.'
                    : '앨범 색이 없어 기본 브랜드 색이 적용되어 있습니다.'}
              </div>
            </section>

            {/* 모드 선택 */}
            <section className="border border-hairline bg-white p-6">
              <div className="mb-4 text-[12.5px] font-extrabold tracking-k2 text-mute">모드</div>
              <div className="flex gap-2">
                {[
                  { key: 'auto', label: '자동', desc: '최신 앨범 색' },
                  { key: 'manual', label: '수동', desc: '직접 지정' },
                ].map((opt) => {
                  const active = mode === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setMode(opt.key)}
                      className={`flex-1 border px-4 py-3.5 text-left transition-colors ${
                        active ? 'border-ink bg-ink text-white' : 'border-hairline text-esub hover:border-ink'
                      }`}
                    >
                      <div className="text-[15px] font-extrabold">{opt.label}</div>
                      <div className={`text-[12.5px] ${active ? 'text-white/70' : 'text-mute'}`}>
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 자동 상세 */}
            {mode === 'auto' && (
              <section className="border border-hairline bg-white p-6">
                <div className="mb-4 text-[12.5px] font-extrabold tracking-k2 text-mute">
                  자동 추출 소스
                </div>
                {autoAlbum ? (
                  <div className="flex items-center gap-4">
                    {autoAlbum.coverThumbUrl && (
                      <img
                        src={autoAlbum.coverThumbUrl}
                        alt={autoAlbum.title}
                        className="h-20 w-20 shrink-0 border border-hairline object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-[15px] font-extrabold text-ink">{autoAlbum.title}</div>
                      <div className="mt-1 font-mono text-[12.5px] text-mute">
                        추출색 {autoAlbum.themeColor}
                      </div>
                      <div className="mt-3">
                        <PalettePreview palette={autoPalette} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[13.5px] text-mute">커버가 있는 앨범이 없습니다.</div>
                )}
              </section>
            )}

            {/* 수동 상세 */}
            {mode === 'manual' && (
              <section className="border border-hairline bg-white p-6">
                <div className="mb-4 flex items-center gap-2 text-[12.5px] font-extrabold tracking-k2 text-mute">
                  <PaletteIcon size={14} className="text-primary" />
                  색상 지정
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <input
                    type="color"
                    value={manualColor}
                    onChange={(e) => setManualColor(e.target.value.toUpperCase())}
                    className="h-14 w-16 cursor-pointer border border-hairline bg-white p-1"
                  />
                  <input
                    type="text"
                    value={manualColor}
                    onChange={(e) => {
                      let v = e.target.value.toUpperCase();
                      if (!v.startsWith('#')) v = `#${v}`;
                      setManualColor(v);
                    }}
                    maxLength={7}
                    className="w-32 border border-hairline px-3 py-2.5 font-mono text-[14px] font-bold text-ink focus:border-ink focus:outline-none"
                  />
                  <div
                    className="h-11 flex-1 min-w-[120px] border border-hairline"
                    style={{ backgroundColor: /^#[0-9A-F]{6}$/.test(manualColor) ? manualColor : undefined }}
                  />
                </div>
                <p className="mt-3 text-[12.5px] leading-relaxed text-mute">
                  선택한 색은 버튼·텍스트 가독성을 위해 명도·채도가 살짝 보정되어 적용됩니다. 저장하면 실제 적용
                  색상을 위 &lsquo;현재 적용 중&rsquo;에서 확인할 수 있습니다.
                </p>
              </section>
            )}

            {/* 저장 */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-ink px-8 py-3 text-[13.5px] font-extrabold tracking-k1 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AdminLayout>
  );
}

export default Theme;
