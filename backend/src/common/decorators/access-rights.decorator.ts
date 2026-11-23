import { SetMetadata } from '@nestjs/common';

export const ACCESS_RIGHTS_KEY = 'accessRights';
export type AccessRight = 'KITCHEN_INVENTORY' | 'BOTTLE_MANAGEMENT' | 'APPROVAL';
export const AccessRights = (...rights: AccessRight[]) => SetMetadata(ACCESS_RIGHTS_KEY, rights);
