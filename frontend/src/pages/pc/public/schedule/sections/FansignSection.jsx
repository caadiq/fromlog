import { ExternalLink, PenLine, Video, Users } from 'lucide-react';
import { decodeHtmlEntities } from './utils';
import Crumb from './Crumb';

/**
 * PC 팬사인회 상세 — 에디토리얼 리뉴얼
 * 중앙 컬럼 — 크럼·형식뱃지·제목·팩트시트(주최/형식/링크)
 * 장소는 당첨자에게 개별 안내되므로 표기하지 않고 주최(음반점)를 보여준다.
 */
export const FANSIGN_FORMAT = {
  offline: { label: '대면 팬사인회', icon: PenLine, fact: '대면' },
  online: { label: '영상통화 팬사인회', icon: Video, fact: '영상통화 (비대면)' },
  both: { label: '대면 + 영상통화 팬사인회', icon: Users, fact: '대면 + 영상통화' },
};

function FansignSection({ schedule }) {
  const meta = FANSIGN_FORMAT[schedule.format] || FANSIGN_FORMAT.offline;
  const Icon = meta.icon;
  const postUrls = schedule.postUrls || [];

  const linkLabel = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  };

  // 팩트 시트 (날짜는 크럼에 표기하므로 제외)
  const facts = [];
  if (schedule.host) {
    facts.push({ k: 'HOST', v: schedule.host });
  }
  facts.push({ k: 'FORMAT', v: meta.fact });
  if (postUrls.length > 0) {
    facts.push({
      k: 'LINKS',
      v: (
        <span className="flex flex-wrap gap-1.5">
          {postUrls.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-hairline px-3 py-1.5 text-[14.5px] font-bold text-esub transition-colors hover:border-ink hover:text-ink"
            >
              {linkLabel(url)}
              <ExternalLink size={11} />
            </a>
          ))}
        </span>
      ),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-[70px] pb-14 pt-[52px]">
      <Crumb schedule={schedule} />

      {/* 형식 뱃지 */}
      <span className="mt-[22px] inline-flex items-center gap-2 self-start border border-ink px-[15px] py-[9px] text-[12.5px] font-extrabold tracking-k15 text-ink">
        <Icon size={13} />
        {meta.label}
      </span>

      {/* 제목 */}
      <h1
        className="mt-[24px] text-[34px] font-extrabold leading-[1.35] tracking-[-0.9px] text-ink"
        style={{ textWrap: 'balance' }}
      >
        {decodeHtmlEntities(schedule.title)}
      </h1>

      {/* 팩트 시트 */}
      <div className="mt-8 border-t-2 border-ink">
        {facts.map((f) => (
          <div
            key={f.k}
            className="grid grid-cols-[120px_1fr] items-baseline border-b border-hairline px-0.5 py-[15px]"
          >
            <span className="text-[13px] font-extrabold tracking-k25 text-mute">{f.k}</span>
            <span className="text-[16.5px] font-semibold leading-[1.6] text-ink">{f.v}</span>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[13.5px] leading-[1.7] text-mute">
        장소는 당첨자에게 개별 안내됩니다.
      </p>
    </div>
  );
}

export default FansignSection;
