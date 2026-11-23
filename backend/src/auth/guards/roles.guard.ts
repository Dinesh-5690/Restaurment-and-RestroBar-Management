import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ACCESS_RIGHTS_KEY } from '../../common/decorators/access-rights.decorator';
import { UserRole } from '../../common/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredAccessRights = this.reflector.getAllAndOverride<string[]>(ACCESS_RIGHTS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if ((!requiredRoles || requiredRoles.length === 0) && (!requiredAccessRights || requiredAccessRights.length === 0)) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Access denied');
    const hasRole = requiredRoles?.includes(user.role) ?? false;
    const hasAccessRight = requiredAccessRights?.some((right) => user.accessRights?.includes(right)) ?? false;
    if (!hasRole && !hasAccessRight) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
