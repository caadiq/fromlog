-- 선예매 종료 시각
-- 선예매는 오픈 시각만 있고 종료가 없었다. 팬클럽 인증 종료와 값이 같은 경우가 많지만
-- 별개 개념이라(인증은 사전 절차, 선예매 종료는 판매 마감) 컬럼을 따로 둔다.
ALTER TABLE schedule_ticketing
  ADD COLUMN presale_end DATETIME NULL AFTER purchase_limit;
