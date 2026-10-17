import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { ManualAttendanceDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async checkIn(currentUser: User, note?: string): Promise<Attendance> {
    const today = this.today();
    const existing = await this.attendanceRepo.findOne({
      where: { userId: currentUser.id, attendanceDate: today },
    });

    if (existing?.checkInAt) {
      throw new BadRequestException('Already checked in for today');
    }

    if (existing && !existing.checkInAt) {
      existing.checkInAt = new Date();
      existing.note = note?.trim() || existing.note;
      existing.updatedBy = currentUser.name;
      return this.attendanceRepo.save(existing);
    }

    const record = this.attendanceRepo.create({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      attendanceDate: today,
      checkInAt: new Date(),
      status: AttendanceStatus.PRESENT,
      isManual: false,
      note: note?.trim() || null,
      createdBy: currentUser.name,
      updatedBy: currentUser.name,
    });

    return this.attendanceRepo.save(record);
  }

  async checkOut(currentUser: User, note?: string): Promise<Attendance> {
    const today = this.today();
    const existing = await this.attendanceRepo.findOne({
      where: { userId: currentUser.id, attendanceDate: today },
    });

    if (!existing || !existing.checkInAt) {
      throw new BadRequestException('Check in first before checking out');
    }
    if (existing.checkOutAt) {
      throw new BadRequestException('Already checked out for today');
    }

    existing.checkOutAt = new Date();
    existing.workedMinutes = this.computeWorkedMinutes(existing.checkInAt, existing.checkOutAt);
    existing.note = note?.trim() || existing.note;
    existing.updatedBy = currentUser.name;

    return this.attendanceRepo.save(existing);
  }

  async getMyToday(currentUser: User): Promise<Attendance | null> {
    return this.attendanceRepo.findOne({
      where: { userId: currentUser.id, attendanceDate: this.today() },
    });
  }

  async createManual(dto: ManualAttendanceDto, actor: User): Promise<Attendance> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new BadRequestException('Invalid user selected');

    const existing = await this.attendanceRepo.findOne({
      where: { userId: dto.userId, attendanceDate: dto.attendanceDate },
    });
    if (existing) {
      throw new BadRequestException('Attendance already exists for this user/date');
    }

    const checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : null;
    const checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : null;

    if (checkInAt && checkOutAt && checkOutAt < checkInAt) {
      throw new BadRequestException('Check-out cannot be earlier than check-in');
    }

    const record = this.attendanceRepo.create({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      attendanceDate: dto.attendanceDate,
      checkInAt,
      checkOutAt,
      workedMinutes: this.computeWorkedMinutes(checkInAt, checkOutAt),
      status: dto.status ?? AttendanceStatus.PRESENT,
      isManual: true,
      note: dto.note?.trim() || null,
      createdBy: actor.name,
      updatedBy: actor.name,
    });

    return this.attendanceRepo.save(record);
  }

  async update(id: string, dto: UpdateAttendanceDto, actor: User): Promise<Attendance> {
    const record = await this.findOne(id);

    if (dto.attendanceDate !== undefined) record.attendanceDate = dto.attendanceDate;
    if (dto.checkInAt !== undefined) record.checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : null;
    if (dto.checkOutAt !== undefined) record.checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : null;
    if (dto.status !== undefined) record.status = dto.status;
    if (dto.note !== undefined) record.note = dto.note?.trim() || null;

    if (record.checkInAt && record.checkOutAt && record.checkOutAt < record.checkInAt) {
      throw new BadRequestException('Check-out cannot be earlier than check-in');
    }

    record.workedMinutes = this.computeWorkedMinutes(record.checkInAt, record.checkOutAt);
    record.isManual = true;
    record.updatedBy = actor.name;

    return this.attendanceRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.attendanceRepo.remove(record);
  }

  async findOne(id: string): Promise<Attendance> {
    const record = await this.attendanceRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Attendance record not found');
    return record;
  }

  async list(params: {
    from?: string;
    to?: string;
    userId?: string;
    status?: AttendanceStatus | 'ALL';
    search?: string;
  }): Promise<Attendance[]> {
    const { from, to, userId, status = 'ALL', search } = params;

    const q = this.attendanceRepo
      .createQueryBuilder('attendance')
      .orderBy('attendance.attendanceDate', 'DESC')
      .addOrderBy('attendance.checkInAt', 'DESC')
      .addOrderBy('attendance.createdAt', 'DESC');

    if (from) q.andWhere('attendance.attendanceDate >= :from', { from });
    if (to) q.andWhere('attendance.attendanceDate <= :to', { to });
    if (userId) q.andWhere('attendance.userId = :userId', { userId });
    if (status !== 'ALL') q.andWhere('attendance.status = :status', { status });

    if (search?.trim()) {
      q.andWhere('(attendance.userName LIKE :search OR attendance.userRole LIKE :search OR attendance.note LIKE :search)', {
        search: `%${search.trim()}%`,
      });
    }

    return q.getMany();
  }

  async summary(params: {
    from?: string;
    to?: string;
    userId?: string;
  }) {
    const entries = await this.list({ ...params, status: 'ALL' });

    const totals = {
      records: entries.length,
      present: 0,
      late: 0,
      halfDay: 0,
      absent: 0,
      leave: 0,
      totalWorkedHours: 0,
      payableDays: 0,
    };

    const userMap = new Map<string, {
      userId: string;
      userName: string;
      role: string;
      records: number;
      workedHours: number;
      presentDays: number;
      lateDays: number;
      halfDays: number;
      absentDays: number;
      leaveDays: number;
      payableDays: number;
    }>();

    for (const r of entries) {
      totals.totalWorkedHours += (r.workedMinutes || 0) / 60;
      if (r.status === AttendanceStatus.PRESENT) {
        totals.present += 1;
        totals.payableDays += 1;
      }
      if (r.status === AttendanceStatus.LATE) {
        totals.late += 1;
        totals.payableDays += 1;
      }
      if (r.status === AttendanceStatus.HALF_DAY) {
        totals.halfDay += 1;
        totals.payableDays += 0.5;
      }
      if (r.status === AttendanceStatus.ABSENT) totals.absent += 1;
      if (r.status === AttendanceStatus.LEAVE) totals.leave += 1;

      if (!userMap.has(r.userId)) {
        userMap.set(r.userId, {
          userId: r.userId,
          userName: r.userName,
          role: r.userRole,
          records: 0,
          workedHours: 0,
          presentDays: 0,
          lateDays: 0,
          halfDays: 0,
          absentDays: 0,
          leaveDays: 0,
          payableDays: 0,
        });
      }

      const u = userMap.get(r.userId)!;
      u.records += 1;
      u.workedHours += (r.workedMinutes || 0) / 60;
      if (r.status === AttendanceStatus.PRESENT) { u.presentDays += 1; u.payableDays += 1; }
      if (r.status === AttendanceStatus.LATE) { u.lateDays += 1; u.payableDays += 1; }
      if (r.status === AttendanceStatus.HALF_DAY) { u.halfDays += 1; u.payableDays += 0.5; }
      if (r.status === AttendanceStatus.ABSENT) u.absentDays += 1;
      if (r.status === AttendanceStatus.LEAVE) u.leaveDays += 1;
    }

    totals.totalWorkedHours = Number(totals.totalWorkedHours.toFixed(2));
    totals.payableDays = Number(totals.payableDays.toFixed(2));

    const byUser = Array.from(userMap.values())
      .map((u) => ({
        ...u,
        workedHours: Number(u.workedHours.toFixed(2)),
        payableDays: Number(u.payableDays.toFixed(2)),
      }))
      .sort((a, b) => b.payableDays - a.payableDays);

    return { totals, byUser };
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private computeWorkedMinutes(checkInAt?: Date, checkOutAt?: Date): number {
    if (!checkInAt || !checkOutAt) return 0;
    const mins = Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000);
    return Math.max(0, mins);
  }
}
