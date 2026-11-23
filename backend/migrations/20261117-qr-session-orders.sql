ALTER TABLE `orders`
  ADD COLUMN `sessionId` varchar(36) NULL AFTER `tableId`,
  ADD COLUMN `clientRequestId` varchar(36) NULL AFTER `sessionId`,
  ADD UNIQUE KEY `UQ_orders_clientRequestId` (`clientRequestId`),
  ADD KEY `IDX_orders_table_session` (`tableId`, `sessionId`);
