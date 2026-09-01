USE NewArtX;

CREATE TABLE auctions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    starting_price DECIMAL(15, 4) NOT NULL,
    top_bid_amount DECIMAL(15, 4) NOT NULL,
    top_user_id BIGINT DEFAULT NULL,
    version INT DEFAULT 0,
    status ENUM('ACTIVE', 'CLOSED') DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- This index makes searching for active or recently closed auctions super fast
    INDEX idx_status_end_time (status, end_time)
) ENGINE=InnoDB;