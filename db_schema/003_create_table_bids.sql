USE NewArtX;

CREATE TABLE bids (
    id BIGINT AUTO_INCREMENT,
    auction_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    amount DECIMAL(15, 4) NOT NULL,
    request_id VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- In MySQL, when you partition a table, the partition column (created_at) 
    -- must be part of the Primary Key and Unique Keys.
    PRIMARY KEY (id, created_at),
    UNIQUE KEY uk_request_id (request_id, created_at),
    
    -- This index perfectly matches your GET /bid endpoint requirements
    INDEX idx_auction_user_amount (auction_id, user_id, amount)
) ENGINE=InnoDB
-- We split the table by month. September 2026, October 2026, etc.
PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
    PARTITION p202609 VALUES LESS THAN (202610),
    PARTITION p202610 VALUES LESS THAN (202611),
    PARTITION p202611 VALUES LESS THAN (202612),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);