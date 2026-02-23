CREATE TABLE IF NOT EXISTS meetings (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  meet_url TEXT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  duration_sec INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  run_at DATETIME NOT NULL,
  payload JSON NOT NULL,
  status ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED') DEFAULT 'PENDING',
  attempts INT DEFAULT 0,
  locked_by VARCHAR(255),
  locked_at DATETIME,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_jobs_status_run_at (status, run_at)
);

CREATE TABLE IF NOT EXISTS recordings (
  id VARCHAR(36) PRIMARY KEY,
  meeting_id VARCHAR(36) NOT NULL,
  status ENUM('RECORDING', 'TRANSCODING', 'READY', 'FAILED') NOT NULL,
  output_dir VARCHAR(1024) NOT NULL,
  raw_path VARCHAR(1024),
  hls_master_path VARCHAR(1024),
  mp4_720_path VARCHAR(1024),
  mp4_480_path VARCHAR(1024),
  mp3_path VARCHAR(1024),
  thumb_path VARCHAR(1024),
  duration_sec INT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);
