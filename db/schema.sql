-- Test sonuçlarının saklandığı tablolar.
--
-- Bu dosya `npm run db:init` ile çalıştırılır ve tekrar çalıştırılmaya dayanıklıdır
-- (IF NOT EXISTS). Veri yalnızca kullanıcı sonuç ekranında açıkça onay verdiğinde yazılır.
--
-- Kişisel veri notu: Hiçbir kimlik bilgisi (ad, e-posta, IP) saklanmaz. `participant_id`
-- tarayıcıda üretilen rastgele bir değerdir ve kişiye değil tarayıcıya aittir.

CREATE TABLE IF NOT EXISTS test_results (
  id              uuid        PRIMARY KEY,
  participant_id  uuid        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Sunucunun hesapladığı puanlar (istemciden gelen değerlere güvenilmez; imzayla doğrulanır).
  estimated_iq    int         NOT NULL,
  accuracy_ratio  real        NOT NULL,
  score_ratio     real        NOT NULL,
  total_seconds   int         NOT NULL,
  question_count  int         NOT NULL,
  correct_count   int         NOT NULL,

  -- Kullanıcının isteğe bağlı olarak girdiği bilgiler; üçü de boş olabilir.
  birth_year      int,
  gender          text,
  province_code   int,

  CONSTRAINT test_results_birth_year_range CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100),
  CONSTRAINT test_results_gender_values CHECK (gender IS NULL OR gender IN ('kadin', 'erkek', 'belirtilmemis')),
  CONSTRAINT test_results_province_range CHECK (province_code IS NULL OR province_code BETWEEN 1 AND 81)
);

-- İstatistikler "her katılımcının ilk denemesi" üzerinden hesaplanır; bu indeks onu hızlandırır.
CREATE INDEX IF NOT EXISTS test_results_participant_created_idx
  ON test_results (participant_id, created_at);

CREATE TABLE IF NOT EXISTS question_results (
  result_id   uuid  NOT NULL REFERENCES test_results (id) ON DELETE CASCADE,
  question_id text  NOT NULL,
  status      text  NOT NULL,
  score       real  NOT NULL,
  seconds     int   NOT NULL,

  PRIMARY KEY (result_id, question_id),
  CONSTRAINT question_results_status_values
    CHECK (status IN ('correct', 'partial', 'wrong', 'unanswered'))
);

-- Soru bazlı istatistikler question_id üzerinden gruplanır.
CREATE INDEX IF NOT EXISTS question_results_question_idx
  ON question_results (question_id);
