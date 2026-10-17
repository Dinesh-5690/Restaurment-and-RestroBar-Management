-- ============================================================
-- Restaurant Platform — MySQL Schema
-- Import this file via Hostinger phpMyAdmin or cPanel MySQL
-- NOTE: If you set synchronize:true in .env, TypeORM will
--       auto-create these tables. This file is a backup/reference.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`        varchar(36)  NOT NULL,
  `username`  varchar(255) NOT NULL,
  `password`  varchar(255) NOT NULL,
  `name`      varchar(255) NOT NULL,
  `role`      varchar(20)  NOT NULL DEFAULT 'WAITER',
  `salaryType` varchar(50) NULL,
  `salaryAmount` float     NULL,
  `basicDetails` text      NULL,
  `accessRights` json      NULL,
  `isActive`  tinyint(1)   NOT NULL DEFAULT 1,
  `createdAt` datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tables` (
  `id`             varchar(36)  NOT NULL,
  `tableNumber`    int          NOT NULL,
  `qrCodeId`       varchar(255) NULL,
  `qrCodeUrl`      text         NULL,
  `qrCodeImage`    longtext     NULL,
  `status`         varchar(20)  NOT NULL DEFAULT 'FREE',
  `currentOrderId` varchar(36)  NULL,
  `capacity`       int          NOT NULL DEFAULT 4,
  `location`       varchar(255) NULL,
  `createdAt`      datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`      datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_tables_number`  (`tableNumber`),
  UNIQUE KEY `UQ_tables_qrCodeId` (`qrCodeId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- menu_categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `menu_categories` (
  `id`             varchar(36)  NOT NULL,
  `name`           varchar(255) NOT NULL,
  `kitchenStation` varchar(50)  NULL,
  `sequence`       int          NOT NULL DEFAULT 0,
  `isActive`       tinyint(1)   NOT NULL DEFAULT 1,
  `description`    varchar(255) NULL,
  `createdAt`      datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`      datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_menu_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- menu_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id`              varchar(36)  NOT NULL,
  `categoryId`      varchar(36)  NOT NULL,
  `name`            varchar(255) NOT NULL,
  `description`     text         NULL,
  `price`           float        NOT NULL DEFAULT 0,
  `taxPercent`      float        NOT NULL DEFAULT 0,
  `prepTimeEstimate` int         NOT NULL DEFAULT 15,
  `isAvailable`     tinyint(1)   NOT NULL DEFAULT 1,
  `imageUrl`        varchar(255) NULL,
  `tags`            varchar(255) NULL,
  `createdAt`       datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`       datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_menu_items_category` (`categoryId`),
  CONSTRAINT `FK_menu_items_category`
    FOREIGN KEY (`categoryId`) REFERENCES `menu_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id`              varchar(36)  NOT NULL,
  `orderType`       varchar(20)  NOT NULL,
  `tableId`         varchar(36)  NULL,
  `tableNumber`     int          NULL,
  `status`          varchar(30)  NOT NULL DEFAULT 'CREATED',
  `subtotal`        float        NOT NULL DEFAULT 0,
  `taxAmount`       float        NOT NULL DEFAULT 0,
  `totalAmount`     float        NOT NULL DEFAULT 0,
  `customerName`    varchar(255) NULL,
  `customerPhone`   varchar(255) NULL,
  `rejectionReason` text         NULL,
  `notes`           text         NULL,
  `approvedBy`      varchar(255) NULL,
  `approvedAt`      datetime     NULL,
  `completedAt`     datetime     NULL,
  `mergeGroupId`    varchar(36)  NULL,
  `mergedWith`      varchar(255) NULL,
  `createdAt`       datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`       datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_orders_status`       (`status`),
  KEY `IDX_orders_mergeGroupId` (`mergeGroupId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- order_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id`               varchar(36)  NOT NULL,
  `orderId`          varchar(36)  NOT NULL,
  `menuItemId`       varchar(36)  NOT NULL,
  `menuItemName`     varchar(255) NOT NULL,
  `quantity`         int          NOT NULL DEFAULT 1,
  `unitPrice`        float        NOT NULL DEFAULT 0,
  `lineTotal`        float        NOT NULL DEFAULT 0,
  `status`           varchar(20)  NOT NULL DEFAULT 'PENDING',
  `kitchenStation`   varchar(50)  NULL,
  `notes`            text         NULL,
  `cookingStartedAt` datetime     NULL,
  `readyAt`          datetime     NULL,
  `servedAt`         datetime     NULL,
  `createdAt`        datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`        datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_order_items_order` (`orderId`),
  CONSTRAINT `FK_order_items_order`
    FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- kitchen_batches
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `kitchen_batches` (
  `id`          varchar(36)  NOT NULL,
  `orderId`     varchar(36)  NOT NULL,
  `batchNumber` int          NOT NULL DEFAULT 1,
  `status`      varchar(20)  NOT NULL DEFAULT 'FIRED',
  `firedBy`     varchar(255) NULL,
  `firedAt`     datetime     NULL,
  `doneAt`      datetime     NULL,
  `createdAt`   datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`   datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_kitchen_batches_order` (`orderId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- kitchen_batch_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `kitchen_batch_items` (
  `id`             varchar(36)  NOT NULL,
  `batchId`        varchar(36)  NOT NULL,
  `orderItemId`    varchar(36)  NOT NULL,
  `menuItemName`   varchar(255) NOT NULL,
  `quantity`       int          NOT NULL DEFAULT 1,
  `kitchenStation` varchar(50)  NULL,
  `notes`          text         NULL,
  PRIMARY KEY (`id`),
  KEY `FK_kbi_batch` (`batchId`),
  CONSTRAINT `FK_kbi_batch`
    FOREIGN KEY (`batchId`) REFERENCES `kitchen_batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
