import { IsArray, IsString, IsUUID } from 'class-validator';

export class FireItemsDto {
  @IsUUID()
  orderId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  orderItemIds: string[];
}

export class UpdateBatchStatusDto {
  @IsString()
  status: 'DONE';
}
