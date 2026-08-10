-- 추천 검색어 테이블

-- 검색어 테이블 (Unigram)
CREATE TABLE IF NOT EXISTS suggestion_queries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    query VARCHAR(255) NOT NULL UNIQUE,
    count INT DEFAULT 1,
    last_searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_query_prefix (query(50)),
    INDEX idx_count (count DESC),
    INDEX idx_last_searched (last_searched_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 단어 쌍 테이블 (Bi-gram)
CREATE TABLE IF NOT EXISTS suggestion_word_pairs (
    word1 VARCHAR(100) NOT NULL,
    word2 VARCHAR(100) NOT NULL,
    count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (word1, word2),
    INDEX idx_word1_count (word1, count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 초성 인덱스 테이블
CREATE TABLE IF NOT EXISTS suggestion_chosung (
    chosung VARCHAR(50) NOT NULL,
    word VARCHAR(100) NOT NULL,
    count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chosung, word),
    INDEX idx_chosung (chosung),
    INDEX idx_count (count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
