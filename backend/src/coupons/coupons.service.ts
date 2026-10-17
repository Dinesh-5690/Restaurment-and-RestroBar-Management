import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon, CouponDiscountType } from './entities/coupon.entity';
import { CreateCouponDto, UpdateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
  ) {}

  async create(dto: CreateCouponDto): Promise<Coupon> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.couponRepo.findOne({ where: { code } });
    if (existing) {
      throw new BadRequestException('Coupon code already exists');
    }

    this.validateDiscountRule(dto.discountType, dto.discountValue);

    const coupon = this.couponRepo.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      discountType: dto.discountType,
      discountValue: Number(dto.discountValue),
      minOrderAmount: Number(dto.minOrderAmount ?? 0),
      maxDiscountAmount: dto.maxDiscountAmount != null ? Number(dto.maxDiscountAmount) : null,
      usageLimit: dto.usageLimit ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      isActive: dto.isActive ?? true,
    });

    this.validateDateRange(coupon.startsAt, coupon.endsAt);
    return this.couponRepo.save(coupon);
  }

  async findAll(params: { status?: 'ALL' | 'ACTIVE' | 'INACTIVE'; search?: string }) {
    const { status = 'ALL', search } = params;
    const query = this.couponRepo.createQueryBuilder('coupon').orderBy('coupon.createdAt', 'DESC');

    if (status === 'ACTIVE') {
      query.andWhere('coupon.isActive = :isActive', { isActive: true });
    } else if (status === 'INACTIVE') {
      query.andWhere('coupon.isActive = :isActive', { isActive: false });
    }

    if (search?.trim()) {
      query.andWhere('(coupon.code LIKE :search OR coupon.name LIKE :search)', {
        search: `%${search.trim()}%`,
      });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.findOne(id);

    if (dto.discountType != null || dto.discountValue != null) {
      this.validateDiscountRule(dto.discountType ?? coupon.discountType, dto.discountValue ?? coupon.discountValue);
    }

    if (dto.startsAt !== undefined) coupon.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) coupon.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    this.validateDateRange(coupon.startsAt, coupon.endsAt);

    if (dto.name !== undefined) coupon.name = dto.name.trim();
    if (dto.description !== undefined) coupon.description = dto.description?.trim() ?? null;
    if (dto.discountType !== undefined) coupon.discountType = dto.discountType;
    if (dto.discountValue !== undefined) coupon.discountValue = Number(dto.discountValue);
    if (dto.minOrderAmount !== undefined) coupon.minOrderAmount = Number(dto.minOrderAmount);
    if (dto.maxDiscountAmount !== undefined) {
      coupon.maxDiscountAmount = dto.maxDiscountAmount != null ? Number(dto.maxDiscountAmount) : null;
    }
    if (dto.usageLimit !== undefined) coupon.usageLimit = dto.usageLimit ?? null;
    if (dto.isActive !== undefined) coupon.isActive = dto.isActive;

    return this.couponRepo.save(coupon);
  }

  async toggle(id: string): Promise<Coupon> {
    const coupon = await this.findOne(id);
    coupon.isActive = !coupon.isActive;
    return this.couponRepo.save(coupon);
  }

  async remove(id: string): Promise<void> {
    const coupon = await this.findOne(id);
    await this.couponRepo.remove(coupon);
  }

  async validateForOrder(code: string, orderAmount: number) {
    const coupon = await this.couponRepo.findOne({
      where: { code: code.trim().toUpperCase() },
    });

    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }

    const now = new Date();
    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is inactive');
    }
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.endsAt && now > coupon.endsAt) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    const roundedOrderAmount = Number(orderAmount || 0);
    if (roundedOrderAmount < coupon.minOrderAmount) {
      throw new BadRequestException(`Minimum order amount is ${coupon.minOrderAmount.toFixed(2)}`);
    }

    let discount = 0;
    if (coupon.discountType === CouponDiscountType.PERCENT) {
      discount = roundedOrderAmount * (coupon.discountValue / 100);
      if (coupon.maxDiscountAmount != null) {
        discount = Math.min(discount, coupon.maxDiscountAmount);
      }
    } else {
      discount = coupon.discountValue;
    }

    discount = Math.min(discount, roundedOrderAmount);
    discount = Number(discount.toFixed(2));

    return {
      couponId: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: discount,
      finalAmount: Number((roundedOrderAmount - discount).toFixed(2)),
    };
  }

  async incrementUsage(couponId: string): Promise<void> {
    await this.couponRepo.increment({ id: couponId }, 'usageCount', 1);
  }

  private validateDiscountRule(discountType: CouponDiscountType, discountValue: number) {
    if (discountType === CouponDiscountType.PERCENT && discountValue > 100) {
      throw new BadRequestException('Percent discount cannot exceed 100');
    }
  }

  private validateDateRange(startsAt?: Date, endsAt?: Date) {
    if (startsAt && endsAt && startsAt > endsAt) {
      throw new BadRequestException('startsAt cannot be later than endsAt');
    }
  }
}
