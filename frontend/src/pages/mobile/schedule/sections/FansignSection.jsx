import { ExternalLink, PenLine, Users, Video } from 'lucide-react';
import { decodeHtmlEntities, Fact, formatFactDate } from './utils';

/**
 * Mobile 팬사인회 섹션 — 에디토리얼 리뉴얼
 * offline(대면): 형식 뱃지 + 팩트시트(장소) + 인라인 카카오맵
 * online(영통): 형식 뱃지 + 팩트시트(형식)
 */
const MOBILE_FANSIGN_FORMAT = {
  offline: { label: '대면 팬사인회', icon: PenLine, fact: '대면' },
  online: { label: '영상통화 팬사인회', icon: Video, fact: '영상통화 (비대면)' },
  both: { label: '대면 + 영상통화', icon: Users, fact: '대면 + 영상통화' },
};

/**
 * Mobile 팬사인회 섹션 — 주최·형식·링크 (장소는 당첨자 개별 안내라 미표기)
 */
function MobileFansignSection({ schedule }) {
  const meta = MOBILE_FANSIGN_FORMAT[schedule.format] || MOBILE_FANSIGN_FORMAT.offline;
  const Icon = meta.icon;
  const postUrls = schedule.postUrls || [];
  const linkLabel = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  };

  return (
    <div className="px-[22px] pb-16 pt-[26px]">
      {/* 형식 뱃지 */}
      <span className="inline-flex items-center gap-1.5 border border-ink px-3 py-[7px] text-[12px] font-extrabold tracking-k15 text-ink">
        <Icon size={12} />
        {meta.label}
      </span>

      {/* 제목 */}
      <h1
        className="mt-[18px] text-[24px] font-extrabold leading-[1.35] tracking-[-0.6px] text-ink"
        style={{ textWrap: 'balance' }}
      >
        {decodeHtmlEntities(schedule.title)}
      </h1>

      {/* 팩트 시트 */}
      <div className="mt-[22px] border-t-2 border-ink">
        <Fact k="DATE">{formatFactDate(schedule.date, schedule.time)}</Fact>
        {schedule.host && <Fact k="HOST">{schedule.host}</Fact>}
        <Fact k="FORMAT">{meta.fact}</Fact>
        {postUrls.length > 0 && (
          <Fact k="LINKS">
            <span className="flex flex-wrap gap-1.5">
              {postUrls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border border-hairline px-2.5 py-1.5 text-[13px] font-bold text-esub"
                >
                  {linkLabel(url)}
                  <ExternalLink size={10} />
                </a>
              ))}
            </span>
          </Fact>
        )}
      </div>

      <p className="mt-4 text-[13px] leading-[1.7] text-mute">장소는 당첨자에게 개별 안내됩니다.</p>
    </div>
  );
}

export default MobileFansignSection;
